import React, { useCallback, useEffect, useState } from 'react';
import { Clock, Route, Sigma, Cloud, CloudRain, Sun, Loader2 } from 'lucide-react';
import { getJson } from '../liveApi';
import { useLiveTheme } from '../liveTheme';
import { Screen, useRace } from '../LiveApp';
import AdFooter from '../components/AdFooter';

const POLL_MS = 30000;
const POLL_CLIMA_MS = 10 * 60 * 1000;

const NARANJA = '#E77622';
const VERDE = '#4ade80';
const ROJO = '#f87171';
const GRIS = '#9a9a9a';

const ICONO_CLIMA = { soleado: Sun, lloviendo: CloudRain, nublado: Cloud };
const NOMBRE_CLIMA = { soleado: 'Soleado', lloviendo: 'Lloviendo', nublado: 'Nublado' };

const mmss = (segundos) => {
  const s = Math.max(0, segundos || 0);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/** Fila de dato: icono, nombre y el número grande a la derecha. */
function Dato({ Icono, etiqueta, valor, unidad, T }) {
  return (
    <div className={`flex items-center gap-3.5 py-3.5 border-b ${T.divider}`}>
      <Icono className={`w-5 h-5 shrink-0 ${T.subtle}`} strokeWidth={1.6} />
      <span className={`flex-1 text-[13px] ${T.muted}`}>{etiqueta}</span>
      <span className="text-[28px] font-light tracking-tight tabular-nums">{valor}</span>
      <span className={`text-[11px] w-6 ${T.subtle}`}>{unidad}</span>
    </div>
  );
}

/**
 * Tablero de la carrera: la vuelta en curso arriba, las cifras acumuladas
 * debajo, el clima y el patrocinador al cerrar.
 *
 * Todo tiene que caber de una vez en la pantalla del teléfono: un tablero al
 * que hay que bajarle el dedo para ver cuántos corredores quedan no es un
 * tablero. Por eso los tamaños de aquí son los que son.
 */
export default function DashboardScreen() {
  const { T } = useLiveTheme();
  const { raceCode } = useRace();

  const [stats, setStats] = useState(null);
  const [vuelta, setVuelta] = useState(null);
  const [clima, setClima] = useState(null);
  // El contador corre en el teléfono; del backend solo llega el punto de
  // partida cada medio minuto.
  const [restantes, setRestantes] = useState(null);

  const cargar = useCallback(async () => {
    const [s, v] = await Promise.allSettled([
      getJson(`/api/race/stats?race_code=${raceCode}`),
      getJson(`/api/race/lap-status?race_code=${raceCode}`),
    ]);
    if (s.status === 'fulfilled') setStats(s.value);
    if (v.status === 'fulfilled') {
      setVuelta(v.value);
      setRestantes(v.value.seconds_remaining ?? 0);
    }
  }, [raceCode]);

  useEffect(() => {
    cargar();
    const id = setInterval(cargar, POLL_MS);
    return () => clearInterval(id);
  }, [cargar]);

  useEffect(() => {
    const pedir = () => getJson(`/api/race/clima?race_code=${raceCode}`)
      .then((d) => setClima(d.clima))
      .catch(() => {});
    pedir();
    const id = setInterval(pedir, POLL_CLIMA_MS);
    return () => clearInterval(id);
  }, [raceCode]);

  // Tic del contador. Al llegar a cero se pide de nuevo: ahí empieza la vuelta
  // siguiente y el número de arriba tiene que cambiar sin esperar al poll.
  useEffect(() => {
    const parada = !vuelta?.race_started || vuelta?.race_finished || vuelta?.estado === 'cerrada';
    if (restantes == null || parada) return undefined;
    // El respiro antes de volver a preguntar evita una ráfaga de llamadas si
    // el reloj del teléfono va un pelo por delante del servidor.
    const id = restantes <= 0
      ? setTimeout(cargar, 1200)
      : setTimeout(() => setRestantes((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [restantes, vuelta, cargar]);

  if (!stats || !vuelta) {
    return (
      <Screen title="Tablero" back>
        <div className={`flex justify-center py-24 ${T.muted}`}>
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      </Screen>
    );
  }

  // Una carrera cerrada no tiene vuelta en curso: la última que se corrió es
  // la que cuentan los corredores. Ahí el reloj de `lap-status` y el número de
  // `stats` no coinciden, y manda `stats`, que es el que cuadra con las vueltas
  // y los kilómetros de la gente.
  const cerrada = vuelta.race_finished || vuelta.estado === 'cerrada';
  const enCarrera = vuelta.race_started && !cerrada;
  const activos = stats.athletes_active || 0;
  const dnf = stats.athletes_dnf || 0;
  const dns = stats.athletes_dns || 0;

  // Terminada la carrera ya no hay nadie corriendo: "Activos 0" es la verdad
  // más inútil que se puede poner en un tablero. Lo que se quiere ver ahí es
  // quién ganó, así que esa columna pasa a ser el ganador.
  const columnas = stats.winner
    ? [
        { etiqueta: 'GANADOR', n: 1, color: NARANJA },
        { etiqueta: 'DNF', n: dnf, color: ROJO },
        { etiqueta: 'DNS', n: dns, color: GRIS },
      ]
    : [
        { etiqueta: 'ACTIVOS', n: activos, color: VERDE },
        { etiqueta: 'DNF', n: dnf, color: ROJO },
        { etiqueta: 'DNS', n: dns, color: GRIS },
      ];
  const total = columnas.reduce((suma, c) => suma + c.n, 0);

  // Una backyard es una vuelta por hora: las horas acumuladas son las vueltas
  // que ya se completaron, las mismas con las que se cuentan los kilómetros.
  const horas = stats.total_laps_completed || 0;
  // La vuelta no siempre dura una hora: la duración sale del propio reloj de
  // la carrera, que es quien sabe cuánto mide.
  const duracion = vuelta.lap_start_time && vuelta.lap_end_time
    ? (new Date(vuelta.lap_end_time) - new Date(vuelta.lap_start_time)) / 1000
    : 3600;
  const avance = enCarrera
    ? Math.min(100, Math.max(0, 100 * (1 - (restantes || 0) / (duracion || 3600))))
    : 0;

  const condicion = clima?.condicion || 'nublado';
  const IconoClima = ICONO_CLIMA[condicion] || Cloud;

  return (
    <Screen title="Tablero" back>
      <div className="px-4 pt-4">
        {/* La vuelta en curso: lo único que se ve desde el otro lado de la carpa */}
        <p className="text-[10px] tracking-[0.3em] mb-2.5" style={{ color: NARANJA }}>
          {cerrada ? 'VUELTA FINAL' : 'VUELTA'}
        </p>
        <div className="flex items-end justify-between">
          <span className="text-[96px] font-light leading-[0.78] tracking-[-0.06em] tabular-nums">
            {cerrada ? horas : (vuelta.race_started ? stats.current_lap : '—')}
          </span>
          <div className="text-right pb-2.5">
            {enCarrera ? (
              <>
                <p className="text-[15px] tabular-nums" style={{ color: NARANJA }}>{mmss(restantes)}</p>
                <p className={`text-[9px] tracking-[0.16em] mt-1 ${T.subtle}`}>RESTANTES</p>
              </>
            ) : (
              <p className={`text-[9px] tracking-[0.16em] ${T.subtle}`}>
                {cerrada ? 'CARRERA CERRADA' : 'SIN SALIR'}
              </p>
            )}
          </div>
        </div>
        <div className="relative h-[2px] mt-5 overflow-hidden">
          <span className="absolute inset-0 bg-current opacity-[0.14]" />
          <span
            className="absolute inset-y-0 left-0 transition-[width] duration-1000 ease-linear"
            style={{ width: `${avance}%`, backgroundColor: NARANJA }}
          />
        </div>

        <div className="mt-2">
          <Dato Icono={Clock} etiqueta="Horas acumuladas" valor={horas} unidad="h" T={T} />
          <Dato Icono={Route} etiqueta="Kilómetros" valor={(stats.total_km || 0).toFixed(1)} unidad="km" T={T} />
          {/* Lo que llevan corrido todos juntos, incluidos los que ya se
              retiraron: es un número de miles, así que va sin decimales. */}
          <Dato
            Icono={Sigma}
            etiqueta="Suma de todos"
            valor={Math.round(stats.total_km_all_athletes || 0).toLocaleString('es-DO')}
            unidad="km"
            T={T}
          />
        </div>

        {/* Corredores: la barra dice de un vistazo cuántos quedan en pie */}
        <div className={`py-4 border-b ${T.divider}`}>
          <div className="flex justify-between items-baseline mb-3">
            <span className={`text-[13px] ${T.muted}`}>Corredores</span>
            <span className={`text-[11px] ${T.subtle}`}>{total} en total</span>
          </div>
          <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
            {total === 0 ? (
              <span className="flex-1 bg-current opacity-[0.14]" />
            ) : (
              columnas.map(({ etiqueta, n, color }) => (
                n > 0 ? <span key={etiqueta} style={{ flex: n, backgroundColor: color }} /> : null
              ))
            )}
          </div>
          <div className="flex gap-5 mt-3.5">
            {columnas.map(({ etiqueta, n, color }) => (
              <div key={etiqueta} className="flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                  <span className={`text-[10px] tracking-[0.1em] ${T.subtle}`}>{etiqueta}</span>
                </div>
                <p className="text-[26px] font-light mt-1 tabular-nums">{n}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {clima && (
        <div className="px-4 pt-4 pb-1 flex items-center gap-4">
          <IconoClima className="w-7 h-7 shrink-0" strokeWidth={1.4} style={{ color: '#8fb4d8' }} />
          <div className="flex-1">
            <p className="text-[14px]">{NOMBRE_CLIMA[condicion] || 'Nublado'}</p>
            <p className={`text-[10px] tracking-[0.14em] mt-0.5 ${T.subtle}`}>CLIMA</p>
          </div>
          <div className="flex gap-5 items-baseline">
            <p className="text-[24px] font-light tabular-nums">
              {clima.temperatura}<span className={`text-[13px] ${T.subtle}`}>°</span>
            </p>
            <p className="text-[24px] font-light tabular-nums">
              {clima.humedad}<span className={`text-[13px] ${T.subtle}`}>%</span>
            </p>
          </div>
        </div>
      )}

      {/* El patrocinador cierra la pantalla, debajo del clima */}
      <div className="pt-2 pb-[calc(0.25rem+env(safe-area-inset-bottom))]">
        <AdFooter raceCode={raceCode} inline />
      </div>
    </Screen>
  );
}
