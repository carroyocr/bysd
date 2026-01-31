# Backyard Ultra Santo Domingo 2026 - Product Requirements Document

## Información General
- **Proyecto**: Sistema de tracking en vivo para carrera Backyard Ultra
- **Evento**: Santo Domingo 2026
- **Fecha de Creación**: Enero 2026
- **Última Actualización**: 26 Enero 2026

## Descripción del Producto
Aplicación web full-stack para gestionar y mostrar en tiempo real el progreso de una carrera Backyard Ultra. Incluye:
- Sitio informativo del evento
- Panel de administración seguro
- Dashboard público con estadísticas en vivo
- Sistema de detección automática del ganador
- Botones para compartir en redes sociales
- Sistema de notificaciones por email
- Sistema de mensajes de ánimo (cheer messages)

## Stack Tecnológico
- **Frontend**: React, Tailwind CSS, Shadcn/UI
- **Backend**: FastAPI (Python)
- **Base de Datos**: MongoDB
- **Autenticación**: JWT con bcrypt
- **Email**: smtplib (Gmail SMTP)
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
- Visor de horario de vuelta
- Botón Retroceder Vuelta
- Botón para completar vuelta de todos los atletas activos
- Marcar atletas como DNF (Did Not Finish) - **NO incrementa vueltas** (18 Enero 2026) ✅
- Marcar atletas como DNS (Did Not Start)
- **Contador de Seguidores por atleta** (18 Enero 2026) ✅
- Filtros por estado (Activo, DNF, DNS)
- Reset de base de datos con confirmación ("REINICIO")

#### Dashboard Público (`/en-vivo`)
- **Estadísticas en tiempo real**
- **Tabla de participantes filtrable**
- **Exportar a CSV**
- **Auto-refresh cada 30 segundos**
- **Sección de Ganador**
- **Botones de Compartir** (Twitter/X, WhatsApp, Copiar)
- **Sistema de Seguir Atletas** (corazón)
- **Notificaciones por Email** (suscripción)
- **Mensajes de Ánimo** (18 Enero 2026) ✅
  - Botón de enviar ánimo a cada atleta
  - Feed de mensajes de ánimo públicos
  - Contador de mensajes totales

### 3. Sistema de Notificaciones por Email (Completado)
- Suscripción con email
- Notificaciones cada vuelta o solo al finalizar (DNF/Ganador)
- Botón de dar de baja (unsubscribe)
- Template HTML responsive para emails

### 4. Lógica del Ganador (Completado)
**Condiciones para declarar ganador:**
1. Solo 1 atleta activo restante
2. Al menos 1 atleta retirado (DNF)
3. El atleta activo tiene MÁS vueltas que todos los retirados

### 5. Sistema de Gestión de Voluntarios (Completado 22 Ene 2026)
#### Página de Voluntarios (`/voluntarios`)
- **Manual de Voluntarios**: Enlace a PDF descargable
- **Pestañas**: Roles, Asignación, Reglas, Emergencias

#### Pestaña de Asignación
- **Filtros**: Por nombre/posición, posición, turno, estado
- **Estadísticas**: Total espacios, asignados, disponibles
- **Grid de turnos**: Muestra slots con información completa
- **Asignación por email**: Modal para confirmar correo registrado
- **Eliminación de asignación**: Solo el voluntario asignado puede eliminar

