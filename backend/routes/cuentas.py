"""Cuentas de espectador: la puerta por la que se empieza a saber quien anima.

De las 696 personas que han escrito alguno de los 1.625 mensajes de animo que hay
en la base no se conserva mas que un nombre suelto escrito a mano. No hay forma
de avisar a ninguna cuando empieza la carrera que vino a ver, ni de reconocerla
si vuelve al ano siguiente, ni de saber si dos mensajes son de la misma persona.
Lo que sigue a quien anima —a que corredores mira, que mensajes le gustaron, con
que nombre firma— vive hoy en el `localStorage` de su telefono y se pierde en
cuanto lo cambia.

Este router es aditivo: no toca ninguna ruta existente. Ver la carrera sigue sin
pedir nada, que es como lo hace la mayoria; la cuenta se pide en el momento de
hacer algo que deja rastro —animar, seguir a alguien— y no en la puerta. El
correo de quien quiere que le avisen cuando su hermano cierre la vuelta 30 es un
correo bueno; el de quien lo escribe para quitarse de encima una pantalla que le
estorba, no.

El alta no espera a la verificacion: se crea la cuenta y se anima en el mismo
gesto, y el codigo llega por correo detras. Solo las cuentas verificadas entran
en los envios, de modo que lo que no se confirme queda marcado y aparte en vez de
ensuciar las listas.

Ver PLAN_CUENTA_UNICA.md, fase 2.
"""
import logging
import secrets
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field

from services import cuentas, rate_limit
from services.auth import require_cuenta, require_permission, verify_cuenta_token

logger = logging.getLogger(__name__)

# `/api/cuenta` (singular) ya lo ocupa el cambio de contrasena del panel, en
# routes/users.py. Este va en plural para no pisarlo.
router = APIRouter(prefix="/api/cuentas", tags=["cuentas"])

MAX_INTENTOS_CODIGO = 5

# Tope de dorsales que se pueden subir del telefono de una vez. El mismo que usa
# el registro de push: es la lista de a quien sigue una persona, no un almacen.
MAX_SEGUIDOS = 200


# ==================== Entradas ====================


class Registro(BaseModel):
    email: EmailStr
    nombre: str = Field(min_length=1, max_length=80)
    apellidos: str = Field(default="", max_length=80)
    password: str = Field(min_length=cuentas.MIN_PASSWORD, max_length=200)
    acepta_comunicaciones: bool = False
    # 'espectador' | 'staff'. El corredor va por `/api/athletes/register`,
    # que ademas crea su ficha en `athletes`.
    tipo: str = "espectador"


class Acceso(BaseModel):
    email: EmailStr
    password: str


class Codigo(BaseModel):
    email: EmailStr
    code: str
    # La contrasena de la cuenta, para quien confirma sin sesion abierta. Ver
    # `verificar`.
    password: Optional[str] = None


class SoloCorreo(BaseModel):
    email: EmailStr


class NuevaPassword(BaseModel):
    email: EmailStr
    code: str
    password: str = Field(min_length=cuentas.MIN_PASSWORD, max_length=200)


class Perfil(BaseModel):
    nombre: Optional[str] = Field(default=None, max_length=80)
    apellidos: Optional[str] = Field(default=None, max_length=80)
    pais: Optional[str] = Field(default=None, max_length=60)
    relacion: Optional[str] = Field(default=None, max_length=30)
    acepta_comunicaciones: Optional[bool] = None


class EstadoLocal(BaseModel):
    """Lo que la app traia guardado en el telefono antes de haber cuenta."""
    followed: List[str] = Field(default_factory=list)
    fan_name: Optional[str] = None


# ==================== Ayudas ====================


async def _comprobar_codigo(db, cuenta: dict, code: str, proposito: str) -> None:
    """Valida el codigo o levanta el error que toque.

    Seis digitos son un millon de combinaciones: sin limite de intentos se agotan
    en minutos. Al quinto fallo el codigo se anula y hay que pedir otro.
    """
    campo = "verification_code" if proposito == "verificar" else "reset_code"
    guardado = cuenta.get(campo)
    caduca = cuenta.get(f"{campo}_expires")

    if not guardado:
        raise HTTPException(status_code=400, detail="Pide un codigo nuevo")

    if caduca and caduca.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="El codigo caduco. Pide uno nuevo.")

    if not secrets.compare_digest(str(guardado), (code or "").strip()):
        intentos = (cuenta.get(f"{campo}_attempts") or 0) + 1
        if intentos >= MAX_INTENTOS_CODIGO:
            await db[cuentas.COLECCION].update_one(
                {"_id": cuenta["_id"]},
                {"$set": {campo: None, f"{campo}_attempts": 0}},
            )
            raise HTTPException(status_code=429, detail="Demasiados intentos. Pide un codigo nuevo.")

        await db[cuentas.COLECCION].update_one(
            {"_id": cuenta["_id"]}, {"$set": {f"{campo}_attempts": intentos}}
        )
        raise HTTPException(status_code=400, detail="Codigo incorrecto")


