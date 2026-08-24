/**
 * Alta y acceso de quien sigue la carrera.
 *
 * La sesión ya no es suya: vive en `lib/sesion.js`, que es la única del sitio.
 * Aquí solo quedan las llamadas y el nombre de la cuenta que se guarda al lado
 * para poder pintarlo sin ir al servidor.
 *
 * Ver PLAN_CUENTA_UNICA.md.
 */
import { cerrarSesion, guardarSesion as guardarToken, token } from './sesion';

const API = process.env.REACT_APP_BACKEND_URL;

const CUENTA_CACHE = 'bysd_cuenta';

// Lo que el navegador guardaba de quien animaba antes de que hubiera cuentas.
// Al darse de alta se sube y deja de perderse al cambiar de aparato.
export const FAN_NAME_KEY = 'bysd_live_fan_name';
export const FOLLOWED_KEY = 'backyard_ultra_followed_athletes';

export function tokenCuenta() {
  return token();
}

export function hayCuenta() {
  return !!token();
}

/** La cuenta que se guardó al entrar, para pintar el nombre sin ir al servidor. */
export function cuentaGuardada() {
  try {
    return JSON.parse(localStorage.getItem(CUENTA_CACHE)) || null;
  } catch {
    return null;
  }
}

function guardarSesion(datos) {
  guardarToken(datos);
  localStorage.setItem(CUENTA_CACHE, JSON.stringify(datos.cuenta));
  return datos.cuenta;
}

export function cerrarSesionCuenta() {
  cerrarSesion();
  localStorage.removeItem(CUENTA_CACHE);
}

/** `fetch` con el token adjunto, si lo hay. */
export function cuentaFetch(url, options = {}) {
  const t = token();
  const headers = { ...(options.headers || {}) };
  if (t) headers.Authorization = `Bearer ${t}`;
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
