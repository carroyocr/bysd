"""Lectura del perfil publico de ITRA de un corredor.

ITRA no publica una API, pero su pagina de corredor trae los datos en un
objeto JavaScript (`var Model = {...}`) dentro del HTML. Se lee de ahi y no
del texto renderizado: el texto cambia con cada retoque de diseno, mientras
que ese objeto es el modelo que alimenta la pagina y es mucho mas estable.

Dos cosas que conviene tener presentes:

- ITRA responde 403 a las peticiones sin cabecera de navegador. Se manda una
  cabecera normal, pero puede que ademas bloquee las IP de centros de datos:
  si esto falla en produccion y funciona en local, esa es la causa.
- Esto depende de una pagina ajena. El dia que ITRA cambie el nombre de la
  variable o de los campos, la carga automatica dejara de funcionar. Por eso
  nunca se pisa lo que ya habia con datos vacios y el formulario manual sigue
  estando: es el plan B, no un adorno.
"""
import json
import logging
import re
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

TIMEOUT = 25

CABECERAS = {
    # Sin un user-agent de navegador, ITRA contesta 403.
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
}


class ItraError(Exception):
    """Fallo al leer ITRA, con un mensaje ya escrito para el usuario."""


def url_valida(url: str) -> bool:
    return bool(re.match(r"^https?://(www\.)?itra\.run/", (url or "").strip(), re.I))


def _extraer_model(html: str) -> Optional[dict]:
    """Saca el objeto `Model` del HTML contando llaves.

    No vale una expresion regular: el objeto tiene decenas de miles de
    caracteres y llaves anidadas. Se recorre carácter a carácter respetando
    las cadenas, para no contar una llave que este dentro de un texto.
    """
    encontrado = re.search(r"(?:const|var|let)\s+Model\s*=\s*(\{)", html)
    if not encontrado:
        return None

    inicio = encontrado.start(1)
    profundidad = 0
    en_cadena = False
    escapado = False
    i = inicio

    while i < len(html):
        c = html[i]
        if en_cadena:
            if escapado:
                escapado = False
            elif c == "\\":
                escapado = True
            elif c == '"':
                en_cadena = False
        else:
            if c == '"':
                en_cadena = True
            elif c == "{":
                profundidad += 1
            elif c == "}":
                profundidad -= 1
                if profundidad == 0:
                    try:
                        return json.loads(html[inicio:i + 1])
                    except json.JSONDecodeError:
                        return None
        i += 1
    return None


def _numero(valor):
    try:
        return float(valor) if valor is not None else None
    except (TypeError, ValueError):
        return None


def _entero(valor):
    try:
        return int(valor) if valor is not None else None
    except (TypeError, ValueError):
        return None


def _nivel(model: dict) -> Optional[str]:
    """El nivel viene como "Intermediate-3"; se muestra con espacio."""
    infos = model.get("performanceIndicatorInfos") or []
    for info in infos:
        indice = (info or {}).get("piIndex")
        if indice:
            return str(indice).replace("-", " ").strip()
    return None


def _resultados(model: dict) -> list:
    crudos = ((model.get("latestResult") or {}).get("raceResults")) or []
    salida = []
    for r in crudos:
        if not isinstance(r, dict):
            continue
        salida.append({
            "date": r.get("date"),
            "race": (r.get("name") or "").strip() or None,
            "country": r.get("country"),
            "distance_km": _numero(r.get("distance")),
            "elevation_m": _numero(r.get("elevationGain")),
            "time": r.get("time"),
            # El puesto por sexo es el que el corredor reconoce como suyo;
            # si no esta, se cae al general.
            "position": str(r.get("genderRanking") or r.get("ranking") or "") or None,
            "category": r.get("ageGroup"),
        })
    return salida


def _a_snapshot(model: dict) -> dict:
    stats = model.get("runnerStatsVM") or {}
    return {
        "performance_index": _entero(model.get("performanceIndex") or stats.get("performanceIndex")),
        "level": _nivel(model),
        "age_category": model.get("ageGroup"),
        "finished_races": _entero(stats.get("numberOfRaces")),
        "total_distance_km": _numero(stats.get("totalDistance")),
        "total_elevation_m": _numero(stats.get("elevationGain")),
        "total_race_time": stats.get("totalRaceTime"),
        "results": _resultados(model),
    }


async def leer_perfil(url: str) -> dict:
    """Descarga la ficha de ITRA y devuelve el snapshot ya mapeado.

    Lanza ItraError con un mensaje listo para ensenar al usuario.
    """
    url = (url or "").strip()
    if not url_valida(url):
        raise ItraError("El enlace debe ser de itra.run")

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True) as cliente:
            respuesta = await cliente.get(url, headers=CABECERAS)
    except Exception as e:
        logger.warning(f"ITRA no respondio ({url}): {e}")
        raise ItraError("ITRA no respondio. Intentalo mas tarde o escribe los datos a mano.")

    if respuesta.status_code == 404:
        raise ItraError("Ese perfil no existe en ITRA. Revisa el enlace.")
    if respuesta.status_code != 200:
        logger.warning(f"ITRA devolvio {respuesta.status_code} para {url}")
        raise ItraError(
            "ITRA no dejo leer el perfil en este momento. "
            "Puedes escribir los datos a mano."
        )

    model = _extraer_model(respuesta.text)
    if not model:
        logger.warning(f"No se encontro el objeto Model en {url}")
        raise ItraError(
            "No se pudieron leer los datos de esa pagina de ITRA. "
            "Puedes escribirlos a mano."
        )

    snapshot = _a_snapshot(model)
    if snapshot["performance_index"] is None and not snapshot["results"]:
        raise ItraError("El perfil de ITRA no traia datos. Revisa el enlace.")

    return snapshot
