"""El dorsal que se manda a la imprenta.

No toca la base de datos: entran los dorsales ya armados y sale el PDF. Lo que
se comprueba aqui es lo que la imprenta rechazaria: medidas equivocadas, un
color RGB colado o un QR que no lleva a la carrera que toca.
"""
import io
import os
import sys

from PIL import Image, ImageDraw

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
        archivos={"fondo": memoria.getvalue()},
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
    salida = dorsales.construir_pdf([DORSAL], DISENO, archivos={"fondo": b"esto no es una imagen"})
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


# ---------------- Los ojales ----------------
#
# Por los cuatro agujeros entran los imperdibles. Lo que caiga debajo de uno
# se pierde, y no hay forma de verlo hasta que el dorsal esta impreso y
# perforado: de ahi que la regla sea del generador y no del ojo de quien
# revisa la previa.


def _textos(pdf: bytes):
    """Cada texto de la primera pagina como su caja (x0, y0, x1, y1)."""
    import re as expreg

    from PyPDF2 import PdfReader
    from reportlab.pdfbase import pdfmetrics

    flujo = PdfReader(io.BytesIO(pdf)).pages[0].get_contents().get_data().decode("latin-1")
    cuerpo = None
    salida = []
    # Reportlab unas veces deja el cuerpo en un bloque suelto y otras dentro
    # del mismo bloque que el texto (cuando lleva espaciado propio). Se mira
    # bloque a bloque y se guarda el ultimo cuerpo visto.
    for bloque in expreg.finditer(r"BT(.*?)ET", flujo, expreg.S):
        dentro = bloque.group(1)
        cuerpos = expreg.findall(r"/F\d+ (\d+\.?\d*) Tf", dentro)
        if cuerpos:
            cuerpo = float(cuerpos[-1])
        sitio = expreg.search(r"1 0 0 1 (-?\d+\.?\d*) (-?\d+\.?\d*) Tm", dentro)
        escrito = expreg.search(r"\(([^)]*)\) Tj", dentro)
        if not (sitio and escrito and cuerpo):
            continue
        texto = escrito.group(1)
        espaciado = expreg.search(r"(-?\d+\.?\d*) Tc", dentro)
        ancho = pdfmetrics.stringWidth(texto, dorsales.FUENTE_BASE, cuerpo)
        if espaciado:
            ancho += (len(texto) - 1) * float(espaciado.group(1))
        x, y = float(sitio.group(1)), float(sitio.group(2))
        salida.append((x, y, x + ancho, y + cuerpo * dorsales._alto_mayusculas(dorsales.FUENTE_BASE)))
    assert salida, "no se encontro ni un texto en el PDF"
    return salida


def _ojales(pdf: bytes):
    """Las cuatro cajas que ocupan los ojales, en coordenadas de la pagina."""
    from PyPDF2 import PdfReader

    caja = PdfReader(io.BytesIO(pdf)).pages[0].mediabox
    ox = (float(caja.width) - dorsales.ANCHO_CORTE) / 2
    oy = (float(caja.height) - dorsales.ALTO_CORTE) / 2
    radio = dorsales.OJAL_RADIO
    return [
        (x - radio, y - radio, x + radio, y + radio)
        for x in (ox + dorsales.OJAL_MARGEN, ox + dorsales.ANCHO_CORTE - dorsales.OJAL_MARGEN)
        for y in (oy + dorsales.OJAL_MARGEN, oy + dorsales.ALTO_CORTE - dorsales.OJAL_MARGEN)
    ]


def _ningun_texto_sobre_un_ojal(pdf: bytes):
    agujeros = _ojales(pdf)
    for x0, y0, x1, y1 in _textos(pdf):
        for ax0, ay0, ax1, ay1 in agujeros:
            assert not (x0 < ax1 and x1 > ax0 and y0 < ay1 and y1 > ay0), (
                f"un texto ({x0:.1f},{y0:.1f})-({x1:.1f},{y1:.1f}) cae sobre "
                f"el ojal ({ax0:.1f},{ay0:.1f})-({ax1:.1f},{ay1:.1f})"
            )


def test_el_nombre_del_evento_no_cae_sobre_un_ojal():
    salida = dorsales.construir_pdf([DORSAL], DISENO)
    _ningun_texto_sobre_un_ojal(salida.getvalue())


