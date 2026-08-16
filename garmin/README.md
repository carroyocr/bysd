# BYSD Live para Garmin

App de Connect IQ para el corredor de la Backyard Ultra Santo Domingo. Le dice
en qué vuelta va, cuánto falta para la próxima campana y si al ritmo que lleva
va a llegar a tiempo.

> **Estado: sin compilar.** El SDK de Connect IQ y su simulador no se pueden
> instalar en el contenedor donde se escribió este código, así que **nada de
> esto se ha compilado ni probado en un reloj**. La aritmética del reloj local
> y del margen sí está verificada (ver *Lo que sí está comprobado*). Lo
> primero que hay que hacer al abrirlo en tu máquina es `monkeyc` y el
> simulador, y contar con corregir errores de compilación.

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

## Estructura

Son **dos productos de Connect IQ**, porque un `manifest.xml` solo declara un
tipo de app. Comparten todo lo que no es pantalla.

```
shared/source/
  RaceState.mc          el reloj local de la carrera y el margen. La pieza clave
  Latido.mc             lo que hay que hacer cada segundo: refrescar y avisar
  ApiClient.mc          lo único que sale a la red
  Fmt.mc                formatos, y la única decisión de unidades (km o mi)

app/                    la app de reloj
  manifest.xml          productos, permisos e idiomas
  monkey.jungle         sourcePath incluye ../shared/source
  source/
    BysdApp.mc          el temporizador de un segundo
    SplashView.mc       el emblema
    MainView.mc         las cuatro páginas
    MainDelegate.mc     botones y gestos
  resources/            inglés, emblema de 240 px, icono, ajustes
  resources-small/      emblema de 196 px (relojes de 208)
  resources-large/      emblema de 380 px (AMOLED grandes)
  resources-<lang>/     una carpeta por idioma

datafield/              el campo de datos, dentro de la actividad
  manifest.xml
  monkey.jungle
  source/
    BysdFieldApp.mc     la cáscara que el sistema arranca
    BysdField.mc        mide el hueco y elige el reparto
  resources*/           sin emblema: ahí no cabe

tools/generar_strings.py  genera los strings.xml de los dos, desde una tabla
```

### El campo de datos

Es donde vive de verdad el margen, porque es el único sitio con distancia y
ritmo: la app de reloj no puede leer la actividad de otro. Y es donde el
corredor ya está mirando, que vale más que cualquier pantalla que haya que ir
a buscar.

El tamaño lo decide el corredor al montar su pantalla de actividad, así que no
hay medidas fijas: se mide el hueco y se elige el reparto — tres líneas si hay
sitio, dos si hay medio, y solo las dos cifras si cae en una banda estrecha. La
fuente se escoge midiendo con `getFontHeight`, porque una cifra recortada por
arriba no se lee. El fondo sale de `getBackgroundColor()`: pintar negro a la
fuerza dejaría un parche en un reloj con tema claro.

Va sin emblema a propósito. Un campo de datos tiene un presupuesto de memoria
mucho menor que una app, y veinte kilobytes de mapa de bits ahí no caben.

## Compilar

1. Instala el **Connect IQ SDK** y la extensión de **Monkey C** para VS Code.
2. Genera tu **developer key** (se hace una vez, desde la extensión). Es
   gratis: publicar una app gratuita en la Connect IQ Store no cuesta nada. Los
   100 USD anuales de Garmin son solo para el programa de monetización, que
   aquí no aplica.
3. Abre `app/` o `datafield/` como carpeta de trabajo (son dos proyectos) y
   compila:

```
cd app        # o cd datafield
monkeyc -f monkey.jungle -o bysd.prg -y <tu-developer-key.der> -d fenix7
```

4. Para el simulador, `Ctrl+Shift+P` → *Monkey C: Run App*, o `connectiq` y
   luego `monkeydo bysd.prg fenix7`. El campo de datos no se abre solo: en el
   simulador hay que empezar una actividad y añadirlo a una pantalla.

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

El script termina avisando de qué etiquetas pasan de 18 caracteres. Ese listado
es la lista de lo que hay que mirar en el simulador: **en una esfera de 208
píxeles el diseño lo decide la traducción más larga, nunca el español.**

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
recorrer un bucle hora a hora). Lo que **no** está comprobado es todo lo demás:
compilación, dibujado, fuentes, arcos, memoria y comportamiento real en
cualquier reloj.

## Lo que falta

- **Compilar y probar.** Nada de esto ha pasado por el simulador.
- **`GET /api/race/watch`.** Un endpoint público y pequeño, por `race_code` y
  dorsal, que devuelva unos 200 bytes. Cerraría tres huecos de un golpe:
  `km_por_vuelta` y `minutos_por_vuelta` (hoy solo salen en `/live`, que es del
  panel, y la app usa valores por defecto), si al corredor le marcaron la
  vuelta en curso, y evitaría las dos llamadas actuales. La app ya lee esos dos
  campos si aparecen: en cuanto el backend los publique, deja de usar sus
  valores por defecto sin tocar una línea.
- **La memoria del campo de datos.** Es el riesgo real de ese producto: el
  presupuesto es de decenas de kilobytes según el modelo. Si no entra, lo
  primero que sobra es la capa de red, y el campo pasa a leer el estado que ya
  trajo la app de reloj.
- **La lista de productos del `manifest.xml`.** Está puesta a mano y envejece
  con cada modelo nuevo. Conviene rehacerla con el selector de dispositivos de
  la extensión de VS Code, que conoce los del SDK instalado.
- **Los códigos de idioma** del `manifest.xml` y de las carpetas: confirmarlos
  contra la tabla de localización del SDK antes de publicar.
- **El icono del lanzador** es un recorte automático del emblema (solo el aro y
  la lagartija, porque a 60 píxeles el texto curvo no se lee). Funciona, pero
  merece que lo dibuje alguien.
