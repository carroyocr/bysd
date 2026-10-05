"""El rol de equipo, por si solo, no ensena la ficha de nadie.

Darse de alta como staff en la app (`POST /api/cuentas/registro`, `tipo: "staff"`)
crea la cuenta con el rol puesto, sin verificar el correo, y devuelve la sesion.
`/api/staff/mi-perfil` buscaba al voluntario por el correo del token y solo
pedia el rol: con conocer el correo de un voluntario que aun no tuviera cuenta
se leia su telefono, su tipo de sangre, sus alergias y su contacto de
emergencia, se le soltaban los turnos y se bajaba su carnet.

`test_voluntario_y_corredor.py` protege que el rol no se *sume* a una cuenta sin
verificar. Esto es el caso que aquella regla no cubre: aqui el rol no se suma,
se pide. Lo que estos tests protegen:

- que la cuenta de staff sin demostrar no vea ni toque lo del voluntario, y que
  la respuesta no diga siquiera si ese correo esta apuntado;
- que no pierdan el acceso los que ya eran del equipo: las cuentas migradas de
  `admin_users` (sin verificar, con `staff_username`) y los tokens heredados
  del panel;
- que a una cuenta sin demostrar no se le puedan dar permisos desde Usuarios;
- que el camino de vuelta funcione: el codigo llega, y con el la ficha.

Van contra las funciones de las rutas y del servicio, con una base de usar y
tirar en el Mongo local puesta en el sitio de `server.db`:

    backend/.venv/bin/python -m pytest tests/test_staff_sin_demostrar.py -v
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
from routes import carnets_staff, staff_account, users  # noqa: E402
from routes import cuentas as rutas  # noqa: E402
from services import auth, cuentas  # noqa: E402
from services import template_email_service  # noqa: E402

MONGO = os.environ.get("TEST_MONGO_URL", "mongodb://localhost:27017")
CORREO = "voluntaria@correo.com"
CLAVE = "la-de-verdad-123"


def _hay_mongo() -> bool:
    try:
        MongoClient(MONGO, serverSelectionTimeoutMS=800).admin.command("ping")
        return True
    except PyMongoError:
        return False


pytestmark = pytest.mark.skipif(not _hay_mongo(), reason="Hace falta un Mongo local")


@pytest.fixture
def correos(monkeypatch):
    """Lo que se habria mandado: (plantilla, destinatario, codigo). No sale nada."""
    enviados = []

    async def _no_enviar(db, template_id, to_email, data, subject_prefix=""):
        enviados.append((template_id, to_email, data.get("verification_code")))
        return True

    monkeypatch.setattr(template_email_service, "send_email_with_template", _no_enviar)
    return enviados


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
            await _terminar_avisos()
            await cliente.drop_database(nombre)
            cliente.close()

    return asyncio.run(_todo())


async def _terminar_avisos():
    """El perfil manda el codigo en una tarea aparte: se espera a que acabe."""
    otras = [t for t in asyncio.all_tasks() if t is not asyncio.current_task()]
    if otras:
        await asyncio.gather(*otras, return_exceptions=True)


async def _voluntaria(db, email=CORREO):
    await db.volunteer_registrations.insert_one({
        "email": email, "nombre": "Ana", "apellidos": "Perez", "status": "confirmed",
        "telefono": "809-555-0100", "tipo_sangre": "O+", "condicion_medica": "si",
        "condicion_medica_detalle": "asma", "contacto_emergencia_telefono": "809-555-0199",
        "race_code": "MUNDIAL-2026", "evento": "carrera", "slots_interes": [7],
        "created_at": datetime.now(timezone.utc),
    })
    await db.volunteer_assignments.insert_one({
        "id": 7, "puesto": "Avituallamiento", "email_asignado": email, "nombre_asignado": "Ana Perez",
    })


async def _alta_de_staff(email=CORREO, password=CLAVE, nombre="Intruso"):
    """Lo que hace la app al elegir "Staff": devuelve la sesion ya decodificada."""
    sesion = await rutas.registro(rutas.Registro(email=email, nombre=nombre, password=password, tipo="staff"))
    return auth.decodificar(sesion["token"])


def token_heredado(usuario=CORREO, permissions=None):
    """El que emitia el panel antes de la cuenta unica: sin `ver` ni `sub`."""
    return auth.normalizar_payload({
        "username": usuario, "is_admin": False, "permissions": permissions or [],
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
    })


# ==================== La regla ====================


def test_que_cuenta_tiene_el_correo_demostrado():
    assert cuentas.demostrada({"email_verified": True})
    # Migrada de `admin_users`: nunca tuvo la marca, pero no salio de un alta libre.
    assert cuentas.demostrada({"email_verified": False, "staff_username": "geizel26"})
    assert not cuentas.demostrada({"email_verified": False, "roles": ["fan", "staff"]})
    assert not cuentas.demostrada({"roles": ["fan", "staff"], "permissions": ["scanner"]})
    assert not cuentas.demostrada(None)


def test_el_token_heredado_del_panel_pasa_y_el_nuevo_depende_de_su_cuenta():
    assert cuentas.sesion_demostrada(token_heredado(), None)

    nuevo = {"ver": cuentas.VERSION_TOKEN, "sub": "abc", "roles": ["fan", "staff"]}
    assert cuentas.sesion_demostrada(nuevo, {"email_verified": True})
    assert not cuentas.sesion_demostrada(nuevo, {"email_verified": False})
    # La cuenta se borro y el token sigue vivo: no hay nada que ensenar.
    assert not cuentas.sesion_demostrada(nuevo, None)


# ==================== El hueco ====================


def test_el_alta_de_staff_con_el_correo_de_un_voluntario_no_ve_su_ficha(monkeypatch, correos):
    async def caso(db):
        await _voluntaria(db)
        payload = await _alta_de_staff()
        return await staff_account.mi_perfil(payload)

    perfil = correr(caso, monkeypatch)
    assert perfil["perfil"] is None
    assert perfil["turnos"] == []
    assert perfil["slots_interes"] == []
    assert perfil["verificacion_pendiente"] is True


def test_la_respuesta_no_dice_si_ese_correo_esta_apuntado(monkeypatch, correos):
    """Si cambiara segun hubiera ficha o no, serviria para averiguar quien es voluntario."""
    async def caso(db):
        await _voluntaria(db)
        con_ficha = await staff_account.mi_perfil(await _alta_de_staff())
        sin_ficha = await staff_account.mi_perfil(await _alta_de_staff(email="nadie@correo.com"))
        return con_ficha, sin_ficha

    con_ficha, sin_ficha = correr(caso, monkeypatch)
    assert con_ficha["es_voluntario"] is False
    assert {**con_ficha, "username": ""} == {**sin_ficha, "username": ""}


def test_tampoco_suelta_turnos_ni_elige_ni_baja_el_carnet(monkeypatch, correos):
    async def caso(db):
        await _voluntaria(db)
        payload = await _alta_de_staff()
        with pytest.raises(HTTPException) as error:
            await staff_account.equipo_con_correo_demostrado(payload)
        return error.value, await db.volunteer_assignments.find_one({"id": 7})

    error, turno = correr(caso, monkeypatch)
    assert error.status_code == 403
    assert turno["email_asignado"] == CORREO


def test_las_rutas_del_voluntario_cuelgan_de_la_comprobacion():
    """Que nadie vuelva a dejar una de estas con `require_admin` a secas."""
    from fastapi.routing import APIRoute

    protegidas = {
        ("DELETE", "/api/staff/mi-perfil/turnos/{slot_id}"),
        ("GET", "/api/staff/mi-perfil/turnos-disponibles"),
        ("PUT", "/api/staff/mi-perfil/turnos"),
        ("GET", "/api/staff/mi-perfil/carnet"),
        ("GET", "/api/staff/mi-perfil/postulaciones"),
    }
    vistas = set()
    for ruta in server.app.routes:
        if not isinstance(ruta, APIRoute):
            continue
        llamadas = {dep.call for dep in ruta.dependant.dependencies}
        if staff_account.equipo_con_correo_demostrado in llamadas:
            vistas.update((metodo, ruta.path) for metodo in ruta.methods)

    assert protegidas <= vistas, f"Sin la comprobacion: {sorted(protegidas - vistas)}"
    assert carnets_staff.mi_carnet  # la del carnet vive en otro router


# ==================== Quien ya era del equipo no pierde nada ====================


def test_la_cuenta_migrada_del_panel_sigue_viendo_su_ficha(monkeypatch, correos):
    async def caso(db):
        await _voluntaria(db)
        cuenta = await cuentas.crear(
            db, email=CORREO, password=CLAVE, nombre="Ana", roles=[cuentas.STAFF],
            email_verified=False, staff_username=CORREO,
        )
        payload = auth.decodificar(cuentas.emitir_token(cuenta))
        await staff_account.equipo_con_correo_demostrado(payload)
        return await staff_account.mi_perfil(payload)

    perfil = correr(caso, monkeypatch)
    assert perfil["perfil"]["tipo_sangre"] == "O+"
    assert [t["slot_id"] for t in perfil["turnos"]] == [7]
    assert perfil["verificacion_pendiente"] is False
    assert correos == []


def test_el_token_heredado_del_panel_sigue_viendo_su_ficha(monkeypatch, correos):
    async def caso(db):
        await _voluntaria(db)
        payload = token_heredado()
        await staff_account.equipo_con_correo_demostrado(payload)
        return await staff_account.mi_perfil(payload)

    perfil = correr(caso, monkeypatch)
    assert perfil["es_voluntario"] is True
    assert perfil["perfil"]["telefono"] == "809-555-0100"


def test_quien_se_puso_contrasena_con_su_codigo_ve_su_ficha(monkeypatch, correos):
    """"Soy voluntario y no tengo contrasena": el camino que ya trae la app instalada."""
    async def caso(db):
        await _voluntaria(db)
        cuenta = await cuentas.cuenta_de_equipo(db, CORREO, password=CLAVE, nombre="Ana")
        return await staff_account.mi_perfil(auth.decodificar(cuentas.emitir_token(cuenta)))

    assert correr(caso, monkeypatch)["perfil"]["tipo_sangre"] == "O+"


def test_el_voluntario_recibe_la_llave_para_editar_su_postulacion(monkeypatch, correos):
    """Una por evento y solo de su edicion mas reciente; la del ano pasado no."""
    async def caso(db):
        ahora = datetime.now(timezone.utc)
        await db.race_configurations.insert_one({"code": "MUNDIAL-2026", "name": "Backyard Ultra SD"})
        await db.volunteer_registrations.insert_many([
            {"email": CORREO, "nombre": "Ana", "status": "confirmed", "race_code": "BYSD-2025",
             "evento": "carrera", "edit_token": "la-del-ano-pasado", "created_at": ahora - timedelta(days=300)},
            {"email": CORREO, "nombre": "Ana", "status": "confirmed", "race_code": "MUNDIAL-2026",
             "evento": "carrera", "edit_token": "llave-carrera", "created_at": ahora - timedelta(days=2)},
            # Postulacion de antes de que existieran las llaves: se le genera.
            {"email": CORREO, "nombre": "Ana", "status": "confirmed", "race_code": "MUNDIAL-2026",
             "evento": "campeonato", "created_at": ahora - timedelta(days=1)},
            {"email": CORREO, "nombre": "Ana", "status": "cancelled", "race_code": "MUNDIAL-2026",
             "evento": "campeonato", "edit_token": "cancelada", "created_at": ahora},
        ])
        cuenta = await cuentas.cuenta_de_equipo(db, CORREO, password=CLAVE, nombre="Ana")
        payload = auth.decodificar(cuentas.emitir_token(cuenta))
        respuesta = await staff_account.mis_postulaciones(payload)
        guardada = await db.volunteer_registrations.find_one(
            {"email": CORREO, "evento": "campeonato", "status": "confirmed"})
        return respuesta["postulaciones"], guardada

    postulaciones, guardada = correr(caso, monkeypatch)
    por_evento = {p["evento"]: p for p in postulaciones}
    assert set(por_evento) == {"carrera", "campeonato"}
    assert por_evento["carrera"]["edit_token"] == "llave-carrera"
    assert por_evento["carrera"]["evento_nombre"] == "Backyard Ultra SD"
    assert len(por_evento["campeonato"]["edit_token"]) == 32
    assert guardada["edit_token"] == por_evento["campeonato"]["edit_token"]


# ==================== El camino de vuelta ====================


def test_el_alta_de_staff_manda_el_codigo(monkeypatch, correos):
    async def caso(db):
        await _alta_de_staff()
        return await cuentas.por_email(db, CORREO)

    cuenta = correr(caso, monkeypatch)
    assert not cuenta["email_verified"]
    assert correos == [("staff_verification", CORREO, cuenta["verification_code"])]


def test_el_alta_de_espectador_sigue_sin_mandar_nada(monkeypatch, correos):
    async def caso(db):
        await rutas.registro(rutas.Registro(email=CORREO, nombre="Ana", password=CLAVE))

    correr(caso, monkeypatch)
    assert correos == []


def test_con_el_codigo_y_su_contrasena_aparece_la_ficha(monkeypatch, correos):
    async def caso(db):
        await _voluntaria(db)
        payload = await _alta_de_staff(nombre="Ana")
        codigo = correos[-1][2]
        await rutas.verificar(rutas.Codigo(email=CORREO, code=codigo, password=CLAVE), authorization=None)
        # Con la misma sesion de antes: lo que se mira es la cuenta, no el token.
        return await staff_account.mi_perfil(payload)

    perfil = correr(caso, monkeypatch)
    assert perfil["perfil"]["tipo_sangre"] == "O+"
    assert perfil["verificacion_pendiente"] is False


def test_quien_ya_tenia_la_cuenta_recibe_el_codigo_al_abrir_su_perfil(monkeypatch, correos):
    """Las cuentas de staff creadas antes de que el alta mandara el codigo."""
    async def caso(db):
        cuenta = await cuentas.crear(db, email=CORREO, password=CLAVE, nombre="Ana", roles=[cuentas.STAFF])
        payload = auth.decodificar(cuentas.emitir_token(cuenta))
        # La app abre el perfil con varias llamadas: sigue siendo un correo.
        await asyncio.gather(*(staff_account.mi_perfil(payload) for _ in range(4)))
        await _terminar_avisos()
        primera = list(correos)

        # Mas tarde, dentro del mismo dia, tampoco.
        await staff_account.mi_perfil(payload)
        await _terminar_avisos()
        misma_tarde = list(correos)

        # Pasado el plazo, otra vez.
        await db.accounts.update_one({"_id": cuenta["_id"]}, {"$set": {
            "verification_code_sent_at":
                datetime.now(timezone.utc) - timedelta(hours=cuentas.HORAS_ENTRE_AVISOS + 1),
        }})
        await staff_account.mi_perfil(payload)
        await _terminar_avisos()
        return primera, misma_tarde, list(correos)

    primera, misma_tarde, al_dia_siguiente = correr(caso, monkeypatch)
    assert [(p, a) for p, a, _ in primera] == [("staff_verification", CORREO)]
    assert misma_tarde == primera
    assert len(al_dia_siguiente) == 2


# ==================== La sesion que ya tenia abierta el intruso ====================


def test_la_sesion_del_intruso_no_ve_la_ficha_cuando_la_duena_se_pone_su_contrasena(monkeypatch, correos):
    """La duena hace lo correcto —ponerse contrasena con su codigo— y la cuenta
    queda demostrada. La sesion que el intruso abrio antes dura horas: sin esto,
    pasaria a ver la ficha justo entonces."""
    async def caso(db):
        await _voluntaria(db)
        intruso = await _alta_de_staff(password="la-del-intruso-123")
        enviados = len(correos)

        cuenta = await cuentas.cuenta_de_equipo(db, CORREO, password=CLAVE, nombre="Ana")
        duena = auth.decodificar(cuentas.emitir_token(cuenta))

        with pytest.raises(HTTPException) as error:
            await staff_account.equipo_con_correo_demostrado(intruso)
        return (
            await staff_account.mi_perfil(intruso),
            error.value,
            await staff_account.mi_perfil(duena),
            len(correos) - enviados,
        )

    del_intruso, error, de_la_duena, correos_de_mas = correr(caso, monkeypatch)
    assert del_intruso["perfil"] is None and del_intruso["turnos"] == []
    assert del_intruso["sesion_caducada"] is True
    assert del_intruso["verificacion_pendiente"] is False
    assert error.status_code == 403
    assert de_la_duena["perfil"]["tipo_sangre"] == "O+"
    # La cuenta ya esta confirmada: a la duena no se le escribe otra vez.
    assert correos_de_mas == 0


def test_cambiar_la_contrasena_con_codigo_tambien_cierra_las_sesiones_de_antes(monkeypatch, correos):
    async def caso(db):
        await _voluntaria(db)
        intruso = await _alta_de_staff(password="la-del-intruso-123")
        await db.accounts.update_one({"email": CORREO}, {"$set": {
            "reset_code": "777777",
            "reset_code_expires": datetime.now(timezone.utc) + timedelta(minutes=30),
        }})
        sesion = await rutas.nueva_password(rutas.NuevaPassword(email=CORREO, code="777777", password=CLAVE))
        return (
            await staff_account.mi_perfil(intruso),
            await staff_account.mi_perfil(auth.decodificar(sesion["token"])),
        )

    del_intruso, de_la_duena = correr(caso, monkeypatch)
    assert del_intruso["perfil"] is None and del_intruso["sesion_caducada"] is True
    assert de_la_duena["perfil"]["telefono"] == "809-555-0100"


def test_confirmar_con_la_propia_contrasena_no_cierra_la_sesion_abierta(monkeypatch, correos):
    """Quien confirma en la web sigue con su sesion de la app: no hay otra persona de por medio."""
    async def caso(db):
        payload = await _alta_de_staff(nombre="Ana")
        await rutas.verificar(
            rutas.Codigo(email=CORREO, code=correos[-1][2], password=CLAVE), authorization=None)
        return payload, await cuentas.por_email(db, CORREO)

    payload, cuenta = correr(caso, monkeypatch)
    assert cuentas.sesion_demostrada(payload, cuenta)


def test_los_tokens_de_antes_de_la_version_de_sesion_siguen_valiendo():
    """Los que estaban emitidos al desplegar no llevan `sv`."""
    de_antes = {"ver": cuentas.VERSION_TOKEN, "sub": "abc", "roles": ["fan", "staff"]}
    assert cuentas.sesion_demostrada(de_antes, {"email_verified": True})
    assert not cuentas.sesion_demostrada(de_antes, {"email_verified": True, "sesion_ver": 1})


# ==================== Permisos desde el panel ====================


def test_a_una_cuenta_sin_demostrar_no_se_le_dan_permisos(monkeypatch, correos):
    """Abrir una con el correo de un voluntario y esperar a que le marquen el escaner."""
    async def caso(db):
        await _alta_de_staff()
        lista = await users.get_users()
        with pytest.raises(HTTPException) as error:
            await users.update_permissions(CORREO, users.PermissionsUpdate(permissions=["scanner"]))
        return lista, error.value, await cuentas.por_email(db, CORREO)

    lista, error, cuenta = correr(caso, monkeypatch)
    assert [u.correo_sin_verificar for u in lista if u.username == CORREO] == [True]
    assert error.status_code == 409
    assert cuenta["permissions"] == []


def test_en_cuanto_confirma_el_correo_ya_se_le_pueden_dar(monkeypatch, correos):
    async def caso(db):
        await _alta_de_staff(nombre="Ana")
        await rutas.verificar(
            rutas.Codigo(email=CORREO, code=correos[-1][2], password=CLAVE), authorization=None)
        await users.update_permissions(CORREO, users.PermissionsUpdate(permissions=["scanner"]))
        return await users.get_users(), await cuentas.por_email(db, CORREO)

    lista, cuenta = correr(caso, monkeypatch)
    assert cuenta["permissions"] == ["scanner"]
    assert [u.correo_sin_verificar for u in lista if u.username == CORREO] == [False]


def test_quitarle_los_permisos_si_se_puede(monkeypatch, correos):
    async def caso(db):
        cuenta = await cuentas.crear(
            db, email=CORREO, password=CLAVE, nombre="Ana", roles=[cuentas.STAFF], permissions=["scanner"])
        await users.update_permissions(CORREO, users.PermissionsUpdate(permissions=[]))
        return await cuentas.por_id(db, cuenta["_id"])

    assert correr(caso, monkeypatch)["permissions"] == []


def test_los_permisos_de_un_usuario_del_panel_no_los_hereda_la_cuenta_que_coincide_por_correo(monkeypatch, correos):
    """`geizel26` tiene su fila en el panel; alguien abre una cuenta de staff con su correo."""
    async def caso(db):
        await db.admin_users.insert_one({
            "username": "geizel26", "password": cuentas.hash_password(CLAVE),
            "email": CORREO, "permissions": [],
        })
        await _alta_de_staff()
        await users.update_permissions("geizel26", users.PermissionsUpdate(permissions=["scanner"]))
        return (
            await db.admin_users.find_one({"username": "geizel26"}),
            await cuentas.por_email(db, CORREO),
            await users.get_users(),
        )

    fila, cuenta, lista = correr(caso, monkeypatch)
    assert fila["permissions"] == ["scanner"]
    assert cuenta["permissions"] == []
    assert [u.permissions for u in lista if u.username == "geizel26"] == [["scanner"]]


def test_la_cuenta_migrada_recibe_permisos_como_siempre(monkeypatch, correos):
    async def caso(db):
        await db.admin_users.insert_one({
            "username": "geizel26", "password": cuentas.hash_password(CLAVE),
            "email": CORREO, "permissions": [],
        })
        await cuentas.crear(
            db, email=CORREO, password=CLAVE, nombre="Geizel", roles=[cuentas.STAFF],
            email_verified=False, staff_username="geizel26",
        )
        await users.update_permissions("geizel26", users.PermissionsUpdate(permissions=["control"]))
        return await cuentas.por_email(db, CORREO), await users.get_users()

    cuenta, lista = correr(caso, monkeypatch)
    assert cuenta["permissions"] == ["control"]
    assert [u.correo_sin_verificar for u in lista if u.username == "geizel26"] == [False]
