import React, { useState, useEffect } from 'react';
import { Activity, TrendingUp, UserX, Users, MapPin, Download, Share2, Copy, Check, Clock, Heart } from 'lucide-react';
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

// LocalStorage key for followed athletes
const FOLLOWED_ATHLETES_KEY = 'backyard_ultra_followed_athletes';

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

  // Save followed athletes to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(FOLLOWED_ATHLETES_KEY, JSON.stringify(followedAthletes));
  }, [followedAthletes]);

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
    const interval = setInterval(() => {
      loadData();
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
            <p className="text-sm text-muted-foreground">
              Última actualización: {lastUpdate.toLocaleTimeString('es-DO')}
            </p>
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

        {/* Participants Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <CardTitle className="text-2xl">Clasificación de Participantes</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {filteredParticipants.length} participantes
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <Input
                  type="text"
                  placeholder="Buscar por BIB o nombre..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="md:w-64"
                />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-4 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="all">Todos</option>
                  <option value="active">Activos</option>
                  <option value="retired">DNF</option>
                  <option value="dns">DNS</option>
                </select>
                <select
                  value={filterFollowed}
                  onChange={(e) => setFilterFollowed(e.target.value)}
                  className="px-4 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="all">Todos los atletas</option>
                  <option value="followed">Solo seguidos</option>
                </select>
                <Button
                  onClick={exportToCSV}
                  variant="outline"
                  className="border-primary/30 hover:bg-primary/10"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Exportar CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-semibold text-sm">BIB</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm">Nombre</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm">Nacionalidad</th>
                    <th className="text-center py-3 px-4 font-semibold text-sm">Estado</th>
                    <th className="text-center py-3 px-4 font-semibold text-sm">Vueltas</th>
                    <th className="text-center py-3 px-4 font-semibold text-sm">Kilómetros</th>
                    <th className="text-center py-3 px-4 font-semibold text-sm">DNF en</th>
                    <th className="text-center py-3 px-4 font-semibold text-sm">Seguir</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredParticipants.map((participant) => (
                    <tr
                      key={participant.bib}
                      className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
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
                        <Button
                          onClick={() => toggleFollowAthlete(participant.bib)}
                          variant="ghost"
                          size="sm"
                          className={`p-2 ${isFollowed(participant.bib) ? 'text-red-500 hover:text-red-600' : 'text-gray-400 hover:text-red-500'}`}
                        >
                          <Heart 
                            className={`w-4 h-4 ${isFollowed(participant.bib) ? 'fill-current' : ''}`}
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
    </section>
  );
}
