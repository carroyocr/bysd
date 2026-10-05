"""Ser del equipo no es un permiso.

Una cuenta de staff se crea sola desde la app (`POST /api/cuentas/registro` con
`tipo: "staff"`) y nace sin ningun permiso. Aun asi, trece rutas de `race_config`
y `race` solo pedian el rol: con una cuenta recien creada se podia cambiar la
carrera que ensena el sitio, editarla, subirle logos y manuales, mandar el
correo masivo del manual y leer el panel en vivo con los correos de los
corredores.

Lo que este test protege es la regla, no esas trece rutas: recorre la aplicacion
entera y falla si aparece una ruta que se conforme con el rol de staff sin estar
en la lista de abajo. Quien anada un endpoint del panel con `require_admin` a
secas se entera aqui, y no cuando alguien lo encuentre en produccion.

No cubre las rutas que leen la cabecera `Authorization` a mano dentro de la
funcion (`verify_admin_token(...)` seguido de `has_permission`): esas no
declaran dependencia y hay que mirarlas al escribirlas.

    backend/.venv/bin/python -m pytest tests/test_rutas_solo_rol.py -v
"""
import os

os.environ.setdefault("JWT_SECRET_KEY", "clave-solo-para-tests-" + "x" * 40)
# `server` crea el cliente de Mongo al importarse, pero no se conecta hasta la
# primera consulta: aqui solo se leen las rutas, asi que no hace falta base.
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "bysd_test_rutas")
os.environ.setdefault("EMAILS_ACTIVOS", "false")

from fastapi.routing import APIRoute  # noqa: E402

import server  # noqa: E402

# Lo unico que abre el rol por si solo: lo propio de quien entra. Cada una de
# estas rutas trabaja sobre el correo del token y sobre nada mas.
LO_PROPIO = {
    ("POST", "/api/cuenta/cambiar-password"),
    ("GET", "/api/staff/mi-perfil"),
    ("GET", "/api/staff/mi-perfil/carnet"),
    ("GET", "/api/staff/mi-perfil/postulaciones"),
    ("PUT", "/api/staff/mi-perfil/datos"),
    ("POST", "/api/staff/mi-perfil/turnos/{slot_id}/confirmar"),
    ("GET", "/api/staff/mi-perfil/turnos-disponibles"),
    ("PUT", "/api/staff/mi-perfil/turnos"),
    ("DELETE", "/api/staff/mi-perfil/turnos/{slot_id}"),
}

# Dependencias que solo comprueban que el token sea de alguien del equipo.
SOLO_ROL = {"require_admin", "verify_token"}


def _dependencias(dependant, vistas=None):
    vistas = [] if vistas is None else vistas
    for dep in dependant.dependencies:
        vistas.append(getattr(dep.call, "__qualname__", str(dep.call)))
        _dependencias(dep, vistas)
    return vistas


def _rutas_solo_rol():
    encontradas = set()
    for ruta in server.app.routes:
        if not isinstance(ruta, APIRoute):
            continue
        deps = _dependencias(ruta.dependant)
        pide_rol = any(d in SOLO_ROL for d in deps)
        pide_permiso = any(d.startswith("require_permission.") for d in deps)
        if pide_rol and not pide_permiso:
            for metodo in ruta.methods - {"HEAD", "OPTIONS"}:
                encontradas.add((metodo, ruta.path))
    return encontradas


def test_ninguna_ruta_del_panel_se_conforma_con_el_rol():
    de_mas = _rutas_solo_rol() - LO_PROPIO
    assert not de_mas, (
        "Estas rutas solo piden ser del equipo, y una cuenta de staff la crea "
        f"cualquiera desde la app. Ponles su permiso: {sorted(de_mas)}"
    )


def test_la_lista_de_lo_propio_no_guarda_rutas_que_ya_no_existen():
    """Una excepcion que no corresponde a nada es un hueco esperando su ruta."""
    sobran = LO_PROPIO - _rutas_solo_rol()
    assert not sobran, f"Quita de LO_PROPIO lo que ya no existe: {sorted(sobran)}"


def test_configurar_la_carrera_pide_config():
    """Las que se podian usar con una cuenta recien creada, una a una."""
    esperado = {
        ("POST", "/api/race-config/create"): "config",
        ("PUT", "/api/race-config/update/{code}"): "config",
        ("POST", "/api/race-config/activate/{code}"): "config",
        ("POST", "/api/race-config/upload-logo/{code}"): "config",
        ("POST", "/api/race-config/upload-image/{code}/{image_type}"): "config",
        ("POST", "/api/race-config/upload-manual/{code}/{manual_type}"): "config",
        ("DELETE", "/api/race-config/delete-manual/{code}/{manual_type}"): "config",
        ("GET", "/api/race-config/notify-runners-count/{code}"): "config",
        ("GET", "/api/race-config/notify-volunteers-count/{code}"): "config",
        ("POST", "/api/race-config/notify-runners-manual/{code}"): "config",
        ("POST", "/api/race-config/notify-volunteers-manual/{code}"): "config",
        ("GET", "/api/race/live"): "control",
        ("GET", "/api/race/followers-count"): "control",
    }

    def permisos_de(ruta):
        pedidos = set()

        def recorrer(dependant):
            for dep in dependant.dependencies:
                nombre = getattr(dep.call, "__qualname__", "")
                if nombre.startswith("require_permission."):
                    # El permiso viaja en la clausura de `require_permission`.
                    pedidos.update(c.cell_contents for c in dep.call.__closure__ or ())
                recorrer(dep)

        recorrer(ruta.dependant)
        return pedidos

    vistas = {}
    for ruta in server.app.routes:
        if isinstance(ruta, APIRoute):
            for metodo in ruta.methods:
                if (metodo, ruta.path) in esperado:
                    vistas[(metodo, ruta.path)] = permisos_de(ruta)

    for clave, permiso in esperado.items():
        assert clave in vistas, f"No existe la ruta {clave}"
        assert permiso in vistas[clave], f"{clave} deberia pedir '{permiso}' y pide {vistas[clave]}"
