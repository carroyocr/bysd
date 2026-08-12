import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { useRaceConfig } from '../contexts/RaceConfigContext';
import {
  IconAjustes,
  IconAvanzar,
  IconCargando,
  IconCerrar,
  IconPausar,
  IconReproducir,
  IconVolver,
} from '../components/icons';

// Sponsors data
const sponsors = [
  { name: 'AGESS', logo: '/sponsors/agess.png' },
  { name: 'AFP Atlántico', logo: '/sponsors/afp-atlantico.png' },
  { name: 'Águila Logistics', logo: '/sponsors/aguila-logistics.png' },
  { name: 'Banco Atlántico', logo: '/sponsors/banco-atlantico.png' },
  { name: 'Banderas del Mundo', logo: '/sponsors/banderas.png' },
  { name: 'Café Santo Domingo', logo: '/sponsors/cafe-santo-domingo.png' },
  { name: 'Ciclón', logo: '/sponsors/ciclon.png' },
  { name: 'Dra. Vilma Arias', logo: '/sponsors/dra-vilma-arias.png' },
  { name: 'El Catador', logo: '/sponsors/el-catador.png' },
  { name: 'En la Montaña Podcast', logo: '/sponsors/en-la-montana-podcast.png' },
  { name: 'Simpex', logo: '/sponsors/en-simpex.png' },
  { name: 'Fiduciaria Reservas', logo: '/sponsors/fiduciaria-reservas.png' },
  { name: 'Gatorade', logo: '/sponsors/gatorade.png' },
  { name: 'General de Seguros', logo: '/sponsors/general-seguros.png' },
  { name: 'Lupa Graph', logo: '/sponsors/lupa-graph.png' },
  { name: 'Max Sport Uniforms', logo: '/sponsors/max-sport.png' },
  { name: 'Michelob Ultra', logo: '/sponsors/michelob-ultra.png' },
  { name: 'Molino del Sol', logo: '/sponsors/molino-del-sol.png' },
  { name: 'Panaca', logo: '/sponsors/panaca.png' },
  { name: 'Pico Diego de Ocampo Trail', logo: '/sponsors/pico-diego-ocampo.png' },
  { name: 'Senderitmo', logo: '/sponsors/senderitmo.png' },
  { name: 'Suzuki', logo: '/sponsors/suzuki.png' },
  { name: 'Vida Sana Vida Ultra', logo: '/sponsors/vida-sana-ultra.png' },
];

// Esta pantalla se proyecta en el evento, asi que va en negro con el naranja de
// la marca, igual que la cabecera del sitio. El resplandor se dibuja con estilo
// en linea porque son dos degradados radiales, no un color de la paleta.
const FONDO_PRESENTACION = 'min-h-screen bg-[#0C0C0C] text-white flex flex-col relative overflow-hidden';

function ResplandorNaranja() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(60% 60% at 20% 0%, hsl(22 88% 52% / 0.35), transparent 70%)' }}
      />
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(55% 55% at 85% 100%, hsl(25 45% 25% / 0.55), transparent 70%)' }}
      />
    </div>
  );
}

