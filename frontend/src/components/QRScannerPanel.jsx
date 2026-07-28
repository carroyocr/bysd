import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  QrCode, Camera, Clock, Users, AlertTriangle, 
  Loader2, RefreshCw, ChevronRight, Timer, ExternalLink, KeyRound
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from 'sonner';
import { adminFetch } from '../lib/adminApi';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function QRScannerPanel() {
  const navigate = useNavigate();
  
  const [raceStatus, setRaceStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [manualBib, setManualBib] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [claveEscaneo, setClaveEscaneo] = useState(null);
  const [regenerando, setRegenerando] = useState(false);
  
  // Load race status
  useEffect(() => {
    loadRaceStatus();
    cargarClaveEscaneo();
    const interval = setInterval(loadRaceStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const cargarClaveEscaneo = async () => {
    try {
      const res = await adminFetch(`${API_URL}/api/qr-scan/scan-key`);
      if (res.ok) {
        const data = await res.json();
        setClaveEscaneo(data.scan_key);
      }
    } catch (err) {
      console.error('Error cargando la clave de escaneo:', err);
    }
  };

  const regenerarClave = async () => {
    if (!window.confirm('Al cambiar la clave, los dispositivos que ya la tenían dejarán de poder registrar vueltas. ¿Continuar?')) {
      return;
    }
    setRegenerando(true);
    try {
      const res = await adminFetch(`${API_URL}/api/qr-scan/scan-key/regenerate`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setClaveEscaneo(data.scan_key);
        toast.success('Clave de escaneo actualizada');
      } else {
        toast.error(data.detail || 'No se pudo cambiar la clave');
      }
    } catch (err) {
      toast.error('Error de conexión');
    } finally {
      setRegenerando(false);
    }
  };
  
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
    // Open in new tab for better mobile experience
    window.open(`/scan/confirmar?bib=${manualBib.trim()}`, '_blank');
    setManualBib('');
  };
  
  const openFullScanner = () => {
    window.open('/scan', '_blank');
  };
  
  if (loading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">Cargando estado de carrera...</p>
        </CardContent>
      </Card>
    );
  }
  
  const isUrgent = timeRemaining < 300 && timeRemaining > 0;
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Escáner QR</h2>
          <p className="text-muted-foreground">Registra vueltas escaneando el QR del corredor o ingresando su BIB</p>
        </div>
        <Button onClick={openFullScanner} className="bg-green-600 hover:bg-green-700">
          <ExternalLink className="w-4 h-4 mr-2" />
          Abrir Escáner Completo
        </Button>
      </div>

      {/* Clave de escaneo: se la damos al personal que registra vueltas */}
      <Card className="border-amber-300 bg-amber-50/40">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <KeyRound className="w-5 h-5" />
            Clave de escaneo
          </CardTitle>
          <CardDescription>
            El personal la escribe una vez en su teléfono para poder registrar vueltas.
            Quien haya entrado al panel no necesita escribirla.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <span
            className="font-mono text-3xl tracking-[0.3em] font-bold"
            data-testid="text-scan-key"
          >
            {claveEscaneo || '—'}
          </span>
          <Button variant="outline" onClick={regenerarClave} disabled={regenerando}>
            {regenerando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Cambiar clave
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Race Status */}
        <Card className={`${isUrgent ? 'border-red-400 bg-red-50/50' : ''}`}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Estado de la Carrera
            </CardTitle>
          </CardHeader>
          <CardContent>
            {raceStatus && raceStatus.race_active ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Carrera:</span>
                  <span className="font-medium">{raceStatus.race_name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Estado:</span>
                  <span className={`font-medium ${raceStatus.race_started ? 'text-green-600' : 'text-amber-600'}`}>
                    {raceStatus.race_started ? 'En curso' : 'Por iniciar'}
                  </span>
                </div>
                {raceStatus.race_started && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Vuelta actual:</span>
                      <span className="text-2xl font-bold">{raceStatus.current_lap}</span>
                    </div>
                    <div className={`rounded-lg p-4 text-center ${isUrgent ? 'bg-red-100' : 'bg-gray-100'}`}>
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <Timer className={`w-4 h-4 ${isUrgent ? 'text-red-600' : 'text-gray-600'}`} />
                        <span className={`text-sm ${isUrgent ? 'text-red-600' : 'text-gray-600'}`}>
                          Tiempo restante para vuelta {raceStatus.current_lap}
                        </span>
                      </div>
                      <p className={`text-4xl font-mono font-bold ${isUrgent ? 'text-red-600' : ''}`}>
                        {formatTime(timeRemaining)}
                      </p>
                    </div>
                  </>
                )}
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={loadRaceStatus}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Actualizar Estado
                </Button>
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertTriangle className="w-12 h-12 mx-auto mb-2 text-amber-500" />
                <p className="text-amber-600 font-medium">No hay carrera activa</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick BIB Entry */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5" />
              Búsqueda Rápida por BIB
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleManualEntry} className="space-y-4">
              <div>
                <Label htmlFor="bib">Número de BIB</Label>
                <Input
                  id="bib"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="Ej: 001"
                  value={manualBib}
                  onChange={(e) => setManualBib(e.target.value)}
                  className="text-center text-2xl h-14 mt-2"
                  data-testid="quick-bib-input"
                />
              </div>
              <Button type="submit" className="w-full h-12" data-testid="quick-search-btn">
                Buscar y Confirmar Vuelta
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </form>
            
            <div className="mt-6 pt-6 border-t">
              <p className="text-sm text-muted-foreground text-center mb-4">
                Para escanear con la cámara del celular, usa el escáner completo:
              </p>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={openFullScanner}
              >
                <Camera className="w-4 h-4 mr-2" />
                Abrir Escáner con Cámara
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Instructions */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <h3 className="font-medium text-blue-800 mb-2">Instrucciones de uso:</h3>
          <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
            <li>Ingresa el número de BIB del corredor o escanea su código QR</li>
            <li>Verifica el nombre y la vuelta a completar</li>
            <li>Presiona "Confirmar Vuelta" para registrar</li>
            <li>Si el atleta no puede continuar, presiona "Marcar como DNF"</li>
          </ol>
          <p className="text-sm text-blue-600 mt-3">
            <strong>Nota:</strong> Si el tiempo de la vuelta se agota antes de confirmar, 
            el sistema marcará automáticamente al atleta como DNF.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
