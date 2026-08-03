from fastapi import APIRouter, HTTPException, Depends, Header, UploadFile, File, Form
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime, timezone
import os
import uuid
from pathlib import Path

from services.auth import require_permission

router = APIRouter(prefix="/api/sponsors", tags=["sponsors"])

# El listado publico de la web es el unico endpoint abierto; el resto (crear,
# editar, borrar, subir logos) exige el permiso "sponsors".
solo_sponsors = Depends(require_permission("sponsors"))

# Pipeline del proceso de cierre de un patrocinio. "prospecto" (aun sin primer
# contacto) y "declinado" (no se concreto) se agregan a la lista pedida para
# cubrir el inicio y la salida negativa del proceso.
SPONSOR_STATUSES = (
    "prospecto",
    "envio_informacion",
    "llamada_primer_contacto",
    "reunion",
    "retroalimentacion",
    "cierre",
    "facturacion",
    "pago",
    "declinado",
)

STATUS_LABELS = {
    "prospecto": "Prospecto",
    "envio_informacion": "Envío de Información",
    "llamada_primer_contacto": "Llamada de Primer Contacto",
    "reunion": "Reunión (física o virtual)",
    "retroalimentacion": "Retroalimentación",
    "cierre": "Cierre",
    "facturacion": "Facturación",
    "pago": "Pago",
    "declinado": "Declinado",
}

# Orden del pipeline (sin "declinado", que nunca se publica). Cada
# patrocinador define en "publicar_desde" el momento del proceso a partir
# del cual aparece en el sitio (por defecto "cierre"). La publicacion esta
# apagada por defecto: un documento sin status cuenta como "prospecto" y
# NO se publica hasta que el proceso avance al momento configurado.
ORDERED_PIPELINE = [s for s in SPONSOR_STATUSES if s != "declinado"]
DEFAULT_PUBLICAR_DESDE = "cierre"


def sponsor_esta_publicado(doc: dict) -> bool:
    status = doc.get("status") or "prospecto"
    if status not in ORDERED_PIPELINE:
        return False  # declinado o valor desconocido
    threshold = doc.get("publicar_desde") or DEFAULT_PUBLICAR_DESDE
    if threshold not in ORDERED_PIPELINE:
        threshold = DEFAULT_PUBLICAR_DESDE
    return ORDERED_PIPELINE.index(status) >= ORDERED_PIPELINE.index(threshold)

# El endpoint publico solo expone los campos de la vitrina del sitio; los
# datos comerciales (RNC, montos, bitacora, contactos) son solo del panel.
PUBLIC_FIELDS = {
    "_id": 0, "name": 1, "description": 1, "instagram": 1,
    "logo_url": 1, "order": 1, "race_code": 1, "is_active": 1,
}

# Uploads directory for sponsor logos
UPLOADS_DIR = Path(__file__).parent.parent / "static" / "uploads" / "sponsors"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


class SponsorCreate(BaseModel):
    name: str
    description: str
    instagram: Optional[str] = None
    race_code: str
    order: Optional[int] = 0
    # Datos comerciales (CRM)
    razon_social: Optional[str] = None
    rnc: Optional[str] = None
    nombre_contacto: Optional[str] = None
    posicion_contacto: Optional[str] = None
    telefono: Optional[str] = None
    correo: Optional[str] = None
    pagina_web: Optional[str] = None
    propuesta_categoria: Optional[str] = None
    propuesta_monto: Optional[float] = None
    status: Optional[str] = "prospecto"
    publicar_desde: Optional[str] = None


class SponsorUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    instagram: Optional[str] = None
    order: Optional[int] = None
    is_active: Optional[bool] = None
    razon_social: Optional[str] = None
    rnc: Optional[str] = None
    nombre_contacto: Optional[str] = None
    posicion_contacto: Optional[str] = None
    telefono: Optional[str] = None
    correo: Optional[str] = None
    pagina_web: Optional[str] = None
    propuesta_categoria: Optional[str] = None
    propuesta_monto: Optional[float] = None
    status: Optional[str] = None
    publicar_desde: Optional[str] = None


