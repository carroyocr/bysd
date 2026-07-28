# Flujo de trabajo — Backyard Ultra Santo Domingo

Guía para hacer cambios al sitio de forma segura.

## Arquitectura (dónde vive cada cosa)

| Pieza | Dónde |
|---|---|
| Código | GitHub: `carroyocr/bysd` (rama `main` = producción) |
| Backend (FastAPI/Python) | Render — servicio `bysd-backend` (plan Starter) |
| Frontend (React) | Render — servicio `bysd-frontend` (static site) |
| Base de datos | MongoDB Atlas propio — base `backyard_ultra` |
| Dominio | `backyardultrasantodomingo.com` (registrado en GoDaddy, apunta a Render) |
| Secretos / `.env` / dumps | Local: `~/Proyectos/bysd-secretos/` (NO están en git) |

**Auto-Deploy activo:** cada `git push origin main` dispara un despliegue automático en Render (~1-3 min).

---

## Ciclo para una mejora

### 1. Empezar (partir de lo último y crear rama de trabajo)
```bash
cd ~/Proyectos/bysd
git checkout main && git pull
git checkout -b mejora-X          # nombre descriptivo
```

### 2. Probar localmente
```bash
# Terminal 1 — backend
cd ~/Proyectos/bysd/backend && .venv/bin/uvicorn server:app --port 8001

# Terminal 2 — frontend
cd ~/Proyectos/bysd/frontend && yarn start
```
Abrir `http://localhost:3000`. Producción no se toca mientras tanto.

### 3. Guardar el avance
```bash
git add <archivos>
git commit -m "descripción del cambio"
```

### 4. Publicar a producción (cuando ya funciona)
```bash
git checkout main
git merge mejora-X
git push origin main              # ← dispara el deploy automático en Render
git branch -d mejora-X
```
Mirar el dashboard de Render hasta que el servicio diga "Live".

### Si algo sale mal
Render → servicio → **Deploys** → **Rollback** en el deploy anterior. Vuelve a la versión buena al instante.

---

## Reglas de oro

- **Nunca editar directo en `main`** sin probar en una rama primero (`main` = sitio en vivo).
- **Secretos y URLs → dashboard de Render** (Environment), NO al repo. Los `.env` no van a git.
- **Variable `REACT_APP_*` nueva → agregarla en Render** (frontend), porque se hornea en el build.
- **Antes de tocar datos → respaldo**: `mongodump` del Atlas primero.

---

## Cómo correr el entorno local desde cero (si es una máquina nueva)

```bash
# Backend
cd ~/Proyectos/bysd/backend
python3.11 -m venv .venv
.venv/bin/pip install -r requirements.txt
# crear backend/.env (copiar de ~/Proyectos/bysd-secretos/backend.env.txt y ajustar MONGO_URL)

# Frontend
cd ~/Proyectos/bysd/frontend
yarn install
# crear frontend/.env con REACT_APP_BACKEND_URL=http://localhost:8001

# MongoDB local (opcional, para no tocar Atlas)
brew services start mongodb-community@7.0
```

---

## Variables de entorno en Render

**Backend** (`bysd-backend`):
`MONGO_URL`, `DB_NAME=backyard_ultra`, `JWT_SECRET_KEY`, `CORS_ORIGINS`, `FRONTEND_URL`,
`GMAIL_USER`, `GMAIL_APP_PASSWORD`, `TWITTER_*`

- **`JWT_SECRET_KEY` es obligatoria.** Firma los tokens del panel y de los atletas.
  Si falta, el backend **no arranca** (a propósito: antes había un valor por
  defecto escrito en el código y cualquiera podía emitirse un token de admin).
  Generar una con:
  ```bash
  python3 -c "import secrets; print(secrets.token_urlsafe(48))"
  ```
  Cambiarla cierra todas las sesiones abiertas: hacerlo fuera del día de carrera.
- `ADMIN_INITIAL_PASSWORD` (opcional): solo se usa para crear el usuario `admin`
  en una base vacía. Si no está, se genera una al azar y se escribe en el log de
  arranque.
- `CORS_ORIGINS` debe ser: los orígenes permitidos **separados por coma, sin espacios**:
  `https://backyardultrasantodomingo.com,https://www.backyardultrasantodomingo.com,https://bysd-frontend.onrender.com`

**Frontend** (`bysd-frontend`):
`REACT_APP_BACKEND_URL=https://bysd-backend.onrender.com`

---

## Pendientes conocidos

- **Uploads en runtime son efímeros:** las fotos/recibos que suban los usuarios después se pierden al redeploy de Render (no hay disco persistente). Si el evento recibirá subidas nuevas, agregar un Render Disk o mover almacenamiento a un servicio externo (S3).
- **Costo mensual:** Render Starter (~$7) + Atlas (free) ≈ $7/mes.
