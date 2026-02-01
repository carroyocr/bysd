import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  User, Mail, Phone, Calendar, MapPin, Heart, Shield, 
  Shirt, CheckCircle, AlertCircle, ArrowLeft, ArrowRight, 
  Loader2, Info, Users, Clipboard, Clock, Check, Edit2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { useRaceConfig } from '../contexts/RaceConfigContext';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Helper function to convert 24h time to 12h format with AM/PM
const formatTime12h = (time24) => {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
};

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
  
  // State for showing "already registered" message
  const [emailAlreadyRegistered, setEmailAlreadyRegistered] = useState(false);
  
  // Available slots data
  const [availableSlots, setAvailableSlots] = useState({ positions: [], shifts_info: [], race_date: null });
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState([]); // Array of slot IDs
  
  // Check for edit token in URL
  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      setEditToken(token);
      setEditMode(true);
      loadExistingRegistration(token);
    }
  }, [searchParams]);
  
  const loadExistingRegistration = async (token) => {
    setLoadingExisting(true);
    try {
      const response = await fetch(`${API_URL}/api/volunteer-registration/by-token/${token}`);
      
      if (response.ok) {
        const data = await response.json();
        setEmail(data.email || '');
        setFormData({
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
        setSelectedSlots(data.slots_interes || []);
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
  const [formData, setFormData] = useState({
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
  });
  
  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [updateComplete, setUpdateComplete] = useState(false);
  
  // Get the steps based on mode
  const activeSteps = editMode ? EDIT_STEPS : STEPS;
  
  // Get the actual step index for slots (different in edit mode)
  const getSlotsStepIndex = () => editMode ? 2 : 3;

  // Load available slots when entering slots step
  useEffect(() => {
    const slotsIndex = getSlotsStepIndex();
    if (currentStep === slotsIndex) {
      loadAvailableSlots();
    }
  }, [currentStep, editMode]);

  const loadAvailableSlots = async () => {
    setLoadingSlots(true);
    try {
      const response = await fetch(`${API_URL}/api/volunteer-registration/available-slots`);
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

  // Check if two time slots conflict
  const slotsConflict = (slot1, slot2) => {
    // Find the slots in availableSlots
    let s1Info = null, s2Info = null;
    
    for (const pos of availableSlots.positions) {
      for (const turno of pos.turnos) {
        for (const slot of turno.slots) {
          if (slot.id === slot1) s1Info = { ...slot, turno: turno.turno };
          if (slot.id === slot2) s2Info = { ...slot, turno: turno.turno };
        }
      }
    }
    
    if (!s1Info || !s2Info) return false;
    
    // Convert times to comparable format
    const parseTime = (timeStr) => {
      if (!timeStr) return 0;
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };
    
    const start1 = parseTime(s1Info.hora_inicio);
    const end1 = parseTime(s1Info.hora_fin);
    const start2 = parseTime(s2Info.hora_inicio);
    const end2 = parseTime(s2Info.hora_fin);
    
    // Check overlap
    return !(end1 <= start2 || end2 <= start1);
  };

  // Toggle slot selection
  const toggleSlot = (slotId, slotInfo) => {
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
        for (const slot of turno.slots) {
          if (selectedSlots.includes(slot.id)) {
            info.push({
              id: slot.id,
              puesto: pos.puesto,
              turno: turno.turno,
              hora_inicio: turno.hora_inicio,
              hora_fin: turno.hora_fin
            });
          }
        }
      }
    }
    return info;
  };

  const sendVerificationCode = async () => {
    if (!email || !email.includes('@')) {
      toast.error('Por favor ingresa un email válido');
      return;
    }
    
    setEmailAlreadyRegistered(false);
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
        const errorMessage = data.detail || 'Error enviando código';
        
        if (errorMessage.includes('ya está registrado')) {
          setEmailAlreadyRegistered(true);
          toast.info('Este correo ya está registrado como voluntario');
        } else {
          toast.error(errorMessage);
        }
      }
    };
    
    xhr.onerror = function() {
      setSendingCode(false);
      toast.error('Error de conexión. Intenta de nuevo.');
    };
    
    xhr.send(JSON.stringify({ email }));
  };

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
        setCurrentStep(1);
        toast.success('Email verificado correctamente');
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
    switch (currentStep) {
      case 1: // Personal
        if (!formData.nombre || !formData.apellidos || !formData.fecha_nacimiento || 
            !formData.sexo || !formData.telefono || !formData.ciudad_residencia) {
          toast.error('Completa todos los campos obligatorios');
          return false;
        }
        break;
      case editMode ? 1 : 2: // Experience
        if (!formData.experiencia_voluntariado) {
          toast.error('Indica si tienes experiencia');
          return false;
        }
        break;
      case editMode ? 2 : 3: // Slots
        if (selectedSlots.length === 0) {
          toast.error('Selecciona al menos un turno de interés');
          return false;
        }
        break;
      case editMode ? 4 : 5: // Emergency
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
    setCurrentStep(prev => Math.max(prev - 1, editMode ? 0 : 1));
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;
    
    setSubmitting(true);
    try {
      const submitData = {
        ...formData,
        slots_interes: selectedSlots
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
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-accent/5 pt-20">
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
                Tu registro ha sido recibido. Nos pondremos en contacto contigo pronto con más información.
              </p>
              
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-left">
                <h3 className="font-semibold text-amber-800 mb-2">📧 Revisa tu Correo</h3>
                <p className="text-sm text-amber-700">
                  Te enviamos un correo de confirmación con un enlace para editar tu postulación si lo necesitas.
                </p>
              </div>
              
              {selectedInfo.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
                  <h3 className="font-semibold text-blue-800 mb-2">📋 Turnos de Interés Seleccionados</h3>
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
                <Link to="/voluntarios">
                  <Button>
                    <Users className="w-4 h-4 mr-2" />
                    Ver Sección Voluntarios
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
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-accent/5 pt-20">
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
                Tus cambios han sido guardados correctamente.
              </p>
              
              {selectedInfo.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
                  <h3 className="font-semibold text-blue-800 mb-2">📋 Turnos de Interés Actualizados</h3>
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
                <Link to="/voluntarios">
                  <Button>
                    <Users className="w-4 h-4 mr-2" />
                    Ver Sección Voluntarios
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
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-accent/5 pt-20 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando tu postulación...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-accent/5 pt-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white py-10">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl sm:text-5xl font-bold text-center mb-2">
            {editMode ? 'Editar Postulación' : 'Registro de Voluntarios'}
          </h1>
          <p className="text-center text-purple-100 mb-4">
            {raceName || 'Backyard Ultra Santo Domingo'}
          </p>
          {config?.code && (
            <div className="flex justify-center">
              <Badge variant="outline" className="bg-white/10 border-white/30 text-white">
                {config.code}
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* Info Banner */}
      {currentStep === 0 && (
        <div className="container mx-auto px-4 mt-6">
          <Card className="max-w-4xl mx-auto bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="p-6">
              <h2 className="text-xl font-bold text-blue-900 mb-3">💪 ¡Únete al Equipo de Voluntarios!</h2>
              <div className="space-y-3 text-sm text-blue-800">
                <p>
                  Los voluntarios son fundamentales para el éxito del evento. Sin su apoyo, 
                  no sería posible ofrecer una experiencia de calidad a los atletas.
                </p>
                <p>
                  Podrás seleccionar las posiciones y turnos de tu interés según la disponibilidad.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Progress Steps */}
      <div className="container mx-auto px-4 mt-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8 overflow-x-auto pb-2">
            {activeSteps.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === currentStep;
              const isCompleted = index < currentStep;
              
              return (
                <div key={step.id} className="flex flex-col items-center min-w-[70px]">
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center transition-all
                    ${isCompleted ? 'bg-green-500 text-white' : 
                      isActive ? 'bg-primary text-white' : 
                      'bg-gray-200 text-gray-500'}
                  `}>
                    {isCompleted ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <span className={`text-xs mt-2 text-center ${isActive ? 'text-primary font-medium' : 'text-gray-500'}`}>
                    {step.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="container mx-auto px-4 pb-12">
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {React.createElement(activeSteps[currentStep]?.icon || User, { className: "w-5 h-5" })}
              {activeSteps[currentStep]?.title || 'Datos'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* Step 0: Email Verification */}
            {currentStep === 0 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Correo Electrónico *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setEmailAlreadyRegistered(false);
                    }}
                    placeholder="tu@email.com"
                    disabled={codeSent}
                    data-testid="volunteer-email-input"
                  />
                </div>

                {!codeSent ? (
                  <>
                    <Button 
                      onClick={sendVerificationCode} 
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
                    
                    {emailAlreadyRegistered && (
                      <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-amber-800">Este correo ya está registrado</p>
                            <p className="text-sm text-amber-700 mt-1">
                              Ya tienes un registro como voluntario para este evento.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
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
              </div>
            )}

            {/* Step 1: Personal Data */}
            {currentStep === 1 && (
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
                    <option value="Otro">Otro</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Nacionalidad</Label>
                  <Input
                    value={formData.nacionalidad}
                    onChange={(e) => handleInputChange('nacionalidad', e.target.value)}
                    placeholder="Ej: Dominicana"
                  />
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

            {/* Step 2: Experience */}
            {currentStep === 2 && (
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

            {/* Step 3: Slots Selection */}
            {currentStep === 3 && (
              <div className="space-y-6">
                {loadingSlots ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <span className="ml-3 text-muted-foreground">Cargando turnos disponibles...</span>
                  </div>
                ) : (
                  <>
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
                      <div className="space-y-6">
                        {availableSlots.positions.map((position) => (
                          <Card key={position.puesto} className="border-border">
                            <CardHeader className="py-3 px-4 bg-muted/50">
                              <CardTitle className="text-base font-semibold">{position.puesto}</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4">
                              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                                {position.turnos.map((turno) => (
                                  turno.slots.map((slot) => {
                                    const isSelected = selectedSlots.includes(slot.id);
                                    const wouldConflict = !isSelected && selectedSlots.some(
                                      existingId => slotsConflict(existingId, slot.id)
                                    );
                                    
                                    return (
                                      <div
                                        key={slot.id}
                                        onClick={() => !wouldConflict && toggleSlot(slot.id, { ...slot, turno: turno.turno, puesto: position.puesto })}
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
                                        {wouldConflict && (
                                          <p className="text-xs text-red-500 mt-1">Conflicto de horario</p>
                                        )}
                                      </div>
                                    );
                                  })
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
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

            {/* Step 4: Medical Info */}
            {currentStep === 4 && (
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

            {/* Step 5: Emergency Contact */}
            {currentStep === 5 && (
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

            {/* Step 6: Preferences */}
            {currentStep === 6 && (
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

            {/* Navigation Buttons */}
            {currentStep > 0 && (
              <div className="flex justify-between pt-4 border-t">
                <Button variant="outline" onClick={prevStep} disabled={currentStep === 1}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Anterior
                </Button>
                
                {currentStep < STEPS.length - 1 ? (
                  <Button onClick={nextStep}>
                    Siguiente
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button onClick={handleSubmit} disabled={submitting}>
                    {submitting ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Completar Registro
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
