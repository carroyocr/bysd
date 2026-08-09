// Helpers de datos y formato para BYSD Live.
export const API = process.env.REACT_APP_BACKEND_URL;

export const FOLLOWED_KEY = 'backyard_ultra_followed_athletes';
export const FAN_NAME_KEY = 'bysd_live_fan_name';
export const SOS_CONTACT_KEY = 'bysd_live_sos_contact';
export const NOTIF_KEY = 'bysd_live_notifications';

export async function getJson(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function postJson(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

/**
 * Ficha pública de un corredor. En carreras históricas la ficha completa
 * puede no existir (sus resultados viven en la colección legada), así que
 * se cae a los datos básicos del listado de participantes.
 */
export async function getAthleteProfile(bib, raceCode) {
  try {
    return await getJson(`/api/athletes/public-profile/${bib}?race_code=${raceCode}`);
  } catch {
    const list = await getJson(`/api/race/participants?race_code=${raceCode}`);
    const p = (list || []).find((x) => x.bib === bib);
    if (!p) throw new Error('Atleta no encontrado');
    return p;
  }
}

/** true si la carrera ya ocurrió (no activa y con fecha pasada). */
export function raceIsPast(race) {
  if (!race) return false;
  if (race.is_active) return false;
  if (race.archived_at) return true;
  const today = new Date().toISOString().slice(0, 10);
  return !!race.date && race.date < today;
}

/** Llamada con token (perfil del atleta o panel de staff) y cuerpo opcional. */
export async function authJson(method, path, { token, body } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    return { ok: false, status: 0, data: {} };
  }
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

// ISO3 -> ISO2 para banderas; si no está en el mapa se muestra solo el texto
const ISO3_TO_ISO2 = {
  DOM: 'DO', CRC: 'CR', PAN: 'PA', MEX: 'MX', USA: 'US', PUR: 'PR', COL: 'CO',
  VEN: 'VE', ESP: 'ES', FRA: 'FR', ARG: 'AR', CHI: 'CL', CHL: 'CL', PER: 'PE',
  BRA: 'BR', ECU: 'EC', GUA: 'GT', GTM: 'GT', HON: 'HN', HND: 'HN', NCA: 'NI',
  NIC: 'NI', ESA: 'SV', SLV: 'SV', CUB: 'CU', HAI: 'HT', HTI: 'HT', JAM: 'JM',
  CAN: 'CA', GER: 'DE', DEU: 'DE', ITA: 'IT', POR: 'PT', PRT: 'PT', GBR: 'GB',
  URU: 'UY', URY: 'UY', PAR: 'PY', PRY: 'PY', BOL: 'BO',
};

export function flagOf(nacionalidad) {
  if (!nacionalidad) return '';
  const iso2 = ISO3_TO_ISO2[String(nacionalidad).trim().toUpperCase()];
  if (!iso2) return '';
  return String.fromCodePoint(...[...iso2].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export function initialsOf(nombre, apellidos) {
  const a = (nombre || '').trim().charAt(0);
  const b = (apellidos || '').trim().charAt(0);
  return `${a}${b}`.toUpperCase() || '?';
}

export function formatDuration(seconds) {
  if (seconds == null) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatPace(secondsPerKm) {
  if (secondsPerKm == null) return '—';
  const m = Math.floor(secondsPerKm / 60);
  const s = secondsPerKm % 60;
  return `${m}:${String(s).padStart(2, '0')} /km`;
}

export function formatElapsed(ms) {
  if (ms == null || ms < 0) return null;
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function useFollowed() {
  // Hook sencillo compartido entre pantallas (misma clave que LiveDashboard)
  const read = () => {
    try {
      return JSON.parse(localStorage.getItem(FOLLOWED_KEY)) || [];
    } catch {
      return [];
    }
  };
  return {
    read,
    toggle(bib) {
      const list = read();
      const next = list.includes(bib) ? list.filter((b) => b !== bib) : [...list, bib];
      localStorage.setItem(FOLLOWED_KEY, JSON.stringify(next));
      // El backend guarda a quién sigue cada teléfono para saber a quién
      // mandarle el push. La importación es dinámica porque push.js importa
      // de este módulo: estática serían dos módulos esperándose al arrancar.
      import('./push').then((m) => m.sincronizarSeguidos()).catch(() => {});
      return next;
    },
  };
}

export function statusLabel(status) {
  switch (status) {
    case 'registered': return 'Inscrito';
    case 'active': return 'En carrera';
    case 'retired': return 'DNF';
    case 'dns': return 'DNS';
    case 'winner': return 'Ganador';
    case 'honor': return 'Mención de honor';
    case 'waitlist': return 'En lista de espera';
    default: return status || '';
  }
}

// ---- Inicio de carrera y cuenta regresiva ----

// Momento de salida en hora de RD (GMT-4); null si la carrera no tiene fecha
export function raceStartMs(race) {
  if (!race?.date || !race?.start_time) return null;
  const t = new Date(`${race.date}T${race.start_time}:00-04:00`).getTime();
  return Number.isNaN(t) ? null : t;
}

export function formatCountdown(ms) {
  if (ms == null || ms <= 0) return null;
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${Math.max(m, 1)}m`;
}
