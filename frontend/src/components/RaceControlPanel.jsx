import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Save, AlertCircle, CheckCircle2, Search, RotateCw, AlertTriangle, Trash2,
  Clock, ChevronLeft, Edit3, UserCog, Trophy, Star,
  MoreHorizontal, Play, Plus, UserX, Ban, QrCode, ClipboardEdit, Download,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { useAdminRace } from '../contexts/AdminRaceContext';
import RaceSelector from './RaceSelector';
import { adminFetch } from '../lib/adminApi';
import { token as sesionToken } from '../lib/sesion';

export default function RaceControlPanel({
  puedeControlar = true,
  puedeVerVueltas = true,
}) {
  const { raceName, raceCode, conCarrera } = useAdminRace();
  // Que parte se esta mirando. Quien solo tenga permiso para una de las dos
  // entra directo en ella, sin pestanas que no puede abrir.
  // Lo que se ve durante la carrera, en una sola llamada: corredores cruzados
  // con el libro de vueltas y los ultimos movimientos.
  const [totales, setTotales] = useState({});
  const [movimientos, setMovimientos] = useState([]);
  const [cuantosMovimientos, setCuantosMovimientos] = useState(40);
  const [exportando, setExportando] = useState(false);
  const [anotando, setAnotando] = useState(false);
  const [nuevaVuelta, setNuevaVuelta] = useState({ bib: '', lap_number: '', motivo: '' });
  const [guardandoVuelta, setGuardandoVuelta] = useState(false);
  const [anulando, setAnulando] = useState(null);
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
  const [showAdjustLapsModal, setShowAdjustLapsModal] = useState(false);
  const [adjustLapsParticipant, setAdjustLapsParticipant] = useState(null);
  const [newLapsValue, setNewLapsValue] = useState(0);
  const [adjustingLaps, setAdjustingLaps] = useState(false);
  const [showEditParticipantModal, setShowEditParticipantModal] = useState(false);
  const [editParticipant, setEditParticipant] = useState(null);
  const [editFormData, setEditFormData] = useState({ nombre: '', apellidos: '', nacionalidad: '' });
  const [editingParticipant, setEditingParticipant] = useState(false);
  const [markingWinner, setMarkingWinner] = useState(false);
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
    const token = sesionToken();
    if (!token) {
      navigate('/admin/login');
      return;
    }
    // Al cambiar de carrera en la cabecera se recarga todo: si no, quedarían
    // en pantalla los corredores de la carrera anterior.
    if (raceCode) loadData();
  }, [navigate, raceCode, cuantosMovimientos]);

  const loadData = async () => {
    if (!raceCode) return;
    try {
      const res = await adminFetch(
        `${conCarrera(`${process.env.REACT_APP_BACKEND_URL}/api/race/live`)}` +
        `&movimientos=${cuantosMovimientos}`
      );
      if (!res.ok) throw new Error('No se pudo cargar la carrera');
      const datos = await res.json();

      setEstadoVuelta(datos.lap);
      setCurrentLap(datos.lap?.current_lap || 1);
      setParticipants(datos.corredores || []);
      setTotales(datos.totales || {});
      setMovimientos(datos.movimientos || []);
      setLoading(false);
    } catch (err) {
      console.error('Error loading data:', err);
      setLoading(false);
    }
  };

  // Cómo se ve un corredor respecto a la vuelta que corre ahora mismo. Es la
  // pregunta del día de la carrera: quién ha vuelto y quién no.
  const estadoDeVuelta = (participante, marca) => {
    if (participante.status === 'winner') {
      return (
        <span className="flex items-center gap-1.5 text-yellow-600 font-medium">
          <Trophy className="w-4 h-4" /> Ganador
        </span>
      );
    }
    if (participante.status === 'honor') {
      return (
        <span className="flex items-center gap-1.5 text-purple-600 font-medium">
          <Star className="w-4 h-4" /> Invitada de honor
        </span>
      );
    }
    if (participante.status === 'dns') {
      return <span className="text-muted-foreground">No se presentó</span>;
    }
    if (participante.status === 'retired') {
      return (
        <span className="text-red-600">
          DNF{participante.retired_at_lap ? ` en la vuelta ${participante.retired_at_lap}` : ''}
        </span>
      );
    }
    if (!carreraEmpezada) {
      return <span className="text-muted-foreground">En la salida</span>;
    }
    if (participante.vuelta_en_curso_hecha) {
      return (
        <span className="flex items-center gap-1.5 text-green-600 font-medium">
          <CheckCircle2 className="w-4 h-4" />
          Volvió{marca?.hora ? ` a las ${marca.hora.slice(0, 5)}` : ''}
        </span>
      );
    }
    return <span className="text-amber-600 font-medium">Sin volver</span>;
  };

  const etiquetaDeAccion = (accion, vuelta) => {
    if (accion === 'lap_completed') {
      return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Vuelta {vuelta}</Badge>;
    }
    if (accion === 'ajuste') {
      return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">Ajuste a {vuelta}</Badge>;
    }
    const motivos = {
      dnf: 'DNF',
      dnf_early_return: 'DNF (volvió antes)',
      dnf_timeout: 'DNF (sin tiempo)',
    };
    return (
      <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
        {motivos[accion] || accion}
      </Badge>
    );
  };

  // Anotar a mano lo que el escáner no pudo registrar.
  const anotarVueltaAMano = async (e) => {
    e.preventDefault();
    if (!nuevaVuelta.bib.trim()) {
      showMessage('Indica el dorsal', 'error');
      return;
    }

    setGuardandoVuelta(true);
    try {
      const res = await adminFetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/qr-scan/lap-registrations/manual`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            race_code: raceCode,
            bib: nuevaVuelta.bib.trim(),
            lap_number: nuevaVuelta.lap_number ? Number(nuevaVuelta.lap_number) : null,
            motivo: nuevaVuelta.motivo.trim() || null,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'No se pudo anotar la vuelta');

      showMessage(data.message, 'success');
      setNuevaVuelta({ bib: '', lap_number: '', motivo: '' });
      await loadData();
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setGuardandoVuelta(false);
    }
  };

  // Para revisar el dia despues: el libro entero en una hoja de calculo, que
  // es donde de verdad se cruzan y se ordenan miles de anotaciones.
  const exportarCSV = async () => {
    setExportando(true);
    try {
      const res = await adminFetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/qr-scan/lap-registrations/export?race_code=${raceCode}`
      );
      if (!res.ok) throw new Error('No se pudo exportar');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = `registro_vueltas_${raceCode}.csv`;
      document.body.appendChild(enlace);
      enlace.click();
      window.URL.revokeObjectURL(url);
      enlace.remove();
      showMessage('Registro exportado', 'success');
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setExportando(false);
    }
  };

  // Anular en vez de borrar: al día siguiente hay que poder explicar cada
  // número, y un registro borrado no explica nada.
  const anularMovimiento = async (movimiento) => {
    const motivo = window.prompt(
      `Anular la anotación de la vuelta ${movimiento.lap_number} de ${movimiento.athlete_name}.\n\n¿Por qué?`
    );
    if (motivo === null) return;

    setAnulando(movimiento.id);
    try {
      const res = await adminFetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/qr-scan/lap-registrations/${movimiento.id}/anular`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ race_code: raceCode, motivo: motivo.trim() || null }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'No se pudo anular');

      showMessage(`${data.message}. ${movimiento.bib} queda con ${data.laps_completed} vueltas.`, 'success');
      await loadData();
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setAnulando(null);
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
    const token = sesionToken();
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
    const token = sesionToken();
    
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
    const token = sesionToken();
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

    const token = sesionToken();
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
    
    const token = sesionToken();
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
    
    const token = sesionToken();
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
    
    const token = sesionToken();
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
    
    const token = sesionToken();
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
    // "pendientes" no es un estado del corredor sino una pregunta sobre la
    // vuelta en curso: quien sigue en carrera y todavia no ha vuelto.
    const matchesStatus =
      filterStatus === 'all'
        ? true
        : filterStatus === 'pendientes'
        ? !['retired', 'dns', 'winner'].includes(p.status) && !p.vuelta_en_curso_hecha
        : p.status === filterStatus;
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
    <div className="space-y-4">
        {/* Cabecera: sobre qué carrera se trabaja y las acciones que casi nunca
            se usan, apartadas para que no estorben el día de la carrera. */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div>
            <h2 className="text-2xl font-bold">Control de Carrera</h2>
            <p className="text-muted-foreground text-sm">
              Corredores y vueltas de {raceName}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <RaceSelector />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" title="Más acciones">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                {/* Solo lo que es de la carrera en si. Los correos de cierre y
                    la limpieza de mensajes y suscripciones viven en
                    Configuración > Carrera, que es donde se cierra la edición. */}
                <DropdownMenuItem
                  onSelect={() => setShowResetModal(true)}
                  className="gap-2 text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-4 h-4" /> Borrar las vueltas de esta carrera
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
              message.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <p className="font-medium">{message.text}</p>
          </div>
        )}

        {/* El estado de la carrera: la vuelta, el reloj y cuánta gente queda.
            Es lo único que se mira sin buscar nada. */}
        <Card className={carreraEmpezada && !carreraTerminada ? 'border-primary/40' : ''}>
          <CardContent className="pt-6">
            {!carreraEmpezada ? (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold">La carrera no ha empezado</p>
                    <p className="text-sm text-muted-foreground">
                      Salida prevista {horaCorta(estadoVuelta?.started_at)}
                      {cuentaAtras(estadoVuelta?.seconds_remaining)
                        ? ` · faltan ${cuentaAtras(estadoVuelta.seconds_remaining)}`
                        : ''}
                      . Hasta entonces el escáner no acepta vueltas.
                    </p>
                  </div>
                </div>
                <Button onClick={iniciarCarrera} disabled={iniciando} size="lg" className="shrink-0">
                  <Play className="w-4 h-4 mr-2" />
                  {iniciando ? 'Dando la salida...' : 'Iniciar carrera'}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col lg:flex-row gap-6">
                {/* Vuelta y reloj */}
                <div className="flex items-center gap-5 shrink-0">
                  <div className="text-center">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Vuelta</p>
                    <p className="text-5xl font-bold text-primary leading-none">{currentLap}</p>
                  </div>
                  <div className="border-l pl-5">
                    {carreraTerminada ? (
                      <p className="font-semibold text-muted-foreground">Carrera cerrada</p>
                    ) : (
                      <>
                        <p className="text-2xl font-bold tabular-nums">
                          {cuentaAtras(estadoVuelta?.seconds_remaining) || '--'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          para cerrar · {horaCorta(estadoVuelta?.lap_start_time)} a {horaCorta(estadoVuelta?.lap_end_time)}
                        </p>
                      </>
                    )}
                    <button
                      onClick={corregirHoraDeSalida}
                      className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground mt-1"
                    >
                      Salida {horaCorta(estadoVuelta?.started_at)} · corregir
                    </button>
                  </div>
                </div>

                {/* Cuánta gente queda y cuánta falta por volver */}
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 flex-1">
                  <div>
                    <p className="text-2xl font-bold text-green-600 leading-none">{totales.en_carrera ?? 0}</p>
                    <p className="text-xs text-muted-foreground">en carrera</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-muted-foreground leading-none">{totales.fuera ?? 0}</p>
                    <p className="text-xs text-muted-foreground">fuera</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold leading-none">
                      {totales.vuelta_en_curso_hecha ?? 0}
                    </p>
                    <p className="text-xs text-muted-foreground">volvieron de la {currentLap}</p>
                  </div>
                  {(totales.faltan_por_volver ?? 0) > 0 && (
                    <div>
                      <p className="text-2xl font-bold text-amber-600 leading-none">
                        {totales.faltan_por_volver}
                      </p>
                      <p className="text-xs text-muted-foreground">sin volver</p>
                    </div>
                  )}
                </div>

                {/* Cerrar la vuelta para todos, o deshacerla */}
                <div className="flex flex-wrap gap-2 items-center shrink-0">
                  <Button onClick={handleSaveCurrentLap} disabled={saving}>
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? 'Cerrando...' : `Cerrar vuelta ${vueltaACerrar} para todos`}
                  </Button>
                  <Button
                    onClick={handleRevertLap}
                    disabled={reverting}
                    variant="outline"
                    className="border-amber-400 text-amber-700 hover:bg-amber-50"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    {reverting ? 'Deshaciendo...' : 'Deshacer'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {puedeControlar && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
              <CardTitle className="text-lg">
                Corredores
                <span className="text-muted-foreground font-normal text-sm ml-2">
                  {filteredParticipants.length} de {participants.length}
                </span>
              </CardTitle>
              <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
                <div className="relative flex-1 sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Dorsal, nombre o apellidos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 border rounded-md bg-background text-sm"
                >
                  <option value="all">Todos</option>
                  <option value="pendientes">Sin volver de la vuelta</option>
                  <option value="active">En carrera</option>
                  <option value="retired">DNF</option>
                  <option value="dns">DNS</option>
                  <option value="winner">Ganador</option>
                  <option value="honor">Invitada de honor</option>
                </select>
                <Button
                  variant={anotando ? 'default' : 'outline'}
                  onClick={() => setAnotando((v) => !v)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Anotar vuelta
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Anotar a mano lo que el escáner no pudo. Va aquí, junto a los
                corredores, porque es donde se descubre que falta. */}
            {anotando && (
              <form
                onSubmit={anotarVueltaAMano}
                className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end mb-4 p-4 bg-muted/40 rounded-lg"
              >
                <div>
                  <label className="text-xs font-medium mb-1 block">Dorsal</label>
                  <Input
                    value={nuevaVuelta.bib}
                    onChange={(e) => setNuevaVuelta((p) => ({ ...p, bib: e.target.value }))}
                    placeholder="042"
                    className="font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">
                    Vuelta <span className="text-muted-foreground font-normal">(opcional)</span>
                  </label>
                  <Input
                    type="number"
                    min="1"
                    value={nuevaVuelta.lap_number}
                    onChange={(e) => setNuevaVuelta((p) => ({ ...p, lap_number: e.target.value }))}
                    placeholder="la siguiente que le toca"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Motivo</label>
                  <Input
                    value={nuevaVuelta.motivo}
                    onChange={(e) => setNuevaVuelta((p) => ({ ...p, motivo: e.target.value }))}
                    placeholder="el teléfono se quedó sin batería"
                  />
                </div>
                <Button type="submit" disabled={guardandoVuelta}>
                  {guardandoVuelta ? (
                    <RotateCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  Anotar
                </Button>
              </form>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-2 px-3 font-medium">Dorsal</th>
                    <th className="text-left py-2 px-3 font-medium">Corredor</th>
                    <th className="text-center py-2 px-3 font-medium">Vueltas</th>
                    <th className="text-left py-2 px-3 font-medium">
                      {carreraEmpezada ? `Vuelta ${currentLap}` : 'Estado'}
                    </th>
                    <th className="text-right py-2 px-3 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredParticipants.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-muted-foreground">
                        No hay corredores que coincidan
                      </td>
                    </tr>
                  )}
                  {filteredParticipants.map((participant) => {
                    const fuera = participant.status === 'retired' || participant.status === 'dns';
                    const marca = participant.ultima_marca;
                    return (
                      <tr key={participant.bib} className="border-b hover:bg-muted/30">
                        <td className="py-2 px-3">
                          <Badge variant="outline" className="font-mono">{participant.bib}</Badge>
                        </td>
                        <td className="py-2 px-3">
                          <span className="font-medium">
                            {participant.nombre} {participant.apellidos}
                          </span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {participant.nacionalidad}
                          </span>
                          {participant.categoria && (
                            <span className="text-xs text-muted-foreground ml-2">
                              · {participant.categoria}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className="font-bold">{participant.laps_completed}</span>
                          <span className="text-xs text-muted-foreground ml-1">
                            {participant.total_km} km
                          </span>
                        </td>
                        <td className="py-2 px-3">{estadoDeVuelta(participant, marca)}</td>
                        <td className="py-2 px-3">
                          <div className="flex justify-end gap-1">
                            {!fuera && participant.status !== 'winner' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCompleteLap(participant)}
                                disabled={saving}
                                title="Anotar la siguiente vuelta"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {!fuera && participant.status !== 'winner' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleToggleRetired(participant)}
                                disabled={saving}
                                className="border-red-300 text-red-600 hover:bg-red-50"
                              >
                                DNF
                              </Button>
                            )}
                            {fuera && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleToggleRetired(participant)}
                                disabled={saving}
                                className="border-green-400 text-green-700 hover:bg-green-50"
                              >
                                Reactivar
                              </Button>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="ghost" title="Más">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuItem
                                  onSelect={() => openAdjustLapsModal(participant)}
                                  className="gap-2"
                                >
                                  <Edit3 className="w-4 h-4" /> Ajustar vueltas
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onSelect={() => openEditParticipantModal(participant)}
                                  className="gap-2"
                                >
                                  <UserCog className="w-4 h-4" /> Editar datos
                                </DropdownMenuItem>
                                {!fuera && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onSelect={() => handleMarkWinner(participant)}
                                      className="gap-2"
                                    >
                                      <Trophy className="w-4 h-4" /> Marcar ganador
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onSelect={() => handleMarkHonor(participant)}
                                      className="gap-2"
                                    >
                                      <Star className="w-4 h-4" /> Invitada de honor
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onSelect={() => handleMarkDNS(participant)}
                                      className="gap-2"
                                    >
                                      <UserX className="w-4 h-4" /> No se presentó (DNS)
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        )}

        {/* De dónde salen esos números. Los últimos movimientos siempre a la
            vista, y el libro entero a un clic para cuando hay que investigar. */}
        {puedeVerVueltas && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center gap-3">
                <div>
                  <CardTitle className="text-lg">Últimos movimientos</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Escaneos y anotaciones a mano, en el mismo libro. Corregir es
                    anular: nada se borra.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportarCSV}
                  disabled={exportando || movimientos.length === 0}
                >
                  {exportando ? (
                    <RotateCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  Exportar CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {movimientos.length === 0 ? (
                <p className="text-center text-muted-foreground py-6 text-sm">
                  Todavía no hay vueltas anotadas en esta carrera
                </p>
              ) : (
                <div className="divide-y">
                  {movimientos.map((m) => (
                    <div
                      key={m.id}
                      className={`flex items-center gap-3 py-2 text-sm ${m.anulada ? 'opacity-50' : ''}`}
                    >
                      <span className="font-mono text-muted-foreground w-16 shrink-0">
                        {m.scan_time_local || '--:--'}
                      </span>
                      <Badge variant="outline" className="font-mono shrink-0">{m.bib}</Badge>
                      <span className={`flex-1 truncate ${m.anulada ? 'line-through' : ''}`}>
                        {m.athlete_name}
                      </span>
                      <span className="shrink-0">{etiquetaDeAccion(m.action, m.lap_number)}</span>
                      <span className="text-xs text-muted-foreground w-20 shrink-0 flex items-center gap-1">
                        {m.source === 'panel' ? (
                          <><ClipboardEdit className="w-3 h-3" /> panel</>
                        ) : (
                          <><QrCode className="w-3 h-3" /> escáner</>
                        )}
                      </span>
                      {m.anulada ? (
                        <Badge variant="outline" className="text-muted-foreground shrink-0">
                          anulada
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => anularMovimiento(m)}
                          disabled={anulando === m.id}
                          className="text-destructive hover:text-destructive shrink-0"
                        >
                          {anulando === m.id ? (
                            <RotateCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Ban className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {movimientos.length >= cuantosMovimientos && (
                <div className="pt-3 text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCuantosMovimientos((n) => n + 60)}
                  >
                    Ver más movimientos
                  </Button>
                </div>
              )}
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
    </div>
  );
}
