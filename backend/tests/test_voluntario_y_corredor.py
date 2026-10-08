"""Quien corre y ademas es voluntario es una sola cuenta con los dos roles.

La migracion a la cuenta unica junto a esas personas el dia que se corrio, pero
los caminos por los que alguien gana un segundo papel siguieron escribiendo cada
uno en su sitio: el voluntario que ya tenia cuenta de corredor se quedaba sin el
rol de equipo, y al reves. En la app eso es ver solo uno de los dos accesos.

Lo que estos tests protegen, ademas de que el rol llegue:

- que **no llegue a quien no ha demostrado el correo**. La cuenta de espectador
  nace sin verificar; si bastara con que el correo coincidiera, abrir una con el
  correo de un voluntario daria su ficha medica;
- que la contrasena elegida con el correo demostrado sea la unica que vale.

Van contra las funciones de `services.cuentas`, con una base de usar y tirar en
el Mongo local:

    backend/.venv/bin/python -m pytest tests/test_voluntario_y_corredor.py -v
"""
import asyncio
import os
import uuid

import pytest

os.environ.setdefault("JWT_SECRET_KEY", "clave-solo-para-tests-" + "x" * 40)

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402
from pymongo import MongoClient  # noqa: E402
from pymongo.errors import PyMongoError  # noqa: E402

from services import auth, cuentas  # noqa: E402

MONGO = os.environ.get("TEST_MONGO_URL", "mongodb://localhost:27017")
CORREO = "persona@correo.com"


def _hay_mongo() -> bool:
    try:
        MongoClient(MONGO, serverSelectionTimeoutMS=800).admin.command("ping")
        return True
    except PyMongoError:
        return False


pytestmark = pytest.mark.skipif(not _hay_mongo(), reason="Hace falta un Mongo local")


def correr(caso):
    """Ejecuta `caso(db)` contra una base nueva, que se borra al terminar."""
    async def _todo():
        cliente = AsyncIOMotorClient(MONGO)
        nombre = f"bysd_test_{uuid.uuid4().hex[:12]}"
        db = cliente[nombre]
        try:
            await cuentas.asegurar_indices(db)
            return await caso(db)
        finally:
            await cliente.drop_database(nombre)
            cliente.close()

    return asyncio.run(_todo())


async def corredor(db, verificado=True, password="clave-de-corredor"):
    """Un corredor como lo deja el alta: perfil en `athletes` y su cuenta."""
    perfil = {
        "email": CORREO, "nombre": "Ana", "apellidos": "Paz",
        "password_hash": cuentas.hash_password(password), "email_verified": verificado,
    }
    perfil["_id"] = (await db.athletes.insert_one(perfil)).inserted_id
    cuenta = await cuentas.crear(
        db, email=CORREO, password=password, nombre="Ana", apellidos="Paz",
        roles=[cuentas.ATLETA], email_verified=verificado, athlete_profile_id=perfil["_id"],
    )
    return cuenta, perfil


async def voluntario(db, status="registered"):
    await db.volunteer_registrations.insert_one(
        {"email": CORREO, "nombre": "Ana", "apellidos": "Paz", "status": status}
    )


def roles_del_token(cuenta) -> list:
    return auth.decodificar(cuentas.emitir_token(cuenta))["roles"]


# ==================== El turno da el escaner ====================


async def turno(db, puesto, email=CORREO, **extra):
    """Un turno de `volunteer_assignments` ya asignado a ese correo."""
    await db.volunteer_assignments.insert_one(
        {"id": 1, "puesto": puesto, "turno": "A", "slot": 1, "email_asignado": email, **extra}
    )


def permisos_del_token(cuenta) -> list:
    return auth.decodificar(cuentas.emitir_token(cuenta))["permissions"]


