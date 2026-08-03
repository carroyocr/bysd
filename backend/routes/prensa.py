"""
Prensa: directorio de contactos de medios y planificador de eventos
(entrevistas) por contacto.

Cada contacto guarda los datos del programa/medio y sus vías de contacto.
Cuando se decide participar en una entrevista, se agenda un evento con
fecha, tema e invitados. Usa el permiso "emails" porque el objetivo de la
sección es facilitar el envío de mensajes a la prensa.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid

from services.auth import require_permission

router = APIRouter(prefix="/prensa", tags=["prensa"])

solo_emails = Depends(require_permission("emails"))

TIPOS_MEDIO = ("TV", "Radio", "Prensa escrita", "Digital", "Podcast", "Otro")
ESTADOS_EVENTO = ("programado", "realizado", "cancelado")


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
