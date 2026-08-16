/**
 * Cuenta única: la sesión de quien sigue la carrera.
 *
 * Es la tercera clave de sesión que convive en el navegador, junto a
 * `admin_token` (panel) y `athlete_token` (corredor). Las tres se unifican en
 * la fase 3 del plan; hasta entonces esta vive aparte y no toca a las otras.
 *
 * Ver PLAN_CUENTA_UNICA.md.
 */

const API = process.env.REACT_APP_BACKEND_URL;

export const TOKEN_CUENTA = 'bysd_cuenta_token';
const CUENTA_CACHE = 'bysd_cuenta';

// Lo que el navegador guardaba de quien animaba antes de que hubiera cuentas.
// Al darse de alta se sube y deja de perderse al cambiar de aparato.
export const FAN_NAME_KEY = 'bysd_live_fan_name';
export const FOLLOWED_KEY = 'backyard_ultra_followed_athletes';

export function tokenCuenta() {
  return localStorage.getItem(TOKEN_CUENTA);
}

export function hayCuenta() {
  return !!tokenCuenta();
}

/** La cuenta que se guardó al entrar, para pintar el nombre sin ir al servidor. */
export function cuentaGuardada() {
  try {
    return JSON.parse(localStorage.getItem(CUENTA_CACHE)) || null;
  } catch {
    return null;
  }
}

function guardarSesion({ token, cuenta }) {
  localStorage.setItem(TOKEN_CUENTA, token);
  localStorage.setItem(CUENTA_CACHE, JSON.stringify(cuenta));
  return cuenta;
}

export function cerrarSesionCuenta() {
  localStorage.removeItem(TOKEN_CUENTA);
  localStorage.removeItem(CUENTA_CACHE);
}

/** `fetch` con el token de la cuenta adjunto, si lo hay. */
export function cuentaFetch(url, options = {}) {
  const token = tokenCuenta();
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(url, { ...options, headers });
}

async function pedir(ruta, cuerpo) {
  const r = await fetch(`${API}/api/cuentas${ruta}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(datos.detail || 'No se pudo completar la operación');
  return datos;
}

/**
 * Sube a la cuenta lo que este navegador llevaba guardado por su cuenta.
 *
 * Se llama al entrar y al registrarse. Si falla no se le cuenta a nadie: es una
 * cortesía, no parte del alta, y volver a intentarlo en el siguiente acceso no
 * cuesta nada porque el servidor une sin repetir.
 */
async function importarLoLocal() {
  try {
    const followed = JSON.parse(localStorage.getItem(FOLLOWED_KEY) || '[]');
    const fanName = localStorage.getItem(FAN_NAME_KEY) || null;
    if (!followed.length && !fanName) return;

    await cuentaFetch(`${API}/api/cuentas/importar-local`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ followed, fan_name: fanName }),
    });
  } catch {
    /* sin ruido */
  }
}

export async function registrarse({ email, nombre, password, aceptaComunicaciones }) {
  const datos = await pedir('/registro', {
    email,
    nombre,
    password,
    acepta_comunicaciones: !!aceptaComunicaciones,
  });
  const cuenta = guardarSesion(datos);
  await importarLoLocal();
  return cuenta;
}

export async function entrar({ email, password }) {
  const datos = await pedir('/login', { email, password });
  const cuenta = guardarSesion(datos);
  await importarLoLocal();
  return cuenta;
}

export async function verificar({ email, code }) {
  return guardarSesion(await pedir('/verificar', { email, code }));
}

export async function reenviarCodigo(email) {
  return pedir('/reenviar-codigo', { email });
}

export async function pedirCodigoRecuperacion(email) {
  return pedir('/recuperar', { email });
}

export async function definirNuevaPassword({ email, code, password }) {
  return guardarSesion(await pedir('/nueva-password', { email, code, password }));
}
