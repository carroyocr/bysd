"""Acceso a las APIs de Google con la cuenta de servicio del proyecto.

Las APIs de Google (Firebase, Sheets, Drive...) no aceptan una clave fija:
exigen un access token OAuth2 de una cuenta de servicio, que se consigue
firmando un JWT con la llave privada de esa cuenta. El token dura una hora y
aqui se cachea por ambito (scope) hasta un minuto antes de que expire.

La cuenta es la misma del proyecto de Firebase (`bysd-live`), que ya vive en
`FCM_SERVICE_ACCOUNT_JSON`: una cuenta de servicio sirve para cualquier API
del proyecto que este habilitada. Si algun dia conviene separar, basta con
definir `GOOGLE_SERVICE_ACCOUNT_JSON`, que manda sobre la de Firebase.

Sin dependencias nuevas: PyJWT (con cryptography, para RS256) y httpx ya
estaban. Se evita `google-auth` a proposito, como en `push_service.py`.

Si no hay cuenta configurada, `esta_configurado()` es False y `access_token`
devuelve None: nada arranca peor por su ausencia.
"""
import asyncio
import json
import logging
import time
from typing import Dict, Optional, Tuple

import httpx
import jwt

from services.env_utils import get_env

logger = logging.getLogger(__name__)

TOKEN_URI_POR_DEFECTO = "https://oauth2.googleapis.com/token"


def _leer_cuenta() -> Optional[dict]:
    crudo = get_env("GOOGLE_SERVICE_ACCOUNT_JSON") or get_env("FCM_SERVICE_ACCOUNT_JSON")
    if not crudo:
        return None
    try:
        datos = json.loads(crudo)
    except json.JSONDecodeError:
        logger.error("La cuenta de servicio de Google no es JSON valido")
        return None
    if not datos.get("private_key") or not datos.get("client_email"):
        logger.error("La cuenta de servicio de Google esta incompleta")
        return None
    return datos


_CUENTA = _leer_cuenta()

# scope -> (access_token, momento en que expira)
_cache: Dict[str, Tuple[Optional[str], float]] = {}
_lock = asyncio.Lock()


def esta_configurado() -> bool:
    return _CUENTA is not None


def correo_de_la_cuenta() -> Optional[str]:
    """El correo con el que hay que compartir lo que la cuenta deba tocar."""
    return (_CUENTA or {}).get("client_email")


async def access_token(scope: str) -> Optional[str]:
    """Un token vigente para ese ambito, o None si no hay cuenta o Google falla."""
    if _CUENTA is None:
        return None

    token, expira = _cache.get(scope, (None, 0.0))
    if token and time.time() < expira:
        return token

    async with _lock:
        token, expira = _cache.get(scope, (None, 0.0))
        if token and time.time() < expira:
            return token

        ahora = int(time.time())
        token_uri = _CUENTA.get("token_uri", TOKEN_URI_POR_DEFECTO)
        assertion = jwt.encode(
            {
                "iss": _CUENTA["client_email"],
                "scope": scope,
                "aud": token_uri,
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
                    token_uri,
                    data={
                        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                        "assertion": assertion,
                    },
                )
            respuesta.raise_for_status()
            datos = respuesta.json()
        except Exception as e:
            logger.error(f"No se pudo obtener el access token de Google ({scope}): {e}")
            return None

        nuevo = datos.get("access_token")
        if not nuevo:
            logger.error("Respuesta de Google sin access_token")
            return None

        _cache[scope] = (nuevo, time.time() + int(datos.get("expires_in", 3600)) - 60)
        return nuevo
