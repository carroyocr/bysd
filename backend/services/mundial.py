"""El ranking de Latinoamérica del Campeonato Mundial por equipos.

La organización del Mundial publica el leaderboard por países en una hoja de
Google (una fila por equipo: puesto, código, país, corredores en pie, vueltas
sumadas, promedio y los quince nombres). Aquí se lee esa hoja como CSV, se
quedan solo los equipos de Latinoamérica y se ordenan como los ordena la
hoja: por el puesto mundial, que ya tiene en cuenta vueltas, corredores en
pie y promedio. No se recalcula nada: lo que sale en pantalla es lo que dice
la hoja de la organización, que es la que vale.

La hoja se pide cada medio minuto como mucho y se guarda en memoria: la
vista de OBS pregunta cada pocos segundos y Google no tiene por qué recibir
cada una de esas preguntas. Si Google no contesta se sirve la última copia
buena, y solo si nunca hubo una se devuelve error.
"""
import csv
import io
import re
import time
from datetime import datetime, timezone
from typing import Optional

import httpx

# La hoja publicada en la web por la organización (Archivo → Publicar en la
# web). Es la misma que se abre en el navegador; con output=csv devuelve la
# primera pestaña, el leaderboard por equipos, en texto plano.
HOJA_PUBLICADA = (
    "https://docs.google.com/spreadsheets/d/e/"
    "2PACX-1vR-vmYpj04JD3879yCoJkPoXz8YqjJw9ykVU70nb830fFkmdeEQE75d8fwI5gVbljKe8a0MeK2Grx7L"
    "/pub?gid=1526600000&single=true&output=csv"
)

CACHE_SEG = 30          # cada cuánto se vuelve a pedir la hoja, como mucho
CACHE_VIEJA_MAX_SEG = 3600  # hasta cuándo vale la última copia si Google falla

# Los países de Latinoamérica con el código que usa la hoja (el de la IOC) y
# el nombre en español, que es el que se lee en la transmisión. La hoja trae
# los nombres en inglés y no todos los países cada año: los que no estén
# simplemente no salen.
LATINOAMERICA = {
    "ARG": "Argentina",
    "BOL": "Bolivia",
    "BRA": "Brasil",
    "CHI": "Chile",
    "COL": "Colombia",
    "CRC": "Costa Rica",
    "CUB": "Cuba",
    "DOM": "República Dominicana",
    "ECU": "Ecuador",
    "ESA": "El Salvador",
    "GUA": "Guatemala",
    "HAI": "Haití",
    "HON": "Honduras",
    "MEX": "México",
    "NCA": "Nicaragua",
    "PAN": "Panamá",
    "PAR": "Paraguay",
    "PER": "Perú",
    "PUR": "Puerto Rico",
    "URU": "Uruguay",
    "VEN": "Venezuela",
}


def _entero(texto) -> Optional[int]:
    try:
        return int(str(texto).strip().replace(",", ""))
    except (TypeError, ValueError):
        return None


def parsear(texto_csv: str) -> dict:
    """La hoja en CSV convertida al ranking de Latinoamérica.

    Es cálculo puro, para poder probarlo con una hoja de mentira. Busca la
    fila de cabecera por sus nombres (Rank, Tm, Team, #, Yards, Avg) en vez
    de por su posición: si la organización mete una columna, sigue sirviendo.
    """
    filas = list(csv.reader(io.StringIO(texto_csv)))

    vuelta = None
    hora_carrera = None
    for fila in filas[:6]:
        for celda in fila:
            m = re.search(r"Yard\s+(\d+)", celda or "")
            if m and vuelta is None:
                vuelta = int(m.group(1))
            m = re.search(r"Race Time:\s*([\d:]+)", celda or "")
            if m and hora_carrera is None:
                hora_carrera = m.group(1)

    cabecera = None
    inicio = 0
    for i, fila in enumerate(filas):
        if fila and fila[0].strip() == "Rank" and "Team" in fila:
            cabecera = [c.strip() for c in fila]
            inicio = i + 1
            break
    if cabecera is None:
        raise ValueError("La hoja no trae la fila de cabecera (Rank, Tm, Team…)")

    col = {nombre: cabecera.index(nombre) for nombre in ("Rank", "Tm", "Team", "#", "Yards", "Avg")}

    equipos = []
    for fila in filas[inicio:]:
        if len(fila) <= col["Avg"]:
            continue
        codigo = fila[col["Tm"]].strip().upper()
        puesto_mundial = _entero(fila[col["Rank"]])
        if not codigo or puesto_mundial is None:
            continue
        if codigo not in LATINOAMERICA:
            continue
        equipos.append({
            "codigo": codigo,
            "pais": LATINOAMERICA[codigo],
            "pais_hoja": fila[col["Team"]].strip(),
            "puesto_mundial": puesto_mundial,
            "en_pie": _entero(fila[col["#"]]) or 0,
            "vueltas": _entero(fila[col["Yards"]]) or 0,
            "promedio": fila[col["Avg"]].strip() or None,
        })

    # El orden es el de la hoja: su puesto mundial ya desempata por
    # corredores en pie y promedio.
    equipos.sort(key=lambda e: e["puesto_mundial"])
    for i, e in enumerate(equipos, start=1):
        e["puesto"] = i

    return {
        "vuelta": vuelta,
        "hora_carrera": hora_carrera,
        "equipos": equipos,
    }


_cache = {"datos": None, "momento": 0.0}


async def ranking_latam() -> dict:
    """El ranking, de la memoria si es reciente y de la hoja si no."""
    ahora = time.monotonic()
    if _cache["datos"] and ahora - _cache["momento"] < CACHE_SEG:
        return _cache["datos"]

    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as cliente:
            r = await cliente.get(HOJA_PUBLICADA)
            r.raise_for_status()
        datos = parsear(r.text)
        datos["actualizado"] = datetime.now(timezone.utc).isoformat()
        _cache["datos"] = datos
        _cache["momento"] = ahora
        return datos
    except Exception:
        if _cache["datos"] and ahora - _cache["momento"] < CACHE_VIEJA_MAX_SEG:
            return _cache["datos"]
        raise
