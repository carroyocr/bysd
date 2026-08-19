import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Loader2, RotateCcw, EyeOff, RefreshCw, ShieldAlert, Flag } from 'lucide-react';
import { toast } from 'sonner';
import { adminFetch } from '../lib/adminApi';
import RaceSelector from './RaceSelector';
import { useAdminRace } from '../contexts/AdminRaceContext';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const fecha = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('es-DO', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
};

/**
 * Mensajes de ánimo reportados desde la app.
 *
 * Un reporte esconde el mensaje del muro en el acto (ver `/api/race/cheers/{id}/report`);
 * aquí la organización decide el destino: devolverlo al muro si estaba bien, o
 * dejarlo oculto si el reporte tenía razón. "Dejar oculto" no toca nada en el
 * servidor —oculto ya está—: solo lo quita de esta vista para ir despejando la
 * cola mientras se revisa.
 */
export default function CheerModerationPanel() {
  const { raceCode, raceName, conCarrera } = useAdminRace();
  const [mensajes, setMensajes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(null);
  const [revisados, setRevisados] = useState(() => new Set());

  const cargar = useCallback(async () => {
    if (!raceCode) return;
    setCargando(true);
    try {
      const res = await adminFetch(conCarrera(`${API_URL}/api/race/cheers/reported`));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMensajes(data.messages || []);
      setRevisados(new Set());
    } catch {
      toast.error('No se pudieron cargar los mensajes reportados');
    } finally {
      setCargando(false);
    }
  }, [raceCode, conCarrera]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const restaurar = async (mensaje) => {
    setOcupado(mensaje.id);
    try {
      const res = await adminFetch(`${API_URL}/api/race/cheers/${mensaje.id}/restore`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setMensajes((prev) => prev.filter((m) => m.id !== mensaje.id));
      toast.success('Mensaje devuelto al muro');
    } catch {
      toast.error('No se pudo restaurar el mensaje');
    } finally {
      setOcupado(null);
    }
  };

  const dejarOculto = (mensaje) => {
    setRevisados((prev) => new Set(prev).add(mensaje.id));
    toast('El mensaje se queda fuera del muro');
  };

  const pendientes = mensajes.filter((m) => !revisados.has(m.id));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-orange-500" />
            Ánimos reportados
          </h2>
          <p className="text-sm text-muted-foreground">
            Mensajes escondidos del muro por un reporte, a la espera de revisión
            {raceName ? ` · ${raceName}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RaceSelector />
          <Button variant="outline" size="sm" onClick={cargar} disabled={cargando}>
            {cargando
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <RefreshCw className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {cargando ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : pendientes.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <ShieldAlert className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No hay mensajes reportados pendientes de revisar.</p>
          </CardContent>
        </Card>
      ) : (
        pendientes.map((m) => (
          <Card key={m.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>— {m.fan_name || 'Sin nombre'}</span>
                {m.athlete_bib && (
                  <span className="text-muted-foreground font-normal">para #{m.athlete_bib}</span>
                )}
                {m.created_at && (
                  <span className="text-muted-foreground font-normal text-xs">
                    · escrito el {fecha(m.created_at)}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm border-l-2 border-orange-400 pl-3">{m.message}</p>

              <div className="space-y-1">
                {(m.reports || []).map((r, i) => (
                  <p key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Flag className="w-3 h-3 shrink-0 text-orange-500" />
                    Reportado el {fecha(r.at)}{r.reason ? `: «${r.reason}»` : ' (sin motivo)'}
                  </p>
                ))}
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => restaurar(m)}
                  disabled={ocupado === m.id}
                >
                  {ocupado === m.id
                    ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    : <RotateCcw className="w-4 h-4 mr-1.5" />}
                  Devolver al muro
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => dejarOculto(m)}
                  disabled={ocupado === m.id}
                >
                  <EyeOff className="w-4 h-4 mr-1.5" />
                  Dejar oculto
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
