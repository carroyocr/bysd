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

La plantilla es la del dorsal de 2026, que es el que la gente ya reconoce:
banda arriba con el logo y el nombre de la carrera, franja clara en medio con
el nombre del corredor sobre un numero grande, y banda abajo con el logo del
patrocinador. El QR es lo unico nuevo, y va en la franja del medio.

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

# Los del dorsal de 2026: franja clara arriba y abajo, centro blanco y el
# numero en azul. Se pueden cambiar todos desde el panel.
COLOR_FONDO = "#FFFFFF"
COLOR_BANDA = "#A3BECD"
COLOR_TEXTO_BANDA = "#1F3B57"
COLOR_NUMERO = "#3A5F80"
COLOR_NOMBRE = "#3A5F80"

# Distancia de un borde de corte a la que el ojal ya no estorba: esta a 0.6"
# con 0.1" de radio. Nada impreso se mete dentro de esa franja -- ni el logo,
# ni el nombre de la carrera, ni el del patrocinador -- porque por ahi entra
# el imperdible y lo que quede debajo se pierde. El color de la banda si pasa
# por encima: el agujero se perfora y el color no estorba.
LEJOS_DE_LOS_OJALES = OJAL_MARGEN + OJAL_RADIO + 0.09 * PULGADA

# Las tres franjas del dorsal de 2026, de arriba abajo
ALTO_BANDA_SUPERIOR = 1.65 * PULGADA   # logo + nombre de la carrera
ALTO_BANDA_INFERIOR = 0.90 * PULGADA   # logo del patrocinador
AIRE_BANDA = 0.14 * PULGADA            # lo que respira el contenido dentro de su banda
HUECO_LOGO = 0.16 * PULGADA            # entre el logo y el nombre de la carrera
INTERLINEA_EVENTO = 1.18

# Topes, no medidas: el nombre de la carrera crece hasta llenar el hueco que
# le deja el logo, y solo para si se sale de su banda.
CUERPO_EVENTO = 1.0 * PULGADA
CUERPO_PIE = 0.16 * PULGADA
CUERPO_NOMBRE = 0.44 * PULGADA
AIRE_SOBRE_EL_NUMERO = 0.10 * PULGADA
LADO_QR = 40.0 / 25.4 * PULGADA      # 40 mm

# Cuanto de la franja del medio ocupa el numero, de alto. Llenarla entera lo
# deja desproporcionado: en el dorsal de 2026 ocupa poco mas de la mitad, y
# el aire de alrededor es lo que lo hace legible de lejos.
PROPORCION_NUMERO = 0.60

# Las cifras de una tipografia de palo seco vienen todas del mismo ancho, y a
# cuerpo grande un "1" deja un boquete a cada lado. Un pelo de espacio negativo
# junta el numero sin llegar a pegar las cifras.
TRACKING_NUMERO = -0.04

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


def _tinta(color: CMYKColor) -> tuple:
    """Un color CMYK como los cuatro bytes que entiende Pillow (0 = sin tinta)."""
    return tuple(
        max(0, min(255, round(255 * v)))
        for v in (color.cyan, color.magenta, color.yellow, color.black)
    )


BLANCO_PAPEL = (0, 0, 0, 0)


def _aplanar(datos: bytes, sobre: tuple):
    """La imagen en CMYK, con la transparencia fundida contra `sobre`.

    Perder el canal alfa no es un descuido: un PDF no puede llevar a la vez
    una imagen en CMYK y su transparencia -- reportlab, en cuanto ve un PNG
    con alfa, lo mete en DeviceRGB, que es justo lo que la guia de la imprenta
    prohibe. Asi que el logo se funde aqui contra el color de la banda sobre
    la que va a caer, y se funde **en CMYK**: si se hiciera en RGB y se
    convirtiera despues, Pillow reparte la tinta a su manera y el recuadro del
    logo saldria de un tono distinto al de la banda, visible a un metro.

    La consecuencia practica: si la organizacion sube su propio arte de fondo,
    el logo tiene que venir ya dentro de ese arte, porque contra un dibujo no
    hay color plano contra el que fundir.
    """
    imagen = Image.open(io.BytesIO(datos))
    if imagen.mode not in ("RGBA", "LA", "P"):
        return imagen.convert("CMYK")

    imagen = imagen.convert("RGBA")
    # El aire transparente del archivo se recorta antes de nada: si no, un
    # logo con margen a un lado se centra por su lienzo y sale descentrado en
    # el dorsal, que es lo que se ve. Se centra la tinta, no el archivo.
    recorte = imagen.split()[-1].getbbox()
    if recorte:
        imagen = imagen.crop(recorte)
    lienzo = Image.new("CMYK", imagen.size, sobre)
    lienzo.paste(imagen.convert("CMYK"), mask=imagen.split()[-1])
    return lienzo


