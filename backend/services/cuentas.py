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
import logging
import secrets
import unicodedata
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt

from services.auth import ATLETA, FAN, STAFF, encode_admin_token

logger = logging.getLogger(__name__)

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


def version_de_sesion(cuenta: Optional[dict]) -> int:
    return int((cuenta or {}).get("sesion_ver") or 0)


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
        # Ver `sesion_vigente`: sube cuando alguien cambia la contrasena con un
        # codigo al correo, y deja atras las sesiones que hubiera abiertas.
        "sv": version_de_sesion(cuenta),
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


async def sincronizar_credenciales(
    db,
    email: str,
    password_hash: Optional[str] = None,
    email_verified: Optional[bool] = None,
    cerrar_sesiones: bool = False,
) -> bool:
    """Copia a la cuenta un cambio de contrasena o de verificacion.

    Los endpoints del perfil de corredor —restablecer contrasena, cambiarla,
    verificar el correo, y los equivalentes del panel— escriben en `athletes`,
    que es donde vivia todo. Desde que el login lee de `accounts`, si no se
    copia el cambio aqui pasa algo peor que un error: la operacion dice que fue
    bien y la contrasena nueva no sirve para entrar, mientras la vieja sigue
    valiendo. No falla nada a la vista, que es lo malo.

    `cerrar_sesiones` es para cuando la contrasena no la cambia quien conocia
    la anterior, sino quien demuestra el correo con un codigo o la organizacion
    desde el panel: las sesiones abiertas hasta entonces dejan de valer para lo
    que cuelga del correo (`sesion_vigente`).

    Devuelve si habia cuenta que actualizar. Antes de la migracion no la hay y
    esto no hace nada, que es justo lo que tiene que pasar.
    """
    cambios = {"updated_at": datetime.now(timezone.utc)}
    if password_hash is not None:
        cambios["password_hash"] = password_hash
    if email_verified is not None:
        cambios["email_verified"] = email_verified

    operacion = {"$set": cambios}
    if cerrar_sesiones:
        operacion["$inc"] = {"sesion_ver": 1}

    resultado = await db[COLECCION].update_one({"email": normalizar_email(email)}, operacion)
    return resultado.matched_count > 0


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


# ==================== UNA PERSONA, UNA CUENTA ====================
#
# La migracion junto a quien ya era corredor y del equipo el dia que se corrio,
# pero fue un script de una vez. Quien se apunto de voluntario despues teniendo
# ya cuenta de corredor —o al reves— se quedo con el rol de siempre: la ficha
# nueva existia, la cuenta no se enteraba, y en la app solo salia uno de los dos
# accesos. Lo de aqui abajo es lo que mantiene eso al dia sin otro script.
#
# La regla que no se puede saltar: un rol se suma por coincidencia de correo
# solo si el correo de la cuenta esta demostrado. La cuenta de espectador nace
# sin verificar, asi que cualquiera puede crear una con el correo de otro; si
# bastara con que el correo coincidiera, esa cuenta heredaria la ficha medica
# del voluntario o del corredor de verdad.


# El otro lado de la misma regla: el rol de equipo tambien se puede *pedir*, sin
# que nadie lo sume. Darse de alta como staff en la app crea la cuenta con el rol
# puesto y sin verificar, que es el camino natural del voluntario y no se puede
# cerrar. Lo que si se puede es que el rol, por si solo, no ensene nada: lo que
# cuelga del correo —la ficha del voluntario, sus turnos, su carnet— y los
# permisos del panel esperan a que el correo este demostrado.


def demostrada(cuenta: Optional[dict]) -> bool:
    """True si el correo de la cuenta es de quien la usa.

    Dos formas de haberlo demostrado: escribir un codigo que llego a ese correo
    (`email_verified`), o venir de `admin_users` (`staff_username`), donde las
    cuentas las creo la organizacion a mano o salieron de un codigo al correo
    antes de que existiera esta marca.
    """
    return bool(cuenta) and bool(cuenta.get("email_verified") or cuenta.get("staff_username"))


