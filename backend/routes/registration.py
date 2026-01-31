from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, Literal
from datetime import datetime, timezone
from bson import ObjectId
import os
import secrets
import hashlib
import aiofiles

router = APIRouter(prefix="/api/registration", tags=["registration"])

# Get MongoDB from server
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "backyard_ultra")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Collections
registrations_collection = db["registrations"]
verification_tokens_collection = db["verification_tokens"]

# Constants
UPLOAD_DIR = "/app/backend/static/participant_photos"
MAX_PHOTO_SIZE = 10 * 1024 * 1024  # 10MB max
MIN_PHOTO_SIZE = 1 * 1024 * 1024   # 1MB min for high resolution

# Ensure upload directory exists
os.makedirs(UPLOAD_DIR, exist_ok=True)


# Pydantic Models
class RegistrationBase(BaseModel):
    # Personal Info
    email: EmailStr
    nombre: str = Field(..., min_length=2, max_length=100)
    apellidos: str = Field(..., min_length=2, max_length=100)
    fecha_nacimiento: str  # YYYY-MM-DD format
    sexo: Literal["Masculino", "Femenino"]
    nacionalidad: str = Field(..., min_length=2, max_length=100)
    telefono: str = Field(..., min_length=7, max_length=20)
    ciudad_residencia: str = Field(..., min_length=2, max_length=100)
    
    # Running Experience
    anos_experiencia: int = Field(..., ge=0)
    maxima_distancia_km: float = Field(..., ge=0)
    motivacion: str = Field(..., min_length=10, max_length=1000)
    
    # Medical Info
    tipo_sangre: str = Field(..., max_length=10)
    condicion_medica: Literal["Sí", "No"]
    condicion_medica_detalle: Optional[str] = None
    alergias: Literal["Sí", "No"]
    alergias_detalle: Optional[str] = None
    
    # Emergency Contact
    contacto_emergencia_nombre: str = Field(..., min_length=2, max_length=100)
    contacto_emergencia_relacion: Optional[str] = Field(None, max_length=50)
    contacto_emergencia_telefono: str = Field(..., min_length=7, max_length=20)
    
    # Event Preferences
    talla_camiseta: Literal["XS", "S", "M", "L", "XL", "XXL"]
    tiene_carpa: Optional[Literal["Sí", "No", "Tal vez"]] = None
    hospedaje: Optional[Literal["Si quiero acampar", "Si quisiera hospedarme en el hotel", "No lo he decidido aún"]] = None
    acompanantes: Optional[int] = Field(None, ge=0, le=20)
    como_se_entero: Optional[str] = Field(None, max_length=200)
    vueltas_aspiradas: Optional[Literal[
        "Al menos 1", "De 2 a 5", "De 6 a 10", "De 11 a 15", 
        "De 16 a 20", "De 21 a 24", "Hasta que sea el ganador", "No estoy seguro"
    ]] = None
    
    # Custom fields
    personalizacion_camiseta: str = Field(..., max_length=15, description="Text for t-shirt and bib personalization")
    
    # Race association
    race_code: str = Field(..., description="Code of the active race")


class RegistrationCreate(RegistrationBase):
    pass


class RegistrationUpdate(BaseModel):
    # All fields optional for updates
    nombre: Optional[str] = Field(None, min_length=2, max_length=100)
    apellidos: Optional[str] = Field(None, min_length=2, max_length=100)
    fecha_nacimiento: Optional[str] = None
    sexo: Optional[Literal["Masculino", "Femenino"]] = None
    nacionalidad: Optional[str] = Field(None, min_length=2, max_length=100)
    telefono: Optional[str] = Field(None, min_length=7, max_length=20)
    ciudad_residencia: Optional[str] = Field(None, min_length=2, max_length=100)
    anos_experiencia: Optional[int] = Field(None, ge=0)
    maxima_distancia_km: Optional[float] = Field(None, ge=0)
    motivacion: Optional[str] = Field(None, min_length=10, max_length=1000)
    tipo_sangre: Optional[str] = Field(None, max_length=10)
    condicion_medica: Optional[Literal["Sí", "No"]] = None
    condicion_medica_detalle: Optional[str] = None
    alergias: Optional[Literal["Sí", "No"]] = None
    alergias_detalle: Optional[str] = None
    contacto_emergencia_nombre: Optional[str] = Field(None, min_length=2, max_length=100)
    contacto_emergencia_relacion: Optional[str] = Field(None, max_length=50)
    contacto_emergencia_telefono: Optional[str] = Field(None, min_length=7, max_length=20)
    talla_camiseta: Optional[Literal["XS", "S", "M", "L", "XL", "XXL"]] = None
    tiene_carpa: Optional[Literal["Sí", "No", "Tal vez"]] = None
    hospedaje: Optional[Literal["Si quiero acampar", "Si quisiera hospedarme en el hotel", "No lo he decidido aún"]] = None
    acompanantes: Optional[int] = Field(None, ge=0, le=20)
    como_se_entero: Optional[str] = Field(None, max_length=200)
    vueltas_aspiradas: Optional[str] = None
    personalizacion_camiseta: Optional[str] = Field(None, max_length=15)


