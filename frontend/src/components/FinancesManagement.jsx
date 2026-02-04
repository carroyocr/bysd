import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { 
  DollarSign, TrendingUp, TrendingDown, Plus, Trash2, Edit, 
  Save, X, Calendar, FileText, Loader2, Wallet, CreditCard,
  CheckCircle, Clock, AlertCircle, ChevronDown, ChevronUp, Receipt
} from 'lucide-react';
import { toast } from 'sonner';
import { useRaceConfig } from '../contexts/RaceConfigContext';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Payment status options
const PAYMENT_STATUS = {
  pendiente: { label: 'Pendiente', color: 'bg-amber-100 text-amber-700', icon: Clock },
  parcial: { label: 'Parcialmente Pagado', color: 'bg-blue-100 text-blue-700', icon: AlertCircle },
  pagado: { label: 'Pagado', color: 'bg-green-100 text-green-700', icon: CheckCircle }
};

// Payment methods options
const PAYMENT_METHODS = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia Bancaria',
  tarjeta: 'Tarjeta de Crédito/Débito',
  cheque: 'Cheque',
  paypal: 'PayPal',
  otro: 'Otro'
};

export default function FinancesManagement() {
  const { raceCode, loading: configLoading } = useRaceConfig();
  const [movements, setMovements] = useState([]);
  const [summary, setSummary] = useState({ 
    total_ingresos: 0, 
    total_gastos: 0, 
    saldo: 0,
    gastos_pendientes: 0,
    gastos_pagados: 0 
  });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);
  const [showPartialPaymentForm, setShowPartialPaymentForm] = useState(null);
  const [showProgressDashboard, setShowProgressDashboard] = useState(true);
  
  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    tipo: 'gasto',
    detalle: '',
    monto: '',
    estado_pago: 'pendiente',
    metodo_pago: '',
    referencia_pago: '',
    proveedor: ''
  });

  const [partialPaymentData, setPartialPaymentData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    monto: '',
    metodo_pago: 'transferencia',
    referencia: '',
    notas: ''
  });

  const token = localStorage.getItem('admin_token');

  const loadData = useCallback(async () => {
    if (!raceCode || configLoading) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/finances/movements/${raceCode}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setMovements(data.movements || []);
        setSummary(data.summary || { 
          total_ingresos: 0, 
          total_gastos: 0, 
          saldo: 0,
          gastos_pendientes: 0,
          gastos_pagados: 0
        });
      }
    } catch (error) {
      console.error('Error loading finances:', error);
      toast.error('Error al cargar los movimientos financieros');
    } finally {
      setLoading(false);
    }
  }, [raceCode, configLoading, token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetForm = () => {
    setFormData({
      fecha: new Date().toISOString().split('T')[0],
      tipo: 'gasto',
      detalle: '',
      monto: '',
      estado_pago: 'pendiente',
      metodo_pago: '',
      referencia_pago: '',
      proveedor: ''
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.detalle.trim()) {
      toast.error('Por favor ingrese un detalle');
      return;
    }
    
    if (!formData.monto || parseFloat(formData.monto) <= 0) {
      toast.error('Por favor ingrese un monto válido');
      return;
    }
    
    setSaving(true);
    try {
      const url = editingId 
        ? `${API_URL}/api/finances/movements/${editingId}`
        : `${API_URL}/api/finances/movements`;
      
      const method = editingId ? 'PUT' : 'POST';
      
      const payload = {
        ...formData,
        monto: parseFloat(formData.monto),
        race_code: raceCode
      };
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Error al guardar');
      }
      
      toast.success(editingId ? 'Movimiento actualizado' : 'Movimiento registrado');
      resetForm();
      loadData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (movement) => {
    setFormData({
      fecha: movement.fecha,
      tipo: movement.tipo,
      detalle: movement.detalle,
      monto: movement.monto.toString(),
      estado_pago: movement.estado_pago || 'pendiente',
      metodo_pago: movement.metodo_pago || '',
      referencia_pago: movement.referencia_pago || '',
      proveedor: movement.proveedor || ''
    });
    setEditingId(movement.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Está seguro de eliminar este movimiento?')) return;
    
    try {
      const response = await fetch(`${API_URL}/api/finances/movements/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Error al eliminar');
      
      toast.success('Movimiento eliminado');
      loadData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleAddPartialPayment = async (movementId) => {
    if (!partialPaymentData.monto || parseFloat(partialPaymentData.monto) <= 0) {
      toast.error('Ingrese un monto válido');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/finances/movements/${movementId}/partial-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...partialPaymentData,
          monto: parseFloat(partialPaymentData.monto)
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Error al registrar pago');
      }

      toast.success('Pago parcial registrado');
      setShowPartialPaymentForm(null);
      setPartialPaymentData({
        fecha: new Date().toISOString().split('T')[0],
        monto: '',
        metodo_pago: 'transferencia',
        referencia: '',
        notas: ''
      });
      loadData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePartialPayment = async (movementId, paymentId) => {
    if (!window.confirm('¿Eliminar este pago parcial?')) return;

    try {
      const response = await fetch(
        `${API_URL}/api/finances/movements/${movementId}/partial-payment/${paymentId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (!response.ok) throw new Error('Error al eliminar');

      toast.success('Pago parcial eliminado');
      loadData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleMarkAsPaid = async (movement) => {
    try {
      const response = await fetch(`${API_URL}/api/finances/movements/${movement.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ estado_pago: 'pagado' })
      });

      if (!response.ok) throw new Error('Error al actualizar');

      toast.success('Gasto marcado como pagado');
      loadData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: 'DOP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount).replace('DOP', 'RD$');
  };

  const getStatusBadge = (status) => {
    const statusInfo = PAYMENT_STATUS[status] || PAYMENT_STATUS.pendiente;
    const Icon = statusInfo.icon;
    return (
      <Badge className={`${statusInfo.color} hover:${statusInfo.color}`}>
        <Icon className="w-3 h-3 mr-1" />
        {statusInfo.label}
      </Badge>
    );
  };

  if (loading && !movements.length) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Presupuesto</h2>
          <p className="text-muted-foreground">Control de ingresos y gastos del evento</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">Total Ingresos</p>
                <p className="text-2xl font-bold text-green-700">{formatCurrency(summary.total_ingresos)}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-red-50 border-red-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600 font-medium">Total Gastos</p>
                <p className="text-2xl font-bold text-red-700">{formatCurrency(summary.total_gastos)}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-full">
                <TrendingDown className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-600 font-medium">Gastos Pendientes</p>
                <p className="text-2xl font-bold text-amber-700">{formatCurrency(summary.gastos_pendientes || 0)}</p>
              </div>
              <div className="p-3 bg-amber-100 rounded-full">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className={`${summary.saldo >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${summary.saldo >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                  Saldo Disponible
                </p>
                <p className={`text-2xl font-bold ${summary.saldo >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                  {formatCurrency(summary.saldo)}
                </p>
              </div>
              <div className={`p-3 rounded-full ${summary.saldo >= 0 ? 'bg-blue-100' : 'bg-orange-100'}`}>
                <Wallet className={`w-6 h-6 ${summary.saldo >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Progress Dashboard */}
      {summary.total_gastos > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Receipt className="w-5 h-5" />
                  Progreso de Pagos
                  <Badge variant="outline" className="ml-2 font-normal">
                    {summary.total_gastos > 0 
                      ? Math.round(((summary.gastos_pagados || 0) / summary.total_gastos) * 100) 
                      : 0}% liquidado
                  </Badge>
                </CardTitle>
                <CardDescription>Estado de liquidación de gastos del evento</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowProgressDashboard(!showProgressDashboard)}
                className="h-8 w-8 p-0"
              >
                {showProgressDashboard ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </Button>
            </div>
          </CardHeader>
          {showProgressDashboard && (
            <CardContent>
              <div className="space-y-6">
                {/* Main Progress Bar */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Gastos Liquidados</span>
                    <span className="text-sm font-bold">
                      {summary.total_gastos > 0 
                        ? Math.round(((summary.gastos_pagados || 0) / summary.total_gastos) * 100) 
                        : 0}%
                    </span>
                  </div>
                  <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full transition-all duration-500"
                      style={{ 
                        width: `${summary.total_gastos > 0 
                          ? Math.min(100, ((summary.gastos_pagados || 0) / summary.total_gastos) * 100) 
                          : 0}%` 
                      }}
                    />
                  </div>
                </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Total Gastos</p>
                  <p className="text-lg font-bold">{formatCurrency(summary.total_gastos)}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <p className="text-xs text-green-600 mb-1">Pagado</p>
                  <p className="text-lg font-bold text-green-700">{formatCurrency(summary.gastos_pagados || 0)}</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-4 text-center">
                  <p className="text-xs text-amber-600 mb-1">Pendiente</p>
                  <p className="text-lg font-bold text-amber-700">{formatCurrency(summary.gastos_pendientes || 0)}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <p className="text-xs text-blue-600 mb-1">Pagos Parciales</p>
                  <p className="text-lg font-bold text-blue-700">{formatCurrency(summary.total_pagos_parciales || 0)}</p>
                </div>
              </div>

              {/* Status Breakdown */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-3">Desglose por Estado</h4>
                <div className="space-y-2">
                  {(() => {
                    const gastos = movements.filter(m => m.tipo === 'gasto');
                    const pagados = gastos.filter(m => m.estado_pago === 'pagado').length;
                    const parciales = gastos.filter(m => m.estado_pago === 'parcial').length;
                    const pendientes = gastos.filter(m => m.estado_pago === 'pendiente' || !m.estado_pago).length;
                    const total = gastos.length;
                    
                    return (
                      <>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2 w-32">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="text-sm">Pagados</span>
                          </div>
                          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-green-500 rounded-full"
                              style={{ width: `${total > 0 ? (pagados / total) * 100 : 0}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium w-16 text-right">{pagados} de {total}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2 w-32">
                            <AlertCircle className="w-4 h-4 text-blue-600" />
                            <span className="text-sm">Parciales</span>
                          </div>
                          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${total > 0 ? (parciales / total) * 100 : 0}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium w-16 text-right">{parciales} de {total}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2 w-32">
                            <Clock className="w-4 h-4 text-amber-600" />
                            <span className="text-sm">Pendientes</span>
                          </div>
                          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-amber-500 rounded-full"
                              style={{ width: `${total > 0 ? (pendientes / total) * 100 : 0}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium w-16 text-right">{pendientes} de {total}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          </CardContent>
          )}
        </Card>
      )}

      {/* Add Movement Form */}
      {showForm ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              {editingId ? 'Editar Movimiento' : 'Nuevo Movimiento'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fecha">Fecha</Label>
                  <Input
                    id="fecha"
                    type="date"
                    value={formData.fecha}
                    onChange={(e) => setFormData(prev => ({ ...prev, fecha: e.target.value }))}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo</Label>
                  <select
                    id="tipo"
                    value={formData.tipo}
                    onChange={(e) => setFormData(prev => ({ ...prev, tipo: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                    required
                  >
                    <option value="ingreso">Ingreso</option>
                    <option value="gasto">Gasto</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="monto">Monto (RD$)</Label>
                  <Input
                    id="monto"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formData.monto}
                    onChange={(e) => setFormData(prev => ({ ...prev, monto: e.target.value }))}
                    required
                  />
                </div>
                
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="detalle">Detalle / Concepto</Label>
                  <Input
                    id="detalle"
                    type="text"
                    placeholder="Descripción del movimiento..."
                    value={formData.detalle}
                    onChange={(e) => setFormData(prev => ({ ...prev, detalle: e.target.value }))}
                    required
                  />
                </div>

                {formData.tipo === 'gasto' && (
                  <div className="space-y-2">
                    <Label htmlFor="proveedor">Proveedor (opcional)</Label>
                    <Input
                      id="proveedor"
                      type="text"
                      placeholder="Nombre del proveedor"
                      value={formData.proveedor}
                      onChange={(e) => setFormData(prev => ({ ...prev, proveedor: e.target.value }))}
                    />
                  </div>
                )}
              </div>
              
              {/* Payment status section - only for expenses */}
              {formData.tipo === 'gasto' && (
                <div className="border-t pt-4 mt-4">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Estado del Pago
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="estado_pago">Estado</Label>
                      <select
                        id="estado_pago"
                        value={formData.estado_pago}
                        onChange={(e) => setFormData(prev => ({ ...prev, estado_pago: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-md bg-background"
                      >
                        {Object.entries(PAYMENT_STATUS).map(([key, { label }]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="metodo_pago">Método de Pago</Label>
                      <select
                        id="metodo_pago"
                        value={formData.metodo_pago}
                        onChange={(e) => setFormData(prev => ({ ...prev, metodo_pago: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-md bg-background"
                      >
                        <option value="">Seleccionar...</option>
                        {Object.entries(PAYMENT_METHODS).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="referencia_pago">Referencia/Número</Label>
                      <Input
                        id="referencia_pago"
                        type="text"
                        placeholder="# de transferencia, cheque, etc."
                        value={formData.referencia_pago}
                        onChange={(e) => setFormData(prev => ({ ...prev, referencia_pago: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={resetForm}>
                  <X className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Guardando...</>
                  ) : (
                    <><Save className="w-4 h-4 mr-2" /> {editingId ? 'Actualizar' : 'Guardar'}</>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Button onClick={() => setShowForm(true)} className="w-full md:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          Agregar Movimiento
        </Button>
      )}

      {/* Movements Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Movimientos ({movements.length})
          </CardTitle>
          <CardDescription>
            Registro de ingresos y gastos del evento
          </CardDescription>
        </CardHeader>
        <CardContent>
          {movements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No hay movimientos registrados</p>
              <p className="text-sm">Los pagos confirmados se registrarán automáticamente</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 w-8"></th>
                    <th className="text-left py-3 px-2">Fecha</th>
                    <th className="text-left py-3 px-2">Tipo</th>
                    <th className="text-left py-3 px-2">Detalle</th>
                    <th className="text-left py-3 px-2">Estado</th>
                    <th className="text-right py-3 px-2">Monto</th>
                    <th className="text-right py-3 px-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((movement) => (
                    <React.Fragment key={movement.id}>
                      <tr className={`border-b hover:bg-muted/50 ${expandedRow === movement.id ? 'bg-muted/30' : ''}`}>
                        <td className="py-3 px-2">
                          {movement.tipo === 'gasto' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={() => setExpandedRow(expandedRow === movement.id ? null : movement.id)}
                            >
                              {expandedRow === movement.id ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            {movement.fecha}
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          {movement.tipo === 'ingreso' ? (
                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                              <TrendingUp className="w-3 h-3 mr-1" />
                              Ingreso
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                              <TrendingDown className="w-3 h-3 mr-1" />
                              Gasto
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 px-2">
                          <div>
                            <span className="text-sm font-medium">{movement.detalle}</span>
                            {movement.proveedor && (
                              <span className="text-xs text-muted-foreground block">
                                Proveedor: {movement.proveedor}
                              </span>
                            )}
                          </div>
                          {movement.auto_generated && (
                            <Badge variant="outline" className="ml-2 text-xs">Auto</Badge>
                          )}
                        </td>
                        <td className="py-3 px-2">
                          {movement.tipo === 'gasto' ? (
                            <div className="space-y-1">
                              {getStatusBadge(movement.estado_pago || 'pendiente')}
                              {movement.estado_pago === 'parcial' && (
                                <div className="text-xs text-muted-foreground">
                                  Pagado: {formatCurrency(movement.monto_pagado || 0)}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </td>
                        <td className={`py-3 px-2 text-right font-mono font-semibold ${
                          movement.tipo === 'ingreso' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {movement.tipo === 'ingreso' ? '+' : '-'}{formatCurrency(movement.monto)}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <div className="flex justify-end gap-1">
                            {movement.tipo === 'gasto' && movement.estado_pago !== 'pagado' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() => handleMarkAsPaid(movement)}
                                title="Marcar como pagado"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(movement)}
                              disabled={movement.auto_generated}
                              title={movement.auto_generated ? 'Los movimientos automáticos no se pueden editar' : 'Editar'}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDelete(movement.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                      
                      {/* Expanded row for expense details */}
                      {expandedRow === movement.id && movement.tipo === 'gasto' && (
                        <tr>
                          <td colSpan="7" className="bg-muted/20 p-4">
                            <div className="space-y-4">
                              {/* Payment info */}
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Método de pago:</span>
                                  <span className="ml-2 font-medium">
                                    {movement.metodo_pago ? PAYMENT_METHODS[movement.metodo_pago] : 'No especificado'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Referencia:</span>
                                  <span className="ml-2 font-medium">{movement.referencia_pago || '-'}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Pendiente:</span>
                                  <span className="ml-2 font-medium text-amber-600">
                                    {formatCurrency(movement.monto - (movement.monto_pagado || 0))}
                                  </span>
                                </div>
                              </div>

                              {/* Partial payments list */}
                              {movement.pagos_parciales && movement.pagos_parciales.length > 0 && (
                                <div>
                                  <h5 className="font-medium mb-2 flex items-center gap-2">
                                    <Receipt className="w-4 h-4" />
                                    Historial de Pagos ({movement.pagos_parciales.length})
                                  </h5>
                                  <div className="bg-background rounded-lg overflow-hidden">
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="border-b bg-muted/50">
                                          <th className="text-left py-2 px-3">Fecha</th>
                                          <th className="text-left py-2 px-3">Método</th>
                                          <th className="text-left py-2 px-3">Referencia</th>
                                          <th className="text-right py-2 px-3">Monto</th>
                                          <th className="text-right py-2 px-3 w-16"></th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {movement.pagos_parciales.map((pago) => (
                                          <tr key={pago.id} className="border-b">
                                            <td className="py-2 px-3">{pago.fecha}</td>
                                            <td className="py-2 px-3">{PAYMENT_METHODS[pago.metodo_pago] || pago.metodo_pago}</td>
                                            <td className="py-2 px-3">{pago.referencia || '-'}</td>
                                            <td className="py-2 px-3 text-right font-mono text-green-600">
                                              {formatCurrency(pago.monto)}
                                            </td>
                                            <td className="py-2 px-3 text-right">
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-6 w-6 p-0 text-red-500"
                                                onClick={() => handleDeletePartialPayment(movement.id, pago.id)}
                                              >
                                                <X className="w-3 h-3" />
                                              </Button>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}

                              {/* Add partial payment form */}
                              {movement.estado_pago !== 'pagado' && (
                                <div>
                                  {showPartialPaymentForm === movement.id ? (
                                    <div className="bg-background p-4 rounded-lg border">
                                      <h5 className="font-medium mb-3">Registrar Pago Parcial</h5>
                                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                                        <div>
                                          <Label className="text-xs">Fecha</Label>
                                          <Input
                                            type="date"
                                            value={partialPaymentData.fecha}
                                            onChange={(e) => setPartialPaymentData(prev => ({ ...prev, fecha: e.target.value }))}
                                            className="h-9"
                                          />
                                        </div>
                                        <div>
                                          <Label className="text-xs">Monto</Label>
                                          <Input
                                            type="number"
                                            step="0.01"
                                            placeholder="0.00"
                                            value={partialPaymentData.monto}
                                            onChange={(e) => setPartialPaymentData(prev => ({ ...prev, monto: e.target.value }))}
                                            className="h-9"
                                          />
                                        </div>
                                        <div>
                                          <Label className="text-xs">Método</Label>
                                          <select
                                            value={partialPaymentData.metodo_pago}
                                            onChange={(e) => setPartialPaymentData(prev => ({ ...prev, metodo_pago: e.target.value }))}
                                            className="w-full h-9 px-3 border rounded-md bg-background text-sm"
                                          >
                                            {Object.entries(PAYMENT_METHODS).map(([key, label]) => (
                                              <option key={key} value={key}>{label}</option>
                                            ))}
                                          </select>
                                        </div>
                                        <div>
                                          <Label className="text-xs">Referencia</Label>
                                          <Input
                                            type="text"
                                            placeholder="# transferencia"
                                            value={partialPaymentData.referencia}
                                            onChange={(e) => setPartialPaymentData(prev => ({ ...prev, referencia: e.target.value }))}
                                            className="h-9"
                                          />
                                        </div>
                                      </div>
                                      <div className="flex gap-2 mt-3">
                                        <Button
                                          size="sm"
                                          onClick={() => handleAddPartialPayment(movement.id)}
                                          disabled={saving}
                                        >
                                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                                          Guardar Pago
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => setShowPartialPaymentForm(null)}
                                        >
                                          Cancelar
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setShowPartialPaymentForm(movement.id)}
                                    >
                                      <Plus className="w-4 h-4 mr-1" />
                                      Agregar Pago Parcial
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
