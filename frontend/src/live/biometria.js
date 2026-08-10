// Entrar con Face ID, Touch ID o huella, en vez de escribir la contraseña.
//
// Lo que se guarda no es la contraseña, es el token de sesión que el backend
// ya devuelve al iniciar sesión, y va al llavero del sistema (Keychain en iOS,
// Keystore en Android) a través del plugin: sale del alcance de cualquier otra
// app y no queda en el almacenamiento del navegador.
//
// Hay dos accesos independientes —el perfil del corredor y el del staff— y
// cada uno guarda lo suyo bajo su propia etiqueta: un teléfono puede tener
// activada la biometría para uno y no para el otro, y cerrar sesión en uno no
// debe tocar al otro.
//
// Solo funciona en la app instalada. En el navegador no hay biometría y las
// funciones se quedan calladas.
import { Capacitor } from '@capacitor/core';
import { NativeBiometric, BiometryType } from '@capgo/capacitor-native-biometric';

export const ATLETA = 'atleta';
export const STAFF = 'staff';

const SERVIDOR = { [ATLETA]: 'bysd-live-atleta', [STAFF]: 'bysd-live-staff' };
const ACTIVA_KEY = { [ATLETA]: 'bysd_live_biometria', [STAFF]: 'bysd_live_biometria_staff' };
// Con quién está activada. El llavero ya guarda el usuario junto al token,
// pero leerlo de ahí exige pasar por la cara o la huella, que es justo lo que
// no se puede hacer cuando alguien decide entrar con su contraseña. El correo
// no es un secreto, así que se queda aparte para poder rellenarlo.
const USUARIO_KEY = { [ATLETA]: 'bysd_live_biometria_usuario', [STAFF]: 'bysd_live_biometria_usuario_staff' };

function enApp() {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('NativeBiometric');
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
 * Qué puede hacer este teléfono para el acceso indicado.
 * Devuelve { disponible, nombre, activada }.
 */
export async function estadoBiometria(quien = ATLETA) {
  if (!enApp()) return { disponible: false, nombre: '', activada: false, usuario: '' };
  try {
    const { isAvailable, biometryType } = await NativeBiometric.isAvailable();
    return {
      disponible: !!isAvailable,
      nombre: nombreDe(biometryType),
      activada: isAvailable && localStorage.getItem(ACTIVA_KEY[quien]) === 'on',
      usuario: localStorage.getItem(USUARIO_KEY[quien]) || '',
    };
  } catch {
    return { disponible: false, nombre: '', activada: false, usuario: '' };
  }
}

/** Solo si está activada, sin preguntar al sistema. Para decidir rápido. */
export function biometriaActiva(quien = ATLETA) {
  return enApp() && localStorage.getItem(ACTIVA_KEY[quien]) === 'on';
}

/**
 * Deja el token guardado tras verificar la identidad. Se llama justo después
 * de un inicio de sesión con contraseña, que es cuando sabemos que quien está
 * delante es el dueño de la cuenta.
 */
export async function activarBiometria(usuario, token, quien = ATLETA) {
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
      username: usuario || quien, password: token, server: SERVIDOR[quien],
    });
    localStorage.setItem(ACTIVA_KEY[quien], 'on');
    if (usuario) localStorage.setItem(USUARIO_KEY[quien], usuario);
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
export function recordarUsuarioBiometrico(usuario, quien = ATLETA) {
  if (!enApp() || !usuario) return;
  if (localStorage.getItem(ACTIVA_KEY[quien]) !== 'on') return;
  if (localStorage.getItem(USUARIO_KEY[quien])) return;
  localStorage.setItem(USUARIO_KEY[quien], usuario);
}

/** Quita el acceso biométrico y borra el token del llavero. */
export async function desactivarBiometria(quien = ATLETA) {
  localStorage.removeItem(ACTIVA_KEY[quien]);
  localStorage.removeItem(USUARIO_KEY[quien]);
  if (!enApp()) return;
  try {
    await NativeBiometric.deleteCredentials({ server: SERVIDOR[quien] });
  } catch {
    /* si no había nada guardado, ya está como queremos */
  }
}

/**
 * Pide la cara o la huella y devuelve el token guardado.
 * Devuelve null si no está activada, si no hay token o si el usuario cancela.
 */
export async function entrarConBiometria(quien = ATLETA) {
  if (!enApp() || localStorage.getItem(ACTIVA_KEY[quien]) !== 'on') return null;
  try {
    await NativeBiometric.verifyIdentity({
      reason: quien === STAFF ? 'Para entrar al acceso de staff' : 'Para entrar a tu perfil',
      title: 'BYSD Live',
      subtitle: 'Confirma que eres tú',
    });
    const cred = await NativeBiometric.getCredentials({ server: SERVIDOR[quien] });
    return cred?.password || null;
  } catch {
    return null;
  }
}
