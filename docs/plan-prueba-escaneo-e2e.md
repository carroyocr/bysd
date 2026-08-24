# Plan de prueba de punta a punta — Sistema de escaneo (app móvil, producción)

**Objetivo:** probar el escaneo completo desde el celular contra la base de
producción: vueltas, DNF, notificaciones push, publicación de resultados y el
modo fuera de línea. En iOS y Android, con red y sin red.

**Principio de aislamiento:** todo se hace sobre una **carrera de prueba**
(`TEST-2026`). Cada dato del sistema viaja con su `race_code`, así que las
carreras reales (Mundial y enero) no se tocan, y `is_active` no se mueve: el
sitio público sigue mostrando lo de siempre. La limpieza final es borrar por
`race_code`.

**Advertencia de visibilidad:** la carrera de prueba SÍ aparecerá en el
acordeón "Evento" de la app para cualquier usuario real que la abra durante la
ventana de prueba (TestFlight y App Store). Mitigación: llamarla claramente
`PRUEBA INTERNA — ignorar`, hacer la prueba en una ventana corta (una tarde) y
borrarla al terminar.

---

## Fase 0 — Despliegue previo (requisito)

Las funciones nuevas (modo fuera de línea, sync, flujo de carrera) viven en la
rama `escaneo-fuera-de-linea` y **no están en producción**. Antes de probar:

1. **Respaldo de la base**: `mongodump` del Atlas (regla de la casa antes de
   tocar datos).
2. **Merge y push a `main`** → Render despliega backend (endpoint
   `/api/qr-scan/sync-offline`) y web. Los cambios son aditivos: no alteran el
   escaneo en línea existente.
3. **Compilar la app 1.3.3** (`yarn build:mobile`, nunca `yarn build`):
   - **iOS:** subir build a TestFlight como **prueba interna** (sin revisión de
     Apple, disponible en minutos) e instalarla en el iPhone.
   - **Android:** `./gradlew assembleRelease` (JDK 21 de Homebrew) → instalar
     el APK por USB (`adb install`). No hace falta pasar por Play.
4. **Verificar push en ambos**: Configuración → notificaciones activadas; el
   dispositivo debe quedar en `push_devices`.

## Fase 1 — Montar el escenario en producción

1. **Carrera de prueba** desde el panel (Configuración → nueva carrera):
   - Código `TEST-2026`, nombre `PRUEBA INTERNA — ignorar`.
   - `is_active` NO. Fecha: hoy. 60 min/vuelta, 6.7 km (valores reales: las
     reglas de "regreso temprano < 35 min" están calibradas para 60).
2. **El truco del reloj:** esperar 35+ minutos reales por vuelta haría la
   prueba eterna. En su lugar, después de dar la salida se ajusta `started_at`
   por Mongo para "viajar en el tiempo". Guion preparado (ver anexo): mover el
   inicio a `ahora − (N vueltas × 60 + M minutos)` coloca la carrera en la
   vuelta N+1, minuto M. Con M=40 los escaneos valen; con M=10 se prueba el
   DNF por regreso temprano.
3. **Corredores de prueba:** 3–4 inscripciones en `TEST-2026` con dorsales
   `901`–`904` (nombres tipo "Prueba Uno"). Correos: las cuentas demo
   (`…+demo@gmail.com` del App Review). **No usar** `pablotestaok` (persona
   real).
4. **QRs:** generarlos desde el panel (llevan `race=TEST-2026` dentro) y
   tenerlos impresos o en la pantalla de la Mac para escanearlos con el
   teléfono.
5. **Accesos:**
   - Staff: cuenta demo de staff con permiso `scanner` (dárselo en Usuarios).
   - Clave de escaneo de `TEST-2026` (panel → Control): para probar el camino
     "sin cuenta".
   - Espectador: cuenta demo espectador en el otro teléfono, con la carrera
     `TEST-2026` abierta, push activado y el dorsal `901` en favoritos (así
     `push_devices` queda apuntando a la carrera de prueba).
6. **Dar la salida** desde el panel (Control, con TEST-2026 seleccionada):
   pasa los inscritos a `active` y sella `started_at`. Después, aplicar el
   ajuste de reloj.

## Fase 2 — Matriz en línea

Roles: **iPhone = espectador** (recibe push), **Android = staff** (escanea).
A mitad de la fase, invertir los papeles para cubrir la matriz completa
(escanear desde iOS y recibir push en Android).

| # | Prueba | Resultado esperado |
|---|--------|--------------------|
| E1 | Escanear QR del 901 (vuelta válida, minuto ≥35) | Confirmación verde; vueltas y km suben en Seguimiento; **push llega al que sigue al 901** con la app cerrada |
| E2 | Repetir con otro dorsal desde el otro teléfono | Igual (cubre escáner iOS y Android) |
| E3 | Entrada manual del BIB | La confirmación llega con `race=TEST-2026` en la URL y anota en TEST |
| E4 | Dos teléfonos escanean el mismo dorsal casi a la vez | El segundo recibe "ya estaba registrada", sin error feo |
| E5 | Ajustar reloj a minuto 10 y escanear | Aviso "regresó muy temprano" → confirmar → **DNF automático** + push de retiro |
| E6 | DNF manual (escribir "DNF") sobre otro dorsal | Retiro anotado + push |
| E7 | Ajustar reloj y escanear a quien ya completó la vuelta en curso | "La vuelta aún no ha iniciado. Debe esperar" |
| E8 | Panel: anular una vuelta y anotar una manual | El contador se recalcula; la app lo refleja al refrescar |

