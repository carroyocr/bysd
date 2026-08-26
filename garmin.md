# Garmin — lo que queda

Estado a 26 de agosto de 2026. La **1.4.0 está publicada** en la Connect IQ
Store —la del barrido de dispositivos: 104 relojes, ver la sección de abajo—.
Se llevó dentro todo lo de la 1.3.0, que nunca llegó a subirse suelta. La
versión se declara en `AcercaView.mc` y las novedades ES/EN para la ficha están
en `garmin/PUBLICAR.md`.

La app de reloj y el campo de datos **compilan sin errores ni avisos** para los
104 relojes de la lista. La arquitectura, cómo se compila y qué está comprobado
están en [`garmin/README.md`](garmin/README.md); aquí solo está lo que falta.

## Qué cambió

La app dejó de ser específica de la Backyard Ultra Santo Domingo y vale para
cualquier backyard. Se fue el servidor entero —no hay `ApiClient` ni dorsal ni
código de carrera— y con él la página «En pie».

Y dejó de ser una espectadora: **la app es la actividad**. Graba su propia
sesión (`ActivityRecording`, permisos `Fit` y `Positioning`), las campanas van
ancladas a la hora en punto del reloj de pared (arrancar a las 8:03 no mueve
la campana de las 9:00), LAP marca el término de la vuelta —solo vale el
primero de cada hora— y la vuelta siguiente la abre la hora sola. Opcional:
la marca cae sola al llegar al punto de salida (GPS). Al terminar, la
actividad se guarda y sube a Garmin Connect como cualquier carrera.

Quedan cuatro páginas —Vuelta, Margen, Tuyo y Reloj (hora y batería)— y
cuatro ajustes: minutos y km de la vuelta, aviso de corral y vuelta
automática. El emblema se queda. Está todo explicado en el README.

Contra el boceto original (el artifact «BYSD en tu muñeca»), las únicas
vistas que no están son «Quedan en pie» y el punto de sincronía: necesitaban
red y se descartaron a propósito con el servidor. Decisión del 17 de agosto.

## Para retomar

Todo lo del entorno ya está montado en esta máquina y no hay que repetirlo:
SDK 9.2.0, los 166 archivos de dispositivo y la developer key (en
`~/Proyectos/bysd-secretos/garmin/`, fuera del repo).

Un detalle que cuesta descubrir y hace perder una hora: hay **dos** SDK
instalados y solo sirve uno. Usa el del SdkManager,

```
~/Library/Application Support/Garmin/ConnectIQ/Sdks/connectiq-sdk-mac-9.2.0-*/bin/
```

El de Homebrew compila igual, pero su simulador arranca sin abrir el puerto y
`monkeydo` responde «Unable to connect to simulator» sin más explicación.

---

## El fēnix 8 Solar ya entra (24-ago): faltan los dos envíos a la tienda

Descubierto el 24 de agosto con el reloj delante (fēnix 8 — 47 mm, Solar): la
app le salía «no compatible». **No era un fallo de la 1.2:** ese reloj nunca
estuvo en la lista. Los manifiestos declaraban `fenix843mm` y `fenix847mm`, que
son los fēnix 8 **AMOLED**; el Solar es otro dispositivo en Connect IQ —MIP en
vez de AMOLED, otra resolución— con su propio identificador y su propia ficha
en la tienda. Sin build suyo en el `.iq`, la tienda no deja ni encolar la
descarga. No era `minApiLevel`: el Solar va muy por encima.

**Arreglado en la rama `garmin-mip-fenix`.** Se añadieron **dieciséis** relojes
a los dos manifiestos y a los dos `monkey.jungle`, aprovechando el envío:

| Reloj | id | Pantalla | Icono |
|---|---|---|---|
| fēnix 8 Solar 47 mm | `fenix8solar47mm` | 260×260 MIP | 40 |
| fēnix 8 Solar 51 mm | `fenix8solar51mm` | 280×280 MIP | 40 |
| fēnix 8 Pro 47 mm | `fenix8pro47mm` | 454×454 AMOLED | 65 |
| fēnix E | `fenixe` | 416×416 AMOLED | 60 |
| fēnix 7 Pro / 7S Pro / 7X Pro | `fenix7pro`, `fenix7spro`, `fenix7xpro` | 260 / 240 / 280 MIP | 40 |
| fēnix 7 Pro y 7X Pro sin wifi | `fenix7pronowifi`, `fenix7xpronowifi` | 260 / 280 MIP | 40 |
| epix Pro 42 / 47 / 51 mm | `epix2pro42mm`, `epix2pro47mm`, `epix2pro51mm` | 390 / 416 / 454 AMOLED | 60 |
| fēnix 5 y 5X (2017) | `fenix5`, `fenix5x` | 240×240 MIP | 40 |
| fēnix 5S y Chronos (2017) | `fenix5s`, `fenixchronos` | 218×218 MIP | 36 |

La generación de 2017 entró por lo mismo que salía el Solar, pero al revés:
se queda en **Connect IQ 3.1.6** y la app declaraba `minApiLevel` 3.2.0. Bajarlo
a 3.1.0 bastó —el código no usa nada por encima de 3.1— y trajo de regalo el
tactix Charlie y el quatix 5, que viajan dentro de `fenix5x` y `fenix5`. Lo
único nuevo que hubo que dibujar es el **icono de 36 px** (`shared/resources-icon36`),
que no pide ningún otro reloj.

**Y un fallo que la compilación no ve, encontrado en el simulador el 24-ago:**
al pulsar START en el fēnix 5X la app se caía en el acto con

```
Error: Symbol Not Found Error
Details: Could not find symbol '008000df'
```

Era `Toybox.Activity.SPORT_RUNNING`, que **no existe hasta Connect IQ 3.2**:
en la generación de 2017 esa constante vive en `ActivityRecording`. Compila
sin un aviso y revienta en el reloj, en la única línea que importa —la que
crea la sesión de grabación—. Arreglado en `BackyardApp._deporte()`, que
pregunta con `has` y si no está usa el número del perfil FIT (correr = 1);
nombrar `Rec.SPORT_RUNNING` compila, pero suelta un aviso de obsoleta en los
otros 47 relojes.

**Cómo se traduce un crash así**, que es lo que costó encontrarlo: el id del
símbolo está en el `api.debug.xml` del propio reloj —
`grep 'symbol="SPORT_RUNNING"' fenix5x.api.debug.xml` da `id="8388831"`, que
es `0x8000df`—. Y las direcciones del stack se resuelven con el
`<prg>.prg.debug.xml` que deja `monkeyc` al lado del `.prg`, buscando la
entrada de `pcToLineNum` con el pc más cercano por debajo. Ahí salió
`darLaSalida` y `StartDelegate.onSelect`, o sea: pulsar START.

Moraleja para los relojes viejos: **compilar limpio no prueba nada**. La VM
resuelve los símbolos en marcha, y el compilador no distingue entre un
símbolo que existe en el SDK y uno que existe en ese reloj. Hay que abrir el
simulador con `-d` del reloj viejo y recorrer las pantallas a mano.

**Y las ruedas de ajustes, que salian en blanco sobre blanco.** Encontrado en
el simulador del fēnix 5S: `Ui.Picker` pinta el fondo con el **tema del reloj**,
y en la generación fēnix 5 ese tema es blanco, así que las cifras blancas de la
app quedaban invisibles. No hay opción para cambiarlo —el `Picker` no acepta
color de fondo—, limpiar a negro en el `onUpdate` de un `Picker` propio no vale
(repinta después) y hacerlo desde el título solo ennegrece su banda, porque
cada elemento va recortado a su zona. La rueda es ahora una vista nuestra,
`RuedaView` + `RuedaDelegate` en `AjustesView.mc`: fondo negro, cifra grande y
su marca —`AM`/`PM`, `min`, `km`— debajo en fuente de texto, porque
`FONT_NUMBER_MEDIUM` **no tiene letras** y pegadas al número salen dos cajas
vacías. Los mismos botones de siempre: UP/DOWN cambian, START pasa de columna y
acepta, BACK cancela.