class TestElTurnoDaElEscaner:
    """Control de Vueltas y Corral de salida escanean: el permiso sale del turno."""

    def test_con_turno_de_control_de_vueltas_entra_con_el_escaner(self):
        async def caso(db):
            cuenta = await cuentas.crear(
                db, email=CORREO, password="x" * 8, nombre="Ana",
                roles=[cuentas.STAFF], email_verified=True,
            )
            await turno(db, "Control de Vueltas")

            al_dia = await cuentas.poner_al_dia(db, cuenta)

            assert permisos_del_token(al_dia) == ["scanner"]
            # No se guarda: lo que hay en Usuarios sigue siendo lo que marco la organizacion.
            assert (await cuentas.por_email(db, CORREO))["permissions"] == []

        correr(caso)

    def test_el_corral_tambien_aunque_el_puesto_este_escrito_distinto(self):
        async def caso(db):
            cuenta = await cuentas.crear(
                db, email=CORREO, password="x" * 8, nombre="Ana",
                roles=[cuentas.STAFF], email_verified=True,
            )
            await turno(db, "corral de salida y animacion.")

            assert permisos_del_token(await cuentas.poner_al_dia(db, cuenta)) == ["scanner"]

        correr(caso)

    def test_otro_puesto_no_lo_da(self):
        async def caso(db):
            cuenta = await cuentas.crear(
                db, email=CORREO, password="x" * 8, nombre="Ana",
                roles=[cuentas.STAFF], email_verified=True,
            )
            await turno(db, "Hidratación y Snacks")
            await turno(db, "Control de Ruta.")

            assert permisos_del_token(await cuentas.poner_al_dia(db, cuenta)) == []

        correr(caso)

    def test_un_turno_que_le_quitaron_ya_no_lo_da(self):
        async def caso(db):
            cuenta = await cuentas.crear(
                db, email=CORREO, password="x" * 8, nombre="Ana",
                roles=[cuentas.STAFF], email_verified=True,
            )
            await turno(db, "Control de Vueltas", email=None)

            assert permisos_del_token(await cuentas.poner_al_dia(db, cuenta)) == []

        correr(caso)

    def test_sin_el_correo_demostrado_no_lo_da(self):
        """Abrir una cuenta de staff con el correo de quien controla vueltas."""
        async def caso(db):
            cuenta = await cuentas.crear(
                db, email=CORREO, password="x" * 8, nombre="X", roles=[cuentas.STAFF],
            )
            await turno(db, "Control de Vueltas")

            assert permisos_del_token(await cuentas.poner_al_dia(db, cuenta)) == []

        correr(caso)

    def test_la_cuenta_heredada_del_panel_cuenta_como_demostrada(self):
        async def caso(db):
            cuenta = await cuentas.crear(
                db, email=CORREO, password="x" * 8, nombre="Ana",
                roles=[cuentas.STAFF], staff_username=CORREO,
            )
            await turno(db, "Control de Vueltas")

            assert permisos_del_token(await cuentas.poner_al_dia(db, cuenta)) == ["scanner"]

        correr(caso)

    def test_sin_el_rol_de_equipo_no_lo_da(self):
        """Un espectador verificado con el correo de un turno, pero sin postulacion."""
        async def caso(db):
            cuenta = await cuentas.crear(db, email=CORREO, password="x" * 8, nombre="Ana", email_verified=True)
            await turno(db, "Control de Vueltas")

            al_dia = await cuentas.poner_al_dia(db, cuenta)

            assert al_dia["roles"] == ["fan"]
            assert permisos_del_token(al_dia) == []

        correr(caso)

    def test_se_suma_a_los_del_panel_sin_repetirse(self):
        async def caso(db):
            cuenta = await cuentas.crear(
                db, email=CORREO, password="x" * 8, nombre="Ana",
                roles=[cuentas.STAFF], permissions=["laps", "scanner"], email_verified=True,
            )
            await turno(db, "Control de Vueltas")

            assert permisos_del_token(await cuentas.poner_al_dia(db, cuenta)) == ["laps", "scanner"]

        correr(caso)

    def test_el_corredor_que_controla_vueltas_gana_el_rol_y_el_escaner_de_una_vez(self):
        async def caso(db):
            cuenta, _ = await corredor(db)
            await voluntario(db)
            await turno(db, "Control de Vueltas")

            al_dia = await cuentas.poner_al_dia(db, cuenta)

            assert "staff" in al_dia["roles"]
            assert permisos_del_token(al_dia) == ["scanner"]

        correr(caso)


# ==================== Al entrar ====================


