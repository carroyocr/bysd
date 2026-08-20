# Replanteamiento — 20 de agosto de 2026

La primera prueba en el reloj de verdad (fenix 8, 17–18 de agosto) salió mal.
Este documento restablece los requerimientos, dice qué se mantiene y qué
cambia, y deja el plan para llegar a algo que funcione de verdad en una
carrera de 80–120 horas. Sustituye a la sección «0» de `garmin.md`; el
`README.md` sigue siendo la referencia de arquitectura.

## 1. Lo que pasó en el reloj, y por qué

Lo que se vio en la muñeca tiene explicación conocida, confirmada en el
simulador antes de la prueba y apuntada en `garmin.md`:

| Lo que se vio | La causa |
|---|---|
| No se podía cambiar de pantalla | La pre-salida (vuelta 0) corta el dibujado antes del enrutado de páginas. Con vueltas de 60 minutos, ese candado puede durar media hora y parece un congelamiento. |
| «Se congeló / se cerró» y el manejo confuso | BACK nunca abre el menú de terminar: no hay forma sana de cerrar la carrera, y el descarte a la fuerza pareció un reinicio del reloj. |
| Datos incorrectos | La aritmética del margen jamás pasó por el simulador con distancia real (`Activity Data`): llegó al reloj sin validar. |

La conclusión importa: **el diseño de fondo no falló; falló la capa de
interacción y faltaron pruebas con datos reales.** La aritmética del reloj de
carrera sí está verificada (puerto a Python en `tools/verificar_aritmetica.py`).

## 2. Los requerimientos, restablecidos

Los ocho puntos acordados el 20 de agosto, y cómo los cubre el sistema:

| # | Requerimiento | Cómo se resuelve | Estado |
|---|---|---|---|
| 1 | Distancia recorrida de la vuelta | `kmEnLaVuelta()`: distancia de la actividad menos el corte tomado en la campana | Escrito, sin probar con datos reales |
| 2 | Ritmo promedio de la vuelta | tiempo de vuelta ÷ km de vuelta; oculto bajo 1 km porque antes da tumbos | Escrito, sin probar |
| 3 | Tiempo y distancia restantes | objetivo − recorrido; falta = restante × ritmo. El objetivo se autocalibra con lo que midió el GPS la vuelta anterior (filtro 0.8–1.2) | Escrito, sin probar |
| 4 | **Margen de descanso (clave)** | margen = lo que queda de hora − lo que falta al ritmo actual. Positivo (verde): descanso previsto. Negativo (rojo): a ese ritmo no llega | Escrito, sin probar |
| 5 | Extraordinariamente liviana | Estado de tamaño fijo, presupuesto de memoria medido, reglas de código (§4) | **Nuevo trabajo** |
| 6 | Avisos a 3, 2 y 1 minuto | El corral: entra solo en los últimos 3 minutos, pantalla roja, vibración en 180/120/60 s. Desactivable | Escrito, probado a medias en simulador |
| 7 | Cierre de vuelta sin error | LAP solo **cierra** la vuelta (solo vale el primero; los repetidos se ignoran). Opcional: autocierre por GPS a 30 m del punto de salida con más de media vuelta hecha. La vuelta siguiente **la abre la hora**, nunca un botón | Escrito, autocierre sin probar |
| 8 | Que no se estanque en 80 h | Recuperación tras caída + memoria plana + protocolo de pruebas largas (§4) | **Nuevo trabajo** |

## 3. Lo que se mantiene (ratificado hoy)

- **Una sola actividad continua**, elegida de nuevo hoy: la app graba su
  propia sesión, una vuelta FIT por hora, sin botón de pausa (la campana no
  espera a nadie). Al terminar se guarda y sube a Garmin Connect.
- **El reloj de pared manda.** START ancla el cero a la marca de hora más
  cercana (epoch); los cambios de hora no mueven campanas.
- **Sin servidor.** Vale para cualquier backyard.
- **Dos productos**: la app (la actividad es suya) y el campo de datos (la
  actividad es la nativa). El campo de datos se queda como plan B de máxima
  estabilidad: si la app diera guerra en carrera, el corredor tiene el margen
  dentro de la app de Correr de Garmin, que no se cae. Comparten `RaceState`.

## 4. Lo que cambia

1. **Navegación siempre viva.** El enrutado de páginas (UP/DOWN o deslizar)
   va antes que cualquier estado. La pre-salida deja de ser un candado: es
   una página más, y toda página tolera «sin datos» con guiones. Regla nueva:
   ningún estado de la carrera puede impedir cambiar de pantalla.
2. **Mapa de botones único y explícito**, documentado y sin excepciones:
   UP/DOWN cambian de página; START da la salida (antes) o marca el término
   de la vuelta (en carrera); BACK abre el menú de terminar — Reanudar,
   Guardar, Descartar con confirmación aparte. El fallo de `onBack` se
   rediagnostica con trazas de `monkeydo` antes de tocar nada.