class BitacoraEntry(BaseModel):
    nota: str


def get_db():
    from server import db
    return db


@router.get("/race/{race_code}")
async def get_sponsors_by_race(race_code: str, db=Depends(get_db)):
    """Get published sponsors for a specific race (public endpoint)"""
    # Se necesitan status y publicar_desde para decidir la publicacion,
    # pero se quitan antes de responder: son datos del panel.
    projection = {**PUBLIC_FIELDS, "status": 1, "publicar_desde": 1}
    docs = await db.sponsors.find(
        {"race_code": race_code.upper(), "is_active": True},
        projection
    ).sort("order", 1).to_list(100)

    sponsors = []
    for doc in docs:
        if sponsor_esta_publicado(doc):
            doc.pop("status", None)
            doc.pop("publicar_desde", None)
            sponsors.append(doc)

    return {"sponsors": sponsors, "race_code": race_code.upper()}


@router.get("/admin/race/{race_code}", dependencies=[solo_sponsors])
async def get_sponsors_admin(race_code: str, db=Depends(get_db)):
    """Get all sponsors for admin (including inactive)"""
    sponsors = await db.sponsors.find(
        {"race_code": race_code.upper()},
        {"_id": 0}
    ).sort("order", 1).to_list(100)
    
    return {"sponsors": sponsors, "race_code": race_code.upper()}


