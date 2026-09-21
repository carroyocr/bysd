"""El carnet del staff, en hojas para imprimir, recortar y doblar.

Cada carnet va con su anverso y su reverso uno al lado del otro, pegados por
el lomo: se recorta el contorno por las marcas de corte y se dobla por la
linea punteada del centro, con lo que las dos caras quedan espalda con
espalda y listas para plastificar. Cuatro carnets por hoja carta apaisada.

Las franjas de color se pasan un poco del borde (sangrado): si el corte se
desvia un milimetro no aparece un filo blanco. Por eso las marcas de corte
arrancan algo mas afuera.

Aqui no se habla con la base de datos: entran los carnets ya armados y sale
el PDF, para poder probarlo sin levantar nada.
"""
import io
from pathlib import Path

import qrcode
from PIL import Image
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import landscape, letter
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

NARANJA = HexColor("#E8772E")
NARANJA_CLARO = HexColor("#F5B98A")
OSCURO = HexColor("#111827")
GRIS = HexColor("#6B7280")
GRIS_CLARO = HexColor("#D1D5DB")
FONDO_FOTO = HexColor("#F3F4F6")

# Tamano de tarjeta de identificacion (CR80), en vertical
ANCHO = 54 * mm
ALTO = 85.6 * mm

# Rejilla de la hoja: dos parejas (anverso + reverso) por fila, dos filas
COLUMNAS = 2
FILAS = 2
HUECO_COLUMNAS = 16 * mm
HUECO_FILAS = 14 * mm

SANGRADO = 1.5 * mm
MARCA_SEPARACION = 3 * mm   # entre el borde de corte y el inicio de la marca
MARCA_LARGO = 3.5 * mm

LOGO = Path(__file__).resolve().parent.parent / "static" / "carnet" / "logo.png"
SITIO = "backyardultrasantodomingo.com"


def _logo():
    if not LOGO.exists():
        return None
    return ImageReader(Image.open(LOGO).convert("RGBA"))


def _qr(texto: str) -> ImageReader:
    codigo = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, border=1, box_size=10)
    codigo.add_data(texto)
    codigo.make(fit=True)
    return ImageReader(codigo.make_image(fill_color="black", back_color="white").convert("RGB"))


def _ajustar(pdf, texto: str, fuente: str, tamano: float, ancho: float, minimo: float = 6) -> float:
    """El tamano de letra con el que el texto cabe en el ancho, sin bajar del minimo."""
    while tamano > minimo and pdf.stringWidth(texto, fuente, tamano) > ancho:
        tamano -= 0.25
    return tamano


def _recortar(pdf, texto: str, fuente: str, tamano: float, ancho: float) -> str:
    if pdf.stringWidth(texto, fuente, tamano) <= ancho:
        return texto
    while texto and pdf.stringWidth(texto + "…", fuente, tamano) > ancho:
        texto = texto[:-1]
    return texto + "…"


def _centrado(pdf, texto: str, cx: float, y: float, fuente: str, tamano: float, ancho: float, minimo: float = 6):
    tamano = _ajustar(pdf, texto, fuente, tamano, ancho, minimo)
    texto = _recortar(pdf, texto, fuente, tamano, ancho)
    pdf.setFont(fuente, tamano)
    pdf.drawCentredString(cx, y, texto)


def _iniciales(carnet: dict) -> str:
    return "".join(
        (parte.strip()[:1] for parte in (carnet.get("nombre") or "", carnet.get("apellidos") or "") if parte.strip())
    ).upper() or "?"


