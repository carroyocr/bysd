from fastapi import APIRouter, HTTPException, Depends, Header, UploadFile, File, Form
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime, timezone
import os
import aiofiles
from pathlib import Path

router = APIRouter(prefix="/api/sponsors", tags=["sponsors"])

# Uploads directory for sponsor logos
UPLOADS_DIR = Path(__file__).parent.parent / "static" / "uploads" / "sponsors"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


class SponsorCreate(BaseModel):
    name: str
    description: str
    instagram: Optional[str] = None
    race_code: str
    order: Optional[int] = 0


class SponsorUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    instagram: Optional[str] = None
    order: Optional[int] = None
    is_active: Optional[bool] = None


def get_db():
    from server import db
    return db


@router.get("/race/{race_code}")
async def get_sponsors_by_race(race_code: str, db=Depends(get_db)):
    """Get all sponsors for a specific race"""
    sponsors = await db.sponsors.find(
        {"race_code": race_code.upper(), "is_active": True},
        {"_id": 0}
    ).sort("order", 1).to_list(100)
    
    return {"sponsors": sponsors, "race_code": race_code.upper()}


@router.get("/admin/race/{race_code}")
async def get_sponsors_admin(race_code: str, db=Depends(get_db)):
    """Get all sponsors for admin (including inactive)"""
    sponsors = await db.sponsors.find(
        {"race_code": race_code.upper()},
        {"_id": 0}
    ).sort("order", 1).to_list(100)
    
    return {"sponsors": sponsors, "race_code": race_code.upper()}


@router.post("/create")
async def create_sponsor(sponsor: SponsorCreate, db=Depends(get_db)):
    """Create a new sponsor"""
    # Check if sponsor with same name exists for this race
    existing = await db.sponsors.find_one({
        "name": sponsor.name,
        "race_code": sponsor.race_code.upper()
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un patrocinador con ese nombre para esta carrera")
    
    # Get next order number
    last_sponsor = await db.sponsors.find_one(
        {"race_code": sponsor.race_code.upper()},
        sort=[("order", -1)]
    )
    next_order = (last_sponsor.get("order", 0) + 1) if last_sponsor else 1
    
    sponsor_data = {
        "name": sponsor.name,
        "description": sponsor.description,
        "instagram": sponsor.instagram,
        "race_code": sponsor.race_code.upper(),
        "order": sponsor.order or next_order,
        "logo_url": None,
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.sponsors.insert_one(sponsor_data)
    
    # Return without _id
    sponsor_data.pop("_id", None)
    return {"message": "Patrocinador creado exitosamente", "sponsor": sponsor_data}


@router.put("/update/{sponsor_name}")
async def update_sponsor(
    sponsor_name: str,
    race_code: str,
    updates: SponsorUpdate,
    db=Depends(get_db)
):
    """Update a sponsor"""
    sponsor = await db.sponsors.find_one({
        "name": sponsor_name,
        "race_code": race_code.upper()
    })
    
    if not sponsor:
        raise HTTPException(status_code=404, detail="Patrocinador no encontrado")
    
    update_data = {k: v for k, v in updates.dict().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No se proporcionaron datos para actualizar")
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.sponsors.update_one(
        {"name": sponsor_name, "race_code": race_code.upper()},
        {"$set": update_data}
    )
    
    return {"message": "Patrocinador actualizado exitosamente"}


@router.post("/upload-logo/{sponsor_name}")
async def upload_sponsor_logo(
    sponsor_name: str,
    race_code: str,
    file: UploadFile = File(...),
    db=Depends(get_db)
):
    """Upload a logo for a sponsor"""
    sponsor = await db.sponsors.find_one({
        "name": sponsor_name,
        "race_code": race_code.upper()
    })
    
    if not sponsor:
        raise HTTPException(status_code=404, detail="Patrocinador no encontrado")
    
    # Validate file type
    allowed_types = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Tipo de archivo no permitido. Use PNG, JPG, WEBP o SVG")
    
    # Create filename
    ext = file.filename.split(".")[-1] if "." in file.filename else "png"
    safe_name = sponsor_name.lower().replace(" ", "-").replace(".", "")
    filename = f"{race_code.upper()}_{safe_name}.{ext}"
    filepath = UPLOADS_DIR / filename
    
    # Save file
    async with aiofiles.open(filepath, 'wb') as f:
        content = await file.read()
        await f.write(content)
    
    # Update sponsor with logo URL
    logo_url = f"/static/uploads/sponsors/{filename}"
    await db.sponsors.update_one(
        {"name": sponsor_name, "race_code": race_code.upper()},
        {"$set": {"logo_url": logo_url, "updated_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": "Logo subido exitosamente", "logo_url": logo_url}


@router.delete("/delete/{sponsor_name}")
async def delete_sponsor(sponsor_name: str, race_code: str, db=Depends(get_db)):
    """Delete a sponsor (soft delete - sets is_active to false)"""
    result = await db.sponsors.update_one(
        {"name": sponsor_name, "race_code": race_code.upper()},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc)}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Patrocinador no encontrado")
    
    return {"message": "Patrocinador eliminado exitosamente"}


@router.delete("/hard-delete/{sponsor_name}")
async def hard_delete_sponsor(sponsor_name: str, race_code: str, db=Depends(get_db)):
    """Permanently delete a sponsor"""
    result = await db.sponsors.delete_one({
        "name": sponsor_name,
        "race_code": race_code.upper()
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Patrocinador no encontrado")
    
    return {"message": "Patrocinador eliminado permanentemente"}


@router.post("/reorder")
async def reorder_sponsors(
    race_code: str,
    sponsor_orders: List[dict],  # [{"name": "Sponsor1", "order": 1}, ...]
    db=Depends(get_db)
):
    """Reorder sponsors for a race"""
    for item in sponsor_orders:
        await db.sponsors.update_one(
            {"name": item["name"], "race_code": race_code.upper()},
            {"$set": {"order": item["order"], "updated_at": datetime.now(timezone.utc)}}
        )
    
    return {"message": "Orden actualizado exitosamente"}
