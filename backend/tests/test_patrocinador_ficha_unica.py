"""La ficha unica del patrocinador: una marca, muchas carreras.

Se prueban las tres cosas que no se pueden romper al unificar:

1. Que el reparto funcione: los contactos son de la marca y el status, la
   categoria y el anuncio son de cada carrera.
2. Que la vitrina y el pie sigan devolviendo **la misma forma de respuesta**.
   Hay apps instaladas (1.3.x) leyendola tal cual.
3. Que las metricas se cuenten en la carrera que las genero.

Corre contra un backend en marcha:

    REACT_APP_BACKEND_URL=http://localhost:8001 .venv/bin/pytest tests/test_patrocinador_ficha_unica.py
"""
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")

ADMIN_USERNAME = os.environ.get("TEST_ADMIN_USER", "admin")
ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASS", "Backyard2026!")

CARRERA_A = "BYSD-2027"
CARRERA_B = "MUNDIAL-2026"


@pytest.fixture(scope="module")
def sesion():
    s = requests.Session()
    r = s.post(
        f"{BASE_URL}/api/race/auth/admin-login",
        json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD},
    )
    if r.status_code != 200:
        pytest.skip(f"No se pudo autenticar: {r.status_code}")
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    return s


@pytest.fixture
def marca(sesion):
    """Una marca de prueba con su carrera, que se borra al terminar."""
    nombre = f"Prueba Ficha {uuid.uuid4().hex[:8]}"
    r = sesion.post(
        f"{BASE_URL}/api/sponsors/create",
        json={"name": nombre, "telefono": "809-555-0000", "races": [CARRERA_A]},
    )
    assert r.status_code == 200, r.text
    ficha = r.json()["sponsor"]
    yield ficha
    sesion.delete(f"{BASE_URL}/api/sponsors/{ficha['id']}/permanente")


def leer(sesion, sponsor_id):
    r = sesion.get(f"{BASE_URL}/api/sponsors/admin")
    assert r.status_code == 200
    return next(s for s in r.json()["sponsors"] if s["id"] == sponsor_id)


def test_nace_con_su_carrera_marcada(marca):
    assert [p["race_code"] for p in marca["participaciones"]] == [CARRERA_A]
    assert marca["telefono"] == "809-555-0000"


def test_una_marca_no_se_repite(sesion, marca):
    r = sesion.post(f"{BASE_URL}/api/sponsors/create", json={"name": marca["name"]})
    assert r.status_code == 400


def test_el_contacto_es_de_la_marca_y_vale_para_todas(sesion, marca):
    sesion.put(f"{BASE_URL}/api/sponsors/{marca['id']}/carrera/{CARRERA_B}", json={})
    r = sesion.put(
        f"{BASE_URL}/api/sponsors/{marca['id']}",
        json={"nombre_contacto": "María Pérez", "correo": "maria@empresa.com"},
    )
    assert r.status_code == 200

    ficha = leer(sesion, marca["id"])
    assert ficha["nombre_contacto"] == "María Pérez"
    # El dato esta una sola vez, y las dos carreras lo comparten.
    assert {p["race_code"] for p in ficha["participaciones"]} == {CARRERA_A, CARRERA_B}


def test_el_status_es_de_cada_carrera(sesion, marca):
    sesion.put(f"{BASE_URL}/api/sponsors/{marca['id']}/carrera/{CARRERA_B}", json={})
    sesion.put(f"{BASE_URL}/api/sponsors/{marca['id']}/carrera/{CARRERA_A}", json={"status": "pago"})
    sesion.put(f"{BASE_URL}/api/sponsors/{marca['id']}/carrera/{CARRERA_B}", json={"status": "reunion"})

    ficha = leer(sesion, marca["id"])
    status = {p["race_code"]: p["status"] for p in ficha["participaciones"]}
    assert status == {CARRERA_A: "pago", CARRERA_B: "reunion"}

    # Y el cambio de status queda anotado en la bitacora de SU carrera.
    bitacoras = {p["race_code"]: [b["nota"] for b in p.get("bitacora", [])] for p in ficha["participaciones"]}
    assert any("Pago" in n for n in bitacoras[CARRERA_A])
    assert not any("Pago" in n for n in bitacoras[CARRERA_B])


def test_la_vitrina_devuelve_la_forma_de_siempre(sesion, marca):
    sesion.put(
        f"{BASE_URL}/api/sponsors/{marca['id']}/carrera/{CARRERA_A}",
        json={"status": "pago", "publicar_web": True},
    )
    r = requests.get(f"{BASE_URL}/api/sponsors/race/{CARRERA_A}")
    assert r.status_code == 200
    salida = next(s for s in r.json()["sponsors"] if s["name"] == marca["name"])
    assert set(salida) == {
        "id", "name", "logo_url", "order", "race_code", "is_active", "propuesta_categoria",
    }


def test_no_sale_antes_de_tiempo(sesion, marca):
    """Un prospecto no se publica aunque el interruptor este encendido."""
    sesion.put(
        f"{BASE_URL}/api/sponsors/{marca['id']}/carrera/{CARRERA_A}",
        json={"status": "prospecto", "publicar_web": True},
    )
    r = requests.get(f"{BASE_URL}/api/sponsors/race/{CARRERA_A}")
    assert marca["name"] not in [s["name"] for s in r.json()["sponsors"]]


def test_el_pie_de_la_app_conserva_sus_campos(sesion, marca):
    sesion.put(
        f"{BASE_URL}/api/sponsors/{marca['id']}/carrera/{CARRERA_A}",
        json={"status": "pago", "publicar_app": True, "text": "Una línea", "link_url": "https://ejemplo.do"},
    )
    r = requests.get(f"{BASE_URL}/api/ads/pie?race_code={CARRERA_A}")
    assert r.status_code == 200
    datos = r.json()
    assert datos["origen"] in ("ads", "pausados", "vacio")
    anuncio = next((b for b in datos["banners"] if b["name"] == marca["name"]), None)
    assert anuncio is not None, "el patrocinador pagado y encendido tiene que salir en el pie"
    assert set(anuncio) == {
        "id", "name", "text", "link_url", "logo_url", "banner_url", "detail_url",
        "weight", "order", "mostrar_marca", "description", "instagram",
    }


def test_las_metricas_se_cuentan_en_su_carrera(sesion, marca):
    sesion.put(f"{BASE_URL}/api/sponsors/{marca['id']}/carrera/{CARRERA_B}", json={})
    ficha = leer(sesion, marca["id"])
    parte_a = next(p for p in ficha["participaciones"] if p["race_code"] == CARRERA_A)

    requests.post(f"{BASE_URL}/api/ads/track", json={"banner_id": parte_a["id"], "event": "click"})

    ficha = leer(sesion, marca["id"])
    despues = {p["race_code"]: p.get("clicks", 0) for p in ficha["participaciones"]}
    assert despues[CARRERA_A] == 1
    assert despues[CARRERA_B] == 0


def test_quitar_una_carrera_no_toca_las_demas(sesion, marca):
    sesion.put(f"{BASE_URL}/api/sponsors/{marca['id']}/carrera/{CARRERA_B}", json={"status": "cierre"})
    r = sesion.delete(f"{BASE_URL}/api/sponsors/{marca['id']}/carrera/{CARRERA_A}")
    assert r.status_code == 200

    ficha = leer(sesion, marca["id"])
    assert [p["race_code"] for p in ficha["participaciones"]] == [CARRERA_B]
    assert ficha["telefono"] == "809-555-0000"
