import { useCallback, useEffect, useRef, useState } from 'react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Cada cuánto se pregunta por mensajes nuevos. Cinco segundos: un mensaje
// recién escrito sale en pantalla casi al momento y el muro no se machaca.
const CADA_MS = 5000;
// Cuántos se piden: de sobra para que los nuevos de un latido quepan y para
// la rotación de los últimos.
const PEDIR = 30;

/**
 * Qué mensaje toca enseñar ahora. Es la parte que se puede probar sin red.
 *
 * `cola` son los que llegaron nuevos y aún no han salido, en el orden en que
 * se escribieron; `recientes` es lo último que contestó el servidor (del más
 * nuevo al más viejo) y es la lista de confianza: lo que ya no está ahí se
 * reportó o lo borró el corredor, y no sale aunque estuviera en cola. Un
 * mensaje nuevo pasa antes que la rotación; sin nuevos, se rotan los últimos
 * `rotar` del más viejo al más nuevo, siguiendo al que está en pantalla, y
 * con `rotar` en cero la pantalla se queda vacía hasta que escriban.
 * `esperaSeg` retiene cada mensaje ese tiempo desde que se publicó, para que
 * un reporte llegue antes que la pantalla.
 */
export function elegir({ cola, recientes, rotar, actualId, ahora, esperaSeg = 0 }) {
  const vivos = new Set(recientes.map((m) => m.id));
  const listo = (m) => {
    if (!esperaSeg || !m.created_at) return true;
    return ahora - new Date(m.created_at).getTime() >= esperaSeg * 1000;
  };
  // Los escondidos se van de la cola; los que aún no cumplen la espera se
  // quedan para el siguiente turno.
  const pendientes = cola.filter((m) => vivos.has(m.id));
  const i = pendientes.findIndex(listo);
  if (i >= 0) return { mensaje: pendientes[i], cola: pendientes.filter((_, j) => j !== i) };
  if (!rotar) return { mensaje: null, cola: pendientes };

  const ciclo = recientes.slice(0, rotar).filter(listo).reverse();
  if (!ciclo.length) return { mensaje: null, cola: pendientes };
  const pos = ciclo.findIndex((m) => m.id === actualId);
  return { mensaje: ciclo[(pos + 1) % ciclo.length], cola: pendientes };
}

/**
 * Los mensajes de apoyo del muro, de uno en uno, para la transmisión.
 *
 * Se pregunta al muro cada pocos segundos y lo que llega nuevo se pone en
 * cola: cada mensaje ocupa la pantalla `segundos` y entra el siguiente. Sin
 * nada nuevo, se rotan los últimos `rotar` para que la fuente no quede en
 * blanco; con `rotar` en cero sale solo lo que se va escribiendo. Los de la
 * primera carga son historia, no novedad: no se anuncian, se rotan.
 */
export default function useMensajes({ raceCode, activo = true, segundos = 10, rotar = 10, esperaSeg = 0 }) {
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);

  const recientes = useRef([]);     // la última respuesta del servidor
  const conocidos = useRef(null);   // ids ya vistos en alguna respuesta
  const cola = useRef([]);          // nuevos aún sin enseñar
  const actual = useRef(null);      // el que está en pantalla
  const temporizador = useRef(null);
  const cargado = useRef(false);

  const avanzar = useCallback(() => {
    clearTimeout(temporizador.current);
    const r = elegir({
      cola: cola.current,
      recientes: recientes.current,
      rotar,
      actualId: actual.current?.id,
      ahora: Date.now(),
      esperaSeg,
    });
    cola.current = r.cola;
    actual.current = r.mensaje;
    setMensaje(r.mensaje);
    // Con algo en pantalla, el turno dura lo suyo. En blanco no hay turno:
    // el próximo latido con novedades lo pone en marcha.
    if (r.mensaje) temporizador.current = setTimeout(avanzar, Math.max(3, segundos) * 1000);
  }, [rotar, segundos, esperaSeg]);

  const pedir = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: String(PEDIR) });
      if (raceCode) params.set('race_code', raceCode);
      const res = await fetch(`${API_URL}/api/race/cheers?${params}`);
      if (!res.ok) {
        if (!cargado.current) setError('No se pudieron cargar los mensajes');
        return;
      }
      const datos = await res.json();
      const lista = datos.messages || [];
      recientes.current = lista;
      setError(null);
      cargado.current = true;

      if (conocidos.current === null) {
        conocidos.current = new Set(lista.map((m) => m.id));
      } else {
        // Vienen del más nuevo al más viejo; se encolan como se escribieron
        const nuevos = lista.filter((m) => !conocidos.current.has(m.id)).reverse();
        nuevos.forEach((m) => { conocidos.current.add(m.id); cola.current.push(m); });
      }
      if (!actual.current) avanzar();
    } catch {
      if (!cargado.current) setError('Sin conexión con el servidor');
    }
  }, [raceCode, avanzar]);

  useEffect(() => {
    if (!activo) return undefined;
    pedir();
    const id = setInterval(pedir, CADA_MS);
    return () => { clearInterval(id); clearTimeout(temporizador.current); };
  }, [pedir, activo]);

  return { mensaje, error };
}
