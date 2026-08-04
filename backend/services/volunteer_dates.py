"""Fecha real de un turno de voluntarios.

Los slots guardan el dia como un tipo relativo ('previo', 'carrera_dia1',
'carrera_dia2', 'carrera_dia3'), no como fecha. La fecha concreta sale de la
programacion del evento (volunteer_event_schedules) y, si no existe, de la
fecha de la carrera activa. Sin esto, los correos de turno asignado y de
recordatorio salian con la fecha en blanco.
"""
from datetime import datetime, timedelta
from typing import Optional

# Desplazamiento en dias respecto al inicio del evento
DIA_TIPO_OFFSET = {
    "previo": -1,
    "carrera_dia1": 0,
    "carrera_dia2": 1,
    "carrera_dia3": 2,
    # Valor antiguo, anterior a los dias numerados
    "carrera": 0,
}


def _solo_fecha(valor: str) -> str:
    """'2026-08-15T08:00' o '2026-08-15' -> '2026-08-15'."""
    return (valor or "").split("T")[0].strip()


def _sumar_dias(fecha_iso: str, dias: int) -> str:
    try:
        base = datetime.strptime(fecha_iso, "%Y-%m-%d")
    except ValueError:
        return ""
    return (base + timedelta(days=dias)).strftime("%Y-%m-%d")


async def _primer_dia_legado(db, evento: str) -> str:
    """Menor valor del campo 'dia' entre los turnos del evento.

    Los turnos heredados de una edicion anterior conservan la fecha de aquel
    ano, asi que ese campo no sirve como fecha absoluta; sirve para saber a
    que dia del evento pertenece cada turno (el primero, el siguiente...).
    """
    if evento == "campeonato":
        filtro = {"evento": "campeonato"}
    else:
        filtro = {"$or": [{"evento": "carrera"}, {"evento": {"$exists": False}}, {"evento": None}]}

    doc = await db.volunteer_assignments.find_one(
        {**filtro, "dia": {"$nin": [None, ""]}},
        {"_id": 0, "dia": 1},
        sort=[("dia", 1)],
    )
    return _solo_fecha((doc or {}).get("dia"))


async def _offset_de_slot(db, slot: dict) -> int:
    """Dia del evento al que pertenece el turno, como desplazamiento en dias."""
    dia_tipo = slot.get("dia_tipo")
    if dia_tipo in DIA_TIPO_OFFSET:
        return DIA_TIPO_OFFSET[dia_tipo]

    # Sin dia numerado: se deduce del campo 'dia' heredado, comparandolo con el
    # primer dia del evento (asi la madrugada sigue cayendo en el dia siguiente)
    dia_slot = _solo_fecha(slot.get("dia"))
    if dia_slot:
        primero = await _primer_dia_legado(db, slot.get("evento") or "carrera")
        if primero:
            try:
                d1 = datetime.strptime(primero, "%Y-%m-%d")
                d2 = datetime.strptime(dia_slot, "%Y-%m-%d")
                return (d2 - d1).days
            except ValueError:
                pass
    return 0


async def fecha_de_slot(db, slot: dict) -> str:
    """Fecha del turno en formato 'YYYY-MM-DD'. Cadena vacia si no se puede
    determinar (por ejemplo, sin programacion ni carrera activa)."""
    if not slot:
        return ""

    evento = slot.get("evento") or "carrera"

    # 1) Programacion del evento: la fuente correcta desde que los turnos se
    #    generan a partir de un inicio y un fin
    schedule = await db.volunteer_event_schedules.find_one({"evento": evento})
    base = _solo_fecha((schedule or {}).get("fecha_inicio"))

    # 2) Respaldo: la fecha de la carrera activa
    if not base:
        race = await db.race_configurations.find_one({"is_active": True})
        base = _solo_fecha((race or {}).get("date"))

    if not base:
        # Sin fecha del evento, lo unico disponible es la heredada
        return _solo_fecha(slot.get("dia"))

    return _sumar_dias(base, await _offset_de_slot(db, slot))


async def con_fecha(db, slot: dict) -> dict:
    """Copia del slot con el campo 'dia' resuelto, lista para los correos."""
    if not slot:
        return slot
    return {**slot, "dia": await fecha_de_slot(db, slot)}


async def con_fecha_varios(db, slots: list) -> list:
    return [await con_fecha(db, s) for s in (slots or [])]


async def fecha_y_hora_de_slot(db, slot: dict) -> Optional[datetime]:
    """Inicio del turno como datetime local, para programar recordatorios."""
    fecha = await fecha_de_slot(db, slot)
    hora = slot.get("hora_inicio") or ""
    if not fecha or not hora:
        return None
    try:
        partes = hora.split(":")
        return datetime.strptime(fecha, "%Y-%m-%d").replace(
            hour=int(partes[0]),
            minute=int(partes[1]) if len(partes) > 1 else 0,
        )
    except (ValueError, IndexError):
        return None
