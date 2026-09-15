"""Cuanta comida hay que pedir para los voluntarios.

El calculo sale de los turnos asignados, no de una lista aparte: si se mueve
un turno, la cuenta cambia sola. Las reglas las puso la organizacion:

  - Un refrigerio por cada turno de 4 horas o mas.
  - Dos turnos seguidos que van de madrugada a mañana: desayuno.
  - Dos turnos seguidos que van de mañana a tarde: almuerzo.
  - Dos turnos seguidos que van de tarde a noche: cena.
  - Quien tiene un solo turno, o turnos sueltos, se queda con su refrigerio.

Las comidas se suman al refrigerio, no lo sustituyen: quien cubre 08:00 a
16:00 recibe dos refrigerios y un almuerzo.

La franja de un turno la decide su hora de inicio, no su duracion: el turno de
04:00 a 08:00 es de madrugada aunque termine de mañana. Es lo que hace que la
pareja 04-08 + 08-12 sea "madrugada a mañana" y pida desayuno.

Aqui no se habla con la base de datos: entran turnos ya leidos y salen
cuentas, para poder probarlo sin levantar nada.
"""
from datetime import date

# Franjas por hora de inicio del turno
FRANJAS = (
    (0, "madrugada"),
    (6 * 60, "mañana"),
    (12 * 60, "tarde"),
    (18 * 60, "noche"),
)

# Que comida genera cada salto de franja entre dos turnos seguidos
COMIDA_DEL_SALTO = {
    ("madrugada", "mañana"): "desayuno",
    ("mañana", "tarde"): "almuerzo",
    ("tarde", "noche"): "cena",
}

COMIDAS = ("desayuno", "almuerzo", "cena")

# Un turno da refrigerio a partir de esta duracion
REFRIGERIO_DESDE_MIN = 4 * 60

# Los refrigerios no se reparten turno por turno, sino en cuatro momentos fijos
# del dia: uno solo abre la mesa y pasan todos los que les toca.
HORAS_REFRIGERIO = (
    1 * 60,            # 01:00, la madrugada
    9 * 60 + 30,       # 09:30, la mañana
    14 * 60 + 30,      # 14:30, la tarde
    20 * 60 + 30,      # 20:30, la noche
)

# Hasta aqui dos turnos se consideran la misma jornada. Los horarios reales no
# siempre encajan al minuto (hay turnos que abren 07:30 y otros 08:00), y media
# hora de hueco no es irse a casa.
HUECO_CONTINUO_MIN = 30

# A que dia del evento pertenece cada tipo de dia, para poder comparar turnos
# de dias distintos. Mismos valores que en routes/volunteer_config.py.
DIA_TIPO_OFFSET = {
    "previo": -1,
    "carrera": 0,
    "carrera_dia1": 0,
    "carrera_dia2": 1,
    "carrera_dia3": 2,
}

ETIQUETA_DIA_TIPO = {
    -1: "Día previo",
    0: "Día 1",
    1: "Día 2",
    2: "Día 3",
}


def _minutos(hora) -> int:
    """'08:00' o '08:00:00' -> minutos desde medianoche."""
    try:
        partes = str(hora or "0:0").split(":")
        return int(partes[0]) * 60 + int(partes[1])
    except (ValueError, IndexError):
        return 0


def _hhmm(hora) -> str:
    minutos = _minutos(hora)
    return f"{minutos // 60:02d}:{minutos % 60:02d}"


def _ordinal_fecha(valor):
    """Ordinal de la fecha del turno, si el turno trae fecha."""
    if not valor:
        return None
    try:
        return date.fromisoformat(str(valor)[:10]).toordinal()
    except ValueError:
        return None


def franja(minuto_inicio: int) -> str:
    """Franja del dia a la que pertenece un turno que empieza a esa hora."""
    del_dia = minuto_inicio % 1440
    nombre = FRANJAS[0][1]
    for desde, etiqueta in FRANJAS:
        if del_dia >= desde:
            nombre = etiqueta
    return nombre


