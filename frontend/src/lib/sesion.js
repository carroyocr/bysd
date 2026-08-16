/**
 * La sesión del sitio web: una sola.
 *
 * Hasta la cuenta única el navegador guardaba tres llaves distintas —
 * `admin_token` para el panel, `athlete_token` para el corredor y
 * `bysd_cuenta_token` para el espectador— porque detrás había tres sistemas de
 * identidad separados. Ahora hay una cuenta con roles, así que hay un token, y
 * el backend decide qué abre según lo que lleve dentro.
 *
 * (La app móvil sigue con sus dos llaves en `src/live/sesion.js`. Se unifica en
 * la fase 4, cuando se recompile sobre el modelo final.)
 *
 * Ver PLAN_CUENTA_UNICA.md.
 */

export const TOKEN = 'bysd_token';

// Lo que guardaban las versiones anteriores. Se adoptan para que nadie se
// encuentre la sesión cerrada de golpe el día del despliegue: el backend sigue
// aceptando esos tokens hasta que caducan solos.
const HEREDADAS = ['admin_token', 'athlete_token', 'bysd_cuenta_token'];

// Datos sueltos del panel que acompañan al token.
const EXTRAS_PANEL = ['admin_username', 'admin_is_admin', 'admin_permissions'];

function adoptarHeredada() {
  const encontradas = HEREDADAS
    .map((k) => [k, localStorage.getItem(k)])
    .filter(([, v]) => v);

  if (!encontradas.length) return null;

  // Con dos sesiones abiertas a la vez —el caso de quien corre y además es del
  // equipo, que hasta ahora tenía dos cuentas— no se puede elegir por él: cada
  // token abre cosas distintas y quedarse con el que no toca daría errores
  // raros en vez de una pantalla de acceso. Se limpian las dos y entra una vez.
  // Después de la migración esto deja de ocurrir: una persona, una cuenta.
  if (encontradas.length > 1) {
    HEREDADAS.forEach((k) => localStorage.removeItem(k));
    return null;
  }

  const [, valor] = encontradas[0];
  localStorage.setItem(TOKEN, valor);
  HEREDADAS.forEach((k) => localStorage.removeItem(k));
  return valor;
}

/** El token de la sesión abierta, o null. */
export function token() {
  return localStorage.getItem(TOKEN) || adoptarHeredada();
}

export function haySesion() {
  return !!token();
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
  return datos.token;
}

export function cerrarSesion() {
  [TOKEN, ...HEREDADAS, ...EXTRAS_PANEL].forEach((k) => localStorage.removeItem(k));
}

/** Cabeceras con el token adjunto, conservando las que ya traiga la llamada. */
export function authHeaders(extra = {}) {
  const t = token();
  return t ? { ...extra, Authorization: `Bearer ${t}` } : { ...extra };
}

/** `fetch` con el token adjunto. */
export function sesionFetch(url, options = {}) {
  return fetch(url, { ...options, headers: authHeaders(options.headers || {}) });
}
