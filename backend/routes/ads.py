"""Banners publicitarios del pie de BYSD Live.

CRUD protegido con el permiso "sponsors" (quien administra patrocinadores
administra tambien la publicidad). El listado publico solo expone lo que el
banner necesita para pintarse; las metricas (impresiones/clics) se acumulan
con endpoints publicos ligeros que no revelan nada.
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from typing import Optional
from pydantic import BaseModel, Field
from datetime import datetime, timezone
import uuid

from services.auth import require_permission

router = APIRouter(prefix="/api/ads", tags=["ads"])

solo_sponsors = Depends(require_permission("sponsors"))

# Solo estos campos salen al publico; las metricas y fechas son del panel.
PUBLIC_FIELDS = {
    "_id": 0, "id": 1, "name": 1, "text": 1, "link_url": 1,
    "logo_url": 1, "weight": 1, "order": 1,
}


def get_db():
    from server import db
    return db


async def _active_race_code(database) -> Optional[str]:
    from routes.race import get_active_race_code
    return await get_active_race_code(database)


class BannerCreate(BaseModel):
    name: str
    text: Optional[str] = None
    link_url: Optional[str] = None
    race_code: str
    weight: int = Field(default=1, ge=1, le=10)
    start_at: Optional[str] = None   # ISO; vigencia opcional
    end_at: Optional[str] = None
    is_active: bool = True


class BannerUpdate(BaseModel):
    name: Optional[str] = None
    text: Optional[str] = None
    link_url: Optional[str] = None
    weight: Optional[int] = Field(default=None, ge=1, le=10)
    start_at: Optional[str] = None
    end_at: Optional[str] = None
    is_active: Optional[bool] = None
    order: Optional[int] = None


class ReorderRequest(BaseModel):
    ids: list[str]


def _parse_iso(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except ValueError:
        raise HTTPException(status_code=400, detail="Fecha de vigencia no válida (use ISO 8601)")


def _vigente(banner: dict, now: datetime) -> bool:
    start = _parse_iso(banner.get("start_at"))
    end = _parse_iso(banner.get("end_at"))
    if start and now < start:
        return False
    if end and now > end:
        return False
    return True


@router.get("/public")
async def get_public_banners(race_code: Optional[str] = None, db=Depends(get_db)):
    """Banners activos y vigentes para el pie de la vista en vivo (público)."""
    code = race_code or await _active_race_code(db)
    if not code:
        return []
    banners = await db.ad_banners.find(
        {"race_code": code.upper(), "is_active": True},
        PUBLIC_FIELDS | {"start_at": 1, "end_at": 1},
    ).sort("order", 1).to_list(100)
    now = datetime.now(timezone.utc)
    vigentes = [b for b in banners if _vigente(b, now)]
    for b in vigentes:
        b.pop("start_at", None)
        b.pop("end_at", None)
    return vigentes


@router.get("/admin", dependencies=[solo_sponsors])
async def get_banners_admin(race_code: str, db=Depends(get_db)):
    return await db.ad_banners.find(
        {"race_code": race_code.upper()}, {"_id": 0}
    ).sort("order", 1).to_list(200)


@router.post("/", dependencies=[solo_sponsors])
async def create_banner(data: BannerCreate, db=Depends(get_db)):
    # Validar vigencia desde la creacion para no guardar fechas ilegibles.
    _parse_iso(data.start_at)
    _parse_iso(data.end_at)
    count = await db.ad_banners.count_documents({"race_code": data.race_code.upper()})
    now = datetime.now(timezone.utc)
    doc = {
        "id": str(uuid.uuid4()),
        "race_code": data.race_code.upper(),
        "name": data.name.strip(),
        "text": (data.text or "").strip(),
        "link_url": (data.link_url or "").strip(),
        "logo_url": None,
        "weight": data.weight,
        "start_at": data.start_at,
        "end_at": data.end_at,
        "is_active": data.is_active,
        "order": count,
        "impressions": 0,
        "clicks": 0,
        "created_at": now,
        "updated_at": now,
    }
    await db.ad_banners.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/reorder", dependencies=[solo_sponsors])
async def reorder_banners(data: ReorderRequest, db=Depends(get_db)):
    for idx, banner_id in enumerate(data.ids):
        await db.ad_banners.update_one({"id": banner_id}, {"$set": {"order": idx}})
    return {"message": "Orden actualizado"}


@router.put("/{banner_id}", dependencies=[solo_sponsors])
async def update_banner(banner_id: str, data: BannerUpdate, db=Depends(get_db)):
    _parse_iso(data.start_at)
    _parse_iso(data.end_at)
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    # Permitir borrar la vigencia mandando cadena vacia.
    for campo in ("start_at", "end_at", "text", "link_url"):
        valor = getattr(data, campo)
        if valor == "":
            updates[campo] = None
    if not updates:
        raise HTTPException(status_code=400, detail="Nada que actualizar")
    updates["updated_at"] = datetime.now(timezone.utc)
    result = await db.ad_banners.update_one({"id": banner_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Banner no encontrado")
    return await db.ad_banners.find_one({"id": banner_id}, {"_id": 0})


@router.delete("/{banner_id}", dependencies=[solo_sponsors])
async def delete_banner(banner_id: str, db=Depends(get_db)):
    banner = await db.ad_banners.find_one({"id": banner_id})
    if not banner:
        raise HTTPException(status_code=404, detail="Banner no encontrado")
    await db.ad_banners.delete_one({"id": banner_id})
    # Limpiar el logo de GridFS para no acumular huerfanos.
    logo_url = banner.get("logo_url") or ""
    if logo_url.startswith("/api/uploads/ads/"):
        from services import file_storage
        await file_storage.delete(logo_url.rsplit("/", 1)[-1])
    return {"message": "Banner eliminado"}


@router.post("/{banner_id}/logo", dependencies=[solo_sponsors])
async def upload_banner_logo(banner_id: str, file: UploadFile = File(...), db=Depends(get_db)):
    banner = await db.ad_banners.find_one({"id": banner_id})
    if not banner:
        raise HTTPException(status_code=404, detail="Banner no encontrado")

    # Sin SVG: puede llevar JavaScript y se sirve desde nuestro origen.
    allowed_types = ["image/png", "image/jpeg", "image/jpg", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Tipo de archivo no permitido. Use PNG, JPG o WEBP")

    from services import file_storage

    content = await file.read()
    ext_original = file.filename.split(".")[-1] if file.filename and "." in file.filename else "png"
    content, ext, content_type = file_storage.compress_image(content, ext_original, file.content_type)

    filename = f"{banner['race_code']}_{banner_id}.{ext}"
    await file_storage.save(filename, content, content_type, file_storage.FOLDER_ADS)

    logo_url = f"/api/uploads/ads/{filename}"
    await db.ad_banners.update_one(
        {"id": banner_id},
        {"$set": {"logo_url": logo_url, "updated_at": datetime.now(timezone.utc)}},
    )
    return {"message": "Logo subido exitosamente", "logo_url": logo_url}


class TrackRequest(BaseModel):
    banner_id: str
    event: str  # "impression" | "click"


@router.post("/track")
async def track_banner_event(data: TrackRequest, db=Depends(get_db)):
    """Acumula una impresión o clic (público, sin datos personales)."""
    if data.event not in ("impression", "click"):
        raise HTTPException(status_code=400, detail="Evento no válido")
    field = "impressions" if data.event == "impression" else "clicks"
    await db.ad_banners.update_one({"id": data.banner_id}, {"$inc": {field: 1}})
    return {"ok": True}
