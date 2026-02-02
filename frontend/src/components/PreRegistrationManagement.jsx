import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { 
  Search, Users, UserCheck, UserX, Edit, Trash2, Save, X, 
  Hash, Shirt, Phone, Mail, Calendar, MapPin, Heart, Flag,
  ChevronDown, ChevronUp, AlertCircle, CheckCircle, Download,
  Send, Loader2, CreditCard, FileImage, Award, TrendingUp, ArrowUpDown,
  QrCode
} from 'lucide-react';
import { toast } from 'sonner';
import { useRaceConfig } from '../contexts/RaceConfigContext';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Calculate experience score (50% years experience, 50% max distance)
const calculateExperienceScore = (registration) => {
  const yearsExp = registration.anos_experiencia || 0;
  const maxDistance = registration.maxima_distancia_km || 0;
  
  // Normalize years experience (0-20 years -> 0-100)
  const normalizedYears = Math.min(yearsExp / 20, 1) * 100;
  
  // Normalize max distance (0-200 km -> 0-100)
  const normalizedDistance = Math.min(maxDistance / 200, 1) * 100;
  
  // 50/50 weighted score
  return (normalizedYears * 0.5) + (normalizedDistance * 0.5);
};

export default function PreRegistrationManagement() {
  const { raceCode, loading: configLoading } = useRaceConfig();
  const [registrations, setRegistrations] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [editingEmail, setEditingEmail] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);
  const [nextBib, setNextBib] = useState(1);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [activeAthletesCount, setActiveAthletesCount] = useState(0);
  const [pendingReceipts, setPendingReceipts] = useState([]);
  const [sortByExperience, setSortByExperience] = useState(false);
  const [removingBib, setRemovingBib] = useState(null);
  const [autoAssigningBibs, setAutoAssigningBibs] = useState(false);
  const [removingAllBibs, setRemovingAllBibs] = useState(false);

  const token = localStorage.getItem('admin_token');

  const loadData = useCallback(async () => {
    if (!raceCode || configLoading) return;
    
    setLoading(true);
    try {
      const [regsRes, statsRes, bibRes, countRes, receiptsRes] = await Promise.all([
        fetch(`${API_URL}/api/registration/admin/list/${raceCode}`),
        fetch(`${API_URL}/api/registration/admin/stats/${raceCode}`),
        fetch(`${API_URL}/api/registration/admin/next-bib/${raceCode}`),
        fetch(`${API_URL}/api/registration/admin/active-athletes-count/${raceCode}`),
        fetch(`${API_URL}/api/registration/admin/pending-receipts/${raceCode}`)
      ]);
      
      if (regsRes.ok) {
        const data = await regsRes.json();
        setRegistrations(data.registrations || []);
      }
      
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }
      
      if (bibRes.ok) {
        const data = await bibRes.json();
        setNextBib(data.next_bib);
      }
      
      if (countRes.ok) {
        const data = await countRes.json();
        setActiveAthletesCount(data.count || 0);
      }
      
      if (receiptsRes.ok) {
        const data = await receiptsRes.json();
        setPendingReceipts(data.registrations || []);
      }
    } catch (error) {
      console.error('Error loading registrations:', error);
      toast.error('Error al cargar los pre-registros');
    } finally {
      setLoading(false);
    }
  }, [raceCode, configLoading]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSendPaymentReminder = async () => {
    if (activeAthletesCount === 0) {
      toast.error('No hay atletas activos con pago pendiente');
      return;
    }
    
    const confirmed = window.confirm(
      `¿Enviar recordatorio de pago a ${activeAthletesCount} atletas activos con pago pendiente?\n\nEl correo incluirá los datos de la cuenta para el pago y un enlace para subir el comprobante.`
    );
    
    if (!confirmed) return;
    
    setSendingReminder(true);
    try {
      const response = await fetch(`${API_URL}/api/registration/admin/send-payment-reminder/${raceCode}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Error al enviar recordatorios');
      }
      
      toast.success(data.message, {
        description: data.failed_count > 0 ? `${data.failed_count} envíos fallaron` : undefined
      });
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSendingReminder(false);
    }
  };

  const handleReviewReceipt = async (email, approved) => {
    const action = approved ? 'aprobar' : 'rechazar';
    const confirmed = window.confirm(
      `¿Deseas ${action} el comprobante de pago de ${email}?`
    );
    
    if (!confirmed) return;
    
    try {
      const response = await fetch(
        `${API_URL}/api/registration/admin/review-receipt/${email}?race_code=${raceCode}&approved=${approved}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Error al revisar el comprobante');
      }
      
      toast.success(data.message);
      loadData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleRemoveBib = async (email) => {
    const confirmed = window.confirm(
      `¿Eliminar la asignación de BIB para ${email}?\n\nEsto dejará al atleta sin número asignado.`
    );
    
    if (!confirmed) return;
    
    setRemovingBib(email);
    try {
      const response = await fetch(
        `${API_URL}/api/registration/admin/remove-bib/${email}?race_code=${raceCode}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Error al eliminar asignación');
      }
      
      toast.success('Asignación de BIB eliminada');
      loadData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setRemovingBib(null);
    }
  };

  // Count eligible athletes for auto-assignment
  const eligibleForBibCount = useMemo(() => {
    return registrations.filter(r => r.status === 'active' && r.payment_status === 'paid').length;
  }, [registrations]);

  const handleAutoAssignBibs = async () => {
    if (eligibleForBibCount === 0) {
      toast.error('No hay atletas activos con pago completado para asignar BIB');
      return;
    }
    
    const startBib = prompt(
      `Se asignarán BIBs a ${eligibleForBibCount} atletas activos con pago completado, ordenados por nivel de experiencia.\n\n¿Desde qué número de BIB desea iniciar?`,
      '1'
    );
    
    if (!startBib) return;
    
    const startBibNum = parseInt(startBib);
    if (isNaN(startBibNum) || startBibNum < 1) {
      toast.error('Por favor ingrese un número válido');
      return;
    }
    
    const confirmed = window.confirm(
      `¿Confirma asignar BIBs del ${startBibNum} al ${startBibNum + eligibleForBibCount - 1} según el indicador de experiencia?\n\nEsto sobrescribirá cualquier BIB existente para estos atletas.`
    );
    
    if (!confirmed) return;
    
    setAutoAssigningBibs(true);
    try {
      const response = await fetch(
        `${API_URL}/api/registration/admin/auto-assign-bibs/${raceCode}?start_bib=${startBibNum}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Error al asignar BIBs');
      }
      
      toast.success(data.message, {
        description: `BIBs ${data.start_bib} - ${data.end_bib} asignados por experiencia`
      });
      loadData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setAutoAssigningBibs(false);
    }
  };

  // Count athletes with BIB assigned
  const athletesWithBibCount = useMemo(() => {
    return registrations.filter(r => r.bib).length;
  }, [registrations]);

  const handleRemoveAllBibs = async () => {
    if (athletesWithBibCount === 0) {
      toast.error('No hay atletas con BIB asignado');
      return;
    }
    
    const confirmed = window.confirm(
      `¿Está seguro de eliminar TODAS las asignaciones de BIB?\n\nEsta acción eliminará el número de BIB de ${athletesWithBibCount} atleta(s).`
    );
    
    if (!confirmed) return;
    
    setRemovingAllBibs(true);
    try {
      const response = await fetch(
        `${API_URL}/api/registration/admin/remove-all-bibs/${raceCode}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Error al eliminar asignaciones');
      }
      
      toast.success(data.message);
      loadData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setRemovingAllBibs(false);
    }
  };

  // Filter and optionally sort by experience
  const filteredRegistrations = useMemo(() => {
    let result = registrations.filter(reg => {
      const matchesSearch = 
        `${reg.nombre} ${reg.apellidos}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        reg.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (reg.bib && reg.bib.toString().includes(searchTerm));
      
      const matchesFilter = filterStatus === 'all' || reg.status === filterStatus;
      
      return matchesSearch && matchesFilter;
    });
    
    // Sort by experience if enabled (only for active + paid athletes)
    if (sortByExperience) {
      result = result
        .map(reg => ({
          ...reg,
          experienceScore: calculateExperienceScore(reg)
        }))
        .sort((a, b) => {
          // Active + paid athletes with higher experience first
          const aQualified = a.status === 'active' && a.payment_status === 'paid';
          const bQualified = b.status === 'active' && b.payment_status === 'paid';
          
          if (aQualified && !bQualified) return -1;
          if (!aQualified && bQualified) return 1;
          if (aQualified && bQualified) {
            return b.experienceScore - a.experienceScore;
          }
          return 0;
        });
    }
    
    return result;
  }, [registrations, searchTerm, filterStatus, sortByExperience]);

  const startEditing = (reg) => {
    setEditingEmail(reg.email);
    setEditForm({
      nombre: reg.nombre || '',
      apellidos: reg.apellidos || '',
      email: reg.email || '',
      telefono: reg.telefono || '',
      nacionalidad: reg.nacionalidad || '',
      ciudad_residencia: reg.ciudad_residencia || '',
      fecha_nacimiento: reg.fecha_nacimiento || '',
      sexo: reg.sexo || '',
      talla_camiseta: reg.talla_camiseta || '',
      personalizacion_camiseta: reg.personalizacion_camiseta || '',
      tipo_sangre: reg.tipo_sangre || '',
      contacto_emergencia_nombre: reg.contacto_emergencia_nombre || '',
      contacto_emergencia_telefono: reg.contacto_emergencia_telefono || '',
      bib: reg.bib || '',
      status: reg.status || 'pre_registered',
      payment_status: reg.payment_status || 'pending'
    });
  };

  const cancelEditing = () => {
    setEditingEmail(null);
    setEditForm({});
  };

  const saveChanges = async () => {
    setSaving(true);
    try {
      // Clean up the form data - convert empty strings to null for bib
      const cleanedForm = { ...editForm };
      if (cleanedForm.bib === '' || cleanedForm.bib === null) {
        cleanedForm.bib = null;
      } else {
        cleanedForm.bib = parseInt(cleanedForm.bib);
      }

      const response = await fetch(
        `${API_URL}/api/registration/admin/registration/${editingEmail}?race_code=${raceCode}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(cleanedForm)
        }
      );
      
      if (response.ok) {
        toast.success('Registro actualizado exitosamente');
        setEditingEmail(null);
        loadData();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Error al actualizar');
      }
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Error al guardar los cambios');
    } finally {
      setSaving(false);
    }
  };

  const deleteRegistration = async (email) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este pre-registro? Esta acción no se puede deshacer.')) {
      return;
    }
    
    try {
      const response = await fetch(
        `${API_URL}/api/registration/admin/registration/${email}?race_code=${raceCode}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (response.ok) {
        toast.success('Registro eliminado');
        loadData();
      } else {
        toast.error('Error al eliminar el registro');
      }
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Error al eliminar');
    }
  };

  const assignNextBib = () => {
    setEditForm(prev => ({ ...prev, bib: nextBib }));
  };

  const exportToCSV = () => {
    if (filteredRegistrations.length === 0) {
      toast.error('No hay registros para exportar');
      return;
    }

    const headers = [
      'BIB', 'Nombre', 'Apellidos', 'Email', 'Teléfono', 'Nacionalidad', 
      'Ciudad', 'Fecha Nacimiento', 'Sexo', 'Talla', 'Personalización',
      'Tipo Sangre', 'Estado', 'Pago', 'Fecha Registro'
    ];

    const rows = filteredRegistrations.map(reg => [
      reg.bib || '',
      reg.nombre,
      reg.apellidos,
      reg.email,
      reg.telefono,
      reg.nacionalidad,
      reg.ciudad_residencia,
      reg.fecha_nacimiento,
      reg.sexo,
      reg.talla_camiseta,
      reg.personalizacion_camiseta,
      reg.tipo_sangre,
      reg.status,
      reg.payment_status,
      reg.created_at
    ]);

    const csvContent = '\uFEFF' + [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `pre-registros-${raceCode}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast.success('CSV exportado');
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pre_registered: { label: 'Pre-Registrado', variant: 'outline', className: 'border-blue-500 text-blue-600' },
      registered: { label: 'Registrado', variant: 'outline', className: 'border-green-500 text-green-600' },
      confirmed: { label: 'Confirmado', variant: 'default', className: 'bg-green-500' },
      active: { label: 'Activo', variant: 'default', className: 'bg-emerald-500' },
      retired: { label: 'Retirado', variant: 'outline', className: 'border-red-500 text-red-600' },
      dns: { label: 'DNS', variant: 'outline', className: 'border-gray-500 text-gray-600' },
      winner: { label: 'Ganador', variant: 'default', className: 'bg-yellow-500' }
    };
    
    const config = statusConfig[status] || statusConfig.pre_registered;
    return <Badge variant={config.variant} className={config.className}>{config.label}</Badge>;
  };

  const getPaymentBadge = (paymentStatus) => {
    if (paymentStatus === 'paid') {
      return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Pagado</Badge>;
    }
    return <Badge variant="outline" className="border-yellow-500 text-yellow-600"><AlertCircle className="w-3 h-3 mr-1" />Pendiente</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.masculino}</p>
                  <p className="text-xs text-muted-foreground">Masculino</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <UserX className="w-5 h-5 text-pink-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.femenino}</p>
                  <p className="text-xs text-muted-foreground">Femenino</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.paid}</p>
                  <p className="text-xs text-muted-foreground">Pagados</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Hash className="w-5 h-5 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold">{nextBib}</p>
                  <p className="text-xs text-muted-foreground">Próximo BIB</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Payment Reminder & Pending Receipts Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Payment Reminder Card */}
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-orange-800">
              <CreditCard className="w-4 h-4" />
              Recordatorio de Pago
            </CardTitle>
            <CardDescription className="text-orange-600">
              Envía un correo a los atletas activos con pago pendiente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-orange-800">{activeAthletesCount}</p>
                <p className="text-xs text-orange-600">Atletas con pago pendiente</p>
              </div>
              <Button
                variant="outline"
                className="border-orange-400 text-orange-700 hover:bg-orange-100"
                onClick={handleSendPaymentReminder}
                disabled={sendingReminder || activeAthletesCount === 0}
                data-testid="send-payment-reminder-btn"
              >
                {sendingReminder ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
                ) : (
                  <><Send className="w-4 h-4 mr-2" /> Enviar Recordatorio</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Pending Receipts Card */}
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-blue-800">
              <FileImage className="w-4 h-4" />
              Comprobantes Pendientes
            </CardTitle>
            <CardDescription className="text-blue-600">
              Comprobantes de pago esperando revisión
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-blue-800">{pendingReceipts.length}</p>
                <p className="text-xs text-blue-600">Por revisar</p>
              </div>
              {pendingReceipts.length > 0 && (
                <Badge className="bg-blue-500">{pendingReceipts.length} nuevo(s)</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Receipts List */}
      {pendingReceipts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileImage className="w-5 h-5 text-blue-500" />
              Comprobantes de Pago Pendientes ({pendingReceipts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingReceipts.map((reg) => (
                <div key={reg.email} className="border rounded-lg p-4 bg-white">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-semibold">{reg.nombre} {reg.apellidos}</p>
                      <p className="text-sm text-muted-foreground">{reg.email}</p>
                      <div className="flex flex-wrap gap-2 mt-2 text-sm">
                        <Badge variant="outline">
                          <Calendar className="w-3 h-3 mr-1" />
                          {reg.payment_receipt?.payment_date}
                        </Badge>
                        <Badge variant="outline">
                          {reg.payment_receipt?.bank_origin}
                        </Badge>
                        {reg.payment_receipt?.transfer_number && (
                          <Badge variant="outline">
                            Ref: {reg.payment_receipt.transfer_number}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      {reg.payment_receipt?.image_path && (
                        <a
                          href={`${API_URL}${reg.payment_receipt.image_path}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                        >
                          <FileImage className="w-4 h-4" />
                          Ver Comprobante
                        </a>
                      )}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="bg-green-500 hover:bg-green-600"
                          onClick={() => handleReviewReceipt(reg.email, true)}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Aprobar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-300 text-red-600 hover:bg-red-50"
                          onClick={() => handleReviewReceipt(reg.email, false)}
                        >
                          <X className="w-4 h-4 mr-1" />
                          Rechazar
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* T-shirt Distribution */}
      {stats?.talla_distribution && Object.keys(stats.talla_distribution).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shirt className="w-4 h-4" />
              Distribución de Tallas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {['XS', 'S', 'M', 'L', 'XL', 'XXL'].map(size => (
                <Badge key={size} variant="outline" className="px-3 py-1">
                  {size}: {stats.talla_distribution[size] || 0}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters and Search */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Atletas ({filteredRegistrations.length})
            </span>
            <div className="flex gap-2">
              <Button 
                variant={sortByExperience ? "default" : "outline"} 
                size="sm" 
                onClick={() => setSortByExperience(!sortByExperience)}
                className={sortByExperience ? "bg-purple-600 hover:bg-purple-700" : ""}
                data-testid="sort-by-experience-btn"
              >
                <Award className="w-4 h-4 mr-2" />
                {sortByExperience ? "Ordenado por Exp." : "Ordenar por Experiencia"}
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleAutoAssignBibs}
                disabled={autoAssigningBibs || eligibleForBibCount === 0}
                className="border-green-400 text-green-700 hover:bg-green-50"
                data-testid="auto-assign-bibs-btn"
              >
                {autoAssigningBibs ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Asignando...</>
                ) : (
                  <><Hash className="w-4 h-4 mr-2" /> Asignar BIBs ({eligibleForBibCount})</>
                )}
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRemoveAllBibs}
                disabled={removingAllBibs || athletesWithBibCount === 0}
                className="border-red-400 text-red-700 hover:bg-red-50"
                data-testid="remove-all-bibs-btn"
              >
                {removingAllBibs ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Eliminando...</>
                ) : (
                  <><Trash2 className="w-4 h-4 mr-2" /> Quitar BIBs ({athletesWithBibCount})</>
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={exportToCSV}>
                <Download className="w-4 h-4 mr-2" />
                Exportar CSV
              </Button>
            </div>
          </CardTitle>
          {sortByExperience && (
            <CardDescription className="text-purple-600 mt-2">
              <TrendingUp className="w-4 h-4 inline mr-1" />
              Mostrando atletas activos con pago completado ordenados por nivel de experiencia (50% años + 50% distancia máxima)
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, email o BIB..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="search-registrations"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border rounded-md bg-background"
              data-testid="filter-status"
            >
              <option value="all">Todos los estados</option>
              <option value="pre_registered">Pre-Registrado</option>
              <option value="registered">Registrado</option>
              <option value="confirmed">Confirmado</option>
              <option value="active">Activo</option>
            </select>
          </div>

          {/* Registrations Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2">BIB</th>
                  <th className="text-left py-3 px-2">Nombre</th>
                  <th className="text-left py-3 px-2 hidden md:table-cell">Email</th>
                  <th className="text-left py-3 px-2 hidden lg:table-cell">Talla</th>
                  <th className="text-center py-3 px-2 hidden lg:table-cell">Exp.</th>
                  <th className="text-left py-3 px-2">Estado</th>
                  <th className="text-left py-3 px-2">Pago</th>
                  <th className="text-right py-3 px-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredRegistrations.map((reg, index) => (
                  <React.Fragment key={reg.email}>
                    <tr className={`border-b hover:bg-muted/50 ${expandedRow === reg.email ? 'bg-muted/30' : ''}`}>
                      <td className="py-3 px-2">
                        {editingEmail === reg.email ? (
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              value={editForm.bib}
                              onChange={(e) => setEditForm(prev => ({ ...prev, bib: e.target.value }))}
                              className="w-16 h-8 text-sm"
                              placeholder="#"
                            />
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={assignNextBib}
                              title={`Asignar BIB ${nextBib}`}
                              className="h-8 px-2"
                            >
                              <Hash className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className={`font-mono ${reg.bib ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                              {reg.bib || '—'}
                            </span>
                            {reg.bib && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleRemoveBib(reg.email)}
                                disabled={removingBib === reg.email}
                                title="Eliminar asignación de BIB"
                              >
                                {removingBib === reg.email ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <X className="w-3 h-3" />
                                )}
                              </Button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        {editingEmail === reg.email ? (
                          <div className="flex gap-1">
                            <Input
                              value={editForm.nombre}
                              onChange={(e) => setEditForm(prev => ({ ...prev, nombre: e.target.value }))}
                              className="w-24 h-8 text-sm"
                              placeholder="Nombre"
                            />
                            <Input
                              value={editForm.apellidos}
                              onChange={(e) => setEditForm(prev => ({ ...prev, apellidos: e.target.value }))}
                              className="w-24 h-8 text-sm"
                              placeholder="Apellidos"
                            />
                          </div>
                        ) : (
                          <div>
                            <span className="font-medium">{reg.nombre} {reg.apellidos}</span>
                            <span className="block text-xs text-muted-foreground md:hidden">{reg.email}</span>
                            {sortByExperience && index < 10 && reg.status === 'active' && reg.payment_status === 'paid' && (
                              <Badge variant="outline" className="ml-2 text-xs bg-purple-50 text-purple-700 border-purple-300">
                                #{index + 1}
                              </Badge>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-2 hidden md:table-cell text-muted-foreground">
                        {reg.email}
                      </td>
                      <td className="py-3 px-2 hidden lg:table-cell">
                        {editingEmail === reg.email ? (
                          <select
                            value={editForm.talla_camiseta}
                            onChange={(e) => setEditForm(prev => ({ ...prev, talla_camiseta: e.target.value }))}
                            className="px-2 py-1 border rounded text-sm bg-background"
                          >
                            {['XS', 'S', 'M', 'L', 'XL', 'XXL'].map(size => (
                              <option key={size} value={size}>{size}</option>
                            ))}
                          </select>
                        ) : (
                          <Badge variant="outline">{reg.talla_camiseta}</Badge>
                        )}
                      </td>
                      {/* Experience Score Column */}
                      <td className="py-3 px-2 hidden lg:table-cell text-center">
                        {reg.status === 'active' && reg.payment_status === 'paid' ? (
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-purple-700">
                              {Math.round(reg.experienceScore || calculateExperienceScore(reg))}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {reg.anos_experiencia || 0}a / {reg.maxima_distancia_km || 0}km
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        {editingEmail === reg.email ? (
                          <select
                            value={editForm.status}
                            onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                            className="px-2 py-1 border rounded text-sm bg-background"
                          >
                            <option value="pre_registered">Pre-Registrado</option>
                            <option value="registered">Registrado</option>
                            <option value="confirmed">Confirmado</option>
                            <option value="active">Activo</option>
                          </select>
                        ) : (
                          getStatusBadge(reg.status)
                        )}
                      </td>
                      <td className="py-3 px-2">
                        {editingEmail === reg.email ? (
                          <select
                            value={editForm.payment_status}
                            onChange={(e) => setEditForm(prev => ({ ...prev, payment_status: e.target.value }))}
                            className="px-2 py-1 border rounded text-sm bg-background"
                          >
                            <option value="pending">Pendiente</option>
                            <option value="paid">Pagado</option>
                          </select>
                        ) : (
                          getPaymentBadge(reg.payment_status)
                        )}
                      </td>
                      <td className="py-3 px-2 text-right">
                        {editingEmail === reg.email ? (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" onClick={saveChanges} disabled={saving} className="h-8">
                              <Save className="w-3 h-3 mr-1" />
                              {saving ? '...' : 'Guardar'}
                            </Button>
                            <Button size="sm" variant="outline" onClick={cancelEditing} className="h-8">
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-1">
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => setExpandedRow(expandedRow === reg.email ? null : reg.email)}
                              className="h-8"
                            >
                              {expandedRow === reg.email ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => startEditing(reg)}
                              className="h-8"
                              data-testid={`edit-btn-${reg.email}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => deleteRegistration(reg.email)}
                              className="h-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                    
                    {/* Expanded Details Row */}
                    {expandedRow === reg.email && (
                      <tr className="bg-muted/20">
                        <td colSpan={7} className="py-4 px-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div>
                              <h4 className="font-semibold mb-2 flex items-center gap-2">
                                <UserCheck className="w-4 h-4" /> Información Personal
                              </h4>
                              <div className="space-y-1 text-muted-foreground">
                                <p><Mail className="w-3 h-3 inline mr-1" /> {reg.email}</p>
                                <p><Phone className="w-3 h-3 inline mr-1" /> {reg.telefono}</p>
                                <p><Calendar className="w-3 h-3 inline mr-1" /> {reg.fecha_nacimiento}</p>
                                <p><Flag className="w-3 h-3 inline mr-1" /> {reg.nacionalidad}</p>
                                <p><MapPin className="w-3 h-3 inline mr-1" /> {reg.ciudad_residencia}</p>
                              </div>
                            </div>
                            <div>
                              <h4 className="font-semibold mb-2 flex items-center gap-2">
                                <Shirt className="w-4 h-4" /> Carrera
                              </h4>
                              <div className="space-y-1 text-muted-foreground">
                                <p>Personalización: <span className="font-medium text-foreground">{reg.personalizacion_camiseta}</span></p>
                                <p>Talla: {reg.talla_camiseta}</p>
                                <p>Experiencia: {reg.anos_experiencia} años</p>
                                <p>Máx. Distancia: {reg.maxima_distancia_km} km</p>
                              </div>
                            </div>
                            <div>
                              <h4 className="font-semibold mb-2 flex items-center gap-2">
                                <Heart className="w-4 h-4" /> Médico/Emergencia
                              </h4>
                              <div className="space-y-1 text-muted-foreground">
                                <p>Tipo Sangre: {reg.tipo_sangre}</p>
                                <p>Contacto: {reg.contacto_emergencia_nombre}</p>
                                <p>Tel. Emergencia: {reg.contacto_emergencia_telefono}</p>
                                {reg.condicion_medica === 'Sí' && (
                                  <p className="text-yellow-600">⚠️ Condición médica: {reg.condicion_medica_detalle}</p>
                                )}
                                {reg.alergias === 'Sí' && (
                                  <p className="text-yellow-600">⚠️ Alergias: {reg.alergias_detalle}</p>
                                )}
                              </div>
                            </div>
                          </div>
                          {reg.motivacion && (
                            <div className="mt-4 p-3 bg-background rounded border">
                              <h4 className="font-semibold text-sm mb-1">Motivación:</h4>
                              <p className="text-sm text-muted-foreground">{reg.motivacion}</p>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
            
            {filteredRegistrations.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No se encontraron pre-registros</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