def base_del_evento(turnos) -> int:
    """Fecha mas temprana entre los turnos que la traen, como ordinal.

    Los turnos viejos guardan la fecha (`dia`) y los nuevos solo a que dia del
    evento pertenecen (`dia_tipo`). Para poder ordenarlos juntos se toma la
    primera fecha como dia 1; si ningun turno trae fecha, el eje es el propio
    `dia_tipo`.
    """
    ordinales = [o for o in (_ordinal_fecha(t.get("dia")) for t in turnos) if o]
    return min(ordinales) if ordinales else 0


def intervalo(turno: dict, base: int = 0) -> tuple:
    """(inicio, fin) del turno en minutos, contados desde el dia 1 del evento.

    Un turno que termina antes de empezar cruza la medianoche (20:00 a 00:00).
    """
    ordinal = _ordinal_fecha(turno.get("dia"))
    if ordinal is not None and base:
        dia = ordinal - base
    elif ordinal is not None:
        dia = 0
    else:
        dia = DIA_TIPO_OFFSET.get(turno.get("dia_tipo") or "carrera", 0)

    inicio = dia * 1440 + _minutos(turno.get("hora_inicio"))
    fin = dia * 1440 + _minutos(turno.get("hora_fin"))
    if fin <= inicio:
        fin += 1440
    return inicio, fin


def etiqueta_dia(minuto: int, base: int) -> str:
    """Nombre del dia al que cae ese minuto: la fecha, o 'Día 1' si no la hay."""
    indice = minuto // 1440
    if base:
        return date.fromordinal(base + indice).isoformat()
    return ETIQUETA_DIA_TIPO.get(indice, f"Día {indice + 1}")


def hora_de_reparto(inicio: int, fin: int) -> int:
    """En cual de los cuatro repartos recoge su refrigerio quien cubre ese turno.

    El de su turno, si dentro del turno cae uno. Si no cae ninguno (pasa con el
    turno de 16:00 a 20:00 y con el de 04:00 a 08:00), el mas cercano, y en un
    empate el posterior: nadie recoge su refrigerio antes de entrar a trabajar.
    """
    dia = inicio // 1440
    candidatos = [
        (dia + desplazamiento) * 1440 + hora
        for desplazamiento in (-1, 0, 1)
        for hora in HORAS_REFRIGERIO
    ]

    dentro = [c for c in candidatos if inicio <= c < fin]
    if dentro:
        return min(dentro)

    def distancia(candidato):
        if candidato < inicio:
            return (inicio - candidato, 1)   # antes de entrar: se cede el empate
        return (candidato - fin, 0)

    return min(candidatos, key=distancia)


def _fundir_entregas(entregas: list) -> list:
    """Dos raciones iguales en el mismo reparto son una linea de dos.

    Pasa con quien encadena 04-08 y 08-12: los dos refrigerios le tocan en la
    mesa de las 9:30, y en la hoja de reparto su nombre debe salir una vez.
    """
    fundidas = {}
    for entrega in entregas:
        clave = (entrega["minuto"], entrega["tipo"])
        if clave in fundidas:
            fundidas[clave]["cantidad"] += entrega["cantidad"]
            fundidas[clave]["turnos_origen"] += entrega["turnos_origen"]
        else:
            fundidas[clave] = {**entrega, "turnos_origen": list(entrega["turnos_origen"])}
    return [fundidas[c] for c in sorted(fundidas)]


def _jornadas(turnos_ordenados) -> list:
    """Parte los turnos en bloques de trabajo continuo."""
    bloques = []
    for turno in turnos_ordenados:
        if bloques and turno["inicio"] - bloques[-1][-1]["fin"] <= HUECO_CONTINUO_MIN:
            bloques[-1].append(turno)
        else:
            bloques.append([turno])
    return bloques