**Ojo con el dato de memoria, que engaña:** el `appStorageCapacity` de
`simulator.json` (131072 en el fēnix 5X) **no** es el presupuesto de la app,
es la capacidad del API `Application.Storage`. El bueno está en
`compiler.json`, en `appTypes`: el fēnix 5X da **1,25 MB** para una watchApp y
128 KB para un campo de datos, y las builds pesan 157 KB y 25 KB. Sobra sitio.

**El Forerunner 645 y el 645 Music entran de propina.** Son de la misma
cosecha que el fēnix 5 y comparten con él todo lo que importa: 240x240 MIP de
8 bits, cinco botones, Connect IQ 3.1.6 y 128 KB de presupuesto para una
watchApp (el Music sube a 1 MB). Tanto, que la build del 645 sale **byte a
byte idéntica** a la del fēnix 5 —158 636 bytes de `.prg`, 29 376 de código y
5 149 de datos—, así que no hubo que tocar ni una línea de código: dos ids en
cada `manifest.xml` y dos líneas de icono de 40 px en cada `monkey.jungle`.

**Ninguno estrena familia de pantalla**: las siete (218, 240, 260, 280, 390,
416 y 454 px) ya se compilaban para otros relojes, así que no hizo falta tocar ni una
línea de dibujo. Tampoco emblema nuevo: el reparto del `monkey.jungle` va por
familia. Lo que sí hubo que escribir a mano es la línea del icono de cada
dispositivo —el tamaño va por reloj, no por familia—; los de 65 px
(`fenix8pro47mm`) usan el icono por defecto de `shared/resources` y no llevan
línea.

Los dos `.iq` de tienda vuelven a salir con **90 builds cada uno, sin un solo
error ni aviso** (eran 52). La versión de `AcercaView.mc` subió a **1.3.0**, y
las novedades ES/EN están en `garmin/PUBLICAR.md`.

**Lo que falta, y solo lo puede hacer Cristhian:** subir la versión nueva de
**los dos productos** a la Connect IQ Store (`build/backyard.iq` y
`build/backyard-margen.iq`) y pasar otra vez por la revisión de Garmin. Eso es
lo que marca el plazo real, no la compilación.

Sin comprobar todavía: cómo se ve la app en una pantalla MIP de verdad. El
riesgo es bajo —el fēnix 7 y el enduro, de las mismas familias y del mismo
tipo de pantalla, ya estaban dentro y el código no distingue— pero conviene
mirarlo en el simulador con `-d fenix8solar51mm` antes de enviar. Ojo con lo
apuntado abajo para el Instinct 2: en MIP **monocromo** el texto en
`COLOR_DK_GRAY` no se ve. El Solar no es monocromo (8 bits de color), así que
eso no le afecta.

Eso se escribió cuando quedaban fuera a propósito los relojes que no son de la
familia fēnix/epix. **Ya no**: el barrido de la 1.4.0 metió los Descent, los D2,
los Approach y los Instinct 3 AMOLED. Lo que sigue fuera son los Instinct
monocromos, por el problema del gris.

## El barrido de dispositivos (26-ago): de 48 a 104 relojes

Revisados **los 166 dispositivos del SDK**, uno a uno, con los datos que
manda: `appTypes` (si admite watchApp y campo de datos, y con cuánta memoria),
`partNumbers` (la versión de Connect IQ de cada variante), `deviceFamily`,
`bitsPerPixel` y `launcherIcon`. De ahí salieron **56 que entran sin tocar
código**, y entraron todos.

