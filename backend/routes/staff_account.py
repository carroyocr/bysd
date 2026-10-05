"""Cuenta y perfil del equipo de staff (voluntarios incluidos).

Hasta ahora un voluntario solo podia entrar por el enlace que le llegaba al
correo, y el panel era cosa de tres usuarios creados a mano. Aqui el voluntario
se pone su propia contrasena y pasa a ser un usuario del sistema **sin ningun
permiso**: solo ve su perfil y sus turnos. El dia que la organizacion decida
que alguno escanee vueltas o consulte fichas medicas, basta con marcarle el
permiso en la pestana Usuarios que ya existe; no hace falta plomeria nueva.

La contrasena se elige con un codigo enviado al correo, el mismo mecanismo que
ya usaba el registro de voluntarios. Asi no hay que mandar credenciales por
correo a nadie, y sirve igual para los que ya estaban registrados y para los
que se registren manana.
"""
import asyncio
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field

from services import cuentas, rate_limit
from services.auth import require_admin, require_permission

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/staff", tags=["staff"])

MIN_PASSWORD = 8
CODIGO_VALIDO_MINUTOS = 30


class SolicitarCodigo(BaseModel):
    email: EmailStr


class DefinirPassword(BaseModel):
    email: EmailStr
    code: str
    password: str


def _generar_codigo() -> str:
    return "".join(str(secrets.randbelow(10)) for _ in range(6))


async def _buscar_voluntario(db, email: str) -> Optional[dict]:
    """El voluntario mas reciente con ese correo, sin importar la carrera."""
    docs = await db.volunteer_registrations.find(
        {"email": email, "status": {"$ne": "cancelled"}}
    ).sort("created_at", -1).to_list(5)
    return docs[0] if docs else None


async def _acceso_de_equipo(db, email: str, voluntario: Optional[dict]) -> dict:
    """Con que entra al equipo quien tiene este correo, si entra con algo.

    La cuenta vive en `accounts`. La de un corredor o un espectador cuenta aqui
    solo si la persona es voluntaria y su correo esta verificado: es lo que hace
    que el acceso le sume el rol (`cuentas.poner_al_dia`). `admin_users` se mira
    todavia por quien se puso contrasena antes de que esto pasara a `accounts` y
    aun no ha vuelto a entrar.
    """
    cuenta = await cuentas.por_email(db, email)
    if cuenta and cuentas.STAFF not in (cuenta.get("roles") or []):
        if not (voluntario and cuenta.get("email_verified")):
            cuenta = None

    heredado = await db.admin_users.find_one({"username": email})
    return {
        "cuenta": cuenta,
        "heredado": heredado,
        "tiene_cuenta": bool(cuenta or heredado),
        "tiene_password": bool(
            cuenta.get("password_hash") if cuenta else (heredado or {}).get("password")
        ),
    }


# ==================== ESTADO DE LA CUENTA ====================


@router.get("/account-status")
async def estado_de_la_cuenta(email: EmailStr, request: Request = None):
    """Que se puede hacer con este correo, antes de meterse en un flujo.

    Sin esto, quien no esta registrado pasa por pedir codigo, esperar un correo
    que no llega y volver a empezar; y quien ya tiene cuenta se mete en el alta
    de voluntario para acabar en un error al final. Es lo que permite mandarlo
    de entrada al camino que le toca.

    Va con limite de peticiones porque, por su naturaleza, dice si un correo
    esta apuntado como voluntario.
    """
    from server import db

    rate_limit.comprobar(
        "estado_cuenta",
        rate_limit.ip_cliente(request),
        limite=30,
        ventana_segundos=300,
        mensaje="Demasiadas comprobaciones. Espera un momento.",
    )

    correo = email.lower().strip()
    voluntario = await _buscar_voluntario(db, correo)
    acceso = await _acceso_de_equipo(db, correo, voluntario)

    return {
        "es_voluntario": voluntario is not None,
        "tiene_cuenta": acceso["tiene_cuenta"],
        "tiene_password": acceso["tiene_password"],
    }


# ==================== CONTRASENA ====================