def calcular_voluntario(turnos: list, base: int = 0) -> dict:
    """Comida que le toca a una persona por los turnos que tiene asignados."""
    ordenados = []
    for turno in turnos:
        inicio, fin = intervalo(turno, base)
        ordenados.append({
            "inicio": inicio,
            "fin": fin,
            "franja": franja(inicio),
            "puesto": turno.get("puesto", ""),
            "turno": turno.get("turno", ""),
            "horario": f"{_hhmm(turno.get('hora_inicio'))}-{_hhmm(turno.get('hora_fin'))}",
        })
    ordenados.sort(key=lambda t: (t["inicio"], t["fin"]))

    cuenta = {"refrigerio": 0, "desayuno": 0, "almuerzo": 0, "cena": 0}
    por_dia = {}
    entregas = []

    def anotar(tipo, turno, minuto):
        """Apunta una racion, y cuando y donde se entrega.

        El refrigerio se recoge en uno de los cuatro repartos del dia. La
        comida se entrega al empezar el turno al que se entra, que es justo el
        cambio de turno: el almuerzo de quien encadena 08-12 con 12-16 se
        reparte a las 12:00, cuando llega a su segundo puesto.
        """
        cuenta[tipo] += 1
        dia = por_dia.setdefault(minuto // 1440, {"refrigerio": 0, "desayuno": 0, "almuerzo": 0, "cena": 0})
        dia[tipo] += 1
        entregas.append({
            "tipo": tipo,
            "minuto": minuto,
            "cantidad": 1,
            "puesto": turno["puesto"],
            "turno": turno["turno"],
            "horario": turno["horario"],
            # De que turno sale la racion, para poder listarla en el reporte
            # que se le manda al coordinador de ese puesto.
            "turnos_origen": [turno["inicio"]],
        })

    # Nadie come dos veces a la misma hora. Un voluntario puede aparecer en dos
    # puestos que se pisan (el panel de asignaciones lo marca como conflicto) y
    # eso no son dos refrigerios: es una persona.
    fin_del_ultimo_refrigerio = None
    for turno in ordenados:
        if turno["fin"] - turno["inicio"] < REFRIGERIO_DESDE_MIN:
            continue
        if fin_del_ultimo_refrigerio is not None and turno["inicio"] < fin_del_ultimo_refrigerio:
            continue
        anotar("refrigerio", turno, hora_de_reparto(turno["inicio"], turno["fin"]))
        fin_del_ultimo_refrigerio = turno["fin"]

    jornadas = _jornadas(ordenados)
    for bloque in jornadas:
        for anterior, siguiente in zip(bloque, bloque[1:]):
            comida = COMIDA_DEL_SALTO.get((anterior["franja"], siguiente["franja"]))
            if comida:
                # La comida se sirve en el turno al que se entra, que es el que
                # dice de que dia es ese almuerzo o esa cena.
                anotar(comida, siguiente, siguiente["inicio"])

    return {
        **cuenta,
        "total_comidas": sum(cuenta[c] for c in COMIDAS),
        "turnos": len(ordenados),
        "minutos": sum(t["fin"] - t["inicio"] for t in ordenados),
        "jornadas": [
            {
                "inicio": bloque[0]["inicio"],
                "fin": bloque[-1]["fin"],
                "turnos": len(bloque),
            }
            for bloque in jornadas
        ],
        "detalle_turnos": ordenados,
        "por_dia": por_dia,
        "entregas": _fundir_entregas(entregas),
    }


def calcular(turnos_por_persona: dict, base: int = 0) -> dict:
    """Cuenta de todos: {email: [turnos]} -> totales, por dia y por persona."""
    personas = {}
    totales = {"refrigerio": 0, "desayuno": 0, "almuerzo": 0, "cena": 0}
    por_dia = {}

    for email, turnos in turnos_por_persona.items():
        cuenta = calcular_voluntario(turnos, base)
        personas[email] = cuenta
        for tipo in totales:
            totales[tipo] += cuenta[tipo]
        for indice, dia in cuenta["por_dia"].items():
            acumulado = por_dia.setdefault(indice, {"refrigerio": 0, "desayuno": 0, "almuerzo": 0, "cena": 0})
            for tipo, valor in dia.items():
                acumulado[tipo] += valor

    return {
        "totales": {
            **totales,
            "total_comidas": sum(totales[c] for c in COMIDAS),
            "voluntarios": len(personas),
        },
        "por_dia": por_dia,
        "personas": personas,
    }
