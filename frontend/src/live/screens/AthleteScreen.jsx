import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getJson, formatDuration, formatPace } from '../liveApi';
import { useLiveTheme } from '../liveTheme';

// Cuántas etiquetas del eje X caben sin que se toquen, y cada cuántas vueltas
// hay que poner una. Con 45 vueltas y 272 px de ancho no caben las 45: se
// pintaban una encima de otra y el eje quedaba en una mancha ilegible.
const ETIQUETA_ANCHO = 20;   // px que ocupa "V45" con su aire

function pasoDeEtiquetas(total, ancho) {
  const caben = Math.max(1, Math.floor(ancho / ETIQUETA_ANCHO));
  if (total <= caben) return 1;
  // Se sube al siguiente paso "redondo" (2, 5, 10, 20...) en vez de a un 3 o un
  // 7: leer de cinco en cinco es más fácil que de siete en siete.
  const bonitos = [1, 2, 5, 10, 20, 25, 50];
  const minimo = Math.ceil(total / caben);
  return bonitos.find((p) => p >= minimo) || minimo;
}

/** Índices que llevan etiqueta: la primera, las del paso, y siempre la última. */
function indicesConEtiqueta(total, ancho) {
  const paso = pasoDeEtiquetas(total, ancho);
  const indices = [];
  for (let i = 0; i < total; i += paso) indices.push(i);
  const ultimo = total - 1;
  if (indices[indices.length - 1] !== ultimo) {
    // Si la última quedaría pegada a la anterior, esa anterior se retira: entre
    // las dos, la que importa es la última vuelta.
    if (ultimo - indices[indices.length - 1] < paso * 0.6) indices.pop();
    indices.push(ultimo);
  }
  return new Set(indices);
}

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
  const etiquetadas = indicesConEtiqueta(points.length, W - PAD.left - PAD.right);

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
          <circle cx={x(i)} cy={y(p.pace_seg_km)} r={points.length > 25 ? 2 : 3} fill="#E77622" />
          {etiquetadas.has(i) && (
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="8.5" fill="currentColor" opacity="0.55">
              V{p.lap}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

/**
 * Gráfico de barras: en qué se le fue la hora a cada vuelta.
 *
 * En un backyard cada vuelta arranca en punto: lo que el corredor no gasta
 * corriendo se lo queda de descanso, y ese reparto es media carrera. La barra
 * de abajo es el tiempo en ruta y la de arriba lo que le sobró; cuando la
 * naranja va comiéndose la hora, el corredor está al límite.
 */
function RestChart({ laps, ventanaSeg, T }) {
  const datos = laps.filter((l) => l.duracion_seg != null);
  if (!datos.length) {
    return (
      <p className={`text-xs text-center px-4 ${T.muted}`}>
        Aún no hay vueltas cronometradas para el gráfico.
      </p>
    );
  }

  const W = 320;
  const H = 230;
  const PAD = { top: 10, right: 8, bottom: 22, left: 34 };
  const alto = H - PAD.top - PAD.bottom;
  const ancho = W - PAD.left - PAD.right;

  // La escala llega hasta la hora completa aunque nadie la haya apurado: es la
  // referencia de la carrera, y sin ella no se ve cuánto margen queda.
  const tope = Math.max(ventanaSeg, ...datos.map((l) => l.duracion_seg));
  const largo = (seg) => (seg / tope) * alto;
  const paso = ancho / datos.length;
  const grosor = Math.max(1.5, Math.min(14, paso * 0.72));
  const x = (i) => PAD.left + paso * i + (paso - grosor) / 2;
  const base = PAD.top + alto;

  const etiquetadas = indicesConEtiqueta(datos.length, ancho);
  const marcas = [0, ventanaSeg / 2, ventanaSeg];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full">
      {marcas.map((seg) => (
        <g key={seg}>
          <line
            x1={PAD.left} x2={W - PAD.right}
            y1={base - largo(seg)} y2={base - largo(seg)}
            stroke="currentColor" strokeOpacity={seg === ventanaSeg ? 0.28 : 0.12}
            strokeDasharray={seg === ventanaSeg ? '3 3' : undefined}
          />
          <text x={PAD.left - 6} y={base - largo(seg) + 3} textAnchor="end" fontSize="8.5" fill="currentColor" opacity="0.55">
            {Math.round(seg / 60)}′
          </text>
        </g>
      ))}

      {datos.map((l, i) => {
        const ruta = Math.min(l.duracion_seg, tope);
        const descanso = Math.max(0, ventanaSeg - l.duracion_seg);
        return (
          <g key={l.lap}>
            {descanso > 0 && (
              <rect
                x={x(i)} y={base - largo(ruta) - largo(descanso)}
                width={grosor} height={largo(descanso)}
                fill="currentColor" opacity="0.22" rx={grosor > 4 ? 1.5 : 0}
              />
            )}
            <rect
              x={x(i)} y={base - largo(ruta)}
              width={grosor} height={largo(ruta)}
              fill="#E77622" rx={grosor > 4 ? 1.5 : 0}
            />
            {etiquetadas.has(i) && (
              <text x={x(i) + grosor / 2} y={H - 8} textAnchor="middle" fontSize="8.5" fill="currentColor" opacity="0.55">
                V{l.lap}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Sección "Seguimiento" de la ficha: vueltas, kilómetros y ritmo.
 *
 * El encabezado con el nombre del corredor y los botones de sección los pone
 * FichaAtleta, que es quien envuelve a todas; aquí solo va el contenido.
 */
export default function AthleteScreen() {
  const { T } = useLiveTheme();
  const { profile, raceCode, race, bib } = useOutletContext();
  // La ventana de la vuelta: lo que no se corre, se descansa. Por defecto la
  // hora de un backyard, que es lo que usa el backend cuando la carrera no lo
  // dice.
  const ventanaSeg = (race?.minutos_por_vuelta || 60) * 60;

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

  return (
    <>
          {/* Vueltas y kilómetros como protagonistas */}
          <div className={`mx-4 rounded-2xl p-4 ${T.card}`}>
            {/* El estado ya se ve arriba, junto al país: aquí ocupaba una fila
                entera y era lo que dejaba la tarjeta sin sitio para el gráfico. */}
            <div className="flex items-center justify-center gap-10">
              <div className="text-center">
                <div className="text-[2rem] font-extrabold font-mono text-[#E77622] leading-none">
                  {profile.laps_completed || 0}
                </div>
                <div className={`text-[10px] tracking-[0.18em] mt-1.5 ${T.subtle}`}>VUELTAS</div>
              </div>
              <div className={`w-px h-11 ${T.divider} border-l`} />
              <div className="text-center">
                <div className="text-[2rem] font-extrabold font-mono leading-none">
                  {(profile.total_km || 0).toFixed(1)}
                </div>
                <div className={`text-[10px] tracking-[0.18em] mt-1.5 ${T.subtle}`}>KILÓMETROS</div>
              </div>
            </div>

            {/* Tabs Gráfico / Vueltas */}
            <div className={`flex mt-4 border-b ${T.divider}`}>
              {[
                { key: 'grafico', label: 'Ritmo' },
                { key: 'descanso', label: 'Descanso' },
                { key: 'vueltas', label: 'Vueltas' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`flex-1 pb-2 text-sm font-bold ${tab === key ? T.tabOn : T.tab}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* El alto sale de lo que queda libre, para que la tarjeta entre
                entre los botones de sección y la banda de publicidad sin que la
                pantalla tenga que desplazarse. Lo restado es lo que ocupan la
                barra superior, el encabezado del corredor, el pie y la propia
                cabecera de la tarjeta (cifras y pestañas).
                Sigue siendo el mismo alto en las dos pestañas: la tarjeta no
                debe dar un salto al cambiar de una a otra, y con muchas vueltas
                la lista se desplaza aquí dentro.
                Lo restado eran 28rem y se quedaba corto: la tarjeta terminaba
                metiéndose debajo de la banda de publicidad. Con las cifras más
                pequeñas y el estado fuera, la cuenta baja a unas 27rem. */}
            <div
              className="mt-3 overflow-y-auto"
              style={{
                height: 'calc(100dvh - 27.5rem - env(safe-area-inset-top) - env(safe-area-inset-bottom))',
                minHeight: '170px',
                maxHeight: '360px',
              }}
            >
              {tab === 'grafico' && (
                <div className="h-full flex flex-col justify-center">
                  <p className={`text-[10px] tracking-widest text-center mb-1 ${T.subtle}`}>RITMO PROMEDIO POR VUELTA</p>
                  <PaceChart laps={laps} T={T} />
                </div>
              )}

              {tab === 'descanso' && (
                <div className="h-full flex flex-col justify-center">
                  <p className={`text-[10px] tracking-widest text-center ${T.subtle}`}>EN QUÉ SE FUE CADA VUELTA</p>
                  <div className={`flex items-center justify-center gap-4 mt-1 mb-0.5 text-[10px] ${T.muted}`}>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-[#E77622]" /> En ruta
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-current opacity-25" /> Descanso
                    </span>
                  </div>
                  <RestChart laps={laps} ventanaSeg={ventanaSeg} T={T} />
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
    </>
  );
}
