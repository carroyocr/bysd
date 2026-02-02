# Backyard Ultra Santo Domingo - Product Requirements Document

## Información General
- **Proyecto**: Sistema de tracking en vivo para carrera Backyard Ultra
- **Evento**: Santo Domingo 2026/2027
- **Fecha de Creación**: Enero 2026
- **Última Actualización**: 02 Febrero 2026

## Descripción del Producto
Aplicación web full-stack para gestionar y mostrar en tiempo real el progreso de una carrera Backyard Ultra. Incluye:
- Sitio informativo del evento
- Panel de administración seguro con control de permisos
- Dashboard público con estadísticas en vivo
- Sistema de detección automática del ganador
- Botones para compartir en redes sociales
- Sistema de notificaciones por email
- Sistema de mensajes de ánimo (cheer messages)
- Sistema de códigos QR para control de vueltas
- Archivado automático de datos de carreras anteriores

## Stack Tecnológico
- **Frontend**: React, Tailwind CSS, Shadcn/UI
- **Backend**: FastAPI (Python)
- **Base de Datos**: MongoDB
- **Autenticación**: JWT con bcrypt
- **Email**: smtplib (Gmail SMTP)
- **QR Codes**: qrcode (Python)
- **Dependencias adicionales**: react-pdf (visor de PDF)

## Sistema de Carreras Múltiples
El sistema soporta múltiples carreras con aislamiento de datos:
- **Carrera Activa**: Los endpoints por defecto operan sobre la carrera activa
- **Carreras Archivadas**: Los datos de carreras anteriores se preservan en colecciones separadas
- **Colecciones de Archivo**: `archived_participants`, `archived_cheer_messages`, `archived_sponsors`
- **API de Datos Archivados**: `/api/race-config/archived/{code}/participants`, `/api/race-config/archived/{code}/cheers`

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

- [x] **Deep Review: Control de Carrera y Sistema QR** (02 Febrero 2026)
  - **Verificación completa del flujo:**
    - Estadísticas de carrera y participantes
    - Control de vueltas (avanzar, retroceder, completar)
    - Sistema de escaneo QR (generar, escanear, confirmar)
    - Estados de atleta (active, retired, dns, winner, honor)
    - Auto-DNF basado en tiempo
  - **Bugs corregidos:**
    - ✅ `/reactivate` - Ahora usa `registrations` para carreras nuevas
    - ✅ `/mark-dns` - Ahora usa `registrations` para carreras nuevas
    - ✅ `/adjust-laps` - Ahora usa `registrations` para carreras nuevas
    - ✅ `/edit-participant` - Ahora usa `registrations` para carreras nuevas
    - ✅ `/mark-honor` - Ahora usa `registrations` para carreras nuevas
  - **Tests verificados:**
    - ✅ Obtener estadísticas y participantes
    - ✅ Establecer/completar vueltas
    - ✅ Escanear atleta por BIB
    - ✅ Generar y confirmar via QR
    - ✅ Marcar DNF, DNS, ganador, honor
    - ✅ Reactivar y ajustar vueltas (en registrations)
  - **Documentación creada:** `/app/memory/FLUJO_CONTROL_CARRERA.md`

- [x] **Deep Review: Flujo de Registro de Voluntarios** (02 Febrero 2026)
  - **Verificación completa del flujo:**
    - Registro nuevo: verificación email → código → sesión → registro
    - Asignación de slots: validaciones y cambio de status a "confirmed"
    - Desasignación: validaciones y reversión de status a "registered"
    - Edición: solicitud de link → obtención por token → actualización
    - Cancelación: eliminación de asignaciones y registro
  - **Tests verificados:**
    - ✅ Envío de código de verificación
    - ✅ Verificación de email existente/no existente
    - ✅ Asignación/desasignación de voluntarios
    - ✅ Cambios de status correctos
    - ✅ Validaciones de errores (slot ocupado, email incorrecto, etc.)
  - **Documentación creada:** `/app/memory/FLUJO_REGISTRO_VOLUNTARIOS.md`
  - **Bug resuelto:** El `AttributeError: 'str' object has no attribute 'get'` mencionado en el handoff ya no está presente (posiblemente corregido en actualización anterior)


