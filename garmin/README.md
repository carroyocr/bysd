# BYSD Live para Garmin

App de Connect IQ para el corredor de la Backyard Ultra Santo Domingo. Le dice
en qué vuelta va, cuánto falta para la próxima campana y si al ritmo que lleva
va a llegar a tiempo.

> **Estado: compila y arranca en el simulador.** Los dos proyectos compilan sin
> errores ni avisos para los 24 relojes de la lista, y en el simulador se
> dibujan las cuatro páginas y el campo de datos sin fallos en tiempo de
> ejecución. Lo que **no** se ha probado todavía es un reloj de verdad: batería,
> memoria bajo carga y el comportamiento del Bluetooth durante treinta horas
> solo se ven ahí.

## La idea

Una backyard es un metrónomo: la campana suena cada hora exacta desde la
salida. Si el reloj sabe en qué vuelta va y cuántos segundos le quedan, puede
mantener la cuenta él solo con su propio cronómetro.

Por eso de la respuesta del servidor solo se guarda una cosa: *en la vuelta N
le quedaban R segundos, y eso lo supe en el instante M*. A partir de ahí todo
son diferencias de tiempo, nunca horas absolutas. Eso tiene dos consecuencias
que hacen la app viable:

- Da igual que el reloj del corredor esté mal puesto.
- Da igual que el teléfono se quede sin cobertura treinta horas. La cuenta
  atrás no se detiene ni miente; como mucho envejece, y eso se ve en el punto
  de sincronía.

En una backyard esto encaja especialmente bien porque el corredor pasa por
meta cada hora: aunque deje el teléfono en su carpa, el reloj se sincroniza
solo al pasar por el rango del Bluetooth, una vez por vuelta.

## Las pantallas

El emblema de la carrera a pantalla completa poco más de un segundo, y de ahí
directo a la vuelta. Cualquier botón lo salta. Después, cuatro páginas que se
recorren con arriba y abajo (o deslizando, en los táctiles):

| Página | Cifra grande | De dónde sale |
|---|---|---|
| **Vuelta** | Cuenta atrás a la próxima salida | Cronómetro local |
| **Margen** | Minutos a favor o en contra | `Activity.Info` + cronómetro local |
| **Tuyo** | Vueltas completadas y km | Cronómetro local |
| **En pie** | Cuántos siguen en carrera | `/api/race/stats` |

El botón de acción fuerza una consulta al servidor: es lo que uno quiere
pulsar justo después de pasar por meta.

**El corral** no es una página: entra sola en los últimos tres minutos, tiñe de
rojo la pantalla de vuelta y vibra a los 3, 2 y 1 minuto. Se puede apagar
desde los ajustes.

### El margen

```
ritmo        = tiempo_en_la_vuelta / distancia_en_la_vuelta
km_restantes = objetivo - distancia_en_la_vuelta
falta        = km_restantes * ritmo
margen       = restan_de_vuelta - falta
```

Positivo es descanso previsto; negativo es que a ese ritmo no se llega. Dos
detalles que no son adorno:

- **Por debajo de un kilómetro no se muestra.** Con trescientos metros hechos
  el ritmo medio da tumbos y el margen saltaría minutos enteros de una zancada
  a otra. Hasta el primer kilómetro sale un guion.
- **El objetivo se calibra solo.** El GPS puede medir 6.85 km en un circuito
  de 6.7, y sobre treinta vueltas eso descuadra la cuenta. Al cerrarse cada
  vuelta se guarda lo que midió el reloj y se usa como referencia en la
  siguiente, siempre que se parezca a una vuelta de verdad.

## El campo de datos

La pantalla del margen necesita que haya una actividad grabando, porque el
ritmo sale de la distancia que va midiendo el reloj. Su sitio natural no es una
app aparte que hay que abrir: es un campo de datos dentro de la actividad, que
el corredor coloca una vez en su pantalla de carrera y no vuelve a tocar.

Comparte con la app el reloj local, los formatos y la llamada a la red — es el
mismo problema resuelto una vez. Lo que no comparte es el dibujo, porque aquí
la pantalla no es la esfera sino el trozo que le haya tocado, y eso lo decide
el corredor al repartir sus campos. Por eso se dibuja en tres tallas:

| Sitio | Qué se ve |
|---|---|
| Una franja fina | Solo la cifra del margen |
| Media pantalla | La cifra y qué significa |
| Pantalla entera | Además, el aro de la vuelta |

Dos diferencias con la app que no son capricho. El latido no lo pone un
`Timer`, lo pone el propio reloj llamando a `compute()` una vez por segundo
mientras la actividad corre. Y el fondo no es negro por decreto: un campo de
datos que no respete el color de fondo del reloj se ve como un parche pegado.

