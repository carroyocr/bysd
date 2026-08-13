// Cuánto dura una sesión abierta dentro de la app.
//
// El backend firma el token del atleta para 72 horas, que es lo razonable para
// la web: se entra desde un ordenador propio y molestar cada rato sobra. En el
// teléfono el riesgo es otro —se presta, se pierde, se deja en la mesa— así
// que la app es más estricta que el token:
//
//   - Con biometría activada se pide la cara o la huella en CADA entrada al
//     perfil. La sesión puede seguir viva; lo que se protege es el acceso.
//   - Sin biometría, a las 3 horas hay que volver a escribir la contraseña.
//
// Esto se decide en el teléfono, no en el servidor: el token sigue siendo
// válido hasta sus 72 horas. Es un cerrojo contra quien coge el aparato, no
// contra quien se lleve el token; para eso está la biometría, que sí guarda la
// credencial en el llavero del sistema.
import { biometriaActiva, desactivarBiometria, ATLETA, STAFF } from './biometria';

export const TOKEN_ATLETA = 'athlete_token';
export const TOKEN_STAFF = 'admin_token';

const DESDE_ATLETA = 'bysd_live_atleta_desde';
const HORAS_SIN_BIOMETRIA = 3;

const ahora = () => Date.now();

/** Marca el momento en que se validó la identidad del atleta. */
export function marcarAccesoAtleta() {
  localStorage.setItem(DESDE_ATLETA, String(ahora()));
}

/**
 * true si hay que volver a pedir la contraseña por tiempo.
 * Con biometría no aplica: ahí se pide la cara en cada entrada.
 */
export function accesoAtletaCaducado() {
  if (!localStorage.getItem(TOKEN_ATLETA)) return false;
  if (biometriaActiva(ATLETA)) return false;
  const desde = Number(localStorage.getItem(DESDE_ATLETA) || 0);
  if (!desde) return true;   // sesión de una versión anterior: que se identifique
  return ahora() - desde > HORAS_SIN_BIOMETRIA * 3600 * 1000;
}

export function cerrarSesionAtleta() {
  localStorage.removeItem(TOKEN_ATLETA);
  localStorage.removeItem(DESDE_ATLETA);
}

export function cerrarSesionStaff() {
  ['admin_token', 'admin_username', 'admin_is_admin', 'admin_permissions']
    .forEach((k) => localStorage.removeItem(k));
}

export const hayAtleta = () => !!localStorage.getItem(TOKEN_ATLETA);
export const hayStaff = () => !!localStorage.getItem(TOKEN_STAFF);

/**
 * Cierra desde el menú lo que esté abierto, sea el corredor, el staff o los
 * dos. Apaga también la biometría de cada uno: el token del llavero es esa
 * misma sesión, y dejarlo haría que cerrar sesión no cerrara nada —bastaría la
 * cara para volver a entrar.
 */
export async function cerrarSesion() {
  if (hayAtleta()) {
    cerrarSesionAtleta();
    await desactivarBiometria(ATLETA);
  }
  if (hayStaff()) {
    cerrarSesionStaff();
    await desactivarBiometria(STAFF);
  }
}

/** Para el menú: qué accesos enseñar. */
export function sesionesAbiertas() {
  return { atleta: hayAtleta(), staff: hayStaff() };
}

/**
 * A dónde va la app al abrirse, pasada la bienvenida.
 *
 * Con sesión abierta se entra directo al inicio, igual que el espectador:
 * preguntar "¿cómo quieres entrar?" a quien ya entró es un paso de más en cada
 * arranque, y quien abre la app viene a ver la carrera, no su perfil. El
 * perfil queda a un toque en el menú lateral.
 *
 * La pantalla de acceso solo aparece cuando de verdad hay algo que elegir.
 */
export function rutaDeEntrada() {
  return hayAtleta() || hayStaff() ? '/live/carreras' : '/live/login';
}

export { ATLETA, STAFF };
export const HORAS_SESION = HORAS_SIN_BIOMETRIA;
