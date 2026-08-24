// La carrera con la que abre la app.
//
// Antes, entrar siempre pasaba por el selector de carreras. Ahora la app
// resuelve sola con cuál abrir: la que la persona eligió la última vez —que se
// guarda en el teléfono y no se pierde entre arranques— y, si nunca eligió,
// la más próxima a celebrarse. El selector como pantalla desaparece del camino
// de entrada; elegir carrera vive en el menú lateral, dentro de Seguimiento.
//
// Solo se guarda la elección EXPLÍCITA de la persona. La automática no se
// escribe: si mañana se publica una carrera más cercana, quien nunca eligió
// debe abrir con esa, no con la que el automatismo pisó ayer.

const CARRERA_KEY = 'bysd_live_carrera';

export function guardarCarrera(code) {
  try { localStorage.setItem(CARRERA_KEY, code); } catch { /* modo privado */ }
}

export function carreraGuardada() {
  try { return localStorage.getItem(CARRERA_KEY); } catch { return null; }
}

/**
 * Las carreras en dos grupos, como los enseña el menú: próximas (la más
 * cercana primero, con las que están en curso) y pasadas (la más reciente
 * primero). El mismo corte que usaba el selector de carreras.
 */
export function agruparCarreras(races) {
  const hoy = new Date().toISOString().slice(0, 10);
  const proximas = (races || [])
    .filter((r) => r.is_active || (r.date && r.date >= hoy && !r.archived_at))
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const pasadas = (races || [])
    .filter((r) => !proximas.includes(r))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return { proximas, pasadas };
}

/**
 * Con qué carrera abrir: la guardada si sigue existiendo; si no, la más
 * próxima a celebrarse; y si ya no queda ninguna por venir, la última corrida.
 */
export function carreraDeEntrada(races) {
  const guardada = carreraGuardada();
  const elegida = (races || []).find((r) => r.code === guardada);
  if (elegida) return elegida;
  const { proximas, pasadas } = agruparCarreras(races);
  return proximas[0] || pasadas[0] || null;
}
