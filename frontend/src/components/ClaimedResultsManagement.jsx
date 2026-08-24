import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import {
  Search, Users, UserCheck, UserX, Link2Off, Loader2,
  Download, ArrowUpDown, Trophy, Flag
} from 'lucide-react';
import { toast } from 'sonner';
import { useAdminRace } from '../contexts/AdminRaceContext';
import RaceSelector from './RaceSelector';
import { adminFetch } from '../lib/adminApi';
import { token as sesionToken } from '../lib/sesion';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function ClaimedResultsManagement() {
  const { raceCode, raceName, loading: cargandoCarrera } = useAdminRace();
  // Vincular un resultado con el perfil de su atleta solo tiene sentido en las
  // ediciones historicas: en las modernas el corredor se inscribio el mismo.
  const [reclamable, setReclamable] = useState(true);
  const [results, setResults] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [unlinking, setUnlinking] = useState(null);
  const [sortField, setSortField] = useState('bib');
  const [sortAsc, setSortAsc] = useState(true);

  const token = sesionToken();

  const loadData = useCallback(async () => {
    if (!raceCode || cargandoCarrera) return;
    setLoading(true);
    try {
      const res = await adminFetch(
        `${API_URL}/api/athletes/admin/2026-results?race_code=${raceCode}`
      );
      if (!res.ok) throw new Error('Error al cargar datos');
      const data = await res.json();
      setResults(data.results || []);
      setStats(data.stats || {});
      setReclamable(data.reclamable !== false);
    } catch (err) {
      toast.error('Error al cargar los resultados');
    } finally {
      setLoading(false);
    }
  }, [raceCode, cargandoCarrera]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleUnclaim = async (resultId, bib) => {
    if (!window.confirm(`¿Desvincular el resultado del BIB ${bib}? El atleta perderá la asociación con este resultado.`)) return;
    setUnlinking(resultId);
    try {
      const res = await fetch(`${API_URL}/api/athletes/admin/unclaim-2026`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ result_id: resultId }),
      });
      if (!res.ok) throw new Error('Error al desvincular');
      toast.success(`BIB ${bib} desvinculado exitosamente`);
      loadData();
    } catch {
      toast.error('Error al desvincular resultado');
    } finally {
      setUnlinking(null);
    }
  };

  const toggleSort = (field) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  const filtered = useMemo(() => {
    let data = [...results];

    if (filterStatus === 'claimed') data = data.filter((r) => r.claimed_by_id);
    else if (filterStatus === 'unclaimed') data = data.filter((r) => !r.claimed_by_id);
    else if (filterStatus === 'auto') data = data.filter((r) => r.claim_type === 'auto');
    else if (filterStatus === 'manual') data = data.filter((r) => r.claim_type === 'manual');

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      data = data.filter(
        (r) =>
          r.bib?.toLowerCase().includes(q) ||
          r.nombre?.toLowerCase().includes(q) ||
          r.apellidos?.toLowerCase().includes(q) ||
          r.athlete?.email?.toLowerCase().includes(q) ||
          r.athlete?.nombre?.toLowerCase().includes(q)
      );
    }

    data.sort((a, b) => {
      let va, vb;
      if (sortField === 'bib') { va = parseInt(a.bib) || 0; vb = parseInt(b.bib) || 0; }
      else if (sortField === 'nombre') { va = `${a.nombre} ${a.apellidos}`.toLowerCase(); vb = `${b.nombre} ${b.apellidos}`.toLowerCase(); }
      else if (sortField === 'laps') { va = a.laps_completed || 0; vb = b.laps_completed || 0; }
      else if (sortField === 'status') { va = a.claimed_by_id ? 1 : 0; vb = b.claimed_by_id ? 1 : 0; }
      else { va = a[sortField]; vb = b[sortField]; }
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });

    return data;
  }, [results, filterStatus, searchTerm, sortField, sortAsc]);

  const exportCSV = () => {
    const header = 'BIB,Nombre,Apellidos,Vueltas,Sexo,Estado,Tipo,Email Atleta,Nombre Atleta\n';
    const rows = filtered.map((r) =>
      [
        r.bib, r.nombre, r.apellidos, r.laps_completed, r.sexo || '',
        r.claimed_by_id ? 'Vinculado' : 'Sin vincular',
        r.claim_type || '',
        r.athlete?.email || '',
        r.athlete ? `${r.athlete.nombre} ${r.athlete.apellidos}` : '',
      ].map((v) => `"${v}"`).join(',')
    ).join('\n');
    const blob = new Blob(['\ufeff' + header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'resultados_2026_vinculaciones.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12" data-testid="results-loading">
        <Loader2 className="w-6 h-6 animate-spin text-[#E8772E]" />
        <span className="ml-2">Cargando resultados 2026...</span>
      </div>
    );
  }

  const SortHeader = ({ field, children }) => (
    <th
      className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none"
      onClick={() => toggleSort(field)}
    >
      <span className="flex items-center gap-1">
        {children}
        <ArrowUpDown className="w-3 h-3" />
      </span>
    </th>
  );

  return (
    <div className="space-y-6" data-testid="claimed-results-management">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h2 className="text-2xl font-bold">Resultados</h2>
          <p className="text-muted-foreground text-sm">
            {reclamable
              ? `Resultados de ${raceName} y a qué perfil está vinculado cada uno`
              : `Resultados de ${raceName}`}
          </p>
        </div>
        <RaceSelector />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold" data-testid="stat-total">{stats?.total || 0}</div>
            <div className="text-sm text-gray-500">Total Corredores</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600" data-testid="stat-claimed">{stats?.claimed || 0}</div>
            <div className="text-sm text-gray-500">
              {reclamable ? 'Vinculados' : 'Con perfil'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-400" data-testid="stat-unclaimed">{stats?.unclaimed || 0}</div>
            <div className="text-sm text-gray-500">Sin vincular</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-[#E8772E]" data-testid="stat-percentage">
              {stats?.total ? Math.round((stats.claimed / stats.total) * 100) : 0}%
            </div>
            <div className="text-sm text-gray-500">Porcentaje</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[#E8772E]" />
            {raceName}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar por BIB, nombre o email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="search-input"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {[
                { key: 'all', label: 'Todos', icon: Users },
                { key: 'claimed', label: 'Vinculados', icon: UserCheck },
                { key: 'unclaimed', label: 'Sin vincular', icon: UserX },
                { key: 'auto', label: 'Auto', icon: Flag },
              ].map(({ key, label, icon: Icon }) => (
                <Button
                  key={key}
                  variant={filterStatus === key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterStatus(key)}
                  className={filterStatus === key ? 'bg-[#E8772E] hover:bg-[#d06a28]' : ''}
                  data-testid={`filter-${key}`}
                >
                  <Icon className="w-3.5 h-3.5 mr-1" />
                  {label}
                </Button>
              ))}
              <Button variant="outline" size="sm" onClick={exportCSV} data-testid="export-csv-btn">
                <Download className="w-3.5 h-3.5 mr-1" />
                CSV
              </Button>
            </div>
          </div>

          <div className="text-sm text-gray-500">
            Mostrando {filtered.length} de {results.length} resultados
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm" data-testid="results-table">
              <thead className="bg-gray-50">
                <tr>
                  <SortHeader field="bib">BIB</SortHeader>
                  <SortHeader field="nombre">Corredor (2026)</SortHeader>
                  <SortHeader field="laps">Vueltas</SortHeader>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sexo</th>
                  <SortHeader field="status">Estado</SortHeader>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Perfil Vinculado</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50" data-testid={`row-${r.bib}`}>
                    <td className="px-3 py-2.5 font-mono font-semibold">{r.bib}</td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium">{r.nombre} {r.apellidos}</div>
                      <div className="text-xs text-gray-400">{r.nacionalidad}</div>
                    </td>
                    <td className="px-3 py-2.5 font-semibold">{r.laps_completed}</td>
                    <td className="px-3 py-2.5">
                      <Badge variant="outline" className="text-xs">
                        {r.sexo === 'Femenino' ? 'F' : r.sexo === 'Masculino' ? 'M' : '-'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      {r.claimed_by_id ? (
                        <Badge className={
                          r.claim_type === 'auto'
                            ? 'bg-blue-100 text-blue-700 hover:bg-blue-100'
                            : r.claim_type === 'huerfano'
                            ? 'bg-red-100 text-red-700 hover:bg-red-100'
                            : 'bg-green-100 text-green-700 hover:bg-green-100'
                        }>
                          {r.claim_type === 'auto' ? 'Auto' : r.claim_type === 'huerfano' ? 'Huérfano' : 'Manual'}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-gray-400">Sin vincular</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {r.athlete ? (
                        <div>
                          <div className="text-sm font-medium">{r.athlete.nombre} {r.athlete.apellidos}</div>
                          <div className="text-xs text-gray-400">{r.athlete.email}</div>
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {reclamable && r.claimed_by_id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUnclaim(r.id, r.bib)}
                          disabled={unlinking === r.id}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          data-testid={`unclaim-btn-${r.bib}`}
                        >
                          {unlinking === r.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Link2Off className="w-4 h-4" />
                          )}
                          <span className="ml-1 hidden sm:inline">Desvincular</span>
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                      No se encontraron resultados
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
