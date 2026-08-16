"""Cuentas: una sola identidad para el corredor, el equipo y el espectador.

Hasta ahora habia dos sistemas de identidad completos y separados —`athletes`
con PBKDF2 y `admin_users` con bcrypt, cada uno con su firma de token— y del
espectador no se guardaba nada. Una misma persona que corre y ademas es
voluntaria tenia dos cuentas, dos contrasenas y dos huellas registradas en el
telefono; `push_devices` llego a guardar `athlete_email` y `staff_email` en el
mismo documento para que una pantalla no borrara lo de la otra.

Aqui vive la identidad y solo la identidad: correo, contrasena, nombre, roles y
permisos. Los perfiles se quedan donde estan —el del corredor en `athletes`, el
del voluntario en `volunteer_registrations`— y la cuenta apunta a ellos. Es lo
que permite deshacer con un despliegue en vez de con una restauracion: mientras
las colecciones viejas sigan enteras, esto es aditivo.

Ver PLAN_CUENTA_UNICA.md.
"""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt

from services.auth import ATLETA, FAN, STAFF, encode_admin_token

COLECCION = "accounts"

# Los tres roles viven en `services.auth` (este modulo importa de alli, y al
# reves haria el circulo). Todo el mundo tiene `fan`: es el suelo comun, y es lo
# que permite que un corredor siga a otro corredor sin logica especial.
ROLES_VALIDOS = {FAN, ATLETA, STAFF}

# Version del formato de token. Distingue los nuevos de los heredados, que
# viajan sin este campo y hay que traducir. Ver `auth.normalizar_payload`.
VERSION_TOKEN = 2

# El panel caduca antes que el perfil del corredor, igual que hasta ahora: son
# 12 h de sesion administrativa frente a 72 h de una cuenta personal.
HORAS_STAFF = 12
HORAS_PERSONA = 72

MIN_PASSWORD = 8


# ==================== CONTRASENAS ====================
#
# Conviven dos formatos mientras dure la migracion:
#
#   bcrypt          "$2b$12$..."      lo que usa el panel y lo que se escribe hoy
#   PBKDF2 heredado "<salt>:<hex>"    lo que traen las cuentas de `athletes`
#
# El verificador despacha por formato y, cuando acierta con uno heredado, lo
# reescribe en bcrypt. Asi la conversion ocurre sola segun entra la gente, sin
# pedirle a nadie que cambie nada ni mandar un correo que asuste.


