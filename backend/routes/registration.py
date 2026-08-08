from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, Literal
from datetime import datetime, timezone
from bson import ObjectId
import os
import secrets
import hashlib

from services import rate_limit
from services.auth import require_permission

router = APIRouter(prefix="/api/registration", tags=["registration"])

# Todo lo que cuelga de /admin exige un token del panel con permiso sobre
# atletas. Antes estaba abierto: cualquiera podia listar los inscritos con
# sus datos medicos y de contacto, borrarlos o aprobar comprobantes de pago.
admin_router = APIRouter(
    prefix="/admin",
    tags=["registration-admin"],
    dependencies=[Depends(require_permission("athletes"))],
)

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
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_DIR = os.path.join(BACKEND_DIR, "static", "participant_photos")
MAX_PHOTO_SIZE = 10 * 1024 * 1024  # 10MB max
MIN_PHOTO_SIZE = 1 * 1024 * 1024   # 1MB min for high resolution

# Cancellation reasons
CANCELLATION_REASONS = [
    "Me lesioné",
    "Ya no estoy interesado en participar",
    "Tengo otros compromisos",
    "Otra razón"
]


class CancellationRequest(BaseModel):
    reason: str
    other_reason: Optional[str] = None


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
    """Send verification email using the template system"""
    from services.template_email_service import (
        send_email_with_template, build_race_data, build_general_data
    )
    
    # Get active race config
    race_config = await db["race_configurations"].find_one({"is_active": True})
    
    # Build merge data
    merge_data = {
        **build_race_data(race_config),
        **build_general_data(verification_code=code),
        "athlete_nombre": nombre,
    }
    
    await send_email_with_template(
        db=db,
        template_id="email_verification",
        to_email=email,
        data=merge_data
    )


async def send_confirmation_email(email: str, registration: dict, edit_token: str):
    """Send registration confirmation email using the template system"""
    from services.template_email_service import (
        send_email_with_template, build_race_data, build_athlete_data, build_payment_data
    )
    
    race_code = registration.get('race_code', '')
    
    # Get race configuration
    race_config = await db["race_configurations"].find_one({"code": race_code})
    
    # Build merge data
    merge_data = {
        **build_race_data(race_config),
        **build_athlete_data(registration, edit_token),
        **build_payment_data(race_config=race_config, edit_token=edit_token),
        "athlete_personalizacion_camiseta": registration.get('personalizacion_camiseta', ''),
        "athlete_talla_camiseta": registration.get('talla_camiseta', ''),
    }
    
    await send_email_with_template(
        db=db,
        template_id="athlete_registration_confirmation",
        to_email=email,
        data=merge_data
    )


# API Endpoints

@router.post("/send-verification")
async def send_verification(request: EmailVerificationRequest, http_request: Request = None):
    """Send verification code to email"""
    rate_limit.limitar_envio_codigo(http_request)
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
async def verify_email(request: EmailVerificationConfirm, http_request: Request = None):
    """Verify email with code"""
    rate_limit.limitar_verificacion(http_request)
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
    
    # Guardar en GridFS: el disco del contenedor se borra en cada despliegue.
    from services import file_storage

    ext_original = photo.filename.split(".")[-1] if "." in photo.filename else "jpg"
    contenido, ext, content_type = file_storage.compress_image(content, ext_original, photo.content_type)
    filename = f"{registration['race_code']}_{registration['bib']}_{secrets.token_hex(8)}.{ext}"
    await file_storage.save(filename, contenido, content_type, file_storage.FOLDER_PARTICIPANT_PHOTOS)

    # Update registration with photo URL
    photo_url = f"/api/static/participant_photos/{filename}"
    anterior = await registrations_collection.find_one_and_update(
        {"edit_token": token},
        {
            "$set": {
                "photo_url": photo_url,
                "updated_at": datetime.now(timezone.utc)
            }
        },
        projection={"photo_url": 1}
    )

    url_anterior = (anterior or {}).get("photo_url")
    if url_anterior and url_anterior != photo_url:
        await file_storage.delete(url_anterior.rsplit("/", 1)[-1])
    
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
async def request_access(request: AccessRequest, http_request: Request = None):
    """Request access to edit registration via email verification"""
    rate_limit.limitar_envio_codigo(http_request)
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
    
    # Send verification email using template system
    try:
        from services.template_email_service import (
            send_email_with_template, build_race_data, build_athlete_data, build_general_data
        )
        
        race_code = registration.get('race_code', '')
        race_config = await db["race_configurations"].find_one({"code": race_code})
        
        # Build merge data
        merge_data = {
            **build_race_data(race_config),
            **build_athlete_data(registration),
            **build_general_data(verification_code=code),
        }
        
        await send_email_with_template(
            db=db,
            template_id="athlete_edit_code",
            to_email=email,
            data=merge_data
        )
    except Exception as e:
        print(f"Error sending access code email: {e}")
        raise HTTPException(status_code=500, detail="Error enviando el código de verificación")
    
    return {"message": "Código de verificación enviado", "sent": True}


