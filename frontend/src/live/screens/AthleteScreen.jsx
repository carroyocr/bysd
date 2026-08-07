import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Contact, MessageCircle, Trophy, Star, Mountain, Loader2,
} from 'lucide-react';
import { API, getJson, flagOf, initialsOf, formatDuration, formatPace, useFollowed, statusLabel } from '../liveApi';
import { useLiveTheme } from '../liveTheme';
import { Screen, useRace } from '../LiveApp';

/**
 * Gráfico de línea: ritmo promedio por vuelta.
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
      <path d={line} fill="none" stroke="#E77622" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={p.lap}>
          <circle cx={x(i)} cy={y(p.pace_seg_km)} r="3" fill="#E77622" />
          <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="8.5" fill="currentColor" opacity="0.55">
            V{p.lap}
          </text>
        </g>
      ))}
    </svg>
  );
}

const STATUS_STYLES = {
  registered: 'bg-sky-500/15 text-sky-400 border border-sky-500/40',
  active: 'bg-green-500/15 text-green-500 border border-green-500/40',
  retired: 'bg-red-500/15 text-red-500 border border-red-500/40',
  dns: 'bg-gray-500/15 text-gray-400 border border-gray-500/40',
  winner: 'bg-[#E77622]/15 text-[#E77622] border border-[#E77622]/50',
  honor: 'bg-[#E77622]/15 text-[#E77622] border border-[#E77622]/50',
};

/**
 * Pantalla dedicada del atleta: datos, acciones y vueltas (gráfico de línea y tabla).
 */
export default function AthleteScreen() {
  const { T } = useLiveTheme();
  const { raceCode } = useRace();
  const { bib } = useParams();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [failed, setFailed] = useState(false);
  const [laps, setLaps] = useState([]);
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
    ])
      .then(([prof, lapsData]) => {
        if (cancel) return;
        setProfile(prof);
        setLaps(lapsData.laps || []);
      })
      .catch(() => { if (!cancel) setFailed(true); });
    return () => { cancel = true; };
  }, [bib, raceCode]);

  const base = `/live/${raceCode}/atleta/${bib}`;
  const actions = [
    // Fotos oculta por ahora (la pantalla /fotos sigue lista para reactivarla)
    { label: 'Experiencia', Icon: Mountain, to: `${base}/experiencia` },
    { label: 'Compartir BIB', Icon: Contact, to: `${base}/bib` },
    { label: 'Enviar ánimo', Icon: MessageCircle, to: `${base}/animo` },
    { label: 'Resultados', Icon: Trophy, to: `${base}/resultados` },
  ];

  const statusText = profile?.status === 'active'
    ? 'Aún en carrera'
    : `${statusLabel(profile?.status)}${profile?.status === 'retired' && profile?.retired_at_lap ? ` · vuelta ${profile.retired_at_lap}` : ''}`;

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

          {/* Acciones: rejilla fija, sin scroll horizontal */}
          <div className={`grid px-4 pb-4 gap-2 ${actions.length <= 4 ? 'grid-cols-4' : 'grid-cols-5'}`}>
            {actions.map(({ label, Icon, to }) => (
              <button key={label} onClick={() => navigate(to)} className="flex flex-col items-center gap-1.5 min-w-0">
                <span className={`w-11 h-11 rounded-full flex items-center justify-center ${T.actionChip}`}>
                  <Icon className="w-[18px] h-[18px] text-[#E77622]" />
                </span>
                <span className={`text-[9.5px] text-center leading-tight ${T.muted}`}>{label}</span>
              </button>
            ))}
          </div>

          {/* Vueltas y kilómetros como protagonistas + estado */}
          <div className={`mx-4 rounded-2xl p-5 ${T.card}`}>
            <div className="flex justify-center mb-4">
              <span className={`text-[11px] font-extrabold tracking-wider px-3 py-1.5 rounded-full ${STATUS_STYLES[profile.status] || STATUS_STYLES.dns}`}>
                {statusText.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center justify-center gap-12">
              <div className="text-center">
                <div className="text-5xl font-extrabold font-mono text-[#E77622] leading-none">
                  {profile.laps_completed || 0}
                </div>
                <div className={`text-[10px] tracking-[0.18em] mt-2 ${T.subtle}`}>VUELTAS</div>
              </div>
              <div className={`w-px h-14 ${T.divider} border-l`} />
              <div className="text-center">
                <div className="text-5xl font-extrabold font-mono leading-none">
                  {(profile.total_km || 0).toFixed(1)}
                </div>
                <div className={`text-[10px] tracking-[0.18em] mt-2 ${T.subtle}`}>KILÓMETROS</div>
              </div>
            </div>

            {/* Tabs Gráfico / Vueltas */}
            <div className={`flex mt-5 border-b ${T.divider}`}>
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
                <p className={`text-[10px] tracking-widest text-center mb-1 ${T.subtle}`}>RITMO PROMEDIO POR VUELTA</p>
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

          {/* Enviar ánimo */}
          <div className="mx-4 mt-4">
            <button
              onClick={() => navigate(`${base}/animo`)}
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
