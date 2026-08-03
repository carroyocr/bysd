from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, EmailStr
from typing import Optional, Literal, List
from datetime import datetime, timezone, timedelta
import random
import string

from services import rate_limit
from services.auth import require_permission

router = APIRouter(prefix="/volunteer-registration", tags=["volunteer-registration"])

# Listar, editar y borrar voluntarios exige el permiso "volunteers".
admin_router = APIRouter(
    prefix="/admin",
    tags=["volunteer-registration-admin"],
    dependencies=[Depends(require_permission("volunteers"))],
)

VALID_EVENTOS = ["carrera", "campeonato"]


def evento_query(evento: str) -> dict:
    """Mongo filter fragment by event. Legacy docs (no 'evento') count as 'carrera'."""
    if evento == "campeonato":
        return {"evento": "campeonato"}
    return {"$or": [{"evento": "carrera"}, {"evento": {"$exists": False}}, {"evento": None}]}


class VerificationRequest(BaseModel):
    email: EmailStr


class VerificationConfirm(BaseModel):
    email: EmailStr
    code: str


class VolunteerRegistrationData(BaseModel):
    # Personal info
    nombre: str
    apellidos: str
    fecha_nacimiento: str
    sexo: Literal["Masculino", "Femenino", "Otro"]
    nacionalidad: str
    telefono: str
    ciudad_residencia: str
    
    # Experience
    experiencia_voluntariado: Literal["Sí", "No"]
    experiencia_voluntariado_detalle: Optional[str] = None
    
    # Slot preferences - list of slot IDs the volunteer is interested in
    slots_interes: Optional[List[int]] = None
    
    # Event the volunteer is registering for ('carrera' or 'campeonato')
    evento: Optional[str] = "carrera"
    
    # Medical
    tipo_sangre: Optional[str] = None
    condicion_medica: Optional[Literal["Sí", "No"]] = None
    condicion_medica_detalle: Optional[str] = None
    alergias: Optional[Literal["Sí", "No"]] = None
    alergias_detalle: Optional[str] = None
    
    # Emergency contact
    contacto_emergencia_nombre: str
    contacto_emergencia_relacion: Optional[str] = None
    contacto_emergencia_telefono: str
    
    # Preferences
    talla_camiseta: Optional[Literal["XS", "S", "M", "L", "XL", "XXL"]] = None
    como_se_entero: Optional[str] = None
    comentarios: Optional[str] = None


class VolunteerCancellationRequest(BaseModel):
    reason: str
    other_reason: Optional[str] = None


@router.post("/cancel/{token}")
async def cancel_volunteer_registration(token: str, cancellation: VolunteerCancellationRequest):
    """Cancel and delete a volunteer registration"""
    from server import db
    
    registration = await db.volunteer_registrations.find_one({"edit_token": token})
    
    if not registration:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    
    reason_text = cancellation.reason
    if cancellation.reason == "Otra razón" and cancellation.other_reason:
        reason_text = f"Otra razón: {cancellation.other_reason}"
    
    # Store data for email before deletion
    nombre = f"{registration.get('nombre', '')} {registration.get('apellidos', '')}".strip()
    email = registration.get("email", "").lower()
    race_code = registration.get("race_code", "")

    # Remove slot assignments for this volunteer, only within this
    # registration's event (they may also volunteer for the other one)
    await db.volunteer_assignments.update_many(
        {"email_asignado": email, **evento_query(registration.get("evento") or "carrera")},
        {"$set": {"email_asignado": None, "nombre_asignado": None}}
    )
    
    # Delete the registration completely
    await db.volunteer_registrations.delete_one({"edit_token": token})
    
    # Clean up related data (only if no other registration remains)
    remaining = await db.volunteer_registrations.count_documents({"email": email})
    if remaining == 0:
        await db.volunteer_verification_tokens.delete_many({"email": email})
        await db.volunteer_sessions.delete_many({"email": email})

    # Send cancellation confirmation email using template system
    try:
        from services.template_email_service import (
            send_email_with_template, build_race_data, build_volunteer_data
        )
        
        race_config = await db.race_configurations.find_one({"code": race_code}) if race_code else await db.race_configurations.find_one({"is_active": True})
        
        merge_data = {
            **build_race_data(race_config),
            **build_volunteer_data(registration),
            "cancellation_reason": reason_text,
        }
        
        await send_email_with_template(
            db=db,
            template_id="volunteer_cancellation",
            to_email=email,
            data=merge_data
        )
    except Exception as e:
        print(f"Error sending cancellation email: {e}")
    
    return {"message": "Registro de voluntario cancelado y eliminado exitosamente"}