#### API Endpoints Voluntarios
| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/volunteers/slots` | GET | Obtener todos los slots con asignaciones |
| `/api/volunteers/positions` | GET | Posiciones únicas disponibles |
| `/api/volunteers/shifts` | GET | Turnos únicos disponibles |
| `/api/volunteers/assign/{slot_id}` | POST | Asignar voluntario a slot |
| `/api/volunteers/unassign/{slot_id}` | POST | Eliminar asignación de slot |
| `/api/volunteers/list` | GET | Lista de voluntarios registrados |
| `/api/volunteers/init-data` | POST | Inicializar datos desde código embebido |
| `/api/volunteers/send-test-reminder` | POST | Enviar email de prueba (recordatorio 1h antes) |
| `/api/volunteers/send-test-assignments` | POST | Enviar email de prueba (resumen de asignaciones) |
| `/api/volunteers/send-reminder/{slot_id}` | POST | Enviar recordatorio a voluntario de slot específico |
| `/api/volunteers/send-all-assignments` | POST | Enviar email masivo a todos los voluntarios |
| `/api/volunteers/scheduler/init` | POST | Inicializar scheduler de emails |
| `/api/volunteers/scheduler/jobs` | GET | Ver jobs programados |

#### Colecciones MongoDB (Voluntarios)
- **volunteers**: `{ email, nombre, apellidos, sexo, lugar_residencia, telefono, created_at }`
- **volunteer_assignments**: `{ id, puesto, turno, dia, hora_inicio, hora_fin, slot, email_asignado, created_at, updated_at }`

### 6. Sistema de Encuestas de Satisfacción (Completado 26 Ene 2026)
#### Página de Encuestas (`/encuesta`)
- **Tres formularios**: Atletas, Voluntarios, Espectadores
- **Campos comunes**: Nombre, Email, Ratings (1-5), Texto libre
- **Validación**: Campos requeridos, rango de ratings
- **Confirmación visual**: Mensaje de éxito tras envío

#### Panel Admin - Resultados de Encuestas
- **Estadísticas rápidas**: Total, por categoría
- **Tabs**: Atletas, Voluntarios, Espectadores
- **Cards expandibles**: Ver detalle de cada respuesta
- **Exportar CSV**: Por categoría

#### API Endpoints Encuestas
| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/surveys/athletes` | POST | Enviar encuesta de atleta |
| `/api/surveys/volunteers` | POST | Enviar encuesta de voluntario |
| `/api/surveys/spectators` | POST | Enviar encuesta de espectador |
| `/api/surveys/stats` | GET | Estadísticas de encuestas |
| `/api/surveys/athletes/responses` | GET | Respuestas de atletas |
| `/api/surveys/volunteers/responses` | GET | Respuestas de voluntarios |
| `/api/surveys/spectators/responses` | GET | Respuestas de espectadores |

#### Colecciones MongoDB (Encuestas)
- **surveys_athletes**: `{ nombre, email, bib, ratings..., lo_mejor, areas_mejora, created_at }`
- **surveys_volunteers**: `{ nombre, email, area_voluntariado, ratings..., lo_mejor, areas_mejora, created_at }`
- **surveys_spectators**: `{ nombre, email, relacion_evento, ratings..., lo_mejor, areas_mejora, created_at }`

---

## API Endpoints

### Públicos
| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/race/stats` | GET | Estadísticas de la carrera |
| `/api/race/participants` | GET | Lista de participantes |
| `/api/race/cheers` | GET | Feed de mensajes de ánimo |
| `/api/race/cheers/count` | GET | Total de mensajes de ánimo |
| `/api/race/cheer` | POST | Enviar mensaje de ánimo |
| `/api/race/subscribe` | POST | Suscribirse a notificaciones |
| `/api/race/unsubscribe/{id}` | GET | Cancelar suscripción |

### Protegidos (requieren JWT)
| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/race/auth/admin-login` | POST | Autenticación admin |
| `/api/race/complete-lap-all-active` | POST | Completar vuelta todos activos |
| `/api/race/mark-retired` | POST | Marcar DNF (NO incrementa vueltas) |
| `/api/race/mark-dns` | POST | Marcar DNS |
| `/api/race/revert-lap` | POST | Retroceder a vuelta anterior |
| `/api/race/reset-database` | POST | Reiniciar base de datos |
| `/api/race/reactivate` | POST | Reactivar atleta |
| `/api/race/followers-count` | GET | Conteo de seguidores por atleta |

---

## Base de Datos (MongoDB)

### Colecciones
- **race_config**: `{ current_lap, race_status }`
- **participants**: `{ bib, nombre, apellidos, nacionalidad, status, laps_completed, total_km, retired_at_lap }`
- **admin_users**: `{ username, password (hashed) }`
- **laps_log**: `{ participant_bib, lap_number, completed_at, recorded_by }`
- **email_subscriptions**: `{ email, athletes_bibs[], notify_every_lap, notify_on_finish, active }`
- **cheer_messages**: `{ athlete_bib, fan_name, message, approved, created_at }`

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
- `backend/services/email_service.py` - Servicio de emails
- `frontend/src/components/LiveDashboard.jsx` - Dashboard público
- `frontend/src/components/RaceControlPanel.jsx` - Panel admin
- `frontend/src/contexts/RaceConfigContext.jsx` - Contexto global de configuración de carrera

