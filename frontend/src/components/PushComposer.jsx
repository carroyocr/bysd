import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Bell, Smartphone, Send, Loader2, AlertTriangle, History } from 'lucide-react';
import { toast } from 'sonner';
import { adminFetch } from '../lib/adminApi';
import { REG_STATUS_OPTIONS, PAYMENT_OPTIONS } from './EmailComposer';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Límites de la bandeja de notificaciones: más texto que esto se corta en el
// teléfono, así que se corta aquí y el organizador lo ve mientras escribe.
const MAX_TITULO = 60;
const MAX_MENSAJE = 160;

const AUDIENCIAS = [
  { value: 'todos', label: 'Todos los que tienen la app' },
  { value: 'atletas', label: 'Corredores' },
  { value: 'staff', label: 'Equipo y voluntarios' },
  { value: 'seguidores', label: 'Quienes siguen a un dorsal' },
  { value: 'manual', label: 'Personas concretas (por correo)' },
];

const EVENTOS = [
  { value: '', label: 'Los dos eventos' },
  { value: 'carrera', label: 'Carrera' },
  { value: 'campeonato', label: 'Campeonato' },
];

const selectCls = 'w-full h-10 rounded-md border border-input bg-background px-3 text-sm';

/**
 * Mensajes push a la app BYSD Live.
 *
 * Mismo planteamiento que el envío de correos: se elige a quién va, se ve a
 * cuántos llegaría y se manda. El aviso de vuelta completada sigue saliendo
 * solo con cada escaneo; esto es para lo demás —cambios de logística, clima,
 * recordatorios al equipo— y para escribir a un grupo concreto.
 *
 * Un teléfono entra en un grupo cuando su dueño ha entrado en la app con su
 * cuenta (de corredor o de staff). El que nunca inició sesión solo es
 * alcanzable por "todos": eso es lo que separa `personas_con_app` de
 * `personas_en_la_lista`.
 */
