"""Apuntar a un voluntario desde el panel, sin formulario ni codigo al correo.

    backend/.venv/bin/python -m pytest tests/test_alta_manual_voluntario.py -v
"""
import asyncio
import os
import uuid

import pytest

os.environ.setdefault("JWT_SECRET_KEY", "clave-solo-para-tests-" + "x" * 40)

from fastapi import HTTPException  # noqa: E402
from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402
from pymongo import MongoClient  # noqa: E402
from pymongo.errors import PyMongoError  # noqa: E402

import server  # noqa: E402
from routes import staff_account, volunteer_registration as vr  # noqa: E402
from services import cuentas, template_email_service  # noqa: E402

MONGO = os.environ.get("TEST_MONGO_URL", "mongodb://localhost:27017")
CORREO = "nueva@correo.com"
PANEL = {"username": "admin", "permissions": ["all"], "roles": ["staff"]}


def _hay_mongo() -> bool:
    try:
        MongoClient(MONGO, serverSelectionTimeoutMS=800).admin.command("ping")
        return True
    except PyMongoError:
        return False


pytestmark = pytest.mark.skipif(not _hay_mongo(), reason="Hace falta un Mongo local")


@pytest.fixture
def correos(monkeypatch):
    enviados, codigos = [], []

    async def _correo(db, template_id, to_email, data, **k):
        enviados.append((template_id, to_email, data))
        return True

    async def _codigo(db, email):
        codigos.append(email)
        return True

    monkeypatch.setattr(template_email_service, "send_email_with_template", _correo)
    monkeypatch.setattr(staff_account, "enviar_codigo_password", _codigo)
    return enviados, codigos


def correr(caso, monkeypatch):
    async def _todo():
        cliente = AsyncIOMotorClient(MONGO)
        db = cliente[f"bysd_test_{uuid.uuid4().hex[:12]}"]
        monkeypatch.setattr(server, "db", db)
        try:
            await cuentas.asegurar_indices(db)
            await db.race_configurations.insert_one(
                {"code": "BYSD-2027", "name": "BYSD 2027", "is_active": True, "date": "2027-01-23"})
            return await caso(db)
        finally:
            await cliente.drop_database(db.name)
            cliente.close()
    return asyncio.run(_todo())


def _datos(**extra):
    return vr.AltaManualVoluntario(
        nombre=" Ana ", apellidos="Paz", email="Nueva@Correo.com", telefono="809-555-0000", **extra)


def test_queda_apuntada_como_si_viniera_del_formulario(monkeypatch, correos):
    async def caso(db):
        r = await vr.alta_manual_de_voluntario(_datos(talla_camiseta="M", comentarios="  "), payload=PANEL)
        return r, await db.volunteer_registrations.find_one({"email": CORREO})

    r, reg = correr(caso, monkeypatch)
    assert reg["nombre"] == "Ana" and reg["apellidos"] == "Paz"
    assert reg["evento"] == "campeonato" and reg["race_code"] == "BYSD-2027"
    assert reg["status"] == "registered" and reg["email_verified"] is True
    assert len(reg["edit_token"]) == 32
    assert reg["alta_manual"] is True and reg["alta_por"] == "admin"
    assert reg["talla_camiseta"] == "M" and "comentarios" not in reg
    assert "edit_token" not in r["registro"]


def test_manda_la_bienvenida_y_el_codigo_si_se_pide(monkeypatch, correos):
    enviados, codigos = correos

    async def caso(db):
        return await vr.alta_manual_de_voluntario(_datos(enviar_codigo=True), payload=PANEL)

    r = correr(caso, monkeypatch)
    assert r["correo_enviado"] is True and r["codigo_enviado"] is True
    assert [(t, a) for t, a, _ in enviados] == [("volunteer_registration_confirmation", CORREO)]
    assert "token=" in enviados[0][2]["volunteer_edit_link"]
    assert enviados[0][2]["race_name"] == "Campeonato Mundial por Equipos"
    assert codigos == [CORREO]


def test_sin_avisar_no_sale_ningun_correo(monkeypatch, correos):
    enviados, codigos = correos

    async def caso(db):
        return await vr.alta_manual_de_voluntario(_datos(avisar=False), payload=PANEL)

    r = correr(caso, monkeypatch)
    assert (r["correo_enviado"], r["codigo_enviado"]) == (False, False)
    assert enviados == [] and codigos == []


def test_el_mismo_correo_en_el_mismo_evento_se_rechaza(monkeypatch, correos):
    async def caso(db):
        await vr.alta_manual_de_voluntario(_datos(), payload=PANEL)
        with pytest.raises(HTTPException) as error:
            await vr.alta_manual_de_voluntario(_datos(), payload=PANEL)
        # En el otro evento si puede estar: es otra postulacion
        await vr.alta_manual_de_voluntario(_datos(evento="carrera"), payload=PANEL)
        return error.value.status_code, await db.volunteer_registrations.count_documents({"email": CORREO})

    assert correr(caso, monkeypatch) == (409, 2)


def test_no_crea_cuenta_sin_contrasena_pero_suma_el_rol_a_la_que_ya_habia(monkeypatch, correos):
    async def caso(db):
        await vr.alta_manual_de_voluntario(_datos(), payload=PANEL)
        sin_cuenta = await cuentas.por_email(db, CORREO)

        await cuentas.crear(db, email="corre@correo.com", password="x" * 8, nombre="Luis",
                            roles=[cuentas.ATLETA], email_verified=True)
        await vr.alta_manual_de_voluntario(
            vr.AltaManualVoluntario(nombre="Luis", apellidos="Gil", email="corre@correo.com", telefono="1"),
            payload=PANEL)
        return sin_cuenta, (await cuentas.por_email(db, "corre@correo.com"))["roles"]

    sin_cuenta, roles = correr(caso, monkeypatch)
    assert sin_cuenta is None
    assert set(roles) == {"fan", "athlete", "staff"}


def test_sale_en_la_lista_del_panel(monkeypatch, correos):
    async def caso(db):
        await vr.alta_manual_de_voluntario(_datos(), payload=PANEL)
        return await vr.get_volunteer_registrations()

    lista = correr(caso, monkeypatch)
    assert [r["email"] for r in lista["registrations"]] == [CORREO]
