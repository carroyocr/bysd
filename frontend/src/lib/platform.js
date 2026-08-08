import { Capacitor } from '@capacitor/core';

/** true cuando el código corre dentro de la app nativa (Android/iOS). */
export function isNative() {
  return Capacitor.isNativePlatform();
}

/**
 * Solo en la app nativa: fija la escala del viewport. Sin esto, iOS hace
 * zoom automático al enfocar inputs con letra menor a 16px y la página
 * queda sobredimensionada, con las barras fijas cortadas. En la web no se
 * toca (el usuario conserva su zoom).
 */
export function lockNativeViewport() {
  if (!Capacitor.isNativePlatform()) return;
  const meta = document.querySelector('meta[name="viewport"]');
  if (meta) {
    meta.setAttribute(
      'content',
      'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover'
    );
  }
}
