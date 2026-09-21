import { useLayoutEffect, useState } from 'react';

/**
 * El tamaño de letra con el que `texto` cabe en una línea dentro de `ref`.
 *
 * Empieza en `max` y baja de punto en punto hasta que el texto deja de
 * desbordar, sin pasar de `min`; por debajo de ahí se corta con puntos
 * suspensivos. Se mide en vez de adivinarlo por el número de letras porque
 * el ancho cambia con cada teléfono y con cada letra: una W ocupa el doble
 * que una I. Vuelve a medir si cambia el ancho de la caja que lo contiene.
 */
export default function useTextoQueCabe(ref, texto, { max = 28, min = 16 } = {}) {
  const [tamano, setTamano] = useState(max);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const ajustar = () => {
      let t = max;
      el.style.fontSize = `${t}px`;
      while (t > min && el.scrollWidth > el.clientWidth) {
        t -= 1;
        el.style.fontSize = `${t}px`;
      }
      setTamano(t);
    };

    ajustar();
    // La fuente de los títulos llega por la red: medido antes de que cargue,
    // el ancho sería el de la letra de respaldo.
    document.fonts?.ready?.then(ajustar).catch(() => {});

    if (typeof ResizeObserver === 'undefined') return undefined;
    const observador = new ResizeObserver(ajustar);
    observador.observe(el.parentElement || el);
    return () => observador.disconnect();
  }, [ref, texto, max, min]);

  return tamano;
}
