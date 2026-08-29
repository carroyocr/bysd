import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Star, Users, Loader2 } from 'lucide-react';
import { getJson, flagOf, initialsOf, useFollowed, raceStartMs } from '../liveApi';
import { useLiveTheme } from '../liveTheme';
import { Screen, useRace } from '../LiveApp';
import AvisoFavorito, { debeAvisarFavorito } from '../components/AvisoFavorito';

const POLL_MS = 30000;

// "Todos" va primero y es donde abre la pantalla: es la única lista que nunca
// sale vacía, sea cual sea el momento de la carrera.
// "Confirmados" hace de lo que antes era "Activos": quien tiene su plaza
// asegurada y sigue en carrera. Antes de la salida son los que ya pagaron;
// durante la carrera, los que aún no se han retirado. Un solo chip para las
// dos situaciones.
const FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'confirmados', label: 'Confirmados' },
  { key: 'inscritos', label: 'Inscritos' },
  { key: 'espera', label: 'Espera' },
  { key: 'retired', label: 'DNF' },
  { key: 'dns', label: 'DNS' },
  { key: 'favoritos', label: 'Fav' },
];

const FILTRO_INICIAL = 'all';

// Colores para el aro del avatar (estilo tracking de maratón)
const RING_COLORS = ['#E77622', '#4ade80', '#38bdf8', '#a78bfa', '#f472b6', '#facc15'];
const ringOf = (bib) => RING_COLORS[(parseInt(bib, 10) || 0) % RING_COLORS.length];

// Filtro y búsqueda elegidos por carrera: al abrir la ficha de un corredor y
// volver, la pantalla se vuelve a montar y debe conservar la selección.
const vistaPorCarrera = new Map();

/**
 * Seguimiento: lista de corredores con búsqueda por nombre o dorsal y filtros.
 * Cada tarjeta navega a la pantalla dedicada del atleta.
 */
