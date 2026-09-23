"""Los dorsales, en PDF y con calidad de imprenta.

Las medidas son las de la plantilla de la imprenta (Boulder Bibs): corte de
8 x 5.25 pulgadas, esquinas redondeadas de 0.375", sangrado de 0.25" por los
cuatro lados y cuatro ojales a 0.6" de cada esquina. Un dorsal por pagina.

De su guia salen tres reglas que aqui no se negocian:

- **Todo en CMYK.** El RGB brillante no imprime. No hay un solo color de este
  archivo que no pase por `_cmyk()`, ni una imagen que no se convierta antes
  de incrustarse.
- **El arte llega hasta el sangrado.** El fondo -- color o imagen -- cubre la
  pagina entera, no solo el area de corte: si la guillotina se desvia un
  milimetro no aparece un filo blanco.
- **Nada importante fuera de la linea de corte**, y anadido nuestro: nada
  importante encima de los ojales, que es por donde entran los imperdibles.

El QR va en vectores, no en mapa de bits: se lee igual a cualquier tamano,
imprime negro puro (0/0/0/100) y no depende de con que resolucion lo
rasterice la imprenta. Un QR raster a 150 dpi sobre un dorsal de 8 pulgadas
es exactamente el que a las tres de la manana no escanea.

Aqui no se habla con la base de datos: entran los dorsales ya armados y sale
el PDF, para poder probarlo sin levantar nada.
"""
import hashlib
import io
import logging
from typing import Optional

import qrcode
from PIL import Image
from reportlab.lib.colors import CMYKColor
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

logger = logging.getLogger(__name__)

PULGADA = 72.0

# ============ Medidas de la plantilla de la imprenta ============

ANCHO_CORTE = 8.0 * PULGADA          # 576 pt
ALTO_CORTE = 5.25 * PULGADA          # 378 pt
SANGRADO = 0.25 * PULGADA            # 18 pt por lado
RADIO_ESQUINA = 0.375 * PULGADA      # 27 pt
OJAL_RADIO = 0.1 * PULGADA           # 7.2 pt
OJAL_MARGEN = 0.6 * PULGADA          # del borde de corte al centro del ojal

# Espacio extra alrededor del sangrado cuando se piden marcas de corte
MARGEN_MARCAS = 0.3 * PULGADA
LARGO_MARCA = 0.22 * PULGADA
SEPARACION_MARCA = 0.06 * PULGADA

# Margen de seguridad hacia dentro del corte: por aqui no pasa nada que
# duela perder si el corte se desvia.
MARGEN_SEGURO = 0.35 * PULGADA

# El QR vive en una columna propia a un lado, para no pelearse nunca con el
# numero. Se separa 0.85" del borde de corte: mas que los 0.6" del ojal, asi
# que el imperdible no le come ni un modulo.
MARGEN_QR = 0.85 * PULGADA
HUECO_QR = 0.25 * PULGADA            # entre la columna del QR y el numero

# ============ Valores por defecto del diseno ============

COLOR_FONDO = "#FFFFFF"
COLOR_BANDA = "#111827"
COLOR_TEXTO_BANDA = "#FFFFFF"
COLOR_NUMERO = "#111827"
COLOR_NOMBRE = "#E8772E"

ALTO_BANDA_SUPERIOR = 0.62 * PULGADA
ALTO_BANDA_INFERIOR = 0.34 * PULGADA
LADO_QR = 40.0 / 25.4 * PULGADA      # 40 mm

# Un QR de version 8 (el de nuestra URL con correccion alta) son 49 modulos.
# El silencio de alrededor es obligatorio: sin el, muchos lectores no lo ven.
MODULOS_SILENCIO = 4

FUENTE_BASE = "Helvetica-Bold"
FUENTE_INCRUSTADA = "BYSD-Dorsal"


# ============ Color ============


