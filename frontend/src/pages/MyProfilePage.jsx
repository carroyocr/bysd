import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { User, Mail, Lock, Eye, EyeOff, ArrowLeft, Trophy, Calendar, Search, CheckCircle, Loader2, Heart, Edit2, LogOut, Camera, Upload, AlertCircle, Info, ExternalLink, XCircle, MessageCircle } from 'lucide-react';
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

// Register steps
const REG_STEPS = [
  { key: 'account', label: 'Cuenta' },
  { key: 'personal', label: 'Personal' },
  { key: 'medical', label: 'Médico' },
  { key: 'emergency', label: 'Emergencia' },
  { key: 'preferences', label: 'Preferencias' },
  { key: 'photo', label: 'Foto' },
];

// Page wrapper (matches CorredoresPage structure: pt-20 for nav clearance + py-20 section)
const PageContent = ({ children }) => (
  <div className="pt-16">
    <section className="py-10 bg-gradient-to-b from-muted/20 to-background min-h-[60vh]">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto space-y-8">
          {children}
        </div>
      </div>
    </section>
  </div>
);

const SectionHeader = ({ title, subtitle }) => (
  <div className="text-center space-y-4">
    <h2 className="font-display text-4xl sm:text-5xl text-foreground">{title}</h2>
    {subtitle && <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{subtitle}</p>}
  </div>
);