def _sesion(cuenta: dict) -> dict:
    return {"token": cuentas.emitir_token(cuenta), "cuenta": cuentas.publica(cuenta)}


def _es_quien_la_abrio(cuenta: dict, password: Optional[str], authorization) -> bool:
    """Si quien llama demuestra que la cuenta es suya: con su sesion o su contrasena."""
    if isinstance(authorization, str) and authorization:
        try:
            if verify_cuenta_token(authorization).get("sub") == str(cuenta["_id"]):
                return True
        except HTTPException:
            pass   # sesion caducada o de otro sitio: que valga la contrasena
    return cuentas.verificar_password(password or "", cuenta.get("password_hash"))


# ==================== Alta y acceso ====================


@router.get("/existe")
async def correo_en_uso(email: EmailStr, request: Request = None):
    """Si ese correo ya tiene cuenta, para decirlo antes de rellenar nada.

    Sin esto, quien va a darse de alta como corredor rellena siete campos mas
    —telefono, fecha, nacionalidad, contacto de emergencia— y solo al final se
    entera de que ya tenia cuenta. El aviso llega cuando todavia no cuesta nada.

    Devuelve solo si existe, sin decir de que tipo es: saber que un correo es de
    un corredor o del equipo no hace falta para esto y seria contar de mas.

    Va con limite de peticiones porque, por su naturaleza, permite comprobar
    correos uno a uno.
    """
    from server import db

    rate_limit.comprobar(
        "correo_en_uso",
        rate_limit.ip_cliente(request),
        limite=30,
        ventana_segundos=300,
        mensaje="Demasiadas comprobaciones. Espera un momento.",
    )

    return {"existe": await cuentas.por_email(db, email) is not None}


@router.post("/registro")
async def registro(datos: Registro, request: Request = None):
    """Crea la cuenta de espectador y devuelve la sesion en el acto.

    **No se manda codigo de verificacion.** Ser espectador no da acceso a nada
    que no sea ya publico: se anima, se sigue a un corredor y se reciben avisos.
    Pedir que confirme el correo para eso es un tramite sin nada detras, y cada
    tramite cuesta altas.

    La verificacion se exige cuando la cuenta pasa a tener consecuencias —al
    ganar el rol de corredor o de equipo, donde hay inscripciones, pagos, fichas
    medicas y turnos— y no antes. Para eso siguen vivos `/verificar` y
    `/reenviar-codigo`.

    **La cuenta de staff si recibe el codigo.** Nace con el rol puesto, y ese rol
    abre la ficha del voluntario que tenga su mismo correo: sin demostrar el
    correo, bastaba con conocer el de un voluntario para leer su ficha medica.
    La sesion se devuelve igual, porque la app instalada no tiene paso de codigo
    tras el alta; lo que espera a la verificacion es lo que cuelga del correo
    (`cuentas.sesion_demostrada`).

    Que un correo sea falso no rompe nada: esa cuenta simplemente nunca recibira
    lo que se le mande. Lo que decide a quien se escribe es el consentimiento.
    """
    from server import db

    # Antes esto usaba `limitar_envio_codigo` (5 cada 15 min) porque el alta
    # mandaba un correo. Ya no lo manda, y ese limite era demasiado estrecho
    # para lo que ahora es: varias personas apuntandose desde la misma red —el
    # wifi del evento, una casa— chocarian entre ellas. El tope de aqui deja
    # pasar un grupo real y sigue cortando el alta masiva por script.
    rate_limit.comprobar(
        "registro-cuenta",
        rate_limit.ip_cliente(request),
        limite=20,
        ventana_segundos=900,
        mensaje="Demasiadas cuentas creadas desde aqui. Espera unos minutos.",
    )

    es_staff = datos.tipo == "staff"
    if es_staff:
        # Este alta si manda un correo, y a la direccion que escriba quien la
        # pide: sin un tope propio serviria para llenarle el buzon a un tercero.
        rate_limit.comprobar(
            "registro-staff",
            rate_limit.ip_cliente(request),
            limite=8,
            ventana_segundos=900,
            mensaje="Demasiadas cuentas de equipo creadas desde aqui. Espera unos minutos.",
        )

    if await cuentas.por_email(db, datos.email):
        raise HTTPException(
            status_code=409,
            detail="Ese correo ya tiene cuenta. Entra con tu contrasena.",
        )

    # Una cuenta de equipo se crea desde cero, sin que la organizacion tenga que
    # apuntar antes a nadie: es lo que hace que haya un solo perfil para todo el
    # mundo. Lo que NO se decide aqui son los permisos, que salen siempre vacios
    # y los da despues el panel. Sin ellos, el rol de staff abre su propio perfil
    # y los turnos libres, nada mas: las fichas medicas exigen el permiso
    # `scanner`, y el resto del panel, el suyo. Y su propio perfil tampoco lo
    # abre hasta que confirme el correo.
    roles = [cuentas.STAFF] if es_staff else []

    cuenta = await cuentas.crear(
        db,
        email=datos.email,
        password=datos.password,
        nombre=datos.nombre,
        apellidos=datos.apellidos,
        roles=roles,
        acepta_comunicaciones=datos.acepta_comunicaciones,
    )

    if es_staff:
        await cuentas.mandar_codigo(db, cuenta, "verificar", plantilla="staff_verification")

    return _sesion(cuenta)


