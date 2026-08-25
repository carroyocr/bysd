# Publicar Backyard en la Connect IQ Store

Estado y guía para subir los dos productos a la tienda de Garmin. Actualizado
el 24 de agosto de 2026.

## Estado técnico — listo

- La **app** (`backyard.iq`) y el **campo de datos** (`backyard-margen.iq`)
  compilan para los **86 builds** de los 46 dispositivos, **sin un solo
  error**. Los paquetes de tienda están en `garmin/build/*.iq`.
- Firma con la developer key de `~/Proyectos/bysd-secretos/garmin/`.
- **Sin un solo aviso**, tampoco los del icono del lanzador: hay un icono por
  talla y cada reloj mapea al suyo. Ver la sección al final.

## Reparto de tareas

**Yo (hecho o automatizable):**
- Paquetes `.iq` de tienda generados. ✅
- Textos de la ficha (abajo). ✅
- Iconos por talla, si se decide hacerlos (mejora de calidad, no bloquea).

**Tú (requiere tu cuenta e identidad):**
1. Crear la **cuenta de desarrollador** en https://developer.garmin.com
   (gratis; hay una verificación de desarrollador que puede tardar).
2. **Capturas de pantalla** de cada producto (del reloj o del simulador).
3. Subir cada `.iq`, rellenar la ficha, aceptar los términos y **enviar a
   revisión**. La revisión de Garmin tarda unos días.

Son **dos fichas separadas**: la app y el campo de datos son productos
distintos con su propio id. Comparten la mitad del código, pero en la tienda
van por separado.

## Pasos en el portal (para cada producto)

1. Entra a https://apps.garmin.com/developer con tu cuenta.
2. **Upload an App** → sube el `.iq` correspondiente.
3. Rellena la ficha con los textos de abajo (nombre, resumen, descripción).
4. Elige **categoría** (Activity Tracking / Running) y las **capturas**.
5. Marca los **países** (los nuevos desarrolladores arrancan sin la UE; se
   amplía después).
6. Acepta los términos y **envía a revisión**.

Para una **beta**, hoy la beta de la tienda solo la descarga el propio
desarrollador; para que la prueben otros corredores, el reparto del `.prg`
por cable sigue siendo el camino. Ver el README para instalar por USB.

---

## Novedades de la versión 1.3.0 (para el campo "What's New")

Dieciséis relojes más, y por primera vez los **fēnix que no son AMOLED**: el
fēnix 8 Solar no podía ni encolar la descarga en la tienda porque el `.iq` no
llevaba build para él. Entra también la generación **fēnix 5 de 2017**, que
solo pedía bajar el `minApiLevel` de la app de 3.2.0 a 3.1.0 (el código no usa
nada por encima de 3.1). Ninguna familia de pantalla es nueva —218, 240, 260,
280, 390, 416 y 454 px ya estaban resueltas—, pero sí hubo dos arreglos que
solo se ven en relojes viejos: `Activity.SPORT_RUNNING` (no existe antes de
Connect IQ 3.2 y tumbaba la app al dar la salida) y las ruedas de ajustes, que
en las pantallas MIP salían en blanco sobre blanco.

**ES**

> - Dieciséis relojes más: fēnix 8 Solar (47 y 51 mm), fēnix 8 Pro, fēnix E,
>   fēnix 7 Pro, 7S Pro y 7X Pro (también las versiones sin wifi), epix Pro
>   (42, 47 y 51 mm) y la generación fēnix 5 de 2017 — fēnix 5, 5S y 5X, con
>   el tactix Charlie y el fēnix Chronos.
> - Las ruedas de los ajustes —hora de salida, duración y distancia— se ven
>   ahora en negro con cifras blancas en todos los relojes. En los de pantalla
>   MIP salían en blanco sobre blanco, ilegibles.

**EN**

