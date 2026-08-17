import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { API, getJson, raceStartMs, formatCountdown } from '../liveApi';
import { clic } from '../sonido';
import { rolElegido } from '../sesion';
import PortadaCarrera, { PUERTA_PROPIA } from '../components/PortadaCarrera';

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

// El mismo haz de luz que la pantalla de acceso y la portada: las tres son
// el camino de entrada y se leen como una sola pieza.
const FONDO_NOCTURNO =
  'radial-gradient(90% 55% at 50% -8%, rgba(231,118,34,.30) 0%, rgba(231,118,34,.06) 45%, transparent 72%),'
  + 'radial-gradient(70% 45% at 50% 108%, rgba(133,183,235,.10) 0%, transparent 70%),'
  + '#070707';

// Lo que tarda la lista en apartarse antes de que entre la portada. Coincide
// con `bysd-aparta` en index.css; si allí cambia, aquí también.
const MS_APARTAR = 420;

/**
 * Elegir carrera y, sin cambiar de pantalla, verla.
 *
 * Antes esto llevaba a `/live/portada/:code`, y el salto rompía la idea: eran
 * dos pantallas para un solo gesto. Ahora, al tocar una carrera, las demás se
 * apartan —su hueco se cierra y suben— y en su sitio se despliega la cuenta
 * atrás. La carrera elegida no se mueve de donde estaba: son las otras las que
 * dejan de estar, que es lo que hace que se lea como una sola pantalla.
 *
 * La ruta de la portada sigue existiendo para los enlaces directos, y usa el
 * mismo componente.
 */
