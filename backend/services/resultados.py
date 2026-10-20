"""Resultados de una carrera para la web, leídos del libro mayor de vueltas.

La página del Campeonato (y la que quiera después) enseña quién ganó, cuántas
vueltas hizo cada uno y cuánto tardó en cada una. Todo sale de dos sitios que
ya existen: la lista de corredores (`/api/race/participants`, que ya aplica las
reglas de quién se enseña: sin reservas, sin perfiles privados) y el libro de
vueltas (`lap_registrations`), que guarda la hora real de cada paso por el arco.

El tiempo de cada vuelta se mide con la misma regla que la hoja del Mundial
(`hoja_mundial.celdas`): desde la salida de esa vuelta según el reloj de la
carrera, no desde el `lap_start_time` anotado, porque el panel anota la vuelta
anterior con el reloj de la que corre. Y lo que el libro no sabe no se inventa:
una vuelta fijada con un ajuste, o anotada tarde desde el panel, va con tiempo
`None` y las estadísticas la dejan fuera. El retiro lleva la misma marca que la
hoja: RTC (no salió), INC (regresó antes de tiempo) u Over (llegó pasada la hora).

Nada de aquí toca la base: son funciones puras sobre lo que ya está leído, y
`tests/test_resultados.py` las prueba sin servidor.
"""
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from services import hoja_mundial, laps, races


def _en_utc(momento: Optional[datetime]) -> Optional[datetime]:
    if momento is None:
        return None
    if momento.tzinfo is None:
        # Mongo devuelve las fechas sin zona: son UTC.
        return momento.replace(tzinfo=timezone.utc)
    return momento


def _iso(momento: Optional[datetime]) -> Optional[str]:
    momento = _en_utc(momento)
    return momento.isoformat() if momento else None


def clave_de_dorsal(bib) -> str:
    """El libro guarda el dorsal como lo trae la ficha ("7") y la lista de
    corredores lo rellena a tres cifras ("007"): se casan por su valor."""
    texto = str(bib or "").strip()
    return str(int(texto)) if texto.isdigit() else texto


def tiempos_por_vuelta(carrera: dict, anotaciones: List[dict]) -> List[Optional[int]]:
    """Segundos de cada vuelta completada, en orden, según el libro.

    `anotaciones` es el historial del corredor sin anuladas y en orden de
    paso. Sigue la cuenta de `laps.recalcular`: un ajuste fija las vueltas y
    cada vuelta completada suma una. Una vuelta sin hora real (la trajo un
    ajuste, o el paso cae fuera de la hora) va como `None`.
    """
    duracion = races.minutos_por_vuelta(carrera)
    salida = races.hora_de_salida(carrera)

    vueltas = 0
    pasos: Dict[int, dict] = {}
    for registro in anotaciones:
        accion = registro.get("action")
        if accion == laps.AJUSTE:
            vueltas = int(registro.get("lap_number") or 0)
        elif accion == laps.VUELTA_COMPLETADA:
            vueltas += 1
            pasos[int(registro.get("lap_number") or vueltas)] = registro

    tiempos: List[Optional[int]] = []
    for vuelta in range(1, vueltas + 1):
        momento = _en_utc((pasos.get(vuelta) or {}).get("scan_time"))
        segundos = None
        if salida is not None and momento is not None:
            inicio = salida + timedelta(minutes=(vuelta - 1) * duracion)
            transcurrido = (momento - inicio).total_seconds()
            if 0 <= transcurrido < duracion * 60:
                segundos = int(transcurrido)
        tiempos.append(segundos)
    return tiempos


def marca_de_retiro(anotaciones: List[dict], status: Optional[str]) -> Optional[str]:
    """RTC, INC u Over para quien se retiró; None para los demás."""
    if status != "retired":
        return None
    retiros = [r for r in anotaciones if r.get("action") in laps.RETIROS]
    accion = retiros[-1].get("action") if retiros else laps.RETIRO_MANUAL
    return hoja_mundial.MARCA_DE_RETIRO.get(accion, hoja_mundial.RTC)


def ficha(carrera: dict, corredor: dict, anotaciones: List[dict]) -> dict:
    """Lo que la web enseña de un corredor: vueltas, km, tiempos y retiro."""
    tiempos = tiempos_por_vuelta(carrera, anotaciones)
    # Si el libro trae menos vueltas que la ficha (carreras anotadas antes
    # del libro), la ficha manda y las vueltas de más van sin tiempo.
    vueltas = max(len(tiempos), int(corredor.get("laps_completed") or 0))
    tiempos = tiempos + [None] * (vueltas - len(tiempos))
    km = round(vueltas * races.km_por_vuelta(carrera), 2)
    return {
        "bib": corredor.get("bib"),
        "nombre": corredor.get("nombre") or "",
        "apellidos": corredor.get("apellidos") or "",
        "status": corredor.get("status") or "active",
        "categoria": corredor.get("categoria"),
        "nacionalidad": corredor.get("nacionalidad"),
        "vueltas": vueltas,
        "km": km,
        "tiempos": tiempos,
        "retiro": marca_de_retiro(anotaciones, corredor.get("status")),
    }


def armar(carrera: dict, corredores: List[dict], anotaciones: List[dict]) -> dict:
    """La respuesta entera de `/api/race/resultados`.

    `anotaciones` es el libro de la carrera sin anuladas, en orden de paso;
    aquí se reparte por dorsal. Los corredores salen ordenados por vueltas, y
    el ganador (status `winner`) primero aunque empate.
    """
    por_dorsal: Dict[str, List[dict]] = {}
    for registro in anotaciones:
        por_dorsal.setdefault(clave_de_dorsal(registro.get("bib")), []).append(registro)

    fichas = [ficha(carrera, c, por_dorsal.get(clave_de_dorsal(c.get("bib")), [])) for c in corredores]
    fichas.sort(key=lambda f: (f["status"] != "winner", -f["vueltas"], f["bib"] or "999"))

    return {
        "carrera": {
            "code": carrera.get("code"),
            "nombre": carrera.get("name"),
            "fecha": carrera.get("date"),
            "estado": races.estado(carrera),
            "km_por_vuelta": races.km_por_vuelta(carrera),
            "minutos_por_vuelta": races.minutos_por_vuelta(carrera),
            "salida": _iso(races.hora_de_salida(carrera)),
            "llegada": _iso(races.hora_de_llegada(carrera)),
        },
        "corredores": fichas,
    }
