# Flujo de Registro de Voluntarios - Documentación Técnica

## Última Actualización: 02 Febrero 2026

---

## Resumen del Sistema

El sistema de voluntarios tiene dos colecciones principales:
1. **`volunteers`** - Colección legacy con datos de voluntarios importados (54 registros)
2. **`volunteer_registrations`** - Nueva colección para registros vía formulario web

Ambas colecciones son válidas para asignación de slots.

---

## Flujo de Registro de Nuevo Voluntario

### Paso 1: Verificación de Email
```
POST /api/volunteer-registration/send-verification
Body: { "email": "voluntario@email.com" }
```
- Genera código de 6 dígitos
- Almacena en `volunteer_verification_tokens`
- Envía email con código
- Expira en 30 minutos

### Paso 2: Confirmar Código
```
POST /api/volunteer-registration/verify-code
Body: { "email": "voluntario@email.com", "code": "123456" }
```
- Valida código
- Genera `session_token` de 32 caracteres
- Almacena en `volunteer_sessions`
- Elimina token de verificación

### Paso 3: Completar Registro
```
POST /api/volunteer-registration/register
Query: ?email=voluntario@email.com&session_token=xxx
Body: VolunteerRegistrationData
```
- Valida sesión
- Crea registro en `volunteer_registrations`
- Genera `edit_token` para futuras ediciones
- Envía email de confirmación con link de edición
- Status inicial: `"registered"`

---

## Flujo de Asignación de Voluntario

### Asignar Voluntario a Slot
```
POST /api/volunteers/assign/{slot_id}
Body: { "email": "voluntario@email.com" }
```

**Validaciones:**
1. ✅ El email debe existir en `volunteers` O `volunteer_registrations`
2. ✅ El slot debe existir
3. ✅ El slot no debe tener otro voluntario asignado

**Acciones:**
1. Actualiza `volunteer_assignments` con email y nombre
2. Actualiza `volunteer_registrations.status` a `"confirmed"`
3. Elimina slot de `slots_interes` del voluntario
4. Programa recordatorio 1h antes del turno
5. Envía email de confirmación de turno

### Desasignar Voluntario de Slot
```
POST /api/volunteers/unassign/{slot_id}
Body: { "email": "voluntario@email.com" }
```

**Validaciones:**
1. ✅ El slot debe existir
2. ✅ El slot debe tener asignación
3. ✅ El email debe coincidir con el voluntario asignado

**Acciones:**
1. Limpia `email_asignado` y `nombre_asignado` en slot
2. Cancela recordatorio programado
3. Si no tiene más asignaciones, revierte status a `"registered"`

---

## Estados de Voluntario

| Estado | Descripción |
|--------|-------------|
| `registered` | Registro completado, sin asignación activa |
| `confirmed` | Tiene al menos un slot asignado |
| `cancelled` | Registro cancelado por el voluntario |

---

## Flujo de Edición

### Solicitar Link de Edición
```
POST /api/volunteer-registration/request-edit-link
Body: { "email": "voluntario@email.com" }
```
- Busca registro por email y race_code activo
- Genera nuevo `edit_token` si no existe
- Envía email con link de edición

### Obtener Registro por Token
```
GET /api/volunteer-registration/by-token/{token}
```
- Retorna datos del registro (sin edit_token)

### Actualizar Registro
```
PUT /api/volunteer-registration/update/{token}
Body: VolunteerRegistrationData
```
- Actualiza todos los campos
- Mantiene email, race_code, edit_token

---

## Flujo de Cancelación

```
POST /api/volunteer-registration/cancel/{token}
Body: { "reason": "Razón", "other_reason": "opcional" }
```

**Acciones:**
1. Elimina todas las asignaciones del voluntario
2. Elimina registro de `volunteer_registrations`
3. Limpia tokens y sesiones
4. Envía email de confirmación de cancelación

---

## Colecciones MongoDB

### `volunteer_registrations`
```javascript
{
  email: String,
  race_code: String,
  nombre: String,
  apellidos: String,
  fecha_nacimiento: String,
  sexo: "Masculino" | "Femenino" | "Otro",
  nacionalidad: String,
  telefono: String,
  ciudad_residencia: String,
  experiencia_voluntariado: "Sí" | "No",
  experiencia_voluntariado_detalle: String?,
  slots_interes: [Int]?,
  tipo_sangre: String?,
  condicion_medica: "Sí" | "No"?,
  condicion_medica_detalle: String?,
  alergias: "Sí" | "No"?,
  alergias_detalle: String?,
  contacto_emergencia_nombre: String,
  contacto_emergencia_relacion: String?,
  contacto_emergencia_telefono: String,
  talla_camiseta: "XS" | "S" | "M" | "L" | "XL" | "XXL"?,
  como_se_entero: String?,
  comentarios: String?,
  email_verified: Boolean,
  status: "registered" | "confirmed" | "cancelled",
  edit_token: String,
  created_at: DateTime,
  updated_at: DateTime
}
```

### `volunteer_assignments`
```javascript
{
  id: Int,
  puesto: String,
  turno: String,  // A-G
  dia: String,    // YYYY-MM-DD
  hora_inicio: String,  // HH:MM:SS
  hora_fin: String,
  slot: Int,
  email_asignado: String?,
  nombre_asignado: String?,
  created_at: DateTime,
  updated_at: DateTime
}
```

### `volunteers` (Legacy)
```javascript
{
  email: String,
  nombre: String,
  apellidos: String,
  sexo: String?,
  lugar_residencia: String?,
  telefono: String?,
  created_at: DateTime
}
```

---

## API Endpoints

### Públicos
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/volunteer-registration/send-verification` | Enviar código |
| POST | `/api/volunteer-registration/verify-code` | Verificar código |
| POST | `/api/volunteer-registration/register` | Completar registro |
| GET | `/api/volunteer-registration/available-slots` | Slots disponibles |
| GET | `/api/volunteer-registration/by-token/{token}` | Obtener registro |
| PUT | `/api/volunteer-registration/update/{token}` | Actualizar registro |
| POST | `/api/volunteer-registration/cancel/{token}` | Cancelar registro |
| POST | `/api/volunteer-registration/request-edit-link` | Solicitar link |
| GET | `/api/volunteer-registration/check/{email}` | Verificar si existe |

### Admin
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/volunteers/slots` | Todos los slots |
| GET | `/api/volunteers/positions` | Posiciones únicas |
| GET | `/api/volunteers/shifts` | Turnos únicos |
| POST | `/api/volunteers/assign/{slot_id}` | Asignar voluntario |
| POST | `/api/volunteers/unassign/{slot_id}` | Desasignar |
| GET | `/api/volunteers/list` | Lista legacy |
| GET | `/api/volunteer-registration/admin/registrations` | Registros nuevos |
| DELETE | `/api/volunteer-registration/admin/registrations/{email}` | Eliminar registro |

---

## Tests Verificados (02 Febrero 2026)

| Test | Estado |
|------|--------|
| Enviar código de verificación | ✅ |
| Verificar email existente | ✅ |
| Verificar email no existente | ✅ |
| Asignar voluntario a slot | ✅ |
| Status cambia a "confirmed" | ✅ |
| Desasignar voluntario | ✅ |
| Status vuelve a "registered" | ✅ |
| Rechazar asignación sin registro | ✅ |
| Rechazar slot ocupado | ✅ |
| Rechazar desasignación con email incorrecto | ✅ |
| Rechazar slot inexistente | ✅ |
| Solicitar link de edición | ✅ |
| Rechazar link para email no registrado | ✅ |
