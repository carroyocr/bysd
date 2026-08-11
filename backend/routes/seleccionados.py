"""
Seleccionados del Campeonato Mundial por Equipos.

Mantenimiento del roster (titulares y reservas). Los candidatos salen de los
atletas del evento previo (BYSD-2026), que viven en las colecciones
archived_participants / participants; al seleccionar uno se copia su ficha a
la colección campeonato_seleccionados.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import re
import uuid

from services.auth import require_permission

router = APIRouter(prefix="/seleccionados", tags=["seleccionados"])

# Mismo permiso que las pantallas de atletas (Resultados 2026, Perfiles)
solo_atletas = Depends(require_permission("athletes"))

CATEGORIAS = ("titular", "reserva")

# La nomina es la lista de quien va al campeonato; la carrera se corre sobre
# `registrations`, como cualquier otra. Se mantienen a la par: entrar en la
# nomina inscribe, y salir de ella desinscribe. Antes el campeonato tenia su
# propia rama en el control de carrera y por eso no podia correrse -- ni el QR
# ni el control de vueltas miraban en esta coleccion.
MUNDIAL = "MUNDIAL-2026"


async def _siguiente_dorsal(db) -> str:
    inscritos = await db.registrations.find(
        {"race_code": MUNDIAL}, {"bib": 1}
    ).to_list(500)

    numeros = []
    for i in inscritos:
        try:
            numeros.append(int(str(i.get("bib") or "").lstrip("0") or 0))
        except ValueError:
            continue

    return f"{(max(numeros) if numeros else 0) + 1:03d}"


async def _correo_conocido(db, seleccionado: dict) -> Optional[str]:
    """Correo del atleta, si se puede averiguar por su paso por 2026."""
    from bson import ObjectId
    from migrations.bib_email_2026 import BIB_EMAIL_MAP

    bib_previo = str(seleccionado.get("bib") or "").zfill(3)
    if bib_previo in BIB_EMAIL_MAP:
        return BIB_EMAIL_MAP[bib_previo]

    if seleccionado.get("result_id"):
        try:
            corredor = await db.participants.find_one({"_id": ObjectId(seleccionado["result_id"])})
        except Exception:
            corredor = None
        if corredor and corredor.get("claimed_by"):
            try:
                atleta = await db.athletes.find_one({"_id": ObjectId(corredor["claimed_by"])})
            except Exception:
                atleta = None
            if atleta and atleta.get("email"):
                return atleta["email"]

    return None


async def inscribir_en_el_mundial(db, seleccionado: dict) -> Optional[dict]:
    """Da de alta al seleccionado como corredor del campeonato."""
    carrera = await db.race_configurations.find_one({"code": MUNDIAL})
    if not carrera:
        return None

    ya_esta = await db.registrations.find_one(
        {"race_code": MUNDIAL, "seleccionado_id": seleccionado["id"]}
    )
    if ya_esta:
        return None

    dorsal = await _siguiente_dorsal(db)
    correo = await _correo_conocido(db, seleccionado)
    pendiente = correo is None
    if pendiente:
        # Direccion imposible de entregar, para que no salga un correo a ciegas.
        # La organizacion la corrige desde el panel.
        correo = f"pendiente-{dorsal}@mundial-2026.invalid"

    ahora = datetime.now(timezone.utc)
    inscripcion = {
        "race_code": MUNDIAL,
        "bib": dorsal,
        "nombre": seleccionado.get("nombre"),
        "apellidos": seleccionado.get("apellidos") or "",
        "email": correo.lower(),
        "sexo": seleccionado.get("sexo") or "",
        "nacionalidad": seleccionado.get("nacionalidad") or "DOM",
        # En el campeonato no hay inscripcion que pagar: estar en la nomina es
        # lo que da la plaza.
        "status": "registered",
        "payment_status": "paid",
        "laps_completed": 0,
        "total_km": 0.0,
        "categoria": seleccionado.get("categoria"),
        "seleccionado_id": seleccionado["id"],
        "correo_pendiente": pendiente,
        "edit_token": uuid.uuid4().hex,
        "created_at": ahora,
        "updated_at": ahora,
    }
    await db.registrations.insert_one(inscripcion)
    inscripcion.pop("_id", None)
    inscripcion.pop("edit_token", None)
    return inscripcion


def get_db():
    from server import db
    return db


class SeleccionadoCreate(BaseModel):
    result_id: str  # _id del participante del evento previo
    categoria: str  # titular | reserva


class SeleccionadoManualCreate(BaseModel):
    """Atleta externo: no corrio el evento previo, se digita a mano."""
    nombre: str
    apellidos: Optional[str] = ""
    categoria: str  # titular | reserva
    sexo: Optional[str] = ""
    nacionalidad: Optional[str] = ""
    bib: Optional[str] = None
    laps_completed: Optional[int] = 0


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
    inscripcion = await inscribir_en_el_mundial(db, doc)
    return {"success": True, "seleccionado": doc, "inscripcion": inscripcion}


@router.post("/admin/manual", dependencies=[solo_atletas])
async def add_seleccionado_manual(data: SeleccionadoManualCreate, db=Depends(get_db)):
    """Agrega un seleccionado externo, digitado a mano.

    Para atletas que no corrieron el evento previo y por tanto no aparecen
    entre los candidatos. Quedan marcados con externo=True y sin result_id.
    """
    if data.categoria not in CATEGORIAS:
        raise HTTPException(status_code=400, detail="Categoría inválida (titular o reserva)")

    nombre = (data.nombre or "").strip()
    apellidos = (data.apellidos or "").strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="El nombre es obligatorio")

    bib = (data.bib or "").strip() or None
    if bib:
        # El BIB, si se digita, no puede chocar con otro ya seleccionado
        if await db.campeonato_seleccionados.find_one({"bib": bib}):
            raise HTTPException(status_code=400, detail=f"Ya hay un seleccionado con el BIB {bib}")

    # Evitar duplicar a la misma persona por nombre completo
    patron = f"^{re.escape(nombre)}$"
    patron_apellidos = f"^{re.escape(apellidos)}$"
    repetido = await db.campeonato_seleccionados.find_one({
        "nombre": {"$regex": patron, "$options": "i"},
        "apellidos": {"$regex": patron_apellidos, "$options": "i"},
    })
    if repetido:
        raise HTTPException(status_code=400, detail="Ya hay un seleccionado con ese nombre")

    doc = {
        "id": str(uuid.uuid4()),
        "result_id": None,
        "externo": True,
        "bib": bib,
        "nombre": nombre,
        "apellidos": apellidos,
        "sexo": (data.sexo or "").strip(),
        "nacionalidad": (data.nacionalidad or "").strip(),
        "laps_completed": data.laps_completed or 0,
        "categoria": data.categoria,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.campeonato_seleccionados.insert_one({**doc})
    inscripcion = await inscribir_en_el_mundial(db, doc)
    return {"success": True, "seleccionado": doc, "inscripcion": inscripcion}


@router.put("/admin/{seleccionado_id}", dependencies=[solo_atletas])
async def update_seleccionado(seleccionado_id: str, data: SeleccionadoUpdate, db=Depends(get_db)):
    if data.categoria not in CATEGORIAS:
        raise HTTPException(status_code=400, detail="Categoría inválida (titular o reserva)")

    result = await db.campeonato_seleccionados.update_one(
        {"id": seleccionado_id}, {"$set": {"categoria": data.categoria}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Seleccionado no encontrado")

    await db.registrations.update_one(
        {"race_code": MUNDIAL, "seleccionado_id": seleccionado_id},
        {"$set": {"categoria": data.categoria}},
    )
    return {"success": True}


@router.delete("/admin/{seleccionado_id}", dependencies=[solo_atletas])
async def delete_seleccionado(seleccionado_id: str, db=Depends(get_db)):
    # Si ya corrio, no se le saca de la carrera desde aqui: eso borraria un
    # resultado. Primero hay que resolverlo en el control de carrera.
    inscripcion = await db.registrations.find_one(
        {"race_code": MUNDIAL, "seleccionado_id": seleccionado_id}
    )
    if inscripcion and inscripcion.get("laps_completed", 0) > 0:
        raise HTTPException(
            status_code=400,
            detail=(
                f"{inscripcion.get('nombre')} ya tiene {inscripcion['laps_completed']} "
                "vuelta(s) corridas en el campeonato. Quítalo desde el control de carrera."
            ),
        )

    result = await db.campeonato_seleccionados.delete_one({"id": seleccionado_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Seleccionado no encontrado")

    if inscripcion:
        await db.registrations.delete_one({"_id": inscripcion["_id"]})

    return {"success": True}