No hay emblema: no cabe, y la memoria de la que se dispone aquí es bastante
menor que en una app.

## Estructura

Son **dos aplicaciones**, con su ficha propia en la tienda, que comparten la
mitad del código: la app de reloj y el campo de datos. Lo que comparten es
justo lo que no depende de la pantalla.

```
shared/
  source/
    RaceState.mc        el reloj local de la carrera y el margen. La pieza clave
    ApiClient.mc        lo único que sale a la red
    Fmt.mc              formatos, y la única decisión de unidades (km o mi)
  resources/
    settings/           los cuatro ajustes, que son los mismos en las dos
    drawables/          el icono del lanzador

app/                    la app de reloj
  manifest.xml          productos, permisos e idiomas
  monkey.jungle         qué carpeta de recursos usa cada familia de relojes
  source/
    BysdApp.mc          el latido de un segundo: refrescar, avisar, repintar
    SplashView.mc       el emblema
    MainView.mc         las cuatro páginas
    MainDelegate.mc     botones y gestos
  resources/            emblema de 240 px
  resources-small/      emblema de 196 px
  resources-large/      emblema de 380 px
  resources-<lang>/     una carpeta por idioma

datafield/              el campo de datos
  manifest.xml
  monkey.jungle
  source/
    BysdFieldApp.mc     la AppBase por la que entra: le da la vista al reloj
    BysdField.mc        el margen, en tres tallas según el hueco que le toque
  resources-<lang>/     una carpeta por idioma

tools/generar_strings.py  genera todos los strings.xml desde una sola tabla
```

Las carpetas `resources-<lang>` aparecen **dos veces**, una en cada proyecto, y
eso no se puede arreglar moviéndolas a `shared/`: `monkeyc` solo mira las
carpetas de idioma que son hermanas del `manifest.xml` que está compilando, y
si no las encuentra **no avisa** — compila igual y el reloj sale en inglés. Por
eso los XML se generan en vez de escribirse, y por eso el generador escribe en
los dos sitios.

## Compilar

Hacen falta tres cosas, y solo una de ellas pide cuenta de Garmin.

**1. El SDK.** Trae `monkeyc`, `monkeydo` y el simulador:

```
brew install --cask connectiq
```

**2. La developer key.** Es la firma de la app, se genera una vez y no va al
repo (`.gitignore` excluye `*.der` y `*.pem`). No hace falta cuenta ni pagar
nada: los 100 USD anuales de Garmin son solo para el programa de monetización,
que aquí no aplica.

```
openssl genrsa -out developer_key.pem 4096
openssl pkcs8 -topk8 -inform PEM -outform DER -in developer_key.pem -out developer_key.der -nocrypt
```

**3. Las definiciones de dispositivo.** Esto es lo único que obliga a iniciar
sesión, con una cuenta de Garmin cualquiera (la de Garmin Connect sirve, y es
gratis). Sin ellas `monkeyc` no compila para ningún reloj: no acepta un destino
genérico, y el simulador no tiene qué arrancar.

```
brew install --cask connectiq-sdk-manager
```

Abre **SdkManager.app**, inicia sesión y descarga los dispositivos en la
pestaña *Devices*. Van a `~/Library/Application Support/Garmin/ConnectIQ/Devices`,
que es donde los busca el `monkeyc` de Homebrew. Hay que tener descargados
todos los que nombra el `monkey.jungle`: si falta uno, la compilación **falla**
con `is not a valid device / family qualifier`, aunque estés compilando para
otro reloj.

Ya con eso, cada proyecto se compila desde su carpeta:

```
cd app && monkeyc -f monkey.jungle -o bysd.prg -y <developer_key.der> -d fenix7
cd datafield && monkeyc -f monkey.jungle -o bysd-field.prg -y <developer_key.der> -d fenix7
```

Para el simulador: arranca `connectiq` una vez y luego `monkeydo <prg> fenix7`.
Desde VS Code, `Ctrl+Shift+P` → *Monkey C: Run App*.

Para cargarlo en un reloj de verdad: conéctalo por USB y copia el `.prg` a
`GARMIN/APPS/` de la unidad que monta.

## Idiomas

Están español, inglés, francés, alemán, italiano y portugués. El reloj elige
solo según el idioma que tenga configurado el sistema; el corredor no elige
nada y no hay menú de idioma. Si su reloj está en un idioma que no traemos, ve
el inglés.

Las traducciones **no se editan en los XML**: viven todas juntas en la tabla de
`tools/generar_strings.py`, que es lo único que garantiza que no se quede una
clave a medias. Para añadir un idioma, añade su código a `IDIOMAS`, rellena la
columna, ejecuta el script y añade el idioma al `manifest.xml`:

```
python3 tools/generar_strings.py
```