@router.post("/login")
async def login(datos: Acceso, request: Request = None):
    """Acceso unico: vale para cualquier cuenta, sea del rol que sea.

    Es la puerta de la app, que ya no pregunta "¿corredor o staff?" antes de
    saber quien eres. El backend mira los roles y decide que abre.
    """
    from server import db

    ip = rate_limit.limitar_login(request, datos.email.lower())

    cuenta = await cuentas.autenticar(db, datos.email, datos.password)
    if not cuenta:
        # El voluntario que se puso contrasena cuando eso aun se guardaba solo
        # en `admin_users`: se le hace la cuenta aqui, al acertar.
        cuenta = await cuentas.adoptar_del_panel(db, datos.email, datos.password)
    if not cuenta:
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")

    # Quien corre y ademas es voluntario entra una vez y ve sus dos zonas.
    cuenta = await cuentas.poner_al_dia(db, cuenta)

    # El corredor sin correo verificado no entra, igual que en
    # `/api/athletes/login`. Sin esta linea, esta puerta seria la forma comoda
    # de saltarse esa regla. Al espectador no se le pide —no verifica nada— y al
    # equipo tampoco: sus cuentas vienen de `admin_users`, que nunca guardo esa
    # marca, y exigirla dejaria fuera a los 18 de golpe.
    if cuentas.ATLETA in (cuenta.get("roles") or []) and not cuenta.get("email_verified"):
        raise HTTPException(
            status_code=403,
            detail="Tu correo esta sin verificar. Entra desde tu perfil de corredor para recibir un codigo.",
        )

    rate_limit.olvidar("login", ip)
    return _sesion(cuenta)


@router.post("/verificar")
async def verificar(
    datos: Codigo,
    request: Request = None,
    authorization: Optional[str] = Header(None),
):
    """Confirma el correo de una cuenta.

    Pide dos cosas porque demuestran dos cosas distintas. El codigo, que quien
    lo escribe lee ese buzon. La sesion o la contrasena, que es quien abrio la
    cuenta. Con el codigo solo, el dueno del correo estaria confirmando la
    cuenta que otro abrio con su direccion —le llega un correo que dice
    "confirma" y confirma—, y esa cuenta, con la contrasena del otro, pasaria a
    ver su ficha.

    Quien tiene el buzon pero no la contrasena no se queda fuera: la cambia con
    `/recuperar` y `/nueva-password`, que deja el correo confirmado y fuera a
    quien hubiera abierto la cuenta.
    """
    from server import db

    rate_limit.limitar_verificacion(request)

    cuenta = await cuentas.por_email(db, datos.email)
    if not cuenta:
        raise HTTPException(status_code=404, detail="No hay cuenta con ese correo")

    if cuenta.get("email_verified"):
        # Aqui se devolvia la sesion sin mirar el codigo: bastaba con saber el
        # correo de una cuenta verificada —la de cualquier corredor, la de
        # alguien del equipo con permisos— para entrar en ella. Quien ya tiene
        # el correo confirmado no tiene nada que hacer en esta ruta.
        raise HTTPException(
            status_code=409,
            detail="Ese correo ya esta confirmado. Entra con tu contrasena.",
        )

    # Primero el codigo: sin el, esta ruta no dice nada sobre la contrasena.
    await _comprobar_codigo(db, cuenta, datos.code, "verificar")

    if not _es_quien_la_abrio(cuenta, datos.password, authorization):
        raise HTTPException(
            status_code=401,
            detail=(
                "El codigo es correcto, pero falta la contrasena de esta cuenta. "
                "Si no la recuerdas, cambiala con \"Olvide mi contrasena\": "
                "eso tambien confirma tu correo."
            ),
        )

    await db[cuentas.COLECCION].update_one(
        {"_id": cuenta["_id"]},
        {"$set": {"email_verified": True, "verification_code": None,
                  "updated_at": datetime.now(timezone.utc)}},
    )
    cuenta["email_verified"] = True
    return _sesion(await cuentas.poner_al_dia(db, cuenta))