def preparar_imagen(datos: Optional[bytes], sobre: tuple = BLANCO_PAPEL) -> Optional[ImageReader]:
    """La imagen lista para incrustar, o None si no se deja leer.

    Se convierte al armar el PDF y no al subirla porque el archivo se guarda
    tal como lo mando la organizacion: si manana cambia la imprenta y pide
    RGB, se cambia esta funcion y no hay que volver a subir nada.
    """
    if not datos:
        return None
    try:
        return ImageReader(_aplanar(datos, sobre))
    except Exception:
        logger.warning("Una imagen de los dorsales no se pudo leer", exc_info=True)
        return None


def dpi_al_imprimir(
    datos: Optional[bytes], ancho_pulgadas: float, alto_pulgadas: float, cubrir: bool = False
) -> Optional[int]:
    """A cuantos puntos por pulgada queda esa imagen en su hueco del dorsal.

    Es el aviso que hace falta antes de mandar a imprenta: un logo de 300 px
    en una banda de pulgada y media sale con los bordes rotos, y eso no se ve
    en la pantalla del panel. `cubrir` es para el arte de fondo, que se recorta
    para llenar el dorsal entero; los logos entran completos dentro de su caja.
    """
    if not datos:
        return None
    try:
        with Image.open(io.BytesIO(datos)) as imagen:
            ancho, alto = imagen.size
    except Exception:
        return None
    if not ancho or not alto:
        return None
    lados = (ancho_pulgadas / ancho, alto_pulgadas / alto)
    pulgadas_por_pixel = max(lados) if cubrir else min(lados)
    return int(1 / pulgadas_por_pixel) if pulgadas_por_pixel else None


def dpi_del_fondo(datos: Optional[bytes]) -> Optional[int]:
    """El arte de fondo se mide contra el dorsal entero, sangrado incluido."""
    return dpi_al_imprimir(
        datos,
        (ANCHO_CORTE + 2 * SANGRADO) / PULGADA,
        (ALTO_CORTE + 2 * SANGRADO) / PULGADA,
        cubrir=True,
    )


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


def _pintar_logo(pdf, logo: ImageReader, x: float, y: float, ancho: float, alto: float,
                 alinear="centro") -> float:
    """El logo entero dentro de su caja, sin deformarlo. Devuelve lo que ocupa."""
    ancho_imagen, alto_imagen = logo.getSize()
    escala = min(ancho / ancho_imagen, alto / alto_imagen)
    ancho_final, alto_final = ancho_imagen * escala, alto_imagen * escala
    izquierda = x if alinear == "izquierda" else x + (ancho - ancho_final) / 2
    pdf.drawImage(logo, izquierda, y + (alto - alto_final) / 2, ancho_final, alto_final)
    return ancho_final


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


def _dos_lineas(pdf, texto: str, fuente: str, ancho: float, cuerpo: float) -> list:
    """El nombre de la carrera partido en dos lineas, como en el dorsal de 2026.

    Se parte por donde las dos queden mas parejas, que es lo que hace un
    disenador a ojo. Con una barra vertical se manda a mano donde cortar, para
    los nombres que no se parten bien solos.
    """
    if "|" in texto:
        return [parte.strip() for parte in texto.split("|", 1) if parte.strip()]

    palabras = texto.split()
    if len(palabras) < 2:
        return [texto]
    if pdf.stringWidth(texto, fuente, cuerpo) <= ancho:
        # Cabe entera y holgada: dos lineas solo si es un nombre largo
        if len(palabras) < 3:
            return [texto]

    def desparejo(corte):
        izquierda = " ".join(palabras[:corte])
        derecha = " ".join(palabras[corte:])
        return max(pdf.stringWidth(izquierda, fuente, 1), pdf.stringWidth(derecha, fuente, 1))

    corte = min(range(1, len(palabras)), key=desparejo)
    return [" ".join(palabras[:corte]), " ".join(palabras[corte:])]


