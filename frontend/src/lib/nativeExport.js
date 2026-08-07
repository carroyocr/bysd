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

/** Abre un enlace externo: pestaña nueva en la web, Browser nativo en la app. */
export async function openExternal(url) {
  if (Capacitor.isNativePlatform()) {
    await Browser.open({ url });
    return;
  }
  window.open(url, '_blank');
}