> - Sixteen more watches: fēnix 8 Solar (47 and 51 mm), fēnix 8 Pro, fēnix E,
>   fēnix 7 Pro, 7S Pro and 7X Pro (no-wifi versions too), epix Pro (42, 47
>   and 51 mm), and the 2017 fēnix 5 generation — fēnix 5, 5S and 5X, plus
>   tactix Charlie and fēnix Chronos.
> - The settings wheels — start time, lap duration and distance — are now
>   black with white figures on every watch. On MIP screens they came out
>   white on white, unreadable.

---

## Novedades de la versión 1.2.0 (para el campo "What's New")

**ES**

> - Hora de salida definible, el primer ajuste: fija la hora de tu carrera y
>   las campanas quedan ancladas a ella — antes de esa hora todo es
>   calentamiento, y da igual cuándo pulses START. En Auto, el reloj la
>   deduce solo, como hasta ahora.
> - Seis relojes más: fēnix 5 Plus, 5S Plus y 5X Plus, y Forerunner 745,
>   945 y 945 LTE.

**EN**

> - Start time setting, first in the list: set your race's start time and
>   the bells anchor to it — everything before it is warm-up, no matter when
>   you press START. On Auto, the watch works it out by itself, as before.
> - Six more watches: fēnix 5 Plus, 5S Plus and 5X Plus, and Forerunner
>   745, 945 and 945 LTE.

---

## Novedades de la versión 1.1.0 (para el campo "What's New")

El paquete es `build/backyard.iq` (export de los 52 builds). La versión que
declara la app en "Acerca de" es la constante de `AcercaView.mc`: subir de
versión = actualizarla ahí y regenerar el `.iq`.

**ES**

> - La vuelta ahora se llama Yard, como en el evento, en los seis idiomas.
> - Yard automático: por distancia, por llegada a la meta, o ambos — marca el
>   que ocurra primero. Y para el modo totalmente automático, el botón LAP se
>   puede desactivar.
> - Dos pantallas de datos nuevas: Datos por yard (distancia, ritmo y pulso de
>   la vuelta) y Datos totales (solo lo corrido en yards, sin descansos), con
>   aros de color y nombre para distinguirlas de un vistazo.
> - Catálogo de pantallas: cada una se muestra completa antes de decidir si se
>   activa u oculta, desde el propio reloj.
> - Calentamiento como pantalla única: cuenta atrás a la salida, hora de la
>   campana y check de GPS en verde cuando el reloj fija posición.
> - Aviso de inicio: en cada campana, 5 segundos con el número del yard que
>   arranca.
> - Avisos del corral que se sienten a ciegas: 3 vibraciones a 3 minutos, 2 a
>   2, una larga en el último — y ahora también con tonos. Interruptores de
>   vibración y sonido para apagarlos.
> - El último minuto, en negro gigante sobre rojo.
> - Margen más fiel: el circuito se calibra en el momento de marcar el yard.
> - Acerca de, con la versión y un QR al sitio del evento.

**EN**

> - Laps are now called Yards, as at the event, in all six languages.
> - Auto yard: by distance, by reaching the finish line, or both — whichever
>   comes first. For fully automatic use, the LAP button can be disabled.
> - Two new data screens: Yard data (current lap distance, pace, HR) and Total
>   data (yards only, rest time excluded), with colored rings and labels.
> - Screen catalog: preview every screen right on the watch before choosing to
>   show or hide it.
> - Warm-up as a single screen: countdown to the start, bell time, and a GPS
>   check that turns green when position is fixed.
> - Yard start notice: 5 seconds at every bell with the starting yard number.
> - Corral alerts you can feel blind: 3 short buzzes at 3 minutes, 2 at 2, one
>   long in the final minute — now with tones too. Vibration and sound
>   switches to turn them off.
> - The final minute: giant black digits on red.
> - Truer margin: the course calibrates at the moment the yard is marked.
> - About screen with the version and a QR code to the event site.

---

## Textos de la ficha

