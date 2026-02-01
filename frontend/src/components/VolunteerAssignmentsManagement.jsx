import React, { useState, useEffect } from 'react';
import { Search, Plus, Trash2, Users, RefreshCw, Filter, Clock, MapPin, ChevronDown, ChevronRight, X, UserX } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function VolunteerAssignmentsManagement() {
  const [volunteers, setVolunteers] = useState([]);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedVolunteer, setExpandedVolunteer] = useState(null);
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [showDeleteVolunteerModal, setShowDeleteVolunteerModal] = useState(false);
  const [selectedVolunteer, setSelectedVolunteer] = useState(null);
  const [selectedSlotToRemove, setSelectedSlotToRemove] = useState(null);
  const [selectedSlotToAdd, setSelectedSlotToAdd] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Load data
  const loadData = async () => {
    setLoading(true);
    try {
      const [volunteersRes, slotsRes] = await Promise.all([
        fetch(`${API_URL}/api/volunteer-registration/admin/registrations`),
        fetch(`${API_URL}/api/volunteers/slots`)
      ]);
      
      if (volunteersRes.ok) {
        const data = await volunteersRes.json();
        setVolunteers(data.registrations || data || []);
      }
      
      if (slotsRes.ok) {
        const slotsData = await slotsRes.json();
        setAvailableSlots(slotsData || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error cargando datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Format time to 12h
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

  // Get slot info by ID
  const getSlotInfo = (slotId) => {
    return availableSlots.find(s => s.id === slotId);
  };

  // Get available slots for adding (not assigned to anyone)
  const getAvailableSlotsForVolunteer = () => {
    return availableSlots.filter(slot => !slot.email_asignado);
  };

  // Group available slots by position
  const groupSlotsByPosition = (slots) => {
    const grouped = {};
    slots.forEach(slot => {
      if (!grouped[slot.puesto]) {
        grouped[slot.puesto] = [];
      }
      grouped[slot.puesto].push(slot);
    });
    return grouped;
  };

  // Filter volunteers
  const filteredVolunteers = volunteers.filter(v => {
    const term = searchTerm.toLowerCase();
    return !searchTerm || 
      (v.nombre && v.nombre.toLowerCase().includes(term)) ||
      (v.apellidos && v.apellidos.toLowerCase().includes(term)) ||
      (v.email && v.email.toLowerCase().includes(term));
  });

  // Handle add assignment
  const handleAddAssignment = async () => {
    if (!selectedVolunteer || !selectedSlotToAdd) return;
    
    setActionLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/volunteers/assign/${selectedSlotToAdd.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: selectedVolunteer.email })
      });
      
      if (response.ok) {
        toast.success('Turno asignado correctamente');
        setShowAddModal(false);
        setSelectedSlotToAdd(null);
        loadData();
      } else {
        const data = await response.json();
        toast.error(data.detail || 'Error al asignar turno');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error de conexión');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle remove assignment
  const handleRemoveAssignment = async () => {
    if (!selectedVolunteer || !selectedSlotToRemove) return;
    
    setActionLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/volunteers/unassign/${selectedSlotToRemove.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: selectedVolunteer.email })
      });
      
      if (response.ok) {
        toast.success('Asignación eliminada');
        setShowRemoveModal(false);
        setSelectedSlotToRemove(null);
        loadData();
      } else {
        const data = await response.json();
        toast.error(data.detail || 'Error al eliminar asignación');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error de conexión');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle delete volunteer
  const handleDeleteVolunteer = async () => {
    if (!selectedVolunteer) return;
    
    setActionLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/volunteer-registration/admin/registrations/${encodeURIComponent(selectedVolunteer.email)}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        toast.success('Voluntario eliminado correctamente');
        setShowDeleteVolunteerModal(false);
        setSelectedVolunteer(null);
        setExpandedVolunteer(null);
        loadData();
      } else {
        const data = await response.json();
        toast.error(data.detail || 'Error al eliminar voluntario');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error de conexión');
    } finally {
      setActionLoading(false);
    }
  };

  // Open add modal
  const openAddModal = (volunteer) => {
    setSelectedVolunteer(volunteer);
    setSelectedSlotToAdd(null);
    setShowAddModal(true);
  };

  // Open remove modal
  const openRemoveModal = (volunteer, slotId) => {
    setSelectedVolunteer(volunteer);
    const slotInfo = getSlotInfo(slotId);
    setSelectedSlotToRemove(slotInfo);
    setShowRemoveModal(true);
  };

  // Open delete volunteer modal
  const openDeleteVolunteerModal = (volunteer) => {
    setSelectedVolunteer(volunteer);
    setShowDeleteVolunteerModal(true);
  };

  // Statistics
  const totalVolunteers = volunteers.length;
  const volunteersWithAssignments = volunteers.filter(v => 
    (v.slots_interes && v.slots_interes.length > 0) || 
    availableSlots.some(s => s.email_asignado === v.email)
  ).length;
  const totalAssignments = availableSlots.filter(s => s.email_asignado).length;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-blue-700">{totalVolunteers}</div>
            <div className="text-sm text-blue-600">Voluntarios Registrados</div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-green-700">{volunteersWithAssignments}</div>
            <div className="text-sm text-green-600">Con Asignaciones</div>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-purple-700">{totalAssignments}</div>
            <div className="text-sm text-purple-600">Turnos Asignados</div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Refresh */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5" />
              Voluntarios Registrados
            </CardTitle>
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Volunteers List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando...</div>
          ) : filteredVolunteers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? 'No se encontraron voluntarios' : 'No hay voluntarios registrados'}
            </div>
          ) : (
            <div className="divide-y">
              {filteredVolunteers.map((volunteer) => {
                const isExpanded = expandedVolunteer === volunteer.email;
                const assignedSlots = availableSlots.filter(s => s.email_asignado === volunteer.email);
                const interestSlots = volunteer.slots_interes || [];
                const totalSlots = assignedSlots.length + interestSlots.length;
                
                return (
                  <div key={volunteer.email} className="hover:bg-muted/30">
                    {/* Volunteer Header */}
                    <div 
                      className="p-4 flex items-center justify-between cursor-pointer"
                      onClick={() => setExpandedVolunteer(isExpanded ? null : volunteer.email)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-primary font-semibold">
                            {volunteer.nombre?.[0]}{volunteer.apellidos?.[0]}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium">{volunteer.nombre} {volunteer.apellidos}</div>
                          <div className="text-sm text-muted-foreground">{volunteer.email}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {assignedSlots.length > 0 && (
                          <Badge variant="default">
                            {assignedSlots.length} asignado{assignedSlots.length !== 1 ? 's' : ''}
                          </Badge>
                        )}
                        {interestSlots.length > 0 && (
                          <Badge variant="outline">
                            {interestSlots.length} de interés
                          </Badge>
                        )}
                        {totalSlots === 0 && (
                          <Badge variant="secondary">Sin turnos</Badge>
                        )}
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="px-4 pb-4 bg-muted/20">
                        <div className="ml-14 space-y-4">
                          {/* Contact Info */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm py-3 border-b">
                            <div>
                              <span className="text-muted-foreground">Teléfono:</span>
                              <div className="font-medium">{volunteer.telefono || '-'}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Ciudad:</span>
                              <div className="font-medium">{volunteer.ciudad_residencia || '-'}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Experiencia:</span>
                              <div className="font-medium">{volunteer.experiencia_voluntariado || '-'}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Talla:</span>
                              <div className="font-medium">{volunteer.talla_camiseta || '-'}</div>
                            </div>
                          </div>

                          {/* Assigned Shifts */}
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-semibold text-sm">Turnos Asignados</h4>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openAddModal(volunteer);
                                }}
                              >
                                <Plus className="w-4 h-4 mr-1" />
                                Agregar Turno
                              </Button>
                            </div>
                            
                            {assignedSlots.length === 0 ? (
                              <p className="text-sm text-muted-foreground italic">
                                No tiene turnos asignados actualmente
                              </p>
                            ) : (
                              <div className="grid gap-2">
                                {assignedSlots.map((slot) => (
                                  <div 
                                    key={slot.id}
                                    className="flex items-center justify-between p-3 bg-background rounded-lg border"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
                                        <MapPin className="w-4 h-4 text-primary" />
                                      </div>
                                      <div>
                                        <div className="font-medium text-sm">{slot.puesto}</div>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                          <Badge variant="outline" className="text-xs">
                                            Turno {slot.turno}
                                          </Badge>
                                          <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {formatTime(slot.hora_inicio)} - {formatTime(slot.hora_fin)}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openRemoveModal(volunteer, slot.id);
                                      }}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Interest Slots (from registration) */}
                          {volunteer.slots_interes && volunteer.slots_interes.length > 0 && (
                            <div className="pt-3 border-t">
                              <h4 className="font-semibold text-sm mb-2 text-muted-foreground">
                                Turnos de Interés (del registro)
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {volunteer.slots_interes.map((slotId) => {
                                  const slotInfo = getSlotInfo(slotId);
                                  return (
                                    <Badge key={slotId} variant="outline" className="text-xs">
                                      {slotInfo ? `${slotInfo.puesto} - Turno ${slotInfo.turno}` : `Slot #${slotId}`}
                                    </Badge>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Delete Volunteer Button */}
                          <div className="pt-4 border-t">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                              onClick={(e) => {
                                e.stopPropagation();
                                openDeleteVolunteerModal(volunteer);
                              }}
                            >
                              <UserX className="w-4 h-4 mr-2" />
                              Eliminar Voluntario
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Assignment Modal */}
      {showAddModal && selectedVolunteer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <CardHeader className="flex-shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Plus className="w-5 h-5 text-green-600" />
                  Agregar Turno a {selectedVolunteer.nombre}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowAddModal(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto space-y-4">
              <p className="text-sm text-muted-foreground">
                Selecciona un turno disponible para asignar a este voluntario:
              </p>
              
              {Object.entries(groupSlotsByPosition(getAvailableSlotsForVolunteer())).length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  No hay turnos disponibles para asignar
                </p>
              ) : (
                <div className="space-y-4">
                  {Object.entries(groupSlotsByPosition(getAvailableSlotsForVolunteer())).map(([position, slots]) => (
                    <div key={position}>
                      <h4 className="font-semibold text-sm mb-2">{position}</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {slots.map((slot) => (
                          <div
                            key={slot.id}
                            onClick={() => setSelectedSlotToAdd(slot)}
                            className={`
                              p-3 rounded-lg border-2 cursor-pointer transition-all text-sm
                              ${selectedSlotToAdd?.id === slot.id 
                                ? 'border-primary bg-primary/10' 
                                : 'border-gray-200 hover:border-primary/50'}
                            `}
                          >
                            <Badge variant="outline" className="text-xs mb-1">
                              Turno {slot.turno}
                            </Badge>
                            <div className="text-xs text-muted-foreground">
                              {formatTime(slot.hora_inicio)} - {formatTime(slot.hora_fin)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowAddModal(false)}
                  disabled={actionLoading}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleAddAssignment}
                  disabled={!selectedSlotToAdd || actionLoading}
                >
                  {actionLoading ? 'Asignando...' : 'Asignar Turno'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Remove Assignment Modal */}
      {showRemoveModal && selectedVolunteer && selectedSlotToRemove && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-600" />
                Eliminar Asignación
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                ¿Estás seguro de que deseas eliminar esta asignación?
              </p>
              
              <div className="p-4 bg-muted rounded-lg">
                <div className="font-medium">{selectedVolunteer.nombre} {selectedVolunteer.apellidos}</div>
                <div className="text-sm text-muted-foreground mt-2">
                  <strong>Posición:</strong> {selectedSlotToRemove.puesto}
                </div>
                <div className="text-sm text-muted-foreground">
                  <strong>Turno:</strong> {selectedSlotToRemove.turno} ({formatTime(selectedSlotToRemove.hora_inicio)} - {formatTime(selectedSlotToRemove.hora_fin)})
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowRemoveModal(false)}
                  disabled={actionLoading}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  onClick={handleRemoveAssignment}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Eliminando...' : 'Eliminar'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Volunteer Modal */}
      {showDeleteVolunteerModal && selectedVolunteer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserX className="w-5 h-5 text-red-600" />
                Eliminar Voluntario
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">
                  <strong>⚠️ Advertencia:</strong> Esta acción eliminará permanentemente el registro del voluntario 
                  y todas sus asignaciones de turnos.
                </p>
              </div>
              
              <div className="p-4 bg-muted rounded-lg">
                <div className="font-medium">{selectedVolunteer.nombre} {selectedVolunteer.apellidos}</div>
                <div className="text-sm text-muted-foreground">{selectedVolunteer.email}</div>
                {selectedVolunteer.telefono && (
                  <div className="text-sm text-muted-foreground">{selectedVolunteer.telefono}</div>
                )}
              </div>

              <p className="text-sm text-muted-foreground">
                ¿Estás seguro de que deseas eliminar este voluntario?
              </p>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowDeleteVolunteerModal(false)}
                  disabled={actionLoading}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  onClick={handleDeleteVolunteer}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Eliminando...' : 'Eliminar Voluntario'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
