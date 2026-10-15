"""Acceso a las APIs de Google (Sheets, Drive...) desde el backend.

Las APIs de Google no aceptan una clave fija: exigen un access token OAuth2,
que dura una hora. Aqui se consigue de una de dos identidades y se cachea por
ambito (scope) hasta un minuto antes de que expire:

1. **Una cuenta de Google de la organizacion, por OAuth** (`GOOGLE_OAUTH_JSON`:
   `client_id`, `client_secret`, `refresh_token` y `email`). Es la que vale
   cuando lo que hay que tocar no lo podemos compartir nosotros: la hoja del
   Campeonato Mundial la controla la organizacion mundial y solo dio acceso a
   dos cuentas nuestras, asi que el backend escribe **como esa cuenta**. El
   refresh token se obtiene una sola vez con `scripts/google_oauth_token.py`.
   Si esta definida, manda.

2. **La cuenta de servicio del proyecto** (`GOOGLE_SERVICE_ACCOUNT_JSON`, o la
   de Firebase en `FCM_SERVICE_ACCOUNT_JSON`, que es la misma del proyecto
   `bysd-live`). Se firma un JWT con su llave privada. Sirve para lo que se le
   pueda compartir a su correo (`client_email`).

Sin dependencias nuevas: PyJWT (con cryptography, para RS256) y httpx ya
estaban. Se evita `google-auth` a proposito, como en `push_service.py`.

Si no hay ninguna identidad, `esta_configurado()` es False y `access_token`
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


def _leer_json(nombre: str, obligatorios: tuple) -> Optional[dict]:
    crudo = get_env(nombre)
    if not crudo:
        return None
    try:
        datos = json.loads(crudo)
    except json.JSONDecodeError:
        logger.error(f"{nombre} no es JSON valido")
        return None
    if any(not datos.get(campo) for campo in obligatorios):
        logger.error(f"{nombre} esta incompleto (faltan {', '.join(obligatorios)})")
        return None
    return datos


_OAUTH = _leer_json("GOOGLE_OAUTH_JSON", ("client_id", "client_secret", "refresh_token"))
_CUENTA = (_leer_json("GOOGLE_SERVICE_ACCOUNT_JSON", ("private_key", "client_email"))
           or _leer_json("FCM_SERVICE_ACCOUNT_JSON", ("private_key", "client_email")))

# scope -> (access_token, momento en que expira)
_cache: Dict[str, Tuple[Optional[str], float]] = {}
_lock = asyncio.Lock()


def esta_configurado() -> bool:
    return _OAUTH is not None or _CUENTA is not None


def por_oauth() -> bool:
    """True si el backend escribe como una cuenta de Google de la organizacion."""
    return _OAUTH is not None


def correo_de_la_cuenta() -> Optional[str]:
    """Con que identidad entra el backend en Google: lo que hay que compartir
    con ella (cuenta de servicio) o la cuenta que ya tiene acceso (OAuth)."""
    if _OAUTH is not None:
        return _OAUTH.get("email") or "la cuenta de Google configurada por OAuth"
    return (_CUENTA or {}).get("client_email")


async def _canjear(datos: dict, token_uri: str) -> Optional[dict]:
    try:
        async with httpx.AsyncClient(timeout=15) as cliente:
            respuesta = await cliente.post(token_uri, data=datos)
        respuesta.raise_for_status()
        return respuesta.json()
    except httpx.HTTPStatusError as e:
        logger.error(f"Google no dio access token: {e.response.status_code} {e.response.text[:300]}")
    except Exception as e:
        logger.error(f"No se pudo obtener el access token de Google: {e}")
    return None


async def _token_oauth(scope: str) -> Optional[dict]:
    # El ambito lo fija el consentimiento que dio la cuenta al obtener el
    # refresh token; aqui no se puede ampliar, solo renovar.
    return await _canjear(
        {
            "grant_type": "refresh_token",
            "client_id": _OAUTH["client_id"],
            "client_secret": _OAUTH["client_secret"],
            "refresh_token": _OAUTH["refresh_token"],
        },
        _OAUTH.get("token_uri", TOKEN_URI_POR_DEFECTO),
    )


async def _token_cuenta_de_servicio(scope: str) -> Optional[dict]:
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
    return await _canjear(
        {"grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": assertion},
        token_uri,
    )


async def access_token(scope: str) -> Optional[str]:
    """Un token vigente para ese ambito, o None si no hay identidad o Google falla."""
    if not esta_configurado():
        return None

    token, expira = _cache.get(scope, (None, 0.0))
    if token and time.time() < expira:
        return token

    async with _lock:
        token, expira = _cache.get(scope, (None, 0.0))
        if token and time.time() < expira:
            return token

        datos = await (_token_oauth(scope) if _OAUTH is not None else _token_cuenta_de_servicio(scope))
        nuevo = (datos or {}).get("access_token")
        if not nuevo:
            return None

        _cache[scope] = (nuevo, time.time() + int(datos.get("expires_in", 3600)) - 60)
        return nuevo