class TestElAccesoPoneLosRolesAlDia:
    def test_el_corredor_que_es_voluntario_gana_el_rol_de_equipo(self):
        async def caso(db):
            cuenta, _ = await corredor(db)
            await voluntario(db)

            al_dia = await cuentas.poner_al_dia(db, cuenta)

            assert set(roles_del_token(al_dia)) == {"fan", "athlete", "staff"}
            guardada = await cuentas.por_email(db, CORREO)
            assert set(guardada["roles"]) == {"fan", "athlete", "staff"}
            # Sigue siendo corredor: el token lleva su perfil.
            assert auth.decodificar(cuentas.emitir_token(al_dia))["athlete_id"]

        correr(caso)

    def test_sin_el_correo_verificado_no_gana_nada(self):
        """Lo que impide heredar la ficha de otro con una cuenta a su correo."""
        async def caso(db):
            ajena = await cuentas.crear(db, email=CORREO, password="la-de-otro", nombre="X")
            await voluntario(db)
            perfil = {"email": CORREO, "email_verified": True, "password_hash": "x"}
            await db.athletes.insert_one(perfil)

            al_dia = await cuentas.poner_al_dia(db, ajena)

            assert al_dia["roles"] == ["fan"]
            assert (await cuentas.por_email(db, CORREO))["roles"] == ["fan"]

        correr(caso)

    def test_un_registro_cancelado_no_da_el_rol(self):
        async def caso(db):
            cuenta, _ = await corredor(db)
            await voluntario(db, status="cancelled")

            al_dia = await cuentas.poner_al_dia(db, cuenta)

            assert "staff" not in al_dia["roles"]

        correr(caso)

    def test_el_del_equipo_con_perfil_de_corredor_gana_el_rol_y_el_perfil(self):
        async def caso(db):
            cuenta = await cuentas.crear(
                db, email=CORREO, password="clave-de-staff", nombre="Ana",
                roles=[cuentas.STAFF], permissions=["scanner"], email_verified=True,
            )
            perfil = {"email": CORREO, "email_verified": True, "password_hash": "x"}
            perfil["_id"] = (await db.athletes.insert_one(perfil)).inserted_id

            al_dia = await cuentas.poner_al_dia(db, cuenta)

            payload = auth.decodificar(cuentas.emitir_token(al_dia))
            assert set(payload["roles"]) == {"fan", "athlete", "staff"}
            assert payload["athlete_id"] == str(perfil["_id"])
            assert payload["permissions"] == ["scanner"]
            atado = await db.athletes.find_one({"_id": perfil["_id"]})
            assert atado["account_id"] == cuenta["_id"]

        correr(caso)

    def test_un_perfil_de_corredor_sin_verificar_no_da_el_rol(self):
        async def caso(db):
            cuenta = await cuentas.crear(
                db, email=CORREO, password="clave-de-staff", nombre="Ana",
                roles=[cuentas.STAFF], email_verified=True,
            )
            await db.athletes.insert_one({"email": CORREO, "email_verified": False})

            al_dia = await cuentas.poner_al_dia(db, cuenta)

            assert "athlete" not in al_dia["roles"]

        correr(caso)

    def test_quien_ya_esta_al_dia_queda_igual(self):
        async def caso(db):
            cuenta, _ = await corredor(db)
            assert await cuentas.poner_al_dia(db, cuenta) is cuenta
            assert await cuentas.poner_al_dia(db, None) is None

        correr(caso)


# ==================== Al apuntarse de voluntario o ponerse contrasena ====================


class TestLaCuentaDelEquipo:
    def test_sin_cuenta_previa_se_crea_con_el_rol(self):
        async def caso(db):
            cuenta = await cuentas.cuenta_de_equipo(
                db, CORREO, password="clave-nueva-1", nombre="Ana", apellidos="Paz"
            )

            assert set(cuenta["roles"]) == {"fan", "staff"}
            assert cuenta["email_verified"] is True
            assert cuenta["permissions"] == []
            assert await cuentas.autenticar(db, CORREO, "clave-nueva-1")

        correr(caso)

    def test_sin_cuenta_y_sin_contrasena_no_se_crea_nada(self):
        async def caso(db):
            assert await cuentas.cuenta_de_equipo(db, CORREO) is None
            assert await cuentas.por_email(db, CORREO) is None

        correr(caso)

    def test_el_corredor_gana_el_rol_en_su_misma_cuenta(self):
        async def caso(db):
            original, perfil = await corredor(db)

            cuenta = await cuentas.cuenta_de_equipo(db, CORREO, password="clave-nueva-1")

            assert cuenta["_id"] == original["_id"]
            assert await db.accounts.count_documents({}) == 1
            assert set(cuenta["roles"]) == {"fan", "athlete", "staff"}
            # Una sola contrasena: la que acaba de elegir, tambien en el perfil.
            assert await cuentas.autenticar(db, CORREO, "clave-nueva-1")
            assert not await cuentas.autenticar(db, CORREO, "clave-de-corredor")
            guardado = await db.athletes.find_one({"_id": perfil["_id"]})
            assert cuentas.verificar_password("clave-nueva-1", guardado["password_hash"])

        correr(caso)

    def test_el_corredor_sin_contrasena_nueva_conserva_la_suya(self):
        async def caso(db):
            await corredor(db)

            cuenta = await cuentas.cuenta_de_equipo(db, CORREO)

            assert "staff" in cuenta["roles"]
            assert await cuentas.autenticar(db, CORREO, "clave-de-corredor")

        correr(caso)

    def test_una_cuenta_sin_verificar_no_gana_el_rol_sin_contrasena_nueva(self):
        async def caso(db):
            await cuentas.crear(db, email=CORREO, password="la-de-otro", nombre="X")

            cuenta = await cuentas.cuenta_de_equipo(db, CORREO)

            assert cuenta["roles"] == ["fan"]

        correr(caso)

    def test_la_contrasena_nueva_deja_fuera_a_quien_abrio_la_cuenta_con_correo_ajeno(self):
        async def caso(db):
            await cuentas.crear(db, email=CORREO, password="la-de-otro", nombre="X")

            cuenta = await cuentas.cuenta_de_equipo(db, CORREO, password="la-del-dueno")

            assert "staff" in cuenta["roles"]
            assert cuenta["email_verified"] is True
            assert not await cuentas.autenticar(db, CORREO, "la-de-otro")
            assert await cuentas.autenticar(db, CORREO, "la-del-dueno")

        correr(caso)

    def test_los_permisos_que_ya_tenia_no_se_tocan(self):
        async def caso(db):
            await cuentas.crear(
                db, email=CORREO, password="clave-de-staff", nombre="Ana",
                roles=[cuentas.STAFF], permissions=["scanner"],
            )

            cuenta = await cuentas.cuenta_de_equipo(db, CORREO, password="clave-nueva-1")

            assert cuenta["permissions"] == ["scanner"]
            assert (await cuentas.por_email(db, CORREO))["permissions"] == ["scanner"]

        correr(caso)


