import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Play, Pause, Download, MapPin, Flag } from 'lucide-react';
import { API } from '../liveApi';
import { useLiveTheme } from '../liveTheme';
import { Screen, useRace } from '../LiveApp';
import { leerGpx, proyectar } from '../gpx';
import { enApp, openExternal, descargarBlob } from '../../lib/nativeExport';

const W = 320;
const H = 300;

// Cuánto tarda el punto en dar una vuelta al circuito, en milisegundos. Doce
// segundos: lo bastante lento para seguirlo con la vista y lo bastante rápido
// para no aburrir a quien solo quiere ver por dónde se corre.
const RECORRIDO_MS = 12000;

/** Dibujo del circuito: el trazado, la salida, las marcas de kilómetro y el corredor. */
function Trazado({ ruta, avance, T }) {
  const puntos = useMemo(() => proyectar(ruta, W, H), [ruta]);
  const linea = useMemo(
    () => puntos.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),
    [puntos],
  );

  // Las marcas de kilómetro: el primer punto que pasa de cada entero.
  const kilometros = useMemo(() => {
    const marcas = [];
    let siguiente = 1;
    ruta.acumulado.forEach((km, i) => {
      if (km >= siguiente && siguiente < ruta.distanciaKm) {
        marcas.push({ km: siguiente, punto: puntos[i] });
        siguiente += 1;
      }
    });
    return marcas;
  }, [ruta, puntos]);

  const indice = Math.min(puntos.length - 1, Math.round(avance * (puntos.length - 1)));
  const corredor = puntos[indice];
  const salida = puntos[0];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full">
      {/* El recorrido ya hecho se pinta encima del trazado completo, para que
          se vea de un vistazo por dónde va. */}
      <path d={linea} fill="none" stroke="currentColor" strokeOpacity="0.22" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d={puntos.slice(0, indice + 1).map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
        fill="none" stroke="#E77622" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
      />

      {kilometros.map(({ km, punto }) => (
        <g key={km}>
          <circle cx={punto.x} cy={punto.y} r="7" fill="currentColor" fillOpacity="0.12" />
          <text x={punto.x} y={punto.y + 3} textAnchor="middle" fontSize="7.5" fill="currentColor" opacity="0.75">
            {km}
          </text>
        </g>
      ))}

      <circle cx={salida.x} cy={salida.y} r="6" fill="#22c55e" stroke="#0C0C0C" strokeWidth="1.5" />
      <circle cx={corredor.x} cy={corredor.y} r="6.5" fill="#FFFFFF" stroke="#E77622" strokeWidth="3" />
    </svg>
  );
}

