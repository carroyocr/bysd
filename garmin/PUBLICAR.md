# Publicar Backyard en la Connect IQ Store

Estado y guía de la ficha de Garmin. Actualizado el 27 de agosto de 2026.

**Solo va a la tienda la app de reloj.** El campo de datos se compila y
funciona, pero se decidió el 26 de agosto de 2026 **no publicarlo**: se queda
en el repo, sin ficha. Los textos que había preparados para su ficha siguen
abajo por si algún día cambia la decisión.

## Estado — la 1.4.1, lista para subir

La **1.4.1 está empaquetada y sin subir**: `build/backyard.iq`, 174 builds de
los 104 relojes, sin un solo error ni aviso. Es la primera versión desde la
1.1.0 que cambia el comportamiento de la app y no la lista de relojes: el
margen deja de callarse el primer kilómetro de cada vuelta, Margen pasa a ser
la primera pantalla y la meta automática viene puesta. Las novedades para el
portal, más abajo.

**Lo que falta, y solo lo puede hacer Cristhian:** subir el `.iq` al portal,
pegar el texto de novedades y enviar a revisión.

## Estado — la 1.4.0, publicada

La **1.4.0 salió a la Connect IQ Store el 26 de agosto de 2026**: 104 relojes y
174 builds. La ficha es «Backyard Ultra — lap, pace & rest», con descripción en
inglés y en español, y pesa 136 KB.

- App: `https://apps.garmin.com/en-US/apps/39077413-5fe7-438d-b932-d85cea576a0f`
  (y `es-ES` para la española). **El segmento de idioma es obligatorio**: sin él
  la ficha no carga, se queda en la portada de la tienda.
- El id de la tienda **no es** el del `manifest.xml`: Garmin asigna el suyo.
- Versión inicial en tienda: 24 de agosto de 2026, con la 1.3.0.

## Estado técnico — listo

- La **app** (`backyard.iq`) y el **campo de datos** (`backyard-margen.iq`)
  compilan para los **174 builds** de los 104 dispositivos, **sin un solo
  error**. Los paquetes de tienda están en `garmin/build/*.iq`. A la tienda
  sube solo el primero.
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

Serían **dos fichas separadas**: la app y el campo de datos son productos
distintos con su propio id. Comparten la mitad del código, pero en la tienda
irían por separado. Hoy solo hay ficha de la app.

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

## Novedades de la versión 1.4.1 (para el campo "What's New")

La primera versión desde la 1.1.0 que cambia cómo se comporta la app en vez de
a cuántos relojes llega. Todo sale de una salida de prueba del 27 de agosto:
los dos campos de ritmo salían vacíos durante mucho rato y no se entendía por
qué. La razón era un umbral prestado —el margen no se muestra por debajo de un
kilómetro, porque extrapola, y ese mismo mínimo estaba tapando también la
*visualización* del ritmo—, y de ahí salió el resto.

El margen ya no calla ese primer kilómetro: proyecta con una mezcla del ritmo
de la vuelta y el ritmo medio de la carrera, pesada por la distancia recorrida,
así que la cifra sale al minuto y se asienta sola. En el kilómetro vale
exactamente lo que valía antes.

Y un fallo que la publicación de la meta automática dejaba al descubierto: el
punto de meta se tomaba solo al pulsar START, cuando el GPS a menudo no ha
fijado todavía; si no había fijado, la meta automática no marcaba en toda la
carrera y no lo decía. Ahora se repesca en la campana, que es cuando el
corredor está en la línea por definición.

**ES**

> - La pantalla de **Margen** es ahora la primera: es la que se mira mientras
>   se corre.
> - El **ritmo** aparece al minuto de empezar el yard, no al kilómetro. Antes,
>   los dos campos de ritmo se quedaban en blanco los primeros ocho minutos de
>   cada hora.
> - El **margen** también sale al minuto. Mientras el ritmo del yard se
>   asienta, se apoya en el ritmo medio de tu carrera, así que la cifra no
>   salta minutos enteros de una zancada a otra.
> - **Yard auto Meta viene activado**: el circuito de una backyard acaba donde
>   empezó, y marcarlo a mano treinta veces son treinta ocasiones de
>   olvidarlo. El botón LAP sigue funcionando igual.
> - Arreglado: si al dar la salida el GPS todavía no había fijado, la meta
>   automática no marcaba en toda la carrera. Ahora el punto se toma en la
>   campana, contigo en la línea.
> - Si ya tenías la app, estos dos valores de fábrica no tocan tu
>   configuración: se cambian desde los ajustes.

