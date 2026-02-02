# Flujo de Control de Carrera y Sistema QR - Documentación Técnica

## Última Actualización: 02 Febrero 2026

---

## Resumen del Sistema

El sistema de control de carrera permite gestionar el avance de vueltas, estados de atletas, y registro de tiempos mediante:
1. **Panel de Control Manual** - RaceControlPanel.jsx
2. **Sistema de Escaneo QR** - QRScannerPage.jsx y ScanConfirmPage.jsx

---

## Panel de Control de Carrera

### Funcionalidades Principales

1. **Control de Vuelta Actual**
   - Muestra vuelta en curso
   - Permite avanzar y retroceder vueltas
   - Validación de horario (opcional)
   - Cada vuelta = 1 hora (Backyard Ultra)

2. **Gestión de Participantes**
   - Registrar vuelta individual
   - Marcar DNF (Did Not Finish)
   - Marcar DNS (Did Not Start)
   - Marcar Ganador
   - Marcar Invitada de Honor
   - Ajustar vueltas manualmente
   - Editar datos del corredor
   - Reactivar atleta

3. **Acciones Administrativas**
   - Reiniciar base de datos de carrera
   - Reiniciar suscripciones de email
   - Borrar mensajes de ánimo
   - Enviar correos a corredores

---

## Sistema de Escaneo QR

### Flujo de Escaneo

```
1. Escanear QR o ingresar BIB manualmente
   ↓
2. Cargar datos del atleta desde /api/qr-scan/athlete/{bib}
   ↓
3. Verificar estado y calcular vuelta a completar
   ↓
4. Confirmar vuelta o marcar DNF
   ↓
5. Actualizar base de datos via /api/qr-scan/confirm-lap
```

### Lógica de Auto-DNF

El sistema calcula automáticamente si un atleta debe ser marcado como DNF basándose en:
- **Hora de inicio de carrera** - Configurable en race_configurations
- **Duración de vuelta** - 60 minutos (Backyard Ultra)
- **Vueltas completadas del atleta**

```
Si (vuelta_atleta + 1) < vuelta_carrera_actual:
    auto_dnf = True
    can_complete = False
```

---

## API Endpoints

### Race Control

| Método | Endpoint | Descripción | Colección |
|--------|----------|-------------|-----------|
| GET | `/api/race/stats` | Estadísticas de carrera | registrations/participants |
| GET | `/api/race/participants` | Lista de participantes | registrations/participants |
| POST | `/api/race/set-current-lap` | Establecer vuelta actual | race_config |
| POST | `/api/race/complete-lap` | Completar vuelta individual | registrations/participants |
| POST | `/api/race/complete-lap-all-active` | Completar vuelta para todos | registrations/participants |
| POST | `/api/race/revert-lap` | Retroceder vuelta | race_config + registrations |
| POST | `/api/race/mark-retired` | Marcar DNF | registrations/participants |
| POST | `/api/race/mark-dns` | Marcar DNS | registrations/participants |
| POST | `/api/race/mark-winner` | Marcar ganador | registrations/participants |
| POST | `/api/race/mark-honor` | Marcar invitada de honor | registrations/participants |
| POST | `/api/race/reactivate` | Reactivar atleta | registrations/participants |
| POST | `/api/race/adjust-laps` | Ajustar vueltas | registrations/participants |
| POST | `/api/race/edit-participant` | Editar datos | registrations/participants |
| POST | `/api/race/reset-database` | Reiniciar carrera | registrations + race_config |

