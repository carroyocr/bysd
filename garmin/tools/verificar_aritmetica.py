#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Puerto de la aritmetica de RaceState, para comprobarla sin reloj.

Las campanas van ancladas al reloj de pared: al dar la salida, el cero se
redondea a la marca de duracion-de-vuelta mas cercana, y desde ahi las vueltas
las abre la hora, no ningun boton. Esto comprueba ese redondeo, la proyeccion
de la vuelta con sus bordes (la campana exacta, los saltos largos, el corral)
y la regla de que solo vale un LAP por vuelta.
"""

DURACION = 3600
AVISOS_CORRAL = [180, 120, 60]

fallos = []


def comprobar(nombre, obtenido, esperado):
    if obtenido != esperado:
        fallos.append("%s: sale %r, deberia ser %r" % (nombre, obtenido, esperado))


# --- el ancla: RaceState.darLaSalida() ---------------------------------------

def ancla(epoch_ahora, desde_medianoche, duracion=DURACION):
    """Redondea a la marca de duracion mas cercana del reloj de pared."""
    resto = desde_medianoche % duracion
    if resto < duracion / 2:
        return epoch_ahora - resto
    return epoch_ahora + (duracion - resto)


# START a las 8:03:20 -> el ancla es 8:00 y la vuelta ya corre.
h8 = 8 * 3600
comprobar("salida tarde", ancla(1000200, h8 + 200), 1000000)
# START a las 7:58 -> el ancla tambien es 8:00, que aun no llega.
comprobar("salida temprano", ancla(999880, h8 - 120), 1000000)
# START clavado en la campana.
comprobar("salida exacta", ancla(1000000, h8), 1000000)
# Vueltas de 30 min: a las 8:20 el ancla es 8:30; a las 8:10, 8:00.
comprobar("30 min, 8:20", ancla(1001200, h8 + 1200, 1800), 1001800)
comprobar("30 min, 8:10", ancla(1000600, h8 + 600, 1800), 1000000)


# --- la proyeccion: RaceState.proyeccion() -----------------------------------

def proyeccion(s, duracion=DURACION):
    """s = segundos desde el ancla; negativo si la campana no ha sonado."""
    if s is None or duracion <= 0:
        return None
    if s < 0:
        return [0, -s]
    vuelta = (s // duracion) + 1
    restante = duracion - (s % duracion)
    return [vuelta, restante]


# Antes de la campana: vuelta 0 y la cuenta atras a la salida.
comprobar("2 min antes", proyeccion(-120), [0, 120])
# El primer segundo ya es vuelta 1, con la hora casi entera por delante.
comprobar("s=1", proyeccion(1), [1, 3599])
# La campana exacta: el segundo 3600 es vuelta 2 con la hora entera por
# delante, no vuelta 2 con cero.
comprobar("s=3599", proyeccion(3599), [1, 1])
comprobar("s=3600", proyeccion(3600), [2, 3600])
comprobar("s=3601", proyeccion(3601), [2, 3599])
# Treinta horas: una division, no un bucle.
comprobar("30 h", proyeccion(30 * 3600), [31, 3600])
comprobar("30 h + 10 min", proyeccion(30 * 3600 + 600), [31, 3000])
# El corral entra a los tres minutos justos y no se queda pegado.
for seg, dentro in [(3419, False), (3420, True), (3599, True), (3600, False)]:
    comprobar("corral en s=%d" % seg,
              proyeccion(seg)[1] <= AVISOS_CORRAL[0], dentro)
# Vueltas de otra duracion.
comprobar("30 min, s=1800", proyeccion(1800, 1800), [2, 1800])
comprobar("30 min, s=1799", proyeccion(1799, 1800), [1, 1])


# --- solo vale un LAP por vuelta: RaceState.marcarVuelta() -------------------

class Marca:
    def __init__(self):
        self.vuelta_marcada = 0

    def marcar(self, vuelta):
        if vuelta is None or vuelta < 1 or vuelta == self.vuelta_marcada:
            return False
        self.vuelta_marcada = vuelta
        return True


m = Marca()
comprobar("LAP antes de la salida", m.marcar(0), False)
comprobar("primer LAP de la vuelta 1", m.marcar(1), True)
comprobar("segundo LAP, ignorado", m.marcar(1), False)
comprobar("tercero, ignorado", m.marcar(1), False)
comprobar("primer LAP de la vuelta 2", m.marcar(2), True)
comprobar("y sus repetidos, ignorados", m.marcar(2), False)

# Completadas: vuelta - 1, mas la actual si ya se marco.
def completadas(vuelta, marcada):
    return (vuelta - 1) + (1 if marcada else 0)

comprobar("en carrera, vuelta 3", completadas(3, False), 2)
comprobar("vuelta 3 ya marcada", completadas(3, True), 3)


if fallos:
    print("FALLOS:")
    for f in fallos:
        print("  " + f)
    raise SystemExit(1)
print("La aritmetica cuadra en los 27 casos.")
