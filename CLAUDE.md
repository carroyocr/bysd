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
- **Notificaciones push (app BYSD Live):** van por Firebase Cloud Messaging desde `backend/services/push_service.py`, con la cuenta de servicio en `FCM_SERVICE_ACCOUNT_JSON` (variable de entorno; si falta, el push queda inactivo pero el backend arranca igual). Los avisos automáticos salen del escaneo y no deben bloquearlo: se disparan con `asyncio.create_task`. Ver `frontend/NOTIFICACIONES_PUSH.md`.
- El escaneo de vueltas (`/api/qr-scan/athlete`, `/confirm`) se autoriza con la **clave de escaneo** de la carrera (cabecera `X-Scan-Key`) o con token del panel. La clave está en `race_configurations.scan_key` y **no debe salir** en ninguna respuesta pública.

Ver **WORKFLOW.md** para el detalle completo del flujo de desarrollo y despliegue.
