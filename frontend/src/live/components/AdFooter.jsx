import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { API, getJson, postJson } from '../liveApi';
import { useLiveTheme } from '../liveTheme';
import { openExternal } from '../../lib/nativeExport';

const AD_ROTATE_MS = 8000;

/**
 * Pie publicitario fijo: rota banners ponderados por peso y acumula métricas.
 */
export default function AdFooter({ raceCode }) {
  const { T, theme } = useLiveTheme();
  const navigate = useNavigate();
  // Color propio: la portada de la carrera fuerza texto blanco sobre la foto
  // y en modo claro la tarjeta es blanca, así que el nombre se perdía.
  const cardText = theme === 'dark' ? 'text-white' : 'text-[#232323]';
  const [banners, setBanners] = useState([]);
  const [index, setIndex] = useState(0);
  const impressionsSent = useRef(new Set());

  useEffect(() => {
    let cancel = false;
    const load = async () => {
      try {
        const data = await getJson(`/api/ads/public${raceCode ? `?race_code=${raceCode}` : ''}`);
        if (data.length > 0) {
          if (!cancel) setBanners(data);
          return;
        }
        // Sin banners de publicidad: caer a los patrocinadores publicados de
        // la carrera; si esa carrera tampoco tiene, usar los de la carrera
        // activa para que el pie no quede vacío.
        let sponsors = [];
        let code = raceCode;
        if (code) {
          ({ sponsors } = await getJson(`/api/sponsors/race/${code}`));
        }
        if (!sponsors || sponsors.length === 0) {
          const active = await getJson('/api/race-config/active');
          if (active?.code && active.code !== code) {
            code = active.code;
            ({ sponsors } = await getJson(`/api/sponsors/race/${code}`));
          }
        }
        const fallback = (sponsors || []).map((s, i) => ({
          id: `sponsor-${code}-${i}`,
          name: s.name,
          text: s.description || null,
          logo_url: s.logo_url || null,
          link_url: s.instagram
            ? (s.instagram.startsWith('http') ? s.instagram : `https://instagram.com/${s.instagram.replace('@', '')}`)
            : null,
          is_sponsor_fallback: true,
        }));
        if (!cancel) setBanners(fallback);
      } catch {
        /* sin publicidad no se rompe nada */
      }
    };
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => { cancel = true; clearInterval(id); };
  }, [raceCode]);

  const playlist = useMemo(() => {
    const list = [];
    banners.forEach((b) => {
      for (let i = 0; i < Math.max(1, b.weight || 1); i++) list.push(b);
    });
    return list;
  }, [banners]);

  useEffect(() => {
    if (playlist.length <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % playlist.length), AD_ROTATE_MS);
    return () => clearInterval(id);
  }, [playlist.length]);

  const ad = playlist.length ? playlist[index % playlist.length] : null;

  useEffect(() => {
    if (!ad || ad.is_sponsor_fallback || impressionsSent.current.has(ad.id)) return;
    impressionsSent.current.add(ad.id);
    postJson('/api/ads/track', { banner_id: ad.id, event: 'impression' }).catch(() => {});
  }, [ad]);

  if (!ad) return null;

  const handleClick = () => {
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

  return (
    // Fondo propio y no transparente: el pie va pegado abajo mientras se
    // desplaza la pantalla, y sin fondo el texto de detrás se colaba por los
    // márgenes de la tarjeta y parecía que la publicidad tapaba la lectura.
    <footer className={`sticky bottom-0 z-40 px-4 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] ${T.page}`}>
      {/* Proporción fija en vez de alto fijo: el ancho de la barra cambia con
          cada teléfono, así que con un alto fijo la pieza del patrocinador se
          deformaría o se recortaría en casi todos. Con 5:1 la imagen llena la
          barra exacta en cualquier pantalla. */}
      <button
        onClick={handleClick}
        className={`w-full aspect-[5/1] flex items-center gap-3 relative text-left rounded-2xl shadow-lg overflow-hidden ${bannerCompleto ? '' : 'px-3.5'} ${T.card} ${cardText}`}
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

        <span className={`absolute top-1 right-3 text-[8px] tracking-widest uppercase ${bannerCompleto ? 'text-white/70 drop-shadow' : T.subtle}`}>
          Patrocinador
        </span>

        {banners.length > 1 && (
          <div className={`absolute bottom-1.5 right-3 flex gap-1.5 ${bannerCompleto ? '' : ''}`}>
            {banners.map((b) => (
              <span
                key={b.id}
                className={`w-1.5 h-1.5 rounded-full ${b.id === ad.id ? 'bg-[#E77622]' : 'bg-gray-500/40'}`}
              />
            ))}
          </div>
        )}
      </button>
    </footer>
  );
}
