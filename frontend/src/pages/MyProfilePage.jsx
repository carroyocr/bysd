import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Lock, Eye, EyeOff, ArrowLeft, Trophy, Calendar, Search, CheckCircle, Loader2, Phone, MapPin, Heart, Edit2, LogOut } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { COUNTRIES } from '../data/countries';
import { useRaceConfig } from '../contexts/RaceConfigContext';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Auth views
const VIEW_LANDING = 'landing';
const VIEW_LOGIN = 'login';
const VIEW_REGISTER = 'register';
const VIEW_VERIFY = 'verify';
const VIEW_FORGOT = 'forgot';
const VIEW_RESET = 'reset';
const VIEW_DASHBOARD = 'dashboard';

// Helper for API calls using XMLHttpRequest to avoid platform interceptor issues
const apiCall = (method, url, data = null) => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    
    const token = localStorage.getItem('athlete_token');
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    
    xhr.onload = function() {
      let responseData;
      try {
        responseData = JSON.parse(xhr.responseText);
      } catch (e) {
        responseData = { detail: xhr.responseText };
      }
      resolve({ status: xhr.status, data: responseData, ok: xhr.status >= 200 && xhr.status < 300 });
    };
    
    xhr.onerror = function() {
      reject(new Error('Network error'));
    };
    
    if (data) {
      xhr.send(JSON.stringify(data));
    } else {
      xhr.send();
    }
  });
};

