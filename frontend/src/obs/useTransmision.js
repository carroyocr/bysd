import { useCallback, useEffect, useRef, useState } from 'react';
import { relojForzado } from './Globo';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Cada cuánto se pregunta al backend. Tres segundos es lo que tarda en verse
// una llegada en pantalla; el cronómetro no depende de esto, corre solo.
const CADA_MS = 3000;

/** Segundos a "MM:SS", o a "H:MM:SS" cuando pasa de la hora. */
export function reloj(segundos) {
  if (segundos === null || segundos === undefined || Number.isNaN(segundos)) return '--:--';
  const s = Math.max(0, Math.floor(segundos));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const resto = s % 60;
  const dos = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${dos(m)}:${dos(resto)}` : `${dos(m)}:${dos(resto)}`;
}

/** "2027-01-23T06:00:00-04:00" -> "6:00 a. m." */
export function horaCorta(iso) {
  if (!iso) return '--:--';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString('es-DO', { hour: 'numeric', minute: '2-digit' });
}

/**
 * Los datos de la transmisión: estado de la carrera y cola de anuncios.
 *
 * El cronómetro no se pinta con lo que contesta el servidor, sino con la hora
 * de fin de la vuelta y un reloj local: así baja segundo a segundo aunque una
 * respuesta tarde o se pierda. Del servidor sale el desfase (`ahora`), porque
 * el ordenador que transmite puede tener el reloj minutos corrido y el
 * cronómetro en pantalla es lo que más se nota.
 */
export default function useTransmision({ clave, raceCode, clasificacion = 10, inicio = '' }) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [anuncio, setAnuncio] = useState(null);
  const [tick, setTick] = useState(0);

  const desfase = useRef(0);          // hora del servidor menos la del equipo
  const anterior = useRef(null);      // la cuenta del latido anterior, para
  const destello = useRef(null);      // ver cuándo cruza el cero
  const conocidas = useRef(null);     // llegadas ya vistas: las de la primera
  const cola = useRef([]);            // carga no se anuncian, son historia
  const mostrando = useRef(false);

  const siguienteAnuncio = useCallback(() => {
    const proximo = cola.current.shift();
    if (!proximo) {
      mostrando.current = false;
      setAnuncio(null);
      return;
    }
    mostrando.current = true;
    setAnuncio(proximo);
    setTimeout(siguienteAnuncio, 9000);
  }, []);

  const pedir = useCallback(async () => {
    if (!clave) return;
    try {
      const params = new URLSearchParams({ clave, clasificacion: String(clasificacion) });
      if (raceCode) params.set('race_code', raceCode);
      const res = await fetch(`${API_URL}/api/overlay/estado?${params}`);
      if (!res.ok) {
        setError(res.status === 403 ? 'Clave de transmisión no válida' : 'No se pudo cargar la carrera');
        return;
      }
      const nuevos = await res.json();
      setError(null);
      setDatos(nuevos);

      if (nuevos.reloj?.ahora) {
        desfase.current = new Date(nuevos.reloj.ahora).getTime() - Date.now();
      }

      const llegadas = nuevos.llegadas || [];
      if (conocidas.current === null) {
        conocidas.current = new Set(llegadas.map((l) => l.id));
        return;
      }
      // Van de la más nueva a la más vieja; se anuncian en el orden en que
      // pasaron por el arco.
      const nuevas = llegadas.filter((l) => !conocidas.current.has(l.id)).reverse();
      nuevas.forEach((l) => {
        conocidas.current.add(l.id);
        cola.current.push(l);
      });
      if (nuevas.length && !mostrando.current) siguienteAnuncio();
    } catch {
      setError('Sin conexión con el servidor');
    }
  }, [clave, raceCode, clasificacion, siguienteAnuncio]);

  useEffect(() => {
    pedir();
    const id = setInterval(pedir, CADA_MS);
    return () => clearInterval(id);
  }, [pedir]);

  // Reloj local: un latido por segundo para que la cuenta atrás baje sola
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const ahora = Date.now() + desfase.current;
  const hasta = (iso) => (iso ? Math.round((new Date(iso).getTime() - ahora) / 1000) : null);

  // Con `inicio` en la dirección la salida es la que diga ahí, no la de la
  // carrera: sirve para ensayar la pantalla sin tocar nada. Los demás datos
  // (conteos, llegadas) siguen siendo los de verdad.
  const forzado = inicio ? relojForzado(inicio, datos?.carrera?.minutos_por_vuelta, ahora) : null;
  const r = forzado && datos ? { ...datos.reloj, ...forzado } : datos?.reloj;
  const cuentaAtras = r?.empezada ? hasta(r.fin_de_vuelta) : hasta(r?.hora_inicio);
  const quedan = r?.terminada ? 0 : cuentaAtras;

  // El destello de «¡SALIDA!»: cuando la cuenta cruza el cero se enciende
  // cinco segundos, con la hora a la que cruzó. Se mira el latido anterior
  // para no encenderlo al cargar la página en medio de una vuelta ya pasada
  // de hora. La hora se guarda aquí porque un latido después el reloj ya
  // habla de la vuelta siguiente.
  if (quedan !== null && quedan !== undefined && !r?.terminada) {
    if (anterior.current !== null && anterior.current > 0 && quedan <= 0) {
      destello.current = { hasta: Date.now() + 5000, en: new Date(ahora).toISOString() };
    }
    anterior.current = quedan;
  }

  return {
    datos,
    error,
    anuncio,
    reloj: r,
    ahora,
    // Lo que queda de la vuelta en curso, o para la salida si no ha empezado
    cuentaAtras: quedan,
    esperandoSalida: !!r && !r.empezada,
    // Mientras dura el destello, la hora de la salida que acaba de darse
    salida: destello.current && Date.now() < destello.current.hasta ? { en: destello.current.en } : null,
    tick,
  };
}