@router.post("/create", dependencies=[solo_sponsors])
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
    
    status = sponsor.status or "prospecto"
    if status not in SPONSOR_STATUSES:
        raise HTTPException(status_code=400, detail="Status inválido")

    publicar_desde = sponsor.publicar_desde or DEFAULT_PUBLICAR_DESDE
    if publicar_desde not in ORDERED_PIPELINE:
        raise HTTPException(status_code=400, detail="Momento de publicación inválido")

    sponsor_data = {
        "name": sponsor.name,
        "description": sponsor.description,
        "instagram": sponsor.instagram,
        "race_code": sponsor.race_code.upper(),
        "order": sponsor.order or next_order,
        "logo_url": None,
        "is_active": True,
        "razon_social": (sponsor.razon_social or "").strip(),
        "rnc": (sponsor.rnc or "").strip(),
        "nombre_contacto": (sponsor.nombre_contacto or "").strip(),
        "posicion_contacto": (sponsor.posicion_contacto or "").strip(),
        "telefono": (sponsor.telefono or "").strip(),
        "correo": (sponsor.correo or "").strip(),
        "pagina_web": (sponsor.pagina_web or "").strip(),
        "propuesta_categoria": (sponsor.propuesta_categoria or "").strip(),
        "propuesta_monto": sponsor.propuesta_monto,
        "status": status,
        "publicar_desde": publicar_desde,
        "bitacora": [],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.sponsors.insert_one(sponsor_data)
    
    # Return without _id
    sponsor_data.pop("_id", None)
    return {"message": "Patrocinador creado exitosamente", "sponsor": sponsor_data}


@router.put("/update/{sponsor_name}", dependencies=[solo_sponsors])
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

    if "status" in update_data and update_data["status"] not in SPONSOR_STATUSES:
        raise HTTPException(status_code=400, detail="Status inválido")

    if "publicar_desde" in update_data and update_data["publicar_desde"] not in ORDERED_PIPELINE:
        raise HTTPException(status_code=400, detail="Momento de publicación inválido")

    update_data["updated_at"] = datetime.now(timezone.utc)

    ops = {"$set": update_data}

    # Cada cambio de status queda registrado en la bitacora automaticamente
    old_status = sponsor.get("status") or "prospecto"
    new_status = update_data.get("status")
    if new_status and new_status != old_status:
        ops["$push"] = {
            "bitacora": {
                "id": str(uuid.uuid4()),
                "fecha": datetime.now(timezone.utc).isoformat(),
                "nota": f"Status: {STATUS_LABELS.get(old_status, old_status)} → {STATUS_LABELS.get(new_status, new_status)}",
                "tipo": "status",
            }
        }

    await db.sponsors.update_one(
        {"name": sponsor_name, "race_code": race_code.upper()},
        ops
    )

    return {"message": "Patrocinador actualizado exitosamente"}


@router.post("/upload-logo/{sponsor_name}", dependencies=[solo_sponsors])
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
    # Sin SVG: puede llevar JavaScript dentro y se sirve desde el dominio del
    # backend, asi que abrirlo ejecutaria ese script en nuestro origen.
    allowed_types = ["image/png", "image/jpeg", "image/jpg", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Tipo de archivo no permitido. Use PNG, JPG, WEBP o SVG")
    
    # Create filename - sanitize to remove special characters
    import unicodedata
    import re
    
    ext = file.filename.split(".")[-1] if "." in file.filename else "png"
    # Normalize unicode to ASCII equivalents, remove accents
    safe_name = unicodedata.normalize('NFKD', sponsor_name.lower())
    safe_name = safe_name.encode('ascii', 'ignore').decode('ascii')
    safe_name = re.sub(r'[^a-z0-9\-]', '-', safe_name)
    safe_name = re.sub(r'-+', '-', safe_name).strip('-')
    
    filename = f"{race_code.upper()}_{safe_name}.{ext}"

    # Guardar en GridFS: el disco del contenedor se borra en cada despliegue.
    from services import file_storage

    content = await file.read()
    await file_storage.save(filename, content, file.content_type, file_storage.FOLDER_SPONSORS)

    # Update sponsor with logo URL - use /api/uploads for correct routing
    logo_url = f"/api/uploads/sponsors/{filename}"
    await db.sponsors.update_one(
        {"name": sponsor_name, "race_code": race_code.upper()},
        {"$set": {"logo_url": logo_url, "updated_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": "Logo subido exitosamente", "logo_url": logo_url}


@router.delete("/delete/{sponsor_name}", dependencies=[solo_sponsors])
async def delete_sponsor(sponsor_name: str, race_code: str, db=Depends(get_db)):
    """Delete a sponsor (soft delete - sets is_active to false)"""
    result = await db.sponsors.update_one(
        {"name": sponsor_name, "race_code": race_code.upper()},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc)}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Patrocinador no encontrado")
    
    return {"message": "Patrocinador eliminado exitosamente"}


@router.delete("/hard-delete/{sponsor_name}", dependencies=[solo_sponsors])
async def hard_delete_sponsor(sponsor_name: str, race_code: str, db=Depends(get_db)):
    """Permanently delete a sponsor"""
    result = await db.sponsors.delete_one({
        "name": sponsor_name,
        "race_code": race_code.upper()
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Patrocinador no encontrado")
    
    return {"message": "Patrocinador eliminado permanentemente"}


@router.post("/bitacora/{sponsor_name}", dependencies=[solo_sponsors])
async def add_bitacora_entry(
    sponsor_name: str,
    race_code: str,
    entry: BitacoraEntry,
    db=Depends(get_db)
):
    """Registrar un contacto en la bitacora del patrocinador"""
    nota = entry.nota.strip()
    if not nota:
        raise HTTPException(status_code=400, detail="La nota no puede estar vacía")

    result = await db.sponsors.update_one(
        {"name": sponsor_name, "race_code": race_code.upper()},
        {
            "$push": {
                "bitacora": {
                    "id": str(uuid.uuid4()),
                    "fecha": datetime.now(timezone.utc).isoformat(),
                    "nota": nota,
                    "tipo": "contacto",
                }
            },
            "$set": {"updated_at": datetime.now(timezone.utc)},
        }
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Patrocinador no encontrado")
    return {"message": "Contacto registrado en la bitácora"}


@router.post("/reorder", dependencies=[solo_sponsors])
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