async def enviar_codigo_password(db, email: str) -> bool:
    """Genera el codigo y lo manda por correo. Devuelve si el correo salio.

    Vive aparte porque lo usan dos sitios: el voluntario que lo pide desde su
    pantalla de acceso, y el panel cuando alguien del equipo tiene que echarle
    una mano a un voluntario que no consigue entrar.
    """
    codigo = _generar_codigo()
    await db.volunteer_verification_tokens.delete_many({"email": email})
    await db.volunteer_verification_tokens.insert_one({
        "email": email,
        "code": codigo,
        "proposito": "password",
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=CODIGO_VALIDO_MINUTOS),
    })
    try:
        from services.template_email_service import (
            send_email_with_template, build_race_data, build_general_data,
        )
        carrera = await db.race_configurations.find_one({"is_active": True})
        return bool(await send_email_with_template(
            db=db,
            template_id="volunteer_verification_code",
            to_email=email,
            data={**build_race_data(carrera), **build_general_data(verification_code=codigo)},
        ))
    except Exception as e:
        logger.error(f"No se pudo enviar el codigo de staff a {email}: {e}")
        return False


@router.post("/password/request-code")
async def solicitar_codigo(datos: SolicitarCodigo, request: Request = None):
    """Manda un codigo al correo para poder elegir contrasena."""
    from server import db

    rate_limit.limitar_envio_codigo(request)
    email = datos.email.lower().strip()

    voluntario = await _buscar_voluntario(db, email)
    acceso = await _acceso_de_equipo(db, email, voluntario)

    # Se responde lo mismo exista o no la cuenta: si no, esto seria una forma
    # comoda de averiguar quien esta apuntado como voluntario.
    if voluntario or acceso["tiene_cuenta"]:
        await enviar_codigo_password(db, email)

    return {
        "message": "Si ese correo tiene cuenta en el equipo, te enviamos un codigo.",
        "email": email,
    }


@router.post("/password/set")
async def definir_password(datos: DefinirPassword, request: Request = None):
    """Valida el codigo y deja la cuenta lista, devolviendo ya la sesion."""
    from server import db

    rate_limit.limitar_verificacion(request)
    email = datos.email.lower().strip()

    if len(datos.password) < MIN_PASSWORD:
        raise HTTPException(
            status_code=400,
            detail=f"La contrasena debe tener al menos {MIN_PASSWORD} caracteres",
        )

    token_doc = await db.volunteer_verification_tokens.find_one({
        "email": email, "code": datos.code.strip(), "proposito": "password",
    })
    if not token_doc:
        raise HTTPException(status_code=400, detail="Codigo incorrecto")
    if token_doc["expires_at"].replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="El codigo caduco. Pide uno nuevo.")

    voluntario = await _buscar_voluntario(db, email)
    acceso = await _acceso_de_equipo(db, email, voluntario)
    if not voluntario and not acceso["tiene_cuenta"]:
        raise HTTPException(status_code=404, detail="Ese correo no tiene cuenta en el equipo")

    heredado = acceso["heredado"]

    # La contrasena va a la cuenta unica, que es de donde lee cualquier acceso.
    # Antes se guardaba en `admin_users`, y a quien ya tenia cuenta de corredor
    # eso le dejaba una contrasena que no abria nada: el acceso miraba primero
    # su cuenta, donde seguia la otra. Si la persona ya tenia cuenta gana aqui
    # el rol de equipo en esa misma; los permisos no se tocan.
    cuenta = await cuentas.cuenta_de_equipo(
        db,
        email,
        password=datos.password,
        nombre=(voluntario or {}).get("nombre") or (heredado or {}).get("nombre") or "",
        apellidos=(voluntario or {}).get("apellidos") or "",
        permissions=(heredado or {}).get("permissions"),
    )
    cuenta = await cuentas.poner_al_dia(db, cuenta)

    if heredado:
        # Mientras `admin_users` siga viva, que no guarde una contrasena vieja.
        await db.admin_users.update_one(
            {"username": email},
            {"$set": {"password": cuenta["password_hash"], "updated_at": datetime.now(timezone.utc)}},
        )

    await db.volunteer_verification_tokens.delete_many({"email": email})

    permisos = cuenta.get("permissions") or []
    return {
        "token": cuentas.emitir_token(cuenta),
        "username": email,
        "nombre": f"{cuenta.get('nombre') or ''} {cuenta.get('apellidos') or ''}".strip(),
        "is_admin": False,
        "permissions": permisos,
    }


# ==================== PERFIL ====================


# Lo que cuelga del correo de la sesion —la ficha, los turnos, el carnet— se
# busca por ese correo y por nada mas. Y una cuenta de staff se crea desde la
# app con el correo que uno quiera escribir: sin esta comprobacion, conocer el
# correo de un voluntario era leer su telefono, su tipo de sangre, sus alergias
# y su contacto de emergencia, y poder soltarle los turnos.

