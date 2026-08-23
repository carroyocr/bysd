import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  QrCode, Check, X, Loader2, AlertTriangle, Clock,
  User, Timer, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { scanHeaders } from '../lib/adminApi';
import { pack, modoActivo, evaluarEscaneo, encolar } from '../lib/scanOffline';
import ScanKeyGate from '../components/ScanKeyGate';
import { getJson, statusLabel } from '../live/liveApi';
import { LiveThemeProvider, useLiveTheme } from '../live/liveTheme';
import TopBar from '../live/components/TopBar';
import Drawer from '../live/components/Drawer';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Cascarón con el diseño de BYSD Live: barra superior con menú lateral de la
 * carrera activa. Envuelve todas las vistas de la confirmación de escaneo.
 */
function ScanShell({ title = 'Confirmar vuelta', children }) {
  const { T } = useLiveTheme();
  const [activeRace, setActiveRace] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    let cancel = false;
    getJson('/api/race-config/active')
      .then((data) => { if (!cancel) setActiveRace(data); })
      .catch(() => {});
    return () => { cancel = true; };
  }, []);

  return (
    <div className={`min-h-[100dvh] flex flex-col ${T.page}`} style={{ WebkitTapHighlightColor: 'transparent' }}>
      <div className="w-full max-w-md mx-auto flex flex-col flex-1 min-h-[100dvh]">
        <TopBar title={title} onMenu={() => setDrawerOpen(true)} raceCode={activeRace?.code} />
        <main className="flex-1 px-4 py-4">{children}</main>
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          raceCode={activeRace?.code}
          raceName={activeRace?.name}
        />
      </div>
    </div>
  );
}

export default function ScanConfirmPage() {
  return (
    <LiveThemeProvider>
      <ScanConfirmInner />
    </LiveThemeProvider>
  );
}

