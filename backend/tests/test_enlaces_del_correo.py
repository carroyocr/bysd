"""Los enlaces personales que van dentro de un correo masivo.

El compositor arma sus propias variables de combinacion, aparte de las que usan
los correos automaticos, y ahi faltaban los dos enlaces del recordatorio de
pago: la plantilla los pedia y el envio no los traia, asi que los botones
salian con `href=""` -- visibles, pulsables y sin llevar a ninguna parte.

No toca la base de datos: entra el destinatario y sale lo que se sustituye.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault("JWT_SECRET_KEY", "clave-de-prueba-larga-de-sobra-para-pasar-el-minimo")

from routes.athletes import _enlaces_del_destinatario, _template_recipient_data  # noqa: E402
from services.template_email_service import BASE_URL, build_athlete_data, render_template  # noqa: E402

TOKEN = "un-token-cualquiera"


def test_los_tres_enlaces_salen_del_token():
    enlaces = _enlaces_del_destinatario(TOKEN)
    assert enlaces["athlete_plazo_link"] == f"{BASE_URL}/plazo-de-pago?token={TOKEN}"
    assert enlaces["athlete_cancel_link"] == f"{BASE_URL}/cancelar-registro?token={TOKEN}"
    assert enlaces["athlete_edit_link"] == f"{BASE_URL}/inscripcion/editar/{TOKEN}"


def test_sin_token_los_enlaces_van_vacios_y_no_a_medias():
    """Prefiero vacio a una direccion sin token, que llevaria a un error."""
    for nada in ("", None):
        enlaces = _enlaces_del_destinatario(nada)
        assert set(enlaces.values()) == {""}


def test_el_compositor_y_los_correos_automaticos_dan_la_misma_direccion():
    """Son dos caminos distintos hacia el mismo correo. Si se separan, un dia
    uno lleva a una pagina que el otro ya no."""
    del_compositor = _template_recipient_data({}, {"email": "a@b.c", "edit_token": TOKEN})
    del_automatico = build_athlete_data({"nombre": "Ana", "edit_token": TOKEN})

    for campo in ("athlete_plazo_link", "athlete_cancel_link"):
        assert del_compositor[campo] == del_automatico[campo]


def test_el_destinatario_sin_inscripcion_no_rompe_el_envio():
    """Un correo suelto escrito a mano no tiene inscripcion: se queda sin
    enlaces, pero el correo sale."""
    datos = _template_recipient_data({}, {"email": "suelto@ejemplo.com"})
    assert datos["athlete_plazo_link"] == ""
    assert datos["athlete_email"] == "suelto@ejemplo.com"


def test_la_plantilla_deja_de_tener_botones_muertos():
    """Lo que se veia: `href=""` en los dos botones del recordatorio."""
    plantilla = '<a href="{{athlete_plazo_link}}">Pedir</a><a href="{{athlete_cancel_link}}">Cancelar</a>'

    vacio = render_template(plantilla, _template_recipient_data({}, {"email": "a@b.c"}))
    assert vacio.count('href=""') == 2

    lleno = render_template(
        plantilla, _template_recipient_data({}, {"email": "a@b.c", "edit_token": TOKEN})
    )
    assert 'href=""' not in lleno
    assert lleno.count(TOKEN) == 2


def test_el_dorsal_tambien_viaja():
    datos = _template_recipient_data({}, {"email": "a@b.c", "bib": "007"})
    assert datos["athlete_bib"] == "007"


def test_los_botones_del_correo_van_en_azul_con_la_letra_en_blanco():
    """Pasaron del naranja de la marca a negro, y de negro a azul y mas bajos."""
    from services import correo_estilo as e

    html = e.boton("Pulsa aquí", "https://ejemplo.com")
    assert 'bgcolor="#0071e3"' in html
    assert "color: #ffffff" in html
    assert "padding: 9px 22px" in html and "font-weight: 400" in html
    assert "E8772E" not in html and "#000000" not in html
