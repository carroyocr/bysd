# Flujo de Registro de Atletas - Backyard Ultra Santo Domingo

## Resumen del Flujo

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  1. PRE-REGISTRO│───▶│ 2. CONFIRMACIÓN  │───▶│   3. PAGO       │
│  (Formulario)   │    │    DE EMAIL      │    │ (Comprobante)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                       │
                                                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   6. DÍA DE     │◀───│ 5. CARRERA       │◀───│ 4. ASIGNACIÓN   │
│   CARRERA       │    │    ACTIVA        │    │    DE BIB + QR  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │
         ▼
┌─────────────────┐    ┌──────────────────┐
│ 7. CONTROL DE   │───▶│  8. GANADOR O    │
│    VUELTAS      │    │     DNF          │
└─────────────────┘    └──────────────────┘
```

---

## Fase 1: Pre-Registro

### Endpoint
`POST /api/registration/register`

### Campos Requeridos
| Campo | Tipo | Descripción |
|-------|------|-------------|
| email | string | Email único del atleta |
| nombre | string | Nombre |
| apellidos | string | Apellidos |
| fecha_nacimiento | date | Fecha de nacimiento |
| sexo | enum | "Masculino" o "Femenino" |
| nacionalidad | string | Código de país |
| telefono | string | Número de teléfono |
| ciudad_residencia | string | Ciudad de residencia |
| anos_experiencia | int | Años de experiencia en running |
| maxima_distancia_km | int | Distancia máxima corrida |
| motivacion | string | Motivación para participar |
| tipo_sangre | string | Tipo de sangre |
| condicion_medica | string | Condiciones médicas |
| alergias | string | Alergias |
| contacto_emergencia_nombre | string | Nombre contacto emergencia |
| contacto_emergencia_telefono | string | Teléfono emergencia |
| talla_camiseta | enum | XS, S, M, L, XL, XXL |
| personalizacion_camiseta | string | Nombre para camiseta |
| race_code | string | Código de la carrera (ej: BYSD-2027) |

### Estados Iniciales
- `status`: "pre_registered"
- `payment_status`: "pending"
- `bib`: null
- `laps_completed`: 0

### Tokens Generados
- `edit_token`: Para editar el registro
- `verification_token`: Para verificar email

---

## Fase 2: Confirmación de Email

### Endpoint
`POST /api/registration/verify`

### Proceso
1. Usuario recibe email con enlace de verificación
2. Click en enlace verifica el email
3. Estado cambia a "registered"

---

## Fase 3: Proceso de Pago

### Flujo de Pago
1. **Admin envía recordatorio**: `POST /api/registration/admin/send-payment-reminder/{email}`
2. **Atleta sube comprobante**: `POST /api/registration/upload-receipt`
3. **Admin revisa comprobante**: `PUT /api/registration/admin/review-receipt/{email}`
   - Si aprueba: `payment_status = "paid"`, `status = "confirmed"`
   - Se crea entrada en finanzas automáticamente

### Estados de Pago
- `pending`: Pago pendiente
- `paid`: Pago confirmado

---

## Fase 4: Asignación de BIB y QR

### Métodos de Asignación

#### Automático (por experiencia)
`POST /api/registration/admin/auto-assign-bibs/{race_code}`

**Algoritmo de Score:**
```python
score = (años_experiencia * 10) + (maxima_distancia_km / 10)
```

**Proceso:**
1. Filtra atletas con `payment_status = "paid"` y `status = "active"`
2. Ordena por score descendente
3. Asigna BIBs secuenciales (001, 002, ...)
4. Genera código QR para cada BIB

#### Manual (individual)
Editar atleta desde el panel admin

### QR Code
- **Contenido**: URL a `/scan/confirmar?bib={BIB}&race={RACE_CODE}`
- **Almacenamiento**: `/api/qr-scan/image/qr_{race_code}_{bib}.png`
- **Descarga masiva**: `GET /api/qr-scan/download-all-qr/{race_code}` (ZIP)

---

## Fase 5: Configuración de Carrera

### Configuración en `/api/race-config/`
- `date`: Fecha de la carrera
- `start_time`: Hora de inicio (ej: "09:00")
- `timezone_gmt`: Zona horaria (ej: "GMT-4")
- `is_active`: Boolean para carrera activa

### Constantes de Carrera
- **Duración de vuelta**: 60 minutos
- **Distancia por vuelta**: 6.7 km

---

## Fase 6: Día de Carrera

### Filtro de Participantes Activos
Solo se muestran atletas con:
- `status = "active"`
- `payment_status = "paid"`
- `bib != null`

### Endpoint de Participantes
`GET /api/race/participants/{race_code}`

---

## Fase 7: Control de Vueltas

### Métodos de Registro

#### 1. Escáner QR (Recomendado)
- **Página**: `/scan` o `/scan/confirmar?bib={BIB}`
- **Endpoint**: `POST /api/qr-scan/confirm-lap`
- **Auto-DNF**: Si el tiempo de vuelta se agota

#### 2. Manual Individual
`POST /api/race/complete-lap`
```json
{
  "bib": "001",
  "lap_number": 5
}
```

#### 3. Manual Masivo
`POST /api/race/complete-lap-all-active`
- Completa la vuelta para todos los atletas activos

### Lógica de Tiempo
```python
# Cálculo de vuelta actual
tiempo_transcurrido = hora_actual - hora_inicio
vuelta_actual = (tiempo_transcurrido / 60_minutos) + 1

