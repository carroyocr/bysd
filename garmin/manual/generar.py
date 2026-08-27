#!/usr/bin/env python3
"""Genera los manuales publicables a partir de sus fuentes.

Piezas:

    estilos.css           el diseño, compartido por todos los idiomas
    acentos.js            la recomposición de acentos, compartida
    manual-<idioma>.src.html  el texto, con {{ESTILOS}} y {{GUION}}
    manual-<idioma>.html      lo que se publica

Lo compartido está fuera de los fuentes a propósito: son dos manuales que
tienen que verse igual, y con el CSS copiado en cada uno se separan a la
primera corrección que se haga en uno solo.

Los fuentes se escriben en UTF-8, como cualquier texto. El publicable sale en
ASCII puro, con cada acento convertido a referencia numérica: la página se
sirve sin declarar juego de caracteres, y así no hay nada que malinterpretar.
(El navegador igualmente decodifica esas referencias y vuelve a servirlas mal,
y para eso está `acentos.js`; las entidades cubren el caso de que algún día no
haga falta.)

Dentro de <style> las entidades no valen —el navegador no las resuelve ahí—,
así que `estilos.css` tiene que venir ya en ASCII y este script lo comprueba.

    python3 generar.py
"""

import pathlib
import sys

AQUI = pathlib.Path(__file__).parent
IDIOMAS = ["es", "en"]


def ascii_o_morir(texto, de_donde):
    sobran = sorted({c for c in texto if ord(c) > 127})
    if sobran:
        sys.exit(
            "%s lleva caracteres no ASCII y ahi no valen entidades. "
            "Quitalos: %s" % (de_donde, " ".join(sobran))
        )


def main():
    css = (AQUI / "estilos.css").read_text(encoding="utf-8").strip("\n")
    guion = (AQUI / "acentos.js").read_text(encoding="utf-8").strip("\n")
    ascii_o_morir(css, "estilos.css")
    ascii_o_morir(guion, "acentos.js")

    for idioma in IDIOMAS:
        fuente = AQUI / ("manual-%s.src.html" % idioma)
        if not fuente.exists():
            print("(sin fuente para %s, se salta)" % idioma)
            continue

        texto = fuente.read_text(encoding="utf-8")
        for marca in ("{{ESTILOS}}", "{{GUION}}"):
            if marca not in texto:
                sys.exit("%s no tiene la marca %s." % (fuente.name, marca))

        texto = texto.replace("{{ESTILOS}}", "<style>\n%s\n</style>" % css)
        texto = texto.replace("{{GUION}}", "<script>\n%s\n</script>" % guion)

        # El <style> ya viene comprobado; el resto pasa a referencias numericas.
        fin = texto.find("</style>")
        cabeza = texto[:fin]
        ascii_o_morir(cabeza, "%s (antes de </style>)" % fuente.name)
        cuerpo = "".join(c if ord(c) < 128 else "&#%d;" % ord(c) for c in texto[fin:])

        salida = AQUI / ("manual-%s.html" % idioma)
        salida.write_text('<meta charset="utf-8">\n' + cabeza + cuerpo, encoding="ascii")
        print("%s escrito, %d bytes ASCII" % (salida.name, salida.stat().st_size))


if __name__ == "__main__":
    main()
