import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Activity, TrendingUp, UserX, Users, MapPin, Download, Share2, Copy, Check, Clock, Heart, Mail, Bell, X, MessageCircle, UserCheck, Send } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

// Add custom CSS for slow pulse animation
const customStyles = `
  @keyframes pulse-slow {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.95;
    }
  }
  
  .animate-pulse-slow {
    animation: pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
`;

// Race start date: January 24, 2026 at 9:00 AM (Dominican Republic time)
const RACE_START_DATE = new Date('2026-01-24T09:00:00-04:00');

// LocalStorage keys
const FOLLOWED_ATHLETES_KEY = 'backyard_ultra_followed_athletes';
const SUBSCRIPTION_EMAIL_KEY = 'backyard_ultra_subscription_email';
const SUBSCRIPTION_SETTINGS_KEY = 'backyard_ultra_subscription_settings';

export default function LiveDashboard() {
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
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: false });
  
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
  
  // Cheer count for link
  const [cheerCount, setCheerCount] = useState(0);
  
  // Cheer message modal
  const [showCheerModal, setShowCheerModal] = useState(false);
  const [cheerAthlete, setCheerAthlete] = useState(null);
  const [cheerFanName, setCheerFanName] = useState('');
  const [cheerMessage, setCheerMessage] = useState('');
  const [cheerSending, setCheerSending] = useState(false);
  const [cheerResult, setCheerResult] = useState(null);

  // Save followed athletes to localStorage and update subscription if exists
  useEffect(() => {
    localStorage.setItem(FOLLOWED_ATHLETES_KEY, JSON.stringify(followedAthletes));
    
    // Auto-update subscription if user is already subscribed
    const savedEmail = localStorage.getItem(SUBSCRIPTION_EMAIL_KEY);
    if (savedEmail && followedAthletes.length > 0) {
      updateSubscriptionSilently(savedEmail, followedAthletes);
    }
  }, [followedAthletes]);

  // Silent subscription update (no UI feedback)
  const updateSubscriptionSilently = async (email, athletes) => {
    const savedSettings = localStorage.getItem(SUBSCRIPTION_SETTINGS_KEY);
    const settings = savedSettings ? JSON.parse(savedSettings) : { notifyEveryLap: false, notifyOnFinish: true };
    
    try {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/subscribe`, {
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
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/subscription/${encodeURIComponent(savedEmail)}`);
      
      if (response.ok) {
        // Clear local storage
        localStorage.removeItem(SUBSCRIPTION_EMAIL_KEY);
        localStorage.removeItem(SUBSCRIPTION_SETTINGS_KEY);
        setIsSubscribed(false);
        setSubscribeEmail('');
        setNotifyEveryLap(false);
        setNotifyOnFinish(true);
        
        setSubscribeMessage({ type: 'success', text: 'Te has dado de baja exitosamente. Ya no recibirás más notificaciones.' });
        
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
  const handleSubmitCheer = async () => {
    if (!cheerMessage.trim() || !cheerFanName.trim()) {
      setCheerResult({ type: 'error', text: 'Por favor ingresa tu nombre y un mensaje' });
      return;
    }

    if (cheerMessage.length > 280) {
      setCheerResult({ type: 'error', text: 'El mensaje no puede exceder 280 caracteres' });
      return;
    }

    setCheerSubmitting(true);
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
        setCheerResult({ type: 'success', text: data.message });
        setCheerMessage('');
        // Refresh cheer count
        loadCheerCount();
        setTimeout(() => {
          setShowCheerModal(false);
          setCheerResult(null);
        }, 2000);
      } else {
        setCheerResult({ type: 'error', text: data.detail || 'Error al enviar mensaje' });
      }
    } catch (error) {
      setCheerResult({ type: 'error', text: 'Error de conexión. Intenta de nuevo.' });
    } finally {
      setCheerSubmitting(false);
    }
  };

  // Load cheer messages feed
  const loadCheerMessages = async () => {
    setLoadingCheers(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/cheers?limit=50`);
      if (response.ok) {
        const data = await response.json();
        setCheerMessages(data);
      }
    } catch (error) {
      console.error('Error loading cheer messages:', error);
    } finally {
      setLoadingCheers(false);
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

  // Open cheer modal
  const openCheerModal = (athlete) => {
    setCheerAthlete(athlete);
    setCheerMessage('');
    setCheerResult(null);
    setShowCheerModal(true);
  };

  // Send cheer message
  const handleSendCheer = async () => {
    if (!cheerMessage.trim() || !cheerFanName.trim()) {
      setCheerResult({ type: 'error', text: 'Por favor ingresa tu nombre y un mensaje' });
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
        setCheerResult({ type: 'error', text: data.detail || 'Error al enviar' });
      }
    } catch (error) {
      setCheerResult({ type: 'error', text: 'Error de conexión' });
    } finally {
      setCheerSending(false);
    }
  };

  // Countdown timer effect
  useEffect(() => {
    const calculateCountdown = () => {
      const now = new Date();
      const difference = RACE_START_DATE - now;

      if (difference <= 0) {
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: false });
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setCountdown({ days, hours, minutes, seconds, expired: false });
    };

    calculateCountdown();
    const timer = setInterval(calculateCountdown, 1000);

    return () => clearInterval(timer);
  }, []);

  // Generate share text for winner
  const getWinnerShareText = () => {
    if (!stats?.winner) return '';
    const winner = stats.winner;
    return `🏆 ¡${winner.nombre} ${winner.apellidos} es el campeón del Backyard Ultra Santo Domingo 2026!\n\n` +
           `📍 ${winner.nacionalidad}\n` +
           `🔄 ${winner.laps_completed} vueltas completadas\n` +
           `📏 ${winner.total_km} km recorridos\n\n` +
           `#BackyardUltra #SantoDomingo2026 #Ultrarunning`;
  };

  const shareOnTwitter = () => {
    const text = getWinnerShareText();
    const url = window.location.href;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      '_blank',
      'width=550,height=420'
    );
  };

  const shareOnWhatsApp = () => {
    const text = getWinnerShareText() + `\n\n🔗 ${window.location.href}`;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(text)}`,
      '_blank'
    );
  };

  const copyToClipboard = async () => {
    const text = getWinnerShareText() + `\n\n🔗 ${window.location.href}`;
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
      const [statsRes, participantsRes] = await Promise.all([
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/stats`),
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/participants`)
      ]);

      const statsData = await statsRes.json();
      const participantsData = await participantsRes.json();

      setStats(statsData);
      setParticipants(participantsData);
      setLastUpdate(new Date());
      setLoading(false);
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
  }, []);

  const exportToCSV = () => {
    const headers = ['BIB', 'Nombre', 'Apellidos', 'Nacionalidad', 'Estado', 'Vueltas', 'Kilómetros', 'Retirado en Vuelta'];
    const rows = participants.map(p => [
      p.bib,
      `"${p.nombre}"`,
      `"${p.apellidos}"`,
      p.nacionalidad,
      p.status === 'active' ? 'Activo' : (p.status === 'dns' ? 'DNS' : 'DNF'),
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
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `backyard-ultra-resultados-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
        <div className="text-center">
          <Activity className="w-12 h-12 text-primary animate-pulse mx-auto mb-4" />
          <p className="text-lg text-muted-foreground">Cargando datos en vivo...</p>
        </div>
      </div>
    );
  }

  return (
    <section className="py-20 bg-gradient-to-b from-muted/20 to-background min-h-screen">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto space-y-12">
          {/* Header */}
          <div className="text-center space-y-4">
            <h2 className="font-display text-4xl sm:text-5xl text-foreground">
              Seguimiento en Vivo
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Backyard Ultra Santo Domingo 2026
            </p>
            <div className="flex flex-col items-center gap-2">
              <p className="text-sm text-muted-foreground">
                Última actualización: {lastUpdate.toLocaleTimeString('es-DO')}
              </p>
              {cheerCount > 0 && (
                <Link to="/comunidad">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-purple-300 text-purple-600 hover:bg-purple-50"
                    data-testid="view-comunidad-btn"
                  >
                    <MessageCircle className="w-4 h-4 mr-1" />
                    {cheerCount} mensajes de ánimo · Ver Comunidad →
                  </Button>
                </Link>
              )}
            </div>
          </div>

          {/* Countdown Timer - Only show if not expired */}
          {!countdown.expired && (
            <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5">
            <CardContent className="p-6">
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-4">
                  <Clock className="w-6 h-6 text-primary" />
                  <h2 className="text-xl font-bold text-foreground">La carrera comienza en</h2>
                </div>
                <div className="flex justify-center gap-3 sm:gap-6">
                  <div className="text-center">
                    <div className="bg-primary text-primary-foreground rounded-lg px-4 py-3 sm:px-6 sm:py-4 min-w-[70px] sm:min-w-[90px]">
                      <p className="text-3xl sm:text-5xl font-bold">{countdown.days}</p>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-2 font-medium">DÍAS</p>
                  </div>
                  <div className="text-center">
                    <div className="bg-primary text-primary-foreground rounded-lg px-4 py-3 sm:px-6 sm:py-4 min-w-[70px] sm:min-w-[90px]">
                      <p className="text-3xl sm:text-5xl font-bold">{String(countdown.hours).padStart(2, '0')}</p>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-2 font-medium">HORAS</p>
                  </div>
                  <div className="text-center">
                    <div className="bg-primary text-primary-foreground rounded-lg px-4 py-3 sm:px-6 sm:py-4 min-w-[70px] sm:min-w-[90px]">
                      <p className="text-3xl sm:text-5xl font-bold">{String(countdown.minutes).padStart(2, '0')}</p>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-2 font-medium">MINUTOS</p>
                  </div>
                  <div className="text-center">
                    <div className="bg-primary text-primary-foreground rounded-lg px-4 py-3 sm:px-6 sm:py-4 min-w-[70px] sm:min-w-[90px]">
                      <p className="text-3xl sm:text-5xl font-bold">{String(countdown.seconds).padStart(2, '0')}</p>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-2 font-medium">SEGUNDOS</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-4">
                  24 de enero de 2026 • 9:00 AM
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Winner Section */}
        {stats.winner && (
          <Card className="mb-8 border-4 border-yellow-400 bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50 shadow-strong animate-pulse-slow">
            <CardContent className="p-8">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-strong">
                    <span className="text-4xl">🏆</span>
                  </div>
                </div>
                <div>
                  <h2 className="font-display text-3xl sm:text-4xl text-amber-900 font-bold mb-2">
                    ¡Tenemos un Ganador!
                  </h2>
                  <p className="text-lg text-amber-800">
                    Último atleta en pie - Backyard Ultra Santo Domingo 2026
                  </p>
                </div>
                <div className="max-w-2xl mx-auto bg-white/80 rounded-lg p-6 shadow-medium">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-amber-700 font-medium">BIB</p>
                        <p className="text-3xl font-bold text-amber-900">#{stats.winner.bib}</p>
                      </div>
                      <div>
                        <p className="text-sm text-amber-700 font-medium">Nombre</p>
                        <p className="text-2xl font-bold text-amber-900">
                          {stats.winner.nombre} {stats.winner.apellidos}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-amber-700 font-medium">País</p>
                        <Badge className="text-lg px-4 py-1 bg-amber-600">
                          {stats.winner.nacionalidad}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-amber-700 font-medium">Vueltas Completadas</p>
                        <p className="text-5xl font-bold text-amber-900">{stats.winner.laps_completed}</p>
                      </div>
                      <div>
                        <p className="text-sm text-amber-700 font-medium">Kilómetros Recorridos</p>
                        <p className="text-4xl font-bold text-amber-900">{stats.winner.total_km} km</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="pt-4">
                  <p className="text-lg text-amber-800 font-semibold">
                    🎉 ¡Felicitaciones por completar el desafío! 🎉
                  </p>
                </div>
                
                {/* Share Buttons */}
                <div className="pt-6 border-t border-amber-200 mt-6">
                  <p className="text-sm text-amber-700 font-medium mb-3 flex items-center justify-center gap-2">
                    <Share2 className="w-4 h-4" />
                    Compartir resultado
                  </p>
                  <div className="flex flex-wrap justify-center gap-3">
                    <Button
                      onClick={shareOnTwitter}
                      data-testid="share-twitter-btn"
                      className="bg-black hover:bg-gray-800 text-white px-4 py-2 rounded-full flex items-center gap-2 transition-all hover:scale-105"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                      </svg>
                      Twitter / X
                    </Button>
                    <Button
                      onClick={shareOnWhatsApp}
                      data-testid="share-whatsapp-btn"
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-full flex items-center gap-2 transition-all hover:scale-105"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      WhatsApp
                    </Button>
                    <Button
                      onClick={copyToClipboard}
                      data-testid="share-copy-btn"
                      className={`${copied ? 'bg-green-600' : 'bg-amber-600 hover:bg-amber-700'} text-white px-4 py-2 rounded-full flex items-center gap-2 transition-all hover:scale-105`}
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4" />
                          ¡Copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Copiar texto
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards - Compact on mobile */}
        <div className="grid grid-cols-4 sm:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-4 mb-8">
          <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
            <CardContent className="p-2 sm:p-4 lg:p-6 h-full">
              <div className="flex flex-col sm:flex-row items-center sm:justify-between h-full text-center sm:text-left">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Vuelta</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground">{stats.current_lap}</p>
                </div>
                <Activity className="hidden sm:block w-8 h-8 lg:w-10 lg:h-10 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-2 sm:p-4 lg:p-6 h-full">
              <div className="flex flex-col sm:flex-row items-center sm:justify-between h-full text-center sm:text-left">
                <div>
                  <p className="text-xs sm:text-sm text-green-700">Completadas</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-green-900">{stats.total_laps_completed}</p>
                </div>
                <TrendingUp className="hidden sm:block w-8 h-8 lg:w-10 lg:h-10 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-2 sm:p-4 lg:p-6 h-full">
              <div className="flex flex-col sm:flex-row items-center sm:justify-between h-full text-center sm:text-left">
                <div>
                  <p className="text-xs sm:text-sm text-blue-700">Activos</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-blue-900">{stats.athletes_active}</p>
                </div>
                <Users className="hidden sm:block w-8 h-8 lg:w-10 lg:h-10 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
            <CardContent className="p-2 sm:p-4 lg:p-6 h-full">
              <div className="flex flex-col sm:flex-row items-center sm:justify-between h-full text-center sm:text-left">
                <div>
                  <p className="text-xs sm:text-sm text-red-700">DNF</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-red-900">{stats.athletes_dnf}</p>
                </div>
                <UserX className="hidden sm:block w-8 h-8 lg:w-10 lg:h-10 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200">
            <CardContent className="p-2 sm:p-4 lg:p-6 h-full">
              <div className="flex flex-col sm:flex-row items-center sm:justify-between h-full text-center sm:text-left">
                <div>
                  <p className="text-xs sm:text-sm text-gray-700">DNS</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">{stats.athletes_dns}</p>
                </div>
                <UserX className="hidden sm:block w-8 h-8 lg:w-10 lg:h-10 text-gray-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-2 sm:p-4 lg:p-6 h-full">
              <div className="flex flex-col sm:flex-row items-center sm:justify-between h-full text-center sm:text-left">
                <div>
                  <p className="text-xs sm:text-sm text-purple-700">Km Evento</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-purple-900">{stats.total_km}</p>
                </div>
                <MapPin className="hidden sm:block w-8 h-8 lg:w-10 lg:h-10 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <CardContent className="p-2 sm:p-4 lg:p-6 h-full">
              <div className="flex flex-col sm:flex-row items-center sm:justify-between h-full text-center sm:text-left">
                <div>
                  <p className="text-xs sm:text-sm text-orange-700">Km Total</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-orange-900">{stats.total_km_all_athletes}</p>
                </div>
                <TrendingUp className="hidden sm:block w-8 h-8 lg:w-10 lg:h-10 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Participants Section */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4">
              <div>
                <CardTitle className="text-xl sm:text-2xl">Clasificación de Participantes</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {filteredParticipants.length} participantes
                  {followedAthletes.length > 0 && ` • ${followedAthletes.length} seguidos`}
                </p>
              </div>
              <div className="flex flex-col gap-2 w-full">
                <Input
                  type="text"
                  placeholder="Buscar por BIB o nombre..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
                <div className="flex flex-wrap gap-2">
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="flex-1 min-w-[100px] px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="all">Todos</option>
                    <option value="active">Activos</option>
                    <option value="retired">DNF</option>
                    <option value="dns">DNS</option>
                  </select>
                  <select
                    value={filterFollowed}
                    onChange={(e) => setFilterFollowed(e.target.value)}
                    className="flex-1 min-w-[120px] px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="all">Todos</option>
                    <option value="followed">Seguidos ❤️</option>
                  </select>
                  <Button
                    onClick={exportToCSV}
                    variant="outline"
                    size="sm"
                    className="border-primary/30 hover:bg-primary/10"
                  >
                    <Download className="w-4 h-4 sm:mr-2" />
                    <span className="hidden sm:inline">CSV</span>
                  </Button>
                </div>
              </div>
              
              {/* Subscribe Button */}
              {followedAthletes.length > 0 && (
                <Button
                  onClick={() => setShowSubscribeModal(true)}
                  className={`w-full ${isSubscribed ? 'bg-green-600 hover:bg-green-700' : 'bg-gradient-to-r from-primary to-accent'} text-white`}
                >
                  {isSubscribed ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Suscrito • {followedAthletes.length} atleta(s) • Modificar
                    </>
                  ) : (
                    <>
                      <Bell className="w-4 h-4 mr-2" />
                      Recibir notificaciones de {followedAthletes.length} atleta(s)
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {/* Mobile View - Cards */}
            <div className="lg:hidden space-y-3">
              {filteredParticipants.map((participant) => (
                <div
                  key={participant.bib}
                  className={`p-4 rounded-lg border ${
                    isFollowed(participant.bib) 
                      ? 'border-red-300 bg-red-50' 
                      : 'border-border bg-muted/20'
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-lg">
                        {participant.bib}
                      </Badge>
                      <Badge
                        className={
                          participant.status === 'active' 
                            ? 'bg-green-500' 
                            : participant.status === 'dns'
                            ? 'bg-gray-500'
                            : 'bg-red-500'
                        }
                      >
                        {participant.status === 'active' 
                          ? 'Activo' 
                          : participant.status === 'dns'
                          ? 'DNS'
                          : 'DNF'}
                      </Badge>
                      {followersCount[participant.bib] && (
                        <Badge variant="secondary" className="bg-pink-100 text-pink-700">
                          <UserCheck className="w-3 h-3 mr-1" />
                          {followersCount[participant.bib]}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        onClick={() => openCheerModal(participant)}
                        variant="ghost"
                        size="sm"
                        className="p-2 text-purple-500 hover:text-purple-600"
                      >
                        <MessageCircle className="w-5 h-5" />
                      </Button>
                      <Button
                        onClick={() => toggleFollowAthlete(participant.bib)}
                        variant="ghost"
                        size="sm"
                        className={`p-2 ${isFollowed(participant.bib) ? 'text-red-500' : 'text-gray-400'}`}
                      >
                        <Heart className={`w-5 h-5 ${isFollowed(participant.bib) ? 'fill-current' : ''}`} />
                      </Button>
                    </div>
                  </div>
                  <div className="mb-3">
                    <p className="font-semibold text-foreground">{participant.nombre} {participant.apellidos}</p>
                    <Badge variant="secondary" className="text-xs mt-1">
                      {participant.nacionalidad}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-background rounded p-2">
                      <p className="text-xs text-muted-foreground">Vueltas</p>
                      <p className="font-bold text-lg">{participant.laps_completed}</p>
                    </div>
                    <div className="bg-background rounded p-2">
                      <p className="text-xs text-muted-foreground">Km</p>
                      <p className="font-bold text-lg">{participant.total_km}</p>
                    </div>
                    <div className="bg-background rounded p-2">
                      <p className="text-xs text-muted-foreground">DNF en</p>
                      <p className="font-bold text-lg">{participant.retired_at_lap || '-'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop View - Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-semibold text-sm">BIB</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm">Nombre</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm">País</th>
                    <th className="text-center py-3 px-4 font-semibold text-sm">Estado</th>
                    <th className="text-center py-3 px-4 font-semibold text-sm">Vueltas</th>
                    <th className="text-center py-3 px-4 font-semibold text-sm">Km</th>
                    <th className="text-center py-3 px-4 font-semibold text-sm">DNF en</th>
                    <th className="text-center py-3 px-4 font-semibold text-sm">Seguidores</th>
                    <th className="text-center py-3 px-4 font-semibold text-sm">Ánimo</th>
                    <th className="text-center py-3 px-4 font-semibold text-sm">Seguir</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredParticipants.map((participant) => (
                    <tr
                      key={participant.bib}
                      className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${
                        isFollowed(participant.bib) ? 'bg-red-50' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="font-mono">
                          {participant.bib}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-foreground">{participant.nombre}</p>
                          <p className="text-sm text-muted-foreground">{participant.apellidos}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="secondary" className="text-xs">
                          {participant.nacionalidad}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge
                          className={
                            participant.status === 'active' 
                              ? 'bg-green-500' 
                              : participant.status === 'dns'
                              ? 'bg-gray-500'
                              : 'bg-red-500'
                          }
                        >
                          {participant.status === 'active' 
                            ? 'Activo' 
                            : participant.status === 'dns'
                            ? 'DNS'
                            : 'DNF'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-bold text-lg">{participant.laps_completed}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-semibold">{participant.total_km} km</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {participant.retired_at_lap ? (
                          <Badge variant="outline">Vuelta {participant.retired_at_lap}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {followersCount[participant.bib] ? (
                          <Badge variant="secondary" className="bg-pink-100 text-pink-700">
                            <UserCheck className="w-3 h-3 mr-1" />
                            {followersCount[participant.bib]}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">0</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Button
                          onClick={() => openCheerModal(participant)}
                          variant="ghost"
                          size="sm"
                          className="p-2 text-purple-500 hover:text-purple-600 hover:bg-purple-50"
                        >
                          <MessageCircle className="w-5 h-5" />
                        </Button>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Button
                          onClick={() => toggleFollowAthlete(participant.bib)}
                          variant="ghost"
                          size="sm"
                          className={`p-2 ${isFollowed(participant.bib) ? 'text-red-500 hover:text-red-600' : 'text-gray-400 hover:text-red-500'}`}
                        >
                          <Heart 
                            className={`w-5 h-5 ${isFollowed(participant.bib) ? 'fill-current' : ''}`}
                          />
                        </Button>
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

      {/* Subscribe Modal */}
      {showSubscribeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                    {isSubscribed ? <Check className="w-5 h-5 text-green-600" /> : <Bell className="w-5 h-5 text-primary" />}
                    {isSubscribed ? 'Suscripción Activa' : 'Notificaciones por Email'}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {isSubscribed 
                      ? 'Los nuevos atletas que sigas se agregarán automáticamente'
                      : 'Recibe actualizaciones de tus atletas favoritos'
                    }
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSubscribeModal(false)}
                  className="p-1"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Followed Athletes Summary */}
              <div className="bg-muted/30 rounded-lg p-4 mb-4">
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

              {/* Email Input */}
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

              {/* Notification Options */}
              <div className="space-y-3 mb-6">
                <label className="text-sm font-medium block">¿Cuándo quieres recibir notificaciones?</label>
                
                <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/30 transition-colors">
                  <input
                    type="checkbox"
                    checked={notifyEveryLap}
                    onChange={(e) => setNotifyEveryLap(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <div>
                    <p className="font-medium text-sm">Cada vuelta completada</p>
                    <p className="text-xs text-muted-foreground">Recibe un email cada vez que se complete una vuelta</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/30 transition-colors">
                  <input
                    type="checkbox"
                    checked={notifyOnFinish}
                    onChange={(e) => setNotifyOnFinish(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <div>
                    <p className="font-medium text-sm">Solo al finalizar (DNF/Ganador)</p>
                    <p className="text-xs text-muted-foreground">Recibe un email cuando el atleta termine o gane</p>
                  </div>
                </label>
              </div>

              {/* Message */}
              {subscribeMessage && (
                <div className={`p-3 rounded-lg mb-4 ${
                  subscribeMessage.type === 'success' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  <p className="text-sm">{subscribeMessage.text}</p>
                </div>
              )}

              {/* Submit Button */}
              <Button
                onClick={handleSubscribe}
                disabled={subscribing}
                className="w-full bg-gradient-to-r from-primary to-accent text-white"
              >
                <Mail className="w-4 h-4 mr-2" />
                {subscribing ? 'Guardando...' : isSubscribed ? 'Actualizar Suscripción' : 'Suscribirme'}
              </Button>

              {/* Unsubscribe Button - Only show if already subscribed */}
              {isSubscribed && (
                <Button
                  onClick={handleUnsubscribe}
                  disabled={subscribing}
                  variant="ghost"
                  className="w-full mt-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <X className="w-4 h-4 mr-2" />
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
    </section>
  );
}
