import React, { useState, useEffect } from 'react';
import { ClipboardCheck, AlertCircle, Phone, Shirt, Download, Calendar, Search, X, Check, Trash2, Heart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

export default function VolunteersSection() {
  // State for assignments tab
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
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
    setLoadingSlots(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/volunteers/slots`);
      if (response.ok) {
        const data = await response.json();
        setSlots(data);
      }
    } catch (error) {
      console.error('Error loading slots:', error);
    } finally {
      setLoadingSlots(false);
    }
  };

  // Load filter options
  const loadFilterOptions = async () => {
    try {
      const [posRes, shiftRes] = await Promise.all([
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/volunteers/positions`),
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/volunteers/shifts`)
      ]);
      if (posRes.ok) setPositions(await posRes.json());
      if (shiftRes.ok) setShifts(await shiftRes.json());
    } catch (error) {
      console.error('Error loading filter options:', error);
    }
  };

  useEffect(() => {
    loadSlots();
    loadFilterOptions();
  }, []);

  // Filter slots
  const filteredSlots = slots.filter(slot => {
    const matchesName = !filterName || 
      slot.puesto.toLowerCase().includes(filterName.toLowerCase()) ||
      (slot.nombre_asignado && slot.nombre_asignado.toLowerCase().includes(filterName.toLowerCase()));
    const matchesPosition = !filterPosition || slot.puesto === filterPosition;
    const matchesShift = !filterShift || slot.turno === filterShift;
    const matchesStatus = !filterStatus || 
      (filterStatus === 'asignado' && slot.email_asignado) ||
      (filterStatus === 'disponible' && !slot.email_asignado);
    return matchesName && matchesPosition && matchesShift && matchesStatus;
  });

  // Handle assign
  const handleAssign = async () => {
    if (!emailInput.trim() || !selectedSlot) return;
    
    setActionLoading(true);
    setActionMessage(null);
    
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/volunteers/assign/${selectedSlot.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput.trim().toLowerCase() })
      });
      
      const status = res.status;
      const data = await res.json().catch(() => ({}));
      
      if (status >= 200 && status < 300) {
        setActionMessage({ type: 'success', text: data.message || 'Asignación exitosa' });
        loadSlots();
        setTimeout(() => {
          setShowAssignModal(false);
          setEmailInput('');
          setActionMessage(null);
        }, 2000);
      } else {
        setActionMessage({ type: 'error', text: data.detail || 'Error al realizar la asignación' });
      }
    } catch (error) {
      console.error('Error en asignación:', error);
      setActionMessage({ type: 'error', text: 'Error de conexión. Intenta de nuevo.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle unassign
  const handleUnassign = async () => {
    if (!emailInput.trim() || !selectedSlot) return;
    
    setActionLoading(true);
    setActionMessage(null);
    
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/volunteers/unassign/${selectedSlot.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput.trim().toLowerCase() })
      });
      
      const data = await response.clone().json();
      
      if (response.ok) {
        setActionMessage({ type: 'success', text: data.message });
        loadSlots();
        setTimeout(() => {
          setShowUnassignModal(false);
          setEmailInput('');
          setActionMessage(null);
        }, 2000);
      } else {
        setActionMessage({ type: 'error', text: data.detail || 'Error al eliminar la asignación' });
      }
    } catch (error) {
      console.error('Error en desasignación:', error);
      setActionMessage({ type: 'error', text: 'Error de conexión. Intenta de nuevo.' });
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
    const parts = time.split(':');
    if (parts.length >= 2) {
      let hour = parseInt(parts[0], 10);
      const minutes = parts[1];
      const ampm = hour >= 12 ? 'PM' : 'AM';
      hour = hour % 12;
      if (hour === 0) hour = 12;
      return `${hour}:${minutes} ${ampm}`;
    }
    return time;
  };

  const volunteerRoles = [
    {
      title: 'Staff de Registro y Check-in',
      description: 'Manejo de check-in de corredores, responder preguntas sobre el evento',
      requirements: ['Excelente comunicación verbal', 'Rapidez en procesamiento de información', 'Actitud amigable y paciente'],
    },
    {
      title: 'Control de Corral de Salida y Animación',
      description: 'Energizar corredores antes del inicio, controlar acceso al corral, señalizar conteos regresivos',
      requirements: ['Firmeza y autoridad respetuosa', 'Capacidad de seguir horarios exactos', 'Buena comunicación'],
    },
    {
      title: 'Punto de Hidratación y Snacks',
      description: 'Reponer agua y electrolitos, mantener orden, monitorear atletas por signos de agotamiento',
      requirements: ['Agilidad en reposición', 'Atención a atletas con señales de agotamiento', 'Buena higiene'],
    },
    {
      title: 'Control de Vueltas',
      description: 'Crear lista de atletas que iniciaron cada vuelta, confirmar retiros, actualizar marcador',
      requirements: ['Precisión absoluta en datos', 'Concentración por largos períodos', 'Alto sentido de responsabilidad'],
      critical: true,
    },
    {
      title: 'Área de Carpas / Zona de Atletas',
      description: 'Asegurar que cada carpa esté en su espacio, mantener pasillos despejados, manejar preguntas',
      requirements: ['Buena comunicación', 'Capacidad de organización espacial', 'Actitud calmada'],
    },
    {
      title: 'Orden y Limpieza',
      description: 'Recoger basura visible, reponer bolsas, verificar baños estén usables',
      requirements: ['Energía física ligera', 'Sentido de orden', 'Compromiso con cuidado ambiental'],
    },
    {
      title: 'Equipo Médico y Apoyo de Seguridad',
      description: 'Guiar personal médico a atletas con problemas, notificar al comité organizador',
      requirements: ['Comunicación rápida y efectiva', 'Calma en situaciones médicas', 'Respeto por protocolos'],
    },
    {
      title: 'Marcación de Ruta',
      description: 'Marcar la ruta el viernes, colocar banderas y señalización, inspeccionar la ruta',
      requirements: ['Capacidad de caminar largos tramos', 'Atención visual', 'Trabajo en equipo'],
    },
    {
      title: 'Decoración, Montaje y Ambientación',
      description: 'Dirigir montaje de arcos, carpas, zonas; colocar banners y señalización estética',
      requirements: ['Excelente organización espacial', 'Sentido estético', 'Disponibilidad el viernes'],
    },
  ];

  const importantRules = [
    'Puntualidad en todos los turnos',
    'Usar la camiseta oficial de Staff para identificación',
    'Comunicación vía WhatsApp (Grupo Voluntarios Backyard 2026)',
    'No consumir alcohol durante el evento',
    'No abandonar el puesto sin previo aviso',
    'Mantener actitud positiva y respetuosa',
    'No ofrecer medicamentos o diagnósticos a atletas',
  ];

  const emergencyProtocol = [
    {
      type: 'Emergencias Médicas',
      actions: [
        'Activar protocolo inmediatamente',
        'No mover al atleta a menos que haya peligro inmediato',
        'Llamar al equipo médico',
        'Mantener alejados a otros atletas',
        'No ofrecer medicamentos ni diagnósticos',
        'Notificar al Coordinador General',
      ],
      signals: [
        'Desorientación',
        'Mareos',
        'Dificultad respiratoria',
        'Desmayo',
        'Vómito continuo',
        'Dolor de pecho',
        'Calambres severos',
        'Convulsiones',
        'Sangrado abundante',
        'Señales de golpe de calor',
      ],
    },
    {
      type: 'Golpe de Calor',
      signals: [
        'Atleta deja de sudar',
        'Confusión',
        'Náuseas intensas',
        'Piel caliente',
        'Movimientos lentos o tambaleantes',
      ],
      actions: [
        'Guiar a la sombra',
        'Quitar peso',
        'Ofrecer aire/ventilación manual',
        'Llamar al equipo médico',
        'No dar grandes cantidades de agua de una vez',
      ],
    },
  ];

  return (
    <section className="py-20 bg-gradient-to-b from-muted/20 to-background">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto space-y-12">
          {/* Header */}
          <div className="text-center space-y-4">
            <h2 className="font-display text-4xl sm:text-5xl text-foreground">
              Sección Voluntarios
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Guía completa para el equipo de voluntarios del evento
            </p>
          </div>

          {/* Download Manual */}
          <Card className="bg-gradient-to-br from-accent/5 to-primary/5 border-accent/20 shadow-medium">
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <Download className="w-7 h-7 text-accent" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-display text-2xl text-foreground">Manual de Voluntarios</h3>
                    <p className="text-muted-foreground">
                      Consulta el manual completo con todas las instrucciones, roles y protocolos para voluntarios
                    </p>
                  </div>
                </div>
                <a
                  href="/manual-voluntarios.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0"
                >
                  <Button size="lg" className="bg-accent hover:bg-primary text-accent-foreground shadow-medium hover:shadow-strong transition-all duration-300">
                    <Download className="w-5 h-5 mr-2" />
                    Ver Manual PDF
                  </Button>
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Main Content Tabs */}
          <Tabs defaultValue="roles" className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-muted/50 p-1">
              <TabsTrigger value="roles" className="data-[state=active]:bg-card data-[state=active]:text-foreground">
                <ClipboardCheck className="w-4 h-4 mr-2" />
                Roles
              </TabsTrigger>
              <TabsTrigger value="assignments" className="data-[state=active]:bg-card data-[state=active]:text-foreground">
                <Calendar className="w-4 h-4 mr-2" />
                Asignación
              </TabsTrigger>
              <TabsTrigger value="rules" className="data-[state=active]:bg-card data-[state=active]:text-foreground">
                <Shirt className="w-4 h-4 mr-2" />
                Reglas
              </TabsTrigger>
              <TabsTrigger value="emergency" className="data-[state=active]:bg-card data-[state=active]:text-foreground">
                <Phone className="w-4 h-4 mr-2" />
                Emergencias
              </TabsTrigger>
            </TabsList>

            {/* Roles Tab */}
            <TabsContent value="roles" className="space-y-6 mt-6">
              <Card className="border-border shadow-soft">
                <CardHeader>
                  <CardTitle className="text-2xl">Roles y Responsabilidades</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Los voluntarios son cruciales para logística, seguridad, hidratación, control de vueltas y orden general
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4">
                    {volunteerRoles.map((role, index) => (
                      <Card
                        key={index}
                        className={`${
                          role.critical
                            ? 'border-primary/30 bg-primary/5'
                            : 'border-border bg-card'
                        } shadow-soft hover-lift`}
                      >
                        <CardContent className="p-5 space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <h4 className="font-bold text-foreground">{role.title}</h4>
                            {role.critical && (
                              <Badge variant="destructive" className="text-xs">
                                Crítico
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{role.description}</p>
                          <div className="pt-2">
                            <p className="text-xs font-semibold text-muted-foreground mb-2">Requisitos:</p>
                            <div className="flex flex-wrap gap-2">
                              {role.requirements.map((req, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {req}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Assignments Tab */}
            <TabsContent value="assignments" className="space-y-6 mt-6">
              <Card className="border-border shadow-soft">
                <CardHeader>
                  <CardTitle className="text-2xl">Asignación de Turnos</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Consulta los turnos disponibles y asígnate a un espacio usando tu correo electrónico registrado
                  </p>
                </CardHeader>
                <CardContent>
                  {/* Filters */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por nombre o posición..."
                        value={filterName}
                        onChange={(e) => setFilterName(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <select
                      value={filterPosition}
                      onChange={(e) => setFilterPosition(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Todas las posiciones</option>
                      {positions.map((pos, idx) => (
                        <option key={idx} value={pos}>{pos}</option>
                      ))}
                    </select>
                    <select
                      value={filterShift}
                      onChange={(e) => setFilterShift(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Todos los turnos</option>
                      {shifts.map((shift, idx) => (
                        <option key={idx} value={shift}>Turno {shift}</option>
                      ))}
                    </select>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Todos los estados</option>
                      <option value="asignado">Asignados</option>
                      <option value="disponible">Disponibles</option>
                    </select>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-muted/30 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-foreground">{slots.length}</p>
                      <p className="text-xs text-muted-foreground">Total Espacios</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-green-600">{slots.filter(s => s.email_asignado).length}</p>
                      <p className="text-xs text-green-700">Asignados</p>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-amber-600">{slots.filter(s => !s.email_asignado).length}</p>
                      <p className="text-xs text-amber-700">Disponibles</p>
                    </div>
                  </div>

                  {/* Slots Grid - Card based for responsiveness */}
                  {loadingSlots ? (
                    <div className="text-center py-12">
                      <Calendar className="w-12 h-12 text-muted-foreground animate-pulse mx-auto mb-4" />
                      <p className="text-muted-foreground">Cargando asignaciones...</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredSlots.map((slot) => (
                        <div 
                          key={slot.id} 
                          className={`p-4 rounded-lg border ${
                            slot.email_asignado 
                              ? 'bg-white border-green-200' 
                              : 'bg-amber-50/50 border-amber-200'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-semibold text-foreground truncate">{slot.puesto}</p>
                                <Badge variant="outline" className="font-mono text-xs flex-shrink-0">
                                  {slot.turno}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {slot.dia} • {formatTime(slot.hora_inicio)} - {formatTime(slot.hora_fin)}
                              </p>
                            </div>
                            <div className="flex items-center justify-between sm:justify-end gap-3">
                              <div className="min-w-0">
                                {slot.nombre_asignado ? (
                                  <div className="flex items-center gap-1">
                                    <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                                    <span className="text-green-700 font-medium text-sm truncate max-w-[150px]">
                                      {slot.nombre_asignado}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-amber-600 italic text-sm">Disponible</span>
                                )}
                              </div>
                              {slot.email_asignado ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-red-300 text-red-600 hover:bg-red-50 flex-shrink-0"
                                  onClick={() => openUnassignModal(slot)}
                                >
                                  <Trash2 className="w-3 h-3 mr-1" />
                                  Eliminar
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  className="bg-primary hover:bg-accent flex-shrink-0"
                                  onClick={() => openAssignModal(slot)}
                                >
                                  <Check className="w-3 h-3 mr-1" />
                                  Asignarme
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      {filteredSlots.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          No se encontraron espacios con los filtros seleccionados
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Rules Tab */}
            <TabsContent value="rules" className="space-y-6 mt-6">
              <Card className="border-border shadow-soft">
                <CardHeader>
                  <CardTitle className="text-2xl">Reglas Generales para Voluntarios</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {importantRules.map((rule, index) => (
                      <div key={index} className="flex items-start gap-3 pb-3 border-b border-border last:border-0">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-xs font-bold text-primary">{index + 1}</span>
                        </div>
                        <p className="text-foreground">{rule}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="grid md:grid-cols-2 gap-6">
                <Card className="border-border shadow-soft">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shirt className="w-5 h-5 text-primary" />
                      Indumentaria Recomendada
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                        Camiseta oficial de Staff (obligatorio)
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                        Pantalones/shorts deportivos cómodos
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                        Chaqueta ligera o suéter para temperaturas frescas
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                        Gorra para protección solar
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                        Zapatos deportivos con buen amortiguamiento
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                        Linterna frontal (especialmente turnos nocturnos)
                      </li>
                    </ul>
                  </CardContent>
                </Card>

                <Card className="border-border shadow-soft">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Heart className="w-5 h-5 text-primary" />
                      Beneficios del Voluntario
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                        Ticket de comida para desayuno, almuerzo o cena según turno
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                        Camiseta oficial del evento
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                        Opción de acampar en área designada
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                        Experiencia única en evento deportivo internacional
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                        Certificado de participación como voluntario
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Emergency Tab */}
            <TabsContent value="emergency" className="space-y-6 mt-6">
              <Card className="border-destructive/30 bg-destructive/5 shadow-medium">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-2xl">
                    <AlertCircle className="w-6 h-6 text-destructive" />
                    Protocolo de Emergencias
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">Regla Principal:</strong> Mantener la calma, reportar rápidamente
                    y no actuar fuera de su rol. El objetivo es proteger, no resolver problemas de forma independiente.
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {emergencyProtocol.map((protocol, index) => (
                    <div key={index} className="space-y-4">
                      <h4 className="font-bold text-lg text-foreground">{protocol.type}</h4>
                      
                      {protocol.signals && (
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-muted-foreground">Señales de Alerta:</p>
                          <div className="flex flex-wrap gap-2">
                            {protocol.signals.map((signal, idx) => (
                              <Badge key={idx} variant="destructive" className="text-xs">
                                {signal}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-muted-foreground">Acciones del Voluntario:</p>
                        <ul className="space-y-2">
                          {protocol.actions.map((action, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm text-foreground">
                              <span className="w-1.5 h-1.5 rounded-full bg-destructive mt-2 flex-shrink-0"></span>
                              {action}
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      {index < emergencyProtocol.length - 1 && <div className="border-t border-border pt-4"></div>}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-border shadow-soft">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="w-5 h-5 text-primary" />
                    Comunicación y Reportes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <p className="font-semibold text-foreground">Formato para Reportar Situaciones:</p>
                    <div className="bg-muted/50 p-4 rounded-lg border border-border">
                      <p className="text-sm font-mono text-muted-foreground">
                        [Tipo de evento] + [Ubicación] + [Acción necesaria]
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="font-semibold text-foreground">Para Emergencias:</p>
                    <div className="bg-destructive/10 p-4 rounded-lg border border-destructive/30">
                      <p className="text-sm font-semibold text-foreground">
                        Iniciar mensajes con &quot;URGENTE&quot;
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Ejemplo: &quot;URGENTE – Atleta caído en zona de carpas – solicita médico.&quot;
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="font-semibold text-foreground">Reglas de Comunicación:</p>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                        Usar formato breve y concreto
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                        No conversaciones largas en el grupo
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                        No enviar notas de voz de más de 10 segundos
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                        Durante turnos nocturnos, mensajes aún más cortos
                      </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Assign Modal */}
      {showAssignModal && selectedSlot && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-strong">
            <CardHeader className="border-b">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>Asignarse al Turno</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedSlot.puesto}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowAssignModal(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="bg-muted/30 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Turno</p>
                      <p className="font-semibold">{selectedSlot.turno}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Fecha</p>
                      <p className="font-semibold">{selectedSlot.dia}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Horario</p>
                      <p className="font-semibold">{formatTime(selectedSlot.hora_inicio)} - {formatTime(selectedSlot.hora_fin)}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Confirma tu correo electrónico
                  </label>
                  <Input
                    type="email"
                    placeholder="tu@email.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Debe coincidir con el correo registrado como voluntario
                  </p>
                </div>

                {actionMessage && (
                  <div className={`p-3 rounded-lg text-sm ${
                    actionMessage.type === 'success' 
                      ? 'bg-green-50 text-green-800 border border-green-200' 
                      : 'bg-red-50 text-red-800 border border-red-200'
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
                    className="flex-1 bg-primary"
                    onClick={handleAssign}
                    disabled={!emailInput.trim() || actionLoading}
                  >
                    {actionLoading ? 'Procesando...' : 'Confirmar Asignación'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Unassign Modal */}
      {showUnassignModal && selectedSlot && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-strong border-red-200">
            <CardHeader className="border-b border-red-100 bg-red-50/50">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-red-900">Eliminar Asignación</CardTitle>
                  <p className="text-sm text-red-700 mt-1">
                    {selectedSlot.puesto}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowUnassignModal(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="bg-muted/30 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Turno</p>
                      <p className="font-semibold">{selectedSlot.turno}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Fecha</p>
                      <p className="font-semibold">{selectedSlot.dia}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Horario</p>
                      <p className="font-semibold">{formatTime(selectedSlot.hora_inicio)} - {formatTime(selectedSlot.hora_fin)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Asignado a</p>
                      <p className="font-semibold text-green-700">{selectedSlot.nombre_asignado}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Confirma tu correo electrónico para eliminar
                  </label>
                  <Input
                    type="email"
                    placeholder="tu@email.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Solo el voluntario asignado puede eliminar su asignación
                  </p>
                </div>

                {actionMessage && (
                  <div className={`p-3 rounded-lg text-sm ${
                    actionMessage.type === 'success' 
                      ? 'bg-green-50 text-green-800 border border-green-200' 
                      : 'bg-red-50 text-red-800 border border-red-200'
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
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </section>
  );
}