# Notificaciones push de BYSD Live

Avisos que llegan al teléfono **aunque la app esté cerrada**. Van por Firebase
Cloud Messaging (FCM), que sirve para Android y para iOS (en iOS, Firebase
reenvía a APNs).

No confundir con el aviso que ya existía: ese usa la API de notificaciones del
navegador y solo funciona con la app abierta. Sigue ahí para quien entra por el
navegador; dentro de la app instalada se apaga para no avisar dos veces.

## Qué se envía

| Aviso | Quién lo recibe | Cuándo |
|---|---|---|
| Vuelta completada | Solo quien sigue a ese corredor | Al confirmar el escaneo del QR |
| Eliminación (DNF) | Solo quien sigue a ese corredor | En los tres casos de DNF: manual, regreso antes de tiempo y tiempo agotado |
| Aviso escrito a mano | Todos los que tengan la app | Cuando se envía desde el panel, tab **Avisos App** |

La lista de corredores seguidos vive en el teléfono y se copia al backend cada
vez que cambia. El backend no guarda nombre, correo ni cuenta: solo el token
del dispositivo y los dorsales que sigue (colección `push_devices`).

## Puesta en marcha

Nada de esto está hecho todavía; hasta que se complete, la app funciona igual
pero no sale ningún aviso (el panel lo avisa en el tab **Avisos App**).

### 1. Proyecto de Firebase

1. Crear un proyecto en <https://console.firebase.google.com>.
2. Añadir una app **Android** con el ID `com.backyardultrasd.app`.
   Descargar `google-services.json` y ponerlo en `frontend/android/app/`.
3. Añadir una app **iOS** con el mismo ID. Descargar `GoogleService-Info.plist`
   y añadirlo al proyecto desde Xcode (arrastrarlo sobre la carpeta `App`, con
   "Copy items if needed" marcado).

Estos dos archivos son configuración del cliente, no secretos: pueden ir al
repositorio y hacen falta para compilar.

### 2. Llave de APNs (solo iOS)

1. En <https://developer.apple.com> → Certificates, Identifiers & Profiles →
   Keys, crear una llave con **Apple Push Notifications service (APNs)** y
   descargar el `.p8` (solo se puede descargar una vez).
2. Subirla en Firebase → Configuración del proyecto → Cloud Messaging → sección
   iOS, junto con el Key ID y el Team ID.
3. En el identificador de la app (Identifiers), activar la capacidad
   **Push Notifications**.
4. En Xcode: pestaña **Signing & Capabilities** → **+ Capability** →
   **Push Notifications**.

### 3. Cuenta de servicio para el backend

1. Firebase → Configuración del proyecto → **Cuentas de servicio** →
   *Generar nueva clave privada*. Descarga un `.json`.
2. **Es un secreto.** No va al repositorio (`.gitignore` ya ignora
   `*firebase-adminsdk*.json`). Guardarlo en `~/Proyectos/bysd-secretos/`.
3. En Render, servicio `bysd-backend` → Environment, crear la variable
   `FCM_SERVICE_ACCOUNT_JSON` y pegar **el JSON completo en una sola línea**.

Para probar en local, la misma variable en `backend/.env`.

### 4. Compilar la app

```bash
cd frontend && yarn build && npx cap sync
```

Android Studio para el APK/AAB, Xcode para iOS. Si `npx cap sync ios` falla con
un error de Unicode de CocoaPods, es la configuración regional del terminal:

```bash
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 npx cap sync ios
```

## Cómo comprobar que funciona

1. Instalar la app, entrar a una carrera, marcar un corredor como favorito y
   activar **Notificaciones de vueltas** en Configuración (pide permiso del
   sistema).
2. En el panel, tab **Avisos App**: el contador debe subir a 1 teléfono.
3. Enviar un aviso de prueba desde ese mismo tab.
4. Para el aviso automático, escanear una vuelta de ese corredor.

## Detalles de implementación

- `backend/services/push_service.py` — firma el JWT de la cuenta de servicio,
  lo canjea por un access token (cacheado una hora) y envía a la API HTTP v1 de
  FCM. Sin dependencias nuevas: PyJWT y httpx ya estaban.
- `backend/routes/push.py` — alta/baja de dispositivos, aviso manual y la
  función `avisar_a_seguidores` que usa el escaneo.
- `backend/routes/qr_scan.py` — dispara los avisos en segundo plano
  (`asyncio.create_task`) para no retrasar la fila de escaneo.
- `frontend/src/live/push.js` — permiso, token y sincronización de favoritos.
- `frontend/src/components/PushComposer.jsx` — el tab del panel.

Los tokens que FCM rechaza por desinstalación se borran solos de
`push_devices` en el siguiente envío.

### Por qué hay un sustituto del SDK web de Firebase

El plugin `@capacitor-firebase/messaging` trae una implementación para
navegador que importa `firebase/app` y `firebase/messaging`. En el navegador no
usamos push, así que en vez de instalar el SDK completo de Firebase (cientos de
kilobytes en el bundle del sitio) se apunta a `src/live/firebaseWebStub.js` con
un alias de webpack en `craco.config.js`. Si algún día se quiere push en el
navegador, hay que instalar `firebase` y quitar ese alias.

## Limitaciones conocidas

- **Con la app abierta en primer plano**, Android no muestra el aviso en la
  bandeja: lo entrega a la app, que hoy no lo pinta. Se ven al salir de la app.
- Un aviso enviado **no se puede retirar**.
- Los avisos automáticos salen del escaneo del QR. Si una vuelta se registra a
  mano desde el panel, no genera aviso.
