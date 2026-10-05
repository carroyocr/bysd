"""Confirmar el correo no es una forma de entrar sin contrasena.

`POST /api/cuentas/verificar` devolvia la sesion de la cuenta en cuanto veia que
su correo ya estaba confirmado, sin mirar el codigo. Con saber el correo de un
corredor o de alguien del equipo —y los del equipo llevan permisos del panel—
bastaba para entrar en su cuenta.

Y el codigo solo tampoco basta para confirmar: demuestra que quien lo escribe
lee ese buzon, no que la cuenta la abriera el. Hace falta ademas su sesion o su
contrasena; si no, el dueno del correo le confirmaria la cuenta a quien la abrio
con su direccion.

Van contra la funcion de la ruta, con una base de usar y tirar en el Mongo
local puesta en el sitio de `server.db`:

    backend/.venv/bin/python -m pytest tests/test_verificar_no_regala_sesion.py -v
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
from routes import cuentas as rutas  # noqa: E402
from services import cuentas  # noqa: E402

MONGO = os.environ.get("TEST_MONGO_URL", "mongodb://localhost:27017")
CORREO = "persona@correo.com"
CLAVE = "la-de-verdad-123"


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


def test_una_cuenta_ya_verificada_no_da_sesion_por_su_correo(monkeypatch):
    async def caso(db):
        await cuentas.crear(
            db, email=CORREO, password=CLAVE, nombre="Ana",
            roles=[cuentas.STAFF], permissions=["scanner"], email_verified=True,
        )
        with pytest.raises(HTTPException) as error:
            await rutas.verificar(rutas.Codigo(email=CORREO, code="000000"), authorization=None)
        return error.value

    error = correr(caso, monkeypatch)
    assert error.status_code == 409


def test_sin_el_codigo_no_hay_sesion(monkeypatch):
    async def caso(db):
        cuenta = await cuentas.crear(db, email=CORREO, password=CLAVE, nombre="Ana")
        await db.accounts.update_one({"_id": cuenta["_id"]}, {"$set": {
            "verification_code": "123456",
            "verification_code_expires": datetime.now(timezone.utc) + timedelta(minutes=30),
        }})
        with pytest.raises(HTTPException) as error:
            await rutas.verificar(
                rutas.Codigo(email=CORREO, code="654321", password=CLAVE), authorization=None)
        return error.value, await cuentas.por_email(db, CORREO)

    error, cuenta = correr(caso, monkeypatch)
    assert error.status_code == 400
    assert not cuenta["email_verified"]


async def _cuenta_con_codigo(db, **extra):
    cuenta = await cuentas.crear(db, email=CORREO, password=CLAVE, nombre="Ana", **extra)
    await db.accounts.update_one({"_id": cuenta["_id"]}, {"$set": {
        "verification_code": "123456",
        "verification_code_expires": datetime.now(timezone.utc) + timedelta(minutes=30),
    }})
    return cuenta


def test_con_el_codigo_y_la_contrasena_se_confirma_y_no_vale_dos_veces(monkeypatch):
    async def caso(db):
        await _cuenta_con_codigo(db)
        sesion = await rutas.verificar(
            rutas.Codigo(email=CORREO, code="123456", password=CLAVE), authorization=None)
        with pytest.raises(HTTPException) as repetido:
            await rutas.verificar(
                rutas.Codigo(email=CORREO, code="123456", password=CLAVE), authorization=None)
        return sesion, repetido.value

    sesion, repetido = correr(caso, monkeypatch)
    assert sesion["token"] and sesion["cuenta"]["email_verified"] is True
    assert repetido.status_code == 409


def test_el_codigo_solo_no_confirma_la_cuenta_que_abrio_otro(monkeypatch):
    """El dueno del correo recibe el codigo de una cuenta que no abrio el."""
    async def caso(db):
        await _cuenta_con_codigo(db, roles=[cuentas.STAFF])
        errores = []
        for password in (None, "la-mia-de-siempre"):
            with pytest.raises(HTTPException) as error:
                await rutas.verificar(
                    rutas.Codigo(email=CORREO, code="123456", password=password),
                    authorization=None)
            errores.append(error.value.status_code)
        return errores, await cuentas.por_email(db, CORREO)

    errores, cuenta = correr(caso, monkeypatch)
    assert errores == [401, 401]
    assert not cuenta["email_verified"]
    # Y el codigo no se quema: quien si tiene la contrasena puede usarlo aun.
    assert cuenta["verification_code"] == "123456"


def test_con_la_sesion_abierta_basta_el_codigo(monkeypatch):
    """La app y Mi cuenta confirman con la sesion puesta, sin volver a pedir la contrasena."""
    async def caso(db):
        cuenta = await _cuenta_con_codigo(db, roles=[cuentas.STAFF])
        cabecera = "Bearer " + cuentas.emitir_token(cuenta)
        return await rutas.verificar(
            rutas.Codigo(email=CORREO, code="123456"), authorization=cabecera)

    sesion = correr(caso, monkeypatch)
    assert sesion["cuenta"]["email_verified"] is True


def test_la_sesion_de_otra_cuenta_no_sirve(monkeypatch):
    async def caso(db):
        await _cuenta_con_codigo(db, roles=[cuentas.STAFF])
        otra = await cuentas.crear(db, email="otra@correo.com", password="otra-clave-123", nombre="Otra")
        with pytest.raises(HTTPException) as error:
            await rutas.verificar(
                rutas.Codigo(email=CORREO, code="123456"),
                authorization="Bearer " + cuentas.emitir_token(otra))
        return error.value, await cuentas.por_email(db, CORREO)

    error, cuenta = correr(caso, monkeypatch)
    assert error.status_code == 401
    assert not cuenta["email_verified"]


def test_cambiar_la_contrasena_con_codigo_deja_fuera_a_quien_abrio_la_cuenta(monkeypatch):
    """La salida de quien tiene el buzon y no la contrasena."""
    async def caso(db):
        cuenta = await cuentas.crear(
            db, email=CORREO, password="la-del-intruso-123", nombre="Intruso", roles=[cuentas.STAFF])
        await db.accounts.update_one({"_id": cuenta["_id"]}, {"$set": {
            "reset_code": "777777",
            "reset_code_expires": datetime.now(timezone.utc) + timedelta(minutes=30),
        }})
        await rutas.nueva_password(rutas.NuevaPassword(email=CORREO, code="777777", password=CLAVE))
        return (
            await cuentas.autenticar(db, CORREO, "la-del-intruso-123"),
            await cuentas.autenticar(db, CORREO, CLAVE),
        )

    intruso, duena = correr(caso, monkeypatch)
    assert intruso is None
    assert duena and cuentas.demostrada(duena)
