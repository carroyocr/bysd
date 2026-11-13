"""Corregir una inscripcion aprobada como pagada completa que pago una parte.

`test_plazos.py` protege las reglas. Esto protege lo que hace la ruta con la
base: el pago vuelve a pendiente con el plazo aprobado (el cupo sigue
asegurado), el comprobante pasa a vivir dentro del plazo, y en finanzas queda
un solo ingreso con lo que de verdad entro -- y solo si el ingreso lo habia
anotado el sistema.

Con una base de usar y tirar en el Mongo local:

    backend/.venv/bin/python -m pytest tests/test_pago_parcial.py -v
"""
import asyncio
import os
import uuid
from datetime import datetime, timezone

import pytest

os.environ.setdefault("JWT_SECRET_KEY", "clave-solo-para-tests-" + "x" * 40)
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "bysd_test_rutas")
os.environ.setdefault("EMAILS_ACTIVOS", "false")

from fastapi import HTTPException  # noqa: E402
from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402
from pymongo import MongoClient  # noqa: E402
from pymongo.errors import PyMongoError  # noqa: E402

import server  # noqa: E402
from routes import registration  # noqa: E402
from services import cupos, plazos  # noqa: E402

MONGO = os.environ.get("TEST_MONGO_URL", "mongodb://localhost:27017")
CARRERA = "BYSD-2027"
CORREO = "corredora@correo.com"
ADMIN = {"username": "cristian"}


def _hay_mongo() -> bool:
    try:
        MongoClient(MONGO, serverSelectionTimeoutMS=800).admin.command("ping")
        return True
    except PyMongoError:
        return False


pytestmark = pytest.mark.skipif(not _hay_mongo(), reason="Hace falta un Mongo local")


def correr(caso, monkeypatch):
    async def _todo():
        cliente = AsyncIOMotorClient(MONGO)
        nombre = f"bysd_test_{uuid.uuid4().hex[:12]}"
        db = cliente[nombre]
        monkeypatch.setattr(registration, "db", db)
        monkeypatch.setattr(registration, "registrations_collection", db["registrations"])
        # Finanzas escribe en la base del servidor, no en la del router.
        monkeypatch.setattr(server, "db", db)
        try:
            return await caso(db)
        finally:
            await cliente.drop_database(nombre)
            cliente.close()

    return asyncio.run(_todo())


RECIBO = {
    "status": "approved", "image_path": "/api/uploads/receipts/r.jpg",
    "payment_date": "2026-11-01", "bank_origin": "Popular", "transfer_number": "777",
    "submitted_at": datetime(2026, 11, 1, tzinfo=timezone.utc),
    "reviewed_at": datetime(2026, 11, 2, tzinfo=timezone.utc),
}


async def _sembrar(db, con_ingreso=True, **extra):
    await db.race_configurations.insert_one(
        {"code": CARRERA, "name": "BYSD 2027", "max_participants": 10,
         "registration_cost": 4000, "is_active": True})
    await db.registrations.insert_one({
        "race_code": CARRERA, "email": CORREO, "nombre": "Ana", "apellidos": "Prueba",
        "status": "registered", "payment_status": "paid", "payment_receipt": dict(RECIBO),
        "edit_token": "token-1", "created_at": datetime(2026, 8, 1, tzinfo=timezone.utc),
        **extra,
    })
    if con_ingreso:
        await db.financial_movements.insert_one({
            "id": "abc", "tipo": "ingreso", "monto": 4000, "race_code": CARRERA,
            "detalle": "Pago inscripción - Ana Prueba", "auto_generated": True,
            "source": "payment_confirmation", "athlete_email": CORREO,
        })
        await db.financial_movements.insert_one({
            "id": "otro", "tipo": "ingreso", "monto": 500, "race_code": CARRERA,
            "detalle": "Venta de camiseta", "athlete_email": CORREO,
        })