async def de_la_sesion(db, payload: dict) -> Optional[dict]:
    """La cuenta de quien trae este token. Los heredados del panel no la llevan."""
    return await por_id(db, payload["sub"]) if payload.get("sub") else None


def sesion_vigente(payload: dict, cuenta: Optional[dict]) -> bool:
    """False si la sesion es anterior a un cambio de contrasena hecho con un codigo.

    Quien abre una cuenta con el correo de otro se queda con una sesion que dura
    horas. Cuando el dueno del correo hace lo correcto —ponerse su contrasena con
    el codigo que le llega—, la cuenta pasa a estar demostrada... y esa sesion
    ajena seguiria abierta sobre una cuenta que ya ensena la ficha. Por eso cada
    cambio de contrasena por codigo sube `sesion_ver`, y la sesion que traiga una
    version anterior deja de valer para lo que cuelga del correo.

    Los tokens emitidos antes de que existiera el campo viajan sin el y cuentan
    como version 0, que es la de toda cuenta a la que nadie le ha cambiado nada.
    """
    return int(payload.get("sv") or 0) == version_de_sesion(cuenta)


def sesiones_nuevas(cuenta: Optional[dict]) -> dict:
    """Lo que hay que escribir en la cuenta para dejar atras las sesiones abiertas."""
    return {"sesion_ver": version_de_sesion(cuenta) + 1}


def sesion_demostrada(payload: dict, cuenta: Optional[dict]) -> bool:
    """Si esta sesion puede ver y tocar lo que cuelga de su correo.

    El token heredado del panel (sin `ver`) pasa: solo sale del acceso contra
    `admin_users`, donde no hay alta libre. El token nuevo depende de su cuenta,
    y si la cuenta ya no existe no hay nada que ensenar.
    """
    if not payload.get("ver"):
        return True
    return demostrada(cuenta) and sesion_vigente(payload, cuenta)


# ==================== CODIGOS AL CORREO ====================

CODIGO_VALIDO_MINUTOS = 30

# Cada cuanto se le puede volver a escribir sola a una cuenta sin verificar.
# Quien quiera otro codigo antes lo pide el mismo, que para eso hay un boton.
HORAS_ENTRE_AVISOS = 12


def generar_codigo() -> str:
    """Seis digitos con `secrets`, no con `random`.

    El generador de `random` es un Mersenne Twister, predecible a partir de sus
    salidas anteriores, y estos codigos restablecen contrasenas.
    """
    return "".join(str(secrets.randbelow(10)) for _ in range(6))


async def mandar_codigo(db, cuenta: dict, proposito: str, plantilla: str = "email_verification") -> None:
    """Genera el codigo, lo guarda en la cuenta y lo manda por correo.

    Se traga sus errores: que el correo no salga no puede tumbar un registro que
    por lo demas fue bien. Quien no lo reciba puede pedir otro.
    """
    codigo = generar_codigo()
    campo = "verification_code" if proposito == "verificar" else "reset_code"
    ahora = datetime.now(timezone.utc)

    await db[COLECCION].update_one(
        {"_id": cuenta["_id"]},
        {"$set": {
            campo: codigo,
            f"{campo}_expires": ahora + timedelta(minutes=CODIGO_VALIDO_MINUTOS),
            f"{campo}_attempts": 0,
            f"{campo}_sent_at": ahora,
        }},
    )

    try:
        from services.template_email_service import (
            BASE_URL, build_race_data, send_email_with_template,
        )

        carrera = await db.race_configurations.find_one({"is_active": True})
        await send_email_with_template(
            db,
            plantilla,
            cuenta["email"],
            {
                "frontend_url": BASE_URL,
                **(build_race_data(carrera) if carrera else {"race_name": "Backyard Ultra Santo Domingo"}),
                "nombre": cuenta.get("nombre") or "",
                "verification_code": codigo,
                "expires_minutes": str(CODIGO_VALIDO_MINUTOS),
            },
        )
    except Exception as e:
        logger.error("No se pudo enviar el codigo a %s: %s", cuenta["email"], e)