AVISO_VERIFICAR = (
    "Confirma tu correo para ver tu ficha y tus turnos. "
    "Te enviamos un codigo; si no lo tienes, pide otro."
)
AVISO_SESION = "Tu contrasena cambio despues de abrir esta sesion. Sal y vuelve a entrar."


async def equipo_con_correo_demostrado(payload: dict = Depends(require_admin)) -> dict:
    """Dependencia: alguien del equipo cuyo correo es suyo de verdad.

    Es la que piden las rutas que ensenan o tocan lo del voluntario. El perfil
    (`mi_perfil`) no la usa porque no rechaza: responde vacio, que es lo que la
    app ya instalada sabe pintar.
    """
    from server import db

    cuenta = await cuentas.de_la_sesion(db, payload)
    if not cuentas.sesion_demostrada(payload, cuenta):
        raise HTTPException(
            status_code=403,
            detail=AVISO_SESION if cuentas.demostrada(cuenta) else AVISO_VERIFICAR,
        )
    return payload


def turno_confirmado(slot: dict) -> bool:
    """Si quien tiene el turno ha reconfirmado que va.

    La confirmacion guarda quien la hizo, y vale solo mientras el turno siga
    siendo suyo. Asi no hay que acordarse de borrarla en cada sitio que
    reasigna un turno: si pasa a otra persona, deja de contar sola.
    """
    asignado = (slot.get("email_asignado") or "").lower()
    return bool(asignado) and (slot.get("confirmado_por") or "").lower() == asignado


def _turno_legible(slot: dict) -> dict:
    """Los turnos se guardan con las claves en espanol de volunteer_assignments."""
    confirmado = turno_confirmado(slot)
    return {
        "slot_id": slot.get("id"),
        "puesto": slot.get("puesto"),
        "turno": slot.get("turno"),
        "dia": slot.get("dia"),
        "hora_inicio": slot.get("hora_inicio"),
        "hora_fin": slot.get("hora_fin"),
        "confirmado": confirmado,
        "confirmado_at": slot.get("confirmado_at") if confirmado else None,
    }


def _perfil_legible(voluntario: dict) -> dict:
    """La ficha del voluntario tal como la ve el mismo."""
    return {
        "nombre": voluntario.get("nombre"),
        "apellidos": voluntario.get("apellidos"),
        "email": voluntario.get("email"),
        "telefono": voluntario.get("telefono"),
        "fecha_nacimiento": voluntario.get("fecha_nacimiento"),
        "sexo": voluntario.get("sexo"),
        "nacionalidad": voluntario.get("nacionalidad"),
        "ciudad_residencia": voluntario.get("ciudad_residencia"),
        "talla_camiseta": voluntario.get("talla_camiseta"),
        "tipo_sangre": voluntario.get("tipo_sangre"),
        "condicion_medica": voluntario.get("condicion_medica"),
        "condicion_medica_detalle": voluntario.get("condicion_medica_detalle"),
        "alergias": voluntario.get("alergias"),
        "alergias_detalle": voluntario.get("alergias_detalle"),
        "contacto_emergencia_nombre": voluntario.get("contacto_emergencia_nombre"),
        "contacto_emergencia_relacion": voluntario.get("contacto_emergencia_relacion"),
        "contacto_emergencia_telefono": voluntario.get("contacto_emergencia_telefono"),
        "race_code": voluntario.get("race_code"),
    }


@router.get("/mi-perfil")
async def mi_perfil(payload: dict = Depends(require_admin)):
    """Datos del miembro del staff y los turnos que tiene asignados."""
    from server import db

    email = (payload.get("username") or "").lower()

    cuenta = await cuentas.de_la_sesion(db, payload)
    if not cuentas.sesion_demostrada(payload, cuenta):
        # Ni ficha ni turnos, tenga o no registro de voluntario ese correo: que
        # la respuesta cambiara segun lo tuviera ya seria decir quien esta
        # apuntado.
        #
        # Dos motivos, que la app distingue: el correo esta sin confirmar (se
        # le manda el codigo, aparte para no hacer esperar a la pantalla por el
        # correo), o la sesion es anterior a un cambio de contrasena y basta
        # con volver a entrar.
        caducada = cuentas.demostrada(cuenta)
        if not caducada:
            asyncio.create_task(cuentas.avisar_de_verificacion(db, cuenta))
        return {
            "username": email,
            "es_voluntario": False,
            "perfil": None,
            "turnos": [],
            "evento": "carrera",
            "slots_interes": [],
            "verificacion_pendiente": not caducada,
            "sesion_caducada": caducada,
        }

    voluntario = await _buscar_voluntario(db, email)

    asignaciones = await db.volunteer_assignments.find(
        {"email_asignado": email}, {"_id": 0}
    ).to_list(200)
    asignaciones.sort(key=lambda s: (s.get("dia") or "", s.get("hora_inicio") or ""))

    perfil = _perfil_legible(voluntario) if voluntario else None

    return {
        "username": email,
        "es_voluntario": voluntario is not None,
        "perfil": perfil,
        "turnos": [_turno_legible(s) for s in asignaciones],
        # Lo que el voluntario pidio, que no es lo mismo que lo que le
        # asignaron: la organizacion decide despues.
        "evento": (voluntario or {}).get("evento") or "carrera",
        "slots_interes": (voluntario or {}).get("slots_interes") or [],
        "verificacion_pendiente": False,
        "sesion_caducada": False,
    }


