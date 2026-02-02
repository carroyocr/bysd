import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  QrCode, Camera, Clock, Users, AlertTriangle, 
  Loader2, RefreshCw, ChevronRight, Timer
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function QRScannerPage() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  const [raceStatus, setRaceStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [manualBib, setManualBib] = useState('');
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  
  // Load race status
  useEffect(() => {
    loadRaceStatus();
    const interval = setInterval(loadRaceStatus, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
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
    setScanning(true);
    setCameraError(null);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        
        // Start scanning for QR codes
        scanQRCode();
      }
    } catch (err) {
      console.error('Camera error:', err);
      setCameraError('No se pudo acceder a la cámara. Usa la entrada manual.');
      setScanning(false);
    }
  };
  
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setScanning(false);
  };
  
  const scanQRCode = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    // Check if BarcodeDetector is available
    if ('BarcodeDetector' in window) {
      const barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code'] });
      
      const detectLoop = async () => {
        if (!scanning) return;
        
        try {
          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0);
            
            const barcodes = await barcodeDetector.detect(canvas);
            
            if (barcodes.length > 0) {
              const qrData = barcodes[0].rawValue;
              handleQRDetected(qrData);
              return;
            }
          }
        } catch (err) {
          console.error('Detection error:', err);
        }
        
        // Continue scanning
        if (scanning) {
          requestAnimationFrame(detectLoop);
        }
      };
      
      detectLoop();
    } else {
      // Fallback message
      setCameraError('Tu navegador no soporta escaneo de QR nativo. Usa la entrada manual.');
      stopCamera();
    }
  };
  
  const handleQRDetected = (data) => {
    stopCamera();
    
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
                <video 
                  ref={videoRef} 
                  className="w-full rounded-lg bg-black"
                  playsInline
                  muted
                />
                <canvas ref={canvasRef} className="hidden" />
                <div className="absolute inset-0 border-2 border-green-400 rounded-lg pointer-events-none">
                  <div className="absolute inset-8 border border-green-400/50 rounded"></div>
                </div>
                <Button 
                  onClick={stopCamera}
                  variant="destructive"
                  className="absolute bottom-4 left-1/2 -translate-x-1/2"
                >
                  Cancelar
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