---

## Backlog / Tareas Pendientes

### 🟢 Completado Recientemente
- [x] **Compatibilidad Dual para Datos Legacy** (31 Enero 2026)
  - BYSD-2026 usa colección `participants` (legacy)
  - BYSD-2027+ usa colección `registrations` (nuevo)
  - Lista `LEGACY_RACE_CODES` en backend para carreras históricas
  - Endpoint `/api/race-config/all` incluye carreras legacy automáticamente
  - Frontend `LiveDashboard` pasa `race_code` en llamadas API
- [x] **Botones de Admin Filtrados por Carrera** (31 Enero 2026)
  - `reset-database`: Solo reinicia tracking de vueltas de la carrera activa (no borra datos históricos)
  - `reset-cheers`: Solo borra mensajes de ánimo de la carrera activa
  - `reset-subscriptions`: Solo borra suscripciones de la carrera activa
  - `send-runner-emails`: Usa participantes de registrations de la carrera activa
  - Nuevas suscripciones y mensajes de ánimo ahora incluyen `race_code`
  - Eliminado código muerto (lista de 90 participantes hardcodeados)
  - Eliminada sección de encuestas del Panel de Control (solo en pestaña dedicada)
- [x] **Panel de Control usa Pre-Registros Activos** (31 Enero 2026)
  - Endpoints `/api/race/stats` y `/api/race/participants` ahora priorizan colección `registrations`
  - Filtrado por `race_code` de la carrera activa
  - Solo muestra participantes con status "active" y BIB asignado
  - Fallback a colección `participants` para carreras sin registrations
  - Campos de tracking (`laps_completed`, `total_km`) inicializados al activar participante
- [x] **Gestión de Pre-Registros en Admin** (31 Enero 2026)
  - Nueva pestaña "Pre-Registros" en panel de administración
  - Ver/editar información completa de participantes pre-registrados
  - Asignar números de BIB a participantes
  - Cambiar estado y estado de pago
  - Estadísticas: Total, Masculino, Femenino, Pagados, Próximo BIB
  - Distribución de tallas de camiseta
  - Búsqueda, filtros y exportar CSV
- [x] **Refactor Paramétrico** - Sistema de configuración de carreras desde admin panel
  - Backend: `/api/race-config/` endpoints (crear, leer, actualizar, activar)
  - Frontend: `RaceConfigContext` para valores dinámicos globales
  - Componentes actualizados: Navigation, Hero, Footer, LiveDashboard, etc.

### 🔴 P1 - Próximas Tareas
- [ ] Notificación UI cuando un fan sube de nivel de badge
- [ ] Filtros mejorados en página Comunidad (por atleta o fan)
- [ ] Limpieza de código: Remover integración abandonada de Twitter/X
  - Eliminar `tweepy` de requirements.txt
  - Eliminar `backend/services/twitter_service.py`
  - Remover variables de entorno relacionadas

### 🟠 P2 - Mejoras Sugeridas
- [ ] Mover datos de patrocinadores a archivo JSON externo
- [ ] Extraer lista de participantes a archivo CSV/JSON separado
- [ ] Optimizar PDF del manual (actualmente 27MB)
- [ ] Refactorizar VolunteersSection.jsx (700+ líneas) en componentes más pequeños

### 🟡 P3 - Mejoras Opcionales
- [ ] Historial detallado de vueltas (laps_log ya existe pero no tiene UI)
- [ ] Notificaciones push cuando hay cambios
- [ ] Modo oscuro para el dashboard
- [ ] Agregar Facebook como opción de compartir

### ❌ Descartado
- Twitter/X Integration - Requiere plan pagado ($100/mes)

---

## Testing
- **Archivos de tests**: 
  - `/app/tests/test_race_winner.py`
  - `/app/tests/test_new_features.py`
  - `/app/backend/tests/test_surveys.py`
  - `/app/backend/tests/test_race_config.py`
  - `/app/backend/tests/test_pre_registration_admin.py` (nuevo)
- **Reportes**: 
  - `/app/test_reports/iteration_1.json`
  - `/app/test_reports/iteration_2.json`
  - `/app/test_reports/iteration_3.json`
  - `/app/test_reports/iteration_4.json`
  - `/app/test_reports/iteration_5.json` (nuevo - gestión pre-registros)