async def avisar_de_verificacion(db, cuenta: Optional[dict]) -> bool:
    """Le escribe a una cuenta de equipo sin demostrar para que confirme su correo.

    Es para quien ya tenia la cuenta cuando se empezo a pedir la verificacion: la
    app que lleva instalada no sabe ensenarle el aviso, asi que se le manda el
    codigo al correo con la pagina donde escribirlo. Como mucho una vez cada
    `HORAS_ENTRE_AVISOS`: abrir el perfil diez veces no son diez correos, ni un
    codigo nuevo que invalide el que la persona esta escribiendo.

    Devuelve si se mando.
    """
    if not cuenta or demostrada(cuenta):
        return False

    # El turno se pide en la base, no mirando el documento que ya se tiene: la
    # app abre el perfil con varias llamadas a la vez y serian varios correos.
    ahora = datetime.now(timezone.utc)
    turno = await db[COLECCION].update_one(
        {"_id": cuenta["_id"], "$or": [
            {"verification_code_sent_at": None},
            {"verification_code_sent_at": {"$lt": ahora - timedelta(hours=HORAS_ENTRE_AVISOS)}},
        ]},
        {"$set": {"verification_code_sent_at": ahora}},
    )
    if not turno.modified_count:
        return False

    await mandar_codigo(db, cuenta, "verificar", plantilla="staff_verification")
    return True


# ==================== PERMISOS QUE DA EL TURNO ====================
#
# Quien tiene asignado un turno en el control de vueltas o en el corral de
# salida escanea dorsales: es su trabajo. Pedirle a la organizacion que ademas
# le marque el permiso a cada uno en Usuarios era un paso que siempre se le
# olvidaba a alguien, y se notaba el dia de la carrera. Asi que el permiso sale
# del turno: se calcula al entrar y viaja en el token, pero **no se guarda** en
# la cuenta. Si le quitan el turno, lo pierde en la siguiente sesion; y lo que
# la organizacion marque en Usuarios sigue siendo exactamente lo que marco.

PUESTOS_CON_ESCANER = ("Control de Vueltas", "Corral de salida y animación")


def _clave_de_puesto(nombre) -> str:
    """El nombre del puesto sin acentos, mayusculas ni puntuacion.

    Los puestos se escriben a mano en la pestana Turnos («Control de Ruta.»,
    con punto, existe), asi que la comparacion no puede ser letra por letra.
    """
    sin_acentos = unicodedata.normalize("NFKD", str(nombre or ""))
    letras = "".join(c for c in sin_acentos if not unicodedata.combining(c))
    return " ".join("".join(c if c.isalnum() else " " for c in letras).casefold().split())


def da_escaner(puesto) -> bool:
    """Si un turno en ese puesto lleva consigo el permiso de escanear."""
    return _clave_de_puesto(puesto) in {_clave_de_puesto(p) for p in PUESTOS_CON_ESCANER}


async def permisos_del_turno(db, cuenta: Optional[dict]) -> list:
    """Los permisos que la persona tiene por sus turnos asignados: hoy, `scanner`.

    Solo con el rol de equipo y el correo demostrado. Los turnos se buscan por
    correo, y el escaner abre las fichas medicas: una cuenta abierta con el
    correo de otro no se lleva lo que le toca al dueno del correo.
    """
    if not cuenta or STAFF not in (cuenta.get("roles") or []) or not demostrada(cuenta):
        return []
    puestos = await db.volunteer_assignments.distinct(
        "puesto", {"email_asignado": cuenta.get("email")}
    )
    return ["scanner"] if any(da_escaner(p) for p in puestos) else []


def _con_permisos(cuenta: dict, extra: list) -> dict:
    """La cuenta con `extra` sumado a sus permisos, sin repetir y sin guardar."""
    permisos = list(cuenta.get("permissions") or [])
    nuevos = [p for p in extra if p not in permisos]
    return {**cuenta, "permissions": permisos + nuevos} if nuevos else cuenta


