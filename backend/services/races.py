"""Las carreras del sistema y la vuelta en la que va cada una.

Un unico sitio donde se responde a dos preguntas que antes se contestaban de
formas distintas segun quien preguntara: **sobre que carrera estoy trabajando**
y **en que vuelta va**.

Antes ambas colgaban del mismo booleano `is_active`, que hacia tres trabajos a
la vez: decidir que carrera ve el publico, sobre cual trabaja el panel y sobre
cual escanea el QR. Al ser uno solo, no podia haber dos carreras vivas: activar
el campeonato mundial de octubre habria tumbado la pagina de inscripcion de la
carrera de enero. Aqui se separan:

- `is_active` conserva un unico significado: **la carrera que muestra el sitio
  publico**. Por eso las pantallas publicas no cambian.
- El panel manda su `race_code` en cada llamada (lo elige en la cabecera).
- El escaner manda el `race_code` que viene dentro del propio QR.

Y la vuelta actual tiene una sola autoridad: **el reloj**, contado desde la hora
real de salida. Antes habia dos que podian discrepar -- un contador manual en la
coleccion `race_config` y este calculo por reloj en el escaner -- y bastaba con
que a alguien se le olvidara avanzar el contador para que el escaner empezara a
rechazar vueltas buenas o a marcar retiros que no eran.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, Query

# Una backyard ultra es una vuelta por hora en punto; la distancia del anillo
# puede cambiar de una sede a otra, asi que sale de la ficha de la carrera.
MINUTOS_POR_VUELTA = 60
KM_POR_VUELTA = 6.7

# Volver antes de este minuto significa que el corredor abandono el anillo:
# no completo la vuelta, se retira.
MINUTOS_MINIMOS_POR_VUELTA = 35

# Ciclo de vida de una carrera. Varias pueden convivir en estados distintos:
# el mundial puede estar `en_carrera` mientras la edicion de enero sigue en
# `inscripcion`.
ESTADOS = ("borrador", "inscripcion", "en_carrera", "cerrada")
ESTADO_POR_DEFECTO = "inscripcion"

# La primera edicion nunca llego a tener ficha propia: se inventaba en el codigo
# cada vez que hacia falta. Sus resultados si existen (coleccion `participants`)
# y la app los pide por su codigo, asi que aqui queda una sola definicion en vez
# de las copias que habia repartidas. La migracion la guarda como fila normal;
# esto es el respaldo por si se consulta antes.
CARRERAS_HISTORICAS = {
    "BYSD-2026": {
        "code": "BYSD-2026",
        "name": "Backyard Ultra Santo Domingo 2026",
        "date": "2026-01-24",
        "start_time": "09:00",
        "location": "Parque del Este, Santo Domingo, República Dominicana",
        "logo_url": "/icon-bu.png",
        "timezone_gmt": "GMT-4",
        "is_active": False,
        "is_legacy": True,
        "estado": "cerrada",
        "archived_at": "2026-01-25T00:00:00",
    }
}


# ============= LA CARRERA =============


async def obtener_carrera(database, code: str) -> dict:
    """Ficha de una carrera por su codigo. 404 si no existe."""
    if not code:
        raise HTTPException(status_code=400, detail="Falta el codigo de la carrera")

    codigo = code.upper()
    carrera = await database.race_configurations.find_one({"code": codigo})
    if carrera:
        return carrera

    if codigo in CARRERAS_HISTORICAS:
        return dict(CARRERAS_HISTORICAS[codigo])

    raise HTTPException(status_code=404, detail=f"Carrera {code} no encontrada")


async def carrera_publica(database) -> Optional[dict]:
    """La carrera que muestra el sitio publico (la marcada `is_active`)."""
    return await database.race_configurations.find_one({"is_active": True})


async def carrera_del_panel(
    race_code: str = Query(..., description="Carrera sobre la que se trabaja"),
) -> str:
    """Dependencia para endpoints del panel: exige decir sobre que carrera.

    Sin esto un endpoint caia en silencio sobre la carrera activa, que ya no
    tiene por que ser la que el administrador esta mirando en pantalla. Es
    preferible un error claro a escribir vueltas en la carrera equivocada.
    """
    if not race_code or not race_code.strip():
        raise HTTPException(
            status_code=400,
            detail="Falta indicar sobre que carrera se trabaja (race_code)",
        )
    return race_code.strip().upper()


async def resolver_carrera(database, race_code: Optional[str]) -> dict:
    """Para endpoints publicos y para la app: la pedida, o la del sitio.

    La app movil ya manda `race_code` en casi todo, pero esta desplegada en los
    telefonos y no se puede actualizar a la fuerza: si alguna pantalla vieja no
    lo manda, cae en la carrera publica, que es lo que esa pantalla esperaba.
    """
    if race_code:
        return await obtener_carrera(database, race_code)

    carrera = await carrera_publica(database)
    if not carrera:
        raise HTTPException(status_code=400, detail="No hay ninguna carrera publicada")
    return carrera


def km_por_vuelta(carrera: dict) -> float:
    return float((carrera or {}).get("km_por_vuelta") or KM_POR_VUELTA)


def minutos_por_vuelta(carrera: dict) -> int:
    return int((carrera or {}).get("minutos_por_vuelta") or MINUTOS_POR_VUELTA)


def estado(carrera: dict) -> str:
    return (carrera or {}).get("estado") or ESTADO_POR_DEFECTO


# ============= EL RELOJ DE LA CARRERA =============


def desfase_horario(carrera: dict) -> int:
    """Horas de desfase de la sede, a partir de 'GMT-4' y similares."""
    texto = (carrera or {}).get("timezone_gmt") or "GMT-4"
    texto = texto.upper().replace("GMT", "").replace("UTC", "").strip()
    try:
        return int(texto)
    except ValueError:
        return -4


def zona_horaria(carrera: dict) -> timezone:
    return timezone(timedelta(hours=desfase_horario(carrera)))


def ahora_en_carrera(carrera: dict) -> datetime:
    """La hora local de la sede, no la del servidor."""
    return datetime.now(zona_horaria(carrera))


def hora_local_str(carrera: dict) -> str:
    return ahora_en_carrera(carrera).strftime("%H:%M:%S")


def hora_de_salida(carrera: dict) -> Optional[datetime]:
    """Cuando arranco la carrera de verdad.

    `started_at` es la hora que se sella al pulsar "Iniciar carrera": es la que
    manda, porque una salida se retrasa con mas facilidad de la que se corrige
    la ficha. Mientras nadie la haya pulsado se usa la hora prevista, que es lo
    que se venia haciendo.
    """
    tz = zona_horaria(carrera)

    sellada = (carrera or {}).get("started_at")
    if isinstance(sellada, datetime):
        # Mongo devuelve las fechas sin zona: son UTC.
        if sellada.tzinfo is None:
            sellada = sellada.replace(tzinfo=timezone.utc)
        return sellada.astimezone(tz)

    fecha = (carrera or {}).get("date")
    if not fecha:
        return None

    try:
        prevista = datetime.strptime(
            f"{fecha} {(carrera or {}).get('start_time') or '09:00'}", "%Y-%m-%d %H:%M"
        )
    except ValueError:
        return None

    return prevista.replace(tzinfo=tz)


def hora_de_llegada(carrera: dict) -> Optional[datetime]:
    """Cuando se dio la carrera por terminada, si ya termino."""
    sellada = (carrera or {}).get("finished_at")
    if isinstance(sellada, datetime):
        if sellada.tzinfo is None:
            sellada = sellada.replace(tzinfo=timezone.utc)
        return sellada.astimezone(zona_horaria(carrera))
    return None


# Los mensajes de animo son para la carrera, no para siempre: pasado un mes
# de la llegada, el hilo de cada corredor se cierra y queda como archivo.
DIAS_DE_ANIMO_TRAS_LA_CARRERA = 30


def cierre_de_animos(carrera: dict) -> Optional[datetime]:
    """Hasta cuando se pueden mandar mensajes de animo a esta carrera.

    Se cuenta desde `finished_at`, la hora que se sella al cerrar la carrera.
    Si nadie la cerro se cuenta desde la salida, que para esto sirve igual: una
    backyard dura dias, no un mes, asi que el margen sigue siendo holgado.

    Devuelve None cuando la carrera no tiene ni salida ni fecha: sin reloj no
    hay plazo que contar y los animos siguen abiertos.
    """
    referencia = hora_de_llegada(carrera) or hora_de_salida(carrera)
    if referencia is None:
        return None
    return referencia + timedelta(days=DIAS_DE_ANIMO_TRAS_LA_CARRERA)


def animos_cerrados(carrera: dict) -> bool:
    cierre = cierre_de_animos(carrera)
    if cierre is None:
        return False
    return ahora_en_carrera(carrera) > cierre


def vuelta_actual(carrera: dict) -> dict:
    """En que vuelta va la carrera segun el reloj, y cuanto queda de ella.

    Una carrera terminada deja de contar. Sin esto el reloj seguia corriendo
    para siempre: la edicion de enero de 2026 aparecia en la vuelta 4782, una
    por cada hora transcurrida desde aquel dia.
    """
    duracion = minutos_por_vuelta(carrera)
    salida = hora_de_salida(carrera)
    llegada = hora_de_llegada(carrera)
    ahora = llegada or ahora_en_carrera(carrera)

    if salida is None:
        # Sin fecha no hay reloj que valga: la carrera no ha empezado.
        return {
            "current_lap": 0,
            "race_started": False,
            "race_finished": False,
            "time_elapsed_minutes": 0,
            "minutes_into_lap": 0,
            "lap_start_time": None,
            "lap_end_time": None,
            "seconds_remaining": 0,
            "started_at": None,
            "finished_at": None,
        }

    if ahora < salida:
        return {
            "current_lap": 0,
            "race_started": False,
            "race_finished": False,
            "time_elapsed_minutes": 0,
            "minutes_into_lap": 0,
            "lap_start_time": salida,
            "lap_end_time": salida + timedelta(minutes=duracion),
            "seconds_remaining": int((salida - ahora).total_seconds()),
            "started_at": salida,
            "finished_at": None,
        }

    transcurridos = (ahora - salida).total_seconds() / 60
    vuelta = int(transcurridos // duracion) + 1
    dentro_de_la_vuelta = transcurridos % duracion

    return {
        "current_lap": vuelta,
        "race_started": True,
        "race_finished": llegada is not None,
        "time_elapsed_minutes": transcurridos,
        "minutes_into_lap": int(dentro_de_la_vuelta),
        "lap_start_time": salida + timedelta(minutes=(vuelta - 1) * duracion),
        "lap_end_time": salida + timedelta(minutes=vuelta * duracion),
        "seconds_remaining": 0 if llegada else int((duracion - dentro_de_la_vuelta) * 60),
        "started_at": salida,
        "finished_at": llegada,
    }
