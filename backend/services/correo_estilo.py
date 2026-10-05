"""El estilo de los correos del sitio, en un solo sitio.

Piezas sueltas para armar un correo: la envoltura, los encabezados, los datos
que hay que remarcar y los enlaces como boton. Todas devuelven HTML con los
estilos puestos en linea, que es lo unico que respetan los clientes de correo.

El diseno: texto gris sobre blanco, sin recuadros ni cajas de colores. Los
titulos y los datos van en negro y **sin negrita**: lo que los destaca es el
color y el tamano, no el peso. Lo que separa una seccion de otra es el aire y,
como mucho, una linea fina. Los enlaces van en azul; los que hay que pulsar son
botones azules, bajos, con la letra en blanco.

Ancho, tamano y colores estan pensados para leerse en el telefono, que es donde
se abre casi todo: cuerpo de 17px e interlineado ancho.

**Las plantillas se guardan en la base con su HTML ya montado**, asi que cambiar
este modulo no cambia nada de lo que ya se sembro. Por eso cada diseno queda
aqui como un `Tema`, y `al_dia()` traduce el HTML armado con el anterior al de
hoy. Se aplica al rendir cualquier plantilla (`render_template`) y al servirlas
al panel, de modo que un cambio de diseno llega a todos los correos sin tocar
la base.
"""
import re
from typing import Dict, Iterable, NamedTuple, Optional

# La familia de siempre en correo: cada sistema cae en la suya y ninguna
# depende de que el cliente descargue nada.
FUENTE = ("-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, "
          "'Helvetica Neue', Helvetica, Arial, sans-serif")

ANCHO = 600
FONDO = "#ffffff"


class Tema(NamedTuple):
    """Lo que distingue un diseno de otro. El esqueleto —margenes, tamanos de
    letra— es el mismo; cambian los colores, los pesos y el boton."""
    titulo: str            # encabezados y datos que hay que encontrar
    texto: str             # el cuerpo
    apagado: str           # lo secundario: pies, aclaraciones
    linea: str             # las lineas finas
    boton: str             # el fondo de los botones, con la letra en blanco
    enlace: str            # los enlaces dentro del texto
    enlace_pie: str        # el enlace del pie
    subrayado: str         # `text-decoration` de los enlaces
    peso_titulo: int
    peso_valor: int        # el valor de `dato()` y de `linea()`
    peso_cifra: int        # `cifra()` y `codigo()`
    boton_relleno: str
    boton_letra: str
    boton_peso: int
    valor_con_color: bool  # si el valor de `linea()` lleva su propio color


# Hasta el 5 de octubre de 2026: todo en negro, titulos en negrita, botones
# negros y altos, enlaces del color del texto y subrayados.
TEMA_2026_09 = Tema(
    titulo="#1d1d1f", texto="#1d1d1f", apagado="#6e6e73", linea="#d2d2d7",
    boton="#000000", enlace="#1d1d1f", enlace_pie="#6e6e73", subrayado="underline",
    peso_titulo=700, peso_valor=600, peso_cifra=700,
    boton_relleno="14px 28px", boton_letra="16px", boton_peso=600,
    valor_con_color=False,
)

# Desde entonces: cuerpo en gris, titulos y datos en negro sin negrita, botones
# azules y bajos, enlaces en azul.
TEMA_ACTUAL = Tema(
    titulo="#1d1d1f", texto="#424245", apagado="#6e6e73", linea="#d2d2d7",
    boton="#0071e3", enlace="#0066cc", enlace_pie="#0066cc", subrayado="none",
    peso_titulo=400, peso_valor=400, peso_cifra=400,
    boton_relleno="9px 22px", boton_letra="15px", boton_peso=400,
    valor_con_color=True,
)

# Los nombres de siempre, para quien arma HTML a mano fuera de este modulo.
TINTA = TEMA_ACTUAL.titulo      # titulos y datos
TEXTO = TEMA_ACTUAL.texto       # el cuerpo
APAGADO = TEMA_ACTUAL.apagado
LINEA = TEMA_ACTUAL.linea
BOTON = TEMA_ACTUAL.boton
ENLACE = TEMA_ACTUAL.enlace

