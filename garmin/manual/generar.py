#!/usr/bin/env python3
"""Genera el manual publicable a partir del fuente.

El fuente (`manual-es.src.html`) se escribe en UTF-8, como cualquier texto en
español. El publicable (`manual-es.html`) sale en ASCII puro, con cada acento
convertido a referencia numérica.

Por qué: la página se sirve sin declarar juego de caracteres, y el navegador
entonces lee el UTF-8 como Latin-1 y parte cada acento en dos ("CÃ³mo se
calcula"). En ASCII puro no hay nada que malinterpretar, lo declare el
servidor como lo declare.

Los comentarios del CSS son la excepción: ahí las entidades no valen —el
navegador no las resuelve dentro de <style>—, así que se escriben sin acentos
en el propio fuente y este script comprueba que así sea.

    python3 generar.py
"""

import pathlib
import sys

AQUI = pathlib.Path(__file__).parent
FUENTE = AQUI / "manual-es.src.html"
SALIDA = AQUI / "manual-es.html"


def main():
    texto = FUENTE.read_text(encoding="utf-8")

    # El bloque de estilos tiene que venir ya en ASCII: dentro de <style> las
    # referencias numericas se quedan sin resolver y saldrian tal cual.
    fin = texto.find("</style>")
    if fin < 0:
        sys.exit("No encuentro el bloque <style> en el fuente.")
    css = texto[:fin]
    sobran = sorted({c for c in css if ord(c) > 127})
    if sobran:
        sys.exit(
            "El bloque <style> lleva caracteres no ASCII y ahi no valen "
            "entidades. Quitalos del fuente: " + " ".join(sobran)
        )

    cuerpo = "".join(c if ord(c) < 128 else "&#%d;" % ord(c) for c in texto[fin:])
    SALIDA.write_text('<meta charset="utf-8">\n' + css + cuerpo, encoding="ascii")
    print("%s escrito, %d bytes ASCII" % (SALIDA.name, SALIDA.stat().st_size))


if __name__ == "__main__":
    main()
