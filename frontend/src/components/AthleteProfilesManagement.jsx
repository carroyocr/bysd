import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import {
  Search, Users, UserCheck, UserX, Loader2, Download, ArrowUpDown,
  Mail, MailCheck, ClipboardList, ShieldCheck, KeyRound, CheckCircle2, X, Pencil
} from 'lucide-react';
import { toast } from 'sonner';
import { COUNTRIES } from '../data/countries';
import { token as sesionToken } from '../lib/sesion';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function AthleteProfilesManagement() {
  const [athletes, setAthletes] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortField, setSortField] = useState('created_at');
  const [sortAsc, setSortAsc] = useState(false);
  const [activatingId, setActivatingId] = useState(null);
  const [pwdModal, setPwdModal] = useState(null); // athlete object
  const [newPwd, setNewPwd] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);
  const [editModal, setEditModal] = useState(null); // athlete object
  const [editForm, setEditForm] = useState({ nombre: '', apellidos: '', telefono: '', sexo: '', nacionalidad: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  const token = sesionToken();

  const openEditModal = (athlete) => {
    setEditForm({
      nombre: athlete.nombre || '',
      apellidos: athlete.apellidos || '',
      telefono: athlete.telefono || '',
      sexo: athlete.sexo || '',
      nacionalidad: athlete.nacionalidad || '',
    });
    setEditModal(athlete);
  };

  const saveEdit = async () => {
    if (!editForm.nombre.trim() || !editForm.apellidos.trim()) {
      toast.error('Nombre y apellidos son obligatorios');
      return;
    }
    setSavingEdit(true);
    try {
      const res = await fetch(`${API_URL}/api/athletes/admin/athlete-profile/${editModal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(editForm),
      });
      if (res.ok) { toast.success('Perfil actualizado'); setEditModal(null); loadData(); }
      else { const d = await res.json().catch(() => ({})); toast.error(d.detail || 'Error al actualizar'); }
    } catch { toast.error('Error de conexión'); }
    finally { setSavingEdit(false); }
  };

  const activateAccount = async (athlete) => {
    if (!window.confirm(`¿Activar la cuenta de ${athlete.nombre} ${athlete.apellidos}?`)) return;
    setActivatingId(athlete.id);
    try {
      const res = await fetch(`${API_URL}/api/athletes/admin/verify-account/${athlete.id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) { toast.success('Cuenta activada'); loadData(); }
      else { const d = await res.json().catch(() => ({})); toast.error(d.detail || 'Error al activar'); }
    } catch { toast.error('Error de conexión'); }
    finally { setActivatingId(null); }
  };

  const saveNewPassword = async () => {
    if (newPwd.length < 6) { toast.error('La contraseña debe tener al menos 6 caracteres'); return; }
    setSavingPwd(true);
    try {
      const res = await fetch(`${API_URL}/api/athletes/admin/set-password/${pwdModal.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ new_password: newPwd }),
      });
      if (res.ok) { toast.success('Contraseña actualizada'); setPwdModal(null); setNewPwd(''); loadData(); }
      else { const d = await res.json().catch(() => ({})); toast.error(d.detail || 'Error al actualizar'); }
    } catch { toast.error('Error de conexión'); }
    finally { setSavingPwd(false); }
  };

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
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
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
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        {!a.email_verified && (
                          <Button
                            size="sm" variant="ghost"
                            onClick={() => activateAccount(a)}
                            disabled={activatingId === a.id}
                            className="h-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                            title="Activar cuenta"
                            data-testid={`activate-btn-${a.id}`}
                          >
                            {activatingId === a.id
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <CheckCircle2 className="w-4 h-4" />}
                          </Button>
                        )}
                        <Button
                          size="sm" variant="ghost"
                          onClick={() => openEditModal(a)}
                          className="h-8 text-gray-600 hover:text-gray-800 hover:bg-gray-100"
                          title="Editar datos"
                          data-testid={`edit-btn-${a.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm" variant="ghost"
                          onClick={() => { setPwdModal(a); setNewPwd(''); }}
                          className="h-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          title="Crear nueva contraseña"
                          data-testid={`set-password-btn-${a.id}`}
                        >
                          <KeyRound className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-gray-400">
                      No se encontraron atletas
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Profile Modal */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" data-testid="edit-profile-modal">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-[#E8772E]" />
                <h3 className="text-lg font-semibold">Editar datos del atleta</h3>
              </div>
              <button onClick={() => setEditModal(null)} className="text-gray-400 hover:text-gray-600" data-testid="close-edit-modal">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500">{editModal.email}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Nombre</label>
                <Input
                  value={editForm.nombre}
                  onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
                  data-testid="edit-nombre-input"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Apellidos</label>
                <Input
                  value={editForm.apellidos}
                  onChange={(e) => setEditForm({ ...editForm, apellidos: e.target.value })}
                  data-testid="edit-apellidos-input"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Teléfono</label>
                <Input
                  value={editForm.telefono}
                  onChange={(e) => setEditForm({ ...editForm, telefono: e.target.value })}
                  data-testid="edit-telefono-input"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Sexo</label>
                <select
                  value={editForm.sexo}
                  onChange={(e) => setEditForm({ ...editForm, sexo: e.target.value })}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  data-testid="edit-sexo-select"
                >
                  <option value="">Seleccionar</option>
                  <option value="Masculino">Masculino</option>
                  <option value="Femenino">Femenino</option>
                </select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-medium text-gray-600">País</label>
                <select
                  value={editForm.nacionalidad}
                  onChange={(e) => setEditForm({ ...editForm, nacionalidad: e.target.value })}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  data-testid="edit-nacionalidad-select"
                >
                  <option value="">Seleccionar</option>
                  {COUNTRIES.map((c) => <option key={c.code} value={c.name}>{c.name}</option>)}
                  {editForm.nacionalidad && !COUNTRIES.some((c) => c.name === editForm.nacionalidad) && (
                    <option value={editForm.nacionalidad}>{editForm.nacionalidad}</option>
                  )}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditModal(null)} data-testid="cancel-edit-btn">Cancelar</Button>
              <Button onClick={saveEdit} disabled={savingEdit} className="bg-[#E8772E] hover:bg-[#d06a28]" data-testid="confirm-edit-btn">
                {savingEdit && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Guardar Cambios
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Set Password Modal */}
      {pwdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" data-testid="set-password-modal">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold">Nueva contraseña</h3>
              </div>
              <button onClick={() => setPwdModal(null)} className="text-gray-400 hover:text-gray-600" data-testid="close-password-modal">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500">
              Establecer una nueva contraseña para <strong>{pwdModal.nombre} {pwdModal.apellidos}</strong> ({pwdModal.email}). La cuenta también quedará activada.
            </p>
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Mínimo 6 caracteres"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                data-testid="new-password-modal-input"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setPwdModal(null)} data-testid="cancel-password-modal-btn">Cancelar</Button>
              <Button onClick={saveNewPassword} disabled={savingPwd} className="bg-blue-600 hover:bg-blue-700" data-testid="confirm-password-modal-btn">
                {savingPwd && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Guardar Contraseña
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
