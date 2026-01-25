import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Save, AlertCircle, CheckCircle2, Search, RotateCw, AlertTriangle, Trash2, Clock, ChevronLeft, Users, ShieldCheck, ShieldOff, Mail, MessageCircle, Edit3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';

// Race start date: January 24, 2026 at 9:00 AM (Dominican Republic time)
const RACE_START_DATE = new Date('2026-01-24T09:00:00-04:00');

export default function RaceControlPanel() {
  const [currentLap, setCurrentLap] = useState(1);
  const [participants, setParticipants] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [message, setMessage] = useState(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState('');
  const [resetting, setResetting] = useState(false);
  const [showResetSubsModal, setShowResetSubsModal] = useState(false);
  const [resetSubsConfirmation, setResetSubsConfirmation] = useState('');
  const [resettingSubs, setResettingSubs] = useState(false);
  const [showResetCheersModal, setShowResetCheersModal] = useState(false);
  const [resetCheersConfirmation, setResetCheersConfirmation] = useState('');
  const [resettingCheers, setResettingCheers] = useState(false);
  const [showAdjustLapsModal, setShowAdjustLapsModal] = useState(false);
  const [adjustLapsParticipant, setAdjustLapsParticipant] = useState(null);
  const [newLapsValue, setNewLapsValue] = useState(0);
  const [adjustingLaps, setAdjustingLaps] = useState(false);
  const [followersCount, setFollowersCount] = useState({});
  const [sendingRunnerEmails, setSendingRunnerEmails] = useState(false);
  const [showSendRunnerEmailsModal, setShowSendRunnerEmailsModal] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [timeValidationEnabled, setTimeValidationEnabled] = useState(() => {
    const saved = localStorage.getItem('race_time_validation');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const navigate = useNavigate();

  // Race starts at 9:00 AM, each lap is 1 hour
  const RACE_START_HOUR = 9;

  // Calculate the time range for a given lap
  const getLapTimeRange = (lap) => {
    const startHour = RACE_START_HOUR + (lap - 1);
    const endHour = startHour;
    
    // Format hours
    const formatHour = (hour) => {
      const h = hour % 24;
      const period = h >= 12 ? 'PM' : 'AM';
      const displayHour = h > 12 ? h - 12 : (h === 0 ? 12 : h);
      return `${displayHour}:00 ${period}`;
    };

    const formatEndHour = (hour) => {
      const h = hour % 24;
      const period = h >= 12 ? 'PM' : 'AM';
      const displayHour = h > 12 ? h - 12 : (h === 0 ? 12 : h);
      return `${displayHour}:59 ${period}`;
    };
    
    return {
      start: formatHour(startHour),
      end: formatEndHour(endHour)
    };
  };

  // Check if lap can be completed based on time
  const canCompleteLap = (lap) => {
    if (!timeValidationEnabled) return true;
    
    // Calculate when lap N ends: race start + N hours
    const lapEndTime = new Date(RACE_START_DATE.getTime() + lap * 60 * 60 * 1000);
    return currentTime >= lapEndTime;
  };

  // Get time remaining until lap can be completed
  const getTimeUntilLapComplete = (lap) => {
    const lapEndTime = new Date(RACE_START_DATE.getTime() + lap * 60 * 60 * 1000);
    const diff = lapEndTime - currentTime;
    
    if (diff <= 0) return null;
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else {
      return `${minutes}m ${seconds}s`;
    }
  };

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Save time validation preference
  useEffect(() => {
    localStorage.setItem('race_time_validation', JSON.stringify(timeValidationEnabled));
  }, [timeValidationEnabled]);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      navigate('/admin/login');
      return;
    }
    loadData();
  }, [navigate]);

  const loadData = async () => {
    const token = localStorage.getItem('admin_token');
    try {
      const [statsRes, participantsRes, followersRes] = await Promise.all([
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/stats`),
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/participants`),
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/followers-count`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const stats = await statsRes.json();
      const participantsData = await participantsRes.json();
      
      if (followersRes.ok) {
        const followersData = await followersRes.json();
        setFollowersCount(followersData);
      }

      setCurrentLap(stats.current_lap);
      setParticipants(participantsData);
      setLoading(false);
    } catch (err) {
      console.error('Error loading data:', err);
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_username');
    navigate('/admin/login');
  };

  const handleSaveCurrentLap = async () => {
    const token = localStorage.getItem('admin_token');
    setSaving(true);
    
    try {
      // First, complete the lap for all active participants
      const completeLapRes = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/complete-lap-all-active`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!completeLapRes.ok) throw new Error('Error al completar vuelta');
      
      const completeLapData = await completeLapRes.json();
      
      // Update current lap to the new value
      setCurrentLap(completeLapData.new_lap);
      
      showMessage(
        `Vuelta ${completeLapData.previous_lap} completada. ${completeLapData.updated_count} atletas activos registrados. Vuelta en curso: ${completeLapData.new_lap}`,
        'success'
      );
      
      // Reload data to show updated stats
      await loadData();
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRevertLap = async () => {
    if (currentLap <= 1) {
      showMessage('No se puede retroceder más. Ya está en la vuelta 1.', 'error');
      return;
    }

    const confirmRevert = window.confirm(
      `⚠️ ADVERTENCIA: ¿Está seguro de retroceder a la vuelta ${currentLap - 1}?\n\n` +
      `Esto reducirá en 1 las vueltas completadas de todos los atletas activos.\n\n` +
      `Use esto SOLO para corregir errores si avanzó la vuelta por equivocación.`
    );

    if (!confirmRevert) return;

    const token = localStorage.getItem('admin_token');
    setReverting(true);

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/revert-lap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Error al retroceder vuelta');
      }

      const data = await response.json();
      setCurrentLap(data.new_lap);
      showMessage(data.message, 'success');
      await loadData();
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setReverting(false);
    }
  };

  const handleToggleRetired = async (participant) => {
    const token = localStorage.getItem('admin_token');
    setSaving(true);

    try {
      if (participant.status === 'active') {
        // Marking as retired
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/mark-retired`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ 
            bib: participant.bib,
            retired_at_lap: currentLap 
          })
        });

        if (!response.ok) throw new Error('Error al marcar como DNF');
        const data = await response.json();
        showMessage(data.message, 'success');
      } else {
        // Reactivating - show warning
        const confirmReactivate = window.confirm(
          `⚠️ ADVERTENCIA: ¿Está seguro de reactivar al participante ${participant.bib}?\n\n` +
          `Esto es SOLO para corregir errores. El atleta fue marcado como ${participant.status === 'dns' ? 'DNS' : `DNF en la vuelta ${participant.retired_at_lap}`}.\n\n` +
          `Los atletas DNF/DNS NO deben volver a competir según las reglas del Backyard Ultra.`
        );

        if (!confirmReactivate) {
          setSaving(false);
          return;
        }

        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/reactivate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ bib: participant.bib })
        });

        if (!response.ok) throw new Error('Error al reactivar');
        const data = await response.json();
        showMessage(data.message, 'success');
      }

      await loadData();
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkDNS = async (participant) => {
    const token = localStorage.getItem('admin_token');
    
    const confirmDNS = window.confirm(
      `¿Está seguro de marcar al participante ${participant.bib} como DNS (No se presentó)?\n\n` +
      `El atleta quedará con 0 vueltas y 0 kilómetros.`
    );

    if (!confirmDNS) return;

    setSaving(true);

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/mark-dns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ bib: participant.bib })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Error al marcar como DNS');
      }

      const data = await response.json();
      showMessage(data.message, 'success');
      await loadData();
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteLap = async (participant) => {
    const token = localStorage.getItem('admin_token');
    setSaving(true);

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/complete-lap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          bib: participant.bib,
          lap_number: currentLap
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Error al registrar vuelta');
      }

      showMessage(`Vuelta ${currentLap} registrada para ${participant.bib}`, 'success');
      await loadData();
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleResetDatabase = async () => {
    if (resetConfirmation !== 'REINICIO') {
      showMessage('Debe escribir REINICIO para confirmar', 'error');
      return;
    }

    const token = localStorage.getItem('admin_token');
    setResetting(true);

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/reset-database`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ confirmation: resetConfirmation })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Error al reiniciar base de datos');
      }

      const data = await response.json();
      showMessage(data.message, 'success');
      setShowResetModal(false);
      setResetConfirmation('');
      
      // Reload data
      await loadData();
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setResetting(false);
    }
  };

  const handleResetSubscriptions = async () => {
    if (resetSubsConfirmation !== 'SUSCRIPCIONES') {
      showMessage('Debe escribir SUSCRIPCIONES para confirmar', 'error');
      return;
    }

    const token = localStorage.getItem('admin_token');
    setResettingSubs(true);

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/reset-subscriptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ confirmation: resetSubsConfirmation })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Error al reiniciar suscripciones');
      }

      const data = await response.json();
      showMessage(data.message, 'success');
      setShowResetSubsModal(false);
      setResetSubsConfirmation('');
      
      // Reload data to update followers count
      await loadData();
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setResettingSubs(false);
    }
  };

  const handleResetCheers = async () => {
    if (resetCheersConfirmation !== 'MENSAJES') {
      showMessage('Debe escribir MENSAJES para confirmar', 'error');
      return;
    }

    const token = localStorage.getItem('admin_token');
    setResettingCheers(true);

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/reset-cheers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ confirmation: resetCheersConfirmation })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Error al reiniciar mensajes');
      }

      const data = await response.json();
      showMessage(data.message, 'success');
      setShowResetCheersModal(false);
      setResetCheersConfirmation('');
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setResettingCheers(false);
    }
  };

  const handleSendRunnerEmails = async () => {
    const token = localStorage.getItem('admin_token');
    setSendingRunnerEmails(true);

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/send-runner-emails`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Error al enviar correos');
      }

      const data = await response.json();
      showMessage(`Correos enviados: ${data.emails_sent} exitosos, ${data.emails_failed} fallidos, ${data.no_email} sin email`, 'success');
      setShowSendRunnerEmailsModal(false);
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setSendingRunnerEmails(false);
    }
  };

  const openAdjustLapsModal = (participant) => {
    setAdjustLapsParticipant(participant);
    setNewLapsValue(participant.laps_completed || 0);
    setShowAdjustLapsModal(true);
  };

  const handleAdjustLaps = async () => {
    if (!adjustLapsParticipant) return;
    
    const token = localStorage.getItem('admin_token');
    setAdjustingLaps(true);

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/adjust-laps`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          bib: adjustLapsParticipant.bib,
          new_laps: parseInt(newLapsValue, 10)
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Error al ajustar vueltas');
      }

      const data = await response.json();
      showMessage(data.message, 'success');
      setShowAdjustLapsModal(false);
      setAdjustLapsParticipant(null);
      setNewLapsValue(0);
      
      await loadData();
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setAdjustingLaps(false);
    }
  };

  const filteredParticipants = participants.filter(p => {
    const search = searchTerm.toLowerCase();
    const matchesSearch = (
      p.bib.toLowerCase().includes(search) ||
      p.nombre.toLowerCase().includes(search) ||
      p.apellidos.toLowerCase().includes(search)
    );
    const matchesStatus = filterStatus === 'all' || p.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RotateCw className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando panel de control...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Panel de Control de Carrera</h1>
            <p className="text-muted-foreground mt-1">Backyard Ultra Santo Domingo 2026</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => setShowSendRunnerEmailsModal(true)}
              variant="outline"
              className="border-green-300 text-green-600 hover:bg-green-50"
            >
              <Mail className="w-4 h-4 mr-2" />
              Enviar Correos Corredores
            </Button>
            <Button
              onClick={() => setShowResetSubsModal(true)}
              variant="outline"
              className="border-pink-300 text-pink-600 hover:bg-pink-50"
            >
              <Mail className="w-4 h-4 mr-2" />
              Reiniciar Suscripciones
            </Button>
            <Button
              onClick={() => setShowResetCheersModal(true)}
              variant="outline"
              className="border-purple-300 text-purple-600 hover:bg-purple-50"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Borrar Mensajes
            </Button>
            <Button
              onClick={() => setShowResetModal(true)}
              variant="outline"
              className="border-orange-300 text-orange-600 hover:bg-orange-50"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Reiniciar BD
            </Button>
            <Button
              onClick={handleLogout}
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar Sesión
            </Button>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`mb-6 flex items-center gap-2 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <p className="text-sm font-medium">{message.text}</p>
          </div>
        )}

        {/* Current Lap Control */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <CardTitle>Control de Vuelta</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Al guardar, se registrará la vuelta actual para todos los atletas activos y se incrementará a la siguiente vuelta
                </p>
              </div>
              {/* Time Validation Toggle */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTimeValidationEnabled(!timeValidationEnabled)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                    timeValidationEnabled
                      ? 'bg-green-50 border-green-300 text-green-700'
                      : 'bg-gray-50 border-gray-300 text-gray-600'
                  }`}
                >
                  {timeValidationEnabled ? (
                    <ShieldCheck className="w-4 h-4" />
                  ) : (
                    <ShieldOff className="w-4 h-4" />
                  )}
                  <span className="text-sm font-medium">
                    {timeValidationEnabled ? 'Validación Activa' : 'Validación Inactiva'}
                  </span>
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-6">
              {/* Time Validation Warning/Info */}
              {timeValidationEnabled && !canCompleteLap(currentLap) && (
                <div className="bg-amber-50 border border-amber-300 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-800">Vuelta aún en curso</p>
                      <p className="text-sm text-amber-700 mt-1">
                        No puedes registrar la vuelta {currentLap} hasta que finalice.
                      </p>
                      <p className="text-lg font-bold text-amber-800 mt-2">
                        Tiempo restante: {getTimeUntilLapComplete(currentLap)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {timeValidationEnabled && canCompleteLap(currentLap) && (
                <div className="bg-green-50 border border-green-300 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="font-semibold text-green-800">Vuelta {currentLap} finalizada</p>
                      <p className="text-sm text-green-700">Puedes registrar la vuelta completada.</p>
                    </div>
                  </div>
                </div>
              )}

              {!timeValidationEnabled && (
                <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <ShieldOff className="w-5 h-5 text-gray-500" />
                    <div>
                      <p className="font-semibold text-gray-700">Validación de tiempo desactivada</p>
                      <p className="text-sm text-gray-600">Puedes registrar vueltas sin restricción de horario.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Lap Number and Time Display */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Vuelta en Curso
                  </label>
                  <div className="text-center p-6 bg-muted/30 rounded-lg border-2 border-primary/20 flex-1 flex items-center justify-center">
                    <p className="text-5xl font-bold text-primary">{currentLap}</p>
                  </div>
                </div>
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-foreground mb-2 block flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Horario de la Vuelta {currentLap}
                  </label>
                  <div className="text-center p-6 bg-blue-50 rounded-lg border-2 border-blue-200 flex-1 flex flex-col justify-center">
                    <div className="flex items-center justify-center gap-3">
                      <div className="text-center">
                        <p className="text-xs text-blue-600 font-medium">INICIO</p>
                        <p className="text-2xl font-bold text-blue-700">{getLapTimeRange(currentLap).start}</p>
                      </div>
                      <div className="text-2xl text-blue-400">→</div>
                      <div className="text-center">
                        <p className="text-xs text-blue-600 font-medium">FIN</p>
                        <p className="text-2xl font-bold text-blue-700">{getLapTimeRange(currentLap).end}</p>
                      </div>
                    </div>
                    <p className="text-xs text-blue-500 mt-2">
                      La carrera inicia a las 9:00 AM • Cada vuelta dura 1 hora
                    </p>
                    <p className="text-xs text-blue-600 mt-1 font-medium">
                      Hora actual: {currentTime.toLocaleTimeString('es-DO')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={handleRevertLap}
                  disabled={reverting || currentLap <= 1}
                  variant="outline"
                  className="border-amber-400 text-amber-700 hover:bg-amber-50 flex-1 sm:flex-none"
                >
                  <ChevronLeft className="w-5 h-5 mr-2" />
                  {reverting ? 'Retrocediendo...' : 'Retroceder Vuelta'}
                </Button>
                <Button
                  onClick={handleSaveCurrentLap}
                  disabled={saving || (timeValidationEnabled && !canCompleteLap(currentLap))}
                  className={`h-12 px-8 flex-1 ${
                    timeValidationEnabled && !canCompleteLap(currentLap)
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-primary hover:bg-accent'
                  } text-primary-foreground`}
                >
                  <Save className="w-5 h-5 mr-2" />
                  {saving ? 'Guardando...' : 'Registrar Vuelta Completada para Atletas Activos'}
                </Button>
              </div>

              {/* Next Lap Preview */}
              {currentLap < 24 && (
                <div className="text-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Próxima vuelta ({currentLap + 1}):</span>{' '}
                    {getLapTimeRange(currentLap + 1).start} - {getLapTimeRange(currentLap + 1).end}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Participants Control */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <CardTitle>Control de Participantes</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {filteredParticipants.length} participantes
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <div className="relative flex-1 md:w-80">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Buscar por BIB, nombre o apellidos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-4 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="all">Todos ({participants.length})</option>
                  <option value="active">Activos ({participants.filter(p => p.status === 'active').length})</option>
                  <option value="retired">DNF ({participants.filter(p => p.status === 'retired').length})</option>
                  <option value="dns">DNS ({participants.filter(p => p.status === 'dns').length})</option>
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-semibold text-sm">BIB</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm">Nombre</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm">Vueltas</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm">Seguidores</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm">Estado</th>
                    <th className="text-center py-3 px-4 font-semibold text-sm">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredParticipants.map((participant) => (
                    <tr
                      key={participant.bib}
                      className="border-b border-border last:border-0 hover:bg-muted/30"
                    >
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="font-mono">
                          {participant.bib}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-foreground">{participant.nombre}</p>
                          <p className="text-sm text-muted-foreground">{participant.apellidos}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-lg">{participant.laps_completed}</span>
                      </td>
                      <td className="py-3 px-4">
                        {followersCount[participant.bib] ? (
                          <Badge variant="secondary" className="bg-pink-100 text-pink-700 flex items-center gap-1 w-fit">
                            <Users className="w-3 h-3" />
                            {followersCount[participant.bib]}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">0</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={participant.status === 'active' ? 'default' : 'secondary'}
                          className={
                            participant.status === 'active' 
                              ? 'bg-green-500' 
                              : participant.status === 'dns'
                              ? 'bg-gray-500'
                              : 'bg-red-500'
                          }
                        >
                          {participant.status === 'active' 
                            ? 'Activo' 
                            : participant.status === 'dns'
                            ? 'DNS'
                            : 'DNF'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-center gap-2 flex-wrap">
                          {participant.status === 'active' && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleCompleteLap(participant)}
                                disabled={saving}
                                className="bg-primary hover:bg-accent"
                              >
                                Registrar Vuelta
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleToggleRetired(participant)}
                                disabled={saving}
                                className="border-red-500 text-red-600"
                              >
                                Marcar DNF
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleMarkDNS(participant)}
                                disabled={saving}
                                className="border-gray-500 text-gray-600"
                              >
                                Marcar DNS
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openAdjustLapsModal(participant)}
                                disabled={saving}
                                className="border-blue-500 text-blue-600"
                                title="Ajustar vueltas manualmente"
                              >
                                <Edit3 className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          {(participant.status === 'retired' || participant.status === 'dns') && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleToggleRetired(participant)}
                                disabled={saving}
                                className="border-green-500 text-green-600"
                              >
                                Reactivar
                              </Button>
                              {participant.status === 'retired' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openAdjustLapsModal(participant)}
                                  disabled={saving}
                                  className="border-blue-500 text-blue-600"
                                  title="Ajustar vueltas manualmente"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reset Database Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-lg border-orange-300 shadow-strong">
            <CardHeader className="border-b border-orange-200 bg-orange-50/50">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <CardTitle className="text-xl text-orange-900">Reiniciar Base de Datos</CardTitle>
                  <p className="text-sm text-orange-700 mt-1">Esta acción es irreversible</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <h3 className="font-semibold text-orange-900 mb-2">⚠️ Advertencia</h3>
                  <ul className="text-sm text-orange-800 space-y-1">
                    <li>• Se eliminarán todos los datos de participantes</li>
                    <li>• Se borrará el historial de vueltas</li>
                    <li>• La vuelta actual volverá a 1</li>
                    <li>• Todos los atletas volverán a estado inicial (0 vueltas)</li>
                  </ul>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Para confirmar, escriba <span className="font-bold text-orange-600">REINICIO</span>
                  </label>
                  <Input
                    type="text"
                    value={resetConfirmation}
                    onChange={(e) => setResetConfirmation(e.target.value)}
                    placeholder="Escriba REINICIO"
                    className="text-center font-mono text-lg"
                    autoFocus
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={() => {
                      setShowResetModal(false);
                      setResetConfirmation('');
                    }}
                    variant="outline"
                    className="flex-1"
                    disabled={resetting}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleResetDatabase}
                    disabled={resetConfirmation !== 'REINICIO' || resetting}
                    className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    {resetting ? (
                      <>
                        <RotateCw className="w-4 h-4 mr-2 animate-spin" />
                        Reiniciando...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Confirmar Reinicio
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Reset Subscriptions Modal */}
      {showResetSubsModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-lg border-pink-300 shadow-strong">
            <CardHeader className="border-b border-pink-200 bg-pink-50/50">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-pink-100 flex items-center justify-center">
                  <Mail className="w-6 h-6 text-pink-600" />
                </div>
                <div>
                  <CardTitle className="text-xl text-pink-900">Reiniciar Suscripciones</CardTitle>
                  <p className="text-sm text-pink-700 mt-1">Esta acción es irreversible</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
                  <h3 className="font-semibold text-pink-900 mb-2">⚠️ Advertencia</h3>
                  <ul className="text-sm text-pink-800 space-y-1">
                    <li>• Se eliminarán todas las suscripciones de correo</li>
                    <li>• Los usuarios deberán volver a suscribirse</li>
                    <li>• Se perderán los datos de seguidores de atletas</li>
                    <li>• No se enviarán más notificaciones hasta nueva suscripción</li>
                  </ul>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Para confirmar, escriba <span className="font-bold text-pink-600">SUSCRIPCIONES</span>
                  </label>
                  <Input
                    type="text"
                    value={resetSubsConfirmation}
                    onChange={(e) => setResetSubsConfirmation(e.target.value)}
                    placeholder="Escriba SUSCRIPCIONES"
                    className="text-center font-mono text-lg"
                    autoFocus
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={() => {
                      setShowResetSubsModal(false);
                      setResetSubsConfirmation('');
                    }}
                    variant="outline"
                    className="flex-1"
                    disabled={resettingSubs}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleResetSubscriptions}
                    disabled={resetSubsConfirmation !== 'SUSCRIPCIONES' || resettingSubs}
                    className="flex-1 bg-pink-600 hover:bg-pink-700 text-white"
                  >
                    {resettingSubs ? (
                      <>
                        <RotateCw className="w-4 h-4 mr-2 animate-spin" />
                        Reiniciando...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Confirmar Reinicio
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Reset Cheers Modal */}
      {showResetCheersModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-lg border-purple-300 shadow-strong">
            <CardHeader className="border-b border-purple-200 bg-purple-50/50">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                  <MessageCircle className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <CardTitle className="text-xl text-purple-900">Borrar Mensajes de Ánimo</CardTitle>
                  <p className="text-sm text-purple-700 mt-1">Esta acción es irreversible</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h3 className="font-semibold text-purple-900 mb-2">⚠️ Advertencia</h3>
                  <ul className="text-sm text-purple-800 space-y-1">
                    <li>• Se eliminarán todos los mensajes de ánimo enviados</li>
                    <li>• Se reiniciará el ranking de fans</li>
                    <li>• Se perderán los badges de los fans</li>
                    <li>• El modo presentación no mostrará mensajes</li>
                  </ul>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Para confirmar, escriba <span className="font-bold text-purple-600">MENSAJES</span>
                  </label>
                  <Input
                    type="text"
                    value={resetCheersConfirmation}
                    onChange={(e) => setResetCheersConfirmation(e.target.value)}
                    placeholder="Escriba MENSAJES"
                    className="text-center font-mono text-lg"
                    autoFocus
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={() => {
                      setShowResetCheersModal(false);
                      setResetCheersConfirmation('');
                    }}
                    variant="outline"
                    className="flex-1"
                    disabled={resettingCheers}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleResetCheers}
                    disabled={resetCheersConfirmation !== 'MENSAJES' || resettingCheers}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    {resettingCheers ? (
                      <>
                        <RotateCw className="w-4 h-4 mr-2 animate-spin" />
                        Borrando...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Confirmar Borrado
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Adjust Laps Modal */}
      {showAdjustLapsModal && adjustLapsParticipant && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md border-blue-300 shadow-strong">
            <CardHeader className="border-b border-blue-200 bg-blue-50/50">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <Edit3 className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-xl text-blue-900">Ajustar Vueltas</CardTitle>
                  <p className="text-sm text-blue-700 mt-1">
                    {adjustLapsParticipant.nombre} {adjustLapsParticipant.apellidos} (BIB: {adjustLapsParticipant.bib})
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-blue-800">Vueltas actuales:</span>
                    <span className="font-bold text-2xl text-blue-900">{adjustLapsParticipant.laps_completed}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Nuevo número de vueltas
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={newLapsValue}
                    onChange={(e) => setNewLapsValue(e.target.value)}
                    className="text-center font-mono text-2xl h-14"
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Total KM: {(parseFloat(newLapsValue) * 6.7).toFixed(1)} km
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={() => {
                      setShowAdjustLapsModal(false);
                      setAdjustLapsParticipant(null);
                      setNewLapsValue(0);
                    }}
                    variant="outline"
                    className="flex-1"
                    disabled={adjustingLaps}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleAdjustLaps}
                    disabled={adjustingLaps || parseInt(newLapsValue, 10) < 0}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {adjustingLaps ? (
                      <>
                        <RotateCw className="w-4 h-4 mr-2 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Guardar Cambios
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Send Runner Emails Modal */}
      {showSendRunnerEmailsModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-lg border-green-300 shadow-strong">
            <CardHeader className="border-b border-green-200 bg-green-50/50">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <Mail className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <CardTitle className="text-xl text-green-900">Enviar Correos a Corredores</CardTitle>
                  <p className="text-sm text-green-700 mt-1">Resumen de carrera y mensajes de ánimo</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="font-semibold text-green-900 mb-2">📧 Se enviará a cada corredor:</h3>
                  <ul className="text-sm text-green-800 space-y-1">
                    <li>• Mensaje de felicitación personalizado</li>
                    <li>• Resumen: KM recorridos, vueltas, seguidores</li>
                    <li>• Todos los mensajes de ánimo recibidos</li>
                    <li>• El ganador recibirá badge de campeón</li>
                  </ul>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h3 className="font-semibold text-amber-900 mb-2">⚠️ Nota importante:</h3>
                  <ul className="text-sm text-amber-800 space-y-1">
                    <li>• Solo se envía a corredores que participaron (no DNS)</li>
                    <li>• Corredores sin email registrado serán omitidos</li>
                    <li>• Este proceso puede tomar varios minutos</li>
                  </ul>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={() => setShowSendRunnerEmailsModal(false)}
                    variant="outline"
                    className="flex-1"
                    disabled={sendingRunnerEmails}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSendRunnerEmails}
                    disabled={sendingRunnerEmails}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  >
                    {sendingRunnerEmails ? (
                      <>
                        <RotateCw className="w-4 h-4 mr-2 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4 mr-2" />
                        Enviar Correos
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
