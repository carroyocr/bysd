# Backyard Ultra Santo Domingo 2026 - Product Requirements Document

## Información General
- **Proyecto**: Sistema de tracking en vivo para carrera Backyard Ultra
- **Evento**: Santo Domingo 2026
- **Fecha de Creación**: Enero 2026
- **Última Actualización**: 17 Enero 2026

## Descripción del Producto
Aplicación web full-stack para gestionar y mostrar en tiempo real el progreso de una carrera Backyard Ultra. Incluye:
- Sitio informativo del evento
- Panel de administración seguro
- Dashboard público con estadísticas en vivo
- Sistema de detección automática del ganador

## Stack Tecnológico
- **Frontend**: React, Tailwind CSS, Shadcn/UI
- **Backend**: FastAPI (Python)
- **Base de Datos**: MongoDB
- **Autenticación**: JWT con bcrypt
- **Dependencias adicionales**: react-pdf (visor de PDF)

---

## Funcionalidades Implementadas ✅

### 1. Sitio Informativo (Completado)
- Página de evento con información general
- Guía del corredor con visor PDF estilo flipbook
- Reglas de la carrera
- Información logística
- FAQ
- Página de patrocinadores (18 patrocinadores)

### 2. Sistema de Tracking en Vivo (Completado)
#### Panel de Administración (`/admin/login`, `/admin/race-control`)
- Login seguro con JWT (admin/Backyard2026!)
- Control de vuelta actual
- Botón para completar vuelta de todos los atletas activos
- Marcar atletas como DNF (Did Not Finish)
- Marcar atletas como DNS (Did Not Start)
- Filtros por estado (Activo, DNF, DNS)
- Reset de base de datos con confirmación ("REINICIO")

#### Dashboard Público (`/en-vivo`)
- **Estadísticas en tiempo real**:
  - Vuelta en Curso
  - Vueltas Completadas
  - Atletas Activos
  - Atletas DNF
  - Atletas DNS
  - Km del Evento
  - Km Totales (suma de todos los atletas)
- **Tabla de participantes filtrable**
- **Exportar a CSV**
- **Auto-refresh cada 30 segundos**
- **Sección de Ganador** (17 Enero 2026) ✅
  - Aparece solo cuando hay un ganador determinado
  - Muestra: BIB, Nombre, País, Vueltas, Kilómetros
  - Diseño destacado con animación pulse

### 3. Lógica del Ganador (Completado - 17 Enero 2026)
**Condiciones para declarar ganador:**
1. Solo 1 atleta activo restante
2. Al menos 1 atleta retirado (DNF)
3. El atleta activo tiene MÁS vueltas que todos los retirados

Esto significa que el último atleta debe completar una vuelta final solo después de que el penúltimo se retire.

---

## API Endpoints

### Públicos
| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/race/stats` | GET | Estadísticas de la carrera |
| `/api/race/participants` | GET | Lista de participantes |

### Protegidos (requieren JWT)
| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/race/auth/admin-login` | POST | Autenticación admin |
| `/api/race/complete-lap-all-active` | POST | Completar vuelta todos activos |
| `/api/race/mark-retired` | POST | Marcar DNF |
| `/api/race/mark-dns` | POST | Marcar DNS |
| `/api/race/set-current-lap` | POST | Establecer vuelta actual |
| `/api/race/reset-database` | POST | Reiniciar base de datos |
| `/api/race/reactivate` | POST | Reactivar atleta |

---

## Base de Datos (MongoDB)

### Colecciones
- **race_config**: `{ current_lap, race_status, winner }`
- **participants**: `{ bib, nombre, apellidos, nacionalidad, status, laps_completed, total_km, retired_at_lap }`
- **admin_users**: `{ username, password (hashed) }`
- **laps_log**: `{ participant_bib, lap_number, completed_at, recorded_by }`

### Datos Iniciales
- 90 participantes pre-cargados al iniciar
- 1 usuario admin (admin/Backyard2026!)

---

## Credenciales de Prueba
- **Admin Username**: `admin`
- **Admin Password**: `Backyard2026!`

---

## Archivos de Referencia Clave
- `backend/routes/race.py` - Toda la lógica de API
- `backend/models/race.py` - Modelos Pydantic
- `frontend/src/components/LiveDashboard.jsx` - Dashboard público
- `frontend/src/components/RaceControlPanel.jsx` - Panel admin

---

## Backlog / Tareas Futuras

### P1 - Mejoras Sugeridas
- [ ] Mover datos de patrocinadores a archivo JSON externo
- [ ] Extraer lista de participantes a archivo CSV/JSON separado
- [ ] Optimizar PDF del manual (actualmente 27MB)

### P2 - Mejoras Opcionales
- [ ] Historial detallado de vueltas (laps_log ya existe pero no tiene UI)
- [ ] Notificaciones push cuando hay cambios
- [ ] Modo oscuro para el dashboard

---

## Testing
- **Archivo de tests**: `/app/tests/test_race_winner.py`
- **Reporte**: `/app/test_reports/iteration_1.json`
- **Cobertura**: 13/13 tests backend, UI tests completos
