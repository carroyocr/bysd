// Entrar con Face ID, Touch ID o huella, en vez de escribir la contraseña.
//
// Lo que se guarda no es la contraseña, es el token de sesión que el backend
// ya devuelve al iniciar sesión, y va al llavero del sistema (Keychain en iOS,
// Keystore en Android) a través del plugin: sale del alcance de cualquier otra
// app y no queda en el almacenamiento del navegador.
//
// Hasta la cuenta única había dos entradas en el llavero, una para el perfil
// del corredor y otra para el staff, porque detrás había dos cuentas distintas.
// Quien corría y además era voluntario tenía que registrar su cara dos veces.
// Ahora es una cuenta con roles, así que es una sola entrada.
//
// Solo funciona en la app instalada. En el navegador no hay biometría y las
// funciones se quedan calladas.
import { Capacitor } from '@capacitor/core';
import { NativeBiometric, BiometryType } from '@capgo/capacitor-native-biometric';

const SERVIDOR = 'bysd-live';
// Claves nuevas a propósito. La del corredor se llamaba `bysd_live_biometria`
// a secas: reutilizar ese nombre dejaría la marca de "activada" en `on` con el
// llavero nuevo vacío, y la app pediría la cara para no encontrar nada y decir
// que no pudo verificar, una y otra vez, sin que nada pareciera roto.
const ACTIVA_KEY = 'bysd_live_biometria_cuenta';
// Con quién está activada. El llavero ya guarda el usuario junto al token,
// pero leerlo de ahí exige pasar por la cara o la huella, que es justo lo que
// no se puede hacer cuando alguien decide entrar con su contraseña. El correo
// no es un secreto, así que se queda aparte para poder rellenarlo.
const USUARIO_KEY = 'bysd_live_biometria_cuenta_usuario';

// Lo de antes, cuando había dos accesos separados.
const HEREDADO = [
  { servidor: 'bysd-live-atleta', activa: 'bysd_live_biometria', usuario: 'bysd_live_biometria_usuario' },
  { servidor: 'bysd-live-staff', activa: 'bysd_live_biometria_staff', usuario: 'bysd_live_biometria_usuario_staff' },
];

function enApp() {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('NativeBiometric');
}

/**
 * Borra las credenciales biométricas de cuando había dos accesos.
 *
 * No se intenta reaprovecharlas: guardaban el token de una de las dos cuentas
 * viejas, y adivinar cuál de las dos es la buena daría una entrada que abre la
 * mitad de la app. Se pide volver a activarla una vez, que es un gesto, y a
 * partir de ahí vale para todo.
 */
export async function limpiarBiometriaHeredada() {
  for (const v of HEREDADO) {
    const teniaAlgo = localStorage.getItem(v.activa) === 'on';
    localStorage.removeItem(v.activa);
    localStorage.removeItem(v.usuario);
    if (!teniaAlgo || !enApp()) continue;
    try {
      await NativeBiometric.deleteCredentials({ server: v.servidor });
    } catch {
      /* si no había nada guardado, ya está como queremos */
    }
  }
}

/** Nombre de lo que ofrece el teléfono, para poder decirlo en pantalla. */
function nombreDe(tipo) {
  switch (tipo) {
    case BiometryType.FACE_ID: return 'Face ID';
    case BiometryType.TOUCH_ID: return 'Touch ID';
    case BiometryType.FACE_AUTHENTICATION: return 'reconocimiento facial';
    case BiometryType.IRIS_AUTHENTICATION: return 'reconocimiento de iris';
    case BiometryType.FINGERPRINT: return 'huella';
    default: return 'biometría';
  }
}

/**
 * Qué puede hacer este teléfono.
 * Devuelve { disponible, nombre, activada, usuario }.
 */
export async function estadoBiometria() {
  if (!enApp()) return { disponible: false, nombre: '', activada: false, usuario: '' };
  try {
    const { isAvailable, biometryType } = await NativeBiometric.isAvailable();
    return {
      disponible: !!isAvailable,
      nombre: nombreDe(biometryType),
      activada: isAvailable && localStorage.getItem(ACTIVA_KEY) === 'on',
      usuario: localStorage.getItem(USUARIO_KEY) || '',
    };
  } catch {
    return { disponible: false, nombre: '', activada: false, usuario: '' };
  }
}

/** Solo si está activada, sin preguntar al sistema. Para decidir rápido. */
export function biometriaActiva() {
  return enApp() && localStorage.getItem(ACTIVA_KEY) === 'on';
}

/**
 * Deja el token guardado tras verificar la identidad. Se llama justo después
 * de un inicio de sesión con contraseña, que es cuando sabemos que quien está
 * delante es el dueño de la cuenta.
 */
export async function activarBiometria(usuario, token) {
  if (!enApp() || !token) return { ok: false, motivo: 'no-disponible' };
  try {
    const { isAvailable } = await NativeBiometric.isAvailable();
    if (!isAvailable) return { ok: false, motivo: 'no-disponible' };

    await NativeBiometric.verifyIdentity({
      reason: 'Para entrar sin escribir la contraseña',
      title: 'BYSD Live',
      subtitle: 'Confirma que eres tú',
    });
    await NativeBiometric.setCredentials({
      username: usuario || 'bysd', password: token, server: SERVIDOR,
    });
    localStorage.setItem(ACTIVA_KEY, 'on');
    if (usuario) localStorage.setItem(USUARIO_KEY, usuario);
    return { ok: true };
  } catch {
    // El usuario canceló o no reconoció: no es un error que reportar.
    return { ok: false, motivo: 'cancelado' };
  }
}

/**
 * Anota con qué cuenta quedó activada la biometría, si no se sabía.
 *
 * Para quien ya la tenía puesta antes de que esto existiera: la próxima vez
 * que entre con éxito se queda apuntado y a partir de ahí el correo aparece
 * solo. No se pisa lo que ya hubiera.
 */
export function recordarUsuarioBiometrico(usuario) {
  if (!enApp() || !usuario) return;
  if (localStorage.getItem(ACTIVA_KEY) !== 'on') return;
  if (localStorage.getItem(USUARIO_KEY)) return;
  localStorage.setItem(USUARIO_KEY, usuario);
}

/** Quita el acceso biométrico y borra el token del llavero. */
export async function desactivarBiometria() {
  localStorage.removeItem(ACTIVA_KEY);
  localStorage.removeItem(USUARIO_KEY);
  if (!enApp()) return;
  try {
    await NativeBiometric.deleteCredentials({ server: SERVIDOR });
  } catch {
    /* si no había nada guardado, ya está como queremos */
  }
}

/**
 * Pide la cara o la huella y devuelve el token guardado.
 * Devuelve null si no está activada, si no hay token o si el usuario cancela.
 */
export async function entrarConBiometria() {
  if (!enApp() || localStorage.getItem(ACTIVA_KEY) !== 'on') return null;
  try {
    await NativeBiometric.verifyIdentity({
      reason: 'Para entrar a tu cuenta',
      title: 'BYSD Live',
      subtitle: 'Confirma que eres tú',
    });
    const cred = await NativeBiometric.getCredentials({ server: SERVIDOR });
    return cred?.password || null;
  } catch {
    return null;
  }
}
