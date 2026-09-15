"""Los tickets de comida, en hojas para imprimir y recortar.

Se le entregan al voluntario junto con su camiseta: cada ticket dice que le
toca, a que hora y donde trabaja, y se canjea en la mesa de comida. Van
agrupados por persona, para poder recortar el juego completo de una.

Aqui no se habla con la base de datos: entran las raciones ya calculadas y sale
el PDF, para poder probarlo sin levantar nada.
"""
import io

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

NARANJA = HexColor("#E8772E")
GRIS = HexColor("#6B7280")
LINEA = HexColor("#9CA3AF")

# Rejilla de la hoja carta: dos columnas por cinco filas, diez tickets
COLUMNAS = 2
FILAS = 5
MARGEN = 36  # media pulgada

NOMBRE_TIPO = {
    "refrigerio": "REFRIGERIO",
    "desayuno": "DESAYUNO",
    "almuerzo": "ALMUERZO",
    "cena": "CENA",
}


def preparar(entregas: list) -> list:
    """Una racion, un ticket: ordenados por persona y numerados.

    Las entregas vienen agrupadas (quien recoge dos refrigerios en la misma
    mesa es una sola linea de dos), pero cada ticket se canjea por una racion,
    asi que se reparten en tantos tickets como raciones.
    """
    sueltos = []
    for entrega in entregas:
        for _ in range(entrega.get("cantidad", 1)):
            sueltos.append({
                "nombre": entrega.get("nombre", ""),
                "tipo": entrega.get("tipo", ""),
                "dia": entrega.get("dia", ""),
                "hora": entrega.get("hora", ""),
                "puesto": entrega.get("puesto", ""),
                "turno": entrega.get("turno", ""),
                "horario_turno": entrega.get("horario_turno", ""),
            })

    sueltos.sort(key=lambda t: (t["nombre"].lower(), t["dia"], t["hora"], t["tipo"]))
    for numero, ticket in enumerate(sueltos, start=1):
        ticket["numero"] = numero
    return sueltos


def _recortar(pdf, texto: str, fuente: str, tamano: float, ancho: float) -> str:
    """Corta el texto que no cabe en el ticket y lo deja con puntos suspensivos."""
    if pdf.stringWidth(texto, fuente, tamano) <= ancho:
        return texto
    while texto and pdf.stringWidth(texto + "…", fuente, tamano) > ancho:
        texto = texto[:-1]
    return texto + "…"


def _dibujar_ticket(pdf, ticket: dict, x: float, y: float, ancho: float, alto: float, evento: str):
    """Un ticket dentro de su recuadro, con (x, y) en la esquina inferior izquierda."""
    pdf.setDash(2, 2)
    pdf.setStrokeColor(LINEA)
    pdf.setLineWidth(0.5)
    pdf.rect(x, y, ancho, alto)
    pdf.setDash()

    izquierda = x + 12
    util = ancho - 24
    arriba = y + alto - 16

    pdf.setFillColor(GRIS)
    pdf.setFont("Helvetica", 7)
    pdf.drawString(izquierda, arriba, _recortar(pdf, evento.upper(), "Helvetica", 7, util - 40))
    pdf.drawRightString(x + ancho - 12, arriba, f"#{ticket['numero']:04d}")

    pdf.setFillColor(NARANJA)
    pdf.setFont("Helvetica-Bold", 17)
    pdf.drawString(izquierda, arriba - 22, NOMBRE_TIPO.get(ticket["tipo"], ticket["tipo"].upper()))

    pdf.setFillColor(HexColor("#111827"))
    pdf.setFont("Helvetica-Bold", 15)
    pdf.drawRightString(x + ancho - 12, arriba - 22, ticket["hora"])
    pdf.setFont("Helvetica", 8)
    pdf.setFillColor(GRIS)
    pdf.drawRightString(x + ancho - 12, arriba - 33, ticket["dia"])

    pdf.setFillColor(HexColor("#111827"))
    pdf.setFont("Helvetica-Bold", 11)
    pdf.drawString(izquierda, arriba - 52, _recortar(pdf, ticket["nombre"], "Helvetica-Bold", 11, util))

    pdf.setFillColor(GRIS)
    pdf.setFont("Helvetica", 8)
    puesto = ticket["puesto"] or ""
    if ticket["turno"] or ticket["horario_turno"]:
        puesto = f"{puesto} · Turno {ticket['turno']} {ticket['horario_turno']}".strip()
    pdf.drawString(izquierda, arriba - 65, _recortar(pdf, puesto, "Helvetica", 8, util))

    pdf.setFont("Helvetica-Oblique", 7)
    pdf.drawString(izquierda, y + 10, "Presenta este ticket en la mesa de comida")


def construir_pdf(tickets: list, evento: str = "") -> io.BytesIO:
    """Devuelve el PDF con todos los tickets, diez por hoja."""
    memoria = io.BytesIO()
    pdf = canvas.Canvas(memoria, pagesize=letter)
    pdf.setTitle("Tickets de alimentación — Voluntarios")

    ancho_hoja, alto_hoja = letter
    ancho = (ancho_hoja - 2 * MARGEN) / COLUMNAS
    alto = (alto_hoja - 2 * MARGEN) / FILAS

    if not tickets:
        pdf.setFont("Helvetica", 12)
        pdf.drawString(MARGEN, alto_hoja - MARGEN - 20, "No hay raciones que imprimir")

    for indice, ticket in enumerate(tickets):
        posicion = indice % (COLUMNAS * FILAS)
        if indice and posicion == 0:
            pdf.showPage()

        columna = posicion % COLUMNAS
        fila = posicion // COLUMNAS
        x = MARGEN + columna * ancho
        y = alto_hoja - MARGEN - (fila + 1) * alto
        _dibujar_ticket(pdf, ticket, x, y, ancho, alto, evento)

    pdf.save()
    memoria.seek(0)
    return memoria
