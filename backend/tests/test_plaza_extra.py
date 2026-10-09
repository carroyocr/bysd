"""Asignar sobre un turno lleno abre una plaza extra; al soltarla, se borra.

El panel de Voluntarios enseña también los turnos llenos. Si la organización
elige uno, pide `abrir_plaza` y el backend crea una plaza más en ese turno en
vez de rechazar. La plaza extra se marca para que, al desasignarla, desaparezca
y el turno vuelva a sus cupos. Sin `abrir_plaza` todo sigue como antes.

    backend/.venv/bin/python -m pytest tests/test_plaza_extra.py -v
"""
import asyncio
import os
import uuid

import pytest

os.environ.setdefault("JWT_SECRET_KEY", "clave-solo-para-tests-" + "x" * 40)

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402
from pymongo import MongoClient  # noqa: E402
from pymongo.errors import PyMongoError  # noqa: E402

import server  # noqa: E402
from routes import volunteers  # noqa: E402

MONGO = os.environ.get("TEST_MONGO_URL", "mongodb://localhost:27017")
ANA, LUIS = "ana@correo.com", "luis@correo.com"


def _hay_mongo() -> bool:
    try:
        MongoClient(MONGO, serverSelectionTimeoutMS=800).admin.command("ping")
        return True
    except PyMongoError:
        return False


pytestmark = pytest.mark.skipif(not _hay_mongo(), reason="Hace falta un Mongo local")


@pytest.fixture(autouse=True)
def sin_correos_ni_avisos(monkeypatch):
    async def nada(*a, **k):
        return None
    monkeypatch.setattr(volunteers, "_enviar_correo_turnos", nada)
    monkeypatch.setattr(volunteers, "_avisar_turnos_asignados", nada)


def correr(caso, monkeypatch):
    async def _todo():
        cliente = AsyncIOMotorClient(MONGO)
        db = cliente[f"bysd_test_{uuid.uuid4().hex[:12]}"]
        monkeypatch.setattr(server, "db", db)
        try:
            return await caso(db)
        finally:
            await cliente.drop_database(db.name)
            cliente.close()
    return asyncio.run(_todo())


async def _turno_lleno(db):
    """Control de Vueltas, turno A, dos plazas y las dos ocupadas."""
    base = {"puesto": "Control de Vueltas", "turno": "A", "dia_tipo": "carrera_dia1",
            "hora_inicio": "08:00", "hora_fin": "12:00", "evento": "campeonato", "race_code": "BYSD-2027"}
    await db.volunteer_assignments.insert_many([
        {**base, "id": 1, "slot": 1, "email_asignado": "otro1@correo.com", "nombre_asignado": "Otro"},
        {**base, "id": 2, "slot": 2, "email_asignado": "otro2@correo.com", "nombre_asignado": "Otra"},
        # Un turno distinto, para que el id nuevo no choque con nada
        {**base, "id": 7, "turno": "B", "slot": 1, "email_asignado": None},
    ])
    for email, nombre in ((ANA, "Ana"), (LUIS, "Luis")):
        await db.volunteer_registrations.insert_one(
            {"email": email, "nombre": nombre, "apellidos": "Paz", "evento": "campeonato", "status": "registered"})


def test_sin_abrir_plaza_el_turno_lleno_se_rechaza_como_siempre(monkeypatch):
    async def caso(db):
        await _turno_lleno(db)
        r = await volunteers.assign_volunteer(1, volunteers.AssignmentRequest(email=ANA))
        return r.status_code, await db.volunteer_assignments.count_documents({"turno": "A"})

    assert correr(caso, monkeypatch) == (400, 2)


def test_con_abrir_plaza_se_crea_una_plaza_extra_y_se_le_asigna(monkeypatch):
    async def caso(db):
        await _turno_lleno(db)
        r = await volunteers.assign_volunteer(1, volunteers.AssignmentRequest(email=ANA, abrir_plaza=True))
        extra = await db.volunteer_assignments.find_one({"email_asignado": ANA}, {"_id": 0})
        registro = await db.volunteer_registrations.find_one({"email": ANA})
        return r, extra, registro

    r, extra, registro = correr(caso, monkeypatch)
    assert r["success"] is True
    assert extra["extra"] is True
    assert extra["id"] == 8                      # el siguiente id libre de toda la coleccion
    assert extra["slot"] == 3                    # tercera plaza del turno
    assert extra["nombre_asignado"] == "Ana Paz"
    # Copia el horario y el evento de sus hermanas
    assert (extra["puesto"], extra["turno"], extra["dia_tipo"], extra["hora_inicio"], extra["hora_fin"],
            extra["evento"], extra["race_code"]) == (
        "Control de Vueltas", "A", "carrera_dia1", "08:00", "12:00", "campeonato", "BYSD-2027")
    assert registro["status"] == "confirmed"


def test_si_el_turno_tiene_una_plaza_libre_se_usa_esa_y_no_se_abre_otra(monkeypatch):
    async def caso(db):
        await _turno_lleno(db)
        await db.volunteer_assignments.update_one({"id": 2}, {"$set": {"email_asignado": None}})
        await volunteers.assign_volunteer(1, volunteers.AssignmentRequest(email=ANA, abrir_plaza=True))
        return (await db.volunteer_assignments.find_one({"email_asignado": ANA}))["id"], \
               await db.volunteer_assignments.count_documents({"turno": "A"})

    assert correr(caso, monkeypatch) == (2, 2)


def test_dos_plazas_extra_seguidas_no_se_pisan(monkeypatch):
    async def caso(db):
        await _turno_lleno(db)
        await volunteers.assign_volunteer(1, volunteers.AssignmentRequest(email=ANA, abrir_plaza=True))
        await volunteers.assign_volunteer(1, volunteers.AssignmentRequest(email=LUIS, abrir_plaza=True))
        extras = await db.volunteer_assignments.find({"extra": True}, {"_id": 0}).sort("id", 1).to_list(10)
        return [(e["id"], e["slot"], e["email_asignado"]) for e in extras]

    assert correr(caso, monkeypatch) == [(8, 3, ANA), (9, 4, LUIS)]


def test_al_desasignar_la_plaza_extra_desaparece(monkeypatch):
    async def caso(db):
        await _turno_lleno(db)
        await volunteers.assign_volunteer(1, volunteers.AssignmentRequest(email=ANA, abrir_plaza=True))
        r = await volunteers.unassign_volunteer(8, volunteers.AssignmentRequest(email=ANA))
        return r["success"], await db.volunteer_assignments.count_documents({"turno": "A"}), \
               (await db.volunteer_registrations.find_one({"email": ANA}))["status"]

    assert correr(caso, monkeypatch) == (True, 2, "registered")


def test_al_desasignar_una_plaza_normal_queda_libre_como_siempre(monkeypatch):
    async def caso(db):
        await _turno_lleno(db)
        await volunteers.unassign_volunteer(2, volunteers.AssignmentRequest(email="otro2@correo.com"))
        plaza = await db.volunteer_assignments.find_one({"id": 2})
        return plaza is not None and plaza["email_asignado"] is None

    assert correr(caso, monkeypatch) is True