@router.get("/mi-perfil/postulaciones")
async def mis_postulaciones(payload: dict = Depends(equipo_con_correo_demostrado)):
    """Las postulaciones del voluntario, con la llave para editar cada una.

    En la web, editar la postulacion era pedir un enlace al correo y esperar a
    que llegara. Quien ya entro con su cuenta demostro lo mismo que demuestra
    abrir ese correo, asi que se le da el enlace directamente. Solo las de su
    edicion mas reciente, una por evento, como el carnet.
    """
    from server import db
    from routes.volunteer_registration import generate_edit_token, nombre_evento

    email = (payload.get("username") or "").lower()
    registros = await db.volunteer_registrations.find(
        {"email": email, "status": {"$ne": "cancelled"}}
    ).sort("created_at", -1).to_list(20)
    if not registros:
        return {"postulaciones": []}

    edicion = registros[0].get("race_code")
    carrera = await db.race_configurations.find_one({"code": edicion}) if edicion else None

    postulaciones, vistos = [], set()
    for r in registros:
        evento = r.get("evento") or "carrera"
        if r.get("race_code") != edicion or evento in vistos:
            continue
        vistos.add(evento)

        llave = r.get("edit_token")
        if not llave:
            llave = generate_edit_token()
            await db.volunteer_registrations.update_one(
                {"_id": r["_id"]}, {"$set": {"edit_token": llave}}
            )
        postulaciones.append({
            "evento": evento,
            "evento_nombre": nombre_evento(carrera, evento),
            "edit_token": llave,
        })

    return {"postulaciones": postulaciones}


@router.delete("/mi-perfil/turnos/{slot_id}")
async def soltar_turno(slot_id: int, payload: dict = Depends(equipo_con_correo_demostrado)):
    """El voluntario suelta un turno que le habian asignado.

    Antes tenia que escribir a la organizacion para que se lo quitara a mano.
    El turno vuelve a quedar libre y se le retira tambien de lo que pidio, para
    que no se lo vuelvan a asignar en la siguiente ronda.
    """
    from server import db

    email = (payload.get("username") or "").lower()

    slot = await db.volunteer_assignments.find_one({"id": slot_id}, {"_id": 0})
    if not slot:
        raise HTTPException(status_code=404, detail="Ese turno no existe")
    if (slot.get("email_asignado") or "").lower() != email:
        raise HTTPException(status_code=403, detail="Ese turno no es tuyo")

    await db.volunteer_assignments.update_one(
        {"id": slot_id},
        {"$set": {"email_asignado": None, "nombre_asignado": None,
                  "updated_at": datetime.now(timezone.utc)},
         "$unset": {"confirmado_por": "", "confirmado_at": ""}},
    )
    await db.volunteer_registrations.update_many(
        {"email": email},
        {"$pull": {"slots_interes": slot_id}},
    )

    return {"success": True}


@router.post("/mi-perfil/turnos/{slot_id}/confirmar")
async def confirmar_turno(slot_id: int, payload: dict = Depends(equipo_con_correo_demostrado)):
    """El voluntario reconfirma que va a cubrir un turno que le asignaron.

    Entre que se asigna un turno y llega el evento pasan semanas, y la
    organizacion no tenia forma de saber quien sigue contando con ir salvo
    llamando uno por uno. Confirmar no cambia la asignacion: solo deja dicho
    quien lo confirmo y cuando, y el panel lo ensena junto al turno.
    """
    from server import db

    email = (payload.get("username") or "").lower()

    slot = await db.volunteer_assignments.find_one({"id": slot_id}, {"_id": 0})
    if not slot:
        raise HTTPException(status_code=404, detail="Ese turno no existe")
    if (slot.get("email_asignado") or "").lower() != email:
        raise HTTPException(status_code=403, detail="Ese turno no es tuyo")

    # Volver a pulsar no mueve la fecha: interesa cuando lo confirmo.
    if not turno_confirmado(slot):
        ahora = datetime.now(timezone.utc)
        await db.volunteer_assignments.update_one(
            {"id": slot_id},
            {"$set": {"confirmado_por": email, "confirmado_at": ahora, "updated_at": ahora}},
        )
        slot = {**slot, "confirmado_por": email, "confirmado_at": ahora}

    return {"success": True, "turno": _turno_legible(slot)}


