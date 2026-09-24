"""El carnet del staff, en hojas para imprimir.

No toca la base de datos: entran los carnets ya armados y sale el PDF. Se
comprueba lo que se ve al tenerlo en la mano -- que el nombre manda, que un
nombre largo no se sale de la tarjeta -- porque eso es lo que nadie mira dos
veces despues de plastificar cien.
"""
import io
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services import carnet_staff  # noqa: E402


def carnet(nombre="Ana", apellidos="Gómez", puesto="Hidratación y Snacks"):
    return {
        "nombre": nombre,
        "apellidos": apellidos,
        "puesto": puesto,
        "evento": "Backyard Ultra Santo Domingo 2027",
        "tipo_sangre": "O+",
        "contacto_nombre": "María Peña",
        "contacto_relacion": "madre",
        "contacto_telefono": "809 555 1234",
        "numero": "STF-A7K2-M9P4",
        "url_verificacion": "https://backyardultrasantodomingo.com/staff/verificar/A7K2M9P4",
    }


def _textos(pdf: bytes, pagina: int = 0):
    """Cada texto de la pagina como (texto, cuerpo, x, y).

    Reportlab deja el cuerpo unas veces en un bloque suelto y otras dentro del
    mismo bloque que el texto: se mira bloque a bloque guardando el ultimo.
    """
    from PyPDF2 import PdfReader

    flujo = PdfReader(io.BytesIO(pdf)).pages[pagina].get_contents().get_data().decode("latin-1")
    cuerpo = None
    salida = []
    for bloque in re.finditer(r"BT(.*?)ET", flujo, re.S):
        dentro = bloque.group(1)
        cuerpos = re.findall(r"/F\d+ (\d+\.?\d*) Tf", dentro)
        if cuerpos:
            cuerpo = float(cuerpos[-1])
        sitio = re.search(r"1 0 0 1 (-?\d+\.?\d*) (-?\d+\.?\d*) Tm", dentro)
        escrito = re.search(r"\(([^)]*)\) Tj", dentro)
        if sitio and escrito and cuerpo:
            # Los acentos viajan escapados en octal: "G\363mez"
            texto = re.sub(r"\\(\d{3})", lambda m: chr(int(m.group(1), 8)), escrito.group(1))
            salida.append((texto, cuerpo, float(sitio.group(1)), float(sitio.group(2))))
    assert salida, "no se encontro ni un texto en el PDF"
    return salida


def _linea(pdf: bytes, texto: str):
    """La linea que empieza por ese texto: (texto, cuerpo, x, y)."""
    for fila in _textos(pdf):
        if fila[0].startswith(texto):
            return fila
    raise AssertionError(f"no se encontro «{texto}» en el carnet")


def _cuerpo_de(pdf: bytes, texto: str) -> float:
    return _linea(pdf, texto)[1]


def test_cuatro_carnets_por_hoja():
    from PyPDF2 import PdfReader

    salida = carnet_staff.construir_pdf([carnet()] * 5)
    assert len(PdfReader(io.BytesIO(salida.getvalue())).pages) == 2


def test_el_nombre_es_lo_mas_grande_de_la_tarjeta():
    """Un carnet se mira para saber quien es quien, no para leerle el puesto."""
    contenido = carnet_staff.construir_pdf([carnet()]).getvalue()
    cuerpos = [c for _t, c, _x, _y in _textos(contenido)]
    assert _cuerpo_de(contenido, "Ana") == max(cuerpos)


def test_los_apellidos_van_por_debajo_del_nombre():
    contenido = carnet_staff.construir_pdf([carnet()]).getvalue()
    nombre = _cuerpo_de(contenido, "Ana")
    assert _cuerpo_de(contenido, "Gómez") < nombre
    # Y debajo de verdad, no solo mas pequenos
    assert _linea(contenido, "Ana")[3] > _linea(contenido, "Gómez")[3]


def test_un_nombre_largo_se_encoge_en_vez_de_salirse():
    ancho_util = carnet_staff.ANCHO - 6 * carnet_staff.mm
    contenido = carnet_staff.construir_pdf(
        [carnet(nombre="Wellington", apellidos="De la Cruz Buenaventura")]
    ).getvalue()
    assert _cuerpo_de(contenido, "Wellington") < carnet_staff.CUERPO_NOMBRE

    from reportlab.pdfbase import pdfmetrics

    for busca in ("Wellington", "De la Cruz"):
        texto, cuerpo, _x, _y = _linea(contenido, busca)
        assert pdfmetrics.stringWidth(texto, "Helvetica-Bold", cuerpo) <= ancho_util + 1


