"""Condicion de salida de la fase 1 del plan de cuenta unica.

Lo que estos tests protegen: hasta ahora, que un token de corredor no valiera en
el panel era una garantia *criptografica* —los dos se firmaban con claves
distintas—. Con una sola cuenta y un solo token esa garantia pasa a depender de
que se miren los roles, y hay seis sitios que historicamente exigian solo "token
valido" sin permiso concreto. Si alguien quita esa comprobacion, aqui se rompe
algo y se ve; en produccion no se veria hasta que un corredor entrara donde no
debe.

No necesitan servidor ni base de datos: van contra las funciones de las que
cuelgan las rutas.

    backend/.venv/bin/python -m pytest tests/test_cuenta_unica.py -v
"""
import os
from datetime import datetime, timedelta, timezone

import pytest

# `services.auth` exige el secreto al importarse y no arranca sin el. En los
# tests se pone uno propio: asi corren sin depender del .env de nadie.
os.environ.setdefault("JWT_SECRET_KEY", "clave-solo-para-tests-" + "x" * 40)

import jwt  # noqa: E402

from services import auth, cuentas  # noqa: E402
from fastapi import HTTPException  # noqa: E402


# ==================== Ayudas ====================


def cabecera(token: str) -> str:
    return f"Bearer {token}"


def token_nuevo(roles, permissions=None, is_admin=False, email="alguien@correo.com"):
    """Un token del formato actual, con los roles que se le pidan."""
    return cuentas.emitir_token({
        "_id": "abc123",
        "email": email,
        "roles": roles,
        "permissions": permissions or [],
        "is_admin": is_admin,
    })


def token_atleta_heredado(email="corredor@correo.com"):
    """Como los que emitia `/api/athletes/login` antes de la cuenta unica."""
    return jwt.encode(
        {
            "athlete_id": "id-del-atleta",
            "email": email,
            "type": "athlete",
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        },
        auth.ATHLETE_SECRET_KEY,
        algorithm=auth.ALGORITHM,
    )


def token_panel_heredado(username="admin", permissions=("all",), is_admin=True):
    """Como los que emitia `/api/race/auth/admin-login`."""
    return auth.encode_admin_token({
        "username": username,
        "is_admin": is_admin,
        "permissions": list(permissions),
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
    })


# ==================== Lo que no se puede romper ====================


class TestUnTokenDeCorredorNoAbreElPanel:
    """El corazon del cambio. Si falla algo aqui, no se despliega."""

    def test_token_de_corredor_heredado_rebotado(self):
        with pytest.raises(HTTPException) as e:
            auth.require_admin(cabecera(token_atleta_heredado()))
        assert e.value.status_code == 403

    def test_token_de_corredor_nuevo_rebotado(self):
        with pytest.raises(HTTPException) as e:
            auth.require_admin(cabecera(token_nuevo([auth.FAN, auth.ATLETA])))
        assert e.value.status_code == 403

    def test_token_de_espectador_rebotado(self):
        with pytest.raises(HTTPException) as e:
            auth.require_admin(cabecera(token_nuevo([auth.FAN])))
        assert e.value.status_code == 403

    def test_el_del_equipo_si_entra(self):
        payload = auth.require_admin(cabecera(token_nuevo([auth.FAN, auth.STAFF])))
        assert auth.STAFF in payload["roles"]

    def test_el_token_del_panel_heredado_sigue_entrando(self):
        """Las sesiones abiertas al desplegar no se pueden caer de golpe."""
        payload = auth.require_admin(cabecera(token_panel_heredado()))
        assert payload["username"] == "admin"
        assert payload["is_admin"] is True


class TestElEspectadorNoEsCorredor:
    def test_sin_rol_de_corredor_no_hay_perfil(self):
        with pytest.raises(HTTPException) as e:
            auth.require_athlete(cabecera(token_nuevo([auth.FAN])))
        assert e.value.status_code == 403

    def test_el_del_equipo_tampoco_por_serlo(self):
        """Ser del equipo no da acceso al perfil de corredor de nadie."""
        with pytest.raises(HTTPException) as e:
            auth.require_athlete(cabecera(token_nuevo([auth.FAN, auth.STAFF])))
        assert e.value.status_code == 403

    def test_el_corredor_heredado_sigue_entrando(self):
        payload = auth.require_athlete(cabecera(token_atleta_heredado()))
        assert payload["sub"] == "id-del-atleta"

    def test_las_dos_cosas_a_la_vez(self):
        """El voluntario que ademas corre: una cuenta, los dos accesos."""
        token = cabecera(token_nuevo([auth.FAN, auth.ATLETA, auth.STAFF]))
        assert auth.require_athlete(token)
        assert auth.require_admin(token)


class TestPermisos:
    def test_del_equipo_pero_sin_permisos_no_toca_nada(self):
        """La cuenta de voluntario: entra a lo suyo, no al resto del panel."""
        token = cabecera(token_nuevo([auth.FAN, auth.STAFF], permissions=[]))

        assert auth.require_admin(token)          # su perfil, si

        for permiso in ["control", "athletes", "finances", "users", "config"]:
            with pytest.raises(HTTPException) as e:
                auth.require_permission(permiso)(token)
            assert e.value.status_code == 403, permiso

    def test_un_permiso_de_tab_satisface_a_su_sombrilla(self):
        token = cabecera(token_nuevo([auth.FAN, auth.STAFF], permissions=["laps"]))
        assert auth.require_permission("control")(token)

    def test_el_espectador_no_pasa_ni_con_permisos_inventados(self):
        """Sin rol de staff, unos `permissions` en el token no valen de nada."""
        token = cabecera(token_nuevo([auth.FAN], permissions=["all"], is_admin=True))
        with pytest.raises(HTTPException) as e:
            auth.require_permission("control")(token)
        assert e.value.status_code == 403