# Los tres tamanos de `cifra()`, con su espaciado.
_CIFRAS = (("26px", "-0.015em"), ("22px", "normal"), ("19px", "normal"))


def _estilos(t: Tema) -> Dict[str, str]:
    """El `style` de cada pieza con un tema dado.

    Es la unica definicion de cada estilo: las piezas de abajo la leen con el
    tema de hoy, y `al_dia()` la lee con el anterior para saber que buscar.
    Solo estan aqui los que cambian de un tema a otro o podrian cambiar; los
    margenes sueltos de un contenedor van escritos en su pieza.
    """
    valor_linea = f"font-weight: {t.peso_valor};"
    if t.valor_con_color:
        valor_linea += f" color: {t.titulo};"
    estilos = {
        "h1": (f"margin: 0 0 20px 0; font-size: 25px; line-height: 1.3; "
               f"font-weight: {t.peso_titulo}; letter-spacing: -0.02em; color: {t.titulo};"),
        "h2": (f"margin: 32px 0 12px 0; font-size: 19px; line-height: 1.3; "
               f"font-weight: {t.peso_titulo}; color: {t.titulo};"),
        "p": f"margin: 0 0 16px 0; font-size: 17px; line-height: 1.6; color: {t.texto};",
        "p_apagado": f"margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: {t.apagado};",
        "dato_valor": f"font-size: 17px; color: {t.titulo}; font-weight: {t.peso_valor};",
        "linea": f"margin: 0 0 8px 0; font-size: 17px; line-height: 1.5; color: {t.texto};",
        "linea_valor": valor_linea,
        "lista": (f"margin: 0 0 16px 0; padding-left: 22px; font-size: 17px; "
                  f"line-height: 1.6; color: {t.texto};"),
        "boton_a": (f"display: inline-block; padding: {t.boton_relleno}; font-family: {FUENTE}; "
                    f"font-size: {t.boton_letra}; font-weight: {t.boton_peso}; color: #ffffff; "
                    f"text-decoration: none; border-radius: 8px;"),
        "codigo": (f"margin: 0 0 20px 0; font-size: 27px; font-weight: {t.peso_cifra}; "
                   f"letter-spacing: 0.32em; color: {t.titulo}; line-height: 1.3;"),
        "enlace": f"color: {t.enlace}; text-decoration: {t.subrayado};",
        "enlace_pie": f"color: {t.enlace_pie}; text-decoration: {t.subrayado};",
        "fragmento": (f"max-width: {ANCHO}px; margin: 0 auto; padding: 40px 20px; font-family: {FUENTE}; "
                      f"color: {t.texto}; font-size: 17px; line-height: 1.6; text-align: left; "
                      f"background-color: {FONDO};"),
        "documento": (f"font-family: {FUENTE}; color: {t.texto}; font-size: 17px; "
                      f"line-height: 1.6; text-align: left;"),
    }
    for tamano, espaciado in _CIFRAS:
        estilos[f"cifra_{tamano}"] = (
            f"display: block; font-size: {tamano}; font-weight: {t.peso_cifra}; "
            f"letter-spacing: {espaciado}; color: {t.titulo};"
        )
    return estilos


E = _estilos(TEMA_ACTUAL)


def h1(texto: str) -> str:
    """El asunto del correo, dentro del correo. Uno por correo."""
    return f'<h1 style="{E["h1"]}">{texto}</h1>'


def h2(texto: str) -> str:
    """Encabezado de seccion. En negro sobre el gris del texto, que es lo que
    se busca al repasar."""
    return f'<h2 style="{E["h2"]}">{texto}</h2>'


def p(texto: str, apagado: bool = False) -> str:
    return f'<p style="{E["p_apagado" if apagado else "p"]}">{texto}</p>'


def dato(etiqueta: str, valor: str) -> str:
    """Un dato que hay que poder encontrar de un vistazo: etiqueta pequena y
    apagada, valor grande y en negro. Sin recuadro."""
    return (f'<p style="margin: 0 0 14px 0; line-height: 1.45;">'
            f'<span style="display: block; font-size: 13px; color: {APAGADO};">{etiqueta}</span>'
            f'<strong style="{E["dato_valor"]}">{valor}</strong>'
            f'</p>')