export default function PushComposer() {
  const [titulo, setTitulo] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [audiencia, setAudiencia] = useState('todos');
  const [raceCode, setRaceCode] = useState('');
  const [regStatus, setRegStatus] = useState('');
  const [payment, setPayment] = useState('');
  const [evento, setEvento] = useState('');
  const [soloConTurno, setSoloConTurno] = useState(false);
  const [bibs, setBibs] = useState('');
  const [correos, setCorreos] = useState('');

  const [races, setRaces] = useState([]);
  const [alcance, setAlcance] = useState(null);
  const [contando, setContando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [historial, setHistorial] = useState([]);

  const filtro = useMemo(() => ({
    audiencia,
    race_code: ['todos', 'atletas', 'seguidores'].includes(audiencia) ? (raceCode || null) : null,
    reg_status: audiencia === 'atletas' ? (regStatus || null) : null,
    payment: audiencia === 'atletas' ? (payment || null) : null,
    evento: audiencia === 'staff' ? (evento || null) : null,
    solo_con_turno: audiencia === 'staff' ? soloConTurno : false,
    bibs: audiencia === 'seguidores'
      ? bibs.split(/[\s,]+/).map((b) => b.trim()).filter(Boolean)
      : [],
    correos: audiencia === 'manual'
      ? correos.split(/[\s,;]+/).map((c) => c.trim().toLowerCase()).filter(Boolean)
      : [],
  }), [audiencia, raceCode, regStatus, payment, evento, soloConTurno, bibs, correos]);

  useEffect(() => {
    adminFetch(`${API_URL}/api/race-config/all`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setRaces(Array.isArray(d) ? d : (d?.races || [])))
      .catch(() => {});
  }, []);

  const cargarHistorial = useCallback(async () => {
    try {
      const res = await adminFetch(`${API_URL}/api/push/historial?limit=15`);
      if (res.ok) setHistorial((await res.json()).envios || []);
    } catch {
      /* el historial es informativo */
    }
  }, []);

  useEffect(() => { cargarHistorial(); }, [cargarHistorial]);

  // Cuenta de destinatarios. Se recalcula con cada cambio del filtro, igual que
  // en el envío de correos: mandar sin saber a cuántos va es lo que hace que
  // nadie se atreva a usarlo.
  useEffect(() => {
    let cancelado = false;
    setContando(true);
    adminFetch(`${API_URL}/api/push/destinatarios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(filtro),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelado) setAlcance(d); })
      .catch(() => { if (!cancelado) setAlcance(null); })
      .finally(() => { if (!cancelado) setContando(false); });
    return () => { cancelado = true; };
  }, [filtro]);

  const enviar = async () => {
    const t = titulo.trim();
    const m = mensaje.trim();
    if (!t || !m) {
      toast.error('Escribe el título y el mensaje');
      return;
    }
    const destino = AUDIENCIAS.find((a) => a.value === audiencia)?.label || '';
    if (!window.confirm(
      `Se enviará a ${alcance?.dispositivos ?? 0} teléfono(s) — ${destino}.\n\n`
      + 'Las notificaciones no se pueden retirar una vez enviadas. ¿Enviar?'
    )) return;

    setEnviando(true);
    try {
      const res = await adminFetch(`${API_URL}/api/push/enviar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...filtro, title: t, body: m }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.detail || 'No se pudo enviar el aviso');
        return;
      }
      toast.success(`Aviso enviado a ${data.enviados} de ${data.dispositivos} teléfono(s)`);
      setTitulo('');
      setMensaje('');
      cargarHistorial();
    } catch {
      toast.error('No se pudo enviar el aviso');
    } finally {
      setEnviando(false);
    }
  };

  const sinConfigurar = alcance && !alcance.configurado;
  const sinDestino = !contando && (alcance?.dispositivos ?? 0) === 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Mensajes a la app
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
            <label className="text-sm font-medium">¿A quién va?</label>
            <select
              className={selectCls}
              value={audiencia}
              onChange={(e) => setAudiencia(e.target.value)}
              data-testid="push-audiencia"
            >
              {AUDIENCIAS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>

          {['todos', 'atletas', 'seguidores'].includes(audiencia) && (
            <div className="space-y-1">
              <label className="text-sm font-medium">Carrera</label>
              <select className={selectCls} value={raceCode} onChange={(e) => setRaceCode(e.target.value)}>
                <option value="">Cualquiera</option>
                {races.map((r) => <option key={r.code} value={r.code}>{r.name || r.code}</option>)}
              </select>
            </div>
          )}

          {audiencia === 'atletas' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">Estado de inscripción</label>
                <select className={selectCls} value={regStatus} onChange={(e) => setRegStatus(e.target.value)}>
                  {REG_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Pago</label>
                <select className={selectCls} value={payment} onChange={(e) => setPayment(e.target.value)}>
                  {PAYMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
          )}

          {audiencia === 'staff' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">Evento</label>
                <select className={selectCls} value={evento} onChange={(e) => setEvento(e.target.value)}>
                  {EVENTOS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm sm:mt-6">
                <input
                  type="checkbox"
                  checked={soloConTurno}
                  onChange={(e) => setSoloConTurno(e.target.checked)}
                />
                Solo quienes tienen turno asignado
              </label>
            </div>
          )}

          {audiencia === 'seguidores' && (
            <div className="space-y-1">
              <label className="text-sm font-medium">Dorsales</label>
              <Input
                value={bibs}
                placeholder="012, 045, 171"
                onChange={(e) => setBibs(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Llega a los teléfonos que siguen a esos corredores, tengan cuenta o no.
              </p>
            </div>
          )}

          {audiencia === 'manual' && (
            <div className="space-y-1">
              <label className="text-sm font-medium">Correos</label>
              <Textarea
                value={correos}
                rows={2}
                placeholder="alguien@correo.com, otro@correo.com"
                onChange={(e) => setCorreos(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                El correo de su cuenta en la app, sea de corredor o del equipo.
              </p>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm text-muted-foreground border-t pt-3">
            <Smartphone className="w-4 h-4 shrink-0" />
            {contando ? (
              <span>Contando destinatarios…</span>
            ) : (
              <span>
                {alcance?.dispositivos ?? 0} teléfono(s)
                {alcance ? ` · ${alcance.android} Android · ${alcance.ios} iOS` : ''}
                {alcance?.sin_app > 0
                  ? ` — ${alcance.sin_app} de la lista no han entrado en la app y no recibirán nada`
                  : ''}
              </span>
            )}
          </div>

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
            disabled={enviando || sinConfigurar || sinDestino || !titulo.trim() || !mensaje.trim()}
            className="w-full sm:w-auto"
            data-testid="push-enviar"
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

      {historial.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="w-4 h-4" /> Últimos envíos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {historial.map((h, i) => (
              <div key={i} className="rounded-md border p-3 text-sm">
                <p className="font-semibold">{h.title}</p>
                <p className="text-muted-foreground">{h.body}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {AUDIENCIAS.find((a) => a.value === h.audiencia)?.label || h.audiencia}
                  {' · '}{h.enviados} de {h.dispositivos} teléfono(s)
                  {h.enviado_por ? ` · ${h.enviado_por}` : ''}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
