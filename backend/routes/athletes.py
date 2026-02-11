"""
Athletes authentication and profile management
"""
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import secrets
import hashlib
import jwt
import os
import random

router = APIRouter(prefix="/athletes", tags=["athletes"])

# JWT Secret for athletes (different from admin)
ATHLETE_JWT_SECRET = os.environ.get("JWT_SECRET", "backyard-ultra-secret-2024") + "-athletes"
ATHLETE_JWT_ALGORITHM = "HS256"
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
    genero: Optional[str] = None
    pais: Optional[str] = None
    ciudad: Optional[str] = None
    contacto_emergencia_nombre: Optional[str] = None
    contacto_emergencia_telefono: Optional[str] = None

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

class UpdateProfileRequest(BaseModel):
    nombre: Optional[str] = None
    apellidos: Optional[str] = None
    telefono: Optional[str] = None
    fecha_nacimiento: Optional[str] = None
    genero: Optional[str] = None
    pais: Optional[str] = None
    ciudad: Optional[str] = None
    contacto_emergencia_nombre: Optional[str] = None
    contacto_emergencia_telefono: Optional[str] = None

class RaceRegistrationRequest(BaseModel):
    race_code: str
    categoria: Optional[str] = None
    talla_camiseta: Optional[str] = None
    club: Optional[str] = None
    condiciones_medicas: Optional[str] = None
    acepta_terminos: bool = False

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
        return new_hash.hex() == pwd_hash
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
    """Generate 6-digit verification code"""
    return str(random.randint(100000, 999999))


