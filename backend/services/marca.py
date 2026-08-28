"""Patrocinador Titulo (naming) de cada carrera, para los correos.

Es la gemela de `frontend/src/lib/presenting.js`: la marca que acompana al
logo del evento. Vive en el codigo y no en la base porque es una decision de
marca por edicion; cuando entre el naming de la proxima, se agrega una linea
aqui y otra en el archivo del frontend.

El bloque se pinta como una banda blanca debajo del encabezado naranja de los
correos: el logo es azul oscuro y sobre el naranja no se lee. El logo va en PNG
(el SVG no lo pintan los clientes de correo) y se sirve desde el sitio, que es
donde esta `public/sponsors/`.
"""

from services.env_utils import get_env

BASE_URL = get_env("FRONTEND_URL", "https://backyardultrasantodomingo.com")

# El rotulo va en ingles porque asi esta el arte oficial de la carrera.
ETIQUETA = "PRESENTED BY"

# Carrera que se usa cuando el correo no dice de cual habla (avisos sueltos del
# panel, correos de cuenta). Es la edicion en curso.
CARRERA_POR_DEFECTO = "BYSD-2027"

PRESENTING_POR_CARRERA = {
    "BYSD-2027": {
        "nombre": "CEDIMAT",
        "descripcion": "CEDIMAT Plaza de la Salud",
        "logo": "/sponsors/cedimat.png",
        "web": "https://cedimat.com",
    },
}


def presenting(race_code: str = None) -> dict | None:
    """La marca que presenta esa carrera, o None si esa edicion no tiene."""
    codigo = (race_code or CARRERA_POR_DEFECTO).upper()
    return PRESENTING_POR_CARRERA.get(codigo)


def bloque_html(race_code: str = None, base_url: str = None) -> str:
    """Banda "PRESENTED BY <marca>" lista para pegar en un correo.

    Devuelve cadena vacia si la carrera no tiene naming, para que quien lo use
    pueda insertarlo sin preguntar.
    """
    marca = presenting(race_code)
    if not marca:
        return ""

    sitio = (base_url or BASE_URL).rstrip("/")
    logo = f"{sitio}{marca['logo']}"

    return f"""
            <!-- Naming de la edicion -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-collapse: collapse;">
                <tr>
                    <td align="center" style="padding: 18px 24px 22px 24px;">
                        <p style="margin: 0 0 10px 0; font-size: 10px; font-weight: bold; font-style: italic; letter-spacing: 2px; color: #ea580c;">{ETIQUETA}</p>
                        <a href="{marca['web']}" style="text-decoration: none;">
                            <img src="{logo}" alt="{marca['descripcion']}" width="170" style="display: block; margin: 0 auto; border: 0; width: 170px; max-width: 60%; height: auto;">
                        </a>
                    </td>
                </tr>
            </table>
    """