def linea(etiqueta: str, valor: str) -> str:
    """Dato de una sola linea, «Etiqueta: valor», con el valor remarcado."""
    return (f'<p style="{E["linea"]}">'
            f'{etiqueta}: <strong style="{E["linea_valor"]}">{valor}</strong></p>')


def lista(items: Iterable[str]) -> str:
    puntos = "".join(
        f'<li style="margin: 0 0 8px 0; padding: 0;">{i}</li>' for i in items
    )
    return f'<ul style="{E["lista"]}">{puntos}</ul>'


def boton(texto: str, url: str) -> str:
    """Enlace como boton. En tabla y con el relleno en el <a>: es lo unico que
    pinta bien en Outlook, que ignora el padding de los div."""
    return f"""
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 8px 0 24px 0;">
                <tr>
                    <td align="center" bgcolor="{BOTON}" style="border-radius: 8px;">
                        <a href="{url}" style="{E["boton_a"]}">{texto}</a>
                    </td>
                </tr>
            </table>"""


# El fondo del boton dentro de un HTML ya armado. Es el mismo trozo que
# escribe `boton()`, y se busca entero -no el color suelto- para no tocar
# ningun otro `bgcolor` que pueda haber en el correo.
_FONDO_DEL_BOTON = re.compile(
    r'(<td align="center" bgcolor=")#[0-9A-Fa-f]{6}(" style="border-radius: 8px;">)'
)


def recolorear_botones(html: str) -> str:
    """Pone el color de boton de hoy en un HTML que se armo con el de ayer.

    Las plantillas se guardan en la base con su HTML ya montado, y el
    sembrado solo inserta las que faltan: nunca reescribe una que ya existe.
    Asi que cambiar `BOTON` aqui no cambia nada de lo que ya se sembro, y los
    correos siguen saliendo del color viejo sin que nada falle ni avise. Esto
    es lo que pone al dia el fondo, sea cual sea el color con el que se
    guardo; el resto del diseno lo pone `al_dia()`.
    """
    return _FONDO_DEL_BOTON.sub(rf"\g<1>{BOTON}\g<2>", html or "")


def _traduccion() -> Dict[str, str]:
    """De cada `style` del tema anterior al de hoy, para los que cambian."""
    antes = _estilos(TEMA_2026_09)
    return {
        f'style="{antes[pieza]}"': f'style="{E[pieza]}"'
        for pieza in antes
        if antes[pieza] != E[pieza]
    }


_TRADUCCION = _traduccion()


def al_dia(html: str) -> str:
    """Pasa al diseno de hoy un HTML armado con el anterior.

    Busca los `style` enteros que escribian las piezas de este modulo y los
    cambia por los de hoy; lo demas —el texto, lo que se haya editado a mano
    desde el panel, cualquier HTML que no saliera de aqui— se queda igual. Es
    idempotente: sobre un HTML ya al dia no encuentra nada que cambiar.
    """
    html = recolorear_botones(html)
    for viejo, nuevo in _TRADUCCION.items():
        if viejo in html:
            html = html.replace(viejo, nuevo)
    return html


def cifra(etiqueta: str, valor: str) -> str:
    """El dato que es el correo entero: el numero de corredor, el monto, las
    vueltas. Grande y sin caja; el tamano ya lo destaca.

    Destacar no es gritar: el salto sobre el texto (17px) es corto a proposito,
    y lo que separa el dato es el negro y el aire, no el tamano. El largo del
    valor lo baja todavia mas, porque una frase a cuerpo grande parte en varias
    lineas. Se decide aqui y no en cada plantilla para que no dependa de que
    quien la escriba se acuerde.
    """
    # En las plantillas guardadas el valor todavia es "{{payment_amount}}", que
    # es largo y no se parece a lo que vera el lector. Cada marcador cuenta como
    # un valor corto, que es lo que suele acabar puesto ahi.
    largo = len(re.sub(r"\{\{[a-z_]+\}\}", "000000", valor))
    if largo <= 8:
        tamano = "26px"
    elif largo <= 16:
        tamano = "22px"
    else:
        tamano = "19px"
    return (f'<p style="margin: 0 0 24px 0; line-height: 1.2;">'
            f'<span style="display: block; margin-bottom: 6px; font-size: 13px; color: {APAGADO};">{etiqueta}</span>'
            f'<span style="{E[f"cifra_{tamano}"]}">{valor}</span>'
            f'</p>')


