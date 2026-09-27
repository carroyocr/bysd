import { useEffect, useMemo, useRef, useState } from 'react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const ROTAR_MS = 10000;
const RECARGAR_MS = 60 * 1000;

/**
 * La actividad que se transmite, la hora y el expositor de turno.
 *
 * La ficha se relee cada minuto: si en mitad de la charla se agrega un
 * expositor en el panel, entra sin tocar OBS. Con varios expositores se
 * rotan cada 10 segundos; con uno, se queda fijo. `expositorFijo` (1, 2, 3…)
 * clava uno concreto: es lo que permite una fuente de OBS por expositor y
 * cambiar de escena cuando cambia quien habla.
 */
export default function useCharla(actividadId, activo = true, expositorFijo = null) {
  const [actividad, setActividad] = useState(null);
  const [error, setError] = useState(null);
  const [indice, setIndice] = useState(0);
  const [ahora, setAhora] = useState(() => new Date());
  // Si ya hubo ficha, un fallo de red posterior no tapa la barra con un aviso
  const cargada = useRef(false);

  useEffect(() => {
    if (!activo) return undefined;
    if (!actividadId) {
      setError('Falta la actividad en la dirección.');
      return undefined;
    }
    let vivo = true;
    const cargar = async () => {
      try {
        const res = await fetch(`${API_URL}/api/capacitaciones/${encodeURIComponent(actividadId)}/publica`);
        if (!res.ok) {
          if (vivo) setError('No se encontró la actividad.');
          return;
        }
        const datos = await res.json();
        if (vivo) { setActividad(datos); setError(null); cargada.current = true; }
      } catch {
        if (vivo && !cargada.current) setError('Sin conexión con el servidor');
      }
    };
    cargar();
    const id = setInterval(cargar, RECARGAR_MS);
    return () => { vivo = false; clearInterval(id); };
  }, [actividadId, activo]);

  // Reloj de pared, al segundo
  useEffect(() => {
    if (!activo) return undefined;
    const id = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(id);
  }, [activo]);

  const expositores = useMemo(() => actividad?.expositores || [], [actividad]);

  useEffect(() => {
    if (expositores.length <= 1) return undefined;
    const id = setInterval(() => setIndice((i) => (i + 1) % expositores.length), ROTAR_MS);
    return () => clearInterval(id);
  }, [expositores.length]);

  let expositor = null;
  if (expositores.length) {
    const fijo = Number(expositorFijo);
    expositor = fijo >= 1 && fijo <= expositores.length
      ? expositores[fijo - 1]
      : expositores[indice % expositores.length];
  }

  return {
    actividad,
    error,
    expositor,
    hora: ahora.toLocaleTimeString('es-DO', { hour: 'numeric', minute: '2-digit' }),
  };
}
