import React, { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { getJson, formatDuration, formatPace, statusLabel } from '../liveApi';
import { useLiveTheme } from '../liveTheme';

/**
 * Gráfico de línea: ritmo promedio por vuelta.
 */
function PaceChart({ laps, T }) {
  const points = laps.filter((l) => l.pace_seg_km != null);
  if (points.length < 2) {
    return (
      <p className={`text-xs text-center px-4 ${T.muted}`}>
        Aún no hay suficientes vueltas cronometradas para el gráfico.
      </p>
    );
  }
  // Proporción pensada para el alto del contenedor, que es fijo: con el lienzo
  // apaisado de antes el gráfico se quedaba aplastado arriba y sobraba hueco.
  const W = 320;
  const H = 230;
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
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full">
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
  waitlist: 'bg-amber-500/15 text-amber-500 border border-amber-500/40',
  winner: 'bg-[#E77622]/15 text-[#E77622] border border-[#E77622]/50',
  honor: 'bg-[#E77622]/15 text-[#E77622] border border-[#E77622]/50',
};

/**
 * Sección "Seguimiento" de la ficha: vueltas, kilómetros y ritmo.
 *
 * El encabezado con el nombre del corredor y los botones de sección los pone
 * FichaAtleta, que es quien envuelve a todas; aquí solo va el contenido.
 */
export default function AthleteScreen() {
  const { T } = useLiveTheme();
  const { profile, raceCode, bib } = useOutletContext();
  const navigate = useNavigate();

  const [laps, setLaps] = useState([]);
  const [tab, setTab] = useState('grafico');

  useEffect(() => {
    let cancel = false;
    setLaps([]);
    getJson(`/api/race/athlete-laps/${bib}?race_code=${raceCode}`)
      .then((d) => { if (!cancel) setLaps(d.laps || []); })
      .catch(() => { if (!cancel) setLaps([]); });
    return () => { cancel = true; };
  }, [bib, raceCode]);

  // El gráfico necesita las vueltas en orden; la tabla, al revés.
  const vueltasRecientesPrimero = [...laps].reverse();

  const base = `/live/${raceCode}/atleta/${bib}`;

  const statusText = profile?.status === 'active'
    ? 'Aún en carrera'
    : `${statusLabel(profile?.status)}${profile?.status === 'retired' && profile?.retired_at_lap ? ` · vuelta ${profile.retired_at_lap}` : ''}`;

  return (
    <>
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

            {/* Alto fijo para las dos pestañas: la tarjeta no debe dar un salto
                al cambiar de una a otra, y con muchas vueltas la lista se
                desplaza aquí dentro en vez de estirar la pantalla. */}
            <div className="h-[300px] mt-3 overflow-y-auto">
              {tab === 'grafico' && (
                <div className="h-full flex flex-col justify-center">
                  <p className={`text-[10px] tracking-widest text-center mb-1 ${T.subtle}`}>RITMO PROMEDIO POR VUELTA</p>
                  <PaceChart laps={laps} T={T} />
                </div>
              )}

              {tab === 'vueltas' && (
                laps.length === 0 ? (
                  <p className={`text-xs text-center pt-10 ${T.muted}`}>Aún no hay vueltas registradas.</p>
                ) : (
                  <table className="w-full text-sm">
                    {/* La cabecera se queda arriba mientras se desplaza la lista */}
                    <thead className={`sticky top-0 ${T.card}`}>
                      <tr className={`text-[10px] tracking-wider uppercase ${T.tableHead}`}>
                        <th className="text-left py-2 font-semibold">Vuelta</th>
                        <th className="text-left py-2 font-semibold">Hora</th>
                        <th className="text-right py-2 font-semibold">Duración</th>
                        <th className="text-right py-2 font-semibold">Pace</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {/* De la más reciente a la más antigua: lo que interesa
                          durante la carrera es la última vuelta, no la primera. */}
                      {vueltasRecientesPrimero.map((l) => (
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
          </div>

          {/* Enviar ánimo */}
          <div className="mx-4 mt-4">
            <button
              onClick={() => navigate(`${base}/animo`, { replace: true })}
              className="w-full rounded-xl py-3 text-sm font-bold bg-[#E77622] text-white flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-4 h-4" /> Enviar mensaje de apoyo
            </button>
          </div>
    </>
  );
}
