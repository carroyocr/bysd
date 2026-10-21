import { useEffect, useRef, useState } from 'react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// El super se relee seguido: lo que se corrige o se agranda en el panel tiene
// que verse en pantalla en segundos, sin tocar OBS.
const RECARGAR_MS = 3000;

/** Un super de texto libre (dos líneas y su tamaño) y la hora. */
export default function useSuper(superId, activo = true) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [ahora, setAhora] = useState(() => new Date());
  // Si ya hubo datos, un fallo de red posterior no tapa la barra con un aviso
  const cargado = useRef(false);

  useEffect(() => {
    if (!activo) return undefined;
    if (!superId) {
      setError('Falta el super en la dirección.');
      return undefined;
    }
    let vivo = true;
    const cargar = async () => {
      try {
        const res = await fetch(`${API_URL}/api/overlay/super/${encodeURIComponent(superId)}`);
        if (!res.ok) {
          if (vivo) setError('Ese super no existe o fue borrado.');
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
  }, [superId, activo]);

  useEffect(() => {
    if (!activo) return undefined;
    const id = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(id);
  }, [activo]);

  return {
    datos,
    error,
    hora: ahora.toLocaleTimeString('es-DO', { hour: 'numeric', minute: '2-digit' }),
  };
}
