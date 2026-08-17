# Garmin — lo que queda

Estado a 17 de agosto de 2026, rama `garmin-universal`.

La app de reloj y el campo de datos **compilan sin errores ni avisos** para los
24 relojes de la lista, salvo los del tamaño del icono. La arquitectura, cómo se
compila y qué está comprobado están en [`garmin/README.md`](garmin/README.md);
aquí solo está lo que falta.

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

Quedan tres páginas —Vuelta, Margen, Tuyo— y cuatro ajustes: minutos y km de
la vuelta, aviso de corral y vuelta automática. El emblema se queda. Está todo
explicado en el README.

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
- **Los identificadores de dispositivo del manifest**, los 24. Cuidado al
  añadir: uno mal escrito **no rompe la compilación**, solo suelta un `WARNING`
  y deja al reloj fuera en silencio. Así estuvieron fuera los seis Forerunner.
  Compila con `-w` y lee los avisos.
- **El emblema** cabe en todos los relojes de la lista salvo el Instinct 2,
  donde no cabría ninguno y lo encoge `SplashView`.
