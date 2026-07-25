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

Ver **WORKFLOW.md** para el detalle completo del flujo de desarrollo y despliegue.
