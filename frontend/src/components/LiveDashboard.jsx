import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from './ui/card';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { useRaceConfig } from '../contexts/RaceConfigContext';
import { exportTextFile, openExternal } from '../lib/nativeExport';
import {
  IconChip,
  IconAnimo,
  IconAvanzar,
  IconBuscar,
  IconCargando,
  IconCerrar,
  IconCertificado,
  IconCompartir,
  IconCopiar,
  IconDNF,
  IconDNS,
  IconDescargar,
  IconEmail,
  IconEnCarrera,
  IconEnviar,
  IconGanador,
  IconHecho,
  IconImagen,
  IconInvitada,
  IconKmAtletas,
  IconKmEvento,
  IconNotificar,
  IconPDF,
  IconReloj,
  IconSeguidores,
  IconSeguir,
  IconTwitterX,
  IconVueltas,
  IconWhatsApp,
} from './icons';

// LocalStorage keys
const FOLLOWED_ATHLETES_KEY = 'backyard_ultra_followed_athletes';
const SUBSCRIPTION_EMAIL_KEY = 'backyard_ultra_subscription_email';
const SUBSCRIPTION_SETTINGS_KEY = 'backyard_ultra_subscription_settings';

// Como se ve cada estado del atleta: nombre, icono y color en un solo sitio.
// Antes cada estado se escribia a mano en cinco lugares (tarjeta, tabla, CSV,
// filtro) y no coincidian entre si.
const ESTADOS = {
  winner: {
    etiqueta: 'Ganador',
    Icono: IconGanador,
    clase: 'bg-primary/15 text-primary border-primary/30',
  },
  honor: {
    etiqueta: 'Invitada de Honor',
    corta: 'Invitada',
    Icono: IconInvitada,
    clase: 'bg-accent/10 text-accent border-accent/30',
  },
  active: {
    etiqueta: 'En carrera',
    Icono: IconEnCarrera,
    clase: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30',
  },
  dns: {
    etiqueta: 'DNS',
    Icono: IconDNS,
    clase: 'bg-muted text-muted-foreground border-border',
  },
  retired: {
    etiqueta: 'DNF',
    Icono: IconDNF,
    clase: 'bg-destructive/10 text-destructive border-destructive/30',
  },
};

const estadoDe = (status) => ESTADOS[status] || ESTADOS.retired;

