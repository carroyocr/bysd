"""El estilo de los correos del sitio, en un solo sitio.

Piezas sueltas para armar un correo: la envoltura, los encabezados, los datos
que hay que remarcar y los enlaces como boton. Todas devuelven HTML con los
estilos puestos en linea, que es lo unico que respetan los clientes de correo.

El diseno: texto sobre blanco, sin recuadros ni cajas de colores. Lo que separa
una seccion de otra es el aire y, como mucho, una linea fina. La informacion que
importa va en negrita dentro del propio texto, no metida en una tabla gris. Los
enlaces que hay que pulsar son botones; los demas van subrayados y en el texto.

Ancho, tamano y colores estan pensados para leerse en el telefono, que es donde
se abre casi todo: cuerpo de 17px, interlineado ancho y un solo color de acento.
"""
import re
from typing import Iterable, Optional

# La familia de siempre en correo: cada sistema cae en la suya y ninguna
# depende de que el cliente descargue nada.
FUENTE = ("-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, "
          "'Helvetica Neue', Helvetica, Arial, sans-serif")

TINTA = "#1d1d1f"        # el texto
APAGADO = "#6e6e73"      # lo secundario: pies, aclaraciones
LINEA = "#d2d2d7"        # las lineas finas
ACENTO = "#E8772E"       # el naranja de la marca: botones y poco mas
FONDO = "#ffffff"

ANCHO = 600


def h1(texto: str) -> str:
    """El asunto del correo, dentro del correo. Uno por correo."""
    return (f'<h1 style="margin: 0 0 20px 0; font-size: 28px; line-height: 1.25; '
            f'font-weight: 700; letter-spacing: -0.02em; color: {TINTA};">{texto}</h1>')


def h2(texto: str) -> str:
    """Encabezado de seccion. En negrita, que es lo que se busca al repasar."""
    return (f'<h2 style="margin: 32px 0 12px 0; font-size: 19px; line-height: 1.3; '
            f'font-weight: 700; color: {TINTA};">{texto}</h2>')


def p(texto: str, apagado: bool = False) -> str:
    color = APAGADO if apagado else TINTA
    tamano = "15px" if apagado else "17px"
    return (f'<p style="margin: 0 0 16px 0; font-size: {tamano}; line-height: 1.6; '
            f'color: {color};">{texto}</p>')


def dato(etiqueta: str, valor: str) -> str:
    """Un dato que hay que poder encontrar de un vistazo: etiqueta pequena y
    apagada, valor grande y en negrita. Sin recuadro."""
    return (f'<p style="margin: 0 0 14px 0; line-height: 1.45;">'
            f'<span style="display: block; font-size: 13px; color: {APAGADO};">{etiqueta}</span>'
            f'<strong style="font-size: 17px; color: {TINTA}; font-weight: 600;">{valor}</strong>'
            f'</p>')


def linea(etiqueta: str, valor: str) -> str:
    """Dato de una sola linea, «Etiqueta: valor», con el valor remarcado."""
    return (f'<p style="margin: 0 0 8px 0; font-size: 17px; line-height: 1.5; color: {TINTA};">'
            f'{etiqueta}: <strong style="font-weight: 600;">{valor}</strong></p>')


def lista(items: Iterable[str]) -> str:
    puntos = "".join(
        f'<li style="margin: 0 0 8px 0; padding: 0;">{i}</li>' for i in items
    )
    return (f'<ul style="margin: 0 0 16px 0; padding-left: 22px; font-size: 17px; '
            f'line-height: 1.6; color: {TINTA};">{puntos}</ul>')


def boton(texto: str, url: str) -> str:
    """Enlace como boton. En tabla y con el relleno en el <a>: es lo unico que
    pinta bien en Outlook, que ignora el padding de los div."""
    return f"""
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 8px 0 24px 0;">
                <tr>
                    <td align="center" bgcolor="{ACENTO}" style="border-radius: 8px;">
                        <a href="{url}" style="display: inline-block; padding: 14px 28px; font-family: {FUENTE}; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">{texto}</a>
                    </td>
                </tr>
            </table>"""


def cifra(etiqueta: str, valor: str) -> str:
    """El dato que es el correo entero: el numero de corredor, el monto, las
    vueltas. Grande y sin caja; el tamano ya lo destaca.

    El tamano sale del largo del valor. Un numero corto aguanta 44px, pero una
    frase ("8:00 a. m. a 12:00 p. m.") a ese cuerpo se come la pantalla y parte
    en tres lineas. Se decide aqui y no en cada plantilla para que no dependa de
    que quien la escriba se acuerde.
    """
    # En las plantillas guardadas el valor todavia es "{{payment_amount}}", que
    # es largo y no se parece a lo que vera el lector. Cada marcador cuenta como
    # un valor corto, que es lo que suele acabar puesto ahi.
    largo = len(re.sub(r"\{\{[a-z_]+\}\}", "000000", valor))
    if largo <= 8:
        tamano, espaciado = "44px", "-0.02em"
    elif largo <= 16:
        tamano, espaciado = "30px", "-0.015em"
    else:
        tamano, espaciado = "22px", "normal"
    return (f'<p style="margin: 0 0 24px 0; line-height: 1.2;">'
            f'<span style="display: block; margin-bottom: 6px; font-size: 13px; color: {APAGADO};">{etiqueta}</span>'
            f'<span style="display: block; font-size: {tamano}; font-weight: 700; letter-spacing: {espaciado}; color: {TINTA};">{valor}</span>'
            f'</p>')


def codigo(valor: str) -> str:
    """Un codigo de un solo uso. Se copia a mano, asi que va grande y separado."""
    return (f'<p style="margin: 0 0 20px 0; font-size: 34px; font-weight: 700; '
            f'letter-spacing: 0.28em; color: {TINTA}; line-height: 1.2;">{valor}</p>')


def enlace(texto: str, url: str) -> str:
    """Enlace dentro del texto. Subrayado y del color del texto, como en un
    documento; el naranja se reserva para los botones."""
    return f'<a href="{url}" style="color: {TINTA}; text-decoration: underline;">{texto}</a>'


def separador() -> str:
    return f'<hr style="border: 0; border-top: 1px solid {LINEA}; margin: 32px 0;">'


def nota(texto: str) -> str:
    """Letra pequena: aclaraciones, condiciones, «si no fuiste tu...»."""
    return (f'<p style="margin: 0 0 12px 0; font-size: 14px; line-height: 1.55; '
            f'color: {APAGADO};">{texto}</p>')


def _cabecera() -> str:
    """La marca escrita, no dibujada: media bandeja bloquea las imagenes y un
    logo cargado a medias deja el correo empezando por un hueco."""
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
                            <a href="https://{sitio}" style="color: {APAGADO}; text-decoration: underline;">{sitio}</a>
                        </p>
                        {extra or ""}"""


def fragmento(contenido: str, pie_extra: Optional[str] = None) -> str:
    """La misma pinta, pero como <div> suelto en vez de documento entero.

    Es lo que necesitan las plantillas que se guardan en la base y se mandan
    con `send_templated_email`, que les pega detras la banda del patrocinador:
    si fueran un documento completo, esa banda caeria despues de </html>.
    """
    return f"""
<div style="max-width: {ANCHO}px; margin: 0 auto; padding: 40px 20px; font-family: {FUENTE}; color: {TINTA}; font-size: 17px; line-height: 1.6; text-align: left; background-color: {FONDO};">
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
                        <td style="font-family: {FUENTE}; color: {TINTA}; font-size: 17px; line-height: 1.6; text-align: left;">
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
