import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Image as ImageIcon, Contact, MessageCircle, Trophy, Star,
  ExternalLink, MapPin, Loader2, ChevronRight,
} from 'lucide-react';
import { API, getJson, flagOf, initialsOf, formatDuration, formatPace, useFollowed, statusLabel } from '../liveApi';
import { useLiveTheme } from '../liveTheme';
import { Screen, useRace } from '../LiveApp';

/**
 * Gráfico de pace por vuelta (SVG propio, estilo área como el diseño de referencia).
 */
function PaceChart({ laps, T }) {
  const points = laps.filter((l) => l.pace_seg_km != null);
  if (points.length < 2) {
    return <p className={`text-xs text-center py-8 ${T.muted}`}>Aún no hay suficientes vueltas cronometradas para el gráfico.</p>;
  }
  const W = 320;
  const H = 150;
  const PAD = { top: 10, right: 8, bottom: 22, left: 40 };
  const paces = points.map((p) => p.pace_seg_km);
  const min = Math.min(...paces);
  const max = Math.max(...paces);
  const span = Math.max(max - min, 30);
  const x = (i) => PAD.left + (i * (W - PAD.left - PAD.right)) / (points.length - 1);
  // Pace menor (más rápido) arriba, como en las apps de corredores
  const y = (pace) => PAD.top + ((pace - min) / span) * (H - PAD.top - PAD.bottom);

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.pace_seg_km).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(1)},${H - PAD.bottom} L${PAD.left},${H - PAD.bottom} Z`;

  const fmtPaceShort = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {[min, min + span / 2, min + span].map((p) => (
        <g key={p}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(p)} y2={y(p)} stroke="currentColor" strokeOpacity="0.12" />
          <text x={PAD.left - 6} y={y(p) + 3} textAnchor="end" fontSize="8.5" fill="currentColor" opacity="0.55">
            {fmtPaceShort(Math.round(p))}
          </text>
        </g>
      ))}
      <path d={area} fill="#E77622" fillOpacity="0.28" />
      <path d={line} fill="none" stroke="#E77622" strokeWidth="2" strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={p.lap}>
          <circle cx={x(i)} cy={y(p.pace_seg_km)} r="2.4" fill="#E77622" />
          <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="8.5" fill="currentColor" opacity="0.55">
            V{p.lap}
          </text>
        </g>
      ))}
    </svg>
  );
}

/**
 * Pantalla dedicada del atleta: datos, acciones, progreso, vueltas (tabla y
 * gráfico), experiencia ITRA, fotos y acceso a ánimo/compartir.
 */
export default function AthleteScreen() {
  const { T } = useLiveTheme();
  const { raceCode } = useRace();
  const { bib } = useParams();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [failed, setFailed] = useState(false);
  const [laps, setLaps] = useState([]);
  const [stats, setStats] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [tab, setTab] = useState('grafico');
  const followedStore = useFollowed();
  const [followed, setFollowed] = useState(followedStore.read());

  useEffect(() => {
    let cancel = false;
    setProfile(null);
    setFailed(false);
    Promise.all([
      getJson(`/api/athletes/public-profile/${bib}?race_code=${raceCode}`),
      getJson(`/api/race/athlete-laps/${bib}?race_code=${raceCode}`).catch(() => ({ laps: [] })),
      getJson(`/api/race/stats?race_code=${raceCode}`).catch(() => null),
      // Fotos del evento propias; el álbum de Google queda como último recurso
      getJson(`/api/race-config/live-photos/${raceCode}`)
        .then((d) => (d.photos?.length
          ? d.photos.map((p, i) => ({ index: i, url: `${API}${p.url}`, propia: true }))
          : getJson('/api/album/photos').then((a) => (a.photos || []).map((p) => ({ ...p, url: `${p.url}=w300` })))))
        .catch(() => []),
    ])
      .then(([prof, lapsData, statsData, fotos]) => {
        if (cancel) return;
        setProfile(prof);
        setLaps(lapsData.laps || []);
        setStats(statsData);
        setPhotos((fotos || []).slice(0, 6));
      })
      .catch(() => { if (!cancel) setFailed(true); });
    return () => { cancel = true; };
  }, [bib, raceCode]);

  const progressPct = useMemo(() => {
    if (!profile) return 0;
    const currentLap = stats?.current_lap || profile.laps_completed || 1;
    if (!currentLap) return 0;
    return Math.min(100, Math.round(((profile.laps_completed || 0) / currentLap) * 100));
  }, [profile, stats]);

  const actions = [
    { label: 'Fotos', Icon: ImageIcon, action: () => document.getElementById('seccion-fotos')?.scrollIntoView({ behavior: 'smooth' }) },
    { label: 'Compartir BIB', Icon: Contact, action: () => navigate(`/live/${raceCode}/atleta/${bib}/bib`) },
    { label: 'Enviar ánimo', Icon: MessageCircle, action: () => navigate(`/live/${raceCode}/atleta/${bib}/animo`) },
    { label: 'Resultados', Icon: Trophy, action: () => navigate(`/live/${raceCode}/atleta/${bib}/resultados`) },
  ];

  const snapshot = profile?.itra_snapshot;

  return (
    <Screen title="Detalle del corredor" back>
      {!profile && !failed && (
        <div className={`flex justify-center py-20 ${T.muted}`}>
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      )}

      {failed && (
        <p className={`text-sm text-center py-16 ${T.muted}`}>No se pudo cargar la ficha del corredor.</p>
      )}

      {profile && (
        <div className="pb-4">
          {/* Encabezado del atleta */}
          <div className="flex items-center gap-3.5 px-4 pt-4 pb-3">
            {profile.photo_url ? (
              <img
                src={`${API}${profile.photo_url}`}
                alt={profile.nombre}
                className="w-14 h-14 rounded-full object-cover border-2 border-[#E77622] shrink-0"
              />
            ) : (
              <div className={`w-14 h-14 rounded-full flex items-center justify-center text-base font-bold border-2 border-[#E77622] shrink-0 ${T.avatar}`}>
                {initialsOf(profile.nombre, profile.apellidos)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[17px] font-extrabold leading-tight truncate">
                {profile.nombre} {profile.apellidos}
              </p>
              <p className={`text-xs mt-0.5 ${T.muted}`}>
                {[profile.sexo ? profile.sexo.charAt(0).toUpperCase() : null,
                  `${flagOf(profile.nacionalidad)} ${profile.nacionalidad || ''}`.trim(),
                  profile.ciudad_residencia]
                  .filter(Boolean).join(' | ')}
              </p>
              <p className={`text-[11px] mt-0.5 font-semibold ${profile.status === 'active' ? 'text-green-500' : T.subtle}`}>
                {statusLabel(profile.status)}
                {profile.status === 'retired' && profile.retired_at_lap ? ` · vuelta ${profile.retired_at_lap}` : ''}
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className={`text-sm font-mono font-extrabold px-2.5 py-1 rounded-lg ${T.chipOn}`}>#{profile.bib}</span>
              <button
                aria-label="Seguir"
                onClick={() => setFollowed(followedStore.toggle(profile.bib))}
                className="block ml-auto mt-2"
              >
                <Star className={`w-5 h-5 ${followed.includes(profile.bib) ? 'text-[#E77622] fill-[#E77622]' : T.subtle}`} />
              </button>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex gap-3 px-4 pb-4 overflow-x-auto">
            {actions.map(({ label, Icon, action }) => (
              <button key={label} onClick={action} className="flex flex-col items-center gap-1.5 shrink-0 w-[74px]">
                <span className={`w-14 h-14 rounded-full flex items-center justify-center ${T.actionChip}`}>
                  <Icon className="w-5 h-5 text-[#E77622]" />
                </span>
                <span className={`text-[10px] text-center leading-tight ${T.muted}`}>{label}</span>
              </button>
            ))}
          </div>

          {/* Progreso + vueltas */}
          <div className={`mx-4 rounded-2xl p-4 ${T.card}`}>
            <div className="flex items-center justify-center gap-8">
              <div className="relative w-28 h-28">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="8" />
                  <circle
                    cx="50" cy="50" r="44" fill="none" stroke="#E77622" strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={`${(progressPct / 100) * 276.5} 276.5`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-extrabold font-mono">{progressPct}%</span>
                  <span className={`text-[9px] tracking-widest ${T.subtle}`}>DE LA CARRERA</span>
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-extrabold font-mono text-[#E77622]">{profile.laps_completed || 0}</div>
                <div className={`text-[9px] tracking-widest ${T.subtle}`}>VUELTAS</div>
                <div className="text-lg font-bold font-mono mt-2">{(profile.total_km || 0).toFixed(1)}</div>
                <div className={`text-[9px] tracking-widest ${T.subtle}`}>KM</div>
              </div>
            </div>

            {/* Tabs Gráfico / Vueltas */}
            <div className={`flex mt-4 border-b ${T.divider}`}>
              {[{ key: 'grafico', label: 'Gráfico' }, { key: 'vueltas', label: 'Vueltas' }].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`flex-1 pb-2 text-sm font-bold ${tab === key ? T.tabOn : T.tab}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === 'grafico' && (
              <div className="pt-4">
                <PaceChart laps={laps} T={T} />
              </div>
            )}

            {tab === 'vueltas' && (
              laps.length === 0 ? (
                <p className={`text-xs text-center py-8 ${T.muted}`}>Aún no hay vueltas registradas.</p>
              ) : (
                <table className="w-full mt-3 text-sm">
                  <thead>
                    <tr className={`text-[10px] tracking-wider uppercase ${T.tableHead}`}>
                      <th className="text-left py-2 font-semibold">Vuelta</th>
                      <th className="text-left py-2 font-semibold">Hora</th>
                      <th className="text-right py-2 font-semibold">Duración</th>
                      <th className="text-right py-2 font-semibold">Pace</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {laps.map((l) => (
                      <tr key={l.lap} className={T.tableRow}>
                        <td className="py-2.5 font-bold text-[#E77622]">V{l.lap}</td>
                        <td className={`py-2.5 ${T.muted}`}>{l.hora || '—'}</td>
                        <td className="py-2.5 text-right">{formatDuration(l.duracion_seg)}</td>
                        <td className={`py-2.5 text-right ${T.muted}`}>{formatPace(l.pace_seg_km)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}
          </div>

          {/* Experiencia ITRA */}
          {(snapshot || profile.itra_url) && (
            <div className={`mx-4 mt-4 rounded-2xl p-4 ${T.itraBox}`}>
              <p className="text-xs font-extrabold tracking-wider text-[#E77622] mb-2.5">EXPERIENCIA ITRA</p>
              {snapshot && (
                <>
                  <div className="flex items-baseline gap-3 mb-3">
                    {snapshot.performance_index != null && (
                      <span className="text-3xl font-extrabold font-mono text-[#E77622]">{snapshot.performance_index}</span>
                    )}
                    <div className="text-xs">
                      {snapshot.level && <p className="font-bold">{snapshot.level}</p>}
                      {snapshot.age_category && <p className={T.muted}>{snapshot.age_category}</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center mb-2">
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
                  {(snapshot.results || []).slice(0, 4).map((r, i) => (
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
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-[#E77622]"
                >
                  Ver perfil completo en ITRA <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          )}

          {/* Fotos del evento */}
          <div id="seccion-fotos" className="mx-4 mt-4">
            <div className="flex items-center justify-between mb-2">
              <p className={`text-xs font-bold tracking-wider uppercase ${T.subtle}`}>Fotos del evento</p>
              <a href="/album" className="text-xs font-bold text-[#E77622] inline-flex items-center gap-1">
                Ver álbum <ChevronRight className="w-3.5 h-3.5" />
              </a>
            </div>
            {photos.length === 0 ? (
              <div className={`rounded-2xl p-6 text-center ${T.card}`}>
                <ImageIcon className={`w-8 h-8 mx-auto mb-2 opacity-60 ${T.muted}`} />
                <p className={`text-xs ${T.muted}`}>Las fotos estarán disponibles durante el evento.</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {photos.map((ph) => (
                  <a key={ph.index} href="/album" className="aspect-square rounded-xl overflow-hidden">
                    <img src={ph.url} alt="Foto del evento" className="w-full h-full object-cover" loading="lazy" />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Datos de carrera del atleta */}
          {(profile.anos_experiencia != null || profile.maxima_distancia_km != null) && (
            <div className={`mx-4 mt-4 rounded-2xl p-4 flex items-center gap-6 ${T.card}`}>
              <MapPin className="w-5 h-5 text-[#E77622] shrink-0" />
              <div className="flex gap-8">
                {profile.anos_experiencia != null && (
                  <div>
                    <div className="text-lg font-bold font-mono">{profile.anos_experiencia}</div>
                    <div className={`text-[9px] tracking-widest ${T.subtle}`}>AÑOS CORRIENDO</div>
                  </div>
                )}
                {profile.maxima_distancia_km != null && (
                  <div>
                    <div className="text-lg font-bold font-mono">{profile.maxima_distancia_km}</div>
                    <div className={`text-[9px] tracking-widest ${T.subtle}`}>KM MÁX. PREVIOS</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Enviar ánimo */}
          <div className="mx-4 mt-4">
            <button
              onClick={() => navigate(`/live/${raceCode}/atleta/${bib}/animo`)}
              className="w-full rounded-xl py-3 text-sm font-bold bg-[#E77622] text-white flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-4 h-4" /> Enviar mensaje de apoyo
            </button>
          </div>
        </div>
      )}
    </Screen>
  );
}
