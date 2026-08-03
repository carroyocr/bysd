import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import {
  Search, Medal, Shield, RefreshCw, Loader2, Trash2, ArrowLeftRight, UserPlus
} from 'lucide-react';
import { toast } from 'sonner';
import { adminFetch } from '../lib/adminApi';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CATEGORIA_CONFIG = {
  titular: { label: 'Titular', otherLabel: 'Reserva', badgeClass: 'bg-green-100 text-green-700 hover:bg-green-100' },
  reserva: { label: 'Reserva', otherLabel: 'Titular', badgeClass: 'bg-amber-100 text-amber-700 hover:bg-amber-100' },
};

export default function SeleccionadosManagement() {
  const [seleccionados, setSeleccionados] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [selRes, resultsRes] = await Promise.all([
        adminFetch(`${API_URL}/api/seleccionados/admin`),
        adminFetch(`${API_URL}/api/athletes/admin/2026-results`),
      ]);
      if (selRes.ok) {
        const data = await selRes.json();
        setSeleccionados(data.seleccionados || []);
      }
      if (resultsRes.ok) {
        const data = await resultsRes.json();
        setCandidates(data.results || []);
      }
    } catch (err) {
      toast.error('Error cargando seleccionados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const titulares = seleccionados.filter((s) => s.categoria === 'titular');
  const reservas = seleccionados.filter((s) => s.categoria === 'reserva');

  // Atletas del evento previo que aún no están en la selección
  const availableCandidates = useMemo(() => {
    const selectedBibs = new Set(seleccionados.map((s) => s.bib));
    let data = candidates.filter((c) => !selectedBibs.has(c.bib));
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      data = data.filter(
        (c) =>
          c.bib?.toLowerCase().includes(q) ||
          c.nombre?.toLowerCase().includes(q) ||
          c.apellidos?.toLowerCase().includes(q) ||
          c.nacionalidad?.toLowerCase().includes(q)
      );
    }
    return [...data].sort((a, b) => (b.laps_completed || 0) - (a.laps_completed || 0));
  }, [candidates, seleccionados, searchTerm]);

  const handleAdd = async (candidate, categoria) => {
    setActionId(candidate.id);
    try {
      const res = await adminFetch(`${API_URL}/api/seleccionados/admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result_id: candidate.id, categoria }),
      });
      if (res.ok) {
        toast.success(`${candidate.nombre} agregado como ${CATEGORIA_CONFIG[categoria].label.toLowerCase()}`);
        loadData();
      } else {
        const data = await res.json();
        toast.error(data.detail || 'Error al agregar seleccionado');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setActionId(null);
    }
  };

  const handleToggleCategoria = async (sel) => {
    const nueva = sel.categoria === 'titular' ? 'reserva' : 'titular';
    setActionId(sel.id);
    try {
      const res = await adminFetch(`${API_URL}/api/seleccionados/admin/${sel.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoria: nueva }),
      });
      if (res.ok) {
        toast.success(`${sel.nombre} ahora es ${CATEGORIA_CONFIG[nueva].label.toLowerCase()}`);
        loadData();
      } else {
        const data = await res.json();
        toast.error(data.detail || 'Error al cambiar categoría');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setActionId(null);
    }
  };

  const handleRemove = async (sel) => {
    if (!window.confirm(`¿Quitar a ${sel.nombre} ${sel.apellidos} de la selección?`)) return;
    setActionId(sel.id);
    try {
      const res = await adminFetch(`${API_URL}/api/seleccionados/admin/${sel.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success('Seleccionado eliminado');
        loadData();
      } else {
        const data = await res.json();
        toast.error(data.detail || 'Error al eliminar');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setActionId(null);
    }
  };

  const SelectedList = ({ items, categoria }) => (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          {categoria === 'titular' ? (
            <Medal className="w-5 h-5 text-green-600" />
          ) : (
            <Shield className="w-5 h-5 text-amber-600" />
          )}
          {categoria === 'titular' ? 'Titulares' : 'Reservas'}
          <Badge variant="secondary">{items.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground italic px-6 pb-6">
            Todavía no hay {categoria === 'titular' ? 'titulares' : 'reservas'} seleccionados
          </p>
        ) : (
          <div className="divide-y">
            {items.map((sel) => (
              <div key={sel.id} className="px-4 py-3 flex items-center justify-between gap-3" data-testid={`seleccionado-${sel.bib}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono font-semibold text-sm w-10 shrink-0">{sel.bib}</span>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{sel.nombre} {sel.apellidos}</div>
                    <div className="text-xs text-muted-foreground">
                      {sel.laps_completed} vueltas
                      {sel.sexo ? ` · ${sel.sexo === 'Femenino' ? 'F' : 'M'}` : ''}
                      {sel.nacionalidad ? ` · ${sel.nacionalidad}` : ''}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleCategoria(sel)}
                    disabled={actionId === sel.id}
                    title={`Cambiar a ${CATEGORIA_CONFIG[sel.categoria].otherLabel}`}
                    data-testid={`toggle-categoria-${sel.bib}`}
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                    <span className="ml-1 hidden md:inline text-xs">
                      A {CATEGORIA_CONFIG[sel.categoria].otherLabel.toLowerCase()}
                    </span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleRemove(sel)}
                    disabled={actionId === sel.id}
                    data-testid={`remove-seleccionado-${sel.bib}`}
                  >
                    {actionId === sel.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12" data-testid="seleccionados-loading">
        <Loader2 className="w-6 h-6 animate-spin text-[#E8772E]" />
        <span className="ml-2">Cargando seleccionados...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="seleccionados-management">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Seleccionados — Campeonato Mundial por Equipos</h2>
        <p className="text-muted-foreground">
          Gestiona los titulares y reservas del campeonato a partir de los atletas del evento previo (BYSD-2026)
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-green-700" data-testid="stat-titulares">{titulares.length}</div>
            <div className="text-sm text-green-600">Titulares</div>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-amber-700" data-testid="stat-reservas">{reservas.length}</div>
            <div className="text-sm text-amber-600">Reservas</div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-blue-700" data-testid="stat-total">{seleccionados.length}</div>
            <div className="text-sm text-blue-600">Total Seleccionados</div>
          </CardContent>
        </Card>
      </div>

      {/* Selected lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <SelectedList items={titulares} categoria="titular" />
        <SelectedList items={reservas} categoria="reserva" />
      </div>

      {/* Candidates from previous event */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-[#E8772E]" />
              Atletas del Evento Previo (BYSD-2026)
            </CardTitle>
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por BIB, nombre o nacionalidad..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="candidates-search"
            />
          </div>

          <div className="text-sm text-muted-foreground">
            {availableCandidates.length} atleta{availableCandidates.length !== 1 ? 's' : ''} disponible{availableCandidates.length !== 1 ? 's' : ''} (ordenados por vueltas)
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm" data-testid="candidates-table">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">BIB</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Atleta</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vueltas</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sexo</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Seleccionar como</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {availableCandidates.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50" data-testid={`candidate-${c.bib}`}>
                    <td className="px-3 py-2.5 font-mono font-semibold">{c.bib}</td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium">{c.nombre} {c.apellidos}</div>
                      <div className="text-xs text-gray-400">{c.nacionalidad}</div>
                    </td>
                    <td className="px-3 py-2.5 font-semibold">{c.laps_completed}</td>
                    <td className="px-3 py-2.5">
                      <Badge variant="outline" className="text-xs">
                        {c.sexo === 'Femenino' ? 'F' : c.sexo === 'Masculino' ? 'M' : '-'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-700 border-green-300 hover:bg-green-50"
                          onClick={() => handleAdd(c, 'titular')}
                          disabled={actionId === c.id}
                          data-testid={`add-titular-${c.bib}`}
                        >
                          <Medal className="w-3.5 h-3.5 mr-1" />
                          Titular
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-amber-700 border-amber-300 hover:bg-amber-50"
                          onClick={() => handleAdd(c, 'reserva')}
                          disabled={actionId === c.id}
                          data-testid={`add-reserva-${c.bib}`}
                        >
                          <Shield className="w-3.5 h-3.5 mr-1" />
                          Reserva
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {availableCandidates.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-gray-400">
                      {candidates.length === 0
                        ? 'No se pudieron cargar los atletas del evento previo'
                        : 'No hay atletas disponibles con ese criterio'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
