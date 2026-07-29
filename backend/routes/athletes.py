"""
Athletes authentication and profile management
"""
from fastapi import APIRouter, HTTPException, Depends, Header, Request, UploadFile, File, Form
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import secrets
import hashlib
import jwt
import html
import logging
import re

from services import rate_limit
from services.auth import (
    ALGORITHM,
    ATHLETE_SECRET_KEY,
    has_permission,
    verify_admin_token,
)

router = APIRouter(prefix="/athletes", tags=["athletes"])

# El secreto de atleta se deriva del unico secreto del proyecto (services.auth),
# no de una variable propia con valor por defecto: asi no hay forma de que se
# quede sin configurar.
ATHLETE_JWT_SECRET = ATHLETE_SECRET_KEY
ATHLETE_JWT_ALGORITHM = ALGORITHM
ATHLETE_JWT_EXPIRATION_HOURS = 72

# Verification code expiration
CODE_EXPIRATION_MINUTES = 15

# Models
class AthleteRegisterRequest(BaseModel):
    email: EmailStr
    password: str
    nombre: str
    apellidos: str
    telefono: Optional[str] = None
    fecha_nacimiento: Optional[str] = None
    sexo: Optional[str] = None
    nacionalidad: Optional[str] = None
    ciudad_residencia: Optional[str] = None
    # Medical
    tipo_sangre: Optional[str] = None
    condicion_medica: Optional[str] = "No"
    condicion_medica_detalle: Optional[str] = None
    alergias: Optional[str] = "No"
    alergias_detalle: Optional[str] = None
    # Emergency
    contacto_emergencia_nombre: Optional[str] = None
    contacto_emergencia_relacion: Optional[str] = None
    contacto_emergencia_telefono: Optional[str] = None
    # Preferences
    talla_camiseta: Optional[str] = None
    personalizacion_camiseta: Optional[str] = None
    como_se_entero: Optional[str] = None

class AthleteLoginRequest(BaseModel):
    email: EmailStr
    password: str

class VerifyEmailRequest(BaseModel):
    email: EmailStr
    code: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str
    new_password: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class UpdateProfileRequest(BaseModel):
    nombre: Optional[str] = None
    apellidos: Optional[str] = None
    telefono: Optional[str] = None
    fecha_nacimiento: Optional[str] = None
    sexo: Optional[str] = None
    nacionalidad: Optional[str] = None
    ciudad_residencia: Optional[str] = None
    tipo_sangre: Optional[str] = None
    condicion_medica: Optional[str] = None
    condicion_medica_detalle: Optional[str] = None
    alergias: Optional[str] = None
    alergias_detalle: Optional[str] = None
    contacto_emergencia_nombre: Optional[str] = None
    contacto_emergencia_relacion: Optional[str] = None
    contacto_emergencia_telefono: Optional[str] = None
    talla_camiseta: Optional[str] = None
    personalizacion_camiseta: Optional[str] = None
    como_se_entero: Optional[str] = None

class RaceRegistrationRequest(BaseModel):
    race_code: str
    motivacion: Optional[str] = None
    anos_experiencia: Optional[int] = None
    maxima_distancia_km: Optional[float] = None
    vueltas_aspiradas: Optional[str] = None
    tiene_carpa: Optional[str] = None
    hospedaje: Optional[str] = None
    acompanantes: Optional[int] = None

class ClaimResultRequest(BaseModel):
    search_term: str  # nombre, apellidos or BIB

class ConfirmClaimRequest(BaseModel):
    result_id: str


# Helper functions
def hash_password(password: str) -> str:
    """Hash password with salt"""
    salt = secrets.token_hex(16)
    pwd_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
    return f"{salt}:{pwd_hash.hex()}"

def verify_password(password: str, stored_hash: str) -> bool:
    """Verify password against stored hash"""
    try:
        salt, pwd_hash = stored_hash.split(':')
        new_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
        return secrets.compare_digest(new_hash.hex(), pwd_hash)
    except:
        return False

def generate_athlete_token(athlete_id: str, email: str) -> str:
    """Generate JWT token for athlete"""
    payload = {
        "athlete_id": athlete_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=ATHLETE_JWT_EXPIRATION_HOURS),
        "type": "athlete"
    }
    return jwt.encode(payload, ATHLETE_JWT_SECRET, algorithm=ATHLETE_JWT_ALGORITHM)

def verify_athlete_token(token: str) -> dict:
    """Verify and decode athlete JWT token"""
    try:
        payload = jwt.decode(token, ATHLETE_JWT_SECRET, algorithms=[ATHLETE_JWT_ALGORITHM])
        if payload.get("type") != "athlete":
            raise HTTPException(status_code=401, detail="Token inválido")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")

def generate_verification_code() -> str:
    """Generate 6-digit verification code.

    `secrets` y no `random`: el generador de `random` es un Mersenne Twister,
    predecible a partir de sus salidas anteriores, y estos codigos sirven para
    restablecer contrasenas.
    """
    return "".join(str(secrets.randbelow(10)) for _ in range(6))


# Un codigo de 6 digitos son un millon de combinaciones: sin limite de intentos
# se agota en minutos. Al quinto fallo el codigo se anula y hay que pedir otro.
MAX_CODE_ATTEMPTS = 5


async def _registrar_intento_fallido(database, athlete: dict, campo_codigo: str, campo_intentos: str):
    """Suma un intento fallido y anula el codigo si se pasa del limite."""
    intentos = (athlete.get(campo_intentos) or 0) + 1

    if intentos >= MAX_CODE_ATTEMPTS:
        await database.athletes.update_one(
            {"_id": athlete["_id"]},
            {"$set": {campo_codigo: None, campo_intentos: 0}},
        )
        raise HTTPException(
            status_code=429,
            detail="Demasiados intentos fallidos. Solicita un codigo nuevo.",
        )

    await database.athletes.update_one(
        {"_id": athlete["_id"]},
        {"$set": {campo_intentos: intentos}},
    )
    raise HTTPException(status_code=400, detail="Código incorrecto")



@router.post("/check-email")
async def check_email_availability(data: dict):
    """Check if email is already registered"""
    from server import db as database
    email = data.get("email", "").lower().strip()
    if not email:
        raise HTTPException(status_code=400, detail="Email requerido")
    existing = await database.athletes.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=409, detail="Este correo ya esta registrado. Usa 'Iniciar Sesion' para acceder a tu cuenta.")
    return {"available": True}


