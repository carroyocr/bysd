"""Suspender la solicitud de turnos por parte de los voluntarios.

A dos dias del evento la organizacion cierra las peticiones y reparte los
turnos a mano. El interruptor es por evento y la regla la impone el backend
(`services/solicitudes_turnos`), porque la app instalada no sabe de ella.

Lo que estos tests protegen:

- que el interruptor se guarde por evento sin pisar la programacion;
- que con la suspension puesta no se pueda pedir, retirar ni elegir en bloque,
  y que `mis_turnos` salga sin disponibles y con el aviso, solo en ese evento;
- que confirmar y cancelar un turno ya asignado sigan funcionando.

Van contra las funciones de las rutas, con una base de usar y tirar en el
Mongo local puesta en el sitio de `server.db`:

    backend/.venv/bin/python -m pytest tests/test_solicitudes_suspendidas.py -v
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

from fastapi import HTTPException  # noqa: E402
from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402
from pymongo import MongoClient  # noqa: E402
from pymongo.errors import PyMongoError  # noqa: E402

import server  # noqa: E402
from routes import staff_account, volunteer_config  # noqa: E402
from services import auth, cuentas, solicitudes_turnos  # noqa: E402

MONGO = os.environ.get("TEST_MONGO_URL", "mongodb://localhost:27017")
CORREO = "voluntaria@correo.com"
PANEL = {"username": "admin", "permissions": ["all"], "roles": ["staff"]}


def _hay_mongo() -> bool:
    try:
        MongoClient(MONGO, serverSelectionTimeoutMS=800).admin.command("ping")
        return True
    except PyMongoError:
        return False


pytestmark = pytest.mark.skipif(not _hay_mongo(), reason="Hace falta un Mongo local")


def correr(caso, monkeypatch):
    """Ejecuta `caso(db)` con una base nueva en el sitio de `server.db`."""
    async def _todo():
        cliente = AsyncIOMotorClient(MONGO)
        nombre = f"bysd_test_{uuid.uuid4().hex[:12]}"
        db = cliente[nombre]
        monkeypatch.setattr(server, "db", db)
        try:
            await cuentas.asegurar_indices(db)
            return await caso(db)
        finally:
            await cliente.drop_database(nombre)
            cliente.close()

    return asyncio.run(_todo())


async def _sesion(db):
    cuenta = await cuentas.cuenta_de_equipo(db, CORREO, password="la-de-verdad-123", nombre="Ana")
    return auth.decodificar(cuentas.emitir_token(cuenta))


async def _carrera_y_campeonato(db):
    """Una voluntaria apuntada a los dos eventos, con turnos de cada uno."""
    ahora = datetime.now(timezone.utc)
    await db.race_configurations.insert_one(
        {"code": "BYSD-2027", "name": "Backyard Ultra Santo Domingo 2027", "date": "2027-01-23",
         "is_active": True})
    await db.volunteer_event_schedules.insert_one(
        {"evento": "campeonato", "fecha_inicio": "2026-10-17", "duracion_horas": 4})
    base = {"email": CORREO, "nombre": "Ana", "apellidos": "Perez", "status": "confirmed",
            "race_code": "BYSD-2027"}
    await db.volunteer_registrations.insert_many([
        {**base, "evento": "carrera", "slots_interes": [11], "created_at": ahora - timedelta(days=2)},
        {**base, "evento": "campeonato", "slots_interes": [22], "created_at": ahora - timedelta(days=1)},
    ])

    def turno(id_, evento, puesto, letra, inicio, fin, dia_tipo, asignado=None):
        return {"id": id_, "evento": evento, "puesto": puesto, "turno": letra, "hora_inicio": inicio,
                "hora_fin": fin, "dia_tipo": dia_tipo, "email_asignado": asignado, "race_code": "BYSD-2027"}

    await db.volunteer_assignments.insert_many([
        turno(11, "carrera", "Meta", "A", "06:00", "10:00", "carrera"),
        turno(12, "carrera", "Hidratacion", "B", "10:00", "14:00", "carrera"),
        turno(21, "campeonato", "Meta", "A", "07:00", "11:00", "carrera_dia1", asignado=CORREO),
        turno(22, "campeonato", "Hidratacion", "G", "07:00", "11:00", "carrera_dia2"),
        turno(23, "campeonato", "Corral", "H", "11:00", "15:00", "carrera_dia2"),
    ])


async def _suspender_campeonato(db):
    await volunteer_config.suspender_solicitudes(
        volunteer_config.SolicitudesUpdate(suspendidas=True), evento="campeonato", payload=PANEL)


# ==================== El interruptor ====================


def test_nace_abierto_y_se_guarda_por_evento(monkeypatch):
    async def caso(db):
        await _carrera_y_campeonato(db)
        antes = await volunteer_config.estado_de_solicitudes(evento="campeonato")
        await _suspender_campeonato(db)
        return (
            antes,
            await volunteer_config.estado_de_solicitudes(evento="campeonato"),
            await volunteer_config.estado_de_solicitudes(evento="carrera"),
            await db.volunteer_event_schedules.find_one({"evento": "campeonato"}),
        )

    antes, campeonato, carrera, guardado = correr(caso, monkeypatch)
    assert antes == {"evento": "campeonato", "suspendidas": False}
    assert campeonato == {"evento": "campeonato", "suspendidas": True}
    assert carrera == {"evento": "carrera", "suspendidas": False}
    assert guardado["solicitudes_suspendidas_por"] == "admin"
    assert guardado["solicitudes_suspendidas_at"] is not None


def test_no_pisa_la_programacion_del_evento_y_se_puede_reabrir(monkeypatch):
    async def caso(db):
        await _carrera_y_campeonato(db)
        await _suspender_campeonato(db)
        suspendido = await db.volunteer_event_schedules.find_one({"evento": "campeonato"})
        await volunteer_config.suspender_solicitudes(
            volunteer_config.SolicitudesUpdate(suspendidas=False), evento="campeonato", payload=PANEL)
        return suspendido, await solicitudes_turnos.suspendidas(db, "campeonato")

    suspendido, reabierto = correr(caso, monkeypatch)
    assert suspendido["fecha_inicio"] == "2026-10-17" and suspendido["duracion_horas"] == 4
    assert reabierto is False


def test_un_evento_sin_programacion_tambien_se_suspende(monkeypatch):
    async def caso(db):
        await _carrera_y_campeonato(db)
        await volunteer_config.suspender_solicitudes(
            volunteer_config.SolicitudesUpdate(suspendidas=True), evento="carrera", payload=PANEL)
        return await solicitudes_turnos.suspendidas(db, "carrera")

    assert correr(caso, monkeypatch) is True


def test_un_evento_desconocido_cae_en_la_carrera(monkeypatch):
    async def caso(db):
        await _carrera_y_campeonato(db)
        return await volunteer_config.estado_de_solicitudes(evento="otro")

    assert correr(caso, monkeypatch)["evento"] == "carrera"


# ==================== Lo que ve y puede hacer el voluntario ====================


def test_la_pestana_turnos_sale_sin_disponibles_y_con_el_aviso_solo_en_ese_evento(monkeypatch):
    async def caso(db):
        await _carrera_y_campeonato(db)
        await _suspender_campeonato(db)
        return await staff_account.mis_turnos(await _sesion(db))

    eventos = correr(caso, monkeypatch)["eventos"]
    campeonato = next(e for e in eventos if e["evento"] == "campeonato")
    carrera = next(e for e in eventos if e["evento"] == "carrera")

    assert campeonato["solicitudes_suspendidas"] is True
    assert campeonato["aviso_solicitudes"] == solicitudes_turnos.AVISO
    assert campeonato["disponibles"] == []
    # Lo pedido y lo asignado siguen a la vista.
    assert [t["slot_id"] for t in campeonato["solicitados"]] == [22]
    assert [t["slot_id"] for t in campeonato["asignados"]] == [21]

    assert carrera["solicitudes_suspendidas"] is False
    assert carrera["aviso_solicitudes"] is None
    assert [t["slot_id"] for t in carrera["disponibles"]] == [12]


def test_no_se_pide_un_turno_del_evento_suspendido_pero_si_del_otro(monkeypatch):
    async def caso(db):
        await _carrera_y_campeonato(db)
        await _suspender_campeonato(db)
        payload = await _sesion(db)
        with pytest.raises(HTTPException) as error:
            await staff_account.solicitar_turno(23, payload)
        await staff_account.solicitar_turno(12, payload)
        return (
            error.value,
            await db.volunteer_registrations.find_one({"email": CORREO, "evento": "campeonato"}),
            await db.volunteer_registrations.find_one({"email": CORREO, "evento": "carrera"}),
        )

    error, campeonato, carrera = correr(caso, monkeypatch)
    assert error.status_code == 400 and error.detail == solicitudes_turnos.AVISO
    assert campeonato["slots_interes"] == [22]
    assert carrera["slots_interes"] == [11, 12]


def test_tampoco_se_retira_una_solicitud(monkeypatch):
    async def caso(db):
        await _carrera_y_campeonato(db)
        await _suspender_campeonato(db)
        payload = await _sesion(db)
        with pytest.raises(HTTPException) as error:
            await staff_account.retirar_solicitud(22, payload)
        # En el otro evento, como siempre.
        await staff_account.retirar_solicitud(11, payload)
        return (
            error.value,
            await db.volunteer_registrations.find_one({"email": CORREO, "evento": "campeonato"}),
            await db.volunteer_registrations.find_one({"email": CORREO, "evento": "carrera"}),
        )

    error, campeonato, carrera = correr(caso, monkeypatch)
    assert error.status_code == 400 and error.detail == solicitudes_turnos.AVISO
    assert campeonato["slots_interes"] == [22]
    assert carrera["slots_interes"] == []


def test_la_eleccion_en_bloque_de_las_apps_antiguas_se_rechaza_igual(monkeypatch):
    async def caso(db):
        await _carrera_y_campeonato(db)
        await _suspender_campeonato(db)
        payload = await _sesion(db)
        with pytest.raises(HTTPException) as error:
            await staff_account.elegir_turnos(
                staff_account.SeleccionTurnos(evento="campeonato", slots_interes=[22, 23]), payload)
        return error.value, await db.volunteer_registrations.find_one({"email": CORREO, "evento": "campeonato"})

    error, campeonato = correr(caso, monkeypatch)
    assert error.status_code == 400 and error.detail == solicitudes_turnos.AVISO
    assert campeonato["slots_interes"] == [22]


def test_confirmar_y_cancelar_un_turno_asignado_siguen_abiertos(monkeypatch):
    """La suspension es solo para pedir: lo asignado se confirma y se suelta igual."""
    async def caso(db):
        await _carrera_y_campeonato(db)
        await _suspender_campeonato(db)
        payload = await _sesion(db)
        await staff_account.confirmar_turno(21, payload)
        confirmado = await db.volunteer_assignments.find_one({"id": 21})
        await staff_account.soltar_turno(21, payload)
        return confirmado, await db.volunteer_assignments.find_one({"id": 21})

    confirmado, suelto = correr(caso, monkeypatch)
    assert staff_account.turno_confirmado(confirmado) is True
    assert suelto["email_asignado"] is None


def test_el_interruptor_del_panel_pide_el_permiso_de_voluntarios():
    from fastapi.routing import APIRoute

    def permisos_de(ruta):
        pedidos = set()

        def recorrer(dependant):
            for dep in dependant.dependencies:
                if getattr(dep.call, "__qualname__", "").startswith("require_permission."):
                    pedidos.update(c.cell_contents for c in dep.call.__closure__ or ())
                recorrer(dep)

        recorrer(ruta.dependant)
        return pedidos

    vistas = {
        (m, r.path): permisos_de(r)
        for r in server.app.routes if isinstance(r, APIRoute)
        for m in r.methods if r.path == "/api/volunteer-config/solicitudes"
    }
    assert set(vistas) == {("GET", "/api/volunteer-config/solicitudes"), ("PUT", "/api/volunteer-config/solicitudes")}
    assert all("volunteers" in p for p in vistas.values())