def _cmyk(color, por_defecto="#000000") -> CMYKColor:
    """Un color del panel (#RRGGBB) pasado a CMYK.

    La conversion es la aritmetica de siempre, sin perfil ICC: la imprenta
    ajusta con el suyo. Lo que importa es que en el archivo no viaje ni un
    DeviceRGB, que es lo que su guia prohibe.
    """
    texto = (color or "").strip() or por_defecto
    if not texto.startswith("#"):
        texto = "#" + texto
    if len(texto) == 4:  # #abc -> #aabbcc
        texto = "#" + "".join(c * 2 for c in texto[1:])
    try:
        r = int(texto[1:3], 16) / 255.0
        g = int(texto[3:5], 16) / 255.0
        b = int(texto[5:7], 16) / 255.0
    except (ValueError, IndexError):
        return _cmyk(por_defecto, "#000000")

    k = 1 - max(r, g, b)
    if k >= 1:
        return CMYKColor(0, 0, 0, 1)
    return CMYKColor((1 - r - k) / (1 - k), (1 - g - k) / (1 - k), (1 - b - k) / (1 - k), k)


NEGRO = CMYKColor(0, 0, 0, 1)
MAGENTA = CMYKColor(0, 1, 0, 0)   # el mismo rosa con el que la imprenta marca el corte


# ============ Tipografia ============


def registrar_fuente(datos: Optional[bytes]) -> str:
    """Incrusta la tipografia que se haya subido y devuelve su nombre.

    La imprenta pide que las fuentes especiales viajen con el arte; incrustada
    en el propio PDF ya no hay nada que mandar aparte. Si no hay ninguna o no
    se deja leer, se sigue con Helvetica en negrita, que es de las catorce
    estandar del formato y cualquier prensa resuelve.

    El nombre lleva el hash del archivo porque el registro de reportlab es
    global al proceso: con un nombre fijo, dos carreras con tipografias
    distintas se pisarian la una a la otra y el dorsal saldria con la letra
    de la otra carrera.
    """
    if not datos:
        return FUENTE_BASE

    nombre = f"{FUENTE_INCRUSTADA}-{hashlib.sha1(datos).hexdigest()[:12]}"
    if nombre in pdfmetrics.getRegisteredFontNames():
        return nombre
    try:
        pdfmetrics.registerFont(TTFont(nombre, io.BytesIO(datos)))
        return nombre
    except Exception:
        logger.warning("La tipografia subida para los dorsales no se pudo leer", exc_info=True)
        return FUENTE_BASE


def _alto_mayusculas(fuente: str) -> float:
    """Alto de una mayuscula, por unidad de cuerpo. Para centrar de verdad."""
    try:
        cara = pdfmetrics.getFont(fuente).face
        alto = (getattr(cara, "capHeight", 0) or getattr(cara, "ascent", 0)) / 1000.0
        if alto > 0:
            return alto
    except Exception:
        pass
    return 0.72


def _cuerpo_que_cabe(pdf, texto, fuente, ancho, alto, maximo):
    """El cuerpo mas grande con el que el texto entra en ese hueco."""
    if not texto:
        return 0
    por_unidad = pdf.stringWidth(texto, fuente, 1) or 1
    return min(maximo, ancho / por_unidad, alto / _alto_mayusculas(fuente))


def _recortar(pdf, texto, fuente, cuerpo, ancho):
    if pdf.stringWidth(texto, fuente, cuerpo) <= ancho:
        return texto
    while texto and pdf.stringWidth(texto + "…", fuente, cuerpo) > ancho:
        texto = texto[:-1]
    return (texto.rstrip() + "…") if texto else ""


def _linea_centrada(pdf, texto, cx, y, fuente, cuerpo, ancho):
    """Una linea centrada en `cx`, encogida hasta caber en `ancho`."""
    if not texto:
        return
    por_unidad = pdf.stringWidth(texto, fuente, 1) or 1
    cuerpo = min(cuerpo, ancho / por_unidad)
    pdf.setFont(fuente, cuerpo)
    pdf.drawCentredString(cx, y, _recortar(pdf, texto, fuente, cuerpo, ancho))


# ============ El QR, en vectores ============


def _modulos(texto: str):
    codigo = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_H, border=0)
    codigo.add_data(texto)
    codigo.make(fit=True)
    return codigo.get_matrix()


