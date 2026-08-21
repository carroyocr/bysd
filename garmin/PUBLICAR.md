# Publicar Backyard en la Connect IQ Store

Estado y guía para subir los dos productos a la tienda de Garmin. Actualizado
el 21 de agosto de 2026.

## Estado técnico — listo

- La **app** (`backyard.iq`) y el **campo de datos** (`backyard-margen.iq`)
  compilan para los **52 builds** de los 24 dispositivos, **sin un solo
  error**. Los paquetes de tienda están en `garmin/build/*.iq`.
- Firma con la developer key de `~/Proyectos/bysd-secretos/garmin/`.
- Único aviso pendiente: el **icono del lanzador**. Ver la sección al final.

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

Cada dispositivo pide su tamaño de icono (35, 40, 56, 60, 62, 65, 70 px). Ya
se generó el icono en los **siete tamaños** (en `shared/resources-icon<N>/`) y
cada reloj mapea al suyo en los `monkey.jungle`. Los `.iq` compilan **sin
ningún aviso de icono** — máxima calidad en todos los relojes, sin depender del
escalado de Garmin.

Grupos por tamaño de icono:

| px | dispositivos |
|---|---|
| 35 | vivoactive4 |
| 40 | fenix6/6pro/6s/6spro/6xpro, fenix7/7s/7x, enduro, enduro3, fr255/255s, fr955 |
| 56 | vivoactive5 |
| 60 | fenix843mm, epix2, fr265/265s |
| 62 | instinct2 |
| 65 | fenix847mm, fr965 |
| 70 | venu2, venu3 |

Hecho el 21 de agosto de 2026 (commit `837c51f`).
