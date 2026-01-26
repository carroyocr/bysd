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

---

## Backlog / Tareas Pendientes

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

### 🟡 P2 - Mejoras Opcionales
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
- **Reportes**: 
  - `/app/test_reports/iteration_1.json`
  - `/app/test_reports/iteration_2.json`
  - `/app/test_reports/iteration_3.json`
- **Cobertura**: 43/43 tests backend (100%), UI tests completos (100%)

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