class EmailVerificationRequest(BaseModel):
    email: EmailStr


class EmailVerificationConfirm(BaseModel):
    email: EmailStr
    code: str


# Helper functions
def generate_verification_code():
    """Generate a 6-digit verification code"""
    return ''.join([str(secrets.randbelow(10)) for _ in range(6)])


def generate_edit_token():
    """Generate a secure token for editing"""
    return secrets.token_urlsafe(32)


async def send_verification_email(email: str, code: str, nombre: str):
    """Send verification email using the existing email service"""
    from services.runner_email_service import send_email
    
    subject = "Verificación de Email - Backyard Ultra Santo Domingo"
    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #7c3aed 0%, #db2777 100%); padding: 30px; border-radius: 10px; text-align: center;">
            <h1 style="color: white; margin: 0;">Backyard Ultra Santo Domingo</h1>
        </div>
        
        <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 10px 10px;">
            <h2 style="color: #1f2937;">¡Hola {nombre}!</h2>
            
            <p style="color: #4b5563; font-size: 16px;">
                Gracias por iniciar tu inscripción. Para continuar, por favor verifica tu correo electrónico 
                ingresando el siguiente código:
            </p>
            
            <div style="background: white; border: 2px solid #7c3aed; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #7c3aed;">{code}</span>
            </div>
            
            <p style="color: #6b7280; font-size: 14px;">
                Este código expira en 15 minutos. Si no solicitaste esta verificación, puedes ignorar este correo.
            </p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            
            <p style="color: #9ca3af; font-size: 12px; text-align: center;">
                © Backyard Ultra Santo Domingo
            </p>
        </div>
    </body>
    </html>
    """
    
    await send_email(email, subject, html_content)


async def send_confirmation_email(email: str, registration: dict, edit_token: str):
    """Send registration confirmation email"""
    from services.runner_email_service import send_email
    
    nombre = registration.get('nombre', '')
    apellidos = registration.get('apellidos', '')
    race_code = registration.get('race_code', '')
    
    # Build edit URL - use the correct route
    edit_url = f"{os.environ.get('FRONTEND_URL', 'https://runner-portal-1.preview.emergentagent.com')}/pre-registro/editar?token={edit_token}"
    
    subject = f"¡Pre Registro Confirmado! - {race_code}"
    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #7c3aed 0%, #db2777 100%); padding: 30px; border-radius: 10px; text-align: center;">
            <h1 style="color: white; margin: 0;">¡Pre Registro Confirmado!</h1>
            <p style="color: rgba(255,255,255,0.9); margin-top: 10px;">{race_code}</p>
        </div>
        
        <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 10px 10px;">
            <h2 style="color: #1f2937;">¡Hola {nombre}!</h2>
            
            <p style="color: #4b5563; font-size: 16px;">
                Tu pre registro ha sido recibido exitosamente. Aquí están los detalles:
            </p>
            
            <div style="background: white; border-radius: 10px; padding: 20px; margin: 20px 0; border: 1px solid #e5e7eb;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 10px 0; color: #6b7280;">Nombre:</td>
                        <td style="padding: 10px 0; color: #1f2937; font-weight: bold;">{nombre} {apellidos}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; color: #6b7280;">Email:</td>
                        <td style="padding: 10px 0; color: #1f2937;">{email}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; color: #6b7280;">Carrera:</td>
                        <td style="padding: 10px 0; color: #1f2937;">{race_code}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; color: #6b7280;">Personalización:</td>
                        <td style="padding: 10px 0; color: #1f2937;">{registration.get('personalizacion_camiseta', '')}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; color: #6b7280;">Talla Camiseta:</td>
                        <td style="padding: 10px 0; color: #1f2937;">{registration.get('talla_camiseta', '')}</td>
                    </tr>
                </table>
            </div>
            
            <div style="background: #fef3c7; border-radius: 10px; padding: 20px; margin: 20px 0; border: 1px solid #f59e0b;">
                <h3 style="color: #92400e; margin-top: 0;">📝 Editar tu Información</h3>
                <p style="color: #92400e; font-size: 14px; margin-bottom: 15px;">
                    Si necesitas actualizar tus datos, puedes hacerlo usando el siguiente enlace:
                </p>
                <a href="{edit_url}" style="display: inline-block; background: #7c3aed; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
                    Editar mi Pre Registro
                </a>
                <p style="color: #b45309; font-size: 12px; margin-top: 15px;">
                    ⚠️ Guarda este correo. El enlace es personal y te permitirá editar tu información.
                </p>
            </div>
            
            <div style="background: #dbeafe; border-radius: 10px; padding: 20px; margin: 20px 0; border: 1px solid #3b82f6;">
                <h3 style="color: #1e40af; margin-top: 0;">📋 Importante - Próximos Pasos</h3>
                <p style="color: #1e40af; font-size: 14px;">
                    <strong>Completar este formulario no garantiza un cupo confirmado</strong>, sino que asegura tu lugar en la lista de prerregistrados.
                </p>
                <ul style="color: #1e40af; font-size: 14px; padding-left: 20px; margin-top: 10px;">
                    <li>Cuatro (4) meses antes del evento, enviaremos un correo con las instrucciones para realizar el pago.</li>
                    <li>El costo de la carrera será de <strong>RD$3,500</strong>.</li>
                    <li>Tendrás un plazo de treinta (30) días para completar el pago.</li>
                    <li>Si el pago no se realiza en ese período, el pre registro será desestimado.</li>
                </ul>
            </div>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            
            <p style="color: #9ca3af; font-size: 12px; text-align: center;">
                © Backyard Ultra Santo Domingo<br>
                Si tienes preguntas, contáctanos a través de nuestras redes sociales.
            </p>
        </div>
    </body>
    </html>
    """
    
    await send_email(email, subject, html_content)


