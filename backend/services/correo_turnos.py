"""El correo «tus turnos y la app» que se manda a los voluntarios.

Es un correo que redacta la organizacion desde Enviar Correos, no uno que salga
solo: le recuerda a cada voluntario los turnos que tiene asignados —fecha, hora
de inicio y hora de termino—, le dice donde bajar la app y le pide que, si no va
a poder ir, cancele el mismo su participacion desde la app o el portal.

Aqui vive lo que ese correo tiene de propio: los turnos de cada destinatario y
los botones de las tiendas. La plantilla esta en `routes/email_templates.py`
(`volunteer_turnos_y_app`) y quien la rellena al enviar es el redactor
(`routes/athletes.py`).
"""
import html
from datetime import datetime
from typing import Dict, Iterable, List, Optional

from services import correo_estilo as e

# Las imagenes de un correo necesitan una direccion completa y publica. Van
# contra el sitio de produccion y no contra `FRONTEND_URL`: asi se ven tambien
# en el editor del panel y en un correo de prueba enviado desde local.
SITIO = "https://backyardultrasantodomingo.com"
PORTAL_VOLUNTARIOS = f"{SITIO}/voluntarios"

# Las fichas de BYSD Live. Las imagenes son botones propios, del mismo azul que
# los demas botones del correo (`correo_estilo.BOTON`), con el icono de
# cada tienda (`frontend/public/correo/`), al doble de tamano para pantallas
# densas: se pintan a 180 x 52.
#
# El nombre del archivo lleva version a proposito. Los clientes de correo
# guardan cada imagen por su direccion: cuando los botones pasaron de negro a
# azul con el mismo nombre, el correo seguia llegando con los negros. Si se
# vuelven a redibujar, van con nombre nuevo (-v3) y el anterior se apunta en
# `correo_estilo.IMAGENES_RENOMBRADAS`, que es lo que corrige las plantillas
# ya guardadas. Los archivos viejos no se borran: los correos ya enviados
# siguen pidiendolos.
TIENDAS = [
    {
        "url": "https://apps.apple.com/ar/app/bysd-live/id6802661105",
        "imagen": f"{SITIO}/correo/app-store-v2.png",
        "alt": "Descargar BYSD Live en el App Store (iPhone)",
    },
    {
        "url": "https://play.google.com/store/apps/details?id=com.backyardultrasd.app&pcampaignid=web_share",
        "imagen": f"{SITIO}/correo/google-play-v2.png",
        "alt": "Descargar BYSD Live en Google Play (Android)",
    },
]

SIN_TURNOS = e.p(
    "Todavía no tienes turnos asignados. Cuando la organización te asigne alguno "
    "lo verás en la app y en el portal de voluntarios."
)

DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
MESES = ["", "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
         "agosto", "septiembre", "octubre", "noviembre", "diciembre"]


def botones_de_tiendas() -> str:
    """Los dos enlaces de descarga, como imagen con el icono de cada tienda.

    En tabla, una celda por boton: es lo unico que los deja uno junto al otro
    en Outlook. El `alt` dice a que tienda lleva, porque media bandeja bloquea
    las imagenes y sin el quedaria un hueco sin nombre.
    """
    celdas = "".join(
        f"""
                    <td style="padding: 0 10px 10px 0;">
                        <a href="{html.escape(t['url'])}" style="text-decoration: none;">
                            <img src="{t['imagen']}" alt="{t['alt']}" width="180" height="52" style="display: block; border: 0; width: 180px; height: 52px; font-family: {e.FUENTE}; font-size: 14px; color: {e.TINTA};">
                        </a>
                    </td>"""
        for t in TIENDAS
    )
    return f"""
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 4px 0 14px 0;">
                <tr>{celdas}
                </tr>
            </table>"""


def fecha_larga(fecha_iso: str) -> str:
    """'2026-10-17' -> 'Sábado 17 de octubre de 2026'. Lo que no se pueda leer
    sale tal cual, que es mejor que un turno sin fecha."""
    try:
        d = datetime.strptime((fecha_iso or "")[:10], "%Y-%m-%d")
    except ValueError:
        return fecha_iso or ""
    return f"{DIAS[d.weekday()].capitalize()} {d.day} de {MESES[d.month]} de {d.year}"