def _banda_superior(pdf, opciones, logo, fuente, ox, sx, arriba, ancho_sangrado,
                    alto_banda, con_bandas, color_banda, color_texto):
    """Logo a la izquierda y el nombre de la carrera al lado, como en 2026."""
    if con_bandas:
        pdf.setFillColor(color_banda)
        pdf.rect(sx, arriba - alto_banda, ancho_sangrado, alto_banda + SANGRADO, stroke=0, fill=1)

    izquierda = ox + LEJOS_DE_LOS_OJALES
    derecha = ox + ANCHO_CORTE - LEJOS_DE_LOS_OJALES
    alto_util = alto_banda - 2 * AIRE_BANDA
    base = arriba - alto_banda + AIRE_BANDA

    if logo is not None:
        ocupa = _pintar_logo(pdf, logo, izquierda, base, alto_util, alto_util, alinear="izquierda")
        izquierda += ocupa + HUECO_LOGO

    evento = (opciones.get("evento") or "").strip()
    if not evento:
        return

    ancho = max(derecha - izquierda, 1)
    lineas = _dos_lineas(pdf, evento, fuente, ancho, CUERPO_EVENTO)

    # Crece hasta llenar el hueco que deja el logo. Lo que lo para es el ancho
    # o el alto de la banda, nunca un tamano fijo: el hueco cambia con lo
    # ancho que sea el logo y con lo largo que sea el nombre.
    cuerpo = CUERPO_EVENTO
    for linea in lineas:
        cuerpo = min(cuerpo, ancho / (pdf.stringWidth(linea, fuente, 1) or 1))
    alto_por_linea = _alto_mayusculas(fuente) + (len(lineas) - 1) * INTERLINEA_EVENTO
    cuerpo = min(cuerpo, alto_util / alto_por_linea)

    alto_bloque = cuerpo * alto_por_linea
    y = base + (alto_util - alto_bloque) / 2 + (len(lineas) - 1) * cuerpo * INTERLINEA_EVENTO

    pdf.setFillColor(color_texto)
    pdf.setFont(fuente, cuerpo)
    for linea in lineas:
        pdf.drawString(izquierda, y, linea)
        y -= cuerpo * INTERLINEA_EVENTO


def _banda_inferior(pdf, opciones, patrocinador, fuente, ox, sx, abajo, sy, ancho_sangrado,
                    alto_banda, con_bandas, color_banda, color_texto):
    """El logo del patrocinador; si no lo hay, el pie de texto."""
    if con_bandas:
        pdf.setFillColor(color_banda)
        pdf.rect(sx, sy, ancho_sangrado, alto_banda + SANGRADO, stroke=0, fill=1)

    izquierda = ox + LEJOS_DE_LOS_OJALES
    ancho = ANCHO_CORTE - 2 * LEJOS_DE_LOS_OJALES
    alto_util = alto_banda - 2 * AIRE_BANDA

    if patrocinador is not None:
        _pintar_logo(pdf, patrocinador, izquierda, abajo + AIRE_BANDA, ancho, alto_util)
        return

    pie = (opciones.get("pie") or "").strip()
    if pie:
        pdf.setFillColor(color_texto)
        _linea_centrada(
            pdf, pie, ox + ANCHO_CORTE / 2,
            abajo + (alto_banda - CUERPO_PIE * _alto_mayusculas(fuente)) / 2,
            fuente, CUERPO_PIE, ancho,
        )


