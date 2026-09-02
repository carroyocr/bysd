"""Patrocinadores: una ficha por marca y edicion, con todo dentro.

Comercial, marca y publicacion viven en el mismo documento de `sponsors`. Las
reglas compartidas con el pie publicitario estan en `services/patrocinios.py`;
aqui queda el CRUD del panel y la vitrina publica.

El listado publico de la vitrina es el unico endpoint abierto; el resto exige
el permiso "sponsors".
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime, timezone
import re
import unicodedata

from services.auth import require_permission
from services import sponsor_categories, patrocinios

router = APIRouter(prefix="/api/sponsors", tags=["sponsors"])

solo_sponsors = Depends(require_permission("sponsors"))

# Se reexportan porque otros modulos y las pruebas los importaban de aqui
# cuando el pipeline vivia en este archivo.
SPONSOR_STATUSES = patrocinios.STATUSES
STATUS_LABELS = patrocinios.STATUS_LABELS
ORDERED_PIPELINE = patrocinios.PIPELINE
DEFAULT_PUBLICAR_DESDE = patrocinios.PUBLICAR_DESDE_POR_DEFECTO


class DatosComerciales(BaseModel):
    """El bloque que nunca sale del panel."""
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


class DatosPublicos(BaseModel):
    """Marca y publicacion: lo que ve quien entra al sitio o abre la app."""
    description: Optional[str] = None
    instagram: Optional[str] = None
    text: Optional[str] = None
    link_url: Optional[str] = None
    publicar_web: Optional[bool] = None
    publicar_app: Optional[bool] = None
    mostrar_marca: Optional[bool] = None
    weight: Optional[int] = Field(default=None, ge=1, le=10)
    start_at: Optional[str] = None
    end_at: Optional[str] = None


class SponsorCreate(DatosComerciales, DatosPublicos):
    name: str
    race_code: str
    order: Optional[int] = 0


class SponsorUpdate(DatosComerciales, DatosPublicos):
    name: Optional[str] = None
    order: Optional[int] = None
    is_active: Optional[bool] = None


class BitacoraEntry(BaseModel):
    nota: str


class SponsorCopy(BaseModel):
    """Traer patrocinadores de una edicion a otra."""
    from_race_code: str
    to_race_code: str
    names: List[str]


def get_db():
    from server import db
    return db


def nombre_archivo(race_code: str, sponsor_name: str, tipo: str, ext: str = "png") -> str:
    """Nombre del archivo de una imagen: sin acentos ni simbolos, y por carrera.

    Se nombra por el patrocinador y no por su `id` para que el archivo se
    pueda reconocer de un vistazo en GridFS.
    """
    limpio = unicodedata.normalize("NFKD", sponsor_name.lower())
    limpio = limpio.encode("ascii", "ignore").decode("ascii")
    limpio = re.sub(r"[^a-z0-9\-]", "-", limpio)
    limpio = re.sub(r"-+", "-", limpio).strip("-")
    sufijo = "" if tipo == "logo" else f"_{tipo}"
    return f"{race_code.upper()}_{limpio}{sufijo}.{ext}"


# Nombre anterior, cuando solo habia logos. Lo siguen usando las migraciones.
def logo_filename(race_code: str, sponsor_name: str, ext: str = "png") -> str:
    return nombre_archivo(race_code, sponsor_name, "logo", ext)


async def _buscar(db, name: str, race_code: str) -> dict:
    doc = await db.sponsors.find_one({"name": name, "race_code": race_code.upper()})
    if not doc:
        raise HTTPException(status_code=404, detail="Patrocinador no encontrado")
    return doc


def _validar(datos: dict) -> None:
    """Las tres validaciones que comparten el alta y la edicion."""
    if "status" in datos and datos["status"] not in patrocinios.STATUSES:
        raise HTTPException(status_code=400, detail="Status inválido")
    if "publicar_desde" in datos and datos["publicar_desde"] not in patrocinios.PIPELINE:
        raise HTTPException(status_code=400, detail="Momento de publicación inválido")
    if "propuesta_categoria" in datos and not sponsor_categories.es_valida(
        (datos["propuesta_categoria"] or "").strip()
    ):
        raise HTTPException(status_code=400, detail="Categoría de patrocinio inválida")
    patrocinios.parse_iso(datos.get("start_at"))
    patrocinios.parse_iso(datos.get("end_at"))


@router.get("/race/{race_code}")
async def get_sponsors_by_race(race_code: str, destino: str = "web", db=Depends(get_db)):
    """Patrocinadores publicados de una carrera (publico).

    `destino` dice quien pregunta: "web" es la pagina de patrocinadores del
    sitio y "app" la vitrina de BYSD Live. Sale quien tenga encendido el
    interruptor de ese destino **y** cuyo proceso comercial haya llegado al
    momento de publicar. Las dos condiciones viven ahora en el mismo
    documento; antes la primera estaba en otra coleccion.
    """
    code = race_code.upper()
    # Los campos que deciden quien sale no son de la vitrina, pero hacen falta
    # para filtrar: se piden aparte y se quitan antes de responder.
    campos_filtro = {"status": 1, "publicar_desde": 1, "publicar_web": 1, "publicar_app": 1}
    docs = await db.sponsors.find(
        {"race_code": code, "is_active": True},
        {**patrocinios.CAMPOS_VITRINA, **campos_filtro},
    ).sort("order", 1).to_list(200)

    sponsors = []
    for doc in docs:
        if not patrocinios.sale_en(doc, destino):
            continue
        for campo in campos_filtro:
            doc.pop(campo, None)
        sponsors.append(doc)

    return {"sponsors": sponsors, "race_code": code}


@router.get("/admin/race/{race_code}", dependencies=[solo_sponsors])
async def get_sponsors_admin(race_code: str, db=Depends(get_db)):
    """Todos los patrocinadores de una carrera, con los tres bloques."""
    sponsors = await db.sponsors.find(
        {"race_code": race_code.upper()}, {"_id": 0}
    ).sort("order", 1).to_list(200)

    return {"sponsors": sponsors, "race_code": race_code.upper()}


@router.post("/create", dependencies=[solo_sponsors])
async def create_sponsor(sponsor: SponsorCreate, db=Depends(get_db)):
    """Alta de un patrocinador, con su ficha completa desde el primer momento.

    Hasta septiembre de 2026 esto creaba ademas un documento en `ad_banners`,
    y desde el 26 de agosto lo hacia con un argumento que ya no existia: el
    alta reventaba con un 500 despues de haber insertado el patrocinador. Ya
    no hay segunda coleccion que estrenar.
    """
    code = sponsor.race_code.upper()
    if await db.sponsors.find_one({"name": sponsor.name, "race_code": code}):
        raise HTTPException(
            status_code=400,
            detail="Ya existe un patrocinador con ese nombre para esta carrera",
        )

    datos = sponsor.model_dump(exclude_none=True)
    _validar(datos)

    ultimo = await db.sponsors.find_one({"race_code": code}, sort=[("order", -1)])
    siguiente = (ultimo.get("order", 0) + 1) if ultimo else 1

    doc = patrocinios.nuevo(
        code,
        sponsor.name,
        order=sponsor.order or siguiente,
        **{k: v for k, v in datos.items() if k not in ("name", "race_code", "order")},
    )
    await db.sponsors.insert_one(doc)
    doc.pop("_id", None)

    return {"message": "Patrocinador creado exitosamente", "sponsor": doc}


@router.put("/update/{sponsor_name}", dependencies=[solo_sponsors])
async def update_sponsor(
    sponsor_name: str,
    race_code: str,
    updates: SponsorUpdate,
    db=Depends(get_db),
):
    """Editar cualquiera de los tres bloques.

    Las cadenas vacias se guardan como tales -asi se le quita la descripcion o
    el enlace a un patrocinador-; solo se descarta lo que llega como null, que
    es lo que el panel no mando.
    """
    sponsor = await _buscar(db, sponsor_name, race_code)

    cambios = updates.model_dump(exclude_none=True)
    if not cambios:
        raise HTTPException(status_code=400, detail="No se proporcionaron datos para actualizar")

    _validar(cambios)

    # Vaciar la vigencia se pide con cadena vacia, pero se guarda como null:
    # es lo que `vigente()` entiende como "sin limite".
    for campo in ("start_at", "end_at"):
        if cambios.get(campo) == "":
            cambios[campo] = None

    cambios["updated_at"] = datetime.now(timezone.utc)
    ops = {"$set": cambios}

    # Cada cambio de status queda registrado en la bitacora automaticamente.
    anterior = sponsor.get("status") or "prospecto"
    nuevo_status = cambios.get("status")
    if nuevo_status and nuevo_status != anterior:
        ops["$push"] = {
            "bitacora": patrocinios.entrada_bitacora(
                f"Status: {patrocinios.STATUS_LABELS.get(anterior, anterior)}"
                f" → {patrocinios.STATUS_LABELS.get(nuevo_status, nuevo_status)}",
                tipo="status",
            )
        }

    await db.sponsors.update_one(
        {"name": sponsor_name, "race_code": race_code.upper()}, ops
    )

    return {"message": "Patrocinador actualizado exitosamente"}


@router.post("/imagen/{tipo}/{sponsor_name}", dependencies=[solo_sponsors])
async def subir_imagen(
    tipo: str,
    sponsor_name: str,
    race_code: str,
    file: UploadFile = File(...),
    db=Depends(get_db),
):
    """Sube una de las tres piezas graficas del patrocinador.

    - logo:   el cuadrado de la marca. Sirve a la vitrina del sitio y al pie
              de la app: es un solo archivo, no uno por sitio como antes.
    - banner: la pieza que ocupa la barra entera del pie (1200x240).
    - detail: la imagen que se abre en la app al tocar el banner.
    """
    campo = patrocinios.IMAGENES.get(tipo)
    if not campo:
        raise HTTPException(status_code=400, detail="Tipo de imagen no válido")

    await _buscar(db, sponsor_name, race_code)

    # Sin SVG: puede llevar JavaScript dentro y se sirve desde nuestro origen,
    # asi que abrirlo ejecutaria ese script.
    permitidos = ["image/png", "image/jpeg", "image/jpg", "image/webp"]
    if file.content_type not in permitidos:
        raise HTTPException(status_code=400, detail="Tipo de archivo no permitido. Use PNG, JPG o WEBP")

    from services import file_storage

    contenido = await file.read()
    if len(contenido) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="La imagen no puede pasar de 8MB")

    ext_original = file.filename.split(".")[-1] if file.filename and "." in file.filename else "png"

    # Las tres van por `compress_banner`, que reescala pero conserva el canal
    # alfa. El logo no puede pasar por `compress_image`: esa lo convierte a
    # JPEG aplanando la transparencia contra negro, y ahora el mismo archivo
    # tiene que verse igual de bien sobre la tarjeta blanca de la vitrina que
    # sobre el pie negro de la app. Un logo de marca casi siempre es un PNG
    # recortado, y aplanarlo lo convertiria en un cuadrado negro.
    contenido, ext, content_type = file_storage.compress_banner(
        contenido, ext_original, file.content_type
    )

    filename = nombre_archivo(race_code, sponsor_name, tipo, ext)
    await file_storage.save(filename, contenido, content_type, file_storage.FOLDER_SPONSORS)

    url = f"/api/uploads/sponsors/{filename}"
    await db.sponsors.update_one(
        {"name": sponsor_name, "race_code": race_code.upper()},
        {"$set": {campo: url, "updated_at": datetime.now(timezone.utc)}},
    )
    return {"message": "Imagen subida exitosamente", "tipo": tipo, "url": url, campo: url}


@router.delete("/imagen/{tipo}/{sponsor_name}", dependencies=[solo_sponsors])
async def quitar_imagen(tipo: str, sponsor_name: str, race_code: str, db=Depends(get_db)):
    """Quita una pieza: sirve para volver del banner completo al logo y texto."""
    campo = patrocinios.IMAGENES.get(tipo)
    if not campo:
        raise HTTPException(status_code=400, detail="Tipo de imagen no válido")

    sponsor = await _buscar(db, sponsor_name, race_code)

    url = sponsor.get(campo) or ""
    if url.startswith("/api/uploads/"):
        from services import file_storage
        await file_storage.delete(url.rsplit("/", 1)[-1])

    await db.sponsors.update_one(
        {"name": sponsor_name, "race_code": race_code.upper()},
        {"$set": {campo: None, "updated_at": datetime.now(timezone.utc)}},
    )
    return {"message": "Imagen eliminada", "tipo": tipo}


@router.post("/upload-logo/{sponsor_name}", dependencies=[solo_sponsors])
async def upload_sponsor_logo(
    sponsor_name: str, race_code: str, file: UploadFile = File(...), db=Depends(get_db)
):
    """Ruta antigua del logo. Se mantiene para no romper un panel ya abierto."""
    return await subir_imagen("logo", sponsor_name, race_code, file, db)


@router.delete("/delete/{sponsor_name}", dependencies=[solo_sponsors])
async def delete_sponsor(sponsor_name: str, race_code: str, db=Depends(get_db)):
    """Retirar un patrocinador sin borrarlo: deja de salir, se conserva todo."""
    result = await db.sponsors.update_one(
        {"name": sponsor_name, "race_code": race_code.upper()},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc)}},
    )

    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Patrocinador no encontrado")

    return {"message": "Patrocinador eliminado exitosamente"}


@router.delete("/hard-delete/{sponsor_name}", dependencies=[solo_sponsors])
async def hard_delete_sponsor(sponsor_name: str, race_code: str, db=Depends(get_db)):
    """Borrar de verdad, con sus imagenes, para no dejar huerfanos en GridFS."""
    sponsor = await db.sponsors.find_one({"name": sponsor_name, "race_code": race_code.upper()})
    if not sponsor:
        raise HTTPException(status_code=404, detail="Patrocinador no encontrado")

    from services import file_storage

    for campo in patrocinios.IMAGENES.values():
        url = sponsor.get(campo) or ""
        if url.startswith("/api/uploads/"):
            await file_storage.delete(url.rsplit("/", 1)[-1])

    await db.sponsors.delete_one({"name": sponsor_name, "race_code": race_code.upper()})

    return {"message": "Patrocinador eliminado permanentemente"}


@router.post("/bitacora/{sponsor_name}", dependencies=[solo_sponsors])
async def add_bitacora_entry(
    sponsor_name: str, race_code: str, entry: BitacoraEntry, db=Depends(get_db)
):
    """Registrar un contacto en la bitacora del patrocinador."""
    nota = entry.nota.strip()
    if not nota:
        raise HTTPException(status_code=400, detail="La nota no puede estar vacía")

    result = await db.sponsors.update_one(
        {"name": sponsor_name, "race_code": race_code.upper()},
        {
            "$push": {"bitacora": patrocinios.entrada_bitacora(nota)},
            "$set": {"updated_at": datetime.now(timezone.utc)},
        },
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Patrocinador no encontrado")
    return {"message": "Contacto registrado en la bitácora"}


@router.post("/copy", dependencies=[solo_sponsors])
async def copy_sponsors(payload: SponsorCopy, db=Depends(get_db)):
    """Traer patrocinadores de otra edicion a la carrera indicada.

    Llega lo que sirve para volver a tocar la puerta -contactos, logo,
    descripcion, Instagram- pero no el resultado de la negociacion anterior:
    el proceso empieza otra vez en "prospecto", y la categoria y el monto de
    aquella vez quedan como referencia en la bitacora, no como propuesta
    vigente.

    La copia nace apagada para los dos destinos: una edicion que aun no ha
    empezado a vender no deberia estrenar vitrina con las marcas del ano
    pasado.
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

        # Las imagenes se duplican con el nombre de la carrera destino: si
        # luego se cambia el logo de una edicion, la otra conserva el suyo.
        imagenes = {}
        for tipo, campo in patrocinios.IMAGENES.items():
            url_origen = fuente.get(campo)
            if not url_origen:
                continue
            archivo_origen = url_origen.rsplit("/", 1)[-1]
            ext = archivo_origen.rsplit(".", 1)[-1] if "." in archivo_origen else "png"
            contenido = await file_storage.load(archivo_origen)
            if not contenido:
                continue
            archivo_destino = nombre_archivo(destino, name, tipo, ext)
            await file_storage.save(
                archivo_destino, contenido[0], contenido[1], file_storage.FOLDER_SPONSORS
            )
            imagenes[campo] = f"/api/uploads/sponsors/{archivo_destino}"

        categoria_anterior = sponsor_categories.etiqueta(fuente.get("propuesta_categoria"))
        monto_anterior = fuente.get("propuesta_monto")
        referencia = f" Entró como {categoria_anterior}." if categoria_anterior else ""
        referencia += f" Aportó RD${monto_anterior:,.2f}." if monto_anterior else ""

        copia = patrocinios.nuevo(
            destino,
            name,
            order=siguiente_orden,
            razon_social=fuente.get("razon_social"),
            rnc=fuente.get("rnc"),
            nombre_contacto=fuente.get("nombre_contacto"),
            posicion_contacto=fuente.get("posicion_contacto"),
            telefono=fuente.get("telefono"),
            correo=fuente.get("correo"),
            pagina_web=fuente.get("pagina_web"),
            publicar_desde=fuente.get("publicar_desde"),
            description=fuente.get("description"),
            instagram=fuente.get("instagram"),
            text=fuente.get("text"),
            link_url=fuente.get("link_url"),
            weight=fuente.get("weight"),
            mostrar_marca=fuente.get("mostrar_marca", True),
            publicar_web=False,
            publicar_app=False,
            bitacora=[patrocinios.entrada_bitacora(
                f"Traído de {origen}.{referencia}", tipo="status"
            )],
            **imagenes,
        )
        await db.sponsors.insert_one(copia)

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
    db=Depends(get_db),
):
    """Reordenar la vitrina. El mismo orden manda en la rotacion del pie."""
    for item in sponsor_orders:
        await db.sponsors.update_one(
            {"name": item["name"], "race_code": race_code.upper()},
            {"$set": {"order": item["order"], "updated_at": datetime.now(timezone.utc)}},
        )

    return {"message": "Orden actualizado exitosamente"}
