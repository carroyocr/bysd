"""Inscribirse no confirma nada: confirma la transferencia.

Desde que los cupos se aseguran pagando, el correo que recibe quien se inscribe
no puede decir «registro confirmado». Lo que estos tests protegen:

- que la inscripcion nueva entre directa —sin lista de espera— mientras quede
  un cupo que pagar, aunque haya mas inscritos que cupos;
- que el correo diga que la inscripcion solo queda confirmada al verificar la
  transferencia, y lleve los datos de la cuenta y el enlace para subir el
  comprobante;
- que con los cupos completos siga yendo a lista de espera, sin datos de pago.

Contra la funcion de la ruta, con una base de usar y tirar en el Mongo local:

    backend/.venv/bin/python -m pytest tests/test_inscripcion_con_datos_de_pago.py -v
"""
import asyncio
import os
import uuid

import pytest

os.environ.setdefault("JWT_SECRET_KEY", "clave-solo-para-tests-" + "x" * 40)
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "bysd_test_rutas")
os.environ.setdefault("EMAILS_ACTIVOS", "false")

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402
from pymongo import MongoClient  # noqa: E402
from pymongo.errors import PyMongoError  # noqa: E402

import server  # noqa: E402
from routes import athletes, push  # noqa: E402
from routes.email_templates import DEFAULT_TEMPLATES  # noqa: E402
from services import correo_inscripcion, cuentas, template_email_service  # noqa: E402
from services.template_email_service import render_template  # noqa: E402

MONGO = os.environ.get("TEST_MONGO_URL", "mongodb://localhost:27017")
CARRERA = "BYSD-2027"
CONFIG = {
    "code": CARRERA, "name": "Backyard Ultra Santo Domingo 2027", "date": "2027-01-23",
    "registration_cost": 4000, "payment_bank_name": "Banco Popular Dominicano",
    "payment_account_name": "Titular <de> prueba", "payment_account_type": "Corriente",
    "payment_account_number": "123456789", "payment_account_id": "001-0000000-1",
}


def _hay_mongo() -> bool:
    try:
        MongoClient(MONGO, serverSelectionTimeoutMS=800).admin.command("ping")
        return True
    except PyMongoError:
        return False


con_mongo = pytest.mark.skipif(not _hay_mongo(), reason="Hace falta un Mongo local")


def _inscribir(monkeypatch, limite, pagados, sin_pagar):
    """Inscribe a una corredora nueva en una carrera con ese estado de cupos.
    Devuelve la respuesta, su registro, los correos y los avisos al telefono."""
    correos, avisos = [], []

    async def _correo(db, template_id, to_email, data, subject_prefix=""):
        correos.append({"plantilla": template_id, "para": to_email, "datos": data})
        return True

    async def _aviso(db, email, titulo, cuerpo, datos=None):
        avisos.append((titulo, cuerpo))

    monkeypatch.setattr(template_email_service, "send_email_with_template", _correo)
    monkeypatch.setattr(push, "avisar_atleta", _aviso)

    async def _todo():
        cliente = AsyncIOMotorClient(MONGO)
        nombre = f"bysd_test_{uuid.uuid4().hex[:12]}"
        db = cliente[nombre]
        monkeypatch.setattr(server, "db", db)
        try:
            await db.race_configurations.insert_one({**CONFIG, "max_participants": limite})
            otros = [
                {"race_code": CARRERA, "email": f"c{i}@correo.com", "bib": f"{i:03d}", "status": "registered",
                 "payment_status": "paid" if i <= pagados else "pending"}
                for i in range(1, pagados + sin_pagar + 1)
            ]
            if otros:
                await db.registrations.insert_many(otros)

            perfil = await db.athletes.insert_one(
                {"email": "nueva@correo.com", "nombre": "Ana", "apellidos": "Nueva", "email_verified": True})
            cuenta = await cuentas.crear(
                db, email="nueva@correo.com", password="clave-de-prueba-1", nombre="Ana",
                roles=[cuentas.ATLETA], email_verified=True, athlete_profile_id=perfil.inserted_id)

            respuesta = await athletes.register_for_race(
                athletes.RaceRegistrationRequest(race_code=CARRERA),
                authorization="Bearer " + cuentas.emitir_token(cuenta),
            )
            otras = [t for t in asyncio.all_tasks() if t is not asyncio.current_task()]
            if otras:
                await asyncio.gather(*otras, return_exceptions=True)
            return respuesta, await db.registrations.find_one({"email": "nueva@correo.com"})
        finally:
            await cliente.drop_database(nombre)
            cliente.close()

    respuesta, registro = asyncio.run(_todo())
    return respuesta, registro, correos, avisos