function ScanConfirmInner() {
  const { T } = useLiveTheme();
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
  const [needsKey, setNeedsKey] = useState(false);
  const [keyReloads, setKeyReloads] = useState(0);
  const [showDnfConfirm, setShowDnfConfirm] = useState(false);
  const [dnfInput, setDnfInput] = useState('');
  
  // Timer for countdown
  const [timeRemaining, setTimeRemaining] = useState(0);
  
  // Get scanned_by from localStorage (admin username)
  const scannedBy = localStorage.getItem('admin_username') || 'scanner';

  // Sin señal (o con el modo activado a mano) todo se resuelve con los datos
  // descargados: mismo veredicto, sin esperar a una red que no va a responder.
  const sinLinea = (modoActivo() || !navigator.onLine) && !!pack()
    && (!raceCode || pack().race.code === raceCode.toUpperCase());

  useEffect(() => {
    let isMounted = true;
    let xhr = null;

    const loadAthleteData = () => {
      if (!bib) {
        setError('No se proporcionó número de BIB');
        setLoading(false);
        return;
      }

      if (sinLinea) {
        const res = evaluarEscaneo(bib);
        if (!res || res.error) {
          setError(res?.error || 'No hay datos descargados para esta carrera');
        } else {
          setAthlete(res);
          setTimeRemaining(res.time_remaining_seconds || 0);
          if (res.already_registered) toast.info('Esta vuelta ya fue registrada anteriormente');
          else if (res.early_return) toast.warning(`⚠️ Regresó muy temprano (${res.minutes_into_lap} min). Se marcará como DNF.`);
          else if (res.auto_dnf) toast.warning('Tiempo agotado - El atleta será marcado como DNF');
        }
        setLoading(false);
        return;
      }

      const url = raceCode 
        ? `${API_URL}/api/qr-scan/athlete/${bib}?race_code=${raceCode}`
        : `${API_URL}/api/qr-scan/athlete/${bib}`;
      
      xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      Object.entries(scanHeaders()).forEach(([k, v]) => xhr.setRequestHeader(k, v));
      
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
        
        if (xhr.status === 401 || xhr.status === 403) {
          setNeedsKey(true);
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
  }, [bib, raceCode, keyReloads]);
  
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

    if (sinLinea) {
      const res = evaluarEscaneo(bib);
      if (res && !res.error) {
        setAthlete(res);
        setTimeRemaining(res.time_remaining_seconds || 0);
      }
      return;
    }

    setLoading(true);
    setError(null);

    const url = raceCode 
      ? `${API_URL}/api/qr-scan/athlete/${bib}?race_code=${raceCode}`
      : `${API_URL}/api/qr-scan/athlete/${bib}`;
    
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    Object.entries(scanHeaders()).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    
    xhr.onload = function() {
      let data;
      try {
        data = JSON.parse(xhr.responseText);
      } catch (parseErr) {
        setError('Error al procesar respuesta del servidor');
        setLoading(false);
        return;
      }
      
      if (xhr.status === 401 || xhr.status === 403) {
        setNeedsKey(true);
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
  
  /**
   * Guarda la confirmación en el teléfono en vez de mandarla: es lo que hace
   * el modo fuera de línea, y también la red cuando se cae a mitad de escaneo.
   */
  const confirmarSinLinea = (manualDnf) => {
    const datos = pack();
    const esAutoDnf = !manualDnf && (athlete.auto_dnf || athlete.early_return);
    encolar({
      raceCode: datos.race.code,
      bib: athlete.bib,
      nombre: `${athlete.nombre} ${athlete.apellidos}`.trim(),
      lapNumber: athlete.lap_to_complete || (athlete.laps_completed + 1),
      action: manualDnf ? 'dnf' : 'lap_completed',
      scannedBy,
      autoDnf: esAutoDnf,
    });
    setCompleted(true);
    setCompletedAction({
      offline: true,
      action: manualDnf ? 'dnf' : esAutoDnf ? 'dnf_early_return' : 'lap_completed',
      bib: athlete.bib,
      laps_completed: (manualDnf || esAutoDnf) ? athlete.laps_completed : athlete.lap_to_complete,
      total_km: (manualDnf || esAutoDnf)
        ? undefined
        : Math.round(athlete.lap_to_complete * (datos.race.km_por_vuelta || 6.7) * 10) / 10,
      minutes_into_lap: esAutoDnf ? athlete.minutes_into_lap : undefined,
      message: 'Guardado en el teléfono. Se anotará al sincronizar.',
    });
    toast.success('Escaneo guardado en el teléfono');
    setConfirming(false);
    setShowDnfConfirm(false);
    setDnfInput('');
  };

  const handleConfirmLap = async () => {
    if (!athlete) return;

    if (sinLinea) { confirmarSinLinea(false); return; }

    setConfirming(true);
    try {
      const response = await fetch(`${API_URL}/api/qr-scan/confirm`, {
        method: 'POST',
        headers: scanHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          bib: athlete.bib,
          confirmed_lap: athlete.lap_to_complete,
          force_dnf: false,
          scanned_by: scannedBy,
          // De qué carrera es este QR. Sin esto, la vuelta se anotaba en la
          // carrera publicada, que no tiene por qué ser la que se está
          // corriendo.
          race_code: raceCode || null
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
      } else if (response.status === 401 || response.status === 403) {
        setNeedsKey(true);
      } else {
        toast.error(data.detail || 'Error al confirmar vuelta');
      }
    } catch (err) {
      // La señal se cayó entre cargar al atleta y confirmar: si hay datos
      // descargados de esta carrera, la vuelta se guarda en vez de perderse.
      const datos = pack();
      if (datos && (!raceCode || datos.race.code === raceCode.toUpperCase())) {
        confirmarSinLinea(false);
        toast.warning('Sin señal: el escaneo quedó guardado en el teléfono');
      } else {
        toast.error('Error de conexión');
      }
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

    if (sinLinea) { confirmarSinLinea(true); return; }

    setConfirming(true);
    try {
      const response = await fetch(`${API_URL}/api/qr-scan/confirm`, {
        method: 'POST',
        headers: scanHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          bib: athlete.bib,
          confirmed_lap: athlete.lap_to_complete,
          force_dnf: true,
          dnf_confirmation: 'DNF',
          scanned_by: scannedBy,
          race_code: raceCode || null
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setCompleted(true);
        setCompletedAction(data);
        toast.success(data.message);
      } else if (response.status === 401 || response.status === 403) {
        setNeedsKey(true);
      } else {
        toast.error(data.detail || 'Error al marcar DNF');
      }
    } catch (err) {
      const datos = pack();
      if (datos && (!raceCode || datos.race.code === raceCode.toUpperCase())) {
        confirmarSinLinea(true);
        toast.warning('Sin señal: el retiro quedó guardado en el teléfono');
      } else {
        toast.error('Error de conexión');
      }
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

  // Botón secundario con el estilo de la app (usado en varias vistas)
  const scanAnotherButton = (
    <button
      onClick={handleScanAnother}
      className={`w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold border ${T.divider}`}
    >
      <QrCode className="w-4 h-4 text-[#E77622]" /> Escanear otro
    </button>
  );

  // Sin clave de escaneo válida no se puede consultar ni registrar nada
  if (needsKey) {
    return (
      <ScanShell>
        <ScanKeyGate
          mensaje="Escribe la clave de escaneo de la carrera para registrar vueltas."
          onReady={() => {
            setNeedsKey(false);
            setLoading(true);
            setKeyReloads((n) => n + 1);
          }}
        />
      </ScanShell>
    );
  }

  // Loading state
  if (loading) {
    return (
      <ScanShell>
        <div className={`flex flex-col items-center py-20 ${T.muted}`}>
          <Loader2 className="w-6 h-6 animate-spin mb-3" />
          <p className="text-sm">Cargando información del atleta…</p>
        </div>
      </ScanShell>
    );
  }

  // Error state
  if (error) {
    return (
      <ScanShell>
        <div className={`rounded-2xl px-4 py-6 text-center ${T.card}`}>
          <span className="w-14 h-14 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-7 h-7 text-red-500" />
          </span>
          <h2 className="text-base font-bold mb-1">No se pudo cargar</h2>
          <p className={`text-sm mb-4 ${T.muted}`}>{error}</p>
          {scanAnotherButton}
        </div>
      </ScanShell>
    );
  }
  
  // Completed state
  if (completed && completedAction) {
    const isSuccess = completedAction.action === 'lap_completed';
    const isAlreadyRegistered = completedAction.action === 'already_registered';
    const isDNF = ['dnf', 'auto_dnf', 'dnf_early_return', 'dnf_timeout'].includes(completedAction.action);
    
    const accent = isSuccess
      ? { bg: 'bg-green-500', text: 'text-green-500', ring: 'border-green-500' }
      : isAlreadyRegistered
        ? { bg: 'bg-sky-500', text: 'text-sky-500', ring: 'border-sky-500' }
        : { bg: 'bg-red-500', text: 'text-red-500', ring: 'border-red-500' };

    return (
      <ScanShell title={isSuccess ? 'Vuelta registrada' : 'Resultado del escaneo'}>
        <div className={`rounded-2xl px-4 py-6 text-center border ${accent.ring} ${T.card}`}>
          <span className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 ${accent.bg}`}>
            {isSuccess ? <Check className="w-8 h-8 text-white" />
              : isAlreadyRegistered ? <Clock className="w-8 h-8 text-white" />
                : <X className="w-8 h-8 text-white" />}
          </span>

          <h2 className="text-lg font-extrabold mb-3">
            {isSuccess ? '¡Vuelta completada!' : isAlreadyRegistered ? 'Ya estaba registrada' : 'DNF registrado'}
          </h2>

          <div className={`rounded-xl px-3 py-3 mb-3 ${T.itraBox}`}>
            <p className="text-2xl font-extrabold font-mono">#{completedAction.bib}</p>
            <p className={`text-xs mt-1 ${T.muted}`}>{completedAction.message}</p>
          </div>

          {completedAction.offline && (
            <div className="rounded-xl px-3 py-2.5 mb-3 bg-[#E77622]/10 border border-[#E77622]">
              <p className="text-xs font-bold text-[#E77622]">
                Pendiente de sincronizar: se enviará cuando haya señal, con la hora de este escaneo.
              </p>
            </div>
          )}

          {isSuccess && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className={`rounded-xl px-3 py-3 ${T.itraBox}`}>
                <p className={`text-[10px] tracking-widest uppercase ${T.subtle}`}>Vueltas</p>
                <p className={`text-2xl font-extrabold ${accent.text}`}>{completedAction.laps_completed}</p>
              </div>
              <div className={`rounded-xl px-3 py-3 ${T.itraBox}`}>
                <p className={`text-[10px] tracking-widest uppercase ${T.subtle}`}>Distancia</p>
                <p className={`text-2xl font-extrabold ${accent.text}`}>{completedAction.total_km} km</p>
              </div>
            </div>
          )}

          {completedAction.minutes_into_lap !== undefined && isDNF && (
            <div className={`rounded-xl px-3 py-2.5 mb-3 ${T.itraBox}`}>
              <p className={`text-[10px] tracking-widest uppercase ${T.subtle}`}>Tiempo en vuelta</p>
              <p className="text-lg font-extrabold text-[#E77622]">{completedAction.minutes_into_lap} minutos</p>
            </div>
          )}

          <button
            onClick={handleScanAnother}
            className="w-full h-12 bg-[#E77622] hover:bg-[#d96a1a] text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            <QrCode className="w-5 h-5" /> Escanear siguiente
          </button>
        </div>
      </ScanShell>
    );
  }
  
  // Cannot complete - athlete inactive or already registered
  if (athlete && !athlete.can_complete && !athlete.auto_dnf && !athlete.early_return) {
    return (
      <ScanShell>
        <div className={`rounded-2xl px-4 py-6 text-center ${T.card}`}>
          <span className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 ${T.avatar}`}>
            {athlete.already_registered ? <Clock className="w-7 h-7" /> : <User className="w-7 h-7" />}
          </span>

          <p className="text-3xl font-extrabold font-mono">#{athlete.bib}</p>
          <h2 className="text-base font-bold mt-1">
            {athlete.nombre} {athlete.apellidos}
          </h2>

          <div className={`rounded-xl px-3 py-3 my-4 ${T.itraBox}`}>
            <p className={`text-sm ${athlete.already_registered ? 'text-sky-500' : 'text-yellow-600'}`}>
              {athlete.message}
            </p>
            <p className={`text-xs mt-2 ${T.muted}`}>
              Estado: <span className="uppercase font-bold">{statusLabel(athlete.status)}</span>
            </p>
          </div>

          {scanAnotherButton}
        </div>
      </ScanShell>
    );
  }
  
  // Main confirmation view
  const isUrgent = timeRemaining < 300; // Less than 5 minutes
  const isAutoDNF = athlete?.auto_dnf || athlete?.early_return;
  const isLapNotStarted = athlete?.lap_to_complete > athlete?.current_race_lap;
  
  return (
    <ScanShell>
      {/* Escaneo con los datos del teléfono, sin tocar la red */}
      {sinLinea && (
        <div className="rounded-2xl px-4 py-2.5 mb-4 text-center bg-[#E77622]/10 border border-[#E77622]">
          <p className="text-xs font-bold text-[#E77622]">
            FUERA DE LÍNEA · el escaneo se guardará en este teléfono
          </p>
        </div>
      )}

      {/* Vuelta aún no iniciada */}
      {isLapNotStarted && (
        <div className="rounded-2xl px-4 py-3.5 mb-4 text-center bg-purple-500/10 border border-purple-500">
          <Clock className="w-6 h-6 text-purple-400 mx-auto mb-1" />
          <p className="text-sm font-bold text-purple-400">VUELTA NO INICIADA</p>
          <p className={`text-xs mt-1 ${T.muted}`}>
            La vuelta {athlete?.lap_to_complete} aún no ha comenzado (actual: {athlete?.current_race_lap}). Debe esperar.
          </p>
        </div>
      )}

      {/* Cuenta regresiva de la vuelta */}
      {athlete && athlete.can_complete && !isAutoDNF && !isLapNotStarted && (
        <div className={`rounded-2xl px-4 py-3.5 mb-4 text-center ${isUrgent ? 'bg-red-500/10 border border-red-500' : T.card}`}>
          <p className={`text-[10px] tracking-widest uppercase flex items-center justify-center gap-1.5 ${isUrgent ? 'text-red-500' : T.subtle}`}>
            <Timer className="w-3 h-3" /> Tiempo restante · vuelta {athlete.current_race_lap}
          </p>
          <p className={`text-3xl font-mono font-extrabold mt-1 ${isUrgent ? 'text-red-500' : 'text-[#E77622]'}`}>
            {formatTime(timeRemaining)}
          </p>
          {athlete.minutes_into_lap !== undefined && (
            <p className={`text-xs mt-1 ${T.subtle}`}>{athlete.minutes_into_lap} min transcurridos</p>
          )}
        </div>
      )}

      {/* Regreso demasiado temprano */}
      {athlete?.early_return && (
        <div className="rounded-2xl px-4 py-3.5 mb-4 text-center bg-[#E77622]/10 border border-[#E77622]">
          <AlertTriangle className="w-6 h-6 text-[#E77622] mx-auto mb-1" />
          <p className="text-sm font-bold text-[#E77622]">REGRESÓ MUY TEMPRANO</p>
          <p className={`text-xs mt-1 ${T.muted}`}>
            Solo {athlete.minutes_into_lap} min (mínimo 35 min). Se marcará como DNF automáticamente.
          </p>
        </div>
      )}

      {/* Tiempo agotado */}
      {athlete?.auto_dnf && !athlete?.early_return && (
        <div className="rounded-2xl px-4 py-3.5 mb-4 text-center bg-red-500/10 border border-red-500">
          <AlertTriangle className="w-6 h-6 text-red-500 mx-auto mb-1" />
          <p className="text-sm font-bold text-red-500">TIEMPO AGOTADO</p>
          <p className={`text-xs mt-1 ${T.muted}`}>{athlete.message}</p>
        </div>
      )}

      {/* Ficha del atleta */}
      <div className={`rounded-2xl px-4 py-4 ${T.card}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <User className="w-4 h-4 text-[#E77622]" /> Atleta
          </h3>
          <button onClick={refreshAthleteData} aria-label="Actualizar" className={`w-8 h-8 flex items-center justify-center ${T.muted}`}>
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className={`rounded-xl px-3 py-4 text-center ${T.itraBox}`}>
          <p className={`text-[10px] tracking-widest uppercase ${T.subtle}`}>Número de BIB</p>
          <p className="text-5xl font-extrabold font-mono mt-1">{athlete?.bib}</p>
          <p className="text-base font-bold mt-2">{athlete?.nombre} {athlete?.apellidos}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className={`rounded-xl px-3 py-3 text-center ${T.itraBox}`}>
            <p className={`text-[10px] tracking-widest uppercase ${T.subtle}`}>Completadas</p>
            <p className="text-xl font-extrabold mt-0.5">{athlete?.laps_completed || 0}</p>
          </div>
          <div className={`rounded-xl px-3 py-3 text-center ${T.itraBox}`}>
            <p className={`text-[10px] tracking-widest uppercase ${T.subtle}`}>A registrar</p>
            <p className="text-xl font-extrabold text-[#E77622] mt-0.5">{athlete?.lap_to_complete || 1}</p>
          </div>
        </div>

        {athlete?.message && !isAutoDNF && (
          <p className={`text-xs text-center mt-3 ${T.muted}`}>{athlete.message}</p>
        )}

        {/* Confirmación de DNF manual */}
        {showDnfConfirm && (
          <div className="rounded-xl px-3 py-3 mt-4 bg-red-500/10 border border-red-500">
            <p className="text-sm font-bold text-red-500 text-center mb-1">
              ¿Marcar a {athlete?.nombre} como DNF?
            </p>
            <p className={`text-xs text-center mb-3 ${T.muted}`}>Escribe "DNF" para confirmar el retiro</p>
            <input
              type="text"
              placeholder="Escribe DNF"
              value={dnfInput}
              onChange={(e) => setDnfInput(e.target.value.toUpperCase())}
              autoFocus
              className={`w-full rounded-xl px-3 py-2.5 text-center text-sm font-bold outline-none mb-3 ${T.input}`}
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setShowDnfConfirm(false); setDnfInput(''); }}
                className={`flex-1 rounded-xl py-2.5 text-sm font-bold border ${T.divider}`}
              >
                Cancelar
              </button>
              <button
                onClick={handleDNF}
                disabled={confirming || dnfInput !== 'DNF'}
                className="flex-1 bg-red-600 text-white font-bold rounded-xl py-2.5 text-sm disabled:opacity-40"
              >
                {confirming ? 'Registrando…' : 'Confirmar DNF'}
              </button>
            </div>
          </div>
        )}

        {/* Acciones */}
        {!showDnfConfirm && (
          <div className="space-y-2.5 mt-4">
            {athlete?.can_complete && !isAutoDNF && !isLapNotStarted ? (
              <button
                onClick={handleConfirmLap}
                disabled={confirming}
                data-testid="confirm-lap-btn"
                className="w-full h-14 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {confirming
                  ? <><Loader2 className="w-5 h-5 animate-spin" /> Confirmando…</>
                  : <><Check className="w-5 h-5" /> Confirmar vuelta {athlete?.lap_to_complete}</>}
              </button>
            ) : isLapNotStarted ? (
              <button
                disabled
                className={`w-full h-14 rounded-xl flex items-center justify-center gap-2 text-sm font-bold border ${T.divider} ${T.muted}`}
              >
                <Clock className="w-5 h-5" /> Esperando vuelta {athlete?.lap_to_complete}…
              </button>
            ) : isAutoDNF ? (
              <button
                onClick={handleConfirmLap}
                disabled={confirming}
                className="w-full h-14 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {confirming
                  ? <><Loader2 className="w-5 h-5 animate-spin" /> Procesando…</>
                  : <><X className="w-5 h-5" /> Confirmar DNF automático</>}
              </button>
            ) : null}

            {athlete?.can_complete && !isAutoDNF && !isLapNotStarted && (
              <button
                onClick={() => setShowDnfConfirm(true)}
                disabled={confirming}
                data-testid="dnf-btn"
                className="w-full h-11 rounded-xl flex items-center justify-center gap-2 text-sm font-bold border border-red-500 text-red-500 disabled:opacity-50"
              >
                <X className="w-4 h-4" /> Marcar como DNF
              </button>
            )}

            {scanAnotherButton}
          </div>
        )}
      </div>
    </ScanShell>
  );
}
