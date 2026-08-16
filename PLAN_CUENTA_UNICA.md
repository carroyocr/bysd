# Plan — Cuenta única BYSD

Unificar los accesos de corredor, staff y espectador en una sola cuenta con roles,
manteniendo la entrada libre a ver la carrera sin registrarse.

Estado: **propuesta, sin implementar**. Rama `cuenta-unica`.

---

## 1. De dónde partimos

Hoy hay **dos sistemas de identidad completos y separados**, y un tercer grupo de
personas del que no se guarda nada.

| | Corredor | Staff / voluntario | Espectador |
|---|---|---|---|
| Colección | `athletes` | `admin_users` | — |
| Alta | `POST /api/athletes/register` | `POST /api/staff/password/set` | — |
| Login | `POST /api/athletes/login` | `POST /api/race/auth/admin-login` | — |
| Contraseña | PBKDF2-SHA256, campo `password_hash` | bcrypt, campo `password` | — |
| Firma del token | `JWT_SECRET_KEY + "-athletes"` | `JWT_SECRET_KEY` | — |
| Contenido del token | `athlete_id`, `email`, `type` | `username`, `is_admin`, `permissions[]` | — |
| Duración | 72 h | 12 h | — |
| Clave en el móvil | `athlete_token` | `admin_token` | — |
| Biometría (llavero) | `bysd-live-atleta` | `bysd-live-staff` | — |

Del espectador solo queda un nombre suelto: `cheer_messages` guarda `fan_name` como
texto libre ([race.py:1462](backend/routes/race.py:1462)). A quién sigue, qué le
gustó y cómo se llama viven en el `localStorage` del teléfono
(`backyard_ultra_followed_athletes`, `bysd_live_fan_name`, `bysd_live_cheer_likes`):
se pierden al cambiar de móvil y no sirven para nada fuera de él.

### La prueba de que el modelo actual ya no da más

`push_devices` guarda **`athlete_email` y `staff_email` en el mismo documento**, con
este comentario en [push.py:122](backend/routes/push.py:122):

> «la app del corredor y la del staff registran el mismo token desde pantallas
> distintas y una no debe borrar lo de la otra»

Y [sesion.js](frontend/src/live/sesion.js) mantiene **las dos sesiones abiertas a la
vez**, con biometría registrada por separado. El sistema ya está tratando a una
persona como dos, y ya ha tenido que ponerle parches para que no se pisen.

---

## 2. La idea

**Una colección `accounts` que es solo identidad. Los perfiles se quedan donde
están.**

`accounts` guarda: correo, contraseña, nombre, roles y permisos. Nada más.
El perfil de corredor sigue en `athletes` (con todo su historial médico, contacto de
emergencia, talla de camiseta, resultados reclamados); el de voluntario sigue
saliendo de `volunteer_registrations`. La cuenta apunta a ellos, no los absorbe.

```
accounts (identidad)
   ├── roles: ["fan"]                → espectador, sin perfil
   ├── roles: ["fan","athlete"]      → athlete_profile_id → athletes._id
   ├── roles: ["fan","staff"]        → permissions[]
   └── roles: ["fan","athlete","staff"] → las dos cosas, UNA cuenta
```

Todo el mundo tiene `fan`: es el suelo común, y es lo que hace que un corredor pueda
seguir a otro corredor sin ninguna lógica especial.

### El orden importa más que el diseño

El espectador **no tiene ni un solo usuario hoy**. Eso lo convierte en el mejor sitio
posible para estrenar la infraestructura de cuentas: se construye `accounts`, el
token con roles y el login unificado, se pone en producción, y si algo está mal no
hay ningún dato de nadie en riesgo. Cuando eso lleve semanas funcionando, los
corredores y el staff se migran **encima de código ya probado en producción**, no
encima de código recién escrito.

Por eso el plan no es «espectador primero y unificar después» como dos proyectos
sueltos. Es un solo proyecto, ordenado para que la parte con riesgo caiga la última.

---

## 3. Lo que manda en el orden

### 3.1 La app aún no está publicada — y eso lo cambia casi todo

