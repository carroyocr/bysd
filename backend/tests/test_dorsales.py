"""El dorsal que se manda a la imprenta.

No toca la base de datos: entran los dorsales ya armados y sale el PDF. Lo que
se comprueba aqui es lo que la imprenta rechazaria: medidas equivocadas, un
color RGB colado o un QR que no lleva a la carrera que toca.
"""
import io
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services import dorsales  # noqa: E402

URL = "https://backyardultrasantodomingo.com/scan/confirmar?bib=007&race=MUNDIAL-2026"

DORSAL = {"numero": "007", "nombre": "CRISTIAN", "qr_url": URL}

DISENO = {
    "evento": "Big's Backyard Ultra World Team Championship 2026",
    "pie": "Campeonato Mundial por Equipos · 17 de octubre de 2026",
}


def _paginas(pdf: bytes) -> int:
    from PyPDF2 import PdfReader

    return len(PdfReader(io.BytesIO(pdf)).pages)


def _medidas(pdf: bytes):
    from PyPDF2 import PdfReader

    caja = PdfReader(io.BytesIO(pdf)).pages[0].mediabox
    return float(caja.width), float(caja.height)


def test_una_pagina_por_dorsal():
    salida = dorsales.construir_pdf([DORSAL, {**DORSAL, "numero": "008"}], DISENO)
    assert _paginas(salida.getvalue()) == 2


def test_la_pagina_mide_el_corte_mas_el_sangrado():
    """Sin marcas, la pagina es exactamente el area sangrada: 8.5 x 5.75."""
    salida = dorsales.construir_pdf([DORSAL], {**DISENO, "marcas_corte": False})
    ancho, alto = _medidas(salida.getvalue())
    assert round(ancho, 1) == 612.0   # 8.5"
    assert round(alto, 1) == 414.0    # 5.75"


def test_con_marcas_la_pagina_deja_sitio_para_ellas():
    salida = dorsales.construir_pdf([DORSAL], {**DISENO, "marcas_corte": True})
    ancho, alto = _medidas(salida.getvalue())
    assert ancho > 612.0 and alto > 414.0


def test_no_se_cuela_ni_un_color_rgb():
    """La guia de la imprenta lo prohibe: el RGB brillante no imprime."""
    imagen = Image.new("RGB", (2550, 1725), (232, 119, 46))
    memoria = io.BytesIO()
    imagen.save(memoria, "PNG")

    salida = dorsales.construir_pdf(
        [DORSAL],
        {**DISENO, "color_nombre": "#E8772E", "color_banda": "#111827"},
        fondo=memoria.getvalue(),
    )
    contenido = salida.getvalue()
    assert b"DeviceRGB" not in contenido
    assert b"DeviceCMYK" in contenido  # la imagen de fondo, ya convertida


def test_el_naranja_de_la_marca_pasa_a_cmyk():
    color = dorsales._cmyk("#E8772E")
    assert round(color.cyan, 2) == 0.0
    assert round(color.magenta, 2) == 0.49
    assert round(color.yellow, 2) == 0.80
    assert round(color.black, 2) == 0.09


def test_un_color_invalido_no_tumba_el_pdf():
    assert dorsales._cmyk("no-es-un-color", "#FFFFFF") == dorsales._cmyk("#FFFFFF")
    assert dorsales._cmyk("") == dorsales._cmyk("#000000")
    assert dorsales._cmyk("#fff") == dorsales._cmyk("#FFFFFF")


def test_el_qr_va_en_vectores_y_no_en_mapa_de_bits():
    """Un dorsal sin fondo no lleva ni una imagen dentro: el QR son rectangulos."""
    salida = dorsales.construir_pdf([DORSAL], DISENO)
    contenido = salida.getvalue()
    assert b"/Subtype /Image" not in contenido
    assert b"/XObject" not in contenido


def test_sin_qr_no_se_dibuja_nada_de_el():
    con = len(dorsales.construir_pdf([DORSAL], DISENO).getvalue())
    sin = len(dorsales.construir_pdf([{**DORSAL, "qr_url": ""}], DISENO).getvalue())
    assert sin < con


def test_el_dpi_avisa_de_una_imagen_pobre():
    pobre = io.BytesIO()
    Image.new("RGB", (850, 575)).save(pobre, "PNG")
    assert dorsales.dpi_del_fondo(pobre.getvalue()) == 100

    buena = io.BytesIO()
    Image.new("RGB", (2550, 1725)).save(buena, "PNG")
    assert dorsales.dpi_del_fondo(buena.getvalue()) == 300


def test_un_fondo_ilegible_no_tumba_el_pdf():
    """Se pierde el arte, no la tanda de dorsales."""
    salida = dorsales.construir_pdf([DORSAL], DISENO, fondo=b"esto no es una imagen")
    assert _paginas(salida.getvalue()) == 1


def test_una_tipografia_ilegible_cae_en_la_de_siempre():
    assert dorsales.registrar_fuente(b"esto no es una fuente") == dorsales.FUENTE_BASE
    assert dorsales.registrar_fuente(None) == dorsales.FUENTE_BASE


