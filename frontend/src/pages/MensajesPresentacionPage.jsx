import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Play, Pause, Settings, X } from 'lucide-react';
import { Button } from '../components/ui/button';

export default function MensajesPresentacionPage() {
  const [messages, setMessages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [duration, setDuration] = useState(8); // seconds per message
  const [showSettings, setShowSettings] = useState(false);

  // Load messages
  const loadMessages = useCallback(async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/cheers?limit=200`);
      if (response.ok) {
        const data = await response.json();
        // Sort by oldest first
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
    // Refresh messages every 2 minutes to get new ones
    const refreshInterval = setInterval(loadMessages, 120000);
    return () => clearInterval(refreshInterval);
  }, [loadMessages]);

  // Auto-advance slideshow
  useEffect(() => {
    if (!isPlaying || messages.length === 0) return;

    const timer = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % messages.length);
    }, duration * 1000);

    return () => clearInterval(timer);
  }, [isPlaying, messages.length, duration]);

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
        setCurrentIndex(prev => (prev + 1) % messages.length);
      } else if (e.key === 'ArrowLeft') {
        setCurrentIndex(prev => (prev - 1 + messages.length) % messages.length);
      } else if (e.key === 'Escape') {
        setShowSettings(false);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [messages.length]);

  const currentMessage = messages[currentIndex];

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-pink-900 flex flex-col relative overflow-hidden">
      {/* Background animation */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-purple-500/20 to-transparent rounded-full animate-pulse"></div>
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-pink-500/20 to-transparent rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      {/* Controls - show on hover/movement */}
      <div className={`absolute top-0 left-0 right-0 z-50 p-4 transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex justify-between items-center max-w-7xl mx-auto">
          <Link to="/comunidad">
            <Button variant="ghost" className="text-white/80 hover:text-white hover:bg-white/10">
              <ArrowLeft className="w-5 h-5 mr-2" />
              Salir
            </Button>
          </Link>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => setIsPlaying(!isPlaying)}
              className="text-white/80 hover:text-white hover:bg-white/10"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowSettings(true)}
              className="text-white/80 hover:text-white hover:bg-white/10"
            >
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
        <div 
          key={currentIndex}
          className="w-full max-w-4xl animate-fadeIn"
        >
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
        <div className="mt-8 flex items-center gap-2">
          <span className="text-white/60 text-sm">
            {currentIndex + 1} / {messages.length}
          </span>
          <div className="w-32 h-1 bg-white/20 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white/80 rounded-full transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / messages.length) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
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

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Controles de teclado</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li><kbd className="px-2 py-1 bg-gray-200 rounded text-xs">Espacio</kbd> Pausar/Reanudar</li>
                  <li><kbd className="px-2 py-1 bg-gray-200 rounded text-xs">←</kbd> Mensaje anterior</li>
                  <li><kbd className="px-2 py-1 bg-gray-200 rounded text-xs">→</kbd> Mensaje siguiente</li>
                  <li><kbd className="px-2 py-1 bg-gray-200 rounded text-xs">Esc</kbd> Cerrar configuración</li>
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
      )}

      {/* CSS for animations */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(20px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.6s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
