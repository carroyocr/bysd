import { Capacitor } from '@capacitor/core';
import { getJson } from './liveApi';
import { VERSION } from './version';

// Aviso de versión nueva: al abrir, la app le pregunta al backend qué versión
// hay publicada en su tienda y la compara con la que trae dentro.
//
// Solo tiene sentido en la app instalada: en la web el navegador ya sirve
// siempre lo último, y en un build de desarrollo la versión local suele ir por
// delante de la tienda, así que tampoco avisa.

const YA_AVISADO = 'bysd_live_version_avisada';

/** Compara "1.3.10" con "1.3.9" por números, no por texto. Devuelve -1, 0 o 1. */
export function comparaVersiones(a, b) {
  const partes = (v) => String(v || '').split('.').map((n) => parseInt(n, 10) || 0);
  const [x, y] = [partes(a), partes(b)];
  const largo = Math.max(x.length, y.length);

  for (let i = 0; i < largo; i += 1) {
    const dif = (x[i] || 0) - (y[i] || 0);
    if (dif !== 0) return dif > 0 ? 1 : -1;
  }
  return 0;
}

/** Deja de avisar por esta versión (el "ahora no" del aviso). */
export function silenciarVersion(version) {
  try {
    localStorage.setItem(YA_AVISADO, version);
  } catch {
    /* modo privado: se volverá a avisar, que no es grave */
  }
}

function yaSeAviso(version) {
  try {
    return localStorage.getItem(YA_AVISADO) === version;
  } catch {
    return false;
  }
}

/**
 * Devuelve { version, url } si la tienda tiene una versión más nueva que la
 * instalada y todavía no se avisó de ella. En cualquier otro caso, null: sin
 * red, sin app nativa, o al día.
 */
export async function buscarActualizacion() {
  if (!Capacitor.isNativePlatform()) return null;

  const plataforma = Capacitor.getPlatform(); // 'ios' | 'android'

  try {
    const datos = await getJson('/api/app/version');
    const tienda = datos?.[plataforma];
    if (!tienda?.version || !tienda?.url) return null;
    if (comparaVersiones(tienda.version, VERSION) <= 0) return null;
    if (yaSeAviso(tienda.version)) return null;
    return { version: tienda.version, url: tienda.url };
  } catch {
    // Sin red o backend caído: la app abre igual, sin aviso.
    return null;
  }
}
