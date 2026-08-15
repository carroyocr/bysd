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
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr

from services import rate_limit
from services.auth import encode_admin_token, require_admin, require_permission

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
    usuario = await db.admin_users.find_one({"username": correo}, {"password": 1})

    return {
        "es_voluntario": voluntario is not None,
        "tiene_cuenta": usuario is not None,
        "tiene_password": bool(usuario and usuario.get("password")),
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
    usuario = await db.admin_users.find_one({"username": email})

    # Se responde lo mismo exista o no la cuenta: si no, esto seria una forma
    # comoda de averiguar quien esta apuntado como voluntario.
    if voluntario or usuario:
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
    usuario = await db.admin_users.find_one({"username": email})
    if not voluntario and not usuario:
        raise HTTPException(status_code=404, detail="Ese correo no tiene cuenta en el equipo")

    hashed = bcrypt.hashpw(datos.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    ahora = datetime.now(timezone.utc)

    if usuario:
        # Cuenta que ya existia (por ejemplo, alguien del equipo con permisos):
        # se le cambia la contrasena y no se le tocan los permisos.
        await db.admin_users.update_one(
            {"username": email}, {"$set": {"password": hashed, "updated_at": ahora}}
        )
        permisos = usuario.get("permissions", [])
        nombre = usuario.get("nombre") or f"{voluntario.get('nombre','')} {voluntario.get('apellidos','')}".strip()
    else:
        nombre = f"{voluntario.get('nombre', '')} {voluntario.get('apellidos', '')}".strip()
        permisos = []   # solo su perfil; los permisos los da la organizacion
        await db.admin_users.insert_one({
            "username": email,
            "password": hashed,
            "nombre": nombre,
            "email": email,
            "permissions": permisos,
            "es_voluntario": True,
            "created_at": ahora,
            "updated_at": ahora,
        })

    await db.volunteer_verification_tokens.delete_many({"email": email})

    token = encode_admin_token({
        "username": email,
        "is_admin": False,
        "permissions": permisos,
        "exp": datetime.now(timezone.utc) + timedelta(hours=12),
    })
    return {
        "token": token,
        "username": email,
        "nombre": nombre,
        "is_admin": False,
        "permissions": permisos,
    }


# ==================== PERFIL ====================


def _turno_legible(slot: dict) -> dict:
    """Los turnos se guardan con las claves en espanol de volunteer_assignments."""
    return {
        "slot_id": slot.get("id"),
        "puesto": slot.get("puesto"),
        "turno": slot.get("turno"),
        "dia": slot.get("dia"),
        "hora_inicio": slot.get("hora_inicio"),
        "hora_fin": slot.get("hora_fin"),
    }


@router.get("/mi-perfil")
async def mi_perfil(payload: dict = Depends(require_admin)):
    """Datos del miembro del staff y los turnos que tiene asignados."""
    from server import db

    email = (payload.get("username") or "").lower()
    voluntario = await _buscar_voluntario(db, email)

    asignaciones = await db.volunteer_assignments.find(
        {"email_asignado": email}, {"_id": 0}
    ).to_list(200)
    asignaciones.sort(key=lambda s: (s.get("dia") or "", s.get("hora_inicio") or ""))

    perfil = None
    if voluntario:
        perfil = {
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

    return {
        "username": email,
        "es_voluntario": voluntario is not None,
        "perfil": perfil,
        "turnos": [_turno_legible(s) for s in asignaciones],
        # Lo que el voluntario pidio, que no es lo mismo que lo que le
        # asignaron: la organizacion decide despues.
        "evento": (voluntario or {}).get("evento") or "carrera",
        "slots_interes": (voluntario or {}).get("slots_interes") or [],
    }


@router.delete("/mi-perfil/turnos/{slot_id}")
async def soltar_turno(slot_id: int, payload: dict = Depends(require_admin)):
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
                  "updated_at": datetime.now(timezone.utc)}},
    )
    await db.volunteer_registrations.update_many(
        {"email": email},
        {"$pull": {"slots_interes": slot_id}},
    )

    return {"success": True}


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
async def turnos_disponibles(evento: Optional[str] = None, payload: dict = Depends(require_admin)):
    """Puestos y turnos con plazas libres, para que el voluntario elija.

    Reusa el mismo listado del registro publico, pero pasandole su correo: asi
    los turnos que el mismo ya pidio siguen apareciendo como elegibles y no se
    los cuenta como ocupados por otro.
    """
    from routes.volunteer_registration import get_available_slots

    email = (payload.get("username") or "").lower()
    return await get_available_slots(evento=evento, email=email)


@router.put("/mi-perfil/turnos")
async def elegir_turnos(datos: SeleccionTurnos, payload: dict = Depends(require_admin)):
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
