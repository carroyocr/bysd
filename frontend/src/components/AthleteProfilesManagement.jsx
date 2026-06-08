import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import {
  Search, Users, UserCheck, UserX, Loader2, Download, ArrowUpDown,
  Mail, MailCheck, ClipboardList, ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function AthleteProfilesManagement() {
  const [athletes, setAthletes] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortField, setSortField] = useState('created_at');
  const [sortAsc, setSortAsc] = useState(false);

  const token = localStorage.getItem('admin_token');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/athletes/admin/athlete-profiles`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Error');
      const data = await res.json();
      setAthletes(data.athletes || []);
      setStats(data.stats || {});
    } catch {
      toast.error('Error al cargar perfiles de atletas');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleSort = (field) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  const filtered = useMemo(() => {
    let data = [...athletes];

    if (filterStatus === 'inscribed') data = data.filter((a) => a.inscribed);
    else if (filterStatus === 'not_inscribed') data = data.filter((a) => !a.inscribed);
    else if (filterStatus === 'verified') data = data.filter((a) => a.email_verified);
    else if (filterStatus === 'unverified') data = data.filter((a) => !a.email_verified);

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      data = data.filter((a) =>
        a.nombre?.toLowerCase().includes(q) ||
        a.apellidos?.toLowerCase().includes(q) ||
        a.email?.toLowerCase().includes(q) ||
        a.telefono?.includes(q) ||
        a.nacionalidad?.toLowerCase().includes(q)
      );
    }

    data.sort((a, b) => {
      let va, vb;
      if (sortField === 'nombre') { va = `${a.nombre} ${a.apellidos}`.toLowerCase(); vb = `${b.nombre} ${b.apellidos}`.toLowerCase(); }
      else if (sortField === 'created_at') { va = a.created_at || ''; vb = b.created_at || ''; }
      else if (sortField === 'inscribed') { va = a.inscribed ? 1 : 0; vb = b.inscribed ? 1 : 0; }
      else { va = a[sortField] || ''; vb = b[sortField] || ''; }
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });

    return data;
  }, [athletes, filterStatus, searchTerm, sortField, sortAsc]);

  const exportCSV = () => {
    const header = 'Nombre,Apellidos,Email,Teléfono,Sexo,Nacionalidad,Ciudad,Talla,Tipo Sangre,Email Verificado,Inscrito,Fecha Registro\n';
    const rows = filtered.map((a) =>
      [a.nombre, a.apellidos, a.email, a.telefono, a.sexo, a.nacionalidad,
       a.ciudad_residencia, a.talla_camiseta, a.tipo_sangre,
       a.email_verified ? 'Sí' : 'No', a.inscribed ? 'Sí' : 'No',
       a.created_at ? new Date(a.created_at).toLocaleDateString('es-DO') : ''
      ].map((v) => `"${v || ''}"`).join(',')
    ).join('\n');
    const blob = new Blob(['\ufeff' + header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'perfiles_atletas.csv'; link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12" data-testid="profiles-loading">
        <Loader2 className="w-6 h-6 animate-spin text-[#E8772E]" />
        <span className="ml-2">Cargando perfiles...</span>
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
    <div className="space-y-6" data-testid="athlete-profiles-management">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold" data-testid="stat-total">{stats?.total || 0}</div>
            <div className="text-sm text-gray-500">Perfiles Creados</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600" data-testid="stat-inscribed">{stats?.inscribed || 0}</div>
            <div className="text-sm text-gray-500">Inscritos</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-amber-500" data-testid="stat-not-inscribed">{stats?.not_inscribed || 0}</div>
            <div className="text-sm text-gray-500">Sin Inscribir</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600" data-testid="stat-verified">{stats?.verified || 0}</div>
            <div className="text-sm text-gray-500">Email Verificado</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters + Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-[#E8772E]" />
            Perfiles de Atletas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar por nombre, email, teléfono..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="search-input"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {[
                { key: 'all', label: 'Todos', icon: Users },
                { key: 'inscribed', label: 'Inscritos', icon: ClipboardList },
                { key: 'not_inscribed', label: 'Sin Inscribir', icon: UserX },
                { key: 'verified', label: 'Verificados', icon: ShieldCheck },
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
            Mostrando {filtered.length} de {athletes.length} atletas
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm" data-testid="profiles-table">
              <thead className="bg-gray-50">
                <tr>
                  <SortHeader field="nombre">Nombre</SortHeader>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Teléfono</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sexo</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">País</th>
                  <SortHeader field="inscribed">Estado</SortHeader>
                  <SortHeader field="created_at">Registro</SortHeader>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50" data-testid={`row-${a.id}`}>
                    <td className="px-3 py-2.5">
                      <div className="font-medium">{a.nombre} {a.apellidos}</div>
                      {a.claimed_results?.length > 0 && (
                        <div className="text-xs text-blue-500">Resultado 2026 vinculado</div>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {a.email_verified
                          ? <MailCheck className="w-3.5 h-3.5 text-green-500 shrink-0" />
                          : <Mail className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                        }
                        <span className="truncate max-w-[200px]">{a.email}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-gray-600">{a.telefono || '—'}</td>
                    <td className="px-3 py-2.5">
                      <Badge variant="outline" className="text-xs">
                        {a.sexo === 'Femenino' ? 'F' : a.sexo === 'Masculino' ? 'M' : '—'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-gray-600">{a.nacionalidad || '—'}</td>
                    <td className="px-3 py-2.5">
                      {a.inscribed ? (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Inscrito</Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-500 border-amber-300">Sin inscribir</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-gray-500 text-xs">
                      {a.created_at ? new Date(a.created_at).toLocaleDateString('es-DO') : '—'}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                      No se encontraron atletas
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
