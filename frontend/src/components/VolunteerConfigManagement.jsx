import React, { useState, useEffect } from 'react';
import { 
  Plus, Trash2, Edit2, Save, X, Clock, Users, AlertCircle, 
  Loader2, Download, RefreshCw, ChevronDown, ChevronUp, RotateCcw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { toast } from 'sonner';

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
  { turno: "A", hora_inicio: "08:00", hora_fin: "12:00", slots_count: 2, dia_tipo: "carrera" },
  { turno: "B", hora_inicio: "12:00", hora_fin: "16:00", slots_count: 2, dia_tipo: "carrera" },
  { turno: "C", hora_inicio: "16:00", hora_fin: "20:00", slots_count: 2, dia_tipo: "carrera" },
  { turno: "D", hora_inicio: "20:00", hora_fin: "00:00", slots_count: 2, dia_tipo: "carrera" },
  { turno: "E", hora_inicio: "00:00", hora_fin: "04:00", slots_count: 2, dia_tipo: "carrera" },
  { turno: "F", hora_inicio: "04:00", hora_fin: "08:00", slots_count: 2, dia_tipo: "carrera" },
];

// Day type options
const DIA_TIPO_OPTIONS = [
  { value: "previo", label: "Día Previo" },
  { value: "carrera", label: "Día de Carrera" }
];

export default function VolunteerConfigManagement() {
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
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

  useEffect(() => {
    loadPositions();
    loadRaceDate();
  }, []);

  const loadRaceDate = async () => {
    try {
      const response = await fetch(`${API_URL}/api/race-config/active`);
      if (response.ok) {
        const data = await response.json();
        setRaceDate(data.date);
      }
    } catch (error) {
      console.error('Error loading race date:', error);
    }
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
      const response = await fetch(`${API_URL}/api/volunteer-config/positions`);
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
      const response = await fetch(`${API_URL}/api/volunteer-config/import-from-existing`, {
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
    if (!window.confirm('⚠️ ¿Estás seguro de limpiar TODAS las asignaciones de voluntarios?\n\nEsta acción liberará todos los slots asignados y no se puede deshacer.')) {
      return;
    }
    
    setClearing(true);
    try {
      const response = await fetch(`${API_URL}/api/volunteer-config/clear-assignments`, {
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
      const response = await fetch(`${API_URL}/api/volunteer-config/positions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPosition)
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
      const response = await fetch(`${API_URL}/api/volunteer-config/positions/${encodeURIComponent(nombre)}`, {
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
      const response = await fetch(`${API_URL}/api/volunteer-config/positions/${encodeURIComponent(nombre)}`, {
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

  const addShift = (turnos, setTurnos) => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const usedLetters = turnos.map(t => t.turno);
    const nextLetter = letters.split('').find(l => !usedLetters.includes(l)) || 'X';
    
    setTurnos([...turnos, {
      turno: nextLetter,
      hora_inicio: '08:00',
      hora_fin: '12:00',
      slots_count: 2,
      dia_tipo: 'carrera'
    }]);
  };

  const removeShift = (turnos, setTurnos, index) => {
    setTurnos(turnos.filter((_, i) => i !== index));
  };

  // Shift editor component
  const ShiftEditor = ({ turnos, setTurnos, disabled = false }) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Turnos</Label>
        {!disabled && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addShift(turnos, setTurnos)}
          >
            <Plus className="w-3 h-3 mr-1" />
            Agregar Turno
          </Button>
        )}
      </div>
      
      <div className="space-y-2">
        {turnos.map((turno, index) => (
          <div key={index} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
            <div className="w-16">
              <Input
                value={turno.turno}
                onChange={(e) => updateShift(turnos, setTurnos, index, 'turno', e.target.value.toUpperCase())}
                placeholder="A"
                maxLength={2}
                disabled={disabled}
                className="text-center font-bold"
              />
            </div>
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
          <p className="text-muted-foreground">Administra las posiciones y turnos disponibles para voluntarios</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {positions.length === 0 && (
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
          <Button onClick={() => setShowNewForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Posición
          </Button>
        </div>
      </div>

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
              <Button variant="outline" onClick={importFromExisting}>
                <Download className="w-4 h-4 mr-2" />
                Importar de Datos Existentes
              </Button>
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
