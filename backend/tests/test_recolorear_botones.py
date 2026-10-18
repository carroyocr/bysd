"""Poner al dia el color de los botones de las plantillas ya guardadas."""

from services import correo_estilo as e


def test_el_boton_recien_hecho_ya_lleva_el_color_de_hoy():
    assert f'bgcolor="{e.BOTON}"' in e.boton("Pulsa", "https://ejemplo.test")


def test_un_boton_viejo_se_pone_al_dia():
    viejo = e.boton("Pulsa", "https://ejemplo.test").replace(
        f'bgcolor="{e.BOTON}"', 'bgcolor="#E8772E"'
    )
    nuevo = e.recolorear_botones(viejo)
    assert "#E8772E" not in nuevo
    assert f'bgcolor="{e.BOTON}"' in nuevo


def test_no_cambia_nada_mas_del_correo():
    """El texto, el enlace y el resto del HTML se quedan como estaban."""
    viejo = e.boton("Pedir más tiempo", "{{athlete_plazo_link}}").replace(
        f'bgcolor="{e.BOTON}"', 'bgcolor="#E8772E"'
    )
    nuevo = e.recolorear_botones(viejo)
    assert nuevo == viejo.replace('bgcolor="#E8772E"', f'bgcolor="{e.BOTON}"')


def test_otros_bgcolor_del_correo_no_se_tocan():
    """Solo se busca la celda del boton, no cualquier fondo que ande por ahi."""
    html = '<td bgcolor="#E8772E">otra cosa</td>' + e.boton("Pulsa", "#").replace(
        f'bgcolor="{e.BOTON}"', 'bgcolor="#E8772E"'
    )
    nuevo = e.recolorear_botones(html)
    assert '<td bgcolor="#E8772E">otra cosa</td>' in nuevo
    assert f'bgcolor="{e.BOTON}"' in nuevo


def test_pasarlo_dos_veces_no_cambia_nada():
    una = e.recolorear_botones(e.boton("Pulsa", "#"))
    assert e.recolorear_botones(una) == una


def test_un_correo_sin_botones_se_devuelve_igual():
    html = e.p("Solo texto.")
    assert e.recolorear_botones(html) == html


def test_vacio_no_revienta():
    assert e.recolorear_botones("") == ""
    assert e.recolorear_botones(None) == ""
