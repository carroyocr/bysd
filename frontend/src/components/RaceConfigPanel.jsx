import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { 
  Settings, Plus, Upload, Check, Calendar, Clock, MapPin, 
  Tag, Image, Archive, RotateCw, Trash2, CheckCircle, AlertCircle,
  DollarSign, Hash, FileText, CreditCard, Building2, User, Loader2,
  Mail, Send, Eye, EyeOff, Users, MessageCircle, ClipboardList, Info, Bell,
  Handshake
} from 'lucide-react';
import { toast } from 'sonner';
import { adminFetch } from '../lib/adminApi';
import { token as sesionToken } from '../lib/sesion';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function RaceConfigPanel() {
  const [activeRace, setActiveRace] = useState(null);
  const [allRaces, setAllRaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingManual, setUploadingManual] = useState(null); // 'runners' or 'volunteers'
  const [sendingNotification, setSendingNotification] = useState(null); // 'runners' or 'volunteers'
  const [notificationCounts, setNotificationCounts] = useState({ runners: 0, volunteers: 0 });
  
  // Form state for creating new race
  const [newRace, setNewRace] = useState({
    code: '',
    name: '',
    date: '',
    start_time: '09:00',
    location: '',
    timezone_gmt: 'GMT-4',
    registration_cost: 3500,
    edition_number: 1,
    // De qué edición heredar logos, datos de pago y puestos de voluntario
    copiar_de: '',
    // Publicarla en el sitio es una decisión aparte de crearla
    is_active: false,
    es_campeonato: false,
  });
  
  // Form state for editing active race
  const [editForm, setEditForm] = useState({
    name: '',
    date: '',
    start_time: '',
    location: '',
    timezone_gmt: 'GMT-4',
    registration_cost: 3500,
    edition_number: 1,
    max_participants: 120,
    // Payment info
    payment_account_name: '',
    payment_account_id: '',
    payment_bank_name: '',
    payment_account_type: '',
    payment_account_number: '',
    // Page visibility
    show_tracking_page: true,
    show_community_page: true,
    show_preregistration: true,
    show_sponsors_page: true,
    show_volunteer_carrera: false
  });

  const token = sesionToken();

  const loadData = async () => {
    setLoading(true);
    try {
      const [activeRes, allRes] = await Promise.all([
        adminFetch(`${API_URL}/api/race-config/active`),
        adminFetch(`${API_URL}/api/race-config/all`)
      ]);
      
      const activeData = await activeRes.json();
      const allData = await allRes.json();
      
      setActiveRace(activeData);
      setAllRaces(allData.races || []);
      
      // Set edit form with active race data
      setEditForm({
        name: activeData.name || '',
        date: activeData.date || '',
        start_time: activeData.start_time || '',
        location: activeData.location || '',
        timezone_gmt: activeData.timezone_gmt || 'GMT-4',
        registration_cost: activeData.registration_cost || 3500,
        edition_number: activeData.edition_number || 1,
        max_participants: activeData.max_participants || 120,
        // Payment info
        payment_account_name: activeData.payment_account_name || '',
        payment_account_id: activeData.payment_account_id || '',
        payment_bank_name: activeData.payment_bank_name || '',
        payment_account_type: activeData.payment_account_type || '',
        payment_account_number: activeData.payment_account_number || '',
        // Page visibility
        show_tracking_page: activeData.show_tracking_page !== false,
        show_community_page: activeData.show_community_page !== false,
        show_preregistration: activeData.show_preregistration !== false,
        show_sponsors_page: activeData.show_sponsors_page !== false,
        // Apagado salvo que esté explícitamente encendido
        show_volunteer_carrera: activeData.show_volunteer_carrera === true
      });
      
      // Load notification counts if race has manuals
      if (activeData.code && !activeData.is_default) {
        loadNotificationCounts(activeData.code);
      }
    } catch (error) {
      console.error('Error loading race config:', error);
      toast.error('Error al cargar la configuración');
    } finally {
      setLoading(false);
    }
  };

  const loadNotificationCounts = async (code) => {
    try {
      const [runnersRes, volunteersRes] = await Promise.all([
        adminFetch(`${API_URL}/api/race-config/notify-runners-count/${code}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        adminFetch(`${API_URL}/api/race-config/notify-volunteers-count/${code}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);
      
      const runnersData = await runnersRes.json();
      const volunteersData = await volunteersRes.json();
      
      setNotificationCounts({
        runners: runnersData.count || 0,
        volunteers: volunteersData.count || 0
      });
    } catch (error) {
      console.error('Error loading notification counts:', error);
    }
  };

  const handleSendManualNotification = async (type) => {
    if (!activeRace?.code) return;
    
    const count = type === 'runners' ? notificationCounts.runners : notificationCounts.volunteers;
    const recipientType = type === 'runners' ? 'corredores activos' : 'voluntarios registrados';
    
    if (count === 0) {
      toast.error(`No hay ${recipientType} para notificar`);
      return;
    }
    
    const confirmed = window.confirm(
      `¿Enviar notificación de manual disponible a ${count} ${recipientType}?\n\nEsta acción enviará un correo a cada uno informándoles que el manual ya está disponible.`
    );
    
    if (!confirmed) return;
    
    setSendingNotification(type);
    try {
      const endpoint = type === 'runners' 
        ? `/api/race-config/notify-runners-manual/${activeRace.code}`
        : `/api/race-config/notify-volunteers-manual/${activeRace.code}`;
      
      const response = await adminFetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Error al enviar notificaciones');
      }
      
      toast.success(`${data.message}`, {
        description: data.failed_count > 0 ? `${data.failed_count} envíos fallaron` : undefined
      });
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSendingNotification(null);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Fotos del evento para BYSD Live (solo las propias de esta carrera)
  const [livePhotos, setLivePhotos] = useState([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  const loadLivePhotos = async (code) => {
    try {
      const res = await fetch(`${API_URL}/api/race-config/live-photos/${code}`);
      if (res.ok) {
        const data = await res.json();
        setLivePhotos(data.source_race === code ? data.photos : []);
      }
    } catch { /* sin fotos */ }
  };

  useEffect(() => {
    if (activeRace?.code && !activeRace.is_default) loadLivePhotos(activeRace.code);
  }, [activeRace?.code, activeRace?.is_default]);

  const handleLivePhotosUpload = async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length || !activeRace?.code) return;
    setUploadingPhotos(true);
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append('files', f));
      const res = await adminFetch(`${API_URL}/api/race-config/live-photos/${activeRace.code}`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(data.message);
        loadLivePhotos(activeRace.code);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.detail || 'No se pudieron subir las fotos');
      }
    } catch {
      toast.error('Error de conexión al subir las fotos');
    } finally {
      setUploadingPhotos(false);
    }
  };

  const handleDeleteLivePhoto = async (filename) => {
    if (!window.confirm('¿Eliminar esta foto del evento?')) return;
    try {
      const res = await adminFetch(`${API_URL}/api/race-config/live-photos/${activeRace.code}/${filename}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success('Foto eliminada');
        loadLivePhotos(activeRace.code);
      } else {
        toast.error('No se pudo eliminar la foto');
      }
    } catch {
      toast.error('Error de conexión');
    }
  };

  const handleCreateRace = async (e) => {
    e.preventDefault();

    if (!newRace.code || !newRace.name || !newRace.date || !newRace.location) {
      toast.error('Por favor completa todos los campos obligatorios');
      return;
    }

    setSaving(true);
    try {
      // Crear ya no archiva ni vacia nada de la carrera anterior: cada dato
      // lleva su carrera y varias pueden convivir.
      const response = await adminFetch(`${API_URL}/api/race-config/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newRace, copiar_de: newRace.copiar_de || null }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Error al crear la carrera');

      const copiado = data.copiado || {};
      let mensaje = `Carrera "${newRace.name}" creada`;
      if (copiado.origen) {
        const partes = [];
        if (copiado.campos?.length) partes.push(`${copiado.campos.length} ajuste(s)`);
        if (copiado.turnos) partes.push(`${copiado.turnos} puesto(s) de voluntario`);
        if (partes.length) mensaje += `, heredando de ${copiado.origen}: ${partes.join(' y ')}`;
      }
      toast.success(mensaje);

      setShowCreateForm(false);
      setNewRace({
        code: '', name: '', date: '', start_time: '09:00', location: '',
        registration_cost: 4000, edition_number: 1,
        copiar_de: '', is_active: false, es_campeonato: false,
      });
      await loadData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRace = async () => {
    if (!activeRace?.code || activeRace.is_default) {
      toast.error('Primero debe crear una carrera');
      return;
    }
    
    setSaving(true);
    try {
      const response = await adminFetch(`${API_URL}/api/race-config/update/${activeRace.code}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editForm)
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Error al actualizar');
      }
      
      toast.success('Configuración actualizada');
      await loadData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!activeRace?.code || activeRace.is_default) {
      toast.error('Primero debe crear una carrera');
      return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    
    setUploadingLogo(true);
    try {
      const response = await adminFetch(`${API_URL}/api/race-config/upload-logo/${activeRace.code}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Error al subir el logo');
      }
      
      toast.success('Logo subido exitosamente');
      await loadData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleImageUpload = async (e, imageType) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!activeRace?.code || activeRace.is_default) {
      toast.error('Primero debe crear una carrera');
      return;
    }
    
    const typeLabels = {
      'home': 'Logo del Home',
      'menu': 'Logo del Menú',
      'favicon': 'Favicon',
      'portada': 'Portada de BYSD Live'
    };
    
    const formData = new FormData();
    formData.append('file', file);
    
    setUploadingLogo(true);
    try {
      const response = await adminFetch(`${API_URL}/api/race-config/upload-image/${activeRace.code}/${imageType}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || `Error al subir ${typeLabels[imageType]}`);
      }
      
      const data = await response.json();
      toast.success(`${typeLabels[imageType]} subido exitosamente`);
      await loadData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleManualUpload = async (e, manualType) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!activeRace?.code || activeRace.is_default) {
      toast.error('Primero debe crear una carrera');
      return;
    }
    
    if (file.type !== 'application/pdf') {
      toast.error('Solo se permiten archivos PDF');
      return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    
    setUploadingManual(manualType);
    try {
      const response = await adminFetch(`${API_URL}/api/race-config/upload-manual/${activeRace.code}/${manualType}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Error al subir el manual');
      }
      
      toast.success(`Manual de ${manualType === 'runners' ? 'corredores' : 'voluntarios'} subido exitosamente`);
      await loadData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setUploadingManual(null);
    }
  };

  const handleDeleteManual = async (manualType) => {
    if (!activeRace?.code) return;
    
    if (!confirm(`¿Estás seguro de eliminar el manual de ${manualType === 'runners' ? 'corredores' : 'voluntarios'}?`)) {
      return;
    }
    
    try {
      const response = await adminFetch(`${API_URL}/api/race-config/delete-manual/${activeRace.code}/${manualType}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Error al eliminar el manual');
      }
      
      toast.success('Manual eliminado');
      await loadData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleActivateRace = async (code) => {
    setSaving(true);
    try {
      const response = await adminFetch(`${API_URL}/api/race-config/activate/${code}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Error al activar');
      }
      
      toast.success('Carrera activada');
      await loadData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  // Cerrar una carrera ya no mueve datos de sitio: cada dato lleva su carrera y
  // se queda donde esta. Lo que hace es congelar los resultados y parar el
  // reloj, que si no seguiria contando una vuelta por hora para siempre.
  // ---- Cierre de edición ----
  //
  // Estas tres estaban en el control de carrera, que no es su sitio: no tienen
  // que ver con llevar las vueltas sino con cerrar una edición y dejar la casa
  // lista para la siguiente. El correo final se manda cuando ya hay ganador; los
  // mensajes de ánimo y las suscripciones se limpian antes de la próxima.
  const [enviandoCorreos, setEnviandoCorreos] = useState(false);
  const [limpiando, setLimpiando] = useState(null);

  const enviarCorreosDeCierre = async (code) => {
    if (!window.confirm(
      `Enviar el correo de cierre a los corredores de ${code}.\n\n` +
      'Lleva su resultado y solo tiene sentido cuando la carrera ya terminó y ' +
      'hay un ganador declarado. No se puede deshacer.\n\n¿Enviar?'
    )) return;

    setEnviandoCorreos(true);
    try {
      const res = await adminFetch(
        `${API_URL}/api/race/send-runner-emails?race_code=${code}`,
        { method: 'POST' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error al enviar correos');
      toast.success(
        `Correos enviados: ${data.emails_sent} exitosos, ${data.emails_failed} fallidos, ${data.no_email} sin correo`
      );
    } catch (error) {
      toast.error(error.message);
    } finally {
      setEnviandoCorreos(false);
    }
  };

  const limpiarParaLaSiguiente = async (code, tipo) => {
    const config = {
      mensajes: {
        ruta: 'reset-cheers',
        palabra: 'MENSAJES',
        texto: `Borrar todos los mensajes de ánimo de ${code}.`,
      },
      suscripciones: {
        ruta: 'reset-subscriptions',
        palabra: 'SUSCRIPCIONES',
        texto: `Borrar las suscripciones de seguimiento de ${code}. Quienes seguían a un corredor dejarán de recibir avisos.`,
      },
    }[tipo];

    const escrito = window.prompt(
      `${config.texto}\n\nSolo afecta a esta carrera y no se puede deshacer.\n\n` +
      `Escribe ${config.palabra} para confirmar:`
    );
    if (escrito === null) return;
    if (escrito.trim().toUpperCase() !== config.palabra) {
      toast.error(`Hay que escribir ${config.palabra}`);
      return;
    }

    setLimpiando(tipo);
    try {
      const res = await adminFetch(
        `${API_URL}/api/race/${config.ruta}?race_code=${code}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirmation: config.palabra }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'No se pudo limpiar');
      toast.success(data.message);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLimpiando(null);
    }
  };

  const handleCloseRace = async (code) => {
    setSaving(true);
    try {
      const summaryResponse = await adminFetch(`${API_URL}/api/race-config/data-summary/${code}`);
      const summary = summaryResponse.ok ? await summaryResponse.json() : { collections: {} };
      const c = summary.collections || {};

      const mensaje =
        `Cerrar la carrera ${code}.\n\n` +
        `Sus resultados quedan congelados y consultables:\n` +
        `  - Corredores inscritos: ${c.registrations || 0}\n` +
        `  - Voluntarios: ${c.volunteer_registrations || 0}\n` +
        `  - Patrocinadores: ${c.sponsors || 0}\n` +
        `  - Encuestas: ${c.surveys || 0}\n\n` +
        `No se borra ni se mueve nada. Si se cierra antes de tiempo, se puede reabrir.\n\n` +
        `¿Cerrar la carrera?`;

      if (!window.confirm(mensaje)) {
        setSaving(false);
        return;
      }

      const response = await adminFetch(`${API_URL}/api/race-config/close/${code}`, {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Error al cerrar la carrera');

      toast.success(`${data.message} ${data.vueltas_registradas} vueltas registradas.`);
      await loadData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReopenRace = async (code) => {
    if (!window.confirm(`¿Reabrir la carrera ${code}? El reloj vuelve a contar.`)) return;
    setSaving(true);
    try {
      const response = await adminFetch(`${API_URL}/api/race-config/reopen/${code}`, {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Error al reabrir');
      toast.success(data.message);
      await loadData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RotateCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Configuración de Carrera</h2>
          <p className="text-muted-foreground">Gestiona las carreras y sus configuraciones</p>
        </div>
        {activeRace && !activeRace.is_default && (
          <Badge className="bg-green-500 text-white px-3 py-1">
            <CheckCircle className="w-3 h-3 mr-1" />
            Carrera Activa: {activeRace.code}
          </Badge>
        )}
      </div>

      {/* Active Race Configuration */}
      <Card className="border-primary/20">
        <CardHeader className="bg-gradient-to-r from-primary/10 to-accent/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Settings className="w-6 h-6 text-primary" />
              <div>
                <CardTitle>Detalles de la Carrera</CardTitle>
                <CardDescription>Información y configuración actual</CardDescription>
              </div>
            </div>
            {activeRace?.is_default && (
              <Badge variant="outline" className="border-amber-500 text-amber-600">
                <AlertCircle className="w-3 h-3 mr-1" />
                Valores por defecto
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {activeRace?.is_default ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                No hay una carrera configurada. Se están usando valores por defecto.
              </p>
              <Button onClick={() => setShowCreateForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Crear Primera Carrera
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Images/Branding Section */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2 text-lg">
                  <Image className="w-5 h-5" />
                  Imágenes de la Carrera
                </h3>
                
                <div className="grid md:grid-cols-3 gap-4">
                  {/* Home Logo */}
                  <div className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">Logo del Home</h4>
                      {activeRace?.logo_home_url ? (
                        <Badge variant="default" className="bg-green-100 text-green-800 text-xs">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Cargado
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Por defecto</Badge>
                      )}
                    </div>
                    <div className="w-full h-24 bg-muted/50 rounded-lg border flex items-center justify-center overflow-hidden">
                      <img 
                        src={activeRace?.logo_home_url ? 
                          (activeRace.logo_home_url.startsWith('/api') ? `${API_URL}${activeRace.logo_home_url}` : activeRace.logo_home_url) 
                          : '/icon-bu.png'
                        } 
                        alt="Logo Home" 
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Aparece en la página principal</p>
                      <p className="text-xs font-medium text-blue-600">Recomendado: 1024×1024px PNG transparente</p>
                    </div>
                    <label className="block">
                      <input
                        type="file"
                        accept="image/png,image/jpg,image/jpeg,image/webp,image/svg+xml"
                        className="hidden"
                        onChange={(e) => handleImageUpload(e, 'home')}
                        disabled={uploadingLogo}
                      />
                      <Button type="button" variant="outline" size="sm" className="w-full" asChild>
                        <span className="cursor-pointer">
                          <Upload className="w-3 h-3 mr-2" />
                          Subir Logo Home
                        </span>
                      </Button>
                    </label>
                  </div>

                  {/* Menu Logo */}
                  <div className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">Logo del Menú</h4>
                      {activeRace?.logo_menu_url ? (
                        <Badge variant="default" className="bg-green-100 text-green-800 text-xs">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Cargado
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Por defecto</Badge>
                      )}
                    </div>
                    <div className="w-full h-24 bg-muted/50 rounded-lg border flex items-center justify-center overflow-hidden">
                      <img 
                        src={activeRace?.logo_menu_url ? 
                          (activeRace.logo_menu_url.startsWith('/api') ? `${API_URL}${activeRace.logo_menu_url}` : activeRace.logo_menu_url) 
                          : '/icon-bu.png'
                        } 
                        alt="Logo Menú" 
                        className="max-w-[48px] max-h-[48px] object-contain"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Aparece en la barra de navegación</p>
                      <p className="text-xs font-medium text-blue-600">Recomendado: 256×256px PNG transparente</p>
                    </div>
                    <label className="block">
                      <input
                        type="file"
                        accept="image/png,image/jpg,image/jpeg,image/webp,image/svg+xml"
                        className="hidden"
                        onChange={(e) => handleImageUpload(e, 'menu')}
                        disabled={uploadingLogo}
                      />
                      <Button type="button" variant="outline" size="sm" className="w-full" asChild>
                        <span className="cursor-pointer">
                          <Upload className="w-3 h-3 mr-2" />
                          Subir Logo Menú
                        </span>
                      </Button>
                    </label>
                  </div>

                  {/* Favicon */}
                  <div className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">Icono de Pestaña</h4>
                      {activeRace?.favicon_url ? (
                        <Badge variant="default" className="bg-green-100 text-green-800 text-xs">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Cargado
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Por defecto</Badge>
                      )}
                    </div>
                    <div className="w-full h-24 bg-muted/50 rounded-lg border flex items-center justify-center overflow-hidden">
                      <img 
                        src={activeRace?.favicon_url ? 
                          (activeRace.favicon_url.startsWith('/api') ? `${API_URL}${activeRace.favicon_url}` : activeRace.favicon_url) 
                          : '/favicon.ico'
                        } 
                        alt="Favicon" 
                        className="max-w-[32px] max-h-[32px] object-contain"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Icono en la pestaña del navegador</p>
                      <p className="text-xs font-medium text-blue-600">Recomendado: 180×180px PNG</p>
                    </div>
                    <label className="block">
                      <input
                        type="file"
                        accept="image/png,image/x-icon,image/vnd.microsoft.icon,.ico"
                        className="hidden"
                        onChange={(e) => handleImageUpload(e, 'favicon')}
                        disabled={uploadingLogo}
                      />
                      <Button type="button" variant="outline" size="sm" className="w-full" asChild>
                        <span className="cursor-pointer">
                          <Upload className="w-3 h-3 mr-2" />
                          Subir Favicon
                        </span>
                      </Button>
                    </label>
                  </div>
                </div>

                {uploadingLogo && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Subiendo imagen...
                  </div>
                )}

                {/* Portada del Home de BYSD Live */}
                <div className="p-4 border rounded-lg space-y-3 max-w-md">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">Portada de BYSD Live</h4>
                    {activeRace?.portada_url ? (
                      <Badge variant="default" className="bg-green-100 text-green-800 text-xs">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Cargada
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">Usa fotos del evento</Badge>
                    )}
                  </div>
                  {activeRace?.portada_url && (
                    <div className="w-full h-32 bg-muted/50 rounded-lg border overflow-hidden">
                      <img
                        src={activeRace.portada_url.startsWith('/api') ? `${API_URL}${activeRace.portada_url}` : activeRace.portada_url}
                        alt="Portada BYSD Live"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Foto de fondo del Home de la app /live</p>
                    <p className="text-xs font-medium text-blue-600">Recomendado: foto vertical u horizontal grande (JPG)</p>
                  </div>
                  <label className="block">
                    <input
                      type="file"
                      accept="image/png,image/jpg,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => handleImageUpload(e, 'portada')}
                      disabled={uploadingLogo}
                    />
                    <Button type="button" variant="outline" size="sm" className="w-full" asChild>
                      <span className="cursor-pointer">
                        <Upload className="w-3 h-3 mr-2" />
                        Subir Portada
                      </span>
                    </Button>
                  </label>
                </div>
              </div>

              {/* Fotos del evento para BYSD Live */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2 text-lg">
                  <Image className="w-5 h-5" />
                  Fotos del Evento (BYSD Live)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Se muestran en la app <code>/live</code> (ficha del atleta y Home sin portada).
                  Si esta carrera no tiene fotos propias, la app usa las de la edición anterior.
                </p>
                <label className="inline-block">
                  <input
                    type="file"
                    accept="image/png,image/jpg,image/jpeg,image/webp"
                    multiple
                    className="hidden"
                    onChange={handleLivePhotosUpload}
                    disabled={uploadingPhotos}
                  />
                  <Button type="button" variant="outline" size="sm" asChild disabled={uploadingPhotos}>
                    <span className="cursor-pointer">
                      {uploadingPhotos ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Upload className="w-3 h-3 mr-2" />}
                      Subir fotos (varias a la vez)
                    </span>
                  </Button>
                </label>
                {livePhotos.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {livePhotos.map((ph) => (
                      <div key={ph.filename} className="relative group aspect-square rounded-lg overflow-hidden border">
                        <img src={`${API_URL}${ph.url}`} alt="Foto del evento" className="w-full h-full object-cover" loading="lazy" />
                        <button
                          type="button"
                          onClick={() => handleDeleteLivePhoto(ph.filename)}
                          className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label="Eliminar foto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Race Details Form */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Tag className="w-4 h-4" />
                    Código de Carrera
                  </Label>
                  <Input value={activeRace?.code || ''} disabled className="bg-muted" />
                  <p className="text-xs text-muted-foreground">No se puede modificar</p>
                </div>
                
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Tag className="w-4 h-4" />
                    Nombre de la Carrera
                  </Label>
                  <Input 
                    value={editForm.name}
                    onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                    placeholder="Ej: Backyard Ultra Santo Domingo 2026"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Fecha de la Carrera
                  </Label>
                  <Input 
                    type="date"
                    value={editForm.date}
                    onChange={(e) => setEditForm({...editForm, date: e.target.value})}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Hora de Inicio
                  </Label>
                  <Input 
                    type="time"
                    value={editForm.start_time}
                    onChange={(e) => setEditForm({...editForm, start_time: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Zona Horaria (GMT)
                  </Label>
                  <select
                    value={editForm.timezone_gmt}
                    onChange={(e) => setEditForm({...editForm, timezone_gmt: e.target.value})}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  >
                    <option value="GMT-12">GMT-12</option>
                    <option value="GMT-11">GMT-11</option>
                    <option value="GMT-10">GMT-10 (Hawái)</option>
                    <option value="GMT-9">GMT-9 (Alaska)</option>
                    <option value="GMT-8">GMT-8 (Pacífico)</option>
                    <option value="GMT-7">GMT-7 (Montaña)</option>
                    <option value="GMT-6">GMT-6 (Central)</option>
                    <option value="GMT-5">GMT-5 (Este USA)</option>
                    <option value="GMT-4">GMT-4 (Rep. Dominicana)</option>
                    <option value="GMT-3">GMT-3 (Argentina)</option>
                    <option value="GMT-2">GMT-2</option>
                    <option value="GMT-1">GMT-1</option>
                    <option value="GMT+0">GMT+0 (Londres)</option>
                    <option value="GMT+1">GMT+1 (Europa Central)</option>
                    <option value="GMT+2">GMT+2</option>
                  </select>
                  <p className="text-xs text-muted-foreground">Horario oficial para el control de vueltas</p>
                </div>
                
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Ubicación
                  </Label>
                  <Input 
                    value={editForm.location}
                    onChange={(e) => setEditForm({...editForm, location: e.target.value})}
                    placeholder="Ej: Parque del Este, Santo Domingo"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Costo de Inscripción (RD$)
                  </Label>
                  <Input 
                    type="number"
                    min="0"
                    step="100"
                    value={editForm.registration_cost}
                    onChange={(e) => setEditForm({...editForm, registration_cost: parseFloat(e.target.value) || 0})}
                    placeholder="3500"
                  />
                  <p className="text-xs text-muted-foreground">Se mostrará en la página de pre-registro</p>
                </div>
                
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Hash className="w-4 h-4" />
                    Número de Edición
                  </Label>
                  <Input 
                    type="number"
                    min="1"
                    max="100"
                    value={editForm.edition_number}
                    onChange={(e) => setEditForm({...editForm, edition_number: parseInt(e.target.value) || 1})}
                    placeholder="1"
                  />
                  <p className="text-xs text-muted-foreground">1 = Primera, 2 = Segunda, etc.</p>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Máximo de Participantes
                  </Label>
                  <Input 
                    type="number"
                    min="1"
                    step="1"
                    value={editForm.max_participants}
                    onChange={(e) => setEditForm({...editForm, max_participants: parseInt(e.target.value) || 1})}
                    placeholder="120"
                    data-testid="max-participants-input"
                  />
                  <p className="text-xs text-muted-foreground">Al alcanzar este número, las nuevas inscripciones pasan a lista de espera</p>
                </div>
              </div>

              {/* Payment Information Section */}
              <div className="pt-6 border-t">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-green-600" />
                  Datos para Recibir Pagos
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Nombre de la Cuenta
                    </Label>
                    <Input
                      value={editForm.payment_account_name}
                      onChange={(e) => setEditForm({...editForm, payment_account_name: e.target.value})}
                      placeholder="Nombre del titular"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Identificación (Cédula/RNC)</Label>
                    <Input
                      value={editForm.payment_account_id}
                      onChange={(e) => setEditForm({...editForm, payment_account_id: e.target.value})}
                      placeholder="000-0000000-0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      Nombre del Banco
                    </Label>
                    <Input
                      value={editForm.payment_bank_name}
                      onChange={(e) => setEditForm({...editForm, payment_bank_name: e.target.value})}
                      placeholder="Ej: Banco Popular"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Cuenta</Label>
                    <select
                      className="w-full h-10 px-3 rounded-md border border-input bg-background"
                      value={editForm.payment_account_type}
                      onChange={(e) => setEditForm({...editForm, payment_account_type: e.target.value})}
                    >
                      <option value="">Seleccionar...</option>
                      <option value="Ahorro">Cuenta de Ahorro</option>
                      <option value="Corriente">Cuenta Corriente</option>
                    </select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Número de Cuenta</Label>
                    <Input
                      value={editForm.payment_account_number}
                      onChange={(e) => setEditForm({...editForm, payment_account_number: e.target.value})}
                      placeholder="Número de cuenta bancaria"
                    />
                  </div>
                </div>
              </div>

              {/* Manuals Section */}
              <div className="pt-6 border-t">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  Manuales del Evento
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Runners Manual */}
                  <div className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Manual de Corredores</h4>
                      {activeRace?.manual_runners_url ? (
                        <Badge variant="default" className="bg-green-100 text-green-800">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Cargado
                        </Badge>
                      ) : (
                        <Badge variant="secondary">No cargado</Badge>
                      )}
                    </div>
                    
                    {activeRace?.manual_runners_url && (
                      <a 
                        href={`${API_URL}${activeRace.manual_runners_url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <FileText className="w-3 h-3" />
                        Ver manual actual
                      </a>
                    )}
                    
                    <div className="flex gap-2">
                      <label className="flex-1">
                        <input
                          type="file"
                          accept=".pdf"
                          className="hidden"
                          onChange={(e) => handleManualUpload(e, 'runners')}
                          disabled={uploadingManual === 'runners'}
                        />
                        <Button 
                          type="button" 
                          variant="outline" 
                          className="w-full"
                          disabled={uploadingManual === 'runners'}
                          onClick={(e) => e.currentTarget.parentElement.querySelector('input').click()}
                        >
                          {uploadingManual === 'runners' ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Subiendo...</>
                          ) : (
                            <><Upload className="w-4 h-4 mr-2" /> {activeRace?.manual_runners_url ? 'Reemplazar' : 'Subir PDF'}</>
                          )}
                        </Button>
                      </label>
                      {activeRace?.manual_runners_url && (
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDeleteManual('runners')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    
                    {/* Notify Runners Button */}
                    {activeRace?.manual_runners_url && (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full border-orange-300 text-orange-700 hover:bg-orange-50"
                        onClick={() => handleSendManualNotification('runners')}
                        disabled={sendingNotification === 'runners' || notificationCounts.runners === 0}
                      >
                        {sendingNotification === 'runners' ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
                        ) : (
                          <><Mail className="w-4 h-4 mr-2" /> Notificar Corredores ({notificationCounts.runners})</>
                        )}
                      </Button>
                    )}
                  </div>

                  {/* Volunteers Manual */}
                  <div className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Manual de Voluntarios</h4>
                      {activeRace?.manual_volunteers_url ? (
                        <Badge variant="default" className="bg-green-100 text-green-800">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Cargado
                        </Badge>
                      ) : (
                        <Badge variant="secondary">No cargado</Badge>
                      )}
                    </div>
                    
                    {activeRace?.manual_volunteers_url && (
                      <a 
                        href={`${API_URL}${activeRace.manual_volunteers_url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <FileText className="w-3 h-3" />
                        Ver manual actual
                      </a>
                    )}
                    
                    <div className="flex gap-2">
                      <label className="flex-1">
                        <input
                          type="file"
                          accept=".pdf"
                          className="hidden"
                          onChange={(e) => handleManualUpload(e, 'volunteers')}
                          disabled={uploadingManual === 'volunteers'}
                        />
                        <Button 
                          type="button" 
                          variant="outline" 
                          className="w-full"
                          disabled={uploadingManual === 'volunteers'}
                          onClick={(e) => e.currentTarget.parentElement.querySelector('input').click()}
                        >
                          {uploadingManual === 'volunteers' ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Subiendo...</>
                          ) : (
                            <><Upload className="w-4 h-4 mr-2" /> {activeRace?.manual_volunteers_url ? 'Reemplazar' : 'Subir PDF'}</>
                          )}
                        </Button>
                      </label>
                      {activeRace?.manual_volunteers_url && (
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDeleteManual('volunteers')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    
                    {/* Notify Volunteers Button */}
                    {activeRace?.manual_volunteers_url && (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full border-purple-300 text-purple-700 hover:bg-purple-50"
                        onClick={() => handleSendManualNotification('volunteers')}
                        disabled={sendingNotification === 'volunteers' || notificationCounts.volunteers === 0}
                      >
                        {sendingNotification === 'volunteers' ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
                        ) : (
                          <><Mail className="w-4 h-4 mr-2" /> Notificar Voluntarios ({notificationCounts.volunteers})</>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Page Visibility Section */}
              <div className="pt-6 border-t">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <Eye className="w-5 h-5 text-purple-600" />
                  Visibilidad de Páginas Públicas
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Controla qué páginas están visibles para el público durante el evento.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Tracking Page Toggle */}
                  <div className={`p-4 border rounded-lg ${editForm.show_tracking_page ? 'border-green-200 bg-green-50/50' : 'border-gray-200 bg-gray-50/50'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${editForm.show_tracking_page ? 'bg-green-100' : 'bg-gray-200'}`}>
                          <Users className={`w-5 h-5 ${editForm.show_tracking_page ? 'text-green-600' : 'text-gray-500'}`} />
                        </div>
                        <div>
                          <h4 className="font-medium">Página de Seguimiento</h4>
                          <p className="text-sm text-muted-foreground">Resultados en vivo y posiciones</p>
                        </div>
                      </div>
                      <Switch
                        checked={editForm.show_tracking_page}
                        onCheckedChange={(checked) => setEditForm({...editForm, show_tracking_page: checked})}
                      />
                    </div>
                    <div className="mt-3 pt-3 border-t border-dashed">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        {editForm.show_tracking_page ? (
                          <><Eye className="w-3 h-3 text-green-600" /> Visible en /seguimiento</>
                        ) : (
                          <><EyeOff className="w-3 h-3 text-gray-500" /> Oculta para visitantes</>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Community Page Toggle */}
                  <div className={`p-4 border rounded-lg ${editForm.show_community_page ? 'border-green-200 bg-green-50/50' : 'border-gray-200 bg-gray-50/50'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${editForm.show_community_page ? 'bg-green-100' : 'bg-gray-200'}`}>
                          <MessageCircle className={`w-5 h-5 ${editForm.show_community_page ? 'text-green-600' : 'text-gray-500'}`} />
                        </div>
                        <div>
                          <h4 className="font-medium">Página de Comunidad</h4>
                          <p className="text-sm text-muted-foreground">Mensajes de ánimo y fans</p>
                        </div>
                      </div>
                      <Switch
                        checked={editForm.show_community_page}
                        onCheckedChange={(checked) => setEditForm({...editForm, show_community_page: checked})}
                      />
                    </div>
                    <div className="mt-3 pt-3 border-t border-dashed">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        {editForm.show_community_page ? (
                          <><Eye className="w-3 h-3 text-green-600" /> Visible en /comunidad</>
                        ) : (
                          <><EyeOff className="w-3 h-3 text-gray-500" /> Oculta para visitantes</>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Inscription Toggle */}
                  <div className={`p-4 border rounded-lg ${editForm.show_preregistration ? 'border-green-200 bg-green-50/50' : 'border-gray-200 bg-gray-50/50'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${editForm.show_preregistration ? 'bg-green-100' : 'bg-gray-200'}`}>
                          <ClipboardList className={`w-5 h-5 ${editForm.show_preregistration ? 'text-green-600' : 'text-gray-500'}`} />
                        </div>
                        <div>
                          <h4 className="font-medium">Inscripcion de Atletas</h4>
                          <p className="text-sm text-muted-foreground">Boton de inscripcion en Mi Perfil</p>
                        </div>
                      </div>
                      <Switch
                        checked={editForm.show_preregistration}
                        onCheckedChange={(checked) => setEditForm({...editForm, show_preregistration: checked})}
                      />
                    </div>
                    <div className="mt-3 pt-3 border-t border-dashed">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        {editForm.show_preregistration ? (
                          <><Eye className="w-3 h-3 text-green-600" /> Activo - Boton "Inscribirme" visible en Mi Perfil</>
                        ) : (
                          <><EyeOff className="w-3 h-3 text-gray-500" /> Inactivo - Muestra "Proximamente" en Mi Perfil</>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Sponsors Page Toggle */}
                  <div className={`p-4 border rounded-lg ${editForm.show_sponsors_page ? 'border-green-200 bg-green-50/50' : 'border-gray-200 bg-gray-50/50'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${editForm.show_sponsors_page ? 'bg-green-100' : 'bg-gray-200'}`}>
                          <Handshake className={`w-5 h-5 ${editForm.show_sponsors_page ? 'text-green-600' : 'text-gray-500'}`} />
                        </div>
                        <div>
                          <h4 className="font-medium">Página de Patrocinadores</h4>
                          <p className="text-sm text-muted-foreground">Enlace en el menú y página pública</p>
                        </div>
                      </div>
                      <Switch
                        checked={editForm.show_sponsors_page}
                        onCheckedChange={(checked) => setEditForm({...editForm, show_sponsors_page: checked})}
                        data-testid="toggle-sponsors-page"
                      />
                    </div>
                    <div className="mt-3 pt-3 border-t border-dashed">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        {editForm.show_sponsors_page ? (
                          <><Eye className="w-3 h-3 text-green-600" /> Visible - Aparece en el menú</>
                        ) : (
                          <><EyeOff className="w-3 h-3 text-gray-500" /> Oculta - No aparece en el menú</>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Volunteer Registration (carrera) Toggle */}
                  <div className={`p-4 border rounded-lg ${editForm.show_volunteer_carrera ? 'border-green-200 bg-green-50/50' : 'border-gray-200 bg-gray-50/50'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${editForm.show_volunteer_carrera ? 'bg-green-100' : 'bg-gray-200'}`}>
                          <Users className={`w-5 h-5 ${editForm.show_volunteer_carrera ? 'text-green-600' : 'text-gray-500'}`} />
                        </div>
                        <div>
                          <h4 className="font-medium">Voluntarios del Backyard Ultra</h4>
                          <p className="text-sm text-muted-foreground">Postulaciones para la carrera</p>
                        </div>
                      </div>
                      <Switch
                        checked={editForm.show_volunteer_carrera}
                        onCheckedChange={(checked) => setEditForm({...editForm, show_volunteer_carrera: checked})}
                        data-testid="toggle-volunteer-carrera"
                      />
                    </div>
                    <div className="mt-3 pt-3 border-t border-dashed">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        {editForm.show_volunteer_carrera ? (
                          <><Eye className="w-3 h-3 text-green-600" /> Abierto - Se puede postular a la carrera y al campeonato</>
                        ) : (
                          <><EyeOff className="w-3 h-3 text-gray-500" /> Cerrado - Solo se reciben voluntarios del Campeonato Mundial</>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button onClick={handleUpdateRace} disabled={saving}>
                  {saving ? (
                    <RotateCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  Guardar Cambios
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cerrar la edicion en curso y montar la siguiente */}
      {activeRace && !activeRace.is_default && !showCreateForm && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <Archive className="w-5 h-5" />
              Cerrar edición y montar la siguiente
            </CardTitle>
            <CardDescription>
              Congela los resultados de una edición y crea la próxima heredando lo que se reutiliza
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-white p-4 rounded-lg border border-amber-200">
              <h4 className="font-medium text-amber-900 mb-2">Al cerrar una carrera</h4>
              <ul className="text-sm text-amber-800 space-y-1">
                <li>No se borra ni se mueve nada: cada dato lleva su carrera y se queda donde está.</li>
                <li>Los resultados quedan congelados y consultables en /resultados/{'{código}'}.</li>
                <li>El reloj deja de contar vueltas.</li>
                <li>Deja de ofrecerse como carrera de trabajo en el panel.</li>
                <li>Si se cierra antes de tiempo, se puede reabrir.</li>
              </ul>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                <Info className="w-4 h-4" />
                Al crear la siguiente
              </h4>
              <p className="text-sm text-blue-800">
                Puedes heredar de otra edición los logos, los datos de pago y el
                cuadro de puestos de voluntario, que es casi todo el trabajo de
                montarla. Publicarla en el sitio es una decisión aparte: crear el
                campeonato no tumba la página de inscripción de la carrera.
              </p>
            </div>

            {/* Lo que se hace al terminar una edición: avisar a los
                corredores y dejar limpio lo que no pasa a la siguiente. */}
            <div className="bg-white p-4 rounded-lg border border-amber-200 space-y-3">
              <h4 className="font-medium text-amber-900">Cierre de {activeRace.code}</h4>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => enviarCorreosDeCierre(activeRace.code)}
                  disabled={enviandoCorreos}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  {enviandoCorreos ? 'Enviando...' : 'Enviar correo de cierre a corredores'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => limpiarParaLaSiguiente(activeRace.code, 'mensajes')}
                  disabled={limpiando === 'mensajes'}
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Borrar mensajes de ánimo
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => limpiarParaLaSiguiente(activeRace.code, 'suscripciones')}
                  disabled={limpiando === 'suscripciones'}
                >
                  <Bell className="w-4 h-4 mr-2" />
                  Borrar suscripciones de seguimiento
                </Button>
              </div>
              <p className="text-xs text-amber-800">
                El correo lleva el resultado de cada corredor y solo tiene sentido
                con la carrera ya terminada. Las dos limpiezas solo afectan a esta
                carrera.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                className="border-amber-300 text-amber-800 hover:bg-amber-100"
                onClick={() => handleCloseRace(activeRace.code)}
                disabled={saving || activeRace.estado === 'cerrada'}
              >
                <Archive className="w-4 h-4 mr-2" />
                {activeRace.estado === 'cerrada' ? 'Carrera cerrada' : 'Cerrar esta carrera'}
              </Button>
              {activeRace.estado === 'cerrada' && (
                <Button
                  variant="outline"
                  onClick={() => handleReopenRace(activeRace.code)}
                  disabled={saving}
                >
                  <RotateCw className="w-4 h-4 mr-2" />
                  Reabrir
                </Button>
              )}
              <Button
                className="bg-green-600 hover:bg-green-700"
                onClick={() => setShowCreateForm(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Crear Nueva Edición de Carrera
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create New Race Form */}
      {showCreateForm && (
        <Card className="border-green-200">
          <CardHeader className="bg-green-50">
            <CardTitle className="flex items-center gap-2 text-green-800">
              <Plus className="w-5 h-5" />
              Crear Nueva Carrera
            </CardTitle>
            <CardDescription>
              Al crear una nueva carrera, la anterior será archivada automáticamente
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleCreateRace} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Código de Carrera *</Label>
                  <Input 
                    value={newRace.code}
                    onChange={(e) => setNewRace({...newRace, code: e.target.value.toUpperCase()})}
                    placeholder="Ej: BYSD-2027"
                    required
                  />
                  <p className="text-xs text-muted-foreground">Identificador único (ej: BYSD-2027)</p>
                </div>
                
                <div className="space-y-2">
                  <Label>Nombre de la Carrera *</Label>
                  <Input 
                    value={newRace.name}
                    onChange={(e) => setNewRace({...newRace, name: e.target.value})}
                    placeholder="Ej: Backyard Ultra Santo Domingo 2027"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Fecha de la Carrera *</Label>
                  <Input 
                    type="date"
                    value={newRace.date}
                    onChange={(e) => setNewRace({...newRace, date: e.target.value})}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Hora de Inicio</Label>
                  <Input 
                    type="time"
                    value={newRace.start_time}
                    onChange={(e) => setNewRace({...newRace, start_time: e.target.value})}
                  />
                </div>
                
                <div className="md:col-span-2 space-y-2">
                  <Label>Ubicación *</Label>
                  <Input 
                    value={newRace.location}
                    onChange={(e) => setNewRace({...newRace, location: e.target.value})}
                    placeholder="Ej: Parque del Este, Santo Domingo"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Costo de Inscripción (RD$)</Label>
                  <Input 
                    type="number"
                    min="0"
                    step="100"
                    value={newRace.registration_cost}
                    onChange={(e) => setNewRace({...newRace, registration_cost: parseFloat(e.target.value) || 0})}
                    placeholder="3500"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Número de Edición</Label>
                  <Input 
                    type="number"
                    min="1"
                    max="100"
                    value={newRace.edition_number}
                    onChange={(e) => setNewRace({...newRace, edition_number: parseInt(e.target.value) || 1})}
                    placeholder="1"
                  />
                  <p className="text-xs text-muted-foreground">1 = Primera Edición, 2 = Segunda, etc.</p>
                </div>
              </div>

              {/* De donde heredar lo que se reutiliza */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                <div className="space-y-2">
                  <Label>Heredar de una edición anterior</Label>
                  <select
                    value={newRace.copiar_de}
                    onChange={(e) => setNewRace({ ...newRace, copiar_de: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  >
                    <option value="">Empezar en blanco</option>
                    {allRaces.filter((r) => !r.is_legacy).map((r) => (
                      <option key={r.code} value={r.code}>{r.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-blue-800">
                    Copia los logos, los datos de pago y el cuadro de puestos de
                    voluntario. Los resultados, inscritos y fechas no se copian:
                    son propios de cada edición.
                  </p>
                </div>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newRace.is_active}
                    onChange={(e) => setNewRace({ ...newRace, is_active: e.target.checked })}
                    className="mt-1 w-4 h-4 rounded border-blue-300"
                  />
                  <div>
                    <span className="font-medium text-blue-900">Publicarla en el sitio</span>
                    <p className="text-sm text-blue-800 mt-1">
                      Es la carrera que verán los visitantes: portada, inscripción
                      y logos. Solo puede haber una publicada, así que esto
                      despublica la actual{activeRace?.name ? ` (${activeRace.name})` : ''}.
                      Déjalo apagado si estás montando una carrera que todavía no
                      se anuncia.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newRace.es_campeonato}
                    onChange={(e) => setNewRace({ ...newRace, es_campeonato: e.target.checked })}
                    className="mt-1 w-4 h-4 rounded border-blue-300"
                  />
                  <div>
                    <span className="font-medium text-blue-900">Es un campeonato por equipos</span>
                    <p className="text-sm text-blue-800 mt-1">
                      Para el Campeonato Mundial y similares, que no tienen
                      inscripción abierta al público.
                    </p>
                  </div>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving} className="bg-green-600 hover:bg-green-700">
                  {saving ? (
                    <RotateCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  {archiveOnCreate && activeRace && !activeRace.is_default && !activeRace.data_archived 
                    ? 'Archivar y Crear Nueva Carrera' 
                    : 'Crear y Activar Carrera'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* All Races List */}
      {allRaces.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Archive className="w-5 h-5" />
              Historial de Carreras
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {allRaces.map((race) => (
                <div 
                  key={race.code}
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    race.is_active ? 'bg-green-50 border-green-200' : 'bg-muted/50'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{race.code}</span>
                        {race.is_active && (
                          <Badge className="bg-green-500 text-xs">Activa</Badge>
                        )}
                        {race.data_archived && (
                          <Badge variant="outline" className="text-xs">Archivada</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{race.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {race.date} • {race.location}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!race.is_active && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleActivateRace(race.code)}
                        disabled={saving}
                      >
                        Activar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
