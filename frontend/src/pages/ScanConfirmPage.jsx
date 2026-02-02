import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  QrCode, Check, X, Loader2, AlertTriangle, Clock, 
  User, Trophy, Timer, RefreshCw, Camera
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function ScanConfirmPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const bib = searchParams.get('bib');
  const raceCode = searchParams.get('race');
  
  const [loading, setLoading] = useState(true);
  const [athlete, setAthlete] = useState(null);
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [completedAction, setCompletedAction] = useState(null);
  
  // Timer for countdown
  const [timeRemaining, setTimeRemaining] = useState(0);
  
  useEffect(() => {
    if (bib) {
      loadAthleteData();
    } else {
      setError('No se proporcionó número de BIB');
      setLoading(false);
    }
  }, [bib, raceCode]);
  
  // Countdown timer
  useEffect(() => {
    if (timeRemaining > 0 && !completed) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [timeRemaining, completed]);
  
  const loadAthleteData = async () => {
    try {
      const url = raceCode 
        ? `${API_URL}/api/qr-scan/athlete/${bib}?race_code=${raceCode}`
        : `${API_URL}/api/qr-scan/athlete/${bib}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Error al cargar datos del atleta');
      }
      
      const data = await response.json();
      setAthlete(data);
      setTimeRemaining(data.time_remaining_seconds || 0);
      
      // Auto-DNF check
      if (data.auto_dnf) {
        toast.warning('Tiempo agotado - El atleta será marcado como DNF');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleConfirmLap = async () => {
    if (!athlete) return;
    
    setConfirming(true);
    try {
      const response = await fetch(`${API_URL}/api/qr-scan/confirm-lap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bib: athlete.bib,
          confirmed_lap: athlete.lap_to_complete,
          force_dnf: false
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setCompleted(true);
        setCompletedAction(data);
        
        if (data.action === 'lap_completed') {
          toast.success(data.message);
        } else if (data.action === 'auto_dnf') {
          toast.warning(data.message);
        }
      } else {
        toast.error(data.detail || 'Error al confirmar vuelta');
      }
    } catch (err) {
      toast.error('Error de conexión');
    } finally {
      setConfirming(false);
    }
  };
  
  const handleDNF = async () => {
    if (!athlete) return;
    
    if (!window.confirm(`¿Estás seguro de marcar a ${athlete.nombre} ${athlete.apellidos} como DNF?`)) {
      return;
    }
    
    setConfirming(true);
    try {
      const response = await fetch(`${API_URL}/api/qr-scan/confirm-lap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bib: athlete.bib,
          confirmed_lap: athlete.lap_to_complete,
          force_dnf: true
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setCompleted(true);
        setCompletedAction(data);
        toast.success(data.message);
      } else {
        toast.error(data.detail || 'Error al marcar DNF');
      }
    } catch (err) {
      toast.error('Error de conexión');
    } finally {
      setConfirming(false);
    }
  };
  
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const handleScanAnother = () => {
    navigate('/scan');
  };
  
  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-white mx-auto mb-4" />
          <p className="text-gray-300">Cargando información del atleta...</p>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-4">
        <div className="max-w-md mx-auto pt-12">
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-red-900/50 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Error</h2>
              <p className="text-gray-400 mb-6">{error}</p>
              <Button onClick={handleScanAnother} variant="outline" className="border-gray-600 text-gray-300">
                <QrCode className="w-4 h-4 mr-2" />
                Escanear Otro
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  
  // Completed state
  if (completed && completedAction) {
    const isSuccess = completedAction.action === 'lap_completed';
    const isDNF = completedAction.action === 'dnf' || completedAction.action === 'auto_dnf';
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-4">
        <div className="max-w-md mx-auto pt-12">
          <Card className={`border-2 ${isSuccess ? 'bg-green-900/30 border-green-500' : 'bg-amber-900/30 border-amber-500'}`}>
            <CardContent className="p-8 text-center">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${isSuccess ? 'bg-green-500' : 'bg-amber-500'}`}>
                {isSuccess ? (
                  <Check className="w-10 h-10 text-white" />
                ) : (
                  <X className="w-10 h-10 text-white" />
                )}
              </div>
              
              <h2 className="text-2xl font-bold text-white mb-2">
                {isSuccess ? '¡Vuelta Completada!' : 'DNF Registrado'}
              </h2>
              
              <div className="bg-gray-800/50 rounded-lg p-4 mb-4">
                <p className="text-3xl font-bold text-white mb-1">BIB #{completedAction.bib}</p>
                <p className="text-gray-400">{completedAction.message}</p>
              </div>
              
              {isSuccess && (
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <p className="text-sm text-gray-400">Vueltas</p>
                    <p className="text-2xl font-bold text-green-400">{completedAction.laps_completed}</p>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <p className="text-sm text-gray-400">Distancia</p>
                    <p className="text-2xl font-bold text-green-400">{completedAction.total_km} km</p>
                  </div>
                </div>
              )}
              
              <Button 
                onClick={handleScanAnother} 
                size="lg" 
                className="w-full bg-white text-gray-900 hover:bg-gray-200"
              >
                <QrCode className="w-5 h-5 mr-2" />
                Escanear Siguiente Atleta
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  
  // Cannot complete - athlete inactive
  if (athlete && !athlete.can_complete && !athlete.auto_dnf) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-4">
        <div className="max-w-md mx-auto pt-12">
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center mx-auto mb-4">
                <User className="w-8 h-8 text-gray-400" />
              </div>
              
              <p className="text-4xl font-bold text-white mb-2">BIB #{athlete.bib}</p>
              <h2 className="text-xl font-semibold text-white mb-1">
                {athlete.nombre} {athlete.apellidos}
              </h2>
              
              <div className="bg-amber-900/30 border border-amber-500 rounded-lg p-4 my-4">
                <p className="text-amber-400">{athlete.message}</p>
                <p className="text-sm text-gray-400 mt-2">
                  Estado: <span className="uppercase text-amber-400">{athlete.status}</span>
                </p>
              </div>
              
              <Button onClick={handleScanAnother} variant="outline" className="border-gray-600 text-gray-300">
                <QrCode className="w-4 h-4 mr-2" />
                Escanear Otro
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  
  // Main confirmation view
  const isUrgent = timeRemaining < 300; // Less than 5 minutes
  const isAutoNDF = athlete?.auto_dnf;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-4">
      <div className="max-w-md mx-auto pt-8">
        {/* Timer Banner */}
        {athlete && athlete.can_complete && !isAutoNDF && (
          <div className={`rounded-lg p-4 mb-4 text-center ${isUrgent ? 'bg-red-900/50 border border-red-500' : 'bg-gray-800 border border-gray-700'}`}>
            <div className="flex items-center justify-center gap-2 mb-1">
              <Timer className={`w-5 h-5 ${isUrgent ? 'text-red-400' : 'text-gray-400'}`} />
              <span className="text-sm text-gray-400">Tiempo restante vuelta {athlete.current_race_lap}</span>
            </div>
            <p className={`text-4xl font-mono font-bold ${isUrgent ? 'text-red-400' : 'text-white'}`}>
              {formatTime(timeRemaining)}
            </p>
          </div>
        )}
        
        {/* Auto DNF Warning */}
        {isAutoNDF && (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-4 text-center">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-red-400 font-medium">TIEMPO AGOTADO</p>
            <p className="text-sm text-gray-400 mt-1">{athlete.message}</p>
          </div>
        )}
        
        {/* Athlete Card */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <User className="w-5 h-5" />
                Confirmar Vuelta
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={loadAthleteData}
                className="text-gray-400 hover:text-white"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* BIB Number - Big */}
            <div className="text-center py-4 bg-gray-900 rounded-lg">
              <p className="text-sm text-gray-400 mb-1">Número de BIB</p>
              <p className="text-6xl font-bold text-white">{athlete?.bib}</p>
            </div>
            
            {/* Athlete Info */}
            <div className="bg-gray-900/50 rounded-lg p-4">
              <h3 className="text-xl font-semibold text-white text-center">
                {athlete?.nombre} {athlete?.apellidos}
              </h3>
            </div>
            
            {/* Lap Info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-900/50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-400">Vueltas Completadas</p>
                <p className="text-2xl font-bold text-blue-400">{athlete?.laps_completed || 0}</p>
              </div>
              <div className="bg-gray-900/50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-400">Vuelta a Registrar</p>
                <p className="text-2xl font-bold text-green-400">{athlete?.lap_to_complete || 1}</p>
              </div>
            </div>
            
            {/* Message */}
            {athlete?.message && !isAutoNDF && (
              <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-3">
                <p className="text-sm text-blue-300 text-center">{athlete.message}</p>
              </div>
            )}
            
            {/* Action Buttons */}
            <div className="space-y-3 pt-2">
              {athlete?.can_complete && !isAutoNDF ? (
                <Button 
                  onClick={handleConfirmLap}
                  disabled={confirming}
                  size="lg"
                  className="w-full h-16 text-lg bg-green-600 hover:bg-green-700"
                  data-testid="confirm-lap-btn"
                >
                  {confirming ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Confirmando...</>
                  ) : (
                    <>
                      <Check className="w-6 h-6 mr-2" />
                      Confirmar Vuelta {athlete?.lap_to_complete}
                    </>
                  )}
                </Button>
              ) : isAutoNDF ? (
                <Button 
                  onClick={handleDNF}
                  disabled={confirming}
                  size="lg"
                  className="w-full h-16 text-lg bg-red-600 hover:bg-red-700"
                >
                  {confirming ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Procesando...</>
                  ) : (
                    <>
                      <X className="w-6 h-6 mr-2" />
                      Confirmar DNF
                    </>
                  )}
                </Button>
              ) : null}
              
              {/* DNF Button - always available for active athletes */}
              {athlete?.can_complete && !isAutoNDF && (
                <Button 
                  onClick={handleDNF}
                  disabled={confirming}
                  variant="outline"
                  size="lg"
                  className="w-full h-12 border-red-500 text-red-400 hover:bg-red-900/30"
                  data-testid="dnf-btn"
                >
                  <X className="w-5 h-5 mr-2" />
                  Marcar como DNF
                </Button>
              )}
              
              <Button 
                onClick={handleScanAnother}
                variant="ghost"
                className="w-full text-gray-400 hover:text-white"
              >
                <QrCode className="w-4 h-4 mr-2" />
                Escanear Otro Atleta
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