async def poner_al_dia(db, cuenta: Optional[dict]) -> Optional[dict]:
    """Suma a la cuenta los roles que la persona ya se gano por otro camino.

    Se llama en cada acceso, antes de mirar los roles: el voluntario que ademas
    corre entra una vez y ve sus dos zonas. Devuelve la cuenta como queda, con
    los permisos que le dan sus turnos (`permisos_del_turno`) sumados a los
    suyos; esos van en el token y no se escriben en la base.
    """
    if not cuenta:
        return cuenta
    cuenta = await _sumar_roles(db, cuenta)
    return _con_permisos(cuenta, await permisos_del_turno(db, cuenta))


async def _sumar_roles(db, cuenta: dict) -> dict:
    """Los roles que llegan por coincidencia de correo, solo si esta verificado."""
    if not cuenta.get("email_verified"):
        return cuenta

    correo = cuenta.get("email")
    roles = list(cuenta.get("roles") or [FAN])
    nuevos, campos = [], {}

    if STAFF not in roles and await db.volunteer_registrations.find_one(
        {"email": correo, "status": {"$ne": "cancelled"}}, {"_id": 1}
    ):
        nuevos.append(STAFF)

    perfil = None
    if ATLETA not in roles:
        perfil = await db.athletes.find_one(
            {"email": correo, "email_verified": True}, {"_id": 1}
        )
        if perfil:
            nuevos.append(ATLETA)
            campos["athlete_profile_id"] = perfil["_id"]

    if not nuevos:
        return cuenta

    campos["updated_at"] = datetime.now(timezone.utc)
    await db[COLECCION].update_one(
        {"_id": cuenta["_id"]},
        {"$addToSet": {"roles": {"$each": nuevos}}, "$set": campos},
    )
    if perfil:
        await db.athletes.update_one(
            {"_id": perfil["_id"]}, {"$set": {"account_id": cuenta["_id"]}}
        )
    return {**cuenta, **campos, "roles": roles + nuevos}


async def enlazar_corredor(db, perfil: dict) -> Optional[dict]:
    """Ata a su cuenta el perfil de corredor que acaba de verificar su correo.

    Lo normal es que la cuenta la haya creado el propio registro de corredor y
    aqui solo se marque como verificada. El otro caso es el de quien ya tenia
    cuenta —de espectador o del equipo— y se hace despues el perfil: el alta no
    pudo crear otra con el mismo correo, asi que el perfil quedo suelto. Se le
    ata aqui, que es cuando demuestra con el codigo que el correo es suyo, y la
    cuenta toma la contrasena del perfil: es la que acaba de elegir, y deja
    fuera a quien hubiera abierto antes una cuenta con un correo ajeno.

    Devuelve la cuenta como queda, o None si no la hay.
    """
    cuenta = await por_email(db, perfil.get("email"))
    if not cuenta:
        return None

    cambios = {"email_verified": True, "updated_at": datetime.now(timezone.utc)}
    if cuenta.get("athlete_profile_id") != perfil["_id"]:
        cambios["athlete_profile_id"] = perfil["_id"]
        if perfil.get("password_hash"):
            cambios["password_hash"] = perfil["password_hash"]
            # Y las sesiones de quien la hubiera abierto antes dejan de valer.
            cambios.update(sesiones_nuevas(cuenta))

    await db[COLECCION].update_one(
        {"_id": cuenta["_id"]}, {"$addToSet": {"roles": ATLETA}, "$set": cambios}
    )
    await db.athletes.update_one({"_id": perfil["_id"]}, {"$set": {"account_id": cuenta["_id"]}})

    roles = cuenta.get("roles") or [FAN]
    return {**cuenta, **cambios, "roles": roles if ATLETA in roles else [*roles, ATLETA]}