@router.post("/reenviar-codigo")
async def reenviar(datos: SoloCorreo, request: Request = None):
    from server import db

    rate_limit.limitar_envio_codigo(request)

    cuenta = await cuentas.por_email(db, datos.email)
    if cuenta and not cuenta.get("email_verified"):
        del_equipo = cuentas.STAFF in (cuenta.get("roles") or [])
        await cuentas.mandar_codigo(
            db, cuenta, "verificar",
            plantilla="staff_verification" if del_equipo else "email_verification",
        )

    # Misma respuesta exista o no: si no, esto diria quien tiene cuenta.
    return {"message": "Si ese correo tiene cuenta sin verificar, te enviamos un codigo."}


@router.post("/recuperar")
async def recuperar(datos: SoloCorreo, request: Request = None):
    from server import db

    rate_limit.limitar_envio_codigo(request)

    cuenta = await cuentas.por_email(db, datos.email)
    if cuenta:
        await cuentas.mandar_codigo(db, cuenta, "reset")

    return {"message": "Si ese correo tiene cuenta, te enviamos un codigo."}


@router.post("/nueva-password")
async def nueva_password(datos: NuevaPassword, request: Request = None):
    from server import db

    rate_limit.limitar_verificacion(request)

    cuenta = await cuentas.por_email(db, datos.email)
    if not cuenta:
        raise HTTPException(status_code=404, detail="No hay cuenta con ese correo")

    await _comprobar_codigo(db, cuenta, datos.code, "reset")

    nuevo_hash = cuentas.hash_password(datos.password)
    # Las sesiones abiertas con la contrasena de antes dejan de valer para lo
    # que cuelga del correo: pudo abrirlas otra persona. Ver `sesion_vigente`.
    sesiones = cuentas.sesiones_nuevas(cuenta)
    await db[cuentas.COLECCION].update_one(
        {"_id": cuenta["_id"]},
        {"$set": {
            **sesiones,
            "password_hash": nuevo_hash,
            "reset_code": None,
            # Quien prueba el correo con un codigo lo ha demostrado igual que
            # verificandolo: no tiene sentido pedirselo otra vez.
            "email_verified": True,
            "updated_at": datetime.now(timezone.utc),
        }},
    )

    # Y de vuelta al perfil del corredor, si lo tiene. `athletes` conserva su
    # propio `password_hash` y hay endpoints que lo miran —cambiar la
    # contrasena desde el perfil comprueba la actual contra ese campo—. Sin
    # esto, quien recupera su contrasena por aqui despues no podria cambiarla
    # desde su perfil: le diria que la actual es incorrecta siendo la buena.
    if cuenta.get("athlete_profile_id"):
        await db.athletes.update_one(
            {"_id": cuenta["athlete_profile_id"]},
            {"$set": {
                "password_hash": nuevo_hash,
                "email_verified": True,
                "updated_at": datetime.now(timezone.utc),
            }},
        )

    cuenta.update({"email_verified": True, **sesiones})
    return _sesion(cuenta)


# ==================== Perfil ====================


@router.get("/perfil")
async def ver_perfil(payload: dict = Depends(require_cuenta)):
    from server import db

    cuenta = await cuentas.por_id(db, payload.get("sub"))
    if not cuenta:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")

    return {
        **cuentas.publica(cuenta),
        "pais": cuenta.get("pais"),
        "relacion": cuenta.get("relacion"),
        "followed": cuenta.get("followed") or [],
    }