// Barra superior: salir, pausar y ajustes. Se desvanece sola con el raton.
function Controles({ visible, isPlaying, setIsPlaying, setShowSettings }) {
  return (
    <div className={`absolute top-0 left-0 right-0 z-50 p-4 transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="flex justify-between items-center max-w-7xl mx-auto">
        <Link to="/comunidad">
          <Button variant="ghost" className="text-white/70 hover:text-white hover:bg-white/10">
            <IconVolver className="w-5 h-5" />
            Salir
          </Button>
        </Link>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            onClick={() => setIsPlaying(!isPlaying)}
            className="text-white/70 hover:text-white hover:bg-white/10"
            title={isPlaying ? 'Pausar' : 'Reanudar'}
          >
            {isPlaying ? <IconPausar className="w-5 h-5" /> : <IconReproducir className="w-5 h-5" />}
          </Button>
          <Button
            variant="ghost"
            onClick={() => setShowSettings(true)}
            className="text-white/70 hover:text-white hover:bg-white/10"
            title="Configuración"
          >
            <IconAjustes className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// Cabecera de las dos pantallas: logo, nombre y edicion.
function MarcaEvento({ compacta = false, anio }) {
  return (
    <div className="mb-8 text-center">
      <img
        src="/icon-bu.png"
        alt="Backyard Ultra"
        className={`${compacta ? 'w-20 h-20' : 'w-24 h-24'} mx-auto mb-4 rounded-full shadow-strong`}
        onError={(e) => { e.target.style.display = 'none'; }}
      />
      <h1 className={`font-display ${compacta ? 'text-xl md:text-2xl' : 'text-2xl md:text-3xl'} text-white tracking-wider`}>
        BACKYARD ULTRA
      </h1>
      <p className="text-white/50 text-sm tracking-[0.3em] mt-1">
        SANTO DOMINGO {anio}
      </p>
    </div>
  );
}

export default function MensajesPresentacionPage() {
  const { getYear } = useRaceConfig();
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
        // Handle both old array format and new paginated format
        const messagesArray = data.messages || data;
        const sorted = messagesArray.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
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
      <div className={`${FONDO_PRESENTACION} items-center justify-center`}>
        <ResplandorNaranja />
        <div className="relative text-center space-y-4">
          <IconCargando className="w-12 h-12 text-primary animate-spin mx-auto" />
          <p className="text-xl text-white/70">Cargando mensajes...</p>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className={`${FONDO_PRESENTACION} items-center justify-center`}>
        <ResplandorNaranja />
        <div className="relative text-center">
          <p className="font-display text-3xl mb-6">No hay mensajes de ánimo aún</p>
          <Link to="/comunidad">
            <Button variant="outline" className="border-white/30 bg-white/5 text-white hover:bg-white/15 hover:text-white">
              <IconVolver className="w-4 h-4" />
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
      <div className={FONDO_PRESENTACION}>
        <ResplandorNaranja />

        <Controles
          visible={showControls}
          isPlaying={isPlaying}
          setIsPlaying={setIsPlaying}
          setShowSettings={setShowSettings}
        />

        <div className="flex-1 flex flex-col items-center justify-center px-8 py-16 relative z-10">
          <MarcaEvento compacta anio={getYear()} />

          {/* Patrocinador */}
          <div key={currentSponsorIndex} className="animate-sponsorFadeIn">
            <div className="bg-card rounded-3xl p-8 md:p-12 shadow-strong max-w-lg mx-auto">
              <p className="text-center text-primary font-semibold text-xs uppercase tracking-[0.25em] mb-6">
                Patrocinador oficial
              </p>
              <div className="w-full h-40 md:h-56 flex items-center justify-center p-4">
                <img
                  src={currentSponsor.logo}
                  alt={currentSponsor.name}
                  className="max-h-full max-w-full object-contain"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              </div>
              <p className="text-center font-display text-2xl md:text-3xl text-foreground mt-6">
                {currentSponsor.name}
              </p>
            </div>
          </div>

          <p className="text-white/60 text-center mt-8 text-lg">
            Gracias por hacer posible este evento
          </p>
        </div>

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
    <div className={FONDO_PRESENTACION}>
      <ResplandorNaranja />

      <Controles
        visible={showControls}
        isPlaying={isPlaying}
        setIsPlaying={setIsPlaying}
        setShowSettings={setShowSettings}
      />

      <div className="flex-1 flex flex-col items-center justify-center px-8 py-16 relative z-10">
        <MarcaEvento anio={getYear()} />

        {/* Mensaje */}
        <div key={currentMessageIndex} className="w-full max-w-4xl animate-fadeIn">
          <div className="bg-white/[0.06] backdrop-blur-lg rounded-3xl p-8 md:p-12 shadow-strong border border-white/10">
            {/* Atleta */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-3 rounded-full border border-primary/40 bg-primary/15 px-6 py-3">
                <span className="font-display text-3xl md:text-4xl text-primary leading-none">
                  #{currentMessage.athlete_bib}
                </span>
                <span className="text-xl md:text-2xl text-white/90">
                  {currentMessage.athlete_name}
                </span>
              </div>
            </div>

            {/* Texto */}
            <div className="text-center mb-8">
              <p className="text-2xl md:text-4xl lg:text-5xl text-white font-medium leading-relaxed">
                “{currentMessage.message}”
              </p>
            </div>

            {/* Quien lo manda */}
            <div className="text-center">
              <p className="text-xl md:text-2xl text-white/60">
                — {currentMessage.fan_name}
              </p>
            </div>
          </div>
        </div>

        {/* Progreso del ciclo */}
        <div className="mt-8 flex items-center gap-4">
          <span className="text-white/50 text-sm">
            Mensaje {currentMessageIndex + 1} / {messages.length}
          </span>
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  i <= messagesShownInCycle ? 'bg-primary' : 'bg-white/25'
                }`}
              />
            ))}
          </div>
          <span className="inline-flex items-center gap-1 text-white/40 text-xs">
            <IconAvanzar className="w-3.5 h-3.5" />
            Patrocinador
          </span>
        </div>
      </div>

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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card text-card-foreground border border-border rounded-2xl p-6 w-full max-w-md shadow-strong">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-display text-xl text-foreground leading-none">Configuración</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSettings(false)}
            className="text-muted-foreground hover:bg-muted"
          >
            <IconCerrar className="w-5 h-5" />
          </Button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Duración por mensaje: {duration} segundos
            </label>
            <input
              type="range"
              min="3"
              max="15"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>3s</span>
              <span>15s</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Duración pantalla patrocinador: {sponsorScreenDuration} segundos
            </label>
            <input
              type="range"
              min="2"
              max="8"
              value={sponsorScreenDuration}
              onChange={(e) => setSponsorScreenDuration(Number(e.target.value))}
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>2s</span>
              <span>8s</span>
            </div>
          </div>

          <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
            <h4 className="font-medium text-foreground mb-1">Secuencia</h4>
            <p className="text-sm text-muted-foreground">
              3 mensajes → 1 patrocinador → 3 mensajes → 1 patrocinador...
            </p>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
            <h4 className="font-medium text-foreground mb-2">Controles de teclado</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li><kbd className="px-2 py-1 bg-muted rounded text-xs text-foreground">Espacio</kbd> Pausar/Reanudar</li>
              <li><kbd className="px-2 py-1 bg-muted rounded text-xs text-foreground">←</kbd> Mensaje anterior</li>
              <li><kbd className="px-2 py-1 bg-muted rounded text-xs text-foreground">→</kbd> Siguiente</li>
              <li><kbd className="px-2 py-1 bg-muted rounded text-xs text-foreground">Esc</kbd> Cerrar</li>
            </ul>
          </div>
        </div>

        <Button onClick={() => setShowSettings(false)} className="w-full mt-6">
          Cerrar
        </Button>
      </div>
    </div>
  );
}
