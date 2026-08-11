import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera, AlertTriangle, Loader2, RefreshCw, ChevronRight, Timer, X, Hash,
} from 'lucide-react';
import { toast } from 'sonner';
import { Html5Qrcode } from 'html5-qrcode';
import { adminToken, scanKey } from '../lib/adminApi';
import ScanKeyGate from '../components/ScanKeyGate';
import { getJson } from '../live/liveApi';
import { LiveThemeProvider, useLiveTheme } from '../live/liveTheme';
import TopBar from '../live/components/TopBar';
import Drawer from '../live/components/Drawer';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Escáner QR del staff con el mismo diseño de BYSD Live: barra superior con
 * menú lateral (de la carrera activa), tarjetas y acentos de la app.
 */
function ScannerInner() {
  const { T } = useLiveTheme();
  const navigate = useNavigate();
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  const [raceStatus, setRaceStatus] = useState(null);
  const [activeRace, setActiveRace] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [manualBib, setManualBib] = useState('');
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  // Sin clave de escaneo (o sesion del panel) no se puede registrar nada:
  // se pide aqui, al entrar, en vez de fallar al confirmar la vuelta.
  const [hasScanAccess, setHasScanAccess] = useState(() => !!adminToken() || !!scanKey());
  const [timeRemaining, setTimeRemaining] = useState(0);

  // Load race status
  useEffect(() => {
    loadRaceStatus();
    const interval = setInterval(loadRaceStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // La carrera activa alimenta el menú lateral y el botón SOS
  useEffect(() => {
    let cancel = false;
    getJson('/api/race-config/active')
      .then((data) => { if (!cancel) setActiveRace(data); })
      .catch(() => {});
    return () => { cancel = true; };
  }, []);

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // Countdown timer
  useEffect(() => {
    if (timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [timeRemaining]);

  const loadRaceStatus = async () => {
    try {
      // La carrera del reloj sale de la URL (?race=CODIGO). Sin ella se
      // usa la publicada, que es lo que se hacia siempre.
      const carrera = new URLSearchParams(window.location.search).get('race');
      const response = await fetch(
        `${API_URL}/api/qr-scan/race-status${carrera ? `?race_code=${carrera}` : ''}`
      );
      const data = await response.json();
      setRaceStatus(data);
      if (data.seconds_remaining) {
        setTimeRemaining(data.seconds_remaining);
      }
    } catch (err) {
      console.error('Error loading race status:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleManualEntry = (e) => {
    e.preventDefault();
    if (!manualBib.trim()) {
      toast.error('Ingresa un número de BIB');
      return;
    }
    navigate(`/scan/confirmar?bib=${manualBib.trim()}`);
  };

  const startCamera = async () => {
    setCameraError(null);
    setScanning(true);

    try {
      // Small delay to ensure DOM is ready
      await new Promise(resolve => setTimeout(resolve, 100));

      const html5QrCode = new Html5Qrcode("qr-reader");
      html5QrCodeRef.current = html5QrCode;

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      };

      await html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          handleQRDetected(decodedText);
        },
        () => {} // Ignore errors during scanning
      );
    } catch (err) {
      console.error('Camera error:', err);
      let errorMessage = 'No se pudo acceder a la cámara.';

      if (err.toString().includes('NotAllowedError')) {
        errorMessage = 'Permiso de cámara denegado. Por favor permite el acceso a la cámara en la configuración de tu dispositivo.';
      } else if (err.toString().includes('NotFoundError')) {
        errorMessage = 'No se encontró ninguna cámara en este dispositivo.';
      } else if (err.toString().includes('NotReadableError')) {
        errorMessage = 'La cámara está siendo usada por otra aplicación.';
      }

      setCameraError(errorMessage);
      setScanning(false);
    }
  };

  const stopCamera = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current = null;
      } catch (err) {
        console.error('Error stopping camera:', err);
      }
    }
    setScanning(false);
  };

  const handleQRDetected = async (data) => {
    await stopCamera();

    // Parse the QR code URL to extract BIB and race code
    try {
      const url = new URL(data);
      const bib = url.searchParams.get('bib');
      const race = url.searchParams.get('race');

      if (bib) {
        navigate(`/scan/confirmar?bib=${bib}${race ? `&race=${race}` : ''}`);
      } else {
        toast.error('QR code inválido');
      }
    } catch (err) {
      // Try direct BIB number
      if (/^\d+$/.test(data)) {
        navigate(`/scan/confirmar?bib=${data}`);
      } else {
        toast.error('QR code no reconocido');
      }
    }
  };

  const raceCode = activeRace?.code;
  const isUrgent = timeRemaining < 300 && timeRemaining > 0;

  return (
    <div className={`min-h-[100dvh] flex flex-col ${T.page}`} style={{ WebkitTapHighlightColor: 'transparent' }}>
      <div className="w-full max-w-md mx-auto flex flex-col flex-1 min-h-[100dvh]">
        <TopBar title="Escáner QR" onMenu={() => setDrawerOpen(true)} raceCode={raceCode} />

        {loading && (
          <div className={`flex justify-center py-20 ${T.muted}`}>
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        )}

        {!loading && !hasScanAccess && (
          <ScanKeyGate onReady={() => setHasScanAccess(true)} />
        )}

        {!loading && hasScanAccess && (
          <main className="flex-1 px-4 py-4">
            {/* Estado de la carrera y cuenta regresiva de la vuelta */}
            {raceStatus && raceStatus.race_active && (
              <div className={`rounded-2xl px-4 py-4 mb-4 ${isUrgent ? 'bg-red-500/10 border border-red-500' : T.card}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-xs ${T.muted}`}>{raceStatus.race_name || 'Carrera activa'}</p>
                    <p className="text-base font-extrabold mt-0.5">
                      {raceStatus.race_started ? `Vuelta ${raceStatus.current_lap}` : 'Por iniciar'}
                    </p>
                  </div>
                  <button onClick={loadRaceStatus} aria-label="Actualizar" className={`w-9 h-9 flex items-center justify-center ${T.muted}`}>
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
                {raceStatus.race_started && (
                  <div className={`rounded-xl px-3 py-3 mt-3 text-center ${isUrgent ? 'bg-red-500/15' : T.itraBox}`}>
                    <p className={`text-[10px] tracking-widest uppercase flex items-center justify-center gap-1.5 ${isUrgent ? 'text-red-500' : T.subtle}`}>
                      <Timer className="w-3 h-3" /> Tiempo restante
                    </p>
                    <p className={`text-3xl font-mono font-extrabold mt-1 ${isUrgent ? 'text-red-500' : 'text-[#E77622]'}`}>
                      {formatTime(timeRemaining)}
                    </p>
                  </div>
                )}
              </div>
            )}

            {raceStatus && !raceStatus.race_active && (
              <div className="rounded-2xl px-4 py-4 mb-4 bg-yellow-500/10 border border-yellow-600 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0" />
                <p className="text-sm text-yellow-600">{raceStatus.message || 'No hay carrera activa'}</p>
              </div>
            )}

            {/* Cámara */}
            <div className={`rounded-2xl px-4 py-4 mb-4 ${T.card}`}>
              <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
                <Camera className="w-4 h-4 text-[#E77622]" /> Escanear QR
              </h3>
              {scanning ? (
                <div className="relative">
                  <div
                    id="qr-reader"
                    ref={scannerRef}
                    className="w-full rounded-xl overflow-hidden"
                    style={{ minHeight: '300px' }}
                  />
                  <button
                    onClick={stopCamera}
                    className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-red-600 text-white text-xs font-bold px-3 py-2 rounded-lg"
                  >
                    <X className="w-3.5 h-3.5" /> Cerrar
                  </button>
                </div>
              ) : (
                <button
                  onClick={startCamera}
                  data-testid="start-scan-btn"
                  className="w-full h-16 bg-[#E77622] hover:bg-[#d96a1a] text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  <Camera className="w-6 h-6" /> Abrir cámara
                </button>
              )}
              {cameraError && (
                <div className="rounded-xl px-3 py-3 mt-3 bg-yellow-500/10 border border-yellow-600">
                  <p className="text-xs text-yellow-600">{cameraError}</p>
                </div>
              )}
            </div>

            {/* Entrada manual */}
            <div className={`rounded-2xl px-4 py-4 mb-4 ${T.card}`}>
              <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
                <Hash className="w-4 h-4 text-[#E77622]" /> Entrada manual
              </h3>
              <form onSubmit={handleManualEntry} className="space-y-3">
                <label className="block">
                  <span className={`block text-[11px] font-bold mb-1 ${T.muted}`}>Número de BIB</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="Ej: 001"
                    value={manualBib}
                    onChange={(e) => setManualBib(e.target.value)}
                    data-testid="manual-bib-input"
                    className={`w-full rounded-xl px-3 py-2.5 text-center text-2xl font-mono outline-none ${T.input}`}
                  />
                </label>
                <button
                  type="submit"
                  data-testid="search-bib-btn"
                  className="w-full h-12 bg-[#E77622] hover:bg-[#d96a1a] text-white font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                >
                  Buscar atleta <ChevronRight className="w-4 h-4" />
                </button>
              </form>
            </div>

            <p className={`text-xs text-center px-2 ${T.muted}`}>
              Al escanear el QR o ingresar el BIB, podrás confirmar la vuelta completada
              o marcar al atleta como DNF.
            </p>
          </main>
        )}

        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          raceCode={raceCode}
          raceName={activeRace?.name}
        />
      </div>
    </div>
  );
}

export default function QRScannerPage() {
  return (
    <LiveThemeProvider>
      <ScannerInner />
    </LiveThemeProvider>
  );
}
