# Backyard, para Garmin

App de Connect IQ para el corredor de una backyard ultra —cualquiera—. Le dice
en qué vuelta va, cuánto falta para la próxima campana y si al ritmo que lleva
va a llegar a tiempo.

> **Estado: compila y arranca en el simulador.** Los dos proyectos compilan sin
> errores ni avisos para los 104 relojes de la lista —AMOLED y MIP, desde la
> generación fēnix 5 de 2017 y el Forerunner 645—. Lo que
> **no** se ha probado todavía es un reloj de verdad: batería, memoria bajo
> carga y treinta horas de actividad solo se ven ahí.

## La idea

Una backyard es un metrónomo: la campana suena cada hora exacta desde la
salida. Nada más hace falta para llevar la cuenta, y por eso esta app **no
habla con ningún servidor**: funciona igual en una carrera de doscientos
corredores que en una de seis.

Y la app no es unas pantallas montadas encima de una actividad ajena: **la app
es la actividad**. Graba su propia sesión con `ActivityRecording`, y las
reglas son las de una backyard de verdad:

- **Las campanas van con el reloj de pared.** Al pulsar START, el cero se
  ancla a la marca de hora más cercana: quien arranca a las 8:03 —o a las
  7:58— corre igual su vuelta 1 de 8:00 a 9:00. Cualquier retraso en la
  salida queda corregido de raíz, y como el ancla se guarda en epoch, un
  cambio de hora a mitad de carrera no mueve ninguna campana.
- **Las vueltas las abre la hora, no un botón.** LAP (el botón START durante
  la carrera) marca que la vuelta *terminó* —el corredor llegó a meta y
  empieza su descanso— y solo vale el primero de cada vuelta: los demás se
  ignoran. Opcionalmente, la marca puede caer sola al llegar al punto de
  salida (ajuste «Vuelta auto», con el punto fijado al dar la salida).
- **Campana siempre**: en cada apertura de vuelta el reloj vibra largo y se
  marca la vuelta en el FIT. Los avisos de 3, 2 y 1 minuto sí se pueden
  apagar.
- **Al terminar, la actividad se guarda** como cualquier carrera y sube a
  Garmin Connect (y de ahí a Strava) por el camino normal, con una vuelta por
  hora en el FIT y el tramo de meta a campana separado si se marcó el LAP.

El resto sale de cuatro ajustes puestos una vez desde el teléfono: cuánto dura
la vuelta, cuánto mide, si vibra el corral y si la vuelta se marca sola. No
hay botón de pausa: la campana no espera a nadie.

## Las pantallas

El emblema a pantalla completa poco más de un segundo, y de ahí a la **línea
de salida**: qué vuelta se va a correr (distancia y minutos) y si el GPS ya
fijó. START da la salida sin pedir confirmación, porque con la cuenta atrás
del director de carrera sonando un diálogo estorba; si se pulsó antes de la
hora, la app muestra la cuenta atrás «Para la vuelta 1» y la campana suena
sola. Después, cuatro páginas que se recorren con arriba y abajo (o
deslizando, en los táctiles) — y añadir una página nueva es añadir un caso al
enumerado de `MainView`:

| Página | Cifra grande | Debajo |
|---|---|---|
| **Vuelta** | Cuenta atrás a la próxima campana | «Próxima salida» corriendo, «De descanso» tras el LAP |
| **Margen** | Minutos a favor o en contra | Distancia, objetivo y ritmo |
| **Tuyo** | Vueltas completadas (el LAP suma la actual) | Tiempo en carrera y km |
| **Reloj** | Hora del día (12 o 24 h, según el reloj) | Batería, en rojo del 20 % para abajo |

Las páginas cubren el boceto original («BYSD en tu muñeca») completo, con dos
excepciones deliberadas: «Quedan en pie» y el punto de sincronía necesitaban
un servidor que contara la carrera, y esta app no tiene red a propósito. La
página del reloj es nueva: en treinta horas, saber si la batería aguanta la
noche es información de carrera.

