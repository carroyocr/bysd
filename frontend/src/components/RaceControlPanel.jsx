import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Save, AlertCircle, CheckCircle2, Search, RotateCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';

export default function RaceControlPanel() {
  const [currentLap, setCurrentLap] = useState(1);
  const [participants, setParticipants] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      navigate('/admin/login');
      return;
    }
    loadData();
  }, [navigate]);

  const loadData = async () => {
    try {
      const [statsRes, participantsRes] = await Promise.all([
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/stats`),
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/participants`)
      ]);

      const stats = await statsRes.json();
      const participantsData = await participantsRes.json();

      setCurrentLap(stats.current_lap);
      setParticipants(participantsData);
      setLoading(false);
    } catch (err) {
      console.error('Error loading data:', err);
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_username');
    navigate('/admin/login');
  };

  const handleSaveCurrentLap = async () => {
    const token = localStorage.getItem('admin_token');
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/set-current-lap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ current_lap: currentLap })
      });

      if (!response.ok) throw new Error('Error al actualizar vuelta');
      showMessage('Vuelta actual actualizada', 'success');
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  const handleToggleRetired = async (participant) => {
    const token = localStorage.getItem('admin_token');
    setSaving(true);

    try {
      if (participant.status === 'active') {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/mark-retired`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ 
            bib: participant.bib,
            retired_at_lap: currentLap 
          })
        });

        if (!response.ok) throw new Error('Error al marcar como retirado');
        showMessage(`${participant.bib} marcado como retirado`, 'success');
      } else {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/reactivate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ bib: participant.bib })
        });

        if (!response.ok) throw new Error('Error al reactivar');
        showMessage(`${participant.bib} reactivado`, 'success');
      }

      await loadData();
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteLap = async (participant) => {
    const token = localStorage.getItem('admin_token');
    setSaving(true);

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/complete-lap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          bib: participant.bib,
          lap_number: currentLap
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Error al registrar vuelta');
      }

      showMessage(`Vuelta ${currentLap} registrada para ${participant.bib}`, 'success');
      await loadData();
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const filteredParticipants = participants.filter(p => {
    const search = searchTerm.toLowerCase();
    return (
      p.bib.toLowerCase().includes(search) ||
      p.nombre.toLowerCase().includes(search) ||
      p.apellidos.toLowerCase().includes(search)
    );
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RotateCw className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando panel de control...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Panel de Control de Carrera</h1>
            <p className="text-muted-foreground mt-1">Backyard Ultra Santo Domingo 2026</p>
          </div>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="border-red-300 text-red-600 hover:bg-red-50"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Cerrar Sesión
          </Button>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`mb-6 flex items-center gap-2 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <p className="text-sm font-medium">{message.text}</p>
          </div>
        )}

        {/* Current Lap Control */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Vuelta en Curso</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1">
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Número de Vuelta Actual
                </label>
                <Input
                  type="number"
                  min="1"
                  value={currentLap}
                  onChange={(e) => setCurrentLap(parseInt(e.target.value) || 1)}
                  className="text-2xl font-bold text-center"
                />
              </div>
              <Button
                onClick={handleSaveCurrentLap}
                className="bg-primary hover:bg-accent text-primary-foreground"
              >
                <Save className="w-4 h-4 mr-2" />
                Guardar Vuelta
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Participants Control */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <CardTitle>Control de Participantes</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {filteredParticipants.length} participantes
                </p>
              </div>
              <div className="w-full md:w-96">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Buscar por BIB, nombre o apellidos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
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
                    <th className="text-left py-3 px-4 font-semibold text-sm">Vueltas</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm">Estado</th>
                    <th className="text-center py-3 px-4 font-semibold text-sm">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredParticipants.map((participant) => (
                    <tr
                      key={participant.bib}
                      className="border-b border-border last:border-0 hover:bg-muted/30"
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
                        <span className="font-semibold text-lg">{participant.laps_completed}</span>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={participant.status === 'active' ? 'default' : 'secondary'}
                          className={participant.status === 'active' ? 'bg-green-500' : 'bg-red-500'}
                        >
                          {participant.status === 'active' ? 'Activo' : 'Retirado'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-center gap-2">
                          {participant.status === 'active' && (
                            <Button
                              size="sm"
                              onClick={() => handleCompleteLap(participant)}
                              disabled={saving}
                              className="bg-primary hover:bg-accent"
                            >
                              Registrar Vuelta
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggleRetired(participant)}
                            disabled={saving}
                            className={participant.status === 'retired' ? 'border-green-500 text-green-600' : 'border-red-500 text-red-600'}
                          >
                            {participant.status === 'active' ? 'Marcar Retirado' : 'Reactivar'}
                          </Button>
                        </div>
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