# Auto-DNF
if vuelta_atleta < vuelta_actual - 1:
    marcar_como_DNF()
```

---

## Fase 8: Estados Finales

### Marcar DNF (Did Not Finish)
`POST /api/race/mark-retired`
```json
{
  "bib": "005",
  "retired_at_lap": 12
}
```

### Marcar DNS (Did Not Start)
`POST /api/race/mark-dns`
```json
{
  "bib": "010"
}
```

### Declarar Ganador
`POST /api/race/mark-winner`
```json
{
  "bib": "001"
}
```

**Validaciones:**
- Solo puede haber UN ganador por carrera
- El atleta debe estar activo
- Se envían notificaciones automáticas

---

## Colecciones de Base de Datos

| Colección | Propósito |
|-----------|-----------|
| `registrations` | Datos de atletas (carreras nuevas) |
| `participants` | Datos de atletas (carreras legacy) |
| `race_configurations` | Configuración de carreras |
| `laps_log` | Historial de vueltas completadas |
| `finance_movements` | Registro de pagos |
| `cheer_messages` | Mensajes de apoyo |

---

## Estados del Atleta

```
pre_registered → registered → confirmed → active → winner/retired/dns
     │               │            │          │
     └───────────────┴────────────┴──────────┴─── cancelled (eliminado)
```

| Estado | Descripción |
|--------|-------------|
| `pre_registered` | Formulario completado, email no verificado |
| `registered` | Email verificado |
| `confirmed` | Pago confirmado |
| `active` | Listo para competir / Compitiendo |
| `retired` | DNF - No terminó |
| `dns` | DNS - No inició |
| `winner` | Ganador de la carrera |

---

## Notificaciones por Email

| Evento | Template |
|--------|----------|
| Registro completado | Confirmación con token de edición |
| Verificación de email | Enlace de verificación |
| Recordatorio de pago | Datos bancarios + link subir comprobante |
| Pago confirmado | Confirmación de inscripción |
| DNF | Notificación de retiro |
| Ganador | ¡Felicitaciones! |

---

## Endpoints de Admin Principales

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/registration/admin/pending` | GET | Listar registros pendientes |
| `/api/registration/admin/review-receipt/{email}` | PUT | Aprobar/rechazar pago |
| `/api/registration/admin/auto-assign-bibs/{race_code}` | POST | Asignar BIBs automático |
| `/api/registration/admin/remove-all-bibs/{race_code}` | PUT | Quitar todos los BIBs |
| `/api/race/complete-lap` | POST | Registrar vuelta |
| `/api/race/mark-winner` | POST | Declarar ganador |
| `/api/race/mark-retired` | POST | Marcar DNF |
