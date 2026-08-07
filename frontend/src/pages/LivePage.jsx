import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Users, Star, MessageCircle, Trophy, Sun, Moon, Send, X,
  ExternalLink, MapPin, Medal, Clock, Loader2
} from 'lucide-react';
import { useRaceConfig } from '../contexts/RaceConfigContext';

const API = process.env.REACT_APP_BACKEND_URL;

// Misma clave que LiveDashboard para que los favoritos se compartan entre vistas
const FOLLOWED_ATHLETES_KEY = 'backyard_ultra_followed_athletes';
const THEME_KEY = 'bysd_live_theme';

const POLL_MS = 30000;       // participantes y stats
const AD_ROTATE_MS = 8000;   // rotación del banner del pie

// ISO3 -> ISO2 para pintar la bandera; si el valor no está, se muestra el texto tal cual
const ISO3_TO_ISO2 = {
  DOM: 'DO', CRC: 'CR', PAN: 'PA', MEX: 'MX', USA: 'US', PUR: 'PR', COL: 'CO',
  VEN: 'VE', ESP: 'ES', FRA: 'FR', ARG: 'AR', CHI: 'CL', CHL: 'CL', PER: 'PE',
  BRA: 'BR', ECU: 'EC', GUA: 'GT', GTM: 'GT', HON: 'HN', HND: 'HN', NCA: 'NI',
  NIC: 'NI', ESA: 'SV', SLV: 'SV', CUB: 'CU', HAI: 'HT', HTI: 'HT', JAM: 'JM',
  CAN: 'CA', GER: 'DE', DEU: 'DE', ITA: 'IT', POR: 'PT', PRT: 'PT', GBR: 'GB',
  URU: 'UY', URY: 'UY', PAR: 'PY', PRY: 'PY', BOL: 'BO',
};