La app BYSD Live no está en App Store ni en Play Store: la distribución sigue
bloqueada por la membresía de Apple sin pagar, y las únicas instalaciones son las de
prueba. **No hay ninguna app ahí fuera a la que haya que dar compatibilidad.**

Eso elimina la restricción más pesada que tendría este proyecto en cualquier otro
momento. En concreto:

- No hace falta mantener vivos los formatos de token antiguos durante meses.
- No hace falta que `push_devices` siga arrastrando `athlete_email` y `staff_email`.
- **La app se construye con la cuenta única desde el principio**, en vez de meterle
  cuentas de espectador encima del modelo de dos tokens para reescribirla después.
  Esto fusiona dos fases del plan en una.
- No hay ciclo de revisión de tiendas bloqueando nada.

Lo que sí sigue en producción es **la web**, con corredores y staff reales entrando
todos los días. Pero la web se despliega entera de una vez: el único coste de cambiar
el formato de token es que las sesiones abiertas se caen y hay que volver a entrar
una vez. Molestia de un día, no restricción de meses.

**Esta es la razón de fondo para hacerlo ahora y no después de publicar.** Cada
semana que la app esté en las tiendas, este mismo trabajo cuesta bastante más.

### 3.2 Al unificar la firma, la seguridad cambia de sitio

Hoy la garantía de que un token de corredor no sirve en el panel es **criptográfica**:
está firmado con otra clave, y así lo dice [auth.py:62](backend/services/auth.py:62).
Al unificar, esa garantía pasa a depender de que cada endpoint mire los roles.

Estos seis exigen hoy solo «token válido», sin permiso concreto:

- [staff_account.py:235](backend/routes/staff_account.py:235) `GET /api/staff/mi-perfil`
- [staff_account.py:283](backend/routes/staff_account.py:283) `DELETE /api/staff/mi-perfil/turnos/{id}`
- [staff_account.py:353](backend/routes/staff_account.py:353) `GET /api/staff/mi-perfil/turnos-disponibles`
- [staff_account.py:367](backend/routes/staff_account.py:367) `PUT /api/staff/mi-perfil/turnos`
- [users.py:40](backend/routes/users.py:40) cambio de contraseña propia
- [race.py:42](backend/routes/race.py:42) `verify_token`, usado por varias rutas del panel

Si se unifica la firma sin tocarlos, **cualquier corredor con cuenta pasa a poder
leer el perfil de staff y apuntarse turnos**. La contramedida es que `require_admin`
exija `"staff" in roles`, no solo firma válida — y que haya un test automático que
lo demuestre. Ese test es la condición de salida de la Fase 3, no un extra.

### 3.3 La web está en producción y el Mundial es en octubre

`main` despliega solo. Hay corredores y staff con cuentas reales y contraseñas reales,
y el Campeonato Mundial es en octubre de 2026. La migración de contraseñas es la única
parte que no debe tocarse con la carrera encima.

---

## 4. Modelo de datos

### Colección `accounts`

```js
{
  _id: ObjectId,
  email: "persona@correo.com",        // único, siempre en minúsculas
  password_hash: "$2b$...",           // bcrypt para las nuevas
  password_hash_legacy: "salt:hex",   // PBKDF2 heredado, temporal (ver 6.3)
  nombre: "Nombre",
  apellidos: "Apellidos",             // opcional para el espectador
  roles: ["fan"],                     // fan | athlete | staff
  permissions: [],                    // solo con rol staff; los mismos de hoy
  is_admin: false,
  email_verified: false,
  athlete_profile_id: ObjectId|null,  // → athletes._id
  staff_username: "correo"|null,      // → admin_users.username, durante la transición
  pais: null, ciudad: null,           // espectador, opcional
  relacion: null,                     // familiar | amigo | corredor | publico
  acepta_comunicaciones: false,       // consentimiento explícito, aparte del alta
  followed: [],                       // dorsales seguidos, subidos del teléfono
  created_at, updated_at, last_login_at
}
```

Índices: `email` único; `roles`; `athlete_profile_id` disperso.

