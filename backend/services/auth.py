"""Autenticacion y autorizacion del panel de administracion.

Un unico sitio donde vive el secreto JWT y donde se decide quien puede entrar.

Antes cada router tenia su propia copia del secreto con un valor por defecto
escrito en el codigo (`os.getenv("JWT_SECRET_KEY", "backyard-ultra-secret-2026")`).
Como esa variable no estaba definida en Render, produccion firmaba los tokens
con una cadena publica: cualquiera que leyera el repositorio podia emitirse un
token de administrador. Por eso aqui el secreto es obligatorio y el proceso no
arranca sin el: es preferible un fallo visible al desplegar que un panel
abierto sin que nadie se entere.
"""
import os
from typing import Callable, Optional

import jwt
from fastapi import Header, HTTPException

from services.env_utils import get_env

ALGORITHM = "HS256"
MIN_SECRET_LENGTH = 32

# Valores que se usaron como default en el codigo y que por tanto ya no son
# secretos: si alguien los pega en la variable de entorno, tampoco valen.
QUEMADOS = {
    "backyard-ultra-secret-2026",
    "backyard-ultra-secret-2024",
    "backyard-ultra-secret-2026-athletes",
    "backyard-ultra-secret-2024-athletes",
}


def _load_secret() -> str:
    secret = get_env("JWT_SECRET_KEY")

    if not secret:
        raise RuntimeError(
            "Falta la variable de entorno JWT_SECRET_KEY. Genera una con "
            "`python -c \"import secrets; print(secrets.token_urlsafe(48))\"` y "
            "definela en el dashboard de Render (Environment) y en backend/.env "
            "para desarrollo local."
        )

    if secret in QUEMADOS:
        raise RuntimeError(
            "JWT_SECRET_KEY tiene uno de los valores que estuvieron escritos en "
            "el codigo fuente. Son publicos: genera un secreto nuevo."
        )

    if len(secret) < MIN_SECRET_LENGTH:
        raise RuntimeError(
            f"JWT_SECRET_KEY es demasiado corta ({len(secret)} caracteres); "
            f"se requieren al menos {MIN_SECRET_LENGTH}."
        )

    return secret


SECRET_KEY = _load_secret()

# Los tokens de atleta se firman con una clave derivada: asi un token de atleta
# nunca es valido en el panel de administracion, ni al reves.
ATHLETE_SECRET_KEY = SECRET_KEY + "-athletes"


def _extract_bearer(authorization: Optional[str]) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No autorizado")
    return authorization[len("Bearer "):].strip()


def decode_admin_token(token: str) -> dict:
    """Valida la firma de un token del panel y devuelve su contenido."""
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token invalido")


def encode_admin_token(payload: dict) -> str:
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def verify_admin_token(authorization: Optional[str]) -> dict:
    """Version llamable a mano, para rutas que reciben el header sueltas."""
    return decode_admin_token(_extract_bearer(authorization))


def require_admin(authorization: Optional[str] = Header(None)) -> dict:
    """Dependencia FastAPI: exige un token valido del panel."""
    return verify_admin_token(authorization)


# Permisos por tab del panel. Cada tab tiene su permiso propio; los permisos
# "sombrilla" historicos (control, athletes, volunteers, emails, config)
# siguen valiendo y abren todos los tabs de su grupo. Los endpoints exigen la
# sombrilla, y un permiso por tab satisface a la sombrilla de su grupo.
TAB_PERMISSION_GROUPS = {
    "race-control": "control",      # tab Control
    "laps": "control",              # tab Vueltas
    "registrations": "athletes",    # tab Atletas
    "results-2026": "athletes",     # tab Resultados 2026
    "athlete-profiles": "athletes", # tab Perfiles
    "seleccionados": "athletes",    # tab Seleccionados
    "assignments": "volunteers",    # tab Voluntarios (asignaciones)
    "shifts": "volunteers",         # tab Turnos
    "email-templates": "emails",    # tab Correos
    "email-composer": "emails",     # tab Enviar Correos
    "whatsapp": "emails",           # tab WhatsApp
    "prensa": "emails",             # tab Prensa
    "race-config": "config",        # tab Carrera
    "tshirt": "config",             # tab Camisetas
    "capacitaciones": "config",     # tab Capacitaciones
}


def has_permission(payload: dict, permission: str) -> bool:
    if payload.get("is_admin"):
        return True
    permisos = payload.get("permissions") or []
    if "all" in permisos or permission in permisos:
        return True
    # Permisos por tab: cualquiera cuyo grupo sea el permiso exigido
    return any(TAB_PERMISSION_GROUPS.get(p) == permission for p in permisos)


def require_permission(permission: str) -> Callable:
    """Dependencia FastAPI: exige un token valido con un permiso concreto.

    Los permisos ya viajaban dentro del token desde el login, pero ningun
    endpoint los miraba: cualquier usuario secundario tenia el mismo alcance
    que el administrador principal.
    """

    def dependency(authorization: Optional[str] = Header(None)) -> dict:
        payload = verify_admin_token(authorization)
        if not has_permission(payload, permission):
            raise HTTPException(
                status_code=403,
                detail="No tienes permiso para esta operacion",
            )
        return payload

    return dependency
