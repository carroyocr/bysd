"""El diseno de los correos: gris el texto, negro sin negrita los titulos,
azules y bajos los botones, azules los enlaces.

Lo que mas importa aqui no es el diseno en si, sino que **llegue a los correos
que ya existian**. Las plantillas se guardan en la base con su HTML ya montado:
cambiar `services/correo_estilo.py` no cambia ni una de las ya sembradas, y no
falla nada ni avisa nadie. `al_dia()` es lo que traduce ese HTML, y se aplica
al rendir cada plantilla.

`fixtures/plantillas_estilo_2026_09.json` es una copia de como salian las
plantillas el dia antes del cambio —lo que hay guardado en produccion—.

    backend/.venv/bin/python -m pytest tests/test_correo_diseno.py -v
"""
import json
import os
from pathlib import Path

os.environ.setdefault("JWT_SECRET_KEY", "clave-solo-para-tests-" + "x" * 40)
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "bysd_test_rutas")
os.environ.setdefault("EMAILS_ACTIVOS", "false")

from services import correo_estilo as e  # noqa: E402
from services.template_email_service import render_template  # noqa: E402

DE_ANTES = json.loads(
    (Path(__file__).parent / "fixtures" / "plantillas_estilo_2026_09.json").read_text()
)
NEGRO, GRIS, AZUL_BOTON, AZUL_ENLACE = "#1d1d1f", "#424245", "#0071e3", "#0066cc"


# ==================== El diseno ====================


def test_el_texto_va_en_gris():
    assert f"color: {GRIS};" in e.p("Hola")
    assert f"color: {GRIS};" in e.lista(["uno"])
    assert f"color: {GRIS};" in e.fragmento("x")


def test_titulos_y_subtitulos_en_negro_y_sin_negrita():
    for pieza in (e.h1("Titulo"), e.h2("Subtitulo")):
        assert f"color: {NEGRO};" in pieza
        assert "font-weight: 400;" in pieza and "font-weight: 700" not in pieza


def test_los_datos_se_destacan_por_el_color_no_por_el_peso():
    for pieza in (e.linea("Fecha", "17 de octubre"), e.dato("Monto", "RD$ 4,000"),
                  e.cifra("Tu BIB", "#007"), e.codigo("123456")):
        assert f"color: {NEGRO};" in pieza
        assert "font-weight: 600" not in pieza and "font-weight: 700" not in pieza


def test_el_boton_es_azul_bajo_y_con_la_letra_en_blanco():
    html = e.boton("Pagar", "https://ejemplo.com")
    assert f'bgcolor="{AZUL_BOTON}"' in html
    assert "color: #ffffff;" in html
    assert "padding: 9px 22px;" in html and "font-size: 15px;" in html
    assert "font-weight: 400;" in html


def test_los_enlaces_van_en_azul():
    assert f"color: {AZUL_ENLACE};" in e.enlace("ver", "https://ejemplo.com")
    assert f"color: {AZUL_ENLACE};" in e.fragmento("x")   # el del pie


# ==================== Que llegue a lo ya guardado ====================


def test_cada_plantilla_guardada_con_el_diseno_anterior_queda_como_la_de_hoy():
    """Convertida, tiene que ser letra por letra la que hoy se sembraria."""
    import server  # noqa: F401
    from routes.email_templates import DEFAULT_TEMPLATES

    de_hoy = {t["id"]: t["content"] for t in DEFAULT_TEMPLATES}
    assert len(DE_ANTES) >= 30
    for id_, vieja in DE_ANTES.items():
        if id_ not in de_hoy:
            continue        # una plantilla retirada no tiene con que compararse
        assert e.al_dia(vieja) == de_hoy[id_], f"La plantilla {id_} no queda igual que la de hoy"


def test_de_lo_anterior_no_queda_ni_el_boton_negro_ni_la_negrita_de_los_titulos():
    for id_, vieja in DE_ANTES.items():
        nueva = e.al_dia(vieja)
        assert 'bgcolor="#000000"' not in nueva, id_
        assert "padding: 14px 28px" not in nueva, id_
        assert "font-weight: 700; letter-spacing: -0.02em" not in nueva, id_   # h1
        assert "text-decoration: underline" not in nueva, id_


def test_pasarlo_dos_veces_no_cambia_nada():
    for vieja in DE_ANTES.values():
        una = e.al_dia(vieja)
        assert e.al_dia(una) == una


def test_no_toca_el_texto_ni_el_html_que_no_salio_de_aqui():
    propio = '<p style="color: #1d1d1f; font-weight: 700;">Escrito a mano en el panel</p>'
    vieja = DE_ANTES["recordatorio_pago"].replace("Falta tu pago", "Falta tu pago, Ana") + propio
    nueva = e.al_dia(vieja)
    assert "Falta tu pago, Ana" in nueva
    assert propio in nueva


def test_un_boton_de_cualquier_color_antiguo_tambien_se_pone_al_dia():
    """En la base puede quedar alguno del naranja de antes del negro."""
    vieja = DE_ANTES["recordatorio_pago"].replace('bgcolor="#000000"', 'bgcolor="#E8772E"')
    nueva = e.al_dia(vieja)
    assert "#E8772E" not in nueva and f'bgcolor="{AZUL_BOTON}"' in nueva


def test_al_rendir_una_plantilla_guardada_sale_con_el_diseno_de_hoy():
    """Es lo que hace que el cambio llegue sin tocar la base."""
    html = render_template(DE_ANTES["recordatorio_pago"], {
        "athlete_nombre_completo": "Ana Pérez", "race_name": "BYSD 2027",
        "athlete_plazo_link": "https://ejemplo.com/plazo", "athlete_cancel_link": "https://ejemplo.com/cancelar",
    })
    assert f'bgcolor="{AZUL_BOTON}"' in html and 'bgcolor="#000000"' not in html
    assert f"color: {GRIS};" in html
    assert "Ana Pérez" in html


def test_el_asunto_no_pasa_por_el_diseno():
    assert render_template("Tu cupo en {{race_name}}", {"race_name": "A & B"}, escape=False) == "Tu cupo en A & B"


def test_vacio_no_revienta():
    assert e.al_dia("") == ""
    assert e.al_dia(None) == ""
