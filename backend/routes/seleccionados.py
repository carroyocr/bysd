"""
Seleccionados del Campeonato Mundial por Equipos.

Mantenimiento del roster (titulares y reservas). Los candidatos salen de los
atletas del evento previo (BYSD-2026), que viven en las colecciones
archived_participants / participants; al seleccionar uno se copia su ficha a
la colección campeonato_seleccionados.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from datetime import datetime, timezone
import uuid

from services.auth import require_permission

router = APIRouter(prefix="/seleccionados", tags=["seleccionados"])

# Mismo permiso que las pantallas de atletas (Resultados 2026, Perfiles)
solo_atletas = Depends(require_permission("athletes"))

CATEGORIAS = ("titular", "reserva")


def get_db():
    from server import db
    return db


class SeleccionadoCreate(BaseModel):
    result_id: str  # _id del participante del evento previo
    categoria: str  # titular | reserva


class SeleccionadoUpdate(BaseModel):
    categoria: str


@router.get("/admin", dependencies=[solo_atletas])
async def list_seleccionados(db=Depends(get_db)):
    docs = await db.campeonato_seleccionados.find({}, {"_id": 0}).sort("created_at", 1).to_list(500)
    titulares = sum(1 for d in docs if d.get("categoria") == "titular")
    return {
        "seleccionados": docs,
        "stats": {
            "titulares": titulares,
            "reservas": len(docs) - titulares,
            "total": len(docs),
        },
    }


@router.post("/admin", dependencies=[solo_atletas])
async def add_seleccionado(data: SeleccionadoCreate, db=Depends(get_db)):
    from bson import ObjectId

    if data.categoria not in CATEGORIAS:
        raise HTTPException(status_code=400, detail="Categoría inválida (titular o reserva)")

    try:
        obj_id = ObjectId(data.result_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Identificador de atleta inválido")

    participante = None
    for coll_name in ["archived_participants", "participants"]:
        participante = await db[coll_name].find_one({"_id": obj_id})
        if participante:
            break
    if not participante:
        raise HTTPException(status_code=404, detail="Atleta del evento previo no encontrado")

    bib = participante.get("bib")
    ya_esta = await db.campeonato_seleccionados.find_one(
        {"$or": [{"result_id": data.result_id}, {"bib": bib}]}
    )
    if ya_esta:
        raise HTTPException(status_code=400, detail="Ese atleta ya está en la selección")

    doc = {
        "id": str(uuid.uuid4()),
        "result_id": data.result_id,
        "bib": bib,
        "nombre": participante.get("nombre", ""),
        "apellidos": participante.get("apellidos", ""),
        "sexo": participante.get("sexo", ""),
        "nacionalidad": participante.get("nacionalidad", ""),
        "laps_completed": participante.get("laps_completed", 0),
        "categoria": data.categoria,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.campeonato_seleccionados.insert_one({**doc})
    return {"success": True, "seleccionado": doc}


@router.put("/admin/{seleccionado_id}", dependencies=[solo_atletas])
async def update_seleccionado(seleccionado_id: str, data: SeleccionadoUpdate, db=Depends(get_db)):
    if data.categoria not in CATEGORIAS:
        raise HTTPException(status_code=400, detail="Categoría inválida (titular o reserva)")

    result = await db.campeonato_seleccionados.update_one(
        {"id": seleccionado_id}, {"$set": {"categoria": data.categoria}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Seleccionado no encontrado")
    return {"success": True}


@router.delete("/admin/{seleccionado_id}", dependencies=[solo_atletas])
async def delete_seleccionado(seleccionado_id: str, db=Depends(get_db)):
    result = await db.campeonato_seleccionados.delete_one({"id": seleccionado_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Seleccionado no encontrado")
    return {"success": True}
