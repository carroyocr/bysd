/**
 * Persistencia del almacenamiento web dentro de la app nativa.
 *
 * iOS puede purgar el localStorage del WKWebView cuando el sistema necesita
 * espacio, así que en la app cada escritura a localStorage se refleja en
 * Capacitor Preferences (almacenamiento nativo) y al arrancar se restaura
 * todo antes de montar React. Así el resto del código sigue usando
 * localStorage de forma síncrona sin enterarse. En la web no hace nada.
 */
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

export async function initNativeStorage() {
  if (!Capacitor.isNativePlatform()) return;

  // Restaurar: lo que haya en Preferences y falte en localStorage (purga).
  const { keys } = await Preferences.keys();
  for (const key of keys) {
    const { value } = await Preferences.get({ key });
    if (value !== null && window.localStorage.getItem(key) === null) {
      window.localStorage.setItem(key, value);
    }
  }

  // Espejar: toda escritura futura a localStorage se copia a Preferences.
  const { setItem, removeItem, clear } = Storage.prototype;
  Storage.prototype.setItem = function (key, value) {
    setItem.call(this, key, value);
    if (this === window.localStorage) {
      Preferences.set({ key: String(key), value: String(value) });
    }
  };
  Storage.prototype.removeItem = function (key) {
    removeItem.call(this, key);
    if (this === window.localStorage) {
      Preferences.remove({ key: String(key) });
    }
  };
  Storage.prototype.clear = function () {
    clear.call(this);
    if (this === window.localStorage) {
      Preferences.clear();
    }
  };
}