**No se tocó ni una línea de las vistas.** Ninguna familia de pantalla es
nueva: las siete de siempre. Lo único escrito a mano fueron cuatro iconos del
lanzador que no existían, sacados del de 70 px, que es el mayor con alfa:

| Talla | Para quién |
|---|---|
| 30 px | vívoactive 4S, Captain Marvel, Rey |
| 38 px | Instinct Crossover AMOLED |
| 54 px | fr165, fr170, fr570 42 mm, fr70, Venu 4 41 mm, vívoactive 6 |
| 40x33 px | vívoactive 3 Music y 3 Music LTE |

El de 40x33 es el único raro: es el **primer icono no cuadrado** del proyecto.
Los vívoactive 3 lo piden así, y como el dibujo es un aro redondo, se encoge a
33 y se centra en el lienzo ancho; aplastarlo lo deformaría. Sin ese PNG,
`monkeyc` no falla — suelta un `WARNING` y escala él, que es justo lo que este
proyecto evita.

Los dos `.iq` de tienda salen ahora con **174 builds cada uno, sin un solo
error ni aviso** (eran 90). La versión de `AcercaView.mc` subió a **1.4.0**.

**Lo que quedó fuera, y por qué**, para no volver a mirarlo:

- **21 por Connect IQ anterior a 3.1**: fēnix 3, fr235/230/630/735XT/920XT,
  vívoactive y vívoactive HR, D2 Bravo, Approach S60 y S62, epix gen 1,
  GPSMAP 66/86, Oregon, Rino.
- **26 por pantalla rectangular**: todos los Edge, el Venu Sq y Sq 2, el
  Venu X1, Montana, GPSMAP H1, eTrex. El dibujo es radial
  (`radio = min(w,h)/2 - 6`), así que en un 282x470 el aro sale inscrito en el
  lado corto y sobra media pantalla. Se puede hacer, pero es rediseñar la
  vista, no añadir un id.
- **4 que no admiten apps**: fr45, Garmin Swim 2, Edge 130 y 130 Plus.
- **11 pendientes de mirar**, no descartados: los Instinct monocromos
  (Instinct 2X, 3 Solar, E 40/45 mm, 2S, Crossover, Descent G1), que heredan
  del Instinct 2 el problema del `COLOR_DK_GRAY`; el **Venu 2S**, que estrena
  familia `round-360x360` y se llevaría el emblema de 240 px en una pantalla
  de 360; el **fr55**, de 4 bits y familia `round-208x208`; y el
  **vívoactive 3** y el **D2 Delta PX**, que compilan pero pierden una
  variante vieja (CIQ 3.0.3) con aviso.

**Memoria, que era la duda razonable:** el más justo del lote da 96 KB para la
app y 32 KB para el campo de datos. Las builds gastan **34,5 KB** (29 376 de
código y 5 149 de datos) y **8,8 KB**. Sobra en todos.

Y el aviso de siempre, que aquí pesa más que nunca: **compilar limpio no
prueba nada**. Son 56 relojes que nadie ha visto arrancar.

## 0. Dos fallos confirmados en el simulador, sin arreglar

Sesion del 17-18 de agosto, manejando el simulador con teclado. Lo que se
comprobo que SI funciona: las flechas cambian de pagina en carrera, LAP marca
una sola vez y los repetidos se ignoran, el ancla del reloj de pared clava la
campana (a las 8:59 dio cuenta atras de 0:29 hasta las 9:00), y las unidades
salen bien (6.7 km -> 4.2 mi con el reloj en imperial). Lo que NO:

- **BACK no abre el menu de terminar.** Ni con Escape, ni con Backspace, ni
  pulsando el boton del bisel: `onBack` parece no dispararse nunca (o el push
  del Menu2 muere en silencio), asi que no hay forma sana de cerrar la
  carrera. Es el fallo que el usuario vio como "al descartar se reinicio el
  reloj". Estaba a mitad de diagnostico con una linea de depuracion visible
  en pantalla (la consola de monkeydo no se dejo capturar en background);
  las trazas se revirtieron antes del commit, hay que reponerlas para seguir.
