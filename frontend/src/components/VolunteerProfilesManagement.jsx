import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import {
  Search, Users, UserCheck, UserX, KeyRound, Mail, Download,
  Loader2, Pencil, X, ShieldCheck, CalendarClock,
} from 'lucide-react';
import { toast } from 'sonner';
import { adminFetch } from '../lib/adminApi';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Estado de la cuenta del voluntario, no de su inscripción: quién puede entrar
// a ver sus turnos y quién se quedó a medio camino.
const FILTROS = [
  { value: 'all', label: 'Todos' },
  { value: 'sin_cuenta', label: 'Sin cuenta' },
  { value: 'sin_password', label: 'Sin contraseña' },
  { value: 'activos', label: 'Pueden entrar' },
];

const EVENTO_LABEL = { carrera: 'Carrera', campeonato: 'Campeonato' };

const celdaCSV = (valor) => {
  const texto = valor === null || valor === undefined ? '' : String(valor);
  return `"${texto.replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
};

export default function VolunteerProfilesManagement() {
  const [perfiles, setPerfiles] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState('all');
  const [enviandoCodigo, setEnviandoCodigo] = useState(null);
  const [editando, setEditando] = useState(null); // perfil
  const [formulario, setFormulario] = useState({ nombre: '', apellidos: '', telefono: '' });
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const respuesta = await adminFetch(`${API_URL}/api/volunteer-registration/admin/profiles`);
      if (respuesta.ok) {
        const datos = await respuesta.json();
        setPerfiles(datos.profiles || []);
        setStats(datos.stats || null);
      } else {
        toast.error('Error al cargar los perfiles');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    return perfiles.filter((p) => {
      if (filtro === 'sin_cuenta' && p.tiene_cuenta) return false;
      if (filtro === 'sin_password' && (!p.tiene_cuenta || p.tiene_password)) return false;
      if (filtro === 'activos' && !p.tiene_password) return false;
      if (!termino) return true;
      return `${p.nombre} ${p.apellidos} ${p.email}`.toLowerCase().includes(termino);
    });
  }, [perfiles, filtro, busqueda]);

  const enviarCodigo = async (perfil) => {
    setEnviandoCodigo(perfil.email);
    try {
      const respuesta = await adminFetch(
        `${API_URL}/api/volunteer-registration/admin/profiles/${encodeURIComponent(perfil.email)}/codigo-password`,
        { method: 'POST' }
      );
      const datos = await respuesta.json().catch(() => ({}));
      if (respuesta.ok) toast.success(datos.message || 'Código enviado');
      else toast.error(datos.detail || 'No se pudo enviar el código');
    } catch {
      toast.error('Error de conexión');
    } finally {
      setEnviandoCodigo(null);
    }
  };

  const abrirEdicion = (perfil) => {
    setFormulario({
      nombre: perfil.nombre || '',
      apellidos: perfil.apellidos || '',
      telefono: perfil.telefono || '',
    });
    setEditando(perfil);
  };

  const guardarEdicion = async () => {
    if (!formulario.nombre.trim() || !formulario.apellidos.trim()) {
      toast.error('Nombre y apellidos son obligatorios');
      return;
    }
    setGuardando(true);
    try {
      const respuesta = await adminFetch(
        `${API_URL}/api/volunteer-registration/admin/profiles/${encodeURIComponent(editando.email)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formulario),
        }
      );
      const datos = await respuesta.json().catch(() => ({}));
      if (respuesta.ok) {
        toast.success('Datos actualizados');
        setEditando(null);
        cargar();
      } else {
        toast.error(datos.detail || 'Error al actualizar');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setGuardando(false);
    }
  };

  const exportarCSV = () => {
    if (filtrados.length === 0) {
      toast.error('No hay perfiles para exportar');
      return;
    }
    const cabeceras = ['Nombre', 'Apellidos', 'Email', 'Teléfono', 'Ciudad', 'Talla',
      'Eventos', 'Turnos Asignados', 'Tiene Cuenta', 'Tiene Contraseña', 'Permisos', 'Fecha de Registro'];
    const filas = filtrados.map((p) => [
      p.nombre, p.apellidos, p.email, p.telefono, p.ciudad_residencia, p.talla_camiseta,
      (p.eventos || []).map((e) => EVENTO_LABEL[e] || e).join(' / '),
      p.turnos_asignados,
      p.tiene_cuenta ? 'Sí' : 'No',
      p.tiene_password ? 'Sí' : 'No',
      (p.permisos || []).join(' '),
      p.created_at ? String(p.created_at).slice(0, 10) : '',
    ]);
    const contenido = '﻿' + [cabeceras, ...filas]
      .map((fila) => fila.map(celdaCSV).join(','))
      .join('\n');
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(new Blob([contenido], { type: 'text/csv;charset=utf-8;' }));
    enlace.download = `perfiles-voluntarios-${new Date().toISOString().split('T')[0]}.csv`;
    enlace.click();
    URL.revokeObjectURL(enlace.href);
    toast.success(`${filtrados.length} perfil(es) exportado(s)`);
  };

  const estadoCuenta = (perfil) => {
    if (!perfil.tiene_cuenta) {
      return <Badge variant="outline" className="border-amber-400 text-amber-700"><UserX className="w-3 h-3 mr-1" />Sin cuenta</Badge>;
    }
    if (!perfil.tiene_password) {
      return <Badge variant="outline" className="border-blue-400 text-blue-700"><KeyRound className="w-3 h-3 mr-1" />Sin contraseña</Badge>;
    }
    return <Badge className="bg-green-600"><UserCheck className="w-3 h-3 mr-1" />Puede entrar</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Perfiles de Voluntarios</h2>
          <p className="text-muted-foreground">
            Quién puede entrar a ver sus turnos, y quién se quedó a medio camino
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportarCSV} disabled={filtrados.length === 0} data-testid="export-volunteer-profiles">
          <Download className="w-4 h-4 mr-2" />
          Descargar CSV ({filtrados.length})
        </Button>
      </div>

      {/* Resumen */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Voluntarios', valor: stats.total, icono: Users },
            { label: 'Pueden entrar', valor: stats.con_password, icono: UserCheck },
            { label: 'Sin contraseña', valor: stats.sin_password, icono: KeyRound },
            { label: 'Sin cuenta', valor: stats.sin_cuenta, icono: UserX },
          ].map(({ label, valor, icono: Icono }) => (
            <Card key={label}>
              <CardContent className="py-4 flex items-center gap-3">
                <Icono className="w-5 h-5 text-primary" />
                <div>
                  <div className="text-2xl font-bold leading-none">{valor}</div>
                  <div className="text-xs text-muted-foreground mt-1">{label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" />
            {filtrados.length} de {perfiles.length}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o correo..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-10"
              data-testid="volunteer-profiles-search"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {FILTROS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFiltro(f.value)}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                  filtro === f.value
                    ? 'bg-primary text-white shadow'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}
                data-testid={`volunteer-profiles-filter-${f.value}`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="border rounded-lg divide-y">
            {filtrados.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-8 text-center">
                No hay voluntarios que cumplan ese filtro
              </p>
            ) : filtrados.map((perfil) => (
              <div key={perfil.email} className="p-4 flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-primary font-semibold">
                      {perfil.nombre?.[0]}{perfil.apellidos?.[0]}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{perfil.nombre} {perfil.apellidos}</div>
                    <div className="text-sm text-muted-foreground truncate">{perfil.email}</div>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {(perfil.eventos || []).map((e) => (
                        <Badge key={e} variant="outline" className="text-xs">
                          {EVENTO_LABEL[e] || e}
                        </Badge>
                      ))}
                      {perfil.turnos_asignados > 0 && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <CalendarClock className="w-3 h-3" />
                          {perfil.turnos_asignados} turno{perfil.turnos_asignados !== 1 ? 's' : ''}
                        </span>
                      )}
                      {(perfil.permisos || []).length > 0 && (
                        <Badge className="text-xs bg-purple-100 text-purple-700 hover:bg-purple-100">
                          <ShieldCheck className="w-3 h-3 mr-1" />
                          {perfil.permisos.join(', ')}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {estadoCuenta(perfil)}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => abrirEdicion(perfil)}
                    title="Editar datos básicos"
                    data-testid={`edit-volunteer-profile-${perfil.email}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  {!perfil.tiene_password && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => enviarCodigo(perfil)}
                      disabled={enviandoCodigo === perfil.email}
                      title="Enviarle el código para que se ponga su contraseña"
                      data-testid={`send-code-${perfil.email}`}
                    >
                      {enviandoCodigo === perfil.email
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Mail className="w-4 h-4" />}
                      <span className="ml-2 hidden lg:inline">Enviar código</span>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Editar datos básicos */}
      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" data-testid="volunteer-profile-modal">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="px-6 py-4 border-b flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-lg">Editar voluntario</h3>
                <p className="text-sm text-muted-foreground mt-1">{editando.email}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setEditando(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div className="space-y-1">
                <Label htmlFor="vol-nombre">Nombre</Label>
                <Input id="vol-nombre" value={formulario.nombre}
                  onChange={(e) => setFormulario((f) => ({ ...f, nombre: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="vol-apellidos">Apellidos</Label>
                <Input id="vol-apellidos" value={formulario.apellidos}
                  onChange={(e) => setFormulario((f) => ({ ...f, apellidos: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="vol-telefono">Teléfono</Label>
                <Input id="vol-telefono" value={formulario.telefono}
                  onChange={(e) => setFormulario((f) => ({ ...f, telefono: e.target.value }))} />
              </div>
              <p className="text-xs text-muted-foreground">
                El correo no se cambia aquí: es con lo que el voluntario entra y con lo que
                se cruzan sus turnos.
              </p>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
              <Button onClick={guardarEdicion} disabled={guardando} data-testid="save-volunteer-profile">
                {guardando ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
