# Instrucciones para Claude — Backyard Ultra Santo Domingo

Este es un sitio **en producción en vivo** (`backyardultrasantodomingo.com`). La rama `main` se despliega automáticamente a producción (Render) en cada push. Actúa con ese cuidado.

## Reglas obligatorias

1. **NUNCA hagas cambios directamente sobre `main` sin probar primero.** Para cualquier corrección o mejora:
   - Crea una rama de trabajo: `git checkout main && git pull && git checkout -b <nombre-descriptivo>`
   - Haz los cambios ahí y pruébalos localmente.
   - Solo después de verificar, haz merge a `main` y push (eso publica a producción).
   - No hace falta pedir permiso para crear la rama: es el flujo estándar. Sí confirma antes de hacer merge/push a `main`.

2. **Prueba localmente antes de publicar:**
   - Backend: `cd backend && .venv/bin/uvicorn server:app --port 8001`
   - Frontend: `cd frontend && yarn start` (abre `http://localhost:3000`)

3. **Secretos y variables de entorno NO van al repo.** Viven en el dashboard de Render (Environment) y en `~/Proyectos/bysd-secretos/` localmente. Nunca commitees `.env`, URIs de base de datos, contraseñas ni llaves.

4. **Antes de tocar datos de la base, haz respaldo** (`mongodump` del Atlas).

5. **`backend/routes/migration_export.py`** (si existe localmente) es un helper temporal de migración; está en `.gitignore` y NO debe publicarse.

## Contexto técnico

