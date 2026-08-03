import React, { useState, useEffect } from 'react';
import {
  Plus, Trash2, Edit2, Save, X, Clock, Users, AlertCircle,
  Loader2, Download, RefreshCw, ChevronDown, ChevronUp, RotateCcw,
  CalendarClock, Wand2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import { adminFetch } from '../lib/adminApi';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Helper function to convert 24h time to 12h format with AM/PM
const formatTime12h = (time24) => {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
};

// Default shift templates
const DEFAULT_SHIFTS = [
  { turno: "A", hora_inicio: "08:00", hora_fin: "12:00", slots_count: 2, dia_tipo: "carrera_dia1" },
  { turno: "B", hora_inicio: "12:00", hora_fin: "16:00", slots_count: 2, dia_tipo: "carrera_dia1" },
  { turno: "C", hora_inicio: "16:00", hora_fin: "20:00", slots_count: 2, dia_tipo: "carrera_dia1" },
  { turno: "D", hora_inicio: "20:00", hora_fin: "00:00", slots_count: 2, dia_tipo: "carrera_dia1" },
  { turno: "E", hora_inicio: "00:00", hora_fin: "04:00", slots_count: 2, dia_tipo: "carrera_dia2" },
  { turno: "F", hora_inicio: "04:00", hora_fin: "08:00", slots_count: 2, dia_tipo: "carrera_dia2" },
];

// Orden cronológico de los días, para avanzar al siguiente cuando un turno cruza la medianoche
const DIA_TIPO_SECUENCIA = ["previo", "carrera_dia1", "carrera_dia2", "carrera_dia3"];

const toMinutos = (hora) => {
  const [h, m] = (hora || '00:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const toHora = (minutos) => {
  const m = ((minutos % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

const siguienteDiaTipo = (diaTipo) => {
  const i = DIA_TIPO_SECUENCIA.indexOf(diaTipo);
  if (i === -1) return diaTipo; // valor antiguo ("carrera"): se deja como está
  return DIA_TIPO_SECUENCIA[Math.min(i + 1, DIA_TIPO_SECUENCIA.length - 1)];
};

// Letra del turno i: A..Z y luego AA, AB, ...
const letraTurno = (indice) => {
  const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let nombre = '';
  let n = indice + 1;
  while (n > 0) {
    const resto = (n - 1) % 26;
    nombre = letras[resto] + nombre;
    n = Math.floor((n - 1) / 26);
  }
  return nombre;
};

const fmtHoraDate = (fecha) =>
  `${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}`;

// Genera turnos consecutivos que cubren [inicio, fin] con la duración indicada.
// El dia_tipo sigue el día calendario en que arranca cada turno (día 1, 2, 3).
const generarTurnosProgramacion = (programacion) => {
  const inicio = new Date(programacion.fecha_inicio);
  const fin = new Date(programacion.fecha_fin);
  const durMin = Math.round(parseFloat(programacion.duracion_horas) * 60);
  if (isNaN(inicio.getTime()) || isNaN(fin.getTime()) || fin <= inicio || !durMin || durMin <= 0) {
    return null;
  }
  const diaTipos = ['carrera_dia1', 'carrera_dia2', 'carrera_dia3'];
  const diaBase = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
  const slotsCount = parseInt(programacion.slots_por_turno) || 2;
  const turnos = [];
  let cursor = new Date(inicio);
  let i = 0;
  while (cursor < fin) {
    const finTurno = new Date(Math.min(cursor.getTime() + durMin * 60000, fin.getTime()));
    const diaCursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
    const offsetDia = Math.round((diaCursor - diaBase) / 86400000);
    turnos.push({
      turno: letraTurno(i),
      hora_inicio: fmtHoraDate(cursor),
      hora_fin: fmtHoraDate(finTurno),
      slots_count: slotsCount,
      dia_tipo: diaTipos[Math.min(offsetDia, diaTipos.length - 1)],
    });
    cursor = finTurno;
    i++;
  }
  return turnos;
};

const PROGRAMACION_VACIA = { fecha_inicio: '', fecha_fin: '', duracion_horas: 4, slots_por_turno: 2 };

// Day type options
const DIA_TIPO_OPTIONS = [
  { value: "previo", label: "Día Previo", color: "purple" },
  { value: "carrera_dia1", label: "Día 1 Carrera", color: "blue" },
  { value: "carrera_dia2", label: "Día 2 Carrera", color: "green" },
  { value: "carrera_dia3", label: "Día 3 Carrera", color: "orange" }
];

// Event options (top-level grouping)
const EVENTOS = [
  { value: "carrera", label: "Carrera Activa" },
  { value: "campeonato", label: "Campeonato Satélite por Equipos" }
];

// Helper to get day type display info
const getDiaTipoInfo = (diaTipo) => {
  const option = DIA_TIPO_OPTIONS.find(o => o.value === diaTipo);
  if (option) return option;
  // Backward compatibility for old "carrera" value
  if (diaTipo === "carrera") return { value: "carrera", label: "Día Carrera", color: "blue" };
  return { value: diaTipo, label: diaTipo, color: "gray" };
};

export default function VolunteerConfigManagement() {
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Selected event (top-level grouping)
  const [selectedEvento, setSelectedEvento] = useState('carrera');
  const [raceName, setRaceName] = useState('');
  
  // New position form
  const [showNewForm, setShowNewForm] = useState(false);
  const [newPosition, setNewPosition] = useState({
    nombre: '',
    descripcion: '',
    turnos: [...DEFAULT_SHIFTS]
  });
  
  // Edit mode
  const [editingPosition, setEditingPosition] = useState(null);
  const [editData, setEditData] = useState(null);
  
  // Expanded positions
  const [expandedPositions, setExpandedPositions] = useState({});
  
  // Clearing assignments
  const [clearing, setClearing] = useState(false);

  // Race date for display
  const [raceDate, setRaceDate] = useState(null);

  // Programación del evento (fechas + duración de turno) para generar turnos
  const [programacion, setProgramacion] = useState({ ...PROGRAMACION_VACIA });
  const [savingProgramacion, setSavingProgramacion] = useState(false);
  const [applyingProgramacion, setApplyingProgramacion] = useState(false);
  const [deletingShifts, setDeletingShifts] = useState(false);

  useEffect(() => {
    loadRaceDate();
  }, []);

  useEffect(() => {
    loadPositions();
    loadProgramacion();
    setShowNewForm(false);
    setEditingPosition(null);
    setEditData(null);
  }, [selectedEvento]);

  const loadRaceDate = async () => {
    try {
      const response = await adminFetch(`${API_URL}/api/race-config/active`);
      if (response.ok) {
        const data = await response.json();
        setRaceDate(data.date);
        setRaceName(data.name || data.race_name || 'Carrera Activa');
      }
    } catch (error) {
      console.error('Error loading race date:', error);
    }
  };

  // Label for the current 'carrera' event uses the active race name
  const getEventoLabel = (value) => {
    if (value === 'carrera') return raceName || 'Carrera Activa';
    const opt = EVENTOS.find(e => e.value === value);
    return opt ? opt.label : value;
  };

  // Calculate the date for a shift based on its start time
  const getShiftDate = (horaInicio) => {
    if (!raceDate || !horaInicio) return '';
    
    const [hours] = horaInicio.split(':').map(Number);
    const baseDate = new Date(raceDate + 'T00:00:00');
    
    // If shift starts between midnight and 8am, it's likely day 2
    if (hours >= 0 && hours < 8) {
      baseDate.setDate(baseDate.getDate() + 1);
    }
    
    return baseDate.toLocaleDateString('es-DO', { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short' 
    });
  };

  const loadPositions = async () => {
    setLoading(true);
    try {
      const response = await adminFetch(`${API_URL}/api/volunteer-config/positions?evento=${selectedEvento}`);
      if (response.ok) {
        const data = await response.json();
        setPositions(data.positions || []);
      }
    } catch (error) {
      console.error('Error loading positions:', error);
      toast.error('Error cargando posiciones');
    } finally {
      setLoading(false);
    }
  };

  const importFromExisting = async () => {
    try {
      const response = await adminFetch(`${API_URL}/api/volunteer-config/import-from-existing`, {
        method: 'POST'
      });
      const data = await response.json();
      
      if (response.ok) {
        toast.success(data.message);
        loadPositions();
      } else {
        toast.error(data.detail || 'Error importando');
      }
    } catch (error) {
      toast.error('Error de conexión');
    }
  };

  const clearAssignments = async () => {
    if (!window.confirm(`⚠️ ¿Limpiar TODAS las asignaciones de voluntarios de "${getEventoLabel(selectedEvento)}"?\n\nEsta acción liberará todos los slots asignados de este evento y no se puede deshacer.`)) {
      return;
    }

    setClearing(true);
    try {
      const response = await adminFetch(`${API_URL}/api/volunteer-config/clear-assignments?evento=${selectedEvento}`, {
        method: 'POST'
      });
      const data = await response.json();

      if (response.ok) {
        toast.success(data.message);
      } else {
        toast.error(data.detail || 'Error limpiando asignaciones');
      }
    } catch (error) {
      toast.error('Error de conexión');
    } finally {
      setClearing(false);
    }
  };

  const deleteAllShifts = async () => {
    if (!window.confirm(`⚠️ ¿Eliminar TODOS los turnos de "${getEventoLabel(selectedEvento)}"?\n\nSe borrarán todos los turnos y sus slots (incluyendo los asignados) de este evento. Las posiciones se conservan sin turnos. Esta acción no se puede deshacer.`)) {
      return;
    }

    setDeletingShifts(true);
    try {
      const response = await adminFetch(`${API_URL}/api/volunteer-config/delete-all-shifts?evento=${selectedEvento}`, {
        method: 'POST'
      });
      const data = await response.json();

      if (response.ok) {
        toast.success(data.message);
        loadPositions();
      } else {
        toast.error(data.detail || 'Error eliminando turnos');
      }
    } catch (error) {
      toast.error('Error de conexión');
    } finally {
      setDeletingShifts(false);
    }
  };

  const loadProgramacion = async () => {
    try {
      const response = await adminFetch(`${API_URL}/api/volunteer-config/event-schedule?evento=${selectedEvento}`);
      if (response.ok) {
        const data = await response.json();
        if (data.schedule) {
          setProgramacion({
            fecha_inicio: data.schedule.fecha_inicio || '',
            fecha_fin: data.schedule.fecha_fin || '',
            duracion_horas: data.schedule.duracion_horas || 4,
            slots_por_turno: data.schedule.slots_por_turno || 2,
          });
        } else {
          setProgramacion({ ...PROGRAMACION_VACIA });
        }
      }
    } catch (error) {
      console.error('Error loading event schedule:', error);
    }
  };

  const validarProgramacion = () => {
    if (!programacion.fecha_inicio || !programacion.fecha_fin) {
      toast.error('Define la fecha y hora de inicio y final del evento');
      return false;
    }
    if (!generarTurnosProgramacion(programacion)) {
      toast.error('Revisa las fechas y la duración del turno: la fecha final debe ser posterior a la inicial');
      return false;
    }
    return true;
  };

  const saveProgramacion = async () => {
    if (!validarProgramacion()) return;

    setSavingProgramacion(true);
    try {
      const response = await adminFetch(`${API_URL}/api/volunteer-config/event-schedule?evento=${selectedEvento}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...programacion,
          duracion_horas: parseFloat(programacion.duracion_horas),
          slots_por_turno: parseInt(programacion.slots_por_turno) || 2,
        })
      });
      const data = await response.json();

      if (response.ok) {
        toast.success(data.message);
      } else {
        toast.error(data.detail || 'Error guardando programación');
      }
    } catch (error) {
      toast.error('Error de conexión');
    } finally {
      setSavingProgramacion(false);
    }
  };

  const applyProgramacion = async () => {
    if (!validarProgramacion()) return;

    const turnos = generarTurnosProgramacion(programacion);
    if (!window.confirm(`⚠️ ¿Generar ${turnos.length} turnos en TODAS las posiciones de "${getEventoLabel(selectedEvento)}"?\n\nLos turnos y slots actuales de este evento (incluyendo asignaciones) serán reemplazados. Esta acción no se puede deshacer.`)) {
      return;
    }

    setApplyingProgramacion(true);
    try {
      const response = await adminFetch(`${API_URL}/api/volunteer-config/apply-schedule?evento=${selectedEvento}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...programacion,
          duracion_horas: parseFloat(programacion.duracion_horas),
          slots_por_turno: parseInt(programacion.slots_por_turno) || 2,
        })
      });
      const data = await response.json();

      if (response.ok) {
        toast.success(data.message);
        loadPositions();
      } else {
        toast.error(data.detail || 'Error generando turnos');
      }
    } catch (error) {
      toast.error('Error de conexión');
    } finally {
      setApplyingProgramacion(false);
    }
  };

  const handleCreatePosition = async () => {
    if (!newPosition.nombre.trim()) {
      toast.error('El nombre de la posición es requerido');
      return;
    }
    
    if (newPosition.turnos.length === 0) {
      toast.error('Agrega al menos un turno');
      return;
    }
    
    setSaving(true);
    try {
      const response = await adminFetch(`${API_URL}/api/volunteer-config/positions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newPosition, evento: selectedEvento })
      });
      
      if (response.ok) {
        toast.success('Posición creada exitosamente');
        setNewPosition({ nombre: '', descripcion: '', turnos: [...DEFAULT_SHIFTS] });
        setShowNewForm(false);
        loadPositions();
      } else {
        const data = await response.json();
        toast.error(data.detail || 'Error creando posición');
      }
    } catch (error) {
      toast.error('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePosition = async (nombre) => {
    if (!editData) return;
    
    setSaving(true);
    try {
      const response = await adminFetch(`${API_URL}/api/volunteer-config/positions/${encodeURIComponent(nombre)}?evento=${selectedEvento}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData)
      });
      
      if (response.ok) {
        toast.success('Posición actualizada');
        setEditingPosition(null);
        setEditData(null);
        loadPositions();
      } else {
        const data = await response.json();
        toast.error(data.detail || 'Error actualizando');
      }
    } catch (error) {
      toast.error('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePosition = async (nombre) => {
    if (!window.confirm(`¿Eliminar la posición "${nombre}" y todos sus slots?`)) return;
    
    try {
      const response = await adminFetch(`${API_URL}/api/volunteer-config/positions/${encodeURIComponent(nombre)}?evento=${selectedEvento}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        toast.success('Posición eliminada');
        loadPositions();
      } else {
        const data = await response.json();
        toast.error(data.detail || 'Error eliminando');
      }
    } catch (error) {
      toast.error('Error de conexión');
    }
  };

  const startEdit = (position) => {
    setEditingPosition(position.nombre);
    setEditData({
      nombre: position.nombre,
      descripcion: position.descripcion || '',
      turnos: [...position.turnos]
    });
  };

  const cancelEdit = () => {
    setEditingPosition(null);
    setEditData(null);
  };

  const toggleExpand = (nombre) => {
    setExpandedPositions(prev => ({
      ...prev,
      [nombre]: !prev[nombre]
    }));
  };

  const updateShift = (turnos, setTurnos, index, field, value) => {
    const updated = [...turnos];
    updated[index] = { ...updated[index], [field]: value };
    setTurnos(updated);
  };

  // El turno nuevo continúa la secuencia: arranca donde terminó el anterior y
  // dura lo mismo. Si el anterior cruzó la medianoche, el nuevo cae al día siguiente.
  const addShift = (turnos, setTurnos) => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const usedLetters = turnos.map(t => t.turno);
    const nextLetter = letters.split('').find(l => !usedLetters.includes(l)) || 'X';

    const anterior = turnos[turnos.length - 1];
    let horaInicio = '08:00';
    let horaFin = '12:00';
    let diaTipo = 'carrera_dia1';

    if (anterior) {
      const inicioPrev = toMinutos(anterior.hora_inicio);
      const finPrev = toMinutos(anterior.hora_fin);
      const cruzaMedianoche = finPrev <= inicioPrev;
      const duracion = cruzaMedianoche ? finPrev - inicioPrev + 1440 : finPrev - inicioPrev;

      horaInicio = toHora(finPrev);
      horaFin = toHora(finPrev + duracion);
      diaTipo = cruzaMedianoche
        ? siguienteDiaTipo(anterior.dia_tipo || 'carrera_dia1')
        : (anterior.dia_tipo || 'carrera_dia1');
    }

    setTurnos([...turnos, {
      turno: nextLetter,
      hora_inicio: horaInicio,
      hora_fin: horaFin,
      slots_count: 2,
      dia_tipo: diaTipo
    }]);
  };

  const removeShift = (turnos, setTurnos, index) => {
    setTurnos(turnos.filter((_, i) => i !== index));
  };

  // Shift editor component
  const ShiftEditor = ({ turnos, setTurnos, disabled = false }) => {
    // Get color classes based on dia_tipo
    const getDiaTipoClasses = (diaTipo) => {
      const info = getDiaTipoInfo(diaTipo);
      switch(info.color) {
        case 'purple': return 'border-purple-300 bg-purple-50 text-purple-700';
        case 'blue': return 'border-blue-300 bg-blue-50 text-blue-700';
        case 'green': return 'border-green-300 bg-green-50 text-green-700';
        case 'orange': return 'border-orange-300 bg-orange-50 text-orange-700';
        default: return 'border-gray-300 bg-gray-50 text-gray-700';
      }
    };

    return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Label className="text-sm font-medium">Turnos</Label>
        {!disabled && (
          <div className="flex gap-2 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const generados = generarTurnosProgramacion(programacion);
                if (!generados) {
                  toast.error('Configura y guarda primero la programación del evento (fechas y duración del turno)');
                  return;
                }
                if (turnos.length > 0 && !window.confirm(`Se reemplazarán los ${turnos.length} turnos actuales por ${generados.length} turnos generados según la programación del evento. ¿Continuar?`)) {
                  return;
                }
                setTurnos(generados);
              }}
              className="text-primary"
            >
              <Wand2 className="w-3 h-3 mr-1" />
              Generar según Programación
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addShift(turnos, setTurnos)}
            >
              <Plus className="w-3 h-3 mr-1" />
              Agregar Turno
            </Button>
          </div>
        )}
      </div>
      
      <div className="space-y-2">
        {turnos.map((turno, index) => (
          <div key={index} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg flex-wrap">
            <div className="w-14">
              <Input
                value={turno.turno}
                onChange={(e) => updateShift(turnos, setTurnos, index, 'turno', e.target.value.toUpperCase())}
                placeholder="A"
                maxLength={2}
                disabled={disabled}
                className="text-center font-bold"
              />
            </div>
            <select
              value={turno.dia_tipo || 'carrera_dia1'}
              onChange={(e) => updateShift(turnos, setTurnos, index, 'dia_tipo', e.target.value)}
              disabled={disabled}
              className={`px-2 py-1.5 text-xs border rounded-md ${getDiaTipoClasses(turno.dia_tipo)}`}
            >
              {DIA_TIPO_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <div className="flex items-center gap-1 flex-1">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <Input
                type="time"
                value={turno.hora_inicio}
                onChange={(e) => updateShift(turnos, setTurnos, index, 'hora_inicio', e.target.value)}
                disabled={disabled}
                className="w-28"
              />
              <span className="text-muted-foreground">-</span>
              <Input
                type="time"
                value={turno.hora_fin}
                onChange={(e) => updateShift(turnos, setTurnos, index, 'hora_fin', e.target.value)}
                disabled={disabled}
                className="w-28"
              />
            </div>
            <div className="flex items-center gap-1 w-24">
              <Users className="w-4 h-4 text-muted-foreground" />
              <Input
                type="number"
                min="1"
                max="20"
                value={turno.slots_count}
                onChange={(e) => updateShift(turnos, setTurnos, index, 'slots_count', parseInt(e.target.value) || 1)}
                disabled={disabled}
                className="w-16"
              />
            </div>
            {!disabled && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeShift(turnos, setTurnos, index)}
                className="text-red-500 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        ))}
        
        {turnos.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No hay turnos configurados. Agrega al menos uno.
          </p>
        )}
      </div>
    </div>
  );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold">Configuración de Turnos</h2>
          <p className="text-muted-foreground">Posiciones y turnos para: <span className="font-medium text-foreground">{getEventoLabel(selectedEvento)}</span></p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {positions.length === 0 && selectedEvento === 'carrera' && (
            <Button variant="outline" onClick={importFromExisting}>
              <Download className="w-4 h-4 mr-2" />
              Importar Existentes
            </Button>
          )}
          <Button
            variant="outline"
            onClick={clearAssignments}
            disabled={clearing}
            className="text-orange-600 border-orange-300 hover:bg-orange-50 hover:text-orange-700"
          >
            {clearing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RotateCcw className="w-4 h-4 mr-2" />
            )}
            Limpiar Asignaciones
          </Button>
          <Button
            variant="outline"
            onClick={deleteAllShifts}
            disabled={deletingShifts}
            className="text-red-600 border-red-300 hover:bg-red-50 hover:text-red-700"
          >
            {deletingShifts ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4 mr-2" />
            )}
            Eliminar Todos los Turnos
          </Button>
          <Button onClick={() => setShowNewForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Posición
          </Button>
        </div>
      </div>

      {/* Event Selector (top-level grouping) */}
      <div className="flex flex-wrap gap-2 border-b pb-3" data-testid="volunteer-event-selector">
        {EVENTOS.map((ev) => (
          <button
            key={ev.value}
            type="button"
            data-testid={`event-tab-${ev.value}`}
            onClick={() => setSelectedEvento(ev.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedEvento === ev.value
                ? 'bg-primary text-white shadow'
                : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            {getEventoLabel(ev.value)}
          </button>
        ))}
      </div>

      {/* Programación del Evento: fechas, duración de turno y generación automática */}
      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-primary" />
            Programación del Evento
          </CardTitle>
          <CardDescription>
            Define el inicio y final del evento y la duración de cada turno para que el sistema los genere automáticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Inicio del Evento *</Label>
              <Input
                type="datetime-local"
                value={programacion.fecha_inicio}
                onChange={(e) => setProgramacion({ ...programacion, fecha_inicio: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Final del Evento *</Label>
              <Input
                type="datetime-local"
                value={programacion.fecha_fin}
                onChange={(e) => setProgramacion({ ...programacion, fecha_fin: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Duración del Turno (horas)</Label>
              <Input
                type="number"
                min="0.5"
                step="0.5"
                value={programacion.duracion_horas}
                onChange={(e) => setProgramacion({ ...programacion, duracion_horas: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Slots por Turno</Label>
              <Input
                type="number"
                min="1"
                max="20"
                value={programacion.slots_por_turno}
                onChange={(e) => setProgramacion({ ...programacion, slots_por_turno: e.target.value })}
              />
            </div>
          </div>
          {(() => {
            const preview = generarTurnosProgramacion(programacion);
            return preview ? (
              <p className="text-sm text-muted-foreground">
                Se generarán <span className="font-medium text-foreground">{preview.length} turnos</span> por posición:{' '}
                {preview[0].turno} ({formatTime12h(preview[0].hora_inicio)}) hasta{' '}
                {preview[preview.length - 1].turno} (termina {formatTime12h(preview[preview.length - 1].hora_fin)}).
              </p>
            ) : null;
          })()}
          <div className="flex justify-end gap-2 flex-wrap">
            <Button variant="outline" onClick={saveProgramacion} disabled={savingProgramacion}>
              {savingProgramacion ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Guardar Programación
            </Button>
            <Button onClick={applyProgramacion} disabled={applyingProgramacion || positions.length === 0}>
              {applyingProgramacion ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
              Generar Turnos en Todas las Posiciones
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{positions.length}</div>
            <div className="text-sm text-muted-foreground">Posiciones</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {positions.reduce((acc, p) => acc + (p.turnos?.length || 0), 0)}
            </div>
            <div className="text-sm text-muted-foreground">Turnos Totales</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {positions.reduce((acc, p) => 
                acc + (p.turnos?.reduce((a, t) => a + (t.slots_count || 0), 0) || 0), 0
              )}
            </div>
            <div className="text-sm text-muted-foreground">Slots Configurados</div>
          </CardContent>
        </Card>
      </div>

      {/* New Position Form */}
      {showNewForm && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg">Nueva Posición</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre de la Posición *</Label>
                <Input
                  value={newPosition.nombre}
                  onChange={(e) => setNewPosition({...newPosition, nombre: e.target.value})}
                  placeholder="Ej: Hidratación y Snacks"
                />
              </div>
              <div className="space-y-2">
                <Label>Descripción</Label>
                <Input
                  value={newPosition.descripcion}
                  onChange={(e) => setNewPosition({...newPosition, descripcion: e.target.value})}
                  placeholder="Descripción opcional"
                />
              </div>
            </div>
            
            <ShiftEditor 
              turnos={newPosition.turnos}
              setTurnos={(turnos) => setNewPosition({...newPosition, turnos})}
            />
            
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowNewForm(false)}>
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
              <Button onClick={handleCreatePosition} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Crear Posición
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Positions List */}
      {positions.length === 0 && !showNewForm ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No hay posiciones configuradas</h3>
            <p className="text-muted-foreground mb-4">
              Crea posiciones y turnos para que los voluntarios puedan seleccionarlos al registrarse.
            </p>
            <div className="flex justify-center gap-2">
              {selectedEvento === 'carrera' && (
                <Button variant="outline" onClick={importFromExisting}>
                  <Download className="w-4 h-4 mr-2" />
                  Importar de Datos Existentes
                </Button>
              )}
              <Button onClick={() => setShowNewForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Crear Primera Posición
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {positions.map((position) => (
            <Card key={position.nombre} className={editingPosition === position.nombre ? 'border-primary' : ''}>
              <CardHeader className="py-4">
                <div className="flex items-center justify-between">
                  <div 
                    className="flex items-center gap-3 cursor-pointer flex-1"
                    onClick={() => toggleExpand(position.nombre)}
                  >
                    {expandedPositions[position.nombre] ? (
                      <ChevronUp className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    )}
                    <div>
                      <CardTitle className="text-base">{position.nombre}</CardTitle>
                      {position.descripcion && (
                        <CardDescription className="text-sm">{position.descripcion}</CardDescription>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {position.turnos?.length || 0} turnos
                    </Badge>
                    <Badge variant="secondary">
                      {position.turnos?.reduce((acc, t) => acc + (t.slots_count || 0), 0) || 0} slots
                    </Badge>
                    {editingPosition !== position.nombre && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => startEdit(position)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-red-500 hover:text-red-700"
                          onClick={() => handleDeletePosition(position.nombre)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              
              {(expandedPositions[position.nombre] || editingPosition === position.nombre) && (
                <CardContent className="pt-0">
                  {editingPosition === position.nombre ? (
                    <div className="space-y-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Nombre</Label>
                          <Input
                            value={editData.nombre}
                            onChange={(e) => setEditData({...editData, nombre: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Descripción</Label>
                          <Input
                            value={editData.descripcion}
                            onChange={(e) => setEditData({...editData, descripcion: e.target.value})}
                          />
                        </div>
                      </div>
                      
                      <ShiftEditor 
                        turnos={editData.turnos}
                        setTurnos={(turnos) => setEditData({...editData, turnos})}
                      />
                      
                      <div className="flex justify-end gap-2 pt-4 border-t">
                        <Button variant="outline" onClick={cancelEdit}>
                          <X className="w-4 h-4 mr-2" />
                          Cancelar
                        </Button>
                        <Button onClick={() => handleUpdatePosition(position.nombre)} disabled={saving}>
                          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                          Guardar Cambios
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {position.turnos?.map((turno, idx) => (
                        <div key={idx} className="flex items-center gap-4 p-2 bg-muted/30 rounded">
                          <Badge>{turno.turno}</Badge>
                          <span className="text-sm text-muted-foreground">
                            {getShiftDate(turno.hora_inicio)}
                          </span>
                          <span className="text-sm">
                            <Clock className="w-3 h-3 inline mr-1" />
                            {formatTime12h(turno.hora_inicio)} - {formatTime12h(turno.hora_fin)}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            <Users className="w-3 h-3 inline mr-1" />
                            {turno.slots_count} slots
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