**EN**

> - The **Margin** screen now comes first: it's the one you look at while
>   running.
> - **Pace** now appears a minute into the yard instead of a kilometre in.
>   Both pace fields used to sit blank for the first eight minutes of every
>   hour.
> - The **margin** appears a minute in too. While the yard's own pace settles,
>   it leans on your average race pace, so the figure no longer jumps whole
>   minutes from one stride to the next.
> - **Auto yard at the finish line is now on by default**: a backyard course
>   ends where it started, and marking it by hand thirty times is thirty
>   chances to forget. The LAP button works exactly as before.
> - Fixed: if GPS hadn't locked when you started the race, the automatic
>   finish line never marked a single yard. The point is now taken at the
>   bell, with you standing on the line.
> - If you already had the app, these two new defaults don't touch your
>   settings — change them from Settings.

---

## Novedades de la versión 1.4.0 (para el campo "What's New")

Cincuenta y seis relojes más, y con ellos la lista pasa de 48 a **104
dispositivos** y de 90 a **174 builds**. No es una versión de código: no se
tocó ni una línea de las vistas. Ninguna familia de pantalla es nueva —las
siete de siempre, más el `round-208x208` que no entró— y lo único que hubo que
hacer a mano fueron cuatro iconos del lanzador que no existían: 30, 38 y 54 px,
y uno de 40x33 —no cuadrado— para los vívoactive 3 Music, con el aro centrado
en vez de aplastado.

Entra por fin toda la línea Forerunner moderna, que era el hueco de verdad: el
165, el 170, el 570 en sus dos tallas y el 970. Y con ellos los Venu y
vívoactive que faltaban, los Instinct AMOLED, la familia MARQ entera, los
Descent, los D2 y los Approach — que serán de buceo, aviación o golf, pero por
dentro son multideporte de gama fēnix y graban una carrera igual.

Esta versión **se lleva también todo lo de la 1.3.0**, que nunca llegó a la
tienda: los fēnix MIP, la generación fēnix 5 de 2017, el Forerunner 645 y los
dos arreglos de relojes viejos (`SPORT_RUNNING` y las ruedas de ajustes).

**ES**

> - Cincuenta y seis relojes más: la línea Forerunner moderna al completo
>   (165, 170, 245, 255, 570, 645, 935, 970 y sus versiones Music), Venu,
>   Venu 2 Plus, Venu 3S, Venu 4, vívoactive 3 Music, 4S y 6, Instinct 3
>   AMOLED, la familia MARQ entera, los Descent, los D2 y los Approach.
> - Con la app llega también el campo de datos del margen a todos ellos.

**Ojo, esta segunda línea hay que quitarla de la ficha ya publicada:** el campo
de datos no se publicó, así que promete algo que nadie puede descargar. El
texto corregido, para pegar en el portal, está justo debajo.

**ES (corregido)**

> - Cincuenta y seis relojes más: la línea Forerunner moderna al completo
>   (165, 170, 245, 255, 570, 645, 935, 970 y sus versiones Music), Venu,
>   Venu 2 Plus, Venu 3S, Venu 4, vívoactive 3 Music, 4S y 6, Instinct 3
>   AMOLED, la familia MARQ entera, los Descent, los D2 y los Approach.

**EN (corregido)**

> - Fifty-six more watches: the whole modern Forerunner line (165, 170, 245,
>   255, 570, 645, 935, 970 and their Music versions), Venu, Venu 2 Plus,
>   Venu 3S, Venu 4, vívoactive 3 Music, 4S and 6, Instinct 3 AMOLED, the
>   full MARQ family, the Descent, D2 and Approach ranges.

**EN**

> - Fifty-six more watches: the whole modern Forerunner line (165, 170, 245,
>   255, 570, 645, 935, 970 and their Music versions), Venu, Venu 2 Plus,
>   Venu 3S, Venu 4, vívoactive 3 Music, 4S and 6, Instinct 3 AMOLED, the
>   full MARQ family, the Descent, D2 and Approach ranges.
> - The margin data field reaches all of them too.

---

## Novedades de la versión 1.3.0 (para el campo "What's New")

