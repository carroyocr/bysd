import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Trophy, Award, Send, X, Users, Heart, ArrowLeft, Monitor, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';

export default function ComunidadPage() {
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

  const loadMessages = useCallback(async (page = 1) => {
    setLoadingMessages(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/cheers?limit=50&page=${page}`);
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
  }, []);

  // Load messages on mount and when page changes
  useEffect(() => {
    loadMessages(currentPage);
    loadAthletes();
  }, [currentPage, loadMessages]);

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
      // Get subscribers count and participants
      const [subsResponse, participantsResponse] = await Promise.all([
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/subscribers-count-public`),
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/participants`)
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
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/fans/leaderboard?limit=20`);
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
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/participants`);
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
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/fans/badge/${encodeURIComponent(name)}`);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 pt-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white py-10">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl sm:text-5xl font-bold text-center mb-2">
            Comunidad
          </h1>
          <p className="text-center text-purple-100 mb-4">
            Backyard Ultra Santo Domingo 2026
          </p>
          <div className="flex justify-center gap-2 flex-wrap">
            <Link to="/en-vivo">
              <Button variant="outline" size="sm" className="bg-white/10 border-white/30 text-white hover:bg-white/20">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver a Seguimiento
              </Button>
            </Link>
            <Link to="/mensajes/presentacion">
              <Button variant="outline" size="sm" className="bg-white/10 border-white/30 text-white hover:bg-white/20">
                <Monitor className="w-4 h-4 mr-2" />
                Modo Presentación
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Cards - Tab Selector */}
      <div className="container mx-auto px-4 -mt-6">
        <div className="grid grid-cols-3 gap-3 max-w-xl mx-auto">
          <Card 
            onClick={() => setActiveTab('messages')}
            className={`cursor-pointer transition-all hover:scale-105 ${
              activeTab === 'messages' 
                ? 'bg-gradient-to-br from-purple-100 to-purple-200 border-purple-400 ring-2 ring-purple-400' 
                : 'bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 hover:border-purple-300'
            }`}
          >
            <CardContent className="p-3 sm:p-4 text-center">
              <MessageCircle className={`w-5 h-5 sm:w-6 sm:h-6 mx-auto mb-1 ${activeTab === 'messages' ? 'text-purple-600' : 'text-purple-400'}`} />
              <p className="text-xl sm:text-2xl font-bold text-purple-900">{stats.totalMessages}</p>
              <p className="text-xs text-purple-700">Mensajes</p>
            </CardContent>
          </Card>

          <Card 
            onClick={() => setActiveTab('athletes')}
            className={`cursor-pointer transition-all hover:scale-105 ${
              activeTab === 'athletes' 
                ? 'bg-gradient-to-br from-amber-100 to-amber-200 border-amber-400 ring-2 ring-amber-400' 
                : 'bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200 hover:border-amber-300'
            }`}
          >
            <CardContent className="p-3 sm:p-4 text-center">
              <Trophy className={`w-5 h-5 sm:w-6 sm:h-6 mx-auto mb-1 ${activeTab === 'athletes' ? 'text-amber-600' : 'text-amber-400'}`} />
              <p className="text-xl sm:text-2xl font-bold text-amber-900">{stats.totalAthletes}</p>
              <p className="text-xs text-amber-700">Top Atletas</p>
            </CardContent>
          </Card>

          <Card 
            onClick={() => setActiveTab('fans')}
            className={`cursor-pointer transition-all hover:scale-105 ${
              activeTab === 'fans' 
                ? 'bg-gradient-to-br from-green-100 to-green-200 border-green-400 ring-2 ring-green-400' 
                : 'bg-gradient-to-br from-green-50 to-green-100 border-green-200 hover:border-green-300'
            }`}
          >
            <CardContent className="p-3 sm:p-4 text-center">
              <Award className={`w-5 h-5 sm:w-6 sm:h-6 mx-auto mb-1 ${activeTab === 'fans' ? 'text-green-600' : 'text-green-400'}`} />
              <p className="text-xl sm:text-2xl font-bold text-green-900">{stats.totalFans}</p>
              <p className="text-xs text-green-700">Top Fans</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          
          {/* Messages Tab */}
          {activeTab === 'messages' && (
            <div className="space-y-4">
              {/* Filter */}
              <Input
                type="text"
                placeholder="Filtrar por número o nombre de corredor..."
                value={messageFilter}
                onChange={(e) => setMessageFilter(e.target.value)}
                className="w-full"
              />
              
              {/* Messages List */}
              <Card className="shadow-lg">
                <CardHeader className="border-b bg-gradient-to-r from-purple-50 to-pink-50 py-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <MessageCircle className="w-5 h-5 text-purple-600" />
                    Mensajes de Ánimo
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 max-h-[500px] overflow-y-auto">
                  {loadingMessages ? (
                    <div className="text-center py-12">
                      <MessageCircle className="w-12 h-12 text-purple-300 animate-pulse mx-auto mb-4" />
                      <p className="text-muted-foreground">Cargando mensajes...</p>
                    </div>
                  ) : messages.filter(msg => 
                      messageFilter === '' ||
                      msg.athlete_bib.includes(messageFilter) ||
                      msg.athlete_name?.toLowerCase().includes(messageFilter.toLowerCase())
                    ).length === 0 ? (
                    <div className="text-center py-12">
                      <MessageCircle className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                      <p className="text-muted-foreground text-lg">
                        {messageFilter ? 'No hay mensajes para este corredor' : 'Aún no hay mensajes'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {messageFilter ? 'Intenta con otro nombre o número' : '¡Sé el primero en animar a un atleta!'}
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {messages
                        .filter(msg => 
                          messageFilter === '' ||
                          msg.athlete_bib.includes(messageFilter) ||
                          msg.athlete_name?.toLowerCase().includes(messageFilter.toLowerCase())
                        )
                        .map((msg, index) => (
                        <div key={index} className="p-4 hover:bg-purple-50/50 transition-colors">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                              {msg.fan_name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="font-semibold text-foreground">{msg.fan_name}</span>
                                <span className="text-muted-foreground">→</span>
                                <Badge variant="outline" className="text-xs">
                                  #{msg.athlete_bib} {msg.athlete_name}
                                </Badge>
                                {msg.athlete_nacionalidad && (
                                  <span className="text-sm">{getFlag(msg.athlete_nacionalidad)}</span>
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
            </div>
          )}

          {/* Athletes Tab */}
          {activeTab === 'athletes' && (
            <Card className="shadow-lg">
              <CardHeader className="border-b bg-gradient-to-r from-amber-50 to-yellow-50">
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-6 h-6 text-amber-500" />
                  Top Atletas Más Seguidos
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {loadingAthletes ? (
                  <div className="text-center py-12">
                    <Trophy className="w-12 h-12 text-amber-300 animate-pulse mx-auto mb-4" />
                    <p className="text-muted-foreground">Cargando ranking...</p>
                  </div>
                ) : athleteLeaderboard.length === 0 ? (
                  <div className="text-center py-12">
                    <Trophy className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                    <p className="text-muted-foreground">Aún no hay seguidores registrados</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {athleteLeaderboard.map((athlete, index) => (
                      <div key={athlete.athlete_bib} className={`p-4 flex items-center gap-4 ${
                        index === 0 ? 'bg-gradient-to-r from-yellow-50 to-amber-50' :
                        index === 1 ? 'bg-gradient-to-r from-gray-50 to-slate-50' :
                        index === 2 ? 'bg-gradient-to-r from-orange-50 to-amber-50' : ''
                      }`}>
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                          index === 0 ? 'bg-yellow-400 text-yellow-900' :
                          index === 1 ? 'bg-gray-300 text-gray-700' :
                          index === 2 ? 'bg-orange-400 text-orange-900' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-foreground">
                            {athlete.athlete_name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            #{athlete.athlete_bib} • {athlete.nacionalidad}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-purple-600">{athlete.subscriber_count}</p>
                          <p className="text-xs text-muted-foreground">seguidores</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Fans Tab */}
          {activeTab === 'fans' && (
            <Card className="shadow-lg">
              <CardHeader className="border-b bg-gradient-to-r from-green-50 to-emerald-50">
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-6 h-6 text-green-500" />
                  Top Fans
                </CardTitle>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="text-xs px-2 py-1 bg-white rounded-full border">🌱 Novato (1+)</span>
                  <span className="text-xs px-2 py-1 bg-white rounded-full border">📣 Animador (3+)</span>
                  <span className="text-xs px-2 py-1 bg-white rounded-full border">⭐ Súper Fan (5+)</span>
                  <span className="text-xs px-2 py-1 bg-white rounded-full border">🏆 Leyenda (10+)</span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loadingFans ? (
                  <div className="text-center py-12">
                    <Award className="w-12 h-12 text-green-300 animate-pulse mx-auto mb-4" />
                    <p className="text-muted-foreground">Cargando ranking...</p>
                  </div>
                ) : fanLeaderboard.length === 0 ? (
                  <div className="text-center py-12">
                    <Award className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                    <p className="text-muted-foreground">Aún no hay datos</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {fanLeaderboard.map((fan, index) => (
                      <div key={fan.fan_name} className={`p-4 flex items-center gap-4 ${
                        index === 0 ? 'bg-gradient-to-r from-green-50 to-emerald-50' :
                        index === 1 ? 'bg-gradient-to-r from-teal-50 to-cyan-50' :
                        index === 2 ? 'bg-gradient-to-r from-blue-50 to-indigo-50' : ''
                      }`}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                          index === 0 ? 'bg-green-500 text-white' :
                          index === 1 ? 'bg-teal-400 text-white' :
                          index === 2 ? 'bg-blue-400 text-white' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {index + 1}
                        </div>
                        <span className="text-2xl">{fan.badge.emoji}</span>
                        <div className="flex-1">
                          <p className="font-semibold text-foreground">{fan.fan_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {fan.badge.name} • {fan.athletes_cheered} atleta{fan.athletes_cheered !== 1 ? 's' : ''} apoyado{fan.athletes_cheered !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-green-600">{fan.cheer_count}</p>
                          <p className="text-xs text-muted-foreground">mensajes</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Floating Action Button */}
      <Button
        onClick={() => setShowSendModal(true)}
        className="fixed bottom-6 right-6 w-16 h-16 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-2xl"
        data-testid="send-cheer-fab"
      >
        <Send className="w-6 h-6" />
      </Button>

      {/* Send Message Modal */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-purple-600" />
                    Mensaje de Ánimo
                  </h3>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowSendModal(false)} className="p-1">
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Select Athlete */}
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
                  <div className="p-3 bg-purple-50 rounded-lg border border-purple-200 flex items-center justify-between">
                    <div>
                      <p className="font-medium">#{selectedAthlete.bib} {selectedAthlete.nombre} {selectedAthlete.apellidos}</p>
                      <p className="text-sm text-muted-foreground">{selectedAthlete.nacionalidad}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedAthlete(null)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : searchAthlete.length > 0 ? (
                  <div className="max-h-40 overflow-y-auto border rounded-lg">
                    {filteredAthletes.length === 0 ? (
                      <p className="p-3 text-sm text-muted-foreground text-center">No se encontraron corredores</p>
                    ) : (
                      filteredAthletes.slice(0, 10).map(athlete => (
                        <button
                          key={athlete.bib}
                          onClick={() => {
                            setSelectedAthlete(athlete);
                            setSearchAthlete('');
                          }}
                          className="w-full p-2 text-left hover:bg-purple-50 border-b last:border-b-0 text-sm"
                        >
                          <span className="font-mono text-purple-600">#{athlete.bib}</span> {athlete.nombre} {athlete.apellidos}
                          <span className="text-muted-foreground ml-2">{athlete.nacionalidad}</span>
                        </button>
                      ))
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Escribe para buscar un corredor</p>
                )}
              </div>

              {/* Fan Name */}
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
                {fanBadge && (
                  <div className="mt-2 p-2 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{fanBadge.badge.emoji}</span>
                      <div>
                        <p className="text-sm font-medium text-green-800">
                          ¡Hola {fanBadge.badge.name}! ({fanBadge.cheer_count} mensajes)
                        </p>
                        {fanBadge.next_badge && (
                          <p className="text-xs text-green-600">
                            {fanBadge.next_badge.required - fanBadge.cheer_count} más para {fanBadge.next_badge.emoji} {fanBadge.next_badge.name}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Message */}
              <div className="mb-4">
                <label className="text-sm font-medium mb-2 block">Tu mensaje</label>
                <textarea
                  placeholder="¡Escribe tu mensaje de ánimo!"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={280}
                  rows={4}
                  className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                />
                <p className="text-xs text-muted-foreground text-right mt-1">{message.length}/280</p>
              </div>

              {/* Result */}
              {sendResult && (
                <div className={`p-3 rounded-lg mb-4 ${
                  sendResult.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {sendResult.text}
                </div>
              )}

              {/* Submit */}
              <Button
                onClick={handleSendMessage}
                disabled={sending || !selectedAthlete || !fanName.trim() || !message.trim()}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
              >
                <Send className="w-4 h-4 mr-2" />
                {sending ? 'Enviando...' : 'Enviar Mensaje'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getFlag(code) {
  const flags = {
    "DOM": "🇩🇴", "COL": "🇨🇴", "VEN": "🇻🇪", "MEX": "🇲🇽", "USA": "🇺🇸",
    "ARG": "🇦🇷", "BRA": "🇧🇷", "FRA": "🇫🇷", "ESP": "🇪🇸", "GUA": "🇬🇹",
    "HAI": "🇭🇹", "PER": "🇵🇪", "JAP": "🇯🇵"
  };
  return flags[code] || "🏃";
}
