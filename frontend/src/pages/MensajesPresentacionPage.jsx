import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Play, Pause, Settings, X } from 'lucide-react';
import { Button } from '../components/ui/button';

// Sponsors data
const sponsors = [
  { name: 'AGESS', logo: '/sponsors/agess.png' },
  { name: 'AFP Atlántico', logo: '/sponsors/afp-atlantico.png' },
  { name: 'Águila Logistics', logo: '/sponsors/aguila-logistics.png' },
  { name: 'Banco Atlántico', logo: '/sponsors/banco-atlantico.png' },
  { name: 'Banderas del Mundo', logo: '/sponsors/banderas.png' },
  { name: 'Ciclón', logo: '/sponsors/ciclon.png' },
  { name: 'Dra. Vilma Arias', logo: '/sponsors/dra-vilma-arias.png' },
  { name: 'En la Montaña Podcast', logo: '/sponsors/en-la-montana-podcast.png' },
  { name: 'En Simpex', logo: '/sponsors/en-simpex.png' },
  { name: 'Gatorade', logo: '/sponsors/gatorade.png' },
  { name: 'General de Seguros', logo: '/sponsors/general-seguros.png' },
  { name: 'Lupa Graph', logo: '/sponsors/lupa-graph.png' },
  { name: 'Max Sport Uniforms', logo: '/sponsors/max-sport.png' },
  { name: 'Molino del Sol', logo: '/sponsors/molino-del-sol.png' },
  { name: 'Pico Diego de Ocampo Trail', logo: '/sponsors/pico-diego-ocampo.png' },
  { name: 'Senderitmo', logo: '/sponsors/senderitmo.png' },
  { name: 'Suzuki', logo: '/sponsors/suzuki.png' },
  { name: 'Vida Sana Vida Ultra', logo: '/sponsors/vida-sana-ultra.png' },
];

