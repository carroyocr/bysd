"""La portada anuncia la transmision en vivo de la carrera que se corre.

El dia del Mundial (17-oct-2026) el sitio publicaba la carrera de enero y la
transmision de YouTube era del campeonato. El enlace vive en la ficha de cada
carrera (`live_stream_url`) y `/api/race-config/active` lo devuelve en
`transmision_en_vivo` mientras alguna carrera `en_carrera` lo tenga, sea o no
la publicada.

Lo que estos tests protegen:

- que el enlace del campeonato en curso salga aunque la publicada sea otra;
- que una carrera con enlace pero sin estar en carrera no lo anuncie;
- que el panel pueda guardar y borrar el enlace, y que rechace lo que no sea
  una direccion http(s);
- que `/active` siga devolviendo lo de siempre, con el campo nuevo a None.

Van contra una base de usar y tirar en el Mongo local:

    backend/.venv/bin/python -m pytest tests/test_transmision_en_vivo.py -v
"""
import asyncio
import os
import uuid

import pytest
from fastapi import HTTPException

os.environ.setdefault("JWT_SECRET_KEY", "clave-solo-para-tests-" + "x" * 40)
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "bysd_test_rutas")
os.environ.setdefault("EMAILS_ACTIVOS", "false")
os.environ.setdefault("RATE_LIMIT_OFF", "1")

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402
from pymongo import MongoClient  # noqa: E402
from pymongo.errors import PyMongoError  # noqa: E402

import server  # noqa: E402
from routes import race_config  # noqa: E402
from services import transmision  # noqa: E402

MONGO = os.environ.get("TEST_MONGO_URL", "mongodb://localhost:27017")
YOUTUBE = "https://www.youtube.com/live/1L1HbpACnW4"


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


def _publicada():
    return {
        "code": "BYSD-2027", "name": "Enero", "date": "2027-01-23",
        "is_active": True, "estado": "inscripcion",
        "start_time": "09:00", "timezone_gmt": "GMT-4",
    }


def _mundial(**extra):
    return {
        "code": "MUNDIAL-2026", "name": "Mundial", "date": "2026-10-17",
        "is_active": False, "estado": "en_carrera",
        "start_time": "08:00", "timezone_gmt": "GMT-4", **extra,
    }


def test_la_portada_anuncia_la_carrera_en_curso_aunque_publique_otra(monkeypatch):
    async def caso(db):
        await db.race_configurations.insert_many([
            _publicada(), _mundial(live_stream_url=YOUTUBE),
        ])
        activa = await race_config.get_active_race(None)
        assert activa["code"] == "BYSD-2027"
        assert activa["transmision_en_vivo"] == {
            "url": YOUTUBE, "race_code": "MUNDIAL-2026", "race_name": "Mundial",
        }
    correr(caso, monkeypatch)


def test_sin_carrera_en_curso_no_hay_boton(monkeypatch):
    async def caso(db):
        await db.race_configurations.insert_many([
            _publicada(),
            _mundial(estado="cerrada", live_stream_url=YOUTUBE),
            _mundial(code="VIEJA", archived_at="2025-10-18", live_stream_url=YOUTUBE),
            _mundial(code="SIN-ENLACE"),
            _mundial(code="VACIO", live_stream_url="   "),
        ])
        assert await transmision.en_vivo(db) is None
        activa = await race_config.get_active_race(None)
        assert activa["transmision_en_vivo"] is None
    correr(caso, monkeypatch)


def test_el_panel_guarda_y_borra_el_enlace(monkeypatch):
    async def caso(db):
        await db.race_configurations.insert_many([_publicada(), _mundial()])

        cambio = race_config.RaceConfigUpdate(live_stream_url=f"  {YOUTUBE} ")
        await race_config.update_race("MUNDIAL-2026", cambio, user={}, db=None)
        ficha = await db.race_configurations.find_one({"code": "MUNDIAL-2026"})
        assert ficha["live_stream_url"] == YOUTUBE
        assert ficha["name"] == "Mundial"  # no toca lo demas
        assert (await transmision.en_vivo(db))["url"] == YOUTUBE

        with pytest.raises(HTTPException) as error:
            await race_config.update_race(
                "MUNDIAL-2026", race_config.RaceConfigUpdate(live_stream_url="youtube.com/x"),
                user={}, db=None,
            )
        assert error.value.status_code == 400
        ficha = await db.race_configurations.find_one({"code": "MUNDIAL-2026"})
        assert ficha["live_stream_url"] == YOUTUBE

        await race_config.update_race(
            "MUNDIAL-2026", race_config.RaceConfigUpdate(live_stream_url=""), user={}, db=None,
        )
        ficha = await db.race_configurations.find_one({"code": "MUNDIAL-2026"})
        assert ficha["live_stream_url"] == ""
        assert await transmision.en_vivo(db) is None
    correr(caso, monkeypatch)


def test_un_cambio_sin_enlace_no_lo_toca(monkeypatch):
    async def caso(db):
        await db.race_configurations.insert_many([_mundial(live_stream_url=YOUTUBE)])
        await race_config.update_race(
            "MUNDIAL-2026", race_config.RaceConfigUpdate(location="Hotel"), user={}, db=None,
        )
        ficha = await db.race_configurations.find_one({"code": "MUNDIAL-2026"})
        assert ficha["live_stream_url"] == YOUTUBE
        assert ficha["location"] == "Hotel"
    correr(caso, monkeypatch)
