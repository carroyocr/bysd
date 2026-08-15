# Publicar BYSD Live en Google Play

Guía de la primera subida al Play Console. La app iOS va por su cuenta y no
depende de nada de aquí.

## 1. Compilar el bundle

Siempre en este orden. `yarn build` a secas dejaría la app apuntando a
`localhost` y en el teléfono se vería sin datos y sin ningún error visible.

```
cd frontend
yarn build:mobile
cd android
./gradlew bundleRelease
```

El `.aab` firmado queda en `android/app/build/outputs/bundle/release/app-release.aab`.

La firma sale de `~/Proyectos/bysd-secretos/bysd-android-signing.properties`
(llave `bysd-upload.jks`). Si ese archivo no está, el build sale **sin firmar**
y Play lo rechaza. La llave definitiva la guarda Google con Play App Signing;
esta es solo la llave de subida y se puede reemplazar si se pierde.

### Requisito: JDK 21

Los plugins de Capacitor piden una cadena de herramientas Java 21 exacta. El
JDK que trae Android Studio ya no sirve (viene con el 25) y el build falla con
`Cannot find a Java installation ... languageVersion=21`.

```
brew install openjdk@21
```

Y compilar apuntando ahí:

```
JAVA_HOME=/opt/homebrew/opt/openjdk@21 ./gradlew bundleRelease
```

## 2. Numeración de versiones

En `android/app/build.gradle`:

- `versionCode`: número entero que **sube en cada subida**. Play rechaza dos
  bundles con el mismo. Va en 1 (primera subida).
- `versionName`: lo que ve el usuario ("1.0").

## 3. Ficha de la tienda

**Nombre:** BYSD Live

**Descripción corta** (máx. 80 caracteres):

```
Sigue la Backyard Ultra Santo Domingo en vivo: vueltas, corredores y avisos.
```

**Descripción larga:**

```
BYSD Live es la app oficial del Backyard Ultra Santo Domingo, la carrera de
resistencia donde se corre un aro cada hora, en punto, hasta que queda uno.

Con la app puedes:

• Seguir la carrera en vivo. Mira quién sigue en pista, cuántas vueltas lleva
  cada corredor y cuántos kilómetros acumula, vuelta a vuelta.

• Seguir a tus corredores. Marca a quienes te interesan y recibe un aviso en el
  teléfono cuando completan una vuelta o cuando se retiran.

• Mandar ánimo. Escribe mensajes a los corredores que estén en pista; ellos los
  leen desde su perfil.

• Consultar la clasificación y el histórico de las ediciones anteriores.

• Ver tu perfil de atleta: tus inscripciones, tus resultados y tus datos.

• Conocer a los patrocinadores que hacen posible el evento.

El Backyard Ultra Santo Domingo se corre en la República Dominicana bajo el
formato oficial Backyard Ultra: un aro de 6.7 km cada hora, sin línea de meta,
hasta que solo queda un corredor en pie.

Más información en backyardultrasantodomingo.com
```

**Categoría:** Deportes
**Etiquetas:** carrera, ultramaratón, running, resultados en vivo
**Correo de contacto:** backyardultrasantodomingo@gmail.com
**Sitio web:** https://backyardultrasantodomingo.com
**Política de privacidad:** https://backyardultrasantodomingo.com/privacidad

## 4. Material gráfico que hay que producir

Nada de esto existe todavía en el tamaño que Play exige:

| Pieza | Medida | Estado |
|---|---|---|
| Icono de la ficha | 512 × 512 PNG, sin transparencia | Falta. El icono de la app está en 192×192 (`android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png`) y `public/icon-bu.png` en 300×300: hay que regenerarlo desde el original en 512. |
| Gráfico destacado | 1024 × 500 PNG o JPG | Falta. Es la imagen de cabecera de la ficha. |
| Capturas de teléfono | Mínimo 2, entre 320 y 3840 px de lado | Faltan. Recomendadas: la pantalla en vivo, la ficha de un corredor, el perfil y los patrocinadores. |

## 5. Formularios del Play Console

- **Seguridad de los datos**: hay que declarar lo que la app recoge de verdad y
  que cuadre con `/privacidad`. En resumen: datos personales (nombre, correo,
  teléfono), **información de salud** (tipo de sangre, condición médica,
  alergias), fotos, e identificadores del dispositivo (token de notificaciones).
  Todo cifrado en tránsito; el usuario puede pedir el borrado por correo. No se
  comparte con terceros con fines publicitarios.
- **Clasificación de contenido**: cuestionario; la app no tiene contenido
  sensible.
- **Público objetivo**: personas adultas. No marcar "dirigida a niños".
- **Permisos**: `CAMERA` (leer el QR del dorsal) e `INTERNET`. Si Play pregunta
  por el uso de la cámara, la respuesta es que solo lee códigos QR en el momento
  y no guarda ni envía imágenes.

## 6. Primera publicación

1. Crear la app en el Play Console (nombre, idioma por defecto español).
2. Subir el `.aab` a **Pruebas internas** primero. Sale en minutos y permite
   comprobarlo en un teléfono real antes de exponerlo.
3. Completar ficha, material gráfico y los formularios del punto 5.
4. Enviar a revisión para producción. La primera revisión de una cuenta nueva
   puede tardar varios días.
