#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Reconstruye un FIT de actividad desde un GPX sin tiempos.

Strava quita las marcas de tiempo al exportar el GPX de otra persona, pero
los puntos quedan a uno por segundo. Este script les devuelve el reloj
(un segundo por punto) y escribe un FIT de actividad que el simulador de
Connect IQ puede reproducir (Simulation -> Activity Data -> Play a FIT file).

    python3 tools/gpx_a_fit.py <entrada.gpx> <salida.fit> [paso]

`paso` comprime el tiempo: 6 toma un punto de cada seis y deja los segundos
a 1, o sea la misma carrera a 6x. Con el backyard de 30 vueltas (vuelta de
~60 min), paso 6 da una vuelta cada ~10 minutos.
"""
import math
import re
import sys
import time

from fit_tool.fit_file_builder import FitFileBuilder
from fit_tool.profile.messages.activity_message import ActivityMessage
from fit_tool.profile.messages.event_message import EventMessage
from fit_tool.profile.messages.file_id_message import FileIdMessage
from fit_tool.profile.messages.record_message import RecordMessage
from fit_tool.profile.messages.session_message import SessionMessage
from fit_tool.profile.profile_type import Event, EventType, FileType, Sport


def haversine_m(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    x = (math.sin((la2 - la1) / 2) ** 2
         + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2)
    return 6371000.0 * 2.0 * math.asin(math.sqrt(x))


def leer_gpx(ruta):
    con_ele = re.compile(
        r'<trkpt lat="([-\d.]+)" lon="([-\d.]+)">\s*<ele>([-\d.]+)</ele>')
    with open(ruta) as f:
        texto = f.read()
    pts = [(float(m.group(1)), float(m.group(2)), float(m.group(3)))
           for m in con_ele.finditer(texto)]
    if not pts:
        sin_ele = re.compile(r'<trkpt lat="([-\d.]+)" lon="([-\d.]+)"')
        pts = [(float(m.group(1)), float(m.group(2)), 0.0)
               for m in sin_ele.finditer(texto)]
    return pts


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    entrada, salida = sys.argv[1], sys.argv[2]
    paso = int(sys.argv[3]) if len(sys.argv) > 3 else 1

    pts = leer_gpx(entrada)[::paso]
    print("%d puntos (paso %d)" % (len(pts), paso))

    # El cero del FIT da igual para la app (las campanas van con el reloj de
    # pared del simulador), pero un FIT quiere tiempos absolutos: se ancla al
    # momento de la conversion, redondeado al minuto.
    t0_ms = int(time.time() // 60 * 60) * 1000

    builder = FitFileBuilder(auto_define=True, min_string_size=50)

    file_id = FileIdMessage()
    file_id.type = FileType.ACTIVITY
    file_id.manufacturer = 255  # development
    file_id.product = 0
    file_id.serial_number = 1
    file_id.time_created = t0_ms
    builder.add(file_id)

    arranque = EventMessage()
    arranque.event = Event.TIMER
    arranque.event_type = EventType.START
    arranque.timestamp = t0_ms
    builder.add(arranque)

    total = 0.0
    registros = []
    anterior = None
    for i, p in enumerate(pts):
        if anterior is not None:
            total += haversine_m(anterior[:2], p[:2])
        anterior = p
        r = RecordMessage()
        r.timestamp = t0_ms + i * 1000
        r.position_lat = p[0]
        r.position_long = p[1]
        r.altitude = p[2]
        r.distance = total
        # Velocidad suavizada sobre los ultimos 5 segundos, que es lo que
        # haria el reloj; el primer punto queda en 0.
        atras = max(0, i - 5)
        if i > 0 and registros:
            vel = (total - registros[atras].distance) / float(i - atras)
            # Un hueco de GPS comprimido puede dar un salto absurdo, y el
            # campo speed del FIT no pasa de 65.5 m/s. Tope de sprint.
            r.speed = max(0.0, min(vel, 12.0))
        else:
            r.speed = 0.0
        registros.append(r)
    builder.add_all(registros)

    fin = EventMessage()
    fin.event = Event.TIMER
    fin.event_type = EventType.STOP_ALL
    fin.timestamp = t0_ms + len(pts) * 1000
    builder.add(fin)

    sesion = SessionMessage()
    sesion.timestamp = t0_ms + len(pts) * 1000
    sesion.start_time = t0_ms
    sesion.total_elapsed_time = float(len(pts))
    sesion.total_timer_time = float(len(pts))
    sesion.total_distance = total
    sesion.sport = Sport.RUNNING
    builder.add(sesion)

    actividad = ActivityMessage()
    actividad.timestamp = t0_ms + len(pts) * 1000
    actividad.total_timer_time = float(len(pts))
    actividad.num_sessions = 1
    builder.add(actividad)

    builder.build().to_file(salida)
    h = len(pts) // 3600
    m = (len(pts) % 3600) // 60
    print("%s: %.1f km en %d:%02d h" % (salida, total / 1000.0, h, m))


if __name__ == "__main__":
    main()
