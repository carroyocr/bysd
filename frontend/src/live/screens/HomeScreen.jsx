import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Radio, Trophy, MessageCircle, Clock } from 'lucide-react';
import { API, getJson, raceStartMs } from '../liveApi';
import { useRace } from '../LiveApp';
import AdFooter from '../components/AdFooter';

/**
 * Home de la carrera: imagen del evento a pantalla completa, logo centrado,
 * menú y SOS sobre la imagen, y accesos rápidos abajo (estilo app de maratón).
 */
export default function HomeScreen() {
  const { raceCode, race, openDrawer } = useRace();
  const navigate = useNavigate();
  const [fondo, setFondo] = useState(null);
  const [hasWinner, setHasWinner] = useState(null);
  const [now, setNow] = useState(Date.now());

  const startMs = raceStartMs(race);
  const started = startMs != null && now >= startMs;

  // Tic de 1s: el contador corre en vivo
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // EN VIVO solo si ya arrancó y no hay ganador declarado
  useEffect(() => {
    if (!started) return;
    getJson(`/api/race/stats?race_code=${raceCode}`)
      .then((s) => setHasWinner(!!s?.winner))
      .catch(() => {});
  }, [started, raceCode]);

  // El sufijo de versión evita que el navegador muestre una portada vieja
  // cuando se reemplaza (el archivo conserva el mismo nombre).
  const version = race?.updated_at ? `?v=${encodeURIComponent(race.updated_at)}` : '';
  const portadaConfigurada = race?.portada_url
    ? `${race.portada_url.startsWith('/api') ? `${API}${race.portada_url}` : race.portada_url}${version}`
    : null;
  const portada = fondo || portadaConfigurada;

  // Fondo: una foto al azar entre las curadas como aptas (sin caras bajo el
  // logo). Si no hay curadas, cae a la portada configurada o al álbum.
  useEffect(() => {
    if (!race) return;
    getJson(`/api/race-config/live-photos/${raceCode}`)
      .then((d) => {
        const aptas = (d.photos || []).filter((p) => p.fondo);
        if (aptas.length) {
          const elegida = aptas[Math.floor(Math.random() * aptas.length)];
          setFondo(`${API}${elegida.url}`);
        } else if (!race.portada_url) {
          return getJson('/api/album/photos').then((a) => {
            const foto = a.photos?.[0]?.url;
            if (foto) setFondo(`${foto}=w1080`);
          });
        }
      })
      .catch(() => {});
  }, [race, raceCode]);

  const logo = race?.logo_home_url || race?.logo_url;
  const logoSrc = logo ? (logo.startsWith('/api') ? `${API}${logo}` : logo) : null;

  const quickActions = [
    { label: 'Seguimiento', Icon: Radio, to: `/live/${raceCode}/seguimiento` },
    { label: 'Ganadores', Icon: Trophy, to: `/live/${raceCode}/ganadores` },
    { label: 'Ánimo', Icon: MessageCircle, to: `/live/${raceCode}/animo` },
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
        <div className="relative z-10 flex items-center justify-between px-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
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
          {started && hasWinner === false && (
            <span className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-extrabold tracking-widest bg-black/50 backdrop-blur px-3 py-1.5 rounded-full text-green-400">
              <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_10px_#4ade80] animate-pulse" /> EN VIVO
            </span>
          )}
        </div>

        {/* Cuenta regresiva: protagónica pero abajo, donde no tapa caras en
            las fotos curadas del fondo */}
        {!started && startMs != null && (
          <div className="relative z-10 mt-auto mb-4 mx-auto bg-black/55 backdrop-blur rounded-2xl px-5 py-3 text-center">
            <p className="text-[9px] font-extrabold tracking-[0.3em] text-[#F5A623] mb-1.5 flex items-center justify-center gap-1.5">
              <Clock className="w-3 h-3" /> INICIA EN
            </p>
            <div className="flex items-baseline justify-center gap-3 font-mono">
              {(() => {
                const ms = Math.max(0, startMs - now);
                const seg = [
                  [Math.floor(ms / 86400000), 'DÍAS'],
                  [Math.floor((ms % 86400000) / 3600000), 'HRS'],
                  [Math.floor((ms % 3600000) / 60000), 'MIN'],
                  [Math.floor((ms % 60000) / 1000), 'SEG'],
                ];
                return seg.map(([v, label]) => (
                  <div key={label}>
                    <div className="text-2xl font-extrabold text-white leading-none">
                      {String(v).padStart(2, '0')}
                    </div>
                    <div className="text-[8px] tracking-widest text-white/60 mt-1">{label}</div>
                  </div>
                ));
              })()}
            </div>
          </div>
        )}

        {/* Accesos rápidos */}
        <div className="relative z-10 mt-auto px-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
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
