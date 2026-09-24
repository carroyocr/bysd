"""Las preguntas que el publico deja escaneando el QR de la charla.

No toca la base de datos: se prueba la limpieza de lo que llega del formulario,
que es donde estan las dos reglas que importan -- lo que se rechaza y lo que
**no** se guarda.
"""
import os
import sys

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault("JWT_SECRET_KEY", "clave-de-prueba-larga-de-sobra-para-pasar-el-minimo")

from routes.capacitaciones import (  # noqa: E402
    MAX_NOMBRE,
    MAX_PREGUNTA,
    limpiar_pregunta,
    url_de_preguntas,
)


def test_la_pregunta_se_guarda_con_el_nombre_si_se_publica():
    assert limpiar_pregunta("¿Cuántas vueltas hay?", "Ana Gómez", True) == {
        "pregunta": "¿Cuántas vueltas hay?",
        "nombre": "Ana Gómez",
    }


def test_sin_publicar_el_nombre_el_nombre_no_se_guarda():
    """No basta con no ensenarlo.

    Guardar un nombre que alguien pidio no publicar es tener un dato que no
    hacia falta pedir, y ahi seguira el dia que alguien mire la coleccion.
    """
    assert limpiar_pregunta("¿Cuántas vueltas hay?", "Ana Gómez", False)["nombre"] == ""


def test_los_espacios_de_mas_se_recogen():
    limpia = limpiar_pregunta("  ¿Cuántas   vueltas\n hay? ", "  Ana   Gómez ", True)
    assert limpia["pregunta"] == "¿Cuántas vueltas hay?"
    assert limpia["nombre"] == "Ana Gómez"


@pytest.mark.parametrize("vacia", ["", "   ", "¿?", None])
def test_una_pregunta_vacia_o_de_dos_letras_se_rechaza(vacia):
    with pytest.raises(HTTPException) as caida:
        limpiar_pregunta(vacia, "Ana", True)
    assert caida.value.status_code == 400


def test_una_pregunta_kilometrica_se_rechaza():
    """El limite es del servidor, no del formulario: el formulario se salta."""
    with pytest.raises(HTTPException) as caida:
        limpiar_pregunta("a" * (MAX_PREGUNTA + 1), "Ana", True)
    assert caida.value.status_code == 400

    # Justo en el limite si pasa
    assert len(limpiar_pregunta("a" * MAX_PREGUNTA, "Ana", True)["pregunta"]) == MAX_PREGUNTA


def test_un_nombre_kilometrico_se_recorta_en_vez_de_rechazar():
    """La pregunta es lo que importa; el nombre largo no es motivo para
    perderla."""
    limpia = limpiar_pregunta("¿Cuántas vueltas hay?", "A" * 500, True)
    assert len(limpia["nombre"]) == MAX_NOMBRE
    assert limpia["pregunta"] == "¿Cuántas vueltas hay?"


def test_sin_nombre_la_pregunta_sale_anonima():
    assert limpiar_pregunta("¿Cuántas vueltas hay?", None, True)["nombre"] == ""
    assert limpiar_pregunta("¿Cuántas vueltas hay?", "   ", True)["nombre"] == ""


def test_la_direccion_del_qr_es_la_del_formulario():
    """Una sola definicion: el QR, el enlace que se copia y la pagina publica
    tienen que llevar a la misma URL."""
    assert url_de_preguntas("64f0c0ffee").endswith("/actividad/64f0c0ffee/preguntas")
    assert url_de_preguntas("x").startswith("http")
