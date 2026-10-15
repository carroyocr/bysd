"""La sesion del equipo en la app: cuanto dura y que pasa cuando caduca.

El token del equipo duraba 12 horas para todos, y la app instalada (1.3.11),
ante el 401 de `/api/staff/mi-perfil`, deja la pantalla en blanco: ni aviso
ni boton. La biometria devuelve el mismo token guardado, no uno nuevo. Dos
cosas se protegen aqui:

- `cuentas.duracion`: 12 h solo para quien abre el panel (permisos propios o
  admin); una semana para el resto del equipo, aunque lleve el escaner que le
  da su turno; 72 h para corredor y espectador.
- `GET /api/staff/mi-perfil` es la unica ruta que acepta un token caducado con
  la firma buena, y responde vacio con `sesion_caducada` y `token_caducado`,
  que es lo que la app sabe pintar. Las demas siguen dando 401.

    backend/.venv/bin/python -m pytest tests/test_sesion_caducada_app.py -v
"""
import asyncio
import os
from datetime import datetime, timedelta, timezone

import jwt
import pytest

os.environ.setdefault("JWT_SECRET_KEY", "clave-solo-para-tests-" + "x" * 40)
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "bysd_test_rutas")
os.environ.setdefault("EMAILS_ACTIVOS", "false")

from fastapi import HTTPException  # noqa: E402

import server  # noqa: E402,F401
from routes import staff_account  # noqa: E402
from services import auth, cuentas  # noqa: E402

CORREO = "voluntaria@correo.com"


def _token(roles=("fan", "staff"), hace_horas=1, clave=None):
    """Un token de cuenta nueva emitido hace `hace_horas` con una hora de vida."""
    emitido = datetime.now(timezone.utc) - timedelta(hours=hace_horas)
    payload = {
        "sub": "abc", "email": CORREO, "username": CORREO, "roles": list(roles),
        "permissions": [], "is_admin": False, "ver": cuentas.VERSION_TOKEN, "sv": 0,
        "exp": emitido + timedelta(hours=1),
    }
    return jwt.encode(payload, clave or auth.SECRET_KEY, algorithm=auth.ALGORITHM)


# ==================== Cuanto dura ====================


def test_el_panel_dura_doce_horas():
    for cuenta in ({"permissions": ["volunteers"]}, {"is_admin": True}, {"permissions": ["all"], "is_admin": True}):
        assert cuentas.duracion(["fan", "staff"], cuenta) == timedelta(hours=12)


def test_el_voluntario_sin_panel_dura_una_semana():
    assert cuentas.duracion(["fan", "staff"], {}) == timedelta(days=7)
    assert cuentas.duracion(["fan", "staff"], {"permissions": []}) == timedelta(days=7)
    assert cuentas.duracion(["fan", "athlete", "staff"], {"email_verified": True}) == timedelta(days=7)


def test_el_escaner_que_llega_por_el_turno_no_lo_convierte_en_panel():
    """`poner_al_dia` suma el permiso al token y deja apuntado que es del turno."""
    con_turno = {"permissions": ["scanner"], "permisos_del_turno": ["scanner"]}
    assert cuentas.duracion(["fan", "staff"], con_turno) == timedelta(days=7)
    # Si ademas tiene permisos propios, es del panel.
    con_panel = {"permissions": ["scanner", "volunteers"], "permisos_del_turno": ["scanner"]}
    assert cuentas.duracion(["fan", "staff"], con_panel) == timedelta(hours=12)


def test_corredor_y_espectador_siguen_en_72_horas():
    assert cuentas.duracion(["fan"], {}) == timedelta(hours=72)
    assert cuentas.duracion(["fan", "athlete"], {"permissions": ["all"]}) == timedelta(hours=72)


def test_el_token_emitido_lleva_la_duracion_de_su_cuenta():
    cuenta = {"_id": "abc", "email": CORREO, "roles": ["fan", "staff"], "permissions": []}
    exp = auth.decodificar(cuentas.emitir_token(cuenta))["exp"]
    vence = datetime.fromtimestamp(exp, tz=timezone.utc) - datetime.now(timezone.utc)
    assert timedelta(days=6, hours=23) < vence <= timedelta(days=7)


# ==================== Cuando caduca ====================


def test_mi_perfil_responde_vacio_y_pide_entrar_otra_vez():
    payload = auth.require_admin_aunque_caducado(f"Bearer {_token(hace_horas=3)}")
    assert payload["caducado"] is True and payload["username"] == CORREO

    respuesta = asyncio.run(staff_account.mi_perfil(payload))
    assert respuesta["sesion_caducada"] is True and respuesta["token_caducado"] is True
    assert respuesta["verificacion_pendiente"] is False
    assert respuesta["perfil"] is None and respuesta["turnos"] == []
    assert respuesta["username"] == CORREO


def test_con_el_token_vigente_no_lleva_la_marca():
    payload = auth.require_admin_aunque_caducado(f"Bearer {_token(hace_horas=0)}")
    assert "caducado" not in payload


def test_las_demas_rutas_siguen_rechazando_el_token_caducado():
    with pytest.raises(HTTPException) as error:
        auth.require_admin(f"Bearer {_token(hace_horas=3)}")
    assert error.value.status_code == 401 and error.value.detail == "Token expirado"
    with pytest.raises(HTTPException) as error:
        auth.require_permission("volunteers")(f"Bearer {_token(hace_horas=3)}")
    assert error.value.status_code == 401


def test_caducado_pero_con_otra_firma_no_pasa():
    with pytest.raises(HTTPException) as error:
        auth.require_admin_aunque_caducado(f"Bearer {_token(hace_horas=3, clave='otra-clave-' + 'y' * 40)}")
    assert error.value.status_code == 401


def test_caducado_y_sin_rol_de_equipo_tampoco():
    with pytest.raises(HTTPException) as error:
        auth.require_admin_aunque_caducado(f"Bearer {_token(roles=('fan', 'athlete'), hace_horas=3)}")
    assert error.value.status_code == 403


def test_solo_mi_perfil_acepta_el_token_caducado():
    """Si otra ruta lo acepta, hay que mirar que responde con el."""
    from fastapi.routing import APIRoute

    def dependencias(dependant, vistas=None):
        vistas = [] if vistas is None else vistas
        for dep in dependant.dependencies:
            vistas.append(getattr(dep.call, "__qualname__", ""))
            dependencias(dep, vistas)
        return vistas

    con_caducado = {
        (m, r.path) for r in server.app.routes if isinstance(r, APIRoute)
        for m in r.methods - {"HEAD", "OPTIONS"}
        if "require_admin_aunque_caducado" in dependencias(r.dependant)
    }
    assert con_caducado == {("GET", "/api/staff/mi-perfil")}
