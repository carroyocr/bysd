import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Save, AlertCircle, CheckCircle2, Search, RotateCw, AlertTriangle, Trash2, Clock, ChevronLeft, Users, Mail, MessageCircle, Edit3, UserCog, Trophy, Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { useAdminRace } from '../contexts/AdminRaceContext';
import RaceSelector from './RaceSelector';
import LapRegistrationsPanel from './LapRegistrationsPanel';
import { adminFetch } from '../lib/adminApi';

export default function RaceControlPanel({
  embedded = false,
  puedeControlar = true,
  puedeVerVueltas = true,
}) {
  const { raceName, raceCode, conCarrera } = useAdminRace();
  // Que parte se esta mirando. Quien solo tenga permiso para una de las dos
  // entra directo en ella, sin pestanas que no puede abrir.
  const [seccion, setSeccion] = useState(puedeControlar ? 'corredores' : 'registro');
  // El estado de vuelta lo calcula el backend a partir de la hora real de
  // salida. Antes esta pantalla lo calculaba por su cuenta y el escáner por la
  // suya, así que podían decir cosas distintas sobre la misma carrera.
  const [estadoVuelta, setEstadoVuelta] = useState(null);
  const [iniciando, setIniciando] = useState(false);
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
  const [showEditParticipantModal, setShowEditParticipantModal] = useState(false);
  const [editParticipant, setEditParticipant] = useState(null);
  const [editFormData, setEditFormData] = useState({ nombre: '', apellidos: '', nacionalidad: '' });
  const [editingParticipant, setEditingParticipant] = useState(false);
  const [markingWinner, setMarkingWinner] = useState(false);
  const [followersCount, setFollowersCount] = useState({});
  const [sendingRunnerEmails, setSendingRunnerEmails] = useState(false);
  const [showSendRunnerEmailsModal, setShowSendRunnerEmailsModal] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const navigate = useNavigate();

  // El horario de cada vuelta sale del reloj del backend, que cuenta desde la
  // hora real de salida. Esta pantalla lo calculaba antes por su cuenta a
  // partir de la hora prevista de la ficha, así que si la salida se retrasaba
  // -- que es lo normal -- mostraba horarios que no eran.
  const horaCorta = (iso) => {
    if (!iso) return '--:--';
    return new Date(iso).toLocaleTimeString('es-DO', {
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  };

  const cuentaAtras = (segundos) => {
    if (segundos == null || segundos <= 0) return null;
    const dias = Math.floor(segundos / 86400);
    const horas = Math.floor((segundos % 86400) / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);
    const resto = segundos % 60;
    if (dias > 0) return `${dias}d ${horas}h ${minutos}m`;
    if (horas > 0) return `${horas}h ${minutos}m ${resto}s`;
    return `${minutos}m ${resto}s`;
  };

  const carreraEmpezada = !!estadoVuelta?.race_started;
  const carreraTerminada = estadoVuelta?.estado === 'cerrada';
  // La vuelta que se cerraría: la última terminada según el reloj.
  const vueltaACerrar = Math.max(1, (estadoVuelta?.current_lap || 1) - 1);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      navigate('/admin/login');
      return;
    }
    // Al cambiar de carrera en la cabecera se recarga todo: si no, quedarían
    // en pantalla los corredores de la carrera anterior.
    if (raceCode) loadData();
  }, [navigate, raceCode]);

  const loadData = async () => {
    if (!raceCode) return;
    const API = process.env.REACT_APP_BACKEND_URL;
    try {
      const [statsRes, participantsRes, lapRes, followersRes] = await Promise.all([
        fetch(`${API}/api/race/stats?race_code=${raceCode}`),
        fetch(`${API}/api/race/participants?race_code=${raceCode}`),
        fetch(`${API}/api/race/lap-status?race_code=${raceCode}`),
        adminFetch(`${API}/api/race/followers-count`),
      ]);

      const stats = await statsRes.json();
      const participantsData = await participantsRes.json();

      if (lapRes.ok) {
        const lap = await lapRes.json();
        setEstadoVuelta(lap);
        setCurrentLap(lap.current_lap || stats.current_lap || 1);
      } else {
        setCurrentLap(stats.current_lap);
      }

      if (followersRes.ok) {
        const followersData = await followersRes.json();
        setFollowersCount(followersData);
      }

      setParticipants(Array.isArray(participantsData) ? participantsData : []);
      setLoading(false);
    } catch (err) {
      console.error('Error loading data:', err);
      setLoading(false);
    }
  };

  // Sella la hora real de salida. Es lo que hace que el reloj de la carrera
  // empiece a contar, para el panel y para el escáner por igual.
  const iniciarCarrera = async () => {
    if (!window.confirm(
      `¿Dar la salida de ${raceName} ahora?\n\n` +
      'A partir de este momento se cuenta una vuelta por hora. Si la salida ya ' +
      'fue antes, luego puedes corregir la hora.'
    )) return;

    setIniciando(true);
    try {
      const res = await adminFetch(
        conCarrera(`${process.env.REACT_APP_BACKEND_URL}/api/race/start`),
        { method: 'POST' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'No se pudo iniciar la carrera');
      showMessage(data.message, 'success');
      await loadData();
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setIniciando(false);
    }
  };

  const corregirHoraDeSalida = async () => {
    const actual = estadoVuelta?.started_at ? new Date(estadoVuelta.started_at) : new Date();
    const sugerido = new Date(actual.getTime() - actual.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);

    const valor = window.prompt(
      'Hora real de salida (formato AAAA-MM-DDTHH:MM):',
      sugerido
    );
    if (!valor) return;

    try {
      const res = await adminFetch(
        conCarrera(`${process.env.REACT_APP_BACKEND_URL}/api/race/start-time`),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ started_at: valor.trim() }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'No se pudo corregir la hora');
      showMessage(data.message, 'success');
      await loadData();
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_username');
    navigate('/admin/login');
  };

  // Cierra una vuelta para todos los que siguen en carrera. Por defecto la
  // última terminada según el reloj, pero se puede elegir otra: la corrección
  // del día después casi nunca coincide con la vuelta en curso.
  const handleSaveCurrentLap = async () => {
    const vuelta = window.prompt(
      'Cerrar vuelta para todos los atletas activos.\n\n' +
      '¿Qué vuelta se cierra? (a quien ya la tenga registrada no se le repite)',
      String(vueltaACerrar)
    );
    if (vuelta === null) return;

    const numero = Number(vuelta);
    if (!Number.isInteger(numero) || numero < 1) {
      showMessage('Número de vuelta inválido', 'error');
      return;
    }

    setSaving(true);
    try {
      const url = conCarrera(
        `${process.env.REACT_APP_BACKEND_URL}/api/race/complete-lap-all-active`
      );
      const res = await adminFetch(`${url}&lap_number=${numero}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error al completar vuelta');

      showMessage(data.message, 'success');
      await loadData();
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Deshacer una vuelta cerrada por error. No borra nada: anula lo anotado en
  // esa vuelta y devuelve a la carrera a quien se hubiera retirado en ella.
  const handleRevertLap = async () => {
    const vuelta = window.prompt(
      'Deshacer una vuelta.\n\n' +
      'Se anulará todo lo anotado en ella -- vueltas y retiros -- y quienes se ' +
      'retiraron en esa vuelta vuelven a la carrera. Nada se borra: las ' +
      'anotaciones quedan marcadas como anuladas.\n\n¿Qué vuelta se deshace?',
      String(vueltaACerrar)
    );
    if (vuelta === null) return;

    const numero = Number(vuelta);
    if (!Number.isInteger(numero) || numero < 1) {
      showMessage('Número de vuelta inválido', 'error');
      return;
    }

    setReverting(true);
    try {
      const url = conCarrera(`${process.env.REACT_APP_BACKEND_URL}/api/race/revert-lap`);
      const res = await adminFetch(`${url}&lap_number=${numero}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error al deshacer la vuelta');

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
        const response = await adminFetch(conCarrera(`${process.env.REACT_APP_BACKEND_URL}/api/race/mark-retired`), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
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

        const response = await adminFetch(conCarrera(`${process.env.REACT_APP_BACKEND_URL}/api/race/reactivate`), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
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
      const response = await adminFetch(conCarrera(`${process.env.REACT_APP_BACKEND_URL}/api/race/mark-dns`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
      const response = await adminFetch(conCarrera(`${process.env.REACT_APP_BACKEND_URL}/api/race/complete-lap`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
      const response = await adminFetch(conCarrera(`${process.env.REACT_APP_BACKEND_URL}/api/race/reset-database`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
      const response = await adminFetch(conCarrera(`${process.env.REACT_APP_BACKEND_URL}/api/race/reset-subscriptions`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
      const response = await adminFetch(conCarrera(`${process.env.REACT_APP_BACKEND_URL}/api/race/reset-cheers`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
      const response = await adminFetch(conCarrera(`${process.env.REACT_APP_BACKEND_URL}/api/race/send-runner-emails`), {
        method: 'POST',
        headers: {
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

  const openEditParticipantModal = (participant) => {
    setEditParticipant(participant);
    setEditFormData({
      nombre: participant.nombre,
      apellidos: participant.apellidos,
      nacionalidad: participant.nacionalidad
    });
    setShowEditParticipantModal(true);
  };

  const handleEditParticipant = async () => {
    if (!editParticipant) return;
    
    const token = localStorage.getItem('admin_token');
    setEditingParticipant(true);

    try {
      const response = await adminFetch(conCarrera(`${process.env.REACT_APP_BACKEND_URL}/api/race/edit-participant`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          bib: editParticipant.bib,
          nombre: editFormData.nombre,
          apellidos: editFormData.apellidos,
          nacionalidad: editFormData.nacionalidad
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Error al editar participante');
      }

      const data = await response.json();
      showMessage(data.message, 'success');
      setShowEditParticipantModal(false);
      setEditParticipant(null);
      setEditFormData({ nombre: '', apellidos: '', nacionalidad: '' });
      
      await loadData();
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setEditingParticipant(false);
    }
  };

  const handleMarkWinner = async (participant) => {
    if (!window.confirm(`¿Estás seguro de marcar a ${participant.nombre} ${participant.apellidos} como GANADOR?`)) {
      return;
    }
    
    const token = localStorage.getItem('admin_token');
    setMarkingWinner(true);

    try {
      const response = await adminFetch(conCarrera(`${process.env.REACT_APP_BACKEND_URL}/api/race/mark-winner`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bib: participant.bib })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Error al marcar ganador');
      }

      const data = await response.json();
      showMessage(data.message, 'success');
      
      await loadData();
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setMarkingWinner(false);
    }
  };

  const handleMarkHonor = async (participant) => {
    if (!window.confirm(`¿Estás seguro de marcar a ${participant.nombre} ${participant.apellidos} como Invitada de Honor?`)) {
      return;
    }
    
    const token = localStorage.getItem('admin_token');
    setSaving(true);

    try {
      const response = await adminFetch(conCarrera(`${process.env.REACT_APP_BACKEND_URL}/api/race/mark-honor`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bib: participant.bib })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Error al marcar como Invitada de Honor');
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

  const handleAdjustLaps = async () => {
    if (!adjustLapsParticipant) return;
    
    const token = localStorage.getItem('admin_token');
    setAdjustingLaps(true);

    try {
      const response = await adminFetch(conCarrera(`${process.env.REACT_APP_BACKEND_URL}/api/race/adjust-laps`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
    <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold">Control de Carrera</h2>
            <p className="text-muted-foreground">Gestión de vueltas y participantes</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* Sobre qué carrera se lleva el control. Vale también para la
                pestaña Vueltas, pero no toca el resto del panel. */}
            <RaceSelector />
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

        {/* Control de vuelta: el reloj de la carrera */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <CardTitle>Control de Vuelta</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Las vueltas se cuentan desde la hora real de salida. El escáner
                  QR usa este mismo reloj, así que panel y escáner no pueden
                  discrepar.
                </p>
              </div>
              {carreraEmpezada && !carreraTerminada && (
                <Button variant="outline" size="sm" onClick={corregirHoraDeSalida}>
                  <Clock className="w-4 h-4 mr-2" />
                  Corregir hora de salida
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-6">
              {/* Antes de la salida */}
              {!carreraEmpezada && (
                <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-amber-800">La carrera no ha empezado</p>
                      <p className="text-sm text-amber-700 mt-1">
                        Salida prevista: {horaCorta(estadoVuelta?.started_at)}
                        {cuentaAtras(estadoVuelta?.seconds_remaining)
                          ? ` · faltan ${cuentaAtras(estadoVuelta.seconds_remaining)}`
                          : ''}
                      </p>
                      <p className="text-xs text-amber-700/80 mt-1">
                        Hasta que se dé la salida, el escáner no acepta vueltas.
                      </p>
                    </div>
                  </div>
                  <Button onClick={iniciarCarrera} disabled={iniciando} className="shrink-0">
                    <Save className="w-4 h-4 mr-2" />
                    {iniciando ? 'Dando la salida...' : 'Iniciar carrera ahora'}
                  </Button>
                </div>
              )}

              {carreraTerminada && (
                <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-gray-500" />
                  <div>
                    <p className="font-semibold text-gray-700">Carrera cerrada</p>
                    <p className="text-sm text-gray-600">
                      Los resultados están congelados. El reloj ya no cuenta vueltas.
                    </p>
                  </div>
                </div>
              )}

              {/* Vuelta en curso y su horario */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Vuelta en Curso
                  </label>
                  <div className="text-center p-6 bg-muted/30 rounded-lg border-2 border-primary/20 flex-1 flex flex-col items-center justify-center">
                    <p className="text-5xl font-bold text-primary">{currentLap}</p>
                    {carreraEmpezada && !carreraTerminada && cuentaAtras(estadoVuelta?.seconds_remaining) && (
                      <p className="text-sm text-muted-foreground mt-2">
                        termina en {cuentaAtras(estadoVuelta.seconds_remaining)}
                      </p>
                    )}
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
                        <p className="text-2xl font-bold text-blue-700">
                          {horaCorta(estadoVuelta?.lap_start_time)}
                        </p>
                      </div>
                      <div className="text-2xl text-blue-400">-</div>
                      <div className="text-center">
                        <p className="text-xs text-blue-600 font-medium">FIN</p>
                        <p className="text-2xl font-bold text-blue-700">
                          {horaCorta(estadoVuelta?.lap_end_time)}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-blue-500 mt-2">
                      Salida: {horaCorta(estadoVuelta?.started_at)} · Cada vuelta dura 1 hora
                    </p>
                    <p className="text-xs text-blue-600 mt-1 font-medium">
                      Hora actual: {currentTime.toLocaleTimeString('es-DO')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Acciones */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={handleRevertLap}
                  disabled={reverting || !carreraEmpezada}
                  variant="outline"
                  className="border-amber-400 text-amber-700 hover:bg-amber-50 flex-1 sm:flex-none"
                >
                  <ChevronLeft className="w-5 h-5 mr-2" />
                  {reverting ? 'Deshaciendo...' : 'Deshacer una vuelta'}
                </Button>
                <Button
                  onClick={handleSaveCurrentLap}
                  disabled={saving || !carreraEmpezada}
                  className="h-12 px-8 flex-1 bg-primary hover:bg-accent text-primary-foreground"
                >
                  <Save className="w-5 h-5 mr-2" />
                  {saving ? 'Guardando...' : 'Cerrar vuelta para los atletas activos'}
                </Button>
              </div>

              <div className="text-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-600">
                  Lo normal es que las vueltas entren por el escáner QR. Esto es el
                  repuesto para cuando el escaneo no se pudo hacer; queda anotado
                  en el mismo registro, que puedes ver aquí abajo.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Las dos caras del mismo dato: cuantas vueltas lleva cada uno, y de
            donde sale ese numero. El registro no se carga hasta que se abre,
            para que el dia de la carrera esta pantalla siga siendo ligera. */}
        {puedeControlar && puedeVerVueltas && (
          <div className="flex gap-1 bg-muted/40 p-1 rounded-xl mb-4 w-fit">
            {[
              { id: 'corredores', label: 'Corredores', icon: Users },
              { id: 'registro', label: 'Registro de vueltas', icon: Clock },
            ].map(({ id, label, icon: Icono }) => (
              <Button
                key={id}
                variant={seccion === id ? 'default' : 'ghost'}
                size="sm"
                className="gap-2"
                onClick={() => setSeccion(id)}
                data-testid={`seccion-${id}`}
              >
                <Icono className="w-4 h-4" />
                {label}
              </Button>
            ))}
          </div>
        )}

        {seccion === 'registro' && puedeVerVueltas && <LapRegistrationsPanel />}

        {seccion === 'corredores' && puedeControlar && (
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
                <div className="flex gap-2">
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-4 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="all">Todos ({participants.length})</option>
                    <option value="active">Activos ({participants.filter(p => p.status === 'active').length})</option>
                    <option value="winner">Ganador ({participants.filter(p => p.status === 'winner').length})</option>
                    <option value="honor">Invitada de Honor ({participants.filter(p => p.status === 'honor').length})</option>
                    <option value="retired">DNF ({participants.filter(p => p.status === 'retired').length})</option>
                    <option value="dns">DNS ({participants.filter(p => p.status === 'dns').length})</option>
                  </select>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={loadData}
                    title="Refrescar lista"
                  >
                    <RotateCw className="w-4 h-4" />
                  </Button>
                </div>
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
                          variant={participant.status === 'active' || participant.status === 'winner' || participant.status === 'honor' ? 'default' : 'secondary'}
                          className={
                            participant.status === 'winner'
                              ? 'bg-yellow-500'
                              : participant.status === 'honor'
                              ? 'bg-purple-500'
                              : participant.status === 'active' 
                              ? 'bg-green-500' 
                              : participant.status === 'dns'
                              ? 'bg-gray-500'
                              : 'bg-red-500'
                          }
                        >
                          {participant.status === 'winner'
                            ? '🏆 Ganador'
                            : participant.status === 'honor'
                            ? '⭐ Invitada'
                            : participant.status === 'active' 
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
                                onClick={() => handleMarkWinner(participant)}
                                disabled={saving || markingWinner}
                                className="border-yellow-500 text-yellow-600 hover:bg-yellow-50"
                                title="Marcar como Ganador"
                              >
                                <Trophy className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleMarkHonor(participant)}
                                disabled={saving}
                                className="border-purple-400 text-purple-500 hover:bg-purple-50"
                                title="Marcar como Invitada de Honor"
                              >
                                <Star className="w-4 h-4" />
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
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openEditParticipantModal(participant)}
                                disabled={saving}
                                className="border-purple-500 text-purple-600"
                                title="Editar datos del corredor"
                              >
                                <UserCog className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          {participant.status === 'winner' && (
                            <Badge className="bg-yellow-500 text-white">
                              <Trophy className="w-3 h-3 mr-1" />
                              GANADOR
                            </Badge>
                          )}
                          {participant.status === 'honor' && (
                            <>
                              <Badge className="bg-purple-500 text-white">
                                ⭐ INVITADA DE HONOR
                              </Badge>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openEditParticipantModal(participant)}
                                disabled={saving}
                                className="border-purple-500 text-purple-600"
                                title="Editar datos"
                              >
                                <UserCog className="w-4 h-4" />
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
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openEditParticipantModal(participant)}
                                disabled={saving}
                                className="border-purple-500 text-purple-600"
                                title="Editar datos del corredor"
                              >
                                <UserCog className="w-4 h-4" />
                              </Button>
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
        )}

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

      {/* Edit Participant Modal */}
      {showEditParticipantModal && editParticipant && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md border-purple-300 shadow-strong">
            <CardHeader className="border-b border-purple-200 bg-purple-50/50">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                  <UserCog className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <CardTitle className="text-xl text-purple-900">Editar Corredor</CardTitle>
                  <p className="text-sm text-purple-700 mt-1">BIB: {editParticipant.bib}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Nombre
                  </label>
                  <Input
                    value={editFormData.nombre}
                    onChange={(e) => setEditFormData({...editFormData, nombre: e.target.value})}
                    placeholder="Nombre"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Apellidos
                  </label>
                  <Input
                    value={editFormData.apellidos}
                    onChange={(e) => setEditFormData({...editFormData, apellidos: e.target.value})}
                    placeholder="Apellidos"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Nacionalidad (código ISO 3 letras)
                  </label>
                  <Input
                    value={editFormData.nacionalidad}
                    onChange={(e) => setEditFormData({...editFormData, nacionalidad: e.target.value.toUpperCase()})}
                    placeholder="Ej: DOM, VEN, MEX"
                    maxLength={3}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={() => {
                      setShowEditParticipantModal(false);
                      setEditParticipant(null);
                      setEditFormData({ nombre: '', apellidos: '', nacionalidad: '' });
                    }}
                    variant="outline"
                    className="flex-1"
                    disabled={editingParticipant}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleEditParticipant}
                    disabled={editingParticipant || !editFormData.nombre || !editFormData.apellidos || !editFormData.nacionalidad}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    {editingParticipant ? (
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
