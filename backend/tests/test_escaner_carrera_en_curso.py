"""El escaner sin carrera dicha cae en la carrera en curso, no en la publicada.

El dia del Mundial (17-oct-2026) el sitio publicaba la carrera de enero. Los
telefonos en los que nadie habia elegido carrera en el menu de la app
preguntaban `/api/qr-scan/race-status` sin `race_code` y recibian la de
enero: de ahi salian la descarga de datos y el dorsal tecleado a mano.

Lo que estos tests protegen:

- que `carrera_del_escaner` sin codigo devuelva la carrera con la salida dada
  y sin cerrar, aunque no sea la publicada;
- que con codigo siga mandando el codigo (el del QR);
- que sin ninguna en curso se caiga en la publicada, como antes;
- que una carrera cerrada o archivada no cuente como en curso.

Van contra una base de usar y tirar en el Mongo local:

    backend/.venv/bin/python -m pytest tests/test_escaner_carrera_en_curso.py -v
"""
import asyncio
import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest

os.environ.setdefault("JWT_SECRET_KEY", "clave-solo-para-tests-" + "x" * 40)
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "bysd_test_rutas")
os.environ.setdefault("EMAILS_ACTIVOS", "false")
os.environ.setdefault("RATE_LIMIT_OFF", "1")

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402
from pymongo import MongoClient  # noqa: E402
from pymongo.errors import PyMongoError  # noqa: E402

import server  # noqa: E402
from routes import qr_scan  # noqa: E402
from services import races  # noqa: E402

MONGO = os.environ.get("TEST_MONGO_URL", "mongodb://localhost:27017")


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
        monkeypatch.setattr(server, "db", db)
        try:
            return await caso(db)
        finally:
            await cliente.drop_database(nombre)
            cliente.close()

    return asyncio.run(_todo())


HACE_UNA_HORA = datetime.now(timezone.utc) - timedelta(hours=1)


def _publicada():
    return {
        "code": "BYSD-2027", "name": "Enero", "date": "2027-01-23",
        "is_active": True, "estado": "inscripcion",
        "start_time": "09:00", "timezone_gmt": "GMT-4",
    }


def _mundial(**extra):
    return {
        "code": "MUNDIAL-2026", "name": "Mundial", "date": "2026-10-17",
        "is_active": False, "estado": "en_carrera", "started_at": HACE_UNA_HORA,
        "start_time": "08:00", "timezone_gmt": "GMT-4", **extra,
    }


def test_sin_codigo_manda_la_carrera_en_curso(monkeypatch):
    async def caso(db):
        await db.race_configurations.insert_many([_publicada(), _mundial()])
        carrera = await races.carrera_del_escaner(db, None)
        assert carrera["code"] == "MUNDIAL-2026"
        estado = await qr_scan.get_race_status(None)
        assert estado["race_code"] == "MUNDIAL-2026"
        assert estado["race_started"] is True
    correr(caso, monkeypatch)


def test_con_codigo_manda_el_codigo(monkeypatch):
    async def caso(db):
        await db.race_configurations.insert_many([_publicada(), _mundial()])
        carrera = await races.carrera_del_escaner(db, "bysd-2027")
        assert carrera["code"] == "BYSD-2027"
        estado = await qr_scan.get_race_status("BYSD-2027")
        assert estado["race_code"] == "BYSD-2027"
    correr(caso, monkeypatch)


def test_sin_ninguna_en_curso_cae_en_la_publicada(monkeypatch):
    async def caso(db):
        await db.race_configurations.insert_many([
            _publicada(),
            _mundial(code="BYSD-2026", finished_at=HACE_UNA_HORA),
            _mundial(code="VIEJA", archived_at=HACE_UNA_HORA),
        ])
        assert (await races.carrera_del_escaner(db, None))["code"] == "BYSD-2027"
        assert (await qr_scan.get_race_status(None))["race_code"] == "BYSD-2027"
    correr(caso, monkeypatch)


def test_sin_carreras_responde_sin_carrera_activa(monkeypatch):
    async def caso(db):
        estado = await qr_scan.get_race_status(None)
        assert estado == {"race_active": False, "message": "No hay carrera activa"}
    correr(caso, monkeypatch)