# ==================== Al verificar el perfil de corredor ====================


class TestElPerfilDeCorredorSeAtaASuCuenta:
    def test_el_voluntario_que_se_hace_corredor(self):
        async def caso(db):
            cuenta = await cuentas.crear(
                db, email=CORREO, password="clave-de-staff", nombre="Ana", roles=[cuentas.STAFF],
            )
            perfil = {
                "email": CORREO, "email_verified": True,
                "password_hash": cuentas.hash_password("clave-de-corredor"),
            }
            perfil["_id"] = (await db.athletes.insert_one(perfil)).inserted_id

            enlazada = await cuentas.enlazar_corredor(db, perfil)

            assert enlazada["_id"] == cuenta["_id"]
            payload = auth.decodificar(cuentas.emitir_token(enlazada))
            assert set(payload["roles"]) == {"fan", "athlete", "staff"}
            assert payload["athlete_id"] == str(perfil["_id"])
            # Vale la contrasena del perfil, que es la que se acaba de elegir.
            assert await cuentas.autenticar(db, CORREO, "clave-de-corredor")
            assert not await cuentas.autenticar(db, CORREO, "clave-de-staff")

        correr(caso)

    def test_el_alta_normal_solo_queda_verificada(self):
        async def caso(db):
            cuenta, perfil = await corredor(db, verificado=False)

            enlazada = await cuentas.enlazar_corredor(db, perfil)

            assert enlazada["email_verified"] is True
            guardada = await cuentas.por_email(db, CORREO)
            assert guardada["email_verified"] is True
            assert guardada["password_hash"] == cuenta["password_hash"]
            assert set(guardada["roles"]) == {"fan", "athlete"}

        correr(caso)

    def test_sin_cuenta_no_hay_nada_que_atar(self):
        async def caso(db):
            assert await cuentas.enlazar_corredor(db, {"_id": 1, "email": CORREO}) is None

        correr(caso)


# ==================== Quien solo existia en admin_users ====================


class TestSeAdoptaAQuienSoloEstabaEnElPanel:
    @staticmethod
    async def _heredado(db, **extra):
        await db.admin_users.insert_one({
            "username": CORREO, "password": cuentas.hash_password("clave-de-staff"),
            "nombre": "Ana Paz", "permissions": ["scanner"], "es_voluntario": True, **extra,
        })

    def test_al_acertar_la_contrasena_se_le_hace_la_cuenta(self):
        async def caso(db):
            await self._heredado(db)

            cuenta = await cuentas.adoptar_del_panel(db, CORREO.upper(), "clave-de-staff")

            assert set(cuenta["roles"]) == {"fan", "staff"}
            assert cuenta["permissions"] == ["scanner"]
            assert cuenta["email_verified"] is True
            assert await cuentas.autenticar(db, CORREO, "clave-de-staff")
            assert (await cuentas.del_equipo(db, CORREO))["_id"] == cuenta["_id"]

        correr(caso)

    def test_con_la_contrasena_mal_no(self):
        async def caso(db):
            await self._heredado(db)
            assert await cuentas.adoptar_del_panel(db, CORREO, "otra-cosa") is None
            assert await cuentas.por_email(db, CORREO) is None

        correr(caso)

    def test_quien_ya_tiene_cuenta_no_se_toca(self):
        async def caso(db):
            await self._heredado(db)
            await corredor(db)
            assert await cuentas.adoptar_del_panel(db, CORREO, "clave-de-staff") is None
            assert await db.accounts.count_documents({}) == 1

        correr(caso)

    def test_un_usuario_que_no_es_un_correo_sigue_por_donde_iba(self):
        async def caso(db):
            await db.admin_users.insert_one(
                {"username": "geizel26", "password": cuentas.hash_password("clave-de-staff")}
            )
            assert await cuentas.adoptar_del_panel(db, "geizel26", "clave-de-staff") is None

        correr(caso)
