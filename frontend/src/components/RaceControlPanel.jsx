import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Save, AlertCircle, CheckCircle2, Search, RotateCw, AlertTriangle, Trash2, Clock, ChevronLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';

export default function RaceControlPanel() {
  const [currentLap, setCurrentLap] = useState(1);
  const [participants, setParticipants] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [message, setMessage] = useState(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState('');
  const [resetting, setResetting] = useState(false);
  const navigate = useNavigate();

  // Race starts at 9:00 AM, each lap is 1 hour
  const RACE_START_HOUR = 9;

  // Calculate the time range for a given lap
  const getLapTimeRange = (lap) => {
    const startHour = RACE_START_HOUR + (lap - 1);
    const endHour = startHour;
    
    // Format hours
    const formatHour = (hour) => {
      const h = hour % 24;
      const period = h >= 12 ? 'PM' : 'AM';
      const displayHour = h > 12 ? h - 12 : (h === 0 ? 12 : h);
      return `${displayHour}:00 ${period}`;
    };

    const formatEndHour = (hour) => {
      const h = hour % 24;
      const period = h >= 12 ? 'PM' : 'AM';
      const displayHour = h > 12 ? h - 12 : (h === 0 ? 12 : h);
      return `${displayHour}:59 ${period}`;
    };
    
    return {
      start: formatHour(startHour),
      end: formatEndHour(endHour)
    };
  };

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
    setSaving(true);
    
    try {
      // First, complete the lap for all active participants
      const completeLapRes = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/complete-lap-all-active`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!completeLapRes.ok) throw new Error('Error al completar vuelta');
      
      const completeLapData = await completeLapRes.json();
      
      // Update current lap to the new value
      setCurrentLap(completeLapData.new_lap);
      
      showMessage(
        `Vuelta ${completeLapData.previous_lap} completada. ${completeLapData.updated_count} atletas activos registrados. Vuelta en curso: ${completeLapData.new_lap}`,
        'success'
      );
      
      // Reload data to show updated stats
      await loadData();
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRevertLap = async () => {
    if (currentLap <= 1) {
      showMessage('No se puede retroceder más. Ya está en la vuelta 1.', 'error');
      return;
    }

    const confirmRevert = window.confirm(
      `⚠️ ADVERTENCIA: ¿Está seguro de retroceder a la vuelta ${currentLap - 1}?\n\n` +
      `Esto reducirá en 1 las vueltas completadas de todos los atletas activos.\n\n` +
      `Use esto SOLO para corregir errores si avanzó la vuelta por equivocación.`
    );

    if (!confirmRevert) return;

    const token = localStorage.getItem('admin_token');
    setReverting(true);

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/revert-lap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Error al retroceder vuelta');
      }

      const data = await response.json();
      setCurrentLap(data.new_lap);
      showMessage(data.message, 'success');
      await loadData();
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setReverting(false);
    }
  };

  const handleToggleRetired = async (participant) => {
    const token = localStorage.getItem('admin_token');
    setSaving(true);

    try {
      if (participant.status === 'active') {
        // Marking as retired
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

        if (!response.ok) throw new Error('Error al marcar como DNF');
        const data = await response.json();
        showMessage(data.message, 'success');
      } else {
        // Reactivating - show warning
        const confirmReactivate = window.confirm(
          `⚠️ ADVERTENCIA: ¿Está seguro de reactivar al participante ${participant.bib}?\n\n` +
          `Esto es SOLO para corregir errores. El atleta fue marcado como ${participant.status === 'dns' ? 'DNS' : `DNF en la vuelta ${participant.retired_at_lap}`}.\n\n` +
          `Los atletas DNF/DNS NO deben volver a competir según las reglas del Backyard Ultra.`
        );

        if (!confirmReactivate) {
          setSaving(false);
          return;
        }

        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/reactivate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ bib: participant.bib })
        });

        if (!response.ok) throw new Error('Error al reactivar');
        const data = await response.json();
        showMessage(data.message, 'success');
      }

      await loadData();
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkDNS = async (participant) => {
    const token = localStorage.getItem('admin_token');
    
    const confirmDNS = window.confirm(
      `¿Está seguro de marcar al participante ${participant.bib} como DNS (No se presentó)?\n\n` +
      `El atleta quedará con 0 vueltas y 0 kilómetros.`
    );

    if (!confirmDNS) return;

    setSaving(true);

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/mark-dns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ bib: participant.bib })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Error al marcar como DNS');
      }

      const data = await response.json();
      showMessage(data.message, 'success');
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

  const handleResetDatabase = async () => {
    if (resetConfirmation !== 'REINICIO') {
      showMessage('Debe escribir REINICIO para confirmar', 'error');
      return;
    }

    const token = localStorage.getItem('admin_token');
    setResetting(true);

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race/reset-database`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ confirmation: resetConfirmation })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Error al reiniciar base de datos');
      }

      const data = await response.json();
      showMessage(data.message, 'success');
      setShowResetModal(false);
      setResetConfirmation('');
      
      // Reload data
      await loadData();
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setResetting(false);
    }
  };

  const filteredParticipants = participants.filter(p => {
    const search = searchTerm.toLowerCase();
    const matchesSearch = (
      p.bib.toLowerCase().includes(search) ||
      p.nombre.toLowerCase().includes(search) ||
      p.apellidos.toLowerCase().includes(search)
    );
    const matchesStatus = filterStatus === 'all' || p.status === filterStatus;
    return matchesSearch && matchesStatus;
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
          <div className="flex gap-2">
            <Button
              onClick={() => setShowResetModal(true)}
              variant="outline"
              className="border-orange-300 text-orange-600 hover:bg-orange-50"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Reiniciar BD
            </Button>
            <Button
              onClick={handleLogout}
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar Sesión
            </Button>
          </div>
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
            <CardTitle>Control de Vuelta</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Al guardar, se registrará la vuelta actual para todos los atletas activos y se incrementará a la siguiente vuelta
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1">
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Vuelta en Curso
                </label>
                <div className="text-center p-6 bg-muted/30 rounded-lg border-2 border-primary/20">
                  <p className="text-5xl font-bold text-primary">{currentLap}</p>
                </div>
              </div>
              <Button
                onClick={handleSaveCurrentLap}
                disabled={saving}
                className="bg-primary hover:bg-accent text-primary-foreground h-12 px-8"
              >
                <Save className="w-5 h-5 mr-2" />
                {saving ? 'Guardando...' : 'Completar Vuelta y Avanzar'}
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
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <div className="relative flex-1 md:w-80">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Buscar por BIB, nombre o apellidos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-4 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="all">Todos ({participants.length})</option>
                  <option value="active">Activos ({participants.filter(p => p.status === 'active').length})</option>
                  <option value="retired">DNF ({participants.filter(p => p.status === 'retired').length})</option>
                  <option value="dns">DNS ({participants.filter(p => p.status === 'dns').length})</option>
                </select>
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
                            : 'DNF'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-center gap-2 flex-wrap">
                          {participant.status === 'active' && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleCompleteLap(participant)}
                                disabled={saving}
                                className="bg-primary hover:bg-accent"
                              >
                                Registrar Vuelta
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleToggleRetired(participant)}
                                disabled={saving}
                                className="border-red-500 text-red-600"
                              >
                                Marcar DNF
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleMarkDNS(participant)}
                                disabled={saving}
                                className="border-gray-500 text-gray-600"
                              >
                                Marcar DNS
                              </Button>
                            </>
                          )}
                          {(participant.status === 'retired' || participant.status === 'dns') && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleToggleRetired(participant)}
                              disabled={saving}
                              className="border-green-500 text-green-600"
                            >
                              Reactivar
                            </Button>
                          )}
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

      {/* Reset Database Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-lg border-orange-300 shadow-strong">
            <CardHeader className="border-b border-orange-200 bg-orange-50/50">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <CardTitle className="text-xl text-orange-900">Reiniciar Base de Datos</CardTitle>
                  <p className="text-sm text-orange-700 mt-1">Esta acción es irreversible</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <h3 className="font-semibold text-orange-900 mb-2">⚠️ Advertencia</h3>
                  <ul className="text-sm text-orange-800 space-y-1">
                    <li>• Se eliminarán todos los datos de participantes</li>
                    <li>• Se borrará el historial de vueltas</li>
                    <li>• La vuelta actual volverá a 1</li>
                    <li>• Todos los atletas volverán a estado inicial (0 vueltas)</li>
                  </ul>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Para confirmar, escriba <span className="font-bold text-orange-600">REINICIO</span>
                  </label>
                  <Input
                    type="text"
                    value={resetConfirmation}
                    onChange={(e) => setResetConfirmation(e.target.value)}
                    placeholder="Escriba REINICIO"
                    className="text-center font-mono text-lg"
                    autoFocus
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={() => {
                      setShowResetModal(false);
                      setResetConfirmation('');
                    }}
                    variant="outline"
                    className="flex-1"
                    disabled={resetting}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleResetDatabase}
                    disabled={resetConfirmation !== 'REINICIO' || resetting}
                    className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    {resetting ? (
                      <>
                        <RotateCw className="w-4 h-4 mr-2 animate-spin" />
                        Reiniciando...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Confirmar Reinicio
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
