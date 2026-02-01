"""
Financial movements management routes
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from bson import ObjectId

router = APIRouter()

class FinancialMovementCreate(BaseModel):
    fecha: str  # YYYY-MM-DD
    tipo: str  # "ingreso" or "gasto"
    detalle: str
    monto: float
    race_code: str


class FinancialMovementUpdate(BaseModel):
    fecha: Optional[str] = None
    tipo: Optional[str] = None
    detalle: Optional[str] = None
    monto: Optional[float] = None


@router.get("/movements/{race_code}")
async def get_financial_movements(race_code: str):
    """Get all financial movements for a race"""
    from server import db as database
    
    movements = await database.financial_movements.find(
        {"race_code": race_code},
        {"_id": 0}
    ).sort("fecha", -1).to_list(1000)
    
    # Calculate totals
    total_ingresos = sum(m["monto"] for m in movements if m["tipo"] == "ingreso")
    total_gastos = sum(m["monto"] for m in movements if m["tipo"] == "gasto")
    saldo = total_ingresos - total_gastos
    
    return {
        "movements": movements,
        "summary": {
            "total_ingresos": total_ingresos,
            "total_gastos": total_gastos,
            "saldo": saldo
        }
    }


@router.post("/movements")
async def create_financial_movement(movement: FinancialMovementCreate):
    """Create a new financial movement"""
    from server import db as database
    import secrets
    
    movement_data = {
        "id": secrets.token_hex(8),
        "fecha": movement.fecha,
        "tipo": movement.tipo,
        "detalle": movement.detalle,
        "monto": movement.monto,
        "race_code": movement.race_code,
        "created_at": datetime.now(timezone.utc),
        "auto_generated": False
    }
    
    await database.financial_movements.insert_one(movement_data)
    
    return {
        "message": "Movimiento registrado exitosamente",
        "movement": {
            "id": movement_data["id"],
            "fecha": movement_data["fecha"],
            "tipo": movement_data["tipo"],
            "detalle": movement_data["detalle"],
            "monto": movement_data["monto"]
        }
    }


@router.put("/movements/{movement_id}")
async def update_financial_movement(movement_id: str, movement: FinancialMovementUpdate):
    """Update a financial movement"""
    from server import db as database
    
    update_data = {k: v for k, v in movement.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No hay datos para actualizar")
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    result = await database.financial_movements.update_one(
        {"id": movement_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Movimiento no encontrado")
    
    return {"message": "Movimiento actualizado"}


@router.delete("/movements/{movement_id}")
async def delete_financial_movement(movement_id: str):
    """Delete a financial movement"""
    from server import db as database
    
    result = await database.financial_movements.delete_one({"id": movement_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Movimiento no encontrado")
    
    return {"message": "Movimiento eliminado"}


async def create_payment_income(email: str, nombre: str, monto: float, race_code: str):
    """Helper function to create an automatic income record when payment is confirmed"""
    from server import db as database
    import secrets
    
    movement_data = {
        "id": secrets.token_hex(8),
        "fecha": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "tipo": "ingreso",
        "detalle": f"Pago inscripción - {nombre} ({email})",
        "monto": monto,
        "race_code": race_code,
        "created_at": datetime.now(timezone.utc),
        "auto_generated": True,
        "source": "payment_confirmation",
        "athlete_email": email
    }
    
    await database.financial_movements.insert_one(movement_data)
    return movement_data