export default function MyProfilePage() {
  const navigate = useNavigate();
  const { config } = useRaceConfig();
  const raceCost = config?.registration_cost || 3500;
  const formattedCost = `RD$${raceCost.toLocaleString('es-DO')}`;
  
  // Auth state
  const [currentView, setCurrentView] = useState(VIEW_LANDING);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [athlete, setAthlete] = useState(null);
  
  // Register multi-step
  const [regStep, setRegStep] = useState(0);
  const [regData, setRegData] = useState({
    email: '', password: '', confirmPassword: '',
    nombre: '', apellidos: '', fecha_nacimiento: '', sexo: '',
    nacionalidad: '', telefono: '', ciudad_residencia: '',
    tipo_sangre: '', condicion_medica: 'No', condicion_medica_detalle: '',
    alergias: 'No', alergias_detalle: '',
    contacto_emergencia_nombre: '', contacto_emergencia_relacion: '', contacto_emergencia_telefono: '',
    talla_camiseta: '', personalizacion_camiseta: '', como_se_entero: '',
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  
  // Dashboard state
  const [myRaces, setMyRaces] = useState([]);
  const [raceHistory, setRaceHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('profile');
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({});
  
  // Search 2026
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  
  // Cheer messages
  const [cheerMessages, setCheerMessages] = useState([]);
  const [cheerRaces, setCheerRaces] = useState([]);
  const [cheerFilter, setCheerFilter] = useState('');
  
  // Race inscription
  const [showInscription, setShowInscription] = useState(false);
  const [inscriptionData, setInscriptionData] = useState({
    motivacion: '', anos_experiencia: '', maxima_distancia_km: '',
    vueltas_aspiradas: '', tiene_carpa: '', hospedaje: '', acompanantes: '',
  });
  const [inscribing, setInscribing] = useState(false);

  // API helper using XMLHttpRequest
  const apiCall = (method, url, body = null) => {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open(method, url, true);
      if (body) xhr.setRequestHeader('Content-Type', 'application/json');
      const token = localStorage.getItem('athlete_token');
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.onload = () => {
        let data = {};
        try { data = JSON.parse(xhr.responseText); } catch {}
        resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, data });
      };
      xhr.onerror = () => resolve({ ok: false, status: 0, data: {} });
      xhr.send(body ? JSON.stringify(body) : null);
    });
  };

  // Check for existing session
  useEffect(() => {
    const token = localStorage.getItem('athlete_token');
    if (token) fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const { ok, data } = await apiCall('GET', `${API_URL}/api/athletes/profile`);
    if (ok) {
      setAthlete(data);
      setCurrentView(VIEW_DASHBOARD);
      fetchMyRaces();
      fetchRaceHistory();
    } else {
      localStorage.removeItem('athlete_token');
    }
  };

  const fetchMyRaces = async () => {
    const { ok, data } = await apiCall('GET', `${API_URL}/api/athletes/my-races`);
    if (ok) setMyRaces(data.races || []);
  };

  const fetchRaceHistory = async () => {
    const { ok, data } = await apiCall('GET', `${API_URL}/api/athletes/race-history`);
    if (ok) setRaceHistory(data.history || []);
  };

  const fetchCheerMessages = async (raceFilter) => {
    const url = raceFilter ? `${API_URL}/api/athletes/my-messages?race_code=${encodeURIComponent(raceFilter)}` : `${API_URL}/api/athletes/my-messages`;
    const { ok, data } = await apiCall('GET', url);
    if (ok) {
      setCheerMessages(data.messages || []);
      if (!raceFilter) setCheerRaces(data.races || []);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('athlete_token');
    setAthlete(null);
    setCurrentView(VIEW_LANDING);
    setActiveTab('profile');
    toast.success('Sesión cerrada');
  };

  // ===== AUTH HANDLERS =====
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { ok, status, data } = await apiCall('POST', `${API_URL}/api/athletes/login`, { email, password });
      if (ok) {
        localStorage.setItem('athlete_token', data.token);
        toast.success('Bienvenido!');
        await fetchProfile();
      } else if (status === 403) {
        setPendingEmail(email);
        toast.info('Te enviamos un codigo de verificacion');
        setCurrentView(VIEW_VERIFY);
      } else {
        toast.error(data.detail || 'Error al iniciar sesion');
      }
    } catch { toast.error('Error de conexion'); }
    finally { setLoading(false); }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { ok, data } = await apiCall('POST', `${API_URL}/api/athletes/verify-email`, { email: pendingEmail, code: verificationCode });
      if (ok) {
        localStorage.setItem('athlete_token', data.token);
        // Upload photo if one was selected during registration
        if (photoFile) {
          toast.info('Subiendo foto...');
          await uploadPhoto(data.token);
        }
        toast.success('Email verificado!');
        await fetchProfile();
      } else { toast.error(data.detail || 'Codigo incorrecto'); }
    } catch { toast.error('Error de conexion'); }
    finally { setLoading(false); }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { ok } = await apiCall('POST', `${API_URL}/api/athletes/forgot-password`, { email });
      if (ok) {
        setPendingEmail(email);
        toast.success('Codigo enviado a tu correo');
        setCurrentView(VIEW_RESET);
      }
    } catch { toast.error('Error de conexion'); }
    finally { setLoading(false); }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { ok, data } = await apiCall('POST', `${API_URL}/api/athletes/reset-password`, { email: pendingEmail, code: resetCode, new_password: newPassword });
      if (ok) {
        toast.success('Contrasena actualizada');
        setCurrentView(VIEW_LOGIN);
      } else { toast.error(data.detail || 'Error al restablecer'); }
    } catch { toast.error('Error de conexion'); }
    finally { setLoading(false); }
  };

  // ===== REGISTER MULTI-STEP =====
  const updateReg = (field, value) => setRegData(prev => ({ ...prev, [field]: value }));

  const validateRegStep = () => {
    switch (regStep) {
      case 0:
        if (!regData.email || !regData.password) { toast.error('Completa email y contrasena'); return false; }
        if (regData.password.length < 6) { toast.error('La contrasena debe tener al menos 6 caracteres'); return false; }
        if (regData.password !== regData.confirmPassword) { toast.error('Las contrasenas no coinciden'); return false; }
        return 'check_email'; // signal to check email async
      case 1:
        if (!regData.nombre || !regData.apellidos || !regData.fecha_nacimiento || !regData.sexo || !regData.nacionalidad || !regData.telefono || !regData.ciudad_residencia) {
          toast.error('Por favor completa todos los campos obligatorios'); return false;
        }
        break;
      case 2:
        if (!regData.tipo_sangre) { toast.error('Por favor indica tu tipo de sangre'); return false; }
        if (regData.condicion_medica === 'Si' && !regData.condicion_medica_detalle) { toast.error('Especifica tu condicion medica'); return false; }
        if (regData.alergias === 'Si' && !regData.alergias_detalle) { toast.error('Especifica tus alergias'); return false; }
        break;
      case 3:
        if (!regData.contacto_emergencia_nombre || !regData.contacto_emergencia_telefono) { toast.error('Completa los datos de contacto de emergencia'); return false; }
        break;
      case 4:
        if (!regData.talla_camiseta || !regData.personalizacion_camiseta) { toast.error('Completa la talla y personalizacion de camiseta'); return false; }
        if (regData.personalizacion_camiseta.length > 15) { toast.error('La personalizacion no puede exceder 15 caracteres'); return false; }
        break;
    }
    return true;
  };

  const nextRegStep = async () => {
    const result = validateRegStep();
    if (result === false) return;
    if (result === 'check_email') {
      setLoading(true);
      const { ok, data } = await apiCall('POST', `${API_URL}/api/athletes/check-email`, { email: regData.email });
      setLoading(false);
      if (!ok) { toast.error(data.detail || 'Este correo ya esta registrado'); return; }
    }
    setRegStep(prev => Math.min(prev + 1, REG_STEPS.length - 1));
  };
  const prevRegStep = () => setRegStep(prev => Math.max(prev - 1, 0));

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size < 1024 * 1024) { toast.error('La foto debe ser de alta resolucion (minimo 1MB)'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('El archivo es demasiado grande (maximo 10MB)'); return; }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const uploadPhoto = async (token) => {
    if (!photoFile) return;
    const formDataObj = new FormData();
    formDataObj.append('photo', photoFile);
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_URL}/api/athletes/upload-photo`, true);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.onload = () => { resolve(xhr.status >= 200 && xhr.status < 300); };
      xhr.onerror = () => { resolve(false); };
      xhr.send(formDataObj);
    });
  };

  const submitRegistration = async () => {
    setLoading(true);
    try {
      const payload = { ...regData };
      delete payload.confirmPassword;
      const { ok, data } = await apiCall('POST', `${API_URL}/api/athletes/register`, payload);
      if (ok) {
        setPendingEmail(regData.email);
        toast.success('Perfil creado! Revisa tu correo para verificar tu cuenta.');
        setCurrentView(VIEW_VERIFY);
      } else {
        toast.error(data.detail || 'Error en el registro');
      }
    } catch { toast.error('Error de conexion'); }
    finally { setLoading(false); }
  };

  // ===== PROFILE EDIT =====
  const startEdit = () => {
    setEditData({
      nombre: athlete?.nombre || '', apellidos: athlete?.apellidos || '',
      telefono: athlete?.telefono || '', fecha_nacimiento: athlete?.fecha_nacimiento || '',
      sexo: athlete?.sexo || '', nacionalidad: athlete?.nacionalidad || '',
      ciudad_residencia: athlete?.ciudad_residencia || '',
      tipo_sangre: athlete?.tipo_sangre || '',
      condicion_medica: athlete?.condicion_medica || 'No', condicion_medica_detalle: athlete?.condicion_medica_detalle || '',
      alergias: athlete?.alergias || 'No', alergias_detalle: athlete?.alergias_detalle || '',
      contacto_emergencia_nombre: athlete?.contacto_emergencia_nombre || '',
      contacto_emergencia_relacion: athlete?.contacto_emergencia_relacion || '',
      contacto_emergencia_telefono: athlete?.contacto_emergencia_telefono || '',
      talla_camiseta: athlete?.talla_camiseta || '', personalizacion_camiseta: athlete?.personalizacion_camiseta || '',
      como_se_entero: athlete?.como_se_entero || '',
    });
    setEditMode(true);
  };

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      const { ok, data } = await apiCall('PUT', `${API_URL}/api/athletes/profile`, editData);
      if (ok) { toast.success('Perfil actualizado'); setEditMode(false); await fetchProfile(); }
      else { toast.error(data.detail || 'Error al guardar'); }
    } catch { toast.error('Error de conexion'); }
    finally { setLoading(false); }
  };

  // ===== SEARCH & CLAIM 2026 =====
  const handleSearch2026 = async () => {
    if (!searchTerm || searchTerm.length < 2) { toast.error('Ingresa al menos 2 caracteres'); return; }
    setSearching(true);
    const { ok, data } = await apiCall('GET', `${API_URL}/api/athletes/search-2026-results?q=${encodeURIComponent(searchTerm)}`);
    if (ok) setSearchResults(data.results || []);
    setSearching(false);
  };

  const handleClaimResult = async (resultId) => {
    const { ok, data } = await apiCall('POST', `${API_URL}/api/athletes/claim-result`, { result_id: resultId });
    if (ok) { toast.success('Resultado reclamado!'); fetchRaceHistory(); handleSearch2026(); }
    else { toast.error(data.detail || 'Error al reclamar'); }
  };

  // ===== RACE INSCRIPTION =====
  const handleInscribeRace = async () => {
    if (!inscriptionData.motivacion) { toast.error('Indica que te motiva a participar'); return; }
    setInscribing(true);
    try {
      const payload = {
        race_code: config?.code || 'BYSD-2027',
        motivacion: inscriptionData.motivacion,
        anos_experiencia: inscriptionData.anos_experiencia ? parseInt(inscriptionData.anos_experiencia) : null,
        maxima_distancia_km: inscriptionData.maxima_distancia_km ? parseFloat(inscriptionData.maxima_distancia_km) : null,
        vueltas_aspiradas: inscriptionData.vueltas_aspiradas,
        tiene_carpa: inscriptionData.tiene_carpa,
        hospedaje: inscriptionData.hospedaje,
        acompanantes: inscriptionData.acompanantes ? parseInt(inscriptionData.acompanantes) : null,
      };
      const { ok, data } = await apiCall('POST', `${API_URL}/api/athletes/register-race`, payload);
      if (ok) {
        toast.success(`Inscripcion realizada! BIB #${data.bib}`);
        setShowInscription(false);
        fetchMyRaces();
      } else { toast.error(data.detail || 'Error al inscribirse'); }
    } catch { toast.error('Error de conexion'); }
    finally { setInscribing(false); }
  };

  // Cancel race registration
  const handleCancelRace = async (registrationId) => {
    if (!window.confirm('Estas seguro que deseas cancelar tu inscripcion? Esta accion no se puede deshacer.')) return;
    setLoading(true);
    try {
      const { ok, data } = await apiCall('DELETE', `${API_URL}/api/athletes/cancel-race/${registrationId}`);
      if (ok) { toast.success('Inscripcion cancelada'); fetchMyRaces(); }
      else { toast.error(data.detail || 'Error al cancelar'); }
    } catch { toast.error('Error de conexion'); }
    finally { setLoading(false); }
  };

  // ===== REGISTER STEP CONTENT =====
  const renderRegStep = () => {
    switch (regStep) {
      case 0: // Account
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Correo Electronico *</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="email" value={regData.email} onChange={e => updateReg('email', e.target.value)} placeholder="tu@email.com" className="pl-10" data-testid="reg-email" />
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Contrasena *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input type={showPassword ? "text" : "password"} value={regData.password} onChange={e => updateReg('password', e.target.value)} placeholder="Min. 6 caracteres" className="pl-10 pr-10" data-testid="reg-password" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Confirmar Contrasena *</Label>
                <Input type="password" value={regData.confirmPassword} onChange={e => updateReg('confirmPassword', e.target.value)} placeholder="Repite tu contrasena" data-testid="reg-confirm-password" />
              </div>
            </div>
          </div>
        );
      case 1: // Personal
        return (
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre *</Label>
                <Input value={regData.nombre} onChange={e => updateReg('nombre', e.target.value)} placeholder="Tu nombre" data-testid="reg-nombre" />
              </div>
              <div className="space-y-2">
                <Label>Apellidos *</Label>
                <Input value={regData.apellidos} onChange={e => updateReg('apellidos', e.target.value)} placeholder="Tus apellidos" data-testid="reg-apellidos" />
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha de Nacimiento *</Label>
                <Input type="date" value={regData.fecha_nacimiento} onChange={e => updateReg('fecha_nacimiento', e.target.value)} data-testid="reg-nacimiento" />
              </div>
              <div className="space-y-2">
                <Label>Sexo *</Label>
                <div className="flex gap-4 pt-2">
                  {['Masculino', 'Femenino'].map(option => (
                    <label key={option} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="reg-sexo" value={option} checked={regData.sexo === option} onChange={e => updateReg('sexo', e.target.value)} className="w-4 h-4 text-primary" />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nacionalidad *</Label>
                <select value={regData.nacionalidad} onChange={e => updateReg('nacionalidad', e.target.value)} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" data-testid="reg-nacionalidad">
                  <option value="">Seleccionar pais</option>
                  {COUNTRIES.map(c => <option key={c.code} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Telefono *</Label>
                <Input type="tel" value={regData.telefono} onChange={e => updateReg('telefono', e.target.value)} placeholder="+1 809 555 0000" data-testid="reg-telefono" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Ciudad de Residencia *</Label>
              <Input value={regData.ciudad_residencia} onChange={e => updateReg('ciudad_residencia', e.target.value)} placeholder="Ej: Santo Domingo" data-testid="reg-ciudad" />
            </div>
          </div>
        );
      case 2: // Medical
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Tipo de Sangre *</Label>
              <select value={regData.tipo_sangre} onChange={e => updateReg('tipo_sangre', e.target.value)} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" data-testid="reg-sangre">
                <option value="">Selecciona...</option>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Padeces alguna condicion medica relevante? *</Label>
                <div className="flex gap-4">
                  {['No', 'Si'].map(option => (
                    <label key={option} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="condicion_medica" value={option} checked={regData.condicion_medica === option} onChange={e => updateReg('condicion_medica', e.target.value)} className="w-4 h-4 text-primary" />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </div>
              {regData.condicion_medica === 'Si' && (
                <div className="space-y-2">
                  <Label>Especificar condicion medica *</Label>
                  <Input value={regData.condicion_medica_detalle} onChange={e => updateReg('condicion_medica_detalle', e.target.value)} placeholder="Describe tu condicion medica" />
                </div>
              )}
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Eres alergico a algun medicamento o alimento? *</Label>
                <div className="flex gap-4">
                  {['No', 'Si'].map(option => (
                    <label key={option} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="alergias" value={option} checked={regData.alergias === option} onChange={e => updateReg('alergias', e.target.value)} className="w-4 h-4 text-primary" />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </div>
              {regData.alergias === 'Si' && (
                <div className="space-y-2">
                  <Label>Especificar alergias *</Label>
                  <Input value={regData.alergias_detalle} onChange={e => updateReg('alergias_detalle', e.target.value)} placeholder="Describe tus alergias" />
                </div>
              )}
            </div>
          </div>
        );
      case 3: // Emergency
        return (
          <div className="space-y-6">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-amber-800">Informacion Importante</h4>
                  <p className="text-sm text-amber-700">Esta informacion sera utilizada unicamente en caso de emergencia durante el evento.</p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nombre del Contacto de Emergencia *</Label>
              <Input value={regData.contacto_emergencia_nombre} onChange={e => updateReg('contacto_emergencia_nombre', e.target.value)} placeholder="Nombre completo" data-testid="reg-emergencia-nombre" />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Relacion con el Contacto</Label>
                <Input value={regData.contacto_emergencia_relacion} onChange={e => updateReg('contacto_emergencia_relacion', e.target.value)} placeholder="Ej: Esposo/a, Padre, Madre" />
              </div>
              <div className="space-y-2">
                <Label>Telefono del Contacto *</Label>
                <Input type="tel" value={regData.contacto_emergencia_telefono} onChange={e => updateReg('contacto_emergencia_telefono', e.target.value)} placeholder="+1 809 555 0000" data-testid="reg-emergencia-tel" />
              </div>
            </div>
          </div>
        );
      case 4: // Preferences
        return (
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Talla de Camiseta *</Label>
                <select value={regData.talla_camiseta} onChange={e => updateReg('talla_camiseta', e.target.value)} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" data-testid="reg-talla">
                  <option value="">Selecciona...</option>
                  {['XS', 'S', 'M', 'L', 'XL', 'XXL'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Personalizacion Camiseta/BIB * <span className="text-xs text-muted-foreground">(max. 15 caracteres)</span></Label>
                <Input maxLength={15} value={regData.personalizacion_camiseta} onChange={e => updateReg('personalizacion_camiseta', e.target.value.toUpperCase())} placeholder="Ej: JUAN o RUNNER" className="uppercase" data-testid="reg-personalizacion" />
                <p className="text-xs text-muted-foreground text-right">{regData.personalizacion_camiseta.length}/15</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Como te enteraste del evento?</Label>
              <Input value={regData.como_se_entero} onChange={e => updateReg('como_se_entero', e.target.value)} placeholder="Ej: Instagram, amigo, club de running..." />
            </div>
          </div>
        );
      case 5: // Photo
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Camera className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Foto del Participante</h3>
              <p className="text-muted-foreground mt-2">Sube una foto de alta resolucion para tu perfil y credencial</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex gap-3">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-700">
                  <p className="font-medium">Requisitos de la foto:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Alta resolucion (minimo 1MB)</li>
                    <li>Formato: JPG, PNG o WebP</li>
                    <li>Tamano maximo: 10MB</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-center gap-6">
              {photoPreview && (
                <img src={photoPreview} alt="Preview" className="w-48 h-48 object-cover rounded-lg shadow-md" />
              )}
              <label className="flex flex-col items-center justify-center w-full max-w-md h-32 border-2 border-dashed border-primary/30 rounded-lg cursor-pointer hover:bg-primary/5 transition-colors">
                <Upload className="w-8 h-8 text-primary mb-2" />
                <p className="text-sm text-muted-foreground"><span className="font-semibold text-primary">Haz clic para subir</span> o arrastra tu foto</p>
                <p className="text-xs text-muted-foreground mt-1">JPG, PNG o WebP (min. 1MB, max. 10MB)</p>
                <input type="file" className="hidden" accept="image/jpeg,image/jpg,image/png,image/webp" onChange={handlePhotoChange} data-testid="reg-photo-input" />
              </label>
              {photoFile && <p className="text-sm text-muted-foreground">Archivo: {photoFile.name} ({(photoFile.size / 1024 / 1024).toFixed(2)} MB)</p>}
            </div>
          </div>
        );
      default: return null;
    }
  };

  // ===== LANDING VIEW =====
  if (currentView === VIEW_LANDING) {
    return (
      <PageContent>
        <SectionHeader title="Mi Perfil de Atleta" subtitle="Gestiona tu perfil, inscripciones y resultados" />
        <div className="max-w-md mx-auto" data-testid="landing-card">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <Button className="w-full" size="lg" onClick={() => setCurrentView(VIEW_LOGIN)} data-testid="go-to-login-btn">
                <Lock className="w-4 h-4 mr-2" /> Iniciar Sesion
              </Button>
              <Button variant="outline" className="w-full" size="lg" onClick={() => setCurrentView(VIEW_REGISTER)} data-testid="go-to-register-btn">
                <User className="w-4 h-4 mr-2" /> Crear Nuevo Perfil
              </Button>
              <div className="text-center pt-2">
                <button className="text-sm text-muted-foreground hover:text-primary transition-colors" onClick={() => setCurrentView(VIEW_FORGOT)} data-testid="go-to-forgot-btn">
                  Olvidaste tu contrasena?
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </PageContent>
    );
  }

  // ===== LOGIN VIEW =====
  if (currentView === VIEW_LOGIN) {
    return (
      <PageContent>
        <SectionHeader title="Iniciar Sesion" subtitle="Ingresa con tu cuenta de atleta" />
        <div className="max-w-md mx-auto" data-testid="login-card">
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleLogin} className="space-y-4" data-testid="login-form">
                <Button variant="ghost" size="sm" type="button" onClick={() => setCurrentView(VIEW_LANDING)} className="w-fit mb-2" data-testid="login-back-btn">
                  <ArrowLeft className="w-4 h-4 mr-2" /> Volver
                </Button>
                <div className="space-y-2">
                  <Label>Correo electronico</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" className="pl-10" required data-testid="login-email-input" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Contrasena</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Tu contrasena" className="pl-10 pr-10" required data-testid="login-password-input" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading} data-testid="login-submit-btn">
                  {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Ingresar
                </Button>
                <div className="text-center">
                  <button type="button" className="text-sm text-muted-foreground hover:text-primary" onClick={() => setCurrentView(VIEW_FORGOT)} data-testid="login-forgot-link">Olvidaste tu contrasena?</button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </PageContent>
    );
  }

  // ===== REGISTER VIEW (Multi-Step) =====
  if (currentView === VIEW_REGISTER) {
    return (
      <PageContent>
        <SectionHeader title="Crear Perfil de Atleta" subtitle="Completa tu informacion para participar en eventos" />
        <div className="max-w-3xl mx-auto space-y-6" data-testid="register-form">
          

          <Card>
            <CardHeader>
              <Button variant="ghost" size="sm" onClick={() => { if (regStep > 0) prevRegStep(); else setCurrentView(VIEW_LANDING); }} className="w-fit mb-2" data-testid="reg-back-btn">
                <ArrowLeft className="w-4 h-4 mr-2" /> {regStep > 0 ? 'Anterior' : 'Volver'}
              </Button>
              {/* Step indicator */}
              <div className="flex items-center justify-between mb-4">
                {REG_STEPS.map((step, i) => (
                  <div key={step.key} className="flex items-center flex-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${i <= regStep ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                      {i < regStep ? <CheckCircle className="w-4 h-4" /> : i + 1}
                    </div>
                    {i < REG_STEPS.length - 1 && (
                      <div className={`flex-1 h-1 mx-1 rounded ${i < regStep ? 'bg-primary' : 'bg-muted'}`} />
                    )}
                  </div>
                ))}
              </div>
              <CardTitle className="text-lg">{REG_STEPS[regStep].label}</CardTitle>
            </CardHeader>
            <CardContent>
              {renderRegStep()}
              <div className="flex justify-between mt-8">
                {regStep > 0 && <Button variant="outline" onClick={prevRegStep}>Anterior</Button>}
                <div className="ml-auto">
                  {regStep < REG_STEPS.length - 1 ? (
                    <Button onClick={nextRegStep} data-testid="reg-next-btn">Siguiente</Button>
                  ) : (
                    <Button onClick={submitRegistration} disabled={loading} data-testid="reg-submit-btn">
                      {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Crear Perfil
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </PageContent>
    );
  }

  // ===== VERIFY VIEW =====
  if (currentView === VIEW_VERIFY) {
    return (
      <PageContent>
        <SectionHeader title="Verificar Email" subtitle={`Ingresa el codigo enviado a ${pendingEmail}`} />
        <div className="max-w-md mx-auto">
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleVerify} className="space-y-4">
                <div className="space-y-2">
                  <Label>Codigo de Verificacion (6 digitos)</Label>
                  <Input type="text" maxLength={6} value={verificationCode} onChange={e => setVerificationCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" className="text-center text-2xl tracking-widest" data-testid="verify-code-input" />
                </div>
                <Button type="submit" className="w-full" disabled={loading} data-testid="verify-submit-btn">
                  {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Verificar
                </Button>
                <Button variant="ghost" type="button" className="w-full" onClick={() => setCurrentView(VIEW_LANDING)}>Volver</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </PageContent>
    );
  }

  // ===== FORGOT PASSWORD VIEW =====
  if (currentView === VIEW_FORGOT) {
    return (
      <PageContent>
        <SectionHeader title="Recuperar Contrasena" subtitle="Te enviaremos un codigo a tu correo" />
        <div className="max-w-md mx-auto">
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleForgot} className="space-y-4">
                <Button variant="ghost" size="sm" type="button" onClick={() => setCurrentView(VIEW_LANDING)} className="w-fit mb-2"><ArrowLeft className="w-4 h-4 mr-2" /> Volver</Button>
                <div className="space-y-2">
                  <Label>Correo electronico</Label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Enviar Codigo
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </PageContent>
    );
  }

  // ===== RESET PASSWORD VIEW =====
  if (currentView === VIEW_RESET) {
    return (
      <PageContent>
        <SectionHeader title="Restablecer Contrasena" subtitle={`Ingresa el codigo enviado a ${pendingEmail}`} />
        <div className="max-w-md mx-auto">
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleReset} className="space-y-4">
                <div className="space-y-2">
                  <Label>Codigo de Verificacion</Label>
                  <Input type="text" maxLength={6} value={resetCode} onChange={e => setResetCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" className="text-center text-2xl tracking-widest" />
                </div>
                <div className="space-y-2">
                  <Label>Nueva Contrasena</Label>
                  <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min. 6 caracteres" required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Restablecer
                </Button>
                <Button variant="ghost" type="button" className="w-full" onClick={() => setCurrentView(VIEW_LOGIN)}>Volver al Login</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </PageContent>
    );
  }

  // ===== DASHBOARD VIEW =====
  if (currentView === VIEW_DASHBOARD && athlete) {
    const activeRace = config;
    const isRegisteredForActive = myRaces.some(r => r.is_active);
    
    return (
      <PageContent>
        <div data-testid="athlete-dashboard">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-3xl sm:text-4xl text-foreground">Hola, {athlete.nombre}!</h2>
              <p className="text-muted-foreground">{athlete.email}</p>
            </div>
            <Button variant="outline" onClick={handleLogout} data-testid="logout-btn"><LogOut className="w-4 h-4 mr-2" /> Cerrar Sesion</Button>
          </div>

          {/* Profile incomplete banner */}
          {!athlete.profile_complete && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-amber-800">Perfil Incompleto</h4>
                  <p className="text-sm text-amber-700">Completa tu perfil para poder inscribirte a carreras. Haz clic en "Editar" en la pestana Mis Datos.</p>
                </div>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-2 border-b pb-2 overflow-x-auto">
            {[
              { key: 'profile', label: 'Mis Datos', icon: User },
              { key: 'races', label: 'Mis Carreras', icon: Calendar },
              { key: 'history', label: 'Historial', icon: Trophy },
            ].map(tab => (
              <Button key={tab.key} variant={activeTab === tab.key ? 'default' : 'ghost'} onClick={() => setActiveTab(tab.key)} size="sm" data-testid={`tab-${tab.key}`}>
                <tab.icon className="w-4 h-4 mr-2" />{tab.label}
              </Button>
            ))}
          </div>

          {/* ===== PROFILE TAB ===== */}
          {activeTab === 'profile' && (
            <Card data-testid="profile-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2"><User className="w-5 h-5 text-primary" /> Mis Datos</CardTitle>
                {!editMode ? (
                  <Button variant="outline" size="sm" onClick={startEdit} data-testid="edit-profile-btn"><Edit2 className="w-4 h-4 mr-2" />Editar</Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditMode(false)} data-testid="cancel-edit-btn">Cancelar</Button>
                    <Button size="sm" onClick={handleSaveProfile} disabled={loading} data-testid="save-profile-btn">{loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Guardar</Button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {!editMode ? (
                  <div className="space-y-6">
                    {/* Photo + Name Header */}
                    <div className="flex items-center gap-6 pb-4 border-b">
                      <div className="relative group">
                        {athlete.photo_url ? (
                          <img src={`${API_URL}${athlete.photo_url}`} alt={athlete.nombre} className="w-24 h-24 rounded-full object-cover border-2 border-primary/20" data-testid="profile-photo" />
                        ) : (
                          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/20" data-testid="profile-photo-placeholder">
                            <User className="w-10 h-10 text-primary/50" />
                          </div>
                        )}
                        <label className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/30 flex items-center justify-center cursor-pointer transition-colors">
                          <Camera className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          <input type="file" className="hidden" accept="image/jpeg,image/jpg,image/png,image/webp" onChange={async (e) => {
                            const file = e.target.files[0];
                            if (!file) return;
                            if (file.size > 10 * 1024 * 1024) { toast.error('Maximo 10MB'); return; }
                            const formData = new FormData();
                            formData.append('photo', file);
                            const xhr = new XMLHttpRequest();
                            xhr.open('POST', `${API_URL}/api/athletes/upload-photo`, true);
                            xhr.setRequestHeader('Authorization', `Bearer ${localStorage.getItem('athlete_token')}`);
                            xhr.onload = () => { if (xhr.status >= 200 && xhr.status < 300) { toast.success('Foto actualizada'); fetchProfile(); } else { toast.error('Error al subir foto'); } };
                            xhr.send(formData);
                          }} data-testid="profile-photo-upload" />
                        </label>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">{athlete.nombre} {athlete.apellidos}</h3>
                        <p className="text-muted-foreground flex items-center gap-2">{athlete.email} {athlete.email_verified && <CheckCircle className="w-4 h-4 text-green-500" />}</p>
                        {athlete.personalizacion_camiseta && <Badge variant="outline" className="mt-1 uppercase">{athlete.personalizacion_camiseta}</Badge>}
                      </div>
                    </div>
                    {/* Personal */}
                    <div>
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Datos Personales</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div data-testid="profile-nombre"><Label className="text-muted-foreground text-xs">Nombre completo</Label><p className="font-medium">{athlete.nombre} {athlete.apellidos}</p></div>
                        <div data-testid="profile-email"><Label className="text-muted-foreground text-xs">Email</Label><p className="font-medium flex items-center gap-2">{athlete.email}{athlete.email_verified && <CheckCircle className="w-4 h-4 text-green-500" />}</p></div>
                        <div><Label className="text-muted-foreground text-xs">Telefono</Label><p className="font-medium">{athlete.telefono || '-'}</p></div>
                        <div><Label className="text-muted-foreground text-xs">Fecha de Nacimiento</Label><p className="font-medium">{athlete.fecha_nacimiento || '-'}</p></div>
                        <div><Label className="text-muted-foreground text-xs">Sexo</Label><p className="font-medium">{athlete.sexo || '-'}</p></div>
                        <div><Label className="text-muted-foreground text-xs">Nacionalidad / Ciudad</Label><p className="font-medium">{athlete.nacionalidad || '-'}{athlete.ciudad_residencia ? ` / ${athlete.ciudad_residencia}` : ''}</p></div>
                      </div>
                    </div>
                    {/* Medical */}
                    <div>
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Informacion Medica</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div><Label className="text-muted-foreground text-xs">Tipo de Sangre</Label><p className="font-medium">{athlete.tipo_sangre || '-'}</p></div>
                        <div><Label className="text-muted-foreground text-xs">Condicion Medica</Label><p className="font-medium">{athlete.condicion_medica || 'No'}{athlete.condicion_medica_detalle ? ` - ${athlete.condicion_medica_detalle}` : ''}</p></div>
                        <div><Label className="text-muted-foreground text-xs">Alergias</Label><p className="font-medium">{athlete.alergias || 'No'}{athlete.alergias_detalle ? ` - ${athlete.alergias_detalle}` : ''}</p></div>
                      </div>
                    </div>
                    {/* Emergency */}
                    <div>
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Contacto de Emergencia</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div><Label className="text-muted-foreground text-xs">Nombre</Label><p className="font-medium">{athlete.contacto_emergencia_nombre || '-'}</p></div>
                        <div><Label className="text-muted-foreground text-xs">Relacion</Label><p className="font-medium">{athlete.contacto_emergencia_relacion || '-'}</p></div>
                        <div><Label className="text-muted-foreground text-xs">Telefono</Label><p className="font-medium">{athlete.contacto_emergencia_telefono || '-'}</p></div>
                      </div>
                    </div>
                    {/* Preferences */}
                    <div>
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Preferencias</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div><Label className="text-muted-foreground text-xs">Talla Camiseta</Label><p className="font-medium">{athlete.talla_camiseta || '-'}</p></div>
                        <div><Label className="text-muted-foreground text-xs">Personalizacion BIB</Label><p className="font-medium uppercase">{athlete.personalizacion_camiseta || '-'}</p></div>
                        <div><Label className="text-muted-foreground text-xs">Como se entero</Label><p className="font-medium">{athlete.como_se_entero || '-'}</p></div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Nombre</Label><Input value={editData.nombre} onChange={e => setEditData({...editData, nombre: e.target.value})} /></div>
                      <div className="space-y-2"><Label>Apellidos</Label><Input value={editData.apellidos} onChange={e => setEditData({...editData, apellidos: e.target.value})} /></div>
                      <div className="space-y-2"><Label>Telefono</Label><Input value={editData.telefono} onChange={e => setEditData({...editData, telefono: e.target.value})} /></div>
                      <div className="space-y-2"><Label>Fecha de Nacimiento</Label><Input type="date" value={editData.fecha_nacimiento} onChange={e => setEditData({...editData, fecha_nacimiento: e.target.value})} /></div>
                      <div className="space-y-2">
                        <Label>Sexo</Label>
                        <select value={editData.sexo} onChange={e => setEditData({...editData, sexo: e.target.value})} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                          <option value="">Seleccionar</option><option value="Masculino">Masculino</option><option value="Femenino">Femenino</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Nacionalidad</Label>
                        <select value={editData.nacionalidad} onChange={e => setEditData({...editData, nacionalidad: e.target.value})} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                          <option value="">Seleccionar</option>
                          {COUNTRIES.map(c => <option key={c.code} value={c.name}>{c.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2"><Label>Ciudad de Residencia</Label><Input value={editData.ciudad_residencia} onChange={e => setEditData({...editData, ciudad_residencia: e.target.value})} /></div>
                      <div className="space-y-2">
                        <Label>Tipo de Sangre</Label>
                        <select value={editData.tipo_sangre} onChange={e => setEditData({...editData, tipo_sangre: e.target.value})} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                          <option value="">Seleccionar</option>{['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Contacto Emergencia - Nombre</Label><Input value={editData.contacto_emergencia_nombre} onChange={e => setEditData({...editData, contacto_emergencia_nombre: e.target.value})} /></div>
                      <div className="space-y-2"><Label>Contacto Emergencia - Relacion</Label><Input value={editData.contacto_emergencia_relacion} onChange={e => setEditData({...editData, contacto_emergencia_relacion: e.target.value})} /></div>
                      <div className="space-y-2"><Label>Contacto Emergencia - Telefono</Label><Input value={editData.contacto_emergencia_telefono} onChange={e => setEditData({...editData, contacto_emergencia_telefono: e.target.value})} /></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Talla Camiseta</Label>
                        <select value={editData.talla_camiseta} onChange={e => setEditData({...editData, talla_camiseta: e.target.value})} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                          <option value="">Seleccionar</option>{['XS','S','M','L','XL','XXL'].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2"><Label>Personalizacion BIB</Label><Input maxLength={15} value={editData.personalizacion_camiseta} onChange={e => setEditData({...editData, personalizacion_camiseta: e.target.value.toUpperCase()})} className="uppercase" /></div>
                      <div className="space-y-2"><Label>Como se entero</Label><Input value={editData.como_se_entero} onChange={e => setEditData({...editData, como_se_entero: e.target.value})} /></div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ===== RACES TAB ===== */}
          {activeTab === 'races' && (
            <div className="space-y-4">
              {/* Inscription button */}
              {!showInscription && activeRace && !isRegisteredForActive && athlete.profile_complete && (
                <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
                  <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <h3 className="font-display text-xl text-foreground">{activeRace.name || 'Backyard Ultra Santo Domingo'}</h3>
                      <p className="text-muted-foreground text-sm">Inscribete a la proxima edicion</p>
                    </div>
                    <Button size="lg" onClick={() => setShowInscription(true)} data-testid="open-inscription-btn">
                      <Heart className="w-4 h-4 mr-2" /> Inscribirme
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Race inscription form */}
              {showInscription && (
                <Card data-testid="inscription-form">
                  <CardHeader>
                    <Button variant="ghost" size="sm" onClick={() => setShowInscription(false)} className="w-fit mb-2"><ArrowLeft className="w-4 h-4 mr-2" />Volver</Button>
                    <CardTitle className="flex items-center gap-2"><Heart className="w-5 h-5 text-primary" /> Inscripcion a Carrera</CardTitle>
                    <CardDescription>Preguntas especificas del evento {activeRace?.name || ''}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Info Banner - costo e instrucciones */}
                    <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-lg p-5">
                      <h4 className="text-base font-bold text-orange-900 mb-3">Informacion Importante</h4>
                      <div className="space-y-2 text-sm text-orange-800">
                        <p>
                          <strong>Completar este formulario no garantiza un cupo confirmado</strong>, sino que asegura tu lugar en la lista de prerregistrados.
                        </p>
                        <p>
                          Cuatro (4) meses antes del evento, enviaremos un correo electronico con las instrucciones para realizar el pago de la inscripcion.
                        </p>
                        <p className="font-semibold text-lg text-orange-900">
                          El costo de la carrera sera de {formattedCost}.
                        </p>
                        <p>
                          A partir de la recepcion de ese correo, contaras con un plazo de <strong>treinta (30) dias</strong> para completar el pago correspondiente.
                        </p>
                        <p>
                          Si el pago no se realiza dentro de ese periodo, el pre registro sera automaticamente desestimado y el cupo podra ser asignado a otro participante.
                        </p>
                        <p className="text-orange-600 italic flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                          Te recomendamos estar atento a tu correo electronico y verificar tambien la carpeta de spam.
                        </p>
                      </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Anos de Experiencia en Running *</Label>
                        <Input type="number" min="0" value={inscriptionData.anos_experiencia} onChange={e => setInscriptionData({...inscriptionData, anos_experiencia: e.target.value})} placeholder="Ej: 5" data-testid="insc-experiencia" />
                      </div>
                      <div className="space-y-2">
                        <Label>Maxima Distancia Recorrida (km) *</Label>
                        <Input type="number" min="0" step="0.1" value={inscriptionData.maxima_distancia_km} onChange={e => setInscriptionData({...inscriptionData, maxima_distancia_km: e.target.value})} placeholder="Ej: 42.2" data-testid="insc-distancia" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Que te motiva a participar en este evento? *</Label>
                      <textarea value={inscriptionData.motivacion} onChange={e => setInscriptionData({...inscriptionData, motivacion: e.target.value})} placeholder="Cuentanos tu motivacion..." className="w-full min-h-[100px] px-3 py-2 rounded-md border border-input bg-background text-sm" maxLength={1000} data-testid="insc-motivacion" />
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Cuantas vueltas aspiras completar?</Label>
                        <select value={inscriptionData.vueltas_aspiradas} onChange={e => setInscriptionData({...inscriptionData, vueltas_aspiradas: e.target.value})} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" data-testid="insc-vueltas">
                          <option value="">Selecciona...</option>
                          {['Al menos 1','De 2 a 5','De 6 a 10','De 11 a 15','De 16 a 20','De 21 a 24','Hasta que sea el ganador','No estoy seguro'].map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Tienes carpa o toldo propio?</Label>
                        <select value={inscriptionData.tiene_carpa} onChange={e => setInscriptionData({...inscriptionData, tiene_carpa: e.target.value})} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" data-testid="insc-carpa">
                          <option value="">Selecciona...</option>{['Si','No','Tal vez'].map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Te gustaria dormir en el lugar?</Label>
                        <select value={inscriptionData.hospedaje} onChange={e => setInscriptionData({...inscriptionData, hospedaje: e.target.value})} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" data-testid="insc-hospedaje">
                          <option value="">Selecciona...</option>
                          <option value="Si quiero acampar">Si, quiero acampar</option>
                          <option value="Si quisiera hospedarme en el hotel">Si, quisiera hospedarme en el hotel</option>
                          <option value="No lo he decidido aun">No lo he decidido aun</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Cuantas personas te acompanaran?</Label>
                        <Input type="number" min="0" max="20" value={inscriptionData.acompanantes} onChange={e => setInscriptionData({...inscriptionData, acompanantes: e.target.value})} placeholder="0" data-testid="insc-acompanantes" />
                      </div>
                    </div>
                    <Button className="w-full" size="lg" onClick={handleInscribeRace} disabled={inscribing} data-testid="submit-inscription-btn">
                      {inscribing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Heart className="w-4 h-4 mr-2" />} Confirmar Inscripcion
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Current races */}
              {!showInscription && (
                <Card data-testid="races-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Calendar className="w-5 h-5 text-primary" /> Mis Inscripciones</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {myRaces.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground" data-testid="no-races-message">
                        <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No tienes inscripciones activas</p>
                        {!athlete.profile_complete && <p className="text-sm mt-2 text-amber-600">Completa tu perfil primero para poder inscribirte</p>}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {myRaces.map(race => {
                          const canCancel = !race.payment_receipt_status && race.status === 'registered';
                          const showPaymentLink = race.edit_token && race.payment_status !== 'paid';
                          const receiptPending = race.payment_receipt_status === 'pending';
                          
                          return (
                            <div key={race.registration_id} className="p-4 border rounded-lg" data-testid={`race-${race.registration_id}`}>
                              <div className="flex justify-between items-start">
                                <div>
                                  <h3 className="font-semibold">{race.race_name}</h3>
                                  <p className="text-sm text-muted-foreground">{race.race_date}</p>
                                </div>
                                <div className="text-right space-y-1">
                                  {race.bib && <Badge variant="outline">BIB #{race.bib}</Badge>}
                                  <div>
                                    <Badge variant={race.payment_status === 'paid' ? 'default' : receiptPending ? 'outline' : 'secondary'}>
                                      {race.payment_status === 'paid' ? 'Pagado' : receiptPending ? 'Comprobante en revision' : 'Pendiente de pago'}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                              {/* Action buttons */}
                              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
                                {showPaymentLink && (
                                  <Button size="sm" variant="default" onClick={() => window.open(`/subir-comprobante?token=${race.edit_token}`, '_blank')} data-testid={`upload-receipt-btn-${race.registration_id}`}>
                                    <Upload className="w-3 h-3 mr-2" /> Subir Comprobante de Pago
                                  </Button>
                                )}
                                {receiptPending && (
                                  <p className="text-xs text-amber-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Tu comprobante esta siendo revisado por el equipo</p>
                                )}
                                {canCancel && (
                                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto" onClick={() => handleCancelRace(race.registration_id)} data-testid={`cancel-race-btn-${race.registration_id}`}>
                                    <XCircle className="w-3 h-3 mr-2" /> Cancelar Inscripcion
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* ===== HISTORY TAB ===== */}
          {activeTab === 'history' && (
            <div className="space-y-4" data-testid="history-section">
              {/* Claim 2026 Results */}
              <Card data-testid="claim-results-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Search className="w-5 h-5 text-primary" /> Reclamar Resultados 2026</CardTitle>
                  <CardDescription>Participaste en la edicion 2026? Busca por nombre o BIB y vincula tus resultados</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2 mb-4">
                    <Input placeholder="Buscar por nombre, apellidos o BIB..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch2026()} data-testid="search-2026-input" />
                    <Button onClick={handleSearch2026} disabled={searching} data-testid="search-2026-btn">{searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}</Button>
                  </div>
                  {searchResults.length > 0 && (
                    <div className="space-y-2" data-testid="search-results">
                      {searchResults.map(result => (
                        <div key={result.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`result-${result.id}`}>
                          <div>
                            <p className="font-medium">{result.nombre} {result.apellidos}<Badge variant="outline" className="ml-2">BIB {result.bib}</Badge></p>
                            <p className="text-sm text-muted-foreground">{result.laps_completed} vueltas - {result.status === 'winner' ? 'Ganador' : result.status === 'retired' ? 'DNF' : result.status === 'dns' ? 'DNS' : result.status}</p>
                          </div>
                          {result.already_claimed ? (
                            <Badge variant="secondary"><CheckCircle className="w-3 h-3 mr-1" />Reclamado</Badge>
                          ) : (
                            <Button size="sm" onClick={() => handleClaimResult(result.id)} data-testid={`claim-btn-${result.id}`}>Reclamar</Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Race History */}
              <Card data-testid="race-history-card">
                <CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="w-5 h-5 text-primary" /> Mi Historial de Carreras</CardTitle></CardHeader>
                <CardContent>
                  {raceHistory.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground" data-testid="no-history-message">
                      <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" /><p>Aun no tienes historial de carreras</p>
                      <p className="text-sm mt-1">Usa el buscador de arriba para reclamar tus resultados de 2026</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {raceHistory.map(race => (
                        <div key={race.registration_id} className="p-4 border rounded-lg" data-testid={`history-${race.registration_id}`}>
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-semibold flex items-center gap-2">{race.race_name || race.race_code}{race.is_claimed && <Badge variant="outline" className="text-xs">Reclamado</Badge>}</h3>
                              <p className="text-sm text-muted-foreground">{race.race_date || 'Fecha no disponible'}</p>
                            </div>
                            {race.bib && <Badge variant="outline">BIB #{race.bib}</Badge>}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-4 text-sm">
                            <div><span className="text-muted-foreground">Vueltas:</span><span className="ml-1 font-semibold">{race.laps_completed}</span></div>
                            <div><span className="text-muted-foreground">Distancia:</span><span className="ml-1 font-semibold">{(race.laps_completed * 6.7).toFixed(1)} km</span></div>
                            <div><span className="text-muted-foreground">Estado:</span>
                              <Badge variant="secondary" className="ml-1">{race.status === 'winner' ? 'Ganador' : race.status === 'retired' ? 'DNF' : race.status === 'dns' ? 'DNS' : race.status === 'active' ? 'Activo' : race.status}</Badge>
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
      </PageContent>
    );
  }

  return null;
}
