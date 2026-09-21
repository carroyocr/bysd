import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { getJson, postJson } from '../liveApi';
import { openExternal } from '../../lib/nativeExport';
import useTextoQueCabe from '../../hooks/useTextoQueCabe';

const AD_ROTATE_MS = 8000;
const CACHE_PIE = 'bysd_ads_pie';

// La lista del pie, guardada en el telefono. Sin esto el pie sale vacio cada
// vez que se abre la app y no aparece nadie hasta que contesta el servidor;
// las imagenes ya las tiene el navegador en su cache, asi que con la lista a
// mano la publicidad se pinta al instante y el servidor solo confirma.
const leerCache = (code) => {
  try {
    const crudo = localStorage.getItem(`${CACHE_PIE}_${code || 'activa'}`);
    const lista = crudo ? JSON.parse(crudo) : null;
    return Array.isArray(lista) ? lista : null;
  } catch {
    return null;   // navegacion privada, o un guardado de otra version
  }
};

const guardarCache = (code, lista) => {
  try {
    localStorage.setItem(`${CACHE_PIE}_${code || 'activa'}`, JSON.stringify(lista));
  } catch {
    /* sin sitio o sin permiso: el pie sigue funcionando con la red */
  }
};
const DESLIZ_MINIMO = 45;   // px horizontales para contarlo como pasar de banner

/**
 * Pie publicitario fijo: rota banners ponderados por peso y acumula métricas.
 *
 * Con `inline` deja de ser pie y se queda donde se le ponga, dentro del
 * contenido: lo usa el tablero, donde el patrocinador va entre los corredores
 * y el clima en vez de pegado al borde de abajo.
 */