# Dependency to get current athlete
async def get_current_athlete(authorization: str = Header(None)):
    """Extract and verify athlete from Authorization header"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No autorizado")
    
    token = authorization.replace("Bearer ", "")
    return verify_athlete_token(token)


# ==================== AUTHENTICATION ENDPOINTS ====================

@router.post("/register")
async def register_athlete(data: AthleteRegisterRequest):
    """Register a new athlete profile"""
    from server import db as database
    
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
        "genero": data.genero,
        "pais": data.pais,
        "ciudad": data.ciudad,
        "contacto_emergencia_nombre": data.contacto_emergencia_nombre,
        "contacto_emergencia_telefono": data.contacto_emergencia_telefono,
        "email_verified": False,
        "verification_code": verification_code,
        "verification_code_expires": code_expires,
        "claimed_results": [],  # IDs of claimed historical results
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    result = await database.athletes.insert_one(athlete_doc)
    
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
async def verify_email(data: VerifyEmailRequest):
    """Verify email with code"""
    from server import db as database
    
    athlete = await database.athletes.find_one({"email": data.email.lower()})
    if not athlete:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    
    if athlete.get("email_verified"):
        return {"success": True, "message": "Email ya verificado"}
    
    # Check code
    stored_code = athlete.get("verification_code")
    code_expires = athlete.get("verification_code_expires")
    
    if not stored_code or stored_code != data.code:
        raise HTTPException(status_code=400, detail="Código incorrecto")
    
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
async def resend_verification_code(data: ForgotPasswordRequest):
    """Resend verification code"""
    from server import db as database
    
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
                "verification_code_expires": code_expires
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
async def login_athlete(data: AthleteLoginRequest):
    """Login athlete"""
    from server import db as database
    
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
                    "verification_code_expires": code_expires
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
async def forgot_password(data: ForgotPasswordRequest):
    """Request password reset"""
    from server import db as database
    
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
                "reset_code_expires": code_expires
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
            "reset_code": reset_code,
            "expires_minutes": str(CODE_EXPIRATION_MINUTES)
        }
        
        await send_email_with_template(
            database,
            "password_reset",
            data.email,
            email_data
        )
    except Exception as e:
        print(f"Error sending reset email: {e}")
    
    return {"success": True, "message": "Si el correo existe, recibirás un código"}


@router.post("/reset-password")
async def reset_password(data: ResetPasswordRequest):
    """Reset password with code"""
    from server import db as database
    
    athlete = await database.athletes.find_one({"email": data.email.lower()})
    if not athlete:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    
    # Check code
    stored_code = athlete.get("reset_code")
    code_expires = athlete.get("reset_code_expires")
    
    if not stored_code or stored_code != data.code:
        raise HTTPException(status_code=400, detail="Código incorrecto")
    
    if code_expires and datetime.now(timezone.utc) > code_expires:
        raise HTTPException(status_code=400, detail="Código expirado")
    
    # Update password
    await database.athletes.update_one(
        {"_id": athlete["_id"]},
        {
            "$set": {
                "password_hash": hash_password(data.new_password),
                "reset_code": None,
                "reset_code_expires": None,
                "email_verified": True,  # Also verify email
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    return {"success": True, "message": "Contraseña actualizada"}


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
        "genero": athlete.get("genero"),
        "pais": athlete.get("pais"),
        "ciudad": athlete.get("ciudad"),
        "contacto_emergencia_nombre": athlete.get("contacto_emergencia_nombre"),
        "contacto_emergencia_telefono": athlete.get("contacto_emergencia_telefono"),
        "email_verified": athlete.get("email_verified", False),
        "claimed_results": athlete.get("claimed_results", []),
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
    
    for field in ["nombre", "apellidos", "telefono", "fecha_nacimiento", 
                  "genero", "pais", "ciudad", "contacto_emergencia_nombre",
                  "contacto_emergencia_telefono"]:
        value = getattr(data, field, None)
        if value is not None:
            update_data[field] = value
    
    await database.athletes.update_one(
        {"_id": ObjectId(athlete_id)},
        {"$set": update_data}
    )
    
    return {"success": True, "message": "Perfil actualizado"}


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
        
        result.append({
            "registration_id": str(reg["_id"]),
            "race_code": race_code,
            "race_name": race_config.get("name") if race_config else race_code,
            "race_date": race_config.get("race_date") if race_config else None,
            "bib": reg.get("bib"),
            "categoria": reg.get("categoria"),
            "status": reg.get("status", "registered"),
            "payment_status": reg.get("payment_status", "pending"),
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
    
    # Create registration
    registration_doc = {
        "athlete_id": athlete_id,
        "race_code": data.race_code,
        "email": athlete["email"],
        "nombre": athlete["nombre"],
        "apellidos": athlete["apellidos"],
        "telefono": athlete.get("telefono"),
        "bib": str(next_bib).zfill(3),
        "categoria": data.categoria,
        "talla_camiseta": data.talla_camiseta,
        "club": data.club,
        "condiciones_medicas": data.condiciones_medicas,
        "status": "registered",
        "payment_status": "pending",
        "laps_completed": 0,
        "acepta_terminos": data.acepta_terminos,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await database.registrations.insert_one(registration_doc)
    
    return {
        "success": True,
        "message": "Inscripción realizada",
        "bib": registration_doc["bib"]
    }


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


@router.get("/race-history")
async def get_race_history(authorization: str = Header(None)):
    """Get athlete's race history including claimed results"""
    from server import db as database
    from bson import ObjectId
    
    payload = await get_current_athlete(authorization)
    athlete_id = payload["athlete_id"]
    
    # Get athlete
    athlete = await database.athletes.find_one({"_id": ObjectId(athlete_id)})
    if not athlete:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")
    
    # Get own registrations with completed status
    own_registrations = await database.registrations.find({
        "$or": [
            {"athlete_id": athlete_id},
            {"email": athlete["email"]}
        ],
        "status": {"$in": ["retired", "winner", "finished", "dns"]}
    }).to_list(100)
    
    # Get claimed historical results from all collections
    claimed_ids = athlete.get("claimed_results", [])
    claimed_results = []
    if claimed_ids:
        try:
            object_ids = [ObjectId(cid) for cid in claimed_ids]
            # Search in archived_participants
            archived = await database.archived_participants.find({
                "_id": {"$in": object_ids}
            }).to_list(100)
            claimed_results.extend(archived)
            
            # Search in participants
            legacy = await database.participants.find({
                "_id": {"$in": object_ids}
            }).to_list(100)
            claimed_results.extend(legacy)
            
            # Search in registrations
            reg_claimed = await database.registrations.find({
                "_id": {"$in": object_ids}
            }).to_list(100)
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
    
    # Format
    history = []
    for reg in unique_results:
        race_code = reg.get("race_code", "BYSD-2026")
        race_config = await database.race_configurations.find_one({"code": race_code})
        
        history.append({
            "registration_id": str(reg["_id"]),
            "race_code": race_code,
            "race_name": race_config.get("name") if race_config else race_code,
            "race_date": race_config.get("race_date") if race_config else None,
            "bib": reg.get("bib"),
            "laps_completed": reg.get("laps_completed", 0),
            "status": reg.get("status"),
            "final_position": reg.get("final_position"),
            "is_claimed": reg.get("claimed_by") == athlete_id
        })
    
    # Sort by date descending
    history.sort(key=lambda x: x.get("race_date") or "", reverse=True)
    
    return {"history": history}