# API Endpoints

@router.post("/send-verification")
async def send_verification(request: EmailVerificationRequest):
    """Send verification code to email"""
    email = request.email.lower()
    
    # Check if email already registered for active race
    active_race = await db["race_configurations"].find_one({"is_active": True})
    if active_race:
        existing = await registrations_collection.find_one({
            "email": email,
            "race_code": active_race["code"],
            "email_verified": True
        })
        if existing:
            raise HTTPException(
                status_code=400, 
                detail="Este correo ya está registrado para esta carrera"
            )
    
    # Generate verification code
    code = generate_verification_code()
    expires_at = datetime.now(timezone.utc).timestamp() + (15 * 60)  # 15 minutes
    
    # Store or update verification token
    await verification_tokens_collection.update_one(
        {"email": email},
        {
            "$set": {
                "code": code,
                "expires_at": expires_at,
                "created_at": datetime.now(timezone.utc)
            }
        },
        upsert=True
    )
    
    # Send email (we'll use a generic name for now)
    try:
        await send_verification_email(email, code, "Participante")
    except Exception as e:
        print(f"Error sending verification email: {e}")
        raise HTTPException(status_code=500, detail="Error enviando el correo de verificación")
    
    return {"message": "Código de verificación enviado", "email": email}


@router.post("/verify-email")
async def verify_email(request: EmailVerificationConfirm):
    """Verify email with code"""
    email = request.email.lower()
    
    # Find verification token
    token_doc = await verification_tokens_collection.find_one({"email": email})
    
    if not token_doc:
        raise HTTPException(status_code=400, detail="No se encontró solicitud de verificación")
    
    # Check if expired
    if datetime.now(timezone.utc).timestamp() > token_doc["expires_at"]:
        raise HTTPException(status_code=400, detail="El código ha expirado. Solicita uno nuevo.")
    
    # Verify code
    if token_doc["code"] != request.code:
        raise HTTPException(status_code=400, detail="Código incorrecto")
    
    # Mark as verified (create a temporary session token)
    session_token = generate_edit_token()
    await verification_tokens_collection.update_one(
        {"email": email},
        {
            "$set": {
                "verified": True,
                "session_token": session_token,
                "session_expires": datetime.now(timezone.utc).timestamp() + (60 * 60)  # 1 hour
            }
        }
    )
    
    return {
        "message": "Email verificado exitosamente",
        "session_token": session_token,
        "email": email
    }