def test_sin_bandas_tampoco_sube_el_numero_hasta_el_ojal():
    """Sin banda superior el numero crece; el tope sigue siendo el ojal."""
    salida = dorsales.construir_pdf([DORSAL], {**DISENO, "mostrar_bandas": False})
    _ningun_texto_sobre_un_ojal(salida.getvalue())


def test_un_dorsal_pelado_no_se_acerca_a_los_ojales():
    """Sin evento ni pie no hay bandas que sujeten nada: es el caso feo."""
    salida = dorsales.construir_pdf(
        [{"numero": "8", "nombre": "", "qr_url": ""}],
        {"evento": "", "pie": "", "mostrar_qr": False},
    )
    _ningun_texto_sobre_un_ojal(salida.getvalue())


def _solo_el_evento(evento):
    """Un dorsal con el nombre de la carrera y nada mas, para medirlo a solas."""
    return dorsales.construir_pdf(
        [{"numero": "", "nombre": "", "qr_url": ""}],
        {"evento": evento, "pie": "", "mostrar_qr": False, "marcas_corte": False},
    ).getvalue()


def test_el_nombre_de_la_carrera_se_parte_en_dos_lineas():
    """Como en el dorsal de 2026: "Backyard Ultra" encima de "Santo Domingo"."""
    lineas = _textos(_solo_el_evento("Backyard Ultra Santo Domingo"))
    assert len(lineas) == 2
    assert round(lineas[0][0], 1) == round(lineas[1][0], 1), "no comparten margen izquierdo"
    assert lineas[0][1] != lineas[1][1], "estan a la misma altura"


def test_el_nombre_de_la_carrera_llena_el_ancho_que_le_queda():
    """El hueco entre el logo y el borde se ocupa: un titulo chico se ve pobre."""
    lineas = _textos(_solo_el_evento("Backyard Ultra Santo Domingo"))
    disponible = dorsales.ANCHO_CORTE - 2 * dorsales.LEJOS_DE_LOS_OJALES
    ocupa = max(caja[2] for caja in lineas) - min(caja[0] for caja in lineas)
    # No llega al 100%: dos lineas de titulo en una banda de pulgada y media
    # topan antes con el alto de la banda que con el ancho del dorsal.
    assert ocupa > 0.78 * disponible, f"el titulo ocupa {ocupa:.0f} de {disponible:.0f}"


def test_el_numero_no_se_come_la_franja_entera():
    """Llenarla de alto lo deja desproporcionado; en 2026 ocupa poco mas de la mitad."""
    salida = dorsales.construir_pdf([DORSAL], DISENO)
    numero = max(_textos(salida.getvalue()), key=lambda c: c[3] - c[1])
    alto_numero = numero[3] - numero[1]
    franja = dorsales.ALTO_CORTE - dorsales.ALTO_BANDA_SUPERIOR - dorsales.ALTO_BANDA_INFERIOR
    assert 0.4 * franja < alto_numero < 0.8 * franja


def test_el_nombre_del_corredor_se_lee():
    """Era ridiculamente pequeno al lado del numero: ahora es una quinta parte."""
    salida = dorsales.construir_pdf([DORSAL], {**DISENO, "pie": ""})
    cajas = sorted(_textos(salida.getvalue()), key=lambda c: c[3] - c[1])
    nombre = cajas[0][3] - cajas[0][1]      # el texto mas pequeno del dorsal
    numero = cajas[-1][3] - cajas[-1][1]
    assert nombre / numero > 0.18


def test_una_barra_manda_donde_se_parte_el_nombre():
    salida = dorsales.construir_pdf(
        [DORSAL], {**DISENO, "evento": "Backyard Ultra|Santo Domingo", "mostrar_qr": False}
    )
    assert _paginas(salida.getvalue()) == 1


# ---------------- Los logos ----------------


def _imagenes(pdf: bytes):
    """Cada imagen dibujada como su caja (x0, y0, x1, y1)."""
    import re as expreg

    from PyPDF2 import PdfReader

    flujo = PdfReader(io.BytesIO(pdf)).pages[0].get_contents().get_data().decode("latin-1")
    patron = r"(\d+\.?\d*) 0 0 (\d+\.?\d*) (-?\d+\.?\d*) (-?\d+\.?\d*) cm\s*/\S+ Do"
    cajas = []
    for trozo in expreg.finditer(patron, flujo):
        ancho, alto, x, y = (float(v) for v in trozo.groups())
        cajas.append((x, y, x + ancho, y + alto))
    return cajas


