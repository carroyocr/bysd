/**
 * Escaneo fuera de línea: el arco no puede depender de la señal.
 *
 * El teléfono descarga antes la ficha de la carrera y su lista de corredores,
 * y con eso puede hacer solo lo mismo que hace el backend en cada escaneo:
 * saber quién es el dorsal, en qué vuelta va la carrera (el reloj se calcula
 * aquí con la misma regla que `services/races.py`) y si la vuelta vale. Cada
 * confirmación se guarda en el teléfono con su hora, y al volver la señal se
 * manda todo junto a `/api/qr-scan/sync-offline`, que la evalúa con el reloj
 * de la carrera A ESA HORA.
 *
 * Los conflictos (el servidor iba por otra vuelta, un dorsal desconocido) no
 * se pierden: quedan marcados en la cola para resolverlos por el panel.
 */
import { adminToken, scanHeaders } from './adminApi';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const PACK_KEY = 'bysd_scan_offline_pack';
const QUEUE_KEY = 'bysd_scan_offline_queue';
const MODO_KEY = 'bysd_scan_offline_modo';
const FICHAS_PREFIX = 'bysd_fichas_offline:';

const leer = (clave, porDefecto) => {
  try {
    return JSON.parse(localStorage.getItem(clave)) ?? porDefecto;
  } catch {
    return porDefecto;
  }
};
const escribir = (clave, valor) => {
  try { localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* lleno */ }
};

// ---------------- Modo ----------------

export const modoActivo = () => localStorage.getItem(MODO_KEY) === 'on';
export const activarModo = (on) => localStorage.setItem(MODO_KEY, on ? 'on' : 'off');

// ---------------- Datos descargados ----------------

export const pack = () => leer(PACK_KEY, null);

/** Descarga la ficha de la carrera y sus corredores. Necesita señal. */
export async function descargarPack(raceCode) {
  const carrera = await fetch(
    `${API_URL}/api/race-config/${raceCode || 'active'}`
  ).then((r) => { if (!r.ok) throw new Error('carrera'); return r.json(); });

  const participantes = await fetch(
    `${API_URL}/api/race/participants?race_code=${carrera.code}`
  ).then((r) => { if (!r.ok) throw new Error('corredores'); return r.json(); });

  const datos = {
    race: {
      code: carrera.code,
      name: carrera.name,
      date: carrera.date,
      start_time: carrera.start_time,
      timezone_gmt: carrera.timezone_gmt,
      started_at: carrera.started_at || null,
      finished_at: carrera.finished_at || null,
      minutos_por_vuelta: carrera.minutos_por_vuelta || 60,
      km_por_vuelta: carrera.km_por_vuelta || 6.7,
    },
    participants: (participantes || []).map((p) => ({
      bib: String(p.bib ?? ''),
      nombre: p.nombre,
      apellidos: p.apellidos,
      status: p.status,
      laps_completed: p.laps_completed || 0,
    })).filter((p) => p.bib),
    descargado_en: new Date().toISOString(),
  };
  escribir(PACK_KEY, datos);

  // Quien entró al panel se lleva también las fichas de emergencia: la
  // descarga es una sola y deja el teléfono listo para escanear Y para
  // atender. Si no hay token (entró solo con la clave de escaneo), no pasa
  // nada: el backend no las daría igual.
  await descargarFichas();

  return datos;
}

// ---------------- Fichas de emergencia ----------------
//
// La ficha médica es la información que más falta hace justo cuando no hay
// señal: alguien se descompone en el anillo a las tres de la mañana y hay que
// ver su tipo de sangre y a quién llamar. Cada lista se guarda en el teléfono
// al consultarla, y también se puede descargar de golpe junto a los datos del
// escáner. Solo la ve quien entró con el permiso `scanner`: la descarga usa su
// token, y sin él el backend no la entrega.

export const FICHAS_ENDPOINTS = [
  '/api/athletes/staff/emergency-info',
  '/api/staff/equipo/emergency-info',
];

export function guardarFichas(endpoint, data) {
  escribir(`${FICHAS_PREFIX}${endpoint}`, { data, guardado_en: new Date().toISOString() });
}

export function fichasGuardadas(endpoint) {
  return leer(`${FICHAS_PREFIX}${endpoint}`, null);
}

