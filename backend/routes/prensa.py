"""
Prensa: directorio de contactos de medios, planificador de entrevistas y
las notas publicadas.

Cada contacto guarda los datos del programa/medio y sus vías de contacto.
Cuando se decide participar en una entrevista, se agenda un evento con
fecha, tema e invitados. Usa el permiso "emails" porque el objetivo de la
sección es facilitar el envío de mensajes a la prensa.

Las notas son lo que se publica, y van en dos sabores: el *comunicado*, que
escribe la organización y se lee dentro del sitio, y la *aparición*, que
publicó un medio y solo se enlaza. Se guardan juntas porque para quien las
consulta son la misma lista ordenada por fecha, y porque el año se cuenta
mezclando las dos.
"""
import re
import unicodedata
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel

from services.auth import require_permission

router = APIRouter(prefix="/prensa", tags=["prensa"])

solo_emails = Depends(require_permission("emails"))

TIPOS_MEDIO = ("TV", "Radio", "Prensa escrita", "Digital", "Podcast", "Otro")
ESTADOS_EVENTO = ("programado", "realizado", "cancelado")

# Comunicado: lo escribe la organizacion y se lee en el sitio.
# Aparicion: lo publico un medio y solo se enlaza.
TIPOS_NOTA = ("comunicado", "aparicion")


def get_db():
    from server import db
    return db


class ContactoCreate(BaseModel):
    nombre_programa: str
    nombre_medio: str
    tipo_medio: str
    nombre_contacto: Optional[str] = None
    posicion: Optional[str] = None
    telefono: Optional[str] = None
    celular: Optional[str] = None
    email: Optional[str] = None
    pagina_web: Optional[str] = None


class ContactoUpdate(BaseModel):
    nombre_programa: Optional[str] = None
    nombre_medio: Optional[str] = None
    tipo_medio: Optional[str] = None
    nombre_contacto: Optional[str] = None
    posicion: Optional[str] = None
    telefono: Optional[str] = None
    celular: Optional[str] = None
    email: Optional[str] = None
    pagina_web: Optional[str] = None


class EventoCreate(BaseModel):
    fecha: str  # ISO date (YYYY-MM-DD)
    hora: Optional[str] = None  # HH:MM
    tema: str
    invitados: Optional[str] = None
    notas: Optional[str] = None


class EventoUpdate(BaseModel):
    fecha: Optional[str] = None
    hora: Optional[str] = None
    tema: Optional[str] = None
    invitados: Optional[str] = None
    notas: Optional[str] = None
    estado: Optional[str] = None


@router.get("/admin/contactos", dependencies=[solo_emails])
async def list_contactos(db=Depends(get_db)):
    contactos = await db.prensa_contactos.find({}, {"_id": 0}).sort("nombre_medio", 1).to_list(500)
    eventos = await db.prensa_eventos.find({}, {"_id": 0}).sort([("fecha", 1), ("hora", 1)]).to_list(2000)

    por_contacto = {}
    for ev in eventos:
        por_contacto.setdefault(ev.get("contacto_id"), []).append(ev)
    for c in contactos:
        c["eventos"] = por_contacto.get(c["id"], [])

    return {
        "contactos": contactos,
        "stats": {
            "total": len(contactos),
            "eventos_programados": sum(1 for e in eventos if e.get("estado") == "programado"),
        },
    }


