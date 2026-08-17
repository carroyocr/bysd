import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { getJson, raceStartMs, formatCountdown } from '../liveApi';
import { clic } from '../sonido';

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

// El mismo haz de luz que la pantalla de acceso: las dos son el camino de
// entrada y se leen como una sola pieza.
const FONDO_NOCTURNO =
  'radial-gradient(90% 55% at 50% -8%, rgba(231,118,34,.30) 0%, rgba(231,118,34,.06) 45%, transparent 72%),'
  + 'radial-gradient(70% 45% at 50% 108%, rgba(133,183,235,.10) 0%, transparent 70%),'
  + '#070707';

/**
 * Elegir carrera: el último paso antes de entrar en ella.
 *
 * Tocar una carrera entra directamente. Hubo en medio una portada con la
 * cuenta atrás, y se quitó: era una pantalla de paso entre elegir y ver, y lo
 * que decía —cuándo es y cuánto falta— ya está aquí, en la propia ficha. Se
 * intentó fundir las dos con una transición y no acababa de leerse como una
 * sola pantalla, así que se dejó una.
 *
 * Sin barra ni menú, como la pantalla de acceso: aquí no hay nada que
 * consultar, solo elegir.
 */
export default function RaceSelectScreen() {
  const navigate = useNavigate();
  const [races, setRaces] = useState(null);
  const [winners, setWinners] = useState({});
  const [now, setNow] = useState(Date.now());

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

  const today = new Date().toISOString().slice(0, 10);
  // Próximas: la más cercana primero. Pasadas: la más reciente primero.
  const actuales = (races || [])
    .filter((r) => r.is_active || (r.date && r.date >= today && !r.archived_at))
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const pasadas = (races || [])
    .filter((r) => !actuales.includes(r))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const raceCard = (race, apagada = false) => {
    const salida = raceStartMs(race);
    const arrancada = salida != null && now >= salida;
    const enVivo = arrancada && winners[race.code] === false;
    const faltan = !arrancada && salida != null ? formatCountdown(salida - now) : null;

    return (
      <button
        key={race.code}
        onClick={() => { clic(); navigate(`/live/${race.code}`); }}
        data-testid={`carrera-${race.code}`}
        className={`w-full text-left rounded-[20px] px-4 py-4 mb-2.5 block
          border bg-white/[0.04] transition-transform duration-100 ease-out active:scale-[0.99]
          ${enVivo
            ? 'border-[rgba(74,222,128,0.34)] shadow-[0_0_26px_rgba(74,222,128,0.10)]'
            : 'border-white/[0.08]'}
          ${apagada ? 'opacity-60' : ''}`}
      >
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
      </button>
    );
  };

  return (
    <div
      className="min-h-[100dvh] text-[#EFE9DD]"
      style={{ background: FONDO_NOCTURNO, WebkitTapHighlightColor: 'transparent' }}
    >
      <div className="w-full max-w-md mx-auto px-7 pb-10 pt-[calc(3rem+env(safe-area-inset-top))]">
        <p className="text-xs font-light uppercase tracking-[0.16em] text-[#a49c8f]">
          Elige la carrera
        </p>
        <span className="block w-7 h-px bg-white/20 mt-4 mb-7" />

        {races === null && (
          <div className="flex justify-center py-16 text-[#a49c8f]">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        )}

        {races !== null && (
          <>
            {actuales.length > 0 && (
              <>
                <p className="text-[9px] uppercase tracking-[0.2em] text-[#6d655a] mb-3">
                  En curso y próximas
                </p>
                {actuales.map((r) => raceCard(r))}
              </>
            )}
            {pasadas.length > 0 && (
              <>
                <p className="text-[9px] uppercase tracking-[0.2em] text-[#6d655a] mt-7 mb-3">
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
    </div>
  );
}
