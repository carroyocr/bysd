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
    "logo_url": 1, "banner_url": 1, "detail_url": 1, "weight": 1, "order": 1,
    "mostrar_marca": 1, "description": 1, "instagram": 1,
}

# banner_url: PNG del tamano exacto de la barra (1200x240, proporcion 5:1).
# Cuando existe, sustituye al icono y al texto.
# detail_url: imagen que se abre dentro de la app al tocar el banner, para que
# el patrocinador pueda contar algo mas largo sin sacar al usuario de BYSD.
IMAGENES = {
    "logo": "logo_url",
    "banner": "banner_url",
    "detail": "detail_url",
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
    # La descripcion y el Instagram viven aqui, no en la ficha del
    # patrocinador: alli solo queda lo comercial. No son el texto ni el enlace
    # del banner, que son de una linea y del tamano de la barra.
    description: Optional[str] = None
    instagram: Optional[str] = None
    weight: int = Field(default=1, ge=1, le=10)
    start_at: Optional[str] = None   # ISO; vigencia opcional
    end_at: Optional[str] = None
    is_active: bool = True
    # La nota "Patrocinador" sobre el banner. Se puede quitar cuando la propia
    # pieza ya deja claro de quien es y la nota solo estorba.
    mostrar_marca: bool = True


class BannerUpdate(BaseModel):
    name: Optional[str] = None
    text: Optional[str] = None
    link_url: Optional[str] = None
    description: Optional[str] = None
    instagram: Optional[str] = None
    weight: Optional[int] = Field(default=None, ge=1, le=10)
    start_at: Optional[str] = None
    end_at: Optional[str] = None
    is_active: Optional[bool] = None
    order: Optional[int] = None
    mostrar_marca: Optional[bool] = None


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


def nuevo_banner(
    race_code: str,
    name: str,
    *,
    order: int,
    description: Optional[str] = None,
    instagram: Optional[str] = None,
    text: Optional[str] = None,
    link_url: Optional[str] = None,
    weight: int = 1,
    start_at: Optional[str] = None,
    end_at: Optional[str] = None,
    is_active: bool = True,
    mostrar_marca: bool = True,
) -> dict:
    """El documento de una ficha de publicidad recien nacida.

    Vive aqui y no en el endpoint porque el alta de un patrocinador tambien
    estrena la suya, y las dos tienen que salir con la misma forma: si una se
    queda sin un campo, el panel lo lee como vacio y nadie se entera.

    La ficha se ata a su patrocinador por nombre y carrera, que es como se
    direcciona un patrocinador en todo el backend: no tiene campo `id`.
    """
    ahora = datetime.now(timezone.utc)
    return {
        "id": str(uuid.uuid4()),
        "race_code": race_code.upper(),
        "name": name.strip(),
        "text": (text or "").strip(),
        "link_url": (link_url or "").strip(),
        "description": (description or "").strip(),
        "instagram": (instagram or "").strip(),
        "logo_url": None,
        "banner_url": None,
        "detail_url": None,
        "weight": weight,
        "start_at": start_at,
        "end_at": end_at,
        "is_active": is_active,
        "mostrar_marca": mostrar_marca,
        "order": order,
        "impressions": 0,
        "clicks": 0,
        "created_at": ahora,
        "updated_at": ahora,
    }


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


@router.get("/pie")
async def pie_publicitario(race_code: Optional[str] = None, db=Depends(get_db)):
    """Lo que va en el pie de la app, ya resuelto. Publico.

    El respaldo a los patrocinadores publicados vivia en la app, y desde alli
    no se puede distinguir "esta carrera no tiene publicidad montada" de "la
    tiene toda pausada": las dos cosas llegaban como una lista vacia. Al pausar
    el unico banner, el pie resucitaba al mismo patrocinador por la puerta de
    atras y pausar no servia de nada.

    La regla es la que se espera: si la carrera tiene banners montados, el pie
    ensena solo los suyos que esten activos y en vigencia, aunque no quede
    ninguno. El respaldo de patrocinadores es solo para las carreras que no
    tienen publicidad montada.
    """
    code = race_code or await _active_race_code(db)
    if not code:
        return {"banners": [], "origen": "vacio"}
    code = code.upper()

    montados = await db.ad_banners.find(
        {"race_code": code},
        PUBLIC_FIELDS | {"start_at": 1, "end_at": 1, "is_active": 1},
    ).sort("order", 1).to_list(100)

    now = datetime.now(timezone.utc)
    vigentes = [b for b in montados if b.get("is_active") and _vigente(b, now)]
    for b in vigentes:
        for campo in ("start_at", "end_at", "is_active"):
            b.pop(campo, None)

    if vigentes:
        return {"banners": vigentes, "origen": "ads"}
    if montados:
        # Los tiene, pero pausados o fuera de fecha: es una decision, se respeta.
        return {"banners": [], "origen": "pausados"}

    from routes.sponsors import (
        PUBLIC_FIELDS as SPONSOR_FIELDS,
        CAMPOS_PUBLICACION,
        sponsor_esta_publicado,
    )

    docs = await db.sponsors.find(
        {"race_code": code, "is_active": True},
        {**SPONSOR_FIELDS, **CAMPOS_PUBLICACION},
    ).sort("order", 1).to_list(100)

    respaldo = []
    for i, s in enumerate(docs):
        # El pie es app: manda el interruptor de la app, no el del sitio.
        if not sponsor_esta_publicado(s, "app"):
            continue
        instagram = s.get("instagram") or ""
        respaldo.append({
            "id": f"sponsor-{code}-{i}",
            "name": s.get("name"),
            "text": s.get("description") or None,
            "logo_url": s.get("logo_url") or None,
            "link_url": (
                instagram if instagram.startswith("http")
                else f"https://instagram.com/{instagram.lstrip('@')}" if instagram
                else None
            ),
            "is_sponsor_fallback": True,
        })

    return {"banners": respaldo, "origen": "patrocinadores"}


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
    doc = nuevo_banner(
        data.race_code,
        data.name,
        order=count,
        description=data.description,
        instagram=data.instagram,
        text=data.text,
        link_url=data.link_url,
        weight=data.weight,
        start_at=data.start_at,
        end_at=data.end_at,
        is_active=data.is_active,
        mostrar_marca=data.mostrar_marca,
    )
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
    for campo in ("start_at", "end_at", "text", "link_url", "description", "instagram"):
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
    # Limpiar las imagenes de GridFS para no acumular huerfanos.
    from services import file_storage

    for campo in IMAGENES.values():
        url = banner.get(campo) or ""
        if url.startswith("/api/uploads/ads/"):
            await file_storage.delete(url.rsplit("/", 1)[-1])
    return {"message": "Banner eliminado"}


@router.post("/{banner_id}/imagen/{tipo}", dependencies=[solo_sponsors])
async def upload_banner_image(
    banner_id: str, tipo: str, file: UploadFile = File(...), db=Depends(get_db)
):
    """Sube una de las tres imagenes del banner.

    - logo:   el icono cuadrado de siempre, junto al nombre y el texto.
    - banner: la pieza completa que ocupa la barra entera (1200x240).
    - detail: la imagen que se abre dentro de la app al tocar el banner.
    """
    campo = IMAGENES.get(tipo)
    if not campo:
        raise HTTPException(status_code=400, detail="Tipo de imagen no valido")

    banner = await db.ad_banners.find_one({"id": banner_id})
    if not banner:
        raise HTTPException(status_code=404, detail="Banner no encontrado")

    # Sin SVG: puede llevar JavaScript y se sirve desde nuestro origen.
    allowed_types = ["image/png", "image/jpeg", "image/jpg", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Tipo de archivo no permitido. Use PNG, JPG o WEBP")

    from services import file_storage

    content = await file.read()
    if len(content) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="La imagen no puede pasar de 8MB")

    ext_original = file.filename.split(".")[-1] if file.filename and "." in file.filename else "png"

    # El logo cuadrado puede pasar por la compresion normal; el banner y la
    # imagen ampliada no, porque suelen ser PNG con transparencia y esa
    # compresion los pasa a JPEG aplanando el alfa contra negro.
    if tipo == "logo":
        content, ext, content_type = file_storage.compress_image(content, ext_original, file.content_type)
    else:
        content, ext, content_type = file_storage.compress_banner(content, ext_original, file.content_type)

    sufijo = "" if tipo == "logo" else f"_{tipo}"
    filename = f"{banner['race_code']}_{banner_id}{sufijo}.{ext}"
    await file_storage.save(filename, content, content_type, file_storage.FOLDER_ADS)

    url = f"/api/uploads/ads/{filename}"
    await db.ad_banners.update_one(
        {"id": banner_id},
        {"$set": {campo: url, "updated_at": datetime.now(timezone.utc)}},
    )
    return {"message": "Imagen subida exitosamente", "tipo": tipo, "url": url, campo: url}


@router.delete("/{banner_id}/imagen/{tipo}", dependencies=[solo_sponsors])
async def delete_banner_image(banner_id: str, tipo: str, db=Depends(get_db)):
    """Quita una imagen: sirve para volver del banner completo al icono+texto."""
    campo = IMAGENES.get(tipo)
    if not campo:
        raise HTTPException(status_code=400, detail="Tipo de imagen no valido")

    banner = await db.ad_banners.find_one({"id": banner_id})
    if not banner:
        raise HTTPException(status_code=404, detail="Banner no encontrado")

    url = banner.get(campo) or ""
    if url.startswith("/api/uploads/ads/"):
        from services import file_storage
        await file_storage.delete(url.rsplit("/", 1)[-1])

    await db.ad_banners.update_one(
        {"id": banner_id},
        {"$set": {campo: None, "updated_at": datetime.now(timezone.utc)}},
    )
    return {"message": "Imagen eliminada", "tipo": tipo}


@router.post("/{banner_id}/logo", dependencies=[solo_sponsors])
async def upload_banner_logo(banner_id: str, file: UploadFile = File(...), db=Depends(get_db)):
    """Ruta antigua del logo. Se mantiene para no romper el panel ya publicado."""
    return await upload_banner_image(banner_id, "logo", file, db)


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