def _una_pagina(pdf, dorsal: dict, opciones: dict, imagenes: dict, fuente: str,
                ox: float, oy: float):
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
    if imagenes.get("fondo") is not None:
        _pintar_fondo(pdf, imagenes["fondo"], sx, sy, ancho_sangrado, alto_sangrado)

    # El color del texto de las bandas no depende de que haya banda: con el
    # arte de la organizacion de fondo la banda desaparece pero el texto sigue
    # ahi, y quien elige el color es quien conoce su arte.
    con_bandas = bool(opciones.get("mostrar_bandas", True))
    arriba, abajo = oy + ALTO_CORTE, oy

    # --- Las dos bandas ---
    #
    # Una banda existe si tiene algo que ensenar. El alto se reserva aunque las
    # bandas esten apagadas: lo que manda la franja del medio es donde caen el
    # logo y el patrocinador, no si se pinta un rectangulo detras.
    hay_arriba = bool((opciones.get("evento") or "").strip()) or imagenes.get("logo") is not None
    hay_abajo = bool((opciones.get("pie") or "").strip()) or imagenes.get("patrocinador") is not None
    alto_banda = ALTO_BANDA_SUPERIOR if hay_arriba else 0
    alto_pie = ALTO_BANDA_INFERIOR if hay_abajo else 0

    if hay_arriba:
        _banda_superior(pdf, opciones, imagenes.get("logo"), fuente, ox, sx, arriba,
                        ancho_sangrado, alto_banda, con_bandas, color_banda, color_texto_banda)
    if hay_abajo:
        _banda_inferior(pdf, opciones, imagenes.get("patrocinador"), fuente, ox, sx, abajo, sy,
                        ancho_sangrado, alto_pie, con_bandas, color_banda, color_texto_banda)

    # --- La franja del medio ---
    #
    # Entre las dos bandas, y en todo caso por dentro de los ojales: sin bandas
    # que la sujeten, el numero se estiraria hasta el imperdible.
    techo = min(arriba - alto_banda - AIRE_BANDA, arriba - LEJOS_DE_LOS_OJALES)
    suelo = max(abajo + alto_pie + AIRE_BANDA, abajo + LEJOS_DE_LOS_OJALES)

    # --- La columna del QR ---
    lado_qr = float(opciones.get("qr_lado_mm") or 40) / 25.4 * PULGADA
    lado_qr = max(20 / 25.4 * PULGADA, min(lado_qr, 70 / 25.4 * PULGADA))
    lado_qr = min(lado_qr, max(techo - suelo, 1))
    posicion = (opciones.get("qr_posicion") or "derecha").lower()
    url = (dorsal.get("qr_url") or "").strip()
    con_qr = bool(opciones.get("mostrar_qr", True)) and bool(url)

    izquierda = ox + MARGEN_SEGURO
    derecha = ox + ANCHO_CORTE - MARGEN_SEGURO
    if con_qr:
        if posicion == "izquierda":
            x_qr = ox + MARGEN_SEGURO
            izquierda = x_qr + lado_qr + HUECO_QR
        else:
            x_qr = ox + ANCHO_CORTE - MARGEN_SEGURO - lado_qr
            derecha = x_qr - HUECO_QR
        _dibujar_qr(pdf, url, x_qr, (suelo + techo - lado_qr) / 2, lado_qr)

    # --- El nombre del corredor, y debajo el numero ---
    #
    # Como en 2026: el nombre arriba y pequeno, el numero debajo y enorme. El
    # nombre va tal como lo escribio el atleta, sin pasarlo a mayusculas: la
    # personalizacion es suya y "CoachMigue" no es "COACHMIGUE".
    numero = str(dorsal.get("numero") or "").strip()
    nombre = (dorsal.get("nombre") or "").strip()
    # El numero se centra en el hueco que deja el QR, no en el dorsal. Es a
    # proposito: centrarlo en el dorsal con un QR al lado lo obliga a encoger
    # casi a la mitad, y en un dorsal lo que hay que leer a treinta metros es
    # el numero. Sin QR el hueco es el dorsal entero y queda centrado de todas
    # formas, como en 2026.
    ancho_util = max(derecha - izquierda, 1)
    centro_x = (izquierda + derecha) / 2
    alto_util = max(techo - suelo, 1)

    cuerpo_nombre = min(CUERPO_NOMBRE, ancho_util / (pdf.stringWidth(nombre, fuente, 1) or 1))
    alto_nombre = (cuerpo_nombre * _alto_mayusculas(fuente) + AIRE_SOBRE_EL_NUMERO) if nombre else 0
    cuerpo_numero = _cuerpo_que_cabe(
        pdf, numero, fuente, ancho_util,
        min(alto_util - alto_nombre, alto_util * PROPORCION_NUMERO), 3.2 * PULGADA,
    )
    alto_numero = cuerpo_numero * _alto_mayusculas(fuente)

    sobra = alto_util - alto_numero - alto_nombre
    base_numero = suelo + sobra / 2

    if numero:
        # El espacio entre cifras solo se toca desde un objeto de texto, y con
        # el puesto la cuenta del ancho de reportlab ya no vale: se centra a
        # mano descontando lo que se junta.
        tracking = TRACKING_NUMERO * cuerpo_numero
        ancho_numero = pdf.stringWidth(numero, fuente, cuerpo_numero) + (len(numero) - 1) * tracking
        # El espaciado se queda en el estado del lienzo si no se aisla, y lo
        # siguiente que se escriba -- el nombre del corredor -- saldria con las
        # letras montadas unas sobre otras.
        pdf.saveState()
        pdf.setFillColor(color_numero)
        cifras = pdf.beginText(centro_x - ancho_numero / 2, base_numero)
        cifras.setFont(fuente, cuerpo_numero)
        cifras.setCharSpace(tracking)
        cifras.textOut(numero)
        pdf.drawText(cifras)
        pdf.restoreState()

    if nombre:
        pdf.setFillColor(color_nombre)
        _linea_centrada(
            pdf, nombre, centro_x, base_numero + alto_numero + AIRE_SOBRE_EL_NUMERO,
            fuente, cuerpo_nombre, ancho_util,
        )

    if opciones.get("marcas_corte", True):
        _marcas_de_corte(pdf, ox, oy)
    if opciones.get("guias"):
        _guias(pdf, ox, oy)


