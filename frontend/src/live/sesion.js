// La sesión dentro de la app: una sola.
//
// El backend firma el token para 72 horas, que es lo razonable para la web: se
// entra desde un ordenador propio y molestar cada rato sobra. En el teléfono el
// riesgo es otro —se presta, se pierde, se deja en la mesa— así que la app es
// más estricta que el token:
//
//   - Con biometría activada se pide la cara o la huella en CADA entrada a la
//     zona con cuenta. La sesión puede seguir viva; lo que se protege es el
//     acceso.
//   - Sin biometría, a las 3 horas hay que volver a escribir la contraseña.
//
// Esto se decide en el teléfono, no en el servidor: el token sigue siendo
// válido hasta sus 72 horas. Es un cerrojo contra quien coge el aparato, no
// contra quien se lleve el token; para eso está la biometría, que sí guarda la
// credencial en el llavero del sistema.
//
// Antes había dos tokens —`athlete_token` y `admin_token`— y la app llegó a
// mantener las dos sesiones abiertas a la vez, con biometría por separado,
// porque detrás había dos cuentas para una misma persona. Con la cuenta única
// hay un token con roles dentro, y el backend decide qué abre.
import { biometriaActiva, desactivarBiometria, limpiarBiometriaHeredada } from './biometria';

export const TOKEN = 'bysd_token';

// Lo que guardaban las versiones anteriores de la app.
const HEREDADAS = ['athlete_token', 'admin_token'];
const EXTRAS_STAFF = ['admin_username', 'admin_is_admin', 'admin_permissions'];

const DESDE = 'bysd_live_acceso_desde';
const HORAS_SIN_BIOMETRIA = 3;

const ahora = () => Date.now();

/**
 * Adopta la sesión que hubiera de una versión anterior.
 *
 * Con las dos abiertas a la vez no se puede elegir por la persona: cada token
 * abre cosas distintas y quedarse con el que no toca daría errores raros en vez
 * de una pantalla de acceso. Se limpian y entra una vez; con la cuenta
 * unificada esto no vuelve a pasar.
 */
function adoptarHeredada() {
  const encontradas = HEREDADAS.map((k) => localStorage.getItem(k)).filter(Boolean);
  HEREDADAS.forEach((k) => localStorage.removeItem(k));

  if (encontradas.length !== 1) {
    EXTRAS_STAFF.forEach((k) => localStorage.removeItem(k));
    return null;
  }
  localStorage.setItem(TOKEN, encontradas[0]);
  return encontradas[0];
}

export function token() {
  return localStorage.getItem(TOKEN) || adoptarHeredada();
}

export const haySesion = () => !!token();

/** Lo que lleva el token dentro, sin comprobar la firma: eso es del backend. */
function contenido() {
  const t = token();
  if (!t) return null;
  try {
    return JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

/**
 * Qué roles trae la sesión. Es lo que decide qué enseña el menú.
 *
 * Se traducen también los tokens de las versiones anteriores, que no llevaban
 * `roles`: el del corredor traía `type: "athlete"` y el del panel, `username`.
 */
export function roles() {
  const p = contenido();
  if (!p) return [];
  if (Array.isArray(p.roles)) return p.roles;
  if (p.type === 'athlete') return ['fan', 'athlete'];
  if (p.username) return ['fan', 'staff'];
  return ['fan'];
}

/** El id de la cuenta, que es lo que ata este teléfono a su dueño. */
export function cuentaId() {
  return contenido()?.sub || null;
}

export const esCorredor = () => roles().includes('athlete');
export const esStaff = () => roles().includes('staff');

/** Para el menú: qué zonas con cuenta puede abrir quien entró. */
export function zonasAbiertas() {
  return { atleta: esCorredor(), staff: esStaff() };
}

/** Guarda la sesión que devuelve cualquiera de los endpoints de acceso. */
export function guardarSesion(datos) {
  if (!datos?.token) return null;
  localStorage.setItem(TOKEN, datos.token);
  if (datos.username !== undefined) localStorage.setItem('admin_username', datos.username);
  if (datos.is_admin !== undefined) localStorage.setItem('admin_is_admin', String(datos.is_admin));
  if (datos.permissions !== undefined) {
    localStorage.setItem('admin_permissions', JSON.stringify(datos.permissions));
  }
  marcarAcceso();
  return datos.token;
}

/** Marca el momento en que se validó la identidad. */
export function marcarAcceso() {
  localStorage.setItem(DESDE, String(ahora()));
}

/**
 * true si hay que volver a pedir la contraseña por tiempo.
 * Con biometría no aplica: ahí se pide la cara en cada entrada.
 */
export function accesoCaducado() {
  if (!token()) return false;
  if (biometriaActiva()) return false;
  const desde = Number(localStorage.getItem(DESDE) || 0);
  if (!desde) return true;   // sesión de una versión anterior: que se identifique
  return ahora() - desde > HORAS_SIN_BIOMETRIA * 3600 * 1000;
}

/**
 * Cierra la sesión y apaga la biometría.
 *
 * Lo segundo no es un extra: el token del llavero es esa misma sesión, y
 * dejarlo haría que cerrar sesión no cerrara nada —bastaría la cara para
 * volver a entrar—.
 */
export async function cerrarSesion() {
  [TOKEN, ...HEREDADAS, ...EXTRAS_STAFF, DESDE].forEach((k) => localStorage.removeItem(k));
  await desactivarBiometria();
}

export function permisosStaff() {
  try {
    return JSON.parse(localStorage.getItem('admin_permissions')) || [];
  } catch {
    return [];
  }
}

/**
 * Con qué papel entró la persona: corredor, staff o espectador.
 *
 * No es una sesión ni da permisos —eso son los roles del token—: es solo el
 * camino que eligió en la primera pantalla, para saber a dónde llevarla cuando
 * ya haya escogido carrera.
 */
const ROL_KEY = 'bysd_live_rol';
export const ESPECTADOR = 'espectador';

export function guardarRol(rol) {
  try { localStorage.setItem(ROL_KEY, rol); } catch { /* modo privado */ }
}

export function rolElegido() {
  try { return localStorage.getItem(ROL_KEY) || ESPECTADOR; } catch { return ESPECTADOR; }
}

/**
 * A dónde va la app al abrirse, pasada la bienvenida.
 *
 * Con sesión abierta se entra directo al inicio, igual que el espectador:
 * preguntar "¿cómo quieres entrar?" a quien ya entró es un paso de más en cada
 * arranque, y quien abre la app viene a ver la carrera, no su perfil. El
 * perfil queda a un toque en el menú lateral.
 */
export function rutaDeEntrada() {
  return haySesion() ? '/live/carreras' : '/live/login';
}

/** Se llama una vez al arrancar la app. */
export async function migrarSesionHeredada() {
  token();                          // adopta o limpia lo viejo
  await limpiarBiometriaHeredada(); // el llavero de cuando había dos accesos
}

export const HORAS_SESION = HORAS_SIN_BIOMETRIA;