### Token unificado

```js
{
  sub: "<account_id>",
  email: "...",
  roles: ["fan","athlete"],
  permissions: [...],      // solo si hay rol staff
  is_admin: false,
  ver: 2,                  // versión del formato: distingue nuevo de heredado
  exp: ...
}
```

Firmado con `JWT_SECRET_KEY`. Duración: 12 h si trae rol staff, 72 h si no —
mantiene el criterio actual de que el panel caduca antes.

### Lo que cambia en las colecciones existentes

| Colección | Cambio |
|---|---|
| `athletes` | gana `account_id`. Nada más se toca. |
| `admin_users` | se mantiene como está durante la transición; los permisos se copian a `accounts`, no se mueven, hasta la Fase 5. |
| `cheer_messages` | gana `account_id` opcional. `fan_name` se conserva para todo lo histórico. |
| `push_devices` | `athlete_email` y `staff_email` se sustituyen por `account_id`. Sin app publicada, no hace falta arrastrar los dos campos: se migran los registros existentes y se acabó. |

---

## 5. Dónde va el muro

**Sin cuenta se puede:** ver la carrera en vivo, el listado de corredores, las
vueltas, la clasificación, las fotos, las reglas, la logística, los patrocinadores.
Todo lo que hoy es libre sigue siéndolo, y la entrada de espectador de la
[pantalla de acceso](frontend/src/live/screens/LoginScreen.jsx) no desaparece.

**Pide cuenta:** enviar un ánimo, seguir a un corredor con avisos, dar me gusta,
y que las preferencias sobrevivan al cambio de teléfono.

El razonamiento: el correo de quien quiere que le avisen cuando su hermano cierre la
vuelta 30 es un correo bueno. El de quien lo escribe para pasar de una pantalla que
le estorba, no. El muro en la puerta recoge más correos y peores.

**Nadie pierde lo que ya tenía:** al crear la cuenta, la app sube el `fan_name`, los
seguidos y los me gusta que hubiera en `localStorage` y los ata a la cuenta.

### Consentimiento

Levantar correos de espectadores obliga a:

- actualizar la [política de privacidad](frontend/src/pages/PrivacidadPage.jsx) con
  qué se guarda del espectador, para qué y cuánto tiempo;
- una casilla de comunicaciones **separada del alta y no premarcada**
  (`acepta_comunicaciones`); tener cuenta no es consentir que le escriban;
- una forma de borrar la cuenta desde la propia app.

El envío por correo y el push segmentado solo van a cuentas con
`acepta_comunicaciones: true` y `email_verified: true`.

---

## 6. Fases

### Fase 0 — Medir y respaldar — **HECHA (16/08/2026)**
*Sin código. Es lo que decide varias cosas de la Fase 3.*

**Resultados sobre producción** (solo lecturas, `scratchpad/fase0_conteos.py`):

| | |
|---|---|
| `athletes` | **246** (246 correos distintos), 13 sin verificar, 0 sin contraseña |
| `admin_users` | **19 documentos / 18 correos**, todos bcrypt, todos con contraseña |
| — de ellos voluntarios | 16 marcados `es_voluntario`, 18 sin ningún permiso |
| **Solape (misma persona, dos cuentas)** | **1** — `carroyo@riesgobancario.com` |
| `cheer_messages` | **1.625** ánimos, **696** nombres distintos, **0 correos recuperables** |
| `push_devices` | 21; 10 ligados a un corredor, 0 a staff, **11 sin cuenta** |

Dos lecturas de esos números:

- **La decisión 4 se resuelve sola.** Con **una sola persona** en el solape no hace
  falta el esquema de doble hash durante tres meses: se unifica a mano y se le avisa.
  El plan se simplifica y `password_hash_legacy` deja de necesitar plazo.
- **696 personas han animado y no hay forma de contactar con ninguna.** Ese es el
  tamaño exacto de lo que hoy se pierde, y la justificación de la Fase 2.

**Hallazgo no buscado: hay dos usuarios `admin` en producción.** Ver sección 10.

