"""Correo de confirmacion de una actividad (charlas, jornadas, entrega de kits).

Lo recibe quien se apunta por la pagina publica, /actividad/<id>, sin cuenta en
el sitio. Es el unico comprobante que le queda: lleva la fecha, la hora de fin
calculada desde la duracion, los datos con los que quedo inscrito y el programa
completo, para que no tenga que volver a la pagina a mirarlo.

Va en texto plano a proposito. Ver `cuerpo()`.
"""
import re
from typing import Optional

from services.template_email_service import send_templated_email
from services.env_utils import get_env

BASE_URL = (get_env("FRONTEND_URL", "https://backyardultrasantodomingo.com") or "").rstrip("/")

MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
         "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]


def _minutos(duracion: Optional[str]) -> Optional[int]:
    """Duracion en minutos. Se escribe a mano en el panel ("2", "2 horas",
    "90 min", "2:30"), asi que hay que interpretarla. None si no se puede."""
    if not duracion:
        return None
    s = str(duracion).strip().lower().replace(",", ".")
    if not s:
        return None

    hm = re.match(r"^(\d{1,2}):([0-5]\d)$", s)
    if hm:
        return int(hm.group(1)) * 60 + int(hm.group(2))

    minutos = 0.0
    encontrado = False
    horas = re.search(r"(\d+(?:\.\d+)?)\s*(?:h\b|hr|hrs|hora|horas)", s)
    if horas:
        minutos += float(horas.group(1)) * 60
        encontrado = True
    mins = re.search(r"(\d+)\s*(?:m\b|min|mins|minuto|minutos)", s)
    if mins:
        minutos += int(mins.group(1))
        encontrado = True
    if not encontrado and re.match(r"^\d+(?:\.\d+)?$", s):
        minutos = float(s) * 60
        encontrado = True

    return round(minutos) if encontrado and minutos > 0 else None


def _hora(h: int, m: int) -> str:
    sufijo = "a. m." if h < 12 else "p. m."
    h12 = h % 12 or 12
    return f"{h12}:{m:02d} {sufijo}"


def cuando(fecha_iso: str, duracion: Optional[str] = None) -> str:
    """«sábado 3 de octubre de 2026, 10:00 a. m. a 12:30 p. m.»

    Si la fecha no se puede interpretar se devuelve tal cual: mas vale un texto
    raro que un correo sin fecha.
    """
    from datetime import datetime, timedelta

    try:
        inicio = datetime.fromisoformat((fecha_iso or "").replace("Z", ""))
    except Exception:
        return fecha_iso or ""

    texto = (f"{DIAS[inicio.weekday()]} {inicio.day} de {MESES[inicio.month - 1]} "
             f"de {inicio.year}, {_hora(inicio.hour, inicio.minute)}")
    mins = _minutos(duracion)
    if mins:
        fin = inicio + timedelta(minutes=mins)
        texto += f" a {_hora(fin.hour, fin.minute)}"
    return texto


def cuerpo(nombre: str, actividad: dict, email: str, telefono: str) -> str:
    """El correo, en texto plano.

    Nada de HTML ni imagenes: media bandeja de entrada bloquea las imagenes por
    defecto y una cabecera con el logo se veria como un hueco. En texto se lee
    entero desde el primer momento, en cualquier cliente y en el reloj.
    """
    horario = cuando(actividad.get("datetime", ""), actividad.get("duration"))
    precio = ("Entrada gratis" if actividad.get("is_free")
              else f"RD${float(actividad.get('cost') or 0):,.0f}")
    tipo = (actividad.get("tipo_label") or "Actividad").upper()
    enlace = f"{BASE_URL}/actividad/{actividad.get('id', '')}"

    partes = [
        "BACKYARD ULTRA SANTO DOMINGO 2027",
        "Presented by CEDIMAT · Plaza de la Salud",
        "",
        f"Hola {nombre},",
        "",
        "Tu inscripción quedó confirmada. Te esperamos.",
        "",
        tipo,
        actividad.get("name", ""),
        horario,
        precio,
        "",
        "QUEDASTE INSCRITO CON ESTOS DATOS",
        nombre,
        email,
        telefono,
        "",
        "¿Algo está mal? Vuelve al enlace de abajo y confírmalos otra vez:",
        "se actualizan solos.",
        enlace,
    ]

    programa = (actividad.get("program") or "").strip()
    if programa:
        partes += ["", "PROGRAMA", "", programa]

    partes += ["", "--", "Backyard Ultra Santo Domingo", BASE_URL]
    return "\n".join(partes)


async def enviar_confirmacion(email: str, nombre: str, actividad: dict, telefono: str) -> bool:
    """Manda la confirmacion. Nunca revienta: si el correo falla, la persona ya
    quedo inscrita y eso es lo que no se puede perder."""
    try:
        asunto = f"Inscripción confirmada · {actividad.get('name', 'Actividad')}"
        return await send_templated_email(
            email, asunto, cuerpo(nombre, actividad, email, telefono), is_plain=True
        )
    except Exception as e:  # noqa: BLE001
        print(f"Error enviando confirmación de actividad a {email}: {e}")
        return False
