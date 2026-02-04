import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  QrCode, Check, X, Loader2, AlertTriangle, Clock, 
  User, Timer, RefreshCw, Home
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
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
  
  // DNF confirmation
  const [showDnfConfirm, setShowDnfConfirm] = useState(false);
  const [dnfInput, setDnfInput] = useState('');
  
  // Timer for countdown
  const [timeRemaining, setTimeRemaining] = useState(0);
  
  // Get scanned_by from localStorage (admin username)
  const scannedBy = localStorage.getItem('admin_username') || 'scanner';
  
  useEffect(() => {
    let isMounted = true;
    let xhr = null;
    
    const loadAthleteData = () => {
      if (!bib) {
        setError('No se proporcionó número de BIB');
        setLoading(false);
        return;
      }
      
      const url = raceCode 
        ? `${API_URL}/api/qr-scan/athlete/${bib}?race_code=${raceCode}`
        : `${API_URL}/api/qr-scan/athlete/${bib}`;
      
      xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      
      xhr.onload = function() {
        if (!isMounted) return;
        
        let data;
        try {
          data = JSON.parse(xhr.responseText);
        } catch (parseErr) {
          setError('Error al procesar respuesta del servidor');
          setLoading(false);
          return;
        }
        
        if (xhr.status >= 400) {
          setError(data.detail || 'Error al cargar datos del atleta');
          setLoading(false);
          return;
        }
        
        setAthlete(data);
        setTimeRemaining(data.time_remaining_seconds || 0);
        
        // Show appropriate warnings
        if (data.already_registered) {
          toast.info('Esta vuelta ya fue registrada anteriormente');
        } else if (data.early_return) {
          toast.warning(`⚠️ Regresó muy temprano (${data.minutes_into_lap} min). Se marcará como DNF.`);
        } else if (data.auto_dnf) {
          toast.warning('Tiempo agotado - El atleta será marcado como DNF');
        }
        
        setLoading(false);
      };
      
      xhr.onerror = function() {
        if (!isMounted) return;
        setError('Error de conexión');
        setLoading(false);
      };
      
      xhr.send();
    };
    
    loadAthleteData();
    
    return () => {
      isMounted = false;
      if (xhr) {
        xhr.abort();
      }
    };
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
  
  const refreshAthleteData = () => {
    if (!bib) return;
    
    setLoading(true);
    setError(null);
    
    const url = raceCode 
      ? `${API_URL}/api/qr-scan/athlete/${bib}?race_code=${raceCode}`
      : `${API_URL}/api/qr-scan/athlete/${bib}`;
    
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    
    xhr.onload = function() {
      let data;
      try {
        data = JSON.parse(xhr.responseText);
      } catch (parseErr) {
        setError('Error al procesar respuesta del servidor');
        setLoading(false);
        return;
      }
      
      if (xhr.status >= 400) {
        setError(data.detail || 'Error al cargar datos del atleta');
        setLoading(false);
        return;
      }
      
      setAthlete(data);
      setTimeRemaining(data.time_remaining_seconds || 0);
      setLoading(false);
    };
    
    xhr.onerror = function() {
      setError('Error de conexión');
      setLoading(false);
    };
    
    xhr.send();
  };
  
  const handleConfirmLap = async () => {
    if (!athlete) return;
    
    setConfirming(true);
    try {
      const response = await fetch(`${API_URL}/api/qr-scan/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bib: athlete.bib,
          confirmed_lap: athlete.lap_to_complete,
          force_dnf: false,
          scanned_by: scannedBy
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        if (data.action === 'lap_not_started') {
          // Lap hasn't started - show warning but don't mark as completed
          toast.warning(data.message);
          return;
        }
        
        setCompleted(true);
        setCompletedAction(data);
        
        if (data.action === 'lap_completed') {
          toast.success(data.message);
        } else if (data.action === 'already_registered') {
          toast.info(data.message);
        } else if (data.action === 'auto_dnf' || data.action === 'dnf_early_return' || data.action === 'dnf_timeout') {
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
    
    // Check DNF confirmation
    if (dnfInput !== 'DNF') {
      toast.error('Debe escribir "DNF" para confirmar el retiro');
      return;
    }
    
    setConfirming(true);
    try {
      const response = await fetch(`${API_URL}/api/qr-scan/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bib: athlete.bib,
          confirmed_lap: athlete.lap_to_complete,
          force_dnf: true,
          dnf_confirmation: 'DNF',
          scanned_by: scannedBy
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
      setShowDnfConfirm(false);
      setDnfInput('');
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

  const handleGoHome = () => {
    navigate('/');
  };
  
  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center safe-area-inset">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-white mx-auto mb-4" />
          <p className="text-gray-300 text-sm">Cargando información del atleta...</p>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-3 safe-area-inset">
        <div className="max-w-md mx-auto pt-12">
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-red-900/50 flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="w-7 h-7 text-red-400" />
              </div>
              <h2 className="text-lg font-bold text-white mb-2">Error</h2>
              <p className="text-gray-400 mb-4 text-sm">{error}</p>
              <div className="space-y-2">
                <Button onClick={handleScanAnother} variant="outline" className="w-full border-gray-600 text-gray-300">
                  <QrCode className="w-4 h-4 mr-2" />
                  Escanear Otro
                </Button>
                <Button onClick={handleGoHome} variant="ghost" className="w-full text-gray-400">
                  <Home className="w-4 h-4 mr-2" />
                  Ir al Inicio
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  
  // Completed state
  if (completed && completedAction) {
    const isSuccess = completedAction.action === 'lap_completed';
    const isAlreadyRegistered = completedAction.action === 'already_registered';
    const isDNF = ['dnf', 'auto_dnf', 'dnf_early_return', 'dnf_timeout'].includes(completedAction.action);
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-3 safe-area-inset">
        <div className="max-w-md mx-auto pt-6">
          <Card className={`border-2 ${
            isSuccess ? 'bg-green-900/30 border-green-500' : 
            isAlreadyRegistered ? 'bg-blue-900/30 border-blue-500' :
            'bg-amber-900/30 border-amber-500'
          }`}>
            <CardContent className="p-5 text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 ${
                isSuccess ? 'bg-green-500' : 
                isAlreadyRegistered ? 'bg-blue-500' :
                'bg-amber-500'
              }`}>
                {isSuccess ? (
                  <Check className="w-8 h-8 text-white" />
                ) : isAlreadyRegistered ? (
                  <Clock className="w-8 h-8 text-white" />
                ) : (
                  <X className="w-8 h-8 text-white" />
                )}
              </div>
              
              <h2 className="text-xl font-bold text-white mb-2">
                {isSuccess ? '¡Vuelta Completada!' : 
                 isAlreadyRegistered ? 'Ya Registrada' :
                 'DNF Registrado'}
              </h2>
              
              <div className="bg-gray-800/50 rounded-lg p-3 mb-3">
                <p className="text-2xl font-bold text-white mb-1">BIB #{completedAction.bib}</p>
                <p className="text-gray-400 text-sm">{completedAction.message}</p>
              </div>
              
              {isSuccess && (
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <p className="text-sm text-gray-400">Vueltas</p>
                    <p className="text-2xl font-bold text-green-400">{completedAction.laps_completed}</p>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-2">
                    <p className="text-xs text-gray-400">Distancia</p>
                    <p className="text-xl font-bold text-green-400">{completedAction.total_km} km</p>
                  </div>
                </div>
              )}
              
              {completedAction.minutes_into_lap !== undefined && isDNF && (
                <div className="bg-gray-800/50 rounded-lg p-2 mb-3">
                  <p className="text-xs text-gray-400">Tiempo en vuelta</p>
                  <p className="text-lg font-bold text-orange-400">{completedAction.minutes_into_lap} minutos</p>
                </div>
              )}
              
              <div className="space-y-2">
                <Button 
                  onClick={handleScanAnother} 
                  size="lg" 
                  className="w-full h-12 bg-white text-gray-900 hover:bg-gray-200"
                >
                  <QrCode className="w-5 h-5 mr-2" />
                  Escanear Siguiente
                </Button>
                <Button 
                  onClick={handleGoHome} 
                  variant="ghost" 
                  className="w-full text-gray-400"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Ir al Inicio
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  
  // Cannot complete - athlete inactive or already registered
  if (athlete && !athlete.can_complete && !athlete.auto_dnf && !athlete.early_return) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-3 safe-area-inset">
        <div className="max-w-md mx-auto pt-6">
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-5 text-center">
              <div className="w-14 h-14 rounded-full bg-gray-700 flex items-center justify-center mx-auto mb-3">
                {athlete.already_registered ? (
                  <Clock className="w-7 h-7 text-blue-400" />
                ) : (
                  <User className="w-7 h-7 text-gray-400" />
                )}
              </div>
              
              <p className="text-3xl font-bold text-white mb-1">BIB #{athlete.bib}</p>
              <h2 className="text-lg font-semibold text-white mb-1">
                {athlete.nombre} {athlete.apellidos}
              </h2>
              
              <div className={`rounded-lg p-3 my-3 ${
                athlete.already_registered 
                  ? 'bg-blue-900/30 border border-blue-500' 
                  : 'bg-amber-900/30 border border-amber-500'
              }`}>
                <p className={`text-sm ${athlete.already_registered ? 'text-blue-400' : 'text-amber-400'}`}>
                  {athlete.message}
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  Estado: <span className="uppercase text-amber-400">{athlete.status}</span>
                </p>
              </div>
              
              <div className="space-y-2">
                <Button onClick={handleScanAnother} variant="outline" className="w-full border-gray-600 text-gray-300">
                  <QrCode className="w-4 h-4 mr-2" />
                  Escanear Otro
                </Button>
                <Button onClick={handleGoHome} variant="ghost" className="w-full text-gray-400">
                  <Home className="w-4 h-4 mr-2" />
                  Ir al Inicio
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  
  // Main confirmation view
  const isUrgent = timeRemaining < 300; // Less than 5 minutes
  const isAutoDNF = athlete?.auto_dnf || athlete?.early_return;
  const isLapNotStarted = athlete?.lap_to_complete > athlete?.current_race_lap;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-3 safe-area-inset">
      <div className="max-w-md mx-auto pt-2">
        {/* Home Button Header */}
        <div className="flex items-center justify-between mb-3">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleGoHome}
            className="text-gray-400 hover:text-white p-2"
          >
            <Home className="w-5 h-5" />
          </Button>
          <span className="text-gray-400 text-sm">Confirmar Vuelta</span>
          <div className="w-9" />
        </div>

        {/* Lap Not Started Warning */}
        {isLapNotStarted && (
          <div className="bg-purple-900/50 border border-purple-500 rounded-lg p-3 mb-3 text-center">
            <Clock className="w-6 h-6 text-purple-400 mx-auto mb-1" />
            <p className="text-purple-400 font-medium text-sm">VUELTA NO INICIADA</p>
            <p className="text-xs text-gray-400 mt-1">
              La vuelta {athlete?.lap_to_complete} aún no ha comenzado
            </p>
            <p className="text-xs text-purple-300 mt-1">
              Vuelta actual: {athlete?.current_race_lap}. Debe esperar.
            </p>
          </div>
        )}

        {/* Timer Banner */}
        {athlete && athlete.can_complete && !isAutoDNF && !isLapNotStarted && (
          <div className={`rounded-lg p-3 mb-3 text-center ${isUrgent ? 'bg-red-900/50 border border-red-500' : 'bg-gray-800 border border-gray-700'}`}>
            <div className="flex items-center justify-center gap-2 mb-1">
              <Timer className={`w-4 h-4 ${isUrgent ? 'text-red-400' : 'text-gray-400'}`} />
              <span className="text-xs text-gray-400">Tiempo restante vuelta {athlete.current_race_lap}</span>
            </div>
            <p className={`text-3xl font-mono font-bold ${isUrgent ? 'text-red-400' : 'text-white'}`}>
              {formatTime(timeRemaining)}
            </p>
            {athlete.minutes_into_lap !== undefined && (
              <p className="text-xs text-gray-500 mt-1">
                {athlete.minutes_into_lap} min transcurridos
              </p>
            )}
          </div>
        )}
        
        {/* Early Return Warning */}
        {athlete?.early_return && (
          <div className="bg-orange-900/50 border border-orange-500 rounded-lg p-3 mb-3 text-center">
            <AlertTriangle className="w-6 h-6 text-orange-400 mx-auto mb-1" />
            <p className="text-orange-400 font-medium text-sm">REGRESÓ MUY TEMPRANO</p>
            <p className="text-xs text-gray-400 mt-1">
              Solo {athlete.minutes_into_lap} min (mínimo 35 min)
            </p>
            <p className="text-xs text-orange-300 mt-1">Se marcará como DNF automáticamente</p>
          </div>
        )}
        
        {/* Auto DNF Warning (timeout) */}
        {athlete?.auto_dnf && !athlete?.early_return && (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-3 mb-3 text-center">
            <AlertTriangle className="w-6 h-6 text-red-400 mx-auto mb-1" />
            <p className="text-red-400 font-medium text-sm">TIEMPO AGOTADO</p>
            <p className="text-xs text-gray-400 mt-1">{athlete.message}</p>
          </div>
        )}
        
        {/* Athlete Card */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-2 px-4 pt-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2 text-base">
                <User className="w-4 h-4" />
                Atleta
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={refreshAthleteData}
                className="text-gray-400 hover:text-white h-8 w-8 p-0"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-3 px-4 pb-4">
            {/* BIB Number - Big */}
            <div className="text-center py-3 bg-gray-900 rounded-lg">
              <p className="text-xs text-gray-400 mb-1">Número de BIB</p>
              <p className="text-5xl font-bold text-white">{athlete?.bib}</p>
            </div>
            
            {/* Athlete Info */}
            <div className="bg-gray-900/50 rounded-lg p-3">
              <h3 className="text-lg font-semibold text-white text-center">
                {athlete?.nombre} {athlete?.apellidos}
              </h3>
            </div>
            
            {/* Lap Info */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gray-900/50 rounded-lg p-2 text-center">
                <p className="text-xs text-gray-400">Completadas</p>
                <p className="text-xl font-bold text-blue-400">{athlete?.laps_completed || 0}</p>
              </div>
              <div className="bg-gray-900/50 rounded-lg p-2 text-center">
                <p className="text-xs text-gray-400">A Registrar</p>
                <p className="text-xl font-bold text-green-400">{athlete?.lap_to_complete || 1}</p>
              </div>
            </div>
            
            {/* Message */}
            {athlete?.message && !isAutoDNF && (
              <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-2">
                <p className="text-xs text-blue-300 text-center">{athlete.message}</p>
              </div>
            )}
            
            {/* DNF Confirmation Modal */}
            {showDnfConfirm && (
              <div className="bg-red-900/30 border border-red-500 rounded-lg p-3">
                <p className="text-red-400 font-medium mb-2 text-center text-sm">
                  ¿Marcar a {athlete?.nombre} como DNF?
                </p>
                <p className="text-xs text-gray-400 mb-2 text-center">
                  Escriba "DNF" para confirmar el retiro
                </p>
                <Input
                  type="text"
                  placeholder="Escriba DNF"
                  value={dnfInput}
                  onChange={(e) => setDnfInput(e.target.value.toUpperCase())}
                  className="bg-gray-900 border-gray-700 text-white text-center mb-2 h-10"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button 
                    onClick={() => { setShowDnfConfirm(false); setDnfInput(''); }}
                    variant="outline"
                    size="sm"
                    className="flex-1 border-gray-600"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleDNF}
                    disabled={confirming || dnfInput !== 'DNF'}
                    size="sm"
                    className="flex-1 bg-red-600 hover:bg-red-700"
                  >
                    {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar DNF'}
                  </Button>
                </div>
              </div>
            )}
            
            {/* Action Buttons */}
            {!showDnfConfirm && (
              <div className="space-y-2 pt-1">
                {athlete?.can_complete && !isAutoDNF ? (
                  <Button 
                    onClick={handleConfirmLap}
                    disabled={confirming}
                    size="lg"
                    className="w-full h-14 text-base bg-green-600 hover:bg-green-700"
                    data-testid="confirm-lap-btn"
                  >
                    {confirming ? (
                      <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Confirmando...</>
                    ) : (
                      <>
                        <Check className="w-5 h-5 mr-2" />
                        Confirmar Vuelta {athlete?.lap_to_complete}
                      </>
                    )}
                  </Button>
                ) : isAutoDNF ? (
                  <Button 
                    onClick={handleConfirmLap}
                    disabled={confirming}
                    size="lg"
                    className="w-full h-14 text-base bg-red-600 hover:bg-red-700"
                  >
                    {confirming ? (
                      <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Procesando...</>
                    ) : (
                      <>
                        <X className="w-5 h-5 mr-2" />
                        Confirmar DNF Automático
                      </>
                    )}
                  </Button>
                ) : null}
                
                {/* Manual DNF Button - always available for active athletes */}
                {athlete?.can_complete && !isAutoDNF && (
                  <Button 
                    onClick={() => setShowDnfConfirm(true)}
                    disabled={confirming}
                    variant="outline"
                    className="w-full h-10 border-red-500 text-red-400 hover:bg-red-900/30 text-sm"
                    data-testid="dnf-btn"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Marcar como DNF
                  </Button>
                )}
                
                <div className="flex gap-2">
                  <Button 
                    onClick={handleScanAnother}
                    variant="outline"
                    className="flex-1 text-gray-400 border-gray-600 text-sm"
                  >
                    <QrCode className="w-4 h-4 mr-1" />
                    Escanear Otro
                  </Button>
                  <Button 
                    onClick={handleGoHome}
                    variant="ghost"
                    className="flex-1 text-gray-400 text-sm"
                  >
                    <Home className="w-4 h-4 mr-1" />
                    Inicio
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
