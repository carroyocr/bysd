import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Star, Users, Loader2 } from 'lucide-react';
import { getJson, flagOf, initialsOf, useFollowed } from '../liveApi';
import { useLiveTheme } from '../liveTheme';
import { Screen, useRace } from '../LiveApp';

const POLL_MS = 30000;

const FILTERS = [
  { key: 'active', label: 'Activos' },
  { key: 'retired', label: 'DNF' },
  { key: 'dns', label: 'DNS' },
  { key: 'favoritos', label: 'Favoritos' },
  { key: 'all', label: 'Todos' },
];

// Colores para el aro del avatar (estilo tracking de maratón)
const RING_COLORS = ['#E77622', '#4ade80', '#38bdf8', '#a78bfa', '#f472b6', '#facc15'];
const ringOf = (bib) => RING_COLORS[(parseInt(bib, 10) || 0) % RING_COLORS.length];

/**
 * Seguimiento: lista de corredores con búsqueda por nombre o dorsal y filtros.
 * Cada tarjeta navega a la pantalla dedicada del atleta.
 */
export default function TrackingScreen() {
  const { T } = useLiveTheme();
  const { raceCode } = useRace();
  const navigate = useNavigate();

  const [participants, setParticipants] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('active');
  const followedStore = useFollowed();
  const [followed, setFollowed] = useState(followedStore.read());

  const fetchData = useCallback(async () => {
    try {
      const data = await getJson(`/api/race/participants?race_code=${raceCode}`);
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

  const counts = useMemo(() => ({
    active: (participants || []).filter((p) => p.status === 'active').length,
    retired: (participants || []).filter((p) => p.status === 'retired').length,
    dns: (participants || []).filter((p) => p.status === 'dns').length,
    favoritos: (participants || []).filter((p) => followed.includes(p.bib)).length,
    all: (participants || []).length,
  }), [participants, followed]);

  const filtered = useMemo(() => {
    let list = participants || [];
    if (filter === 'favoritos') list = list.filter((p) => followed.includes(p.bib));
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

  const toggleFollow = (bib) => setFollowed(followedStore.toggle(bib));

  const progressLine = (p) => {
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

        {/* Filtros */}
        <div className="flex gap-2 mb-3 overflow-x-auto pb-0.5">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`shrink-0 text-[11px] font-semibold px-3.5 py-1.5 rounded-full ${filter === key ? T.chipOn : T.chip}`}
            >
              {label} <span className="opacity-60 font-normal">· {counts[key]}</span>
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

        {filtered.map((p) => (
          <div
            key={p.bib}
            onClick={() => navigate(`/live/${raceCode}/atleta/${p.bib}`)}
            className={`flex items-center gap-3 rounded-2xl px-3 py-3.5 mb-2.5 cursor-pointer ${p.status === 'retired' || p.status === 'dns' ? T.cardOff : T.card}`}
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
              <span className={`text-xs font-mono font-bold ${T.muted}`}>#{p.bib}</span>
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
    </Screen>
  );
}
