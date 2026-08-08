// Sustituto vacío del SDK web de Firebase.
//
// El plugin @capacitor-firebase/messaging trae una implementación para
// navegador que importa `firebase/app` y `firebase/messaging`. La app solo usa
// push dentro de la aplicación instalada (`pushDisponible()` lo comprueba
// antes de llamar al plugin), así que ese código nunca se ejecuta; sin este
// sustituto habría que instalar el SDK completo de Firebase —cientos de
// kilobytes— para satisfacer un import que no se usa.
//
// Se enlaza desde craco.config.js con un alias de webpack.

const noSoportado = () => {
  throw new Error('Firebase web no está disponible: el push solo funciona en la app instalada.');
};

export const initializeApp = noSoportado;
export const getApp = noSoportado;
export const getApps = () => [];
export const getMessaging = noSoportado;
export const getToken = noSoportado;
export const deleteToken = noSoportado;
export const onMessage = noSoportado;
export const isSupported = () => Promise.resolve(false);

export default {};
