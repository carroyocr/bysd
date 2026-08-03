from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta, timezone

from services.auth import require_permission

# Configurar puestos y turnos es parte de la gestion de voluntarios.
router = APIRouter(
    prefix="/volunteer-config",
    tags=["volunteer-config"],
    dependencies=[Depends(require_permission("volunteers"))],
)

VALID_EVENTOS = ["carrera", "campeonato"]


def evento_query(evento: str) -> dict:
    """Build a Mongo query fragment for filtering by event.
    Legacy documents without 'evento' are treated as 'carrera'."""
    if evento == "campeonato":
        return {"evento": "campeonato"}
    # carrera (default) includes legacy docs without the field
    return {"$or": [{"evento": "carrera"}, {"evento": {"$exists": False}}, {"evento": None}]}


class EventScheduleUpdate(BaseModel):
    fecha_inicio: str  # ISO local, ej. "2026-08-15T08:00"
    fecha_fin: str
    duracion_horas: float
    slots_por_turno: int = 2


class ShiftConfig(BaseModel):
    turno: str  # A, B, C, etc.
    hora_inicio: str  # "08:00"
    hora_fin: str  # "12:00"
    slots_count: int  # Number of slots for this shift
    dia_tipo: str = "carrera"  # "previo" or "carrera"


class PositionCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    turnos: List[ShiftConfig]
    evento: str = "carrera"


class PositionUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    turnos: Optional[List[ShiftConfig]] = None
    evento: Optional[str] = None
    # Si es True, se borran TODOS los slots de la posicion (incluso asignados)
    # antes de regenerar. Lo usa "Generar según Programación" para evitar
    # que queden slots viejos duplicados con otros horarios.
    reemplazar_slots: bool = False


@router.get("/positions")
async def get_positions(evento: Optional[str] = None):
    """Get all volunteer positions with their shifts configuration.
    Optionally filtered by event ('carrera' or 'campeonato')."""
    from server import db
    
    query = evento_query(evento) if evento in VALID_EVENTOS else {}
    positions = await db.volunteer_positions.find(query, {"_id": 0}).to_list(100)
    # Normalize evento for legacy docs
    for p in positions:
        if not p.get("evento"):
            p["evento"] = "carrera"
    return {"positions": positions}


async def _find_position(db, nombre: str, evento: str):
    """Find a position by name + event, with legacy fallback for carrera."""
    existing = await db.volunteer_positions.find_one({"nombre": nombre, "evento": evento})
    if not existing and evento == "carrera":
        existing = await db.volunteer_positions.find_one({
            "nombre": nombre,
            "$or": [{"evento": {"$exists": False}}, {"evento": None}]
        })
    return existing