## Fase 3 — Fuera de línea (el corazón de la prueba)

En cada plataforma:

| # | Prueba | Resultado esperado |
|---|--------|--------------------|
| F1 | Con señal: "Descargar datos" (tarjeta del escáner y tarjeta "Usar sin señal" de Staff) | Muestra N corredores y hora; con cuenta staff baja también las fichas médicas |
| F2 | **Modo avión** → escanear QR | La cámara y la validación funcionan sin red; banner "FUERA DE LÍNEA"; confirmar → "Guardado en el teléfono" |
| F3 | Seguir escaneando otros dorsales en modo avión | Cada uno se encola; el mismo dorsal dos veces da "ya registrada" (local) |
| F4 | Consultar la cola en el escáner | Lista con dorsal, vuelta y hora de cada escaneo |
| F5 | En modo avión: Staff → Atletas y Equipo | Fichas médicas completas desde la copia, con el aviso naranja de cuándo se descargó |
| F6 | Quitar modo avión → "Sincronizar ahora" | Las vueltas entran al libro con la **hora original** del escaneo (verificar en el panel: pestaña Vueltas, columna hora); sin push (por diseño); la cola queda vacía |
| F7 | Provocar un conflicto: con el teléfono en avión, anotar por el panel una vuelta manual al mismo dorsal; luego sincronizar | El escaneo queda **en conflicto** en el teléfono con su motivo, y se puede descartar |
| F8 | Cargar un atleta con señal, activar avión, confirmar | El escaneo se guarda en la cola en vez de perderse ("Sin señal: quedó guardado") |
| F9 | Cerrar y reabrir la app con cola pendiente | La cola sobrevive (persistencia) |

## Fase 4 — Resultados

1. Simular el final: dejar un solo corredor activo (DNF a los demás).
2. Declarar **ganador** desde el panel → verificar pantalla Ganadores en la
   app, push de ganador (si aplica) y resultados.
3. **Cerrar la carrera** (`/api/race-config/close/TEST-2026`) → el reloj se
   congela, nada se mueve ni se borra.

## Fase 5 — Limpieza

1. Borrar por `race_code = TEST-2026` en: `race_configurations`,
   `registrations`, `lap_registrations`, `cheer_messages`, `live_photos` (si
   hubo), y las entradas de `push_devices` cuyo `race_code` sea TEST (o
   simplemente reabrir la app con una carrera real, que re-registra el
   dispositivo).
2. Quitar el permiso `scanner` extra si se le dio a alguna cuenta demo.
3. Verificar que el sitio público y la app siguen mostrando lo de siempre.

---

## Anexo — Guion de "viaje en el tiempo" (correr en la Mac)

```bash
# Coloca la carrera TEST-2026 en la vuelta N, minuto M (producción)
# Uso: editar VUELTA y MINUTO y ejecutar. URI: bysd-secretos/atlas_propio_url.txt
cd ~/Proyectos/bysd/backend && .venv/bin/python - <<'EOF'
import asyncio, os
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient

VUELTA, MINUTO = 2, 40   # <-- vuelta en curso y minuto dentro de ella

uri = open(os.path.expanduser('~/Proyectos/bysd-secretos/atlas_propio_url.txt')).read().strip()
async def main():
    db = AsyncIOMotorClient(uri).backyard_ultra
    inicio = datetime.now(timezone.utc) - timedelta(minutes=(VUELTA - 1) * 60 + MINUTO)
    r = await db.race_configurations.update_one(
        {'code': 'TEST-2026'}, {'$set': {'started_at': inicio}})
    print('ajustado' if r.modified_count else 'ojo: carrera no encontrada',
          '- vuelta', VUELTA, 'minuto', MINUTO)
asyncio.run(main())
EOF
```

**Ojo con el modo fuera de línea y el reloj:** el teléfono calcula la vuelta
con el `started_at` que descargó. Después de cada ajuste de reloj, tocar
"Actualizar datos descargados" antes de escanear sin red.

## Qué necesita cada dispositivo

| | iPhone | Android |
|---|---|---|
| App | 1.3.3 por TestFlight interno | 1.3.3 por APK (adb) |
| Push | APNs producción (ya validado) | FCM directo |
| Cuentas | espectador demo ↔ staff demo (se intercambian a mitad) | ídem |
| Papel fase 3 | escáner offline y fichas | escáner offline y fichas |

**Duración estimada:** montaje 45 min, fases 2–4 unas 2 horas, limpieza 15 min.