@router.get("/available-slots")
async def get_available_slots(evento: Optional[str] = None):
    """Get available volunteer slots grouped by position and shift (one per turno).
    Optionally filtered by event ('carrera' or 'campeonato')."""
    from server import db
    
    # Get active race for the event date
    active_race = await db.race_configurations.find_one({"is_active": True})
    race_date = active_race.get("date", "2027-01-23") if active_race else "2027-01-23"
    
    # Get all slots from the correct collection, filtered by event
    query = evento_query(evento) if evento in VALID_EVENTOS else {}
    slots = await db.volunteer_assignments.find(query, {"_id": 0}).to_list(1000)
    
    # Group by position and turno
    positions = {}
    shifts_info = {}
    
    for slot in slots:
        puesto = slot.get("puesto", "")
        turno = slot.get("turno", "")
        is_available = not slot.get("email_asignado")
        
        # Build shift info
        if turno not in shifts_info:
            shifts_info[turno] = {
                "turno": turno,
                "hora_inicio": slot.get("hora_inicio", ""),
                "hora_fin": slot.get("hora_fin", ""),
                "dia": slot.get("dia", "")
            }
        
        # Build position info
        if puesto not in positions:
            positions[puesto] = {
                "puesto": puesto,
                "turnos": {}
            }
        
        if turno not in positions[puesto]["turnos"]:
            positions[puesto]["turnos"][turno] = {
                "first_available_slot_id": None,
                "available_count": 0,
                "total_count": 0,
                "hora_inicio": slot.get("hora_inicio"),
                "hora_fin": slot.get("hora_fin")
            }
        
        positions[puesto]["turnos"][turno]["total_count"] += 1
        if is_available:
            positions[puesto]["turnos"][turno]["available_count"] += 1
            # Keep track of first available slot ID
            if positions[puesto]["turnos"][turno]["first_available_slot_id"] is None:
                positions[puesto]["turnos"][turno]["first_available_slot_id"] = slot.get("id")
    
    # Convert to list format - ONE entry per turno (not per slot)
    positions_list = []
    for puesto, data in sorted(positions.items()):
        turnos_list = []
        for turno, turno_data in sorted(data["turnos"].items()):
            if turno_data["available_count"] > 0:  # Only include shifts with available slots
                turnos_list.append({
                    "turno": turno,
                    "hora_inicio": turno_data["hora_inicio"],
                    "hora_fin": turno_data["hora_fin"],
                    "available_count": turno_data["available_count"],
                    "total_count": turno_data["total_count"],
                    "slot_id": turno_data["first_available_slot_id"]  # Single slot ID for selection
                })
        
        if turnos_list:  # Only include positions with available shifts
            positions_list.append({
                "puesto": puesto,
                "turnos": turnos_list
            })
    
    return {
        "positions": positions_list,
        "shifts_info": list(shifts_info.values()),
        "race_date": race_date
    }


def generate_verification_code():
    return ''.join(random.choices(string.digits, k=6))


def generate_edit_token():
    return ''.join(random.choices(string.ascii_letters + string.digits, k=32))


@router.post("/send-verification")
async def send_verification(request: VerificationRequest, http_request: Request = None):
    """Send verification code to volunteer's email"""
    rate_limit.limitar_envio_codigo(http_request)
    from server import db
    
    email = request.email.lower()

    # Get active race
    active_race = await db.race_configurations.find_one({"is_active": True})

    # El codigo se envia SIEMPRE, tenga o no registros previos: despues de
    # verificar el correo se le muestran sus opciones (editar o crear otra).
    # Generate and store verification code
    code = generate_verification_code()
    
    await db.volunteer_verification_tokens.delete_many({"email": email})
    await db.volunteer_verification_tokens.insert_one({
        "email": email,
        "code": code,
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=30)
    })
    
    # Send email using template system
    try:
        from services.template_email_service import (
            send_email_with_template, build_race_data, build_general_data
        )
        
        merge_data = {
            **build_race_data(active_race),
            **build_general_data(verification_code=code),
        }
        
        await send_email_with_template(
            db=db,
            template_id="volunteer_verification_code",
            to_email=email,
            data=merge_data
        )
    except Exception as e:
        print(f"Error sending email: {e}")
        # Continue anyway for development
    
    return {"message": "Código de verificación enviado", "email": email, "status": "code_sent"}


