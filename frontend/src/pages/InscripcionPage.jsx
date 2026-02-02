import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { 
  User, Mail, Phone, Calendar, MapPin, Heart, Shield, 
  Shirt, Tent, Users, Target, Camera, CheckCircle, 
  AlertCircle, ArrowLeft, ArrowRight, Loader2, Upload,
  Info, FileText, XCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { useRaceConfig } from '../contexts/RaceConfigContext';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Helper function to format cost
const formatCost = (cost) => {
  return `RD$${(cost || 3500).toLocaleString('es-DO')}`;
};

// Form steps
const STEPS = [
  { id: 'verify', title: 'Verificación', icon: Mail },
  { id: 'personal', title: 'Datos Personales', icon: User },
  { id: 'running', title: 'Experiencia', icon: Target },
  { id: 'medical', title: 'Info Médica', icon: Heart },
  { id: 'emergency', title: 'Emergencia', icon: Shield },
  { id: 'preferences', title: 'Preferencias', icon: Shirt },
  { id: 'photo', title: 'Foto', icon: Camera },
];

export default function InscripcionPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { config, raceName, raceCode, getFormattedCost, registrationCost } = useRaceConfig();
  
  // Check if editing existing registration
  const editToken = searchParams.get('token');
  const [isEditing, setIsEditing] = useState(false);
  
  // Current step
  const [currentStep, setCurrentStep] = useState(0);
  
  // Access recovery mode
  const [accessMode, setAccessMode] = useState(false);
  const [accessEmail, setAccessEmail] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [accessCodeSent, setAccessCodeSent] = useState(false);
  const [requestingAccess, setRequestingAccess] = useState(false);
  const [verifyingAccess, setVerifyingAccess] = useState(false);
  
  // Email verification
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [sessionToken, setSessionToken] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  
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
    
    // Running
    anos_experiencia: '',
    maxima_distancia_km: '',
    motivacion: '',
    
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
    personalizacion_camiseta: '',
    tiene_carpa: '',
    hospedaje: '',
    acompanantes: '',
    como_se_entero: '',
    vueltas_aspiradas: '',
  });
  
  // Photo
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState(null);
  
  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [registrationResult, setRegistrationResult] = useState(null);
  
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
  
  // Load existing registration if editing
  useEffect(() => {
    if (editToken) {
      loadExistingRegistration();
    }
  }, [editToken]);
  
  const loadExistingRegistration = async () => {
    try {
      const response = await fetch(`${API_URL}/api/registration/my-registration?token=${editToken}`);
      if (response.ok) {
        const data = await response.json();
        setFormData({
          nombre: data.nombre || '',
          apellidos: data.apellidos || '',
          fecha_nacimiento: data.fecha_nacimiento || '',
          sexo: data.sexo || '',
          nacionalidad: data.nacionalidad || '',
          telefono: data.telefono || '',
          ciudad_residencia: data.ciudad_residencia || '',
          anos_experiencia: data.anos_experiencia?.toString() || '',
          maxima_distancia_km: data.maxima_distancia_km?.toString() || '',
          motivacion: data.motivacion || '',
          tipo_sangre: data.tipo_sangre || '',
          condicion_medica: data.condicion_medica || 'No',
          condicion_medica_detalle: data.condicion_medica_detalle || '',
          alergias: data.alergias || 'No',
          alergias_detalle: data.alergias_detalle || '',
          contacto_emergencia_nombre: data.contacto_emergencia_nombre || '',
          contacto_emergencia_relacion: data.contacto_emergencia_relacion || '',
          contacto_emergencia_telefono: data.contacto_emergencia_telefono || '',
          talla_camiseta: data.talla_camiseta || '',
          personalizacion_camiseta: data.personalizacion_camiseta || '',
          tiene_carpa: data.tiene_carpa || '',
          hospedaje: data.hospedaje || '',
          acompanantes: data.acompanantes?.toString() || '',
          como_se_entero: data.como_se_entero || '',
          vueltas_aspiradas: data.vueltas_aspiradas || '',
        });
        setEmail(data.email || '');
        setEmailVerified(true);
        setIsEditing(true);
        setCurrentStep(1); // Skip verification
        setExistingPhotoUrl(data.photo_url);
        setRegistrationResult({});
      } else {
        toast.error('Token inválido o expirado');
        navigate('/pre-registro');
      }
    } catch (error) {
      console.error('Error loading registration:', error);
      toast.error('Error cargando los datos');
    }
  };
  
  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };
  
  // Access recovery functions
  const requestAccess = async () => {
    if (!accessEmail || !accessEmail.includes('@')) {
      toast.error('Por favor ingresa un email válido');
      return;
    }
    
    setRequestingAccess(true);
    try {
      const response = await fetch(`${API_URL}/api/registration/request-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: accessEmail })
      });
      
      const data = await response.json();
      
      if (response.ok && data.sent) {
        setAccessCodeSent(true);
        toast.success('Código de acceso enviado a tu correo');
      } else {
        toast.error(data.detail || 'Error solicitando acceso');
      }
    } catch (error) {
      toast.error('Error de conexión');
    } finally {
      setRequestingAccess(false);
    }
  };
  
  const verifyAccess = async () => {
    if (!accessCode || accessCode.length !== 6) {
      toast.error('Ingresa el código de 6 dígitos');
      return;
    }
    
    setVerifyingAccess(true);
    try {
      const response = await fetch(`${API_URL}/api/registration/verify-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: accessEmail, code: accessCode })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast.success('Acceso verificado');
        // Navigate to edit page with the token
        navigate(`/pre-registro/editar?token=${data.edit_token}`);
      } else {
        toast.error(data.detail || 'Código incorrecto');
      }
    } catch (error) {
      toast.error('Error verificando código');
    } finally {
      setVerifyingAccess(false);
    }
  };
  
  // State for showing "already registered" message
  const [emailAlreadyRegistered, setEmailAlreadyRegistered] = useState(false);
  
  const sendVerificationCode = async () => {
    if (!email || !email.includes('@')) {
      toast.error('Por favor ingresa un email válido');
      return;
    }
    
    setEmailAlreadyRegistered(false);
    setSendingCode(true);
    
    // Use XMLHttpRequest to avoid body stream issues with platform interceptors
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}/api/registration/send-verification`, true);
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
        
        // Check if it's a "already registered" error
        if (errorMessage.includes('ya está registrado') || errorMessage.includes('ya está pre registrado')) {
          setEmailAlreadyRegistered(true);
          toast.info('Este correo ya tiene un pre-registro');
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
  
  const verifyEmail = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast.error('Ingresa el código de 6 dígitos');
      return;
    }
    
    setVerifying(true);
    try {
      const response = await fetch(`${API_URL}/api/registration/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: verificationCode })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setEmailVerified(true);
        setSessionToken(data.session_token);
        toast.success('Email verificado');
        setCurrentStep(1);
      } else {
        toast.error(data.detail || 'Código incorrecto');
      }
    } catch (error) {
      toast.error('Error verificando código');
    } finally {
      setVerifying(false);
    }
  };
  
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Check file size (min 1MB)
    if (file.size < 1024 * 1024) {
      toast.error('La foto debe ser de alta resolución (mínimo 1MB)');
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      toast.error('El archivo es demasiado grande (máximo 10MB)');
      return;
    }
    
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };
  
  const uploadPhoto = async (token) => {
    if (!photoFile) return;
    
    setUploadingPhoto(true);
    try {
      const formDataPhoto = new FormData();
      formDataPhoto.append('token', token);
      formDataPhoto.append('photo', photoFile);
      
      const response = await fetch(`${API_URL}/api/registration/upload-photo`, {
        method: 'POST',
        body: formDataPhoto
      });
      
      if (response.ok) {
        const data = await response.json();
        toast.success('Foto subida exitosamente');
        return data.photo_url;
      } else {
        const data = await response.json();
        toast.error(data.detail || 'Error subiendo foto');
      }
    } catch (error) {
      toast.error('Error subiendo foto');
    } finally {
      setUploadingPhoto(false);
    }
  };
  
  const validateCurrentStep = () => {
    switch (currentStep) {
      case 1: // Personal
        if (!formData.nombre || !formData.apellidos || !formData.fecha_nacimiento ||
            !formData.sexo || !formData.nacionalidad || !formData.telefono ||
            !formData.ciudad_residencia) {
          toast.error('Por favor completa todos los campos obligatorios');
          return false;
        }
        break;
      case 2: // Running
        if (!formData.anos_experiencia || !formData.maxima_distancia_km || !formData.motivacion) {
          toast.error('Por favor completa todos los campos obligatorios');
          return false;
        }
        break;
      case 3: // Medical
        if (!formData.tipo_sangre) {
          toast.error('Por favor indica tu tipo de sangre');
          return false;
        }
        if (formData.condicion_medica === 'Sí' && !formData.condicion_medica_detalle) {
          toast.error('Por favor especifica tu condición médica');
          return false;
        }
        if (formData.alergias === 'Sí' && !formData.alergias_detalle) {
          toast.error('Por favor especifica tus alergias');
          return false;
        }
        break;
      case 4: // Emergency
        if (!formData.contacto_emergencia_nombre || !formData.contacto_emergencia_telefono) {
          toast.error('Por favor completa los datos de contacto de emergencia');
          return false;
        }
        break;
      case 5: // Preferences
        if (!formData.talla_camiseta || !formData.personalizacion_camiseta) {
          toast.error('Por favor completa la talla y personalización de camiseta');
          return false;
        }
        if (formData.personalizacion_camiseta.length > 15) {
          toast.error('La personalización no puede exceder 15 caracteres');
          return false;
        }
        break;
    }
    return true;
  };
  
  const nextStep = () => {
    if (validateCurrentStep()) {
      setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
    }
  };
  
  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, isEditing ? 1 : 0));
  };
  
  const submitRegistration = async () => {
    if (!validateCurrentStep()) return;
    
    setSubmitting(true);
    try {
      const payload = {
        email,
        ...formData,
        anos_experiencia: parseInt(formData.anos_experiencia),
        maxima_distancia_km: parseFloat(formData.maxima_distancia_km),
        acompanantes: formData.acompanantes ? parseInt(formData.acompanantes) : null,
        race_code: config?.code || raceCode
      };
      
      if (isEditing) {
        // Update existing registration
        const response = await fetch(`${API_URL}/api/registration/update?token=${editToken}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        if (response.ok) {
          // Upload photo if new one selected
          if (photoFile) {
            await uploadPhoto(editToken);
          }
          toast.success('Datos actualizados exitosamente');
          setRegistrationComplete(true);
        } else {
          const data = await response.json();
          toast.error(data.detail || 'Error actualizando datos');
        }
      } else {
        // New registration
        const response = await fetch(`${API_URL}/api/registration/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if (response.ok) {
          setRegistrationResult(data);
          
          // Upload photo if selected
          if (photoFile) {
            await uploadPhoto(data.edit_token);
          }
          
          setRegistrationComplete(true);
          toast.success('¡Pre registro completado!');
        } else {
          // Handle validation errors from Pydantic (detail can be array or string)
          let errorMessage = 'Error en el pre registro';
          if (data.detail) {
            if (Array.isArray(data.detail)) {
              // Pydantic validation error - show first error
              const firstError = data.detail[0];
              const field = firstError.loc?.slice(-1)[0] || 'campo';
              errorMessage = `Campo "${field}": ${firstError.msg}`;
            } else {
              errorMessage = data.detail;
            }
          }
          toast.error(errorMessage);
        }
      }
    } catch (error) {
      console.error('Registration error:', error);
      toast.error('Error de conexión. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };
  
  // Handle registration cancellation
  const handleCancelRegistration = async () => {
    if (!cancelReason) {
      toast.error('Por favor selecciona una razón para cancelar');
      return;
    }
    
    if (cancelReason === 'Otra razón' && !cancelOtherReason.trim()) {
      toast.error('Por favor especifica la razón');
      return;
    }
    
    setCancelling(true);
    try {
      const requestBody = {
        reason: cancelReason,
        other_reason: cancelReason === 'Otra razón' ? cancelOtherReason : null
      };
      
      const response = await fetch(`${API_URL}/api/registration/cancel/${editToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      if (response.ok) {
        toast.success('Pre registro cancelado exitosamente');
        setShowCancelModal(false);
        navigate('/');
      } else {
        const data = await response.json();
        toast.error(data.detail || 'Error cancelando el pre registro');
      }
    } catch (error) {
      console.error('Cancel error:', error);
      toast.error('Error de conexión. Intenta de nuevo.');
    } finally {
      setCancelling(false);
    }
  };
  
  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Email verification or Access Recovery
        // Access Recovery Mode
        if (accessMode) {
          return (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-8 h-8 text-blue-600" />
                </div>
                <h2 className="text-2xl font-bold">Acceder a mi Pre Registro</h2>
                <p className="text-muted-foreground mt-2">
                  Ingresa tu correo para recibir un código de acceso
                </p>
              </div>
              
              <div className="space-y-4 max-w-md mx-auto">
                <div className="space-y-2">
                  <Label htmlFor="accessEmail">Correo Electrónico *</Label>
                  <Input
                    id="accessEmail"
                    type="email"
                    value={accessEmail}
                    onChange={(e) => setAccessEmail(e.target.value)}
                    placeholder="tu@email.com"
                    disabled={accessCodeSent}
                  />
                </div>
                
                {!accessCodeSent ? (
                  <Button 
                    onClick={requestAccess} 
                    disabled={requestingAccess}
                    className="w-full"
                  >
                    {requestingAccess ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
                    ) : (
                      'Enviar Código de Acceso'
                    )}
                  </Button>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="accessCode">Código de Acceso (6 dígitos)</Label>
                      <Input
                        id="accessCode"
                        type="text"
                        maxLength={6}
                        value={accessCode}
                        onChange={(e) => setAccessCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="000000"
                        className="text-center text-2xl tracking-widest"
                      />
                    </div>
                    
                    <Button 
                      onClick={verifyAccess} 
                      disabled={verifyingAccess}
                      className="w-full"
                    >
                      {verifyingAccess ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verificando...</>
                      ) : (
                        'Acceder a mi Registro'
                      )}
                    </Button>
                    
                    <Button 
                      variant="ghost" 
                      onClick={() => { setAccessCodeSent(false); setAccessCode(''); }}
                      className="w-full"
                    >
                      Cambiar email
                    </Button>
                  </>
                )}
                
                <div className="pt-4 border-t">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setAccessMode(false);
                      setAccessEmail('');
                      setAccessCode('');
                      setAccessCodeSent(false);
                    }}
                    className="w-full"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Volver al Pre Registro
                  </Button>
                </div>
              </div>
            </div>
          );
        }
        
        // Normal registration flow
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold">Verificación de Email</h2>
              <p className="text-muted-foreground mt-2">
                Ingresa tu correo electrónico para comenzar el pre registro
              </p>
            </div>
            
            <div className="space-y-4 max-w-md mx-auto">
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
                  data-testid="email-input"
                />
              </div>
              
              {!codeSent ? (
                <>
                  <Button 
                    onClick={sendVerificationCode} 
                    disabled={sendingCode}
                    className="w-full"
                    data-testid="send-code-btn"
                  >
                    {sendingCode ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
                    ) : (
                      'Enviar Código de Verificación'
                    )}
                  </Button>
                  
                  {/* Show message when email is already registered */}
                  {emailAlreadyRegistered && (
                    <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-amber-800">Este correo ya tiene un pre-registro</p>
                          <p className="text-sm text-amber-700 mt-1">
                            Si deseas ver o editar tu información, usa el botón de abajo para acceder a tu registro existente.
                          </p>
                          <Button 
                            variant="default" 
                            size="sm"
                            onClick={() => {
                              setAccessMode(true);
                              setAccessEmail(email);
                            }}
                            className="mt-3 bg-amber-600 hover:bg-amber-700"
                            data-testid="access-existing-btn"
                          >
                            Acceder a mi Pre Registro
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="code">Código de Verificación (6 dígitos)</Label>
                    <Input
                      id="code"
                      type="text"
                      maxLength={6}
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="000000"
                      className="text-center text-2xl tracking-widest"
                      data-testid="verification-code-input"
                    />
                  </div>
                  
                  <Button 
                    onClick={verifyEmail} 
                    disabled={verifying}
                    className="w-full"
                    data-testid="verify-btn"
                  >
                    {verifying ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verificando...</>
                    ) : (
                      'Verificar Email'
                    )}
                  </Button>
                  
                  <Button 
                    variant="ghost" 
                    onClick={() => { setCodeSent(false); setVerificationCode(''); }}
                    className="w-full"
                  >
                    Cambiar email
                  </Button>
                </>
              )}
              
              {/* Access existing registration link */}
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground text-center mb-3">
                  ¿Ya te registraste anteriormente?
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => setAccessMode(true)}
                  className="w-full"
                >
                  Acceder a mi Pre Registro Existente
                </Button>
              </div>
            </div>
          </div>
        );
        
      case 1: // Personal info
        return (
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre *</Label>
                <Input
                  id="nombre"
                  value={formData.nombre}
                  onChange={(e) => handleInputChange('nombre', e.target.value)}
                  placeholder="Tu nombre"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apellidos">Apellidos *</Label>
                <Input
                  id="apellidos"
                  value={formData.apellidos}
                  onChange={(e) => handleInputChange('apellidos', e.target.value)}
                  placeholder="Tus apellidos"
                />
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fecha_nacimiento">Fecha de Nacimiento *</Label>
                <Input
                  id="fecha_nacimiento"
                  type="date"
                  value={formData.fecha_nacimiento}
                  onChange={(e) => handleInputChange('fecha_nacimiento', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Sexo *</Label>
                <div className="flex gap-4">
                  {['Masculino', 'Femenino'].map(option => (
                    <label key={option} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="sexo"
                        value={option}
                        checked={formData.sexo === option}
                        onChange={(e) => handleInputChange('sexo', e.target.value)}
                        className="w-4 h-4 text-primary"
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nacionalidad">Nacionalidad *</Label>
                <Input
                  id="nacionalidad"
                  value={formData.nacionalidad}
                  onChange={(e) => handleInputChange('nacionalidad', e.target.value)}
                  placeholder="Ej: Dominicana"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefono">Teléfono *</Label>
                <Input
                  id="telefono"
                  type="tel"
                  value={formData.telefono}
                  onChange={(e) => handleInputChange('telefono', e.target.value)}
                  placeholder="+1 809 555 0000"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="ciudad_residencia">Ciudad de Residencia *</Label>
              <Input
                id="ciudad_residencia"
                value={formData.ciudad_residencia}
                onChange={(e) => handleInputChange('ciudad_residencia', e.target.value)}
                placeholder="Ej: Santo Domingo"
              />
            </div>
          </div>
        );
        
      case 2: // Running experience
        return (
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="anos_experiencia">Años de Experiencia en Running *</Label>
                <Input
                  id="anos_experiencia"
                  type="number"
                  min="0"
                  value={formData.anos_experiencia}
                  onChange={(e) => handleInputChange('anos_experiencia', e.target.value)}
                  placeholder="Ej: 5"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxima_distancia_km">Máxima Distancia Recorrida (km) *</Label>
                <Input
                  id="maxima_distancia_km"
                  type="number"
                  min="0"
                  step="0.1"
                  value={formData.maxima_distancia_km}
                  onChange={(e) => handleInputChange('maxima_distancia_km', e.target.value)}
                  placeholder="Ej: 42.2"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="motivacion">¿Qué te motiva a participar en este evento? *</Label>
              <textarea
                id="motivacion"
                value={formData.motivacion}
                onChange={(e) => handleInputChange('motivacion', e.target.value)}
                placeholder="Cuéntanos tu motivación..."
                className="w-full min-h-[120px] px-3 py-2 rounded-md border border-input bg-background text-sm"
                maxLength={1000}
              />
              <p className="text-xs text-muted-foreground text-right">
                {formData.motivacion.length}/1000
              </p>
            </div>
          </div>
        );
        
      case 3: // Medical info
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="tipo_sangre">Tipo de Sangre *</Label>
              <select
                id="tipo_sangre"
                value={formData.tipo_sangre}
                onChange={(e) => handleInputChange('tipo_sangre', e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="">Selecciona...</option>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>¿Padeces alguna condición médica relevante? *</Label>
                <div className="flex gap-4">
                  {['No', 'Sí'].map(option => (
                    <label key={option} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="condicion_medica"
                        value={option}
                        checked={formData.condicion_medica === option}
                        onChange={(e) => handleInputChange('condicion_medica', e.target.value)}
                        className="w-4 h-4 text-primary"
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              {formData.condicion_medica === 'Sí' && (
                <div className="space-y-2">
                  <Label htmlFor="condicion_medica_detalle">Especificar condición médica *</Label>
                  <Input
                    id="condicion_medica_detalle"
                    value={formData.condicion_medica_detalle}
                    onChange={(e) => handleInputChange('condicion_medica_detalle', e.target.value)}
                    placeholder="Describe tu condición médica"
                  />
                </div>
              )}
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>¿Eres alérgico a algún medicamento o alimento? *</Label>
                <div className="flex gap-4">
                  {['No', 'Sí'].map(option => (
                    <label key={option} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="alergias"
                        value={option}
                        checked={formData.alergias === option}
                        onChange={(e) => handleInputChange('alergias', e.target.value)}
                        className="w-4 h-4 text-primary"
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              {formData.alergias === 'Sí' && (
                <div className="space-y-2">
                  <Label htmlFor="alergias_detalle">Especificar alergias *</Label>
                  <Input
                    id="alergias_detalle"
                    value={formData.alergias_detalle}
                    onChange={(e) => handleInputChange('alergias_detalle', e.target.value)}
                    placeholder="Describe tus alergias"
                  />
                </div>
              )}
            </div>
          </div>
        );
        
      case 4: // Emergency contact
        return (
          <div className="space-y-6">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-amber-800">Información Importante</h4>
                  <p className="text-sm text-amber-700">
                    Esta información será utilizada únicamente en caso de emergencia durante el evento.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="contacto_emergencia_nombre">Nombre del Contacto de Emergencia *</Label>
              <Input
                id="contacto_emergencia_nombre"
                value={formData.contacto_emergencia_nombre}
                onChange={(e) => handleInputChange('contacto_emergencia_nombre', e.target.value)}
                placeholder="Nombre completo"
              />
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contacto_emergencia_relacion">Relación con el Contacto</Label>
                <Input
                  id="contacto_emergencia_relacion"
                  value={formData.contacto_emergencia_relacion}
                  onChange={(e) => handleInputChange('contacto_emergencia_relacion', e.target.value)}
                  placeholder="Ej: Esposo/a, Padre, Madre"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contacto_emergencia_telefono">Teléfono del Contacto *</Label>
                <Input
                  id="contacto_emergencia_telefono"
                  type="tel"
                  value={formData.contacto_emergencia_telefono}
                  onChange={(e) => handleInputChange('contacto_emergencia_telefono', e.target.value)}
                  placeholder="+1 809 555 0000"
                />
              </div>
            </div>
          </div>
        );
        
      case 5: // Preferences
        return (
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Talla de Camiseta *</Label>
                <select
                  value={formData.talla_camiseta}
                  onChange={(e) => handleInputChange('talla_camiseta', e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="">Selecciona...</option>
                  {['XS', 'S', 'M', 'L', 'XL', 'XXL'].map(size => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="personalizacion_camiseta">
                  Personalización Camiseta/BIB * 
                  <span className="text-xs text-muted-foreground ml-1">(máx. 15 caracteres)</span>
                </Label>
                <Input
                  id="personalizacion_camiseta"
                  maxLength={15}
                  value={formData.personalizacion_camiseta}
                  onChange={(e) => handleInputChange('personalizacion_camiseta', e.target.value.toUpperCase())}
                  placeholder="Ej: JUAN o RUNNER"
                  className="uppercase"
                />
                <p className="text-xs text-muted-foreground text-right">
                  {formData.personalizacion_camiseta.length}/15
                </p>
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>¿Tienes carpa o toldo propio?</Label>
                <select
                  value={formData.tiene_carpa}
                  onChange={(e) => handleInputChange('tiene_carpa', e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="">Selecciona...</option>
                  {['Sí', 'No', 'Tal vez'].map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              
              <div className="space-y-2">
                <Label>¿Te gustaría dormir en el lugar?</Label>
                <select
                  value={formData.hospedaje}
                  onChange={(e) => handleInputChange('hospedaje', e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="">Selecciona...</option>
                  <option value="Si quiero acampar">Sí, quiero acampar</option>
                  <option value="Si quisiera hospedarme en el hotel">Sí, quisiera hospedarme en el hotel</option>
                  <option value="No lo he decidido aún">No lo he decidido aún</option>
                </select>
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="acompanantes">¿Cuántas personas te acompañarán?</Label>
                <Input
                  id="acompanantes"
                  type="number"
                  min="0"
                  max="20"
                  value={formData.acompanantes}
                  onChange={(e) => handleInputChange('acompanantes', e.target.value)}
                  placeholder="0"
                />
              </div>
              
              <div className="space-y-2">
                <Label>¿Cuántas vueltas aspiras completar?</Label>
                <select
                  value={formData.vueltas_aspiradas}
                  onChange={(e) => handleInputChange('vueltas_aspiradas', e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="">Selecciona...</option>
                  {[
                    'Al menos 1', 'De 2 a 5', 'De 6 a 10', 'De 11 a 15',
                    'De 16 a 20', 'De 21 a 24', 'Hasta que sea el ganador', 'No estoy seguro'
                  ].map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="como_se_entero">¿Cómo te enteraste del evento?</Label>
              <Input
                id="como_se_entero"
                value={formData.como_se_entero}
                onChange={(e) => handleInputChange('como_se_entero', e.target.value)}
                placeholder="Ej: Instagram, amigo, club de running..."
              />
            </div>
          </div>
        );
        
      case 6: // Photo upload
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Camera className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Foto del Participante</h3>
              <p className="text-muted-foreground mt-2">
                Sube una foto de alta resolución para tu perfil y credencial
              </p>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex gap-3">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-700">
                  <p className="font-medium">Requisitos de la foto:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Alta resolución (mínimo 1MB)</li>
                    <li>Formato: JPG, PNG o WebP</li>
                    <li>Tamaño máximo: 10MB</li>
                    <li>Preferiblemente foto tipo retrato</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col items-center gap-6">
              {(photoPreview || existingPhotoUrl) && (
                <div className="relative">
                  <img
                    src={photoPreview || `${API_URL}${existingPhotoUrl}`}
                    alt="Preview"
                    className="w-48 h-48 object-cover rounded-lg shadow-medium"
                  />
                  {photoFile && (
                    <Badge className="absolute -top-2 -right-2 bg-green-500">
                      Nueva
                    </Badge>
                  )}
                </div>
              )}
              
              <div className="w-full max-w-md">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-primary/30 rounded-lg cursor-pointer hover:bg-primary/5 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 text-primary mb-2" />
                    <p className="text-sm text-muted-foreground">
                      <span className="font-semibold text-primary">Haz clic para subir</span> o arrastra tu foto
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      JPG, PNG o WebP (mín. 1MB, máx. 10MB)
                    </p>
                  </div>
                  <input 
                    type="file" 
                    className="hidden" 
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handlePhotoChange}
                  />
                </label>
              </div>
              
              {photoFile && (
                <p className="text-sm text-muted-foreground">
                  Archivo seleccionado: {photoFile.name} ({(photoFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };
  
  // Registration complete view
  if (registrationComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-primary/5 pt-20">
        <div className="container mx-auto px-4 py-12">
          <Card className="max-w-2xl mx-auto">
            <CardContent className="p-8 text-center">
              <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              
              <h1 className="text-3xl font-bold text-foreground mb-2">
                {isEditing ? '¡Datos Actualizados!' : '¡Pre Registro Exitoso!'}
              </h1>
              
              <p className="text-muted-foreground mb-6">
                {isEditing 
                  ? 'Tus datos han sido actualizados correctamente.'
                  : 'Tu pre registro ha sido recibido. Recibirás un correo de confirmación con los próximos pasos.'
                }
              </p>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
                <h3 className="font-semibold text-blue-800 mb-2">📋 Próximos Pasos</h3>
                <ul className="text-sm text-blue-700 space-y-2">
                  <li>• Cuatro (4) meses antes del evento, recibirás un correo con las instrucciones para el pago.</li>
                  <li>• El costo de la carrera será de <strong>{getFormattedCost()}</strong>.</li>
                  <li>• Tendrás 30 días para completar el pago desde la recepción del correo.</li>
                </ul>
              </div>
              
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
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-accent/5 pt-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white py-10">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl sm:text-5xl font-bold text-center mb-2">
            {isEditing ? 'Editar Pre Registro' : 'Pre Registro'}
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
      
      {/* Pre-registration Info Banner */}
      {!isEditing && currentStep === 0 && (
        <div className="container mx-auto px-4 mt-6">
          <Card className="max-w-4xl mx-auto bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="p-6">
              <h2 className="text-xl font-bold text-blue-900 mb-3">📋 Pre registro Abierto</h2>
              <div className="space-y-3 text-sm text-blue-800">
                <p>
                  El pre registro al evento ya se encuentra abierto.
                  <strong> Completar este formulario no garantiza un cupo confirmado</strong>, sino que asegura tu lugar en la lista de prerregistrados.
                </p>
                <p>
                  Cuatro (4) meses antes del evento, enviaremos un correo electrónico a todos los prerregistrados con las instrucciones para realizar el pago de la inscripción.
                </p>
                <p className="font-semibold text-lg text-blue-900">
                  El costo de la carrera será de {getFormattedCost()}.
                </p>
                <p>
                  A partir de la recepción de ese correo, el participante contará con un plazo de <strong>treinta (30) días</strong> para completar el pago correspondiente.
                </p>
                <p>
                  Si el pago no se realiza dentro de ese período, el pre registro será automáticamente desestimado y el cupo podrá ser asignado a otro participante.
                </p>
                <p className="text-blue-600 italic">
                  ⚠️ Te recomendamos estar atento a tu correo electrónico y verificar también la carpeta de spam.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Progress Steps */}
      <div className="container mx-auto px-4 -mt-6">
        <div className="bg-white rounded-xl shadow-medium p-4 max-w-4xl mx-auto overflow-x-auto">
          <div className="flex items-center justify-between min-w-[600px]">
            {STEPS.map((step, index) => {
              const StepIcon = step.icon;
              const isActive = index === currentStep;
              const isCompleted = index < currentStep;
              const isDisabled = !isEditing && index > 0 && !emailVerified;
              
              return (
                <div key={step.id} className="flex items-center">
                  <div className={`flex flex-col items-center ${isDisabled ? 'opacity-40' : ''}`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                      isActive 
                        ? 'bg-primary text-white' 
                        : isCompleted 
                          ? 'bg-green-500 text-white'
                          : 'bg-muted text-muted-foreground'
                    }`}>
                      {isCompleted ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        <StepIcon className="w-5 h-5" />
                      )}
                    </div>
                    <span className={`text-xs mt-1 ${isActive ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                      {step.title}
                    </span>
                  </div>
                  
                  {index < STEPS.length - 1 && (
                    <div className={`w-12 h-0.5 mx-2 ${
                      isCompleted ? 'bg-green-500' : 'bg-muted'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Form Content */}
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {React.createElement(STEPS[currentStep].icon, { className: "w-5 h-5 text-primary" })}
              {STEPS[currentStep].title}
            </CardTitle>
            <CardDescription>
              {currentStep === 0 && 'Verifica tu correo electrónico para comenzar'}
              {currentStep === 1 && 'Información personal básica'}
              {currentStep === 2 && 'Tu experiencia en el running'}
              {currentStep === 3 && 'Información médica importante'}
              {currentStep === 4 && 'Datos de contacto de emergencia'}
              {currentStep === 5 && 'Preferencias para el evento'}
              {currentStep === 6 && 'Sube tu foto de participante'}
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            {renderStepContent()}
            
            {/* Navigation Buttons */}
            {currentStep > 0 && (
              <div className="flex justify-between mt-8 pt-6 border-t">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={prevStep}
                    disabled={currentStep === (isEditing ? 1 : 0)}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Anterior
                  </Button>
                  
                  {/* Cancel Registration Button - Only show when editing */}
                  {isEditing && (
                    <Button
                      variant="destructive"
                      onClick={() => setShowCancelModal(true)}
                      className="ml-2"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Cancelar Pre Registro
                    </Button>
                  )}
                </div>
                
                {currentStep < STEPS.length - 1 ? (
                  <Button onClick={nextStep}>
                    Siguiente
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button 
                    onClick={submitRegistration}
                    disabled={submitting || uploadingPhoto}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {submitting || uploadingPhoto ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Procesando...</>
                    ) : (
                      <>{isEditing ? 'Guardar Cambios' : 'Completar Pre Registro'}</>
                    )}
                  </Button>
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
                Cancelar Pre Registro
              </CardTitle>
              <CardDescription>
                Esta acción no se puede deshacer. Tu pre registro será eliminado permanentemente.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>¿Por qué deseas cancelar tu pre registro? *</Label>
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
                  Mantener Pre Registro
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleCancelRegistration}
                  disabled={cancelling}
                  className="flex-1"
                >
                  {cancelling ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Cancelando...</>
                  ) : (
                    'Confirmar Cancelación'
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