# ==================== EDITAR LO PROPIO ====================

SI_NO = Literal["Sí", "No"]

# Lo que el registro exige: se puede corregir, no dejar vacio.
OBLIGATORIOS = {
    "nombre": "el nombre",
    "apellidos": "los apellidos",
    "telefono": "el telefono",
    "contacto_emergencia_nombre": "el nombre del contacto de emergencia",
    "contacto_emergencia_telefono": "el telefono del contacto de emergencia",
}


class MisDatos(BaseModel):
    """Lo que el voluntario puede corregir de su ficha. Todo opcional: cada
    tarjeta de la pantalla manda solo lo suyo. El correo no esta: es la
    identidad con la que entra."""
    nombre: Optional[str] = Field(default=None, max_length=80)
    apellidos: Optional[str] = Field(default=None, max_length=80)
    telefono: Optional[str] = Field(default=None, max_length=40)
    fecha_nacimiento: Optional[str] = Field(default=None, max_length=10)
    sexo: Optional[Literal["Masculino", "Femenino", "Otro", ""]] = None
    nacionalidad: Optional[str] = Field(default=None, max_length=80)
    ciudad_residencia: Optional[str] = Field(default=None, max_length=80)
    talla_camiseta: Optional[Literal["XS", "S", "M", "L", "XL", "XXL", ""]] = None

    tipo_sangre: Optional[str] = Field(default=None, max_length=10)
    condicion_medica: Optional[SI_NO] = None
    condicion_medica_detalle: Optional[str] = Field(default=None, max_length=500)
    alergias: Optional[SI_NO] = None
    alergias_detalle: Optional[str] = Field(default=None, max_length=500)
    contacto_emergencia_nombre: Optional[str] = Field(default=None, max_length=120)
    contacto_emergencia_relacion: Optional[str] = Field(default=None, max_length=60)
    contacto_emergencia_telefono: Optional[str] = Field(default=None, max_length=40)


@router.put("/mi-perfil/datos")
async def editar_mis_datos(datos: MisDatos, payload: dict = Depends(equipo_con_correo_demostrado)):
    """El voluntario corrige sus datos personales o los de salud y emergencia.

    Antes, cambiar el telefono era abrir el formulario entero de la
    postulacion. Los datos son de la persona, no de un evento: quien se apunto
    a la carrera y al campeonato tiene dos registros, y se corrigen los dos.
    Los turnos no pasan por aqui.
    """
    from server import db

    email = (payload.get("username") or "").lower()

    cambios = {}
    for campo, valor in datos.model_dump(exclude_unset=True).items():
        if isinstance(valor, str):
            valor = valor.strip()
        cambios[campo] = valor or None

    for campo, nombre in OBLIGATORIOS.items():
        if campo in cambios and not cambios[campo]:
            raise HTTPException(status_code=400, detail=f"Falta {nombre}")

    # Sin condicion o sin alergias, el detalle de antes no pinta nada.
    if cambios.get("condicion_medica") == "No":
        cambios["condicion_medica_detalle"] = None
    if cambios.get("alergias") == "No":
        cambios["alergias_detalle"] = None

    registros = await db.volunteer_registrations.find(
        {"email": email, "status": {"$ne": "cancelled"}}
    ).sort("created_at", -1).to_list(20)
    if not registros:
        raise HTTPException(status_code=404, detail="No tienes un registro de voluntariado")

    if cambios:
        edicion = registros[0].get("race_code")
        ids = [r["_id"] for r in registros if r.get("race_code") == edicion]
        await db.volunteer_registrations.update_many(
            {"_id": {"$in": ids}},
            {"$set": {**cambios, "updated_at": datetime.now(timezone.utc)}},
        )

        # El nombre tambien viaja copiado en cada turno asignado.
        if "nombre" in cambios or "apellidos" in cambios:
            actual = {**registros[0], **cambios}
            completo = f"{actual.get('nombre') or ''} {actual.get('apellidos') or ''}".strip()
            await db.volunteer_assignments.update_many(
                {"email_asignado": email}, {"$set": {"nombre_asignado": completo}}
            )

    return {"success": True, "perfil": _perfil_legible({**registros[0], **cambios})}


