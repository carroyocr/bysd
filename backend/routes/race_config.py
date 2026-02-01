from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Header
from fastapi.responses import FileResponse
from typing import Optional
from pydantic import BaseModel
from datetime import datetime
import os
import shutil
from pathlib import Path

router = APIRouter(prefix="/api/race-config", tags=["race-config"])

# Directory for uploaded logos and manuals
LOGOS_DIR = Path(__file__).parent.parent / "static" / "logos"
LOGOS_DIR.mkdir(parents=True, exist_ok=True)

MANUALS_DIR = Path(__file__).parent.parent / "static" / "manuals"
MANUALS_DIR.mkdir(parents=True, exist_ok=True)

# JWT verification (reuse from race.py)
import jwt
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "backyard-ultra-secret-2026")
ALGORITHM = "HS256"

async def verify_token(authorization: str = Header(...)):
    """Verify JWT token from Authorization header"""
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")


class PaymentInfoModel(BaseModel):
    account_name: Optional[str] = None
    account_id: Optional[str] = None  # Identificación/Cédula
    bank_name: Optional[str] = None
    account_type: Optional[str] = None  # Ahorro, Corriente
    account_number: Optional[str] = None


class RaceConfigCreate(BaseModel):
    code: str  # e.g., "BYSD-2026"
    name: str  # e.g., "Backyard Ultra Santo Domingo 2026"
    date: str  # e.g., "2026-01-24"
    start_time: str  # e.g., "09:00"
    location: str  # e.g., "Parque del Este, Santo Domingo"
    is_active: bool = True
    registration_cost: float = 3500.0  # Cost in local currency (RD$)
    edition_number: int = 1  # Edition number (1 = Primera, 2 = Segunda, etc.)


class RaceConfigUpdate(BaseModel):
    name: Optional[str] = None
    date: Optional[str] = None
    start_time: Optional[str] = None
    location: Optional[str] = None
    logo_url: Optional[str] = None
    registration_cost: Optional[float] = None
    edition_number: Optional[int] = None
    # Payment info
    payment_account_name: Optional[str] = None
    payment_account_id: Optional[str] = None
    payment_bank_name: Optional[str] = None
    payment_account_type: Optional[str] = None
    payment_account_number: Optional[str] = None


@router.get("/active")
async def get_active_race(db=Depends(lambda: None)):
    """Get the currently active race configuration"""
    from server import db as database
    
    config = await database.race_configurations.find_one(
        {"is_active": True}, 
        {"_id": 0}
    )
    
    if not config:
        # Return default values if no active race is configured
        return {
            "code": "BYSD-2026",
            "name": "Backyard Ultra Santo Domingo 2026",
            "date": "2026-01-24",
            "start_time": "09:00",
            "location": "Parque del Este, Santo Domingo, República Dominicana",
            "logo_url": "/icon-bu.png",
            "is_active": True,
            "is_default": True,
            "registration_cost": 3500.0,
            "edition_number": 1
        }
    
    # Ensure defaults for new fields if not present
    if "registration_cost" not in config:
        config["registration_cost"] = 3500.0
    if "edition_number" not in config:
        config["edition_number"] = 1
    
    return config


