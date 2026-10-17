"""Transmision en vivo de una carrera (YouTube u otra), para la portada.

El enlace vive en la ficha de la carrera (`race_configurations.live_stream_url`)
y no esta atado a la carrera publica: el dia del Mundial el sitio publicaba la
carrera de enero y lo que se transmitia era el campeonato. Por eso la portada
ensena el boton mientras *alguna* carrera en `en_carrera` tenga enlace, sea o
no la que publica el sitio. Sin ninguna, no hay boton: el enlace de una
carrera cerrada o aun sin salida no se anuncia.
"""
from typing import Optional

ESTADO_EN_CARRERA = "en_carrera"


def enlace_valido(url) -> Optional[str]:
    """El enlace limpio, o None si no es una direccion http(s)."""
    if not isinstance(url, str):
        return None
    limpio = url.strip()
    if not limpio.lower().startswith(("http://", "https://")):
        return None
    return limpio


async def en_vivo(database) -> Optional[dict]:
    """La transmision que toca anunciar ahora, o None.

    Si por error hubiera dos carreras en curso con enlace, la de salida mas
    reciente (`started_at`); una sin salida sellada va al final.
    """
    cursor = database.race_configurations.find(
        {"estado": ESTADO_EN_CARRERA, "archived_at": None,
         "live_stream_url": {"$exists": True, "$nin": [None, ""]}},
        {"_id": 0, "code": 1, "name": 1, "live_stream_url": 1, "started_at": 1},
    ).sort("started_at", -1)
    async for carrera in cursor:
        url = enlace_valido(carrera.get("live_stream_url"))
        if url:
            return {
                "url": url,
                "race_code": carrera.get("code", ""),
                "race_name": carrera.get("name", ""),
            }
    return None
