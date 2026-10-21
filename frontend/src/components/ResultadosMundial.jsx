import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Trophy, Timer, Flag, Route, Users, Zap, ChevronDown } from 'lucide-react';
import { resumen, formatoTiempo, formatoHoras, formatoDiferencia, detalleVueltas } from '../lib/estadisticasCarrera';

// Resultados del Campeonato Mundial por Equipos (edición 2026): quién ganó,
// cómo le fue a cada corredor y qué dicen las vueltas del equipo. Todo sale
// de `GET /api/race/resultados?race_code=MUNDIAL-2026` (el libro de vueltas)
// y las cuentas están en `lib/estadisticasCarrera.js`. Si el backend no
// responde o la carrera aún no tiene vueltas, la sección no se pinta.
//
// Los gráficos son SVG hechos a mano: una sola serie cada uno, en el azul
// del sitio, sin leyenda (el título dice lo que es) y con un lector al pasar
// el cursor. La tabla de abajo lleva todos los números, así que nada depende
// del gráfico para leerse.

const API_URL = process.env.REACT_APP_BACKEND_URL;
export const CODIGO_MUNDIAL = 'MUNDIAL-2026';

const VUELTAS_PARA_CLASIFICAR = 24;

const num = (n, decimales = 0) =>
  (n == null ? '—' : Number(n).toLocaleString('es-DO', { minimumFractionDigits: decimales, maximumFractionDigits: decimales }));

// Solo hay un final que contar: el campeón. Todos los demás, por la regla
// del formato, no terminaron: DNF.
function comoTermino(c) {
  return c.status === 'winner' ? 'Campeón nacional' : 'DNF';
}

function useAncho(ref, inicial = 720) {
  const [ancho, setAncho] = useState(inicial);
  useEffect(() => {
    const nodo = ref.current;
    if (!nodo || typeof ResizeObserver === 'undefined') return undefined;
    const observador = new ResizeObserver((entradas) => {
      const w = entradas[0]?.contentRect?.width;
      if (w) setAncho(Math.max(280, Math.round(w)));
    });
    observador.observe(nodo);
    return () => observador.disconnect();
  }, [ref]);
  return ancho;
}

function Eyebrow({ children }) {
  return <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{children}</p>;
}

function Cifra({ icono: Icono, etiqueta, valor, detalle }) {
  return (
    <div className="py-5 md:border-r border-border last:border-r-0 md:px-5 md:first:pl-0">
      <div className="flex items-center gap-2 text-muted-foreground">
        {Icono && <Icono className="w-4 h-4" aria-hidden="true" />}
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">{etiqueta}</span>
      </div>
      <div className="font-display text-5xl leading-none text-foreground mt-2">{valor}</div>
      {detalle && <div className="text-xs text-muted-foreground mt-1.5">{detalle}</div>}
    </div>
  );
}

// ---------- Gráficos ----------

const MARGEN = { arriba: 16, derecha: 16, abajo: 28, izquierda: 44 };

function ticksEnteros(maximo, cuantos = 5) {
  const paso = Math.max(1, Math.ceil(maximo / cuantos));
  const ticks = [];
  for (let v = 0; v <= maximo; v += paso) ticks.push(v);
  if (ticks[ticks.length - 1] !== maximo) ticks.push(maximo);
  return ticks;
}

function ticksDeVuelta(maximo) {
  const paso = maximo > 60 ? 12 : maximo > 30 ? 6 : maximo > 12 ? 4 : 1;
  const ticks = [];
  for (let v = paso; v <= maximo; v += paso) ticks.push(v);
  if (!ticks.includes(1)) ticks.unshift(1);
  // La última vuelta siempre se lee, salvo que casi pise la marca anterior.
  if (maximo - ticks[ticks.length - 1] >= paso / 2) ticks.push(maximo);
  return ticks;
}