**BACK durante la carrera** no sale de la app sin preguntar —debajo hay una
actividad grabando—: abre el menú de terminar, con Reanudar, Guardar y
Descartar. Descartar pide confirmación aparte, porque tirar treinta horas por
un toque sería imperdonable.

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

- **El ritmo que se multiplica no es el que se enseña.** Con trescientos
  metros hechos, el ritmo de la vuelta da tumbos y multiplicarlo por los seis
  que faltan saltaría minutos enteros de una zancada a otra. Así que el margen
  proyecta con una mezcla: en el metro cero manda el ritmo medio de la carrera
  —lo que este corredor lleva corriendo todo el día— y en el primer kilómetro
  manda ya solo el de la vuelta, con la transición pesada por la propia
  distancia recorrida. El ritmo que se lee en pantalla, en cambio, es siempre
  el crudo de la vuelta. El guion dura solo el primer minuto, hasta que hay
  distancia de la que sacar un ritmo.
- **El objetivo se calibra solo.** El GPS puede medir 6.85 km en un circuito
  de 6.7, y sobre treinta vueltas eso descuadra la cuenta. Al cerrarse cada
  vuelta se guarda lo que midió el reloj y se usa como referencia en la
  siguiente, siempre que se parezca a una vuelta de verdad.

## El campo de datos

La pantalla del margen necesita que haya una actividad grabando, porque el
ritmo sale de la distancia que va midiendo el reloj. Su sitio natural no es una
app aparte que hay que abrir: es un campo de datos dentro de la actividad, que
el corredor coloca una vez en su pantalla de carrera y no vuelve a tocar.

Aquí la actividad sí es la nativa del reloj —el campo vive dentro de ella— y
el cero es su arranque. Comparte con la app el reloj de la carrera y los
formatos; lo que no comparte es el dibujo, porque la pantalla no es la esfera
sino el trozo que le haya tocado, y eso lo decide el corredor al repartir sus
campos. Se dibuja en tres tallas:

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
    Fmt.mc              formatos, y la única decisión de unidades (km o mi)
  resources/
    settings/           los tres ajustes, que son los mismos en las dos
    drawables/          el icono del lanzador

app/                    la app de reloj
  manifest.xml          productos, idiomas y permisos (Fit y Positioning)
  monkey.jungle         qué carpeta de recursos usa cada familia de relojes
  source/
    BackyardApp.mc      la sesión que graba, la campana y el latido de 1 s
    SplashView.mc       el emblema
    StartView.mc        la línea de salida: la vuelta, el GPS y START
    MainView.mc         las tres páginas
    MainDelegate.mc     botones, gestos y el menú de terminar
  resources/            emblema de 240 px
  resources-small/      emblema de 196 px
  resources-large/      emblema de 380 px
  resources-<lang>/     una carpeta por idioma

datafield/              el campo de datos
  manifest.xml
  monkey.jungle
  source/
    BackyardFieldApp.mc la AppBase por la que entra: le da la vista al reloj
    BackyardField.mc    el margen, en tres tallas según el hueco que le toque
  resources-<lang>/     una carpeta por idioma

tools/generar_strings.py       genera todos los strings.xml desde una sola tabla
tools/verificar_dispositivos.py cruza la lista de relojes con el SDK: ids que
                              no existen, iconos de la talla que no es y
                              emblemas que la linea de dispositivo se comio
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
pestaña *Devices*. Van a `~/Library/Application Support/Garmin/ConnectIQ/Devices`.

Hay **dos SDK** instalados y solo sirve uno: el del SdkManager,
`~/Library/Application Support/Garmin/ConnectIQ/Sdks/connectiq-sdk-mac-*/bin/`.
El de Homebrew compila igual, pero su simulador arranca sin abrir el puerto y
`monkeydo` responde «Unable to connect to simulator» sin más explicación.

Ya con eso, cada proyecto se compila desde su carpeta:

```
cd app && monkeyc -f monkey.jungle -o backyard.prg -y <developer_key.der> -d fenix7 -w
cd datafield && monkeyc -f monkey.jungle -o backyard-field.prg -y <developer_key.der> -d fenix7 -w
```