def _dibujar_qr(pdf, texto: str, x: float, y: float, lado: float):
    """El QR como rectangulos negros sobre un cuadro blanco.

    Los modulos seguidos de una misma fila se pintan de una sola pasada: un
    QR de 49x49 son 2401 rectangulos si se hace modulo a modulo, y unos 400
    asi. Con 160 dorsales la diferencia es un PDF de 30 MB o uno de 2 MB.
    """
    modulos = _modulos(texto)
    total = len(modulos) + 2 * MODULOS_SILENCIO
    paso = lado / total

    pdf.setFillColor(CMYKColor(0, 0, 0, 0))
    pdf.rect(x, y, lado, lado, stroke=0, fill=1)

    pdf.setFillColor(NEGRO)
    for fila, celdas in enumerate(modulos):
        # La matriz viene de arriba hacia abajo y el PDF cuenta desde abajo
        cy = y + (total - MODULOS_SILENCIO - fila - 1) * paso
        inicio = None
        for columna in range(len(celdas) + 1):
            pintado = columna < len(celdas) and celdas[columna]
            if pintado and inicio is None:
                inicio = columna
            elif not pintado and inicio is not None:
                cx = x + (MODULOS_SILENCIO + inicio) * paso
                pdf.rect(cx, cy, (columna - inicio) * paso, paso, stroke=0, fill=1)
                inicio = None


# ============ El fondo que suba la organizacion ============


def preparar_fondo(datos: Optional[bytes]) -> Optional[ImageReader]:
    """La imagen base, ya en CMYK, lista para incrustar.

    Se convierte aqui y no en la subida porque el archivo se guarda tal como
    lo mando la organizacion: si manana cambia la imprenta y pide RGB, se
    cambia esta linea y no hay que volver a subir nada.
    """
    if not datos:
        return None
    try:
        imagen = Image.open(io.BytesIO(datos))
        if imagen.mode in ("RGBA", "LA", "P"):
            # Sin canal alfa: el blanco de debajo es el papel
            fondo = Image.new("RGB", imagen.size, "white")
            imagen = imagen.convert("RGBA")
            fondo.paste(imagen, mask=imagen.split()[-1])
            imagen = fondo
        return ImageReader(imagen.convert("CMYK"))
    except Exception:
        logger.warning("El diseno base de los dorsales no se pudo leer", exc_info=True)
        return None


def dpi_del_fondo(datos: Optional[bytes]) -> Optional[int]:
    """A cuantos puntos por pulgada queda la imagen estirada al tamano del dorsal.

    Es el aviso que hace falta antes de mandar a imprenta: una imagen de 800
    px sobre 8.5 pulgadas son 94 dpi, y eso sale pixelado en un dorsal que se
    mira de cerca.
    """
    if not datos:
        return None
    try:
        with Image.open(io.BytesIO(datos)) as imagen:
            ancho, alto = imagen.size
    except Exception:
        return None
    pulgadas_ancho = (ANCHO_CORTE + 2 * SANGRADO) / PULGADA
    pulgadas_alto = (ALTO_CORTE + 2 * SANGRADO) / PULGADA
    return int(min(ancho / pulgadas_ancho, alto / pulgadas_alto))


def _pintar_fondo(pdf, fondo: ImageReader, x: float, y: float, ancho: float, alto: float):
    """La imagen cubriendo el rectangulo entero, recortada por el lado que sobre.

    Estirarla deformaria el arte; se escala por el lado corto y lo que sobra
    del largo se sale por el sangrado, que es justo lo que se corta.
    """
    ancho_imagen, alto_imagen = fondo.getSize()
    escala = max(ancho / ancho_imagen, alto / alto_imagen)
    ancho_final, alto_final = ancho_imagen * escala, alto_imagen * escala

    pdf.saveState()
    recorte = pdf.beginPath()
    recorte.rect(x, y, ancho, alto)
    pdf.clipPath(recorte, stroke=0, fill=0)
    pdf.drawImage(
        fondo,
        x + (ancho - ancho_final) / 2,
        y + (alto - alto_final) / 2,
        ancho_final,
        alto_final,
    )
    pdf.restoreState()


# ============ Marcas y guias ============


def _marcas_de_corte(pdf, ox: float, oy: float):
    """Las cuatro esquinas, en negro de registro, por fuera del sangrado."""
    pdf.setStrokeColor(NEGRO)
    pdf.setLineWidth(0.25)
    for x, dx in ((ox, -1), (ox + ANCHO_CORTE, 1)):
        for y, dy in ((oy, -1), (oy + ALTO_CORTE, 1)):
            desde = SANGRADO + SEPARACION_MARCA
            pdf.line(x + dx * desde, y, x + dx * (desde + LARGO_MARCA), y)
            pdf.line(x, y + dy * desde, x, y + dy * (desde + LARGO_MARCA))