- **Cobertura**: 85/85 tests backend (100%), UI tests completos (100%)

---

## Changelog

### 18 Enero 2026
- ✅ Modificada lógica de DNF: Marcar como DNF ya NO incrementa vueltas
- ✅ Corregida función `revert_lap`: Al revertir, atletas DNF se reactivan con sus vueltas originales
- ✅ Nuevo endpoint: `/api/race/followers-count` (admin only)
- ✅ Nueva funcionalidad: Sistema de mensajes de ánimo (cheer messages)
  - POST `/api/race/cheer` - Enviar mensaje
  - GET `/api/race/cheers` - Feed de mensajes
  - GET `/api/race/cheers/count` - Total de mensajes
  - GET `/api/race/cheers/leaderboard` - Top atletas más apoyados
- ✅ Panel admin: Nueva columna "Seguidores" con contador
- ✅ **Sistema de Insignias para Fans**:
  - GET `/api/race/fans/leaderboard` - Top fans con badges
  - GET `/api/race/fans/badge/{fan_name}` - Badge y progreso de un fan
  - Niveles: 🌱 Novato (1+), 📣 Animador (3+), ⭐ Súper Fan (5+), 🏆 Leyenda (10+)
- ✅ **Nueva página `/comunidad`** con:
  - Header con estadísticas (mensajes, fans, atletas apoyados)
  - Feed de mensajes de ánimo
  - Top Atletas Apoyados (sidebar)
  - Top Fans con badges (sidebar)
  - Botón flotante para enviar mensaje
  - Buscador de atletas al enviar mensaje
- ✅ Dashboard `/en-vivo` actualizado:
  - Nueva columna "Ánimos" mostrando contador de mensajes por atleta
  - Link a página de Comunidad
  - Removidos modales de ánimo (movidos a /comunidad)
- ✅ Navegación actualizada: "Comunidad" entre "En Vivo" y "Admin"
- ❌ Twitter/X descartado: Requiere plan pagado ($100/mes)

### 31 Enero 2026
- ✅ **Panel de Control usa Pre-Registros Activos (P0)**:
  - Endpoints `/api/race/stats` y `/api/race/participants` modificados para usar `registrations`
  - Aceptan parámetro `race_code` para filtrar por carrera
  - Solo muestra participantes con status "active", "retired", "dns", "winner", "honor" y BIB asignado
  - Fallback automático a colección `participants` para compatibilidad
  - Endpoint `complete-lap-all-active` actualizado para trabajar con `registrations`
  - Al cambiar status a "active" se inicializan campos: `laps_completed=0`, `total_km=0.0`
  - **Tests**: 20 tests de backend (100% coverage)

- ✅ **Gestión de Pre-Registros en Panel Admin (P0)**:
  - **Nueva pestaña "Pre-Registros" en `/admin`**:
    - Ver lista de todos los pre-registrados para la carrera activa
    - Estadísticas: Total, Masculino, Femenino, Pagados, Próximo BIB disponible
    - Distribución de tallas de camiseta
    - Tabla con BIB, Nombre, Email, Talla, Estado, Pago, Acciones
    - Expandir fila para ver detalles completos del participante
    - Editar información: nombre, talla, estado, pago, asignar BIB
    - Búsqueda por nombre, email o BIB
    - Filtro por estado (pre_registered, registered, confirmed, active)
    - Exportar a CSV
  - **Backend - Nuevos endpoints admin (`backend/routes/registration.py`)**:
    - `GET /api/registration/admin/registration/{email}` - Obtener registro individual
    - `PUT /api/registration/admin/registration/{email}` - Actualizar registro (incluye asignar BIB)
    - `DELETE /api/registration/admin/registration/{email}` - Eliminar registro
    - `GET /api/registration/admin/next-bib/{race_code}` - Obtener próximo BIB disponible
  - **Frontend - Nuevo componente**:
    - `PreRegistrationManagement.jsx` - Gestión completa de pre-registros
  - **Panel de Admin actualizado**: Ahora tiene 4 pestañas (Panel de Control, Pre-Registros, Encuestas, Carrera Activa)
  - **Tests**: 21 tests de backend (100% coverage)
  
