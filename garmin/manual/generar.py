#!/usr/bin/env python3
"""Genera los manuales, en sus dos sabores.

Piezas de entrada:

    estilos.css                el diseño, compartido por todos los idiomas
    acentos.js                 la recomposición de acentos, compartida
    manual-<idioma>.src.html   el texto, con {{ESTILOS}} y {{GUION}}

Lo compartido está fuera de los fuentes a propósito: son dos manuales que
tienen que verse igual, y con el CSS copiado en cada uno se separan a la
primera corrección que se haga en uno solo.

Y dos salidas, porque son dos destinos con reglas distintas:

    manual-<idioma>.html                 para publicar como Artifact
    ../../frontend/public/garmin/…       para el sitio, backyardultrasantodomingo.com

El de **Artifact** va sin esqueleto —quien lo publica envuelve el contenido en
su propio <head>— y en **ASCII puro**, con cada acento en referencia numérica,
porque esa página se sirve sin declarar juego de caracteres.

El del **sitio** es un documento completo, con su <head> y su charset donde
tiene que estar, así que va en UTF-8 normal. Lleva además los metadatos de
compartir: un manual acaba pegado en un grupo de WhatsApp, y ahí la tarjeta
importa.

`acentos.js` viaja en los dos. En el del sitio no hace nada -el charset llega
a tiempo y el guion se desactiva solo-, y se queda por lo mismo que se escribe
un cinturón teniendo tirantes.

Dentro de <style> las entidades no valen —el navegador no las resuelve ahí—,
así que `estilos.css` tiene que venir ya en ASCII y este script lo comprueba.

    python3 generar.py
"""

import pathlib
import sys

AQUI = pathlib.Path(__file__).parent
SITIO = AQUI.parent.parent / "frontend" / "public" / "garmin"

# Por idioma: la carpeta que le toca en el sitio, el atributo lang, la
# descripcion para buscadores y tarjetas, y como se llama el otro idioma.
IDIOMAS = {
    "es": {
        "carpeta": "",
        "lang": "es",
        "titulo": "Manual de Backyard",
        "descripcion": (
            "Manual completo de Backyard, la app de reloj Garmin para correr "
            "una backyard ultra: ajustes, las seis pantallas, el corral, como "
            "se calcula el margen y que hacer si el reloj se apaga."
        ),
        "otro": ("/garmin/en", "English version"),
    },
    "en": {
        "carpeta": "en",
        "lang": "en",
        "titulo": "Backyard Manual",
        "descripcion": (
            "Full manual for Backyard, the Garmin watch app for running a "
            "backyard ultra: settings, the six screens, the corral, how the "
            "margin is worked out, and what to do if the watch dies."
        ),
        "otro": ("/garmin", "Version en espanol"),
    },
}


def ascii_o_morir(texto, de_donde):
    sobran = sorted({c for c in texto if ord(c) > 127})
    if sobran:
        sys.exit(
            "%s lleva caracteres no ASCII y ahi no valen entidades. "
            "Quitalos: %s" % (de_donde, " ".join(sobran))
        )


def partir(texto):
    """Separa la cabecera (hasta el </style>) del cuerpo."""
    fin = texto.find("</style>")
    if fin < 0:
        sys.exit("No encuentro el bloque de estilos.")
    corte = fin + len("</style>")
    return texto[:corte], texto[corte:]


def para_artifact(cabeza, cuerpo, destino):
    ascii_o_morir(cabeza, destino.name + " (cabecera)")
    entidades = "".join(c if ord(c) < 128 else "&#%d;" % ord(c) for c in cuerpo)
    destino.write_text('<meta charset="utf-8">\n' + cabeza + entidades, encoding="ascii")
    return destino


def para_sitio(cabeza, cuerpo, destino, ficha):
    ruta_otro, nombre_otro = ficha["otro"]
    cuerpo = cuerpo.replace(
        "</footer>",
        '  <span><a href="%s">%s</a></span>\n</footer>' % (ruta_otro, nombre_otro),
        1,
    )
    documento = (
        "<!doctype html>\n"
        '<html lang="%s">\n'
        "<head>\n"
        '<meta charset="utf-8">\n'
        '<meta name="description" content="%s">\n'
        '<meta property="og:type" content="article">\n'
        '<meta property="og:title" content="%s">\n'
        '<meta property="og:description" content="%s">\n'
        '<link rel="icon" href="/favicon.png">\n'
        "%s\n"
        "</head>\n"
        "<body>\n%s\n</body>\n</html>\n"
    ) % (
        ficha["lang"],
        ficha["descripcion"],
        ficha["titulo"],
        ficha["descripcion"],
        cabeza,
        cuerpo.strip("\n"),
    )
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(documento, encoding="utf-8")
    return destino


def main():
    css = (AQUI / "estilos.css").read_text(encoding="utf-8").strip("\n")
    guion = (AQUI / "acentos.js").read_text(encoding="utf-8").strip("\n")
    ascii_o_morir(css, "estilos.css")
    ascii_o_morir(guion, "acentos.js")

    for idioma, ficha in IDIOMAS.items():
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

        cabeza, cuerpo = partir(texto)

        a = para_artifact(cabeza, cuerpo, AQUI / ("manual-%s.html" % idioma))
        b = para_sitio(cabeza, cuerpo, SITIO / ficha["carpeta"] / "index.html", ficha)
        print("%-16s %6d bytes ASCII" % (a.name, a.stat().st_size))
        print("%-16s %6d bytes UTF-8   (%s)"
              % (b.parent.name + "/" + b.name, b.stat().st_size,
                 b.relative_to(AQUI.parent.parent)))


if __name__ == "__main__":
    main()
