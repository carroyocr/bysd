import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { GraduationCap, Calendar, DollarSign, Users, Check, Loader2, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// La duracion se captura como texto libre ("2", "2 horas", "90 min", "1:30").
// Devuelve los minutos, o null si no se puede interpretar.
const parseDurationMinutes = (raw) => {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim().toLowerCase().replace(',', '.');
  if (!s) return null;

  const hm = s.match(/^(\d{1,2}):([0-5]\d)$/);
  if (hm) return Number(hm[1]) * 60 + Number(hm[2]);

  let minutes = 0;
  let found = false;
  const horas = s.match(/(\d+(?:\.\d+)?)\s*(?:h\b|hr|hrs|hora|horas)/);
  if (horas) { minutes += parseFloat(horas[1]) * 60; found = true; }
  const mins = s.match(/(\d+)\s*(?:m\b|min|mins|minuto|minutos)/);
  if (mins) { minutes += parseInt(mins[1], 10); found = true; }

  // Solo un numero: se asume que son horas
  if (!found && /^\d+(?:\.\d+)?$/.test(s)) { minutes = parseFloat(s) * 60; found = true; }

  return found && minutes > 0 ? Math.round(minutes) : null;
};

// Hora en que termina = inicio + duracion. null si falta o no se puede calcular.
const getEndTime = (iso, duration) => {
  const minutes = parseDurationMinutes(duration);
  if (!iso || minutes === null) return null;
  const start = new Date(iso);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + minutes * 60000);
  return end.toLocaleTimeString('es-DO', { hour: 'numeric', minute: '2-digit' });
};

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
      toast.error('Error al cargar las actividades');
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
          <p>No hay actividades disponibles por ahora.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4" data-testid="capacitaciones-tab">
      {items.map((c) => (
        <CapacitacionCard
          key={c.id}
          cap={c}
          fmtDate={fmtDate}
          acting={acting === c.id}
          onToggle={() => toggleRegister(c)}
        />
      ))}
    </div>
  );
}

// Tarjeta de actividad: en celular los datos van en dos columnas,
// el programa se despliega bajo demanda y el boton ocupa todo el ancho
function CapacitacionCard({ cap: c, fmtDate, acting, onToggle }) {
  const [showProgram, setShowProgram] = useState(false);
  const endTime = getEndTime(c.datetime, c.duration);

  return (
    <Card className={c.my_registered ? 'border-green-300 bg-green-50/30' : ''} data-testid={`cap-item-${c.id}`}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex items-start gap-2">
              <GraduationCap className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="min-w-0">
                <h3 className="font-semibold text-base sm:text-lg text-foreground leading-snug">{c.name}</h3>
                {c.tipo_label && (
                  <span className="inline-block mt-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    {c.tipo_label}
                  </span>
                )}
              </div>
              {c.my_registered && (
                <span className="shrink-0 ml-auto inline-flex items-center gap-1 rounded-full bg-green-100 text-green-700 text-[11px] font-medium px-2 py-0.5">
                  <Check className="w-3 h-3" />Inscrito
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm text-muted-foreground sm:flex sm:flex-wrap sm:gap-x-4 sm:gap-y-1">
              <span className="flex items-start gap-1.5 col-span-2 sm:col-auto">
                <Calendar className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  {fmtDate(c.datetime)}
                  {endTime ? ` a ${endTime}` : c.duration ? ` · ${c.duration}` : ''}
                </span>
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <DollarSign className="w-4 h-4 shrink-0" />
                {c.is_free ? <span className="text-green-600">Gratis</span> : `RD$${(c.cost || 0).toLocaleString('es-DO')}`}
              </span>
              <span className="flex items-center gap-1.5"><Users className="w-4 h-4 shrink-0" />{c.registered_count} inscritos</span>
            </div>

            {c.program && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowProgram(v => !v)}
                  className="sm:hidden flex items-center gap-1 text-xs font-medium text-primary"
                  aria-expanded={showProgram}
                  data-testid={`cap-program-toggle-${c.id}`}
                >
                  {showProgram ? 'Ocultar programa' : 'Ver programa'}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showProgram ? 'rotate-180' : ''}`} />
                </button>
                <p className={`${showProgram ? 'block' : 'hidden'} sm:block text-sm text-muted-foreground mt-2 whitespace-pre-wrap leading-relaxed`}>
                  {c.program}
                </p>
              </div>
            )}
          </div>

          <Button
            onClick={onToggle}
            disabled={acting}
            className={`w-full sm:w-auto shrink-0 ${c.my_registered ? 'bg-green-600 hover:bg-green-700' : 'bg-primary hover:bg-primary/90'}`}
            data-testid={`register-cap-${c.id}`}
          >
            {acting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              : c.my_registered ? <Check className="w-4 h-4 mr-2" /> : null}
            {c.my_registered ? 'Cancelar inscripción' : 'Inscribirme'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
