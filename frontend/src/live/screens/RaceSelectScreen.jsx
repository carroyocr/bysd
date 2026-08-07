import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, CalendarDays, MapPin, Loader2 } from 'lucide-react';
import { API, getJson } from '../liveApi';
import { useLiveTheme } from '../liveTheme';

const fmtDate = (iso) => {
  if (!iso) return '';
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString('es-DO', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch {
    return iso;
  }
};

/**
 * Capa de selección de carrera: actuales/próximas arriba, pasadas abajo.
 */
export default function RaceSelectScreen() {
  const { T } = useLiveTheme();
  const navigate = useNavigate();
  const [races, setRaces] = useState(null);

  useEffect(() => {
    let cancel = false;
    getJson('/api/race-config/all')
      .then((data) => { if (!cancel) setRaces(data.races || []); })
      .catch(() => { if (!cancel) setRaces([]); });
    return () => { cancel = true; };
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const actuales = (races || []).filter((r) => r.is_active || (r.date && r.date >= today && !r.archived_at));
  const pasadas = (races || []).filter((r) => !actuales.includes(r));

  const raceCard = (race) => (
    <button
      key={race.code}
      onClick={() => navigate(`/live/${race.code}`)}
      className={`w-full flex items-center gap-3.5 rounded-2xl px-4 py-4 mb-3 text-left ${T.card}`}
    >
      {race.logo_url ? (
        <img
          src={race.logo_url.startsWith('/api') ? `${API}${race.logo_url}` : race.logo_url}
          alt={race.name}
          className="w-14 h-14 rounded-xl object-contain bg-white/90 shrink-0"
        />
      ) : (
        <div className={`w-14 h-14 rounded-xl flex items-center justify-center font-extrabold text-sm shrink-0 ${T.avatar}`}>
          {race.code?.slice(-2)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-bold text-[15px] leading-tight">{race.name}</p>
        </div>
        <p className={`text-xs mt-1 flex items-center gap-1.5 ${T.muted}`}>
          <CalendarDays className="w-3.5 h-3.5 shrink-0" /> {fmtDate(race.date)}
        </p>
        {race.location && (
          <p className={`text-xs mt-0.5 flex items-center gap-1.5 truncate ${T.muted}`}>
            <MapPin className="w-3.5 h-3.5 shrink-0" /> {race.location}
          </p>
        )}
        {race.is_active && (
          <span className="inline-flex items-center gap-1.5 mt-1.5 text-[10px] font-extrabold tracking-wider text-green-500">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_8px_#4ade80]" /> EN VIVO
          </span>
        )}
      </div>
      <ChevronRight className={`w-5 h-5 shrink-0 ${T.subtle}`} />
    </button>
  );

  return (
    <div className={`min-h-[100dvh] ${T.page}`}>
      <div className="w-full max-w-md mx-auto px-4 pt-10 pb-8">
        <h1 className="text-2xl font-extrabold">
          BYSD <span className="text-[#E77622]">LIVE</span>
        </h1>
        <p className={`text-sm mt-1 mb-7 ${T.muted}`}>Elige la carrera que quieres seguir</p>

        {races === null && (
          <div className={`flex justify-center py-16 ${T.muted}`}>
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        )}

        {races !== null && (
          <>
            {actuales.length > 0 && (
              <>
                <p className={`text-[11px] font-bold tracking-[0.18em] uppercase mb-2.5 ${T.subtle}`}>
                  En curso y próximas
                </p>
                {actuales.map(raceCard)}
              </>
            )}
            {pasadas.length > 0 && (
              <>
                <p className={`text-[11px] font-bold tracking-[0.18em] uppercase mt-6 mb-2.5 ${T.subtle}`}>
                  Carreras pasadas
                </p>
                {pasadas.map(raceCard)}
              </>
            )}
            {races.length === 0 && (
              <p className={`text-sm text-center py-16 ${T.muted}`}>No hay carreras disponibles.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