# ============ El documento ============


def construir_pdf(
    dorsales: list,
    opciones: Optional[dict] = None,
    archivos: Optional[dict] = None,
    fuente: Optional[bytes] = None,
) -> io.BytesIO:
    """El PDF con un dorsal por pagina.

    `dorsales` son diccionarios con `numero`, `nombre` y `qr_url`. `opciones`
    es lo que se parametriza desde el panel (textos, colores, QR, marcas).
    `archivos` trae el arte de fondo y los dos logos, en bytes tal como se
    subieron: `fondo`, `logo` y `patrocinador`.
    """
    opciones = dict(opciones or {})
    archivos = dict(archivos or {})
    con_marcas = bool(opciones.get("marcas_corte", True))
    margen = MARGEN_MARCAS if con_marcas else 0
    ancho_pagina = ANCHO_CORTE + 2 * SANGRADO + 2 * margen
    alto_pagina = ALTO_CORTE + 2 * SANGRADO + 2 * margen
    ox = (ancho_pagina - ANCHO_CORTE) / 2
    oy = (alto_pagina - ALTO_CORTE) / 2

    memoria = io.BytesIO()
    pdf = canvas.Canvas(memoria, pagesize=(ancho_pagina, alto_pagina))
    pdf.setTitle(opciones.get("evento") or "Dorsales")

    # Los logos se funden contra el color sobre el que van a caer: la banda, o
    # el fondo del dorsal si las bandas estan apagadas.
    detras = _tinta(
        _cmyk(opciones.get("color_banda"), COLOR_BANDA)
        if opciones.get("mostrar_bandas", True)
        else _cmyk(opciones.get("color_fondo"), COLOR_FONDO)
    )
    imagenes = {
        "fondo": preparar_imagen(archivos.get("fondo")),
        "logo": preparar_imagen(archivos.get("logo"), detras),
        "patrocinador": preparar_imagen(archivos.get("patrocinador"), detras),
    }
    tipografia = registrar_fuente(fuente)

    for dorsal in dorsales or []:
        _una_pagina(pdf, dorsal, opciones, imagenes, tipografia, ox, oy)
        pdf.showPage()

    if not dorsales:
        pdf.showPage()

    pdf.save()
    memoria.seek(0)
    return memoria