/** Baja las dos listas (atletas y equipo). Necesita token con permiso scanner. */
export async function descargarFichas() {
  const t = adminToken();
  if (!t) return 0;
  let guardadas = 0;
  for (const endpoint of FICHAS_ENDPOINTS) {
    try {
      const r = await fetch(`${API_URL}${endpoint}`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (r.ok) {
        guardarFichas(endpoint, await r.json());
        guardadas += 1;
      }
    } catch { /* sin señal o sin permiso: se queda lo que hubiera */ }
  }
  return guardadas;
}

// ---------------- El reloj local ----------------

const MINUTOS_MINIMOS = 35;

function desfaseHorario(race) {
  const texto = (race?.timezone_gmt || 'GMT-4').toUpperCase().replace('GMT', '').replace('UTC', '').trim();
  const n = parseInt(texto, 10);
  return Number.isNaN(n) ? -4 : n;
}

function horaDeSalidaMs(race) {
  if (race?.started_at) {
    const t = Date.parse(race.started_at.endsWith?.('Z') || /[+-]\d{2}:?\d{2}$/.test(race.started_at)
      ? race.started_at
      : `${race.started_at}Z`); // Mongo guarda UTC sin zona
    if (!Number.isNaN(t)) return t;
  }
  if (!race?.date) return null;
  const t = Date.parse(`${race.date}T${race.start_time || '09:00'}:00${desfaseHorario(race) < 0 ? '-' : '+'}${String(Math.abs(desfaseHorario(race))).padStart(2, '0')}:00`);
  return Number.isNaN(t) ? null : t;
}

/** La misma cuenta que `races.vuelta_actual`, con el reloj del teléfono. */
export function relojLocal(race, enMs = Date.now()) {
  const duracionMs = (race?.minutos_por_vuelta || 60) * 60000;
  const salida = horaDeSalidaMs(race);
  const llegada = race?.finished_at ? Date.parse(`${race.finished_at}Z`) : null;
  const ahora = llegada ? Math.min(enMs, llegada) : enMs;

  if (salida == null || ahora < salida) {
    return {
      race_started: false,
      current_lap: 0,
      minutes_into_lap: 0,
      seconds_remaining: salida ? Math.floor((salida - ahora) / 1000) : 0,
    };
  }

  const transcurridoMs = ahora - salida;
  const vuelta = Math.floor(transcurridoMs / duracionMs) + 1;
  const dentroMs = transcurridoMs % duracionMs;
  return {
    race_started: true,
    current_lap: vuelta,
    minutes_into_lap: Math.floor(dentroMs / 60000),
    seconds_remaining: llegada ? 0 : Math.floor((duracionMs - dentroMs) / 1000),
  };
}

// ---------------- La cola de escaneos ----------------

export const cola = () => leer(QUEUE_KEY, []);
const guardarCola = (items) => escribir(QUEUE_KEY, items);

export const pendientes = () => cola().filter((s) => s.estado !== 'sincronizada');

/**
 * Guarda un escaneo confirmado en el teléfono, para sincronizarlo después.
 *
 * `autoDnf` marca los que el reloj local ya condenó (regreso temprano, tiempo
 * agotado): viajan como `lap_completed` y el servidor deriva el retiro de la
 * hora, pero aquí hace falta saberlo para que el corredor cuente como retirado
 * en los escaneos locales siguientes.
 */
export function encolar({ raceCode, bib, nombre, lapNumber, action, scannedBy, autoDnf = false }) {
  const items = cola();
  const item = {
    id: `${Date.now()}-${bib}-${lapNumber}`,
    race_code: raceCode,
    bib: String(bib),
    nombre,
    lap_number: lapNumber,
    action,
    auto_dnf: autoDnf,
    scanned_at: new Date().toISOString(),
    scanned_by: scannedBy || 'scanner',
    estado: 'pendiente',
    mensaje: '',
  };
  items.push(item);
  guardarCola(items);
  return item;
}

export function descartar(id) {
  guardarCola(cola().filter((s) => s.id !== id));
}

export function vaciarSincronizadas() {
  guardarCola(pendientes());
}

// ---------------- El corredor, resuelto en local ----------------

const normalizaBib = (b) => String(b ?? '').trim().replace(/^0+(?=\d)/, '');

export function atletaLocal(bib) {
  const datos = pack();
  if (!datos) return null;
  const buscado = normalizaBib(bib);
  const p = datos.participants.find((x) => normalizaBib(x.bib) === buscado);
  if (!p) return null;

  // Las vueltas pendientes de sincronizar también cuentan: sin esto, el mismo
  // corredor escaneado dos horas seguidas repetiría el número de vuelta.
  const enCola = pendientes().filter(
    (s) => s.race_code === datos.race.code
      && normalizaBib(s.bib) === buscado
      && s.action === 'lap_completed' && !s.auto_dnf
  ).length;
  const retiradoEnCola = pendientes().some(
    (s) => s.race_code === datos.race.code
      && normalizaBib(s.bib) === buscado && (s.action === 'dnf' || s.auto_dnf)
  );

  return {
    ...p,
    laps_completed: (p.laps_completed || 0) + enCola,
    status: retiradoEnCola ? 'retired' : p.status,
  };
}

/**
 * El mismo veredicto que da `GET /api/qr-scan/athlete/{bib}`, calculado con
 * los datos descargados y el reloj del teléfono.
 */
export function evaluarEscaneo(bib) {
  const datos = pack();
  if (!datos) return null;
  const p = atletaLocal(bib);
  if (!p) {
    return { error: `El dorsal ${bib} no está en los datos descargados.` };
  }

  const base = {
    bib: p.bib,
    nombre: p.nombre,
    apellidos: p.apellidos,
    status: p.status,
    laps_completed: p.laps_completed,
    offline: true,
  };

  if (['retired', 'dns', 'winner'].includes(p.status)) {
    const textos = {
      retired: 'Este atleta ya fue marcado como DNF',
      dns: 'Este atleta no inició la carrera (DNS)',
      winner: 'Este atleta ya fue declarado ganador',
    };
    return {
      ...base,
      current_race_lap: 0,
      lap_to_complete: 0,
      time_remaining_seconds: 0,
      minutes_into_lap: 0,
      can_complete: false,
      auto_dnf: false,
      already_registered: false,
      early_return: false,
      message: textos[p.status] || 'Atleta inactivo',
    };
  }

  const reloj = relojLocal(datos.race);
  const vuelta = p.laps_completed + 1;

  if (!reloj.race_started) {
    return {
      ...base,
      current_race_lap: 0,
      lap_to_complete: 1,
      time_remaining_seconds: reloj.seconds_remaining,
      minutes_into_lap: 0,
      can_complete: false,
      auto_dnf: false,
      already_registered: false,
      early_return: false,
      message: 'La carrera aún no ha comenzado.',
    };
  }

  const yaEnCola = pendientes().some(
    (s) => s.race_code === datos.race.code
      && normalizaBib(s.bib) === normalizaBib(bib)
      && s.action === 'lap_completed' && s.lap_number === vuelta
  );
  const temprano = reloj.minutes_into_lap < MINUTOS_MINIMOS && vuelta === reloj.current_lap;

  let can_complete = true;
  let auto_dnf = false;
  let message = '';

  if (yaEnCola) {
    can_complete = false;
    message = `¡Vuelta ${vuelta} ya fue registrada! No se puede registrar dos veces.`;
  } else if (vuelta > reloj.current_lap) {
    can_complete = false;
    message = `⚠️ La vuelta ${vuelta} aún no ha iniciado. Vuelta actual: ${reloj.current_lap}. Debe esperar.`;
  } else if (temprano) {
    can_complete = false;
    auto_dnf = true;
    message = `⚠️ Regresó muy temprano (${reloj.minutes_into_lap} minutos). Mínimo requerido: ${MINUTOS_MINIMOS} minutos. Se marcará como DNF.`;
  } else if (vuelta < reloj.current_lap) {
    can_complete = false;
    auto_dnf = true;
    message = `⚠️ Tiempo agotado. El atleta debió completar la vuelta ${vuelta} antes. Se marcará como DNF automáticamente.`;
  } else {
    const m = Math.floor(reloj.seconds_remaining / 60);
    const s = reloj.seconds_remaining % 60;
    message = `Vuelta ${vuelta} - Quedan ${m}:${String(s).padStart(2, '0')} para completar.`;
  }

  return {
    ...base,
    current_race_lap: reloj.current_lap,
    lap_to_complete: vuelta,
    time_remaining_seconds: reloj.seconds_remaining,
    minutes_into_lap: reloj.minutes_into_lap,
    can_complete,
    auto_dnf,
    already_registered: yaEnCola,
    early_return: temprano && auto_dnf,
    message,
  };
}

// ---------------- Sincronizar ----------------

/**
 * Manda las pendientes al backend y devuelve {ok, aplicadas, conflictos}.
 * Las aplicadas (o ya registradas por otro escáner) salen de la cola; las que
 * el servidor no pudo aplicar quedan marcadas como conflicto, con su motivo.
 */
export async function sincronizar() {
  const datos = pack();
  const porEnviar = pendientes();
  if (!datos || porEnviar.length === 0) {
    return { ok: true, aplicadas: 0, conflictos: 0 };
  }

  const r = await fetch(`${API_URL}/api/qr-scan/sync-offline`, {
    method: 'POST',
    headers: scanHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      race_code: datos.race.code,
      scans: porEnviar.map((s) => ({
        bib: s.bib,
        lap_number: s.lap_number,
        action: s.action,
        scanned_at: s.scanned_at,
        scanned_by: s.scanned_by,
      })),
    }),
  });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(d.detail || `Error ${r.status} al sincronizar`);
  }
  const { results } = await r.json();

  // El resultado llega en el mismo orden temporal; se casa por bib+vuelta.
  let aplicadas = 0;
  let conflictos = 0;
  const restante = [];
  porEnviar.forEach((s) => {
    const res = (results || []).find(
      (x) => normalizaBib(x.bib) === normalizaBib(s.bib) && x.lap_number === s.lap_number
    );
    if (!res) { restante.push(s); return; }
    if (res.status === 'conflicto') {
      conflictos += 1;
      restante.push({ ...s, estado: 'conflicto', mensaje: res.message });
    } else {
      aplicadas += 1;   // ok, dnf o already_registered: el libro ya lo tiene
    }
  });
  guardarCola(restante);

  // Con la señal de vuelta, se refrescan los contadores descargados para que
  // el siguiente escaneo local no arrastre números viejos.
  try { await descargarPack(datos.race.code); } catch { /* se queda el de antes */ }

  return { ok: true, aplicadas, conflictos };
}