export default function RaceSelectScreen() {
  const navigate = useNavigate();
  const [races, setRaces] = useState(null);
  const [winners, setWinners] = useState({});
  const [now, setNow] = useState(Date.now());

  // null mientras se elige. Después, la carrera elegida.
  const [elegida, setElegida] = useState(null);
  // 'lista' | 'apartando' | 'portada'
  const [fase, setFase] = useState('lista');
  const temporizador = useRef(null);

  useEffect(() => {
    let cancel = false;
    getJson('/api/race-config/all')
      .then((data) => { if (!cancel) setRaces(data.races || []); })
      .catch(() => { if (!cancel) setRaces([]); });
    return () => { cancel = true; };
  }, []);

  // Tic para la cuenta regresiva
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => () => clearTimeout(temporizador.current), []);

  // EN VIVO real: la carrera ya arrancó y todavía no hay ganador declarado
  useEffect(() => {
    (races || [])
      .filter((r) => {
        const start = raceStartMs(r);
        return start != null && Date.now() >= start && !r.archived_at;
      })
      .forEach((r) => {
        getJson(`/api/race/stats?race_code=${r.code}`)
          .then((s) => setWinners((prev) => ({ ...prev, [r.code]: !!s?.winner })))
          .catch(() => {});
      });
  }, [races]);

  const elegir = (race) => {
    clic();
    setElegida(race);
    setFase('apartando');
    // La portada entra cuando las otras ya se fueron; si entrara antes, se
    // verían las dos cosas encima y sería justo el salto que se quiere evitar.
    temporizador.current = setTimeout(() => setFase('portada'), MS_APARTAR);

    // La ficha completa trae la hora y el sitio, que el listado no da.
    getJson(`/api/race-config/${race.code}`)
      .then((d) => setElegida((p) => ({ ...(p || {}), ...d })))
      .catch(() => {});
  };

  const volver = () => {
    clic();
    clearTimeout(temporizador.current);
    setFase('lista');
    setElegida(null);
  };

  const today = new Date().toISOString().slice(0, 10);
  // Próximas: la más cercana primero. Pasadas: la más reciente primero.
  const actuales = (races || [])
    .filter((r) => r.is_active || (r.date && r.date >= today && !r.archived_at))
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const pasadas = (races || [])
    .filter((r) => !actuales.includes(r))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const propia = PUERTA_PROPIA[rolElegido()] || null;
  const eligiendo = fase !== 'lista';

  const raceCard = (race, apagada = false) => {
    const salida = raceStartMs(race);
    const arrancada = salida != null && now >= salida;
    const enVivo = arrancada && winners[race.code] === false;
    const faltan = !arrancada && salida != null ? formatCountdown(salida - now) : null;
    const esLaElegida = elegida?.code === race.code;

    // La elegida se queda quieta y se desvanece en su sitio; las demás se
    // apartan cerrando su hueco.
    const salidaClase = !eligiendo ? ''
      : esLaElegida ? 'bysd-desvanece' : 'bysd-aparta';

    return (
      <button
        key={race.code}
        onClick={() => elegir(race)}
        disabled={eligiendo}
        data-testid={`carrera-${race.code}`}
        className={`w-full text-left rounded-[20px] px-4 py-4 mb-2.5 flex items-center gap-3.5
          border bg-white/[0.04] transition-transform duration-100 ease-out active:scale-[0.99]
          ${enVivo
            ? 'border-[rgba(74,222,128,0.34)] shadow-[0_0_26px_rgba(74,222,128,0.10)]'
            : 'border-white/[0.08]'}
          ${apagada ? 'opacity-60' : ''} ${salidaClase}`}
      >
        {race.logo_url && (
          <img
            src={race.logo_url.startsWith('/api') ? `${API}${race.logo_url}` : race.logo_url}
            alt=""
            className="w-11 h-11 rounded-full object-contain bg-white/90 shrink-0"
          />
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] font-medium tracking-[0.06em] leading-snug text-white">
            {race.name}
          </span>
          <span className="block text-[10px] uppercase tracking-[0.1em] text-[#9a9184] mt-1.5">
            {fmtDate(race.date)}
            {faltan ? ` · faltan ${faltan}` : ''}
          </span>
          {enVivo && (
            <span className="inline-flex items-center gap-1.5 mt-2 text-[9px] uppercase tracking-[0.2em] text-[#4ADE80]">
              <span className="w-[5px] h-[5px] rounded-full bg-[#4ADE80] shadow-[0_0_9px_#4ADE80]" />
              En vivo
            </span>
          )}
        </span>
      </button>
    );
  };

  return (
    <div
      className="min-h-[100dvh] flex flex-col text-[#EFE9DD]"
      style={{ background: FONDO_NOCTURNO, WebkitTapHighlightColor: 'transparent' }}
    >
      <div className="w-full max-w-md mx-auto px-7 pb-10 pt-[calc(1.25rem+env(safe-area-inset-top))] flex flex-col items-center flex-1">
        {/* El atrás solo tiene sentido una vez elegida: en la lista no hay de
            dónde volver, y ahora tampoco se ha cambiado de pantalla. */}
        <button
          onClick={volver}
          className={`self-start p-2 -ml-2 text-[#a49c8f] transition-opacity duration-200
            ${eligiendo ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          aria-label="Volver a las carreras"
        >
          <ArrowLeft className="w-5 h-5" strokeWidth={1.6} />
        </button>

        {fase === 'portada' ? (
          <PortadaCarrera
            carrera={elegida}
            ahora={now}
            alEntrar={() => { clic(); navigate(`/live/${elegida.code}`); }}
            puertaPropia={propia}
            alIrAPuerta={() => { clic(); navigate(propia.ruta); }}
          />
        ) : (
          <div className="w-full">
            <p className={`text-xs font-light uppercase tracking-[0.16em] text-[#a49c8f]
              ${eligiendo ? 'bysd-desvanece' : ''}`}
            >
              Elige la carrera
            </p>
            <span className={`block w-7 h-px bg-white/20 mt-4 mb-7 ${eligiendo ? 'bysd-desvanece' : ''}`} />

            {races === null && (
              <div className="flex justify-center py-16 text-[#a49c8f]">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            )}

            {races !== null && (
              <>
                {actuales.length > 0 && (
                  <>
                    <p className={`text-[9px] uppercase tracking-[0.2em] text-[#6d655a] mb-3
                      ${eligiendo ? 'bysd-aparta' : ''}`}
                    >
                      En curso y próximas
                    </p>
                    {actuales.map((r) => raceCard(r))}
                  </>
                )}
                {pasadas.length > 0 && (
                  <>
                    <p className={`text-[9px] uppercase tracking-[0.2em] text-[#6d655a] mt-7 mb-3
                      ${eligiendo ? 'bysd-aparta' : ''}`}
                    >
                      Ediciones anteriores
                    </p>
                    {pasadas.map((r) => raceCard(r, true))}
                  </>
                )}
                {races.length === 0 && (
                  <p className="text-sm text-center py-16 text-[#a49c8f]">No hay carreras disponibles.</p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
