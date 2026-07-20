import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { GraduationCap, Calendar, Clock, DollarSign, Users, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function CapacitacionesTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);
  const token = localStorage.getItem('athlete_token');

  const loadData = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/capacitaciones/list`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      setItems(data.capacitaciones || []);
    } catch {
      toast.error('Error al cargar capacitaciones');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleRegister = async (cap) => {
    setActing(cap.id);
    try {
      const method = cap.my_registered ? 'DELETE' : 'POST';
      const res = await fetch(`${API_URL}/api/capacitaciones/${cap.id}/register`, {
        method,
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success(cap.my_registered ? 'Inscripción cancelada' : '¡Te inscribiste!');
        loadData();
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(d.detail || 'Error');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setActing(null);
    }
  };

  const fmtDate = (iso) => {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString('es-DO', { dateStyle: 'medium', timeStyle: 'short' }); }
    catch { return iso; }
  };

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (items.length === 0) {
    return (
      <Card data-testid="capacitaciones-empty">
        <CardContent className="py-12 text-center text-muted-foreground">
          <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>No hay capacitaciones disponibles por ahora.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4" data-testid="capacitaciones-tab">
      {items.map((c) => (
        <Card key={c.id} className={c.my_registered ? 'border-green-300 bg-green-50/30' : ''} data-testid={`cap-item-${c.id}`}>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg text-foreground">{c.name}</h3>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
                  <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{fmtDate(c.datetime)}</span>
                  {c.duration && <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{c.duration}</span>}
                  <span className="flex items-center gap-1 font-medium">
                    <DollarSign className="w-4 h-4" />
                    {c.is_free ? <span className="text-green-600">Gratis</span> : `RD$${(c.cost || 0).toLocaleString('es-DO')}`}
                  </span>
                  <span className="flex items-center gap-1"><Users className="w-4 h-4" />{c.registered_count} inscritos</span>
                </div>
                {c.program && <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{c.program}</p>}
              </div>
              <Button
                onClick={() => toggleRegister(c)}
                disabled={acting === c.id}
                className={c.my_registered ? 'bg-green-600 hover:bg-green-700' : 'bg-primary hover:bg-primary/90'}
                data-testid={`register-cap-${c.id}`}
              >
                {acting === c.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  : c.my_registered ? <Check className="w-4 h-4 mr-2" /> : null}
                {c.my_registered ? 'Inscrito' : 'Inscribirme'}
              </Button>
            </div>
            {c.my_registered && (
              <p className="text-xs text-green-600 mt-3">Estás inscrito. Puedes cancelar tu inscripción con el botón.</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
