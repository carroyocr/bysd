# Garmin — lo que queda

Estado a 16 de agosto de 2026, rama `garmin-compilar`.

La app de reloj y el campo de datos **compilan y arrancan en el simulador**:
24 relojes cada uno, sin errores y sin avisos salvo los del tamaño del icono.
La arquitectura, cómo se compila y qué está comprobado están en
[`garmin/README.md`](garmin/README.md); aquí solo está lo que falta.

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

**Es el hueco más importante.** En el simulador no había ninguna actividad
grabando, así que `Activity.getActivityInfo()` no devolvía distancia: el margen
salió siempre como `--:--`. La pantalla se dibuja sin fallar, pero la
aritmética que justifica toda la app —ritmo, kilómetros de la vuelta en curso,
la calibración del objetivo con lo que mide el GPS y los dos aros que se
persiguen— **no ha pasado nunca por el simulador con números de verdad**.

Y es justamente la razón de ser del campo de datos, así que hasta que esto se
pruebe, esa parte está escrita pero no verificada.

Cómo: en el simulador, *Simulation → Activity Data → Play a FIT file* (o
*Simulate Data*), y con la actividad corriendo comprobar en `RaceState`:

- que `kmEnLaVuelta()` avanza y se corta en cada campana;
- que `kmMedidosUltimaVuelta` se queda con lo medido solo cuando se parece a
  una vuelta (el filtro del 0.8–1.2);
- que el margen cambia de signo y de color al cruzar el ritmo necesario;
- que por debajo de 1 km sigue saliendo el guion en vez de saltar minutos.

## 2. `GET /api/race/watch` en el backend

No existe todavía, y sin él la app va a ciegas en tres cosas:

- usa 6.7 km y 60 min por defecto en vez de los de la carrera que se corre;
- no sabe si al corredor le marcaron la vuelta en curso;
- hace dos llamadas (`/lap-status` y `/stats`) donde bastaría una.

Hoy, por esto, **el ajuste del dorsal no sirve para nada**: se muestra en la
pantalla «Tuyo» y ya, porque no hay a quién preguntarle por él.

Debe ser público (la app no lleva token), pequeño —unos 200 bytes— y aceptar
`race_code` y dorsal. Ojo con la regla de varias carreras del `CLAUDE.md`: es
un endpoint de la app, así que va con `races.resolver_carrera`, que acepta el
código que venga y si no cae en la carrera pública.

`ApiClient` ya lee `km_por_vuelta` y `minutos_por_vuelta` si aparecen en la
respuesta: en cuanto el backend los publique, la app deja de usar sus valores
por defecto **sin tocar una línea de Monkey C**.

## 3. Probarlo en un reloj de verdad

Lo que el simulador no puede decir: batería en treinta horas, memoria bajo
carga y qué hace el Bluetooth entrando y saliendo de cobertura vuelta tras
vuelta. Se conecta el reloj por USB y se copia el `.prg` a `GARMIN/APPS/`.

## 4. Medir la memoria del campo de datos

Compila y dibuja, pero no se ha medido cuánto gasta con la actividad grabando,
que es donde el presupuesto es pequeño. Si se pasa, el reloj lo mata en mitad
de la carrera. Se ve con `monkeyc --build-stats` y con el perfilador del
simulador.

## 5. El icono del lanzador

Hay uno solo de 60×60 y cada reloj pide el suyo, de 35×35 (vívoactive 4) a
70×70 (Venu). Garmin lo escala solo, así que no rompe nada: son los únicos
avisos que quedan al compilar, 20 de los 24 relojes. Pero un icono escalado a
ojo se nota en la lista del reloj, y además el actual es un recorte automático
del emblema. Merece que lo dibuje alguien.

## 6. Publicar

Falta decidir si va a la Connect IQ Store —es gratis, pero pasa una revisión de
Garmin— o si se reparte el `.prg` a mano entre los corredores inscritos. Si va
a la tienda, son **dos fichas**: la app y el campo de datos son aplicaciones
distintas con su propio id.

---

## Cosas que ya se comprobaron y no hace falta repetir

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
  donde no cabría ninguno y lo encoge `SplashView` en tiempo de ejecución.