@router.post("/positions")
async def create_position(data: PositionCreate):
    """Create a new volunteer position with shifts"""
    from server import db
    
    evento = data.evento if data.evento in VALID_EVENTOS else "carrera"
    
    # Check if position already exists within the same event
    existing = await _find_position(db, data.nombre, evento)
    if existing:
        raise HTTPException(status_code=400, detail="Esta posición ya existe en este evento")
    
    position = {
        "nombre": data.nombre,
        "descripcion": data.descripcion,
        "turnos": [t.dict() for t in data.turnos],
        "evento": evento,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.volunteer_positions.insert_one(position)
    
    # Generate slots for this position
    await _regenerate_slots_for_position(db, data.nombre, data.turnos, evento=evento)
    
    return {"message": "Posición creada exitosamente", "position": data.nombre}


# {nombre:path} permite nombres con "/" (ej. "Área de Carpas / Zona de Atletas"):
# el %2F llega decodificado al enrutador y sin esto la ruta no coincide (404).
@router.put("/positions/{nombre:path}")
async def update_position(nombre: str, data: PositionUpdate, evento: str = "carrera"):
    """Update a volunteer position"""
    from server import db
    
    if evento not in VALID_EVENTOS:
        evento = "carrera"
    
    existing = await _find_position(db, nombre, evento)
    if not existing:
        raise HTTPException(status_code=404, detail="Posición no encontrada")
    
    update_data = {"updated_at": datetime.now(timezone.utc), "evento": evento}
    
    if data.nombre is not None:
        update_data["nombre"] = data.nombre
    if data.descripcion is not None:
        update_data["descripcion"] = data.descripcion
    if data.turnos is not None:
        update_data["turnos"] = [t.dict() for t in data.turnos]
        if data.reemplazar_slots:
            # Wipe every slot of the position (assigned included) so the
            # regenerated shifts don't coexist with stale ones
            await db.volunteer_assignments.delete_many({
                "puesto": nombre,
                **evento_query(evento)
            })
        # Regenerate slots when shifts change
        await _regenerate_slots_for_position(db, nombre, data.turnos, data.nombre or nombre, evento=evento)
    
    await db.volunteer_positions.update_one(
        {"nombre": existing["nombre"], "evento": existing.get("evento", evento)} if existing.get("evento") else {"nombre": nombre},
        {"$set": update_data}
    )
    
    return {"message": "Posición actualizada exitosamente"}


@router.delete("/positions/{nombre:path}")
async def delete_position(nombre: str, evento: str = "carrera"):
    """Delete a volunteer position and its slots"""
    from server import db
    
    if evento not in VALID_EVENTOS:
        evento = "carrera"
    
    # Check if position exists
    existing = await _find_position(db, nombre, evento)
    if not existing:
        raise HTTPException(status_code=404, detail="Posición no encontrada")
    
    # Delete position
    await db.volunteer_positions.delete_one({"_id": existing["_id"]})
    
    # Delete associated slots for this position within the event
    await db.volunteer_assignments.delete_many({"puesto": nombre, **evento_query(evento)})
    
    return {"message": "Posición eliminada exitosamente"}


@router.post("/regenerate-slots")
async def regenerate_all_slots():
    """Regenerate all volunteer slots based on current positions configuration"""
    from server import db
    
    # Get all positions
    positions = await db.volunteer_positions.find({}).to_list(100)
    
    if not positions:
        raise HTTPException(status_code=400, detail="No hay posiciones configuradas")
    
    # Clear existing slots that don't have assignments
    await db.volunteer_assignments.delete_many({"email_asignado": {"$in": [None, ""]}})
    
    total_slots = 0
    for position in positions:
        turnos = [ShiftConfig(**t) for t in position.get("turnos", [])]
        slots_created = await _regenerate_slots_for_position(
            db, 
            position["nombre"], 
            turnos,
            preserve_assignments=True,
            evento=position.get("evento", "carrera")
        )
        total_slots += slots_created
    
    return {"message": f"Slots regenerados: {total_slots} creados"}


@router.post("/clear-assignments")
async def clear_all_assignments(evento: Optional[str] = None):
    """Clear volunteer assignments from slots.
    If 'evento' is provided, only that event's assignments are cleared."""
    from server import db

    query = evento_query(evento) if evento in VALID_EVENTOS else {}

    # Count current assignments
    assigned_count = await db.volunteer_assignments.count_documents({
        **query,
        "email_asignado": {"$nin": [None, ""]}
    })

    # Clear assignments
    await db.volunteer_assignments.update_many(
        query,
        {"$set": {"email_asignado": None, "nombre_asignado": None}}
    )

    return {
        "message": f"Asignaciones limpiadas: {assigned_count} slots liberados",
        "slots_cleared": assigned_count
    }


@router.post("/delete-position-shifts")
async def delete_position_shifts(nombre: str, evento: str = "carrera"):
    """Delete every shift (and its slots, including assigned ones) of ONE position.
    The position itself is kept, without shifts. 'nombre' goes as a query
    param so names containing '/' work without route issues."""
    from server import db

    if evento not in VALID_EVENTOS:
        evento = "carrera"

    existing = await _find_position(db, nombre, evento)
    if not existing:
        raise HTTPException(status_code=404, detail="Posición no encontrada")

    ev_filter = evento_query(evento)
    slots_result = await db.volunteer_assignments.delete_many({
        "puesto": existing["nombre"],
        **ev_filter
    })
    await db.volunteer_positions.update_one(
        {"_id": existing["_id"]},
        {"$set": {"turnos": [], "updated_at": datetime.now(timezone.utc)}}
    )

    return {
        "message": f"Turnos de \"{existing['nombre']}\" eliminados: {slots_result.deleted_count} slots borrados",
        "slots_deleted": slots_result.deleted_count,
    }


@router.post("/delete-all-shifts")
async def delete_all_shifts(evento: str = "carrera"):
    """Delete every shift (and its slots, including assigned ones) for an event.
    Positions are kept, but left without shifts."""
    from server import db

    if evento not in VALID_EVENTOS:
        evento = "carrera"
    ev_filter = evento_query(evento)

    slots_result = await db.volunteer_assignments.delete_many(ev_filter)
    positions_result = await db.volunteer_positions.update_many(
        ev_filter,
        {"$set": {"turnos": [], "updated_at": datetime.now(timezone.utc)}}
    )

    return {
        "message": (
            f"Turnos eliminados: {slots_result.deleted_count} slots borrados "
            f"en {positions_result.modified_count} posiciones"
        ),
        "slots_deleted": slots_result.deleted_count,
        "positions_updated": positions_result.modified_count,
    }


def _parse_schedule_dates(data: EventScheduleUpdate):
    """Validate and parse the schedule; returns (inicio, fin) datetimes."""
    try:
        inicio = datetime.fromisoformat(data.fecha_inicio)
        fin = datetime.fromisoformat(data.fecha_fin)
    except ValueError:
        raise HTTPException(status_code=400, detail="Fechas inválidas")
    if fin <= inicio:
        raise HTTPException(status_code=400, detail="La fecha final debe ser posterior a la inicial")
    if data.duracion_horas <= 0:
        raise HTTPException(status_code=400, detail="La duración del turno debe ser mayor que cero")
    if data.slots_por_turno < 1:
        raise HTTPException(status_code=400, detail="Los slots por turno deben ser al menos 1")
    return inicio, fin


def _letra_turno(indice: int) -> str:
    """A..Z, then AA, AB, ... for shift labels."""
    letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    nombre = ""
    indice += 1
    while indice > 0:
        indice, resto = divmod(indice - 1, 26)
        nombre = letras[resto] + nombre
    return nombre


def _generar_turnos(inicio: datetime, fin: datetime, duracion_horas: float, slots_count: int) -> List[dict]:
    """Generate consecutive shifts covering [inicio, fin] with the given duration.
    dia_tipo follows the calendar day of each shift's start (dia1, dia2, dia3)."""
    dia_tipos = ["carrera_dia1", "carrera_dia2", "carrera_dia3"]
    duracion = timedelta(minutes=round(duracion_horas * 60))
    turnos = []
    cursor = inicio
    indice = 0
    while cursor < fin:
        fin_turno = min(cursor + duracion, fin)
        offset_dia = (cursor.date() - inicio.date()).days
        turnos.append({
            "turno": _letra_turno(indice),
            "hora_inicio": cursor.strftime("%H:%M"),
            "hora_fin": fin_turno.strftime("%H:%M"),
            "slots_count": slots_count,
            "dia_tipo": dia_tipos[min(offset_dia, len(dia_tipos) - 1)],
        })
        cursor = fin_turno
        indice += 1
    return turnos


@router.get("/event-schedule")
async def get_event_schedule(evento: str = "carrera"):
    """Get the saved schedule (start/end datetime + shift duration) for an event."""
    from server import db

    if evento not in VALID_EVENTOS:
        evento = "carrera"
    schedule = await db.volunteer_event_schedules.find_one({"evento": evento}, {"_id": 0})
    return {"schedule": schedule}


@router.put("/event-schedule")
async def save_event_schedule(data: EventScheduleUpdate, evento: str = "carrera"):
    """Save the schedule for an event (used to auto-generate shifts)."""
    from server import db

    if evento not in VALID_EVENTOS:
        evento = "carrera"
    _parse_schedule_dates(data)

    await db.volunteer_event_schedules.update_one(
        {"evento": evento},
        {"$set": {
            "evento": evento,
            "fecha_inicio": data.fecha_inicio,
            "fecha_fin": data.fecha_fin,
            "duracion_horas": data.duracion_horas,
            "slots_por_turno": data.slots_por_turno,
            "updated_at": datetime.now(timezone.utc),
        }},
        upsert=True
    )

    return {"message": "Programación guardada"}


@router.post("/apply-schedule")
async def apply_schedule(data: EventScheduleUpdate, evento: str = "carrera"):
    """Save the schedule and regenerate the shifts of EVERY position of the event.
    Existing slots for the event (including assigned ones) are replaced."""
    from server import db

    if evento not in VALID_EVENTOS:
        evento = "carrera"
    inicio, fin = _parse_schedule_dates(data)
    ev_filter = evento_query(evento)

    positions = await db.volunteer_positions.find(ev_filter).to_list(100)
    if not positions:
        raise HTTPException(status_code=400, detail="No hay posiciones configuradas en este evento")

    # Persist the schedule so it is also available for new positions
    await save_event_schedule(data, evento)

    # Replace all slots of the event with freshly generated ones
    await db.volunteer_assignments.delete_many(ev_filter)

    total_slots = 0
    num_turnos = 0
    for position in positions:
        turnos_existentes = position.get("turnos") or []
        slots_count = turnos_existentes[0].get("slots_count", data.slots_por_turno) if turnos_existentes else data.slots_por_turno
        turnos = _generar_turnos(inicio, fin, data.duracion_horas, slots_count)
        num_turnos = len(turnos)

        await db.volunteer_positions.update_one(
            {"_id": position["_id"]},
            {"$set": {"turnos": turnos, "evento": evento, "updated_at": datetime.now(timezone.utc)}}
        )
        total_slots += await _regenerate_slots_for_position(
            db, position["nombre"], [ShiftConfig(**t) for t in turnos], evento=evento
        )

    return {
        "message": (
            f"Turnos generados: {len(positions)} posiciones con "
            f"{num_turnos} turnos cada una ({total_slots} slots)"
        ),
        "positions_updated": len(positions),
        "slots_created": total_slots,
    }


@router.get("/shifts-template")
async def get_shifts_template():
    """Get default shift templates"""
    return {
        "templates": [
            {"turno": "A", "hora_inicio": "08:00", "hora_fin": "12:00", "label": "Mañana"},
            {"turno": "B", "hora_inicio": "12:00", "hora_fin": "16:00", "label": "Mediodía"},
            {"turno": "C", "hora_inicio": "16:00", "hora_fin": "20:00", "label": "Tarde"},
            {"turno": "D", "hora_inicio": "20:00", "hora_fin": "00:00", "label": "Noche"},
            {"turno": "E", "hora_inicio": "00:00", "hora_fin": "04:00", "label": "Madrugada"},
            {"turno": "F", "hora_inicio": "04:00", "hora_fin": "08:00", "label": "Amanecer"},
            {"turno": "G", "hora_inicio": "08:00", "hora_fin": "12:00", "label": "Mañana 2"},
        ]
    }


@router.post("/import-from-existing")
async def import_from_existing():
    """Import positions and shifts from existing volunteer_assignments data"""
    from server import db
    
    # Get existing slots
    existing_slots = await db.volunteer_assignments.find({}).to_list(1000)
    
    if not existing_slots:
        return {"message": "No hay datos existentes para importar", "positions_created": 0}
    
    # Extract unique positions and their shifts
    positions_data = {}
    
    for slot in existing_slots:
        puesto = slot.get("puesto", "")
        turno = slot.get("turno", "")
        hora_inicio = slot.get("hora_inicio", "")
        hora_fin = slot.get("hora_fin", "")
        
        if not puesto or not turno:
            continue
        
        if puesto not in positions_data:
            positions_data[puesto] = {
                "nombre": puesto,
                "descripcion": "",
                "turnos": {}
            }
        
        if turno not in positions_data[puesto]["turnos"]:
            positions_data[puesto]["turnos"][turno] = {
                "turno": turno,
                "hora_inicio": hora_inicio,
                "hora_fin": hora_fin,
                "slots_count": 0
            }
        
        positions_data[puesto]["turnos"][turno]["slots_count"] += 1
    
    # Save to volunteer_positions collection
    positions_created = 0
    for puesto, data in positions_data.items():
        # Check if already exists
        existing = await db.volunteer_positions.find_one({"nombre": puesto})
        if existing:
            continue
        
        position_doc = {
            "nombre": data["nombre"],
            "descripcion": data["descripcion"],
            "turnos": list(data["turnos"].values()),
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        
        await db.volunteer_positions.insert_one(position_doc)
        positions_created += 1
    
    return {
        "message": f"Importación completada: {positions_created} posiciones creadas",
        "positions_created": positions_created
    }


async def _regenerate_slots_for_position(db, position_name: str, turnos: List[ShiftConfig], new_name: str = None, preserve_assignments: bool = False, evento: str = "carrera"):
    """Helper function to regenerate slots for a position"""
    
    target_name = new_name or position_name
    ev_filter = evento_query(evento)
    
    if not preserve_assignments:
        # Delete existing unassigned slots for this position within the event
        await db.volunteer_assignments.delete_many({
            "puesto": position_name,
            "email_asignado": {"$in": [None, ""]},
            **ev_filter
        })
    
    # Get max ID for new slots
    max_slot = await db.volunteer_assignments.find_one(sort=[("id", -1)])
    next_id = (max_slot.get("id", 0) if max_slot else 0) + 1
    
    slots_created = 0
    for turno in turnos:
        turno_dict = turno.dict() if hasattr(turno, 'dict') else turno
        
        # Get dia_tipo (default to "carrera" for backward compatibility)
        dia_tipo = turno_dict.get("dia_tipo", "carrera")
        
        # Check existing slots for this position+shift+dia_tipo within the event
        existing_count = await db.volunteer_assignments.count_documents({
            "puesto": target_name,
            "turno": turno_dict["turno"],
            "dia_tipo": dia_tipo,
            **ev_filter
        })
        
        slots_to_create = turno_dict["slots_count"] - existing_count
        
        for i in range(max(0, slots_to_create)):
            slot_doc = {
                "id": next_id,
                "puesto": target_name,
                "turno": turno_dict["turno"],
                "slot": existing_count + i + 1,
                "hora_inicio": turno_dict["hora_inicio"],
                "hora_fin": turno_dict["hora_fin"],
                "dia_tipo": dia_tipo,
                "evento": evento,
                "email_asignado": None,
                "nombre_asignado": None
            }
            await db.volunteer_assignments.insert_one(slot_doc)
            next_id += 1
            slots_created += 1
    
    return slots_created
