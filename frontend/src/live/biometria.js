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
  if (!enApp()) return { disponible: false, nombre: '', activada: false };
  try {
    const { isAvailable, biometryType } = await NativeBiometric.isAvailable();
    return {
      disponible: !!isAvailable,
      nombre: nombreDe(biometryType),
      activada: isAvailable && localStorage.getItem(ACTIVA_KEY[quien]) === 'on',
    };
  } catch {
    return { disponible: false, nombre: '', activada: false };
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
    return { ok: true };
  } catch {
    // El usuario canceló o no reconoció: no es un error que reportar.
    return { ok: false, motivo: 'cancelado' };
  }
}

/** Quita el acceso biométrico y borra el token del llavero. */
export async function desactivarBiometria(quien = ATLETA) {
  localStorage.removeItem(ACTIVA_KEY[quien]);
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
