"""Todos los comprobantes de un inscrito, no solo el ultimo.

El documento referencia uno por clase; los anteriores siguen en GridFS con el
correo y la carrera en el nombre. Con una base de usar y tirar en el Mongo
local:

    backend/.venv/bin/python -m pytest tests/test_comprobantes_lista.py -v
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

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402
from pymongo import MongoClient  # noqa: E402
from pymongo.errors import PyMongoError  # noqa: E402

import server  # noqa: E402
from routes import registration  # noqa: E402
from services import file_storage, plazos  # noqa: E402

MONGO = os.environ.get("TEST_MONGO_URL", "mongodb://localhost:27017")
CARRERA = "BYSD-2027"
CORREO = "ana@correo.com"
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
        monkeypatch.setattr(server, "db", db)  # GridFS cuelga de la base del servidor
        try:
            return await caso(db)
        finally:
            await cliente.drop_database(nombre)
            cliente.close()

    return asyncio.run(_todo())


def test_salen_todos_los_comprobantes_con_lo_que_se_sabe_de_cada_uno(monkeypatch):
    async def caso(db):
        # Tres subidas: un pago rechazado, un abono aprobado y el pago final en revision.
        for nombre in ("receipt_BYSD-2027_ana_correo.com_aaa.jpg",
                       "abono_BYSD-2027_ana_correo.com_bbb.pdf",
                       "receipt_BYSD-2027_ana_correo.com_ccc.jpg",
                       "receipt_BYSD-2027_otro_correo.com_ddd.jpg"):
            await file_storage.save(nombre, b"x", "image/jpeg", file_storage.FOLDER_RECEIPTS)
        await db.registrations.insert_one({
            "race_code": CARRERA, "email": CORREO, "status": "registered", "payment_status": "pending",
            "payment_receipt": {"status": "pending_review", "bank_origin": "BHD", "transfer_number": "9",
                                "image_path": "/api/uploads/receipts/receipt_BYSD-2027_ana_correo.com_ccc.jpg",
                                "submitted_at": datetime.now(timezone.utc)},
            "plazo_pago": {"estado": plazos.APROBADO, "monto_abonado": 1000,
                           "comprobante": {"image_path": "/api/uploads/receipts/abono_BYSD-2027_ana_correo.com_bbb.pdf",
                                           "bank_origin": "Popular"}},
        })
        return await registration.listar_comprobantes(CORREO, CARRERA, usuario=ADMIN)

    respuesta = correr(caso, monkeypatch)
    lista = respuesta["comprobantes"]
    # Los tres de Ana y ninguno del otro corredor, del mas reciente al mas antiguo.
    assert [c["image_path"].rsplit("_", 1)[1] for c in lista] == ["ccc.jpg", "bbb.pdf", "aaa.jpg"]
    assert [c["estado"] for c in lista] == ["en_revision", "abono_aprobado", "reemplazado"]
    assert [c["tipo"] for c in lista] == ["pago", "abono", "pago"]
    assert lista[0]["transfer_number"] == "9" and lista[1]["bank_origin"] == "Popular"
    assert all(c["subido_at"] for c in lista)


def test_lo_referenciado_que_no_esta_en_gridfs_entra_igual(monkeypatch):
    """Los comprobantes de antes de la migracion viven en disco: el enlace sigue valiendo."""
    async def caso(db):
        await db.registrations.insert_one({
            "race_code": CARRERA, "email": CORREO, "payment_status": "paid",
            "payment_receipt": {"status": "approved", "image_path": "/api/uploads/receipts/viejo.jpg"},
        })
        return await registration.listar_comprobantes(CORREO, CARRERA, usuario=ADMIN)

    lista = correr(caso, monkeypatch)["comprobantes"]
    assert len(lista) == 1
    assert lista[0]["estado"] == "aprobado" and lista[0]["subido_at"] is None


def test_tras_corregir_a_abono_el_comprobante_aprobado_sigue_en_la_lista(monkeypatch):
    async def caso(db):
        await file_storage.save("receipt_BYSD-2027_ana_correo.com_eee.jpg", b"x", "image/jpeg",
                                file_storage.FOLDER_RECEIPTS)
        await db.race_configurations.insert_one({"code": CARRERA, "registration_cost": 4000})
        await db.registrations.insert_one({
            "race_code": CARRERA, "email": CORREO, "nombre": "Ana", "apellidos": "P",
            "status": "registered", "payment_status": "paid",
            "payment_receipt": {"status": "approved", "bank_origin": "BHD",
                                "image_path": "/api/uploads/receipts/receipt_BYSD-2027_ana_correo.com_eee.jpg"},
        })
        await registration.corregir_pago_parcial(
            CORREO, CARRERA, registration.PagoParcial(monto_pagado=2000, avisar=False), usuario=ADMIN)
        return await registration.listar_comprobantes(CORREO, CARRERA, usuario=ADMIN)

    lista = correr(caso, monkeypatch)["comprobantes"]
    assert len(lista) == 1
    assert lista[0]["estado"] == "abono_aprobado" and lista[0]["bank_origin"] == "BHD"