def hash_password(password: str) -> str:
    """Hash nuevo, siempre bcrypt."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def es_heredado(guardado: str) -> bool:
    """True si el hash viene de `athletes` (PBKDF2) y no de bcrypt."""
    return bool(guardado) and not guardado.startswith("$2")


def _verificar_pbkdf2(password: str, guardado: str) -> bool:
    """El esquema que usaba `athletes.password_hash`: `<salt>:<hex>`."""
    try:
        salt, esperado = guardado.split(":")
    except ValueError:
        return False
    calculado = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100000)
    return secrets.compare_digest(calculado.hex(), esperado)


def verificar_password(password: str, guardado: Optional[str]) -> bool:
    """Comprueba la contrasena contra cualquiera de los dos formatos."""
    if not guardado or not password:
        return False
    if es_heredado(guardado):
        return _verificar_pbkdf2(password, guardado)
    try:
        return bcrypt.checkpw(password.encode("utf-8"), guardado.encode("utf-8"))
    except ValueError:
        # Hash corrupto o truncado: no es motivo para reventar el login.
        return False


# ==================== TOKENS ====================


def duracion(roles) -> timedelta:
    """Cuanto vive el token. Con rol de staff, lo que dura el panel."""
    return timedelta(hours=HORAS_STAFF if STAFF in (roles or []) else HORAS_PERSONA)


def emitir_token(cuenta: dict) -> str:
    """Token de una cuenta ya cargada de la base.

    Se firma con la misma clave que el panel. La separacion criptografica que
    habia antes —los tokens de atleta iban firmados con `SECRET + "-athletes"`,
    de modo que nunca valian en el panel— desaparece aqui, y esa garantia pasa a
    depender de los roles. Por eso `auth.require_admin` exige el rol `staff` y no
    solo una firma valida: sin esa comprobacion, cualquier corredor con cuenta
    entraria en las rutas del equipo.
    """
    roles = cuenta.get("roles") or [FAN]
    payload = {
        "sub": str(cuenta.get("_id") or ""),
        "email": cuenta.get("email"),
        # Dieciseis sitios de `routes/athletes.py` leen `payload["athlete_id"]`
        # para buscar el perfil. La cuenta lo lleva encima para que ninguno de
        # ellos tenga que cambiar: el token nuevo se comporta como el viejo alli
        # donde el codigo ya funcionaba.
        "athlete_id": (str(cuenta["athlete_profile_id"])
                       if cuenta.get("athlete_profile_id") else None),
        # Se mantiene `username` con el correo porque los routers del panel leen
        # ese campo del token (`staff_account`, `push`). Quitarlo obligaria a
        # tocarlos todos en esta misma fase, que es justo lo que no se quiere.
        "username": cuenta.get("email"),
        "roles": roles,
        "permissions": cuenta.get("permissions") or [],
        "is_admin": bool(cuenta.get("is_admin")),
        "ver": VERSION_TOKEN,
        "exp": datetime.now(timezone.utc) + duracion(roles),
    }
    return encode_admin_token(payload)


# ==================== ACCESO A LA BASE ====================


def normalizar_email(email: str) -> str:
    return (email or "").strip().lower()


async def asegurar_indices(db) -> None:
    """Indices de la coleccion. Idempotente: se puede llamar en cada arranque."""
    await db[COLECCION].create_index("email", unique=True)
    await db[COLECCION].create_index("roles")
    await db[COLECCION].create_index("athlete_profile_id", sparse=True)


async def por_email(db, email: str) -> Optional[dict]:
    return await db[COLECCION].find_one({"email": normalizar_email(email)})


async def por_id(db, cuenta_id) -> Optional[dict]:
    from bson import ObjectId

    try:
        return await db[COLECCION].find_one({"_id": ObjectId(str(cuenta_id))})
    except Exception:
        return None


async def crear(
    db,
    email: str,
    password: str,
    nombre: str,
    apellidos: str = "",
    roles=None,
    permissions=None,
    email_verified: bool = False,
    **extra,
) -> dict:
    """Crea una cuenta. El correo es unico y se guarda en minusculas."""
    correo = normalizar_email(email)
    roles = list(dict.fromkeys([FAN] + list(roles or [])))

    ahora = datetime.now(timezone.utc)
    doc = {
        "email": correo,
        "password_hash": hash_password(password),
        "nombre": (nombre or "").strip(),
        "apellidos": (apellidos or "").strip(),
        "roles": roles,
        "permissions": list(permissions or []),
        "is_admin": False,
        "email_verified": email_verified,
        "athlete_profile_id": None,
        "followed": [],
        "acepta_comunicaciones": False,
        "created_at": ahora,
        "updated_at": ahora,
        "last_login_at": None,
        **extra,
    }
    resultado = await db[COLECCION].insert_one(doc)
    doc["_id"] = resultado.inserted_id
    return doc


async def autenticar(db, email: str, password: str) -> Optional[dict]:
    """Devuelve la cuenta si la contrasena es correcta, o None.

    Si el hash era heredado y ha valido, se reescribe en bcrypt aqui mismo: es
    el unico momento en que se tiene la contrasena en claro, y hacerlo en el
    login es lo que convierte la coleccion entera sin avisar a nadie.
    """
    cuenta = await por_email(db, email)
    if not cuenta:
        return None

    guardado = cuenta.get("password_hash")
    if not verificar_password(password, guardado):
        return None

    cambios = {"last_login_at": datetime.now(timezone.utc)}
    if es_heredado(guardado):
        cambios["password_hash"] = hash_password(password)
        cuenta["password_hash"] = cambios["password_hash"]

    await db[COLECCION].update_one({"_id": cuenta["_id"]}, {"$set": cambios})
    return cuenta


async def anadir_rol(db, cuenta_id, rol: str, permissions=None) -> None:
    """Suma un rol a una cuenta que ya existe.

    Es lo que hace que el voluntario que ademas corre sea una sola persona: no
    se crea otra cuenta, se le anade el rol que le faltaba.
    """
    if rol not in ROLES_VALIDOS:
        raise ValueError(f"Rol desconocido: {rol}")

    cambios = {"$addToSet": {"roles": rol}, "$set": {"updated_at": datetime.now(timezone.utc)}}
    if permissions is not None:
        cambios["$set"]["permissions"] = list(permissions)

    await db[COLECCION].update_one({"_id": cuenta_id}, cambios)


def publica(cuenta: dict) -> dict:
    """La cuenta tal como puede salir en una respuesta: sin hash ni codigos."""
    return {
        "id": str(cuenta.get("_id", "")),
        "email": cuenta.get("email"),
        "nombre": cuenta.get("nombre"),
        "apellidos": cuenta.get("apellidos"),
        "roles": cuenta.get("roles") or [FAN],
        "permissions": cuenta.get("permissions") or [],
        "is_admin": bool(cuenta.get("is_admin")),
        "email_verified": bool(cuenta.get("email_verified")),
        "acepta_comunicaciones": bool(cuenta.get("acepta_comunicaciones")),
    }