@router.post("/verify-code")
async def verify_code(request: VerificationConfirm, http_request: Request = None):
    """Verify the email code"""
    rate_limit.limitar_verificacion(http_request)
    from server import db
    
    email = request.email.lower()
    
    token = await db.volunteer_verification_tokens.find_one({
        "email": email,
        "code": request.code
    })
    
    if not token:
        raise HTTPException(status_code=400, detail="Código inválido o expirado")
    
    # Generate session token
    session_token = generate_edit_token()

    # Store session
    await db.volunteer_sessions.insert_one({
        "email": email,
        "token": session_token,
        "created_at": datetime.now(timezone.utc)
    })

    # Clean up verification token
    await db.volunteer_verification_tokens.delete_many({"email": email})

    # Con el correo ya verificado es seguro devolver las postulaciones
    # existentes (con su token de edicion) para que el frontend ofrezca
    # editar directamente o crear una nueva para el evento que falta.
    active_race = await db.race_configurations.find_one({"is_active": True})
    race_code = active_race["code"] if active_race else "BYSD-2027"

    existing_regs = await db.volunteer_registrations.find({
        "email": email,
        "race_code": race_code
    }).to_list(10)

    registrations = []
    for reg in existing_regs:
        edit_token = reg.get("edit_token")
        if not edit_token:
            edit_token = generate_edit_token()
            await db.volunteer_registrations.update_one(
                {"_id": reg["_id"]},
                {"$set": {"edit_token": edit_token}}
            )
        registrations.append({
            "evento": reg.get("evento") or "carrera",
            "edit_token": edit_token
        })

    eventos_disponibles = [
        e for e in VALID_EVENTOS
        if e not in {r["evento"] for r in registrations}
    ]

    return {
        "message": "Email verificado",
        "session_token": session_token,
        "email": email,
        "registrations": registrations,
        "eventos_disponibles": eventos_disponibles
    }