1. `mongodump` completo del Atlas.
2. Contar el solape: cuántos correos están a la vez en `athletes` y en `admin_users`.
   **Este número decide la política de contraseñas** (ver 6.3).
3. Contar `athletes` con `email_verified: false` y `admin_users` sin `password`.
4. Repasar el inventario de endpoints de 3.2 y confirmar que no falta ninguno
   (`grep -rn "require_admin\|verify_token" backend/routes/`).
5. Redactar el texto nuevo de privacidad.

**Salida:** los tres números y el texto legal. Sin ellos no se empieza la Fase 1.

---

### Fase 1 — Infraestructura de cuentas — **HECHA (16/08/2026)**
*Backend, invisible: nada del sitio cambia.*

Entregado: [`services/cuentas.py`](backend/services/cuentas.py) nuevo,
[`services/auth.py`](backend/services/auth.py) con los roles, y
[`tests/test_cuenta_unica.py`](backend/tests/test_cuenta_unica.py) con 24 tests en
verde. Comprobado además contra el backend local sobre las rutas reales: el panel
entra igual que siempre, y un token de corredor y uno de espectador reciben 403 en
las cinco rutas que solo pedían firma válida. Falta por hacer de esta fase: llamar a
`cuentas.asegurar_indices` en el arranque (va con la Fase 2, que es cuando se escribe
la primera cuenta).

Nuevo `backend/services/cuentas.py`:

- creación, búsqueda y verificación de cuentas contra `accounts`;
- verificador de contraseña que despacha por formato (`$2b$` → bcrypt;
  `salt:hex` → PBKDF2 heredado) y **rehashea a bcrypt al primer login correcto**,
  para que la conversión ocurra sola sin pedirle nada a nadie;
- emisión y validación del token nuevo (`ver: 2`).

En `backend/services/auth.py`:

- `require_admin` pasa a exigir `"staff" in roles` además de firma válida;
- se añade `require_athlete` (`"athlete" in roles`) y `require_cuenta` (cualquier rol);
- las tres aceptan **también** los tokens heredados de las dos firmas antiguas,
  traduciéndolos al payload nuevo. Sin app publicada, esto ya no es un puente de
  meses: solo cubre las sesiones web abiertas en el momento del despliegue, que
  caducan solas en 72 h (atleta) y 12 h (panel). Pasada esa semana se retira.

Tests (condición de salida):

- un token heredado de atleta sigue valiendo en `/api/athletes/*` y **falla** en las
  seis rutas de 3.2;
- un token nuevo con `roles: ["fan"]` falla en todo lo de staff y todo lo de atleta;
- un token nuevo con `roles: ["fan","staff"]` y `permissions: []` falla en cada
  endpoint con `require_permission` y pasa en `/api/staff/mi-perfil`;
- una contraseña PBKDF2 heredada valida y queda convertida a bcrypt.

---

### Fase 2 — Cuenta de espectador — **BACKEND HECHO (16/08/2026), FALTA LA WEB**
*El piloto en producción. Puramente aditivo: no toca nada existente.*

Decidido: **se anima nada más registrarse** y el código de verificación llega
detrás; solo las cuentas verificadas **y con consentimiento** entran en envíos. Se
piden **correo, nombre y consentimiento**, nada más; país y relación quedan como
opcionales editables después.

Entregado en [`routes/cuentas.py`](backend/routes/cuentas.py): alta, acceso,
verificación por código con límite de intentos, recuperación de contraseña, perfil,
importación de lo que traía el teléfono, borrado de la propia cuenta, y el listado
para el panel. Más el ánimo firmado en [`routes/race.py`](backend/routes/race.py), el
`account_id` y la audiencia `espectadores` en [`routes/push.py`](backend/routes/push.py),
y los índices en el arranque. Probado end to end contra el backend local.

**Falta:** la parte web (alta y acceso de espectador, el botón de ánimo pidiendo
cuenta, y la pestaña del panel).

Backend, router nuevo `/api/cuenta` (ojo: `/api/cuenta` ya lo usa
[users.py:25](backend/routes/users.py:25) para el cambio de contraseña del panel —
el router nuevo va en `/api/cuentas` o se reordena aquel):

