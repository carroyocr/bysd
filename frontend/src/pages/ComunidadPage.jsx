import React, { useState, useEffect, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useRaceConfig } from '../contexts/RaceConfigContext';
import {
  IconChip,
  IconAnimo,
  IconAnterior,
  IconActualizar,
  IconAvanzar,
  IconAviso,
  IconCargando,
  IconCerrar,
  IconEnviar,
  IconFans,
  IconGanador,
  IconInicio,
  IconNivelAnimador,
  IconNivelLeyenda,
  IconNivelNovato,
  IconNivelSuperFan,
  IconPresentacion,
  IconSiguiente,
  IconVolver,
} from '../components/icons';

// El backend manda el nivel del fan con un emoji dentro. Aqui se traduce a
// icono y color: el emoji lo dibuja cada sistema operativo a su manera, no
// hereda el color del texto y no hay forma de alinearlo. El color sube de tono
// con el nivel, del gris apagado al naranja lleno.
const NIVELES_FAN = {
  rookie: { Icono: IconNivelNovato, clase: 'bg-muted text-muted-foreground' },
  cheerleader: { Icono: IconNivelAnimador, clase: 'bg-secondary text-secondary-foreground' },
  super_fan: { Icono: IconNivelSuperFan, clase: 'bg-primary/15 text-primary' },
  legend: { Icono: IconNivelLeyenda, clase: 'bg-primary text-primary-foreground' },
};

// El siguiente nivel viene sin `level`, solo con el nombre.
const NIVEL_POR_NOMBRE = {
  'Novato': 'rookie',
  'Animador': 'cheerleader',
  'Súper Fan': 'super_fan',
  'Leyenda': 'legend',
};

const nivelFan = (badge) =>
  NIVELES_FAN[badge?.level] || NIVELES_FAN[NIVEL_POR_NOMBRE[badge?.name]] || NIVELES_FAN.rookie;

// Los tres primeros del ranking se distinguen por color, no por medalla: oro,
// plata y bronce en emoji se ven distintos en cada telefono.
const claseRango = (indice) => {
  if (indice === 0) return 'bg-primary text-primary-foreground';
  if (indice === 1) return 'bg-primary/20 text-primary';
  if (indice === 2) return 'bg-secondary text-secondary-foreground';
  return 'bg-muted text-muted-foreground';
};

// Las tres cifras de arriba son ademas el selector de pestana. El fondo de la
// activa tiene que ser opaco: las tarjetas montan sobre la cabecera negra, y
// con un naranja translucido se le veia el negro por la mitad de arriba.
function PestanaCifra({ activa, onClick, Icono, valor, etiqueta, testId }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={`rounded-xl border p-3 sm:p-4 text-center transition-colors ${
        activa
          ? 'border-primary bg-secondary shadow-soft'
          : 'border-border/60 bg-card hover:border-primary/40'
      }`}
    >
      <Icono className={`w-5 h-5 mx-auto mb-1.5 ${activa ? 'text-primary' : 'text-muted-foreground'}`} />
      <p className="font-display text-2xl leading-none text-foreground">{valor}</p>
      <p className="text-[11px] text-muted-foreground mt-1">{etiqueta}</p>
    </button>
  );
}

// Aviso vacio o cargando dentro de una lista.
function ListaVacia({ Icono, texto, detalle, cargando = false }) {
  return (
    <div className="text-center py-14 px-4">
      <Icono className={`w-10 h-10 mx-auto mb-4 text-muted-foreground/50 ${cargando ? 'animate-spin' : ''}`} />
      <p className="text-muted-foreground">{texto}</p>
      {detalle && <p className="text-sm text-muted-foreground/70 mt-1">{detalle}</p>}
    </div>
  );
}