# Dependency to get current athlete
async def get_current_athlete(authorization: str = Header(None)):
    """Extract and verify athlete from Authorization header"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No autorizado")
    
    token = authorization.replace("Bearer ", "")
    return verify_athlete_token(token)


# ==================== AUTHENTICATION ENDPOINTS ====================

@router.post("/register")
async def register_athlete(data: AthleteRegisterRequest, request: Request = None):
    """Register a new athlete profile"""
    from server import db as database

    rate_limit.limitar_envio_codigo(request)
    
    # Check if email already exists
    existing = await database.athletes.find_one({"email": data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Este correo ya está registrado")
    
    # Generate verification code
    verification_code = generate_verification_code()
    code_expires = datetime.now(timezone.utc) + timedelta(minutes=CODE_EXPIRATION_MINUTES)
    
    # Create athlete document
    athlete_doc = {
        "email": data.email.lower(),
        "password_hash": hash_password(data.password),
        "nombre": data.nombre,
        "apellidos": data.apellidos,
        "telefono": data.telefono,
        "fecha_nacimiento": data.fecha_nacimiento,
        "sexo": data.sexo,
        "nacionalidad": data.nacionalidad,
        "ciudad_residencia": data.ciudad_residencia,
        "tipo_sangre": data.tipo_sangre,
        "condicion_medica": data.condicion_medica,
        "condicion_medica_detalle": data.condicion_medica_detalle,
        "alergias": data.alergias,
        "alergias_detalle": data.alergias_detalle,
        "contacto_emergencia_nombre": data.contacto_emergencia_nombre,
        "contacto_emergencia_relacion": data.contacto_emergencia_relacion,
        "contacto_emergencia_telefono": data.contacto_emergencia_telefono,
        "talla_camiseta": data.talla_camiseta,
        "personalizacion_camiseta": data.personalizacion_camiseta,
        "como_se_entero": data.como_se_entero,
        "photo_url": None,
        "email_verified": False,
        "verification_code": verification_code,
        "verification_code_expires": code_expires,
        "verification_attempts": 0,
        "claimed_results": [],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await database.athletes.insert_one(athlete_doc)
    
    # Auto-claim 2026 result if email matches a BIB from that race
    auto_claimed_bib = None
    try:
        from migrations.bib_email_2026 import EMAIL_BIB_MAP
        matched_bib = EMAIL_BIB_MAP.get(data.email.lower())
        if matched_bib:
            # Find the participant in archived_participants or participants
            bib_variants = [matched_bib, matched_bib.lstrip("0") or "0"]
            for coll_name in ["archived_participants", "participants"]:
                participant = await database[coll_name].find_one({
                    "bib": {"$in": bib_variants},
                    "claimed_by": {"$exists": False}
                })
                if participant:
                    pid = str(participant["_id"])
                    aid = str(athlete_doc["_id"])
                    await database[coll_name].update_one(
                        {"_id": participant["_id"]},
                        {"$set": {"claimed_by": aid}}
                    )
                    await database.athletes.update_one(
                        {"_id": athlete_doc["_id"]},
                        {"$addToSet": {"claimed_results": pid}}
                    )
                    auto_claimed_bib = matched_bib
                    logging.info(f"Auto-claimed BIB {matched_bib} for {data.email.lower()}")
                    break
    except Exception as e:
        logging.warning(f"Auto-claim error for {data.email.lower()}: {e}")
    
    # Send verification email using template
    try:
        from services.template_email_service import send_email_with_template, build_race_data
        
        # Get active race for race_name
        active_race = await database.race_configurations.find_one({"is_active": True})
        race_data = build_race_data(active_race) if active_race else {"race_name": "Backyard Ultra Santo Domingo"}
        
        email_data = {
            **race_data,
            "nombre": data.nombre,
            "verification_code": verification_code,
            "expires_minutes": str(CODE_EXPIRATION_MINUTES)
        }
        
        await send_email_with_template(
            database,
            "email_verification",
            data.email,
            email_data
        )
    except Exception as e:
        print(f"Error sending verification email: {e}")
    
    return {
        "success": True,
        "message": "Perfil creado. Revisa tu correo para verificar tu cuenta.",
        "requires_verification": True
    }


@router.post("/verify-email")
async def verify_email(data: VerifyEmailRequest, request: Request = None):
    """Verify email with code"""
    from server import db as database

    rate_limit.limitar_verificacion(request)
    
    athlete = await database.athletes.find_one({"email": data.email.lower()})
    if not athlete:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    
    if athlete.get("email_verified"):
        return {"success": True, "message": "Email ya verificado"}
    
    # Check code
    stored_code = athlete.get("verification_code")
    code_expires = athlete.get("verification_code_expires")
    
    if not stored_code or not secrets.compare_digest(str(stored_code), data.code):
        await _registrar_intento_fallido(
            database, athlete, "verification_code", "verification_attempts"
        )

    if code_expires:
        # Handle both naive and aware datetimes from MongoDB
        if code_expires.tzinfo is None:
            code_expires = code_expires.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > code_expires:
            raise HTTPException(status_code=400, detail="Código expirado. Solicita uno nuevo.")

    # Mark as verified
    await database.athletes.update_one(
        {"_id": athlete["_id"]},
        {
            "$set": {
                "email_verified": True,
                "verification_code": None,
                "verification_code_expires": None,
                "verification_attempts": 0,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    # Generate token
    token = generate_athlete_token(str(athlete["_id"]), athlete["email"])
    
    return {
        "success": True,
        "message": "Email verificado correctamente",
        "token": token,
        "athlete": {
            "id": str(athlete["_id"]),
            "email": athlete["email"],
            "nombre": athlete["nombre"],
            "apellidos": athlete["apellidos"]
        }
    }


@router.post("/resend-code")
async def resend_verification_code(data: ForgotPasswordRequest, request: Request = None):
    """Resend verification code"""
    from server import db as database

    rate_limit.limitar_envio_codigo(request)
    
    athlete = await database.athletes.find_one({"email": data.email.lower()})
    if not athlete:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    
    if athlete.get("email_verified"):
        return {"success": True, "message": "Email ya verificado"}
    
    # Generate new code
    verification_code = generate_verification_code()
    code_expires = datetime.now(timezone.utc) + timedelta(minutes=CODE_EXPIRATION_MINUTES)
    
    await database.athletes.update_one(
        {"_id": athlete["_id"]},
        {
            "$set": {
                "verification_code": verification_code,
                "verification_code_expires": code_expires,
                "verification_attempts": 0
            }
        }
    )
    
    # Send email using template
    try:
        from services.template_email_service import send_email_with_template, build_race_data
        
        active_race = await database.race_configurations.find_one({"is_active": True})
        race_data = build_race_data(active_race) if active_race else {"race_name": "Backyard Ultra Santo Domingo"}
        
        email_data = {
            **race_data,
            "nombre": athlete["nombre"],
            "verification_code": verification_code,
            "expires_minutes": str(CODE_EXPIRATION_MINUTES)
        }
        
        await send_email_with_template(
            database,
            "email_verification",
            data.email,
            email_data
        )
    except Exception as e:
        print(f"Error sending verification email: {e}")
    
    return {"success": True, "message": "Código enviado"}


@router.post("/login")
async def login_athlete(data: AthleteLoginRequest, request: Request = None):
    """Login athlete"""
    from server import db as database

    ip = rate_limit.limitar_login(request, data.email)
    
    athlete = await database.athletes.find_one({"email": data.email.lower()})
    if not athlete:
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    
    if not verify_password(data.password, athlete.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    
    if not athlete.get("email_verified"):
        # Resend verification code
        verification_code = generate_verification_code()
        code_expires = datetime.now(timezone.utc) + timedelta(minutes=CODE_EXPIRATION_MINUTES)
        
        await database.athletes.update_one(
            {"_id": athlete["_id"]},
            {
                "$set": {
                    "verification_code": verification_code,
                    "verification_code_expires": code_expires,
                    "verification_attempts": 0
                }
            }
        )
        
        try:
            from services.template_email_service import send_email_with_template, build_race_data
            
            active_race = await database.race_configurations.find_one({"is_active": True})
            race_data = build_race_data(active_race) if active_race else {"race_name": "Backyard Ultra Santo Domingo"}
            
            email_data = {
                **race_data,
                "nombre": athlete["nombre"],
                "verification_code": verification_code,
                "expires_minutes": str(CODE_EXPIRATION_MINUTES)
            }
            
            await send_email_with_template(
                database,
                "email_verification",
                data.email,
                email_data
            )
        except:
            pass
        
        raise HTTPException(
            status_code=403, 
            detail="Email no verificado. Te enviamos un nuevo código."
        )
    
    # Generate token
    token = generate_athlete_token(str(athlete["_id"]), athlete["email"])
    rate_limit.olvidar("login", ip)

    return {
        "success": True,
        "token": token,
        "athlete": {
            "id": str(athlete["_id"]),
            "email": athlete["email"],
            "nombre": athlete["nombre"],
            "apellidos": athlete["apellidos"]
        }
    }


@router.post("/forgot-password")
async def forgot_password(data: ForgotPasswordRequest, request: Request = None):
    """Request password reset"""
    from server import db as database

    rate_limit.limitar_envio_codigo(request)
    
    athlete = await database.athletes.find_one({"email": data.email.lower()})
    if not athlete:
        # Don't reveal if email exists
        return {"success": True, "message": "Si el correo existe, recibirás un código"}
    
    # Generate reset code
    reset_code = generate_verification_code()
    code_expires = datetime.now(timezone.utc) + timedelta(minutes=CODE_EXPIRATION_MINUTES)
    
    await database.athletes.update_one(
        {"_id": athlete["_id"]},
        {
            "$set": {
                "reset_code": reset_code,
                "reset_code_expires": code_expires,
                "reset_attempts": 0
            }
        }
    )
    
    # Send email using template
    try:
        from services.template_email_service import (
            send_email_with_template,
            send_templated_email,
            build_race_data,
            build_athlete_data,
            build_general_data,
        )

        active_race = await database.race_configurations.find_one({"is_active": True})
        race_data = build_race_data(active_race) if active_race else {"race_name": "Backyard Ultra Santo Domingo"}

        email_data = {
            **race_data,
            **build_athlete_data(athlete),
            **build_general_data(verification_code=reset_code),
            "nombre": athlete["nombre"],
            "reset_code": reset_code,
            "expires_minutes": str(CODE_EXPIRATION_MINUTES)
        }

        sent = await send_email_with_template(
            database,
            "password_reset",
            data.email,
            email_data
        )

        # If the template is missing or failed, send a minimal fallback so the
        # user always receives the code
        if not sent:
            race_name = race_data.get("race_name", "Backyard Ultra Santo Domingo")
            fallback_html = f"""
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #ea580c;">Restablecer contraseña</h2>
    <p>Hola {athlete.get('nombre', '')},</p>
    <p>Tu código para restablecer la contraseña es:</p>
    <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #ea580c;">{reset_code}</p>
    <p>Este código expira en {CODE_EXPIRATION_MINUTES} minutos.</p>
    <p style="color: #6b7280; font-size: 13px;">Si no solicitaste este cambio, ignora este correo.</p>
    <p style="color: #9ca3af; font-size: 12px;">{race_name}</p>
