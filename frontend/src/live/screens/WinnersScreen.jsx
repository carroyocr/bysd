import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Medal, Loader2 } from 'lucide-react';
import { getJson, flagOf, initialsOf } from '../liveApi';
import { useLiveTheme } from '../liveTheme';
import { Screen, useRace } from '../LiveApp';

/**
 * Ganadores: último en pie, menciones de honor y, mientras no haya ganador,
 * los corredores con más vueltas.
 */
export default function WinnersScreen() {
  const { T } = useLiveTheme();
  const { raceCode } = useRace();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [participants, setParticipants] = useState(null);

  useEffect(() => {
    let cancel = false;
    Promise.all([
      getJson(`/api/race/stats?race_code=${raceCode}`).catch(() => null),
      getJson(`/api/race/participants?race_code=${raceCode}`).catch(() => []),
    ]).then(([s, p]) => {
      if (cancel) return;
      setStats(s);
      setParticipants(p);
    });
    return () => { cancel = true; };
  }, [raceCode]);

  const honors = (participants || []).filter((p) => p.status === 'honor');
  const lastStanding = (participants || [])
    .filter((p) => p.status === 'active')
    .sort((a, b) => (b.laps_completed || 0) - (a.laps_completed || 0))
    .slice(0, 3);

  return (
    <Screen title="Ganadores">
      <div className="px-4 py-4">
        {participants === null && (
          <div className={`flex justify-center py-16 ${T.muted}`}>
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        )}

        {participants !== null && (
          <>
            {stats?.winner && (
              <div className={`rounded-2xl p-6 mb-4 text-center ${T.card}`}>
                <Trophy className="w-10 h-10 mx-auto mb-2 text-[#E77622]" />
                <p className={`text-[10px] tracking-[0.22em] mb-1.5 ${T.subtle}`}>ÚLTIMO EN PIE</p>
                <p className="text-xl font-extrabold">{stats.winner.nombre} {stats.winner.apellidos}</p>
                <p className={`text-xs mt-1 ${T.muted}`}>
                  #{stats.winner.bib} · {flagOf(stats.winner.nacionalidad)} {stats.winner.nacionalidad}
                </p>
                <div className="flex justify-center gap-8 mt-4">
                  <div>
                    <div className="text-3xl font-bold text-[#E77622] font-mono">{stats.winner.laps_completed}</div>
                    <div className={`text-[9px] tracking-widest ${T.subtle}`}>VUELTAS</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-[#E77622] font-mono">
                      {Number(stats.winner.total_km || 0).toFixed(1)}
                    </div>
                    <div className={`text-[9px] tracking-widest ${T.subtle}`}>KM</div>
                  </div>
                </div>
                {stats.winner.bib && (
                  <button
                    onClick={() => navigate(`/live/${raceCode}/atleta/${stats.winner.bib}`)}
                    className="mt-4 text-xs font-bold text-[#E77622]"
                  >
                    Ver ficha del ganador →
                  </button>
                )}
              </div>
            )}

            {honors.length > 0 && (
              <>
                <p className={`text-xs font-bold tracking-wider uppercase mb-2 ${T.subtle}`}>Menciones de honor</p>
                {honors.map((p) => (
                  <div
                    key={p.bib}
                    onClick={() => navigate(`/live/${raceCode}/atleta/${p.bib}`)}
                    className={`flex items-center gap-3 rounded-2xl px-3.5 py-3 mb-2.5 cursor-pointer ${T.card}`}
                  >
                    <Medal className="w-5 h-5 text-[#E77622] shrink-0" />
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${T.avatar}`}>
                      {initialsOf(p.nombre, p.apellidos)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{p.nombre} {p.apellidos}</p>
                      <p className={`text-[11px] ${T.muted}`}>
                        #{p.bib} · {p.laps_completed} vueltas · {(p.total_km || 0).toFixed(1)} km
                      </p>
                    </div>
                  </div>
                ))}
              </>
            )}

            {!stats?.winner && honors.length === 0 && (
              <>
                <div className={`text-center py-12 ${T.muted}`}>
                  <Trophy className="w-10 h-10 mx-auto mb-3 opacity-60" />
                  <p className="font-semibold">Aún no hay ganador</p>
                  <p className="text-xs mt-1.5">La carrera sigue: solo puede quedar uno en pie.</p>
                </div>
                {lastStanding.length > 0 && (
                  <>
                    <p className={`text-xs font-bold tracking-wider uppercase mb-2 ${T.subtle}`}>Últimos en pie</p>
                    {lastStanding.map((p) => (
                      <div
                        key={p.bib}
                        onClick={() => navigate(`/live/${raceCode}/atleta/${p.bib}`)}
                        className={`flex items-center gap-3 rounded-2xl px-3.5 py-3 mb-2.5 cursor-pointer ${T.card}`}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs border-2 border-[#E77622] ${T.avatar}`}>
                          {initialsOf(p.nombre, p.apellidos)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold truncate">{p.nombre} {p.apellidos}</p>
                          <p className={`text-[11px] ${T.muted}`}>#{p.bib} · {(p.total_km || 0).toFixed(1)} km</p>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-[#E77622] font-mono">{p.laps_completed || 0}</div>
                          <div className={`text-[9px] tracking-widest ${T.subtle}`}>VUELTAS</div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </Screen>
  );
}
