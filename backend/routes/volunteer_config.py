from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone

router = APIRouter(prefix="/volunteer-config", tags=["volunteer-config"])


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


class PositionUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    turnos: Optional[List[ShiftConfig]] = None


@router.get("/positions")
async def get_positions():
    """Get all volunteer positions with their shifts configuration"""
    from server import db
    
    positions = await db.volunteer_positions.find({}, {"_id": 0}).to_list(100)
    return {"positions": positions}


@router.post("/positions")
async def create_position(data: PositionCreate):
    """Create a new volunteer position with shifts"""
    from server import db
    
    # Check if position already exists
    existing = await db.volunteer_positions.find_one({"nombre": data.nombre})
    if existing:
        raise HTTPException(status_code=400, detail="Esta posición ya existe")
    
    position = {
        "nombre": data.nombre,
        "descripcion": data.descripcion,
        "turnos": [t.dict() for t in data.turnos],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.volunteer_positions.insert_one(position)
    
    # Generate slots for this position
    await _regenerate_slots_for_position(db, data.nombre, data.turnos)
    
    return {"message": "Posición creada exitosamente", "position": data.nombre}


@router.put("/positions/{nombre}")
async def update_position(nombre: str, data: PositionUpdate):
    """Update a volunteer position"""
    from server import db
    
    existing = await db.volunteer_positions.find_one({"nombre": nombre})
    if not existing:
        raise HTTPException(status_code=404, detail="Posición no encontrada")
    
    update_data = {"updated_at": datetime.now(timezone.utc)}
    
    if data.nombre is not None:
        update_data["nombre"] = data.nombre
    if data.descripcion is not None:
        update_data["descripcion"] = data.descripcion
    if data.turnos is not None:
        update_data["turnos"] = [t.dict() for t in data.turnos]
        # Regenerate slots when shifts change
        await _regenerate_slots_for_position(db, nombre, data.turnos, data.nombre or nombre)
    
    await db.volunteer_positions.update_one(
        {"nombre": nombre},
        {"$set": update_data}
    )
    
    return {"message": "Posición actualizada exitosamente"}


@router.delete("/positions/{nombre}")
async def delete_position(nombre: str):
    """Delete a volunteer position and its slots"""
    from server import db
    
    # Check if position exists
    existing = await db.volunteer_positions.find_one({"nombre": nombre})
    if not existing:
        raise HTTPException(status_code=404, detail="Posición no encontrada")
    
    # Delete position
    await db.volunteer_positions.delete_one({"nombre": nombre})
    
    # Delete associated slots
    await db.volunteer_assignments.delete_many({"puesto": nombre})
    
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
            preserve_assignments=True
        )
        total_slots += slots_created
    
    return {"message": f"Slots regenerados: {total_slots} creados"}


@router.post("/clear-assignments")
async def clear_all_assignments():
    """Clear all volunteer assignments from slots"""
    from server import db
    
    # Count current assignments
    assigned_count = await db.volunteer_assignments.count_documents({
        "email_asignado": {"$nin": [None, ""]}
    })
    
    # Clear all assignments
    result = await db.volunteer_assignments.update_many(
        {},
        {"$set": {"email_asignado": None, "nombre_asignado": None}}
    )
    
    return {
        "message": f"Asignaciones limpiadas: {assigned_count} slots liberados",
        "slots_cleared": assigned_count
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


async def _regenerate_slots_for_position(db, position_name: str, turnos: List[ShiftConfig], new_name: str = None, preserve_assignments: bool = False):
    """Helper function to regenerate slots for a position"""
    
    target_name = new_name or position_name
    
    if not preserve_assignments:
        # Delete existing unassigned slots for this position
        await db.volunteer_assignments.delete_many({
            "puesto": position_name,
            "email_asignado": {"$in": [None, ""]}
        })
    
    # Get max ID for new slots
    max_slot = await db.volunteer_assignments.find_one(sort=[("id", -1)])
    next_id = (max_slot.get("id", 0) if max_slot else 0) + 1
    
    slots_created = 0
    for turno in turnos:
        turno_dict = turno.dict() if hasattr(turno, 'dict') else turno
        
        # Get dia_tipo (default to "carrera" for backward compatibility)
        dia_tipo = turno_dict.get("dia_tipo", "carrera")
        
        # Check existing slots for this position+shift+dia_tipo
        existing_count = await db.volunteer_assignments.count_documents({
            "puesto": target_name,
            "turno": turno_dict["turno"],
            "dia_tipo": dia_tipo
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
                "email_asignado": None,
                "nombre_asignado": None
            }
            await db.volunteer_assignments.insert_one(slot_doc)
            next_id += 1
            slots_created += 1
    
    return slots_created