@router.post("/admin/contactos", dependencies=[solo_emails])
async def create_contacto(data: ContactoCreate, db=Depends(get_db)):
    if data.tipo_medio not in TIPOS_MEDIO:
        raise HTTPException(status_code=400, detail="Tipo de medio inválido")

    doc = {
        "id": str(uuid.uuid4()),
        "nombre_programa": data.nombre_programa.strip(),
        "nombre_medio": data.nombre_medio.strip(),
        "tipo_medio": data.tipo_medio,
        "nombre_contacto": (data.nombre_contacto or "").strip(),
        "posicion": (data.posicion or "").strip(),
        "telefono": (data.telefono or "").strip(),
        "celular": (data.celular or "").strip(),
        "email": (data.email or "").strip(),
        "pagina_web": (data.pagina_web or "").strip(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.prensa_contactos.insert_one({**doc})
    doc["eventos"] = []
    return {"success": True, "contacto": doc}


@router.put("/admin/contactos/{contacto_id}", dependencies=[solo_emails])
async def update_contacto(contacto_id: str, data: ContactoUpdate, db=Depends(get_db)):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if "tipo_medio" in updates and updates["tipo_medio"] not in TIPOS_MEDIO:
        raise HTTPException(status_code=400, detail="Tipo de medio inválido")
    if not updates:
        raise HTTPException(status_code=400, detail="Nada que actualizar")

    result = await db.prensa_contactos.update_one({"id": contacto_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Contacto no encontrado")
    return {"success": True}


@router.delete("/admin/contactos/{contacto_id}", dependencies=[solo_emails])
async def delete_contacto(contacto_id: str, db=Depends(get_db)):
    result = await db.prensa_contactos.delete_one({"id": contacto_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Contacto no encontrado")
    await db.prensa_eventos.delete_many({"contacto_id": contacto_id})
    return {"success": True}


@router.post("/admin/contactos/{contacto_id}/eventos", dependencies=[solo_emails])
async def create_evento(contacto_id: str, data: EventoCreate, db=Depends(get_db)):
    contacto = await db.prensa_contactos.find_one({"id": contacto_id})
    if not contacto:
        raise HTTPException(status_code=404, detail="Contacto no encontrado")

    doc = {
        "id": str(uuid.uuid4()),
        "contacto_id": contacto_id,
        "fecha": data.fecha,
        "hora": (data.hora or "").strip(),
        "tema": data.tema.strip(),
        "invitados": (data.invitados or "").strip(),
        "notas": (data.notas or "").strip(),
        "estado": "programado",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.prensa_eventos.insert_one({**doc})
    return {"success": True, "evento": doc}


@router.put("/admin/eventos/{evento_id}", dependencies=[solo_emails])
async def update_evento(evento_id: str, data: EventoUpdate, db=Depends(get_db)):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if "estado" in updates and updates["estado"] not in ESTADOS_EVENTO:
        raise HTTPException(status_code=400, detail="Estado inválido")
    if not updates:
        raise HTTPException(status_code=400, detail="Nada que actualizar")

    result = await db.prensa_eventos.update_one({"id": evento_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    return {"success": True}


@router.delete("/admin/eventos/{evento_id}", dependencies=[solo_emails])
async def delete_evento(evento_id: str, db=Depends(get_db)):
    result = await db.prensa_eventos.delete_one({"id": evento_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    return {"success": True}


# ==================== NOTAS DE PRENSA ====================


class NotaCreate(BaseModel):
    tipo: str                          # 'comunicado' o 'aparicion'
    titulo: str
    fecha: str                         # ISO date (YYYY-MM-DD)
    resumen: Optional[str] = None      # la bajada; es lo que se lee en la lista
    medio: Optional[str] = None        # aparicion: quien la publico
    url: Optional[str] = None          # aparicion: donde leerla
    contenido: Optional[str] = None    # comunicado: el texto, en HTML
    imagen_url: Optional[str] = None
    publicada: bool = True


class NotaUpdate(BaseModel):
    tipo: Optional[str] = None
    titulo: Optional[str] = None
    fecha: Optional[str] = None
    resumen: Optional[str] = None
    medio: Optional[str] = None
    url: Optional[str] = None
    contenido: Optional[str] = None
    imagen_url: Optional[str] = None
    publicada: Optional[bool] = None


def _slug(titulo: str) -> str:
    """Trozo de URL a partir del titulo: «Se abre la inscripción» -> se-abre-la-inscripcion."""
    sin_tildes = unicodedata.normalize("NFKD", titulo or "").encode("ascii", "ignore").decode()
    limpio = re.sub(r"[^a-z0-9]+", "-", sin_tildes.lower()).strip("-")
    return limpio[:70] or "nota"


async def _slug_libre(db, titulo: str, excluir_id: Optional[str] = None) -> str:
    """El slug vive en la URL de la nota, asi que no puede repetirse. Si ya
    existe se le pega un numero: ...-2, ...-3."""
    base = _slug(titulo)
    candidato = base
    n = 1
    while True:
        query = {"slug": candidato}
        if excluir_id:
            query["id"] = {"$ne": excluir_id}
        if not await db.notas_prensa.find_one(query, {"_id": 1}):
            return candidato
        n += 1
        candidato = f"{base}-{n}"


def _validar_nota(datos: dict, existente: Optional[dict] = None) -> None:
    """Lo que no puede faltar segun el tipo.

    Una aparicion sin enlace no lleva a ninguna parte y un comunicado sin texto
    abre una pagina vacia: las dos son la misma clase de nota rota, y es mejor
    cortarlas aqui que descubrirlas publicadas.
    """
    base = dict(existente or {})
    base.update({k: v for k, v in datos.items() if v is not None})

    tipo = base.get("tipo")
    if tipo not in TIPOS_NOTA:
        raise HTTPException(status_code=400, detail="Tipo de nota inválido")
    if not (base.get("titulo") or "").strip():
        raise HTTPException(status_code=400, detail="La nota necesita un título")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", base.get("fecha") or ""):
        raise HTTPException(status_code=400, detail="La fecha debe ser AAAA-MM-DD")

    if tipo == "aparicion":
        url = (base.get("url") or "").strip()
        if not url:
            raise HTTPException(status_code=400, detail="Una aparición necesita el enlace a la publicación")
        if not url.startswith(("http://", "https://")):
            raise HTTPException(status_code=400, detail="El enlace debe empezar por http:// o https://")
        if not (base.get("medio") or "").strip():
            raise HTTPException(status_code=400, detail="Una aparición necesita el nombre del medio")
    else:
        texto = re.sub(r"<[^>]+>", "", base.get("contenido") or "").strip()
        if not texto:
            raise HTTPException(status_code=400, detail="Un comunicado necesita su texto")


def _nota_publica(doc: dict, con_contenido: bool = False) -> dict:
    """Lo que sale al sitio. El contenido solo en la ficha: en la lista son
    decenas de notas y no hace falta mandar el texto entero de cada una."""
    salida = {
        "id": doc.get("id"),
        "slug": doc.get("slug"),
        "tipo": doc.get("tipo"),
        "titulo": doc.get("titulo", ""),
        "fecha": doc.get("fecha", ""),
        "resumen": doc.get("resumen") or "",
        "medio": doc.get("medio") or "",
        "url": doc.get("url") or "",
        "imagen_url": doc.get("imagen_url") or "",
    }
    if con_contenido:
        salida["contenido"] = doc.get("contenido") or ""
    return salida


# ---------------- Público ----------------


@router.get("/notas")
async def listar_notas_publicas(db=Depends(get_db)):
    """Las notas publicadas, de la más reciente a la más vieja."""
    notas = await db.notas_prensa.find(
        {"publicada": True}, {"_id": 0}
    ).sort([("fecha", -1), ("created_at", -1)]).to_list(500)
    return {"notas": [_nota_publica(n) for n in notas]}


@router.get("/notas/{slug}")
async def ver_nota_publica(slug: str, db=Depends(get_db)):
    """Un comunicado, para leerlo en el sitio."""
    nota = await db.notas_prensa.find_one({"slug": slug, "publicada": True}, {"_id": 0})
    if not nota:
        raise HTTPException(status_code=404, detail="Nota no encontrada")
    return _nota_publica(nota, con_contenido=True)


# ---------------- Panel ----------------


@router.get("/admin/notas", dependencies=[solo_emails])
async def listar_notas_admin(db=Depends(get_db)):
    """Todas, incluidos los borradores."""
    notas = await db.notas_prensa.find({}, {"_id": 0}).sort(
        [("fecha", -1), ("created_at", -1)]
    ).to_list(500)
    return {"notas": notas}


@router.post("/admin/notas", dependencies=[solo_emails])
async def crear_nota(datos: NotaCreate, db=Depends(get_db)):
    entrada = datos.dict()
    _validar_nota(entrada)

    ahora = datetime.now(timezone.utc)
    nota = {
        **entrada,
        "titulo": entrada["titulo"].strip(),
        "id": str(uuid.uuid4()),
        "slug": await _slug_libre(db, entrada["titulo"]),
        "created_at": ahora,
        "updated_at": ahora,
    }
    await db.notas_prensa.insert_one(nota)
    nota.pop("_id", None)
    return nota


@router.put("/admin/notas/{nota_id}", dependencies=[solo_emails])
async def actualizar_nota(nota_id: str, datos: NotaUpdate, db=Depends(get_db)):
    existente = await db.notas_prensa.find_one({"id": nota_id}, {"_id": 0})
    if not existente:
        raise HTTPException(status_code=404, detail="Nota no encontrada")

    cambios = {k: v for k, v in datos.dict().items() if v is not None}
    if not cambios:
        return existente
    _validar_nota(cambios, existente)

    if "titulo" in cambios:
        cambios["titulo"] = cambios["titulo"].strip()
        # El slug sigue al titulo, pero solo mientras la nota este sin publicar:
        # una vez publicada su URL puede estar repartida y cambiarla la rompe.
        if not existente.get("publicada"):
            cambios["slug"] = await _slug_libre(db, cambios["titulo"], excluir_id=nota_id)

    cambios["updated_at"] = datetime.now(timezone.utc)
    await db.notas_prensa.update_one({"id": nota_id}, {"$set": cambios})
    return await db.notas_prensa.find_one({"id": nota_id}, {"_id": 0})


@router.delete("/admin/notas/{nota_id}", dependencies=[solo_emails])
async def borrar_nota(nota_id: str, db=Depends(get_db)):
    resultado = await db.notas_prensa.delete_one({"id": nota_id})
    if resultado.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Nota no encontrada")
    return {"success": True}


@router.post("/admin/notas/imagen", dependencies=[solo_emails])
async def subir_imagen_nota(file: UploadFile = File(...)):
    """La foto que acompaña a la nota. Va a GridFS: el disco del contenedor se
    borra en cada despliegue."""
    from services import file_storage

    # Sin SVG: puede llevar JavaScript dentro y se sirve desde nuestro origen.
    if file.content_type not in ("image/png", "image/jpeg", "image/jpg", "image/webp"):
        raise HTTPException(status_code=400, detail="Usa PNG, JPG o WEBP")

    contenido = await file.read()
    if len(contenido) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="La imagen no puede pasar de 8MB")

    ext_original = file.filename.split(".")[-1] if file.filename and "." in file.filename else "jpg"
    contenido, ext, content_type = file_storage.compress_image(
        contenido, ext_original, file.content_type
    )

    filename = f"nota-{uuid.uuid4().hex}.{ext}"
    await file_storage.save(filename, contenido, content_type, file_storage.FOLDER_PRENSA)
    return {"url": f"/api/uploads/prensa/{filename}"}