function EstadoBadge({ status, compacto = false }) {
  const estado = estadoDe(status);
  const { Icono } = estado;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${estado.clase}`}
    >
      <Icono className="w-3.5 h-3.5" />
      {compacto ? estado.corta || estado.etiqueta : estado.etiqueta}
    </span>
  );
}

// Una cifra de la carrera. Todas iguales: recuadro del icono arriba, numero
// grande, etiqueta abajo. El color solo distingue lo que hay que distinguir.
function Metrica({ Icono, valor, etiqueta, tono = 'primary' }) {
  const tonos = {
    primary: 'bg-primary/10 text-primary',
    neutral: 'bg-muted text-muted-foreground',
    alerta: 'bg-destructive/10 text-destructive',
  };
  return (
    <Card className="border-border/60 shadow-soft">
      <CardContent className="p-3 sm:p-5 flex flex-col items-center sm:items-start gap-2 sm:gap-3 text-center sm:text-left">
        <IconChip size="sm" className={tonos[tono]}>
          <Icono className="w-4 h-4" />
        </IconChip>
        <div>
          <p className="font-display text-2xl sm:text-3xl leading-none text-foreground">{valor}</p>
          <p className="text-[11px] sm:text-xs text-muted-foreground mt-1 leading-tight">{etiqueta}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// Un dato del ganador dentro de su tarjeta.
function DatoGanador({ etiqueta, valor, destacado = false }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/80 px-4 py-3 text-center">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{etiqueta}</p>
      <p className={`font-display text-foreground leading-none mt-1.5 ${destacado ? 'text-3xl sm:text-4xl' : 'text-xl sm:text-2xl'}`}>
        {valor}
      </p>
    </div>
  );
}

export default function LiveDashboard({ raceCode }) {
  const { raceName, getYear, config } = useRaceConfig();

  // Determine which race to show - from URL param or active race
  const displayRaceCode = raceCode ? raceCode.toUpperCase() : config?.code;
  const [raceInfo, setRaceInfo] = useState(null);

  const [stats, setStats] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterFollowed, setFilterFollowed] = useState('all'); // 'all' or 'followed'
  const [followedAthletes, setFollowedAthletes] = useState(() => {
    // Initialize from localStorage
    const saved = localStorage.getItem(FOLLOWED_ATHLETES_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [copied, setCopied] = useState(false);

  // Subscription modal state
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [subscribeEmail, setSubscribeEmail] = useState(() => {
    return localStorage.getItem(SUBSCRIPTION_EMAIL_KEY) || '';
  });
  const [notifyEveryLap, setNotifyEveryLap] = useState(() => {
    const saved = localStorage.getItem(SUBSCRIPTION_SETTINGS_KEY);
    return saved ? JSON.parse(saved).notifyEveryLap : false;
  });
  const [notifyOnFinish, setNotifyOnFinish] = useState(() => {
    const saved = localStorage.getItem(SUBSCRIPTION_SETTINGS_KEY);
    return saved ? JSON.parse(saved).notifyOnFinish : true;
  });
  const [isSubscribed, setIsSubscribed] = useState(() => {
    return !!localStorage.getItem(SUBSCRIPTION_EMAIL_KEY);
  });
  const [subscribing, setSubscribing] = useState(false);
  const [subscribeMessage, setSubscribeMessage] = useState(null);

  // Followers count (like admin panel)
  const [followersCount, setFollowersCount] = useState({});

  // Certificates availability
  const [certificatesAvailable, setCertificatesAvailable] = useState({});

  // Cheer count for link
  const [cheerCount, setCheerCount] = useState(0);

  // Cheer message modal
  const [showCheerModal, setShowCheerModal] = useState(false);
  const [cheerAthlete, setCheerAthlete] = useState(null);
  const [cheerFanName, setCheerFanName] = useState('');
  const [cheerMessage, setCheerMessage] = useState('');
  const [cheerSending, setCheerSending] = useState(false);
  const [cheerResult, setCheerResult] = useState(null);

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

  // Save followed athletes to localStorage and update subscription if exists
  useEffect(() => {
    localStorage.setItem(FOLLOWED_ATHLETES_KEY, JSON.stringify(followedAthletes));

    // Auto-update subscription if user is already subscribed
    const savedEmail = localStorage.getItem(SUBSCRIPTION_EMAIL_KEY);
    if (savedEmail && followedAthletes.length > 0) {
      updateSubscriptionSilently(savedEmail, followedAthletes);
    }
  }, [followedAthletes]);

  // Silent subscription update (no UI feedback, no email)
  const updateSubscriptionSilently = async (email, athletes) => {
    const savedSettings = localStorage.getItem(SUBSCRIPTION_SETTINGS_KEY);
    const settings = savedSettings ? JSON.parse(savedSettings) : { notifyEveryLap: false, notifyOnFinish: true };

    try {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/subscribe-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          athletes_bibs: athletes,
          notify_every_lap: settings.notifyEveryLap,
          notify_on_finish: settings.notifyOnFinish
        })
      });
    } catch (error) {
      console.error('Error updating subscription:', error);
    }
  };

  // Toggle follow/unfollow athlete
  const toggleFollowAthlete = (bib) => {
    setFollowedAthletes(prev => {
      if (prev.includes(bib)) {
        return prev.filter(b => b !== bib);
      } else {
        return [...prev, bib];
      }
    });
  };

  // Check if athlete is followed
  const isFollowed = (bib) => followedAthletes.includes(bib);

  // Handle subscription
  const handleSubscribe = async () => {
    if (!subscribeEmail || followedAthletes.length === 0) {
      setSubscribeMessage({ type: 'error', text: 'Ingresa tu email y selecciona al menos un atleta para seguir' });
      return;
    }

    if (!notifyEveryLap && !notifyOnFinish) {
      setSubscribeMessage({ type: 'error', text: 'Selecciona al menos una opción de notificación' });
      return;
    }

    setSubscribing(true);
    setSubscribeMessage(null);

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: subscribeEmail,
          athletes_bibs: followedAthletes,
          notify_every_lap: notifyEveryLap,
          notify_on_finish: notifyOnFinish
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Save subscription info to localStorage for auto-updates
        localStorage.setItem(SUBSCRIPTION_EMAIL_KEY, subscribeEmail);
        localStorage.setItem(SUBSCRIPTION_SETTINGS_KEY, JSON.stringify({
          notifyEveryLap,
          notifyOnFinish
        }));
        setIsSubscribed(true);

        setSubscribeMessage({ type: 'success', text: `¡Listo! Recibirás notificaciones de ${data.athletes_count} atleta(s). Los nuevos atletas que sigas se agregarán automáticamente.` });
        setTimeout(() => {
          setShowSubscribeModal(false);
          setSubscribeMessage(null);
        }, 3000);
      } else {
        setSubscribeMessage({ type: 'error', text: data.detail || 'Error al suscribirse' });
      }
    } catch (error) {
      setSubscribeMessage({ type: 'error', text: 'Error de conexión. Intenta de nuevo.' });
    } finally {
      setSubscribing(false);
    }
  };

  // Handle unsubscribe
  const handleUnsubscribe = async () => {
    const savedEmail = localStorage.getItem(SUBSCRIPTION_EMAIL_KEY);
    if (!savedEmail) return;

    const confirmUnsubscribe = window.confirm(
      '¿Estás seguro de que deseas cancelar tu suscripción? Ya no recibirás notificaciones de tus atletas seguidos.'
    );

    if (!confirmUnsubscribe) return;

    setSubscribing(true);

    try {
      // Get subscription to find the ID
      const subResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/subscription/${encodeURIComponent(savedEmail)}`);

      if (subResponse.ok) {
        const subData = await subResponse.json();

        if (subData.subscribed) {
          // Call unsubscribe endpoint to deactivate in backend
          // We need to get the subscription ID first
          const emailSubResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/unsubscribe-by-email/${encodeURIComponent(savedEmail)}`, {
            method: 'POST'
          });

          if (!emailSubResponse.ok) {
            throw new Error('Error al cancelar suscripción en el servidor');
          }
        }

        // Clear local storage
        localStorage.removeItem(SUBSCRIPTION_EMAIL_KEY);
        localStorage.removeItem(SUBSCRIPTION_SETTINGS_KEY);
        setIsSubscribed(false);
        setSubscribeEmail('');
        setNotifyEveryLap(false);
        setNotifyOnFinish(true);

        setSubscribeMessage({ type: 'success', text: 'Te has dado de baja exitosamente. Ya no recibirás más notificaciones.' });

        // Reload followers count to reflect the change
        loadFollowersCount();

        setTimeout(() => {
          setShowSubscribeModal(false);
          setSubscribeMessage(null);
        }, 2000);
      }
    } catch (error) {
      setSubscribeMessage({ type: 'error', text: 'Error al cancelar suscripción. Intenta de nuevo.' });
    } finally {
      setSubscribing(false);
    }
  };

  // Open cheer modal for an athlete
  const openCheerModal = (athlete) => {
    setCheerAthlete(athlete);
    setCheerMessage('');
    setCheerResult(null);
    setShowCheerModal(true);
  };

  // Submit cheer message
  const handleSendCheer = async () => {
    if (!cheerMessage.trim() || !cheerFanName.trim()) {
      setCheerResult({ type: 'error', text: 'Por favor ingresa tu nombre y un mensaje' });
      return;
    }

    if (cheerMessage.length > 280) {
      setCheerResult({ type: 'error', text: 'El mensaje no puede exceder 280 caracteres' });
      return;
    }

    setCheerSending(true);
    setCheerResult(null);

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/cheer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          athlete_bib: cheerAthlete.bib,
          fan_name: cheerFanName,
          message: cheerMessage
        })
      });

      const data = await response.json();

      if (response.ok) {
        setCheerResult({ type: 'success', text: '¡Mensaje enviado!' });
        setCheerMessage('');
        loadCheerCount();
        setTimeout(() => {
          setShowCheerModal(false);
          setCheerResult(null);
        }, 1500);
      } else {
        setCheerResult({ type: 'error', text: data.detail || 'Error al enviar mensaje' });
      }
    } catch (error) {
      setCheerResult({ type: 'error', text: 'Error de conexión. Intenta de nuevo.' });
    } finally {
      setCheerSending(false);
    }
  };

  // Load cheer count
  const loadCheerCount = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/cheers/count`);
      if (response.ok) {
        const data = await response.json();
        setCheerCount(data.count);
      }
    } catch (error) {
      console.error('Error loading cheer count:', error);
    }
  };

  // Load followers count (email subscribers)
  const loadFollowersCount = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/subscribers-count`);
      if (response.ok) {
        const data = await response.json();
        setFollowersCount(data);
      }
    } catch (error) {
      console.error('Error loading followers count:', error);
    }
  };

  // Generate share text for winner
  const getWinnerShareText = () => {
    if (!stats?.winner) return '';
    const winner = stats.winner;
    return `¡${winner.nombre} ${winner.apellidos} es el campeón del ${raceName}!\n\n` +
           `País: ${winner.nacionalidad}\n` +
           `Vueltas completadas: ${winner.laps_completed}\n` +
           `Kilómetros recorridos: ${winner.total_km}\n\n` +
           `#BackyardUltra #SantoDomingo${getYear()} #Ultrarunning`;
  };

  const shareOnTwitter = () => {
    const text = getWinnerShareText();
    const url = window.location.href;
    openExternal(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`
    );
  };

  const shareOnWhatsApp = () => {
    const text = getWinnerShareText() + `\n\n${window.location.href}`;
    openExternal(`https://wa.me/?text=${encodeURIComponent(text)}`);
  };

  const copyToClipboard = async () => {
    const text = getWinnerShareText() + `\n\n${window.location.href}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Error copying to clipboard:', err);
    }
  };

  const loadData = async () => {
    try {
      // Use displayRaceCode to fetch data for specific race or active race
      const raceCodeParam = displayRaceCode ? `?race_code=${displayRaceCode}` : '';

      const [statsRes, participantsRes] = await Promise.all([
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/stats${raceCodeParam}`),
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/participants${raceCodeParam}`)
      ]);

      const statsData = await statsRes.json();
      const participantsData = await participantsRes.json();

      setStats(statsData);
      setParticipants(participantsData);
      setLastUpdate(new Date());
      setLoading(false);

      // Check certificates availability for non-DNS participants
      const certChecks = await Promise.all(
        participantsData
          .filter(p => p.status !== 'dns')
          .map(async (p) => {
            try {
              const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/certificate-check/${p.bib}`);
              const data = await res.json();
              return { bib: p.bib, available: data.available };
            } catch {
              return { bib: p.bib, available: false };
            }
          })
      );

      const certMap = {};
      certChecks.forEach(c => { certMap[c.bib] = c.available; });
      setCertificatesAvailable(certMap);
    } catch (err) {
      console.error('Error loading data:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    loadCheerCount();
    loadFollowersCount();
    const interval = setInterval(() => {
      loadData();
      loadFollowersCount();
    }, 30000); // Auto-refresh every 30 seconds

    return () => clearInterval(interval);
  }, [displayRaceCode]);  // Reload when race code changes

  const exportToCSV = () => {
    const headers = ['BIB', 'Nombre', 'Apellidos', 'Nacionalidad', 'Estado', 'Vueltas', 'Kilómetros', 'Retirado en Vuelta'];
    const rows = participants.map(p => [
      p.bib,
      `"${p.nombre}"`,
      `"${p.apellidos}"`,
      p.nacionalidad,
      estadoDe(p.status).etiqueta,
      p.laps_completed,
      p.total_km,
      p.retired_at_lap || '-'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Add UTF-8 BOM for Excel compatibility with special characters
    const BOM = '\uFEFF';
    exportTextFile(
      `backyard-ultra-resultados-${new Date().toISOString().split('T')[0]}.csv`,
      BOM + csvContent,
      'text/csv;charset=utf-8;'
    );
  };

  const filteredParticipants = participants.filter(p => {
    const matchesSearch = searchTerm === '' ||
      p.bib.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.apellidos.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === 'all' || p.status === filterStatus;
    const matchesFollowed = filterFollowed === 'all' || (filterFollowed === 'followed' && isFollowed(p.bib));

    return matchesSearch && matchesStatus && matchesFollowed;
  }).sort((a, b) => {
    // Sort by BIB number
    return a.bib.localeCompare(b.bib);
  });

  if (loading || !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <IconCargando className="w-10 h-10 text-primary animate-spin mx-auto" />
          <p className="text-muted-foreground">Cargando resultados...</p>
        </div>
      </div>
    );
  }

  const certificadoDe = (participant) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="p-2 text-primary hover:text-primary hover:bg-primary/10"
          title="Certificado"
        >
          <IconCertificado className="w-5 h-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => openExternal(`${process.env.REACT_APP_BACKEND_URL}/api/race/certificate/${participant.bib}`)}
          className="cursor-pointer"
        >
          <IconPDF className="w-4 h-4 mr-2" />
          Ver PDF
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => openExternal(`${process.env.REACT_APP_BACKEND_URL}/api/race/certificate/${participant.bib}/image`)}
          className="cursor-pointer"
        >
          <IconImagen className="w-4 h-4 mr-2" />
          Descargar imagen (HD)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/25 to-background">
      {/* Cabecera */}
      <header className="relative overflow-hidden bg-[#0C0C0C] text-white">
        <div
          className="absolute inset-0"
          aria-hidden="true"
          style={{ background: 'radial-gradient(75% 120% at 50% -15%, hsl(22 88% 52% / 0.45), transparent 65%)' }}
        />
        <div className="relative container mx-auto px-4 py-12 sm:py-16">
          <div className="max-w-6xl mx-auto flex flex-col items-center text-center gap-4">
            {displayRaceCode && (
              <span className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-white/70">
                {displayRaceCode}
              </span>
            )}
            <h1 className="font-display text-5xl sm:text-6xl leading-none">Resultados</h1>
            <p className="text-lg sm:text-xl text-white/70 max-w-2xl">
              {getDisplayRaceName()}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <span className="inline-flex items-center gap-2 text-sm text-white/50">
                <IconReloj className="w-4 h-4" />
                Actualizado a las {lastUpdate.toLocaleTimeString('es-DO')}
              </span>
              {cheerCount > 0 && (
                <Link
                  to={displayRaceCode ? `/comunidad/${displayRaceCode.toLowerCase()}` : '/comunidad'}
                  data-testid="view-comunidad-btn"
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-1.5 text-sm text-white/90 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <IconAnimo className="w-4 h-4" />
                  {cheerCount} mensajes de ánimo
                  <IconAvanzar className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-10">
        <div className="max-w-6xl mx-auto space-y-8">

          {/* Ganador */}
          {stats.winner && (
            <Card className="overflow-hidden border-primary/25 shadow-medium">
              <div className="bg-gradient-to-br from-primary/10 via-secondary/25 to-card">
                <CardContent className="p-6 sm:p-10">
                  <div className="flex flex-col items-center text-center gap-6">
                    <IconChip size="xl" className="bg-primary text-primary-foreground shadow-medium">
                      <IconGanador className="w-9 h-9" />
                    </IconChip>
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-primary">
                        Último atleta en pie
                      </p>
                      <h2 className="font-display text-3xl sm:text-5xl text-foreground leading-none">
                        {stats.winner.nombre} {stats.winner.apellidos}
                      </h2>
                      <p className="text-muted-foreground">
                        Campeón · {getDisplayRaceName()}
                      </p>
                    </div>

                    <div className="w-full max-w-3xl grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <DatoGanador etiqueta="BIB" valor={`#${stats.winner.bib}`} />
                      <DatoGanador etiqueta="País" valor={stats.winner.nacionalidad} />
                      <DatoGanador etiqueta="Vueltas" valor={stats.winner.laps_completed} destacado />
                      <DatoGanador etiqueta="Kilómetros" valor={`${stats.winner.total_km} km`} destacado />
                    </div>

                    {/* Compartir */}
                    <div className="w-full max-w-3xl pt-6 border-t border-border/60">
                      <p className="text-xs font-medium text-muted-foreground mb-3 flex items-center justify-center gap-2">
                        <IconCompartir className="w-4 h-4" />
                        Compartir resultado
                      </p>
                      <div className="flex flex-wrap justify-center gap-2">
                        <Button
                          onClick={shareOnTwitter}
                          data-testid="share-twitter-btn"
                          variant="outline"
                          size="sm"
                          className="rounded-full border-border hover:bg-foreground hover:text-background"
                        >
                          <IconTwitterX className="w-4 h-4" />
                          Twitter / X
                        </Button>
                        <Button
                          onClick={shareOnWhatsApp}
                          data-testid="share-whatsapp-btn"
                          variant="outline"
                          size="sm"
                          className="rounded-full border-border hover:bg-foreground hover:text-background"
                        >
                          <IconWhatsApp className="w-4 h-4" />
                          WhatsApp
                        </Button>
                        <Button
                          onClick={copyToClipboard}
                          data-testid="share-copy-btn"
                          variant="outline"
                          size="sm"
                          className={`rounded-full ${copied ? 'border-primary text-primary' : 'border-border hover:bg-foreground hover:text-background'}`}
                        >
                          {copied ? <IconHecho className="w-4 h-4" /> : <IconCopiar className="w-4 h-4" />}
                          {copied ? 'Copiado' : 'Copiar texto'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </div>
            </Card>
          )}

          {/* Cifras de la carrera */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Metrica Icono={IconVueltas} valor={stats.total_laps_completed} etiqueta="Vueltas completadas" />
            <Metrica Icono={IconEnCarrera} valor={stats.athletes_active} etiqueta="En carrera" />
            <Metrica Icono={IconDNF} valor={stats.athletes_dnf} etiqueta="DNF" tono="alerta" />
            <Metrica Icono={IconDNS} valor={stats.athletes_dns} etiqueta="DNS" tono="neutral" />
            <Metrica Icono={IconKmEvento} valor={stats.total_km} etiqueta="Km del evento" />
            <Metrica Icono={IconKmAtletas} valor={stats.total_km_all_athletes} etiqueta="Km entre todos" />
          </div>

          {/* Participantes */}
          <Card className="border-border/60 shadow-soft overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-border/60 space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl sm:text-3xl text-foreground leading-none">
                    Clasificación
                  </h2>
                  <p className="text-sm text-muted-foreground mt-2">
                    {filteredParticipants.length} participantes
                    {followedAthletes.length > 0 && ` · ${followedAthletes.length} seguidos`}
                  </p>
                </div>
                <Button
                  onClick={exportToCSV}
                  variant="outline"
                  size="sm"
                  className="border-border hover:bg-primary/10 hover:text-primary"
                >
                  <IconDescargar className="w-4 h-4" />
                  Descargar CSV
                </Button>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <IconBuscar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    type="text"
                    placeholder="Buscar por BIB o nombre..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9"
                  />
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="h-9 min-w-[140px] rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="all">Todos los estados</option>
                  <option value="winner">Ganador</option>
                  <option value="honor">Invitada de Honor</option>
                  <option value="active">En carrera</option>
                  <option value="retired">DNF</option>
                  <option value="dns">DNS</option>
                </select>
                <select
                  value={filterFollowed}
                  onChange={(e) => setFilterFollowed(e.target.value)}
                  className="h-9 min-w-[140px] rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="all">Todos los atletas</option>
                  <option value="followed">Solo los que sigo</option>
                </select>
              </div>

              {/* Suscripción */}
              {followedAthletes.length > 0 && (
                <Button
                  onClick={() => setShowSubscribeModal(true)}
                  variant={isSubscribed ? 'outline' : 'default'}
                  className={`w-full ${isSubscribed ? 'border-primary/40 text-primary hover:bg-primary/10' : ''}`}
                >
                  {isSubscribed ? <IconHecho className="w-4 h-4" /> : <IconNotificar className="w-4 h-4" />}
                  {isSubscribed
                    ? `Suscrito · ${followedAthletes.length} atleta(s) · Modificar`
                    : `Recibir notificaciones de ${followedAthletes.length} atleta(s)`}
                </Button>
              )}
            </div>

            <CardContent className="p-4 sm:p-6">
              {filteredParticipants.length === 0 && (
                <p className="text-center text-muted-foreground py-10">
                  No hay participantes que coincidan con la búsqueda.
                </p>
              )}

              {/* Móvil: tarjetas */}
              <div className="lg:hidden space-y-3">
                {filteredParticipants.map((participant) => (
                  <div
                    key={participant.bib}
                    className={`p-4 rounded-xl border transition-colors ${
                      isFollowed(participant.bib)
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-border/60 bg-card'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2 mb-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold rounded-md border border-border px-2 py-1">
                          {participant.bib}
                        </span>
                        <EstadoBadge status={participant.status} compacto />
                        {followersCount[participant.bib] > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <IconSeguidores className="w-3.5 h-3.5" />
                            {followersCount[participant.bib]}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5">
                        {certificatesAvailable[participant.bib] && certificadoDe(participant)}
                        <Button
                          onClick={() => openCheerModal(participant)}
                          variant="ghost"
                          size="sm"
                          className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10"
                          title="Enviar mensaje de ánimo"
                        >
                          <IconAnimo className="w-5 h-5" />
                        </Button>
                        <Button
                          onClick={() => toggleFollowAthlete(participant.bib)}
                          variant="ghost"
                          size="sm"
                          className={`p-2 hover:bg-primary/10 ${isFollowed(participant.bib) ? 'text-primary hover:text-primary' : 'text-muted-foreground hover:text-primary'}`}
                          title={isFollowed(participant.bib) ? 'Dejar de seguir' : 'Seguir'}
                        >
                          <IconSeguir className={`w-5 h-5 ${isFollowed(participant.bib) ? 'fill-current' : ''}`} />
                        </Button>
                      </div>
                    </div>
                    <div className="mb-3">
                      <p className="font-semibold text-foreground leading-tight">
                        {participant.nombre} {participant.apellidos}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{participant.nacionalidad}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-muted/40 p-2">
                        <p className="text-[11px] text-muted-foreground">Vueltas</p>
                        <p className="font-display text-lg leading-none mt-1">{participant.laps_completed}</p>
                      </div>
                      <div className="rounded-lg bg-muted/40 p-2">
                        <p className="text-[11px] text-muted-foreground">Km</p>
                        <p className="font-display text-lg leading-none mt-1">{participant.total_km}</p>
                      </div>
                      <div className="rounded-lg bg-muted/40 p-2">
                        <p className="text-[11px] text-muted-foreground">DNF en</p>
                        <p className="font-display text-lg leading-none mt-1">{participant.retired_at_lap || '—'}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Escritorio: tabla */}
              <div className="hidden lg:block overflow-x-auto rounded-xl border border-border/60">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted/40 text-muted-foreground">
                      <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wider">BIB</th>
                      <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wider">Atleta</th>
                      <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wider">País</th>
                      <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wider">Estado</th>
                      <th className="text-center py-3 px-4 text-[11px] font-semibold uppercase tracking-wider">Vueltas</th>
                      <th className="text-center py-3 px-4 text-[11px] font-semibold uppercase tracking-wider">Km</th>
                      <th className="text-center py-3 px-4 text-[11px] font-semibold uppercase tracking-wider">DNF en</th>
                      <th className="text-center py-3 px-4 text-[11px] font-semibold uppercase tracking-wider">Seguidores</th>
                      <th className="text-right py-3 px-4 text-[11px] font-semibold uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredParticipants.map((participant) => (
                      <tr
                        key={participant.bib}
                        className={`border-t border-border/60 transition-colors ${
                          isFollowed(participant.bib) ? 'bg-primary/5' : 'hover:bg-muted/30'
                        }`}
                      >
                        <td className="py-3 px-4">
                          <span className="font-mono text-sm font-semibold rounded-md border border-border px-2 py-1">
                            {participant.bib}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-medium text-foreground leading-tight">{participant.nombre}</p>
                          <p className="text-sm text-muted-foreground">{participant.apellidos}</p>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm text-muted-foreground">{participant.nacionalidad}</span>
                        </td>
                        <td className="py-3 px-4">
                          <EstadoBadge status={participant.status} />
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="font-display text-xl leading-none">{participant.laps_completed}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="font-medium">{participant.total_km} km</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {participant.retired_at_lap ? (
                            <span className="text-sm text-muted-foreground">Vuelta {participant.retired_at_lap}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {followersCount[participant.bib] > 0 ? (
                            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                              <IconSeguidores className="w-4 h-4" />
                              {followersCount[participant.bib]}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-sm">0</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex justify-end items-center gap-0.5">
                            {certificatesAvailable[participant.bib] && certificadoDe(participant)}
                            <Button
                              onClick={() => openCheerModal(participant)}
                              variant="ghost"
                              size="sm"
                              className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10"
                              title="Enviar mensaje de ánimo"
                            >
                              <IconAnimo className="w-5 h-5" />
                            </Button>
                            <Button
                              onClick={() => toggleFollowAthlete(participant.bib)}
                              variant="ghost"
                              size="sm"
                              className={`p-2 hover:bg-primary/10 ${isFollowed(participant.bib) ? 'text-primary hover:text-primary' : 'text-muted-foreground hover:text-primary'}`}
                              title={isFollowed(participant.bib) ? 'Dejar de seguir' : 'Seguir'}
                            >
                              <IconSeguir className={`w-5 h-5 ${isFollowed(participant.bib) ? 'fill-current' : ''}`} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Notificaciones por email */}
      {showSubscribeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl shadow-strong max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start gap-4 mb-5">
                <div className="flex items-start gap-3">
                  <IconChip size="sm">
                    {isSubscribed ? <IconHecho className="w-4 h-4" /> : <IconNotificar className="w-4 h-4" />}
                  </IconChip>
                  <div>
                    <h3 className="font-display text-xl text-foreground leading-none">
                      {isSubscribed ? 'Suscripción activa' : 'Notificaciones por email'}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-2">
                      {isSubscribed
                        ? 'Los nuevos atletas que sigas se agregarán automáticamente'
                        : 'Recibe actualizaciones de tus atletas favoritos'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSubscribeModal(false)}
                  className="p-1 text-muted-foreground hover:bg-muted"
                >
                  <IconCerrar className="w-5 h-5" />
                </Button>
              </div>

              {/* Atletas seguidos */}
              <div className="rounded-xl border border-border/60 bg-muted/30 p-4 mb-4">
                <p className="text-sm font-medium mb-2">Atletas seleccionados ({followedAthletes.length}):</p>
                <div className="flex flex-wrap gap-2">
                  {participants
                    .filter(p => followedAthletes.includes(p.bib))
                    .map(p => (
                      <Badge key={p.bib} variant="secondary" className="text-xs">
                        #{p.bib} {p.nombre}
                      </Badge>
                    ))}
                </div>
              </div>

              {/* Email */}
              <div className="mb-4">
                <label className="text-sm font-medium mb-2 block">Tu correo electrónico</label>
                <Input
                  type="email"
                  placeholder="tu@email.com"
                  value={subscribeEmail}
                  onChange={(e) => setSubscribeEmail(e.target.value)}
                  className="w-full"
                />
              </div>

              {/* Opciones */}
              <div className="space-y-2 mb-6">
                <label className="text-sm font-medium block">¿Cuándo quieres recibir notificaciones?</label>

                <label className="flex items-start gap-3 p-3 rounded-xl border border-border/60 cursor-pointer hover:bg-muted/30 transition-colors">
                  <input
                    type="checkbox"
                    checked={notifyEveryLap}
                    onChange={(e) => setNotifyEveryLap(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-input text-primary focus:ring-primary"
                  />
                  <div>
                    <p className="font-medium text-sm">Cada vuelta completada</p>
                    <p className="text-xs text-muted-foreground">Recibe un email cada vez que se complete una vuelta</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-xl border border-border/60 cursor-pointer hover:bg-muted/30 transition-colors">
                  <input
                    type="checkbox"
                    checked={notifyOnFinish}
                    onChange={(e) => setNotifyOnFinish(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-input text-primary focus:ring-primary"
                  />
                  <div>
                    <p className="font-medium text-sm">Solo al finalizar (DNF/Ganador)</p>
                    <p className="text-xs text-muted-foreground">Recibe un email cuando el atleta termine o gane</p>
                  </div>
                </label>
              </div>

              {subscribeMessage && (
                <div className={`rounded-xl p-3 mb-4 text-sm ${
                  subscribeMessage.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/25'
                    : 'bg-destructive/10 text-destructive border border-destructive/25'
                }`}>
                  {subscribeMessage.text}
                </div>
              )}

              <Button onClick={handleSubscribe} disabled={subscribing} className="w-full">
                <IconEmail className="w-4 h-4" />
                {subscribing ? 'Guardando...' : isSubscribed ? 'Actualizar suscripción' : 'Suscribirme'}
              </Button>

              {isSubscribed && (
                <Button
                  onClick={handleUnsubscribe}
                  disabled={subscribing}
                  variant="ghost"
                  className="w-full mt-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <IconCerrar className="w-4 h-4" />
                  Cancelar suscripción
                </Button>
              )}

              {!isSubscribed && (
                <p className="text-xs text-muted-foreground text-center mt-3">
                  Puedes cancelar la suscripción en cualquier momento
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mensaje de ánimo */}
      {showCheerModal && cheerAthlete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl shadow-strong max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-start gap-4 mb-5">
                <div className="flex items-start gap-3">
                  <IconChip size="sm">
                    <IconAnimo className="w-4 h-4" />
                  </IconChip>
                  <div>
                    <h3 className="font-display text-xl text-foreground leading-none">Mensaje de ánimo</h3>
                    <p className="text-sm text-muted-foreground mt-2">
                      Para <span className="font-medium text-foreground">#{cheerAthlete.bib} {cheerAthlete.nombre} {cheerAthlete.apellidos}</span>
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCheerModal(false)}
                  className="p-1 text-muted-foreground hover:bg-muted"
                >
                  <IconCerrar className="w-5 h-5" />
                </Button>
              </div>

              <div className="mb-4">
                <label className="text-sm font-medium mb-2 block">Tu nombre</label>
                <Input
                  type="text"
                  placeholder="Tu nombre"
                  value={cheerFanName}
                  onChange={(e) => setCheerFanName(e.target.value)}
                  maxLength={50}
                />
              </div>

              <div className="mb-4">
                <label className="text-sm font-medium mb-2 block">Tu mensaje</label>
                <textarea
                  placeholder="¡Escribe tu mensaje de ánimo!"
                  value={cheerMessage}
                  onChange={(e) => setCheerMessage(e.target.value)}
                  maxLength={280}
                  rows={3}
                  className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                />
                <p className="text-xs text-muted-foreground text-right mt-1">{cheerMessage.length}/280</p>
              </div>

              {cheerResult && (
                <div className={`rounded-xl p-3 mb-4 text-sm ${
                  cheerResult.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/25'
                    : 'bg-destructive/10 text-destructive border border-destructive/25'
                }`}>
                  {cheerResult.text}
                </div>
              )}

              <Button
                onClick={handleSendCheer}
                disabled={cheerSending || !cheerMessage.trim() || !cheerFanName.trim()}
                className="w-full"
              >
                <IconEnviar className="w-4 h-4" />
                {cheerSending ? 'Enviando...' : 'Enviar mensaje'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