</div>
"""
            await send_templated_email(
                data.email,
                f"Código para restablecer tu contraseña - {race_name}",
                fallback_html
            )
    except Exception as e:
        print(f"Error sending reset email: {e}")
    
    return {"success": True, "message": "Si el correo existe, recibirás un código"}


@router.post("/reset-password")
async def reset_password(data: ResetPasswordRequest, request: Request = None):
    """Reset password with code"""
    from server import db as database

    rate_limit.limitar_verificacion(request)
    
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 6 caracteres")

    athlete = await database.athletes.find_one({"email": data.email.lower()})
    if not athlete:
        # Mismo mensaje que un codigo equivocado: si aqui dijeramos "cuenta no
        # encontrada" se podria averiguar que correos estan registrados, que es
        # justo lo que evita el mensaje generico de /forgot-password.
        raise HTTPException(status_code=400, detail="Código incorrecto")

    # Check code
    stored_code = athlete.get("reset_code")
    code_expires = athlete.get("reset_code_expires")

    if not stored_code or not secrets.compare_digest(str(stored_code), data.code):
        await _registrar_intento_fallido(
            database, athlete, "reset_code", "reset_attempts"
        )

    if code_expires:
        if code_expires.tzinfo is None:
            code_expires = code_expires.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > code_expires:
            raise HTTPException(status_code=400, detail="Código expirado")

    # Update password
    await database.athletes.update_one(
        {"_id": athlete["_id"]},
        {
            "$set": {
                "password_hash": hash_password(data.new_password),
                "reset_code": None,
                "reset_code_expires": None,
                "reset_attempts": 0,
                "email_verified": True,  # Also verify email
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    return {"success": True, "message": "Contraseña actualizada"}


@router.post("/change-password")
async def change_password(data: ChangePasswordRequest, authorization: str = Header(None)):
    """Change password while authenticated (requires current password)"""
    from server import db as database
    from bson import ObjectId

    payload = await get_current_athlete(authorization)
    athlete_id = payload["athlete_id"]

    athlete = await database.athletes.find_one({"_id": ObjectId(athlete_id)})
    if not athlete:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")

    # Verify current password
    if not verify_password(data.current_password, athlete.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="La contraseña actual es incorrecta")

    # Validate new password
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="La nueva contraseña debe tener al menos 6 caracteres")

    if verify_password(data.new_password, athlete.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="La nueva contraseña debe ser diferente a la actual")

    await database.athletes.update_one(
        {"_id": athlete["_id"]},
        {"$set": {
            "password_hash": hash_password(data.new_password),
            "updated_at": datetime.now(timezone.utc)
        }}
    )

    return {"success": True, "message": "Contraseña actualizada correctamente"}


# ==================== PROFILE ENDPOINTS ====================

@router.get("/profile")
async def get_profile(authorization: str = Header(None)):
    """Get current athlete profile"""
    from server import db as database
    from bson import ObjectId
    
    payload = await get_current_athlete(authorization)
    athlete_id = payload["athlete_id"]
    
    athlete = await database.athletes.find_one({"_id": ObjectId(athlete_id)})
    if not athlete:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")
    
    return {
        "id": str(athlete["_id"]),
        "email": athlete["email"],
        "nombre": athlete["nombre"],
        "apellidos": athlete["apellidos"],
        "telefono": athlete.get("telefono"),
        "fecha_nacimiento": athlete.get("fecha_nacimiento"),
        "sexo": athlete.get("sexo") or athlete.get("genero"),
        "nacionalidad": athlete.get("nacionalidad") or athlete.get("pais"),
        "ciudad_residencia": athlete.get("ciudad_residencia") or athlete.get("ciudad"),
        "tipo_sangre": athlete.get("tipo_sangre"),
        "condicion_medica": athlete.get("condicion_medica"),
        "condicion_medica_detalle": athlete.get("condicion_medica_detalle"),
        "alergias": athlete.get("alergias"),
        "alergias_detalle": athlete.get("alergias_detalle"),
        "contacto_emergencia_nombre": athlete.get("contacto_emergencia_nombre"),
        "contacto_emergencia_relacion": athlete.get("contacto_emergencia_relacion"),
        "contacto_emergencia_telefono": athlete.get("contacto_emergencia_telefono"),
        "talla_camiseta": athlete.get("talla_camiseta"),
        "personalizacion_camiseta": athlete.get("personalizacion_camiseta"),
        "como_se_entero": athlete.get("como_se_entero"),
        "photo_url": athlete.get("photo_url"),
        "email_verified": athlete.get("email_verified", False),
        "claimed_results": athlete.get("claimed_results", []),
        "profile_complete": bool(athlete.get("tipo_sangre") and athlete.get("talla_camiseta") and athlete.get("contacto_emergencia_nombre")),
        "created_at": athlete.get("created_at")
    }


@router.put("/profile")
async def update_profile(data: UpdateProfileRequest, authorization: str = Header(None)):
    """Update athlete profile"""
    from server import db as database
    from bson import ObjectId
    
    payload = await get_current_athlete(authorization)
    athlete_id = payload["athlete_id"]
    
    # Build update dict
    update_data = {"updated_at": datetime.now(timezone.utc)}
    
    profile_fields = [
        "nombre", "apellidos", "telefono", "fecha_nacimiento", 
        "sexo", "nacionalidad", "ciudad_residencia",
        "tipo_sangre", "condicion_medica", "condicion_medica_detalle",
        "alergias", "alergias_detalle",
        "contacto_emergencia_nombre", "contacto_emergencia_relacion",
        "contacto_emergencia_telefono",
        "talla_camiseta", "personalizacion_camiseta", "como_se_entero"
    ]
    
    for field in profile_fields:
        value = getattr(data, field, None)
        if value is not None:
            update_data[field] = value
    
    await database.athletes.update_one(
        {"_id": ObjectId(athlete_id)},
        {"$set": update_data}
    )
    
    return {"success": True, "message": "Perfil actualizado"}


MAX_ATHLETE_PHOTO_SIZE = 10 * 1024 * 1024  # 10MB


@router.post("/upload-photo")
async def upload_athlete_photo(
    photo: UploadFile = File(...),
    authorization: str = Header(None)
):
    """Upload athlete profile photo"""
    from server import db as database
    from bson import ObjectId
    from services import file_storage
    import uuid

    payload = await get_current_athlete(authorization)
    athlete_id = payload["athlete_id"]

    if not photo.content_type or not photo.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="El archivo debe ser una imagen")

    content = await photo.read()
    if len(content) > MAX_ATHLETE_PHOTO_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"El archivo es demasiado grande (maximo 10MB). Tu archivo tiene {len(content) / 1024 / 1024:.2f}MB."
        )

    ext_original = photo.filename.split(".")[-1] if photo.filename and "." in photo.filename else "jpg"
    content, ext, content_type = file_storage.compress_image(content, ext_original, photo.content_type)
    filename = f"{athlete_id}_{uuid.uuid4().hex[:8]}.{ext}"
    await file_storage.save(filename, content, content_type, file_storage.FOLDER_ATHLETE_PHOTOS)

    photo_url = f"/api/static/athlete_photos/{filename}"

    anterior = await database.athletes.find_one_and_update(
        {"_id": ObjectId(athlete_id)},
        {"$set": {"photo_url": photo_url, "updated_at": datetime.now(timezone.utc)}},
        projection={"photo_url": 1}
    )

    # Borrar la foto que se reemplaza para no acumular huerfanos en GridFS.
    url_anterior = (anterior or {}).get("photo_url")
    if url_anterior and url_anterior != photo_url:
        await file_storage.delete(url_anterior.rsplit("/", 1)[-1])

    return {"success": True, "photo_url": photo_url}


# ==================== RACE REGISTRATION ENDPOINTS ====================

@router.get("/my-races")
async def get_my_races(authorization: str = Header(None)):
    """Get races the athlete is registered for"""
    from server import db as database
    from bson import ObjectId
    
    payload = await get_current_athlete(authorization)
    athlete_id = payload["athlete_id"]
    
    # Get registrations linked to this athlete
    registrations = await database.registrations.find({
        "athlete_id": athlete_id
    }).to_list(100)
    
    # Also check by email for legacy registrations
    athlete = await database.athletes.find_one({"_id": ObjectId(athlete_id)})
    if athlete:
        email_registrations = await database.registrations.find({
            "email": athlete["email"],
            "athlete_id": {"$exists": False}
        }).to_list(100)
        registrations.extend(email_registrations)
    
    # Get race details for each registration
    result = []
    for reg in registrations:
        race_code = reg.get("race_code")
        race_config = await database.race_configurations.find_one({"code": race_code})
        
        # Generate edit_token if missing
        edit_token = reg.get("edit_token")
        if not edit_token:
            edit_token = secrets.token_urlsafe(32)
            await database.registrations.update_one(
                {"_id": reg["_id"]},
                {"$set": {"edit_token": edit_token}}
            )
        
        result.append({
            "registration_id": str(reg["_id"]),
            "race_code": race_code,
            "race_name": race_config.get("name") if race_config else race_code,
            "race_date": race_config.get("race_date") if race_config else None,
            "bib": reg.get("bib"),
            "categoria": reg.get("categoria"),
            "status": reg.get("status", "registered"),
            "payment_status": reg.get("payment_status", "pending"),
            "payment_receipt_status": reg.get("payment_receipt", {}).get("status") if reg.get("payment_receipt") else None,
            "edit_token": edit_token,
            "laps_completed": reg.get("laps_completed", 0),
            "is_active": race_config.get("is_active", False) if race_config else False
        })
    
    # Sort by race date, active races first
    result.sort(key=lambda x: (not x["is_active"], x.get("race_date") or ""))
    
    return {"races": result}


@router.post("/register-race")
async def register_for_race(data: RaceRegistrationRequest, authorization: str = Header(None)):
    """Register athlete for a race"""
    from server import db as database
    from bson import ObjectId
    
    payload = await get_current_athlete(authorization)
    athlete_id = payload["athlete_id"]
    
    # Get athlete info
    athlete = await database.athletes.find_one({"_id": ObjectId(athlete_id)})
    if not athlete:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")
    
    # Check race exists
    race = await database.race_configurations.find_one({"code": data.race_code})
    if not race:
        raise HTTPException(status_code=404, detail="Carrera no encontrada")
    
    # Check if already registered
    existing = await database.registrations.find_one({
        "race_code": data.race_code,
        "$or": [
            {"athlete_id": athlete_id},
            {"email": athlete["email"]}
        ]
    })
    if existing:
        raise HTTPException(status_code=400, detail="Ya estás inscrito en esta carrera")
    
    # Get next BIB number
    last_reg = await database.registrations.find_one(
        {"race_code": data.race_code},
        sort=[("bib", -1)]
    )
    next_bib = 1
    if last_reg and last_reg.get("bib"):
        try:
            next_bib = int(last_reg["bib"]) + 1
        except:
            next_bib = 1
    
    # Determine if this registration exceeds capacity -> waitlist
    max_participants = race.get("max_participants", 120)
    current_count = await database.registrations.count_documents({
        "race_code": data.race_code,
        "status": {"$nin": ["cancelled", "waitlist"]}
    })
    is_waitlist = current_count >= max_participants
    reg_status = "waitlist" if is_waitlist else "registered"

    # Create registration with profile data + event-specific fields
    registration_doc = {
        "athlete_id": athlete_id,
        "race_code": data.race_code,
        "email": athlete["email"],
        "nombre": athlete["nombre"],
        "apellidos": athlete["apellidos"],
        "fecha_nacimiento": athlete.get("fecha_nacimiento"),
        "sexo": athlete.get("sexo") or athlete.get("genero"),
        "nacionalidad": athlete.get("nacionalidad") or athlete.get("pais"),
        "telefono": athlete.get("telefono"),
        "ciudad_residencia": athlete.get("ciudad_residencia") or athlete.get("ciudad"),
        "tipo_sangre": athlete.get("tipo_sangre"),
        "condicion_medica": athlete.get("condicion_medica"),
        "condicion_medica_detalle": athlete.get("condicion_medica_detalle"),
        "alergias": athlete.get("alergias"),
        "alergias_detalle": athlete.get("alergias_detalle"),
        "contacto_emergencia_nombre": athlete.get("contacto_emergencia_nombre"),
        "contacto_emergencia_relacion": athlete.get("contacto_emergencia_relacion"),
        "contacto_emergencia_telefono": athlete.get("contacto_emergencia_telefono"),
        "talla_camiseta": athlete.get("talla_camiseta"),
        "personalizacion_camiseta": athlete.get("personalizacion_camiseta"),
        "como_se_entero": athlete.get("como_se_entero"),
        "photo_url": athlete.get("photo_url"),
        # Event-specific fields
        "motivacion": data.motivacion,
        "anos_experiencia": data.anos_experiencia,
        "maxima_distancia_km": data.maxima_distancia_km,
        "vueltas_aspiradas": data.vueltas_aspiradas,
        "tiene_carpa": data.tiene_carpa,
        "hospedaje": data.hospedaje,
        "acompanantes": data.acompanantes,
        # Registration metadata
        "edit_token": secrets.token_urlsafe(32),
        "bib": str(next_bib).zfill(3),
        "status": reg_status,
        "payment_status": "pending",
        "laps_completed": 0,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await database.registrations.insert_one(registration_doc)
    
    # Send confirmation email using existing template (or waitlist template if capacity reached)
    try:
        from services.template_email_service import send_email_with_template, build_race_data, build_athlete_data
        race_config = await database.race_configurations.find_one({"code": data.race_code})
        merge_data = {
            **build_race_data(race_config),
            **build_athlete_data(registration_doc, edit_token=registration_doc["edit_token"]),
        }

        if is_waitlist:
            # Waitlist: no payment timeline, just notify the athlete is on the waitlist
            await send_email_with_template(
                db=database,
                template_id="athlete_waitlist_confirmation",
                to_email=athlete["email"],
                data=merge_data
            )
        else:
            # Dynamic content based on date: before Oct 2026 vs Oct 2026+
            now = datetime.now(timezone.utc)
            payment_cutoff = datetime(2026, 10, 1, tzinfo=timezone.utc)
            if now < payment_cutoff:
                merge_data["proximos_pasos"] = """
                    <p style="font-size: 16px; color: #1f2937; line-height: 1.6;">
                        <strong>¡Felicidades!</strong> Tu registro a la carrera está confirmado.
                    </p>
                    <div style="background: #eff6ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
                        <p style="margin: 0; color: #1e40af; line-height: 1.6;">
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
                db=database,
                template_id="athlete_registration_confirmation",
                to_email=athlete["email"],
                data=merge_data
            )
    except Exception as e:
        print(f"Error sending confirmation email: {e}")
    
    return {
        "success": True,
        "message": "Inscripción en lista de espera" if is_waitlist else "Inscripción realizada",
        "waitlisted": is_waitlist,
        "bib": registration_doc["bib"]
    }



