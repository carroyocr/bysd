import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import {
  Search, Newspaper, RefreshCw, Loader2, Trash2, Plus, Pencil, X,
  Phone, Smartphone, Mail, Globe, CalendarPlus, ChevronDown, ChevronRight,
  MessageCircle, CheckCircle, Ban, CalendarClock, User
} from 'lucide-react';
import { toast } from 'sonner';
import { adminFetch } from '../lib/adminApi';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const TIPOS_MEDIO = ['TV', 'Radio', 'Prensa escrita', 'Digital', 'Podcast', 'Otro'];

const ESTADO_CONFIG = {
  programado: { label: 'Programado', badgeClass: 'bg-blue-100 text-blue-700 hover:bg-blue-100' },
  realizado: { label: 'Realizado', badgeClass: 'bg-green-100 text-green-700 hover:bg-green-100' },
  cancelado: { label: 'Cancelado', badgeClass: 'bg-red-100 text-red-700 hover:bg-red-100' },
};

const EMPTY_CONTACTO = {
  nombre_programa: '',
  nombre_medio: '',
  tipo_medio: 'TV',
  nombre_contacto: '',
  posicion: '',
  telefono: '',
  celular: '',
  email: '',
  pagina_web: '',
};

const EMPTY_EVENTO = { fecha: '', hora: '', tema: '', invitados: '', notas: '' };

const soloDigitos = (v) => (v || '').replace(/[^0-9]/g, '');

const formatFecha = (fecha) => {
  if (!fecha) return '';
  const [y, m, d] = fecha.split('-');
  if (!y || !m || !d) return fecha;
  return `${d}/${m}/${y}`;
};