export default function MensajesPresentacionPage() {
  const [messages, setMessages] = useState([]);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [duration, setDuration] = useState(8);
  const [showSettings, setShowSettings] = useState(false);
  const [sponsorScreenDuration, setSponsorScreenDuration] = useState(4);
  
  // New state for alternating pattern
  const [displayMode, setDisplayMode] = useState('message'); // 'message' or 'sponsor'
  const [messagesShownInCycle, setMessagesShownInCycle] = useState(0);
  const [currentSponsorIndex, setCurrentSponsorIndex] = useState(0);
  
  const timerRef = useRef(null);

  // Load messages
  const loadMessages = useCallback(async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/cheers?limit=200`);
      if (response.ok) {
        const data = await response.json();
        const sorted = data.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        setMessages(sorted);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMessages();
    const refreshInterval = setInterval(loadMessages, 120000);
    return () => clearInterval(refreshInterval);
  }, [loadMessages]);

  // Main slideshow logic
  useEffect(() => {
    if (!isPlaying || messages.length === 0) return;

    const currentDuration = displayMode === 'message' ? duration : sponsorScreenDuration;

    timerRef.current = setTimeout(() => {
      if (displayMode === 'message') {
        // We just showed a message
        const newMessagesShown = messagesShownInCycle + 1;
        
        if (newMessagesShown >= 3) {
          // After 3 messages, show sponsor
          setDisplayMode('sponsor');
          setMessagesShownInCycle(0);
        } else {
          // Show next message
          setMessagesShownInCycle(newMessagesShown);
          setCurrentMessageIndex(prev => (prev + 1) % messages.length);
        }
      } else {
        // We just showed a sponsor, go back to messages
        setDisplayMode('message');
        setCurrentSponsorIndex(prev => (prev + 1) % sponsors.length);
        setCurrentMessageIndex(prev => (prev + 1) % messages.length);
      }
    }, currentDuration * 1000);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isPlaying, messages.length, duration, sponsorScreenDuration, displayMode, messagesShownInCycle, currentMessageIndex]);

  // Hide controls after inactivity
  useEffect(() => {
    let timeout;
    const handleMouseMove = () => {
      setShowControls(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setShowControls(false), 3000);
    };

    window.addEventListener('mousemove', handleMouseMove);
    timeout = setTimeout(() => setShowControls(false), 3000);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(timeout);
    };
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === ' ' || e.key === 'Space') {
        e.preventDefault();
        setIsPlaying(prev => !prev);
      } else if (e.key === 'ArrowRight') {
        if (displayMode === 'message') {
          const newMessagesShown = messagesShownInCycle + 1;
          if (newMessagesShown >= 3) {
            setDisplayMode('sponsor');
            setMessagesShownInCycle(0);
          } else {
            setMessagesShownInCycle(newMessagesShown);
            setCurrentMessageIndex(prev => (prev + 1) % messages.length);
          }
        } else {
          setDisplayMode('message');
          setCurrentSponsorIndex(prev => (prev + 1) % sponsors.length);
          setCurrentMessageIndex(prev => (prev + 1) % messages.length);
        }
      } else if (e.key === 'ArrowLeft') {
        setCurrentMessageIndex(prev => (prev - 1 + messages.length) % messages.length);
      } else if (e.key === 'Escape') {
        setShowSettings(false);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [messages.length, displayMode, messagesShownInCycle]);

  const currentMessage = messages[currentMessageIndex];
  const currentSponsor = sponsors[currentSponsorIndex];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-pink-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xl">Cargando mensajes...</p>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-pink-900 flex items-center justify-center">
        <div className="text-center text-white">
          <p className="text-2xl mb-4">No hay mensajes de ánimo aún</p>
          <Link to="/comunidad">
            <Button variant="outline" className="border-white text-white hover:bg-white/20">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a Comunidad
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Sponsor dedicated screen
  if (displayMode === 'sponsor' && currentSponsor) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-pink-900 flex flex-col relative overflow-hidden">
        {/* Background animation */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-purple-500/20 to-transparent rounded-full animate-pulse"></div>
          <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-pink-500/20 to-transparent rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
        </div>

        {/* Controls */}
        <div className={`absolute top-0 left-0 right-0 z-50 p-4 transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex justify-between items-center max-w-7xl mx-auto">
            <Link to="/comunidad">
              <Button variant="ghost" className="text-white/80 hover:text-white hover:bg-white/10">
                <ArrowLeft className="w-5 h-5 mr-2" />
                Salir
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => setIsPlaying(!isPlaying)} className="text-white/80 hover:text-white hover:bg-white/10">
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </Button>
              <Button variant="ghost" onClick={() => setShowSettings(true)} className="text-white/80 hover:text-white hover:bg-white/10">
                <Settings className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-8 py-16 relative z-10">
          {/* Logo */}
          <div className="mb-8 text-center">
            <img 
              src="/icon-bu.png" 
              alt="Backyard Ultra" 
              className="w-20 h-20 mx-auto mb-4 rounded-full shadow-2xl"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            <h1 className="text-xl md:text-2xl font-bold text-white/90 tracking-wider">
              BACKYARD ULTRA
            </h1>
            <p className="text-white/60 text-sm tracking-widest">
              SANTO DOMINGO 2026
            </p>
          </div>

          {/* Sponsor Card */}
          <div key={currentSponsorIndex} className="animate-sponsorFadeIn">
            <div className="bg-white/95 backdrop-blur-lg rounded-3xl p-8 md:p-12 shadow-2xl max-w-lg mx-auto">
              <p className="text-center text-purple-600 font-semibold text-sm uppercase tracking-wider mb-6">
                Patrocinador Oficial
              </p>
              <div className="w-full h-40 md:h-56 flex items-center justify-center p-4">
                <img
                  src={currentSponsor.logo}
                  alt={currentSponsor.name}
                  className="max-h-full max-w-full object-contain"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              </div>
              <p className="text-center text-gray-800 font-bold text-xl md:text-2xl mt-6">
                {currentSponsor.name}
              </p>
            </div>
          </div>

          {/* Thank you message */}
          <p className="text-white/70 text-center mt-8 text-lg">
            Gracias por hacer posible este evento
          </p>
        </div>

        {/* Settings Modal */}
        {showSettings && <SettingsModal 
          duration={duration} 
          setDuration={setDuration}
          sponsorScreenDuration={sponsorScreenDuration}
          setSponsorScreenDuration={setSponsorScreenDuration}
          setShowSettings={setShowSettings}
        />}

        <style>{`
          @keyframes sponsorFadeIn {
            from { opacity: 0; transform: scale(0.9); }
            to { opacity: 1; transform: scale(1); }
          }
          .animate-sponsorFadeIn {
            animation: sponsorFadeIn 0.5s ease-out forwards;
          }
        `}</style>
      </div>
    );
  }

  // Message screen
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-pink-900 flex flex-col relative overflow-hidden">
      {/* Background animation */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-purple-500/20 to-transparent rounded-full animate-pulse"></div>
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-pink-500/20 to-transparent rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      {/* Controls */}
      <div className={`absolute top-0 left-0 right-0 z-50 p-4 transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex justify-between items-center max-w-7xl mx-auto">
          <Link to="/comunidad">
            <Button variant="ghost" className="text-white/80 hover:text-white hover:bg-white/10">
              <ArrowLeft className="w-5 h-5 mr-2" />
              Salir
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setIsPlaying(!isPlaying)} className="text-white/80 hover:text-white hover:bg-white/10">
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </Button>
            <Button variant="ghost" onClick={() => setShowSettings(true)} className="text-white/80 hover:text-white hover:bg-white/10">
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-16 relative z-10">
        {/* Logo */}
        <div className="mb-8 text-center">
          <img 
            src="/icon-bu.png" 
            alt="Backyard Ultra" 
            className="w-24 h-24 mx-auto mb-4 rounded-full shadow-2xl"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <h1 className="text-2xl md:text-3xl font-bold text-white/90 tracking-wider">
            BACKYARD ULTRA
          </h1>
          <p className="text-white/60 text-sm tracking-widest">
            SANTO DOMINGO 2026
          </p>
        </div>

        {/* Message Card */}
        <div key={currentMessageIndex} className="w-full max-w-4xl animate-fadeIn">
          <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 md:p-12 shadow-2xl border border-white/20">
            {/* Athlete Info */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-3 bg-white/20 rounded-full px-6 py-3 mb-4">
                <span className="text-3xl md:text-4xl font-bold text-white">
                  #{currentMessage.athlete_bib}
                </span>
                <span className="text-xl md:text-2xl text-white/90">
                  {currentMessage.athlete_name}
                </span>
              </div>
            </div>

            {/* Message */}
            <div className="text-center mb-8">
              <p className="text-2xl md:text-4xl lg:text-5xl text-white font-medium leading-relaxed">
                "{currentMessage.message}"
              </p>
            </div>

            {/* Fan Name */}
            <div className="text-center">
              <p className="text-xl md:text-2xl text-white/70">
                — {currentMessage.fan_name}
              </p>
            </div>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="mt-8 flex items-center gap-4">
          <span className="text-white/60 text-sm">
            Mensaje {currentMessageIndex + 1} / {messages.length}
          </span>
          <div className="flex gap-1">
            {[0, 1, 2].map(i => (
              <div 
                key={i}
                className={`w-3 h-3 rounded-full transition-all ${
                  i <= messagesShownInCycle ? 'bg-white' : 'bg-white/30'
                }`}
              />
            ))}
          </div>
          <span className="text-white/40 text-xs">
            → Patrocinador
          </span>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && <SettingsModal 
        duration={duration} 
        setDuration={setDuration}
        sponsorScreenDuration={sponsorScreenDuration}
        setSponsorScreenDuration={setSponsorScreenDuration}
        setShowSettings={setShowSettings}
      />}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.6s ease-out forwards;
        }
      `}</style>
    </div>
  );
}