@router.post("/register")
async def register_volunteer(
    data: VolunteerRegistrationData,
    email: str,
    session_token: str
):
    """Register a new volunteer"""
    from server import db
    
    email = email.lower()
    
    # Verify session
    session = await db.volunteer_sessions.find_one({
        "email": email,
        "token": session_token
    })
    
    if not session:
        raise HTTPException(status_code=401, detail="Sesión inválida")
    
    # Get active race
    active_race = await db.race_configurations.find_one({"is_active": True})
    race_code = active_race["code"] if active_race else "BYSD-2027"
    
    # Check if already registered for this specific event
    evento = data.evento if data.evento in VALID_EVENTOS else "carrera"
    existing = await db.volunteer_registrations.find_one({
        "email": email,
        "race_code": race_code,
        **evento_query(evento)
    })

    if existing:
        raise HTTPException(status_code=400, detail="Ya estás registrado como voluntario para este evento")
    
    # Generate edit token
    edit_token = generate_edit_token()
    
    # Create registration
    registration = {
        **data.dict(),
        "evento": evento,
        "email": email,
        "race_code": race_code,
        "email_verified": True,
        "status": "registered",
        "edit_token": edit_token,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.volunteer_registrations.insert_one(registration)
    
    # Clean up session
    await db.volunteer_sessions.delete_many({"email": email})
    
    # Send confirmation email with edit link using template system
    try:
        from services.template_email_service import (
            send_email_with_template, build_race_data, build_volunteer_data
        )
        import os
        
        frontend_url = os.environ.get('FRONTEND_URL', 'https://admin-dashboard-v2-66.preview.emergentagent.com')
        edit_url = f"{frontend_url}/voluntarios/registro?token={edit_token}"
        
        merge_data = {
            **build_race_data(active_race),
            **build_volunteer_data(registration, edit_token=edit_token),
            "volunteer_edit_link": edit_url,
        }
        
        await send_email_with_template(
            db=db,
            template_id="volunteer_registration_confirmation",
            to_email=email,
            data=merge_data
        )
        print(f"Confirmation email sent to {email}")
    except Exception as e:
        print(f"Error sending confirmation email: {e}")
    
    return {
        "message": "Registro exitoso",
        "edit_token": edit_token
    }


@router.get("/by-token/{token}")
async def get_registration_by_token(token: str):
    """Get volunteer registration by edit token"""
    from server import db
    
    registration = await db.volunteer_registrations.find_one(
        {"edit_token": token},
        {"_id": 0, "edit_token": 0}
    )
    
    if not registration:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    
    return registration


@router.put("/update/{token}")
async def update_volunteer_registration(token: str, data: VolunteerRegistrationData):
    """Update volunteer registration by edit token"""
    from server import db
    
    # Find existing registration
    existing = await db.volunteer_registrations.find_one({"edit_token": token})

    if not existing:
        raise HTTPException(status_code=404, detail="Registro no encontrado")

    # Al editar no se permite cambiar a un evento donde el mismo correo
    # ya tiene otro registro
    evento = data.evento if data.evento in VALID_EVENTOS else "carrera"
    otro = await db.volunteer_registrations.find_one({
        "email": existing.get("email"),
        "race_code": existing.get("race_code"),
        "edit_token": {"$ne": token},
        **evento_query(evento)
    })
    if otro:
        raise HTTPException(status_code=400, detail="Ya tienes otro registro para ese evento")

    # Update registration
    update_data = {
        **data.dict(),
        "evento": evento,
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.volunteer_registrations.update_one(
        {"edit_token": token},
        {"$set": update_data}
    )
    
    return {"message": "Registro actualizado exitosamente"}


class EditLinkRequest(BaseModel):
    email: EmailStr


@router.post("/request-edit-link")
async def request_edit_link(request: EditLinkRequest, http_request: Request = None):
    """Request an edit link to be sent to the volunteer's email"""
    rate_limit.limitar_envio_codigo(http_request)
    from server import db
    
    email = request.email.lower()
    
    # Get active race
    active_race = await db.race_configurations.find_one({"is_active": True})
    race_code = active_race["code"] if active_race else "BYSD-2027"
    
    # Find the registrations (a volunteer can have one per event)
    registrations = await db.volunteer_registrations.find({
        "email": email,
        "race_code": race_code
    }).to_list(10)

    if not registrations:
        raise HTTPException(status_code=404, detail="No encontramos un registro con este correo electrónico")

    for registration in registrations:
        # Get the edit token
        edit_token = registration.get("edit_token")

        if not edit_token:
            # Generate a new edit token if it doesn't exist
            edit_token = generate_edit_token()
            await db.volunteer_registrations.update_one(
                {"_id": registration["_id"]},
                {"$set": {"edit_token": edit_token}}
            )

        # Send email with edit link using template system
        try:
            from services.template_email_service import (
                send_email_with_template, build_race_data, build_volunteer_data
            )
            import os

            frontend_url = os.environ.get('FRONTEND_URL', 'https://admin-dashboard-v2-66.preview.emergentagent.com')
            edit_url = f"{frontend_url}/voluntarios/registro?token={edit_token}"

            merge_data = {
                **build_race_data(active_race),
                **build_volunteer_data(registration, edit_token=edit_token),
                "volunteer_edit_link": edit_url,
            }

            await send_email_with_template(
                db=db,
                template_id="volunteer_edit_link",
                to_email=email,
                data=merge_data
            )
            print(f"Edit link email sent to {email}")
        except Exception as e:
            print(f"Error sending edit link email: {e}")
            # Continue anyway - the link was generated

    return {"message": "Link de edición enviado a tu correo"}


@admin_router.get("/registrations")
async def get_volunteer_registrations(race_code: Optional[str] = None):
    """Get all volunteer registrations for admin"""
    from server import db
    
    # Get active race if not specified
    if not race_code:
        active_race = await db.race_configurations.find_one({"is_active": True})
        race_code = active_race["code"] if active_race else "BYSD-2027"
    
    registrations = await db.volunteer_registrations.find(
        {"race_code": race_code},
        {"_id": 0, "edit_token": 0}
    ).to_list(1000)
    
    # Normalize evento for legacy registrations
    for r in registrations:
        if not r.get("evento"):
            r["evento"] = "carrera"
    
    return {"registrations": registrations, "count": len(registrations)}


class UpdateEventoRequest(BaseModel):
    evento: str


@admin_router.put("/registrations/{email}/evento")
async def update_volunteer_evento(email: str, request: UpdateEventoRequest, race_code: Optional[str] = None, evento_actual: Optional[str] = None):
    """Update the event a volunteer belongs to (admin only).
    'evento_actual' identifies which registration to move when the volunteer
    has one per event."""
    from server import db

    email = email.lower()
    evento = request.evento if request.evento in VALID_EVENTOS else "carrera"

    if not race_code:
        active_race = await db.race_configurations.find_one({"is_active": True})
        race_code = active_race["code"] if active_race else "BYSD-2027"

    query = {"email": email, "race_code": race_code}
    if evento_actual in VALID_EVENTOS:
        query.update(evento_query(evento_actual))

    existing = await db.volunteer_registrations.find_one(query)

    if not existing:
        raise HTTPException(status_code=404, detail="Voluntario no encontrado")

    if (existing.get("evento") or "carrera") != evento:
        # No mover el registro a un evento donde el correo ya tiene otro
        otro = await db.volunteer_registrations.find_one({
            "email": email,
            "race_code": race_code,
            "_id": {"$ne": existing["_id"]},
            **evento_query(evento)
        })
        if otro:
            raise HTTPException(status_code=400, detail="Este voluntario ya tiene un registro en ese evento")

    await db.volunteer_registrations.update_one(
        {"_id": existing["_id"]},
        {"$set": {"evento": evento, "updated_at": datetime.now(timezone.utc)}}
    )

    return {"message": "Evento actualizado exitosamente", "evento": evento}


@admin_router.delete("/registrations/{email}")
async def delete_volunteer_registration(email: str, race_code: Optional[str] = None, evento: Optional[str] = None):
    """Delete a volunteer registration (admin only).
    If 'evento' is provided, only that event's registration is deleted."""
    from server import db

    email = email.lower()

    if not race_code:
        active_race = await db.race_configurations.find_one({"is_active": True})
        race_code = active_race["code"] if active_race else "BYSD-2027"

    query = {"email": email, "race_code": race_code}
    if evento in VALID_EVENTOS:
        query.update(evento_query(evento))

    # Check if volunteer exists
    existing = await db.volunteer_registrations.find_one(query)

    if not existing:
        raise HTTPException(status_code=404, detail="Voluntario no encontrado")

    # Remove assignments for this volunteer within the registration's event
    await db.volunteer_assignments.update_many(
        {"email_asignado": email, **evento_query(existing.get("evento") or "carrera")},
        {"$set": {"email_asignado": None, "nombre_asignado": None}}
    )

    # Delete the registration
    await db.volunteer_registrations.delete_one({"_id": existing["_id"]})

    # Clean up related data (only if no other registration remains)
    remaining = await db.volunteer_registrations.count_documents({"email": email})
    if remaining == 0:
        await db.volunteer_verification_tokens.delete_many({"email": email})
        await db.volunteer_sessions.delete_many({"email": email})

    return {"message": "Voluntario eliminado correctamente"}


@router.get("/check/{email}")
async def check_volunteer_registration(email: str, race_code: Optional[str] = None):
    """Check if email is already registered as volunteer"""
    from server import db
    
    email = email.lower()
    
    if not race_code:
        active_race = await db.race_configurations.find_one({"is_active": True})
        race_code = active_race["code"] if active_race else "BYSD-2027"
    
    existing = await db.volunteer_registrations.find_one({
        "email": email,
        "race_code": race_code
    })
    
    return {"registered": existing is not None}


router.include_router(admin_router)