export default function TrackingScreen() {
  const { T } = useLiveTheme();
  const { raceCode, race } = useRace();
  const navigate = useNavigate();

  const [participants, setParticipants] = useState(null);
  const [search, setSearch] = useState(() => vistaPorCarrera.get(raceCode)?.search || '');
  const [filter, setFilter] = useState(() => vistaPorCarrera.get(raceCode)?.filter || FILTRO_INICIAL);
  const followedStore = useFollowed();
  const [followed, setFollowed] = useState(followedStore.read());

  useEffect(() => {
    vistaPorCarrera.set(raceCode, { filter, search });
  }, [raceCode, filter, search]);

  const fetchData = useCallback(async () => {
    try {
      // include_waitlist solo lo pide esta pantalla: el resto del sitio cuenta
      // corredores con plaza y sumarles la espera le descuadraría los números.
      const data = await getJson(`/api/race/participants?race_code=${raceCode}&include_waitlist=true`);
      setParticipants(data);
    } catch {
      setParticipants((prev) => prev || []);
    }
  }, [raceCode]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, POLL_MS);
    return () => clearInterval(id);
  }, [fetchData]);

  // Antes de la salida los que van a correr están en "registered"
  const enCarrera = (p) => p.status === 'active' || p.status === 'registered';
  const esConfirmado = (p) => enCarrera(p) && p.confirmado;
  const esInscrito = (p) => enCarrera(p) && !p.confirmado;

  const counts = useMemo(() => ({
    confirmados: (participants || []).filter(esConfirmado).length,
    inscritos: (participants || []).filter(esInscrito).length,
    espera: (participants || []).filter((p) => p.status === 'waitlist').length,
    retired: (participants || []).filter((p) => p.status === 'retired').length,
    dns: (participants || []).filter((p) => p.status === 'dns').length,
    favoritos: (participants || []).filter((p) => followed.includes(p.bib)).length,
    all: (participants || []).length,
  }), [participants, followed]);

  const cargado = participants !== null && counts.all > 0;
  // En una carrera ya corrida no queda nadie por salir: los dos primeros chips
  // se quedarían a cero y solo estorban.
  const concluida = cargado && counts.confirmados === 0 && counts.inscritos === 0;

  // Antes de la salida nadie puede haberse retirado ni haber faltado, así que
  // DNF y DNS solo estorban. Si la carrera no tiene fecha, se trata como que no
  // ha empezado.
  const inicio = raceStartMs(race);
  const haEmpezado = inicio != null && Date.now() >= inicio;

  const visibleFilters = FILTERS.filter(({ key }) => {
    if (key === 'espera') return counts.espera > 0;          // se pidió ocultarlo si no hay
    if ((key === 'retired' || key === 'dns') && !haEmpezado) return false;
    if (concluida) return key !== 'confirmados' && key !== 'inscritos';
    return true;
  });

  const filtered = useMemo(() => {
    let list = participants || [];
    if (filter === 'favoritos') list = list.filter((p) => followed.includes(p.bib));
    else if (filter === 'confirmados') list = list.filter(esConfirmado);
    else if (filter === 'inscritos') list = list.filter(esInscrito);
    else if (filter === 'espera') list = list.filter((p) => p.status === 'waitlist');
    else if (filter !== 'all') list = list.filter((p) => p.status === filter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((p) =>
        `${p.nombre} ${p.apellidos}`.toLowerCase().includes(q) ||
        (p.bib || '').toLowerCase().includes(q.replace(/^#/, ''))
      );
    }
    return list;
  }, [participants, filter, search, followed]);

  const [avisoFav, setAvisoFav] = useState(false);

  const toggleFollow = (bib) => {
    const agregando = !followed.includes(bib);
    setFollowed(followedStore.toggle(bib));
    if (agregando && debeAvisarFavorito()) setAvisoFav(true);
  };

  const progressLine = (p) => {
    if (p.status === 'waitlist') return 'En lista de espera';
    if (p.status === 'registered') {
      if (p.categoria) {
        return p.categoria === 'titular' ? 'Titular de la selección' : 'Reserva de la selección';
      }
      // El estado del pago no se airea en una lista pública.
      return p.confirmado ? 'Confirmado · listo para la salida' : 'Inscrito';
    }
    if (p.status === 'dns') return 'No inició la carrera';
    if (p.status === 'retired') return `DNF · se retiró en la vuelta ${p.retired_at_lap || p.laps_completed || '—'}`;
    if (p.status === 'winner') return `GANADOR · ${p.laps_completed} vueltas`;
    if (p.status === 'honor') return `Mención de honor · ${p.laps_completed} vueltas`;
    return `Vuelta ${p.laps_completed || 0} · ${(p.total_km || 0).toFixed(1)} km`;
  };

  return (
    <Screen title="Seguimiento">
      <div className="px-3.5 py-3">
        {/* Búsqueda */}
        <div className={`flex items-center gap-2.5 rounded-xl px-3.5 mb-3 ${T.input}`}>
          <Search className="w-4 h-4 shrink-0 opacity-70" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o dorsal"
            className="w-full bg-transparent py-2.5 text-sm outline-none"
          />
        </div>

        {/* Filtros en una sola fila. Antes envolvian: seis filtros no cabian y
            "Fav" se caia a una segunda linea que empujaba la lista hacia abajo.
            Ahora van mas justos y, si la carrera enseña mas filtros de los que
            caben, la fila se desplaza a lo ancho en vez de partirse. */}
        <div className="flex flex-nowrap gap-1 mb-3 overflow-x-auto no-scrollbar">
          {visibleFilters.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`shrink-0 flex flex-col items-center leading-tight px-2 py-1 rounded-lg whitespace-nowrap ${filter === key ? T.chipOn : T.chip}`}
            >
              <span className="text-[9px] font-semibold text-center">{label}</span>
              <span className="text-[10px] font-bold opacity-70 text-center">({counts[key]})</span>
            </button>
          ))}
        </div>

        {participants === null && (
          <div className={`flex justify-center py-16 ${T.muted}`}>
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        )}

        {participants !== null && filtered.length === 0 && (
          <div className={`text-center py-14 px-6 ${T.muted}`}>
            <Users className="w-10 h-10 mx-auto mb-3 opacity-60" />
            <p className="font-semibold">No hay corredores aquí</p>
            {filter === 'favoritos' && (
              <p className="text-xs mt-1.5">Toca la estrella de un corredor para agregarlo a favoritos.</p>
            )}
          </div>
        )}

        {filtered.map((p, idx) => (
          <div
            key={p.bib || `sin-bib-${idx}`}
            onClick={() => p.bib && navigate(`/live/${raceCode}/atleta/${p.bib}`)}
            className={`flex items-center gap-3 rounded-2xl px-3 py-3.5 mb-2.5 ${p.bib ? 'cursor-pointer' : ''} ${['retired', 'dns', 'waitlist'].includes(p.status) ? T.cardOff : T.card}`}
          >
            <div
              className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border-2 ${T.avatar}`}
              style={{ borderColor: ringOf(p.bib) }}
            >
              {initialsOf(p.nombre, p.apellidos)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold truncate">{p.nombre} {p.apellidos}</p>
                {p.status === 'active' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_8px_#4ade80] shrink-0" />
                )}
              </div>
              <p className={`text-[11px] mt-0.5 truncate ${T.muted}`}>
                {flagOf(p.nacionalidad)} {p.nacionalidad}
              </p>
              <p className={`text-[11px] mt-0.5 font-semibold ${p.status === 'active' ? 'text-[#E77622]' : T.subtle}`}>
                {progressLine(p)}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <span className={`text-xs font-mono font-bold ${T.muted}`}>{p.bib ? `#${p.bib}` : ''}</span>
              <button
                aria-label="Seguir"
                onClick={(e) => { e.stopPropagation(); toggleFollow(p.bib); }}
                className="w-8 h-8 flex items-center justify-center"
              >
                <Star className={`w-5 h-5 ${followed.includes(p.bib) ? 'text-[#E77622] fill-[#E77622]' : T.subtle}`} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <AvisoFavorito abierto={avisoFav} onCerrar={() => setAvisoFav(false)} />
    </Screen>
  );
}
