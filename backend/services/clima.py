"""El tiempo que hace en la sede de la carrera.

Lo sirve Open-Meteo, que es gratis y no pide llave: una variable de entorno
menos que recordar en Render. La consulta se hace desde el backend y no desde
el telefono para no repetirla una vez por espectador, y se guarda en memoria
unos minutos, que es de sobra: la temperatura no cambia entre una vuelta y la
siguiente.

Si Open-Meteo no responde, esto devuelve None y la pantalla se queda sin el
bloque del clima. Nada mas se rompe.
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone

import httpx

logger = logging.getLogger(__name__)

API = "https://api.open-meteo.com/v1/forecast"

# Parque del Este, Santo Domingo: la sede de siempre. Una carrera puede traer
# las suyas en la ficha (`latitud` / `longitud`) si algun dia se corre en otro
# sitio.
LAT_POR_DEFECTO = 18.4746
LON_POR_DEFECTO = -69.8226

VIGENCIA = timedelta(minutes=10)
TIMEOUT = 6.0

# Codigos de tiempo de la OMM agrupados en las tres condiciones que la app
# ensena. Todo lo que sea agua cayendo (llovizna, chubasco, tormenta) es
# "lloviendo": al corredor le da igual la diferencia.
def _condicion(codigo: int) -> str:
    if codigo in (0, 1):
        return "soleado"
    if codigo in (2, 3, 45, 48):
        return "nublado"
    return "lloviendo"


_cache: dict[tuple[float, float], tuple[datetime, dict]] = {}
_candado = asyncio.Lock()


def coordenadas(carrera: dict) -> tuple[float, float]:
    """Donde se corre. La ficha manda; si no las trae, Santo Domingo."""
    carrera = carrera or {}
    try:
        lat = float(carrera.get("latitud"))
        lon = float(carrera.get("longitud"))
        return lat, lon
    except (TypeError, ValueError):
        return LAT_POR_DEFECTO, LON_POR_DEFECTO


async def actual(carrera: dict) -> dict | None:
    """El tiempo ahora mismo en la sede, o None si no se pudo consultar."""
    punto = coordenadas(carrera)
    ahora = datetime.now(timezone.utc)

    guardado = _cache.get(punto)
    if guardado and ahora - guardado[0] < VIGENCIA:
        return guardado[1]

    async with _candado:
        # Otra peticion pudo refrescarlo mientras esta esperaba el candado.
        guardado = _cache.get(punto)
        if guardado and datetime.now(timezone.utc) - guardado[0] < VIGENCIA:
            return guardado[1]

        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as cliente:
                respuesta = await cliente.get(API, params={
                    "latitude": punto[0],
                    "longitude": punto[1],
                    "current": "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m",
                    "timezone": "auto",
                })
                respuesta.raise_for_status()
                datos = (respuesta.json() or {}).get("current") or {}
        except Exception as error:  # red caida, corte, formato raro
            logger.warning("No se pudo consultar el clima: %s", error)
            # Se conserva lo ultimo bueno aunque haya caducado: una temperatura
            # de hace media hora informa mas que un hueco en la pantalla.
            return guardado[1] if guardado else None

        temperatura = datos.get("temperature_2m")
        if temperatura is None:
            return guardado[1] if guardado else None

        clima = {
            "temperatura": round(float(temperatura)),
            "humedad": round(float(datos.get("relative_humidity_2m") or 0)),
            "viento_kmh": round(float(datos.get("wind_speed_10m") or 0)),
            "condicion": _condicion(int(datos.get("weather_code") or 0)),
            "actualizado": datetime.now(timezone.utc).isoformat(),
        }
        _cache[punto] = (datetime.now(timezone.utc), clima)
        return clima
