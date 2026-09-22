"""Patrocinadores: una ficha por marca, con la lista de carreras que patrocina.

La ficha (quien es la empresa: contactos, logo, descripcion) se guarda una vez.
Lo que se negocia por evento -status, categoria, monto, donde se ve, el arte de
esa campana y las metricas- vive en `participaciones`, una por carrera. El
reparto exacto y el porque estan en `services/patrocinios.py`.

Las rutas del panel identifican la marca por su `id`, no por el nombre: asi
renombrar una empresa no desengancha nada. Las de una carrera concreta llevan
ademas el `race_code`.

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


class FichaBase(BaseModel):
    """La marca: lo que no cambia de una edicion a otra."""
    razon_social: Optional[str] = None
    rnc: Optional[str] = None
    nombre_contacto: Optional[str] = None
    posicion_contacto: Optional[str] = None
    telefono: Optional[str] = None
    correo: Optional[str] = None
    pagina_web: Optional[str] = None
    description: Optional[str] = None
    instagram: Optional[str] = None


class FichaCreate(FichaBase):
    name: str
    # Las carreras que patrocina desde el primer momento. Se pueden marcar
    # despues desde la pestana "Carreras" de su ficha.
    races: List[str] = []


class FichaUpdate(FichaBase):
    name: Optional[str] = None
    is_active: Optional[bool] = None


class ParticipacionUpdate(BaseModel):
    """Lo que la marca negocia y publica en una carrera concreta."""
    order: Optional[int] = None
    status: Optional[str] = None
    publicar_desde: Optional[str] = None
    propuesta_categoria: Optional[str] = None
    propuesta_monto: Optional[float] = None
    publicar_web: Optional[bool] = None
    publicar_app: Optional[bool] = None
    mostrar_marca: Optional[bool] = None
    weight: Optional[int] = Field(default=None, ge=1, le=10)
    start_at: Optional[str] = None
    end_at: Optional[str] = None
    text: Optional[str] = None
    link_url: Optional[str] = None


class BitacoraEntry(BaseModel):
    nota: str


def get_db():
    from server import db
    return db


def _slug(texto: str) -> str:
    limpio = unicodedata.normalize("NFKD", texto.lower())
    limpio = limpio.encode("ascii", "ignore").decode("ascii")
    limpio = re.sub(r"[^a-z0-9\-]", "-", limpio)
    return re.sub(r"-+", "-", limpio).strip("-")


def nombre_archivo(race_code: Optional[str], sponsor_name: str, tipo: str, ext: str = "png") -> str:
    """Nombre del archivo de una imagen: sin acentos ni simbolos.

    Se nombra por el patrocinador y no por su `id` para que el archivo se
    pueda reconocer de un vistazo en GridFS. El logo es de la marca y no
    lleva carrera delante; el banner y la imagen ampliada son de una edicion
    concreta y si la llevan.
    """
    sufijo = "" if tipo == "logo" else f"_{tipo}"
    if tipo == "logo":
        return f"MARCA_{_slug(sponsor_name)}.{ext}"
    return f"{(race_code or '').upper()}_{_slug(sponsor_name)}{sufijo}.{ext}"


def archivo_de_url(url: str) -> str:
    """El nombre del archivo dentro de una URL de pieza, sin la marca de version.

    Las URLs se guardan con `?v=<fecha>` para que al reemplazar una pieza el
    telefono no siga ensenando la vieja durante las 24 horas que dura su
    cache. En GridFS el archivo se llama sin esa cola, asi que todo lo que
    vaya a buscarlo por nombre tiene que quitarla.
    """
    return url.rsplit("/", 1)[-1].split("?", 1)[0]


async def _ficha(db, sponsor_id: str) -> dict:
    doc = await db.sponsors.find_one({"id": sponsor_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Patrocinador no encontrado")
    return doc


def _participacion(doc: dict, race_code: str) -> dict:
    part = patrocinios.participacion(doc, race_code)
    if not part:
        raise HTTPException(
            status_code=404,
            detail="Este patrocinador no está marcado en esa carrera",
        )
    return part


def _validar(datos: dict) -> None:
    """Las validaciones de una participacion: pipeline, categoria y fechas."""
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


async def _siguiente_orden(db, race_code: str) -> int:
    """El orden que le toca al proximo que entre en esa carrera."""
    code = race_code.upper()
    ordenes = [
        part.get("order", 0)
        async for doc in db.sponsors.find(
            {"participaciones.race_code": code}, {"participaciones": 1}
        )
        for part in doc.get("participaciones", [])
        if (part.get("race_code") or "").upper() == code
    ]
    return (max(ordenes) + 1) if ordenes else 1


async def _guardar_participaciones(db, sponsor_id: str, participaciones: list) -> None:
    await db.sponsors.update_one(
        {"id": sponsor_id},
        {"$set": {
            "participaciones": participaciones,
            "updated_at": datetime.now(timezone.utc),
        }},
    )


@router.get("/race/{race_code}")
async def get_sponsors_by_race(race_code: str, destino: str = "web", db=Depends(get_db)):
    """Patrocinadores publicados de una carrera (publico).

    `destino` dice quien pregunta: "web" es la pagina de patrocinadores del
    sitio y "app" la vitrina de BYSD Live. Sale quien tenga encendido el
    interruptor de ese destino **y** cuyo proceso comercial de esa carrera haya
    llegado al momento de publicar.

    La respuesta es la de siempre, campo por campo: la ficha y su participacion
    se aplanan en `vista_vitrina`.
    """
    code = race_code.upper()
    docs = await db.sponsors.find({"participaciones.race_code": code}).to_list(400)

    sponsors = []
    for doc in docs:
        part = patrocinios.participacion(doc, code)
        if not part or not patrocinios.sale_en(doc, part, destino):
            continue
        sponsors.append(patrocinios.vista_vitrina(doc, part))

    sponsors.sort(key=lambda s: s.get("order") or 0)
    return {"sponsors": sponsors, "race_code": code}


@router.get("/admin", dependencies=[solo_sponsors])
async def get_sponsors_admin(db=Depends(get_db)):
    """Todas las fichas, con sus participaciones dentro.

    El panel las filtra por carrera y por status sin volver a preguntar: son
    unas decenas de marcas y caben de sobra en una sola respuesta.
    """
    sponsors = await db.sponsors.find({}, {"_id": 0}).sort("name", 1).to_list(400)
    for doc in sponsors:
        doc.setdefault("participaciones", [])
        doc["participaciones"].sort(key=lambda p: p.get("race_code") or "")
    return {"sponsors": sponsors}


@router.get("/admin/race/{race_code}", dependencies=[solo_sponsors])
async def get_sponsors_admin_race(race_code: str, db=Depends(get_db)):
    """Las marcas de una carrera, con su participacion aplanada en la ficha.

    Es la vista de una sola edicion, para lo que solo mira a una carrera.
    """
    code = race_code.upper()
    docs = await db.sponsors.find(
        {"participaciones.race_code": code}, {"_id": 0}
    ).to_list(400)

    sponsors = []
    for doc in docs:
        part = patrocinios.participacion(doc, code)
        if not part:
            continue
        plano = {k: v for k, v in doc.items() if k != "participaciones"}
        plano.update({k: v for k, v in part.items() if k != "id"})
        sponsors.append(plano)

    sponsors.sort(key=lambda s: s.get("order") or 0)
    return {"sponsors": sponsors, "race_code": code}


@router.post("/create", dependencies=[solo_sponsors])
async def create_sponsor(ficha: FichaCreate, db=Depends(get_db)):
    """Alta de una marca. Las carreras que patrocine se marcan aqui o despues."""
    name = ficha.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="El nombre es obligatorio")

    # Sin dos marcas con el mismo nombre: la gracia de la ficha unica es que
    # "Cedimat" sea una sola en todo el panel.
    if await db.sponsors.find_one({"name": re.compile(f"^{re.escape(name)}$", re.I)}):
        raise HTTPException(status_code=400, detail="Ya existe un patrocinador con ese nombre")

    datos = ficha.model_dump(exclude_none=True)
    doc = patrocinios.nueva_ficha(
        name, **{k: v for k, v in datos.items() if k not in ("name", "races")}
    )

    for code in dict.fromkeys(c.upper() for c in ficha.races if c):
        doc["participaciones"].append(
            patrocinios.nueva_participacion(code, order=await _siguiente_orden(db, code))
        )

    await db.sponsors.insert_one(doc)
    doc.pop("_id", None)
    return {"message": "Patrocinador creado exitosamente", "sponsor": doc}


@router.put("/{sponsor_id}", dependencies=[solo_sponsors])
async def update_sponsor(sponsor_id: str, updates: FichaUpdate, db=Depends(get_db)):
    """Editar la ficha de la marca: contactos, descripcion, Instagram.

    Las cadenas vacias se guardan como tales -asi se le quita la descripcion a
    una marca-; solo se descarta lo que llega como null, que es lo que el panel
    no mando.
    """
    doc = await _ficha(db, sponsor_id)

    cambios = updates.model_dump(exclude_none=True)
    if not cambios:
        raise HTTPException(status_code=400, detail="No se proporcionaron datos para actualizar")

    nombre = (cambios.get("name") or "").strip()
    if nombre and nombre.lower() != (doc.get("name") or "").lower():
        if await db.sponsors.find_one({
            "name": re.compile(f"^{re.escape(nombre)}$", re.I),
            "id": {"$ne": sponsor_id},
        }):
            raise HTTPException(status_code=400, detail="Ya existe un patrocinador con ese nombre")
        cambios["name"] = nombre

    cambios["updated_at"] = datetime.now(timezone.utc)
    await db.sponsors.update_one({"id": sponsor_id}, {"$set": cambios})
    return {"message": "Patrocinador actualizado exitosamente"}


@router.put("/{sponsor_id}/carrera/{race_code}", dependencies=[solo_sponsors])
async def guardar_participacion(
    sponsor_id: str, race_code: str, updates: ParticipacionUpdate, db=Depends(get_db)
):
    """Marcar la carrera, o editar lo que la marca negocia en ella.

    Si todavia no estaba marcada, se crea la participacion: es lo que hace la
    casilla de la carrera en la ficha. Si ya estaba, se editan sus campos.
    """
    doc = await _ficha(db, sponsor_id)
    code = race_code.upper()

    cambios = updates.model_dump(exclude_none=True)
    _validar(cambios)

    # Vaciar la vigencia se pide con cadena vacia, pero se guarda como null:
    # es lo que `vigente()` entiende como "sin limite".
    for campo in ("start_at", "end_at"):
        if cambios.get(campo) == "":
            cambios[campo] = None

    participaciones = list(doc.get("participaciones") or [])
    part = patrocinios.participacion(doc, code)

    if not part:
        nueva = patrocinios.nueva_participacion(
            code, order=cambios.pop("order", None) or await _siguiente_orden(db, code), **cambios
        )
        participaciones.append(nueva)
        await _guardar_participaciones(db, sponsor_id, participaciones)
        return {"message": f"Patrocinador añadido a {code}", "participacion": nueva}

    # Cada cambio de status queda registrado en la bitacora de esa carrera.
    anterior = part.get("status") or "prospecto"
    nuevo_status = cambios.get("status")
    if nuevo_status and nuevo_status != anterior:
        part.setdefault("bitacora", []).append(patrocinios.entrada_bitacora(
            f"Status: {patrocinios.STATUS_LABELS.get(anterior, anterior)}"
            f" → {patrocinios.STATUS_LABELS.get(nuevo_status, nuevo_status)}",
            tipo="status",
        ))

    part.update(cambios)
    await _guardar_participaciones(db, sponsor_id, participaciones)
    return {"message": "Participación actualizada", "participacion": part}


@router.delete("/{sponsor_id}/carrera/{race_code}", dependencies=[solo_sponsors])
async def quitar_participacion(sponsor_id: str, race_code: str, db=Depends(get_db)):
    """Desmarcar una carrera: la marca deja de patrocinarla.

    Se borra tambien el arte de esa campana, que no sirve para ninguna otra.
    El logo no se toca: es de la marca y lo comparten todas las ediciones.
    """
    doc = await _ficha(db, sponsor_id)
    code = race_code.upper()
    part = _participacion(doc, code)

    from services import file_storage

    for campo in patrocinios.IMAGENES_CARRERA.values():
        url = part.get(campo) or ""
        if url.startswith("/api/uploads/"):
            await file_storage.delete(archivo_de_url(url))

    participaciones = [
        p for p in doc.get("participaciones") or []
        if (p.get("race_code") or "").upper() != code
    ]
    await _guardar_participaciones(db, sponsor_id, participaciones)
    return {"message": f"Patrocinador quitado de {code}"}


@router.post("/{sponsor_id}/imagen/{tipo}", dependencies=[solo_sponsors])
async def subir_imagen(
    tipo: str,
    sponsor_id: str,
    race_code: Optional[str] = None,
    file: UploadFile = File(...),
    db=Depends(get_db),
):
    """Sube una de las tres piezas graficas.

    - logo:   el cuadrado de la marca. Es de la ficha: sirve a la vitrina del
              sitio y al pie de la app en todas las ediciones.
    - banner: la pieza que ocupa la barra entera del pie (1200x240).
    - detail: la imagen que se abre en la app al tocar el banner.

    Las dos ultimas son el arte de una campana, asi que piden `race_code`.
    """
    if tipo not in patrocinios.IMAGENES:
        raise HTTPException(status_code=400, detail="Tipo de imagen no válido")
    campo = patrocinios.IMAGENES[tipo]
    es_de_la_marca = tipo in patrocinios.IMAGEN_MARCA

    if not es_de_la_marca and not race_code:
        raise HTTPException(status_code=400, detail="Falta la carrera de esta pieza")

    doc = await _ficha(db, sponsor_id)
    part = None if es_de_la_marca else _participacion(doc, race_code)

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
    # JPEG aplanando la transparencia contra negro, y el mismo archivo tiene
    # que verse igual de bien sobre la tarjeta blanca de la vitrina que sobre
    # el pie negro de la app. Un logo de marca casi siempre es un PNG
    # recortado, y aplanarlo lo convertiria en un cuadrado negro.
    contenido, ext, content_type = file_storage.compress_banner(
        contenido, ext_original, file.content_type
    )

    filename = nombre_archivo(race_code, doc["name"], tipo, ext)
    await file_storage.save(filename, contenido, content_type, file_storage.FOLDER_SPONSORS)

    # El nombre del archivo no cambia al reemplazar una pieza -se construye con
    # el nombre de la marca-, asi que sin esta marca de version el telefono
    # seguiria ensenando la imagen vieja hasta que caducase su cache.
    version = int(datetime.now(timezone.utc).timestamp())
    url = f"/api/uploads/sponsors/{filename}?v={version}"

    if es_de_la_marca:
        await db.sponsors.update_one(
            {"id": sponsor_id},
            {"$set": {campo: url, "updated_at": datetime.now(timezone.utc)}},
        )
    else:
        part[campo] = url
        await _guardar_participaciones(db, sponsor_id, doc["participaciones"])

    return {"message": "Imagen subida exitosamente", "tipo": tipo, "url": url, campo: url}


@router.delete("/{sponsor_id}/imagen/{tipo}", dependencies=[solo_sponsors])
async def quitar_imagen(
    tipo: str, sponsor_id: str, race_code: Optional[str] = None, db=Depends(get_db)
):
    """Quita una pieza: sirve para volver del banner completo al logo y texto."""
    if tipo not in patrocinios.IMAGENES:
        raise HTTPException(status_code=400, detail="Tipo de imagen no válido")
    campo = patrocinios.IMAGENES[tipo]
    es_de_la_marca = tipo in patrocinios.IMAGEN_MARCA

    if not es_de_la_marca and not race_code:
        raise HTTPException(status_code=400, detail="Falta la carrera de esta pieza")

    doc = await _ficha(db, sponsor_id)
    part = None if es_de_la_marca else _participacion(doc, race_code)

    url = (doc if es_de_la_marca else part).get(campo) or ""
    if url.startswith("/api/uploads/"):
        from services import file_storage
        await file_storage.delete(archivo_de_url(url))

    if es_de_la_marca:
        await db.sponsors.update_one(
            {"id": sponsor_id},
            {"$set": {campo: None, "updated_at": datetime.now(timezone.utc)}},
        )
    else:
        part[campo] = None
        await _guardar_participaciones(db, sponsor_id, doc["participaciones"])

    return {"message": "Imagen eliminada", "tipo": tipo}


@router.delete("/{sponsor_id}", dependencies=[solo_sponsors])
async def retirar_sponsor(sponsor_id: str, db=Depends(get_db)):
    """Retirar una marca sin borrarla: deja de salir en todas sus carreras."""
    result = await db.sponsors.update_one(
        {"id": sponsor_id},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc)}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Patrocinador no encontrado")
    return {"message": "Patrocinador retirado"}


@router.delete("/{sponsor_id}/permanente", dependencies=[solo_sponsors])
async def borrar_sponsor(sponsor_id: str, db=Depends(get_db)):
    """Borrar de verdad, con sus imagenes, para no dejar huerfanos en GridFS."""
    doc = await _ficha(db, sponsor_id)

    from services import file_storage

    urls = [doc.get("logo_url") or ""]
    for part in doc.get("participaciones") or []:
        urls += [part.get(c) or "" for c in patrocinios.IMAGENES_CARRERA.values()]
    for url in urls:
        if url.startswith("/api/uploads/"):
            await file_storage.delete(archivo_de_url(url))

    await db.sponsors.delete_one({"id": sponsor_id})
    return {"message": "Patrocinador eliminado permanentemente"}


@router.post("/{sponsor_id}/bitacora", dependencies=[solo_sponsors])
async def add_bitacora_entry(
    sponsor_id: str, race_code: str, entry: BitacoraEntry, db=Depends(get_db)
):
    """Registrar un contacto en la bitacora de esa carrera."""
    nota = entry.nota.strip()
    if not nota:
        raise HTTPException(status_code=400, detail="La nota no puede estar vacía")

    doc = await _ficha(db, sponsor_id)
    part = _participacion(doc, race_code)
    part.setdefault("bitacora", []).append(patrocinios.entrada_bitacora(nota))
    await _guardar_participaciones(db, sponsor_id, doc["participaciones"])
    return {"message": "Contacto registrado en la bitácora"}


@router.post("/reorder", dependencies=[solo_sponsors])
async def reorder_sponsors(
    race_code: str,
    sponsor_orders: List[dict],  # [{"id": "...", "order": 1}, ...]
    db=Depends(get_db),
):
    """Reordenar la vitrina de una carrera. El mismo orden manda en el pie."""
    code = race_code.upper()
    for item in sponsor_orders:
        await db.sponsors.update_one(
            {"id": item.get("id"), "participaciones.race_code": code},
            {
                "$set": {
                    "participaciones.$.order": item.get("order", 0),
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )
    return {"message": "Orden actualizado exitosamente"}
