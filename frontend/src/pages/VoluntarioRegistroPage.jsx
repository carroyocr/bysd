import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  User, Mail, Phone, Calendar, MapPin, Heart, Shield, 
  Shirt, CheckCircle, AlertCircle, ArrowLeft, ArrowRight, 
  Loader2, Info, Users, Clipboard, Clock, Check, Edit2, XCircle,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { useRaceConfig } from '../contexts/RaceConfigContext';
import { COUNTRIES } from '../data/countries';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Helper function to convert 24h time to 12h format with AM/PM
const formatTime12h = (time24) => {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
};

// Event options (volunteer can choose which event to volunteer for)
const EVENTO_OPTIONS = [
  { value: "carrera", label: "Carrera Activa" },
  { value: "campeonato", label: "Campeonato Satélite por Equipos" }
];

// Form steps for volunteers
const STEPS = [
  { id: 'verify', title: 'Verificación', icon: Mail },
  { id: 'personal', title: 'Datos Personales', icon: User },
  { id: 'experience', title: 'Experiencia', icon: Clipboard },
  { id: 'slots', title: 'Turnos', icon: Calendar },
  { id: 'medical', title: 'Info Médica', icon: Heart },
  { id: 'emergency', title: 'Emergencia', icon: Shield },
  { id: 'preferences', title: 'Preferencias', icon: Shirt },
];

// Formulario vacío (estado inicial y "crear nueva postulación")
const FORM_VACIO = {
  // Personal
  nombre: '',
  apellidos: '',
  fecha_nacimiento: '',
  sexo: '',
  nacionalidad: '',
  telefono: '',
  ciudad_residencia: '',

  // Experience
  experiencia_voluntariado: 'No',
  experiencia_voluntariado_detalle: '',

  // Medical
  tipo_sangre: '',
  condicion_medica: 'No',
  condicion_medica_detalle: '',
  alergias: 'No',
  alergias_detalle: '',

  // Emergency
  contacto_emergencia_nombre: '',
  contacto_emergencia_relacion: '',
  contacto_emergencia_telefono: '',

  // Preferences
  talla_camiseta: '',
  como_se_entero: '',
  comentarios: '',
};

// Edit mode steps (skip verification)
const EDIT_STEPS = [
  { id: 'personal', title: 'Datos Personales', icon: User },
  { id: 'experience', title: 'Experiencia', icon: Clipboard },
  { id: 'slots', title: 'Turnos', icon: Calendar },
  { id: 'medical', title: 'Info Médica', icon: Heart },
  { id: 'emergency', title: 'Emergencia', icon: Shield },
  { id: 'preferences', title: 'Preferencias', icon: Shirt },
];

