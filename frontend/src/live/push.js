// Notificaciones push de BYSD Live (solo en la app instalada, no en el web).
//
// El aviso de vueltas que ya existía funciona con la Notification API del
// navegador y solo mientras la app está abierta. Esto es lo otro: el backend
// manda el aviso a través de Firebase y llega con la app cerrada.
//
// El token identifica a la instalación, no a la persona: no se pide cuenta ni
// correo. Junto al token se envía la lista de dorsales seguidos, que es lo
// único que el backend necesita para saber a quién avisar.
import { Capacitor } from '@capacitor/core';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { API, FOLLOWED_KEY, NOTIF_KEY } from './liveApi';

const TOKEN_KEY = 'bysd_live_push_token';
const RACE_KEY = 'bysd_live_push_race';

let listenersPuestos = false;

/** true solo dentro de la app instalada: en el navegador no hay push nativo. */
export function pushDisponible() {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('FirebaseMessaging');
}

function leerSeguidos() {
  try {
    return JSON.parse(localStorage.getItem(FOLLOWED_KEY)) || [];
  } catch {
    return [];
  }
}

async function registrarEnBackend(token, raceCode, staffEmail, atletaEmail) {
  const cuerpo = {
    token,
    platform: Capacitor.getPlatform(),
    race_code: raceCode || localStorage.getItem(RACE_KEY) || null,
    followed: leerSeguidos(),
  };
  // Solo se manda cuando se registra desde el acceso de staff: si fuera
  // siempre, entrar como corredor borraría el vínculo con el voluntario y se
  // perderían los avisos de turno.
  if (staffEmail) cuerpo.staff_email = staffEmail;
  if (atletaEmail) cuerpo.athlete_email = atletaEmail;

  const res = await fetch(`${API}/api/push/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * Liga este teléfono a la cuenta del corredor que acaba de entrar, para que
 * pueda recibir los avisos dirigidos a los inscritos. Silenciosa: si no hay
 * permiso de notificaciones no se insiste, solo se queda sin ese canal.
 */
export async function registrarAtleta(email) {
  if (!pushDisponible() || !email) return;
  try {
    const permiso = await FirebaseMessaging.checkPermissions();
    if (permiso.receive !== 'granted') return;
    const { token } = await FirebaseMessaging.getToken();
    if (!token) return;
    await registrarEnBackend(token, null, undefined, email);
    localStorage.setItem(TOKEN_KEY, token);
    await ponerListeners();
  } catch {
    /* sigue recibiendo los avisos de sus favoritos */
  }
}

/**
 * Liga este teléfono al voluntario que acaba de entrar como staff, para que le
 * llegue el aviso 30 minutos antes de su turno. Pide permiso si hace falta.
 */
export async function registrarStaff(email) {
  if (!pushDisponible() || !email) return;
  try {
    const permiso = await FirebaseMessaging.requestPermissions();
    if (permiso.receive !== 'granted') return;
    const { token } = await FirebaseMessaging.getToken();
    if (!token) return;
    await registrarEnBackend(token, null, email);
    localStorage.setItem(TOKEN_KEY, token);
    await ponerListeners();
  } catch {
    /* sin avisos de turno; el correo de la hora previa sigue saliendo */
  }
}

/**
 * Firebase rota el token por su cuenta (reinstalación, restauración de copia
 * de seguridad, limpieza de datos). Sin esto, el dispositivo dejaría de
 * recibir avisos en silencio.
 */
async function ponerListeners() {
  if (listenersPuestos) return;
  listenersPuestos = true;
  await FirebaseMessaging.addListener('tokenReceived', async ({ token }) => {
    if (!token || localStorage.getItem(NOTIF_KEY) !== 'on') return;
    try {
      await registrarEnBackend(token);
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* se reintenta en el próximo arranque */
    }
  });
}

/**
 * Pide permiso y registra el dispositivo.
 * Devuelve { ok, motivo } — `motivo` explica por qué no se pudo, para poder
 * mostrarlo en Configuración.
 */
export async function activarPush(raceCode) {
  if (!pushDisponible()) return { ok: false, motivo: 'no-nativo' };

  try {
    const permiso = await FirebaseMessaging.requestPermissions();
    if (permiso.receive !== 'granted') return { ok: false, motivo: 'denegado' };

    const { token } = await FirebaseMessaging.getToken();
    if (!token) return { ok: false, motivo: 'sin-token' };

    if (raceCode) localStorage.setItem(RACE_KEY, raceCode);
    await registrarEnBackend(token, raceCode);
    localStorage.setItem(TOKEN_KEY, token);
    await ponerListeners();
    return { ok: true };
  } catch (e) {
    return { ok: false, motivo: 'error' };
  }
}

/** Baja del dispositivo: deja de recibir avisos y se borra del backend. */
export async function desactivarPush() {
  const token = localStorage.getItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
  if (!token) return;
  try {
    await fetch(`${API}/api/push/unregister`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
  } catch {
    /* el backend lo limpiará solo cuando Firebase rechace el token */
  }
  try {
    await FirebaseMessaging.deleteToken();
  } catch {
    /* daba igual: sin registro en el backend ya no llegan avisos */
  }
}

/**
 * Reenvía la lista de seguidos cuando el usuario añade o quita un favorito.
 * Silenciosa a propósito: es mantenimiento, no una acción del usuario.
 */
export async function sincronizarSeguidos(raceCode) {
  if (!pushDisponible()) return;
  if (localStorage.getItem(NOTIF_KEY) !== 'on') return;
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return;
  try {
    await registrarEnBackend(token, raceCode);
  } catch {
    /* se corrige en la próxima sincronización */
  }
}

/**
 * Al abrir la app: si las notificaciones están activadas, refresca el registro
 * (la carrera activa puede haber cambiado y el token puede haber rotado
 * mientras la app estaba cerrada).
 */
export async function refrescarPush(raceCode) {
  if (!pushDisponible()) return;

  const preferencia = localStorage.getItem(NOTIF_KEY);
  // Apagadas a mano: no se vuelven a encender solas.
  if (preferencia === 'off') return;
  // Sin preferencia guardada es la primera vez: en la app vienen activadas,
  // que es lo que espera quien se instala una app de seguimiento en vivo. Aquí
  // sale el permiso del sistema; si lo deniega, queda apagado hasta que lo
  // active en Configuración.
  if (!preferencia) {
    const { ok } = await activarPush(raceCode);
    if (ok) localStorage.setItem(NOTIF_KEY, 'on');
    return;
  }

  try {
    const permiso = await FirebaseMessaging.checkPermissions();
    if (permiso.receive !== 'granted') return;
    const { token } = await FirebaseMessaging.getToken();
    if (!token) return;
    if (raceCode) localStorage.setItem(RACE_KEY, raceCode);
    await registrarEnBackend(token, raceCode);
    localStorage.setItem(TOKEN_KEY, token);
    await ponerListeners();
  } catch {
    /* sin conexión al abrir: se reintenta en el próximo arranque */
  }
}
