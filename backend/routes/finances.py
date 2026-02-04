"""
Financial movements management routes
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from bson import ObjectId

router = APIRouter()

# Payment status options
PAYMENT_STATUS = {
    "pendiente": "Pendiente",
    "parcial": "Parcialmente Pagado",
    "pagado": "Pagado"
}

# Payment methods options
PAYMENT_METHODS = {
    "efectivo": "Efectivo",
    "transferencia": "Transferencia Bancaria",
    "tarjeta": "Tarjeta de Crédito/Débito",
    "cheque": "Cheque",
    "paypal": "PayPal",
    "otro": "Otro"
}


class PartialPayment(BaseModel):
    fecha: str  # YYYY-MM-DD
    monto: float
    metodo_pago: str
    referencia: Optional[str] = None
    notas: Optional[str] = None


class FinancialMovementCreate(BaseModel):
    fecha: str  # YYYY-MM-DD
    tipo: str  # "ingreso" or "gasto"
    detalle: str
    monto: float
    race_code: str
    # New fields for expense tracking
    estado_pago: Optional[str] = "pendiente"  # pendiente, parcial, pagado
    metodo_pago: Optional[str] = None
    referencia_pago: Optional[str] = None
    proveedor: Optional[str] = None


class FinancialMovementUpdate(BaseModel):
    fecha: Optional[str] = None
    tipo: Optional[str] = None
    detalle: Optional[str] = None
    monto: Optional[float] = None
    estado_pago: Optional[str] = None
    metodo_pago: Optional[str] = None
    referencia_pago: Optional[str] = None
    proveedor: Optional[str] = None


class AddPartialPaymentRequest(BaseModel):
    fecha: str
    monto: float
    metodo_pago: str
    referencia: Optional[str] = None
    notas: Optional[str] = None


@router.get("/options")
async def get_finance_options():
    """Get available options for payment status and methods"""
    return {
        "payment_status": PAYMENT_STATUS,
        "payment_methods": PAYMENT_METHODS
    }


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
    
    # Calculate payment status summary for expenses (based on actual amounts paid)
    gastos_pagados = 0
    gastos_pendientes = 0
    total_pagos_parciales = 0
    
    for m in movements:
        if m["tipo"] == "gasto":
            monto_total = m.get("monto", 0)
            monto_pagado = m.get("monto_pagado", 0)
            
            # Sum partial payments
            if m.get("pagos_parciales"):
                total_pagos_parciales += sum(p.get("monto", 0) for p in m["pagos_parciales"])
            
            # If fully paid (estado_pago == "pagado"), count full amount as paid
            if m.get("estado_pago") == "pagado":
                gastos_pagados += monto_total
            else:
                # Otherwise, use actual monto_pagado
                gastos_pagados += monto_pagado
                gastos_pendientes += (monto_total - monto_pagado)
    
    return {
        "movements": movements,
        "summary": {
            "total_ingresos": total_ingresos,
            "total_gastos": total_gastos,
            "saldo": saldo,
            "gastos_pendientes": gastos_pendientes,
            "gastos_pagados": gastos_pagados,
            "total_pagos_parciales": total_pagos_parciales
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
    
    # Add expense-specific fields
    if movement.tipo == "gasto":
        movement_data["estado_pago"] = movement.estado_pago or "pendiente"
        movement_data["metodo_pago"] = movement.metodo_pago
        movement_data["referencia_pago"] = movement.referencia_pago
        movement_data["proveedor"] = movement.proveedor
        movement_data["pagos_parciales"] = []
        movement_data["monto_pagado"] = 0
        
        # If already marked as paid, set full amount as paid
        if movement.estado_pago == "pagado":
            movement_data["monto_pagado"] = movement.monto
    
    await database.financial_movements.insert_one(movement_data)
    
    return {
        "message": "Movimiento registrado exitosamente",
        "movement": {
            "id": movement_data["id"],
            "fecha": movement_data["fecha"],
            "tipo": movement_data["tipo"],
            "detalle": movement_data["detalle"],
            "monto": movement_data["monto"],
            "estado_pago": movement_data.get("estado_pago")
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
    
    # If marking as paid, update monto_pagado
    if update_data.get("estado_pago") == "pagado":
        existing = await database.financial_movements.find_one({"id": movement_id})
        if existing and existing.get("tipo") == "gasto":
            update_data["monto_pagado"] = existing.get("monto", 0)
    
    result = await database.financial_movements.update_one(
        {"id": movement_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Movimiento no encontrado")
    
    return {"message": "Movimiento actualizado"}


@router.post("/movements/{movement_id}/partial-payment")
async def add_partial_payment(movement_id: str, payment: AddPartialPaymentRequest):
    """Add a partial payment to an expense"""
    from server import db as database
    import secrets
    
    # Get the movement
    movement = await database.financial_movements.find_one({"id": movement_id})
    if not movement:
        raise HTTPException(status_code=404, detail="Movimiento no encontrado")
    
    if movement.get("tipo") != "gasto":
        raise HTTPException(status_code=400, detail="Solo se pueden agregar pagos parciales a gastos")
    
    # Create partial payment record
    partial_payment = {
        "id": secrets.token_hex(6),
        "fecha": payment.fecha,
        "monto": payment.monto,
        "metodo_pago": payment.metodo_pago,
        "referencia": payment.referencia,
        "notas": payment.notas,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Calculate new totals
    existing_payments = movement.get("pagos_parciales", [])
    existing_total = sum(p.get("monto", 0) for p in existing_payments)
    new_total = existing_total + payment.monto
    total_monto = movement.get("monto", 0)
    
    # Determine new status
    if new_total >= total_monto:
        new_status = "pagado"
    elif new_total > 0:
        new_status = "parcial"
    else:
        new_status = "pendiente"
    
    # Update the movement
    await database.financial_movements.update_one(
        {"id": movement_id},
        {
            "$push": {"pagos_parciales": partial_payment},
            "$set": {
                "monto_pagado": new_total,
                "estado_pago": new_status,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    return {
        "message": "Pago parcial registrado",
        "payment": partial_payment,
        "new_status": new_status,
        "monto_pagado": new_total,
        "monto_pendiente": max(0, total_monto - new_total)
    }


@router.delete("/movements/{movement_id}/partial-payment/{payment_id}")
async def delete_partial_payment(movement_id: str, payment_id: str):
    """Delete a partial payment from an expense"""
    from server import db as database
    
    # Get the movement
    movement = await database.financial_movements.find_one({"id": movement_id})
    if not movement:
        raise HTTPException(status_code=404, detail="Movimiento no encontrado")
    
    # Find and remove the partial payment
    existing_payments = movement.get("pagos_parciales", [])
    payment_to_remove = None
    new_payments = []
    
    for p in existing_payments:
        if p.get("id") == payment_id:
            payment_to_remove = p
        else:
            new_payments.append(p)
    
    if not payment_to_remove:
        raise HTTPException(status_code=404, detail="Pago parcial no encontrado")
    
    # Calculate new totals
    new_total = sum(p.get("monto", 0) for p in new_payments)
    total_monto = movement.get("monto", 0)
    
    # Determine new status
    if new_total >= total_monto:
        new_status = "pagado"
    elif new_total > 0:
        new_status = "parcial"
    else:
        new_status = "pendiente"
    
    # Update the movement
    await database.financial_movements.update_one(
        {"id": movement_id},
        {
            "$set": {
                "pagos_parciales": new_payments,
                "monto_pagado": new_total,
                "estado_pago": new_status,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    return {
        "message": "Pago parcial eliminado",
        "new_status": new_status,
        "monto_pagado": new_total
    }


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