@router.get("/equipo/emergency-info", dependencies=[Depends(require_permission("scanner"))])
async def equipo_emergency_info(race_code: Optional[str] = None):
    """Datos de salud y contacto de emergencia del equipo de staff.

    El mismo caso que con los atletas: quien pasa 24 horas en pie en el corral
    tambien puede descomponerse, y ahi hace falta saber su tipo de sangre y a
    quien llamar. Va con el permiso "scanner" del panel, no con la clave de
    escaneo de la carrera.
    """
    from server import db

    filtro = {"status": {"$ne": "cancelled"}}
    if race_code:
        filtro["race_code"] = race_code

    docs = await db.volunteer_registrations.find(filtro, {
        "_id": 0, "nombre": 1, "apellidos": 1, "email": 1, "telefono": 1, "sexo": 1,
        "tipo_sangre": 1, "condicion_medica": 1, "condicion_medica_detalle": 1,
        "alergias": 1, "alergias_detalle": 1, "contacto_emergencia_nombre": 1,
        "contacto_emergencia_relacion": 1, "contacto_emergencia_telefono": 1,
    }).to_list(1000)

    equipo = [
        {**d, "nombre_completo": f"{d.get('nombre','')} {d.get('apellidos','')}".strip()}
        for d in docs
    ]
    equipo.sort(key=lambda v: v["nombre_completo"].lower())

    return {"total": len(equipo), "equipo": equipo}


# ==================== ELEGIR TURNOS ====================


class SeleccionTurnos(BaseModel):
    evento: Optional[str] = None
    slots_interes: list = []


@router.get("/mi-perfil/turnos-disponibles")
async def turnos_disponibles(evento: Optional[str] = None, payload: dict = Depends(equipo_con_correo_demostrado)):
    """Puestos y turnos con plazas libres, para que el voluntario elija.

    Reusa el mismo listado del registro publico, pero pasandole su correo: asi
    los turnos que el mismo ya pidio siguen apareciendo como elegibles y no se
    los cuenta como ocupados por otro.
    """
    from routes.volunteer_registration import get_available_slots

    email = (payload.get("username") or "").lower()
    return await get_available_slots(evento=evento, email=email)


@router.put("/mi-perfil/turnos")
async def elegir_turnos(datos: SeleccionTurnos, payload: dict = Depends(equipo_con_correo_demostrado)):
    """Guarda el evento y los turnos que el voluntario quiere cubrir.

    Antes esto solo se podia hacer desde la web, con el enlace que llegaba por
    correo. Aqui basta con su sesion.
    """
    from server import db
    from routes.volunteer_registration import (
        VALID_EVENTOS, eventos_abiertos, nombre_evento, validar_slots_libres,
        validar_sin_solapes,
    )

    email = (payload.get("username") or "").lower()
    registro = await _buscar_voluntario(db, email)
    if not registro:
        raise HTTPException(status_code=404, detail="No tienes un registro de voluntariado")

    evento = datos.evento if datos.evento in VALID_EVENTOS else (registro.get("evento") or "carrera")

    # Cambiarse a un evento cerrado no vale; quedarse en el suyo, si.
    if evento != (registro.get("evento") or "carrera"):
        carrera = await db.race_configurations.find_one({"is_active": True})
        if evento not in eventos_abiertos(carrera):
            raise HTTPException(
                status_code=400,
                detail=f"El registro de voluntarios para {nombre_evento(carrera, evento)} esta cerrado por ahora",
            )

    slots = [int(s) for s in (datos.slots_interes or [])]
    # Que sigan libres: entre que se cargo la pantalla y se pulso guardar,
    # otro voluntario pudo quedarse con el turno.
    await validar_slots_libres(db, slots, email)
    # Y que no se pisen entre ellos: nadie cubre dos puestos a la vez.
    await validar_sin_solapes(db, slots, evento)

    await db.volunteer_registrations.update_one(
        {"_id": registro["_id"]},
        {"$set": {
            "evento": evento,
            "slots_interes": slots,
            "updated_at": datetime.now(timezone.utc),
        }},
    )

    return {"success": True, "evento": evento, "slots_interes": slots}