def test_dos_tipografias_distintas_no_se_pisan():
    """El registro de reportlab es global: cada archivo necesita su nombre."""
    import reportlab

    fuentes = os.path.join(os.path.dirname(reportlab.__file__), "fonts")
    with open(os.path.join(fuentes, "VeraBd.ttf"), "rb") as f:
        negrita = f.read()
    with open(os.path.join(fuentes, "Vera.ttf"), "rb") as f:
        normal = f.read()

    assert dorsales.registrar_fuente(negrita) != dorsales.registrar_fuente(normal)
    # Y volver a pedir la misma da el mismo nombre, sin registrarla dos veces
    assert dorsales.registrar_fuente(negrita) == dorsales.registrar_fuente(negrita)


def test_un_nombre_larguisimo_no_se_sale_del_dorsal():
    """Se recorta con puntos suspensivos; lo que no hace es invadir el QR."""
    salida = dorsales.construir_pdf(
        [{**DORSAL, "nombre": "MARÍA DE LOS ÁNGELES BUENAVENTURA DEL SOCORRO"}], DISENO
    )
    assert _paginas(salida.getvalue()) == 1


def test_sin_corredores_sale_un_pdf_valido():
    """Una hoja en blanco antes que un archivo roto."""
    assert _paginas(dorsales.construir_pdf([], DISENO).getvalue()) == 1


# ---------------- El QR, modulo a modulo ----------------
#
# Un QR volteado sigue pareciendo un QR: los tres ojos de las esquinas estan
# ahi y a simple vista pasa. Lo que no hace es escanear. Como se dibuja a mano
# (rectangulos, no una imagen), la unica forma de saber que la matriz no salio
# del reves es reconstruirla desde el propio PDF y compararla con la buena.


def _rectangulos(pdf: bytes):
    """Los `x y ancho alto re` del flujo de la primera pagina, en orden."""
    import re as expreg

    from PyPDF2 import PdfReader

    flujo = PdfReader(io.BytesIO(pdf)).pages[0].get_contents().get_data().decode("latin-1")
    patron = r"(-?\d+\.?\d*) (-?\d+\.?\d*) (-?\d+\.?\d*) (-?\d+\.?\d*) re"
    return [tuple(float(v) for v in m.groups()) for m in expreg.finditer(patron, flujo)]


def _matriz_dibujada(pdf: bytes):
    rectangulos = _rectangulos(pdf)
    # El unico rectangulo grande y cuadrado es el fondo blanco del QR; lo que
    # viene detras son sus modulos.
    cuadrados = [r for r in rectangulos if r[2] > 100 and abs(r[2] - r[3]) < 0.01]
    assert len(cuadrados) == 1, "no se encontro el cuadro del QR"
    x0, y0, lado, _ = cuadrados[0]
    modulos = rectangulos[rectangulos.index(cuadrados[0]) + 1:]

    total = len(dorsales._modulos(URL)) + 2 * dorsales.MODULOS_SILENCIO
    paso = lado / total
    dibujada = [[False] * (total - 2 * dorsales.MODULOS_SILENCIO)
                for _ in range(total - 2 * dorsales.MODULOS_SILENCIO)]
    for x, y, ancho, _alto in modulos:
        fila = total - dorsales.MODULOS_SILENCIO - 1 - round((y - y0) / paso)
        columna = round((x - x0) / paso) - dorsales.MODULOS_SILENCIO
        for i in range(round(ancho / paso)):
            dibujada[fila][columna + i] = True
    return dibujada


def test_el_qr_dibujado_es_el_mismo_que_el_de_la_libreria():
    """Ni volteado ni girado: modulo por modulo, el que codifica la URL."""
    salida = dorsales.construir_pdf(
        [{"numero": "", "nombre": "", "qr_url": URL}],
        {"evento": "", "pie": "", "marcas_corte": False},
    )
    assert _matriz_dibujada(salida.getvalue()) == dorsales._modulos(URL)


def test_el_qr_lleva_el_silencio_que_exige_el_formato():
    """Sin el margen en blanco alrededor, muchos lectores ni lo ven."""
    salida = dorsales.construir_pdf(
        [{"numero": "", "nombre": "", "qr_url": URL}],
        {"evento": "", "pie": "", "marcas_corte": False},
    )
    cuadro = [r for r in _rectangulos(salida.getvalue()) if r[2] > 100 and abs(r[2] - r[3]) < 0.01][0]
    modulos = dorsales._modulos(URL)
    paso = cuadro[2] / (len(modulos) + 2 * dorsales.MODULOS_SILENCIO)
    assert dorsales.MODULOS_SILENCIO >= 4
    # El primer modulo negro no puede empezar pegado al borde del cuadro
    primeros = [r for r in _rectangulos(salida.getvalue()) if abs(r[3] - paso) < 0.01]
    assert min(r[0] for r in primeros) - cuadro[0] >= 4 * paso - 0.01
