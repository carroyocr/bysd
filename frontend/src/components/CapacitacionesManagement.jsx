import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { GraduationCap, Plus, Trash2, Loader2, Users, Download, Calendar, Clock, DollarSign, X, FileText } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const emptyForm = { name: '', datetime: '', duration: '', program: '', cost: '', is_free: false };

export default function CapacitacionesManagement() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [participantsModal, setParticipantsModal] = useState(null); // capacitacion object
  const [participants, setParticipants] = useState([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);

  const token = localStorage.getItem('admin_token');
  const authHeader = { Authorization: `Bearer ${token}` };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/capacitaciones/admin/list`, { headers: authHeader });
      const data = await res.json();
      setItems(data.capacitaciones || []);
    } catch {
      toast.error('Error al cargar capacitaciones');
    } finally {
      setLoading(false);
    }
    // eslint-disable-line
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Indica el nombre'); return; }
    if (!form.datetime) { toast.error('Indica la fecha y hora'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/capacitaciones/admin/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({
          name: form.name,
          datetime: form.datetime,
          duration: form.duration,
          program: form.program,
          cost: form.is_free ? 0 : parseFloat(form.cost || 0),
          is_free: form.is_free,
        }),
      });
      if (res.ok) {
        toast.success('Capacitación creada');
        setForm(emptyForm); setShowForm(false); loadData();
      } else {
        toast.error('Error al crear');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta capacitación y todas sus inscripciones?')) return;
    try {
      const res = await fetch(`${API_URL}/api/capacitaciones/admin/${id}`, { method: 'DELETE', headers: authHeader });
      if (res.ok) { toast.success('Eliminada'); loadData(); }
      else toast.error('Error al eliminar');
    } catch { toast.error('Error de conexión'); }
  };

  const openParticipants = async (cap) => {
    setParticipantsModal(cap);
    setLoadingParticipants(true);
    try {
      const res = await fetch(`${API_URL}/api/capacitaciones/admin/${cap.id}/participants`, { headers: authHeader });
      const data = await res.json();
      setParticipants(data.participants || []);
    } catch { toast.error('Error al cargar participantes'); }
    finally { setLoadingParticipants(false); }
  };

  const downloadAttendance = async (cap) => {
    try {
      const res = await fetch(`${API_URL}/api/capacitaciones/admin/${cap.id}/attendance`, { headers: authHeader });
      if (!res.ok) { toast.error('Error al generar PDF'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `asistencia-${cap.name}.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { toast.error('Error de conexión'); }
  };

  const fmtDate = (iso) => {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString('es-DO', { dateStyle: 'medium', timeStyle: 'short' }); }
    catch { return iso; }
  };

  return (
    <div className="space-y-6" data-testid="capacitaciones-management">
      {/* Header + create toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><GraduationCap className="w-5 h-5 text-[#E8772E]" />Capacitaciones</h2>
          <p className="text-sm text-muted-foreground">Crea capacitaciones y controla las inscripciones</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="bg-[#E8772E] hover:bg-[#d06a28]" data-testid="new-capacitacion-btn">
          <Plus className="w-4 h-4 mr-2" />Nueva
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <Card data-testid="capacitacion-form">
          <CardHeader className="pb-3"><CardTitle className="text-base">Nueva capacitación</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre de la capacitación *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej. Preparación mental para ultras" data-testid="cap-name" />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha y hora *</Label>
                <Input type="datetime-local" value={form.datetime} onChange={(e) => setForm({ ...form, datetime: e.target.value })} data-testid="cap-datetime" />
              </div>
              <div className="space-y-2">
                <Label>Duración</Label>
                <Input value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} placeholder="Ej. 2 horas" data-testid="cap-duration" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Programa</Label>
              <Textarea value={form.program} onChange={(e) => setForm({ ...form, program: e.target.value })} rows={4} placeholder="Describe el programa / agenda de la capacitación..." data-testid="cap-program" />
            </div>
            <div className="grid sm:grid-cols-2 gap-4 items-end">
              <div className="space-y-2">
                <Label>Costo</Label>
                <Input type="number" min="0" step="0.01" value={form.cost} disabled={form.is_free} onChange={(e) => setForm({ ...form, cost: e.target.value })} placeholder="0.00" data-testid="cap-cost" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none pb-2">
                <input type="checkbox" checked={form.is_free} onChange={(e) => setForm({ ...form, is_free: e.target.checked })} className="w-4 h-4 accent-[#E8772E]" data-testid="cap-free" />
                <span className="text-sm">Gratis</span>
              </label>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving} className="bg-[#E8772E] hover:bg-[#d06a28]" data-testid="save-capacitacion-btn">
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Guardar
              </Button>
              <Button variant="ghost" onClick={() => { setShowForm(false); setForm(emptyForm); }}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-[#E8772E]" /></div>
      ) : items.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>No hay capacitaciones aún. Crea la primera.</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-4">
          {items.map((c) => (
            <Card key={c.id} data-testid={`capacitacion-${c.id}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg">{c.name}</h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
                      <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{fmtDate(c.datetime)}</span>
                      {c.duration && <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{c.duration}</span>}
                      <span className="flex items-center gap-1"><DollarSign className="w-4 h-4" />{c.is_free ? 'Gratis' : `RD$${(c.cost || 0).toLocaleString('es-DO')}`}</span>
                      <span className="flex items-center gap-1 text-[#E8772E] font-medium"><Users className="w-4 h-4" />{c.registered_count} inscritos</span>
                    </div>
                    {c.program && <p className="text-sm text-muted-foreground mt-2 line-clamp-2 whitespace-pre-wrap">{c.program}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => openParticipants(c)} data-testid={`view-participants-${c.id}`}>
                      <Users className="w-4 h-4 mr-1.5" />Inscritos
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => downloadAttendance(c)} title="Descargar hoja de asistencia" data-testid={`attendance-${c.id}`}>
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(c.id)} className="text-red-500 hover:text-red-600 hover:bg-red-50" data-testid={`delete-capacitacion-${c.id}`}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Participants modal */}
      {participantsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" data-testid="participants-modal">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="font-semibold flex items-center gap-2"><Users className="w-5 h-5 text-[#E8772E]" />Inscritos</h3>
                <p className="text-xs text-muted-foreground">{participantsModal.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => downloadAttendance(participantsModal)}>
                  <FileText className="w-4 h-4 mr-1.5" />Hoja asistencia
                </Button>
                <button onClick={() => setParticipantsModal(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto">
              {loadingParticipants ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#E8772E]" /></div>
              ) : participants.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Aún no hay inscritos.</p>
              ) : (
                <ol className="space-y-1">
                  {participants.map((p, i) => (
                    <li key={i} className="flex items-center gap-3 py-2 border-b border-gray-50 text-sm" data-testid={`participant-${i}`}>
                      <span className="text-gray-400 w-6 text-right">{i + 1}.</span>
                      <span className="font-medium">{p.nombre_completo}</span>
                      <span className="text-muted-foreground text-xs ml-auto truncate">{p.email}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