@router.put("/perfil")
async def editar_perfil(datos: Perfil, payload: dict = Depends(require_cuenta)):
    from server import db

    cuenta = await cuentas.por_id(db, payload.get("sub"))
    if not cuenta:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")

    cambios = {k: v for k, v in datos.model_dump(exclude_none=True).items()}
    if cambios:
        cambios["updated_at"] = datetime.now(timezone.utc)
        await db[cuentas.COLECCION].update_one({"_id": cuenta["_id"]}, {"$set": cambios})

    return {**cuentas.publica({**cuenta, **cambios})}


@router.post("/importar-local")
async def importar_local(datos: EstadoLocal, payload: dict = Depends(require_cuenta)):
    """Sube a la cuenta lo que el telefono llevaba guardado sin ella.

    Quien lleva meses siguiendo a diez corredores desde la app no tiene por que
    perderlos por darse de alta. Se hace en el primer acceso y es idempotente:
    los dorsales se unen sin repetir.
    """
    from server import db

    cuenta = await cuentas.por_id(db, payload.get("sub"))
    if not cuenta:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")

    seguidos = [str(b).strip() for b in datos.followed if str(b).strip()]
    seguidos = list(dict.fromkeys(seguidos))[:MAX_SEGUIDOS]

    cambios = {"updated_at": datetime.now(timezone.utc)}
    # El nombre con el que ya venia firmando solo se toma si no puso otro.
    if datos.fan_name and not (cuenta.get("nombre") or "").strip():
        cambios["nombre"] = datos.fan_name.strip()[:80]

    await db[cuentas.COLECCION].update_one(
        {"_id": cuenta["_id"]},
        {"$addToSet": {"followed": {"$each": seguidos}}, "$set": cambios},
    )

    actualizada = await cuentas.por_id(db, cuenta["_id"])
    return {"success": True, "followed": actualizada.get("followed") or []}


# Lo que se limpia de una inscripcion cuando su dueno borra la cuenta. Queda el
# resultado deportivo —nombre, dorsal, vueltas—, como en cualquier clasificacion
# publicada; se va lo que identifica y localiza a la persona fuera de ese
# resultado: contacto, ficha medica y las llaves de acceso.
DATOS_PERSONALES_INSCRIPCION = [
    "email", "edit_token", "athlete_id", "telefono", "photo_url",
    "tipo_sangre", "condicion_medica", "condicion_medica_detalle",
    "alergias", "alergias_detalle",
    "contacto_emergencia_nombre", "contacto_emergencia_relacion",
    "contacto_emergencia_telefono",
]


