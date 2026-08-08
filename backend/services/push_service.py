"""Envio de notificaciones push a la app BYSD Live.

Usa la API HTTP v1 de Firebase Cloud Messaging, que sirve tanto para Android
como para iOS (en iOS, Firebase reenvia a APNs con la llave que se sube al
proyecto de Firebase).

Autenticacion: FCM v1 no acepta una clave fija, exige un token OAuth2 de la
cuenta de servicio. Se firma un JWT con la llave privada de esa cuenta y se
canjea por un access token que dura una hora; aqui se cachea hasta un minuto
antes de que expire para no pedir uno en cada envio.

No hay dependencias nuevas: PyJWT (con cryptography, para RS256) y httpx ya
estaban en requirements.txt. Se evita `google-auth` a proposito, que arrastra
tres paquetes mas para hacer estas mismas treinta lineas.

Configuracion (variables de entorno, en Render):
  FCM_SERVICE_ACCOUNT_JSON  el JSON completo de la cuenta de servicio de
                            Firebase, en una sola linea.

Si la variable no esta definida, el modulo se queda inactivo y todo envio
devuelve 0 sin romper nada: asi el backend arranca igual en local y en
produccion antes de que exista el proyecto de Firebase.
"""
import asyncio
import json
import logging
import time
from typing import Iterable, Optional

import httpx
import jwt

from services.env_utils import get_env

logger = logging.getLogger(__name__)

SCOPE = "https://www.googleapis.com/auth/firebase.messaging"
TOKEN_URI_POR_DEFECTO = "https://oauth2.googleapis.com/token"

# Cuantos envios simultaneos como maximo. FCM v1 manda un mensaje por peticion
# y el dia de la carrera puede haber cientos de dispositivos; sin tope, un
# broadcast abriria cientos de conexiones a la vez desde un contenedor Starter.
MAX_SIMULTANEOS = 10

# Errores de FCM que significan "este token ya no sirve": el usuario desinstalo
# la app o borro sus datos. Se devuelven para poder limpiarlos de la base.
ERRORES_TOKEN_MUERTO = {"UNREGISTERED", "INVALID_ARGUMENT", "SENDER_ID_MISMATCH"}


def _cuenta_de_servicio() -> Optional[dict]:
    crudo = get_env("FCM_SERVICE_ACCOUNT_JSON")
    if not crudo:
        return None
    try:
        datos = json.loads(crudo)
    except json.JSONDecodeError:
        logger.error("FCM_SERVICE_ACCOUNT_JSON no es JSON valido; push desactivado")
        return None
    if not datos.get("private_key") or not datos.get("client_email"):
        logger.error("FCM_SERVICE_ACCOUNT_JSON incompleto; push desactivado")
        return None
    return datos


_CUENTA = _cuenta_de_servicio()

# (access_token, momento en que expira)
_token_cache: tuple = (None, 0.0)
_token_lock = asyncio.Lock()


def esta_configurado() -> bool:
    """True si hay credenciales de Firebase y por tanto se puede enviar."""
    return _CUENTA is not None


async def _access_token() -> Optional[str]:
    global _token_cache

    if _CUENTA is None:
        return None

    token, expira = _token_cache
    if token and time.time() < expira:
        return token

    async with _token_lock:
        # Otra corrutina pudo renovarlo mientras se esperaba el lock.
        token, expira = _token_cache
        if token and time.time() < expira:
            return token

        ahora = int(time.time())
        assertion = jwt.encode(
            {
                "iss": _CUENTA["client_email"],
                "scope": SCOPE,
                "aud": _CUENTA.get("token_uri", TOKEN_URI_POR_DEFECTO),
                "iat": ahora,
                "exp": ahora + 3600,
            },
            _CUENTA["private_key"],
            algorithm="RS256",
            headers={"kid": _CUENTA.get("private_key_id")},
        )

        try:
            async with httpx.AsyncClient(timeout=15) as cliente:
                respuesta = await cliente.post(
                    _CUENTA.get("token_uri", TOKEN_URI_POR_DEFECTO),
                    data={
                        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                        "assertion": assertion,
                    },
                )
            respuesta.raise_for_status()
            datos = respuesta.json()
        except Exception as e:
            logger.error(f"No se pudo obtener el access token de FCM: {e}")
            return None

        nuevo = datos.get("access_token")
        if not nuevo:
            logger.error("Respuesta de FCM sin access_token")
            return None

        _token_cache = (nuevo, time.time() + int(datos.get("expires_in", 3600)) - 60)
        return nuevo


def _mensaje(token: str, titulo: str, cuerpo: str, data: Optional[dict]) -> dict:
    """Cuerpo de la peticion a FCM para un dispositivo.

    `data` viaja siempre con valores de texto: FCM rechaza numeros y booleanos
    en ese bloque.
    """
    mensaje = {
        "token": token,
        "notification": {"title": titulo, "body": cuerpo},
        "android": {
            "priority": "high",
            "notification": {
                "sound": "default",
                # Agrupa los avisos de la carrera en una sola pila de la bandeja
                "tag": "bysd-live",
                "color": "#E77622",
            },
        },
        "apns": {
            "headers": {"apns-priority": "10"},
            "payload": {"aps": {"sound": "default", "badge": 1}},
        },
    }
    if data:
        mensaje["data"] = {k: str(v) for k, v in data.items() if v is not None}
    return mensaje


async def enviar(
    tokens: Iterable[str],
    titulo: str,
    cuerpo: str,
    data: Optional[dict] = None,
) -> dict:
    """Envia un aviso a varios dispositivos.

    Devuelve {"enviados": n, "fallidos": n, "tokens_muertos": [...]} para que
    quien llame pueda borrar de la base los que ya no existen.
    """
    tokens = [t for t in dict.fromkeys(tokens) if t]  # sin duplicados ni vacios
    if not tokens:
        return {"enviados": 0, "fallidos": 0, "tokens_muertos": []}

    access_token = await _access_token()
    if not access_token:
        return {"enviados": 0, "fallidos": len(tokens), "tokens_muertos": [], "error": "push no configurado"}

    url = f"https://fcm.googleapis.com/v1/projects/{_CUENTA['project_id']}/messages:send"
    cabeceras = {"Authorization": f"Bearer {access_token}"}
    limite = asyncio.Semaphore(MAX_SIMULTANEOS)

    enviados = 0
    fallidos = 0
    muertos = []

    async with httpx.AsyncClient(timeout=20) as cliente:

        async def uno(token: str):
            nonlocal enviados, fallidos
            async with limite:
                try:
                    respuesta = await cliente.post(
                        url,
                        headers=cabeceras,
                        json={"message": _mensaje(token, titulo, cuerpo, data)},
                    )
                except Exception as e:
                    fallidos += 1
                    logger.warning(f"Push fallido (red): {e}")
                    return

                if respuesta.status_code == 200:
                    enviados += 1
                    return

                fallidos += 1
                try:
                    detalle = respuesta.json().get("error", {})
                except Exception:
                    detalle = {}
                estado = detalle.get("status", "")
                if estado in ERRORES_TOKEN_MUERTO or respuesta.status_code == 404:
                    muertos.append(token)
                else:
                    logger.warning(f"Push rechazado por FCM ({respuesta.status_code}): {detalle}")

        await asyncio.gather(*(uno(t) for t in tokens))

    return {"enviados": enviados, "fallidos": fallidos, "tokens_muertos": muertos}