- ✅ **Refactor Paramétrico de la Aplicación (P0)**:
  - **Backend - Configuración de Carrera (`backend/routes/race_config.py`)**:
    - `GET /api/race-config/active` - Obtener carrera activa
    - `GET /api/race-config/all` - Listar todas las carreras
    - `GET /api/race-config/{code}` - Obtener carrera por código
    - `POST /api/race-config/create` - Crear nueva carrera (con JWT auth)
    - `PUT /api/race-config/update/{code}` - Actualizar carrera (con JWT auth)
    - `POST /api/race-config/activate/{code}` - Activar carrera (con JWT auth)
    - `POST /api/race-config/upload-logo/{code}` - Subir logo (con JWT auth)
    - `POST /api/race-config/archive-data/{code}` - Archivar datos de carrera
  - **Frontend - Contexto Global (`frontend/src/contexts/RaceConfigContext.jsx`)**:
    - Hook `useRaceConfig()` para acceder a configuración
    - Funciones helper: `getYear()`, `getShortDate()`, `getRaceStartDate()`
  - **Componentes Actualizados para usar valores dinámicos**:
    - Navigation.jsx, Hero.jsx, Footer.jsx
    - LiveDashboard.jsx, RaceControlPanel.jsx
    - EventInfo.jsx, SponsorsSection.jsx
    - ComunidadPage.jsx, EnviarAnimoPage.jsx, ParticipantsList.jsx, AdminLogin.jsx
  - **Panel de Admin Reorganizado (`/admin`)**:
    - 3 pestañas: Panel de Control, Encuestas, Carrera Activa
    - Nueva página AdminPage.jsx con navegación por tabs
    - RaceConfigPanel.jsx para gestionar configuración de carrera
  - **Nueva colección MongoDB**: `race_configurations`
  - **Tests**: 21 tests de backend + tests de UI (100% coverage)

### 26 Enero 2026
- ✅ **Sistema de Encuestas de Satisfacción (P0)**:
  - Nueva página `/encuesta` con 3 formularios (Atletas, Voluntarios, Espectadores)
  - Backend endpoints: POST `/api/surveys/athletes`, `/volunteers`, `/spectators`
  - Admin endpoints: GET `/api/surveys/stats`, `/api/surveys/{type}/responses`
  - Nueva sección "Resultados de Encuestas" en panel admin con:
    - Estadísticas por tipo (total, por categoría)
    - Tabs para ver respuestas de cada tipo
    - Cards expandibles con detalles de cada respuesta
    - Exportar a CSV por categoría
  - Colecciones MongoDB: `surveys_athletes`, `surveys_volunteers`, `surveys_spectators`
- ✅ **Cambios de UI para Fin de Carrera**:
  - Oculto countdown en página `/seguimiento`
  - Movido link "Admin" de navegación principal al footer
  - Agregado link "Volver al Home" en página `/admin/login`
  - Agregado link "Encuesta" en navegación y footer

### 22 Enero 2026
- ✅ **Sistema de Voluntarios - Datos Embebidos (P0)**:
  - Datos de 90 asignaciones de turnos incrustados en `backend/routes/volunteers.py`
  - Datos de 54 voluntarios registrados incrustados en el código
  - Eliminada dependencia de archivos Excel externos
  - Endpoint `POST /api/volunteers/init-data` ahora usa datos hardcodeados
- ✅ **Fix P1 - Manejo de errores en asignación de voluntarios**:
  - Backend retorna mensajes de error en header `X-Error-Detail`
  - Frontend lee errores del header personalizado para evitar problemas con interceptores externos
  - CORS configurado para exponer header `X-Error-Detail`
  - Mensajes de error específicos ahora se muestran correctamente al usuario
- ✅ **Sistema de Notificaciones por Email para Voluntarios**:
  - **Email de Recordatorio (1 hora antes)**: Notifica al voluntario con detalles del turno
  - **Email Masivo (Viernes 23 a las 6pm)**: Envía resumen de todas las asignaciones
  - Templates HTML profesionales con logo de la carrera
  - Scheduler automático con APScheduler (63 jobs programados)
  - Endpoints para pruebas manuales y control del scheduler
  - Nuevos archivos: `volunteer_email_service.py`, `volunteer_scheduler.py`

### 17 Enero 2026
- Sistema de notificaciones por email implementado
- Sistema de seguir atletas (localStorage)
- Responsive design para móviles
- CSV export con UTF-8 BOM