3. **Recuperación tras caída** (nuevo; es lo que convierte el requisito 8 en
   diseño y no en esperanza). El ancla `campana0`, `vueltaMarcada`, la
   calibración y el punto de salida se escriben en `Storage` **cuando
   cambian** (salida, LAP, campana — nunca cada segundo). Si la app abre y
   hay una carrera viva guardada, ofrece «Reanudar carrera»: sesión de
   grabación nueva, el mismo reloj de pared. Un cuelgue cuesta como mucho el
   tramo grabado desde entonces; la cuenta de la carrera no se pierde nunca.
4. **Presupuesto de memoria escrito y medido.** `RaceState` ya es de tamaño
   fijo (unos quince escalares). Reglas: ninguna colección crece con las
   vueltas ni con el tiempo; nada se acumula en `onUpdate`; los per-vuelta
   son escalares que se sobreescriben. Se mide con `monkeyc --build-stats` y
   el perfilador del simulador, y el número queda apuntado en el README.
   Techo: la mitad del presupuesto del reloj más chico de la lista.
5. **La batería es un dato de diseño, no una sorpresa.** Con actividad
   continua el GPS graba las 120 horas y ningún reloj llega sin carga. La
   página Reloj ya muestra la batería (roja bajo 20 %); en la fase 4 se mide
   el consumo real por hora y se documenta el protocolo: cargar durante los
   descansos, sin tocar la app, que sigue grabando.

## 5. El plan, por fases

Cada fase tiene criterio de salida; no se pasa a la siguiente sin cumplirlo.

- **F1 — Interacción viva** (simulador). Los dos fallos confirmados:
  navegación siempre disponible y BACK → menú de terminar. *Criterio:* con
  vueltas de 5 minutos, recorrer todas las páginas antes, durante y después
  de la campana; cerrar la carrera por Guardar y por Descartar.
- **F2 — El margen con datos reales** (simulador, `Activity Data → Play a
  FIT file`). La lista completa de `garmin.md` §1: la foto de distancia se
  corta en cada campana, la calibración solo acepta vueltas verosímiles, el
  margen cambia de signo y color, el guion bajo 1 km, el FIT sale con sus
  vueltas. *Criterio:* los ocho puntos de esa lista, vistos.
- **F3 — Robustez de 120 horas.** Recuperación tras caída (matar la app a
  mitad de carrera y reanudar), reglas de memoria aplicadas y medidas,
  ensayo largo en el simulador con un FIT de horas. *Criterio:* memoria
  plana tras el ensayo largo; la carrera sobrevive a un cierre forzado.
- **F4 — El reloj de verdad.** Primero un ensayo en la calle con vueltas de
  5–10 minutos (campanas, LAP, autocierre, corral); después uno de 2–3
  horas midiendo batería por hora para proyectar las 120. *Criterio:* cero
  sorpresas de manejo y una proyección de batería escrita.
- **F5 — Pulido y publicación.** Icono por talla, y decidir tienda Connect
  IQ (dos fichas) o `.prg` a mano.

## Estado de la F1 (20 de agosto, mediodía)

Sesión de simulador con manejo automatizado (fenix847mm). Hecho y visto:

- **Navegación siempre viva: arreglada y verificada.** Con la carrera en
  vuelta 0 se recorren las cuatro páginas; Margen muestra el guion, Tuyo
  clava el 0 y el tiempo no sale negativo. En carrera, la página Vuelta
  dibuja "Lap 1 / 53:44 / Next start" con su aro y el ancla clavada a la
  hora en punto.
- **El fallo de BACK no era el botón: era el menú.** `onBack` siempre se
  disparó (trazas en consola con `script`+pty: el log de `monkeydo` a
  archivo sale vacío sin pty). El menú de terminar con rótulos de
  `loadResource` se dibujaba VACÍO (pantalla negra: en el reloj pareció
  que BACK no hacía nada); con cadenas literales se dibuja perfecto
  (probado: Fin / Reanudar / Guardar / Descartar en pantalla). Queda por
  confirmar la variante final —ids de recurso directos en `MenuItem`, ya
  escrita en `MainDelegate.onBack`— cuya prueba salió contaminada dos
  veces porque el Return no llegaba a la ventana (foco del mouse).
- **Ojo en el simulador:** la pantalla negra con el triángulo azul NO es
  un menú vacío: es la pantalla nativa cuando la app ya se cerró (BACK en
  la línea de salida sale de la app, por diseño). Y las teclas solo entran
  tras un clic real en la barra de título; los botones del bisel
  (START ~(655,372), BACK ~(645,612) con la ventana en su sitio) son más
  fiables que el teclado.
- Pendiente F1: confirmar el menú con ids de recurso, probar Guardar y
  Descartar de punta a punta, y quitar las trazas (`Sys.println`) de
  `MainDelegate` al cerrar la fase.

## 6. Bocetos

Los bocetos de las pantallas (salida, vuelta, margen, tuyo, reloj, corral,
menú de terminar y las tres tallas del campo de datos) están en el artifact
«Backyard para Garmin — replanteamiento» publicado el 20 de agosto de 2026,
que sustituye al boceto original «BYSD en tu muñeca».
