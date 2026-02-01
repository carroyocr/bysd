import React, { useState, useEffect } from 'react';
import { Search, X, Check, Trash2, Users, Calendar, RefreshCw, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function VolunteerAssignmentsManagement() {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [filterPosition, setFilterPosition] = useState('');
  const [filterShift, setFilterShift] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [positions, setPositions] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showUnassignModal, setShowUnassignModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [emailInput, setEmailInput] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

  // Load slots data
  const loadSlots = async () => {
    setLoading(true);
    try {
      const [slotsRes, posRes] = await Promise.all([
        fetch(`${API_URL}/api/volunteer/slots`),
        fetch(`${API_URL}/api/volunteer-config/positions`)
      ]);
      if (slotsRes.ok) setSlots(await slotsRes.json());
      if (posRes.ok) {
        const posData = await posRes.json();
        // Handle both array and {positions: []} formats
        setPositions(Array.isArray(posData) ? posData : posData.positions || []);
      }
    } catch (error) {
      console.error('Error loading slots:', error);
      toast.error('Error cargando datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSlots();
  }, []);

  // Extract unique shifts from slots
  useEffect(() => {
    if (slots.length > 0) {
      const uniqueShifts = [...new Set(slots.map(s => s.turno))].sort();
      setShifts(uniqueShifts);
    }
  }, [slots]);

  const handleAssign = async () => {
    if (!selectedSlot || !emailInput.trim()) return;
    
    setActionLoading(true);
    setActionMessage(null);
    
    try {
      const response = await fetch(`${API_URL}/api/volunteer/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slot_id: selectedSlot.id,
          email: emailInput.trim().toLowerCase()
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast.success('Voluntario asignado correctamente');
        setShowAssignModal(false);
        setEmailInput('');
        loadSlots();
      } else {
        const errorMsg = data.detail || 'Error al asignar';
        toast.error(errorMsg);
        setActionMessage({ type: 'error', text: errorMsg });
      }
    } catch (error) {
      console.error('Error assigning:', error);
      const errorMsg = 'Error de conexión';
      toast.error(errorMsg);
      setActionMessage({ type: 'error', text: errorMsg });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnassign = async () => {
    if (!selectedSlot || !emailInput.trim()) return;
    
    setActionLoading(true);
    setActionMessage(null);
    
    try {
      const response = await fetch(`${API_URL}/api/volunteer/unassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slot_id: selectedSlot.id,
          email: emailInput.trim().toLowerCase()
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast.success('Asignación eliminada correctamente');
        setShowUnassignModal(false);
        setEmailInput('');
        loadSlots();
      } else {
        const errorMsg = data.detail || 'Error al eliminar asignación';
        toast.error(errorMsg);
        setActionMessage({ type: 'error', text: errorMsg });
      }
    } catch (error) {
      console.error('Error unassigning:', error);
      const errorMsg = 'Error de conexión';
      toast.error(errorMsg);
      setActionMessage({ type: 'error', text: errorMsg });
    } finally {
      setActionLoading(false);
    }
  };

  const openAssignModal = (slot) => {
    setSelectedSlot(slot);
    setEmailInput('');
    setActionMessage(null);
    setShowAssignModal(true);
  };

  const openUnassignModal = (slot) => {
    setSelectedSlot(slot);
    setEmailInput('');
    setActionMessage(null);
    setShowUnassignModal(true);
  };

  const formatTime = (time) => {
    if (!time) return '';
    if (time.includes(':')) {
      const parts = time.split(':');
      let hour = parseInt(parts[0], 10);
      const minutes = parts[1];
      const ampm = hour >= 12 ? 'PM' : 'AM';
      hour = hour % 12;
      if (hour === 0) hour = 12;
      return `${hour}:${minutes} ${ampm}`;
    }
    return time;
  };

  // Filter slots
  const filteredSlots = slots.filter(slot => {
    const matchesName = !filterName || 
      (slot.nombre_asignado && slot.nombre_asignado.toLowerCase().includes(filterName.toLowerCase())) ||
      (slot.email_asignado && slot.email_asignado.toLowerCase().includes(filterName.toLowerCase()));
    const matchesPosition = !filterPosition || slot.puesto === filterPosition;
    const matchesShift = !filterShift || slot.turno === filterShift;
    const matchesStatus = !filterStatus || 
      (filterStatus === 'assigned' && slot.email_asignado) ||
      (filterStatus === 'available' && !slot.email_asignado);
    
    return matchesName && matchesPosition && matchesShift && matchesStatus;
  });

  // Statistics
  const totalSlots = slots.length;
  const assignedSlots = slots.filter(s => s.email_asignado).length;
  const availableSlots = totalSlots - assignedSlots;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-blue-700">{totalSlots}</div>
            <div className="text-sm text-blue-600">Total Espacios</div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-green-700">{assignedSlots}</div>
            <div className="text-sm text-green-600">Asignados</div>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-amber-700">{availableSlots}</div>
            <div className="text-sm text-amber-600">Disponibles</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filtros
            </CardTitle>
            <Button variant="outline" size="sm" onClick={loadSlots} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o email..."
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              className="h-10 px-3 rounded-md border border-input bg-background text-sm"
              value={filterPosition}
              onChange={(e) => setFilterPosition(e.target.value)}
            >
              <option value="">Todas las posiciones</option>
              {positions.map((pos, idx) => (
                <option key={pos._id || pos.nombre || idx} value={pos.nombre || pos.name}>
                  {pos.nombre || pos.name}
                </option>
              ))}
            </select>
            <select
              className="h-10 px-3 rounded-md border border-input bg-background text-sm"
              value={filterShift}
              onChange={(e) => setFilterShift(e.target.value)}
            >
              <option value="">Todos los turnos</option>
              {shifts.map((shift) => (
                <option key={shift} value={shift}>Turno {shift}</option>
              ))}
            </select>
            <select
              className="h-10 px-3 rounded-md border border-input bg-background text-sm"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">Todos los estados</option>
              <option value="assigned">Asignados</option>
              <option value="available">Disponibles</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Slots Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Asignaciones de Voluntarios
            <Badge variant="secondary" className="ml-2">{filteredSlots.length} resultados</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando...</div>
          ) : filteredSlots.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No se encontraron resultados</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Posición</th>
                    <th className="text-left p-3 font-medium">Turno</th>
                    <th className="text-left p-3 font-medium">Horario</th>
                    <th className="text-left p-3 font-medium">Estado</th>
                    <th className="text-left p-3 font-medium">Voluntario</th>
                    <th className="text-center p-3 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSlots.map((slot) => (
                    <tr key={slot.id} className="border-b hover:bg-muted/30">
                      <td className="p-3">{slot.puesto}</td>
                      <td className="p-3">
                        <Badge variant="outline">Turno {slot.turno}</Badge>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {formatTime(slot.hora_inicio)} - {formatTime(slot.hora_fin)}
                      </td>
                      <td className="p-3">
                        {slot.email_asignado ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                            <Check className="w-3 h-3 mr-1" />
                            Asignado
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Disponible</Badge>
                        )}
                      </td>
                      <td className="p-3">
                        {slot.email_asignado ? (
                          <div>
                            <div className="font-medium">{slot.nombre_asignado || '-'}</div>
                            <div className="text-xs text-muted-foreground">{slot.email_asignado}</div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {slot.email_asignado ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => openUnassignModal(slot)}
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Eliminar
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            onClick={() => openAssignModal(slot)}
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Asignar
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assign Modal */}
      {showAssignModal && selectedSlot && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Check className="w-5 h-5 text-green-600" />
                Asignar Voluntario
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-muted rounded-lg text-sm">
                <div><strong>Posición:</strong> {selectedSlot.puesto}</div>
                <div><strong>Turno:</strong> {selectedSlot.turno}</div>
                <div><strong>Horario:</strong> {formatTime(selectedSlot.hora_inicio)} - {formatTime(selectedSlot.hora_fin)}</div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Email del Voluntario</label>
                <Input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="voluntario@email.com"
                />
                <p className="text-xs text-muted-foreground">
                  El email debe estar registrado en el sistema de voluntarios
                </p>
              </div>

              {actionMessage && (
                <div className={`p-3 rounded-lg text-sm ${
                  actionMessage.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
                }`}>
                  {actionMessage.text}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowAssignModal(false)}
                  disabled={actionLoading}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleAssign}
                  disabled={!emailInput.trim() || actionLoading}
                >
                  {actionLoading ? 'Asignando...' : 'Asignar'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Unassign Modal */}
      {showUnassignModal && selectedSlot && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-600" />
                Eliminar Asignación
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-muted rounded-lg text-sm">
                <div><strong>Posición:</strong> {selectedSlot.puesto}</div>
                <div><strong>Turno:</strong> {selectedSlot.turno}</div>
                <div><strong>Asignado a:</strong> {selectedSlot.email_asignado}</div>
              </div>
              
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                Para eliminar esta asignación, confirma ingresando el email del voluntario asignado.
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Confirmar Email</label>
                <Input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="Ingresa el email para confirmar"
                />
              </div>

              {actionMessage && (
                <div className={`p-3 rounded-lg text-sm ${
                  actionMessage.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
                }`}>
                  {actionMessage.text}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowUnassignModal(false)}
                  disabled={actionLoading}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  onClick={handleUnassign}
                  disabled={!emailInput.trim() || actionLoading}
                >
                  {actionLoading ? 'Procesando...' : 'Eliminar Asignación'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
