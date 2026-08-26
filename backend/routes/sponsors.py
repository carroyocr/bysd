from fastapi import APIRouter, HTTPException, Depends, Header, UploadFile, File, Form
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime, timezone
import os
import uuid
from pathlib import Path

from services.auth import require_permission
from services import sponsor_categories

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


def proceso_permite_publicar(doc: dict) -> bool:
    """Si el proceso comercial de un patrocinador ya llego al momento de salir.

    Es el unico filtro que sigue siendo del patrocinador: "no lo ensenes hasta
    que firme" es una decision comercial, no de publicacion. Donde se ve -sitio
    o app- lo decide ahora su ficha de publicidad, no esto.
    """
    status = doc.get("status") or "prospecto"
    if status not in ORDERED_PIPELINE:
        return False  # declinado o valor desconocido
    threshold = doc.get("publicar_desde") or DEFAULT_PUBLICAR_DESDE
    if threshold not in ORDERED_PIPELINE:
        threshold = DEFAULT_PUBLICAR_DESDE
    return ORDERED_PIPELINE.index(status) >= ORDERED_PIPELINE.index(threshold)

# El endpoint publico solo expone los campos de la vitrina del sitio; los
# datos comerciales (RNC, montos, bitacora, contactos) son solo del panel.
# La categoria si sale al publico: es la que agrupa la vitrina del sitio.
# La descripcion y el Instagram ya no salen: se mudaron a la ficha de
# publicidad (routes/ads.py). En la vitrina queda el logo, el nombre y la
# categoria, que es lo que distingue a un nivel de otro.
PUBLIC_FIELDS = {
    "_id": 0, "name": 1,
    "logo_url": 1, "order": 1, "race_code": 1, "is_active": 1,
    "propuesta_categoria": 1,
}

# Los dos interruptores de publicacion no son de la vitrina, pero hacen falta
# para decidir quien sale: se piden aparte y se quitan antes de responder.
CAMPOS_PUBLICACION = {"status": 1, "publicar_desde": 1}

# Uploads directory for sponsor logos
UPLOADS_DIR = Path(__file__).parent.parent / "static" / "uploads" / "sponsors"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


class SponsorCreate(BaseModel):
    name: str
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


class SponsorCopy(BaseModel):
    """Traer patrocinadores de una edicion a otra."""
    from_race_code: str
    to_race_code: str
    names: List[str]


def logo_filename(race_code: str, sponsor_name: str, ext: str = "png") -> str:
    """Nombre del archivo del logo: sin acentos ni simbolos, y por carrera."""
    import unicodedata
    import re

    safe_name = unicodedata.normalize("NFKD", sponsor_name.lower())
    safe_name = safe_name.encode("ascii", "ignore").decode("ascii")
    safe_name = re.sub(r"[^a-z0-9\-]", "-", safe_name)
    safe_name = re.sub(r"-+", "-", safe_name).strip("-")
    return f"{race_code.upper()}_{safe_name}.{ext}"


def get_db():
    from server import db
    return db


async def estrenar_ficha_publicidad(db, sponsor: dict) -> dict | None:
    """Le crea al patrocinador su ficha de publicidad, si no la tiene ya.

    Nace **apagada** y sin imagenes a proposito: un banner sin pieza grafica
    en el pie de BYSD Live se veria como un hueco con un nombre. Lo unico que
    queda por hacer es subirle el logo, el banner y la imagen de detalle, y
    encenderla.

    Devuelve None si ya habia una para ese patrocinador, para que reponer un
    patrocinador borrado no duplique fichas.
    """
    from routes.ads import nuevo_banner

    race_code = sponsor["race_code"]
    ya_hay = await db.ad_banners.find_one({
        "race_code": race_code,
        "name": sponsor["name"],
    })
    if ya_hay:
        return None

    orden = await db.ad_banners.count_documents({"race_code": race_code})
    banner = nuevo_banner(
        race_code,
        sponsor["name"],
        order=orden,
        description=sponsor.get("description"),
        instagram=sponsor.get("instagram"),
        is_active=False,
    )
    await db.ad_banners.insert_one(banner)
    banner.pop("_id", None)
    return banner