- [x] **Feature: Sistema de QR Code para Control de Vueltas** (02 Febrero 2026)
  - **Backend - Nuevo módulo `qr_scan.py`:**
    - `GET /api/qr-scan/race-status` - Estado actual de la carrera (vuelta actual, tiempo restante)
    - `GET /api/qr-scan/athlete/{bib}` - Información del atleta para confirmación
    - `POST /api/qr-scan/confirm-lap` - Confirma vuelta o marca DNF
    - `POST /api/qr-scan/generate-qr/{bib}` - Genera QR para atleta
    - `GET /api/qr-scan/image/{filename}` - Sirve imágenes QR
  - **Lógica de Auto-DNF:** Si el tiempo de la vuelta actual se agota mientras el atleta no ha completado la vuelta anterior, se marca como DNF automáticamente
  - **Generación automática de QR:** Al asignar BIB (individual o en lote), se genera el QR automáticamente
  - **Frontend:**
    - Nueva página `/scan` - Escáner QR con cámara y entrada manual de BIB
    - Nueva página `/scan/confirmar` - Confirmación de vuelta con información del atleta
    - Botón "Escáner QR" en el Panel de Control de Carrera
    - Ícono QR junto al BIB en la gestión de atletas (enlace a la imagen)
  - **Tests:** 14/14 backend tests passed (100%)

- [x] **Feature: Cancelación de Registro para Atletas y Voluntarios** (02 Febrero 2026)
  - **Nueva página `/cancelar-registro`** para cancelación vía link de email
    - Detecta automáticamente si es atleta o voluntario
    - Muestra información del registro antes de confirmar
    - Requiere seleccionar razón de cancelación
    - Opción "Otra razón" con campo de texto libre
    - Mensajes de error claros para tokens inválidos
  - **InscripcionPage.jsx** - En modo edición:
    - Nuevo botón "Cancelar Pre Registro" en la barra de navegación
    - Modal de confirmación con 4 opciones de razón predefinidas
    - Redirección al inicio después de cancelar exitosamente
  - **VoluntarioRegistroPage.jsx** - En modo edición:
    - Nuevo botón "Cancelar Postulación" en la barra de navegación
    - Modal de confirmación con 4 opciones de razón predefinidas
    - Redirección al inicio después de cancelar exitosamente
  - **Backend endpoints**:
    - `POST /api/registration/cancel/{token}` - Cancela registro de atleta
    - `POST /api/volunteer-registration/cancel/{token}` - Cancela registro de voluntario
    - Ambos actualizan status a "cancelled" y guardan razón y timestamp
    - Envían email de confirmación de cancelación
    - Voluntarios: También eliminan asignaciones de slots
  - **Email de recordatorio de pago** ya incluye link de cancelación
  - **Tests**: 13/13 backend tests passed (100%)

- [x] **Feature: Panel Admin para Configuración de Voluntarios** (01 Febrero 2026)
  - Nueva pestaña "Voluntarios" en el panel de administración
  - CRUD completo para posiciones: crear, editar, eliminar
  - Cada posición puede tener múltiples turnos configurables
  - Cada turno tiene: letra identificadora (A-G), hora inicio, hora fin, número de slots
  - Botón "Importar Existentes" para migrar datos de la configuración anterior
  - Estadísticas en tiempo real: posiciones, turnos totales, slots configurados
  - Backend: Endpoints `/api/volunteer-config/*`
  - El formulario de registro de voluntarios usa esta configuración dinámica
- [x] **Feature: Selección de Turnos en Registro de Voluntarios** (01 Febrero 2026)
  - Nuevo paso "Turnos" en el formulario de voluntarios
  - Muestra posiciones y turnos disponibles agrupados dinámicamente desde la base de datos
  - Permite selección múltiple de turnos siempre que no haya conflicto de horarios
  - Validación de conflictos: si el usuario intenta seleccionar turnos que se solapan, muestra error
  - Resumen visual de turnos seleccionados antes de enviar
  - Backend: Nuevo endpoint `/api/volunteer-registration/available-slots`
  - 7 posiciones disponibles con turnos de 4 horas cada uno (A-G)