El `-w` no es opcional: un identificador de dispositivo mal escrito **no rompe
la compilación**, solo suelta un `WARNING` y deja al reloj fuera en silencio.
Y antes de compilar, esto cruza la lista con el SDK y cuesta un segundo:

```
python3 tools/verificar_dispositivos.py
```

Para el simulador: arranca `connectiq` una vez y luego `monkeydo <prg> fenix7`.
Desde VS Code, `Ctrl+Shift+P` → *Monkey C: Run App*.

Para cargarlo en un reloj de verdad: compila **en release y optimizado**,
añadiendo `-r -O 2` al comando de arriba (y `-d fenix847mm` para el fenix 8 de
51 mm), y copia el `.prg` a `GARMIN/APPS/` de la unidad que monta. El `-r -O 2`
no es cosmético: la build debug sin optimizar se nota en el reloj real, con
los botones respondiendo tarde al pasar de pantalla.

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

| Ajuste | Para qué | Por defecto |
|---|---|---|
| Vuelta (minutos) | Cuánto dura una vuelta | 60 |
| Vuelta (km) | Cuánto mide, **siempre en kilómetros** | 6.7 |
| Aviso de corral | Vibración a los 3, 2 y 1 minuto | sí |
| Vuelta auto | Marcar el LAP solo al llegar al punto de salida | no |

Los valores por defecto son los de la backyard clásica.

La distancia va en kilómetros tenga el reloj la unidad que tenga, y por eso la
etiqueta lo dice. Es la única asimetría con el resto —`Fmt` dibuja en millas si
el reloj está en millas— y es deliberada: leyendo el ajuste en la unidad del
reloj, el 6.7 de fábrica se convertía en 6.7 **millas** para quien tuviera el
reloj en imperial y no lo tocara, es decir 10.8 km de vuelta. Un ajuste que
cambia de unidad no puede tener un valor por defecto correcto para todos.

En el reloj no se pregunta nada: a las veinte horas de carrera nadie quiere
teclear en una esfera.

## Lo que sí está comprobado

La aritmética del reloj de la carrera se verificó con un puerto de la lógica a
Python, en `tools/verificar_aritmetica.py`: el redondeo del ancla al dar la
salida (tarde, temprano y clavado en la campana), la campana exacta (el
segundo 3600 es vuelta 2 con la hora entera por delante, no vuelta 2 con
cero), los saltos largos —treinta horas se resuelven con una división, no
recorriendo un bucle hora a hora—, la entrada y salida del corral, la regla de
un solo LAP válido por vuelta y las vueltas de duración distinta de una hora.
Se ejecuta solo, sin SDK:

```
python3 tools/verificar_aritmetica.py
```

Además, ya en el SDK:

- **Compilación.** Los dos proyectos, para los 104 relojes de la lista, sin un
  solo error ni aviso: 174 builds cada uno en el export de tienda.
- **Arranque.** La app y el campo de datos se cargan en el simulador con
  `monkeydo` sin ninguna excepción, y con una traza temporal en `onUpdate` se
  confirmó que la vista se repinta y con qué valores. Esa traza es la que
  descubrió dos fallos que la compilación no ve: el 6.7 por defecto leído como
  millas, y que **sin actividad `elapsedTime` no es `null` sino `0`**, con lo
  que la app fingía una vuelta 1 parada en 60:00 en vez de decir que no hay de
  dónde contar. Los dos están corregidos; el segundo es la razón de que
  `_milisActividad()` trate el cero como «todavía nada».
- **Anchos de texto.** Medidos con `getTextWidthInPixels` en las fuentes reales
  de cada reloj, contra la cuerda del círculo a la altura donde se dibuja cada
  cosa —que es el hueco de verdad en una esfera, no el ancho de la pantalla—.
- **El emblema.** Ningún reloj de la lista recibe uno que no le quepa, salvo el
  Instinct 2, donde no cabría ninguno y lo encoge `SplashView`.

Lo que **no** está comprobado sigue siendo lo que solo se ve en un reloj de
verdad: batería, memoria bajo carga y treinta horas de actividad.

## Lo que falta

Está en [`../garmin.md`](../garmin.md).
