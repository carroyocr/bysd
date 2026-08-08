import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Mountain, ExternalLink, Loader2 } from 'lucide-react';
import { getAthleteProfile, initialsOf } from '../liveApi';
import { useLiveTheme } from '../liveTheme';
import { Screen, useRace } from '../LiveApp';

/**
 * Experiencia del corredor: trayectoria previa e ITRA en pantalla dedicada.
 */
export default function ExperienciaScreen() {
  const { T } = useLiveTheme();
  const { raceCode } = useRace();
  const { bib } = useParams();
  const [profile, setProfile] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    getAthleteProfile(bib, raceCode)
      .then(setProfile)
      .catch(() => setFailed(true));
  }, [bib, raceCode]);

  const snapshot = profile?.itra_snapshot;
  const hasItra = snapshot || profile?.itra_url;
  const hasPrevia = profile?.anos_experiencia != null || profile?.maxima_distancia_km != null;

  return (
    <Screen title="Experiencia" back>
      {!profile && !failed && (
        <div className={`flex justify-center py-20 ${T.muted}`}>
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      )}
      {failed && <p className={`text-sm text-center py-16 ${T.muted}`}>No se pudo cargar la experiencia.</p>}

      {profile && (
        <div className="px-4 py-4">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm border-2 border-[#E77622] ${T.avatar}`}>
              {initialsOf(profile.nombre, profile.apellidos)}
            </div>
            <div>
              <p className="text-sm font-bold">{profile.nombre} {profile.apellidos}</p>
              <p className={`text-[11px] ${T.muted}`}>#{profile.bib} · trayectoria del corredor</p>
            </div>
          </div>

          {hasPrevia && (
            <div className={`rounded-2xl p-4 mb-4 flex justify-around text-center ${T.card}`}>
              {profile.anos_experiencia != null && (
                <div>
                  <div className="text-2xl font-extrabold font-mono text-[#E77622]">{profile.anos_experiencia}</div>
                  <div className={`text-[9px] tracking-widest mt-1 ${T.subtle}`}>AÑOS CORRIENDO</div>
                </div>
              )}
              {profile.maxima_distancia_km != null && (
                <div>
                  <div className="text-2xl font-extrabold font-mono text-[#E77622]">{profile.maxima_distancia_km}</div>
                  <div className={`text-[9px] tracking-widest mt-1 ${T.subtle}`}>KM MÁX. PREVIOS</div>
                </div>
              )}
            </div>
          )}

          {hasItra ? (
            <div className={`rounded-2xl p-4 ${T.itraBox}`}>
              <p className="text-xs font-extrabold tracking-wider text-[#E77622] mb-2.5">EXPERIENCIA ITRA</p>
              {snapshot && (
                <>
                  <div className="flex items-baseline gap-3 mb-3">
                    {snapshot.performance_index != null && (
                      <span className="text-4xl font-extrabold font-mono text-[#E77622]">{snapshot.performance_index}</span>
                    )}
                    <div className="text-xs">
                      {snapshot.level && <p className="font-bold">{snapshot.level}</p>}
                      {snapshot.age_category && <p className={T.muted}>{snapshot.age_category}</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center mb-3">
                    <div>
                      <div className="text-sm font-bold font-mono">{snapshot.finished_races ?? '—'}</div>
                      <div className={`text-[9px] ${T.subtle}`}>CARRERAS</div>
                    </div>
                    <div>
                      <div className="text-sm font-bold font-mono">
                        {snapshot.total_distance_km != null ? Math.round(snapshot.total_distance_km).toLocaleString() : '—'}
                      </div>
                      <div className={`text-[9px] ${T.subtle}`}>KM TOTALES</div>
                    </div>
                    <div>
                      <div className="text-sm font-bold font-mono">
                        {snapshot.total_elevation_m != null ? `+${Math.round(snapshot.total_elevation_m).toLocaleString()}` : '—'}
                      </div>
                      <div className={`text-[9px] ${T.subtle}`}>DESNIVEL M</div>
                    </div>
                  </div>
                  {(snapshot.results || []).map((r, i) => (
                    <div key={i} className={`flex items-baseline justify-between gap-2 text-xs py-1.5 border-t ${T.divider}`}>
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{r.race}</p>
                        <p className={`text-[10px] ${T.muted}`}>
                          {[r.date, r.category, r.distance_km ? `${r.distance_km} km` : null].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <div className="text-right shrink-0 font-mono">
                        {r.time && <p>{r.time}</p>}
                        {r.position && <p className={`text-[10px] ${T.muted}`}>P. {r.position}</p>}
                      </div>
                    </div>
                  ))}
                </>
              )}
              {profile.itra_url && (
                <a
                  href={profile.itra_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#E77622]"
                >
                  Ver perfil completo en ITRA <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          ) : (
            !hasPrevia && (
              <div className={`text-center py-14 ${T.muted}`}>
                <Mountain className="w-10 h-10 mx-auto mb-3 opacity-60" />
                <p className="font-semibold">Sin experiencia registrada</p>
                <p className="text-xs mt-1.5">El corredor aún no ha cargado su trayectoria ni su perfil ITRA.</p>
              </div>
            )
          )}
        </div>
      )}
    </Screen>
  );
}