def _guias(pdf, ox: float, oy: float):
    """La linea de corte, el margen seguro y los ojales, en rosa.

    Es la prueba de taller, para mirar en pantalla que nada importante se sale.
    No se manda a imprimir con esto puesto.
    """
    pdf.setStrokeColor(MAGENTA)
    pdf.setLineWidth(0.5)
    pdf.roundRect(ox, oy, ANCHO_CORTE, ALTO_CORTE, RADIO_ESQUINA, stroke=1, fill=0)
    pdf.setDash(3, 3)
    pdf.rect(
        ox + MARGEN_SEGURO,
        oy + MARGEN_SEGURO,
        ANCHO_CORTE - 2 * MARGEN_SEGURO,
        ALTO_CORTE - 2 * MARGEN_SEGURO,
        stroke=1,
        fill=0,
    )
    pdf.setDash()
    for x in (ox + OJAL_MARGEN, ox + ANCHO_CORTE - OJAL_MARGEN):
        for y in (oy + OJAL_MARGEN, oy + ALTO_CORTE - OJAL_MARGEN):
            pdf.circle(x, y, OJAL_RADIO, stroke=1, fill=0)


# ============ Un dorsal ============


def _una_pagina(pdf, dorsal: dict, opciones: dict, fondo, fuente: str, ox: float, oy: float):
    color_fondo = _cmyk(opciones.get("color_fondo"), COLOR_FONDO)
    color_banda = _cmyk(opciones.get("color_banda"), COLOR_BANDA)
    color_texto_banda = _cmyk(opciones.get("color_texto_banda"), COLOR_TEXTO_BANDA)
    color_numero = _cmyk(opciones.get("color_numero"), COLOR_NUMERO)
    color_nombre = _cmyk(opciones.get("color_nombre"), COLOR_NOMBRE)

    # --- Fondo, hasta el sangrado ---
    sx, sy = ox - SANGRADO, oy - SANGRADO
    ancho_sangrado, alto_sangrado = ANCHO_CORTE + 2 * SANGRADO, ALTO_CORTE + 2 * SANGRADO
    pdf.setFillColor(color_fondo)
    pdf.rect(sx, sy, ancho_sangrado, alto_sangrado, stroke=0, fill=1)
    if fondo is not None:
        _pintar_fondo(pdf, fondo, sx, sy, ancho_sangrado, alto_sangrado)

    # El color del texto del evento y del pie no depende de que haya banda:
    # con el arte de la organizacion de fondo, la banda desaparece pero el
    # texto sigue ahi y quien elige el color es quien conoce su arte.
    con_bandas = bool(opciones.get("mostrar_bandas", True))
    evento = (opciones.get("evento") or "").strip()
    pie = (opciones.get("pie") or "").strip()

    # --- Banda superior con el nombre del evento ---
    arriba = oy + ALTO_CORTE
    alto_banda = ALTO_BANDA_SUPERIOR if evento else 0
    if evento:
        if con_bandas:
            pdf.setFillColor(color_banda)
            pdf.rect(sx, arriba - alto_banda, ancho_sangrado, alto_banda + SANGRADO, stroke=0, fill=1)
        pdf.setFillColor(color_texto_banda)
        _linea_centrada(
            pdf,
            evento.upper(),
            ox + ANCHO_CORTE / 2,
            arriba - alto_banda + (alto_banda - 0.26 * PULGADA) / 2,
            fuente,
            0.26 * PULGADA,
            ANCHO_CORTE - 2 * MARGEN_SEGURO,
        )

    # --- Banda inferior con el pie (carrera y fecha) ---
    abajo = oy
    alto_pie = ALTO_BANDA_INFERIOR if pie else 0
    if pie:
        if con_bandas:
            pdf.setFillColor(color_banda)
            pdf.rect(sx, sy, ancho_sangrado, alto_pie + SANGRADO, stroke=0, fill=1)
        pdf.setFillColor(color_texto_banda)
        _linea_centrada(
            pdf,
            pie.upper(),
            ox + ANCHO_CORTE / 2,
            abajo + (alto_pie - 0.14 * PULGADA) / 2,
            fuente,
            0.14 * PULGADA,
            ANCHO_CORTE - 2 * MARGEN_SEGURO,
        )

    # --- La columna del QR ---
    lado_qr = float(opciones.get("qr_lado_mm") or 40) / 25.4 * PULGADA
    lado_qr = max(20 / 25.4 * PULGADA, min(lado_qr, 70 / 25.4 * PULGADA))
    posicion = (opciones.get("qr_posicion") or "derecha").lower()
    url = (dorsal.get("qr_url") or "").strip()
    con_qr = bool(opciones.get("mostrar_qr", True)) and bool(url)

    izquierda = ox + MARGEN_SEGURO
    derecha = ox + ANCHO_CORTE - MARGEN_SEGURO
    if con_qr:
        centro_qr = (abajo + alto_pie + arriba - alto_banda) / 2
        if posicion == "izquierda":
            x_qr = ox + MARGEN_QR
            izquierda = x_qr + lado_qr + HUECO_QR
        else:
            x_qr = ox + ANCHO_CORTE - MARGEN_QR - lado_qr
            derecha = x_qr - HUECO_QR
        _dibujar_qr(pdf, url, x_qr, centro_qr - lado_qr / 2, lado_qr)

    # --- El numero y el nombre ---
    numero = str(dorsal.get("numero") or "").strip()
    nombre = (dorsal.get("nombre") or "").strip().upper()
    ancho_util = max(derecha - izquierda, 1)
    centro_x = (izquierda + derecha) / 2
    techo = arriba - alto_banda - 0.18 * PULGADA
    suelo = abajo + alto_pie + 0.18 * PULGADA
    alto_util = max(techo - suelo, 1)

    alto_nombre = 0.46 * PULGADA if nombre else 0
    cuerpo_numero = _cuerpo_que_cabe(
        pdf, numero, fuente, ancho_util, alto_util - alto_nombre, 3.2 * PULGADA
    )
    alto_numero = cuerpo_numero * _alto_mayusculas(fuente)

    # El bloque numero + nombre, centrado en lo que quede de dorsal
    sobra = alto_util - alto_numero - alto_nombre
    base_numero = suelo + sobra / 2 + alto_nombre

    if numero:
        pdf.setFillColor(color_numero)
        pdf.setFont(fuente, cuerpo_numero)
        pdf.drawCentredString(centro_x, base_numero, numero)

    if nombre:
        pdf.setFillColor(color_nombre)
        _linea_centrada(
            pdf, nombre, centro_x, base_numero - alto_nombre, fuente, 0.34 * PULGADA, ancho_util
        )

    if opciones.get("marcas_corte", True):
        _marcas_de_corte(pdf, ox, oy)
    if opciones.get("guias"):
        _guias(pdf, ox, oy)