- **Antes de la campana no se puede cambiar de pagina.** El pre-salida
  (vuelta 0) corta el onUpdate antes del enrutado de paginas, y con vueltas
  de 60 minutos ese bloqueo puede durar media hora. Decidir: o se permite
  navegar (con las paginas protegidas contra vuelta 0: "Lap 0", completadas
  -1, tiempo negativo), o al menos se deja pasar a la pagina del reloj.

Y una nota para probar las pantallas que "no se ven" en el simulador: el
margen en verde/rojo necesita distancia (Simulation -> Activity Data ->
Simulate Data), el corral solo entra en los ultimos 3 minutos de la hora de
pared, y la espera solo aparece si se pulsa START antes de la marca. Con el
ajuste de vuelta en 5 minutos se ve todo en una pasada; con 3 o menos el
corral seria permanente, porque su umbral son 180 s fijos.

## 1. El margen, con datos reales

**Es el hueco más importante, y sigue abierto.** En el simulador no había
ninguna actividad grabando, así que `Activity.getActivityInfo()` no devolvía
distancia. La aritmética que justifica toda la app —ritmo, kilómetros de la
vuelta en curso, la calibración del objetivo con lo que mide el GPS y los dos
aros que se persiguen— **no ha pasado nunca por el simulador con números de
verdad**.

En la app la vuelta ya no depende de la actividad —la manda el reloj de pared—
pero el margen sigue saliendo de la distancia grabada, y esa parte no ha visto
nunca números reales. En el campo de datos, además, la vuelta sí sale del
`elapsedTime` de la actividad nativa.

Cómo: en el simulador, *Simulation → Activity Data → Play a FIT file* (o
*Simulate Data*), y con la actividad corriendo comprobar en `RaceState`:

- que la vuelta avanza sola con la hora y la cuenta atrás se reinicia en cada
  campana, con su vibración larga y su `addLap`;
- que LAP marca el término una sola vez y los repetidos se ignoran;
- que la vuelta automática marca al llegar al punto de salida y no antes
  (exige medio circuito recorrido y 30 m del punto);
- que `kmEnLaVuelta()` avanza y se corta en cada campana;
- que `kmMedidosUltimaVuelta` se queda con lo medido solo cuando se parece a
  una vuelta (el filtro del 0.8–1.2);
- que el margen cambia de signo y de color al cruzar el ritmo necesario;
- que por debajo de 1 km sigue saliendo el guion en vez de saltar minutos;
- y que al guardar, el FIT queda con sus vueltas y sube a Garmin Connect.

La aritmética en sí ya está verificada con un puerto a Python (la campana
exacta, los saltos de treinta horas, el corral, el realineo y las vueltas de
duración distinta de una hora). Lo que falta es verla con los datos del reloj.

## 2. Probarlo en un reloj de verdad

Lo que el simulador no puede decir: batería en treinta horas y memoria bajo
carga. Ya no hay Bluetooth que probar, que era el tercer frente: la app no sale
a la red. Se conecta el reloj por USB y se copia el `.prg` a `GARMIN/APPS/`.

## 3. Medir la memoria del campo de datos

Compila y dibuja, pero no se ha medido cuánto gasta con la actividad grabando,
que es donde el presupuesto es pequeño. Si se pasa, el reloj lo mata en mitad
de la carrera. Se ve con `monkeyc --build-stats` y con el perfilador del
simulador. Debería gastar menos que antes —se fue la pieza de red y dos de las
cadenas que cargaba—, pero eso hay que medirlo, no suponerlo.

## 4. El icono del lanzador

