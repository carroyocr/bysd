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

# Los tokens de atleta se firmaban con una clave derivada, de modo que un token
# de atleta nunca valia en el panel ni al reves. Con la cuenta unica esa
# separacion desaparece —hay un solo token con roles dentro— y la clave derivada
# solo sigue viva para leer los tokens que ya estaban emitidos cuando se
# desplego el cambio. Se retira en cuanto caduquen (72 h). Ver
# PLAN_CUENTA_UNICA.md, fase 5.
ATHLETE_SECRET_KEY = SECRET_KEY + "-athletes"

# Los tres roles de una cuenta. Viven aqui, y no en `services.cuentas`, porque
# ese modulo importa de este: ponerlos alli haria el circulo.
FAN = "fan"
ATLETA = "athlete"
STAFF = "staff"


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


def normalizar_payload(payload: dict) -> dict:
    """Deja cualquier token en la forma nueva, con `roles`.

    Conviven tres formas mientras caducan las sesiones abiertas al desplegar:

      nuevo    {sub, email, username, roles, permissions, is_admin, ver: 2}
      panel    {username, is_admin, permissions}          sin `ver`
      atleta   {athlete_id, email, type: "athlete"}       otra firma

    Las dos heredadas se traducen aqui para que el resto del codigo vea siempre
    `roles`. Se conservan `username`, `permissions` e `is_admin` tal cual porque
    los routers del panel leen esos campos del token; cambiarlos obligaria a
    tocarlos todos a la vez, que es justo lo que no se quiere en esta fase.
    """
    if payload.get("ver"):
        payload.setdefault("roles", [FAN])
        return payload

    if payload.get("type") == "athlete":
        # Token de atleta ya emitido. Nunca lleva rol de staff: es lo que impide
        # que una sesion vieja de corredor se cuele en el panel.
        return {
            **payload,
            "sub": payload.get("athlete_id"),
            "roles": [FAN, ATLETA],
            "permissions": [],
            "is_admin": False,
        }

    # Token del panel ya emitido.
    return {
        **payload,
        "sub": None,
        "email": payload.get("username"),
        "roles": [FAN, STAFF],
        "permissions": payload.get("permissions") or [],
        "is_admin": bool(payload.get("is_admin")),
    }


def decodificar(token: str) -> dict:
    """Valida la firma contra las claves vigentes y normaliza el contenido."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        # Puede ser un token de atleta de los de antes, con la clave derivada.
        try:
            payload = jwt.decode(token, ATHLETE_SECRET_KEY, algorithms=[ALGORITHM])
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token expirado")
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Token invalido")

    return normalizar_payload(payload)


def tiene_rol(payload: dict, rol: str) -> bool:
    return rol in (payload.get("roles") or [])


def verify_admin_token(authorization: Optional[str]) -> dict:
    """Exige un token de alguien del equipo. Llamable a mano.

    Hasta la cuenta unica bastaba con que la firma fuera valida, porque solo el
    panel se firmaba con esta clave. Ahora el corredor y el espectador tambien
    llevan token, asi que aqui se comprueba el rol: sin esta linea, cualquiera
    con cuenta entraria en las rutas que solo piden "token valido" —las cuatro
    de `/api/staff/mi-perfil`, el cambio de contrasena de `users.py` y las que
    cuelgan de `race.verify_token`.

    Se mantiene el nombre a proposito: asi todo lo que ya llamaba a esta funcion
    queda protegido sin tener que tocarlo.
    """
    payload = decodificar(_extract_bearer(authorization))
    if not tiene_rol(payload, STAFF):
        raise HTTPException(status_code=403, detail="Esta zona es solo para el equipo")
    return payload


def verify_cuenta_token(authorization: Optional[str]) -> dict:
    """Cualquier cuenta con sesion abierta, sea del rol que sea."""
    return decodificar(_extract_bearer(authorization))


def require_admin(authorization: Optional[str] = Header(None)) -> dict:
    """Dependencia FastAPI: exige un token de alguien del equipo."""
    return verify_admin_token(authorization)


def require_athlete(authorization: Optional[str] = Header(None)) -> dict:
    """Dependencia FastAPI: exige una cuenta con rol de corredor."""
    payload = decodificar(_extract_bearer(authorization))
    if not tiene_rol(payload, ATLETA):
        raise HTTPException(status_code=403, detail="Necesitas una cuenta de corredor")
    return payload


def require_cuenta(authorization: Optional[str] = Header(None)) -> dict:
    """Dependencia FastAPI: basta con haber iniciado sesion."""
    return verify_cuenta_token(authorization)


# Permisos por tab del panel. Cada tab tiene su permiso propio; los permisos
# "sombrilla" historicos (control, athletes, volunteers, emails, config)
# siguen valiendo y abren todos los tabs de su grupo. Los endpoints exigen la
# sombrilla, y un permiso por tab satisface a la sombrilla de su grupo.
TAB_PERMISSION_GROUPS = {
    "race-control": "control",      # tab Control
    "laps": "control",              # tab Vueltas
    "app-avisos": "control",        # tab Avisos App (push)
    "registrations": "athletes",    # tab Atletas
    "results-2026": "athletes",     # tab Resultados 2026
    "athlete-profiles": "athletes", # tab Perfiles
    "seleccionados": "athletes",    # tab Seleccionados
    "assignments": "volunteers",    # tab Voluntarios (asignaciones)
    "volunteer-profiles": "volunteers",  # tab Perfiles (cuentas de voluntario)
    "shifts": "volunteers",         # tab Turnos
    "email-templates": "emails",    # tab Correos
    "email-composer": "emails",     # tab Enviar Correos
    "espectadores": "emails",       # tab Espectadores (cuentas de espectador)
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
