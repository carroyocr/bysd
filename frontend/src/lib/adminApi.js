/**
 * Llamadas al backend desde el panel de administración.
 *
 * Los endpoints administrativos ahora exigen el token del panel; antes muchos
 * estaban abiertos y por eso varias pantallas llamaban con `fetch` pelado.
 * Este helper adjunta la cabecera siempre, para que no vuelva a olvidarse en
 * una pantalla nueva.
 */

export function adminToken() {
  return localStorage.getItem('admin_token');
}

/** Cabeceras con el token del panel, conservando las que ya traiga la llamada. */
export function authHeaders(extra = {}) {
  const token = adminToken();
  return token ? { ...extra, Authorization: `Bearer ${token}` } : { ...extra };
}

/** `fetch` con el token del panel adjunto. */
export function adminFetch(url, options = {}) {
  return fetch(url, { ...options, headers: authHeaders(options.headers || {}) });
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
