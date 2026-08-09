import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// El gesto tiene que empezar pegado a un borde: así no se confunde con el
// arrastre de una lista horizontal (los chips de Seguimiento, el carrusel de
// patrocinadores) ni con el desplazamiento normal de la pantalla.
const ZONA_BORDE = 32;   // px desde el borde donde se admite el inicio
const RECORRIDO = 70;    // px horizontales mínimos para contarlo como gesto
const DESVIO = 50;       // px verticales máximos: más que esto es un scroll
const DURACION = 700;    // ms: un arrastre lento no es un gesto de volver

/**
 * Volver atrás deslizando el dedo desde un borde de la pantalla.
 *
 * Android ya trae el gesto del sistema, pero en iOS el WebView de Capacitor no
 * lo tiene, así que la app se quedaba sin forma de retroceder que no fuese la
 * flecha de la barra. Se admiten los dos sentidos —desde el borde derecho hacia
 * la izquierda y desde el izquierdo hacia la derecha— para que funcione igual
 * venga el usuario de un teléfono o del otro.
 *
 * Solo se activa donde la barra superior muestra la flecha de volver: en las
 * pantallas de primer nivel no hay paso atrás al que ir.
 */
export default function useSwipeBack(activo) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!activo) return undefined;

    let gesto = null;

    const onStart = (e) => {
      gesto = null;
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      const ancho = window.innerWidth;
      const desdeIzquierda = t.clientX <= ZONA_BORDE;
      const desdeDerecha = t.clientX >= ancho - ZONA_BORDE;
      if (!desdeIzquierda && !desdeDerecha) return;
      gesto = { x: t.clientX, y: t.clientY, t: Date.now(), sentido: desdeIzquierda ? 1 : -1 };
    };

    // Un segundo dedo (pellizco para ampliar una foto) cancela el gesto.
    const onMove = (e) => {
      if (gesto && e.touches.length > 1) gesto = null;
    };

    const onEnd = (e) => {
      const inicio = gesto;
      gesto = null;
      if (!inicio) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - inicio.x;
      const dy = t.clientY - inicio.y;
      if (Date.now() - inicio.t > DURACION) return;
      if (Math.abs(dy) > DESVIO) return;
      if (dx * inicio.sentido < RECORRIDO) return;   // hacia dentro de la pantalla
      navigate(-1);
    };

    const onCancel = () => { gesto = null; };

    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    window.addEventListener('touchcancel', onCancel, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onCancel);
    };
  }, [activo, navigate]);
}
