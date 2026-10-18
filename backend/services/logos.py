"""El aire que trae dentro el archivo de un logo, y como quitarlo.

Un archivo de logo casi nunca viene ajustado a la tinta: trae un margen
propio que va del 0 % al 77 % segun quien lo exporto. Cualquier vitrina
escala el *lienzo* del archivo, no la tinta, asi que en cajas del mismo
tamano un logo sale enorme y el de al lado diminuto. No hay CSS que lo
arregle: lo que esta torcido es el archivo.

La solucion es recortarlo al subirlo. A partir de ahi la proporcion del
archivo ES la proporcion de la tinta, y quien lo pinte puede nivelar por
superficie -misma area optica, no misma altura- sin saber nada mas:

    ancho = raiz(A * r)      alto = raiz(A / r)      r = ancho/alto

Lo que aqui NO se hace es quitar fondos. Si el logo llega opaco se deja
opaco y quien lo pinta le pone una placa. Volver transparente un fondo
plano es una decision de diseno que puede borrar media marca -un escudo
sobre cuadro de color es el fondo y a la vez el logo-, y eso no se
adivina desde un endpoint de subida.
"""

import io
from typing import Optional, Tuple

# Un pixel cuenta como tinta a partir de aqui. El 8 deja fuera el alfa
# residual que sueltan algunos exportadores en todo el lienzo y que, si se
# tomara por tinta, haria que el recorte no quitara nada.
ALFA_MINIMO = 8

# Cuanto se puede alejar del color de la esquina un pixel que sigue siendo
# fondo. Cubre el ruido del JPEG sin comerse un degradado suave.
TOLERANCIA_FONDO = 12

# Las cuatro esquinas tienen que coincidir entre si para dar el fondo por
# uniforme: con una sola esquina, un logo a sangre se recortaria contra su
# propio color.
TOLERANCIA_ESQUINAS = 10

# Y ademas tiene que ser blanco. Un fondo plano de color puede ser la marca
# -un escudo sobre cuadro es a la vez fondo y logo- y recortarlo dejaria solo
# lo de dentro. Blanco es margen; de eso no hay duda razonable.
BLANCO_MINIMO = 242

# Por debajo de esto el recorte no compensa reencodear el archivo: son unos
# pocos pixeles y la proporcion no cambia de forma apreciable.
RECORTE_MINIMO = 0.01


def _esquinas(imagen) -> list:
    ancho, alto = imagen.size
    return [
        imagen.getpixel((0, 0)),
        imagen.getpixel((ancho - 1, 0)),
        imagen.getpixel((0, alto - 1)),
        imagen.getpixel((ancho - 1, alto - 1)),
    ]


def _fondo_uniforme(imagen) -> Optional[tuple]:
    """El color de fondo si las cuatro esquinas coinciden y son blancas."""
    esquinas = _esquinas(imagen.convert("RGB"))
    primera = esquinas[0]
    if min(primera) < BLANCO_MINIMO:
        return None
    for otra in esquinas[1:]:
        if max(abs(a - b) for a, b in zip(primera, otra)) > TOLERANCIA_ESQUINAS:
            return None
    return primera


def caja_de_tinta(imagen) -> Optional[Tuple[int, int, int, int]]:
    """Donde empieza y acaba lo que se ve del logo dentro de su lienzo.

    Con transparencia manda el canal alfa. Sin ella se busca el fondo plano
    de las esquinas y se mide contra el; si el archivo no tiene fondo plano
    no hay nada que recortar y se devuelve None.
    """
    from PIL import Image, ImageChops

    if imagen.mode in ("RGBA", "LA"):
        alfa = imagen.getchannel("A")
        if alfa.getextrema()[0] < 255:
            return alfa.point(lambda v: 255 if v > ALFA_MINIMO else 0).getbbox()

    fondo = _fondo_uniforme(imagen)
    if fondo is None:
        return None

    rgb = imagen.convert("RGB")
    diferencia = ImageChops.difference(rgb, Image.new("RGB", rgb.size, fondo))
    gris = diferencia.convert("L").point(lambda v: 255 if v > TOLERANCIA_FONDO else 0)
    return gris.getbbox()


def es_opaco(imagen) -> bool:
    """True si el archivo no tiene transparencia que lo despegue del papel.

    Quien lo pinte necesita saberlo: un logo opaco sobre un fondo que no sea
    el suyo ensena su rectangulo, y hay que darle una placa.
    """
    if imagen.mode not in ("RGBA", "LA", "P"):
        return True
    if imagen.mode == "P":
        imagen = imagen.convert("RGBA")
    return imagen.getchannel("A").getextrema()[0] >= 255


def recortar(
    contenido: bytes,
    ext_original: str = "png",
    content_type_original: str = "image/png",
) -> Tuple[bytes, str, str, bool]:
    """Quita el aire de alrededor del logo. Devuelve tambien si quedo opaco.

    Si algo falla devuelve el archivo tal como llego: es preferible un logo
    con margen a perder la subida del patrocinador.
    """
    try:
        from PIL import Image, ImageOps

        imagen = ImageOps.exif_transpose(Image.open(io.BytesIO(contenido)))

        # Medir pide RGBA, pero recortar y guardar se hacen sobre el archivo
        # tal como vino. Un PNG de paleta que se pasa a RGBA para guardarlo
        # engorda al triple -son 256 colores escritos como millones-, y eso en
        # una pagina de doce logos se nota mas que el propio recorte.
        medible = imagen.convert("RGBA") if imagen.mode == "P" else imagen

        opaco = es_opaco(medible)
        caja = caja_de_tinta(medible)

        # Lienzo entero en blanco (o casi): no hay logo que encuadrar.
        if not caja:
            return contenido, ext_original, content_type_original, opaco

        izq, arriba, der, abajo = caja
        ancho, alto = imagen.size
        sobra = max(izq, arriba, ancho - der, alto - abajo)
        if sobra <= RECORTE_MINIMO * max(ancho, alto):
            return contenido, ext_original, content_type_original, opaco

        recortada = imagen.crop(caja)

        salida = io.BytesIO()
        if opaco and (ext_original or "").lower() in ("jpg", "jpeg"):
            recortada.convert("RGB").save(
                salida, format="JPEG", quality=90, optimize=True, progressive=True
            )
            return salida.getvalue(), "jpg", "image/jpeg", True

        if recortada.mode not in ("RGBA", "LA", "L", "P"):
            recortada = recortada.convert("RGBA")
        recortada.save(salida, format="PNG", optimize=True)
        return salida.getvalue(), "png", "image/png", opaco

    except Exception:
        return contenido, ext_original, content_type_original, True
