import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  QrCode, Camera, Clock, Users, AlertTriangle, 
  Loader2, RefreshCw, ChevronRight, Timer, X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Html5Qrcode } from 'html5-qrcode';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function QRScannerPage() {
  const navigate = useNavigate();
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);
  
  const [raceStatus, setRaceStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [manualBib, setManualBib] = useState('');
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  
  // Load race status
  useEffect(() => {
    loadRaceStatus();
    const interval = setInterval(loadRaceStatus, 30000);
    return () => clearInterval(interval);
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
      const response = await fetch(`${API_URL}/api/qr-scan/race-status`);
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
        errorMessage = 'Permiso de cámara denegado. Por favor permite el acceso a la cámara en la configuración de tu navegador.';
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
  
  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-white" />
      </div>
    );
  }
  
  const isUrgent = timeRemaining < 300 && timeRemaining > 0;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-4">
      <div className="max-w-md mx-auto pt-8 space-y-4">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white flex items-center justify-center gap-2">
            <QrCode className="w-7 h-7" />
            Control de Vueltas
          </h1>
          <p className="text-gray-400 mt-1">Escanea el QR del corredor o ingresa su BIB</p>
        </div>
        
        {/* Race Status */}
        {raceStatus && raceStatus.race_active && (
          <Card className={`border-2 ${isUrgent ? 'bg-red-900/30 border-red-500' : 'bg-gray-800 border-gray-700'}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm text-gray-400">{raceStatus.race_name || 'Carrera Activa'}</p>
                  <p className="text-lg font-semibold text-white">
                    {raceStatus.race_started ? `Vuelta ${raceStatus.current_lap}` : 'Por Iniciar'}
                  </p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={loadRaceStatus}
                  className="text-gray-400"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
              
              {raceStatus.race_started && (
                <div className={`rounded-lg p-3 text-center ${isUrgent ? 'bg-red-900/50' : 'bg-gray-900'}`}>
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Timer className={`w-4 h-4 ${isUrgent ? 'text-red-400' : 'text-gray-400'}`} />
                    <span className={`text-xs ${isUrgent ? 'text-red-400' : 'text-gray-400'}`}>
                      Tiempo restante
                    </span>
                  </div>
                  <p className={`text-3xl font-mono font-bold ${isUrgent ? 'text-red-400' : 'text-white'}`}>
                    {formatTime(timeRemaining)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
        
        {/* No active race warning */}
        {raceStatus && !raceStatus.race_active && (
          <Card className="bg-amber-900/30 border-amber-500">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-400" />
              <p className="text-amber-400">{raceStatus.message || 'No hay carrera activa'}</p>
            </CardContent>
          </Card>
        )}
        
        {/* Camera Scanner */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <Camera className="w-5 h-5" />
              Escanear QR
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {scanning ? (
              <div className="relative">
                <div 
                  id="qr-reader" 
                  ref={scannerRef}
                  className="w-full rounded-lg overflow-hidden"
                  style={{ minHeight: '300px' }}
                />
                <Button 
                  onClick={stopCamera}
                  variant="destructive"
                  size="sm"
                  className="absolute top-2 right-2 z-10"
                >
                  <X className="w-4 h-4 mr-1" />
                  Cerrar
                </Button>
              </div>
            ) : (
              <Button 
                onClick={startCamera}
                size="lg"
                className="w-full h-16 bg-green-600 hover:bg-green-700"
                data-testid="start-scan-btn"
              >
                <Camera className="w-6 h-6 mr-2" />
                Abrir Cámara
              </Button>
            )}
            
            {cameraError && (
              <div className="bg-amber-900/30 border border-amber-500 rounded-lg p-3">
                <p className="text-sm text-amber-400">{cameraError}</p>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Manual BIB Entry */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <Users className="w-5 h-5" />
              Entrada Manual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleManualEntry} className="space-y-3">
              <div>
                <Label htmlFor="bib" className="text-gray-300">Número de BIB</Label>
                <Input
                  id="bib"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="Ej: 001"
                  value={manualBib}
                  onChange={(e) => setManualBib(e.target.value)}
                  className="bg-gray-900 border-gray-700 text-white text-center text-2xl h-14"
                  data-testid="manual-bib-input"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full h-12"
                data-testid="search-bib-btn"
              >
                Buscar Atleta
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </form>
          </CardContent>
        </Card>
        
        {/* Quick Info */}
        <div className="bg-gray-800/50 rounded-lg p-4 text-center">
          <p className="text-sm text-gray-400">
            Al escanear el QR o ingresar el BIB, podrás confirmar la vuelta completada o marcar al atleta como DNF.
          </p>
        </div>
      </div>
    </div>
  );
}