@router.delete("/cancel-race/{registration_id}")
async def cancel_race_registration(registration_id: str, authorization: str = Header(None)):
    """Cancel a race registration (only if no payment receipt uploaded)"""
    from server import db as database
    from bson import ObjectId
    
    payload = await get_current_athlete(authorization)
    athlete_id = payload["athlete_id"]
    
    try:
        reg = await database.registrations.find_one({"_id": ObjectId(registration_id)})
    except:
        raise HTTPException(status_code=404, detail="Inscripcion no encontrada")
    
    if not reg:
        raise HTTPException(status_code=404, detail="Inscripcion no encontrada")
    
    # Verify ownership
    if reg.get("athlete_id") != athlete_id and reg.get("email") != payload.get("email"):
        raise HTTPException(status_code=403, detail="No autorizado")
    
    # Cannot cancel if payment receipt already uploaded
    if reg.get("payment_receipt"):
        raise HTTPException(status_code=400, detail="No puedes cancelar una inscripcion con comprobante de pago cargado")
    
    # Cannot cancel if already in race (active, retired, winner)
    if reg.get("status") in ["active", "retired", "winner"]:
        raise HTTPException(status_code=400, detail="No puedes cancelar una inscripcion en curso o finalizada")
    
    await database.registrations.delete_one({"_id": ObjectId(registration_id)})
    
    return {"success": True, "message": "Inscripcion cancelada exitosamente"}



# ==================== CHEER MESSAGES ====================


@router.get("/my-messages")
async def get_my_cheer_messages(authorization: str = Header(None), race_code: str = None):
    """Get all cheer messages for an athlete across all races"""
    from server import db as database
    from bson import ObjectId
    
    payload = await get_current_athlete(authorization)
    athlete_id = payload["athlete_id"]
    
    athlete = await database.athletes.find_one({"_id": ObjectId(athlete_id)})
    if not athlete:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")
    
    # Collect all BIBs per race_code
    bib_map = {}  # {race_code: [bibs]}
    
    # From current registrations
    registrations = await database.registrations.find({
        "$or": [{"athlete_id": athlete_id}, {"email": athlete["email"]}]
    }).to_list(100)
    for reg in registrations:
        rc = reg.get("race_code", "")
        bib = reg.get("bib")
        if bib:
            bib_map.setdefault(rc, set()).add(bib)
    
    # From claimed results (participants + archived_participants)
    claimed_ids = athlete.get("claimed_results", [])
    if claimed_ids:
        try:
            object_ids = [ObjectId(cid) for cid in claimed_ids]
            for coll_name in ["participants", "archived_participants"]:
                docs = await database[coll_name].find({"_id": {"$in": object_ids}}).to_list(100)
                for doc in docs:
                    rc = doc.get("race_code", "BYSD-2026")
                    bib = doc.get("bib")
                    if bib:
                        bib_map.setdefault(rc, set()).add(bib)
        except:
            pass
    
    if not bib_map:
        return {"messages": [], "races": []}
    
    # Determine which races are archived vs current
    all_messages = []
    race_labels = {}
    
    for rc, bibs in bib_map.items():
        bib_list = list(bibs)
        # Normalize BIBs: include both padded, unpadded, and integer versions
        expanded_bibs = set()
        for b in bib_list:
            b_str = str(b)
            expanded_bibs.add(b_str)
            stripped = b_str.lstrip("0") or "0"
            expanded_bibs.add(stripped)
            expanded_bibs.add(stripped.zfill(3))
        bib_list = list(expanded_bibs)
        # Also include integer versions for MongoDB type-mismatch
        int_bibs = []
        for b in bib_list:
            try:
                int_bibs.append(int(b))
            except:
                pass
        combined_bibs = bib_list + int_bibs
        bib_query = {"athlete_bib": {"$in": combined_bibs}}
        if race_code and race_code != rc:
            continue
        
        is_archived = "2026" in rc
        messages = []
        
        if is_archived:
            # For 2026 race: query BOTH collections to handle prod/preview differences
            # 1) archived_cheer_messages (preview may store them here)
            arch_msgs = await database.archived_cheer_messages.find(bib_query).sort("created_at", -1).to_list(500)
            messages.extend(arch_msgs)
            logging.info(f"Cheer archived query for {rc}: found={len(arch_msgs)}")
            
            # 2) cheer_messages: legacy messages without race_code (production)
            legacy_query = {
                "athlete_bib": {"$in": combined_bibs},
                "$or": [
                    {"race_code": {"$exists": False}},
                    {"race_code": None},
                    {"race_code": ""},
                    {"race_code": rc}
                ]
            }
            legacy_msgs = await database.cheer_messages.find(legacy_query).sort("created_at", -1).to_list(500)
            messages.extend(legacy_msgs)
            logging.info(f"Cheer legacy query for {rc}: found={len(legacy_msgs)}")
        else:
            # For current races: only cheer_messages with matching race_code
            query = {**bib_query, "race_code": rc}
            messages = await database.cheer_messages.find(query).sort("created_at", -1).to_list(500)
        
        # Deduplicate by message content + fan_name + created_at
        seen = set()
        unique_messages = []
        for msg in messages:
            key = (msg.get("fan_name", ""), msg.get("message", ""), str(msg.get("created_at", "")))
            if key not in seen:
                seen.add(key)
                unique_messages.append(msg)
        messages = unique_messages
        
        logging.info(f"Cheer messages for {rc}: bib_map={list(bibs)}, total_unique={len(messages)}")
        
        # Get race name - try multiple collections and field names
        race_config = None
        for coll_name in ["race_configurations", "race_config"]:
            for field in ["code", "race_code"]:
                race_config = await database[coll_name].find_one({field: rc})
                if race_config:
                    break
            if race_config:
                break
        race_name = rc
        if race_config:
            race_name = race_config.get("name") or race_config.get("race_name") or rc
        race_labels[rc] = race_name
        
        for msg in messages:
            all_messages.append({
                "fan_name": msg.get("fan_name", "Anonimo"),
                "message": msg.get("message", ""),
                "race_code": rc,
                "race_name": race_name,
                "created_at": msg.get("created_at").isoformat() if msg.get("created_at") else None,
            })
    
    # Sort all by date descending
    all_messages.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    
    races = [{"code": k, "name": v} for k, v in race_labels.items()]
    
    return {"messages": all_messages, "races": races}



# ==================== HISTORICAL RESULTS / CLAIM ====================

