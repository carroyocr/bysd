"""El recorte del aire que trae dentro el archivo de un logo."""

import io

import pytest
from PIL import Image

from services import logos


def _png(imagen) -> bytes:
    buf = io.BytesIO()
    imagen.save(buf, format="PNG")
    return buf.getvalue()


def _jpg(imagen) -> bytes:
    buf = io.BytesIO()
    imagen.convert("RGB").save(buf, format="JPEG", quality=95)
    return buf.getvalue()


def _con_margen_transparente(tinta=(40, 20), lienzo=(400, 400)):
    """Una mancha opaca centrada en un lienzo mayormente transparente."""
    imagen = Image.new("RGBA", lienzo, (0, 0, 0, 0))
    mancha = Image.new("RGBA", tinta, (200, 30, 30, 255))
    imagen.paste(mancha, ((lienzo[0] - tinta[0]) // 2, (lienzo[1] - tinta[1]) // 2))
    return imagen


def _con_margen_blanco(tinta=(40, 20), lienzo=(400, 400)):
    imagen = Image.new("RGB", lienzo, (255, 255, 255))
    mancha = Image.new("RGB", tinta, (10, 10, 10))
    imagen.paste(mancha, ((lienzo[0] - tinta[0]) // 2, (lienzo[1] - tinta[1]) // 2))
    return imagen


def _medidas(contenido):
    return Image.open(io.BytesIO(contenido)).size


# --- caja_de_tinta -----------------------------------------------------


def test_caja_de_tinta_encuentra_la_mancha_transparente():
    caja = logos.caja_de_tinta(_con_margen_transparente())
    assert caja == (180, 190, 220, 210)


def test_caja_de_tinta_encuentra_la_mancha_sobre_fondo_blanco():
    caja = logos.caja_de_tinta(_con_margen_blanco())
    assert caja == (180, 190, 220, 210)


def test_caja_de_tinta_sin_fondo_plano_no_recorta():
    """Un degradado no tiene fondo que quitar: mejor no tocar el archivo."""
    imagen = Image.new("RGB", (100, 100))
    for x in range(100):
        for y in range(100):
            imagen.putpixel((x, y), (x * 2, y * 2, 128))
    assert logos.caja_de_tinta(imagen) is None


def test_caja_de_tinta_lienzo_vacio_devuelve_none():
    assert logos.caja_de_tinta(Image.new("RGBA", (50, 50), (0, 0, 0, 0))) is None


def test_el_alfa_residual_no_cuenta_como_tinta():
    """Algunos exportadores dejan un alfa de 1-2 en todo el lienzo."""
    imagen = _con_margen_transparente()
    ruido = Image.new("RGBA", imagen.size, (0, 0, 0, 3))
    ruido.paste(imagen, (0, 0), imagen)
    assert logos.caja_de_tinta(ruido) == (180, 190, 220, 210)


# --- es_opaco ----------------------------------------------------------


def test_es_opaco_distingue_el_png_recortado_del_jpg():
    assert logos.es_opaco(_con_margen_transparente()) is False
    assert logos.es_opaco(_con_margen_blanco()) is True


def test_un_png_sin_transparencia_real_cuenta_como_opaco():
    imagen = Image.new("RGBA", (30, 30), (255, 255, 255, 255))
    assert logos.es_opaco(imagen) is True


# --- recortar ----------------------------------------------------------


def test_recortar_deja_el_archivo_al_tamano_de_la_tinta():
    contenido, ext, tipo, opaco = logos.recortar(_png(_con_margen_transparente()))
    assert _medidas(contenido) == (40, 20)
    assert (ext, tipo) == ("png", "image/png")
    assert opaco is False


def test_recortar_conserva_la_transparencia():
    contenido, _, _, _ = logos.recortar(_png(_con_margen_transparente()))
    assert Image.open(io.BytesIO(contenido)).mode in ("RGBA", "LA")


def test_recortar_un_jpg_sigue_siendo_jpg_y_opaco():
    contenido, ext, tipo, opaco = logos.recortar(
        _jpg(_con_margen_blanco()), "jpg", "image/jpeg"
    )
    assert _medidas(contenido) == (40, 20)
    assert (ext, tipo) == ("jpg", "image/jpeg")
    assert opaco is True


def test_la_proporcion_del_archivo_pasa_a_ser_la_de_la_tinta():
    """Es el punto de todo esto: nivelar por superficie necesita el ratio real."""
    contenido, _, _, _ = logos.recortar(_png(_con_margen_transparente((60, 20))))
    ancho, alto = _medidas(contenido)
    assert ancho / alto == pytest.approx(3.0)


def test_un_png_de_paleta_sigue_siendo_de_paleta():
    """Pasarlo a RGBA lo engorda al triple, y son doce logos en la misma pagina."""
    paleta = _con_margen_transparente().convert("P", palette=Image.ADAPTIVE, colors=64)
    contenido, _, _, _ = logos.recortar(_png(paleta))
    salida = Image.open(io.BytesIO(contenido))
    assert salida.mode == "P"
    assert salida.size == (40, 20)


def test_un_logo_ya_ajustado_no_se_reencoda():
    original = _png(_con_margen_transparente(tinta=(40, 20), lienzo=(40, 20)))
    contenido, ext, tipo, _ = logos.recortar(original)
    assert contenido == original


def test_un_margen_de_un_pixel_no_justifica_reencodear():
    original = _png(_con_margen_transparente(tinta=(398, 398), lienzo=(400, 400)))
    contenido, _, _, _ = logos.recortar(original)
    assert contenido == original


def test_un_archivo_ilegible_se_devuelve_tal_cual():
    contenido, ext, tipo, opaco = logos.recortar(b"esto no es una imagen", "png", "image/png")
    assert contenido == b"esto no es una imagen"
    assert (ext, tipo) == ("png", "image/png")
    assert opaco is True


def test_un_fondo_plano_de_color_no_se_recorta():
    """Un escudo sobre cuadro es a la vez fondo y marca: recortarlo lo destruye."""
    imagen = Image.new("RGB", (200, 100), (10, 60, 120))
    imagen.paste(Image.new("RGB", (40, 40), (255, 255, 255)), (80, 30))
    original = _png(imagen)
    contenido, _, _, opaco = logos.recortar(original)
    assert contenido == original
    assert opaco is True


def test_no_se_quitan_fondos():
    """El blanco se recorta, pero el que queda dentro del recorte se respeta."""
    imagen = Image.new("RGB", (200, 100), (255, 255, 255))
    imagen.paste(Image.new("RGB", (60, 40), (10, 60, 120)), (20, 30))
    imagen.paste(Image.new("RGB", (10, 10), (255, 255, 255)), (45, 45))
    contenido, _, _, opaco = logos.recortar(_png(imagen))
    salida = Image.open(io.BytesIO(contenido)).convert("RGB")
    assert opaco is True
    assert salida.size == (60, 40)
    # El hueco blanco de dentro sigue ahi: no se ha vuelto transparente.
    assert salida.getpixel((30, 20)) == (255, 255, 255)