- `POST /registro` — correo, nombre, contraseña, consentimiento. Crea `roles: ["fan"]`
  y devuelve sesión al momento. Manda el correo de verificación pero **no bloquea**:
  quien acaba de crear la cuenta puede animar ya.
- `POST /login`, `POST /verificar`, `POST /recuperar`, `POST /nueva-password`
- `GET|PUT /perfil`
- `POST /importar-local` — sube `followed`, `fan_name` y likes del teléfono.
- `DELETE /perfil` — borrado de cuenta.

Cambios en lo existente:

- `POST /api/race/cheer` acepta token opcional; con token guarda `account_id` y usa
  el nombre de la cuenta. Sin token sigue funcionando como hoy, que es lo que
  mantiene abierto el ánimo anónimo desde la web.
- `POST /api/push/register` pasa a aceptar `account_id`.

Web (la app se deja para la Fase 4, ver más abajo):

- alta y acceso de espectador;
- el botón de ánimo pide cuenta si no la hay, con el alta en la misma pantalla.

Panel: una pestaña con el listado de espectadores, cuántos hay, cuántos verificados,
cuántos con consentimiento — y esos correos disponibles como audiencia en el
compositor de correo y en el push dirigido de
[push.py:258](backend/routes/push.py:258).

**Se despliega y se deja correr** mientras se prepara la Fase 3. Es el rodaje del
sistema de cuentas antes de meterle los usuarios que ya existen.

---

### Fase 3 — Migrar corredores y staff
*La fase con riesgo. Solo cuando la 2 lleve tiempo estable.*

**Antes: `mongodump` nuevo.**

Script de migración (idempotente, ejecutable en seco):

1. Cada `athletes` → una `accounts` con `roles: ["fan","athlete"]`,
   `athlete_profile_id`, el `password_hash` PBKDF2 tal cual, `email_verified` y
   `nombre`/`apellidos` copiados. `athletes` gana `account_id`.
2. Cada `admin_users` → si el correo ya tiene cuenta, se le **añade** el rol `staff`
   con sus `permissions`; si no, cuenta nueva con `roles: ["fan","staff"]`.
3. `cheer_messages` y `push_devices` reciben `account_id` donde el correo case.

**6.3 — El solape de contraseñas — resuelto por la Fase 0.** El conteo dio **una sola
persona** en las dos colecciones (`carroyo@riesgobancario.com`). No hace falta el
esquema de doble hash con plazo de tres meses que se había previsto: se unifica esa
cuenta a mano, se le avisa, y listo.

Lo que sí se mantiene es la **conversión transparente de PBKDF2 a bcrypt**: los 246
corredores traen su hash heredado y `cuentas.autenticar` lo reescribe en bcrypt la
primera vez que cada uno entra con la contraseña correcta. Nadie recibe un correo
pidiéndole que cambie nada.

Endpoints antiguos: `/api/athletes/login` y `/api/race/auth/admin-login` siguen
respondiendo (los usa la web), pero pasan a leer contra `accounts` y a emitir el token
nuevo. La web: `adminApi.js` y las seis pantallas que leen `athlete_token` a mano pasan
al token único — buen momento para centralizar las llamadas de atleta, que hoy no lo
están.

Las sesiones web abiertas en ese momento se caen y hay que volver a entrar una vez:
conviene desplegar a una hora tranquila y avisar al equipo. La app compilada de
pruebas también deja de funcionar aquí, y no pasa nada — no está en manos de nadie y
se arregla recompilando en la Fase 4.

---

### Fase 4 — La app, construida una sola vez sobre el modelo final

Aquí está el ahorro grande de que la app no esté publicada: en vez de meterle cuentas
de espectador encima del modelo de dos tokens y reescribirla después, se toca **una
vez**, ya con el sistema definitivo.

- `sesion.js` pasa de dos tokens a uno (`bysd_token`) y de dos biometrías a una (hoy
  son dos entradas del llavero, `bysd-live-atleta` y `bysd-live-staff`).