def _logo_cuadrado():
    """Un circulo naranja, con aire transparente alrededor."""
    memoria = io.BytesIO()
    imagen = Image.new("RGBA", (400, 400), (0, 0, 0, 0))
    ImageDraw.Draw(imagen).ellipse([50, 50, 350, 350], fill=(232, 119, 46, 255))
    imagen.save(memoria, "PNG")
    return memoria.getvalue()


def _logo_apaisado():
    memoria = io.BytesIO()
    Image.new("RGB", (1600, 320), (30, 64, 140)).save(memoria, "PNG")
    return memoria.getvalue()


ARCHIVOS = {"logo": _logo_cuadrado(), "patrocinador": _logo_apaisado()}


def test_el_dorsal_lleva_los_dos_logos():
    salida = dorsales.construir_pdf([DORSAL], DISENO, archivos=ARCHIVOS)
    assert len(_imagenes(salida.getvalue())) == 2


def test_los_logos_no_caen_sobre_un_ojal():
    """Por esos cuatro agujeros entran los imperdibles."""
    salida = dorsales.construir_pdf([DORSAL], DISENO, archivos=ARCHIVOS)
    contenido = salida.getvalue()
    for x0, y0, x1, y1 in _imagenes(contenido):
        for ax0, ay0, ax1, ay1 in _ojales(contenido):
            assert not (x0 < ax1 and x1 > ax0 and y0 < ay1 and y1 > ay0), (
                f"un logo ({x0:.1f},{y0:.1f})-({x1:.1f},{y1:.1f}) cae sobre un ojal"
            )


def test_el_logo_del_patrocinador_va_centrado_abajo():
    salida = dorsales.construir_pdf([DORSAL], DISENO, archivos=ARCHIVOS)
    contenido = salida.getvalue()
    from PyPDF2 import PdfReader

    caja = PdfReader(io.BytesIO(contenido)).pages[0].mediabox
    centro = float(caja.width) / 2
    abajo = min(_imagenes(contenido), key=lambda c: c[1])
    assert abs((abajo[0] + abajo[2]) / 2 - centro) < 1


def test_el_recuadro_del_logo_es_exactamente_el_color_de_la_banda():
    """Si no casa, se ve un rectangulo mas claro alrededor del logo a un metro.

    Pillow no convierte a CMYK como lo hace el resto del dorsal: por eso el
    logo se funde contra la banda ya en CMYK, y no en RGB.
    """
    banda = dorsales._tinta(dorsales._cmyk("#A3BECD"))
    plano = dorsales._aplanar(_logo_cuadrado(), banda)
    assert plano.mode == "CMYK"
    assert plano.getpixel((0, 0)) == banda


def test_los_logos_siguen_sin_meter_un_solo_pixel_rgb():
    """Un PNG con transparencia entra en DeviceRGB si no se aplana antes."""
    salida = dorsales.construir_pdf([DORSAL], DISENO, archivos=ARCHIVOS)
    contenido = salida.getvalue()
    assert b"DeviceRGB" not in contenido
    assert b"/SMask" not in contenido


def test_el_aviso_de_resolucion_mide_el_hueco_de_cada_logo():
    """Un logo chico en una banda grande sale roto, y eso no se ve en pantalla."""
    pobre = io.BytesIO()
    Image.new("RGB", (80, 80)).save(pobre, "PNG")
    assert dorsales.dpi_al_imprimir(pobre.getvalue(), 0.87, 0.87) == 91
    assert dorsales.dpi_al_imprimir(_logo_cuadrado(), 0.87, 0.87) == 459


def test_el_logo_se_recorta_por_su_tinta():
    """Con aire a un lado, el logo se centraria por el lienzo y saldria torcido."""
    memoria = io.BytesIO()
    imagen = Image.new("RGBA", (400, 200), (0, 0, 0, 0))
    ImageDraw.Draw(imagen).rectangle([0, 0, 99, 199], fill=(0, 0, 0, 255))
    imagen.save(memoria, "PNG")

    plano = dorsales._aplanar(memoria.getvalue(), dorsales.BLANCO_PAPEL)
    assert plano.size == (100, 200)