def _orden(slot: dict):
    return (str(slot.get("dia") or ""), str(slot.get("hora_inicio") or ""))


def bloque_de_turnos(slots: Iterable[dict], nombres_de_evento: Optional[Dict[str, str]] = None) -> str:
    """Los turnos de un voluntario, uno debajo de otro: fecha, puesto, hora de
    inicio y hora de termino.

    Los slots llegan con `dia` ya resuelto a fecha (`volunteer_dates.con_fecha`).
    El evento solo se nombra si la persona tiene turnos en mas de uno: con uno
    solo es ruido.
    """
    from services.template_email_service import format_time_ampm

    slots = sorted(slots or [], key=_orden)
    if not slots:
        return SIN_TURNOS

    varios_eventos = len({(s.get("evento") or "carrera") for s in slots}) > 1
    bloques = []
    for i, s in enumerate(slots):
        lineas = [
            e.linea("Puesto", html.escape(str(s.get("puesto") or ""))),
            e.linea("Hora de inicio", html.escape(format_time_ampm(s.get("hora_inicio") or ""))),
            e.linea("Hora de término", html.escape(format_time_ampm(s.get("hora_fin") or ""))),
        ]
        if varios_eventos and nombres_de_evento:
            evento = s.get("evento") or "carrera"
            lineas.insert(0, e.linea("Evento", html.escape(nombres_de_evento.get(evento, evento))))

        # Entre turno y turno, una linea fina: sin cajas, como el resto del correo.
        borde = f"border-top: 1px solid {e.LINEA}; padding-top: 18px; " if i else ""
        bloques.append(
            f'<div style="{borde}margin: 0 0 18px 0;">'
            f'<p style="margin: 0 0 8px 0; font-size: 18px; line-height: 1.4; font-weight: 400; color: {e.TINTA};">'
            f'{html.escape(fecha_larga(s.get("dia") or ""))}</p>'
            + "".join(lineas)
            + "</div>"
        )
    return "".join(bloques)


async def turnos_asignados(db, emails: Iterable[str], evento: Optional[str] = None) -> Dict[str, List[dict]]:
    """Los turnos asignados a cada correo, con la fecha ya resuelta.

    `evento` los limita a la carrera o al campeonato, que es como filtra los
    destinatarios el redactor; sin el salen todos los de la persona.
    """
    from routes.volunteer_registration import VALID_EVENTOS, evento_query
    from services.volunteer_dates import con_fecha_varios

    correos = sorted({(c or "").strip().lower() for c in emails if c})
    if not correos:
        return {}

    filtro = {"email_asignado": {"$in": correos}}
    if evento in VALID_EVENTOS:
        filtro.update(evento_query(evento))
    slots = await db.volunteer_assignments.find(filtro, {"_id": 0}).to_list(5000)

    por_correo: Dict[str, List[dict]] = {}
    for slot in await con_fecha_varios(db, slots):
        por_correo.setdefault((slot.get("email_asignado") or "").lower(), []).append(slot)
    return {correo: sorted(lista, key=_orden) for correo, lista in por_correo.items()}


async def datos_por_destinatario(db, emails: Iterable[str], evento: Optional[str] = None) -> Dict[str, dict]:
    """Lo que la plantilla necesita de cada destinatario: sus turnos ya
    montados en HTML y cuantos son."""
    from routes.volunteer_registration import VALID_EVENTOS, nombre_evento

    carrera = await db.race_configurations.find_one({"is_active": True})
    nombres = {ev: nombre_evento(carrera, ev) for ev in VALID_EVENTOS}

    turnos = await turnos_asignados(db, emails, evento)
    return {
        correo: {
            "volunteer_turnos_asignados": bloque_de_turnos(lista, nombres),
            "volunteer_turnos_total": str(len(lista)),
        }
        for correo, lista in turnos.items()
    }


# Para la vista previa del redactor: dos turnos de mentira con buena pinta.
TURNOS_DE_EJEMPLO = [
    {"puesto": "Punto de Hidratación y Snacks", "dia": "2026-10-17", "hora_inicio": "07:00", "hora_fin": "11:00"},
    {"puesto": "Control de Vueltas", "dia": "2026-10-18", "hora_inicio": "15:00", "hora_fin": "19:00"},
]
