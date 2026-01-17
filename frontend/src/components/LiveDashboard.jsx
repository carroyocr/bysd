import React, { useState, useEffect } from 'react';
import { Activity, TrendingUp, UserX, Users, MapPin, Download, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

export default function LiveDashboard() {
  const [stats, setStats] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      loadData();
    }, 30000); // Auto-refresh every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [statsRes, participantsRes] = await Promise.all([
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/stats`),
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/participants`)
      ]);

      const statsData = await statsRes.json();
      const participantsData = await participantsRes.json();

      setStats(statsData);
      setParticipants(participantsData);
      setLastUpdate(new Date());
      setLoading(false);
    } catch (err) {
      console.error('Error loading data:', err);
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['BIB', 'Nombre', 'Apellidos', 'Nacionalidad', 'Estado', 'Vueltas', 'Kilómetros', 'Retirado en Vuelta'];
    const rows = participants.map(p => [
      p.bib,
      p.nombre,
      p.apellidos,
      p.nacionalidad,
      p.status === 'active' ? 'Activo' : 'Retirado',
      p.laps_completed,
      p.total_km,
      p.retired_at_lap || '-'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `backyard-ultra-resultados-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredParticipants = participants.filter(p => {
    const matchesSearch = searchTerm === '' || 
      p.bib.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.apellidos.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || p.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  }).sort((a, b) => {
    // Sort by BIB number
    return a.bib.localeCompare(b.bib);
  });

  if (loading || !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Activity className="w-12 h-12 text-primary animate-pulse mx-auto mb-4" />
          <p className="text-lg text-muted-foreground">Cargando datos en vivo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-20 pb-12">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8 relative">
          <h1 className="font-display text-4xl sm:text-5xl text-foreground mb-2">
            Seguimiento en Vivo
          </h1>
          <p className="text-lg text-muted-foreground">
            Backyard Ultra Santo Domingo 2026
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Última actualización: {lastUpdate.toLocaleTimeString('es-DO')}
          </p>
          
          {/* Admin Access Button */}
          <a
            href="/admin/login"
            className="absolute top-0 right-0 inline-flex items-center gap-2 px-4 py-2 bg-muted hover:bg-primary/10 border border-border rounded-lg text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
          >
            <Lock className="w-4 h-4" />
            Panel Admin
          </a>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Vuelta en Curso</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{stats.current_lap}</p>
                </div>
                <Activity className="w-10 h-10 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-700">Vueltas Completadas</p>
                  <p className="text-3xl font-bold text-green-900 mt-1">{stats.total_laps_completed}</p>
                </div>
                <TrendingUp className="w-10 h-10 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-700">Atletas Activos</p>
                  <p className="text-3xl font-bold text-blue-900 mt-1">{stats.athletes_active}</p>
                </div>
                <Users className="w-10 h-10 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-700">DNF</p>
                  <p className="text-3xl font-bold text-red-900 mt-1">{stats.athletes_dnf}</p>
                </div>
                <UserX className="w-10 h-10 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-700">DNS</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{stats.athletes_dns}</p>
                </div>
                <UserX className="w-10 h-10 text-gray-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-700">Km del Evento</p>
                  <p className="text-3xl font-bold text-purple-900 mt-1">{stats.total_km}</p>
                </div>
                <MapPin className="w-10 h-10 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-orange-700">Km Totales</p>
                  <p className="text-3xl font-bold text-orange-900 mt-1">{stats.total_km_all_athletes}</p>
                </div>
                <TrendingUp className="w-10 h-10 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Participants Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <CardTitle className="text-2xl">Clasificación de Participantes</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {filteredParticipants.length} participantes
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <Input
                  type="text"
                  placeholder="Buscar por BIB o nombre..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="md:w-64"
                />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-4 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="all">Todos</option>
                  <option value="active">Activos</option>
                  <option value="retired">Retirados</option>
                  <option value="dns">DNS</option>
                </select>
                <Button
                  onClick={exportToCSV}
                  variant="outline"
                  className="border-primary/30 hover:bg-primary/10"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Exportar CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-semibold text-sm">BIB</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm">Nombre</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm">Nacionalidad</th>
                    <th className="text-center py-3 px-4 font-semibold text-sm">Estado</th>
                    <th className="text-center py-3 px-4 font-semibold text-sm">Vueltas</th>
                    <th className="text-center py-3 px-4 font-semibold text-sm">Kilómetros</th>
                    <th className="text-center py-3 px-4 font-semibold text-sm">Retirado en</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredParticipants.map((participant) => (
                    <tr
                      key={participant.bib}
                      className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="font-mono">
                          {participant.bib}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-foreground">{participant.nombre}</p>
                          <p className="text-sm text-muted-foreground">{participant.apellidos}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="secondary" className="text-xs">
                          {participant.nacionalidad}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge
                          className={
                            participant.status === 'active' 
                              ? 'bg-green-500' 
                              : participant.status === 'dns'
                              ? 'bg-gray-500'
                              : 'bg-red-500'
                          }
                        >
                          {participant.status === 'active' 
                            ? 'Activo' 
                            : participant.status === 'dns'
                            ? 'DNS'
                            : 'Retirado'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-bold text-lg">{participant.laps_completed}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-semibold">{participant.total_km} km</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {participant.retired_at_lap ? (
                          <Badge variant="outline">Vuelta {participant.retired_at_lap}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