def test_el_pago_completo_pasa_a_abono_y_el_ingreso_se_corrige(monkeypatch):
    async def caso(db):
        await _sembrar(db)
        respuesta = await registration.corregir_pago_parcial(
            CORREO, CARRERA, registration.PagoParcial(monto_pagado=2500, fecha_propuesta="2026-12-20"),
            usuario=ADMIN)
        registro = await db.registrations.find_one({"email": CORREO})
        movimientos = await db.financial_movements.find({"race_code": CARRERA}, {"_id": 0}).to_list(10)
        return respuesta, registro, movimientos, await cupos.resumen(db, CARRERA)

    respuesta, registro, movimientos, resumen = correr(caso, monkeypatch)
    assert respuesta["estado_pago"] == plazos.PAGO_ABONO
    assert respuesta["saldo_pendiente"] == 1500.0
    assert respuesta["ingreso"] == {"antes": 4000.0, "ahora": 2500.0, "movimientos_retirados": 1}

    assert registro["payment_status"] == "pending"
    assert "payment_receipt" not in registro
    plazo = registro["plazo_pago"]
    assert plazo["estado"] == plazos.APROBADO
    assert plazo["monto_abonado"] == 2500.0
    assert plazo["fecha_propuesta"] == "2026-12-20"
    assert plazo["corregido_por"] == "cristian"
    assert plazo["comprobante"]["image_path"] == "/api/uploads/receipts/r.jpg"
    assert plazo["correccion"]["comprobante_aprobado"]["transfer_number"] == "777"
    assert plazos.estado_pago(registro) == plazos.PAGO_ABONO

    # Solo se retira lo que anoto el sistema; la camiseta se queda.
    automaticos = [m for m in movimientos if m.get("source") == "payment_confirmation"]
    assert [m["monto"] for m in automaticos] == [2500.0]
    assert "(abono)" in automaticos[0]["detalle"]
    assert any(m["id"] == "otro" for m in movimientos)
    # El cupo sigue asegurado: lo asegura el plazo aprobado.
    assert resumen["asegurados"] == 1


def test_sin_ingreso_automatico_no_se_toca_finanzas(monkeypatch):
    async def caso(db):
        await _sembrar(db, con_ingreso=False)
        respuesta = await registration.corregir_pago_parcial(
            CORREO, CARRERA, registration.PagoParcial(monto_pagado=2000, avisar=False), usuario=ADMIN)
        return respuesta, await db.financial_movements.count_documents({})

    respuesta, cuantos = correr(caso, monkeypatch)
    assert respuesta["ingreso"] is None
    assert cuantos == 0


def test_no_se_corrige_lo_que_no_es_un_pago_completo(monkeypatch):
    async def caso(db):
        await _sembrar(db, inscripcion_cortesia=True)
        errores = []
        with pytest.raises(HTTPException) as e1:
            await registration.corregir_pago_parcial(
                CORREO, CARRERA, registration.PagoParcial(monto_pagado=2000), usuario=ADMIN)
        errores.append(e1.value.status_code)
        with pytest.raises(HTTPException) as e2:
            await registration.corregir_pago_parcial(
                "nadie@correo.com", CARRERA, registration.PagoParcial(monto_pagado=2000), usuario=ADMIN)
        errores.append(e2.value.status_code)
        registro = await db.registrations.find_one({"email": CORREO})
        return errores, registro

    errores, registro = correr(caso, monkeypatch)
    assert errores == [400, 404]
    # Nada quedo a medias.
    assert registro["payment_status"] == "paid" and registro["payment_receipt"]["status"] == "approved"


def test_un_monto_que_cubre_el_costo_se_rechaza_sin_tocar_nada(monkeypatch):
    async def caso(db):
        await _sembrar(db)
        with pytest.raises(HTTPException) as caida:
            await registration.corregir_pago_parcial(
                CORREO, CARRERA, registration.PagoParcial(monto_pagado=4000), usuario=ADMIN)
        registro = await db.registrations.find_one({"email": CORREO})
        ingreso = await db.financial_movements.find_one({"id": "abc"})
        return caida.value.status_code, registro, ingreso

    codigo, registro, ingreso = correr(caso, monkeypatch)
    assert codigo == 400
    assert registro["payment_status"] == "paid"
    assert ingreso["monto"] == 4000
