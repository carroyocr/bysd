import { useEffect, useRef, useState } from 'react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// La hoja de la organización cambia una vez por vuelta, pero cuando cambia
// (al cerrar cada hora) conviene que la pantalla lo recoja pronto. El
// backend la pide a Google como mucho cada medio minuto, así que preguntar
// cada 15 segundos no cuesta nada.
const RECARGAR_MS = 15000;

/** El ranking de Latinoamérica del Mundial, leído de la hoja de la organización. */
export default function useMundial(activo = true) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  // Si ya hubo ranking, un fallo de red posterior no tapa la tabla con un aviso
  const cargado = useRef(false);

  useEffect(() => {
    if (!activo) return undefined;
    let vivo = true;
    const cargar = async () => {
      try {
        const res = await fetch(`${API_URL}/api/overlay/mundial/latam`);
        if (!res.ok) {
          if (vivo && !cargado.current) setError('No se pudo leer la hoja del Mundial.');
          return;
        }
        const nuevos = await res.json();
        if (vivo) { setDatos(nuevos); setError(null); cargado.current = true; }
      } catch {
        if (vivo && !cargado.current) setError('Sin conexión con el servidor');
      }
    };
    cargar();
    const id = setInterval(cargar, RECARGAR_MS);
    return () => { vivo = false; clearInterval(id); };
  }, [activo]);

  return { datos, error };
}