/** Perfil de altura: la misma vuelta vista de lado. */
function Perfil({ ruta, avance, T }) {
  const alturas = ruta.puntos.map((p) => p.ele);
  if (!alturas.every(Number.isFinite)) return null;

  const w = 320;
  const h = 70;
  const min = Math.min(...alturas);
  const max = Math.max(...alturas);
  const rango = Math.max(max - min, 5);
  const x = (i) => (i / (ruta.puntos.length - 1)) * w;
  const y = (ele) => h - ((ele - min) / rango) * (h - 10) - 4;

  const linea = alturas.map((ele, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(ele).toFixed(1)}`).join(' ');
  const indice = Math.min(alturas.length - 1, Math.round(avance * (alturas.length - 1)));

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[70px]">
      <path d={`${linea} L${w},${h} L0,${h} Z`} fill="#E77622" fillOpacity="0.15" />
      <path d={linea} fill="none" stroke="#E77622" strokeWidth="2" />
      <line x1={x(indice)} x2={x(indice)} y1="0" y2={h} stroke="currentColor" strokeOpacity="0.35" strokeWidth="1" />
      <circle cx={x(indice)} cy={y(alturas[indice])} r="3.5" fill="#FFFFFF" stroke="#E77622" strokeWidth="2" />
    </svg>
  );
}

/**
 * Ruta de la carrera: el circuito que se repite vuelta tras vuelta.
 *
 * Se dibuja el GPX que subió la organización, sin mapa de fondo. No es una
 * limitación disfrazada: en Sierra Prieta no hay cobertura para descargar
 * mosaicos, y lo que hace falta saber -la forma del anillo, dónde está la
 * salida, dónde suben las cuestas- se ve mejor sin una foto de satélite
 * debajo.
 *
 * Algunas sedes cambian el recorrido al caer la noche, así que puede haber dos.
 */
export default function RutaScreen() {
  const { T } = useLiveTheme();
  const { race } = useRace();

  const disponibles = useMemo(() => [
    race?.gpx_dia_url && { clave: 'dia', label: 'Día', url: race.gpx_dia_url },
    race?.gpx_noche_url && { clave: 'noche', label: 'Noche', url: race.gpx_noche_url },
  ].filter(Boolean), [race]);

  const [momento, setMomento] = useState(null);
  const [ruta, setRuta] = useState(null);
  const [estado, setEstado] = useState('cargando');   // cargando | lista | vacia | error
  const [avance, setAvance] = useState(0);
  const [corriendo, setCorriendo] = useState(false);
  const animacion = useRef(null);

  const elegido = disponibles.find((d) => d.clave === momento) || disponibles[0] || null;

  useEffect(() => {
    if (!race) return;
    if (!elegido) { setEstado('vacia'); return; }

    let cancel = false;
    setEstado('cargando');
    setAvance(0);
    setCorriendo(false);

    const url = elegido.url.startsWith('/api') ? `${API}${elegido.url}` : elegido.url;
    fetch(url)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error('no se pudo bajar'))))
      .then((texto) => {
        if (cancel) return;
        const leida = leerGpx(texto);
        if (!leida) { setEstado('error'); return; }
        setRuta(leida);
        setEstado('lista');
      })
      .catch(() => { if (!cancel) setEstado('error'); });

    return () => { cancel = true; };
  }, [race, elegido]);

  // El recorrido: un punto que da la vuelta al circuito. El avance de partida
  // se lee de una referencia y no del estado, para que el efecto no se vuelva a
  // montar en cada cuadro -eso reiniciaría la animación sin parar- y aun así se
  // pueda continuar desde donde se dejó al pausar.
  const avanceRef = useRef(0);
  avanceRef.current = avance;

  useEffect(() => {
    if (!corriendo) return undefined;
    let inicio = null;
    const desde = avanceRef.current >= 1 ? 0 : avanceRef.current;
    const paso = (t) => {
      if (inicio === null) inicio = t - desde * RECORRIDO_MS;
      const nuevo = Math.min(1, (t - inicio) / RECORRIDO_MS);
      setAvance(nuevo);
      if (nuevo >= 1) { setCorriendo(false); return; }
      animacion.current = requestAnimationFrame(paso);
    };
    animacion.current = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(animacion.current);
  }, [corriendo]);

  const alternar = () => {
    if (!corriendo && avance >= 1) setAvance(0);
    setCorriendo((v) => !v);
  };

  const descargar = useCallback(async () => {
    if (!elegido) return;
    const url = elegido.url.startsWith('/api') ? `${API}${elegido.url}` : elegido.url;
    const nombre = `ruta-${elegido.clave}-${race?.code || 'bysd'}.gpx`;
    if (enApp()) {
      // En la app se abre fuera: el sistema ofrece guardarlo o mandarlo al
      // reloj, que es lo que se quiere hacer con un GPX.
      openExternal(url);
      return;
    }
    try {
      const blob = await (await fetch(url)).blob();
      descargarBlob(nombre, blob);
    } catch {
      openExternal(url);
    }
  }, [elegido, race]);

  const kmRecorridos = ruta ? (avance * ruta.distanciaKm) : 0;
  const alturaActual = ruta
    ? ruta.puntos[Math.min(ruta.puntos.length - 1, Math.round(avance * (ruta.puntos.length - 1)))].ele
    : null;

  return (
    <Screen title="Ruta" back showAds>
      <div className="px-4 py-4">
        {estado === 'vacia' && (
          <div className={`text-center py-16 ${T.muted}`}>
            <MapPin className="w-10 h-10 mx-auto mb-3 opacity-60" />
            <p className="font-semibold">Todavía no hay ruta publicada</p>
            <p className="text-xs mt-1.5">La organización la carga antes de la carrera.</p>
          </div>
        )}

        {estado === 'error' && (
          <div className={`text-center py-16 ${T.muted}`}>
            <MapPin className="w-10 h-10 mx-auto mb-3 opacity-60" />
            <p className="font-semibold">No se pudo leer la ruta</p>
            <p className="text-xs mt-1.5">Inténtalo de nuevo cuando tengas señal.</p>
          </div>
        )}

        {estado === 'cargando' && (
          <div className={`flex justify-center py-20 ${T.muted}`}>
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        )}

        {estado === 'lista' && ruta && (
          <>
            {disponibles.length > 1 && (
              <div className="flex gap-2 mb-3">
                {disponibles.map((d) => (
                  <button
                    key={d.clave}
                    onClick={() => setMomento(d.clave)}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold ${elegido.clave === d.clave ? T.chipOn : T.chip}`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            )}

            <div className={`rounded-2xl p-3 ${T.card}`}>
              <Trazado ruta={ruta} avance={avance} T={T} />

              {/* Recorrer la vuelta: el punto va por el trazado y la barra deja
                  pararlo donde uno quiera mirar. */}
              <div className="flex items-center gap-3 mt-1 px-1">
                <button
                  onClick={alternar}
                  aria-label={corriendo ? 'Pausar' : 'Recorrer la vuelta'}
                  className="w-10 h-10 rounded-full bg-[#E77622] text-white flex items-center justify-center shrink-0"
                >
                  {corriendo ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1000"
                  value={Math.round(avance * 1000)}
                  onChange={(e) => { setCorriendo(false); setAvance(Number(e.target.value) / 1000); }}
                  className="flex-1 accent-[#E77622]"
                  aria-label="Punto del recorrido"
                />
                <span className={`text-xs font-mono w-16 text-right ${T.muted}`}>
                  {kmRecorridos.toFixed(2)} km
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-3">
              {[
                { valor: `${ruta.distanciaKm.toFixed(2)}`, unidad: 'KM POR VUELTA' },
                { valor: `${ruta.subidaM}`, unidad: 'METROS DE SUBIDA' },
                {
                  valor: Number.isFinite(alturaActual) ? `${Math.round(alturaActual)}` : '—',
                  unidad: 'ALTURA (M)',
                },
              ].map(({ valor, unidad }) => (
                <div key={unidad} className={`rounded-xl py-3 text-center ${T.card}`}>
                  <p className="text-lg font-extrabold font-mono">{valor}</p>
                  <p className={`text-[9px] tracking-wider mt-0.5 ${T.subtle}`}>{unidad}</p>
                </div>
              ))}
            </div>

            <div className={`rounded-2xl p-3 mt-3 ${T.card}`}>
              <p className={`text-[10px] tracking-widest mb-1 ${T.subtle}`}>PERFIL DE ALTURA</p>
              <Perfil ruta={ruta} avance={avance} T={T} />
            </div>

            <div className={`flex items-center gap-2 mt-3 text-[11px] ${T.muted}`}>
              <Flag className="w-3.5 h-3.5 text-green-500 shrink-0" />
              <span>El punto verde es la salida y la meta: la vuelta se repite entera cada hora.</span>
            </div>

            <button
              onClick={descargar}
              className={`mt-3 w-full rounded-xl py-3 text-sm font-bold flex items-center justify-center gap-2 ${T.chip}`}
            >
              <Download className="w-4 h-4" /> Descargar GPX para el reloj
            </button>
          </>
        )}
      </div>
    </Screen>
  );
}
