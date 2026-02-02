import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { 
  DollarSign, TrendingUp, TrendingDown, Plus, Trash2, Edit, 
  Save, X, Calendar, FileText, Loader2, Wallet
} from 'lucide-react';
import { toast } from 'sonner';
import { useRaceConfig } from '../contexts/RaceConfigContext';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function FinancesManagement() {
  const { raceCode, loading: configLoading } = useRaceConfig();
  const [movements, setMovements] = useState([]);
  const [summary, setSummary] = useState({ total_ingresos: 0, total_gastos: 0, saldo: 0 });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    tipo: 'ingreso',
    detalle: '',
    monto: ''
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
        setSummary(data.summary || { total_ingresos: 0, total_gastos: 0, saldo: 0 });
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
      tipo: 'ingreso',
      detalle: '',
      monto: ''
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
      monto: movement.monto.toString()
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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: 'DOP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount).replace('DOP', 'RD$');
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="detalle">Detalle</Label>
                  <Input
                    id="detalle"
                    type="text"
                    placeholder="Descripción del movimiento..."
                    value={formData.detalle}
                    onChange={(e) => setFormData(prev => ({ ...prev, detalle: e.target.value }))}
                    required
                  />
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
              </div>
              
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
                    <th className="text-left py-3 px-2">Fecha</th>
                    <th className="text-left py-3 px-2">Tipo</th>
                    <th className="text-left py-3 px-2">Detalle</th>
                    <th className="text-right py-3 px-2">Monto</th>
                    <th className="text-right py-3 px-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((movement) => (
                    <tr key={movement.id} className="border-b hover:bg-muted/50">
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
                        <span className="text-sm">{movement.detalle}</span>
                        {movement.auto_generated && (
                          <Badge variant="outline" className="ml-2 text-xs">Auto</Badge>
                        )}
                      </td>
                      <td className={`py-3 px-2 text-right font-mono font-semibold ${
                        movement.tipo === 'ingreso' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {movement.tipo === 'ingreso' ? '+' : '-'}{formatCurrency(movement.monto)}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <div className="flex justify-end gap-1">
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