- La [pantalla de acceso](frontend/src/live/screens/LoginScreen.jsx) deja de preguntar
  «¿cómo quieres entrar?». Pasa a ofrecer *entrar* o *ver la carrera sin cuenta*, y lo
  que hoy es elegir rol se convierte en el menú de después: quien tiene los dos roles
  ve las dos secciones.
- Alta y acceso de espectador dentro de la app, con la subida de `followed`,
  `fan_name` y likes del `localStorage` a la cuenta.
- Registro de push contra `account_id`.
- Compilar con `yarn build:mobile`. **Nunca `yarn build` + `cap copy`**: hornea la URL
  de `frontend/.env` y deja la app sin backend y sin más error visible que pantallas
  vacías.

Aquí es donde el voluntario que además corre deja de tener dos cuentas.

---

### Fase 5 — Limpieza

Ya no hay que esperar a que se renueve un parque de apps instaladas: en cuanto la
Fase 4 esté compilada y probada, esto se puede cerrar.

- Las dependencias dejan de aceptar tokens heredados. Basta una semana desde la
  Fase 3, cuando hayan caducado las sesiones web que quedaran abiertas.
- `ATHLETE_SECRET_KEY` desaparece de `auth.py`.
- `password_hash_legacy` se borra al vencer el plazo del solape (ver 6.3).
- `admin_users` se retira; los permisos viven solo en `accounts`.

**La primera versión de la app que se publique sale ya con la cuenta única.** Nadie
va a tener nunca instalada una app con el modelo viejo, que es justo el problema que
este proyecto tendría si se hiciera dentro de seis meses.

---

## 7. Decisiones que necesito de ti

1. **Verificación del espectador.** Mi propuesta: puede animar nada más registrarse y
   la verificación llega por correo después; solo las cuentas verificadas entran en
   envíos. ¿O prefieres exigir el código antes de dejar animar?

2. **Qué se le pregunta al espectador.** Yo pediría correo, nombre y consentimiento, y
   dejaría país y «relación con la carrera» como opcionales de un toque. Cada campo de
   más cuesta altas.

3. **Los ánimos anónimos que ya existen.** Se quedan con su `fan_name` y sin cuenta.
   ¿De acuerdo, o quieres intentar atarlos por nombre? (Yo no: el nombre no identifica
   y el falso positivo es peor que el hueco.)

4. **El solape de contraseñas** — depende del número de la Fase 0, pero dime si te
   parece bien la vía de «aceptar las dos durante tres meses» frente a avisar a mano.

5. **La puerta de septiembre.** ¿Te vale el criterio de la sección 8 para decidir si
   la migración de corredores y staff entra antes del Mundial o espera? Es la única
   decisión del plan que hay que tomar con datos que aún no tenemos.

---

## 8. Calendario propuesto

Hoy es 16 de agosto de 2026; el Mundial es en octubre. Con la app sin publicar, todo
el proyecto cabe antes de la carrera — pero con una puerta de decisión en medio.

| | Cuándo | Por qué ahí |
|---|---|---|
| Fase 0 | ya | medio día, sin riesgo |
| Fase 1 | ya | invisible: no cambia nada de lo que se ve |
| Fase 2 | en producción antes de septiembre | quieres los correos de espectadores **del Mundial**, que es cuando más público habrá |
| **Puerta** | primeros de septiembre | ver abajo |
| Fase 3 | primera quincena de septiembre, si la puerta se pasa | deja 4-6 semanas de margen antes de la carrera |
| Fase 4 | mientras la 3 asienta | la app no bloquea nada: no está publicada |
| Fase 5 | una semana después de la 4 | ya no espera a ningún parque de apps |

### La puerta de septiembre

La Fase 3 es la única que toca contraseñas de gente real, y las inscripciones del
Mundial están vivas justo ahora. Se pasa a la Fase 3 **solo si** se cumple todo:

- la Fase 2 lleva **dos semanas limpias** en producción, con altas reales;
- el script de migración se ha corrido en seco sobre una copia restaurada del dump y
  cuadra el número de cuentas;