### App — «Backyard» (watch-app)

**Resumen (una línea)**
- ES: Tu vuelta, tu ritmo y cuánto podrás descansar, hora tras hora de tu backyard ultra.
- EN: Your lap, your pace, and how long you'll get to rest — every hour of your backyard ultra.

**Descripción**

> Backyard es el compañero para el corredor de una backyard ultra —cualquiera—.
> Te dice en qué vuelta vas, cuánto falta para la próxima campana y, lo más
> importante, **si al ritmo que llevas vas a llegar a tiempo para descansar**.
>
> - **El margen**: en cada vuelta calcula cuánto tiempo te sobrará (o te
>   faltará) para cerrar el circuito antes de la campana. Verde: descansas.
>   Rojo: aprieta.
> - **Las campanas van con el reloj de pared**: al dar la salida, el cero se
>   ancla a la hora en punto. Un retraso en la salida no descuadra nada.
> - **Avisos de corral** a los 3, 2 y 1 minuto antes de cada salida.
> - **La vuelta la cierras tú** con LAP —o sola, al volver al punto de salida—;
>   la siguiente la abre la hora, no un botón.
> - **Sin servidor**: funciona igual en una carrera de 200 corredores que en
>   una de 6.
> - **Pensada para durar**: extraordinariamente liviana, para actividades de
>   hasta 120 horas.
>
> Graba tu actividad y la sube a Garmin Connect como cualquier carrera. Ajusta
> la duración y la distancia de la vuelta desde el teléfono o desde el propio
> reloj.

### Campo de datos — «Backyard Margen» (data field)

**Resumen (una línea)**
- ES: El margen de tu backyard —cuánto descanso tendrás al ritmo actual— dentro de tu actividad de correr.
- EN: Your backyard margin — how much rest you'll get at your current pace — inside your run activity.

**Descripción**

> ¿Corres una backyard ultra y quieres seguir un trayecto con el mapa de
> Garmin? Usa tu actividad de **Correr** de siempre —con su navegación
> completa— y añade este campo de datos para ver **el margen del backyard**:
> cuánto tiempo te sobrará para descansar al ritmo que llevas.
>
> Se dibuja en tres tallas según el hueco que le dejes en tu pantalla de
> datos: solo la cifra, la cifra con su significado, o la pantalla entera con
> el aro de la vuelta. Verde si descansas, rojo si no llegas, con el aviso del
> corral en los últimos minutos.
>
> Comparte la lógica con la app **Backyard**; elige la app si quieres la
> experiencia completa, o este campo si quieres el margen junto a la
> navegación nativa.

---

## El icono del lanzador — resuelto

Cada dispositivo pide su tamaño de icono (35, 36, 40, 56, 60, 62, 65, 70 px).
Ya se generó el icono en los **ocho tamaños** (en `shared/resources-icon<N>/`) y
cada reloj mapea al suyo en los `monkey.jungle`. Los `.iq` compilan **sin
ningún aviso de icono** — máxima calidad en todos los relojes, sin depender del
escalado de Garmin.

Grupos por tamaño de icono:

| px | dispositivos |
|---|---|
| 35 | vivoactive4 |
| 36 | fenix5s, fenixchronos |
| 40 | fenix5/5x, fenix5plus/5splus/5xplus, fenix6/6pro/6s/6spro/6xpro, fenix7/7s/7x, fenix7pro/7spro/7xpro (+nowifi), fenix8solar47mm/51mm, enduro, enduro3, fr255/255s, fr745, fr945/945lte, fr955 |
| 56 | vivoactive5 |
| 60 | fenix843mm, fenixe, epix2, epix2pro42mm/47mm/51mm, fr265/265s |
| 62 | instinct2 |
| 65 | fenix847mm, fenix8pro47mm, fr965 |
| 70 | venu2, venu3 |

Hecho el 21 de agosto de 2026 (commit `837c51f`).