async def fijar_password(db, cuenta: dict, password: str) -> dict:
    """Cambia la contrasena de quien acaba de demostrar su correo con un codigo.

    Deja ademas el correo como verificado —el codigo lo demuestra igual— y copia
    el cambio al perfil de corredor, que conserva su propio `password_hash` y
    tiene endpoints que comprueban la contrasena actual contra ese campo.
    """
    ahora = datetime.now(timezone.utc)
    cambios = {"password_hash": hash_password(password), "email_verified": True, "updated_at": ahora}
    # Solo en la cuenta: las sesiones abiertas con la contrasena de antes —que
    # pudo poner otra persona— dejan de valer. Ver `sesion_vigente`.
    de_la_cuenta = {**cambios, **sesiones_nuevas(cuenta)}

    await db[COLECCION].update_one({"_id": cuenta["_id"]}, {"$set": de_la_cuenta})
    if cuenta.get("athlete_profile_id"):
        await db.athletes.update_one({"_id": cuenta["athlete_profile_id"]}, {"$set": cambios})
    return {**cuenta, **de_la_cuenta}


async def cuenta_de_equipo(
    db,
    email: str,
    password: Optional[str] = None,
    nombre: str = "",
    apellidos: str = "",
    permissions=None,
) -> Optional[dict]:
    """La cuenta de alguien del equipo que acaba de demostrar su correo.

    Es la salida de los dos caminos del voluntario —apuntarse y ponerse
    contrasena—, que van los dos con un codigo al correo. Si la persona ya tenia
    cuenta, de corredor o de espectador, gana el rol en esa misma cuenta; si no,
    se le crea. La contrasena que escribe ahi pasa a ser la de la cuenta: es la
    ultima que eligio y la eligio con el correo demostrado.

    Sin contrasena y sin cuenta no hay nada que crear: devuelve None y la
    persona se la pondra despues con su codigo.
    """
    cuenta = await por_email(db, email)
    if not cuenta:
        if not password:
            return None
        return await crear(
            db, email=email, password=password, nombre=nombre, apellidos=apellidos,
            roles=[STAFF], permissions=permissions, email_verified=True,
        )

    if password:
        cuenta = await fijar_password(db, cuenta, password)

    # Cuenta sin verificar y sin contrasena nueva: no se sabe si quien la abrio
    # es quien acaba de demostrar el correo. Se queda como esta.
    if not cuenta.get("email_verified"):
        return cuenta

    roles = cuenta.get("roles") or [FAN]
    if STAFF not in roles:
        await anadir_rol(db, cuenta["_id"], STAFF)
        cuenta = {**cuenta, "roles": [*roles, STAFF]}
    return cuenta


async def del_equipo(db, usuario: str) -> Optional[dict]:
    """La cuenta de alguien del equipo, por su correo o por su usuario del panel."""
    usuario = normalizar_email(usuario)
    if not usuario:
        return None
    return await db[COLECCION].find_one(
        {"$or": [{"email": usuario}, {"staff_username": usuario}]}
    )


async def adoptar_del_panel(db, usuario: str, password: str) -> Optional[dict]:
    """Crea la cuenta de quien solo existe en `admin_users`, al acertar su contrasena.

    Entre la migracion y este cambio, el voluntario que se ponia contrasena
    seguia naciendo en `admin_users`: entraba por el acceso de staff, que cae a
    esa coleccion, pero no por la puerta unica de la app, que solo mira
    `accounts`. Aqui se le hace la cuenta en el momento de entrar, con la misma
    forma que le habria dado la migracion.

    Solo para usuarios que son un correo: es la identidad de una cuenta.
    """
    usuario = normalizar_email(usuario)
    if "@" not in usuario or await del_equipo(db, usuario):
        return None

    heredado = await db.admin_users.find_one({"username": usuario})
    if not heredado or not verificar_password(password, heredado.get("password")):
        return None

    return await crear(
        db,
        email=usuario,
        password=password,
        nombre=heredado.get("nombre") or "",
        roles=[STAFF],
        permissions=heredado.get("permissions"),
        # Las cuentas de voluntario salieron de un codigo enviado al correo; las
        # que creo el panel a mano, no.
        email_verified=bool(heredado.get("es_voluntario")),
        staff_username=usuario,
    )


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
