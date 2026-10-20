"""Los resultados de la web salen del libro de vueltas (`services/resultados.py`).

- el tiempo de cada vuelta se mide desde la salida de esa vuelta según el
  reloj de la carrera, como en la hoja del Mundial;
- lo que el libro no sabe (un ajuste, un paso fuera de hora) va sin tiempo,
  no inventado;
- el retiro lleva la marca de la organización (RTC, INC, Over);
- el libro se reparte por dorsal aunque la ficha lo rellene a tres cifras;
- el ganador va primero aunque empate a vueltas.

No necesitan servidor ni base de datos.

    backend/.venv/bin/python -m pytest tests/test_resultados.py -v
"""
import os
from datetime import datetime, timedelta, timezone

os.environ.setdefault("JWT_SECRET_KEY", "clave-solo-para-tests-" + "x" * 40)

from services import laps, resultados  # noqa: E402

TZ = timezone(timedelta(hours=-4))
SALIDA = datetime(2026, 10, 17, 8, 0, tzinfo=TZ)
CARRERA = {
    "code": "MUNDIAL-2026", "name": "Mundial", "date": "2026-10-17",
    "started_at": SALIDA.astimezone(timezone.utc).replace(tzinfo=None),
    "timezone_gmt": "GMT-4", "minutos_por_vuelta": 60, "km_por_vuelta": 6.706,
}


def paso(vuelta, minutos, segundos=0, accion=laps.VUELTA_COMPLETADA, bib="7"):
    momento = SALIDA + timedelta(minutes=(vuelta - 1) * 60 + minutos, seconds=segundos)
    return {"bib": bib, "action": accion, "lap_number": vuelta,
            "scan_time": momento.astimezone(timezone.utc).replace(tzinfo=None)}


def test_tiempos_medidos_desde_la_salida_de_cada_vuelta():
    libro = [paso(1, 52, 30), paso(2, 55, 5), paso(3, 49)]
    assert resultados.tiempos_por_vuelta(CARRERA, libro) == [52 * 60 + 30, 55 * 60 + 5, 49 * 60]


def test_lo_que_el_libro_no_sabe_va_sin_tiempo():
    # Un ajuste fija tres vueltas sin hora; la cuarta sí se escaneó.
    libro = [{"bib": "7", "action": laps.AJUSTE, "lap_number": 3, "scan_time": None}, paso(4, 50)]
    assert resultados.tiempos_por_vuelta(CARRERA, libro) == [None, None, None, 50 * 60]
    # Un paso anotado pasada la hora no es un tiempo real de esa vuelta.
    assert resultados.tiempos_por_vuelta(CARRERA, [paso(1, 61)]) == [None]


def test_marca_de_retiro():
    assert resultados.marca_de_retiro([paso(1, 50)], "active") is None
    assert resultados.marca_de_retiro([paso(1, 50)], "retired") == "RTC"
    assert resultados.marca_de_retiro([paso(1, 50), paso(2, 20, accion=laps.RETIRO_TEMPRANO)], "retired") == "INC"
    assert resultados.marca_de_retiro([paso(1, 50), paso(2, 62, accion=laps.RETIRO_POR_TIEMPO)], "retired") == "Over"


def test_ficha_rellena_las_vueltas_que_el_libro_no_trae():
    corredor = {"bib": "007", "nombre": "Ana", "apellidos": "Pérez", "status": "retired", "laps_completed": 3}
    f = resultados.ficha(CARRERA, corredor, [paso(1, 50)])
    assert f["vueltas"] == 3
    assert f["tiempos"] == [50 * 60, None, None]
    assert f["km"] == round(3 * 6.706, 2)
    assert f["retiro"] == "RTC"


def test_armar_reparte_el_libro_por_dorsal_y_pone_al_ganador_primero():
    corredores = [
        {"bib": "007", "nombre": "Ana", "apellidos": "Pérez", "status": "retired", "laps_completed": 2},
        {"bib": "012", "nombre": "Luis", "apellidos": "Gómez", "status": "winner", "laps_completed": 2},
        {"bib": "003", "nombre": "Eva", "apellidos": "Ruiz", "status": "retired", "laps_completed": 1},
    ]
    libro = [paso(1, 50, bib="7"), paso(1, 51, bib="12"), paso(1, 52, bib="3"),
             paso(2, 48, bib="7"), paso(2, 53, bib="12")]
    salida = resultados.armar(CARRERA, corredores, libro)
    assert [c["bib"] for c in salida["corredores"]] == ["012", "007", "003"]
    assert salida["corredores"][0]["tiempos"] == [51 * 60, 53 * 60]
    assert salida["corredores"][1]["tiempos"] == [50 * 60, 48 * 60]
    assert salida["carrera"]["code"] == "MUNDIAL-2026"
    assert salida["carrera"]["salida"].startswith("2026-10-17T08:00:00-04:00")
    assert salida["carrera"]["km_por_vuelta"] == 6.706
