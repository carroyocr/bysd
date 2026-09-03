import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { API, getJson, postJson } from '../liveApi';
import { useLiveTheme } from '../liveTheme';
import { openExternal } from '../../lib/nativeExport';

const AD_ROTATE_MS = 8000;
const DESLIZ_MINIMO = 45;   // px horizontales para contarlo como pasar de banner

/**
 * Pie publicitario fijo: rota banners ponderados por peso y acumula métricas.
 *
 * Con `inline` deja de ser pie y se queda donde se le ponga, dentro del
 * contenido: lo usa el tablero, donde el patrocinador va entre los corredores
 * y el clima en vez de pegado al borde de abajo.
 */
export default function AdFooter({ raceCode, sobreFoto = false, inline = false }) {
  const { T, theme } = useLiveTheme();
  const navigate = useNavigate();
  // Color propio: la portada de la carrera fuerza texto blanco sobre la foto
  // y en modo claro la tarjeta es blanca, así que el nombre se perdía.
  const cardText = theme === 'dark' ? 'text-white' : 'text-[#232323]';
  const [banners, setBanners] = useState([]);
  const [index, setIndex] = useState(0);
  // Cada pase a mano lo incrementa y con eso reinicia el reloj de la rotacion:
  // si acabas de pasar tu al siguiente, lo ultimo que quieres es que se te
  // cambie solo medio segundo despues.
  const [giro, setGiro] = useState(0);
  const gesto = useRef(null);
  const arrastro = useRef(false);
  const impressionsSent = useRef(new Set());

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
        if (!cancel) setBanners(lista || []);
      } catch {
        /* sin publicidad no se rompe nada */
      }
    };
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

  useEffect(() => {
    if (!ad || ad.is_sponsor_fallback || impressionsSent.current.has(ad.id)) return;
    impressionsSent.current.add(ad.id);
    postJson('/api/ads/track', { banner_id: ad.id, event: 'impression' }).catch(() => {});
  }, [ad]);

  if (!ad) return null;

  const handleClick = () => {
    // El clic que el navegador manda despues de un deslizamiento no abre nada.
    if (arrastro.current) { arrastro.current = false; return; }
    if (!ad.is_sponsor_fallback) {
      postJson('/api/ads/track', { banner_id: ad.id, event: 'click' }).catch(() => {});
    }
    // Con imagen ampliada el patrocinador se lee dentro de la app; solo se sale
    // al navegador cuando no hay nada más que enseñar aquí.
    if (ad.detail_url && raceCode) {
      navigate(`/live/${raceCode}/patrocinador/${ad.id}`);
      return;
    }
    if (ad.link_url) {
      const url = ad.link_url.startsWith('http') ? ad.link_url : `https://${ad.link_url}`;
      openExternal(url);
    }
  };

  const bannerCompleto = !!ad.banner_url;
  // En línea no es el pie de la pantalla, es un bloque más del contenido.
  const Caja = inline ? 'div' : 'footer';

  return (
    // Fondo propio y no transparente: el pie va pegado abajo mientras se
    // desplaza la pantalla, y sin fondo el texto de detrás se colaba por los
    // márgenes de la tarjeta y parecía que la publicidad tapaba la lectura.
    // Sobre la portada del inicio no: ahí la banda taparía la foto, y no hay
    // texto que se cuele porque no se desplaza nada por detrás.
    <Caja
      className={
        inline
          ? 'px-4 py-1'
          : `sticky bottom-0 z-40 px-4 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] ${sobreFoto ? '' : `${T.page} ${T.footerShadow}`}`
      }
    >
      {/* Proporción fija en vez de alto fijo: el ancho de la barra cambia con
          cada teléfono, así que con un alto fijo la pieza del patrocinador se
          deformaría o se recortaría en casi todos. Con 5:1 la imagen llena la
          barra exacta en cualquier pantalla.
          Sin tarjeta detrás: el pie ya es una banda con su propio fondo, y una
          tarjeta encima de otra solo añade un borde que no separa nada. Sobre
          la portada del inicio sí hace falta, que ahí no hay banda y el logo
          quedaría suelto sobre la foto. */}
      <button
        onClick={handleClick}
        onTouchStart={alEmpezarGesto}
        onTouchMove={alMoverGesto}
        onTouchEnd={alSoltarGesto}
        onTouchCancel={() => { gesto.current = null; }}
        // Horizontal lo gobierna el gesto; vertical se lo queda la pantalla,
        // que debajo del pie sigue habiendo contenido que desplazar.
        style={{ touchAction: 'pan-y' }}
        className={`w-full aspect-[5/1] flex items-center gap-3 relative text-left rounded-2xl overflow-hidden ${bannerCompleto ? '' : 'px-3.5'} ${sobreFoto ? `shadow-lg ${T.card}` : ''} ${cardText}`}
      >
        {bannerCompleto ? (
          <img
            src={`${API}${ad.banner_url}`}
            alt={ad.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <>
            {ad.logo_url ? (
              <img
                src={`${API}${ad.logo_url}`}
                alt={ad.name}
                className="w-12 h-12 rounded-xl object-contain bg-white shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-[#F2E8C7] text-[#333333] flex items-center justify-center text-[10px] font-extrabold shrink-0">
                {ad.name?.slice(0, 6)}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[13px] font-bold truncate">{ad.name}</p>
              {ad.text && <p className={`text-[11px] truncate ${T.muted}`}>{ad.text}</p>}
            </div>
          </>
        )}

        {/* La nota de publicidad va en voz baja: tiene que estar para que se
            distinga de lo que es contenido de la app, pero sin disputarle el
            sitio al nombre del patrocinador. Cada banner decide si la lleva:
            hay piezas que ya dicen de quién son. */}
        {ad.mostrar_marca !== false && (
          <span className={`absolute top-1 right-3 text-[7px] tracking-[0.18em] uppercase ${bannerCompleto ? 'text-white/45 drop-shadow' : `${T.subtle} opacity-70`}`}>
            Patrocinador
          </span>
        )}

        {/* Sin puntos de rotación: con dos docenas de patrocinadores era una
            fila de puntos de lado a lado que no dice nada, porque no se puede
            saltar de uno a otro. El banner cambia solo cada pocos segundos. */}
      </button>
    </Caja>
  );
}