Dieciocho relojes más, y por primera vez los **fēnix que no son AMOLED**: el
fēnix 8 Solar no podía ni encolar la descarga en la tienda porque el `.iq` no
llevaba build para él. Entra también la generación **fēnix 5 de 2017** —y con
ella el **Forerunner 645** y el 645 Music, que son de la misma cosecha y de la
misma pantalla—, que solo pedía bajar el `minApiLevel` de la app de 3.2.0 a
3.1.0 (el código no usa nada por encima de 3.1). Ninguna familia de pantalla es nueva —218, 240, 260,
280, 390, 416 y 454 px ya estaban resueltas—, pero sí hubo dos arreglos que
solo se ven en relojes viejos: `Activity.SPORT_RUNNING` (no existe antes de
Connect IQ 3.2 y tumbaba la app al dar la salida) y las ruedas de ajustes, que
en las pantallas MIP salían en blanco sobre blanco.

**ES**

> - Dieciocho relojes más: fēnix 8 Solar (47 y 51 mm), fēnix 8 Pro, fēnix E,
>   fēnix 7 Pro, 7S Pro y 7X Pro (también las versiones sin wifi), epix Pro
>   (42, 47 y 51 mm), la generación fēnix 5 de 2017 — fēnix 5, 5S y 5X, con
>   el tactix Charlie y el fēnix Chronos — y el Forerunner 645 y 645 Music.
> - Las ruedas de los ajustes —hora de salida, duración y distancia— se ven
>   ahora en negro con cifras blancas en todos los relojes. En los de pantalla
>   MIP salían en blanco sobre blanco, ilegibles.

**EN**

> - Eighteen more watches: fēnix 8 Solar (47 and 51 mm), fēnix 8 Pro, fēnix E,
>   fēnix 7 Pro, 7S Pro and 7X Pro (no-wifi versions too), epix Pro (42, 47
>   and 51 mm), the 2017 fēnix 5 generation — fēnix 5, 5S and 5X, plus
>   tactix Charlie and fēnix Chronos — and the Forerunner 645 and 645 Music.
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

### Campo de datos — «Backyard Margen» (data field) — SIN PUBLICAR

*Decidido el 26-ago-2026: este producto no va a la tienda. Lo que sigue queda
escrito por si la decisión cambia.*

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

Cada dispositivo pide su tamaño de icono (30, 35, 36, 38, 40, 40x33, 54, 56,
60, 62, 65, 70 px). Ya se generó el icono en las **doce tallas** (en
`shared/resources-icon<N>/`) y
cada reloj mapea al suyo en los `monkey.jungle`. Los `.iq` compilan **sin
ningún aviso de icono** — máxima calidad en todos los relojes, sin depender del
escalado de Garmin.

Grupos por tamaño de icono:

| px | dispositivos |
|---|---|
| 30 | vivoactive4s, legacyherocaptainmarvel, legacysagarey |
| 35 | vivoactive4, legacyherofirstavenger, legacysagadarthvader |
| 36 | fenix5s, fenixchronos |
| 38 | instinctcrossoveramoled |
| 40 | fenix5/5x, fenix5plus/5splus/5xplus, fenix6/6pro/6s/6spro/6xpro, fenix7/7s/7x, fenix7pro/7spro/7xpro (+nowifi), fenix8solar47mm/51mm, enduro, enduro3, fr245/245m, fr255/255s/255m/255sm, fr645/645m, fr745, fr935, fr945/945lte, fr955, marq (los 8), d2delta/deltas, descentmk1/mk2/mk2s |
| 40x33 | vivoactive3m, vivoactive3mlte — **el único no cuadrado** |
| 54 | fr165/165m, fr170/170m, fr57042mm, fr70, venu441mm, vivoactive6 |
| 56 | vivoactive5, approachs50 |
| 60 | fenix843mm, fenixe, epix2, epix2pro42mm/47mm/51mm, fr265/265s, venu, venud, marq2, marq2aviator, d2air, d2mach1, descentg2, descentmk343mm/mk351mm, approachs7042mm, instinct3amoled45mm/50mm |
| 62 | instinct2 |
| 65 | fenix847mm, fenix8pro47mm, fr965, fr57047mm, fr970, venu445mm, d2mach2, d2mach2pro |
| 70 | venu2, venu3, venu2plus, venu3s, d2airx10, approachs7047mm |

Hecho el 21 de agosto de 2026 (commit `837c51f`) y ampliado el 26 de agosto
con las cuatro tallas del barrido de dispositivos (30, 38, 54 y 40x33).