- [x] **Feature: Registro de Voluntarios** (31 Enero 2026)
  - Nuevo formulario de registro para voluntarios (/voluntarios/registro)
  - Formulario simplificado: sin foto, con pregunta sobre experiencia en eventos deportivos
  - 6 pasos: Verificación, Datos Personales, Experiencia, Info Médica, Emergencia, Preferencias
  - Verificación de email con código de 6 dígitos
  - Backend: Nuevos endpoints /api/volunteer-registration/*
  - Link "Postular como Voluntario" en la sección de voluntarios
- [x] **Feature: Cronograma Dinámico** (31 Enero 2026)
  - La fecha del cronograma en la página de corredores ahora es dinámica
  - Se actualiza automáticamente según la fecha del evento activo
- [x] **Feature: Costo y Edición Parametrizables** (31 Enero 2026)
  - Agregados campos `registration_cost` y `edition_number` a la configuración de carrera
  - Panel Admin > Carrera Activa: Campos editables para costo (RD$) y número de edición
  - Home: Badge dinámico muestra "Primera Edición", "Segunda Edición", etc.
  - Pre-Registro: El costo se muestra dinámicamente desde la base de datos
  - Backend: Valores por defecto (RD$3,500, Edición 1) si no están configurados
- [x] **Bug Fix: Pre-registro con email existente** (31 Enero 2026)
  - Corregido: Al intentar pre-registrarse con un email ya registrado, ahora muestra un mensaje claro
  - Muestra: "Este correo ya tiene un pre-registro" con botón para acceder al registro existente
  - El email se pre-llena automáticamente al hacer clic en "Acceder a mi Pre Registro"
  - Usó XMLHttpRequest para evitar conflictos con interceptores de la plataforma
- [x] **Bug Fix: Eliminación de Patrocinadores** (31 Enero 2026)
  - Corregido: Al eliminar un patrocinador, ahora desaparece de la UI inmediatamente
  - Cambio: Usar endpoint `hard-delete` (eliminación permanente) en lugar de `delete` (soft delete)
  - El estado local se actualiza inmediatamente para mejor UX
  - El mensaje de confirmación ahora advierte que la acción no se puede deshacer
- [x] **Gestión de Patrocinadores en Admin** (31 Enero 2026)
  - Nueva pestaña "Patrocinadores" en panel de administración
  - CRUD completo: crear, editar, eliminar patrocinadores
  - Campos: nombre, descripción, Instagram, logo (upload)
  - Patrocinadores asociados a carrera activa (race_code)
  - BYSD-2026 mantiene patrocinadores legacy (hardcodeados)
  - Nuevas carreras usan datos dinámicos de MongoDB
  - Backend: `/api/sponsors/` endpoints completos
- [x] **Página Comunidad Filtrada por Carrera** (31 Enero 2026)
  - Frontend pasa `race_code` en todas las llamadas API
  - Endpoints `/api/race/cheers`, `/api/race/fans/leaderboard`, `/api/race/fans/badge` filtran por race_code
  - Endpoint `/api/race/subscribers-count-public` filtra por race_code
  - Nuevos mensajes de ánimo se guardan con race_code de la carrera activa
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

### 🟢 Completado Recientemente

- [x] **Feature: Control de Visibilidad de Páginas Públicas** (02 Febrero 2026)
  - **Panel Admin - Pestaña Carrera**:
    - Nuevos switches "Mostrar página de Tracking" y "Mostrar página de Comunidad"
    - Permiten activar/desactivar las páginas públicas `/en-vivo` y `/comunidad`
  - **Navegación Dinámica**:
    - Los enlaces "Resultados" y "Comunidad" se ocultan automáticamente del menú cuando las páginas están desactivadas
    - Funciona tanto en navegación desktop como móvil
  - **Páginas Públicas**:
    - `/en-vivo` y `/comunidad` verifican la configuración antes de mostrar contenido
    - Mensaje elegante de "Página No Disponible" cuando está desactivada
    - Botón "Volver al Inicio" para regresar a la home
  - **Backend - Nuevo endpoint** (`backend/routes/race_config.py`):
    - `GET /api/race-config/page-visibility` - Retorna configuración de visibilidad pública
  - **Tests**: 18/18 tests backend (100%), frontend verificado

- [x] **Feature: Sistema Centralizado de Plantillas de Email** (02 Febrero 2026)
  - **Panel Admin - Nueva pestaña "Correos"**:
    - Lista de 18 plantillas de email categorizadas (atletas, voluntarios, pagos, sistema)
    - Editor HTML con preview en vivo (iframe)
    - Lista de merge fields disponibles ({{athlete_nombre}}, {{race_name}}, etc.)
    - Botón "Enviar Prueba" para verificar plantillas
  - **Plantillas Disponibles**:
    - Atletas: Confirmación registro, Verificación email, Código de acceso, Asignación BIB, Cancelación
    - Voluntarios: Confirmación registro, Código verificación, Asignación turno, Recordatorio turno, Cancelación, Link edición
    - Pagos: Recordatorio, Comprobante recibido, Pago confirmado, Pago rechazado
    - Sistema: Credenciales admin, Verificación email
  - **Refactorización Completa**:
    - Todos los emails hardcodeados migrados al sistema de plantillas
    - Archivos actualizados: registration.py, volunteer_registration.py, users.py, volunteers.py
  - **Backend - Nuevos endpoints** (`backend/routes/email_templates.py`):
    - `GET /api/email-templates/` - Lista todas las plantillas
    - `GET /api/email-templates/{id}` - Obtener plantilla por ID
    - `PUT /api/email-templates/{id}` - Actualizar plantilla
    - `POST /api/email-templates/preview` - Preview renderizado
    - `POST /api/email-templates/send-test` - Enviar email de prueba
  - **Tests**: 18/18 tests backend (100%), UI verificada

- [x] **Feature: Sistema de Recordatorio de Pago y Carga de Comprobante** (01 Febrero 2026)
  - **Panel Admin - Pre-Registro**:
    - Botón "Enviar Recordatorio" para notificar atletas activos con pago pendiente (30 días plazo)
    - Sección "Comprobantes Pendientes" mostrando uploads de atletas esperando revisión
    - Botones para aprobar/rechazar comprobantes con notificación automática por email
    - Muestra conteo de atletas con pago pendiente y comprobantes por revisar
  - **Nueva página `/subir-comprobante`**:
    - Accesible con token único enviado en el email de recordatorio
    - Muestra datos de cuenta para el pago (banco, número, a nombre de, monto)
    - Formulario: fecha de pago, banco de origen, número de transferencia (opcional)
    - Upload de imagen del comprobante (JPG, PNG, WebP, PDF)
  - **Emails automatizados**:
    - Recordatorio de pago con datos de cuenta y enlace para subir comprobante
    - Confirmación cuando se recibe un comprobante
    - Notificación de aprobación/rechazo del comprobante
  - **Tests**: 13/13 tests backend (100%), frontend verificado

- [x] **Feature: Zona Horaria GMT en Configuración de Carrera** (01 Febrero 2026)
  - Campo dropdown en Panel Admin > Carrera > "Zona Horaria (GMT)"
  - Opciones desde GMT-12 hasta GMT+2
  - Default: GMT-4 (República Dominicana)
  - Usado para el control de vueltas en tiempo oficial

- [x] **Feature: Notificaciones de Manual Disponible por Email** (01 Febrero 2026)
  - **Nuevos botones en Panel Admin > Carrera > Manuales**:
    - "Notificar Corredores (X)" - Envía email a atletas activos informando que la Guía del Corredor está disponible
    - "Notificar Voluntarios (X)" - Envía email a voluntarios registrados informando que el Manual de Voluntarios está disponible
    - Los botones muestran el conteo de destinatarios
    - Solo aparecen cuando hay manual cargado
    - Confirmación antes de enviar con cantidad de destinatarios
  - **Template de Email profesional**:
    - Logo del evento y diseño consistente
    - Descripción del contenido del manual
    - Botón CTA "Ver Guía del Corredor" / "Ver Manual de Voluntarios"
    - Link de descarga directa del PDF
  - **Backend - Nuevos endpoints** (`backend/routes/race_config.py`):
    - `GET /api/race-config/notify-runners-count/{code}` - Conteo de atletas activos
    - `GET /api/race-config/notify-volunteers-count/{code}` - Conteo de voluntarios
    - `POST /api/race-config/notify-runners-manual/{code}` - Enviar notificación a corredores
    - `POST /api/race-config/notify-volunteers-manual/{code}` - Enviar notificación a voluntarios
  - **Tests**: 11/11 tests backend (100%), código frontend verificado

- [x] **Feature: Gestión de Manuales y Datos de Pago** (01 Febrero 2026)
  - **Panel Admin - Pestaña Carrera**:
    - Nueva sección "Datos para Recibir Pagos" con 5 campos: Nombre de Cuenta, ID/Cédula, Banco, Tipo de Cuenta, Número de Cuenta
    - Nueva sección "Manuales del Evento" para subir/eliminar PDFs de Corredores y Voluntarios
    - Badges visuales indicando estado del manual (Cargado/No cargado)
    - Botones para ver, reemplazar y eliminar manuales
  - **Páginas Públicas**:
    - `/corredores`: Botones "Ver Guía" y "Descargar" dinámicos (habilitados si hay manual)
    - `/voluntarios`: Botón "Descargar Manual" dinámico (habilitado si hay manual)
    - Mensaje "Próximamente" cuando no hay manual configurado
  - **Backend - Nuevos endpoints** (`backend/routes/race_config.py`):
    - `POST /api/race-config/upload-manual/{code}/{manual_type}` - Subir manual PDF
    - `DELETE /api/race-config/delete-manual/{code}/{manual_type}` - Eliminar manual
    - `GET /api/race-config/manual/{filename}` - Servir archivo PDF
    - `GET /api/race-config/manuals/{code}` - Obtener URLs de manuales
  - **Tests**: 100% backend, 100% frontend (iteration_9.json)

- [x] **Feature: Edición de Registro de Voluntarios** (01 Febrero 2026)
  - Voluntarios pueden editar su postulación usando un link único enviado por email
  - El link contiene un token seguro de 32 caracteres (`?token=xxx`)
  - **Nuevo botón "Editar mi Postulación"** en la página de Voluntarios
    - Abre un modal para solicitar el link de edición
    - El usuario ingresa su email y recibe el link por correo
    - Backend: Nuevo endpoint `POST /api/volunteer-registration/request-edit-link`
  - En modo edición:
    - Título cambia a "Editar Postulación"
    - Barra de progreso muestra 6 pasos (sin Verificación)
    - Formulario pre-cargado con datos existentes
    - Botón "Guardar Cambios" en lugar de "Completar Registro"
  - Pantalla de confirmación específica para actualización
  - Backend: Endpoints `GET /api/volunteer-registration/by-token/{token}` y `PUT /api/volunteer-registration/update/{token}`
  - Email de confirmación incluye link de edición automáticamente
  - Tests: 100% backend (9/9), 100% frontend UI

### 🔴 P1 - Próximas Tareas
- [ ] Notificación UI cuando un fan sube de nivel de badge
- [ ] Filtros mejorados en página Comunidad (por atleta o fan)
- [ ] Limpieza de código: Remover integración abandonada de Twitter/X
  - Eliminar `tweepy` de requirements.txt
  - Eliminar `backend/services/twitter_service.py`
  - Remover variables de entorno relacionadas

### 🟠 P2 - Mejoras Sugeridas
- [ ] Optimizar/eliminar archivo PDF obsoleto `manual-corredores.pdf` del directorio /public (27MB)
- [ ] Refactorizar componentes grandes:
  - `RaceConfigPanel.jsx` - Separar secciones en subcomponentes
  - `VolunteerAssignmentsManagement.jsx` - Separar lógica
  - `VoluntarioRegistroPage.jsx` - Dividir pasos en componentes
- [ ] Mover datos de patrocinadores a archivo JSON externo
- [ ] Extraer lista de participantes a archivo CSV/JSON separado

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
  - `/app/backend/tests/test_pre_registration_admin.py`
  - `/app/backend/tests/test_volunteer_edit_mode.py`
  - `/app/backend/tests/test_email_templates.py` (nuevo)
  - `/app/backend/tests/test_page_visibility_and_templates.py` (nuevo)
- **Reportes**: 
  - `/app/test_reports/iteration_1.json` - iteration_14.json
  - `/app/test_reports/iteration_15.json` (nuevo - visibilidad y plantillas email)
- **Cobertura**: 127+ tests backend (100%), UI tests completos (100%)

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
