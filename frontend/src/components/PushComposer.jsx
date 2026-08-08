import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Bell, Smartphone, Send, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { adminFetch } from '../lib/adminApi';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Límites de la bandeja de notificaciones: más texto que esto se corta en el
// teléfono, así que se corta aquí y el organizador lo ve mientras escribe.
const MAX_TITULO = 60;
const MAX_MENSAJE = 160;

/**
 * Aviso push a todos los teléfonos con BYSD Live instalada.
 *
 * Va a todo el mundo, no solo a quien sigue a un corredor: es para lo que no
 * cabe en un aviso automático (cambios de logística, clima, cierre de calles).
 */
export default function PushComposer() {
  const [titulo, setTitulo] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [stats, setStats] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);

  const cargarStats = useCallback(async () => {
    try {
      const res = await adminFetch(`${API_URL}/api/push/stats`);
      if (res.ok) setStats(await res.json());
    } catch {
      /* se ve en el contador vacío */
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargarStats(); }, [cargarStats]);

  const enviar = async () => {
    const t = titulo.trim();
    const m = mensaje.trim();
    if (!t || !m) {
      toast.error('Escribe el título y el mensaje');
      return;
    }
    if (!window.confirm(
      `Se enviará a ${stats?.total ?? 0} teléfono(s). Las notificaciones no se pueden retirar una vez enviadas.\n\n¿Enviar?`
    )) return;

    setEnviando(true);
    try {
      const res = await adminFetch(`${API_URL}/api/push/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: t, body: m }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.detail || 'No se pudo enviar el aviso');
        return;
      }
      toast.success(`Aviso enviado a ${data.enviados} de ${data.dispositivos} teléfono(s)`);
      setTitulo('');
      setMensaje('');
      cargarStats();
    } catch {
      toast.error('No se pudo enviar el aviso');
    } finally {
      setEnviando(false);
    }
  };

  const sinConfigurar = stats && !stats.configurado;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Avisos a la app
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Smartphone className="w-4 h-4" />
            {cargando ? (
              <span>Contando dispositivos…</span>
            ) : (
              <span>
                {stats?.total ?? 0} teléfono(s) con la app y las notificaciones activadas
                {stats ? ` · ${stats.android} Android · ${stats.ios} iOS` : ''}
              </span>
            )}
          </div>

          {sinConfigurar && (
            <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                Falta configurar Firebase en el backend (variable <code>FCM_SERVICE_ACCOUNT_JSON</code>).
                Hasta entonces no sale ningún aviso.
              </span>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium">Título</label>
            <Input
              value={titulo}
              maxLength={MAX_TITULO}
              placeholder="Cambio de hora de salida"
              onChange={(e) => setTitulo(e.target.value)}
            />
            <p className="text-xs text-muted-foreground text-right">{titulo.length}/{MAX_TITULO}</p>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Mensaje</label>
            <Textarea
              value={mensaje}
              maxLength={MAX_MENSAJE}
              rows={3}
              placeholder="La salida se atrasa 30 minutos por la lluvia. Nueva hora: 7:30 a. m."
              onChange={(e) => setMensaje(e.target.value)}
            />
            <p className="text-xs text-muted-foreground text-right">{mensaje.length}/{MAX_MENSAJE}</p>
          </div>

          {(titulo || mensaje) && (
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground mb-2">Así se verá en el teléfono</p>
              <div className="rounded-md bg-background border p-3 shadow-sm">
                <p className="text-[11px] text-muted-foreground mb-1">BYSD Live · ahora</p>
                <p className="text-sm font-semibold break-words">{titulo || 'Título'}</p>
                <p className="text-sm text-muted-foreground break-words">{mensaje || 'Mensaje'}</p>
              </div>
            </div>
          )}

          <Button
            onClick={enviar}
            disabled={enviando || sinConfigurar || !titulo.trim() || !mensaje.trim()}
            className="w-full sm:w-auto"
          >
            {enviando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Enviar aviso
          </Button>

          <p className="text-xs text-muted-foreground">
            Los avisos de vuelta completada y de eliminación salen solos con cada escaneo, solo a
            quien sigue a ese corredor. Esto es para el resto.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
