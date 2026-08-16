/**
 * Llamadas al backend desde el panel de administración.
 *
 * Los endpoints administrativos ahora exigen el token del panel; antes muchos
 * estaban abiertos y por eso varias pantallas llamaban con `fetch` pelado.
 * Este helper adjunta la cabecera siempre, para que no vuelva a olvidarse en
 * una pantalla nueva.
 *
 * Desde la cuenta única el token es uno solo y vive en `lib/sesion.js`. Este
 * módulo se queda como la puerta del panel —lo usan treinta sitios— pero ya no
 * guarda nada por su cuenta: solo reexporta.
 */
import { authHeaders, sesionFetch, token } from './sesion';

export { authHeaders };

export function adminToken() {
  return token();
}

/** `fetch` con el token adjunto. */
export function adminFetch(url, options = {}) {
  return sesionFetch(url, options);
}

/* ---------------- Clave de escaneo (página /scan) ---------------- */

const SCAN_KEY_STORAGE = 'scan_key';

export function scanKey() {
  return localStorage.getItem(SCAN_KEY_STORAGE) || '';
}

export function saveScanKey(key) {
  localStorage.setItem(SCAN_KEY_STORAGE, (key || '').trim().toUpperCase());
}

export function clearScanKey() {
  localStorage.removeItem(SCAN_KEY_STORAGE);
}

/**
 * Cabeceras para los endpoints de escaneo: vale la clave de la carrera o, si
 * quien escanea entró al panel, su token.
 */
export function scanHeaders(extra = {}) {
  const token = adminToken();
  if (token) return { ...extra, Authorization: `Bearer ${token}` };
  const key = scanKey();
  return key ? { ...extra, 'X-Scan-Key': key } : { ...extra };
}

export function scanFetch(url, options = {}) {
  return fetch(url, { ...options, headers: scanHeaders(options.headers || {}) });
}
