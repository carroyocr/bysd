/**
 * Descargas y enlaces externos que funcionan igual en la web y en la app.
 *
 * En la app nativa no existen las descargas del navegador (Blob + click) ni
 * el window.open a otra pestaña: los archivos se escriben al caché con
 * Filesystem y se entregan por la hoja nativa de compartir, y los enlaces
 * externos se abren con el plugin Browser (navegador dentro de la app).
 */
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/** Descarga (web) o comparte (app) un archivo de texto, p. ej. un CSV. */
export async function exportTextFile(filename, content, mimeType) {
  if (Capacitor.isNativePlatform()) {
    const written = await Filesystem.writeFile({
      path: filename,
      data: content,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({ title: filename, files: [written.uri] });
    return;
  }

  const blob = new Blob([content], { type: mimeType });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** true dentro de la app instalada (Android o iOS), false en el navegador. */
export const enApp = () => Capacitor.isNativePlatform();

function blobABase64(blob) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onerror = reject;
    // readAsDataURL da "data:image/png;base64,XXXX"; Filesystem solo quiere XXXX
    lector.onload = () => resolve(String(lector.result).split(',')[1]);
    lector.readAsDataURL(blob);
  });
}

/**
 * Comparte una imagen generada en un canvas.
 *
 * En la app no sirve `navigator.share` con ficheros —el WebView de Android no
 * lo trae— ni el enlace con `download`, así que el botón no hacía nada: la
 * imagen se escribe al caché y se entrega por la hoja de compartir del sistema,
 * que es también desde donde se guarda en la galería.
 */
export async function shareImage(filename, blob, title) {
  if (enApp()) {
    const written = await Filesystem.writeFile({
      path: filename,
      data: await blobABase64(blob),
      directory: Directory.Cache,
    });
    await Share.share({ title, files: [written.uri] });
    return;
  }

  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title });
    return;
  }
  descargarBlob(filename, blob);
}

/** Descarga por el navegador. Solo tiene sentido fuera de la app. */
export function descargarBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Abre un enlace externo: pestaña nueva en la web, Browser nativo en la app. */
export async function openExternal(url) {
  if (Capacitor.isNativePlatform()) {
    await Browser.open({ url });
    return;
  }
  window.open(url, '_blank');
}