export default function ComunidadPage() {
  const { raceCode } = useParams();
  const { raceName, config } = useRaceConfig();

  // Page visibility check
  const [visibility, setVisibility] = useState({ loading: true, enabled: true, raceName: '', activeRaceCode: '' });

  useEffect(() => {
    const checkVisibility = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race-config/page-visibility`);
        if (response.ok) {
          const data = await response.json();
          // Only apply visibility restriction to the ACTIVE race
          // Past races should always be accessible
          const isActiveRace = !raceCode || data.race_code === raceCode?.toUpperCase();
          setVisibility({
            loading: false,
            enabled: isActiveRace ? data.show_community_page : true, // Always allow past races
            raceName: data.race_name,
            activeRaceCode: data.race_code
          });
        } else {
          setVisibility({ loading: false, enabled: true, raceName: '', activeRaceCode: '' });
        }
      } catch (error) {
        console.error('Error checking page visibility:', error);
        setVisibility({ loading: false, enabled: true, raceName: '', activeRaceCode: '' });
      }
    };
    checkVisibility();
  }, [raceCode]);

  // Determine which race to show - from URL param or active race
  const displayRaceCode = raceCode ? raceCode.toUpperCase() : config?.code;
  const [raceInfo, setRaceInfo] = useState(null);

  // Active tab: 'messages', 'athletes', 'fans'
  const [activeTab, setActiveTab] = useState('messages');

  // Stats
  const [stats, setStats] = useState({ totalMessages: 0, totalFans: 0, totalAthletes: 0 });

  // Messages with pagination
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total_count: 0,
    total_pages: 1,
    has_next: false,
    has_prev: false
  });

  // Auto-refresh control
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Leaderboards
  const [athleteLeaderboard, setAthleteLeaderboard] = useState([]);
  const [fanLeaderboard, setFanLeaderboard] = useState([]);
  const [loadingAthletes, setLoadingAthletes] = useState(false);
  const [loadingFans, setLoadingFans] = useState(false);

  // Send message modal
  const [showSendModal, setShowSendModal] = useState(false);
  const [athletes, setAthletes] = useState([]);
  const [selectedAthlete, setSelectedAthlete] = useState(null);
  const [fanName, setFanName] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [fanBadge, setFanBadge] = useState(null);
  const [searchAthlete, setSearchAthlete] = useState('');

  // Filter for messages
  const [messageFilter, setMessageFilter] = useState('');

  // Fetch race info if viewing a specific race
  useEffect(() => {
    const fetchRaceInfo = async () => {
      if (displayRaceCode) {
        try {
          const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race-config/${displayRaceCode}`);
          if (response.ok) {
            const data = await response.json();
            setRaceInfo(data);
          }
        } catch (error) {
          console.error('Error fetching race info:', error);
        }
      }
    };
    fetchRaceInfo();
  }, [displayRaceCode]);

  // Get display name for the race
  const getDisplayRaceName = () => {
    if (raceInfo) return raceInfo.name;
    return raceName;
  };

  const loadMessages = useCallback(async (page = 1) => {
    setLoadingMessages(true);
    try {
      const raceCodeParam = displayRaceCode ? `&race_code=${displayRaceCode}` : '';
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/cheers?limit=50&page=${page}${raceCodeParam}`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
        setPagination(data.pagination || {
          page: 1,
          limit: 50,
          total_count: 0,
          total_pages: 1,
          has_next: false,
          has_prev: false
        });

        // Update stats with real total count
        const uniqueFans = new Set((data.messages || []).map(m => m.fan_name));
        const uniqueAthletes = new Set((data.messages || []).map(m => m.athlete_bib));
        setStats({
          totalMessages: data.pagination?.total_count || 0,
          totalFans: uniqueFans.size,
          totalAthletes: uniqueAthletes.size
        });
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoadingMessages(false);
    }
  }, [displayRaceCode]);

  // Load messages on mount and when page changes
  useEffect(() => {
    loadMessages(currentPage);
    loadAthletes();
  }, [currentPage, loadMessages, displayRaceCode]);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadMessages(currentPage);
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh, currentPage, loadMessages]);

  // Load leaderboard when tab changes
  useEffect(() => {
    if (activeTab === 'athletes' && athleteLeaderboard.length === 0) {
      loadAthleteLeaderboard();
    } else if (activeTab === 'fans' && fanLeaderboard.length === 0) {
      loadFanLeaderboard();
    }
  }, [activeTab]);

  // Pagination handlers
  const goToPage = (page) => {
    if (page >= 1 && page <= pagination.total_pages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleManualRefresh = () => {
    loadMessages(currentPage);
  };

  const loadAthleteLeaderboard = async () => {
    setLoadingAthletes(true);
    try {
      const raceCodeParam = displayRaceCode ? `?race_code=${displayRaceCode}` : '';
      // Get subscribers count and participants
      const [subsResponse, participantsResponse] = await Promise.all([
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/subscribers-count-public${raceCodeParam}`),
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/participants${raceCodeParam}`)
      ]);

      if (subsResponse.ok && participantsResponse.ok) {
        const subsData = await subsResponse.json();
        const participants = await participantsResponse.json();

        // Build leaderboard based on subscribers
        const leaderboard = participants
          .map(p => ({
            athlete_bib: p.bib,
            athlete_name: `${p.nombre} ${p.apellidos}`,
            nacionalidad: p.nacionalidad,
            subscriber_count: subsData[p.bib] || 0
          }))
          .filter(a => a.subscriber_count > 0)
          .sort((a, b) => b.subscriber_count - a.subscriber_count)
          .slice(0, 20);

        setAthleteLeaderboard(leaderboard);
      }
    } catch (error) {
      console.error('Error loading athlete leaderboard:', error);
    } finally {
      setLoadingAthletes(false);
    }
  };

  const loadFanLeaderboard = async () => {
    setLoadingFans(true);
    try {
      const raceCodeParam = displayRaceCode ? `&race_code=${displayRaceCode}` : '';
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/fans/leaderboard?limit=20${raceCodeParam}`);
      if (response.ok) {
        const data = await response.json();
        setFanLeaderboard(data);
      }
    } catch (error) {
      console.error('Error loading fan leaderboard:', error);
    } finally {
      setLoadingFans(false);
    }
  };

  const loadAthletes = async () => {
    try {
      const raceCodeParam = displayRaceCode ? `?race_code=${displayRaceCode}` : '';
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/participants${raceCodeParam}`);
      if (response.ok) {
        const data = await response.json();
        setAthletes(data);
      }
    } catch (error) {
      console.error('Error loading athletes:', error);
    }
  };

  const loadFanBadge = async (name) => {
    if (!name.trim()) {
      setFanBadge(null);
      return;
    }
    try {
      const raceCodeParam = displayRaceCode ? `?race_code=${displayRaceCode}` : '';
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/fans/badge/${encodeURIComponent(name)}${raceCodeParam}`);
      if (response.ok) {
        const data = await response.json();
        if (data.cheer_count > 0) {
          setFanBadge(data);
        } else {
          setFanBadge(null);
        }
      }
    } catch (error) {
      console.error('Error loading fan badge:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedAthlete || !fanName.trim() || !message.trim()) {
      setSendResult({ type: 'error', text: 'Completa todos los campos' });
      return;
    }

    setSending(true);
    setSendResult(null);

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/cheer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          athlete_bib: selectedAthlete.bib,
          fan_name: fanName,
          message: message
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSendResult({ type: 'success', text: data.message });
        setMessage('');
        setSelectedAthlete(null);
        setSearchAthlete('');
        loadMessages();
        // Reset leaderboards to reload on next view
        setAthleteLeaderboard([]);
        setFanLeaderboard([]);
        setTimeout(() => {
          setShowSendModal(false);
          setSendResult(null);
        }, 2000);
      } else {
        setSendResult({ type: 'error', text: data.detail || 'Error al enviar' });
      }
    } catch (error) {
      setSendResult({ type: 'error', text: 'Error de conexión' });
    } finally {
      setSending(false);
    }
  };

  const filteredAthletes = athletes.filter(a =>
    searchAthlete === '' ||
    `${a.nombre} ${a.apellidos}`.toLowerCase().includes(searchAthlete.toLowerCase()) ||
    a.bib.includes(searchAthlete)
  );

  const mensajesVisibles = messages.filter(msg =>
    messageFilter === '' ||
    msg.athlete_bib.includes(messageFilter) ||
    msg.athlete_name?.toLowerCase().includes(messageFilter.toLowerCase())
  );

  // Show loading state while checking visibility
  if (visibility.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background pt-16">
        <div className="text-center space-y-4">
          <IconCargando className="w-10 h-10 text-primary animate-spin mx-auto" />
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  // Show disabled page message if community is not enabled
  if (!visibility.enabled) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-muted/25 to-background pt-16 flex items-center justify-center px-4">
        <Card className="max-w-md w-full border-border/60 shadow-medium">
          <CardContent className="p-8 text-center">
            <IconChip size="lg" className="mx-auto mb-6">
              <IconAviso className="w-7 h-7" />
            </IconChip>
            <h1 className="font-display text-3xl text-foreground mb-3">
              Comunidad no disponible
            </h1>
            <p className="text-muted-foreground mb-4">
              La página de comunidad para <strong className="text-foreground">{visibility.raceName || 'esta carrera'}</strong> no está activa en este momento.
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Aquí podrás enviar mensajes de ánimo a los atletas y ver el ranking de fans.
            </p>
            <Link to="/">
              <Button className="w-full" data-testid="go-home-btn">
                <IconInicio className="w-4 h-4" />
                Volver al inicio
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/25 to-background pt-16">
      {/* Cabecera */}
      <header className="relative overflow-hidden bg-[#0C0C0C] text-white pb-14">
        <div
          className="absolute inset-0"
          aria-hidden="true"
          style={{ background: 'radial-gradient(75% 120% at 50% -15%, hsl(22 88% 52% / 0.45), transparent 65%)' }}
        />
        <div className="relative container mx-auto px-4 py-12 sm:py-14">
          <div className="max-w-6xl mx-auto flex flex-col items-center text-center gap-4">
            {displayRaceCode && (
              <span className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-white/70">
                {displayRaceCode}
              </span>
            )}
            <h1 className="font-display text-5xl sm:text-6xl leading-none">Comunidad</h1>
            <p className="text-lg sm:text-xl text-white/70 max-w-2xl">
              {getDisplayRaceName()}
            </p>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              <Link
                to={displayRaceCode ? `/resultados/${displayRaceCode.toLowerCase()}` : '/en-vivo'}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-1.5 text-sm text-white/90 hover:bg-white/10 hover:text-white transition-colors"
              >
                <IconVolver className="w-4 h-4" />
                Volver a Resultados
              </Link>
              <Link
                to="/mensajes/presentacion"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-1.5 text-sm text-white/90 hover:bg-white/10 hover:text-white transition-colors"
              >
                <IconPresentacion className="w-4 h-4" />
                Modo presentación
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Cifras / selector de pestana */}
      <div className="container mx-auto px-4 relative z-10 -mt-10">
        <div className="grid grid-cols-3 gap-3 max-w-xl mx-auto">
          <PestanaCifra
            activa={activeTab === 'messages'}
            onClick={() => setActiveTab('messages')}
            Icono={IconAnimo}
            valor={stats.totalMessages}
            etiqueta="Mensajes"
            testId="tab-messages"
          />
          <PestanaCifra
            activa={activeTab === 'athletes'}
            onClick={() => setActiveTab('athletes')}
            Icono={IconGanador}
            valor={stats.totalAthletes}
            etiqueta="Top atletas"
            testId="tab-athletes"
          />
          <PestanaCifra
            activa={activeTab === 'fans'}
            onClick={() => setActiveTab('fans')}
            Icono={IconFans}
            valor={stats.totalFans}
            etiqueta="Top fans"
            testId="tab-fans"
          />
        </div>
      </div>

      {/* Contenido */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">

          {/* Mensajes */}
          {activeTab === 'messages' && (
            <div className="space-y-4">
              {/* Filtro y actualizacion */}
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  type="text"
                  placeholder="Filtrar por número o nombre de corredor..."
                  value={messageFilter}
                  onChange={(e) => setMessageFilter(e.target.value)}
                  className="flex-1"
                />
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 h-9 px-3 rounded-md border border-border/60 bg-card cursor-pointer hover:bg-muted/40 transition-colors">
                    <input
                      type="checkbox"
                      checked={autoRefresh}
                      onChange={(e) => setAutoRefresh(e.target.checked)}
                      className="w-4 h-4 rounded border-input accent-primary"
                    />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">Auto</span>
                  </label>
                  <Button
                    onClick={handleManualRefresh}
                    disabled={loadingMessages}
                    variant="outline"
                    size="sm"
                    className="h-9 border-border hover:bg-primary/10 hover:text-primary"
                  >
                    <IconActualizar className={`w-4 h-4 ${loadingMessages ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">Actualizar</span>
                  </Button>
                </div>
              </div>

              {/* Lista de mensajes */}
              <Card className="border-border/60 shadow-soft overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border/60 bg-muted/30">
                  <h2 className="font-display text-xl text-foreground leading-none flex items-center gap-2">
                    <IconAnimo className="w-5 h-5 text-primary" />
                    Mensajes de ánimo
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {pagination.total_count.toLocaleString()} en total
                  </span>
                </div>
                <CardContent className="p-0 max-h-[520px] overflow-y-auto">
                  {loadingMessages ? (
                    <ListaVacia Icono={IconCargando} texto="Cargando mensajes..." cargando />
                  ) : mensajesVisibles.length === 0 ? (
                    <ListaVacia
                      Icono={IconAnimo}
                      texto={messageFilter ? 'No hay mensajes para este corredor' : 'Aún no hay mensajes'}
                      detalle={messageFilter ? 'Intenta con otro nombre o número' : '¡Sé el primero en animar a un atleta!'}
                    />
                  ) : (
                    <div className="divide-y divide-border/60">
                      {mensajesVisibles.map((msg, index) => (
                        <div key={index} className="p-4 hover:bg-muted/30 transition-colors">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center font-semibold shrink-0">
                              {msg.fan_name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="font-semibold text-foreground">{msg.fan_name}</span>
                                <IconAvanzar className="w-3.5 h-3.5 text-muted-foreground/60" />
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                                  <span className="font-mono text-foreground">#{msg.athlete_bib}</span>
                                  {msg.athlete_name}
                                </span>
                                {msg.athlete_nacionalidad && (
                                  <span className="text-xs text-muted-foreground/80">
                                    {msg.athlete_nacionalidad}
                                  </span>
                                )}
                              </div>
                              <p className="text-foreground">{msg.message}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(msg.created_at).toLocaleString('es-DO')}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Paginacion */}
              {pagination.total_pages > 1 && (
                <div className="flex items-center justify-center gap-2 py-2">
                  <Button
                    onClick={() => goToPage(1)}
                    disabled={!pagination.has_prev || loadingMessages}
                    variant="outline"
                    size="sm"
                    className="hidden sm:flex border-border hover:bg-primary/10 hover:text-primary"
                  >
                    Primera
                  </Button>
                  <Button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={!pagination.has_prev || loadingMessages}
                    variant="outline"
                    size="sm"
                    className="border-border hover:bg-primary/10 hover:text-primary"
                  >
                    <IconAnterior className="w-4 h-4" />
                    <span className="hidden sm:inline">Anterior</span>
                  </Button>

                  <div className="flex items-center gap-2 px-2">
                    <span className="text-sm text-muted-foreground">Página</span>
                    <select
                      value={currentPage}
                      onChange={(e) => goToPage(parseInt(e.target.value))}
                      className="h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      disabled={loadingMessages}
                    >
                      {Array.from({ length: pagination.total_pages }, (_, i) => i + 1).map(page => (
                        <option key={page} value={page}>{page}</option>
                      ))}
                    </select>
                    <span className="text-sm text-muted-foreground">de {pagination.total_pages}</span>
                  </div>

                  <Button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={!pagination.has_next || loadingMessages}
                    variant="outline"
                    size="sm"
                    className="border-border hover:bg-primary/10 hover:text-primary"
                  >
                    <span className="hidden sm:inline">Siguiente</span>
                    <IconSiguiente className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={() => goToPage(pagination.total_pages)}
                    disabled={!pagination.has_next || loadingMessages}
                    variant="outline"
                    size="sm"
                    className="hidden sm:flex border-border hover:bg-primary/10 hover:text-primary"
                  >
                    Última
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Top atletas */}
          {activeTab === 'athletes' && (
            <Card className="border-border/60 shadow-soft overflow-hidden">
              <div className="px-5 py-4 border-b border-border/60 bg-muted/30">
                <h2 className="font-display text-xl text-foreground leading-none flex items-center gap-2">
                  <IconGanador className="w-5 h-5 text-primary" />
                  Atletas más seguidos
                </h2>
              </div>
              <CardContent className="p-0">
                {loadingAthletes ? (
                  <ListaVacia Icono={IconCargando} texto="Cargando ranking..." cargando />
                ) : athleteLeaderboard.length === 0 ? (
                  <ListaVacia Icono={IconGanador} texto="Aún no hay seguidores registrados" />
                ) : (
                  <div className="divide-y divide-border/60">
                    {athleteLeaderboard.map((athlete, index) => (
                      <div
                        key={athlete.athlete_bib}
                        className={`p-4 flex items-center gap-4 ${index === 0 ? 'bg-primary/5' : ''}`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-display text-lg leading-none ${claseRango(index)}`}>
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground truncate">{athlete.athlete_name}</p>
                          <p className="text-sm text-muted-foreground">
                            <span className="font-mono">#{athlete.athlete_bib}</span> · {athlete.nacionalidad}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="font-display text-2xl leading-none text-foreground">{athlete.subscriber_count}</p>
                          <p className="text-[11px] text-muted-foreground mt-1">seguidores</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Top fans */}
          {activeTab === 'fans' && (
            <Card className="border-border/60 shadow-soft overflow-hidden">
              <div className="px-5 py-4 border-b border-border/60 bg-muted/30 space-y-3">
                <h2 className="font-display text-xl text-foreground leading-none flex items-center gap-2">
                  <IconFans className="w-5 h-5 text-primary" />
                  Fans que más animan
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { Icono: IconNivelNovato, texto: 'Novato (1+)' },
                    { Icono: IconNivelAnimador, texto: 'Animador (3+)' },
                    { Icono: IconNivelSuperFan, texto: 'Súper Fan (5+)' },
                    { Icono: IconNivelLeyenda, texto: 'Leyenda (10+)' },
                  ].map(({ Icono, texto }) => (
                    <span
                      key={texto}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground"
                    >
                      <Icono className="w-3.5 h-3.5" />
                      {texto}
                    </span>
                  ))}
                </div>
              </div>
              <CardContent className="p-0">
                {loadingFans ? (
                  <ListaVacia Icono={IconCargando} texto="Cargando ranking..." cargando />
                ) : fanLeaderboard.length === 0 ? (
                  <ListaVacia Icono={IconFans} texto="Aún no hay datos" />
                ) : (
                  <div className="divide-y divide-border/60">
                    {fanLeaderboard.map((fan, index) => {
                      const nivel = nivelFan(fan.badge);
                      const IconoNivel = nivel.Icono;
                      return (
                        <div
                          key={fan.fan_name}
                          className={`p-4 flex items-center gap-3 sm:gap-4 ${index === 0 ? 'bg-primary/5' : ''}`}
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-display text-lg leading-none ${claseRango(index)}`}>
                            {index + 1}
                          </div>
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${nivel.clase}`}>
                            <IconoNivel className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-foreground truncate">{fan.fan_name}</p>
                            <p className="text-sm text-muted-foreground truncate">
                              {fan.badge.name} · {fan.athletes_cheered} atleta{fan.athletes_cheered !== 1 ? 's' : ''} apoyado{fan.athletes_cheered !== 1 ? 's' : ''}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="font-display text-2xl leading-none text-foreground">{fan.cheer_count}</p>
                            <p className="text-[11px] text-muted-foreground mt-1">mensajes</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Boton flotante */}
      <button
        type="button"
        onClick={() => setShowSendModal(true)}
        data-testid="send-cheer-fab"
        title="Enviar mensaje de ánimo"
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-strong hover:bg-primary/90 transition-colors flex items-center justify-center"
      >
        <IconEnviar className="w-6 h-6" />
      </button>

      {/* Enviar mensaje */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl shadow-strong max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start gap-4 mb-5">
                <div className="flex items-start gap-3">
                  <IconChip size="sm">
                    <IconAnimo className="w-4 h-4" />
                  </IconChip>
                  <div>
                    <h3 className="font-display text-xl text-foreground leading-none">Mensaje de ánimo</h3>
                    <p className="text-sm text-muted-foreground mt-2">
                      Escoge a quién animar y escríbele
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSendModal(false)}
                  className="p-1 text-muted-foreground hover:bg-muted"
                >
                  <IconCerrar className="w-5 h-5" />
                </Button>
              </div>

              {/* Atleta */}
              <div className="mb-4">
                <label className="text-sm font-medium mb-2 block">Selecciona un atleta</label>
                <Input
                  type="text"
                  placeholder="Buscar por nombre o número..."
                  value={searchAthlete}
                  onChange={(e) => setSearchAthlete(e.target.value)}
                  className="mb-2"
                />
                {selectedAthlete ? (
                  <div className="p-3 rounded-xl border border-primary/30 bg-primary/5 flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        <span className="font-mono">#{selectedAthlete.bib}</span> {selectedAthlete.nombre} {selectedAthlete.apellidos}
                      </p>
                      <p className="text-sm text-muted-foreground">{selectedAthlete.nacionalidad}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedAthlete(null)}
                      className="text-muted-foreground hover:bg-muted"
                    >
                      <IconCerrar className="w-4 h-4" />
                    </Button>
                  </div>
                ) : searchAthlete.length > 0 ? (
                  <div className="max-h-40 overflow-y-auto rounded-xl border border-border/60 divide-y divide-border/60">
                    {filteredAthletes.length === 0 ? (
                      <p className="p-3 text-sm text-muted-foreground text-center">No se encontraron corredores</p>
                    ) : (
                      filteredAthletes.slice(0, 10).map(athlete => (
                        <button
                          key={athlete.bib}
                          type="button"
                          onClick={() => {
                            setSelectedAthlete(athlete);
                            setSearchAthlete('');
                          }}
                          className="w-full p-2.5 text-left hover:bg-primary/5 text-sm transition-colors"
                        >
                          <span className="font-mono text-primary">#{athlete.bib}</span> {athlete.nombre} {athlete.apellidos}
                          <span className="text-muted-foreground ml-2">{athlete.nacionalidad}</span>
                        </button>
                      ))
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Escribe para buscar un corredor</p>
                )}
              </div>

              {/* Nombre del fan */}
              <div className="mb-4">
                <label className="text-sm font-medium mb-2 block">Tu nombre</label>
                <Input
                  type="text"
                  placeholder="Tu nombre"
                  value={fanName}
                  onChange={(e) => {
                    setFanName(e.target.value);
                    clearTimeout(window.badgeTimeout);
                    window.badgeTimeout = setTimeout(() => loadFanBadge(e.target.value), 500);
                  }}
                  maxLength={50}
                />
                {fanBadge && (() => {
                  const nivel = nivelFan(fanBadge.badge);
                  const IconoNivel = nivel.Icono;
                  return (
                    <div className="mt-2 p-3 rounded-xl border border-primary/25 bg-primary/5 flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${nivel.clase}`}>
                        <IconoNivel className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          ¡Hola {fanBadge.badge.name}! ({fanBadge.cheer_count} mensajes)
                        </p>
                        {fanBadge.next_badge && (
                          <p className="text-xs text-muted-foreground">
                            {fanBadge.next_badge.required - fanBadge.cheer_count} más para {fanBadge.next_badge.name}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Mensaje */}
              <div className="mb-4">
                <label className="text-sm font-medium mb-2 block">Tu mensaje</label>
                <textarea
                  placeholder="¡Escribe tu mensaje de ánimo!"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={280}
                  rows={4}
                  className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                />
                <p className="text-xs text-muted-foreground text-right mt-1">{message.length}/280</p>
              </div>

              {sendResult && (
                <div className={`rounded-xl p-3 mb-4 text-sm ${
                  sendResult.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/25'
                    : 'bg-destructive/10 text-destructive border border-destructive/25'
                }`}>
                  {sendResult.text}
                </div>
              )}

              <Button
                onClick={handleSendMessage}
                disabled={sending || !selectedAthlete || !fanName.trim() || !message.trim()}
                className="w-full"
              >
                <IconEnviar className="w-4 h-4" />
                {sending ? 'Enviando...' : 'Enviar mensaje'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