export default function VoluntarioRegistroPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { config, raceName } = useRaceConfig();
  
  // Edit mode
  const [editMode, setEditMode] = useState(false);
  const [editToken, setEditToken] = useState(null);
  const [loadingExisting, setLoadingExisting] = useState(false);
  
  // Current step
  const [currentStep, setCurrentStep] = useState(0);
  
  // Email verification
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [sessionToken, setSessionToken] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  
  // Postulaciones existentes del correo verificado (para ofrecer editar o
  // crear una nueva en el otro evento)
  const [registeredEventos, setRegisteredEventos] = useState([]);
  const [eventosDisponibles, setEventosDisponibles] = useState([]);
  const [existingRegistrations, setExistingRegistrations] = useState([]);
  
  // Available slots data
  const [availableSlots, setAvailableSlots] = useState({ positions: [], shifts_info: [], race_date: null });
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState([]); // Array of slot IDs
  const [selectedEvento, setSelectedEvento] = useState('carrera'); // Event chosen by volunteer
  // Posiciones expandidas en el acordeón de turnos (cargan contraídas)
  const [expandedPositions, setExpandedPositions] = useState({});
  // Posiciones con la descripción visible (botón de información)
  const [openInfoPositions, setOpenInfoPositions] = useState({});

  const togglePosition = (puesto) => {
    setExpandedPositions(prev => ({ ...prev, [puesto]: !prev[puesto] }));
  };

  const togglePositionInfo = (puesto) => {
    setOpenInfoPositions(prev => ({ ...prev, [puesto]: !prev[puesto] }));
  };
  
  // Check for edit token in URL
  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      setEditToken(token);
      setEditMode(true);
      loadExistingRegistration(token);
    }
  }, [searchParams]);
  
  // Mapea una postulación del backend a los campos del formulario
  const mapRegistrationToForm = (data) => ({
    nombre: data.nombre || '',
    apellidos: data.apellidos || '',
    fecha_nacimiento: data.fecha_nacimiento || '',
    sexo: data.sexo || '',
    nacionalidad: data.nacionalidad || '',
    telefono: data.telefono || '',
    ciudad_residencia: data.ciudad_residencia || '',
    experiencia_voluntariado: data.experiencia_voluntariado || 'No',
    experiencia_voluntariado_detalle: data.experiencia_voluntariado_detalle || '',
    tipo_sangre: data.tipo_sangre || '',
    condicion_medica: data.condicion_medica || 'No',
    condicion_medica_detalle: data.condicion_medica_detalle || '',
    alergias: data.alergias || 'No',
    alergias_detalle: data.alergias_detalle || '',
    contacto_emergencia_nombre: data.contacto_emergencia_nombre || '',
    contacto_emergencia_relacion: data.contacto_emergencia_relacion || '',
    contacto_emergencia_telefono: data.contacto_emergencia_telefono || '',
    talla_camiseta: data.talla_camiseta || '',
    como_se_entero: data.como_se_entero || '',
    comentarios: data.comentarios || '',
  });

  const loadExistingRegistration = async (token) => {
    setLoadingExisting(true);
    try {
      const response = await fetch(`${API_URL}/api/volunteer-registration/by-token/${token}`);

      if (response.ok) {
        const data = await response.json();
        setEmail(data.email || '');
        setFormData(mapRegistrationToForm(data));
        setSelectedSlots(data.slots_interes || []);
        setSelectedEvento(data.evento || 'carrera');
        setEmailVerified(true);
        toast.success('Datos cargados correctamente');
      } else {
        toast.error('Token inválido o expirado');
        setEditMode(false);
        setEditToken(null);
      }
    } catch (error) {
      console.error('Error loading registration:', error);
      toast.error('Error cargando datos');
      setEditMode(false);
    } finally {
      setLoadingExisting(false);
    }
  };
  
  // Calculate the date for a shift based on its start time
  const getShiftDate = (horaInicio) => {
    const raceDate = availableSlots.race_date || config?.date;
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
  
  // Form data
  const [formData, setFormData] = useState({ ...FORM_VACIO });
  
  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [updateComplete, setUpdateComplete] = useState(false);
  
  // Cancellation modal
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelOtherReason, setCancelOtherReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  
  const CANCEL_REASONS = [
    "Me lesioné",
    "Ya no estoy interesado en participar",
    "Tengo otros compromisos",
    "Otra razón"
  ];
  
  // Get the steps based on mode
  const activeSteps = editMode ? EDIT_STEPS : STEPS;
  
  // Get current step ID for conditional rendering
  const currentStepId = activeSteps[currentStep]?.id || '';

  // Load available slots when entering slots step or when event changes
  useEffect(() => {
    if (currentStepId === 'slots') {
      loadAvailableSlots();
    }
  }, [currentStepId, selectedEvento]);

  const loadAvailableSlots = async () => {
    setLoadingSlots(true);
    try {
      const response = await fetch(`${API_URL}/api/volunteer-registration/available-slots?evento=${selectedEvento}`);
      if (response.ok) {
        const data = await response.json();
        setAvailableSlots(data);
      }
    } catch (error) {
      console.error('Error loading slots:', error);
      toast.error('Error cargando turnos disponibles');
    } finally {
      setLoadingSlots(false);
    }
  };

  // Change the selected event and reset any chosen shifts (they belong to the previous event)
  const handleEventoChange = (evento) => {
    if (evento === selectedEvento) return;
    setSelectedEvento(evento);
    setSelectedSlots([]);
    setExpandedPositions({});
  };

  // Check if two time slots conflict
  const slotsConflict = (slot1, slot2) => {
    // Find the turnos in availableSlots
    let t1Info = null, t2Info = null;
    
    for (const pos of availableSlots.positions) {
      for (const turno of pos.turnos) {
        if (turno.slot_id === slot1) t1Info = { ...turno };
        if (turno.slot_id === slot2) t2Info = { ...turno };
      }
    }
    
    if (!t1Info || !t2Info) return false;
    
    // Convert times to comparable format
    const parseTime = (timeStr) => {
      if (!timeStr) return 0;
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };
    
    const start1 = parseTime(t1Info.hora_inicio);
    const end1 = parseTime(t1Info.hora_fin);
    const start2 = parseTime(t2Info.hora_inicio);
    const end2 = parseTime(t2Info.hora_fin);
    
    // Check overlap
    return !(end1 <= start2 || end2 <= start1);
  };

  // Toggle slot selection
  const toggleSlot = (slotId, turnoInfo) => {
    if (selectedSlots.includes(slotId)) {
      // Remove slot
      setSelectedSlots(prev => prev.filter(id => id !== slotId));
    } else {
      // Check for conflicts with already selected slots
      const conflicts = selectedSlots.filter(existingId => slotsConflict(existingId, slotId));
      
      if (conflicts.length > 0) {
        toast.error('Este turno tiene conflicto de horario con otro turno seleccionado');
        return;
      }
      
      // Add slot
      setSelectedSlots(prev => [...prev, slotId]);
    }
  };

  // Get selected slots info for display
  const getSelectedSlotsInfo = () => {
    const info = [];
    for (const pos of availableSlots.positions) {
      for (const turno of pos.turnos) {
        if (selectedSlots.includes(turno.slot_id)) {
          info.push({
            id: turno.slot_id,
            puesto: pos.puesto,
            turno: turno.turno,
            hora_inicio: turno.hora_inicio,
            hora_fin: turno.hora_fin
          });
        }
      }
    }
    return info;
  };

  // Label for an event ('carrera' uses the active race name)
  const getEventoLabel = (value) => {
    if (value === 'carrera') return raceName || 'Carrera Activa';
    const opt = EVENTO_OPTIONS.find(e => e.value === value);
    return opt ? opt.label : value;
  };

  const sendVerificationCode = async () => {
    if (!email || !email.includes('@')) {
      toast.error('Por favor ingresa un email válido');
      return;
    }

    setSendingCode(true);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}/api/volunteer-registration/send-verification`, true);
    xhr.setRequestHeader('Content-Type', 'application/json');

    xhr.onload = function() {
      setSendingCode(false);
      let data;
      try {
        data = JSON.parse(xhr.responseText);
      } catch (e) {
        data = { detail: xhr.responseText };
      }

      if (xhr.status === 200) {
        setCodeSent(true);
        toast.success('Código enviado a tu correo');
      } else {
        toast.error(data.detail || 'Error enviando código');
      }
    };

    xhr.onerror = function() {
      setSendingCode(false);
      toast.error('Error de conexión. Intenta de nuevo.');
    };

    xhr.send(JSON.stringify({ email }));
  };

  // Abre directamente el formulario de edición de una postulación existente
  // (el correo ya fue verificado, no hace falta enlace por email)
  const startDirectEdit = (registration) => {
    setEditToken(registration.edit_token);
    setEditMode(true);
    setCurrentStep(0);
    loadExistingRegistration(registration.edit_token);
  };

  // Inicia una postulación nueva para el evento indicado. Los datos de la
  // postulación existente se precargan para solo confirmarlos; lo único que
  // queda pendiente es elegir los turnos del nuevo evento.
  const startNewRegistration = async (evento) => {
    setEditMode(false);
    setEditToken(null);
    setSelectedEvento(evento);
    setSelectedSlots([]);

    const base = existingRegistrations[0];
    if (base?.edit_token) {
      setLoadingExisting(true);
      try {
        const response = await fetch(`${API_URL}/api/volunteer-registration/by-token/${base.edit_token}`);
        if (response.ok) {
          const data = await response.json();
          setFormData(mapRegistrationToForm(data));
          toast.success('Datos precargados de tu postulación anterior; confírmalos y elige los turnos');
        } else {
          setFormData({ ...FORM_VACIO });
        }
      } catch (error) {
        setFormData({ ...FORM_VACIO });
      } finally {
        setLoadingExisting(false);
      }
    } else {
      setFormData({ ...FORM_VACIO });
    }

    setCurrentStep(1);
  };

  // Vuelve a la pantalla de selección (editar o crear) tras verificar el correo
  const backToChoice = () => {
    setEditMode(false);
    setEditToken(null);
    setCurrentStep(0);
  };

  // Si se llegó al formulario desde la pantalla de selección, "Anterior" en el
  // primer paso regresa a esa pantalla (aplica al editar directamente)
  const canReturnToChoice = existingRegistrations.length > 0;

  const verifyCode = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast.error('Ingresa el código de 6 dígitos');
      return;
    }
    
    setVerifying(true);
    try {
      const response = await fetch(`${API_URL}/api/volunteer-registration/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: verificationCode })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setEmailVerified(true);
        setSessionToken(data.session_token);
        toast.success('Email verificado correctamente');

        const regs = data.registrations || [];
        setExistingRegistrations(regs);
        setRegisteredEventos(regs.map(r => r.evento));
        setEventosDisponibles(data.eventos_disponibles || []);

        if (regs.length === 0) {
          // Sin postulaciones previas: sigue el flujo normal
          setCurrentStep(1);
          if (data.eventos_disponibles?.length) {
            setSelectedEvento(data.eventos_disponibles[0]);
          }
        }
        // Con postulaciones previas se queda en este paso mostrando las
        // opciones: editar la existente o crear una nueva para el otro evento
      } else {
        toast.error(data.detail || 'Código inválido');
      }
    } catch (error) {
      toast.error('Error verificando código');
    } finally {
      setVerifying(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateStep = () => {
    switch (currentStepId) {
      case 'personal':
        if (!formData.nombre || !formData.apellidos || !formData.fecha_nacimiento || 
            !formData.sexo || !formData.telefono || !formData.ciudad_residencia) {
          toast.error('Completa todos los campos obligatorios');
          return false;
        }
        break;
      case 'experience':
        if (!formData.experiencia_voluntariado) {
          toast.error('Indica si tienes experiencia');
          return false;
        }
        break;
      case 'slots':
        if (selectedSlots.length === 0) {
          toast.error('Selecciona al menos un turno de interés');
          return false;
        }
        break;
      case 'emergency':
        if (!formData.contacto_emergencia_nombre || !formData.contacto_emergencia_telefono) {
          toast.error('Completa la información de contacto de emergencia');
          return false;
        }
        break;
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep()) {
      setCurrentStep(prev => Math.min(prev + 1, activeSteps.length - 1));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  // Handle volunteer registration cancellation
  const handleCancelRegistration = async () => {
    if (!cancelReason) {
      toast.error('Por favor selecciona una razón de cancelación');
      return;
    }
    
    if (cancelReason === 'Otra razón' && !cancelOtherReason.trim()) {
      toast.error('Por favor especifica la razón de cancelación');
      return;
    }
    
    setCancelling(true);
    try {
      const response = await fetch(`${API_URL}/api/volunteer-registration/cancel/${editToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: cancelReason,
          other_reason: cancelReason === 'Otra razón' ? cancelOtherReason : null
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast.success('Postulación cancelada exitosamente');
        setShowCancelModal(false);
        navigate('/');
      } else {
        toast.error(data.detail || 'Error al cancelar la postulación');
      }
    } catch (error) {
      toast.error('Error de conexión');
    } finally {
      setCancelling(false);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;
    
    setSubmitting(true);
    try {
      const submitData = {
        ...formData,
        slots_interes: selectedSlots,
        evento: selectedEvento
      };
      
      let response;
      
      if (editMode && editToken) {
        // Update existing registration
        response = await fetch(
          `${API_URL}/api/volunteer-registration/update/${editToken}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(submitData)
          }
        );
      } else {
        // Create new registration
        response = await fetch(
          `${API_URL}/api/volunteer-registration/register?email=${encodeURIComponent(email)}&session_token=${sessionToken}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(submitData)
          }
        );
      }
      
      const data = await response.json();
      
      if (response.ok) {
        if (editMode) {
          setUpdateComplete(true);
          toast.success('¡Postulación actualizada!');
        } else {
          setRegistrationComplete(true);
          toast.success('¡Registro completado!');
        }
      } else {
        toast.error(data.detail || 'Error en el registro');
      }
    } catch (error) {
      toast.error('Error de conexión');
    } finally {
      setSubmitting(false);
    }
  };

  // Registration complete screen
  if (registrationComplete) {
    const selectedInfo = getSelectedSlotsInfo();
    
    return (
      <div className="min-h-screen bg-gradient-to-b from-muted/20 to-background pt-20">
        <div className="container mx-auto px-4 py-12">
          <Card className="max-w-2xl mx-auto text-center">
            <CardContent className="p-8 space-y-6">
              <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>
              
              <h2 className="text-3xl font-bold text-green-700">
                ¡Gracias por Registrarte como Voluntario!
              </h2>
              
              <p className="text-muted-foreground">
                Tu registro como voluntario para <strong className="text-foreground">{getEventoLabel(selectedEvento)}</strong> ha sido recibido. Nos pondremos en contacto contigo pronto con más información.
              </p>
              
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-left">
                <h3 className="font-semibold text-amber-800 mb-2">Revisa tu Correo</h3>
                <p className="text-sm text-amber-700">
                  Te enviamos un correo de confirmación con un enlace para editar tu postulación si lo necesitas.
                </p>
              </div>
              
              {selectedInfo.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
                  <h3 className="font-semibold text-blue-800 mb-2">Turnos de Interés Seleccionados</h3>
                  <ul className="text-sm text-blue-700 space-y-1">
                    {selectedInfo.map(slot => (
                      <li key={slot.id}>
                        • <strong>{slot.puesto}</strong> - Turno {slot.turno} | {getShiftDate(slot.hora_inicio)} {formatTime12h(slot.hora_inicio)} - {formatTime12h(slot.hora_fin)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/">
                  <Button variant="outline">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Volver al Inicio
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  
  // Update complete screen
  if (updateComplete) {
    const selectedInfo = getSelectedSlotsInfo();
    
    return (
      <div className="min-h-screen bg-gradient-to-b from-muted/20 to-background pt-20">
        <div className="container mx-auto px-4 py-12">
          <Card className="max-w-2xl mx-auto text-center">
            <CardContent className="p-8 space-y-6">
              <div className="w-20 h-20 mx-auto bg-blue-100 rounded-full flex items-center justify-center">
                <Edit2 className="w-12 h-12 text-blue-600" />
              </div>
              
              <h2 className="text-3xl font-bold text-blue-700">
                ¡Postulación Actualizada!
              </h2>
              
              <p className="text-muted-foreground">
                Tu postulación para <strong className="text-foreground">{getEventoLabel(selectedEvento)}</strong> ha sido actualizada correctamente.
              </p>
              
              {selectedInfo.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
                  <h3 className="font-semibold text-blue-800 mb-2">Turnos de Interés Actualizados</h3>
                  <ul className="text-sm text-blue-700 space-y-1">
                    {selectedInfo.map(slot => (
                      <li key={slot.id}>
                        • <strong>{slot.puesto}</strong> - Turno {slot.turno} | {getShiftDate(slot.hora_inicio)} {formatTime12h(slot.hora_inicio)} - {formatTime12h(slot.hora_fin)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/">
                  <Button variant="outline">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Volver al Inicio
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  
  // Loading state for edit mode
  if (loadingExisting) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-muted/20 to-background pt-20 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando tu postulación...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/20 to-background pt-20">
      {/* Indicador del paso actual: un solo icono centrado */}
      {(editMode || currentStepId !== 'verify') && (
        <div className="container mx-auto px-4 pt-8">
          <div className="max-w-4xl mx-auto mb-8">
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center">
                {React.createElement(activeSteps[currentStep]?.icon || User, { className: 'w-5 h-5' })}
              </div>
              <span className="text-xs mt-2 text-primary font-medium text-center">
                {activeSteps[currentStep]?.title}
              </span>
              <span className="text-[10px] text-muted-foreground mt-0.5">
                Paso {currentStep + 1} de {activeSteps.length}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Form Content */}
      {/* pt-8 para que la tarjeta no quede pegada al menú en el paso de
          verificación, donde no se muestra el indicador de paso */}
      <div className={`container mx-auto px-4 pb-12 ${(editMode || currentStepId !== 'verify') ? '' : 'pt-8'}`}>
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {React.createElement(activeSteps[currentStep]?.icon || User, { className: "w-5 h-5" })}
              {activeSteps[currentStep]?.title || 'Datos'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* Step: Email Verification - only in normal mode */}
            {currentStepId === 'verify' && !editMode && (
              <div className="space-y-4">
                {emailVerified && existingRegistrations.length > 0 ? (
                  /* Correo verificado con postulaciones previas: elegir entre
                     editar la existente o crear una nueva para el otro evento */
                  <div className="space-y-4">
                    <div className="max-w-sm mx-auto p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-green-800 text-center break-words">
                        <CheckCircle className="w-4 h-4 inline mr-1" />
                        Correo verificado: <strong>{email}</strong>
                      </p>
                    </div>

                    <div className="max-w-sm mx-auto flex flex-col gap-2">
                      {existingRegistrations.map((reg) => (
                        <Button
                          key={reg.evento}
                          variant="outline"
                          onClick={() => startDirectEdit(reg)}
                          className="w-full h-auto min-h-10 whitespace-normal"
                          data-testid={`edit-registration-${reg.evento}`}
                        >
                          Editar mi postulación de {getEventoLabel(reg.evento)}
                        </Button>
                      ))}
                      {eventosDisponibles.map((ev) => (
                        <Button
                          key={ev}
                          onClick={() => startNewRegistration(ev)}
                          className="w-full h-auto min-h-10 whitespace-normal"
                          data-testid={`new-registration-${ev}`}
                        >
                          Crear nueva postulación para {getEventoLabel(ev)}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="email">Correo Electrónico *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="tu@email.com"
                        disabled={codeSent}
                        data-testid="volunteer-email-input"
                      />
                    </div>

                    {!codeSent ? (
                      <Button
                        onClick={() => sendVerificationCode()}
                        disabled={sendingCode}
                        className="w-full"
                        data-testid="volunteer-send-code-btn"
                      >
                        {sendingCode ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
                        ) : (
                          'Enviar Código de Verificación'
                        )}
                      </Button>
                    ) : (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="code">Código de Verificación *</Label>
                          <Input
                            id="code"
                            value={verificationCode}
                            onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="123456"
                            maxLength={6}
                            data-testid="volunteer-code-input"
                          />
                          <p className="text-xs text-muted-foreground">
                            Revisa tu correo (incluyendo spam) para el código de 6 dígitos
                          </p>
                        </div>

                        <Button
                          onClick={verifyCode}
                          disabled={verifying}
                          className="w-full"
                          data-testid="volunteer-verify-btn"
                        >
                          {verifying ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verificando...</>
                          ) : (
                            'Verificar Código'
                          )}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Step: Personal Data */}
            {currentStepId === 'personal' && (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre *</Label>
                  <Input
                    value={formData.nombre}
                    onChange={(e) => handleInputChange('nombre', e.target.value)}
                    placeholder="Tu nombre"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Apellidos *</Label>
                  <Input
                    value={formData.apellidos}
                    onChange={(e) => handleInputChange('apellidos', e.target.value)}
                    placeholder="Tus apellidos"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fecha de Nacimiento *</Label>
                  <Input
                    type="date"
                    value={formData.fecha_nacimiento}
                    onChange={(e) => handleInputChange('fecha_nacimiento', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sexo *</Label>
                  <select
                    className="w-full h-10 px-3 rounded-md border border-input bg-background"
                    value={formData.sexo}
                    onChange={(e) => handleInputChange('sexo', e.target.value)}
                  >
                    <option value="">Seleccionar</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Femenino">Femenino</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Nacionalidad</Label>
                  <select
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    value={formData.nacionalidad}
                    onChange={(e) => handleInputChange('nacionalidad', e.target.value)}
                  >
                    <option value="">Seleccionar país</option>
                    {COUNTRIES.map(country => (
                      <option key={country.code} value={country.name}>
                        {country.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Teléfono *</Label>
                  <Input
                    value={formData.telefono}
                    onChange={(e) => handleInputChange('telefono', e.target.value)}
                    placeholder="Ej: 809-555-1234"
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <Label>Ciudad de Residencia *</Label>
                  <Input
                    value={formData.ciudad_residencia}
                    onChange={(e) => handleInputChange('ciudad_residencia', e.target.value)}
                    placeholder="Ej: Santo Domingo"
                  />
                </div>
              </div>
            )}

            {/* Step: Experience */}
            {currentStepId === 'experience' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label>¿Tienes experiencia dando asistencia en actividades deportivas? *</Label>
                  <select
                    className="w-full h-10 px-3 rounded-md border border-input bg-background"
                    value={formData.experiencia_voluntariado}
                    onChange={(e) => handleInputChange('experiencia_voluntariado', e.target.value)}
                  >
                    <option value="No">No</option>
                    <option value="Sí">Sí</option>
                  </select>
                </div>
                
                {formData.experiencia_voluntariado === 'Sí' && (
                  <div className="space-y-2">
                    <Label>Cuéntanos sobre tu experiencia</Label>
                    <textarea
                      className="w-full min-h-[100px] px-3 py-2 rounded-md border border-input bg-background"
                      value={formData.experiencia_voluntariado_detalle}
                      onChange={(e) => handleInputChange('experiencia_voluntariado_detalle', e.target.value)}
                      placeholder="Describe brevemente tu experiencia previa..."
                    />
                  </div>
                )}
              </div>
            )}

            {/* Step: Slots Selection */}
            {currentStepId === 'slots' && (
              <div className="space-y-6">
                {loadingSlots ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <span className="ml-3 text-muted-foreground">Cargando turnos disponibles...</span>
                  </div>
                ) : (
                  <>
                    {/* Event selector */}
                    <div className="space-y-2" data-testid="volunteer-reg-event-selector">
                      <Label className="text-sm font-semibold">¿Para qué evento deseas ser voluntario?</Label>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {EVENTO_OPTIONS.map((ev) => {
                          const label = ev.value === 'carrera' ? (raceName || 'Carrera Activa') : ev.label;
                          const active = selectedEvento === ev.value;
                          // En un registro nuevo no se puede elegir un evento
                          // donde este correo ya tiene una postulación
                          const yaRegistrado = !editMode && registeredEventos.includes(ev.value);
                          return (
                            <button
                              key={ev.value}
                              type="button"
                              data-testid={`reg-event-${ev.value}`}
                              onClick={() => !yaRegistrado && handleEventoChange(ev.value)}
                              disabled={yaRegistrado}
                              className={`p-3 rounded-lg border-2 text-sm font-medium text-left transition-all ${
                                active
                                  ? 'border-primary bg-primary/10 text-primary'
                                  : yaRegistrado
                                    ? 'border-gray-200 bg-gray-100 text-muted-foreground opacity-60 cursor-not-allowed'
                                    : 'border-gray-200 hover:border-primary/50 text-muted-foreground'
                              }`}
                            >
                              {active && <Check className="w-4 h-4 inline mr-2" />}
                              {label}
                              {yaRegistrado && (
                                <span className="block text-xs mt-1">Ya estás registrado en este evento</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm text-blue-800">
                        <Info className="w-4 h-4 inline mr-2" />
                        Selecciona los turnos de tu interés. Puedes elegir varios siempre que no choquen entre sí.
                        {selectedSlots.length > 0 && (
                          <span className="font-semibold"> ({selectedSlots.length} seleccionado{selectedSlots.length > 1 ? 's' : ''})</span>
                        )}
                      </p>
                    </div>
                    
                    {availableSlots.positions.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No hay turnos disponibles en este momento.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {availableSlots.positions.map((position) => {
                          const isOpen = !!expandedPositions[position.puesto];
                          const seleccionadosEnPosicion = position.turnos.filter(t => selectedSlots.includes(t.slot_id)).length;
                          return (
                          <Card key={position.puesto} className={`border-border ${isOpen ? '' : 'shadow-none'}`}>
                            <CardHeader
                              className="py-3 px-4 bg-muted/50 cursor-pointer select-none"
                              onClick={() => togglePosition(position.puesto)}
                              data-testid={`position-accordion-${position.puesto}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                {/* Tres líneas: nombre, cantidad de turnos y seleccionados */}
                                <div className="flex-1 min-w-0 space-y-1">
                                  <div className="flex items-center gap-2">
                                    <CardTitle className="text-base font-semibold break-words">{position.puesto}</CardTitle>
                                    {position.descripcion && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          togglePositionInfo(position.puesto);
                                        }}
                                        className="text-primary flex-shrink-0"
                                        title="Ver en qué consiste esta posición"
                                        data-testid={`position-info-${position.puesto}`}
                                      >
                                        <Info className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground">{position.turnos.length} turnos</div>
                                  <div className={`text-xs ${seleccionadosEnPosicion > 0 ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                                    {seleccionadosEnPosicion} seleccionado{seleccionadosEnPosicion !== 1 ? 's' : ''}
                                  </div>
                                </div>
                                <div className="flex-shrink-0 mt-1">
                                  {isOpen ? (
                                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                                  ) : (
                                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                                  )}
                                </div>
                              </div>
                              {openInfoPositions[position.puesto] && position.descripcion && (
                                <p className="text-sm text-muted-foreground mt-2 pt-2 border-t break-words">
                                  {position.descripcion}
                                </p>
                              )}
                            </CardHeader>
                            {isOpen && (
                            <CardContent className="p-4">
                              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                                {position.turnos.map((turno) => {
                                  const isSelected = selectedSlots.includes(turno.slot_id);
                                  const wouldConflict = !isSelected && selectedSlots.some(
                                    existingId => slotsConflict(existingId, turno.slot_id)
                                  );
                                  
                                  return (
                                    <div
                                      key={turno.slot_id}
                                      onClick={() => !wouldConflict && toggleSlot(turno.slot_id, turno)}
                                      className={`
                                        relative p-3 rounded-lg border-2 cursor-pointer transition-all
                                        ${isSelected 
                                          ? 'border-primary bg-primary/10' 
                                          : wouldConflict
                                            ? 'border-gray-200 bg-gray-100 opacity-50 cursor-not-allowed'
                                            : 'border-gray-200 hover:border-primary/50 hover:bg-primary/5'
                                        }
                                      `}
                                    >
                                      {isSelected && (
                                        <div className="absolute top-2 right-2">
                                          <Check className="w-5 h-5 text-primary" />
                                        </div>
                                      )}
                                      <div className="flex items-center gap-2 mb-1">
                                        <Badge variant={isSelected ? "default" : "outline"} className="text-xs">
                                          Turno {turno.turno}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">
                                          {getShiftDate(turno.hora_inicio)}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                        <Clock className="w-3 h-3" />
                                        <span>{formatTime12h(turno.hora_inicio)} - {formatTime12h(turno.hora_fin)}</span>
                                      </div>
                                      <div className="text-xs text-muted-foreground mt-1">
                                        {turno.available_count} de {turno.total_count} espacios disponibles
                                      </div>
                                      {wouldConflict && (
                                        <p className="text-xs text-red-500 mt-1">Conflicto de horario</p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </CardContent>
                            )}
                          </Card>
                          );
                        })}
                      </div>
                    )}
                    
                    {/* Selected slots summary */}
                    {selectedSlots.length > 0 && (
                      <Card className="bg-green-50 border-green-200">
                        <CardContent className="p-4">
                          <h4 className="font-semibold text-green-800 mb-2">Turnos Seleccionados:</h4>
                          <ul className="text-sm text-green-700 space-y-1">
                            {getSelectedSlotsInfo().map(slot => (
                              <li key={slot.id}>
                                • {slot.puesto} - Turno {slot.turno} | {getShiftDate(slot.hora_inicio)} {formatTime12h(slot.hora_inicio)} - {formatTime12h(slot.hora_fin)}
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Step: Medical Info */}
            {currentStepId === 'medical' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label>Tipo de Sangre</Label>
                  <select
                    className="w-full h-10 px-3 rounded-md border border-input bg-background"
                    value={formData.tipo_sangre}
                    onChange={(e) => handleInputChange('tipo_sangre', e.target.value)}
                  >
                    <option value="">Seleccionar</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="No sé">No sé</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <Label>¿Tienes alguna condición médica?</Label>
                  <select
                    className="w-full h-10 px-3 rounded-md border border-input bg-background"
                    value={formData.condicion_medica}
                    onChange={(e) => handleInputChange('condicion_medica', e.target.value)}
                  >
                    <option value="No">No</option>
                    <option value="Sí">Sí</option>
                  </select>
                </div>
                
                {formData.condicion_medica === 'Sí' && (
                  <div className="space-y-2">
                    <Label>Detalle de la condición médica</Label>
                    <textarea
                      className="w-full min-h-[80px] px-3 py-2 rounded-md border border-input bg-background"
                      value={formData.condicion_medica_detalle}
                      onChange={(e) => handleInputChange('condicion_medica_detalle', e.target.value)}
                      placeholder="Describe tu condición médica..."
                    />
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label>¿Tienes alergias?</Label>
                  <select
                    className="w-full h-10 px-3 rounded-md border border-input bg-background"
                    value={formData.alergias}
                    onChange={(e) => handleInputChange('alergias', e.target.value)}
                  >
                    <option value="No">No</option>
                    <option value="Sí">Sí</option>
                  </select>
                </div>
                
                {formData.alergias === 'Sí' && (
                  <div className="space-y-2">
                    <Label>Detalle de alergias</Label>
                    <textarea
                      className="w-full min-h-[80px] px-3 py-2 rounded-md border border-input bg-background"
                      value={formData.alergias_detalle}
                      onChange={(e) => handleInputChange('alergias_detalle', e.target.value)}
                      placeholder="Lista tus alergias..."
                    />
                  </div>
                )}
              </div>
            )}

            {/* Step: Emergency Contact */}
            {currentStepId === 'emergency' && (
              <div className="space-y-6">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm text-amber-800">
                    <AlertCircle className="w-4 h-4 inline mr-2" />
                    Esta información solo será utilizada en caso de emergencia.
                  </p>
                </div>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nombre del Contacto *</Label>
                    <Input
                      value={formData.contacto_emergencia_nombre}
                      onChange={(e) => handleInputChange('contacto_emergencia_nombre', e.target.value)}
                      placeholder="Nombre completo"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Relación</Label>
                    <Input
                      value={formData.contacto_emergencia_relacion}
                      onChange={(e) => handleInputChange('contacto_emergencia_relacion', e.target.value)}
                      placeholder="Ej: Familiar, Amigo"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label>Teléfono de Emergencia *</Label>
                    <Input
                      value={formData.contacto_emergencia_telefono}
                      onChange={(e) => handleInputChange('contacto_emergencia_telefono', e.target.value)}
                      placeholder="Ej: 809-555-1234"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step: Preferences */}
            {currentStepId === 'preferences' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label>Talla de Camiseta</Label>
                  <select
                    className="w-full h-10 px-3 rounded-md border border-input bg-background"
                    value={formData.talla_camiseta}
                    onChange={(e) => handleInputChange('talla_camiseta', e.target.value)}
                  >
                    <option value="">Seleccionar</option>
                    <option value="XS">XS</option>
                    <option value="S">S</option>
                    <option value="M">M</option>
                    <option value="L">L</option>
                    <option value="XL">XL</option>
                    <option value="XXL">XXL</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <Label>¿Cómo te enteraste del evento?</Label>
                  <select
                    className="w-full h-10 px-3 rounded-md border border-input bg-background"
                    value={formData.como_se_entero}
                    onChange={(e) => handleInputChange('como_se_entero', e.target.value)}
                  >
                    <option value="">Seleccionar</option>
                    <option value="Redes Sociales">Redes Sociales</option>
                    <option value="Amigo/Conocido">Amigo o Conocido</option>
                    <option value="Club de Running">Club de Running</option>
                    <option value="Página Web">Página Web</option>
                    <option value="Participé como atleta">Participé como atleta</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <Label>Comentarios Adicionales</Label>
                  <textarea
                    className="w-full min-h-[100px] px-3 py-2 rounded-md border border-input bg-background"
                    value={formData.comentarios}
                    onChange={(e) => handleInputChange('comentarios', e.target.value)}
                    placeholder="¿Algo más que quieras compartir con nosotros?"
                  />
                </div>
              </div>
            )}

            {/* Navigation Buttons - show after verification in normal mode or always in edit mode */}
            {(editMode || currentStepId !== 'verify') && (
              <div className="pt-4 border-t space-y-3">
                {/* Anterior y Siguiente en la misma línea */}
                <div className="flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (currentStep === 0 && editMode && canReturnToChoice) {
                        // Se entró editando desde la pantalla de selección:
                        // regresar a ella
                        backToChoice();
                      } else {
                        prevStep();
                      }
                    }}
                    disabled={currentStep === 0 && !(editMode && canReturnToChoice)}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Anterior
                  </Button>

                  {currentStep < activeSteps.length - 1 ? (
                    <Button onClick={nextStep} className="flex-1 sm:flex-initial min-w-0">
                      Siguiente
                      <ArrowRight className="w-4 h-4 ml-2 flex-shrink-0" />
                    </Button>
                  ) : (
                    <Button onClick={handleSubmit} disabled={submitting} className="flex-1 sm:flex-initial min-w-0" data-testid="volunteer-submit-btn">
                      {submitting ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin flex-shrink-0" /> {editMode ? 'Actualizando...' : 'Enviando...'}</>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                          {editMode ? 'Guardar Cambios' : 'Completar'}
                        </>
                      )}
                    </Button>
                  )}
                </div>

                {/* Cancelar debajo, solo en modo edición */}
                {editMode && (
                  <div className="flex justify-center">
                    <Button
                      variant="ghost"
                      onClick={() => setShowCancelModal(true)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      data-testid="cancel-volunteer-btn"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Cancelar Postulación
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Cancellation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <XCircle className="w-5 h-5" />
                Cancelar Postulación
              </CardTitle>
              <CardDescription>
                Esta acción no se puede deshacer. Tu postulación como voluntario será eliminada permanentemente del sistema.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>¿Por qué deseas cancelar tu postulación? *</Label>
                <div className="space-y-2">
                  {CANCEL_REASONS.map(reason => (
                    <label key={reason} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="cancelReason"
                        value={reason}
                        checked={cancelReason === reason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        className="w-4 h-4 text-red-600"
                      />
                      <span className="text-sm">{reason}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              {cancelReason === 'Otra razón' && (
                <div className="space-y-2">
                  <Label htmlFor="cancelOtherReason">Especifica la razón *</Label>
                  <Input
                    id="cancelOtherReason"
                    value={cancelOtherReason}
                    onChange={(e) => setCancelOtherReason(e.target.value)}
                    placeholder="Describe tu razón..."
                    maxLength={200}
                  />
                </div>
              )}
              
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCancelModal(false);
                    setCancelReason('');
                    setCancelOtherReason('');
                  }}
                  className="flex-1"
                >
                  Mantener
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleCancelRegistration}
                  disabled={cancelling}
                  className="flex-1"
                  data-testid="confirm-cancel-volunteer-btn"
                >
                  {cancelling ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Cancelando...</>
                  ) : (
                    'Confirmar'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