@router.post("/verify-access")
async def verify_access(request: AccessVerify, http_request: Request = None):
    """Verify access code and return edit token"""
    rate_limit.limitar_verificacion(http_request)
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
async def resend_edit_link(email: str, http_request: Request = None):
    """Resend edit link to email"""
    rate_limit.limitar_envio_codigo(http_request)
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
@admin_router.get("/list/{race_code}")
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


@admin_router.get("/stats/{race_code}")
async def get_registration_stats(race_code: str):
    """Get registration statistics for a race"""
    pipeline = [
        {"$match": {"race_code": race_code}},
        {"$addFields": {"sexo_lower": {"$toLower": "$sexo"}}},
        {"$group": {
            "_id": None,
            "total": {"$sum": 1},
            "masculino": {"$sum": {"$cond": [{"$eq": ["$sexo_lower", "masculino"]}, 1, 0]}},
            "femenino": {"$sum": {"$cond": [{"$eq": ["$sexo_lower", "femenino"]}, 1, 0]}},
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
    
    # Get t-shirt sizes distribution (total)
    sizes_pipeline = [
        {"$match": {"race_code": race_code}},
        {"$group": {
            "_id": "$talla_camiseta",
            "count": {"$sum": 1}
        }}
    ]
    sizes_result = await registrations_collection.aggregate(sizes_pipeline).to_list(10)
    stats["talla_distribution"] = {s["_id"]: s["count"] for s in sizes_result if s["_id"]}
    
    # Get t-shirt sizes distribution by gender (Masculino)
    sizes_male_pipeline = [
        {"$match": {"race_code": race_code, "sexo": {"$regex": "^masculino$", "$options": "i"}}},
        {"$group": {
            "_id": "$talla_camiseta",
            "count": {"$sum": 1}
        }}
    ]
    sizes_male_result = await registrations_collection.aggregate(sizes_male_pipeline).to_list(10)
    stats["talla_distribution_masculino"] = {s["_id"]: s["count"] for s in sizes_male_result if s["_id"]}
    
    # Get t-shirt sizes distribution by gender (Femenino)
    sizes_female_pipeline = [
        {"$match": {"race_code": race_code, "sexo": {"$regex": "^femenino$", "$options": "i"}}},
        {"$group": {
            "_id": "$talla_camiseta",
            "count": {"$sum": 1}
        }}
    ]
    sizes_female_result = await registrations_collection.aggregate(sizes_female_pipeline).to_list(10)
    stats["talla_distribution_femenino"] = {s["_id"]: s["count"] for s in sizes_female_result if s["_id"]}
    
    return stats


@router.get("/public/participants/{race_code}")
async def public_participants(race_code: str):
    """Public: list of registered participants for a race (bib, nombre, apellidos, sexo) + stats."""
    # Read max capacity from race config (fallback 120)
    race_config = await db["race_configurations"].find_one({"code": race_code})
    max_capacity = (race_config or {}).get("max_participants", 120)

    query = {
        "race_code": race_code,
        "status": {"$nin": ["cancelled", "waitlist"]},
    }
    regs = await registrations_collection.find(
        query,
        {"_id": 0, "bib": 1, "nombre": 1, "apellidos": 1, "sexo": 1}
    ).to_list(1000)

    def bib_key(r):
        try:
            return int(r.get("bib") or 0)
        except (ValueError, TypeError):
            return 0

    regs.sort(key=bib_key)

    masculino = sum(1 for r in regs if (r.get("sexo") or "").strip().lower() == "masculino")
    femenino = sum(1 for r in regs if (r.get("sexo") or "").strip().lower() == "femenino")
    total = len(regs)

    participants = [{
        "bib": r.get("bib"),
        "nombre": r.get("nombre", ""),
        "apellidos": r.get("apellidos", ""),
        "sexo": r.get("sexo", ""),
    } for r in regs]

    # Waitlist participants (status == "waitlist"), ordered by bib
    waitlist_regs = await registrations_collection.find(
        {"race_code": race_code, "status": "waitlist"},
        {"_id": 0, "bib": 1, "nombre": 1, "apellidos": 1, "sexo": 1}
    ).to_list(1000)
    waitlist_regs.sort(key=bib_key)
    waitlist = [{
        "bib": r.get("bib"),
        "nombre": r.get("nombre", ""),
        "apellidos": r.get("apellidos", ""),
        "sexo": r.get("sexo", ""),
    } for r in waitlist_regs]

    return {
        "race_code": race_code,
        "total": total,
        "masculino": masculino,
        "femenino": femenino,
        "max_capacity": max_capacity,
        "plazas_disponibles": max(max_capacity - total, 0),
        "participants": participants,
        "waitlist": waitlist,
        "waitlist_total": len(waitlist),
    }


def _bloque_datos_pago(race_config: Optional[dict], fecha_limite: Optional[str]) -> str:
    """Bloque HTML con los datos bancarios y los pasos para notificar el pago.

    Se usa al promover desde la lista de espera cuando el proceso de cobro ya
    esta abierto. Los valores salen de la configuracion de la carrera (los
    escribe un admin en el panel) y se escapan igual antes de meterlos al HTML.
    """
    import html as _html
    from services.template_email_service import BASE_URL

    cfg = race_config or {}
    monto = cfg.get("registration_cost") or 0
    filas = [
        ("Monto", f"RD$ {monto:,.0f}" if monto else ""),
        ("Banco", cfg.get("payment_bank_name", "")),
        ("Titular", cfg.get("payment_account_name", "")),
        ("Tipo de cuenta", cfg.get("payment_account_type", "")),
        ("Número de cuenta", cfg.get("payment_account_number", "")),
        ("Documento del titular", cfg.get("payment_account_id", "")),
    ]
    filas_html = "".join(
        f"""
                <tr>
                    <td style="padding: 6px 0; color: #6b7280;">{etiqueta}:</td>
                    <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #1f2937;">{_html.escape(str(valor))}</td>
                </tr>"""
        for etiqueta, valor in filas if valor
    )

    limite_html = ""
    if fecha_limite:
        limite_html = f"""
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; border: 2px solid #9ca3af;">
                <p style="font-size: 14px; color: #374151; margin: 0 0 10px 0;">Tienes tiempo para completar tu pago hasta el:</p>
                <p style="font-size: 24px; font-weight: bold; color: #1f2937; margin: 0;">{_html.escape(fecha_limite)}</p>
            </div>"""

    return f"""
            <p style="font-size: 16px; color: #1f2937; line-height: 1.6;">
                <strong>¡Buenas noticias!</strong> Se ha liberado un cupo y tu registro a la carrera está confirmado.
            </p>
            <p style="font-size: 16px; color: #4b5563; line-height: 1.6;">
                El período de pagos ya está abierto, así que a continuación te dejamos los datos para que completes el pago de tu inscripción.
            </p>{limite_html}
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="font-size: 14px; font-weight: bold; color: #1f2937; margin: 0 0 15px 0;">Datos para el pago:</p>
                <table style="width: 100%; font-size: 14px;">{filas_html}
                </table>
            </div>
            <p style="font-size: 15px; font-weight: bold; color: #1f2937; margin: 25px 0 10px 0;">¿Cómo notificar tu pago?</p>
            <ol style="font-size: 14px; color: #4b5563; line-height: 1.8; margin: 0; padding-left: 20px;">
                <li>Realiza el pago con los datos indicados arriba.</li>
                <li>Ingresa a tu <strong>perfil</strong> en nuestro sitio web.</li>
                <li>Ve a la sección <strong>Carreras Inscritas</strong>.</li>
                <li>Pulsa <strong>Notificar pago</strong> y adjunta tu comprobante de pago.</li>
            </ol>
            <div style="text-align: center; margin: 30px 0;">
                <a href="{BASE_URL}/mi-perfil" style="display: inline-block; background: #1f2937; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">Ir a mi Perfil</a>
            </div>
            <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6b7280;">
                <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.6;">
                    <strong>Importante:</strong> si no recibimos tu pago dentro del plazo, tu inscripción será cancelada y tu espacio se reasignará a la lista de espera.
                </p>
            </div>
    """


@admin_router.post("/promote-waitlist/{email}")
async def promote_waitlist(
    email: str,
    race_code: str,
    incluir_pago: bool = False,
    fecha_limite_pago: Optional[str] = None,
):
    """Admin: Promote a waitlisted athlete to confirmed registration and send confirmation email.

    Con incluir_pago=true el correo lleva ademas los datos bancarios y los
    pasos para notificar el pago (util cuando el periodo de cobro ya arranco).
    fecha_limite_pago es texto libre y opcional ("15 de septiembre"): si viene,
    se muestra como fecha limite.
    """
    registration = await registrations_collection.find_one({
        "email": email.lower(),
        "race_code": race_code
    })
    if not registration:
        raise HTTPException(status_code=404, detail="Inscripción no encontrada")
    if registration.get("status") != "waitlist":
        raise HTTPException(status_code=400, detail="Esta inscripción no está en lista de espera")

    await registrations_collection.update_one(
        {"email": email.lower(), "race_code": race_code},
        {"$set": {"status": "registered", "updated_at": datetime.now(timezone.utc)}}
    )

    # Send confirmation email using the standard registration confirmation template
    try:
        from services.template_email_service import send_email_with_template, build_race_data, build_athlete_data
        race_config = await db["race_configurations"].find_one({"code": race_code})
        merge_data = {
            **build_race_data(race_config),
            **build_athlete_data(registration, edit_token=registration.get("edit_token")),
        }
        now = datetime.now(timezone.utc)
        payment_cutoff = datetime(2026, 10, 1, tzinfo=timezone.utc)
        if incluir_pago:
            merge_data["proximos_pasos"] = _bloque_datos_pago(race_config, fecha_limite_pago)
        elif now < payment_cutoff:
            merge_data["proximos_pasos"] = """
                <p style="font-size: 16px; color: #1f2937; line-height: 1.6;">
                    <strong>¡Buenas noticias!</strong> Se ha liberado un cupo y tu registro a la carrera está confirmado.
                </p>
                <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6b7280;">
                    <p style="margin: 0; color: #374151; line-height: 1.6;">
                        4 meses antes del evento recibirás un correo de recordatorio para que completes el pago de la inscripción. Tendrás <strong>30 días</strong> para completarlo. De lo contrario, tu espacio será reasignado.
                    </p>
                </div>
            """
        else:
            merge_data["proximos_pasos"] = """
                <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0 0 10px 0;"><strong>Próximos pasos:</strong></p>
                    <ol style="color: #4b5563; margin: 0; padding-left: 20px;">
                        <li>Completa el pago de inscripción</li>
                        <li>Espera la confirmación de tu BIB</li>
                        <li>Revisa la guía del corredor</li>
                    </ol>
                </div>
            """
        await send_email_with_template(
            db=db,
            template_id="athlete_registration_confirmation",
            to_email=registration["email"],
            data=merge_data
        )
    except Exception as e:
        print(f"Error sending confirmation email on promote: {e}")

    return {"success": True, "message": "Atleta promovido a inscrito", "email": email.lower()}




class AdminRegistrationUpdate(BaseModel):
    """Model for admin updates to registration"""
    nombre: Optional[str] = None
    apellidos: Optional[str] = None
    email: Optional[EmailStr] = None
    fecha_nacimiento: Optional[str] = None
    sexo: Optional[Literal["Masculino", "Femenino"]] = None
    nacionalidad: Optional[str] = None
    telefono: Optional[str] = None
    ciudad_residencia: Optional[str] = None
    anos_experiencia: Optional[int] = None
    maxima_distancia_km: Optional[float] = None
    motivacion: Optional[str] = None
    tipo_sangre: Optional[str] = None
    condicion_medica: Optional[Literal["Sí", "No"]] = None
    condicion_medica_detalle: Optional[str] = None
    alergias: Optional[Literal["Sí", "No"]] = None
    alergias_detalle: Optional[str] = None
    contacto_emergencia_nombre: Optional[str] = None
    contacto_emergencia_relacion: Optional[str] = None
    contacto_emergencia_telefono: Optional[str] = None
    talla_camiseta: Optional[Literal["XS", "S", "M", "L", "XL", "XXL"]] = None
    personalizacion_camiseta: Optional[str] = None
    bib: Optional[int] = None
    status: Optional[Literal["pre_registered", "registered", "confirmed", "active", "retired", "dns", "winner"]] = None
    payment_status: Optional[Literal["pending", "paid"]] = None


@admin_router.get("/registration/{email}")
async def get_registration_admin(email: str, race_code: str):
    """Get single registration by email (admin only)"""
    registration = await registrations_collection.find_one(
        {"email": email.lower(), "race_code": race_code},
        {"_id": 0, "edit_token": 0}
    )
    
    if not registration:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    
    # Convert datetime objects
    if registration.get("created_at"):
        registration["created_at"] = registration["created_at"].isoformat()
    if registration.get("updated_at"):
        registration["updated_at"] = registration["updated_at"].isoformat()
    
    return registration


@admin_router.put("/registration/{email}")
async def update_registration_admin(email: str, race_code: str, updates: AdminRegistrationUpdate):
    """Update registration data (admin only)"""
    registration = await registrations_collection.find_one({
        "email": email.lower(),
        "race_code": race_code
    })
    
    if not registration:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    
    # Build update dict (only non-None values)
    update_data = {k: v for k, v in updates.dict().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No se proporcionaron datos para actualizar")
    
    # If assigning BIB, check it's unique for this race
    if "bib" in update_data and update_data["bib"] is not None:
        existing_bib = await registrations_collection.find_one({
            "race_code": race_code,
            "bib": update_data["bib"],
            "email": {"$ne": email.lower()}
        })
        if existing_bib:
            raise HTTPException(
                status_code=400, 
                detail=f"El número de BIB {update_data['bib']} ya está asignado a otro participante"
            )
    
    # If changing status to "active", initialize race tracking fields
    if update_data.get("status") == "active":
        current_status = registration.get("status")
        if current_status != "active":
            # Initialize race tracking fields if not already set
            if registration.get("laps_completed") is None:
                update_data["laps_completed"] = 0
            if registration.get("total_km") is None:
                update_data["total_km"] = 0.0
            if registration.get("retired_at_lap") is None:
                update_data["retired_at_lap"] = None
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await registrations_collection.update_one(
        {"email": email.lower(), "race_code": race_code},
        {"$set": update_data}
    )
    
    return {"message": "Registro actualizado exitosamente"}


@admin_router.delete("/registration/{email}")
async def delete_registration_admin(email: str, race_code: str):
    """Delete a registration (admin only)"""
    result = await registrations_collection.delete_one({
        "email": email.lower(),
        "race_code": race_code
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    
    return {"message": "Registro eliminado exitosamente"}


@admin_router.get("/next-bib/{race_code}")
async def get_next_bib(race_code: str):
    """Get the next available BIB number for a race"""
    # Find the highest BIB number currently assigned
    pipeline = [
        {"$match": {"race_code": race_code, "bib": {"$ne": None}}},
        {"$group": {"_id": None, "max_bib": {"$max": "$bib"}}}
    ]
    
    result = await registrations_collection.aggregate(pipeline).to_list(1)
    
    if not result or result[0].get("max_bib") is None:
        return {"next_bib": 1}
    
    try:
        return {"next_bib": int(result[0]["max_bib"]) + 1}
    except (ValueError, TypeError):
        return {"next_bib": 1}


@router.post("/cancel/{token}")
async def cancel_registration(token: str, cancellation: CancellationRequest):
    """Cancel and delete an athlete registration"""
    registration = await registrations_collection.find_one({"edit_token": token})
    
    if not registration:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    
    reason_text = cancellation.reason
    if cancellation.reason == "Otra razón" and cancellation.other_reason:
        reason_text = f"Otra razón: {cancellation.other_reason}"
    
    # Store data for email before deletion
    nombre = f"{registration.get('nombre', '')} {registration.get('apellidos', '')}".strip()
    email = registration.get("email")
    race_code = registration.get("race_code", "")
    
    # Delete the registration completely
    await registrations_collection.delete_one({"edit_token": token})
    
    # Send cancellation confirmation email using template system
    try:
        from services.template_email_service import (
            send_email_with_template, build_race_data, build_athlete_data
        )
        
        race_config = await db["race_configurations"].find_one({"code": race_code})
        
        # Build merge data with cancellation reason
        merge_data = {
            **build_race_data(race_config),
            **build_athlete_data(registration),
            "cancellation_reason": reason_text,
        }
        
        await send_email_with_template(
            db=db,
            template_id="athlete_cancellation",
            to_email=email,
            data=merge_data
        )
    except Exception as e:
        print(f"Error sending cancellation email: {e}")
    
    return {"message": "Registro cancelado y eliminado exitosamente"}


@admin_router.put("/remove-bib/{email}")
async def remove_bib_assignment(email: str, race_code: str):
    """Remove BIB assignment from an athlete"""
    result = await registrations_collection.update_one(
        {"email": email.lower(), "race_code": race_code},
        {"$unset": {"bib": ""}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    
    return {"message": "Asignación de BIB eliminada", "email": email}


@admin_router.delete("/remove-all-bibs/{race_code}")
async def remove_all_bib_assignments(race_code: str):
    """Remove all BIB assignments for a race"""
    result = await registrations_collection.update_many(
        {"race_code": race_code, "bib": {"$exists": True}},
        {"$unset": {"bib": ""}}
    )
    
    return {
        "message": f"Se eliminaron {result.modified_count} asignaciones de BIB",
        "removed_count": result.modified_count
    }


@admin_router.post("/auto-assign-bibs/{race_code}")
async def auto_assign_bibs_by_experience(race_code: str, start_bib: int = 1):
    """Auto-assign BIB numbers to active+paid athletes based on experience score"""
    
    # Get all active athletes with paid status
    athletes = await registrations_collection.find(
        {
            "race_code": race_code,
            "status": "active",
            "payment_status": "paid"
        }
    ).to_list(1000)
    
    if not athletes:
        raise HTTPException(status_code=400, detail="No hay atletas activos con pago completado")
    
    # Calculate experience score for each athlete
    def calculate_experience_score(reg):
        years_exp = reg.get("anos_experiencia", 0) or 0
        max_distance = reg.get("maxima_distancia_km", 0) or 0
        
        # Normalize years experience (0-20 years -> 0-100)
        normalized_years = min(years_exp / 20, 1) * 100
        
        # Normalize max distance (0-200 km -> 0-100)
        normalized_distance = min(max_distance / 200, 1) * 100
        
        # 50/50 weighted score
        return (normalized_years * 0.5) + (normalized_distance * 0.5)
    
    # Sort athletes by experience score (highest first)
    athletes_with_score = [
        {
            "email": a["email"],
            "nombre": f"{a.get('nombre', '')} {a.get('apellidos', '')}".strip(),
            "score": calculate_experience_score(a),
            "anos_experiencia": a.get("anos_experiencia", 0),
            "maxima_distancia_km": a.get("maxima_distancia_km", 0)
        }
        for a in athletes
    ]
    athletes_with_score.sort(key=lambda x: x["score"], reverse=True)
    
    # Assign BIBs in order and generate QR codes
    assigned_count = 0
    assignments = []
    
    # Import QR generation
    from routes.qr_scan import generate_qr_code
    import os
    frontend_url = os.environ.get("REACT_APP_BACKEND_URL", "").replace("/api", "")
    if not frontend_url:
        frontend_url = "https://admin-dashboard-v2-66.preview.emergentagent.com"
    
    for i, athlete in enumerate(athletes_with_score):
        bib_number = start_bib + i
        
        # Generate QR code for this BIB
        qr_url = generate_qr_code(str(bib_number), race_code, frontend_url)
        
        result = await registrations_collection.update_one(
            {"email": athlete["email"], "race_code": race_code},
            {"$set": {
                "bib": bib_number,
                "qr_code_url": qr_url
            }}
        )
        
        if result.modified_count > 0 or result.matched_count > 0:
            assigned_count += 1
            assignments.append({
                "bib": bib_number,
                "nombre": athlete["nombre"],
                "email": athlete["email"],
                "score": round(athlete["score"], 1),
                "experiencia": f"{athlete['anos_experiencia']}a / {athlete['maxima_distancia_km']}km",
                "qr_code_url": qr_url
            })
    
    return {
        "message": f"BIBs asignados automáticamente a {assigned_count} atletas",
        "assigned_count": assigned_count,
        "start_bib": start_bib,
        "end_bib": start_bib + assigned_count - 1,
        "assignments": assignments
    }


# ============== PAYMENT REMINDER & RECEIPT ==============

RECEIPTS_UPLOAD_DIR = os.path.join(BACKEND_DIR, "uploads", "receipts")
os.makedirs(RECEIPTS_UPLOAD_DIR, exist_ok=True)


class PaymentReceiptSubmission(BaseModel):
    """Model for payment receipt submission"""
    payment_date: str  # YYYY-MM-DD
    bank_origin: str  # Name of the bank where payment was made
    transfer_number: Optional[str] = None  # Optional transfer/reference number


@admin_router.get("/active-athletes-count/{race_code}")
async def get_active_athletes_count(race_code: str):
    """Get count of active athletes who need payment reminder"""
    count = await registrations_collection.count_documents({
        "race_code": race_code,
        "status": "active",
        "payment_status": "pending"
    })
    
    return {"count": count, "race_code": race_code}


@admin_router.post("/send-payment-reminder/{race_code}")
async def send_payment_reminder(race_code: str):
    """Send payment reminder email to all active athletes with pending payment"""
    from services.template_email_service import (
        send_email_with_template, 
        build_race_data, 
        build_athlete_data, 
        build_payment_data,
        render_template
    )
    
    # Get race config for payment info
    race_config = await db["race_configurations"].find_one({"code": race_code}, {"_id": 0})
    if not race_config:
        raise HTTPException(status_code=404, detail="Carrera no encontrada")
    
    # Get all active athletes with pending payment
    athletes = await registrations_collection.find(
        {
            "race_code": race_code,
            "status": "active",
            "payment_status": "pending"
        },
        {"_id": 0}
    ).to_list(1000)
    
    if not athletes:
        raise HTTPException(status_code=400, detail="No hay atletas activos con pago pendiente")
    
    # Get the payment_reminder template
    template = await db["email_templates"].find_one({"id": "payment_reminder"}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=500, detail="Plantilla de correo no encontrada")
    
    frontend_url = os.environ.get("FRONTEND_URL", "https://admin-dashboard-v2-66.preview.emergentagent.com")
    
    sent_count = 0
    failed_count = 0
    
    for athlete in athletes:
        email = athlete.get("email")
        if not email:
            continue
        
        edit_token = athlete.get("edit_token", "")
        
        # Build merge data for this athlete
        merge_data = {
            **build_race_data(race_config),
            **build_athlete_data(athlete, edit_token),
            **build_payment_data(None, race_config, edit_token),
        }
        
        # Render template
        rendered_subject = render_template(template["subject"], merge_data, escape=False)
        rendered_content = render_template(template["content"], merge_data)
        
        try:
            from services.template_email_service import send_templated_email
            success = await send_templated_email(email, rendered_subject, rendered_content)
            if success:
                sent_count += 1
            else:
                failed_count += 1
        except Exception as e:
            print(f"Error sending payment reminder to {email}: {e}")
            failed_count += 1
    
    return {
        "message": f"Recordatorio enviado a {sent_count} atletas",
        "sent_count": sent_count,
        "failed_count": failed_count,
        "total_athletes": len(athletes)
    }


@router.get("/payment-info/{token}")
async def get_payment_info_for_athlete(token: str):
    """Get payment info and registration data for receipt upload"""
    # Find registration by token
    registration = await registrations_collection.find_one(
        {"edit_token": token},
        {"_id": 0, "nombre": 1, "apellidos": 1, "email": 1, "race_code": 1, 
         "payment_status": 1, "payment_receipt": 1}
    )
    
    if not registration:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    
    # Get race config for payment info
    race_config = await db["race_configurations"].find_one(
        {"code": registration.get("race_code")},
        {"_id": 0, "name": 1, "payment_account_name": 1, "payment_account_id": 1,
         "payment_bank_name": 1, "payment_account_type": 1, "payment_account_number": 1,
         "registration_cost": 1}
    )
    
    return {
        "registration": registration,
        "race_config": race_config or {}
    }


@router.post("/submit-payment-receipt/{token}")
async def submit_payment_receipt(
    token: str,
    payment_date: str = Form(...),
    bank_origin: str = Form(...),
    transfer_number: Optional[str] = Form(None),
    receipt_image: UploadFile = File(...)
):
    """Submit payment receipt with image and details"""
    # Find registration by token
    registration = await registrations_collection.find_one({"edit_token": token})
    
    if not registration:
        raise HTTPException(status_code=404, detail="Registro no encontrado")

    # Sin cupo confirmado no se paga: quien esta en lista de espera todavia no
    # tiene plaza y cobrarle antes obliga a devolver el dinero.
    if registration.get("status") == "waitlist":
        raise HTTPException(
            status_code=400,
            detail="Estas en lista de espera. Podras subir el comprobante cuando se libere un cupo y te confirmemos.",
        )

    # Un segundo comprobante sobre uno que aun se esta revisando solo genera
    # trabajo duplicado a la organizacion.
    recibo = registration.get("payment_receipt") or {}
    if recibo.get("status") == "pending_review":
        raise HTTPException(
            status_code=400,
            detail="Ya enviaste un comprobante y esta en revision.",
        )
    if registration.get("payment_status") == "paid":
        raise HTTPException(
            status_code=400,
            detail="Tu pago ya esta confirmado.",
        )

    # Validate file type
    allowed_types = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"]
    if receipt_image.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Formato no válido. Use JPG, PNG, WebP o PDF."
        )
    
    # Read and validate file size
    content = await receipt_image.read()
    file_size = len(content)
    max_size = 10 * 1024 * 1024  # 10MB
    
    if file_size > max_size:
        raise HTTPException(
            status_code=400,
            detail=f"El archivo es demasiado grande (máximo 10MB). Tu archivo tiene {file_size / 1024 / 1024:.2f}MB."
        )
    
    # Guardar en GridFS: el disco del contenedor se borra en cada despliegue y un
    # comprobante de pago perdido no se puede recuperar.
    from services import file_storage

    ext = receipt_image.filename.split(".")[-1] if "." in receipt_image.filename else "jpg"
    content_type = receipt_image.content_type

    # Los PDF se guardan tal cual. Las capturas de celular se comprimen: a 1600px
    # el numero de transferencia sigue siendo legible y pesan mucho menos.
    if content_type != "application/pdf":
        content, ext, content_type = file_storage.compress_image(content, ext, content_type)

    filename = f"receipt_{registration['race_code']}_{registration['email'].replace('@', '_')}_{secrets.token_hex(6)}.{ext}"
    await file_storage.save(filename, content, content_type, file_storage.FOLDER_RECEIPTS)

    # Update registration with payment receipt info
    receipt_info = {
        "image_path": f"/api/uploads/receipts/{filename}",
        "payment_date": payment_date,
        "bank_origin": bank_origin,
        "transfer_number": transfer_number,
        "submitted_at": datetime.now(timezone.utc),
        "status": "pending_review"  # pending_review, approved, rejected
    }
    
    await registrations_collection.update_one(
        {"edit_token": token},
        {
            "$set": {
                "payment_receipt": receipt_info,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    # Send confirmation email to athlete using template system
    try:
        from services.template_email_service import (
            send_email_with_template, build_race_data, build_athlete_data
        )
        
        race_config = await db["race_configurations"].find_one({"code": registration.get('race_code', '')})
        
        merge_data = {
            **build_race_data(race_config),
            **build_athlete_data(registration),
            "payment_date": payment_date,
            "bank_origin": bank_origin,
            "transfer_number": transfer_number or "N/A",
        }
        
        await send_email_with_template(
            db=db,
            template_id="payment_receipt_received",
            to_email=registration.get("email"),
            data=merge_data
        )
    except Exception as e:
        print(f"Error sending receipt confirmation email: {e}")
    
    return {
        "message": "Comprobante de pago recibido exitosamente",
        "status": "pending_review"
    }


@admin_router.get("/pending-receipts/{race_code}")
async def get_pending_receipts(race_code: str):
    """Get all registrations with pending payment receipts"""
    registrations = await registrations_collection.find(
        {
            "race_code": race_code,
            "payment_receipt": {"$exists": True},
            "payment_receipt.status": "pending_review"
        },
        {"_id": 0, "edit_token": 0}
    ).to_list(100)
    
    # Convert datetime objects
    for reg in registrations:
        if reg.get("created_at"):
            reg["created_at"] = reg["created_at"].isoformat()
        if reg.get("updated_at"):
            reg["updated_at"] = reg["updated_at"].isoformat()
        if reg.get("payment_receipt", {}).get("submitted_at"):
            reg["payment_receipt"]["submitted_at"] = reg["payment_receipt"]["submitted_at"].isoformat()
    
    return {
        "race_code": race_code,
        "count": len(registrations),
        "registrations": registrations
    }


@admin_router.put("/review-receipt/{email}")
async def review_payment_receipt(email: str, race_code: str, approved: bool):
    """Approve or reject a payment receipt"""
    registration = await registrations_collection.find_one({
        "email": email.lower(),
        "race_code": race_code
    })
    
    if not registration:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    
    if not registration.get("payment_receipt"):
        raise HTTPException(status_code=400, detail="No hay comprobante de pago para revisar")
    
    new_status = "approved" if approved else "rejected"
    payment_status = "paid" if approved else "pending"
    
    await registrations_collection.update_one(
        {"email": email.lower(), "race_code": race_code},
        {
            "$set": {
                "payment_receipt.status": new_status,
                "payment_receipt.reviewed_at": datetime.now(timezone.utc),
                "payment_status": payment_status,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    # If approved, create automatic income record
    if approved:
        try:
            from routes.finances import create_payment_income
            
            # Get registration cost from race config
            race_config = await db["race_configurations"].find_one({"code": race_code})
            registration_cost = race_config.get("registration_cost", 3500) if race_config else 3500
            
            nombre = f"{registration.get('nombre', '')} {registration.get('apellidos', '')}".strip()
            await create_payment_income(
                email=email.lower(),
                nombre=nombre,
                monto=registration_cost,
                race_code=race_code
            )
        except Exception as e:
            print(f"Error creating income record: {e}")
    
    # Send notification email to athlete using template system
    try:
        from services.template_email_service import (
            send_email_with_template, build_race_data, build_athlete_data
        )
        
        race_config = await db["race_configurations"].find_one({"code": race_code})
        registration_cost = race_config.get("registration_cost", 3500) if race_config else 3500
        
        # Get payment date from receipt or use current date
        payment_receipt = registration.get("payment_receipt", {})
        payment_date = payment_receipt.get("payment_date") or payment_receipt.get("uploaded_at")
        if payment_date:
            if hasattr(payment_date, 'strftime'):
                payment_date_str = payment_date.strftime("%d/%m/%Y")
            else:
                payment_date_str = str(payment_date)[:10]
        else:
            payment_date_str = datetime.now(timezone.utc).strftime("%d/%m/%Y")
        
        merge_data = {
            **build_race_data(race_config),
            **build_athlete_data(registration),
            "payment_amount": f"RD${registration_cost:,.0f}",
            "payment_date": payment_date_str,
        }
        
        template_id = "payment_confirmed" if approved else "payment_rejected"
        
        await send_email_with_template(
            db=db,
            template_id=template_id,
            to_email=email,
            data=merge_data
        )
    except Exception as e:
        print(f"Error sending receipt review email: {e}")
    
    return {
        "message": f"Comprobante {'aprobado' if approved else 'rechazado'}",
        "payment_status": payment_status
    }


# El sub-router admin se monta al final, cuando ya estan definidas sus rutas.
router.include_router(admin_router)