El script termina avisando de qué etiquetas pasan de 18 caracteres. Hoy solo
salta una: *«Ritmo insufficiente»*, el italiano, con 19.

Ese aviso conviene tomárselo como lo que es —una señal de alerta, no un
veredicto—, porque medido en el simulador **ninguna etiqueta se recorta en
ningún reloj**, ni siquiera en el Instinct 2, que es el más pequeño. Y la
intuición de que manda la pantalla pequeña resultó ser falsa: el único texto
que llegó a salirse lo hizo en la pantalla **más grande**, porque las AMOLED
usan una fuente numérica proporcionalmente mayor. Si tocas una etiqueta o un
formato, mídelo; no lo supongas en ninguna de las dos direcciones.

Las unidades no son idioma y van por otro carril: `DeviceSettings` dice si el
reloj está en métrico o imperial, y `Fmt` obedece. Un corredor de Tennessee ve
millas aunque tenga el reloj en español.

## Ajustes (desde Garmin Connect Mobile)

| Ajuste | Para qué |
|---|---|
| Dorsal | Identifica al corredor. Hoy solo se muestra; hará falta cuando exista el endpoint de abajo |
| Código de carrera | Vacío significa «la carrera que el sitio tenga publicada» |
| Aviso de corral | Vibración a los 3, 2 y 1 minuto |
| Refresco | Segundos entre consultas. 60 por defecto, mínimo 30 |

En el reloj no se pregunta nada: a las veinte horas de carrera nadie quiere
teclear en una esfera.

## Lo que sí está comprobado

La aritmética del reloj local y del margen se verificó con un puerto de la
lógica a Python, contra los casos del boceto y contra los saltos largos (un
reloj que lleva treinta horas sin sincronizar proyecta la vuelta correcta sin
recorrer un bucle hora a hora).

Además, ya en el SDK:

- **Compilación.** Los dos proyectos, para los 24 relojes de la lista, sin
  errores ni avisos.
- **Ejecución.** Las cuatro páginas de la app y el campo de datos se dibujan en
  el simulador sin fallos, probados en 416 px, 260 px y 176 px.
- **Anchos de texto.** Medidos con `getTextWidthInPixels` en las fuentes reales
  de cada reloj, contra la cuerda del círculo a la altura donde se dibuja cada
  cosa —que es el hueco de verdad en una esfera, no el ancho de la pantalla—.
  Con los formatos actuales no se recorta nada, y el peor caso que queda es un
  margen de `-1200:00` a 386 px de los 416 que hay.
- **El emblema.** Ningún reloj de la lista recibe uno que no le quepa, salvo el
  Instinct 2, donde no cabría ninguno y lo encoge `SplashView`.

Lo que **no** está comprobado sigue siendo lo que solo se ve en un reloj de
verdad: batería, memoria bajo carga y treinta horas de Bluetooth.

## Lo que falta

- **Probarlo en un reloj de verdad.** Es lo único grande que queda. El
  simulador no dice nada de la batería ni de la memoria a las veinte horas.
- **`GET /api/race/watch`.** Un endpoint público y pequeño, por `race_code` y
  dorsal, que devuelva unos 200 bytes. Cerraría tres huecos de un golpe:
  `km_por_vuelta` y `minutos_por_vuelta` (hoy solo salen en `/live`, que es del
  panel, y la app usa valores por defecto), si al corredor le marcaron la
  vuelta en curso, y evitaría las dos llamadas actuales. La app ya lee esos dos
  campos si aparecen: en cuanto el backend los publique, deja de usar sus
  valores por defecto sin tocar una línea.
- **La lista de productos del `manifest.xml`.** Sigue puesta a mano y sigue
  envejeciendo con cada modelo nuevo, aunque ahora al menos los 24 nombres son
  válidos. Ojo con esto: un identificador mal escrito **no rompe la
  compilación**, solo suelta un `WARNING` y deja al reloj fuera. Así estuvieron
  fuera los seis Forerunner, que se llamaban `forerunner255` cuando el SDK los
  llama `fr255`. Compila con `-w` y lee los avisos.
- **La memoria del campo de datos.** Compila y dibuja, pero no se ha medido
  cuánta memoria gasta con la actividad grabando, que es donde aprieta.
- **El icono del lanzador** es un recorte automático del emblema (solo el aro y
  la lagartija, porque a 60 píxeles el texto curvo no se lee). Funciona, pero
  merece que lo dibuje alguien. Y cuando se dibuje, que sea uno por tamaño:
  hay 60×60 y cada reloj pide el suyo, de 35×35 (vívoactive 4) a 70×70
  (Venu). Garmin lo escala solo, así que no rompe nada, pero son los únicos
  avisos que quedan al compilar —20 de los 24 relojes— y un icono escalado a
  ojo se nota en la lista del reloj.
