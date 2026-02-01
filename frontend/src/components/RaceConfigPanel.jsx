import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { 
  Settings, Plus, Upload, Check, Calendar, Clock, MapPin, 
  Tag, Image, Archive, RotateCw, Trash2, CheckCircle, AlertCircle,
  DollarSign, Hash, FileText, CreditCard, Building2, User, Loader2,
  Mail, Send
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function RaceConfigPanel() {
  const [activeRace, setActiveRace] = useState(null);
  const [allRaces, setAllRaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingManual, setUploadingManual] = useState(null); // 'runners' or 'volunteers'
  const [archiveOnCreate, setArchiveOnCreate] = useState(true);
  const [sendingNotification, setSendingNotification] = useState(null); // 'runners' or 'volunteers'
  const [notificationCounts, setNotificationCounts] = useState({ runners: 0, volunteers: 0 });
  
  // Form state for creating new race
  const [newRace, setNewRace] = useState({
    code: '',
    name: '',
    date: '',
    start_time: '09:00',
    location: '',
    registration_cost: 3500,
    edition_number: 1
  });
  
  // Form state for editing active race
  const [editForm, setEditForm] = useState({
    name: '',
    date: '',
    start_time: '',
    location: '',
    registration_cost: 3500,
    edition_number: 1,
    // Payment info
    payment_account_name: '',
    payment_account_id: '',
    payment_bank_name: '',
    payment_account_type: '',
    payment_account_number: ''
  });

  const token = localStorage.getItem('admin_token');

  const loadData = async () => {
    setLoading(true);
    try {
      const [activeRes, allRes] = await Promise.all([
        fetch(`${API_URL}/api/race-config/active`),
        fetch(`${API_URL}/api/race-config/all`)
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
        registration_cost: activeData.registration_cost || 3500,
        edition_number: activeData.edition_number || 1,
        // Payment info
        payment_account_name: activeData.payment_account_name || '',
        payment_account_id: activeData.payment_account_id || '',
        payment_bank_name: activeData.payment_bank_name || '',
        payment_account_type: activeData.payment_account_type || '',
        payment_account_number: activeData.payment_account_number || ''
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
        fetch(`${API_URL}/api/race-config/notify-runners-count/${code}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_URL}/api/race-config/notify-volunteers-count/${code}`, {
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
      
      const response = await fetch(`${API_URL}${endpoint}`, {
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

  const handleCreateRace = async (e) => {
    e.preventDefault();
    
    if (!newRace.code || !newRace.name || !newRace.date || !newRace.location) {
      toast.error('Por favor completa todos los campos obligatorios');
      return;
    }
    
    setSaving(true);
    try {
      // Archive current race data if option is selected and there's an active race
      if (archiveOnCreate && activeRace && !activeRace.is_default && !activeRace.data_archived) {
        toast.info('Archivando datos de la carrera anterior...');
        const archiveResponse = await fetch(`${API_URL}/api/race-config/archive-data/${activeRace.code}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (archiveResponse.ok) {
          const archiveData = await archiveResponse.json();
          toast.success(`Datos archivados: ${archiveData.archived.participants} participantes, ${archiveData.archived.cheer_messages} mensajes`);
        }
      }
      
      // Create new race
      const response = await fetch(`${API_URL}/api/race-config/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ...newRace, is_active: true })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Error al crear la carrera');
      }
      
      toast.success('Nueva carrera creada y activada exitosamente');
      setShowCreateForm(false);
      setNewRace({ code: '', name: '', date: '', start_time: '09:00', location: '' });
      setArchiveOnCreate(true);
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
      const response = await fetch(`${API_URL}/api/race-config/update/${activeRace.code}`, {
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
      const response = await fetch(`${API_URL}/api/race-config/upload-logo/${activeRace.code}`, {
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
      const response = await fetch(`${API_URL}/api/race-config/upload-manual/${activeRace.code}/${manualType}`, {
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
      const response = await fetch(`${API_URL}/api/race-config/delete-manual/${activeRace.code}/${manualType}`, {
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
      const response = await fetch(`${API_URL}/api/race-config/activate/${code}`, {
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

  const handleArchiveData = async (code) => {
    if (!window.confirm(`¿Estás seguro de archivar todos los datos de la carrera ${code}? Esta acción no se puede deshacer.`)) {
      return;
    }
    
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/race-config/archive-data/${code}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Error al archivar');
      }
      
      const data = await response.json();
      toast.success(`Datos archivados: ${data.archived.participants} participantes, ${data.archived.cheer_messages} mensajes`);
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
      {/* Active Race Configuration */}
      <Card className="border-primary/20">
        <CardHeader className="bg-gradient-to-r from-primary/10 to-accent/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Settings className="w-6 h-6 text-primary" />
              <div>
                <CardTitle>Carrera Activa</CardTitle>
                <CardDescription>Configuración de la carrera actual</CardDescription>
              </div>
            </div>
            {activeRace && !activeRace.is_default && (
              <Badge className="bg-green-500">
                <CheckCircle className="w-3 h-3 mr-1" />
                {activeRace.code}
              </Badge>
            )}
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
              {/* Logo Section */}
              <div className="flex items-center gap-6 p-4 bg-muted/50 rounded-lg">
                <div className="w-24 h-24 bg-white rounded-lg border flex items-center justify-center overflow-hidden">
                  {activeRace?.logo_url ? (
                    <img 
                      src={activeRace.logo_url.startsWith('/api') ? `${API_URL}${activeRace.logo_url}` : activeRace.logo_url} 
                      alt="Logo" 
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <Image className="w-8 h-8 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  <Label className="text-sm font-medium">Logo de la Carrera</Label>
                  <p className="text-xs text-muted-foreground mb-2">PNG, JPG o SVG. Recomendado: 512x512px</p>
                  <div className="flex gap-2">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      disabled={uploadingLogo}
                      className="max-w-xs"
                    />
                    {uploadingLogo && <RotateCw className="w-5 h-5 animate-spin" />}
                  </div>
                </div>
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
                
                <div className="md:col-span-2 space-y-2">
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

      {/* Archive and Create New Race Section */}
      {activeRace && !activeRace.is_default && !showCreateForm && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <Archive className="w-5 h-5" />
              Finalizar Edición y Crear Nueva
            </CardTitle>
            <CardDescription>
              Archiva los datos de la carrera actual y prepara una nueva edición
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-white p-4 rounded-lg border border-amber-200">
              <h4 className="font-medium text-amber-900 mb-2">¿Qué sucede al archivar?</h4>
              <ul className="text-sm text-amber-800 space-y-1">
                <li>• Los participantes actuales se guardan en el historial</li>
                <li>• Los mensajes de ánimo se archivan</li>
                <li>• Los patrocinadores se conservan</li>
                <li>• Podrás consultar estos datos en el historial</li>
              </ul>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                variant="outline"
                className="border-amber-300 text-amber-700 hover:bg-amber-100"
                onClick={() => handleArchiveData(activeRace.code)}
                disabled={saving || activeRace.data_archived}
              >
                <Archive className="w-4 h-4 mr-2" />
                {activeRace.data_archived ? 'Datos Ya Archivados' : 'Solo Archivar Datos'}
              </Button>
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

              {/* Archive Option */}
              {activeRace && !activeRace.is_default && !activeRace.data_archived && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={archiveOnCreate}
                      onChange={(e) => setArchiveOnCreate(e.target.checked)}
                      className="mt-1 w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <span className="font-medium text-amber-900">Archivar datos de "{activeRace.code}" antes de crear</span>
                      <p className="text-sm text-amber-700 mt-1">
                        Se guardarán {activeRace.code ? 'los participantes, mensajes de ánimo y patrocinadores' : ''} en el historial.
                      </p>
                    </div>
                  </label>
                </div>
              )}

              {activeRace?.data_archived && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm text-green-700">
                    <CheckCircle className="w-4 h-4 inline mr-2" />
                    Los datos de "{activeRace.code}" ya fueron archivados.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => {
                    setShowCreateForm(false);
                    setArchiveOnCreate(true);
                  }}
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