@router.get("/search-2026-results")
async def search_2026_results(q: str, authorization: str = Header(None)):
    """Search 2026 race results by name or BIB"""
    from server import db as database
    
    # Verify athlete is logged in
    await get_current_athlete(authorization)
    
    if not q or len(q) < 2:
        return {"results": []}
    
    search_query = {
        "$or": [
            {"nombre": {"$regex": q, "$options": "i"}},
            {"apellidos": {"$regex": q, "$options": "i"}},
            {"bib": {"$regex": q, "$options": "i"}}
        ]
    }
    
    formatted = []
    
    # Search in archived_participants (BYSD-2026 data)
    archived = await database.archived_participants.find(
        {**search_query, "race_code": {"$regex": "2026", "$options": "i"}},
        {"_id": 1, "bib": 1, "nombre": 1, "apellidos": 1, "laps_completed": 1, 
         "status": 1, "race_code": 1, "claimed_by": 1}
    ).to_list(20)
    
    for r in archived:
        formatted.append({
            "id": str(r["_id"]),
            "source": "archived",
            "bib": r.get("bib"),
            "nombre": r.get("nombre"),
            "apellidos": r.get("apellidos"),
            "laps_completed": r.get("laps_completed", 0),
            "status": r.get("status"),
            "race_code": r.get("race_code", "BYSD-2026"),
            "already_claimed": r.get("claimed_by") is not None
        })
    
    # Also search in participants collection (legacy 2026)
    if len(formatted) < 20:
        legacy = await database.participants.find(
            search_query,
            {"_id": 1, "bib": 1, "nombre": 1, "apellidos": 1, "laps_completed": 1, 
             "status": 1, "claimed_by": 1}
        ).to_list(20 - len(formatted))
        
        # Avoid duplicates by BIB
        existing_bibs = {r["bib"] for r in formatted}
        for r in legacy:
            if r.get("bib") not in existing_bibs:
                formatted.append({
                    "id": str(r["_id"]),
                    "source": "participants",
                    "bib": r.get("bib"),
                    "nombre": r.get("nombre"),
                    "apellidos": r.get("apellidos"),
                    "laps_completed": r.get("laps_completed", 0),
                    "status": r.get("status"),
                    "race_code": "BYSD-2026",
                    "already_claimed": r.get("claimed_by") is not None
                })
    
    # Also search in registrations with 2026 race_code
    if len(formatted) < 20:
        reg_query = {
            "race_code": {"$regex": "2026", "$options": "i"},
            **search_query
        }
        reg_results = await database.registrations.find(
            reg_query,
            {"_id": 1, "bib": 1, "nombre": 1, "apellidos": 1, "laps_completed": 1, 
             "status": 1, "race_code": 1, "claimed_by": 1}
        ).to_list(20 - len(formatted))
        
        existing_bibs = {r["bib"] for r in formatted}
        for r in reg_results:
            if r.get("bib") not in existing_bibs:
                formatted.append({
                    "id": str(r["_id"]),
                    "source": "registrations",
                    "bib": r.get("bib"),
                    "nombre": r.get("nombre"),
                    "apellidos": r.get("apellidos"),
                    "laps_completed": r.get("laps_completed", 0),
                    "status": r.get("status"),
                    "race_code": r.get("race_code"),
                    "already_claimed": r.get("claimed_by") is not None
                })
    
    return {"results": formatted}


@router.post("/claim-result")
async def claim_result(data: ConfirmClaimRequest, authorization: str = Header(None)):
    """Claim a historical result"""
    from server import db as database
    from bson import ObjectId
    
    payload = await get_current_athlete(authorization)
    athlete_id = payload["athlete_id"]
    
    # Try to find the result in multiple collections
    result = None
    collection_name = None
    
    try:
        obj_id = ObjectId(data.result_id)
    except:
        raise HTTPException(status_code=404, detail="Resultado no encontrado")
    
    # Check archived_participants first
    result = await database.archived_participants.find_one({"_id": obj_id})
    if result:
        collection_name = "archived_participants"
    
    # Then check participants
    if not result:
        result = await database.participants.find_one({"_id": obj_id})
        if result:
            collection_name = "participants"
    
    # Then check registrations
    if not result:
        result = await database.registrations.find_one({"_id": obj_id})
        if result:
            collection_name = "registrations"
    
    if not result:
        raise HTTPException(status_code=404, detail="Resultado no encontrado")
    
    # Check if already claimed
    if result.get("claimed_by"):
        raise HTTPException(status_code=400, detail="Este resultado ya fue reclamado")
    
    # Prevent claiming more than one result from the same race (BYSD-2026)
    result_race = result.get("race_code", "BYSD-2026")
    athlete = await database.athletes.find_one({"_id": ObjectId(athlete_id)})
    existing_claims = athlete.get("claimed_results", []) if athlete else []
    if existing_claims:
        existing_oids = []
        for cid in existing_claims:
            try:
                existing_oids.append(ObjectId(cid))
            except:
                pass
        if existing_oids:
            for coll in ["archived_participants", "participants"]:
                already = await database[coll].find_one({
                    "_id": {"$in": existing_oids},
                    "race_code": result_race
                })
                if not already and "2026" in result_race:
                    # Legacy records may not have race_code field
                    already = await database[coll].find_one({
                        "_id": {"$in": existing_oids},
                        "race_code": {"$exists": False}
                    })
                if already:
                    raise HTTPException(
                        status_code=400,
                        detail="Ya tienes un resultado reclamado de esta carrera"
                    )
    
    # Mark as claimed in the source collection
    await database[collection_name].update_one(
        {"_id": obj_id},
        {"$set": {"claimed_by": athlete_id}}
    )
    
    # Add to athlete's claimed results
    await database.athletes.update_one(
        {"_id": ObjectId(athlete_id)},
        {"$addToSet": {"claimed_results": data.result_id}}
    )
    
    return {
        "success": True,
        "message": "Resultado reclamado exitosamente",
        "result": {
            "bib": result.get("bib"),
            "laps_completed": result.get("laps_completed"),
            "race_code": result.get("race_code", "BYSD-2026")
        }
    }