@router.post("/register")
async def register_participant(registration: RegistrationCreate):
    """Register a new participant"""
    email = registration.email.lower()
    
    # Verify the session token
    token_doc = await verification_tokens_collection.find_one({
        "email": email,
        "verified": True
    })
    
    if not token_doc:
        raise HTTPException(status_code=400, detail="Email no verificado. Por favor verifica tu correo primero.")
    
    if datetime.now(timezone.utc).timestamp() > token_doc.get("session_expires", 0):
        raise HTTPException(status_code=400, detail="Sesión expirada. Por favor verifica tu correo nuevamente.")
    
    # Check if already registered for this race
    existing = await registrations_collection.find_one({
        "email": email,
        "race_code": registration.race_code
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Ya estás pre registrado para esta carrera")
    
    # Generate edit token
    edit_token = generate_edit_token()
    
    # Create registration document (no BIB for pre-registration)
    registration_doc = {
        **registration.dict(),
        "email": email,
        "bib": None,  # BIB will be assigned later when payment is confirmed
        "edit_token": edit_token,
        "email_verified": True,
        "photo_url": None,
        "status": "pre_registered",  # pre_registered, registered, confirmed, active, retired, dns, winner
        "payment_status": "pending",  # pending, paid
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    result = await registrations_collection.insert_one(registration_doc)
    
    # Clean up verification token
    await verification_tokens_collection.delete_one({"email": email})
    
    # Send confirmation email
    try:
        await send_confirmation_email(email, registration_doc, edit_token)
    except Exception as e:
        print(f"Error sending confirmation email: {e}")
    
    return {
        "message": "Pre registro completado exitosamente",
        "edit_token": edit_token,
        "registration_id": str(result.inserted_id)
    }


@router.get("/my-registration")
async def get_my_registration(token: str):
    """Get registration by edit token"""
    registration = await registrations_collection.find_one(
        {"edit_token": token},
        {"_id": 0, "edit_token": 0}
    )
    
    if not registration:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    
    # Convert datetime objects to ISO strings
    if registration.get("created_at"):
        registration["created_at"] = registration["created_at"].isoformat()
    if registration.get("updated_at"):
        registration["updated_at"] = registration["updated_at"].isoformat()
    
    return registration


@router.put("/update")
async def update_registration(token: str, updates: RegistrationUpdate):
    """Update registration data"""
    registration = await registrations_collection.find_one({"edit_token": token})
    
    if not registration:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    
    # Build update dict (only non-None values)
    update_data = {k: v for k, v in updates.dict().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No se proporcionaron datos para actualizar")
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await registrations_collection.update_one(
        {"edit_token": token},
        {"$set": update_data}
    )
    
    return {"message": "Datos actualizados exitosamente"}


@router.post("/upload-photo")
async def upload_photo(
    token: str = Form(...),
    photo: UploadFile = File(...)
):
    """Upload participant photo"""
    # Verify registration
    registration = await registrations_collection.find_one({"edit_token": token})
    
    if not registration:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    
    # Validate file type
    allowed_types = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
    if photo.content_type not in allowed_types:
        raise HTTPException(
            status_code=400, 
            detail="Formato de imagen no válido. Use JPG, PNG o WebP."
        )
    
    # Read file content
    content = await photo.read()
    file_size = len(content)
    
    # Validate file size
    if file_size < MIN_PHOTO_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"La foto debe ser de alta resolución (mínimo 1MB). Tu archivo tiene {file_size / 1024 / 1024:.2f}MB."
        )
    
    if file_size > MAX_PHOTO_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"El archivo es demasiado grande (máximo 10MB). Tu archivo tiene {file_size / 1024 / 1024:.2f}MB."
        )
    
    # Generate unique filename
    ext = photo.filename.split(".")[-1] if "." in photo.filename else "jpg"
    filename = f"{registration['race_code']}_{registration['bib']}_{secrets.token_hex(8)}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    
    # Save file
    async with aiofiles.open(filepath, 'wb') as f:
        await f.write(content)
    
    # Update registration with photo URL
    photo_url = f"/static/participant_photos/{filename}"
    await registrations_collection.update_one(
        {"edit_token": token},
        {
            "$set": {
                "photo_url": photo_url,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    return {
        "message": "Foto subida exitosamente",
        "photo_url": photo_url,
        "file_size_mb": round(file_size / 1024 / 1024, 2)
    }


@router.get("/check-email/{email}")
async def check_email_availability(email: str, race_code: str):
    """Check if email is already registered for a race"""
    existing = await registrations_collection.find_one({
        "email": email.lower(),
        "race_code": race_code,
        "email_verified": True
    })
    
    return {
        "available": existing is None,
        "message": "Email disponible" if existing is None else "Este email ya está registrado para esta carrera"
    }


class AccessRequest(BaseModel):
    email: EmailStr
    race_code: Optional[str] = None


class AccessVerify(BaseModel):
    email: EmailStr
    code: str


@router.post("/request-access")
async def request_access(request: AccessRequest):
    """Request access to edit registration via email verification"""
    email = request.email.lower()
    
    # Find registration by email
    query = {"email": email}
    if request.race_code:
        query["race_code"] = request.race_code.upper()
    
    registration = await registrations_collection.find_one(query)
    
    if not registration:
        # Don't reveal if email exists - send generic message
        return {"message": "Si el correo está registrado, recibirás un código de verificación", "sent": True}
    
    # Generate verification code
    code = generate_verification_code()
    expires_at = datetime.now(timezone.utc).timestamp() + (15 * 60)  # 15 minutes
    
    # Store verification token for access
    await verification_tokens_collection.update_one(
        {"email": email, "type": "access"},
        {
            "$set": {
                "code": code,
                "expires_at": expires_at,
                "type": "access",
                "race_code": registration.get("race_code"),
                "created_at": datetime.now(timezone.utc)
            }
        },
        upsert=True
    )
    
    # Send verification email
    try:
        from services.runner_email_service import send_email
        
        nombre = registration.get('nombre', 'Participante')
        race_code = registration.get('race_code', '')
        
        subject = f"Código de Acceso - {race_code}"
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #7c3aed 0%, #db2777 100%); padding: 30px; border-radius: 10px; text-align: center;">
                <h1 style="color: white; margin: 0;">Acceso a tu Pre Registro</h1>
            </div>
            
            <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 10px 10px;">
                <h2 style="color: #1f2937;">¡Hola {nombre}!</h2>
                
                <p style="color: #4b5563; font-size: 16px;">
                    Has solicitado acceso para editar tu pre registro. Ingresa el siguiente código para continuar:
                </p>
                
                <div style="background: white; border: 2px solid #7c3aed; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0;">
                    <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #7c3aed;">{code}</span>
                </div>
                
                <p style="color: #6b7280; font-size: 14px;">
                    Este código expira en 15 minutos. Si no solicitaste este acceso, puedes ignorar este correo.
                </p>
                
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                
                <p style="color: #9ca3af; font-size: 12px; text-align: center;">
                    © Backyard Ultra Santo Domingo
                </p>
            </div>
        </body>
        </html>
        """
        
        await send_email(email, subject, html_content)
    except Exception as e:
        print(f"Error sending access code email: {e}")
        raise HTTPException(status_code=500, detail="Error enviando el código de verificación")
    
    return {"message": "Código de verificación enviado", "sent": True}


@router.post("/verify-access")
async def verify_access(request: AccessVerify):
    """Verify access code and return edit token"""
    email = request.email.lower()
    
    # Find verification token
    token_doc = await verification_tokens_collection.find_one({
        "email": email,
        "type": "access"
    })
    
    if not token_doc:
        raise HTTPException(status_code=400, detail="No se encontró solicitud de acceso")
    
    # Check if expired
    if datetime.now(timezone.utc).timestamp() > token_doc["expires_at"]:
        raise HTTPException(status_code=400, detail="El código ha expirado. Solicita uno nuevo.")
    
    # Verify code
    if token_doc["code"] != request.code:
        raise HTTPException(status_code=400, detail="Código incorrecto")
    
    # Find registration
    registration = await registrations_collection.find_one({"email": email})
    
    if not registration:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    
    # Generate edit_token if it doesn't exist
    edit_token = registration.get("edit_token")
    if not edit_token:
        edit_token = generate_edit_token()
        await registrations_collection.update_one(
            {"email": email},
            {"$set": {"edit_token": edit_token}}
        )
    
    # Clean up verification token
    await verification_tokens_collection.delete_one({"email": email, "type": "access"})
    
    return {
        "message": "Acceso verificado",
        "edit_token": edit_token,
        "race_code": registration.get("race_code")
    }


@router.get("/resend-edit-link")
async def resend_edit_link(email: str):
    """Resend edit link to email"""
    registration = await registrations_collection.find_one({"email": email.lower()})
    
    if not registration:
        # Don't reveal if email exists or not
        return {"message": "Si el correo está registrado, recibirás un enlace de edición"}
    
    # Generate edit_token if it doesn't exist
    edit_token = registration.get("edit_token")
    if not edit_token:
        edit_token = generate_edit_token()
        await registrations_collection.update_one(
            {"email": email.lower()},
            {"$set": {"edit_token": edit_token}}
        )
    
    try:
        await send_confirmation_email(
            registration["email"],
            registration,
            edit_token
        )
    except Exception as e:
        print(f"Error resending edit link: {e}")
    
    return {"message": "Si el correo está registrado, recibirás un enlace de edición"}


# Admin endpoints
@router.get("/admin/list/{race_code}")
async def list_registrations(race_code: str, status: Optional[str] = None):
    """List all registrations for a race (admin only)"""
    query = {"race_code": race_code}
    if status:
        query["status"] = status
    
    registrations = await registrations_collection.find(
        query,
        {"_id": 0, "edit_token": 0}
    ).sort("bib_number", 1).to_list(1000)
    
    # Convert datetime objects
    for reg in registrations:
        if reg.get("created_at"):
            reg["created_at"] = reg["created_at"].isoformat()
        if reg.get("updated_at"):
            reg["updated_at"] = reg["updated_at"].isoformat()
    
    return {
        "race_code": race_code,
        "total": len(registrations),
        "registrations": registrations
    }


@router.get("/admin/stats/{race_code}")
async def get_registration_stats(race_code: str):
    """Get registration statistics for a race"""
    pipeline = [
        {"$match": {"race_code": race_code}},
        {"$group": {
            "_id": None,
            "total": {"$sum": 1},
            "masculino": {"$sum": {"$cond": [{"$eq": ["$sexo", "Masculino"]}, 1, 0]}},
            "femenino": {"$sum": {"$cond": [{"$eq": ["$sexo", "Femenino"]}, 1, 0]}},
            "with_photo": {"$sum": {"$cond": [{"$ne": ["$photo_url", None]}, 1, 0]}},
            "paid": {"$sum": {"$cond": [{"$eq": ["$payment_status", "paid"]}, 1, 0]}}
        }}
    ]
    
    result = await registrations_collection.aggregate(pipeline).to_list(1)
    
    if not result:
        return {
            "race_code": race_code,
            "total": 0,
            "masculino": 0,
            "femenino": 0,
            "with_photo": 0,
            "paid": 0
        }
    
    stats = result[0]
    stats.pop("_id", None)
    stats["race_code"] = race_code
    
    # Get t-shirt sizes distribution
    sizes_pipeline = [
        {"$match": {"race_code": race_code}},
        {"$group": {
            "_id": "$talla_camiseta",
            "count": {"$sum": 1}
        }}
    ]
    sizes_result = await registrations_collection.aggregate(sizes_pipeline).to_list(10)
    stats["talla_distribution"] = {s["_id"]: s["count"] for s in sizes_result if s["_id"]}
    
    return stats
