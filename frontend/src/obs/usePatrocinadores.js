import { useEffect, useMemo, useState } from 'react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Cada cuánto cambia el patrocinador en pantalla, y cada cuánto se vuelve a
// pedir la lista (para que un patrocinador que se enciende en el panel entre
// sin tocar OBS).
const ROTAR_MS = 10000;
const RECARGAR_MS = 5 * 60 * 1000;

/** El logo viene relativo al backend; en pruebas puede venir con dominio. */
export function urlLogo(logo) {
  if (!logo) return null;
  return /^https?:\/\//.test(logo) ? logo : `${API_URL}${logo}`;
}

/**
 * El patrocinador que toca enseñar, rotando por la misma lista que el pie de
 * la app (`/api/ads/pie`): los que están encendidos para la app, vigentes y
 * con algo que enseñar. Así la transmisión no lleva una lista aparte que
 * haya que mantener.
 *
 * El peso se respeta como en la app —quien más pesa sale más veces—, pero
 * aquí el orden no se baraja: en una transmisión conviene que el ciclo sea
 * previsible.
 */
export default function usePatrocinadores(raceCode, activo = true) {
  const [banners, setBanners] = useState([]);
  const [indice, setIndice] = useState(0);

  useEffect(() => {
    if (!activo) return undefined;
    let vivo = true;
    const cargar = async () => {
      try {
        const res = await fetch(`${API_URL}/api/ads/pie${raceCode ? `?race_code=${encodeURIComponent(raceCode)}` : ''}`);
        if (!res.ok) return;
        const { banners: lista } = await res.json();
        if (vivo) setBanners(Array.isArray(lista) ? lista : []);
      } catch {
        /* sin patrocinadores no se rompe nada: la vista queda vacía */
      }
    };
    cargar();
    const id = setInterval(cargar, RECARGAR_MS);
    return () => { vivo = false; clearInterval(id); };
  }, [raceCode, activo]);

  const lista = useMemo(() => {
    const salida = [];
    banners.forEach((b) => {
      for (let i = 0; i < Math.max(1, b.weight || 1); i++) salida.push(b);
    });
    return salida;
  }, [banners]);

  useEffect(() => {
    if (lista.length <= 1) return undefined;
    const id = setInterval(() => setIndice((i) => (i + 1) % lista.length), ROTAR_MS);
    return () => clearInterval(id);
  }, [lista.length]);

  return lista.length ? lista[indice % lista.length] : null;
}