@router.post("/unclaim-result")
async def unclaim_result(data: ConfirmClaimRequest, authorization: str = Header(None)):
    """Unclaim a previously claimed historical result"""
    from server import db as database
    from bson import ObjectId

    payload = await get_current_athlete(authorization)
    athlete_id = payload["athlete_id"]

    try:
        obj_id = ObjectId(data.result_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Resultado no encontrado")

    # Find the result in any collection
    for col_name in ["archived_participants", "participants", "registrations"]:
        doc = await database[col_name].find_one({"_id": obj_id})
        if doc:
            if doc.get("claimed_by") != athlete_id:
                raise HTTPException(status_code=403, detail="No puedes desvincular este resultado")
            await database[col_name].update_one({"_id": obj_id}, {"$unset": {"claimed_by": ""}})
            break
    else:
        raise HTTPException(status_code=404, detail="Resultado no encontrado")

    # Remove from athlete's claimed_results
    await database.athletes.update_one(
        {"_id": ObjectId(athlete_id)},
        {"$pull": {"claimed_results": data.result_id}}
    )

    return {"success": True, "message": "Resultado desvinculado"}



@router.get("/race-history")
async def get_race_history(authorization: str = Header(None)):
    """Get athlete's race history including claimed results with rankings"""
    from server import db as database
    from bson import ObjectId
    from pathlib import Path
    
    CERTIFICATES_DIR = Path(__file__).parent.parent / "static" / "certificates" / "individual"
    
    payload = await get_current_athlete(authorization)
    athlete_id = payload["athlete_id"]
    
    # Get athlete
    athlete = await database.athletes.find_one({"_id": ObjectId(athlete_id)})
    if not athlete:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")
    
    athlete_sexo = (athlete.get("sexo") or "").strip().lower()
    
    # Get own registrations with completed status
    own_registrations = await database.registrations.find({
        "$or": [
            {"athlete_id": athlete_id},
            {"email": athlete["email"]}
        ],
        "status": {"$in": ["retired", "winner", "finished", "dns", "active"]}
    }).to_list(100)
    
    # Get claimed historical results from all collections
    claimed_ids = athlete.get("claimed_results", [])
    claimed_results = []
    if claimed_ids:
        try:
            object_ids = [ObjectId(cid) for cid in claimed_ids]
            archived = await database.archived_participants.find({"_id": {"$in": object_ids}}).to_list(100)
            claimed_results.extend(archived)
            legacy = await database.participants.find({"_id": {"$in": object_ids}}).to_list(100)
            claimed_results.extend(legacy)
            reg_claimed = await database.registrations.find({"_id": {"$in": object_ids}}).to_list(100)
            claimed_results.extend(reg_claimed)
        except:
            pass
    
    # Combine and deduplicate
    all_results = own_registrations + claimed_results
    seen_ids = set()
    unique_results = []
    for r in all_results:
        rid = str(r["_id"])
        if rid not in seen_ids:
            seen_ids.add(rid)
            unique_results.append(r)
    
    # Helper: find race config by code (try multiple field names and collections)
    config_cache = {}
    async def find_race_config(race_code):
        if race_code in config_cache:
            return config_cache[race_code]
        config = None
        for coll_name in ["race_configurations", "race_config"]:
            for field in ["code", "race_code"]:
                config = await database[coll_name].find_one({field: race_code})
                if config:
                    break
            if config:
                break
        config_cache[race_code] = config
        return config
    
    # Pre-compute rankings per race_code
    ranking_cache = {}
    
    async def get_rankings(race_code):
        if race_code in ranking_cache:
            return ranking_cache[race_code]
        
        empty = ({}, 0, {}, {}, {})
        try:
            # Determine collections
            collections_to_check = ["archived_participants", "participants"] if "2026" in race_code else ["registrations"]
            
            all_participants = []
            for coll_name in collections_to_check:
                docs = await database[coll_name].find(
                    {"race_code": race_code, "status": {"$nin": ["dns", "honor"]}},
                    {"_id": 1, "bib": 1, "laps_completed": 1, "sexo": 1, "claimed_by": 1}
                ).to_list(1000)
                if not docs:
                    # Fallback: query without race_code filter
                    docs = await database[coll_name].find(
                        {"status": {"$nin": ["dns", "honor"]}},
                        {"_id": 1, "bib": 1, "laps_completed": 1, "sexo": 1, "claimed_by": 1}
                    ).to_list(1000)
                all_participants.extend(docs)
            
            # Deduplicate by BIB (same athlete may exist in multiple collections)
            seen_bibs = {}
            unique_participants = []
            for p in all_participants:
                bib = p.get("bib")
                if bib and bib not in seen_bibs:
                    seen_bibs[bib] = True
                    unique_participants.append(p)
            all_participants = unique_participants
            
            if not all_participants:
                logging.warning(f"Rankings: No participants found for {race_code}")
                ranking_cache[race_code] = empty
                return empty
            
            logging.info(f"Rankings for {race_code}: {len(all_participants)} participants found")
            
            # Dense ranking by laps_completed descending — keyed by BIB (all formats)
            all_participants.sort(key=lambda x: x.get("laps_completed", 0), reverse=True)
            
            overall_map = {}  # bib -> rank (all normalized variants)
            current_rank = 0
            prev_laps = None
            for i, p in enumerate(all_participants):
                laps = p.get("laps_completed", 0)
                bib = str(p.get("bib", ""))
                if laps != prev_laps:
                    current_rank = i + 1
                    prev_laps = laps
                # Store rank for all BIB variants
                stripped = bib.lstrip("0") or "0"
                for variant in [bib, stripped, stripped.zfill(3), stripped.zfill(2)]:
                    overall_map[variant] = current_rank
            
            total_overall = len(all_participants)
            
            # Gender rankings
            gender_groups = {}
            for p in all_participants:
                sexo = (p.get("sexo") or "").strip().lower()
                if not sexo and p.get("claimed_by"):
                    try:
                        claimed_athlete = await database.athletes.find_one(
                            {"_id": ObjectId(p["claimed_by"])}, {"sexo": 1}
                        )
                        if claimed_athlete:
                            sexo = (claimed_athlete.get("sexo") or "").strip().lower()
                    except:
                        pass
                if sexo:
                    gender_groups.setdefault(sexo, []).append(p)
            
            gender_rank_map = {}  # bib -> rank (all normalized variants)
            gender_totals = {}
            for sexo, participants in gender_groups.items():
                participants.sort(key=lambda x: x.get("laps_completed", 0), reverse=True)
                rank = 0
                prev_laps = None
                gender_totals[sexo] = len(participants)
                for i, p in enumerate(participants):
                    laps = p.get("laps_completed", 0)
                    bib = str(p.get("bib", ""))
                    if laps != prev_laps:
                        rank = i + 1
                        prev_laps = laps
                    stripped = bib.lstrip("0") or "0"
                    for variant in [bib, stripped, stripped.zfill(3), stripped.zfill(2)]:
                        gender_rank_map[variant] = rank
            
            ranking_cache[race_code] = (overall_map, total_overall, gender_rank_map, gender_totals, {})
            return ranking_cache[race_code]
        except Exception as e:
            logging.warning(f"Rankings calculation error for {race_code}: {e}")
            ranking_cache[race_code] = empty
            return empty
    
    # Format
    history = []
    for reg in unique_results:
        race_code = reg.get("race_code", "BYSD-2026")
        race_config = await find_race_config(race_code)
        reg_id = str(reg["_id"])
        
        overall_map, total_overall, gender_rank_map, gender_totals, id_to_bib = await get_rankings(race_code)
        
        # Certificate check
        bib = reg.get("bib")
        cert_available = False
        status = reg.get("status", "")
        if bib and status != "dns":
            cert_path = CERTIFICATES_DIR / f"{bib}.pdf"
            if cert_path.exists():
                cert_available = True
        
        # Lookup by BIB (handles cross-collection ID mismatch and BIB format differences)
        lookup_bib = bib
        if bib:
            # Try exact, then stripped, then padded
            if not overall_map.get(bib):
                stripped = bib.lstrip("0") or "0"
                for candidate in [stripped, stripped.zfill(3), stripped.zfill(2)]:
                    if overall_map.get(candidate):
                        lookup_bib = candidate
                        break
        
        overall_pos = overall_map.get(lookup_bib) if lookup_bib else None
        gender_pos = gender_rank_map.get(lookup_bib) if lookup_bib else None
        gender_total = gender_totals.get(athlete_sexo, 0)
        
        if not overall_pos and bib:
            logging.warning(f"Rankings: BIB={bib} NOT found in overall_map (map has {len(overall_map)} entries, sample keys: {list(overall_map.keys())[:5]})")
        
        # Resolve race name from config
        race_name = race_code
        if race_config:
            race_name = race_config.get("name") or race_config.get("race_name") or race_code
        race_date = None
        if race_config:
            race_date = race_config.get("race_date") or race_config.get("date")
        
        history.append({
            "registration_id": reg_id,
            "race_code": race_code,
            "race_name": race_name,
            "race_date": race_date,
            "bib": bib,
            "laps_completed": reg.get("laps_completed", 0),
            "total_km": reg.get("total_km", 0),
            "status": status,
            "is_claimed": reg.get("claimed_by") == athlete_id,
            "overall_position": overall_pos,
            "overall_total": total_overall,
            "gender_position": gender_pos,
            "gender_total": gender_total,
            "certificate_available": cert_available,
        })
    
    # Sort by date descending
    history.sort(key=lambda x: x.get("race_date") or "", reverse=True)
    
    return {"history": history}



# ==================== ADMIN: 2026 RESULTS MANAGEMENT ====================

@router.get("/admin/2026-results")
async def admin_get_2026_results(authorization: str = Header(None)):
    """Admin: Get all 2026 race results with claim status"""
    from server import db as database
    from bson import ObjectId

    # Verify admin token
    payload = _verify_admin_token(authorization)

    results = []

    for coll_name in ["archived_participants", "participants"]:
        docs = await database[coll_name].find(
            {}, {"nombre": 1, "apellidos": 1, "bib": 1, "laps_completed": 1,
                 "status": 1, "claimed_by": 1, "sexo": 1, "nacionalidad": 1}
        ).sort("bib", 1).to_list(200)

        for doc in docs:
            claimed_by_id = doc.get("claimed_by")
            athlete_info = None
            claim_type = None

            if claimed_by_id:
                athlete = await database.athletes.find_one(
                    {"_id": ObjectId(claimed_by_id)},
                    {"_id": 0, "email": 1, "nombre": 1, "apellidos": 1}
                )
                if athlete:
                    athlete_info = athlete
                    # Determine claim type: auto or manual
                    from migrations.bib_email_2026 import EMAIL_BIB_MAP
                    bib = doc.get("bib", "")
                    mapped_email = EMAIL_BIB_MAP.get(bib, "").lower()
                    if mapped_email and athlete.get("email", "").lower() == mapped_email:
                        claim_type = "auto"
                    else:
                        claim_type = "manual"
                else:
                    athlete_info = {"email": "(perfil eliminado)", "nombre": "—", "apellidos": ""}
                    claim_type = "huerfano"

            results.append({
                "id": str(doc["_id"]),
                "collection": coll_name,
                "bib": doc.get("bib"),
                "nombre": doc.get("nombre", ""),
                "apellidos": doc.get("apellidos", ""),
                "laps_completed": doc.get("laps_completed", 0),
                "status": doc.get("status", ""),
                "sexo": doc.get("sexo", ""),
                "nacionalidad": doc.get("nacionalidad", ""),
                "claimed_by_id": claimed_by_id,
                "athlete": athlete_info,
                "claim_type": claim_type,
            })

    # Deduplicate by BIB (prefer archived_participants)
    seen_bibs = {}
    unique = []
    for r in results:
        bib = r["bib"]
        if bib not in seen_bibs or r["collection"] == "archived_participants":
            seen_bibs[bib] = len(unique)
            if bib in seen_bibs and seen_bibs[bib] < len(unique):
                unique[seen_bibs[bib]] = r
            else:
                unique.append(r)

    claimed_count = sum(1 for r in unique if r["claimed_by_id"])
    return {
        "results": unique,
        "stats": {
            "total": len(unique),
            "claimed": claimed_count,
            "unclaimed": len(unique) - claimed_count,
        }
    }


@router.post("/admin/unclaim-2026")
async def admin_unclaim_2026(data: ConfirmClaimRequest, authorization: str = Header(None)):
    """Admin: Force-unclaim a 2026 result"""
    from server import db as database
    from bson import ObjectId

    # Verify admin token
    payload = _verify_admin_token(authorization)

    obj_id = ObjectId(data.result_id)

    # Find the participant and its current claim
    for coll_name in ["archived_participants", "participants"]:
        doc = await database[coll_name].find_one({"_id": obj_id})
        if doc:
            claimed_by = doc.get("claimed_by")
            # Remove claim from participant
            await database[coll_name].update_one(
                {"_id": obj_id}, {"$unset": {"claimed_by": ""}}
            )
            # Remove from athlete's claimed_results
            if claimed_by:
                await database.athletes.update_one(
                    {"_id": ObjectId(claimed_by)},
                    {"$pull": {"claimed_results": data.result_id}}
                )
            logging.info(f"Admin unclaimed BIB {doc.get('bib')} (was claimed by {claimed_by})")
            return {"success": True, "message": f"Resultado BIB {doc.get('bib')} desvinculado"}

    raise HTTPException(status_code=404, detail="Resultado no encontrado")



# ==================== ADMIN: ATHLETE PROFILES ====================

@router.get("/admin/athlete-profiles")
async def admin_get_athlete_profiles(authorization: str = Header(None)):
    """Admin: Get all registered athlete profiles with their race inscription status"""
    from server import db as database
    from bson import ObjectId

    _verify_admin_token(authorization)

    athletes = await database.athletes.find(
        {}, {"password_hash": 0, "verification_code": 0, "reset_code": 0,
             "verification_code_expires": 0, "reset_code_expires": 0}
    ).sort("created_at", -1).to_list(500)

    # Get all registrations to determine inscription status
    registrations = await database.registrations.find(
        {}, {"athlete_id": 1, "race_code": 1, "status": 1}
    ).to_list(1000)
    reg_by_athlete = {}
    for r in registrations:
        aid = r.get("athlete_id")
        if aid:
            reg_by_athlete.setdefault(aid, []).append({
                "race_code": r.get("race_code"),
                "status": r.get("status"),
            })

    result = []
    for a in athletes:
        aid = str(a["_id"])
        regs = reg_by_athlete.get(aid, [])
        result.append({
            "id": aid,
            "email": a.get("email", ""),
            "nombre": a.get("nombre", ""),
            "apellidos": a.get("apellidos", ""),
            "telefono": a.get("telefono", ""),
            "sexo": a.get("sexo", ""),
            "nacionalidad": a.get("nacionalidad", ""),
            "ciudad_residencia": a.get("ciudad_residencia", ""),
            "email_verified": a.get("email_verified", False),
            "created_at": a.get("created_at").isoformat() if a.get("created_at") else None,
            "claimed_results": a.get("claimed_results", []),
            "registrations": regs,
            "inscribed": len(regs) > 0,
            "talla_camiseta": a.get("talla_camiseta", ""),
            "tipo_sangre": a.get("tipo_sangre", ""),
        })

    inscribed = sum(1 for r in result if r["inscribed"])
    return {
        "athletes": result,
        "stats": {
            "total": len(result),
            "inscribed": inscribed,
            "not_inscribed": len(result) - inscribed,
            "verified": sum(1 for r in result if r["email_verified"]),
        }
    }


def _require_admin_permission(authorization: str, permission: str):
    payload = verify_admin_token(authorization)
    if not has_permission(payload, permission):
        raise HTTPException(status_code=403, detail="No tienes permiso para esta operacion")
    return payload


def _verify_admin_token(authorization: str):
    """Exige un token del panel con permiso sobre atletas."""
    return _require_admin_permission(authorization, "athletes")


def _verify_email_admin(authorization: str):
    """El compositor de correos masivos usa su propio permiso ("emails")."""
    return _require_admin_permission(authorization, "emails")


class AdminSetPasswordRequest(BaseModel):
    new_password: str


class AdminUpdateAthleteRequest(BaseModel):
    nombre: Optional[str] = None
    apellidos: Optional[str] = None
    telefono: Optional[str] = None
    sexo: Optional[str] = None
    nacionalidad: Optional[str] = None


@router.post("/admin/verify-account/{athlete_id}")
async def admin_verify_account(athlete_id: str, authorization: str = Header(None)):
    """Admin: Activate (verify) an athlete account."""
    from server import db as database
    from bson import ObjectId

    _verify_admin_token(authorization)

    try:
        oid = ObjectId(athlete_id)
    except Exception:
        raise HTTPException(status_code=400, detail="ID inválido")

    athlete = await database.athletes.find_one({"_id": oid})
    if not athlete:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")

    await database.athletes.update_one(
        {"_id": oid},
        {"$set": {
            "email_verified": True,
            "verification_code": None,
            "verification_code_expires": None,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    return {"success": True, "message": "Cuenta activada", "email_verified": True}


@router.post("/admin/set-password/{athlete_id}")
async def admin_set_password(athlete_id: str, data: AdminSetPasswordRequest, authorization: str = Header(None)):
    """Admin: Set a new password for an athlete account (also activates it)."""
    from server import db as database
    from bson import ObjectId

    _verify_admin_token(authorization)

    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 6 caracteres")

    try:
        oid = ObjectId(athlete_id)
    except Exception:
        raise HTTPException(status_code=400, detail="ID inválido")

    athlete = await database.athletes.find_one({"_id": oid})
    if not athlete:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")

    await database.athletes.update_one(
        {"_id": oid},
        {"$set": {
            "password_hash": hash_password(data.new_password),
            "email_verified": True,
            "reset_code": None,
            "reset_code_expires": None,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    return {"success": True, "message": "Contraseña actualizada"}


@router.put("/admin/athlete-profile/{athlete_id}")
async def admin_update_athlete_profile(
    athlete_id: str,
    data: AdminUpdateAthleteRequest,
    authorization: str = Header(None),
):
    """Admin: Edit basic data (name, phone, sex, country) of an athlete profile."""
    from server import db as database
    from bson import ObjectId

    _verify_admin_token(authorization)

    try:
        oid = ObjectId(athlete_id)
    except Exception:
        raise HTTPException(status_code=400, detail="ID inválido")

    athlete = await database.athletes.find_one({"_id": oid})
    if not athlete:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")

    update_data = {}
    for field in ("nombre", "apellidos", "telefono", "sexo", "nacionalidad"):
        value = getattr(data, field, None)
        if value is not None:
            update_data[field] = value.strip()

    if not update_data:
        raise HTTPException(status_code=400, detail="No hay datos para actualizar")

    if "nombre" in update_data and not update_data["nombre"]:
        raise HTTPException(status_code=400, detail="El nombre no puede quedar vacío")
    if "apellidos" in update_data and not update_data["apellidos"]:
        raise HTTPException(status_code=400, detail="Los apellidos no pueden quedar vacíos")
    if update_data.get("sexo") and update_data["sexo"] not in ("Masculino", "Femenino"):
        raise HTTPException(status_code=400, detail="Sexo inválido")

    update_data["updated_at"] = datetime.now(timezone.utc)
    await database.athletes.update_one({"_id": oid}, {"$set": update_data})

    return {"success": True, "message": "Perfil actualizado"}


# ==================== ADMIN: EMAIL COMPOSER ====================

class EmailRecipientFilter(BaseModel):
    filter_type: str  # 'all_athletes', 'inscribed', 'not_inscribed', 'volunteers', 'manual'
    race_code: Optional[str] = None
    manual_emails: Optional[list] = None

class AdminEmailRequest(BaseModel):
    subject: str
    content: str
    recipients: EmailRecipientFilter
    plain_text: bool = False

class AdminEmailPreviewRequest(BaseModel):
    subject: str
    content: str
    plain_text: bool = False


@router.post("/admin/email-recipients")
async def admin_get_email_recipients(data: EmailRecipientFilter, authorization: str = Header(None)):
    """Admin: Get list of email recipients based on filter"""
    from server import db as database

    _verify_email_admin(authorization)

    recipients = []

    if data.filter_type == "manual":
        for email in (data.manual_emails or []):
            email = email.strip().lower()
            if email:
                recipients.append({
                    "email": email, "nombre": "", "apellidos": "",
                    "nombre_completo": "", "source": "manual"
                })
        return {"recipients": recipients, "total": len(recipients)}

    if data.filter_type == "volunteers":
        vols = await database.volunteers.find(
            {}, {"_id": 0, "email": 1, "nombre": 1, "apellidos": 1}
        ).to_list(500)
        for v in vols:
            if v.get("email"):
                nombre = v.get("nombre", "") or ""
                apellidos = v.get("apellidos", "") or ""
                recipients.append({
                    "email": v["email"],
                    "nombre": nombre,
                    "apellidos": apellidos,
                    "nombre_completo": f"{nombre} {apellidos}".strip(),
                    "source": "voluntario"
                })
        return {"recipients": recipients, "total": len(recipients)}

    # Athletes-based filters
    athletes = await database.athletes.find(
        {}, {"_id": 1, "email": 1, "nombre": 1, "apellidos": 1}
    ).sort("_id", 1).to_list(500)

    def build_athlete(a, source):
        nombre = a.get("nombre", "") or ""
        apellidos = a.get("apellidos", "") or ""
        return {
            "email": a["email"],
            "nombre": nombre,
            "apellidos": apellidos,
            "nombre_completo": f"{nombre} {apellidos}".strip(),
            "source": source
        }

    if data.filter_type == "all_athletes":
        for a in athletes:
            recipients.append(build_athlete(a, "atleta"))
    elif data.filter_type in ("inscribed", "not_inscribed"):
        query = {"race_code": data.race_code} if data.race_code else {}
        regs = await database.registrations.find(query, {"athlete_id": 1}).to_list(1000)
        inscribed_ids = {r["athlete_id"] for r in regs if r.get("athlete_id")}

        for a in athletes:
            aid = str(a["_id"])
            is_inscribed = aid in inscribed_ids
            if (data.filter_type == "inscribed" and is_inscribed) or \
               (data.filter_type == "not_inscribed" and not is_inscribed):
                recipients.append(build_athlete(a, "inscrito" if is_inscribed else "no inscrito"))

    return {"recipients": recipients, "total": len(recipients)}


def _personalize_email(text: str, recipient: dict, escape: bool = True) -> str:
    """Substitute merge variables with recipient data. Longer tags first to avoid partial matches.

    El nombre lo escribe el propio atleta al inscribirse, asi que se escapa
    antes de meterlo en el HTML del correo. El asunto va como cabecera de texto
    plano: ahi se pasa escape=False.
    """
    if not text:
        return text
    replacements = [
        ("{{nombre_completo}}", recipient.get("nombre_completo", "") or ""),
        ("{{apellidos}}", recipient.get("apellidos", "") or ""),
        ("{{nombre}}", recipient.get("nombre", "") or ""),
        ("{{email}}", recipient.get("email", "") or ""),
    ]
    for tag, value in replacements:
        text = text.replace(tag, html.escape(str(value), quote=True) if escape else str(value))
    return text


def _wrap_email_html(subject: str, content: str) -> str:
    return f"""
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: linear-gradient(135deg, #ea580c 0%, #f97316 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 22px;">{subject}</h1>
    </div>
    <div style="padding: 30px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none; color: #374151; line-height: 1.6;">
        {content}
    </div>
    <div style="background: #1f2937; padding: 20px; text-align: center; border-radius: 0 0 10px 10px;">
        <p style="color: #9ca3af; margin: 0; font-size: 12px;">Backyard Ultra Santo Domingo</p>
    </div>
</div>
"""


def _html_to_plain(html: str) -> str:
    """Convert simple HTML (from the WYSIWYG editor) to readable plain text."""
    if not html:
        return ""
    text = html
    # Block/break elements -> newlines
    text = re.sub(r'(?i)<\s*br\s*/?\s*>', '\n', text)
    text = re.sub(r'(?i)</\s*(p|div|h[1-6])\s*>', '\n', text)
    text = re.sub(r'(?i)<\s*li[^>]*>', '\n- ', text)
    text = re.sub(r'(?i)</\s*(ul|ol)\s*>', '\n', text)
    # Strip all remaining tags
    text = re.sub(r'<[^>]+>', '', text)
    # Decode common HTML entities
    replacements = {'&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'"}
    for ent, char in replacements.items():
        text = text.replace(ent, char)
    # Collapse excessive blank lines
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


@router.post("/admin/email-preview")
async def admin_preview_email(data: AdminEmailPreviewRequest, authorization: str = Header(None)):
    """Admin: Preview email as it would appear (with sample variable values)"""
    _verify_email_admin(authorization)

    # Sample recipient so the admin sees how merge variables render
    sample = {
        "nombre": "Juan",
        "apellidos": "Pérez",
        "nombre_completo": "Juan Pérez",
        "email": "juan.perez@ejemplo.com",
    }
    preview_subject = _personalize_email(data.subject, sample, escape=False)
    preview_content = _personalize_email(data.content, sample)

    if data.plain_text:
        plain = _html_to_plain(preview_content)
        # Wrap in <pre> just for on-screen display (the real email is plain text)
        html = f'<div style="padding:24px;font-family:monospace;white-space:pre-wrap;color:#1f2937;font-size:14px;">{plain}</div>'
        return {"html": html, "subject": preview_subject, "plain_text": True}

    html = _wrap_email_html(preview_subject, preview_content)
    return {"html": html, "subject": preview_subject}


@router.post("/admin/send-email")
async def admin_send_email(data: AdminEmailRequest, authorization: str = Header(None)):
    """Admin: Send personalized email to filtered recipients"""
    import asyncio
    from server import db as database
    from services.template_email_service import send_bulk_emails_sync

    _verify_email_admin(authorization)

    # Get recipients
    recipients_resp = await admin_get_email_recipients(data.recipients, authorization)
    recipients = recipients_resp["recipients"]

    if not recipients:
        raise HTTPException(status_code=400, detail="No hay destinatarios")

    # Build per-recipient personalized messages
    messages = []
    recipient_by_email = {}
    for r in recipients:
        personalized_subject = _personalize_email(data.subject, r, escape=False)
        personalized_content = _personalize_email(data.content, r)
        if data.plain_text:
            body = _html_to_plain(personalized_content)
        else:
            body = _wrap_email_html(personalized_subject, personalized_content)
        messages.append({"to_email": r["email"], "subject": personalized_subject, "body": body})
        recipient_by_email[r["email"]] = r

    # Send using a single SMTP connection (avoids Gmail login throttling) in a worker thread
    send_results = await asyncio.to_thread(send_bulk_emails_sync, messages, data.plain_text)

    sent = sum(1 for x in send_results if x["success"])
    failed = len(send_results) - sent

    # Enrich results with recipient name for the CSV
    results = []
    for x in send_results:
        r = recipient_by_email.get(x["email"], {})
        results.append({
            "email": x["email"],
            "nombre_completo": r.get("nombre_completo", ""),
            "success": x["success"],
            "error": x["error"],
        })

    # Log the send
    await database.email_log.insert_one({
        "subject": data.subject,
        "filter_type": data.recipients.filter_type,
        "race_code": data.recipients.race_code,
        "plain_text": data.plain_text,
        "total_recipients": len(recipients),
        "sent": sent,
        "failed": failed,
        "sent_at": datetime.now(timezone.utc),
    })

    return {"success": True, "sent": sent, "failed": failed, "total": len(recipients), "results": results}


@router.get("/admin/email-history")
async def admin_email_history(authorization: str = Header(None)):
    """Admin: Get history of mass email sends (most recent first)."""
    from server import db as database

    _verify_email_admin(authorization)

    FILTER_LABELS = {
        "all_athletes": "Todos los atletas",
        "inscribed": "Inscritos a carrera",
        "not_inscribed": "No inscritos",
        "volunteers": "Voluntarios",
        "manual": "Correos específicos",
    }

    logs = await database.email_log.find({}).sort("sent_at", -1).to_list(100)
    history = []
    for log in logs:
        sent_at = log.get("sent_at")
        history.append({
            "subject": log.get("subject", ""),
            "filter_type": log.get("filter_type", ""),
            "filter_label": FILTER_LABELS.get(log.get("filter_type", ""), log.get("filter_type", "")),
            "plain_text": log.get("plain_text", False),
            "total_recipients": log.get("total_recipients", 0),
            "sent": log.get("sent", 0),
            "failed": log.get("failed", 0),
            "sent_at": sent_at.isoformat() if hasattr(sent_at, "isoformat") else sent_at,
        })
    return {"history": history}


# ==================== ADMIN: WHATSAPP COMPOSER ====================

class WhatsAppRecipientFilter(BaseModel):
    filter_type: str  # 'all_athletes', 'inscribed', 'waitlist', 'not_inscribed', 'volunteers', 'manual'
    race_code: Optional[str] = None
    manual_entries: Optional[list] = None  # líneas "teléfono, nombre, apellidos, correo"


def _whatsapp_phone_digits(telefono: Optional[str]) -> str:
    """Normaliza un teléfono al formato de solo dígitos que exige api.whatsapp.com/send?phone=.

    Devuelve cadena vacía si el número no parece utilizable.
    """
    digits = re.sub(r"\D", "", telefono or "")
    # Prefijo internacional escrito como 00
    if digits.startswith("00"):
        digits = digits[2:]
    # Números dominicanos de 10 dígitos: anteponer el código de país (1)
    if len(digits) == 10 and digits[:3] in ("809", "829", "849"):
        digits = "1" + digits
    if 8 <= len(digits) <= 15:
        return digits
    return ""


@router.post("/admin/whatsapp-recipients")
async def admin_get_whatsapp_recipients(data: WhatsAppRecipientFilter, authorization: str = Header(None)):
    """Admin: destinatarios (con teléfono) para envíos manuales por WhatsApp."""
    from server import db as database

    _verify_email_admin(authorization)

    def build_recipient(doc, source):
        nombre = doc.get("nombre", "") or ""
        apellidos = doc.get("apellidos", "") or ""
        telefono = doc.get("telefono", "") or ""
        return {
            "email": doc.get("email", "") or "",
            "nombre": nombre,
            "apellidos": apellidos,
            "nombre_completo": f"{nombre} {apellidos}".strip(),
            "telefono": telefono,
            "whatsapp_phone": _whatsapp_phone_digits(telefono),
            "source": source,
        }

    recipients = []

    if data.filter_type == "manual":
        # Cada línea empieza con el teléfono; los campos siguientes (separados por
        # coma, punto y coma o tabulador, p. ej. pegados desde Excel) son nombre,
        # apellidos y correo. El correo se detecta por la @ en cualquier posición.
        for line in (data.manual_entries or [])[:500]:
            if not isinstance(line, str):
                continue
            tokens = [t.strip() for t in re.split(r"[\t;,]", line) if t.strip()]
            if not tokens:
                continue
            telefono = tokens[0]
            email = ""
            names = []
            for tok in tokens[1:]:
                if "@" in tok and not email:
                    email = tok.lower()
                else:
                    names.append(tok)
            nombre = names[0] if names else ""
            apellidos = " ".join(names[1:])
            recipients.append({
                "email": email,
                "nombre": nombre,
                "apellidos": apellidos,
                "nombre_completo": f"{nombre} {apellidos}".strip(),
                "telefono": telefono,
                "whatsapp_phone": _whatsapp_phone_digits(telefono),
                "source": "manual",
            })
    elif data.filter_type == "volunteers":
        vols = await database.volunteers.find(
            {}, {"_id": 0, "email": 1, "nombre": 1, "apellidos": 1, "telefono": 1}
        ).to_list(500)
        recipients = [build_recipient(v, "voluntario") for v in vols]
    else:
        athletes = await database.athletes.find(
            {}, {"_id": 1, "email": 1, "nombre": 1, "apellidos": 1, "telefono": 1}
        ).sort("_id", 1).to_list(500)

        if data.filter_type == "all_athletes":
            recipients = [build_recipient(a, "atleta") for a in athletes]
        elif data.filter_type in ("inscribed", "waitlist", "not_inscribed"):
            query = {"race_code": data.race_code} if data.race_code else {}
            if data.filter_type == "inscribed":
                query["status"] = {"$nin": ["cancelled", "waitlist"]}
            elif data.filter_type == "waitlist":
                query["status"] = "waitlist"
            else:  # not_inscribed: se excluyen las inscripciones canceladas
                query["status"] = {"$ne": "cancelled"}
            regs = await database.registrations.find(query, {"athlete_id": 1}).to_list(1000)
            matched_ids = {r["athlete_id"] for r in regs if r.get("athlete_id")}

            source_labels = {
                "inscribed": "inscrito",
                "waitlist": "lista de espera",
                "not_inscribed": "no inscrito",
            }
            for a in athletes:
                is_match = str(a["_id"]) in matched_ids
                if data.filter_type == "not_inscribed":
                    is_match = not is_match
                if is_match:
                    recipients.append(build_recipient(a, source_labels[data.filter_type]))
        else:
            raise HTTPException(status_code=400, detail="Filtro inválido")

    with_phone = sum(1 for r in recipients if r["whatsapp_phone"])
    return {
        "recipients": recipients,
        "total": len(recipients),
        "with_phone": with_phone,
        "without_phone": len(recipients) - with_phone,
    }