def test_sin_apellidos_el_carnet_sigue_saliendo():
    """Hay registros con el apellido en blanco; no es motivo para no imprimirlo."""
    salida = carnet_staff.construir_pdf([carnet(apellidos="")])
    assert _cuerpo_de(salida.getvalue(), "Ana") > 0


def test_ya_no_queda_hueco_de_foto():
    """El recuadro nunca tuvo una foto dentro: el registro de voluntario no la pide.

    Lo que salia eran las iniciales en un cuadro de 27 mm, un tercio de la
    tarjeta para decir dos letras. Ese sitio es ahora del nombre.
    """
    contenido = carnet_staff.construir_pdf([carnet(nombre="Ana", apellidos="Gómez")]).getvalue()
    assert not hasattr(carnet_staff, "_iniciales")
    assert "AG" not in [t for t, _c, _x, _y in _textos(contenido)]


def test_sin_carnets_sale_una_hoja_que_lo_dice():
    from PyPDF2 import PdfReader

    salida = carnet_staff.construir_pdf([])
    assert len(PdfReader(io.BytesIO(salida.getvalue())).pages) == 1


# ---------------- La marca que presenta la carrera ----------------


def _imagenes(pdf: bytes):
    """Cada imagen dibujada como su caja (x0, y0, x1, y1)."""
    from PyPDF2 import PdfReader

    flujo = PdfReader(io.BytesIO(pdf)).pages[0].get_contents().get_data().decode("latin-1")
    patron = r"(\d+\.?\d*) 0 0 (\d+\.?\d*) (-?\d+\.?\d*) (-?\d+\.?\d*) cm\s*/\S+ Do"
    return [
        (x, y, x + ancho, y + alto)
        for ancho, alto, x, y in (
            tuple(float(v) for v in m.groups()) for m in re.finditer(patron, flujo)
        )
    ]


def _logo_falso():
    from PIL import Image

    memoria = io.BytesIO()
    Image.new("RGBA", (800, 213), (30, 64, 140, 255)).save(memoria, "PNG")
    return memoria.getvalue()


def con_marca(**extra):
    return carnet(**extra) | {
        "presenting_logo": _logo_falso(),
        "presenting_etiqueta": "PRESENTED BY",
    }


def test_el_carnet_lleva_la_marca_que_presenta_la_carrera():
    contenido = carnet_staff.construir_pdf([con_marca()]).getvalue()
    assert _linea(contenido, "PRESENTED BY")
    # El logo de la carrera arriba, el QR y el de la marca: tres imagenes
    assert len(_imagenes(contenido)) == 3


def test_el_rotulo_va_encima_del_logo_de_la_marca():
    contenido = carnet_staff.construir_pdf([con_marca()]).getvalue()
    rotulo = _linea(contenido, "PRESENTED BY")[3]
    logos = sorted(_imagenes(contenido), key=lambda c: c[1])
    assert logos[0][3] < rotulo, "el logo de la marca deberia quedar debajo del rotulo"


def test_una_edicion_sin_naming_no_pinta_nada():
    """Las ediciones anteriores no llevan marca, y no es un error."""
    contenido = carnet_staff.construir_pdf([carnet()]).getvalue()
    textos = [t for t, _c, _x, _y in _textos(contenido)]
    assert "PRESENTED BY" not in textos
    assert len(_imagenes(contenido)) == 2   # el logo de la carrera y el QR


def test_la_marca_no_se_come_los_datos_del_reverso():
    """Lo ultimo de los datos tiene que quedar por encima del aviso."""
    contenido = carnet_staff.construir_pdf([con_marca()]).getvalue()
    numero = _linea(contenido, "STF-")[3]
    aviso = _linea(contenido, "Personal e intransferible")[3]
    assert numero - aviso > 4 * carnet_staff.mm


def test_el_espaciado_del_rotulo_no_se_pega_al_lienzo():
    """Si se escapa, el texto de despues sale con las letras despegadas."""
    from PyPDF2 import PdfReader

    contenido = carnet_staff.construir_pdf([con_marca()]).getvalue()
    flujo = PdfReader(io.BytesIO(contenido)).pages[0].get_contents().get_data().decode("latin-1")
    for bloque in re.finditer(r"BT(.*?)ET", flujo, re.S):
        if "Tc" in bloque.group(1):
            # Todo bloque con espaciado propio va envuelto en q/Q
            inicio = flujo.rindex("q", 0, bloque.start())
            assert "Q" not in flujo[inicio:bloque.start()]