def _anverso(pdf, carnet: dict, x: float, y: float, logo):
    """Cara de delante. (x, y) es la esquina inferior izquierda; sangra por
    arriba, por abajo y por la izquierda, que son bordes de corte."""
    cx = x + ANCHO / 2
    arriba = y + ALTO
    util = ANCHO - 6 * mm

    # Encabezado con el logo
    alto_cabecera = 18 * mm
    pdf.setFillColor(OSCURO)
    pdf.rect(x - SANGRADO, arriba - alto_cabecera, ANCHO + SANGRADO, alto_cabecera + SANGRADO, stroke=0, fill=1)
    lado_logo = 14 * mm
    if logo:
        pdf.drawImage(logo, x + 3 * mm, arriba - alto_cabecera + 2 * mm, lado_logo, lado_logo, mask="auto")
    texto_x = x + 3 * mm + lado_logo + 2.5 * mm
    pdf.setFillColor(white)
    pdf.setFont("Helvetica-Bold", 8.5)
    pdf.drawString(texto_x, arriba - 8 * mm, "BACKYARD ULTRA")
    pdf.setFillColor(NARANJA_CLARO)
    pdf.setFont("Helvetica", 8.5)
    pdf.drawString(texto_x, arriba - 12 * mm, "SANTO DOMINGO")

    # Foto, o las iniciales mientras no haya
    lado_foto = 27 * mm
    foto_x = cx - lado_foto / 2
    foto_y = arriba - alto_cabecera - 4 * mm - lado_foto
    pdf.setFillColor(FONDO_FOTO)
    pdf.rect(foto_x, foto_y, lado_foto, lado_foto, stroke=0, fill=1)
    if carnet.get("foto"):
        pdf.drawImage(ImageReader(io.BytesIO(carnet["foto"])), foto_x, foto_y, lado_foto, lado_foto,
                      preserveAspectRatio=True, anchor="c", mask="auto")
    else:
        pdf.setFillColor(GRIS)
        pdf.setFont("Helvetica-Bold", 27)
        pdf.drawCentredString(cx, foto_y + lado_foto / 2 - 9.5, _iniciales(carnet))
    pdf.setStrokeColor(NARANJA)
    pdf.setLineWidth(1.4)
    pdf.rect(foto_x, foto_y, lado_foto, lado_foto, stroke=1, fill=0)

    # Nombre en dos lineas: nombre y apellidos
    pdf.setFillColor(OSCURO)
    linea = foto_y - 5.5 * mm
    for parte in (carnet.get("nombre") or "", carnet.get("apellidos") or ""):
        if parte.strip():
            _centrado(pdf, parte.strip(), cx, linea, "Helvetica-Bold", 12, util, minimo=8)
            linea -= 5 * mm

    pdf.setFillColor(GRIS)
    _centrado(pdf, carnet.get("puesto") or "Voluntario", cx, linea - 0.5 * mm, "Helvetica", 8, util)

    # Franja STAFF y, debajo, el evento
    alto_evento = 6 * mm
    alto_staff = 11 * mm
    pdf.setFillColor(OSCURO)
    pdf.rect(x - SANGRADO, y - SANGRADO, ANCHO + SANGRADO, alto_evento + SANGRADO, stroke=0, fill=1)
    pdf.setFillColor(GRIS_CLARO)
    _centrado(pdf, carnet.get("evento") or "", cx, y + 2.1 * mm, "Helvetica", 7, util, minimo=5.5)

    pdf.setFillColor(NARANJA)
    pdf.rect(x - SANGRADO, y + alto_evento, ANCHO + SANGRADO, alto_staff, stroke=0, fill=1)
    espacio = 6
    ancho_staff = pdf.stringWidth("STAFF", "Helvetica-Bold", 24) + espacio * 4
    # El espaciado entre letras se queda pegado al lienzo si no se aisla
    pdf.saveState()
    texto = pdf.beginText(cx - ancho_staff / 2, y + alto_evento + 3 * mm)
    texto.setFont("Helvetica-Bold", 24)
    texto.setCharSpace(espacio)
    texto.setFillColor(white)
    texto.textOut("STAFF")
    pdf.drawText(texto)
    pdf.restoreState()


def _reverso(pdf, carnet: dict, x: float, y: float):
    """Cara de atras. Sangra por arriba, por abajo y por la derecha."""
    cx = x + ANCHO / 2
    arriba = y + ALTO
    izquierda = x + 5 * mm
    util = ANCHO - 10 * mm

    pdf.setFillColor(NARANJA)
    pdf.rect(x, arriba - 3 * mm, ANCHO + SANGRADO, 3 * mm + SANGRADO, stroke=0, fill=1)

    lado_qr = 28 * mm
    qr_y = arriba - 6.5 * mm - lado_qr
    if carnet.get("url_verificacion"):
        pdf.drawImage(_qr(carnet["url_verificacion"]), cx - lado_qr / 2, qr_y, lado_qr, lado_qr)
    pdf.setFillColor(GRIS)
    pdf.setFont("Helvetica", 6.5)
    pdf.drawCentredString(cx, qr_y - 3.5 * mm, "Escanear para verificar")

    def dato(etiqueta: str, valores: list, linea: float) -> float:
        pdf.setFillColor(GRIS)
        pdf.setFont("Helvetica", 6.5)
        pdf.drawString(izquierda, linea, etiqueta)
        linea -= 3.6 * mm
        pdf.setFillColor(OSCURO)
        pdf.setFont("Helvetica-Bold", 8)
        for valor in valores:
            pdf.drawString(izquierda, linea, _recortar(pdf, valor, "Helvetica-Bold", 8, util))
            linea -= 3.6 * mm
        return linea - 0.8 * mm

    contacto = carnet.get("contacto_nombre") or "—"
    if carnet.get("contacto_relacion"):
        contacto = f"{contacto} ({carnet['contacto_relacion']})"

    linea = qr_y - 8 * mm
    linea = dato("Tipo de sangre", [carnet.get("tipo_sangre") or "—"], linea)
    linea = dato("Contacto de emergencia", [contacto, carnet.get("contacto_telefono") or "—"], linea)
    dato("Carnet N.º", [carnet.get("numero") or "—"], linea)

    alto_pie = 6 * mm
    pdf.setFillColor(GRIS)
    pdf.setFont("Helvetica", 6.5)
    pdf.drawCentredString(cx, y + alto_pie + 5.5 * mm, "Personal e intransferible.")
    pdf.drawCentredString(cx, y + alto_pie + 2.5 * mm, "Portarlo visible durante todo el evento.")

    pdf.setFillColor(OSCURO)
    pdf.rect(x, y - SANGRADO, ANCHO + SANGRADO, alto_pie + SANGRADO, stroke=0, fill=1)
    pdf.setFillColor(GRIS_CLARO)
    pdf.setFont("Helvetica", 7)
    pdf.drawCentredString(cx, y + 2.1 * mm, SITIO)