// Lienzo común: ejes, rejilla, lector con línea vertical y tooltip.
function Lienzo({ filas, ancho, alto, dominioY, ticksY, formatoY, children, lector }) {
  const [activa, setActiva] = useState(null);
  const n = filas.length;
  const x = (vuelta) => MARGEN.izquierda + ((vuelta - 1) / Math.max(1, n - 1)) * (ancho - MARGEN.izquierda - MARGEN.derecha);
  const y = (valor) => {
    const [y0, y1] = dominioY;
    const alturaUtil = alto - MARGEN.arriba - MARGEN.abajo;
    return MARGEN.arriba + alturaUtil - ((valor - y0) / Math.max(1e-9, y1 - y0)) * alturaUtil;
  };

  const svgRef = useRef(null);
  // El lector busca la vuelta más cercana al cursor: se apunta a una vuelta,
  // no a una línea de dos píxeles.
  const moverA = (clientX) => {
    if (!svgRef.current) return;
    const caja = svgRef.current.getBoundingClientRect();
    const px = ((clientX - caja.left) / caja.width) * ancho;
    const idx = Math.round(((px - MARGEN.izquierda) / (ancho - MARGEN.izquierda - MARGEN.derecha)) * (n - 1));
    setActiva(Math.min(n - 1, Math.max(0, idx)));
  };

  const fila = activa == null ? null : filas[activa];

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${ancho} ${alto}`}
        width="100%"
        height={alto}
        role="img"
        onMouseMove={(e) => moverA(e.clientX)}
        onMouseLeave={() => setActiva(null)}
        onTouchStart={(e) => moverA(e.touches[0].clientX)}
        onTouchMove={(e) => moverA(e.touches[0].clientX)}
        className="block select-none"
      >
        {ticksY.map((t) => (
          <g key={t}>
            <line x1={MARGEN.izquierda} x2={ancho - MARGEN.derecha} y1={y(t)} y2={y(t)} stroke="hsl(var(--border))" strokeWidth="1" />
            <text x={MARGEN.izquierda - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="hsl(var(--muted-foreground))">{formatoY(t)}</text>
          </g>
        ))}
        {ticksDeVuelta(n).map((v) => (
          <text key={v} x={x(v)} y={alto - 8} textAnchor="middle" fontSize="11" fill="hsl(var(--muted-foreground))">{v}</text>
        ))}
        {children({ x, y })}
        {fila && (
          <g>
            <line x1={x(fila.vuelta)} x2={x(fila.vuelta)} y1={MARGEN.arriba} y2={alto - MARGEN.abajo} stroke="hsl(var(--foreground))" strokeWidth="1" opacity="0.35" />
            {lector.puntos(fila).map((valor, i) => (
              valor == null ? null : (
                <circle key={i} cx={x(fila.vuelta)} cy={y(valor)} r="5" fill="hsl(var(--primary))" stroke="hsl(var(--background))" strokeWidth="2" />
              )
            ))}
          </g>
        )}
      </svg>
      {fila && (
        <div
          className="pointer-events-none absolute top-2 rounded border border-border bg-background px-3 py-2 text-xs shadow-medium"
          style={{ left: `${Math.min(92, Math.max(0, (x(fila.vuelta) / ancho) * 100))}%`, transform: x(fila.vuelta) > ancho * 0.7 ? 'translateX(-100%)' : 'translateX(8px)' }}
        >
          <div className="font-semibold text-foreground">Vuelta {fila.vuelta}</div>
          {lector.filas(fila).map(([etiqueta, valor]) => (
            <div key={etiqueta} className="flex items-baseline gap-3 mt-0.5">
              <span className="font-semibold text-foreground tabular-nums">{valor}</span>
              <span className="text-muted-foreground">{etiqueta}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GraficoEnPie({ filas }) {
  const ref = useRef(null);
  const ancho = useAncho(ref);
  const alto = 240;
  const maximo = Math.max(1, ...filas.map((f) => f.enPie));
  const ticks = ticksEnteros(maximo);
  return (
    <div ref={ref}>
      <Lienzo
        filas={filas}
        ancho={ancho}
        alto={alto}
        dominioY={[0, ticks[ticks.length - 1]]}
        ticksY={ticks}
        formatoY={(t) => String(t)}
        lector={{ puntos: (f) => [f.enPie], filas: (f) => [[f.enPie === 1 ? 'corredor completó la vuelta' : 'corredores completaron la vuelta', f.enPie]] }}
      >
        {({ x, y }) => {
          // Escalones: el número de corredores cambia de golpe entre vueltas.
          let d = `M ${x(1)} ${y(filas[0].enPie)}`;
          filas.forEach((f, i) => {
            if (i > 0) d += ` H ${x(f.vuelta)} V ${y(f.enPie)}`;
          });
          const base = y(0);
          return (
            <g>
              <path d={`${d} V ${base} H ${x(1)} Z`} fill="hsl(var(--primary))" opacity="0.1" />
              <path d={d} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            </g>
          );
        }}
      </Lienzo>
    </div>
  );
}

function GraficoRitmo({ filas, minutosPorVuelta }) {
  const ref = useRef(null);
  const ancho = useAncho(ref);
  const alto = 260;
  const conDatos = filas.filter((f) => f.media != null);
  const minimo = Math.min(...conDatos.map((f) => f.minimo));
  const maximo = Math.max(...conDatos.map((f) => f.maximo));
  const paso = 300; // 5 minutos
  const y0 = Math.max(0, Math.floor(minimo / paso) * paso);
  const y1 = Math.min(minutosPorVuelta * 60, Math.ceil((maximo + 1) / paso) * paso);
  const ticks = [];
  for (let v = y0; v <= y1; v += paso) ticks.push(v);

  const segmentos = (clave) => {
    // Un trazo por tramo seguido de vueltas con dato; un hueco corta la línea.
    const tramos = [];
    let actual = [];
    filas.forEach((f) => {
      if (f[clave] == null) {
        if (actual.length) tramos.push(actual);
        actual = [];
      } else actual.push(f);
    });
    if (actual.length) tramos.push(actual);
    return tramos;
  };

  return (
    <div ref={ref}>
      <Lienzo
        filas={filas}
        ancho={ancho}
        alto={alto}
        dominioY={[y0, y1]}
        ticksY={ticks}
        formatoY={(t) => `${t / 60}′`}
        lector={{
          puntos: (f) => [f.media],
          filas: (f) => (f.media == null
            ? [['sin tiempos registrados', '—']]
            : [[`promedio (${f.conTiempo} ${f.conTiempo === 1 ? 'corredor' : 'corredores'})`, formatoTiempo(f.media)], ['la más rápida', formatoTiempo(f.minimo)], ['la más lenta', formatoTiempo(f.maximo)]]),
        }}
      >
        {({ x, y }) => (
          <g>
            {segmentos('media').map((tramo, i) => {
              const arriba = tramo.map((f) => `${x(f.vuelta)} ${y(f.maximo)}`).join(' L ');
              const abajo = [...tramo].reverse().map((f) => `${x(f.vuelta)} ${y(f.minimo)}`).join(' L ');
              const linea = tramo.map((f) => `${x(f.vuelta)} ${y(f.media)}`).join(' L ');
              return (
                <g key={i}>
                  {tramo.length > 1 && <path d={`M ${arriba} L ${abajo} Z`} fill="hsl(var(--primary))" opacity="0.1" />}
                  <path d={`M ${linea}`} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                  {tramo.length === 1 && <circle cx={x(tramo[0].vuelta)} cy={y(tramo[0].media)} r="3" fill="hsl(var(--primary))" />}
                </g>
              );
            })}
          </g>
        )}
      </Lienzo>
    </div>
  );
}

// Tira de tiempos de un corredor: una barra por vuelta, más alta cuanto más
// lenta; las vueltas sin hora van como un punto en gris.
function Tira({ tiempos, maximo }) {
  const alto = 22;
  const anchoBarra = 4;
  const hueco = 1.5;
  const ancho = Math.max(1, tiempos.length) * (anchoBarra + hueco);
  return (
    <svg viewBox={`0 0 ${ancho} ${alto}`} width={ancho} height={alto} className="block" aria-hidden="true">
      {tiempos.map((t, i) => {
        const xx = i * (anchoBarra + hueco);
        if (t == null) return <rect key={i} x={xx} y={alto - 3} width={anchoBarra} height="3" fill="hsl(var(--border))" />;
        const h = Math.max(2, (t / maximo) * alto);
        return <rect key={i} x={xx} y={alto - h} width={anchoBarra} height={h} rx="1" fill="hsl(var(--primary))" opacity="0.85" />;
      })}
    </svg>
  );
}

// Detalle vuelta a vuelta de un corredor (la fila que se despliega bajo la
// suya en la clasificación). Las vueltas se reparten en columnas para que
// cuarenta no hagan una tabla de un metro.
const CELDA = 'py-1.5 px-2 tabular-nums';
const CABECERA = 'py-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground';

function DetalleCorredor({ c, salida, minutosPorVuelta }) {
  const filas = detalleVueltas(c, salida, minutosPorVuelta);
  if (!filas.length) return <p className="text-sm text-muted-foreground">Sin vueltas completadas.</p>;
  // Dos columnas como mucho: tres no caben con las siete cifras de cada fila.
  const porColumna = filas.length > 12 ? Math.ceil(filas.length / 2) : filas.length;
  const columnas = [];
  for (let i = 0; i < filas.length; i += porColumna) columnas.push(filas.slice(i, i + porColumna));
  const sinHora = filas.filter((f) => f.tiempo == null).length;

  return (
    <div className="space-y-3" data-testid={`resultados-detalle-${c.bib}`}>
      <p className="text-sm text-muted-foreground">
        {c.vueltas} vueltas, {formatoHoras(c.vueltas, minutosPorVuelta)} en carrera.
        {c.media != null && ` Promedio ${formatoTiempo(c.media)}, mejor ${formatoTiempo(c.mejor)} (vuelta ${c.mejorVuelta}), más lenta ${formatoTiempo(c.peor)}.`}
        {sinHora > 0 && ` ${sinHora === 1 ? 'Una vuelta' : `${sinHora} vueltas`} sin hora registrada.`}
      </p>
      <div className={`grid gap-x-8 gap-y-4 ${columnas.length === 2 ? 'md:grid-cols-2' : ''}`}>
        {columnas.map((col, k) => (
          <table key={k} className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className={`${CABECERA} text-left`}>Vuelta</th>
                <th className={`${CABECERA} text-left`}>Salida</th>
                <th className={`${CABECERA} text-left`}>Llegada</th>
                <th className={`${CABECERA} text-right`}>Tiempo</th>
                <th className={`${CABECERA} text-right`} title="Respecto a su promedio">vs prom.</th>
                <th className={`${CABECERA} text-right`} title="Respecto a la vuelta anterior">vs ant.</th>
                <th className={`${CABECERA} text-right`}>Descanso</th>
              </tr>
            </thead>
            <tbody>
              {col.map((f) => (
                <tr key={f.vuelta} className={`border-b border-border/60 ${f.vuelta === c.mejorVuelta ? 'bg-secondary' : ''}`}>
                  <td className={`${CELDA} font-mono text-muted-foreground`}>{f.vuelta}</td>
                  <td className={`${CELDA} text-muted-foreground`}>{f.salida}</td>
                  <td className={`${CELDA} text-muted-foreground`}>{f.llegada}</td>
                  <td className={`${CELDA} text-right font-semibold text-foreground`}>{f.tiempo == null ? <span className="font-normal text-muted-foreground">sin hora</span> : formatoTiempo(f.tiempo)}</td>
                  <td className={`${CELDA} text-right text-muted-foreground`}>{formatoDiferencia(f.difPromedio)}</td>
                  <td className={`${CELDA} text-right text-muted-foreground`}>{formatoDiferencia(f.difAnterior)}</td>
                  <td className={`${CELDA} text-right text-muted-foreground`}>{f.descanso == null ? '—' : formatoTiempo(f.descanso)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
    </div>
  );
}

// ---------- Sección ----------

export default function ResultadosMundial({ raceCode = CODIGO_MUNDIAL }) {
  const [datos, setDatos] = useState(null);
  const [abiertos, setAbiertos] = useState(() => new Set());
  const alternar = (bib) => setAbiertos((prev) => {
    const sig = new Set(prev);
    if (sig.has(bib)) sig.delete(bib); else sig.add(bib);
    return sig;
  });

  useEffect(() => {
    let vivo = true;
    fetch(`${API_URL}/api/race/resultados?race_code=${encodeURIComponent(raceCode)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (vivo) setDatos(d); })
      .catch(() => { if (vivo) setDatos(null); });
    return () => { vivo = false; };
  }, [raceCode]);

  const r = useMemo(() => (datos?.corredores?.length ? resumen(datos.corredores, datos.carrera) : null), [datos]);

  if (!r || !r.ganador || r.totalVueltas === 0) return null;

  const carrera = datos.carrera || {};
  const minutosPorVuelta = carrera.minutos_por_vuelta || 60;
  const g = r.ganador;
  const clasifica = g.vueltas >= VUELTAS_PARA_CLASIFICAR;
  const hayTiempos = r.tiempoMedio != null;
  const masLenta = r.masLenta || minutosPorVuelta * 60;
  const fecha = carrera.fecha ? new Date(`${carrera.fecha}T12:00:00`).toLocaleDateString('es-DO', { day: 'numeric', month: 'long', year: 'numeric' }) : null;

  return (
    <div className="space-y-10" data-testid="resultados-mundial">
      {/* Campeón */}
      <div className="border-t-2 border-foreground pt-8">
        <Eyebrow>Resultados{fecha ? ` · ${fecha}` : ''}</Eyebrow>
        <div className="grid lg:grid-cols-[1fr_auto] gap-8 items-end mt-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Trophy className="w-4 h-4 text-primary" aria-hidden="true" />
              Campeón nacional · último en pie
            </p>
            <h3 className="font-display uppercase text-5xl sm:text-7xl leading-none tracking-tight text-foreground mt-2" data-testid="resultados-campeon">
              {g.nombreCompleto}
            </h3>
            <p className="text-base text-muted-foreground mt-4 max-w-2xl">
              {g.vueltas} vueltas, {num(g.km, 1)} km y {formatoHoras(g.vueltas, minutosPorVuelta)} de carrera
              {g.media != null ? `, a ${formatoTiempo(g.media)} de promedio por vuelta` : ''}.
              {clasifica && ` Con ${VUELTAS_PARA_CLASIFICAR} vueltas o más, clasifica al Mundial Individual.`}
            </p>
          </div>
          <div className="flex items-end gap-6 lg:gap-8">
            <div>
              <div className="font-display text-7xl sm:text-8xl leading-none text-foreground">{g.vueltas}</div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mt-1">vueltas</div>
            </div>
            <div className="pb-1">
              <div className="font-display text-4xl leading-none text-foreground">{num(g.km, 1)}</div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mt-1">km</div>
            </div>
            {g.mejor != null && (
              <div className="pb-1">
                <div className="font-display text-4xl leading-none text-foreground">{formatoTiempo(g.mejor)}</div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mt-1">mejor vuelta</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cifras del equipo */}
      <div>
        <Eyebrow>El equipo</Eyebrow>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 border-t border-border mt-3">
          <Cifra icono={Flag} etiqueta="Puntos" valor={num(r.totalVueltas)} detalle="una por cada vuelta completada" />
          <Cifra icono={Route} etiqueta="Kilómetros" valor={num(r.totalKm, 0)} detalle="sumados por el equipo" />
          <Cifra icono={Users} etiqueta="Corredores" valor={num(r.participantes)} detalle={`${num(r.promedioVueltas, 1)} vueltas de promedio`} />
          <Cifra icono={Trophy} etiqueta="Más de un día" valor={num(r.masDeUnDia)} detalle={`${VUELTAS_PARA_CLASIFICAR} vueltas o más`} />
          <Cifra icono={Timer} etiqueta="Ritmo medio" valor={hayTiempos ? formatoTiempo(r.tiempoMedio) : '—'} detalle="por vuelta, todo el equipo" />
          <Cifra
            icono={Zap}
            etiqueta="Vuelta más rápida"
            valor={r.masRapida ? formatoTiempo(r.masRapida.segundos) : '—'}
            detalle={r.masRapida ? `${r.masRapida.corredor.nombreCompleto}, vuelta ${r.masRapida.vuelta}` : null}
          />
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid lg:grid-cols-2 gap-8">
        <div>
          <h4 className="font-display uppercase text-2xl leading-none text-foreground">Corredores en pie</h4>
          <p className="text-sm text-muted-foreground mt-1 mb-4">Cuántos completaron cada vuelta (eje: número de vuelta).</p>
          <GraficoEnPie filas={r.vueltas} />
        </div>
        {hayTiempos && (
          <div>
            <h4 className="font-display uppercase text-2xl leading-none text-foreground">Ritmo del equipo</h4>
            <p className="text-sm text-muted-foreground mt-1 mb-4">Tiempo promedio en cada vuelta; la franja va de la más rápida a la más lenta.</p>
            <GraficoRitmo filas={r.vueltas} minutosPorVuelta={minutosPorVuelta} />
          </div>
        )}
      </div>

      {/* Clasificación */}
      <div>
        <h4 className="font-display uppercase text-2xl leading-none text-foreground">Clasificación</h4>
        <p className="text-sm text-muted-foreground mt-1 mb-4">Cada corredor, con sus vueltas y sus tiempos. Toca un nombre para ver el detalle de cada vuelta.</p>
        <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full text-sm min-w-[720px]" data-testid="resultados-tabla">
            <thead>
              <tr className="border-b-2 border-foreground">
                <th className="text-left py-2.5 pr-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">#</th>
                <th className="text-left py-2.5 px-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Corredor</th>
                <th className="text-right py-2.5 px-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Vueltas</th>
                <th className="text-right py-2.5 px-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Km</th>
                <th className="text-right py-2.5 px-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Promedio</th>
                <th className="text-right py-2.5 px-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Mejor</th>
                <th className="text-left py-2.5 px-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Ritmo</th>
                <th className="text-left py-2.5 pl-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Final</th>
              </tr>
            </thead>
            <tbody>
              {r.corredores.map((c, i) => {
                const clave = c.bib || String(i);
                const abierto = abiertos.has(clave);
                return (
                  <React.Fragment key={clave}>
                    <tr
                      className={`border-b border-border cursor-pointer hover:bg-secondary/60 transition-colors ${abierto ? 'bg-secondary/60' : ''}`}
                      data-testid={`resultados-fila-${i + 1}`}
                      onClick={() => alternar(clave)}
                    >
                      <td className="py-2.5 pr-3 font-mono text-muted-foreground">{String(i + 1).padStart(2, '0')}</td>
                      <td className="py-2.5 px-3 font-medium text-foreground whitespace-nowrap">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 text-left"
                          aria-expanded={abierto}
                          aria-controls={`detalle-${clave}`}
                          onClick={(e) => { e.stopPropagation(); alternar(clave); }}
                        >
                          <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${abierto ? 'rotate-180' : ''}`} aria-hidden="true" />
                          {c.nombreCompleto}
                          {c.status === 'winner' && <Trophy className="w-3.5 h-3.5 text-primary" aria-label="campeón" />}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-foreground tabular-nums">{c.vueltas}</td>
                      <td className="py-2.5 px-3 text-right text-muted-foreground tabular-nums">{num(c.km, 1)}</td>
                      <td className="py-2.5 px-3 text-right text-muted-foreground tabular-nums">{formatoTiempo(c.media)}</td>
                      <td className="py-2.5 px-3 text-right text-muted-foreground tabular-nums">{formatoTiempo(c.mejor)}</td>
                      <td className="py-2.5 px-3"><Tira tiempos={c.tiempos || []} maximo={masLenta} /></td>
                      <td className="py-2.5 pl-3 text-muted-foreground whitespace-nowrap">{comoTermino(c)}</td>
                    </tr>
                    {abierto && (
                      <tr className="border-b border-border bg-background">
                        <td colSpan={8} id={`detalle-${clave}`} className="py-4 pl-3 pr-3 sm:pl-10">
                          <DetalleCorredor c={c} salida={carrera.salida} minutosPorVuelta={minutosPorVuelta} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Los tiempos salen del registro de paso por el arco de cada vuelta. Las vueltas sin hora registrada cuentan como vueltas, pero quedan fuera de los promedios.
        </p>
      </div>
    </div>
  );
}