function flagOf(nacionalidad) {
  if (!nacionalidad) return '';
  const iso2 = ISO3_TO_ISO2[String(nacionalidad).trim().toUpperCase()];
  if (!iso2) return '';
  return String.fromCodePoint(...[...iso2].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

function initialsOf(nombre, apellidos) {
  const a = (nombre || '').trim().charAt(0);
  const b = (apellidos || '').trim().charAt(0);
  return `${a}${b}`.toUpperCase() || '?';
}

function formatElapsed(ms) {
  if (ms < 0) return null;
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Paleta por tema. Un solo lugar para todas las clases que cambian con el modo.
const THEMES = {
  dark: {
    page: 'bg-[#0C0C0C] text-white',
    header: 'bg-[#111111] border-b border-[#222222]',
    clock: 'bg-[#1d1d1d] border border-[#333333] text-[#E77622]',
    themeBtn: 'bg-[#1d1d1d] border border-[#333333] text-[#cccccc]',
    tab: 'bg-[#1a1a1a] text-[#888888] border border-[#262626]',
    tabOn: 'bg-[#E77622] text-white border border-[#E77622] shadow-[0_0_18px_rgba(231,118,34,0.45)]',
    chip: 'bg-[#1a1a1a] text-[#999999] border border-[#2a2a2a]',
    chipOn: 'bg-[#2a1a0d] text-[#E77622] border border-[#E77622]',
    card: 'bg-[#161616] border border-[#242424]',
    cardOff: 'bg-[#161616] border border-[#242424] opacity-60',
    avatar: 'bg-[#2b2b2b] text-[#E77622] border-2 border-[#E77622]',
    avatarOff: 'bg-[#2b2b2b] text-[#888888] border-2 border-[#444444]',
    muted: 'text-[#9a9a9a]',
    subtle: 'text-[#777777]',
    footer: 'bg-[#161616] border-t border-[#262626]',
    input: 'bg-[#1a1a1a] border border-[#2a2a2a] text-white placeholder-[#666666]',
    modal: 'bg-[#161616] border border-[#2a2a2a] text-white',
    itraBox: 'bg-[#1d1509] border border-[#3a2a12]',
    divider: 'border-[#242424]',
  },
  light: {
    page: 'bg-[#FAF6EA] text-[#232323]',
    header: 'bg-white border-b border-[#eee3c2]',
    clock: 'bg-[#FBF3E2] border border-[#eddfb5] text-[#E77622]',
    themeBtn: 'bg-[#FBF3E2] border border-[#eddfb5] text-[#8a6a1e]',
    tab: 'bg-[#F4EDD8] text-[#8a8060] border border-[#eadfba]',
    tabOn: 'bg-[#E77622] text-white border border-[#E77622] shadow-[0_4px_14px_rgba(231,118,34,0.35)]',
    chip: 'bg-white text-[#8a8060] border border-[#e8dcb4]',
    chipOn: 'bg-[#FDEEDF] text-[#E77622] border border-[#E77622]',
    card: 'bg-white border border-[#efe6c8] shadow-sm',
    cardOff: 'bg-white border border-[#efe6c8] opacity-60',
    avatar: 'bg-[#F2E8C7] text-[#8a6a1e] border-2 border-[#E77622]',
    avatarOff: 'bg-[#F2E8C7] text-[#999999] border-2 border-[#cccccc]',
    muted: 'text-[#9a8f6a]',
    subtle: 'text-[#b08944]',
    footer: 'bg-white border-t border-[#efe6c8]',
    input: 'bg-white border border-[#e8dcb4] text-[#232323] placeholder-[#b0a685]',
    modal: 'bg-white border border-[#e8dcb4] text-[#232323]',
    itraBox: 'bg-[#FDF6E3] border border-[#eddfb5]',
    divider: 'border-[#efe6c8]',
  },
};

const TABS = [
  { key: 'atletas', label: 'Atletas', Icon: Users },
  { key: 'favoritos', label: 'Favoritos', Icon: Star },
  { key: 'animo', label: 'Ánimo', Icon: MessageCircle },
  { key: 'ganadores', label: 'Ganadores', Icon: Trophy },
];

const FILTERS = [
  { key: 'active', label: 'Activos' },
  { key: 'retired', label: 'DNF' },
  { key: 'dns', label: 'DNS' },
  { key: 'all', label: 'Todos' },
];

export default function LivePage() {
  const { config, getRaceStartDate } = useRaceConfig();

  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'dark');
  const T = THEMES[theme] || THEMES.dark;

  const [tab, setTab] = useState('atletas');
  const [filter, setFilter] = useState('active');

  const [participants, setParticipants] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  const [followed, setFollowed] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(FOLLOWED_ATHLETES_KEY)) || [];
    } catch {
      return [];
    }
  });

  // Ficha de atleta
  const [profileBib, setProfileBib] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Mensajes de ánimo
  const [cheers, setCheers] = useState([]);
  const [cheerBib, setCheerBib] = useState('');
  const [cheerName, setCheerName] = useState(() => localStorage.getItem('bysd_live_fan_name') || '');
  const [cheerMsg, setCheerMsg] = useState('');
  const [cheerSending, setCheerSending] = useState(false);
  const [cheerResult, setCheerResult] = useState(null);

  // Publicidad del pie
  const [banners, setBanners] = useState([]);
  const [adIndex, setAdIndex] = useState(0);
  const impressionsSent = useRef(new Set());

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(FOLLOWED_ATHLETES_KEY, JSON.stringify(followed));
  }, [followed]);

  // Reloj de carrera (cada segundo)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const fetchRaceData = useCallback(async () => {
    try {
      const [pRes, sRes] = await Promise.all([
        fetch(`${API}/api/race/participants`),
        fetch(`${API}/api/race/stats`),
      ]);
      if (pRes.ok) setParticipants(await pRes.json());
      if (sRes.ok) setStats(await sRes.json());
    } catch (error) {
      console.error('Error cargando datos de carrera:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRaceData();
    const id = setInterval(fetchRaceData, POLL_MS);
    return () => clearInterval(id);
  }, [fetchRaceData]);

  const fetchCheers = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/race/cheers?limit=20`);
      if (res.ok) {
        const data = await res.json();
        setCheers(data.messages || data || []);
      }
    } catch (error) {
      console.error('Error cargando mensajes:', error);
    }
  }, []);

  useEffect(() => {
    if (tab !== 'animo') return;
    fetchCheers();
    const id = setInterval(fetchCheers, POLL_MS);
    return () => clearInterval(id);
  }, [tab, fetchCheers]);

  // Banners: se cargan una vez y rotan ponderados por peso
  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const res = await fetch(`${API}/api/ads/public`);
        if (res.ok) setBanners(await res.json());
      } catch (error) {
        console.error('Error cargando publicidad:', error);
      }
    };
    fetchBanners();
    const id = setInterval(fetchBanners, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const adPlaylist = useMemo(() => {
    const list = [];
    banners.forEach((b) => {
      for (let i = 0; i < Math.max(1, b.weight || 1); i++) list.push(b);
    });
    return list;
  }, [banners]);

  useEffect(() => {
    if (adPlaylist.length <= 1) return;
    const id = setInterval(() => setAdIndex((i) => (i + 1) % adPlaylist.length), AD_ROTATE_MS);
    return () => clearInterval(id);
  }, [adPlaylist.length]);

  const currentAd = adPlaylist.length ? adPlaylist[adIndex % adPlaylist.length] : null;

  // Una impresión por banner por sesión: métrica honesta sin inflar por rotación
  useEffect(() => {
    if (!currentAd || impressionsSent.current.has(currentAd.id)) return;
    impressionsSent.current.add(currentAd.id);
    fetch(`${API}/api/ads/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ banner_id: currentAd.id, event: 'impression' }),
    }).catch(() => {});
  }, [currentAd]);

  const handleAdClick = (banner) => {
    fetch(`${API}/api/ads/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ banner_id: banner.id, event: 'click' }),
    }).catch(() => {});
    if (banner.link_url) {
      const url = banner.link_url.startsWith('http') ? banner.link_url : `https://${banner.link_url}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const toggleFollow = (bib) => {
    setFollowed((prev) => (prev.includes(bib) ? prev.filter((b) => b !== bib) : [...prev, bib]));
  };

  const openProfile = async (bib) => {
    setProfileBib(bib);
    setProfile(null);
    setProfileLoading(true);
    try {
      const res = await fetch(`${API}/api/athletes/public-profile/${bib}`);
      if (res.ok) setProfile(await res.json());
    } catch (error) {
      console.error('Error cargando ficha:', error);
    } finally {
      setProfileLoading(false);
    }
  };

  const openCheerFor = (bib) => {
    setCheerBib(bib);
    setCheerResult(null);
    setTab('animo');
  };

  const sendCheer = async () => {
    if (!cheerBib || !cheerName.trim() || !cheerMsg.trim()) {
      setCheerResult({ ok: false, text: 'Elige un atleta y completa tu nombre y mensaje.' });
      return;
    }
    setCheerSending(true);
    setCheerResult(null);
    try {
      const res = await fetch(`${API}/api/race/cheer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ athlete_bib: cheerBib, fan_name: cheerName.trim(), message: cheerMsg.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('bysd_live_fan_name', cheerName.trim());
        setCheerResult({ ok: true, text: `¡Mensaje enviado a ${data.athlete_name}!` });
        setCheerMsg('');
        fetchCheers();
      } else {
        setCheerResult({ ok: false, text: data.detail || 'No se pudo enviar el mensaje.' });
      }
    } catch (error) {
      setCheerResult({ ok: false, text: 'Error de conexión. Intenta de nuevo.' });
    } finally {
      setCheerSending(false);
    }
  };

  // Derivados
  const counts = useMemo(() => ({
    active: participants.filter((p) => p.status === 'active').length,
    retired: participants.filter((p) => p.status === 'retired').length,
    dns: participants.filter((p) => p.status === 'dns').length,
    all: participants.length,
  }), [participants]);

  const filtered = useMemo(() => {
    if (filter === 'all') return participants;
    return participants.filter((p) => p.status === filter);
  }, [participants, filter]);

  const favorites = useMemo(
    () => participants.filter((p) => followed.includes(p.bib)),
    [participants, followed]
  );

  const winners = useMemo(
    () => participants.filter((p) => p.status === 'winner' || p.status === 'honor'),
    [participants]
  );

  const lastStanding = useMemo(
    () => [...participants].filter((p) => p.status === 'active')
      .sort((a, b) => (b.laps_completed || 0) - (a.laps_completed || 0))
      .slice(0, 3),
    [participants]
  );

  const activeAndRecent = useMemo(
    () => participants.filter((p) => ['active', 'retired', 'winner', 'honor'].includes(p.status)),
    [participants]
  );

  const raceStart = getRaceStartDate();
  const elapsed = raceStart ? formatElapsed(now - raceStart.getTime()) : null;

  const statusBadge = (p) => {
    if (p.status === 'retired') {
      return (
        <span className="ml-auto shrink-0 text-[10px] font-extrabold tracking-wider px-2 py-1 rounded-md bg-red-500/15 text-red-500 border border-red-500/40">
          DNF{p.retired_at_lap ? ` · V${p.retired_at_lap}` : ''}
        </span>
      );
    }
    if (p.status === 'dns') {
      return (
        <span className="ml-auto shrink-0 text-[10px] font-extrabold tracking-wider px-2 py-1 rounded-md bg-gray-500/15 text-gray-400 border border-gray-500/40">
          DNS
        </span>
      );
    }
    return (
      <div className="ml-auto shrink-0 text-right">
        <div className="text-xl font-bold text-[#E77622] font-mono leading-none">{p.laps_completed || 0}</div>
        <div className={`text-[9px] tracking-widest ${T.subtle}`}>VUELTAS</div>
      </div>
    );
  };

  const runnerRow = (p, { off = false } = {}) => (
    <div
      key={p.bib}
      className={`flex items-center gap-3 rounded-2xl px-3 py-3 mb-2.5 cursor-pointer ${off ? T.cardOff : T.card}`}
      onClick={() => openProfile(p.bib)}
    >
      <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${off ? T.avatarOff : T.avatar}`}>
        {initialsOf(p.nombre, p.apellidos)}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-sm font-bold truncate">
          {p.status === 'active' && (
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_8px_#4ade80] shrink-0" />
          )}
          <span className="truncate">{p.nombre} {p.apellidos}</span>
        </div>
        <div className={`text-[11px] mt-0.5 truncate ${T.muted}`}>
          #{p.bib} · {flagOf(p.nacionalidad)} {p.nacionalidad}
          {p.status !== 'dns' && ` · ${(p.total_km || 0).toFixed(1)} km`}
        </div>
      </div>
      {statusBadge(p)}
      <div className="flex flex-col gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
        <button
          aria-label="Seguir atleta"
          onClick={() => toggleFollow(p.bib)}
          className={`w-8 h-8 rounded-full flex items-center justify-center ${T.chip}`}
        >
          <Star
            className={`w-4 h-4 ${followed.includes(p.bib) ? 'text-[#E77622] fill-[#E77622]' : ''}`}
          />
        </button>
        <button
          aria-label="Enviar ánimo"
          onClick={() => openCheerFor(p.bib)}
          className={`w-8 h-8 rounded-full flex items-center justify-center ${T.chip}`}
        >
          <MessageCircle className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  const emptyState = (Icon, title, hint) => (
    <div className={`text-center py-14 px-6 ${T.muted}`}>
      <Icon className="w-10 h-10 mx-auto mb-3 opacity-60" />
      <p className="font-semibold">{title}</p>
      {hint && <p className="text-xs mt-1.5">{hint}</p>}
    </div>
  );

  return (
    <div className={`min-h-[100dvh] flex flex-col ${T.page}`} style={{ WebkitTapHighlightColor: 'transparent' }}>
      <div className="w-full max-w-md mx-auto flex flex-col flex-1 min-h-[100dvh]">

        {/* ===== Encabezado fijo ===== */}
        <header className={`sticky top-0 z-30 px-3.5 pt-3 pb-2.5 ${T.header}`}>
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="font-extrabold tracking-wide text-base">
              BYSD <span className="text-[#E77622]">LIVE</span>
            </div>
            <div className={`font-mono text-xs px-2.5 py-1 rounded-lg ${T.clock}`}>
              {stats?.current_lap ? `V${stats.current_lap}` : '—'}{elapsed ? ` · ${elapsed}` : ''}
            </div>
            <button
              aria-label="Cambiar tema"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${T.themeBtn}`}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
          <nav className="flex gap-2">
            {TABS.map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex-1 rounded-xl py-2 text-[10.5px] font-medium ${tab === key ? T.tabOn : T.tab}`}
              >
                <Icon className="w-[18px] h-[18px] mx-auto mb-0.5" strokeWidth={2} />
                {label}
              </button>
            ))}
          </nav>
        </header>

        {/* ===== Contenido ===== */}
        <main className="flex-1 px-3.5 py-3 pb-4">
          {loading ? (
            <div className={`flex items-center justify-center py-20 ${T.muted}`}>
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <>
              {tab === 'atletas' && (
                <>
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
                  {filtered.length === 0
                    ? emptyState(Users, 'No hay atletas en esta categoría', null)
                    : filtered.map((p) => runnerRow(p, { off: p.status === 'retired' || p.status === 'dns' }))}
                </>
              )}

              {tab === 'favoritos' && (
                favorites.length === 0
                  ? emptyState(Star, 'Aún no sigues a nadie', 'Toca la estrella de un atleta para agregarlo a tus favoritos.')
                  : favorites.map((p) => runnerRow(p, { off: p.status === 'retired' || p.status === 'dns' }))
              )}

              {tab === 'animo' && (
                <>
                  <div className={`rounded-2xl p-3.5 mb-4 ${T.card}`}>
                    <p className="text-sm font-bold mb-2.5">Envía un mensaje de apoyo</p>
                    <select
                      value={cheerBib}
                      onChange={(e) => setCheerBib(e.target.value)}
                      className={`w-full rounded-xl px-3 py-2.5 text-sm mb-2 appearance-none ${T.input}`}
                    >
                      <option value="">Elige un atleta…</option>
                      {activeAndRecent.map((p) => (
                        <option key={p.bib} value={p.bib}>
                          #{p.bib} · {p.nombre} {p.apellidos}
                        </option>
                      ))}
                    </select>
                    <input
                      value={cheerName}
                      onChange={(e) => setCheerName(e.target.value)}
                      maxLength={50}
                      placeholder="Tu nombre"
                      className={`w-full rounded-xl px-3 py-2.5 text-sm mb-2 ${T.input}`}
                    />
                    <textarea
                      value={cheerMsg}
                      onChange={(e) => setCheerMsg(e.target.value)}
                      maxLength={280}
                      rows={3}
                      placeholder="Tu mensaje de ánimo…"
                      className={`w-full rounded-xl px-3 py-2.5 text-sm mb-1 resize-none ${T.input}`}
                    />
                    <div className={`text-[10px] text-right mb-2 ${T.subtle}`}>{cheerMsg.length}/280</div>
                    {cheerResult && (
                      <p className={`text-xs mb-2 ${cheerResult.ok ? 'text-green-500' : 'text-red-500'}`}>
                        {cheerResult.text}
                      </p>
                    )}
                    <button
                      onClick={sendCheer}
                      disabled={cheerSending}
                      className="w-full rounded-xl py-2.5 text-sm font-bold bg-[#E77622] text-white flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      {cheerSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      Enviar ánimo
                    </button>
                  </div>

                  <p className={`text-xs font-bold tracking-wider mb-2 ${T.subtle}`}>MENSAJES RECIENTES</p>
                  {cheers.length === 0
                    ? emptyState(MessageCircle, 'Todavía no hay mensajes', 'Sé la primera persona en enviar ánimo.')
                    : cheers.map((c, i) => (
                      <div key={i} className={`rounded-2xl px-3.5 py-3 mb-2.5 ${T.card}`}>
                        <p className="text-sm leading-snug">{c.message}</p>
                        <p className={`text-[11px] mt-1.5 ${T.muted}`}>
                          — {c.fan_name} para {c.athlete_name || `#${c.athlete_bib}`}
                        </p>
                      </div>
                    ))}
                </>
              )}

              {tab === 'ganadores' && (
                <>
                  {stats?.winner && (
                    <div className={`rounded-2xl p-5 mb-3 text-center ${T.card}`}>
                      <Trophy className="w-9 h-9 mx-auto mb-2 text-[#E77622]" />
                      <p className={`text-[10px] tracking-[0.2em] mb-1 ${T.subtle}`}>ÚLTIMO EN PIE</p>
                      <p className="text-lg font-extrabold">
                        {stats.winner.nombre} {stats.winner.apellidos}
                      </p>
                      <p className={`text-xs mt-0.5 ${T.muted}`}>
                        #{stats.winner.bib} · {flagOf(stats.winner.nacionalidad)} {stats.winner.nacionalidad}
                      </p>
                      <div className="flex justify-center gap-6 mt-3">
                        <div>
                          <div className="text-2xl font-bold text-[#E77622] font-mono">{stats.winner.laps_completed}</div>
                          <div className={`text-[9px] tracking-widest ${T.subtle}`}>VUELTAS</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-[#E77622] font-mono">{Number(stats.winner.total_km || 0).toFixed(1)}</div>
                          <div className={`text-[9px] tracking-widest ${T.subtle}`}>KM</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {winners.filter((w) => w.status === 'honor').length > 0 && (
                    <>
                      <p className={`text-xs font-bold tracking-wider mb-2 ${T.subtle}`}>MENCIONES DE HONOR</p>
                      {winners.filter((w) => w.status === 'honor').map((p) => (
                        <div key={p.bib} className={`flex items-center gap-3 rounded-2xl px-3 py-3 mb-2.5 ${T.card}`}>
                          <Medal className="w-5 h-5 text-[#E77622] shrink-0" />
                          <div className="min-w-0">
                            <div className="text-sm font-bold truncate">{p.nombre} {p.apellidos}</div>
                            <div className={`text-[11px] ${T.muted}`}>
                              #{p.bib} · {p.laps_completed} vueltas · {(p.total_km || 0).toFixed(1)} km
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {!stats?.winner && winners.length === 0 && (
                    <>
                      {emptyState(Trophy, 'Aún no hay ganador', 'La carrera sigue: solo puede quedar uno en pie.')}
                      {lastStanding.length > 0 && (
                        <>
                          <p className={`text-xs font-bold tracking-wider mb-2 ${T.subtle}`}>ÚLTIMOS EN PIE</p>
                          {lastStanding.map((p) => runnerRow(p))}
                        </>
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}
        </main>

        {/* ===== Pie publicitario fijo ===== */}
        <footer className={`sticky bottom-0 z-30 ${T.footer}`}>
          {currentAd ? (
            <button
              onClick={() => handleAdClick(currentAd)}
              className="w-full h-[76px] flex items-center gap-3 px-3.5 relative text-left"
            >
              <span className={`absolute top-1 right-3 text-[8px] tracking-widest uppercase ${T.subtle}`}>
                Patrocinador
              </span>
              {currentAd.logo_url ? (
                <img
                  src={`${API}${currentAd.logo_url}`}
                  alt={currentAd.name}
                  className="w-[52px] h-[52px] rounded-xl object-contain bg-white shrink-0"
                />
              ) : (
                <div className="w-[52px] h-[52px] rounded-xl bg-[#F2E8C7] text-[#333333] flex items-center justify-center text-[10px] font-extrabold shrink-0">
                  {currentAd.name?.slice(0, 6)}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-[13px] font-bold truncate">{currentAd.name}</p>
                {currentAd.text && <p className={`text-[11px] truncate ${T.muted}`}>{currentAd.text}</p>}
              </div>
              {banners.length > 1 && (
                <div className="ml-auto flex gap-1.5 shrink-0">
                  {banners.map((b) => (
                    <span
                      key={b.id}
                      className={`w-1.5 h-1.5 rounded-full ${b.id === currentAd.id ? 'bg-[#E77622]' : 'bg-gray-500/40'}`}
                    />
                  ))}
                </div>
              )}
            </button>
          ) : (
            <div className={`h-[56px] flex items-center justify-center text-[11px] ${T.subtle}`}>
              {config?.name || 'Backyard Ultra Santo Domingo'}
            </div>
          )}
        </footer>
      </div>

      {/* ===== Ficha de atleta ===== */}
      {profileBib && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center"
          onClick={() => setProfileBib(null)}
        >
          <div
            className={`w-full max-w-md max-h-[88dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 ${T.modal}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <p className={`text-[10px] tracking-[0.2em] ${T.subtle}`}>FICHA DEL ATLETA</p>
              <button aria-label="Cerrar" onClick={() => setProfileBib(null)} className={`w-8 h-8 rounded-full flex items-center justify-center ${T.chip}`}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {profileLoading && (
              <div className={`flex justify-center py-10 ${T.muted}`}>
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            )}

            {!profileLoading && !profile && (
              <p className={`text-sm text-center py-8 ${T.muted}`}>No se pudo cargar la ficha.</p>
            )}

            {!profileLoading && profile && (
              <>
                <div className="flex items-center gap-4 mb-4">
                  {profile.photo_url ? (
                    <img
                      src={`${API}${profile.photo_url}`}
                      alt={profile.nombre}
                      className="w-16 h-16 rounded-full object-cover border-2 border-[#E77622] shrink-0"
                    />
                  ) : (
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-lg font-bold shrink-0 ${T.avatar}`}>
                      {initialsOf(profile.nombre, profile.apellidos)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-lg font-extrabold leading-tight">
                      {profile.nombre} {profile.apellidos}
                    </p>
                    <p className={`text-xs mt-0.5 ${T.muted}`}>
                      #{profile.bib} · {flagOf(profile.nacionalidad)} {profile.nacionalidad}
                    </p>
                    {profile.ciudad_residencia && (
                      <p className={`text-xs mt-0.5 flex items-center gap-1 ${T.muted}`}>
                        <MapPin className="w-3 h-3" /> {profile.ciudad_residencia}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                  <div className={`rounded-xl py-2.5 ${T.card}`}>
                    <div className="text-lg font-bold text-[#E77622] font-mono">{profile.laps_completed}</div>
                    <div className={`text-[9px] tracking-widest ${T.subtle}`}>VUELTAS</div>
                  </div>
                  <div className={`rounded-xl py-2.5 ${T.card}`}>
                    <div className="text-lg font-bold text-[#E77622] font-mono">{Number(profile.total_km || 0).toFixed(1)}</div>
                    <div className={`text-[9px] tracking-widest ${T.subtle}`}>KM</div>
                  </div>
                  <div className={`rounded-xl py-2.5 ${T.card}`}>
                    <div className="text-lg font-bold text-[#E77622] font-mono">
                      {profile.anos_experiencia != null ? profile.anos_experiencia : '—'}
                    </div>
                    <div className={`text-[9px] tracking-widest ${T.subtle}`}>AÑOS EXP.</div>
                  </div>
                </div>

                {(profile.itra_snapshot || profile.itra_url) && (
                  <div className={`rounded-2xl p-4 mb-4 ${T.itraBox}`}>
                    <p className="text-xs font-extrabold tracking-wider text-[#E77622] mb-2.5">EXPERIENCIA ITRA</p>

                    {profile.itra_snapshot && (
                      <>
                        <div className="flex items-baseline gap-3 mb-3">
                          {profile.itra_snapshot.performance_index != null && (
                            <span className="text-3xl font-extrabold font-mono text-[#E77622]">
                              {profile.itra_snapshot.performance_index}
                            </span>
                          )}
                          <div className="text-xs">
                            {profile.itra_snapshot.level && <p className="font-bold">{profile.itra_snapshot.level}</p>}
                            {profile.itra_snapshot.age_category && (
                              <p className={T.muted}>{profile.itra_snapshot.age_category}</p>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center mb-3">
                          <div>
                            <div className="text-sm font-bold font-mono">{profile.itra_snapshot.finished_races ?? '—'}</div>
                            <div className={`text-[9px] ${T.subtle}`}>CARRERAS</div>
                          </div>
                          <div>
                            <div className="text-sm font-bold font-mono">
                              {profile.itra_snapshot.total_distance_km != null
                                ? `${Math.round(profile.itra_snapshot.total_distance_km).toLocaleString()}`
                                : '—'}
                            </div>
                            <div className={`text-[9px] ${T.subtle}`}>KM TOTALES</div>
                          </div>
                          <div>
                            <div className="text-sm font-bold font-mono">
                              {profile.itra_snapshot.total_elevation_m != null
                                ? `+${Math.round(profile.itra_snapshot.total_elevation_m).toLocaleString()}`
                                : '—'}
                            </div>
                            <div className={`text-[9px] ${T.subtle}`}>DESNIVEL M</div>
                          </div>
                        </div>

                        {(profile.itra_snapshot.results || []).length > 0 && (
                          <div className={`border-t pt-2.5 ${T.divider}`}>
                            <p className={`text-[10px] tracking-widest mb-1.5 ${T.subtle}`}>ÚLTIMOS RESULTADOS</p>
                            {(profile.itra_snapshot.results || []).slice(0, 6).map((r, i) => (
                              <div key={i} className="flex items-baseline justify-between gap-2 text-xs py-1">
                                <div className="min-w-0">
                                  <p className="font-semibold truncate">{r.race}</p>
                                  <p className={`text-[10px] ${T.muted}`}>
                                    {[r.date, r.category, r.distance_km ? `${r.distance_km} km` : null]
                                      .filter(Boolean).join(' · ')}
                                  </p>
                                </div>
                                <div className="text-right shrink-0 font-mono">
                                  {r.time && <p>{r.time}</p>}
                                  {r.position && <p className={`text-[10px] ${T.muted}`}>P. {r.position}</p>}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    {profile.itra_url && (
                      <a
                        href={profile.itra_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-[#E77622]"
                      >
                        Ver perfil completo en ITRA <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => toggleFollow(profile.bib)}
                    className={`flex-1 rounded-xl py-2.5 text-sm font-bold flex items-center justify-center gap-2 ${followed.includes(profile.bib) ? T.chipOn : T.chip}`}
                  >
                    <Star className={`w-4 h-4 ${followed.includes(profile.bib) ? 'fill-[#E77622]' : ''}`} />
                    {followed.includes(profile.bib) ? 'Siguiendo' : 'Seguir'}
                  </button>
                  <button
                    onClick={() => { setProfileBib(null); openCheerFor(profile.bib); }}
                    className="flex-1 rounded-xl py-2.5 text-sm font-bold bg-[#E77622] text-white flex items-center justify-center gap-2"
                  >
                    <MessageCircle className="w-4 h-4" /> Enviar ánimo
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