- Stack: FastAPI (Python 3.11) + MongoDB Atlas (base `backyard_ultra`) + React (CRA/craco).
- Backend en Render: `bysd-backend` (Starter). Frontend: `bysd-frontend` (static).
- El frontend llama al backend vía `REACT_APP_BACKEND_URL` (se hornea en build; si cambia, requiere rebuild del frontend en Render).
- **Los archivos que sube un usuario NUNCA se guardan en disco.** El sistema de archivos del contenedor en Render es efímero: se borra completo en cada despliegue y en cada reinicio. Todo (fotos de perfil y de participantes, comprobantes de pago, logos, manuales) va a **GridFS** vía `backend/services/file_storage.py`, y se sirve por las rutas de `backend/routes/files.py`, que caen al disco solo como respaldo para los archivos que llegan commiteados con el build. Si agregas un endpoint de subida, usa `file_storage.save()`; no uses `open(..., "wb")`.
- `CORS_ORIGINS` del backend debe listar los orígenes separados por coma **sin espacios**.
- **Autenticación:** el secreto JWT vive en un solo sitio, `backend/services/auth.py`, y sale de `JWT_SECRET_KEY` (obligatoria: sin ella el backend no arranca). No escribas `os.getenv("JWT_SECRET_KEY", "algo")` con valor por defecto ni decodifiques tokens a mano en un router.
- **Endpoint nuevo del panel = endpoint protegido.** Usa `Depends(require_permission("<permiso>"))` de `services.auth` (permisos: `control`, `athletes`, `finances`, `volunteers`, `sponsors`, `surveys`, `config`, `scanner`, `users`, `emails`). Desde el frontend, llámalo con `adminFetch` de `src/lib/adminApi.js`, que adjunta el token.
- **App móvil: compila siempre con `yarn build:mobile`**, nunca con `yarn build` + `npx cap copy`. La URL del backend se hornea en el build, y `yarn build` usa la de `frontend/.env` (`http://localhost:8001`): en el teléfono eso deja la app sin backend y sin ningún error visible más que pantallas vacías.
- **App móvil: el proyecto de iOS usa el ciclo de vida por escenas (UIScene).** Desde el SDK de iOS 27 (Xcode 27) el sistema cierra nada más abrirla cualquier app que no lo traiga, sin mensaje de error: así se cayó la 1.3.7. Las tres piezas van juntas y ninguna sobra: la clave `UIApplicationSceneManifest` del `Info.plist`, `ios/App/App/SceneDelegate.swift` (donde se crea la ventana con el `CAPBridgeViewController`) y el `configurationForConnecting` del `AppDelegate`. Con escenas UIKit **ya no llama** a `applicationDidBecomeActive` ni a los `application(_:open:)` del `AppDelegate`: eso vive en el `SceneDelegate`. El soporte lo trae Capacitor 8.5; en Capacitor 7 no existe.
- **Notificaciones push (app BYSD Live):** van por Firebase Cloud Messaging desde `backend/services/push_service.py`, con la cuenta de servicio en `FCM_SERVICE_ACCOUNT_JSON` (variable de entorno; si falta, el push queda inactivo pero el backend arranca igual). Los avisos automáticos salen del escaneo y no deben bloquearlo: se disparan con `asyncio.create_task`. Ver `frontend/NOTIFICACIONES_PUSH.md`.
- El escaneo de vueltas (`/api/qr-scan/athlete`, `/confirm`) se autoriza con la **clave de escaneo** de la carrera (cabecera `X-Scan-Key`) o con token del panel. La clave está en `race_configurations.scan_key` y **no debe salir** en ninguna respuesta pública. La clave es por carrera: `/confirm` comprueba que sea la de la carrera sobre la que se escribe.
- **Dorsales para la imprenta:** las medidas y las reglas de impresión viven en `backend/services/dorsales.py` y son las de la plantilla de Boulder Bibs: corte de 8 × 5,25", sangrado de 0,25" por lado, esquinas de 0,375" y ojales a 0,6" de cada esquina. Tres cosas que no se pueden saltar: **todo en CMYK** (el RGB no imprime, y por eso no hay un color que no pase por `_cmyk()` ni una imagen que no se convierta antes de incrustarse), el fondo llega hasta el sangrado, y el QR se dibuja **en vectores**, no como imagen. El QR es el mismo del escaneo de vueltas y su dirección tiene una sola definición, `routes/qr_scan.url_de_escaneo`. La plantilla es la del dorsal de 2026: banda arriba con el logo y el nombre de la carrera, franja clara en medio con el nombre del corredor sobre un número grande, y banda abajo con el logo del patrocinador. Nada impreso —texto o logo— entra en la franja de los ojales (0,79" de cada borde): por ahí pasa el imperdible. Los logos se aplanan **en CMYK** contra el color de la banda, porque reportlab manda a DeviceRGB cualquier PNG con transparencia. El nombre impreso no es el nombre completo: es `personalizacion_camiseta` (inscripción primero, perfil después) y va tal como lo escribió el atleta, sin pasarlo a mayúsculas. La banda de abajo lleva el «PRESENTED BY» con la marca que presenta la edición, que **no se sube**: sale de `backend/services/marca.py`, el mismo sitio del que la toman el sitio, la app y los correos, con una copia del logo en `backend/static/marca/` porque en Render el backend no tiene el `public/` del frontend. El rótulo acompaña solo a esa marca; un logo subido a mano manda sobre ella y va sin rótulo, porque puede ser cualquier patrocinador. Lo mismo en el reverso del carnet del staff. La pantalla es `frontend/src/components/DorsalesManagement.jsx`, sirve para cualquier carrera y guarda su diseño, con las tres imágenes y la tipografía, en `dorsal_disenos`.

- **Preguntas de las charlas:** en la sala se reparte un QR (`/actividad/{id}/preguntas`) y quien lo escanea deja su pregunta sin cuenta ni correo; al terminar se proyecta `/admin/preguntas/{id}`, que las pasa una a una. Todo vive en `backend/routes/capacitaciones.py` (colección `capacitacion_preguntas`) y en la pestaña **Atletas → Preguntas**. Dos reglas: **marcar «no publicar mi nombre» no guarda el nombre**, no es solo que no se enseñe (`limpiar_pregunta`); y **las preguntas no salen en ninguna página pública**, ni siquiera la de presentar, porque lo que llega no está moderado y moderar es poder borrar antes de enseñarlo. La dirección del QR tiene una sola definición, `capacitaciones.url_de_preguntas`.

- **App de Garmin (Connect IQ):** vive en `garmin/`, aparte del sitio, y son **dos productos** con id propio en la tienda: la app de reloj (`garmin/app/`) y el campo de datos (`garmin/datafield/`), que comparten `garmin/shared/`. No se despliega con Render: se compila con el SDK de Connect IQ en el Mac y se sube a mano a la Connect IQ Store, con revisión de Garmin de por medio. La lista de relojes compatibles se escribe a mano en los dos `manifest.xml` y **envejece sola**; un id mal escrito no rompe la compilación, solo suelta un `WARNING` y deja al reloj fuera en silencio. Lo pendiente está en [`garmin.md`](garmin.md) (hoy, subir a la tienda la 1.3.0 de los dos productos, la que trae los fēnix MIP), y cómo se compila, en [`garmin/README.md`](garmin/README.md).

## Varias carreras a la vez

Desde agosto de 2026 conviven varias carreras (el Campeonato Mundial de octubre y la carrera abierta de enero). Tres reglas que no se pueden saltar:

- **`is_active` significa una sola cosa: la carrera que muestra el sitio público.** No es "la carrera sobre la que se trabaja". El panel manda su `race_code` en cada llamada (lo elige en el selector de la sección En Vivo, `contexts/AdminRaceContext.jsx`) y el escáner manda el que viaja dentro del QR. Un endpoint de administración que caiga en silencio sobre la carrera activa es un fallo: usa `Depends(races.carrera_del_panel)`, que lo exige. Para endpoints públicos y de la app, `races.resolver_carrera` acepta el que venga y si no cae en la pública.
- **Las vueltas se anotan solo por `services/laps.py`**, que escribe en `lap_registrations` con `race_code`, origen (`qr` o `panel`) y autor. `registrations.laps_completed` y `total_km` no se tocan a mano: los recalcula `laps.recalcular()` desde ese libro. Corregir es **anular** (`laps.anular`), nunca borrar.
- **La vuelta en curso la da el reloj**, en `services/races.py`: `vuelta_actual(carrera)` cuenta desde `started_at`, la hora real que se sella con "Iniciar carrera", y se detiene en `finished_at` al cerrar la carrera. No hay contadores manuales; la colección `race_config` quedó retirada.

- **Un patrocinador es una marca, no una marca por carrera.** `sponsors` guarda una ficha por empresa (contactos, logo, descripción: lo que no cambia de un año a otro) con una lista de `participaciones`, una por carrera que patrocina. Lo que se negocia por evento —status del pipeline, categoría, monto, dónde se ve, el anuncio de esa campaña, las métricas y la bitácora— vive en la participación, nunca en la ficha. Las reglas están en `backend/services/patrocinios.py`, y `vista_vitrina`/`vista_anuncio` aplanan las dos mitades para que `/api/sponsors/race/{code}` y `/api/ads/*` sigan devolviendo la forma que leen las apps instaladas: no se les cambia ni un campo.

Dar la salida (`POST /api/race/start`) también pasa los inscritos de `registered` a `active`: es lo que los convierte en corredores en carrera.

Cerrar una carrera (`POST /api/race-config/close/{code}`) no mueve ni borra datos, solo congela. Cada dato lleva su `race_code` y se queda donde está.

Ver **WORKFLOW.md** para el detalle completo del flujo de desarrollo y despliegue.