Hay uno solo de 60×60 y cada reloj pide el suyo, de 35×35 (vívoactive 4) a
70×70 (Venu). Garmin lo escala solo, así que no rompe nada: son los únicos
avisos que quedan al compilar, 20 de los 24 relojes. Pero un icono escalado a
ojo se nota en la lista del reloj, y además el actual es un recorte automático
del emblema. Merece que lo dibuje alguien.

## 5. Publicar

Falta decidir si va a la Connect IQ Store —es gratis, pero pasa una revisión de
Garmin— o si se reparte el `.prg` a mano. Ahora que la app no es de una sola
carrera, la tienda tiene bastante más sentido que antes. Si va a la tienda, son
**dos fichas**: la app y el campo de datos son aplicaciones distintas con su
propio id.

Una cosa a mirar antes: el emblema de BYSD sigue siendo la pantalla de entrada
de una app que se llama «Backyard» y que sirve para cualquier carrera. Funciona
y se decidió así a propósito, pero en una ficha pública conviene saber si es lo
que se quiere enseñar.

---

## Cosas que ya se comprobaron y no hace falta repetir

- **La aritmética del reloj de la carrera**, con un puerto a Python que se
  quedó en el repo (`garmin/tools/verificar_aritmetica.py`, se ejecuta sin
  SDK): el redondeo del ancla al reloj de pared (salida tarde, temprana y
  exacta), el segundo 3600 como vuelta 2 con la hora entera por delante, las
  treinta horas con una división y no con un bucle, el corral que entra a los
  tres minutos justos y no se queda pegado, la regla de un solo LAP válido por
  vuelta y las vueltas de duración distinta de una hora.
- **Que la app y el campo de datos arrancan** en el simulador sin ninguna
  excepción, y que la vista se repinta. Esto último se vio con una traza
  temporal en `onUpdate`, no por ausencia de errores, y menos mal: la traza
  descubrió dos fallos que la compilación no ve.
- **Sin actividad, `elapsedTime` no es `null`: es `0`.** Es la trampa de este
  diseño, porque todo cuelga de ese número. Sin filtrarlo, la app dibujaba una
  vuelta 1 parada en 60:00 en lugar de decir que no hay de dónde contar. Por eso
  `_milisActividad()` trata el cero como «todavía nada». Si alguien toca esa
  función, que lo tenga presente.
- **El ajuste de distancia va en kilómetros y no en la unidad del reloj.** Se
  intentó al revés, por coherencia con `Fmt`, y sale mal: el 6.7 de fábrica se
  convierte en 6.7 millas —10.8 km de vuelta— para quien tenga el reloj en
  imperial y no lo toque. Un ajuste que cambia de unidad no puede tener un valor
  por defecto correcto para todos.
- **Ninguna etiqueta se recorta**, en ningún idioma ni reloj. Medido con
  `getTextWidthInPixels` en las fuentes reales, contra la cuerda del círculo a
  la altura de cada texto. El peor caso, el italiano «Ritmo insufficiente»,
  mide 141 px de los 166 que hay en el Instinct 2.
- **La pantalla que aprieta es la grande, no la pequeña.** Es al revés de lo
  que decía el README viejo: las AMOLED usan una fuente numérica
  proporcionalmente mayor, y el único texto que llegó a salirse lo hizo en la
  de 416 px. Si tocas un formato, mídelo; no lo supongas en ninguna dirección.
- **Los identificadores de dispositivo del manifest**, los 104 declarados hoy.
  Ojo: esos 104 son los que compilan, no los que existen — la lista envejece
  sola con cada reloj nuevo de Garmin. Cuidado al
  añadir: uno mal escrito **no rompe la compilación**, solo suelta un `WARNING`
  y deja al reloj fuera en silencio. Así estuvieron fuera los seis Forerunner.
  Compila con `-w` y lee los avisos.
- **El emblema** cabe en todos los relojes de la lista salvo el Instinct 2,
  donde no cabría ninguno y lo encoge `SplashView`.
