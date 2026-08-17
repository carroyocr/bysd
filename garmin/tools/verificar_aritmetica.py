#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Puerto de la aritmetica nueva de RaceState, para comprobarla sin reloj.

Lo que cambio de raiz al quitar el servidor es de donde sale el cero de la
carrera y como se proyecta la vuelta. Antes venia sembrado ("en la vuelta N le
quedaban R segundos"); ahora sale del cronometro de la actividad. Esto
comprueba esa cuenta y los bordes que importan: la campana exacta, el corral y
el realineo del cero.
"""

DURACION = 3600
AVISOS_CORRAL = [180, 120, 60]

fallos = []


def proyeccion(elapsed_ms, desfase, duracion=DURACION):
    """RaceState.proyeccion(), tal cual."""
    # El cero cuenta como "todavia nada": sin actividad el simulador devuelve 0
    # en vez de null, y sin este filtro la app dibuja una vuelta 1 parada.
    if elapsed_ms is None or elapsed_ms <= 0 or duracion <= 0:
        return None
    s = (elapsed_ms // 1000) - desfase
    if s <= 0:
        s = 0
    vuelta = (s // duracion) + 1
    restante = duracion - (s % duracion)
    return [vuelta, restante]


def comprobar(nombre, obtenido, esperado):
    if obtenido != esperado:
        fallos.append("%s: sale %r, deberia ser %r" % (nombre, obtenido, esperado))


# --- sin actividad no hay carrera -------------------------------------------
comprobar("sin actividad", proyeccion(None, 0), None)
comprobar("actividad en cero", proyeccion(0, 0), None)

# --- la campana de salida ----------------------------------------------------
# El primer segundo ya es vuelta 1, con la hora casi entera por delante.
comprobar("s=1", proyeccion(1000, 0), [1, 3599])

# --- la campana de la vuelta 2 ----------------------------------------------
# El segundo anterior sigue siendo vuelta 1 con un segundo; el instante exacto
# ya es vuelta 2 con la hora entera, no vuelta 2 con cero segundos.
comprobar("s=3599", proyeccion(3599 * 1000, 0), [1, 1])
comprobar("s=3600", proyeccion(3600 * 1000, 0), [2, 3600])
comprobar("s=3601", proyeccion(3601 * 1000, 0), [2, 3599])

# --- treinta horas dentro ----------------------------------------------------
# La cuenta es una division, no un bucle: da igual lo lejos que este.
comprobar("30 h", proyeccion(30 * 3600 * 1000, 0), [31, 3600])
comprobar("30 h + 10 min", proyeccion((30 * 3600 + 600) * 1000, 0), [31, 3000])

# --- el corral ---------------------------------------------------------------
# Entra a los tres minutos justos y no antes.
for seg, dentro in [(3419, False), (3420, True), (3599, True)]:
    r = proyeccion(seg * 1000, 0)[1]
    comprobar("corral en s=%d" % seg, r <= AVISOS_CORRAL[0], dentro)
# Y no se queda pegado al pasar la campana.
comprobar("corral en s=3600", proyeccion(3600 * 1000, 0)[1] <= AVISOS_CORRAL[0], False)

# --- realinear el cero -------------------------------------------------------
# El corredor arranco la actividad 12 minutos antes de la campana y da la
# salida al sonar: desde ese instante empieza la vuelta 1 entera.
desfase = 720
comprobar("realineo, justo al sellar", proyeccion(720 * 1000, desfase), [1, 3600])
comprobar("realineo, +1 s", proyeccion(721 * 1000, desfase), [1, 3599])
comprobar("realineo, +1 h", proyeccion((720 + 3600) * 1000, desfase), [2, 3600])
# Antes del cero sellado no hay carrera negativa: se queda en la salida.
comprobar("antes del cero sellado", proyeccion(60 * 1000, desfase), [1, 3600])

# --- vueltas de otra duracion ------------------------------------------------
# Una backyard de vueltas de 30 minutos: la cuenta no supone nada.
comprobar("30 min, s=1800", proyeccion(1800 * 1000, 0, 1800), [2, 1800])
comprobar("30 min, s=1799", proyeccion(1799 * 1000, 0, 1800), [1, 1])

# --- vueltas completadas -----------------------------------------------------
# Es vuelta - 1, que es lo que dibujan las paginas.
for seg, completadas in [(1, 0), (3599, 0), (3600, 1), (7200, 2)]:
    comprobar("completadas en s=%d" % seg,
              proyeccion(seg * 1000, 0)[0] - 1, completadas)

if fallos:
    print("FALLOS:")
    for f in fallos:
        print("  " + f)
    raise SystemExit(1)
print("La aritmetica cuadra en los %d casos." % 25)