class TestTokensInvalidos:
    def test_sin_cabecera(self):
        with pytest.raises(HTTPException) as e:
            auth.require_cuenta(None)
        assert e.value.status_code == 401

    def test_firma_ajena(self):
        malo = jwt.encode({"roles": ["fan", "staff"], "ver": 2}, "otra-clave", algorithm="HS256")
        with pytest.raises(HTTPException) as e:
            auth.require_cuenta(cabecera(malo))
        assert e.value.status_code == 401

    def test_caducado(self):
        viejo = auth.encode_admin_token({
            "roles": ["fan", "staff"], "ver": 2,
            "exp": datetime.now(timezone.utc) - timedelta(hours=1),
        })
        with pytest.raises(HTTPException) as e:
            auth.require_cuenta(cabecera(viejo))
        assert e.value.status_code == 401
        assert "caduc" in e.value.detail.lower() or "expirado" in e.value.detail.lower()


# ==================== Contrasenas ====================


class TestContrasenas:
    def test_bcrypt_ida_y_vuelta(self):
        h = cuentas.hash_password("Correcta123")
        assert cuentas.verificar_password("Correcta123", h)
        assert not cuentas.verificar_password("Otra", h)

    def test_el_formato_heredado_de_athletes_sigue_valiendo(self):
        """El hash PBKDF2 que hay hoy en `athletes.password_hash`."""
        import hashlib
        import secrets as _s

        salt = _s.token_hex(16)
        pwd = hashlib.pbkdf2_hmac("sha256", b"Correcta123", salt.encode(), 100000)
        heredado = f"{salt}:{pwd.hex()}"

        assert cuentas.es_heredado(heredado)
        assert cuentas.verificar_password("Correcta123", heredado)
        assert not cuentas.verificar_password("Otra", heredado)

    def test_hash_roto_no_revienta(self):
        for basura in ["", None, "sin-formato", "$2b$roto", "a:b:c"]:
            assert cuentas.verificar_password("algo", basura) is False


class FalsaColeccion:
    """Lo minimo de Motor que usa `cuentas.autenticar`."""

    def __init__(self, doc):
        self.doc = doc
        self.cambios = {}

    async def find_one(self, *_a, **_k):
        return self.doc

    async def update_one(self, _filtro, cambios):
        self.cambios.update(cambios.get("$set", {}))


class FalsaDB:
    def __init__(self, doc):
        self.coleccion = FalsaColeccion(doc)

    def __getitem__(self, _nombre):
        return self.coleccion


# `cuentas.autenticar` es asincrona y en el entorno no hay pytest-asyncio. No
# merece la pena anadir una dependencia al backend por dos tests: se arrancan a
# mano con asyncio.run.
def test_el_hash_heredado_se_convierte_al_entrar():
    """La coleccion se pasa a bcrypt sola, segun entra la gente.

    Es lo que evita mandarle a 246 corredores un correo pidiendoles que cambien
    la contrasena por un motivo que no entenderian.
    """
    import asyncio
    import hashlib
    import secrets as _s

    salt = _s.token_hex(16)
    pwd = hashlib.pbkdf2_hmac("sha256", b"Correcta123", salt.encode(), 100000)
    db = FalsaDB({"_id": "x", "email": "a@b.com", "password_hash": f"{salt}:{pwd.hex()}"})

    cuenta = asyncio.run(cuentas.autenticar(db, "a@b.com", "Correcta123"))

    assert cuenta is not None
    nuevo = db.coleccion.cambios["password_hash"]
    assert nuevo.startswith("$2")
    assert cuentas.verificar_password("Correcta123", nuevo)


def test_contrasena_incorrecta_no_toca_nada():
    import asyncio

    db = FalsaDB({"_id": "x", "email": "a@b.com", "password_hash": cuentas.hash_password("Buena")})
    assert asyncio.run(cuentas.autenticar(db, "a@b.com", "Mala")) is None
    assert db.coleccion.cambios == {}


# ==================== Traduccion de tokens ====================


class TestNormalizacion:
    def test_el_de_atleta_nunca_trae_staff(self):
        p = auth.normalizar_payload({"athlete_id": "1", "email": "a@b.com", "type": "athlete"})
        assert p["roles"] == [auth.FAN, auth.ATLETA]
        assert p["permissions"] == []
        assert p["is_admin"] is False

    def test_el_del_panel_conserva_lo_que_leen_los_routers(self):
        p = auth.normalizar_payload({"username": "geizel26", "is_admin": False,
                                     "permissions": ["sponsors", "prensa"]})
        assert p["roles"] == [auth.FAN, auth.STAFF]
        # `staff_account` y `push` leen `username` del token: no puede perderse.
        assert p["username"] == "geizel26"
        assert p["permissions"] == ["sponsors", "prensa"]

    def test_el_nuevo_se_queda_como_esta(self):
        p = auth.normalizar_payload({"ver": 2, "roles": [auth.FAN], "email": "a@b.com"})
        assert p["roles"] == [auth.FAN]


class TestDuracion:
    def test_el_panel_caduca_antes(self):
        assert cuentas.duracion([auth.FAN, auth.STAFF]).total_seconds() == cuentas.HORAS_STAFF * 3600
        assert cuentas.duracion([auth.FAN]).total_seconds() == cuentas.HORAS_PERSONA * 3600
