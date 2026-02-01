from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from typing import Optional, Literal, List
from datetime import datetime, timezone, timedelta
import random
import string

router = APIRouter(prefix="/volunteer-registration", tags=["volunteer-registration"])


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


@router.get("/available-slots")
async def get_available_slots():
    """Get all available (unassigned) volunteer slots grouped by position and shift"""
    from server import db
    
    # Get active race for the event date
    active_race = await db.race_configurations.find_one({"is_active": True})
    race_date = active_race.get("date", "2027-01-23") if active_race else "2027-01-23"
    
    # Get all slots from the correct collection
    slots = await db.volunteer_assignments.find({}, {"_id": 0}).to_list(1000)
    
    # Group by position
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
                "slots": [],
                "available_count": 0,
                "total_count": 0
            }
        
        positions[puesto]["turnos"][turno]["total_count"] += 1
        if is_available:
            positions[puesto]["turnos"][turno]["available_count"] += 1
            positions[puesto]["turnos"][turno]["slots"].append({
                "id": slot.get("id"),
                "slot_number": slot.get("slot"),
                "hora_inicio": slot.get("hora_inicio"),
                "hora_fin": slot.get("hora_fin")
            })
    
    # Convert to list format
    positions_list = []
    for puesto, data in sorted(positions.items()):
        turnos_list = []
        for turno, turno_data in sorted(data["turnos"].items()):
            if turno_data["available_count"] > 0:  # Only include shifts with available slots
                turnos_list.append({
                    "turno": turno,
                    "hora_inicio": shifts_info[turno]["hora_inicio"],
                    "hora_fin": shifts_info[turno]["hora_fin"],
                    "available_count": turno_data["available_count"],
                    "total_count": turno_data["total_count"],
                    "slots": turno_data["slots"]
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
async def send_verification(request: VerificationRequest):
    """Send verification code to volunteer's email"""
    from server import db
    
    email = request.email.lower()
    
    # Get active race
    active_race = await db.race_configurations.find_one({"is_active": True})
    race_code = active_race["code"] if active_race else "BYSD-2027"
    
    # Check if already registered as volunteer for this race
    existing = await db.volunteer_registrations.find_one({
        "email": email,
        "race_code": race_code,
        "email_verified": True
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Este correo ya está registrado como voluntario para esta carrera")
    
    # Generate and store verification code
    code = generate_verification_code()
    
    await db.volunteer_verification_tokens.delete_many({"email": email})
    await db.volunteer_verification_tokens.insert_one({
        "email": email,
        "code": code,
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=30)
    })
    
    # Send email
    try:
        from services.email_service import send_email
        
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #7c3aed;">🏃 Backyard Ultra Santo Domingo</h1>
                <h2 style="color: #333;">Registro de Voluntarios</h2>
            </div>
            
            <div style="background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%); color: white; padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
                <p style="margin: 0; font-size: 16px;">Tu código de verificación es:</p>
                <h1 style="font-size: 48px; letter-spacing: 8px; margin: 20px 0;">{code}</h1>
                <p style="margin: 0; font-size: 14px; opacity: 0.9;">Este código expira en 30 minutos</p>
            </div>
            
            <p style="color: #666; text-align: center;">
                ¡Gracias por tu interés en ser parte del equipo de voluntarios! 💪
            </p>
        </div>
        """
        
        await send_email(
            to_email=email,
            subject="🏃 Código de Verificación - Voluntarios BYSD",
            html_content=html_content
        )
    except Exception as e:
        print(f"Error sending email: {e}")
        # Continue anyway for development
    
    return {"message": "Código de verificación enviado", "email": email}


@router.post("/verify-code")
async def verify_code(request: VerificationConfirm):
    """Verify the email code"""
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
    
    return {
        "message": "Email verificado",
        "session_token": session_token,
        "email": email
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
    
    # Check if already registered
    existing = await db.volunteer_registrations.find_one({
        "email": email,
        "race_code": race_code
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Ya estás registrado como voluntario")
    
    # Generate edit token
    edit_token = generate_edit_token()
    
    # Create registration
    registration = {
        **data.dict(),
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
    
    # Send confirmation email
    try:
        from services.email_service import send_email
        
        edit_url = f"{process.env.get('FRONTEND_URL', 'https://race-dashboard-12.preview.emergentagent.com')}/voluntarios/registro?token={edit_token}"
        
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #7c3aed;">🏃 Backyard Ultra Santo Domingo</h1>
            </div>
            
            <div style="background: #f0fdf4; border: 1px solid #86efac; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                <h2 style="color: #166534; margin-top: 0;">✅ ¡Registro de Voluntario Confirmado!</h2>
                <p style="color: #166534;">Hola {data.nombre}, gracias por registrarte como voluntario.</p>
            </div>
            
            <p style="color: #666;">
                Nos pondremos en contacto contigo pronto con más información sobre las tareas y horarios.
            </p>
            
            <p style="color: #666; font-size: 14px;">
                ¡Gracias por ser parte del equipo! 💪
            </p>
        </div>
        """
        
        await send_email(
            to_email=email,
            subject="✅ Registro de Voluntario Confirmado - BYSD",
            html_content=html_content
        )
    except Exception as e:
        print(f"Error sending confirmation email: {e}")
    
    return {
        "message": "Registro exitoso",
        "edit_token": edit_token
    }


@router.get("/admin/registrations")
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
    
    return {"registrations": registrations, "count": len(registrations)}


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