# ============ El documento ============


def construir_pdf(
    dorsales: list,
    opciones: Optional[dict] = None,
    fondo: Optional[bytes] = None,
    fuente: Optional[bytes] = None,
) -> io.BytesIO:
    """El PDF con un dorsal por pagina.

    `dorsales` son diccionarios con `numero`, `nombre` y `qr_url`. `opciones`
    es lo que se parametriza desde el panel (textos, colores, QR, marcas).
    """
    opciones = dict(opciones or {})
    con_marcas = bool(opciones.get("marcas_corte", True))
    margen = MARGEN_MARCAS if con_marcas else 0
    ancho_pagina = ANCHO_CORTE + 2 * SANGRADO + 2 * margen
    alto_pagina = ALTO_CORTE + 2 * SANGRADO + 2 * margen
    ox = (ancho_pagina - ANCHO_CORTE) / 2
    oy = (alto_pagina - ALTO_CORTE) / 2

    memoria = io.BytesIO()
    pdf = canvas.Canvas(memoria, pagesize=(ancho_pagina, alto_pagina))
    pdf.setTitle(opciones.get("evento") or "Dorsales")

    imagen = preparar_fondo(fondo)
    tipografia = registrar_fuente(fuente)

    for dorsal in dorsales or []:
        _una_pagina(pdf, dorsal, opciones, imagen, tipografia, ox, oy)
        pdf.showPage()

    if not dorsales:
        pdf.showPage()

    pdf.save()
    memoria.seek(0)
    return memoria