@router.get("/all")
async def get_all_races(db=Depends(lambda: None)):
    """Get all race configurations (active and archived)"""
    from server import db as database
    
    races = await database.race_configurations.find(
        {}, 
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Ensure legacy race BYSD-2026 is always included for historical results
    LEGACY_RACES = [
        {
            "code": "BYSD-2026",
            "name": "Backyard Ultra Santo Domingo 2026",
            "date": "2026-01-24",
            "start_time": "09:00",
            "location": "Parque del Este, Santo Domingo, República Dominicana",
            "logo_url": "/icon-bu.png",
            "is_active": False,
            "is_legacy": True,  # Flag to indicate this uses legacy data
            "archived_at": "2026-01-25T00:00:00"
        }
    ]
    
    # Add legacy races if not already in the list
    existing_codes = {r.get("code") for r in races}
    for legacy_race in LEGACY_RACES:
        if legacy_race["code"] not in existing_codes:
            races.append(legacy_race)
    
    # Sort by date descending
    races.sort(key=lambda x: x.get("date", ""), reverse=True)
    
    return {"races": races}


@router.get("/{code}")
async def get_race_by_code(code: str, db=Depends(lambda: None)):
    """Get a specific race configuration by code"""
    from server import db as database
    
    config = await database.race_configurations.find_one(
        {"code": code}, 
        {"_id": 0}
    )
    
    # If not found in DB, check if it's a legacy race
    if not config:
        LEGACY_RACES = {
            "BYSD-2026": {
                "code": "BYSD-2026",
                "name": "Backyard Ultra Santo Domingo 2026",
                "date": "2026-01-24",
                "start_time": "09:00",
                "location": "Parque del Este, Santo Domingo, República Dominicana",
                "logo_url": "/icon-bu.png",
                "is_active": False,
                "is_legacy": True,
                "archived_at": "2026-01-25T00:00:00"
            }
        }
        
        if code in LEGACY_RACES:
            return LEGACY_RACES[code]
        
        raise HTTPException(status_code=404, detail="Carrera no encontrada")
    
    return config


@router.post("/create")
async def create_race(
    config: RaceConfigCreate,
    user=Depends(verify_token),
    db=Depends(lambda: None)
):
    """Create a new race configuration. If is_active=True, archives the previous active race."""
    from server import db as database
    
    # Check if code already exists
    existing = await database.race_configurations.find_one({"code": config.code})
    if existing:
        raise HTTPException(status_code=400, detail=f"Ya existe una carrera con el código {config.code}")
    
    # If this race is active, archive all other active races
    if config.is_active:
        await database.race_configurations.update_many(
            {"is_active": True},
            {"$set": {"is_active": False, "archived_at": datetime.utcnow()}}
        )
    
    # Create the new race
    race_data = {
        **config.dict(),
        "logo_url": "/icon-bu.png",  # Default logo
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await database.race_configurations.insert_one(race_data)
    
    # Remove _id from response
    race_data.pop("_id", None)
    
    return {
        "message": f"Carrera '{config.name}' creada exitosamente",
        "race": race_data
    }


@router.put("/update/{code}")
async def update_race(
    code: str,
    config: RaceConfigUpdate,
    user=Depends(verify_token),
    db=Depends(lambda: None)
):
    """Update a race configuration"""
    from server import db as database
    
    existing = await database.race_configurations.find_one({"code": code})
    if not existing:
        raise HTTPException(status_code=404, detail="Carrera no encontrada")
    
    # Build update data
    update_data = {"updated_at": datetime.utcnow()}
    for field, value in config.dict(exclude_unset=True).items():
        if value is not None:
            update_data[field] = value
    
    await database.race_configurations.update_one(
        {"code": code},
        {"$set": update_data}
    )
    
    updated = await database.race_configurations.find_one({"code": code}, {"_id": 0})
    
    return {
        "message": f"Carrera '{code}' actualizada",
        "race": updated
    }


@router.post("/activate/{code}")
async def activate_race(
    code: str,
    user=Depends(verify_token),
    db=Depends(lambda: None)
):
    """Set a race as the active one (archives the previous active race)"""
    from server import db as database
    
    existing = await database.race_configurations.find_one({"code": code})
    if not existing:
        raise HTTPException(status_code=404, detail="Carrera no encontrada")
    
    # Archive all other active races
    await database.race_configurations.update_many(
        {"is_active": True},
        {"$set": {"is_active": False, "archived_at": datetime.utcnow()}}
    )
    
    # Activate this race
    await database.race_configurations.update_one(
        {"code": code},
        {"$set": {"is_active": True, "updated_at": datetime.utcnow()}}
    )
    
    return {"message": f"Carrera '{code}' activada"}


@router.post("/upload-logo/{code}")
async def upload_logo(
    code: str,
    file: UploadFile = File(...),
    user=Depends(verify_token),
    db=Depends(lambda: None)
):
    """Upload a logo for a race"""
    from server import db as database
    
    existing = await database.race_configurations.find_one({"code": code})
    if not existing:
        raise HTTPException(status_code=404, detail="Carrera no encontrada")
    
    # Validate file type
    allowed_types = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Tipo de archivo no permitido. Use PNG, JPG, WEBP o SVG")
    
    # Generate filename
    ext = file.filename.split(".")[-1] if "." in file.filename else "png"
    filename = f"logo_{code}.{ext}"
    filepath = LOGOS_DIR / filename
    
    # Save file
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Update database with logo URL
    logo_url = f"/api/race-config/logo/{filename}"
    await database.race_configurations.update_one(
        {"code": code},
        {"$set": {"logo_url": logo_url, "updated_at": datetime.utcnow()}}
    )
    
    return {
        "message": "Logo subido exitosamente",
        "logo_url": logo_url
    }


@router.get("/logo/{filename}")
async def get_logo(filename: str):
    """Serve a logo file"""
    filepath = LOGOS_DIR / filename
    
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Logo no encontrado")
    
    return FileResponse(filepath)


@router.post("/archive-data/{code}")
async def archive_race_data(
    code: str,
    user=Depends(verify_token),
    db=Depends(lambda: None)
):
    """Archive all data (participants, cheers, sponsors) for a race"""
    from server import db as database
    
    existing = await database.race_configurations.find_one({"code": code})
    if not existing:
        raise HTTPException(status_code=404, detail="Carrera no encontrada")
    
    # Archive participants
    participants = await database.participants.find({}).to_list(1000)
    if participants:
        for p in participants:
            p["race_code"] = code
            p.pop("_id", None)
        await database.archived_participants.insert_many(participants)
    
    # Archive cheer messages
    cheers = await database.cheer_messages.find({}).to_list(10000)
    if cheers:
        for c in cheers:
            c["race_code"] = code
            c.pop("_id", None)
        await database.archived_cheer_messages.insert_many(cheers)
    
    # Archive sponsors (if exists)
    sponsors = await database.sponsors.find({}).to_list(100)
    if sponsors:
        for s in sponsors:
            s["race_code"] = code
            s.pop("_id", None)
        await database.archived_sponsors.insert_many(sponsors)
    
    # Mark race as archived
    await database.race_configurations.update_one(
        {"code": code},
        {"$set": {"data_archived": True, "data_archived_at": datetime.utcnow()}}
    )
    
    return {
        "message": f"Datos de la carrera '{code}' archivados",
        "archived": {
            "participants": len(participants),
            "cheer_messages": len(cheers),
            "sponsors": len(sponsors)
        }
    }


@router.get("/archived/{code}/participants")
async def get_archived_participants(code: str, db=Depends(lambda: None)):
    """Get archived participants for a specific race"""
    from server import db as database
    
    participants = await database.archived_participants.find(
        {"race_code": code},
        {"_id": 0}
    ).to_list(1000)
    
    return {"participants": participants, "race_code": code}


@router.get("/archived/{code}/cheers")
async def get_archived_cheers(code: str, skip: int = 0, limit: int = 100, db=Depends(lambda: None)):
    """Get archived cheer messages for a specific race"""
    from server import db as database
    
    cheers = await database.archived_cheer_messages.find(
        {"race_code": code},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await database.archived_cheer_messages.count_documents({"race_code": code})
    
    return {"cheers": cheers, "total": total, "race_code": code}


@router.get("/archived/{code}/sponsors")
async def get_archived_sponsors(code: str, db=Depends(lambda: None)):
    """Get archived sponsors for a specific race"""
    from server import db as database
    
    sponsors = await database.archived_sponsors.find(
        {"race_code": code},
        {"_id": 0}
    ).to_list(100)
    
    return {"sponsors": sponsors, "race_code": code}


# ============== MANUAL UPLOADS ==============

@router.post("/upload-manual/{code}/{manual_type}")
async def upload_manual(
    code: str,
    manual_type: str,  # "runners" or "volunteers"
    file: UploadFile = File(...),
    user=Depends(verify_token),
    db=Depends(lambda: None)
):
    """Upload a manual (PDF) for a race - runners or volunteers"""
    from server import db as database
    
    if manual_type not in ["runners", "volunteers"]:
        raise HTTPException(status_code=400, detail="Tipo de manual inválido. Use 'runners' o 'volunteers'")
    
    existing = await database.race_configurations.find_one({"code": code})
    if not existing:
        raise HTTPException(status_code=404, detail="Carrera no encontrada")
    
    # Validate file type
    allowed_types = ["application/pdf"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Solo se permiten archivos PDF")
    
    # Generate filename
    filename = f"manual_{manual_type}_{code}.pdf"
    filepath = MANUALS_DIR / filename
    
    # Save file
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Update database with manual URL
    manual_url = f"/api/race-config/manual/{filename}"
    field_name = f"manual_{manual_type}_url"
    
    await database.race_configurations.update_one(
        {"code": code},
        {"$set": {field_name: manual_url, "updated_at": datetime.utcnow()}}
    )
    
    return {
        "message": f"Manual de {'corredores' if manual_type == 'runners' else 'voluntarios'} subido exitosamente",
        "manual_url": manual_url
    }


@router.delete("/delete-manual/{code}/{manual_type}")
async def delete_manual(
    code: str,
    manual_type: str,
    user=Depends(verify_token),
    db=Depends(lambda: None)
):
    """Delete a manual for a race"""
    from server import db as database
    
    if manual_type not in ["runners", "volunteers"]:
        raise HTTPException(status_code=400, detail="Tipo de manual inválido")
    
    existing = await database.race_configurations.find_one({"code": code})
    if not existing:
        raise HTTPException(status_code=404, detail="Carrera no encontrada")
    
    # Delete file if exists
    filename = f"manual_{manual_type}_{code}.pdf"
    filepath = MANUALS_DIR / filename
    
    if filepath.exists():
        os.remove(filepath)
    
    # Remove URL from database
    field_name = f"manual_{manual_type}_url"
    await database.race_configurations.update_one(
        {"code": code},
        {"$unset": {field_name: ""}, "$set": {"updated_at": datetime.utcnow()}}
    )
    
    return {"message": f"Manual de {'corredores' if manual_type == 'runners' else 'voluntarios'} eliminado"}


@router.get("/manual/{filename}")
async def get_manual(filename: str):
    """Serve a manual PDF file"""
    filepath = MANUALS_DIR / filename
    
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Manual no encontrado")
    
    return FileResponse(filepath, media_type="application/pdf")


@router.get("/manuals/{code}")
async def get_race_manuals(code: str, db=Depends(lambda: None)):
    """Get manual URLs for a specific race"""
    from server import db as database
    
    race = await database.race_configurations.find_one({"code": code}, {"_id": 0})
    if not race:
        raise HTTPException(status_code=404, detail="Carrera no encontrada")
    
    return {
        "runners_manual": race.get("manual_runners_url"),
        "volunteers_manual": race.get("manual_volunteers_url"),
        "race_code": code
    }



# ============== MANUAL NOTIFICATIONS ==============

@router.get("/notify-runners-count/{code}")
async def get_runners_count_for_notification(
    code: str,
    user=Depends(verify_token),
    db=Depends(lambda: None)
):
    """Get count of active runners who will receive the manual notification"""
    from server import db as database
    
    # Count active athletes for this race
    count = await database.registrations.count_documents({
        "race_code": code,
        "status": "active"
    })
    
    return {"count": count, "race_code": code}


@router.get("/notify-volunteers-count/{code}")
async def get_volunteers_count_for_notification(
    code: str,
    user=Depends(verify_token),
    db=Depends(lambda: None)
):
    """Get count of registered volunteers who will receive the manual notification"""
    from server import db as database
    
    # Count registered volunteers for this race
    count = await database.volunteer_registrations.count_documents({
        "race_code": code
    })
    
    return {"count": count, "race_code": code}


@router.post("/notify-runners-manual/{code}")
async def notify_runners_manual_available(
    code: str,
    user=Depends(verify_token),
    db=Depends(lambda: None)
):
    """Send email notification to all active runners that the manual is available"""
    from server import db as database
    from services.email_service import send_manual_notification_email
    
    # Get race config to verify manual exists
    race = await database.race_configurations.find_one({"code": code})
    if not race:
        raise HTTPException(status_code=404, detail="Carrera no encontrada")
    
    manual_url = race.get("manual_runners_url")
    if not manual_url:
        raise HTTPException(status_code=400, detail="No hay manual de corredores configurado para esta carrera")
    
    # Get all active athletes for this race
    athletes = await database.registrations.find(
        {"race_code": code, "status": "active"},
        {"_id": 0, "email": 1, "nombre": 1, "apellidos": 1}
    ).to_list(1000)
    
    if not athletes:
        raise HTTPException(status_code=400, detail="No hay atletas activos registrados para esta carrera")
    
    # Build URLs
    frontend_url = os.environ.get("FRONTEND_URL", "https://backyardultrasantodomingo.com")
    view_url = f"{frontend_url}/corredores"
    download_url = f"{frontend_url}{manual_url}"
    race_name = race.get("name", "Backyard Ultra Santo Domingo")
    
    # Send emails
    sent_count = 0
    failed_emails = []
    
    for athlete in athletes:
        email = athlete.get("email")
        if not email:
            continue
            
        nombre = f"{athlete.get('nombre', '')} {athlete.get('apellidos', '')}".strip()
        if not nombre:
            nombre = "Corredor"
        
        success = await send_manual_notification_email(
            to_email=email,
            recipient_name=nombre,
            manual_type="runners",
            race_name=race_name,
            view_url=view_url,
            download_url=download_url
        )
        
        if success:
            sent_count += 1
        else:
            failed_emails.append(email)
    
    return {
        "message": f"Notificación enviada a {sent_count} corredores",
        "sent_count": sent_count,
        "failed_count": len(failed_emails),
        "total_athletes": len(athletes)
    }


@router.post("/notify-volunteers-manual/{code}")
async def notify_volunteers_manual_available(
    code: str,
    user=Depends(verify_token),
    db=Depends(lambda: None)
):
    """Send email notification to all registered volunteers that the manual is available"""
    from server import db as database
    from services.email_service import send_manual_notification_email
    
    # Get race config to verify manual exists
    race = await database.race_configurations.find_one({"code": code})
    if not race:
        raise HTTPException(status_code=404, detail="Carrera no encontrada")
    
    manual_url = race.get("manual_volunteers_url")
    if not manual_url:
        raise HTTPException(status_code=400, detail="No hay manual de voluntarios configurado para esta carrera")
    
    # Get all registered volunteers for this race
    volunteers = await database.volunteer_registrations.find(
        {"race_code": code},
        {"_id": 0, "email": 1, "nombre": 1, "apellidos": 1}
    ).to_list(1000)
    
    if not volunteers:
        raise HTTPException(status_code=400, detail="No hay voluntarios registrados para esta carrera")
    
    # Build URLs
    frontend_url = os.environ.get("FRONTEND_URL", "https://backyardultrasantodomingo.com")
    view_url = f"{frontend_url}/voluntarios"
    download_url = f"{frontend_url}{manual_url}"
    race_name = race.get("name", "Backyard Ultra Santo Domingo")
    
    # Send emails
    sent_count = 0
    failed_emails = []
    
    for volunteer in volunteers:
        email = volunteer.get("email")
        if not email:
            continue
            
        nombre = f"{volunteer.get('nombre', '')} {volunteer.get('apellidos', '')}".strip()
        if not nombre:
            nombre = "Voluntario"
        
        success = await send_manual_notification_email(
            to_email=email,
            recipient_name=nombre,
            manual_type="volunteers",
            race_name=race_name,
            view_url=view_url,
            download_url=download_url
        )
        
        if success:
            sent_count += 1
        else:
            failed_emails.append(email)
    
    return {
        "message": f"Notificación enviada a {sent_count} voluntarios",
        "sent_count": sent_count,
        "failed_count": len(failed_emails),
        "total_volunteers": len(volunteers)
    }