// Settings Modal Component
function SettingsModal({ duration, setDuration, sponsorScreenDuration, setSponsorScreenDuration, setShowSettings }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-900">Configuración</h3>
          <Button variant="ghost" size="sm" onClick={() => setShowSettings(false)}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Duración por mensaje: {duration} segundos
            </label>
            <input
              type="range"
              min="3"
              max="15"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full h-2 bg-purple-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>3s</span>
              <span>15s</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Duración pantalla patrocinador: {sponsorScreenDuration} segundos
            </label>
            <input
              type="range"
              min="2"
              max="8"
              value={sponsorScreenDuration}
              onChange={(e) => setSponsorScreenDuration(Number(e.target.value))}
              className="w-full h-2 bg-purple-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>2s</span>
              <span>8s</span>
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-4">
            <h4 className="font-medium text-purple-900 mb-2">Secuencia</h4>
            <p className="text-sm text-purple-700">
              3 mensajes → 1 patrocinador → 3 mensajes → 1 patrocinador...
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">Controles de teclado</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li><kbd className="px-2 py-1 bg-gray-200 rounded text-xs">Espacio</kbd> Pausar/Reanudar</li>
              <li><kbd className="px-2 py-1 bg-gray-200 rounded text-xs">←</kbd> Mensaje anterior</li>
              <li><kbd className="px-2 py-1 bg-gray-200 rounded text-xs">→</kbd> Siguiente</li>
              <li><kbd className="px-2 py-1 bg-gray-200 rounded text-xs">Esc</kbd> Cerrar</li>
            </ul>
          </div>
        </div>

        <Button
          onClick={() => setShowSettings(false)}
          className="w-full mt-6 bg-gradient-to-r from-purple-600 to-pink-600"
        >
          Cerrar
        </Button>
      </div>
    </div>
  );
}
