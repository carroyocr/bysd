import { Capacitor } from '@capacitor/core';

/** true cuando el código corre dentro de la app nativa (Android/iOS). */
export function isNative() {
  return Capacitor.isNativePlatform();
}