- los tests de roles de la Fase 1 pasan en verde;
- faltan **más de cuatro semanas** para la carrera.

Si alguna falla, la Fase 3 espera a después del Mundial y no pasa nada: la Fase 2 ya
está entregando lo que más valor tenía este año. Esa condición de «más de cuatro
semanas» es la que no se negocia sobre la marcha.

---

## 9. Riesgos y vuelta atrás

| Riesgo | Cobertura |
|---|---|
| Un token de atleta abre el panel | El role check de la Fase 1 y su test, antes de tocar nada más |
| Alguien se queda sin poder entrar tras la migración | Doble hash durante tres meses; `mongodump` previo; script idempotente y en seco primero |
| Se caen las sesiones web al desplegar la Fase 3 | Se acepta: es volver a entrar una vez. Desplegar a hora tranquila y avisar al equipo |
| La app de pruebas deja de funcionar entre la Fase 3 y la 4 | No está publicada; se arregla recompilando. No es un riesgo, es una consecuencia |
| Correos de espectador mal recogidos legalmente | Privacidad y consentimiento cerrados en la Fase 0, antes de la primera alta |
| La Fase 3 sale mal | `accounts` es una colección nueva: `athletes` y `admin_users` siguen intactas. La vuelta atrás es desplegar el backend anterior |

La última fila es el motivo de no mover los perfiles a `accounts`: mientras las
colecciones viejas sigan enteras, deshacer es un despliegue, no una restauración.

---

## 10. Hallazgo aparte: hay dos usuarios `admin` en producción

Salió midiendo la Fase 0, no se buscaba. **No es parte de este plan pero lo bloquea**,
porque `accounts.email` va con índice único y la migración fallaría ahí.

En `admin_users` hay **dos documentos con `username: "admin"`**, creados con 132 ms de
diferencia el 17/01/2026 y con **hashes bcrypt distintos**. La causa está en
[server.py:149](backend/server.py:149): el arranque hace `find_one` y después
`insert_one`, sin nada que lo haga atómico. Dos workers arrancaron a la vez, los dos
vieron que no existía y los dos lo crearon; como `ADMIN_INITIAL_PASSWORD` no estaba
definida, cada uno generó una contraseña aleatoria distinta.

La misma base local de pruebas tiene también dos: no fue mala suerte de un día.

**Qué pasa hoy:** el login hace `find_one({"username": "admin"})` y Mongo devuelve el
que encuentra primero. Solo una de las dos contraseñas funciona. No es explotable
—para entrar hay que saber la contraseña igual—, pero es frágil: si los documentos se
reordenan (una restauración, una compactación), el acceso de administrador podría
dejar de funcionar sin que nadie haya tocado nada.

**Resuelto el 16/08/2026.** En dos partes:

1. *El código.* El arranque usa ahora `update_one` con `upsert=True` y `$setOnInsert`,
   una sola operación atómica: arranquen los workers que arranquen, el documento se
   crea una vez. Y crea el índice único en `admin_users.username`.
2. *El dato.* Borrado el documento sobrante en producción, con respaldo previo
   (`respaldo-20260816-pre-cuenta-unica.gz`, 14 MB) y los dos documentos guardados
   aparte en `admin-duplicado-20260816.json`, ambos en `bysd-secretos`.

**Cómo se decidió cuál borrar, sin necesitar la contraseña de nadie.** El login hace
`find_one({"username": "admin"})` y el cambio de contraseña hace `update_one` con el
mismo filtro: los dos caen sobre el primer documento en orden natural. Comprobado diez
veces seguidas, ese primero era siempre `696b363c923cd838fed14baa`. Luego la
contraseña que funciona hoy es, por definición, la de ese documento — y borrar el otro
no puede cambiar el acceso actual, solo quita el riesgo de que Mongo devolviera algún
día el huérfano. Ninguno de los dos tenía `updated_at`, así que la contraseña nunca se
había cambiado desde el panel y ambos conservaban su hash de aquel arranque.

Quedan 18 usuarios (eran 19), un solo `admin`, e índice único activo.