@router.get("/race/{race_code}")
async def get_sponsors_by_race(race_code: str, destino: str = "web", db=Depends(get_db)):
    """Patrocinadores publicados de una carrera (publico).

    `destino` dice quien pregunta: "web" es la pagina de patrocinadores del
    sitio y "app" el BYSD Live. Quien sale donde lo decide **la ficha de
    publicidad** de cada uno, que es donde viven los dos interruptores; aqui
    solo se le pregunta. Lo que si sigue siendo del patrocinador es si su
    proceso comercial llego al momento de publicar.

    La ficha se busca por nombre y carrera, que es como se direcciona un
    patrocinador en todo el backend. Un patrocinador sin ficha -no deberia
    haberlos, cada alta estrena la suya- se ensena: no se le castiga por una
    ficha que falta.
    """
    code = race_code.upper()
    # Los campos de publicacion se necesitan para decidir quien sale, pero se
    # quitan antes de responder: son datos del panel.
    projection = {**PUBLIC_FIELDS, **CAMPOS_PUBLICACION}
    docs = await db.sponsors.find(
        {"race_code": code, "is_active": True},
        projection
    ).sort("order", 1).to_list(100)

    interruptor = "publicar_app" if destino == "app" else "publicar_web"
    fichas = await db.ad_banners.find(
        {"race_code": code},
        {"_id": 0, "name": 1, interruptor: 1},
    ).to_list(200)
    apagados = {
        f["name"] for f in fichas if f.get(interruptor) is False
    }

    sponsors = []
    for doc in docs:
        if doc.get("name") in apagados:
            continue
        if proceso_permite_publicar(doc):
            for campo in CAMPOS_PUBLICACION:
                doc.pop(campo, None)
            sponsors.append(doc)

    return {"sponsors": sponsors, "race_code": code}


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

    categoria = (sponsor.propuesta_categoria or "").strip()
    if not sponsor_categories.es_valida(categoria):
        raise HTTPException(status_code=400, detail="Categoría de patrocinio inválida")

    sponsor_data = {
        "name": sponsor.name,
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
        "propuesta_categoria": categoria,
        "propuesta_monto": sponsor.propuesta_monto,
        "status": status,
        "publicar_desde": publicar_desde,
        "bitacora": [],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.sponsors.insert_one(sponsor_data)

    banner = await estrenar_ficha_publicidad(db, sponsor_data)

    # Return without _id
    sponsor_data.pop("_id", None)
    return {
        "message": "Patrocinador creado exitosamente",
        "sponsor": sponsor_data,
        "banner_id": banner.get("id") if banner else None,
    }


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

    if "propuesta_categoria" in update_data and not sponsor_categories.es_valida(
        update_data["propuesta_categoria"].strip()
    ):
        raise HTTPException(status_code=400, detail="Categoría de patrocinio inválida")

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
    
    ext = file.filename.split(".")[-1] if "." in file.filename else "png"
    filename = logo_filename(race_code, sponsor_name, ext)

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


@router.post("/copy", dependencies=[solo_sponsors])
async def copy_sponsors(payload: SponsorCopy, db=Depends(get_db)):
    """Traer patrocinadores de otra edicion a la carrera indicada.

    Llega lo que sirve para volver a tocar la puerta (logo y datos de
    contacto), pero no el resultado de la negociacion
    anterior: el proceso empieza otra vez en "prospecto" y el monto de aquella
    vez queda solo como referencia en la bitacora, no como propuesta vigente.
    """
    origen = payload.from_race_code.upper()
    destino = payload.to_race_code.upper()

    if origen == destino:
        raise HTTPException(status_code=400, detail="El origen y el destino son la misma carrera")
    if not payload.names:
        raise HTTPException(status_code=400, detail="No se indicó ningún patrocinador")

    from services import file_storage

    ultimo = await db.sponsors.find_one({"race_code": destino}, sort=[("order", -1)])
    siguiente_orden = (ultimo.get("order", 0) + 1) if ultimo else 1

    copiados, omitidos = [], []

    for name in payload.names:
        fuente = await db.sponsors.find_one({"name": name, "race_code": origen})
        if not fuente:
            omitidos.append({"name": name, "motivo": "no existe en la carrera de origen"})
            continue

        if await db.sponsors.find_one({"name": name, "race_code": destino}):
            omitidos.append({"name": name, "motivo": "ya está en esta carrera"})
            continue

        # El logo se duplica con el nombre de la carrera destino: si luego se
        # cambia el de una edicion, la otra conserva el suyo.
        logo_url = None
        if fuente.get("logo_url"):
            origen_archivo = fuente["logo_url"].rsplit("/", 1)[-1]
            ext = origen_archivo.rsplit(".", 1)[-1] if "." in origen_archivo else "png"
            contenido = await file_storage.load(origen_archivo)
            if contenido:
                destino_archivo = logo_filename(destino, name, ext)
                await file_storage.save(
                    destino_archivo, contenido[0], contenido[1], file_storage.FOLDER_SPONSORS
                )
                logo_url = f"/api/uploads/sponsors/{destino_archivo}"

        # La categoria y el monto de la edicion anterior no viajan como
        # propuesta vigente, pero quedan escritos para saber de donde se parte.
        categoria_anterior = sponsor_categories.etiqueta(fuente.get("propuesta_categoria"))
        monto_anterior = fuente.get("propuesta_monto")
        referencia = f" Entró como {categoria_anterior}." if categoria_anterior else ""
        referencia += f" Aportó RD${monto_anterior:,.2f}." if monto_anterior else ""

        copia = {
            "name": name,
            "race_code": destino,
            "order": siguiente_orden,
            "logo_url": logo_url,
            "is_active": True,
            "razon_social": fuente.get("razon_social", ""),
            "rnc": fuente.get("rnc", ""),
            "nombre_contacto": fuente.get("nombre_contacto", ""),
            "posicion_contacto": fuente.get("posicion_contacto", ""),
            "telefono": fuente.get("telefono", ""),
            "correo": fuente.get("correo", ""),
            "pagina_web": fuente.get("pagina_web", ""),
            "propuesta_categoria": "",
            "propuesta_monto": None,
            "status": "prospecto",
            "publicar_desde": fuente.get("publicar_desde") or DEFAULT_PUBLICAR_DESDE,
            "bitacora": [{
                "id": str(uuid.uuid4()),
                "fecha": datetime.now(timezone.utc).isoformat(),
                "nota": f"Traído de {origen}.{referencia}",
                "tipo": "status",
            }],
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        await db.sponsors.insert_one(copia)

        # En la carrera destino estrena su propia ficha de publicidad, con la
        # descripcion y el Instagram de la edicion anterior ya dentro: son lo
        # que sirve para volver a tocar la puerta.
        copia["description"] = fuente.get("description", "")
        copia["instagram"] = fuente.get("instagram")
        await estrenar_ficha_publicidad(db, copia)

        siguiente_orden += 1
        copiados.append(name)

    return {
        "message": f"{len(copiados)} patrocinador(es) traídos de {origen}",
        "copiados": copiados,
        "omitidos": omitidos,
    }


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