export default function PrensaManagement() {
  const [contactos, setContactos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [tipoFilter, setTipoFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);

  // Contact modal (create/edit)
  const [showContactoModal, setShowContactoModal] = useState(false);
  const [editingContacto, setEditingContacto] = useState(null); // null = nuevo
  const [contactoForm, setContactoForm] = useState(EMPTY_CONTACTO);

  // Event modal (create/edit) — planner de entrevistas
  const [showEventoModal, setShowEventoModal] = useState(false);
  const [eventoContacto, setEventoContacto] = useState(null);
  const [editingEvento, setEditingEvento] = useState(null); // null = nuevo
  const [eventoForm, setEventoForm] = useState(EMPTY_EVENTO);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch(`${API_URL}/api/prensa/admin/contactos`);
      if (res.ok) {
        const data = await res.json();
        setContactos(data.contactos || []);
      } else {
        toast.error('Error cargando contactos de prensa');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(() => {
    let data = [...contactos];
    if (tipoFilter !== 'all') data = data.filter((c) => c.tipo_medio === tipoFilter);
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      data = data.filter(
        (c) =>
          c.nombre_programa?.toLowerCase().includes(q) ||
          c.nombre_medio?.toLowerCase().includes(q) ||
          c.nombre_contacto?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q)
      );
    }
    return data;
  }, [contactos, tipoFilter, searchTerm]);

  const totalEventosProgramados = contactos.reduce(
    (sum, c) => sum + (c.eventos || []).filter((e) => e.estado === 'programado').length, 0
  );

  /* ---------------- Contactos ---------------- */

  const openNewContacto = () => {
    setEditingContacto(null);
    setContactoForm(EMPTY_CONTACTO);
    setShowContactoModal(true);
  };

  const openEditContacto = (contacto) => {
    setEditingContacto(contacto);
    setContactoForm({
      nombre_programa: contacto.nombre_programa || '',
      nombre_medio: contacto.nombre_medio || '',
      tipo_medio: contacto.tipo_medio || 'TV',
      nombre_contacto: contacto.nombre_contacto || '',
      posicion: contacto.posicion || '',
      telefono: contacto.telefono || '',
      celular: contacto.celular || '',
      email: contacto.email || '',
      pagina_web: contacto.pagina_web || '',
    });
    setShowContactoModal(true);
  };

  const handleSaveContacto = async () => {
    if (!contactoForm.nombre_programa.trim() || !contactoForm.nombre_medio.trim()) {
      toast.error('Nombre del programa y nombre del medio son obligatorios');
      return;
    }
    setSaving(true);
    try {
      const url = editingContacto
        ? `${API_URL}/api/prensa/admin/contactos/${editingContacto.id}`
        : `${API_URL}/api/prensa/admin/contactos`;
      const res = await adminFetch(url, {
        method: editingContacto ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactoForm),
      });
      if (res.ok) {
        toast.success(editingContacto ? 'Contacto actualizado' : 'Contacto agregado');
        setShowContactoModal(false);
        loadData();
      } else {
        const data = await res.json();
        toast.error(data.detail || 'Error al guardar contacto');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteContacto = async (contacto) => {
    if (!window.confirm(`¿Eliminar a "${contacto.nombre_programa}" (${contacto.nombre_medio}) y todos sus eventos?`)) return;
    try {
      const res = await adminFetch(`${API_URL}/api/prensa/admin/contactos/${contacto.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Contacto eliminado');
        loadData();
      } else {
        const data = await res.json();
        toast.error(data.detail || 'Error al eliminar contacto');
      }
    } catch {
      toast.error('Error de conexión');
    }
  };

  /* ---------------- Eventos (entrevistas) ---------------- */

  const openNewEvento = (contacto) => {
    setEventoContacto(contacto);
    setEditingEvento(null);
    setEventoForm(EMPTY_EVENTO);
    setShowEventoModal(true);
  };

  const openEditEvento = (contacto, evento) => {
    setEventoContacto(contacto);
    setEditingEvento(evento);
    setEventoForm({
      fecha: evento.fecha || '',
      hora: evento.hora || '',
      tema: evento.tema || '',
      invitados: evento.invitados || '',
      notas: evento.notas || '',
    });
    setShowEventoModal(true);
  };

  const handleSaveEvento = async () => {
    if (!eventoForm.fecha || !eventoForm.tema.trim()) {
      toast.error('La fecha y el tema son obligatorios');
      return;
    }
    setSaving(true);
    try {
      const url = editingEvento
        ? `${API_URL}/api/prensa/admin/eventos/${editingEvento.id}`
        : `${API_URL}/api/prensa/admin/contactos/${eventoContacto.id}/eventos`;
      const res = await adminFetch(url, {
        method: editingEvento ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventoForm),
      });
      if (res.ok) {
        toast.success(editingEvento ? 'Evento actualizado' : 'Evento agendado');
        setShowEventoModal(false);
        loadData();
      } else {
        const data = await res.json();
        toast.error(data.detail || 'Error al guardar evento');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const handleSetEventoEstado = async (evento, estado) => {
    try {
      const res = await adminFetch(`${API_URL}/api/prensa/admin/eventos/${evento.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado }),
      });
      if (res.ok) {
        toast.success(`Evento marcado como ${ESTADO_CONFIG[estado].label.toLowerCase()}`);
        loadData();
      } else {
        const data = await res.json();
        toast.error(data.detail || 'Error al actualizar evento');
      }
    } catch {
      toast.error('Error de conexión');
    }
  };

  const handleDeleteEvento = async (evento) => {
    if (!window.confirm(`¿Eliminar el evento "${evento.tema}"?`)) return;
    try {
      const res = await adminFetch(`${API_URL}/api/prensa/admin/eventos/${evento.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Evento eliminado');
        loadData();
      } else {
        const data = await res.json();
        toast.error(data.detail || 'Error al eliminar evento');
      }
    } catch {
      toast.error('Error de conexión');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12" data-testid="prensa-loading">
        <Loader2 className="w-6 h-6 animate-spin text-[#E8772E]" />
        <span className="ml-2">Cargando contactos de prensa...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="prensa-management">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Prensa</h2>
          <p className="text-muted-foreground">
            Directorio de medios y planificador de entrevistas
          </p>
        </div>
        <Button onClick={openNewContacto} data-testid="add-contacto-btn">
          <Plus className="w-4 h-4 mr-2" />
          Agregar Contacto
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-blue-700" data-testid="stat-contactos">{contactos.length}</div>
            <div className="text-sm text-blue-600">Contactos de Prensa</div>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-amber-700" data-testid="stat-eventos">{totalEventosProgramados}</div>
            <div className="text-sm text-amber-600">Eventos Programados</div>
          </CardContent>
        </Card>
      </div>

      {/* Search + filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Newspaper className="w-5 h-5 text-[#E8772E]" />
              Contactos Registrados
            </CardTitle>
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por programa, medio, contacto o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="prensa-search"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={tipoFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTipoFilter('all')}
            >
              Todos
            </Button>
            {TIPOS_MEDIO.map((tipo) => (
              <Button
                key={tipo}
                variant={tipoFilter === tipo ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTipoFilter(tipo)}
              >
                {tipo}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Contact list */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {contactos.length === 0
                ? 'Todavía no hay contactos de prensa. Agrega el primero.'
                : 'No se encontraron contactos con ese criterio'}
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((contacto) => {
                const isExpanded = expandedId === contacto.id;
                const eventos = contacto.eventos || [];
                const programados = eventos.filter((e) => e.estado === 'programado');
                return (
                  <div key={contacto.id} className="hover:bg-muted/30" data-testid={`contacto-${contacto.id}`}>
                    {/* Row header */}
                    <div
                      className="p-4 flex items-center justify-between cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : contacto.id)}
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Newspaper className="w-5 h-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium truncate">{contacto.nombre_programa}</div>
                          <div className="text-sm text-muted-foreground truncate">{contacto.nombre_medio}</div>
                          <Badge variant="outline" className="mt-1 text-xs border-primary/40 text-primary">
                            {contacto.tipo_medio}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {programados.length > 0 && (
                          <Badge variant="default">
                            {programados.length} evento{programados.length !== 1 ? 's' : ''}
                          </Badge>
                        )}
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {/* Expanded */}
                    {isExpanded && (
                      <div className="px-4 pb-4 bg-muted/20">
                        <div className="ml-0 md:ml-14 space-y-4 pt-3">
                          {/* Contact info + quick actions */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            <div className="flex items-center gap-2 md:col-span-2">
                              <User className="w-4 h-4 text-muted-foreground shrink-0" />
                              {contacto.nombre_contacto ? (
                                <span>
                                  <span className="font-medium">{contacto.nombre_contacto}</span>
                                  {contacto.posicion ? <span className="text-muted-foreground"> — {contacto.posicion}</span> : null}
                                </span>
                              ) : <span className="text-muted-foreground">Sin persona de contacto</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                              {contacto.telefono ? (
                                <a href={`tel:${contacto.telefono}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                                  {contacto.telefono}
                                </a>
                              ) : <span className="text-muted-foreground">Sin teléfono</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              <Smartphone className="w-4 h-4 text-muted-foreground shrink-0" />
                              {contacto.celular ? (
                                <span className="flex items-center gap-2">
                                  <a href={`tel:${contacto.celular}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                                    {contacto.celular}
                                  </a>
                                  <a
                                    href={`https://wa.me/${soloDigitos(contacto.celular)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-green-600 hover:text-green-700"
                                    title="Enviar WhatsApp"
                                  >
                                    <MessageCircle className="w-4 h-4" />
                                  </a>
                                </span>
                              ) : <span className="text-muted-foreground">Sin celular</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                              {contacto.email ? (
                                <a href={`mailto:${contacto.email}`} className="hover:underline truncate" onClick={(e) => e.stopPropagation()}>
                                  {contacto.email}
                                </a>
                              ) : <span className="text-muted-foreground">Sin correo</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                              {contacto.pagina_web ? (
                                <a
                                  href={contacto.pagina_web.startsWith('http') ? contacto.pagina_web : `https://${contacto.pagina_web}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:underline truncate"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {contacto.pagina_web}
                                </a>
                              ) : <span className="text-muted-foreground">Sin página web</span>}
                            </div>
                          </div>

                          {/* Events planner */}
                          <div className="pt-3 border-t">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-semibold text-sm flex items-center gap-2">
                                <CalendarClock className="w-4 h-4" />
                                Planificador de Eventos
                              </h4>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => { e.stopPropagation(); openNewEvento(contacto); }}
                                data-testid={`add-evento-${contacto.id}`}
                              >
                                <CalendarPlus className="w-4 h-4 mr-1" />
                                Agendar Evento
                              </Button>
                            </div>

                            {eventos.length === 0 ? (
                              <p className="text-sm text-muted-foreground italic">
                                No hay eventos agendados con este medio
                              </p>
                            ) : (
                              <div className="grid gap-2">
                                {eventos.map((evento) => {
                                  const estadoInfo = ESTADO_CONFIG[evento.estado] || ESTADO_CONFIG.programado;
                                  return (
                                    <div
                                      key={evento.id}
                                      className="flex flex-col md:flex-row md:items-center justify-between gap-2 p-3 bg-background rounded-lg border"
                                      data-testid={`evento-${evento.id}`}
                                    >
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="font-medium text-sm">{evento.tema}</span>
                                          <Badge className={estadoInfo.badgeClass}>{estadoInfo.label}</Badge>
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                          {formatFecha(evento.fecha)}{evento.hora ? ` · ${evento.hora}` : ''}
                                          {evento.invitados ? ` · Invitados: ${evento.invitados}` : ''}
                                        </div>
                                        {evento.notas && (
                                          <div className="text-xs text-muted-foreground mt-1 italic">{evento.notas}</div>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1 shrink-0">
                                        {evento.estado === 'programado' && (
                                          <>
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                              title="Marcar como realizado"
                                              onClick={(e) => { e.stopPropagation(); handleSetEventoEstado(evento, 'realizado'); }}
                                            >
                                              <CheckCircle className="w-4 h-4" />
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              className="text-gray-500 hover:text-gray-700"
                                              title="Marcar como cancelado"
                                              onClick={(e) => { e.stopPropagation(); handleSetEventoEstado(evento, 'cancelado'); }}
                                            >
                                              <Ban className="w-4 h-4" />
                                            </Button>
                                          </>
                                        )}
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          title="Editar evento"
                                          onClick={(e) => { e.stopPropagation(); openEditEvento(contacto, evento); }}
                                        >
                                          <Pencil className="w-4 h-4" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                          title="Eliminar evento"
                                          onClick={(e) => { e.stopPropagation(); handleDeleteEvento(evento); }}
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Contact actions */}
                          <div className="pt-3 border-t flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => { e.stopPropagation(); openEditContacto(contacto); }}
                              data-testid={`edit-contacto-${contacto.id}`}
                            >
                              <Pencil className="w-4 h-4 mr-1" />
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                              onClick={(e) => { e.stopPropagation(); handleDeleteContacto(contacto); }}
                              data-testid={`delete-contacto-${contacto.id}`}
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              Eliminar
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contact modal */}
      {showContactoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Newspaper className="w-5 h-5 text-[#E8772E]" />
                  {editingContacto ? 'Editar Contacto' : 'Agregar Contacto de Prensa'}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowContactoModal(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Nombre del Programa *</label>
                <Input
                  value={contactoForm.nombre_programa}
                  onChange={(e) => setContactoForm({ ...contactoForm, nombre_programa: e.target.value })}
                  placeholder="Ej: El Show del Mediodía"
                  data-testid="input-nombre-programa"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Nombre del Medio *</label>
                <Input
                  value={contactoForm.nombre_medio}
                  onChange={(e) => setContactoForm({ ...contactoForm, nombre_medio: e.target.value })}
                  placeholder="Ej: Color Visión"
                  data-testid="input-nombre-medio"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Tipo de Medio *</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {TIPOS_MEDIO.map((tipo) => (
                    <Button
                      key={tipo}
                      type="button"
                      size="sm"
                      variant={contactoForm.tipo_medio === tipo ? 'default' : 'outline'}
                      onClick={() => setContactoForm({ ...contactoForm, tipo_medio: tipo })}
                    >
                      {tipo}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Nombre del Contacto</label>
                  <Input
                    value={contactoForm.nombre_contacto}
                    onChange={(e) => setContactoForm({ ...contactoForm, nombre_contacto: e.target.value })}
                    placeholder="Ej: Ana Rodríguez"
                    data-testid="input-nombre-contacto"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Posición</label>
                  <Input
                    value={contactoForm.posicion}
                    onChange={(e) => setContactoForm({ ...contactoForm, posicion: e.target.value })}
                    placeholder="Ej: Productora, Conductor"
                    data-testid="input-posicion"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Teléfono</label>
                  <Input
                    value={contactoForm.telefono}
                    onChange={(e) => setContactoForm({ ...contactoForm, telefono: e.target.value })}
                    placeholder="809-000-0000"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Celular</label>
                  <Input
                    value={contactoForm.celular}
                    onChange={(e) => setContactoForm({ ...contactoForm, celular: e.target.value })}
                    placeholder="829-000-0000"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Correo Electrónico</label>
                <Input
                  type="email"
                  value={contactoForm.email}
                  onChange={(e) => setContactoForm({ ...contactoForm, email: e.target.value })}
                  placeholder="contacto@medio.com"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Página Web</label>
                <Input
                  value={contactoForm.pagina_web}
                  onChange={(e) => setContactoForm({ ...contactoForm, pagina_web: e.target.value })}
                  placeholder="www.medio.com"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowContactoModal(false)} disabled={saving}>
                  Cancelar
                </Button>
                <Button className="flex-1" onClick={handleSaveContacto} disabled={saving} data-testid="save-contacto-btn">
                  {saving ? 'Guardando...' : editingContacto ? 'Guardar Cambios' : 'Agregar'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Event modal */}
      {showEventoModal && eventoContacto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <CalendarPlus className="w-5 h-5 text-[#E8772E]" />
                  {editingEvento ? 'Editar Evento' : `Agendar con ${eventoContacto.nombre_programa}`}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowEventoModal(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Fecha *</label>
                  <Input
                    type="date"
                    value={eventoForm.fecha}
                    onChange={(e) => setEventoForm({ ...eventoForm, fecha: e.target.value })}
                    data-testid="input-evento-fecha"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Hora</label>
                  <Input
                    type="time"
                    value={eventoForm.hora}
                    onChange={(e) => setEventoForm({ ...eventoForm, hora: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Tema *</label>
                <Input
                  value={eventoForm.tema}
                  onChange={(e) => setEventoForm({ ...eventoForm, tema: e.target.value })}
                  placeholder="Ej: Entrevista sobre el Campeonato Mundial por Equipos"
                  data-testid="input-evento-tema"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Invitados</label>
                <Input
                  value={eventoForm.invitados}
                  onChange={(e) => setEventoForm({ ...eventoForm, invitados: e.target.value })}
                  placeholder="Ej: Juan Pérez, María Gómez"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Notas</label>
                <Input
                  value={eventoForm.notas}
                  onChange={(e) => setEventoForm({ ...eventoForm, notas: e.target.value })}
                  placeholder="Detalles adicionales (opcional)"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowEventoModal(false)} disabled={saving}>
                  Cancelar
                </Button>
                <Button className="flex-1" onClick={handleSaveEvento} disabled={saving} data-testid="save-evento-btn">
                  {saving ? 'Guardando...' : editingEvento ? 'Guardar Cambios' : 'Agendar'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
