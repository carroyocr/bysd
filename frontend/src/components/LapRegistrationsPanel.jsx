import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { 
  Clock, Search, Download, Loader2, Filter, RefreshCw,
  CheckCircle, XCircle, AlertTriangle, User, Timer
} from 'lucide-react';
import { toast } from 'sonner';
import { useRaceConfig } from '../contexts/RaceConfigContext';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Action labels and colors
const ACTION_CONFIG = {
  lap_completed: { label: 'Completada', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  dnf: { label: 'DNF Manual', color: 'bg-red-100 text-red-700', icon: XCircle },
  dnf_early_return: { label: 'DNF (Temprano)', color: 'bg-orange-100 text-orange-700', icon: AlertTriangle },
  dnf_timeout: { label: 'DNF (Tiempo)', color: 'bg-red-100 text-red-700', icon: Timer }
};

export default function LapRegistrationsPanel() {
  const { raceCode, loading: configLoading } = useRaceConfig();
  const [registrations, setRegistrations] = useState([]);
  const [summary, setSummary] = useState({ total: 0, by_lap: [], by_action: {} });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  
  // Filters
  const [filters, setFilters] = useState({
    lap_number: '',
    athlete_name: '',
    scanned_by: ''
  });
  const [availableLaps, setAvailableLaps] = useState([]);
  const [availableScanners, setAvailableScanners] = useState([]);

  const token = localStorage.getItem('admin_token');

  const loadData = useCallback(async () => {
    if (!raceCode || configLoading) return;
    
    setLoading(true);
    try {
      // Build query params
      const params = new URLSearchParams();
      params.append('race_code', raceCode);
      if (filters.lap_number) params.append('lap_number', filters.lap_number);
      if (filters.athlete_name) params.append('athlete_name', filters.athlete_name);
      if (filters.scanned_by) params.append('scanned_by', filters.scanned_by);
      
      const [regsRes, summaryRes] = await Promise.all([
        fetch(`${API_URL}/api/qr-scan/lap-registrations?${params}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_URL}/api/qr-scan/lap-registrations/summary?race_code=${raceCode}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);
      
      if (regsRes.ok) {
        const data = await regsRes.json();
        setRegistrations(data.registrations || []);
        setAvailableLaps(data.available_laps || []);
        setAvailableScanners(data.available_scanners || []);
      }
      
      if (summaryRes.ok) {
        const data = await summaryRes.json();
        setSummary(data);
      }
    } catch (error) {
      console.error('Error loading lap registrations:', error);
      toast.error('Error al cargar registros de vueltas');
    } finally {
      setLoading(false);
    }
  }, [raceCode, configLoading, token, filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      params.append('race_code', raceCode);
      if (filters.lap_number) params.append('lap_number', filters.lap_number);
      if (filters.athlete_name) params.append('athlete_name', filters.athlete_name);
      if (filters.scanned_by) params.append('scanned_by', filters.scanned_by);
      
      const response = await fetch(`${API_URL}/api/qr-scan/lap-registrations/export?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `registro_vueltas_${raceCode}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        toast.success('CSV exportado correctamente');
      } else {
        throw new Error('Error al exportar');
      }
    } catch (error) {
      toast.error('Error al exportar CSV');
    } finally {
      setExporting(false);
    }
  };

  const clearFilters = () => {
    setFilters({
      lap_number: '',
      athlete_name: '',
      scanned_by: ''
    });
  };

  const formatTime = (dateStr, localStr) => {
    // Use local time string if available
    if (localStr) return localStr;
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getActionBadge = (action) => {
    const config = ACTION_CONFIG[action] || { label: action, color: 'bg-gray-100 text-gray-700', icon: Clock };
    const Icon = config.icon;
    return (
      <Badge className={`${config.color} hover:${config.color}`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  if (loading && !registrations.length) {
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
          <h2 className="text-2xl font-bold">Registro de Vueltas</h2>
          <p className="text-muted-foreground">Historial detallado de escaneos QR y vueltas completadas</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button onClick={handleExport} disabled={exporting || !registrations.length}>
            {exporting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Total Registros</p>
              <p className="text-3xl font-bold">{summary.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-green-600">Vueltas Completadas</p>
              <p className="text-3xl font-bold text-green-700">
                {summary.by_action?.lap_completed || 0}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-red-600">DNF Registrados</p>
              <p className="text-3xl font-bold text-red-700">
                {(summary.by_action?.dnf || 0) + 
                 (summary.by_action?.dnf_early_return || 0) + 
                 (summary.by_action?.dnf_timeout || 0)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-blue-600">Vueltas Registradas</p>
              <p className="text-3xl font-bold text-blue-700">
                {availableLaps.length > 0 ? Math.max(...availableLaps) : 0}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Vuelta</label>
              <select
                value={filters.lap_number}
                onChange={(e) => setFilters(prev => ({ ...prev, lap_number: e.target.value }))}
                className="w-full px-3 py-2 border rounded-md bg-background"
              >
                <option value="">Todas las vueltas</option>
                {availableLaps.map(lap => (
                  <option key={lap} value={lap}>Vuelta {lap}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-1 block">Atleta</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Buscar por nombre..."
                  value={filters.athlete_name}
                  onChange={(e) => setFilters(prev => ({ ...prev, athlete_name: e.target.value }))}
                  className="pl-9"
                />
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-1 block">Registrado por</label>
              <select
                value={filters.scanned_by}
                onChange={(e) => setFilters(prev => ({ ...prev, scanned_by: e.target.value }))}
                className="w-full px-3 py-2 border rounded-md bg-background"
              >
                <option value="">Todos los usuarios</option>
                {availableScanners.map(scanner => (
                  <option key={scanner} value={scanner}>{scanner}</option>
                ))}
              </select>
            </div>
            
            <div className="flex items-end">
              <Button variant="outline" onClick={clearFilters} className="w-full">
                Limpiar Filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Registrations Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Registros ({registrations.length})
          </CardTitle>
          <CardDescription>
            Historial de escaneos de vueltas ordenado por vuelta y hora
          </CardDescription>
        </CardHeader>
        <CardContent>
          {registrations.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No hay registros de vueltas</p>
              <p className="text-sm">Los escaneos de QR aparecerán aquí</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-3 px-3 font-medium">BIB</th>
                    <th className="text-left py-3 px-3 font-medium">Nombre</th>
                    <th className="text-center py-3 px-3 font-medium">Vuelta</th>
                    <th className="text-left py-3 px-3 font-medium">Acción</th>
                    <th className="text-center py-3 px-3 font-medium">Inicio Vuelta</th>
                    <th className="text-center py-3 px-3 font-medium">Hora Registro</th>
                    <th className="text-center py-3 px-3 font-medium">Min. en Vuelta</th>
                    <th className="text-left py-3 px-3 font-medium">Registrado Por</th>
                  </tr>
                </thead>
                <tbody>
                  {registrations.map((reg, index) => (
                    <tr key={index} className="border-b hover:bg-muted/30">
                      <td className="py-3 px-3">
                        <Badge variant="outline" className="font-mono">
                          {reg.bib}
                        </Badge>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{reg.athlete_name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="text-lg font-bold">{reg.lap_number}</span>
                      </td>
                      <td className="py-3 px-3">
                        {getActionBadge(reg.action)}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-sm">
                        {reg.lap_start_time_local || formatTime(reg.lap_start_time, null)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="font-mono text-sm">
                          {reg.scan_time_local || formatTime(reg.scan_time, null)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(reg.scan_time)}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {reg.minutes_into_lap !== undefined && reg.minutes_into_lap !== null ? (
                          <span className={`font-mono ${reg.minutes_into_lap < 35 ? 'text-orange-600' : 'text-green-600'}`}>
                            {reg.minutes_into_lap} min
                          </span>
                        ) : '-'}
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-sm text-muted-foreground">
                          {reg.scanned_by || '-'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lap Summary */}
      {summary.by_lap && summary.by_lap.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Resumen por Vuelta</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {summary.by_lap.map((lap) => (
                <div key={lap.lap} className="bg-muted/30 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Vuelta {lap.lap}</p>
                  <p className="text-xl font-bold">{lap.completed}</p>
                  <p className="text-xs text-green-600">completadas</p>
                  {lap.dnf > 0 && (
                    <p className="text-xs text-red-600 mt-1">{lap.dnf} DNF</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
