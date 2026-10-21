import { useEffect, useState } from 'react';

// El álbum público de la edición anterior, tal como lo sirve el backend
// (`/api/album/photos`, el mismo que lee la página de Fotos). Se pide una
// sola vez por visita, lo compartan las secciones que lo compartan: la
// promesa vive en el módulo. Devuelve `null` mientras carga y `[]` si no se
// pudo leer (la caché del backend aún vacía responde 503), en cuyo caso se
// vuelve a intentar en el siguiente montaje.

const API_URL = process.env.REACT_APP_BACKEND_URL;

let promesa = null;

export function cargarAlbum() {
  if (!promesa) {
    promesa = fetch(`${API_URL}/api/album/photos`)
      .then((r) => (r.ok ? r.json() : { photos: [] }))
      .then((datos) => (datos.photos || []).map((p) => p.url).filter(Boolean))
      .catch(() => [])
      .then((urls) => {
        if (!urls.length) promesa = null;
        return urls;
      });
  }
  return promesa;
}

export default function useAlbum() {
  const [album, setAlbum] = useState(null);
  useEffect(() => {
    let vivo = true;
    cargarAlbum().then((urls) => {
      if (vivo) setAlbum(urls);
    });
    return () => {
      vivo = false;
    };
  }, []);
  return album;
}