### QR Scanning

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/qr-scan/race-status` | Estado actual de la carrera |
| GET | `/api/qr-scan/athlete/{bib}` | Datos del atleta para escaneo |
| POST | `/api/qr-scan/confirm-lap` | Confirmar vuelta o DNF |
| POST | `/api/qr-scan/generate-qr/{bib}` | Generar QR para atleta |
| GET | `/api/qr-scan/image/{filename}` | Obtener imagen QR |
| GET | `/api/qr-scan/download-all-qr/{race_code}` | Descargar ZIP con todos los QRs |

---

## Modelo de Datos

### race_config
```javascript
{
  race_code: String,
  current_lap: Int,
  race_status: "active" | "finished",
  updated_at: DateTime
}
```

### registrations (campos relevantes para carrera)
```javascript
{
  email: String,
  race_code: String,
  bib: Int,
  nombre: String,
  apellidos: String,
  nacionalidad: String,
  status: "active" | "retired" | "dns" | "winner" | "honor",
  laps_completed: Int,
  total_km: Float,
  retired_at_lap: Int?,
  qr_code_url: String?,
  laps_log: [{
    lap: Int,
    completed_at: DateTime,
    method: "manual" | "qr_scan"
  }]
}
```

---

## Estados de Atleta

| Estado | Descripción | Puede Competir |
|--------|-------------|----------------|
| `active` | Compitiendo activamente | ✅ |
| `retired` | DNF - Abandonó la carrera | ❌ |
| `dns` | DNS - No se presentó | ❌ |
| `winner` | Ganador de la carrera | ❌ |
| `honor` | Invitada de Honor | ❌ |

---

## Generación de Código QR

El QR contiene una URL con formato:
```
{FRONTEND_URL}/scan/confirmar?bib={BIB}&race={RACE_CODE}
```

**Características:**
- Error correction: HIGH (H)
- Box size: 10px
- Border: 4 boxes
- Formato: PNG
- Almacenamiento: `/backend/static/qrcodes/`

---

## Validación de Tiempo

El panel de control incluye validación opcional de tiempo:
- **Activada:** Solo permite completar vuelta cuando el tiempo ha transcurrido
- **Desactivada:** Permite completar vueltas sin restricción de horario

Cada vuelta tiene un rango horario:
```
Vuelta 1: 9:00 AM - 9:59 AM
Vuelta 2: 10:00 AM - 10:59 AM
...
Vuelta N: (9 + N - 1):00 - (9 + N - 1):59
```

---

## Colecciones y Compatibilidad

El sistema soporta dos colecciones de datos:

1. **`registrations`** - Nueva colección (carreras desde 2027)
2. **`participants`** - Colección legacy (BYSD-2026 y anteriores)

**Lógica de selección:**
```python
LEGACY_RACE_CODES = ["BYSD-2026"]

if active_race_code not in LEGACY_RACE_CODES:
    # Usar registrations
else:
    # Usar participants
```

---

## Tests Verificados (02 Febrero 2026)

| Funcionalidad | Estado |
|---------------|--------|
| Obtener estadísticas de carrera | ✅ |
| Obtener lista de participantes | ✅ |
| Establecer vuelta actual | ✅ |
| Completar vuelta individual | ✅ |
| Escanear atleta por BIB (válido) | ✅ |
| Escanear atleta por BIB (inválido) | ✅ |
| Generar código QR | ✅ |
| Confirmar vuelta via QR scan | ✅ |
| Rechazar vuelta incorrecta | ✅ |
| Marcar DNF via QR scan | ✅ |
| Marcar DNF via panel | ✅ |
| Marcar DNS | ✅ |
| Reactivar atleta (registrations) | ✅ |
| Ajustar vueltas (registrations) | ✅ |
| Editar datos (registrations) | ✅ |
| Marcar ganador | ✅ |
| Marcar invitada de honor | ✅ |

---

## Bugs Corregidos (02 Febrero 2026)

1. **Endpoint `/reactivate`** - Ahora busca en `registrations` además de `participants`
2. **Endpoint `/mark-dns`** - Ahora usa `registrations` para carreras nuevas
3. **Endpoint `/adjust-laps`** - Ahora usa `registrations` para carreras nuevas
4. **Endpoint `/edit-participant`** - Ahora usa `registrations` para carreras nuevas
5. **Endpoint `/mark-honor`** - Ahora usa `registrations` para carreras nuevas

Todos estos endpoints ahora detectan automáticamente la colección correcta basándose en el `race_code` activo.