def codigo(valor: str) -> str:
    """Un codigo de un solo uso. Se copia a mano, asi que va grande y separado."""
    return f'<p style="{E["codigo"]}">{valor}</p>'


def enlace(texto: str, url: str) -> str:
    """Enlace dentro del texto: en azul, que es como se reconoce un enlace."""
    return f'<a href="{url}" style="{E["enlace"]}">{texto}</a>'


def separador() -> str:
    return f'<hr style="border: 0; border-top: 1px solid {LINEA}; margin: 32px 0;">'


def nota(texto: str) -> str:
    """Letra pequena: aclaraciones, condiciones, «si no fuiste tu...»."""
    return (f'<p style="margin: 0 0 12px 0; font-size: 14px; line-height: 1.55; '
            f'color: {APAGADO};">{texto}</p>')


def _cabecera() -> str:
    """La marca escrita, no dibujada: media bandeja bloquea las imagenes y un
    logo cargado a medias deja el correo empezando por un hueco. Es lo unico
    que conserva la negrita: es el logotipo, no un titulo."""
    return f"""
                        <p style="margin: 0 0 40px 0; line-height: 1.3;">
                            <span style="display: block; font-size: 17px; font-weight: 700; letter-spacing: 0.04em; color: {TINTA};">BACKYARD ULTRA</span>
                            <span style="display: block; font-size: 13px; letter-spacing: 0.18em; color: {APAGADO};">SANTO DOMINGO</span>
                        </p>"""


def _pie(extra: Optional[str] = None, con_marca: bool = True) -> str:
    """El pie. `con_marca` se apaga cuando despues del correo se pega la banda
    del patrocinador (`marca.bloque_html()`), para no nombrarlo dos veces."""
    sitio = "backyardultrasantodomingo.com"
    presenta = " · Presented by CEDIMAT" if con_marca else ""
    return f"""
                        <hr style="border: 0; border-top: 1px solid {LINEA}; margin: 40px 0 20px 0;">
                        <p style="margin: 0 0 6px 0; font-size: 13px; line-height: 1.6; color: {APAGADO};">
                            Backyard Ultra Santo Domingo{presenta}<br>
                            <a href="https://{sitio}" style="{E["enlace_pie"]}">{sitio}</a>
                        </p>
                        {extra or ""}"""


def fragmento(contenido: str, pie_extra: Optional[str] = None) -> str:
    """La misma pinta, pero como <div> suelto en vez de documento entero.

    Es lo que necesitan las plantillas que se guardan en la base y se mandan
    con `send_templated_email`, que les pega detras la banda del patrocinador:
    si fueran un documento completo, esa banda caeria despues de </html>.
    """
    return f"""
<div style="{E["fragmento"]}">
{_cabecera()}
{contenido}
{_pie(pie_extra, con_marca=False)}
</div>"""


def documento(contenido: str, preheader: str = "", pie_extra: Optional[str] = None) -> str:
    """Envuelve el contenido en el correo completo.

    `preheader` es la linea que la bandeja de entrada ensena junto al asunto;
    va oculta en el cuerpo. Si no se pasa, el cliente ensena el principio del
    texto, que suele ser el saludo y no dice nada.
    """
    oculto = ""
    if preheader:
        oculto = (f'<div style="display: none; max-height: 0; overflow: hidden; '
                  f'opacity: 0; color: transparent; height: 0; width: 0;">{preheader}</div>')

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light only">
</head>
<body style="margin: 0; padding: 0; background-color: {FONDO}; -webkit-font-smoothing: antialiased;">
    {oculto}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: {FONDO}; border-collapse: collapse;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" width="{ANCHO}" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: {ANCHO}px; border-collapse: collapse;">
                    <tr>
                        <td style="{E["documento"]}">
{_cabecera()}
{contenido}
{_pie(pie_extra)}
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>"""