export default function MyProfilePage() {
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState(VIEW_LANDING);
  const [loading, setLoading] = useState(false);
  const [athlete, setAthlete] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  
  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  
  // Registration form
  const [registerData, setRegisterData] = useState({
    nombre: '',
    apellidos: '',
    email: '',
    password: '',
    telefono: '',
    fecha_nacimiento: '',
    genero: '',
    pais: '',
    ciudad: '',
    contacto_emergencia_nombre: '',
    contacto_emergencia_telefono: ''
  });
  
  // Dashboard data
  const [myRaces, setMyRaces] = useState([]);
  const [raceHistory, setRaceHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('profile');
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({});
  
  // Claim results
  const [searchResults, setSearchResults] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);

  // Check if already logged in
  useEffect(() => {
    const token = localStorage.getItem('athlete_token');
    if (token) {
      fetchProfile();
    }
  }, []);

  const fetchProfile = async () => {
    try {
      const { ok, data } = await apiCall('GET', `${API_URL}/api/athletes/profile`);
      if (ok) {
        setAthlete(data);
        setCurrentView(VIEW_DASHBOARD);
        fetchMyRaces();
        fetchRaceHistory();
      } else {
        localStorage.removeItem('athlete_token');
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      localStorage.removeItem('athlete_token');
    }
  };

  const fetchMyRaces = async () => {
    try {
      const { ok, data } = await apiCall('GET', `${API_URL}/api/athletes/my-races`);
      if (ok) {
        setMyRaces(data.races || []);
      }
    } catch (error) {
      console.error('Error fetching races:', error);
    }
  };

  const fetchRaceHistory = async () => {
    try {
      const { ok, data } = await apiCall('GET', `${API_URL}/api/athletes/race-history`);
      if (ok) {
        setRaceHistory(data.history || []);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  // Login handler
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { ok, status, data } = await apiCall('POST', `${API_URL}/api/athletes/login`, { email, password });
      
      if (ok) {
        localStorage.setItem('athlete_token', data.token);
        toast.success('¡Bienvenido!');
        await fetchProfile();
      } else if (status === 403) {
        setPendingEmail(email);
        toast.info('Te enviamos un código de verificación');
        setCurrentView(VIEW_VERIFY);
      } else {
        toast.error(data.detail || 'Error al iniciar sesión');
      }
    } catch (error) {
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  // Register handler
  const handleRegister = async (e) => {
    e.preventDefault();
    
    if (registerData.password !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }
    
    if (registerData.password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    
    setLoading(true);
    try {
      const { ok, data } = await apiCall('POST', `${API_URL}/api/athletes/register`, registerData);
      
      if (ok) {
        setPendingEmail(registerData.email);
        toast.success('¡Perfil creado! Revisa tu correo');
        setCurrentView(VIEW_VERIFY);
      } else {
        toast.error(data.detail || 'Error al crear perfil');
      }
    } catch (error) {
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  // Verify email handler
  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { ok, data } = await apiCall('POST', `${API_URL}/api/athletes/verify-email`, { 
        email: pendingEmail, 
        code: verificationCode 
      });
      
      if (ok) {
        localStorage.setItem('athlete_token', data.token);
        toast.success('¡Email verificado!');
        await fetchProfile();
      } else {
        toast.error(data.detail || 'Código incorrecto');
      }
    } catch (error) {
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  // Forgot password handler
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { ok } = await apiCall('POST', `${API_URL}/api/athletes/forgot-password`, { email });
      
      if (ok) {
        setPendingEmail(email);
        toast.success('Si el correo existe, recibirás un código');
        setCurrentView(VIEW_RESET);
      }
    } catch (error) {
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  // Reset password handler
  const handleResetPassword = async (e) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }
    
    setLoading(true);
    try {
      const { ok, data } = await apiCall('POST', `${API_URL}/api/athletes/reset-password`, { 
        email: pendingEmail, 
        code: verificationCode,
        new_password: password 
      });
      
      if (ok) {
        toast.success('Contraseña actualizada');
        setCurrentView(VIEW_LOGIN);
        setPassword('');
        setConfirmPassword('');
        setVerificationCode('');
      } else {
        toast.error(data.detail || 'Error al cambiar contraseña');
      }
    } catch (error) {
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  // Search 2026 results
  const handleSearch2026 = async () => {
    if (!searchTerm || searchTerm.length < 2) {
      toast.error('Ingresa al menos 2 caracteres');
      return;
    }
    
    setSearching(true);
    try {
      const { ok, data } = await apiCall('GET', `${API_URL}/api/athletes/search-2026-results?q=${encodeURIComponent(searchTerm)}`);
      
      if (ok) {
        setSearchResults(data.results || []);
        if (data.results?.length === 0) {
          toast.info('No se encontraron resultados');
        }
      }
    } catch (error) {
      toast.error('Error al buscar');
    } finally {
      setSearching(false);
    }
  };

  // Claim result
  const handleClaimResult = async (resultId) => {
    try {
      const { ok, data } = await apiCall('POST', `${API_URL}/api/athletes/claim-result`, { result_id: resultId });
      
      if (ok) {
        toast.success('¡Resultado reclamado!');
        setSearchResults(prev => prev.map(r => 
          r.id === resultId ? {...r, already_claimed: true} : r
        ));
        fetchRaceHistory();
      } else {
        toast.error(data.detail || 'Error al reclamar');
      }
    } catch (error) {
      toast.error('Error de conexión');
    }
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('athlete_token');
    setAthlete(null);
    setCurrentView(VIEW_LANDING);
    toast.success('Sesión cerrada');
  };

  // Resend code
  const handleResendCode = async () => {
    setLoading(true);
    try {
      const { ok } = await apiCall('POST', `${API_URL}/api/athletes/resend-code`, { email: pendingEmail });
      if (ok) {
        toast.success('Código reenviado');
      }
    } catch (error) {
      toast.error('Error al reenviar código');
    } finally {
      setLoading(false);
    }
  };

  // Start edit mode
  const startEdit = () => {
    setEditData({
      nombre: athlete?.nombre || '',
      apellidos: athlete?.apellidos || '',
      telefono: athlete?.telefono || '',
      fecha_nacimiento: athlete?.fecha_nacimiento || '',
      genero: athlete?.genero || '',
      pais: athlete?.pais || '',
      ciudad: athlete?.ciudad || '',
      contacto_emergencia_nombre: athlete?.contacto_emergencia_nombre || '',
      contacto_emergencia_telefono: athlete?.contacto_emergencia_telefono || ''
    });
    setEditMode(true);
  };

  // Save profile changes
  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      const { ok, data } = await apiCall('PUT', `${API_URL}/api/athletes/profile`, editData);
      if (ok) {
        toast.success('Perfil actualizado');
        setEditMode(false);
        await fetchProfile();
      } else {
        toast.error(data.detail || 'Error al guardar');
      }
    } catch (error) {
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  // ==================== RENDER VIEWS ====================

  // Simple page wrapper (Navigation/Footer provided by App layout)
  const PageWrapper = ({ children }) => (
    <div className="bg-gradient-to-b from-background to-muted/30 min-h-[60vh]">
      {children}
    </div>
  );

  // Landing view
  if (currentView === VIEW_LANDING) {
    return (
      <PageWrapper>
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-md mx-auto">
            <Card>
              <CardHeader className="text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <User className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-2xl">Mi Perfil de Atleta</CardTitle>
                <CardDescription>
                  Gestiona tu perfil, inscripciones y resultados
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={() => setCurrentView(VIEW_LOGIN)}
                >
                  <Lock className="w-4 h-4 mr-2" />
                  Iniciar Sesión
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full" 
                  size="lg"
                  onClick={() => setCurrentView(VIEW_REGISTER)}
                >
                  <User className="w-4 h-4 mr-2" />
                  Crear Nuevo Perfil
                </Button>
                <div className="text-center pt-4">
                  <button 
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    onClick={() => setCurrentView(VIEW_FORGOT)}
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </PageWrapper>
    );
  }

  // Login view
  if (currentView === VIEW_LOGIN) {
    return (
      <PageWrapper>
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-md mx-auto">
            <Card>
              <CardHeader>
                <Button variant="ghost" size="sm" onClick={() => setCurrentView(VIEW_LANDING)} className="w-fit mb-2">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Volver
                </Button>
                <CardTitle>Iniciar Sesión</CardTitle>
                <CardDescription>Ingresa con tu cuenta de atleta</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Correo electrónico</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="tu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Contraseña</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Ingresar
                  </Button>
                  <div className="text-center">
                    <button 
                      type="button"
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                      onClick={() => setCurrentView(VIEW_FORGOT)}
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </PageWrapper>
    );
  }

  // Register view
  if (currentView === VIEW_REGISTER) {
    return (
      <PageWrapper>
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <Card>
              <CardHeader>
                <Button variant="ghost" size="sm" onClick={() => setCurrentView(VIEW_LANDING)} className="w-fit mb-2">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Volver
                </Button>
                <CardTitle>Crear Perfil de Atleta</CardTitle>
                <CardDescription>Completa tu información para crear tu perfil</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRegister} className="space-y-6">
                  {/* Personal Info */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg border-b pb-2 flex items-center gap-2">
                      <User className="w-5 h-5 text-primary" />
                      Información Personal
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="nombre">Nombre *</Label>
                        <Input
                          id="nombre"
                          value={registerData.nombre}
                          onChange={(e) => setRegisterData({...registerData, nombre: e.target.value})}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="apellidos">Apellidos *</Label>
                        <Input
                          id="apellidos"
                          value={registerData.apellidos}
                          onChange={(e) => setRegisterData({...registerData, apellidos: e.target.value})}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="reg-email">Correo electrónico *</Label>
                        <Input
                          id="reg-email"
                          type="email"
                          value={registerData.email}
                          onChange={(e) => setRegisterData({...registerData, email: e.target.value})}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="telefono">Teléfono</Label>
                        <Input
                          id="telefono"
                          type="tel"
                          value={registerData.telefono}
                          onChange={(e) => setRegisterData({...registerData, telefono: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="fecha_nacimiento">Fecha de nacimiento</Label>
                        <Input
                          id="fecha_nacimiento"
                          type="date"
                          value={registerData.fecha_nacimiento}
                          onChange={(e) => setRegisterData({...registerData, fecha_nacimiento: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="genero">Sexo</Label>
                        <select
                          id="genero"
                          value={registerData.genero}
                          onChange={(e) => setRegisterData({...registerData, genero: e.target.value})}
                          className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
                        >
                          <option value="">Seleccionar</option>
                          <option value="masculino">Masculino</option>
                          <option value="femenino">Femenino</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pais">País</Label>
                        <select
                          id="pais"
                          value={registerData.pais}
                          onChange={(e) => setRegisterData({...registerData, pais: e.target.value})}
                          className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
                        >
                          <option value="">Seleccionar país</option>
                          {COUNTRIES.map(country => (
                            <option key={country.code} value={country.name}>{country.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ciudad">Ciudad</Label>
                        <Input
                          id="ciudad"
                          value={registerData.ciudad}
                          onChange={(e) => setRegisterData({...registerData, ciudad: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Emergency Contact */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg border-b pb-2 flex items-center gap-2">
                      <Heart className="w-5 h-5 text-primary" />
                      Contacto de Emergencia
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="emergencia_nombre">Nombre del contacto</Label>
                        <Input
                          id="emergencia_nombre"
                          value={registerData.contacto_emergencia_nombre}
                          onChange={(e) => setRegisterData({...registerData, contacto_emergencia_nombre: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="emergencia_tel">Teléfono del contacto</Label>
                        <Input
                          id="emergencia_tel"
                          type="tel"
                          value={registerData.contacto_emergencia_telefono}
                          onChange={(e) => setRegisterData({...registerData, contacto_emergencia_telefono: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg border-b pb-2 flex items-center gap-2">
                      <Lock className="w-5 h-5 text-primary" />
                      Crear Contraseña
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="reg-password">Contraseña *</Label>
                        <Input
                          id="reg-password"
                          type="password"
                          value={registerData.password}
                          onChange={(e) => setRegisterData({...registerData, password: e.target.value})}
                          placeholder="Mínimo 6 caracteres"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirm-password">Confirmar contraseña *</Label>
                        <Input
                          id="confirm-password"
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <Button type="submit" className="w-full" size="lg" disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Crear Perfil
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </PageWrapper>
    );
  }

  // Verify email view
  if (currentView === VIEW_VERIFY) {
    return (
      <PageWrapper>
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-md mx-auto">
            <Card>
              <CardHeader className="text-center">
                <Mail className="w-12 h-12 text-primary mx-auto mb-4" />
                <CardTitle>Verifica tu correo</CardTitle>
                <CardDescription>
                  Enviamos un código de 6 dígitos a<br/>
                  <span className="font-medium text-foreground">{pendingEmail}</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleVerify} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">Código de verificación</Label>
                    <Input
                      id="code"
                      type="text"
                      placeholder="000000"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="text-center text-2xl tracking-widest"
                      maxLength={6}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading || verificationCode.length !== 6}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Verificar
                  </Button>
                  <div className="text-center">
                    <button 
                      type="button"
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                      onClick={handleResendCode}
                      disabled={loading}
                    >
                      ¿No recibiste el código? Reenviar
                    </button>
                  </div>
                  <div className="text-center pt-2 border-t">
                    <Button variant="ghost" onClick={() => navigate('/')} className="mt-2">
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Volver al inicio
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </PageWrapper>
    );
  }

  // Forgot password view
  if (currentView === VIEW_FORGOT) {
    return (
      <PageWrapper>
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-md mx-auto">
            <Card>
              <CardHeader>
                <Button variant="ghost" size="sm" onClick={() => setCurrentView(VIEW_LOGIN)} className="w-fit mb-2">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Volver
                </Button>
                <CardTitle>Recuperar Contraseña</CardTitle>
                <CardDescription>Ingresa tu correo para recibir un código</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="forgot-email">Correo electrónico</Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      placeholder="tu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Enviar Código
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </PageWrapper>
    );
  }

  // Reset password view
  if (currentView === VIEW_RESET) {
    return (
      <PageWrapper>
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-md mx-auto">
            <Card>
              <CardHeader>
                <CardTitle>Nueva Contraseña</CardTitle>
                <CardDescription>
                  Ingresa el código enviado a {pendingEmail}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reset-code">Código</Label>
                    <Input
                      id="reset-code"
                      type="text"
                      placeholder="000000"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="text-center text-xl tracking-widest"
                      maxLength={6}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">Nueva contraseña</Label>
                    <Input
                      id="new-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-new-password">Confirmar contraseña</Label>
                    <Input
                      id="confirm-new-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Cambiar Contraseña
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </PageWrapper>
    );
  }

  // Dashboard view
  if (currentView === VIEW_DASHBOARD && athlete) {
    return (
      <PageWrapper>
        <div className="container mx-auto px-4 py-8" data-testid="athlete-dashboard">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold" data-testid="dashboard-greeting">
                  Hola, {athlete.nombre}!
                </h1>
                <p className="text-muted-foreground">{athlete.email}</p>
              </div>
              <Button variant="outline" onClick={handleLogout} data-testid="logout-btn">
                <LogOut className="w-4 h-4 mr-2" />
                Cerrar Sesión
              </Button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b pb-2 overflow-x-auto">
              {[
                { key: 'profile', label: 'Mis Datos', icon: User },
                { key: 'races', label: 'Mis Carreras', icon: Calendar },
                { key: 'history', label: 'Historial', icon: Trophy },
              ].map(tab => (
                <Button 
                  key={tab.key}
                  variant={activeTab === tab.key ? 'default' : 'ghost'}
                  onClick={() => setActiveTab(tab.key)}
                  size="sm"
                  data-testid={`tab-${tab.key}`}
                >
                  <tab.icon className="w-4 h-4 mr-2" />
                  {tab.label}
                </Button>
              ))}
            </div>

            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <Card data-testid="profile-card">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5 text-primary" />
                    Mis Datos
                  </CardTitle>
                  {!editMode ? (
                    <Button variant="outline" size="sm" onClick={startEdit} data-testid="edit-profile-btn">
                      <Edit2 className="w-4 h-4 mr-2" />
                      Editar
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setEditMode(false)} data-testid="cancel-edit-btn">
                        Cancelar
                      </Button>
                      <Button size="sm" onClick={handleSaveProfile} disabled={loading} data-testid="save-profile-btn">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Guardar
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  {!editMode ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div data-testid="profile-nombre">
                        <Label className="text-muted-foreground text-sm">Nombre completo</Label>
                        <p className="font-medium">{athlete.nombre} {athlete.apellidos}</p>
                      </div>
                      <div data-testid="profile-email">
                        <Label className="text-muted-foreground text-sm">Email</Label>
                        <p className="font-medium flex items-center gap-2">
                          {athlete.email}
                          {athlete.email_verified && <CheckCircle className="w-4 h-4 text-green-500" />}
                        </p>
                      </div>
                      <div data-testid="profile-telefono">
                        <Label className="text-muted-foreground text-sm">Teléfono</Label>
                        <p className="font-medium">{athlete.telefono || '-'}</p>
                      </div>
                      <div data-testid="profile-nacimiento">
                        <Label className="text-muted-foreground text-sm">Fecha de Nacimiento</Label>
                        <p className="font-medium">{athlete.fecha_nacimiento || '-'}</p>
                      </div>
                      <div data-testid="profile-genero">
                        <Label className="text-muted-foreground text-sm">Sexo</Label>
                        <p className="font-medium capitalize">{athlete.genero || '-'}</p>
                      </div>
                      <div data-testid="profile-ubicacion">
                        <Label className="text-muted-foreground text-sm">País / Ciudad</Label>
                        <p className="font-medium">
                          {athlete.pais || '-'}{athlete.ciudad ? ` / ${athlete.ciudad}` : ''}
                        </p>
                      </div>
                      <div className="md:col-span-2" data-testid="profile-emergencia">
                        <Label className="text-muted-foreground text-sm">Contacto de Emergencia</Label>
                        <p className="font-medium">
                          {athlete.contacto_emergencia_nombre || '-'}
                          {athlete.contacto_emergencia_telefono && ` (${athlete.contacto_emergencia_telefono})`}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nombre</Label>
                        <Input value={editData.nombre} onChange={e => setEditData({...editData, nombre: e.target.value})} data-testid="edit-nombre" />
                      </div>
                      <div className="space-y-2">
                        <Label>Apellidos</Label>
                        <Input value={editData.apellidos} onChange={e => setEditData({...editData, apellidos: e.target.value})} data-testid="edit-apellidos" />
                      </div>
                      <div className="space-y-2">
                        <Label>Teléfono</Label>
                        <Input value={editData.telefono} onChange={e => setEditData({...editData, telefono: e.target.value})} data-testid="edit-telefono" />
                      </div>
                      <div className="space-y-2">
                        <Label>Fecha de Nacimiento</Label>
                        <Input type="date" value={editData.fecha_nacimiento} onChange={e => setEditData({...editData, fecha_nacimiento: e.target.value})} data-testid="edit-nacimiento" />
                      </div>
                      <div className="space-y-2">
                        <Label>Sexo</Label>
                        <select value={editData.genero} onChange={e => setEditData({...editData, genero: e.target.value})} className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground" data-testid="edit-genero">
                          <option value="">Seleccionar</option>
                          <option value="masculino">Masculino</option>
                          <option value="femenino">Femenino</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>País</Label>
                        <select value={editData.pais} onChange={e => setEditData({...editData, pais: e.target.value})} className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground" data-testid="edit-pais">
                          <option value="">Seleccionar país</option>
                          {COUNTRIES.map(c => <option key={c.code} value={c.name}>{c.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Ciudad</Label>
                        <Input value={editData.ciudad} onChange={e => setEditData({...editData, ciudad: e.target.value})} data-testid="edit-ciudad" />
                      </div>
                      <div className="space-y-2">
                        <Label>Contacto Emergencia - Nombre</Label>
                        <Input value={editData.contacto_emergencia_nombre} onChange={e => setEditData({...editData, contacto_emergencia_nombre: e.target.value})} data-testid="edit-emergencia-nombre" />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label>Contacto Emergencia - Teléfono</Label>
                        <Input value={editData.contacto_emergencia_telefono} onChange={e => setEditData({...editData, contacto_emergencia_telefono: e.target.value})} data-testid="edit-emergencia-tel" />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Races Tab */}
            {activeTab === 'races' && (
              <Card data-testid="races-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary" />
                    Próximas Carreras
                  </CardTitle>
                  <CardDescription>Carreras en las que estás inscrito</CardDescription>
                </CardHeader>
                <CardContent>
                  {myRaces.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground" data-testid="no-races-message">
                      <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No tienes inscripciones activas</p>
                      <Button className="mt-4" onClick={() => navigate('/pre-registro')} data-testid="register-race-btn">
                        Inscribirme a una carrera
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {myRaces.map((race) => (
                        <div key={race.registration_id} className="p-4 border rounded-lg" data-testid={`race-${race.registration_id}`}>
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-semibold">{race.race_name}</h3>
                              <p className="text-sm text-muted-foreground">{race.race_date}</p>
                            </div>
                            <div className="text-right space-y-1">
                              {race.bib && <Badge variant="outline">BIB #{race.bib}</Badge>}
                              <div>
                                <Badge variant={race.payment_status === 'paid' ? 'default' : 'secondary'}>
                                  {race.payment_status === 'paid' ? 'Pagado' : 'Pendiente de pago'}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
              <div className="space-y-4" data-testid="history-section">
                {/* Claim 2026 Results */}
                <Card data-testid="claim-results-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Search className="w-5 h-5 text-primary" />
                      Reclamar Resultados 2026
                    </CardTitle>
                    <CardDescription>
                      Participaste en la edición 2026? Busca por nombre o BIB y vincula tus resultados
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2 mb-4">
                      <Input
                        placeholder="Buscar por nombre, apellidos o BIB..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch2026()}
                        data-testid="search-2026-input"
                      />
                      <Button onClick={handleSearch2026} disabled={searching} data-testid="search-2026-btn">
                        {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      </Button>
                    </div>
                    
                    {searchResults.length > 0 && (
                      <div className="space-y-2" data-testid="search-results">
                        {searchResults.map((result) => (
                          <div key={result.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`result-${result.id}`}>
                            <div>
                              <p className="font-medium">
                                {result.nombre} {result.apellidos}
                                <Badge variant="outline" className="ml-2">BIB {result.bib}</Badge>
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {result.laps_completed} vueltas - {result.status === 'winner' ? 'Ganador' : result.status === 'retired' ? 'DNF' : result.status === 'dns' ? 'DNS' : result.status}
                              </p>
                            </div>
                            {result.already_claimed ? (
                              <Badge variant="secondary">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Reclamado
                              </Badge>
                            ) : (
                              <Button size="sm" onClick={() => handleClaimResult(result.id)} data-testid={`claim-btn-${result.id}`}>
                                Reclamar
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Race History */}
                <Card data-testid="race-history-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-primary" />
                      Mi Historial de Carreras
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {raceHistory.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground" data-testid="no-history-message">
                        <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Aún no tienes historial de carreras</p>
                        <p className="text-sm mt-1">Usa el buscador de arriba para reclamar tus resultados de 2026</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {raceHistory.map((race) => (
                          <div key={race.registration_id} className="p-4 border rounded-lg" data-testid={`history-${race.registration_id}`}>
                            <div className="flex justify-between items-start">
                              <div>
                                <h3 className="font-semibold flex items-center gap-2">
                                  {race.race_name || race.race_code}
                                  {race.is_claimed && (
                                    <Badge variant="outline" className="text-xs">Reclamado</Badge>
                                  )}
                                </h3>
                                <p className="text-sm text-muted-foreground">{race.race_date || 'Fecha no disponible'}</p>
                              </div>
                              {race.bib && <Badge variant="outline">BIB #{race.bib}</Badge>}
                            </div>
                            <div className="mt-3 flex flex-wrap gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">Vueltas:</span>
                                <span className="ml-1 font-semibold">{race.laps_completed}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Distancia:</span>
                                <span className="ml-1 font-semibold">{(race.laps_completed * 6.7).toFixed(1)} km</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Estado:</span>
                                <Badge variant="secondary" className="ml-1">
                                  {race.status === 'winner' ? 'Ganador' : 
                                   race.status === 'retired' ? 'DNF' : 
                                   race.status === 'dns' ? 'DNS' : 
                                   race.status === 'active' ? 'Activo' : race.status}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </PageWrapper>
    );
  }

  return null;
}