# ==================== El bloque de pago ====================


def test_el_bloque_lleva_la_cuenta_y_los_enlaces_para_pagar():
    html = correo_inscripcion.bloque_de_pago(CONFIG, "TOKEN123")
    for dato in ("RD$ 4,000", "Banco Popular Dominicano", "Corriente", "123456789", "001-0000000-1"):
        assert dato in html
    # Lo que escribe el panel no puede meter HTML en el correo.
    assert "Titular &lt;de&gt; prueba" in html and "<de>" not in html
    assert "/subir-comprobante?token=TOKEN123" in html
    assert "/plazo-de-pago?token=TOKEN123" in html
    assert "15 de noviembre" in html
    assert "queda confirmada" in html


def test_sin_cuenta_configurada_no_se_inventa_una_tabla_vacia():
    html = correo_inscripcion.bloque_de_pago({"registration_cost": 0}, "TOKEN123")
    assert "Datos para la transferencia" not in html
    assert "/subir-comprobante?token=TOKEN123" in html


def test_la_plantilla_no_dice_que_el_registro_esta_confirmado():
    plantilla = next(t for t in DEFAULT_TEMPLATES if t["id"] == "athlete_registration_pending_payment")
    asunto = render_template(plantilla["subject"], {"race_name": "BYSD 2027"}, escape=False)
    assert "falta confirmar el pago" in asunto and "confirmado" not in asunto.lower()
    html = plantilla["content"]
    assert "solo queda confirmada cuando verifiquemos tu transferencia" in html
    assert "no está" in html and "garantizado" in html
    assert "{{proximos_pasos}}" in html


# ==================== La inscripcion entera ====================


@con_mongo
def test_la_inscripcion_nueva_entra_directa_aunque_haya_mas_inscritos_que_cupos(monkeypatch):
    """165 inscritos de 163, pero solo 85 pagados: quedan cupos que pagar."""
    respuesta, registro, correos, avisos = _inscribir(monkeypatch, limite=163, pagados=85, sin_pagar=80)

    assert respuesta["waitlisted"] is False
    assert registro["status"] == "registered" and registro["payment_status"] == "pending"

    assert [c["plantilla"] for c in correos] == ["athlete_registration_pending_payment"]
    pasos = correos[0]["datos"]["proximos_pasos"]
    assert "Banco Popular Dominicano" in pasos and "123456789" in pasos
    assert f"/subir-comprobante?token={registro['edit_token']}" in pasos

    titulo, cuerpo = avisos[0]
    assert titulo == "Inscripción recibida"
    assert "verifiquemos tu pago" in cuerpo


@con_mongo
def test_con_los_cupos_completos_va_a_lista_de_espera_y_no_se_le_pide_pagar(monkeypatch):
    respuesta, registro, correos, avisos = _inscribir(monkeypatch, limite=10, pagados=10, sin_pagar=2)

    assert respuesta["waitlisted"] is True and registro["status"] == "waitlist"
    assert [c["plantilla"] for c in correos] == ["athlete_waitlist_confirmation"]
    assert "proximos_pasos" not in correos[0]["datos"]
    assert avisos[0][0] == "Ya estás en lista de espera"