export default function AdFooter({ raceCode, sobreFoto = false, inline = false }) {
  const navigate = useNavigate();
  const [banners, setBanners] = useState([]);
  const [index, setIndex] = useState(0);
  // Cada pase a mano lo incrementa y con eso reinicia el reloj de la rotacion:
  // si acabas de pasar tu al siguiente, lo ultimo que quieres es que se te
  // cambie solo medio segundo despues.
  const [giro, setGiro] = useState(0);
  const gesto = useRef(null);
  const arrastro = useRef(false);
  const impressionsSent = useRef(new Set());
  const refNombre = useRef(null);

  useEffect(() => {
    let cancel = false;
    let ultimaCarga = 0;
    // Quién va en el pie lo decide el backend. Antes el respaldo a los
    // patrocinadores publicados se hacía aquí, y desde aquí no se distingue
    // "esta carrera no tiene publicidad" de "la tiene toda pausada": al pausar
    // el único banner, el pie resucitaba al mismo patrocinador y pausar no
    // servía de nada.
    const load = async () => {
      ultimaCarga = Date.now();
      try {
        const { banners: lista } = await getJson(
          `/api/ads/pie${raceCode ? `?race_code=${raceCode}` : ''}`
        );
        if (cancel) return;
        setBanners(lista || []);
        // Se guarda tambien la lista vacia: pausar al ultimo patrocinador
        // tiene que vaciar el pie tambien en el proximo arranque.
        guardarCache(raceCode, lista || []);
      } catch {
        /* sin publicidad no se rompe nada */
      }
    };
    const guardado = leerCache(raceCode);
    if (guardado) setBanners(guardado);
    load();

    // Volver a la app es el momento en que la lista tiene de verdad
    // posibilidades de haber cambiado: se toca un patrocinador en el panel y
    // se pasa al telefono a mirarlo. Preguntar cada pocos segundos daria lo
    // mismo a costa de que cada telefono abierto llame al backend todo el
    // rato, y en carrera son cientos. El repaso periodico se queda de red,
    // para el telefono que lleva horas encendido en la mesa de control.
    const refrescar = () => { if (Date.now() - ultimaCarga > 10000) load(); };
    const alVolver = () => { if (document.visibilityState === 'visible') refrescar(); };
    document.addEventListener('visibilitychange', alVolver);

    // En el movil el evento del sistema es mas fiable que el del documento:
    // el WebView no siempre marca la pestana como oculta al minimizar.
    let suscripcion;
    let vivo = true;
    if (Capacitor.isNativePlatform()) {
      CapApp.addListener('appStateChange', ({ isActive }) => { if (isActive) refrescar(); })
        .then((h) => { if (vivo) suscripcion = h; else h.remove(); });
    }

    const id = setInterval(load, 5 * 60 * 1000);
    return () => {
      cancel = true;
      vivo = false;
      clearInterval(id);
      document.removeEventListener('visibilitychange', alVolver);
      suscripcion?.remove();
    };
  }, [raceCode]);

  const playlist = useMemo(() => {
    const list = [];
    banners.forEach((b) => {
      for (let i = 0; i < Math.max(1, b.weight || 1); i++) list.push(b);
    });
    // Barajada. El pie arrancaba siempre por el primero de la lista y seguía
    // el mismo orden en todos los teléfonos: quien abría la app un minuto veía
    // a los dos primeros patrocinadores y a nadie más, y el último de la lista
    // no se veía nunca. El peso se sigue respetando -sale más veces quien más
    // pesa-, pero el turno se reparte al azar.
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }, [banners]);

  useEffect(() => {
    if (playlist.length <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % playlist.length), AD_ROTATE_MS);
    return () => clearInterval(id);
  }, [playlist.length, giro]);

  // Pasar de banner con el dedo, en los dos sentidos. Salta las repeticiones
  // del mismo patrocinador: la baraja lleva una carta por cada punto de peso,
  // asi que el hueco siguiente suele ser el mismo de nuevo, y quien desliza el
  // dedo espera ver otro anuncio, no el que ya estaba.
  const pasar = (dir) => {
    if (playlist.length <= 1) return;
    setIndex((i) => {
      const actual = playlist[i % playlist.length]?.id;
      let n = i % playlist.length;
      for (let k = 0; k < playlist.length; k++) {
        n = (n + dir + playlist.length) % playlist.length;
        if (playlist[n]?.id !== actual) break;
      }
      return n;
    });
    setGiro((g) => g + 1);
  };

  const alEmpezarGesto = (e) => {
    arrastro.current = false;
    gesto.current = e.touches.length === 1
      ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
      : null;
  };

  // Un segundo dedo (un pellizco sobre la pantalla) cancela el gesto.
  const alMoverGesto = (e) => { if (e.touches.length > 1) gesto.current = null; };

  const alSoltarGesto = (e) => {
    const inicio = gesto.current;
    gesto.current = null;
    const t = e.changedTouches[0];
    if (!inicio || !t) return;
    const dx = t.clientX - inicio.x;
    const dy = t.clientY - inicio.y;
    if (Math.abs(dx) < DESLIZ_MINIMO || Math.abs(dx) <= Math.abs(dy)) return;
    // El gesto se queda aqui. Sin cortarlo, el mismo deslizamiento abriria
    // ademas la ficha del patrocinador, y empezando pegado a un borde tambien
    // dispararia el "volver atras" de useSwipeBack, que escucha en la ventana.
    e.stopPropagation();
    e.preventDefault();
    arrastro.current = true;
    pasar(dx < 0 ? 1 : -1);
  };

  const ad = playlist.length ? playlist[index % playlist.length] : null;
  // Antes del «return null» de más abajo: un hook no puede ir detrás.
  const tamanoNombre = useTextoQueCabe(refNombre, ad?.name, { max: 28, min: 16 });

  useEffect(() => {
    if (!ad || ad.is_sponsor_fallback || impressionsSent.current.has(ad.id)) return;
    impressionsSent.current.add(ad.id);
    postJson('/api/ads/track', { banner_id: ad.id, event: 'impression' }).catch(() => {});
  }, [ad]);

  if (!ad) return null;

  // Adónde lleva «Conocer más». Si el patrocinador subió una pieza gráfica
  // se enseña dentro de la app, que sacar al usuario al navegador es la forma
  // más rápida de que no vuelva; si no subió nada, se va a su enlace. Sin
  // ninguna de las dos cosas no hay botón: sería un botón que no hace nada.
  const tienePieza = !!(ad.detail_url || ad.banner_url);
  const destino = tienePieza && raceCode ? 'pieza' : ad.link_url ? 'enlace' : null;

  const handleClick = () => {
    // El clic que el navegador manda despues de un deslizamiento no abre nada.
    if (arrastro.current) { arrastro.current = false; return; }
    if (!destino) return;
    if (!ad.is_sponsor_fallback) {
      postJson('/api/ads/track', { banner_id: ad.id, event: 'click' }).catch(() => {});
    }
    if (destino === 'pieza') {
      navigate(`/live/${raceCode}/patrocinador/${ad.id}`);
      return;
    }
    const url = ad.link_url.startsWith('http') ? ad.link_url : `https://${ad.link_url}`;
    openExternal(url);
  };

  // En línea no es el pie de la pantalla, es un bloque más del contenido.
  const Caja = destino ? 'button' : 'div';

  return (
    // Una franja de borde a borde y no una tarjeta: el patrocinador es la
    // última sección de la pantalla, con su filo naranja arriba, en los
    // colores de la app. El banner con el arte de cada marca metía un bloque
    // de otra tipografía y otros colores que no casaba con nada; ese arte no
    // se pierde, se abre con «Conocer más».
    // Oscura en los dos temas y con fondo propio: sobre la foto de la
    // portada o sobre la crema del modo claro, una franja blanca se leía como
    // un recorte pegado encima. Y como pie fijo, sin fondo se colaría por
    // detrás el texto de la pantalla al desplazarla.
    // Con destino toda la franja es el botón, no solo la pastilla: en un pie
    // tan bajo, acertarle a la pastilla con el pulgar cuesta.
    <Caja
      {...(destino ? { type: 'button', onClick: handleClick } : {})}
      onTouchStart={alEmpezarGesto}
      onTouchMove={alMoverGesto}
      onTouchEnd={alSoltarGesto}
      onTouchCancel={() => { gesto.current = null; }}
      // Horizontal lo gobierna el gesto; vertical se lo queda la pantalla,
      // que debajo del pie sigue habiendo contenido que desplazar.
      style={{ touchAction: 'pan-y' }}
      className={`w-full block text-left bg-[#17110C] text-white border-t-2 border-[#E77622] px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] ${
        inline || sobreFoto ? '' : 'sticky bottom-0 z-40'
      }`}
    >
      {/* Abajo, solo el hueco del indicador de inicio y no además un margen
          propio: sumados dejaban la franja con más aire debajo que encima.
          Alto fijo: al rotar, un patrocinador con texto y otro sin él no
          pueden hacer saltar lo que hay encima. */}
      <div className="h-[70px] flex items-center gap-4">
        <div className="min-w-0 flex-1">
          {/* La nota de publicidad va siempre: distingue el anuncio del
              contenido de la app. El interruptor «mostrar_marca» del panel
              era para los banners con el arte de la marca, que ya decían de
              quién eran; aquí solo hay un nombre y hace falta. */}
          <p className="text-[10px] font-bold tracking-[0.3em] uppercase text-[#E77622] mb-1">
            Patrocinador
          </p>
          {/* Los nombres largos bajan de tamaño hasta caber en una línea. */}
          <p
            ref={refNombre}
            style={{ fontSize: tamanoNombre }}
            className="font-display leading-none uppercase tracking-wide truncate"
          >
            {ad.name}
          </p>
          {ad.text && (
            <p className="text-[12px] mt-1 truncate text-[#9a9a9a]">{ad.text}</p>
          )}
        </div>

        {destino && (
          <span className="shrink-0 rounded-full bg-[#E77622] text-[#1a1a1a] text-[13px] font-bold px-5 py-3">
            Conocer más
          </span>
        )}
      </div>

      {/* Sin puntos de rotación: con dos docenas de patrocinadores era una
          fila de puntos de lado a lado que no dice nada, porque no se puede
          saltar de uno a otro. El banner cambia solo cada pocos segundos. */}
    </Caja>
  );
}
