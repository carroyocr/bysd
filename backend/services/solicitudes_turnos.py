"""Suspender la solicitud de turnos por parte de los voluntarios.

A dos dias del evento la organizacion deja de aceptar peticiones y reparte los
turnos a mano. El interruptor es por evento (`carrera` o `campeonato`) y vive
en `volunteer_event_schedules`, el mismo documento que guarda la programacion
del evento, para que no haya una configuracion mas que buscar.

Lo que cierra es **pedir** turnos: solicitar uno disponible, retirar una
solicitud y la eleccion en bloque de las apps antiguas. Confirmar o cancelar un
turno ya asignado sigue abierto, porque eso no cambia lo que la organizacion
esta repartiendo, sino con quien puede contar.

La regla la impone el backend y no la pantalla: la app instalada no sabe de la
suspension hasta que llega una version nueva, asi que una app vieja que pida
un turno recibe el rechazo y lo ensena como error.
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException

AVISO = (
    "La solicitud de turnos está cerrada: la organización está asignando los "
    "turnos. Si necesitas un cambio, escríbenos."
)


async def suspendidas(db, evento: str) -> bool:
    doc = await db.volunteer_event_schedules.find_one(
        {"evento": evento or "carrera"}, {"_id": 0, "solicitudes_suspendidas": 1}
    )
    return bool((doc or {}).get("solicitudes_suspendidas"))


async def suspender(db, evento: str, valor: bool, por: Optional[str] = None) -> None:
    """Enciende o apaga el interruptor sin tocar la programacion del evento."""
    await db.volunteer_event_schedules.update_one(
        {"evento": evento},
        {"$set": {
            "evento": evento,
            "solicitudes_suspendidas": bool(valor),
            "solicitudes_suspendidas_por": por,
            "solicitudes_suspendidas_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )


async def exigir_abiertas(db, evento: str) -> None:
    """Corta en seco cualquier camino por el que un voluntario pide un turno."""
    if await suspendidas(db, evento):
        raise HTTPException(status_code=400, detail=AVISO)
