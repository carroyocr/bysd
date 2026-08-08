// Entrar al perfil con Face ID, Touch ID o huella, en vez de escribir la
// contraseña cada vez.
//
// Lo que se guarda no es la contraseña, es el token de sesión que el backend
// ya devuelve al iniciar sesión, y va al llavero del sistema (Keychain en iOS,
// Keystore en Android) a través del plugin: sale del alcance de cualquier otra
// app y no queda en el almacenamiento del navegador.
//
// Solo funciona en la app instalada. En el navegador no hay biometría y las
// funciones se quedan calladas.
import { Capacitor } from '@capacitor/core';
import { NativeBiometric, BiometryType } from '@capgo/capacitor-native-biometric';

// Etiqueta bajo la que se guarda el token en el llavero.
const SERVIDOR = 'bysd-live-atleta';
const ACTIVA_KEY = 'bysd_live_biometria';

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
 * Qué puede hacer este teléfono.
 * Devuelve { disponible, nombre, activada }.
 */
export async function estadoBiometria() {
  if (!enApp()) return { disponible: false, nombre: '', activada: false };
  try {
    const { isAvailable, biometryType } = await NativeBiometric.isAvailable();
    return {
      disponible: !!isAvailable,
      nombre: nombreDe(biometryType),
      activada: isAvailable && localStorage.getItem(ACTIVA_KEY) === 'on',
    };
  } catch {
    return { disponible: false, nombre: '', activada: false };
  }
}

/**
 * Deja el token guardado tras verificar la identidad. Se llama justo después
 * de un inicio de sesión con contraseña, que es cuando sabemos que quien está
 * delante es el dueño de la cuenta.
 */
export async function activarBiometria(email, token) {
  if (!enApp() || !token) return { ok: false, motivo: 'no-disponible' };
  try {
    const { isAvailable } = await NativeBiometric.isAvailable();
    if (!isAvailable) return { ok: false, motivo: 'no-disponible' };

    await NativeBiometric.verifyIdentity({
      reason: 'Para entrar a tu perfil sin escribir la contraseña',
      title: 'BYSD Live',
      subtitle: 'Confirma que eres tú',
    });
    await NativeBiometric.setCredentials({ username: email, password: token, server: SERVIDOR });
    localStorage.setItem(ACTIVA_KEY, 'on');
    return { ok: true };
  } catch {
    // El usuario canceló o no reconoció: no es un error que reportar.
    return { ok: false, motivo: 'cancelado' };
  }
}

/** Quita el acceso biométrico y borra el token del llavero. */
export async function desactivarBiometria() {
  localStorage.removeItem(ACTIVA_KEY);
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
      reason: 'Para entrar a tu perfil',
      title: 'BYSD Live',
      subtitle: 'Confirma que eres tú',
    });
    const cred = await NativeBiometric.getCredentials({ server: SERVIDOR });
    return cred?.password || null;
  } catch {
    return null;
  }
}