@router.delete("/perfil")
async def borrar_cuenta(payload: dict = Depends(require_cuenta)):
    """Borra la cuenta desde la app, sea del rol que sea.

    La App Store lo exige (guideline 5.1.1(v)): toda cuenta que se puede crear
    en la app se tiene que poder borrar en la app, y de corredor y de staff
    tambien se crean ahi. Solo quedan dos puertas cerradas: la cuenta que
    administra el panel —quedarse sin administradores no se arregla desde un
    boton— y el corredor inscrito en una carrera que aun no termina, porque su
    dorsal, su pago y su ficha medica estan en uso; para esos dos casos sigue
    valiendo escribir a la organizacion.

    Que se borra y que se queda: se va la persona —login, perfil de corredor,
    contacto, ficha medica—; se queda el resultado deportivo. Inscripciones y
    vueltas son el historial publico de la carrera y conservan nombre y dorsal,
    pero se les limpia todo lo demas. Los animos que haya escrito se quedan
    tambien, sin el vinculo con la cuenta: son parte del hilo publico, y
    borrarlos dejaria huecos en conversaciones de otras personas.
    """
    from server import db

    # Las sesiones de versiones anteriores traen en `sub` el id del perfil de
    # corredor, no el de la cuenta: se cae al correo. Y el corredor de antes de
    # la migracion puede no tener documento en `accounts` y aun asi ser una
    # cuenta real que vive en `athletes`: se le borra igual, guiandose por lo
    # que dice su token.
    cuenta = await cuentas.por_id(db, payload.get("sub"))
    if not cuenta and payload.get("email"):
        cuenta = await cuentas.por_email(db, payload["email"])

    email = (cuenta or {}).get("email") or cuentas.normalizar_email(payload.get("email") or "")
    if not cuenta and not email:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")

    if (cuenta or payload).get("is_admin"):
        raise HTTPException(
            status_code=409,
            detail="Esta cuenta administra el panel. Escribe a la organizacion para darla de baja.",
        )

    roles = set((cuenta or {}).get("roles") or payload.get("roles") or [])

    atleta_id = None
    if cuenta and cuenta.get("athlete_profile_id"):
        atleta_id = str(cuenta["athlete_profile_id"])
    elif payload.get("athlete_id"):
        atleta_id = str(payload["athlete_id"])

    inscripciones = []
    if cuentas.ATLETA in roles:
        vinculos = [{"email": email}]
        if atleta_id:
            vinculos.append({"athlete_id": atleta_id})

        inscripciones = await db.registrations.find(
            {"$or": vinculos, "status": {"$ne": "cancelled"}},
            {"race_code": 1},
        ).to_list(500)

        codigos = list({i["race_code"] for i in inscripciones if i.get("race_code")})
        if codigos:
            # Carrera "en uso": ni cerrada (`finished_at` se sella al cerrarla)
            # ni archivada. Con una inscripcion ahi no se borra en frio.
            abiertas = await db.race_configurations.count_documents({
                "code": {"$in": codigos},
                "finished_at": None,
                "archived_at": None,
                "data_archived": {"$ne": True},
            })
            if abiertas:
                raise HTTPException(
                    status_code=409,
                    detail="Tienes una inscripcion en una carrera que aun no termina. Escribe a la organizacion para darte de baja de la carrera y poder borrar la cuenta.",
                )

    if inscripciones:
        await db.registrations.update_many(
            {"_id": {"$in": [i["_id"] for i in inscripciones]}},
            {
                "$unset": {campo: "" for campo in DATOS_PERSONALES_INSCRIPCION},
                "$set": {"account_deleted_at": datetime.now(timezone.utc)},
            },
        )

    # El perfil de corredor es datos personales de arriba abajo: fuera entero.
    # Por id y por correo, porque las cuentas anteriores a la migracion pueden
    # no llevar el enlace.
    if cuentas.ATLETA in roles:
        if atleta_id:
            try:
                from bson import ObjectId

                await db.athletes.delete_one({"_id": ObjectId(atleta_id)})
            except Exception:
                pass
        await db.athletes.delete_many({"email": email})

    if cuenta:
        await db.cheer_messages.update_many(
            {"account_id": cuenta["_id"]}, {"$unset": {"account_id": ""}}
        )
        await db.push_devices.update_many(
            {"account_id": cuenta["_id"]}, {"$unset": {"account_id": ""}}
        )
        await db[cuentas.COLECCION].delete_one({"_id": cuenta["_id"]})

    # Y lo que quede suyo en `admin_users`. Sin esto, la contrasena de alli
    # seguiria abriendo el acceso del equipo, que al acertar le volveria a
    # crear la cuenta (`cuentas.adoptar_del_panel`): borrar no borraria nada.
    usuarios = [u for u in (email, (cuenta or {}).get("staff_username")) if u]
    if usuarios:
        await db.admin_users.delete_many({"username": {"$in": usuarios}})

    return {"success": True}


# ==================== Panel ====================


@router.get("/admin/espectadores", dependencies=[Depends(require_permission("emails"))])
async def listado_espectadores(limit: int = 200, solo_escribibles: bool = False):
    """Quien sigue la carrera sin correr ni trabajar en ella.

    Va con el permiso de comunicaciones porque para lo que sirve esta lista es
    para escribirles. Y lo que decide a quien se puede escribir es **solo el
    consentimiento**: el espectador no verifica su correo, asi que exigir
    `email_verified` dejaria la lista vacia para siempre sin que nada fallara a
    la vista.
    """
    from server import db

    solo_fan = {"roles": [cuentas.FAN]}

    total = await db[cuentas.COLECCION].count_documents(solo_fan)
    escribibles = await db[cuentas.COLECCION].count_documents(
        {**solo_fan, "acepta_comunicaciones": True}
    )

    filtro = dict(solo_fan)
    if solo_escribibles:
        filtro["acepta_comunicaciones"] = True

    docs = await db[cuentas.COLECCION].find(
        filtro,
        {"password_hash": 0, "verification_code": 0, "reset_code": 0},
    ).sort("created_at", -1).to_list(min(limit, 1000))

    return {
        "total": total,
        "escribibles": escribibles,
        "espectadores": [
            {
                **cuentas.publica(d),
                "pais": d.get("pais"),
                "relacion": d.get("relacion"),
                "sigue_a": len(d.get("followed") or []),
                "created_at": d.get("created_at"),
                "last_login_at": d.get("last_login_at"),
            }
            for d in docs
        ],
    }
