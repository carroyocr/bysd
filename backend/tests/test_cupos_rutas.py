"""Los cupos por orden de pago, vistos desde las rutas.

`test_cupos.py` protege las reglas. Esto protege que las rutas las usen: que la
lista publica cuente cupos asegurados y no inscripciones, que no se acepte un
pago cuando ya no queda cupo que pagar, que la organizacion no apruebe por
encima del limite, y que el aviso de «tu cupo no esta garantizado» le llegue a
quien toca y a nadie mas.

Con una base de usar y tirar en el Mongo local, puesta en el sitio de la que
usa `routes/registration.py`:

    backend/.venv/bin/python -m pytest tests/test_cupos_rutas.py -v
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

from fastapi import HTTPException  # noqa: E402
from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402
from pymongo import MongoClient  # noqa: E402
from pymongo.errors import PyMongoError  # noqa: E402

import server  # noqa: E402,F401
from routes import athletes, registration  # noqa: E402
from routes.email_templates import DEFAULT_TEMPLATES  # noqa: E402
from services import cupos  # noqa: E402

MONGO = os.environ.get("TEST_MONGO_URL", "mongodb://localhost:27017")
CARRERA = "BYSD-2027"


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
        try:
            return await caso(db)
        finally:
            await cliente.drop_database(nombre)
            cliente.close()

    return asyncio.run(_todo())


def _inscrito(n, **extra):
    return {
        "race_code": CARRERA, "email": f"corredor{n}@correo.com", "nombre": f"Corredor{n}",
        "apellidos": "Prueba", "sexo": "Masculino", "bib": f"{n:03d}", "edit_token": f"token-{n}",
        "status": "registered", "payment_status": "pending",
        "created_at": datetime(2026, 8, 1, tzinfo=timezone.utc) + timedelta(minutes=n),
        **extra,
    }


async def _sembrar(db, limite, pagados, sin_pagar, extra=()):
    await db.race_configurations.insert_one(
        {"code": CARRERA, "name": "Backyard Ultra Santo Domingo 2027", "max_participants": limite,
         "registration_cost": 4000, "is_active": True})
    docs = [_inscrito(i, payment_status="paid") for i in range(1, pagados + 1)]
    docs += [_inscrito(i) for i in range(pagados + 1, pagados + sin_pagar + 1)]
    docs += list(extra)
    await db.registrations.insert_many(docs)


def test_el_dia_del_cambio_quedan_85_cupos_no_5(monkeypatch):
    async def caso(db):
        await _sembrar(db, limite=170, pagados=85, sin_pagar=80)
        return await cupos.resumen(db, CARRERA), await registration.public_participants(CARRERA)

    resumen, publico = correr(caso, monkeypatch)
    assert (resumen["asegurados"], resumen["por_confirmar"], resumen["disponibles"]) == (85, 80, 85)
    assert publico["plazas_disponibles"] == 85
    assert publico["cupos_asegurados"] == 85
    # Mientras quedan cupos, la lista publica no distingue quien pago.
    assert publico["total"] == 165 and publico["waitlist_total"] == 0


def test_con_los_cupos_completos_la_lista_publica_separa_a_quien_no_pago(monkeypatch):
    async def caso(db):
        await _sembrar(db, limite=10, pagados=10, sin_pagar=4)
        return await registration.public_participants(CARRERA)

    publico = correr(caso, monkeypatch)
    assert publico["cupos_completos"] is True and publico["plazas_disponibles"] == 0
    assert publico["total"] == 10
    # En espera, por orden de inscripcion.
    assert [p["bib"] for p in publico["waitlist"]] == ["011", "012", "013", "014"]


def test_el_corredor_sin_pagar_lee_que_su_cupo_no_esta_garantizado(monkeypatch):
    async def caso(db):
        await _sembrar(db, limite=170, pagados=85, sin_pagar=80)
        return (
            await registration.get_payment_info_for_athlete("token-100"),
            await registration.get_payment_info_for_athlete("token-1"),
            await registration.ver_plazo("token-100"),
        )

    sin_pagar, pagado, plazo = correr(caso, monkeypatch)
    assert sin_pagar["cupo"]["situacion"] == cupos.POR_CONFIRMAR
    assert "no está garantizado" in sin_pagar["cupo"]["mensaje"]
    assert sin_pagar["impedimento"] is None
    assert pagado["cupo"]["situacion"] == cupos.ASEGURADO
    # Y puede seguir pidiendo el plazo para pagar por partes.
    assert plazo["impedimento"] is None


def test_sin_cupos_que_pagar_no_se_acepta_ni_comprobante_ni_abono(monkeypatch):
    """9 asegurados y un comprobante en revision de 10: el ultimo ya tiene dueno."""
    async def caso(db):
        en_revision = _inscrito(50, payment_receipt={"status": "pending_review"})
        await _sembrar(db, limite=10, pagados=9, sin_pagar=3, extra=[en_revision])
        info = await registration.get_payment_info_for_athlete("token-10")
        plazo = await registration.ver_plazo("token-10")
        errores = []
        with pytest.raises(HTTPException) as e1:
            await registration.submit_payment_receipt(
                "token-10", payment_date="2026-10-05", bank_origin="Popular", receipt_image=None)
        errores.append(e1.value.status_code)
        with pytest.raises(HTTPException) as e2:
            await registration.pedir_plazo(
                "token-10", monto_abonado="1000", fecha_propuesta="2026-11-10",
                payment_date="2026-10-05", bank_origin="Popular", receipt_image=None)
        errores.append(e2.value.status_code)
        return info, plazo, errores

    info, plazo, errores = correr(caso, monkeypatch)
    assert info["cupo"]["situacion"] == cupos.EN_ESPERA
    assert info["impedimento"] and "lista de espera" in info["impedimento"]
    assert plazo["impedimento"] and "lista de espera" in plazo["impedimento"]
    assert errores == [409, 409]


def test_la_organizacion_no_aprueba_por_encima_del_limite(monkeypatch):
    async def caso(db):
        con_comprobante = _inscrito(50, payment_receipt={"status": "pending_review"})
        con_abono = _inscrito(51, plazo_pago={"estado": "pendiente", "monto_abonado": 1000})
        await _sembrar(db, limite=10, pagados=10, sin_pagar=1, extra=[con_comprobante, con_abono])
        errores = []
        with pytest.raises(HTTPException) as e1:
            await registration.review_payment_receipt("corredor50@correo.com", CARRERA, approved=True)
        errores.append((e1.value.status_code, e1.value.detail))
        with pytest.raises(HTTPException) as e2:
            await registration.revisar_plazo("corredor51@correo.com", CARRERA, aprobado=True)
        errores.append((e2.value.status_code, e2.value.detail))
        with pytest.raises(HTTPException) as e3:
            await registration.marcar_inscripcion_cortesia(
                "corredor11@correo.com", CARRERA, registration.CortesiaRequest(motivo="Invitado"),
                usuario={"username": "admin"})
        errores.append((e3.value.status_code, e3.value.detail))
        return errores, await db.registrations.find_one({"email": "corredor50@correo.com"})

    errores, registro = correr(caso, monkeypatch)
    assert [codigo for codigo, _ in errores] == [409, 409, 409]
    assert all("límite" in detalle for _, detalle in errores)
    # Nada quedo a medias.
    assert registro["payment_status"] == "pending"
    assert registro["payment_receipt"]["status"] == "pending_review"


def test_el_aviso_va_solo_a_quien_tiene_el_cupo_por_confirmar(monkeypatch):
    async def caso(db):
        otros = [
            _inscrito(60, payment_receipt={"status": "pending_review"}),
            _inscrito(61, plazo_pago={"estado": "aprobado", "monto_abonado": 1000}),
            _inscrito(62, plazo_pago={"estado": "pendiente", "monto_abonado": 1000}),
            _inscrito(63, plazo_pago={"estado": "rechazado"}),
            _inscrito(64, payment_status="paid", inscripcion_cortesia=True),
            _inscrito(65, status="waitlist"),
            _inscrito(66, status="cancelled"),
        ]
        await _sembrar(db, limite=170, pagados=2, sin_pagar=2, extra=otros)
        consulta = athletes._inscribed_registration_query(CARRERA, None, "por_confirmar")
        return sorted([r["bib"] async for r in db.registrations.find(consulta)])

    # Los dos sin pagar, el del abono rechazado y el de la lista de espera de antes.
    assert correr(caso, monkeypatch) == ["003", "004", "063", "065"]


def test_la_plantilla_del_aviso_dice_lo_acordado():
    plantilla = next(t for t in DEFAULT_TEMPLATES if t["id"] == "cupo_no_garantizado")
    html = plantilla["content"]
    assert "sigue activa" in html and "no está garantizado" in html
    assert "podrías perder tu derecho a participar" in html
    assert "15 de noviembre" in html
    for enlace in ("{{athlete_plazo_link}}", "{{athlete_cancel_link}}", "{{frontend_url}}/mi-perfil"):
        assert enlace in html
