from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Header
from fastapi.responses import FileResponse
from typing import Optional
from pydantic import BaseModel
from datetime import datetime
import os
import shutil
from pathlib import Path

router = APIRouter(prefix="/api/race-config", tags=["race-config"])

# Directory for uploaded logos
LOGOS_DIR = Path(__file__).parent.parent / "static" / "logos"
LOGOS_DIR.mkdir(parents=True, exist_ok=True)

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


class RaceConfigCreate(BaseModel):
    code: str  # e.g., "BYSD-2026"
    name: str  # e.g., "Backyard Ultra Santo Domingo 2026"
    date: str  # e.g., "2026-01-24"
    start_time: str  # e.g., "09:00"
    location: str  # e.g., "Parque del Este, Santo Domingo"
    is_active: bool = True


class RaceConfigUpdate(BaseModel):
    name: Optional[str] = None
    date: Optional[str] = None
    start_time: Optional[str] = None
    location: Optional[str] = None
    logo_url: Optional[str] = None


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
            "is_default": True
        }
    
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
    
    if not config:
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
