"""Que eventos aceptan postulaciones nuevas de voluntarios.

No toca la base de datos: entra la ficha de la carrera y sale la lista de
eventos abiertos. Se prueba aqui porque de esta funcion cuelgan tres sitios
-- la pagina publica, el registro y la cuenta de staff -- y un descuido cierra
el reclutamiento sin que nadie se entere, o lo deja abierto cuando ya no debe.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault("JWT_SECRET_KEY", "clave-de-prueba-larga-de-sobra-para-pasar-el-minimo")

from routes.volunteer_registration import eventos_abiertos  # noqa: E402


def test_por_defecto_solo_el_campeonato():
    """Es como estuvo desde que existe: el campeonato abierto, la carrera no."""
    assert eventos_abiertos({}) == ["campeonato"]


def test_una_carrera_antigua_sin_los_campos_no_se_cierra_sola():
    """El interruptor del campeonato se agrego despues; los documentos que ya
    estaban no lo traen, y eso no puede dejar a nadie fuera."""
    assert eventos_abiertos({"name": "Backyard Ultra"}) == ["campeonato"]
    assert eventos_abiertos(None) == ["campeonato"]


def test_se_puede_apagar_el_campeonato():
    """Lo que pedia el encargo: cerrarlo cuando el equipo este completo."""
    assert eventos_abiertos({"show_volunteer_campeonato": False}) == []


def test_se_pueden_tener_los_dos_abiertos():
    abiertos = eventos_abiertos(
        {"show_volunteer_carrera": True, "show_volunteer_campeonato": True}
    )
    assert abiertos == ["carrera", "campeonato"]


def test_solo_la_carrera():
    abiertos = eventos_abiertos(
        {"show_volunteer_carrera": True, "show_volunteer_campeonato": False}
    )
    assert abiertos == ["carrera"]


def test_los_dos_apagados_es_una_respuesta_valida():
    """Lista vacia, no error: significa que ya no se reciben voluntarios."""
    assert eventos_abiertos(
        {"show_volunteer_carrera": False, "show_volunteer_campeonato": False}
    ) == []


def test_solo_el_true_exacto_abre_la_carrera():
    """La carrera nace cerrada: cualquier cosa que no sea True la deja cerrada."""
    for valor in (None, "", 0, "true", "si"):
        assert eventos_abiertos({"show_volunteer_carrera": valor}) == ["campeonato"]


def test_solo_el_false_exacto_cierra_el_campeonato():
    """Al reves que la carrera: nace abierto y solo un False lo cierra, para
    que un campo a medio migrar no deje fuera a nadie."""
    for valor in (None, "", "false", 1):
        assert "campeonato" in eventos_abiertos({"show_volunteer_campeonato": valor})
