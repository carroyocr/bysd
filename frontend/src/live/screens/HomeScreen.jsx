import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Radio, Trophy, MessageCircle } from 'lucide-react';
import { API, getJson } from '../liveApi';
import { useRace } from '../LiveApp';
import AdFooter from '../components/AdFooter';

/**
 * Home de la carrera: imagen del evento a pantalla completa, logo centrado,
 * menú y SOS sobre la imagen, y accesos rápidos abajo (estilo app de maratón).
 */
export default function HomeScreen() {
  const { raceCode, race, openDrawer } = useRace();
  const navigate = useNavigate();
  const [albumFallback, setAlbumFallback] = useState(null);

  const portada = race?.portada_url
    ? (race.portada_url.startsWith('/api') ? `${API}${race.portada_url}` : race.portada_url)
    : albumFallback;

  // Sin portada configurada: primera foto del evento (o del álbum como último recurso)
  useEffect(() => {
    if (race && !race.portada_url) {
      getJson(`/api/race-config/live-photos/${raceCode}`)
        .then((d) => {
          const first = d.photos?.[0]?.url;
          if (first) {
            setAlbumFallback(`${API}${first}`);
          } else {
            return getJson('/api/album/photos').then((a) => {
              const foto = a.photos?.[0]?.url;
              if (foto) setAlbumFallback(`${foto}=w1080`);
            });
          }
        })
        .catch(() => {});
    }
  }, [race, raceCode]);

  const logo = race?.logo_home_url || race?.logo_url;
  const logoSrc = logo ? (logo.startsWith('/api') ? `${API}${logo}` : logo) : null;

  const quickActions = [
    { label: 'Seguimiento', Icon: Radio, to: `/live/${raceCode}/seguimiento` },
    { label: 'Ganadores', Icon: Trophy, to: `/live/${raceCode}/ganadores` },
    { label: 'Ánimo', Icon: MessageCircle, to: `/live/${raceCode}/seguimiento` },
  ];

  return (
    <div className="min-h-[100dvh] bg-[#0C0C0C] text-white flex flex-col">
      <div className="w-full max-w-md mx-auto flex flex-col flex-1 min-h-[100dvh] relative">

        {/* Imagen de fondo del evento */}
        <div className="absolute inset-0 overflow-hidden">
          {portada ? (
            <img src={portada} alt={race?.name || 'Evento'} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-b from-[#1a1208] via-[#0C0C0C] to-[#000000]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/75" />
        </div>

        {/* Controles superiores sobre la imagen */}
        <div className="relative z-10 flex items-center justify-between px-3 pt-3">
          <button
            aria-label="Menú"
            onClick={openDrawer}
            className="w-11 h-11 rounded-xl bg-black/45 backdrop-blur flex items-center justify-center"
          >
            <Menu className="w-6 h-6" />
          </button>
          <button
            aria-label="SOS"
            onClick={() => navigate(`/live/${raceCode}/sos`)}
            className="bg-white text-red-600 text-[11px] font-extrabold rounded-full w-11 h-11 flex items-center justify-center shadow-lg"
          >
            SOS
          </button>
        </div>

        {/* Logo / nombre del evento */}
        <div className="relative z-10 flex flex-col items-center mt-6 px-6">
          {logoSrc ? (
            <img src={logoSrc} alt={race?.name} className="max-h-40 max-w-[70%] object-contain drop-shadow-[0_4px_18px_rgba(0,0,0,0.6)]" />
          ) : (
            <h1 className="text-3xl font-extrabold text-center drop-shadow-lg">
              {race?.name || 'Backyard Ultra Santo Domingo'}
            </h1>
          )}
          {race?.is_active && (
            <span className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-extrabold tracking-widest bg-black/50 backdrop-blur px-3 py-1.5 rounded-full text-green-400">
              <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_10px_#4ade80] animate-pulse" /> EN VIVO
            </span>
          )}
        </div>

        {/* Accesos rápidos */}
        <div className="relative z-10 mt-auto pb-5 px-6">
          <div className="flex justify-center gap-8">
            {quickActions.map(({ label, Icon, to }) => (
              <button key={label} onClick={() => navigate(to)} className="flex flex-col items-center gap-2">
                <span className="w-16 h-16 rounded-full bg-black/55 backdrop-blur border border-white/15 flex items-center justify-center">
                  <Icon className="w-7 h-7 text-[#E77622]" strokeWidth={2} />
                </span>
                <span className="text-xs font-semibold drop-shadow">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <AdFooter raceCode={raceCode} />
        </div>
      </div>
    </div>
  );
}