def _marcas_de_corte(pdf, x: float, y: float):
    """Marcas en las esquinas del contorno de la pareja y, en el centro, las
    del doblez. Quedan fuera del carnet, para que no se vean al recortar."""
    ancho = 2 * ANCHO
    pdf.setStrokeColor(OSCURO)
    pdf.setLineWidth(0.4)
    pdf.setDash()
    for esquina_x, hacia_x in ((x, -1), (x + ancho, 1)):
        for esquina_y, hacia_y in ((y, -1), (y + ALTO, 1)):
            inicio = MARCA_SEPARACION
            fin = MARCA_SEPARACION + MARCA_LARGO
            pdf.line(esquina_x + hacia_x * inicio, esquina_y, esquina_x + hacia_x * fin, esquina_y)
            pdf.line(esquina_x, esquina_y + hacia_y * inicio, esquina_x, esquina_y + hacia_y * fin)

    # Doblez: raya punteada arriba y abajo del lomo
    lomo = x + ANCHO
    pdf.setDash(1.5, 1.5)
    pdf.line(lomo, y + ALTO + MARCA_SEPARACION, lomo, y + ALTO + MARCA_SEPARACION + MARCA_LARGO)
    pdf.line(lomo, y - MARCA_SEPARACION, lomo, y - MARCA_SEPARACION - MARCA_LARGO)
    pdf.setDash()


def construir_pdf(carnets: list, titulo: str = "Carnets de staff") -> io.BytesIO:
    """Devuelve el PDF con todos los carnets, cuatro por hoja.

    Cada carnet es un dict con: nombre, apellidos, puesto, evento, tipo_sangre,
    contacto_nombre, contacto_relacion, contacto_telefono, numero,
    url_verificacion y, si la hay, foto (bytes).
    """
    memoria = io.BytesIO()
    hoja = landscape(letter)
    pdf = canvas.Canvas(memoria, pagesize=hoja)
    pdf.setTitle(titulo)
    ancho_hoja, alto_hoja = hoja

    ancho_bloque = COLUMNAS * 2 * ANCHO + (COLUMNAS - 1) * HUECO_COLUMNAS
    alto_bloque = FILAS * ALTO + (FILAS - 1) * HUECO_FILAS
    margen_x = (ancho_hoja - ancho_bloque) / 2
    margen_y = (alto_hoja - alto_bloque) / 2
    logo = _logo()

    def instrucciones():
        pdf.setFillColor(GRIS)
        pdf.setFont("Helvetica", 7.5)
        pdf.drawCentredString(
            ancho_hoja / 2, alto_hoja - margen_y / 2 - 2,
            "Recortar por las marcas de corte · Doblar por la línea punteada del centro · Plastificar",
        )

    if not carnets:
        pdf.setFont("Helvetica", 12)
        pdf.drawString(margen_x, alto_hoja - margen_y, "No hay carnets que imprimir")

    por_hoja = COLUMNAS * FILAS
    for indice, carnet in enumerate(carnets):
        posicion = indice % por_hoja
        if posicion == 0:
            if indice:
                pdf.showPage()
            instrucciones()

        columna = posicion % COLUMNAS
        fila = posicion // COLUMNAS
        x = margen_x + columna * (2 * ANCHO + HUECO_COLUMNAS)
        y = alto_hoja - margen_y - (fila + 1) * ALTO - fila * HUECO_FILAS

        _anverso(pdf, carnet, x, y, logo)
        _reverso(pdf, carnet, x + ANCHO, y)
        _marcas_de_corte(pdf, x, y)

    pdf.save()
    memoria.seek(0)
    return memoria
