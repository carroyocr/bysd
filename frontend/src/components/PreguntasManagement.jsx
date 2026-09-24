import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check, Copy, Download, HelpCircle, Loader2, Lock, MonitorPlay, QrCode,
  RotateCcw, Trash2, Unlock,
} from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { adminFetch } from '../lib/adminApi';
import { descargarBlob } from '../lib/nativeExport';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const fmtFecha = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('es-DO', {
      day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

/**
 * Las preguntas de una actividad: el QR que se reparte en la sala, lo que va
 * llegando y el botón para presentarlas.
 *
 * El QR se dibuja en el backend y no aquí, para que el que se proyecta, el que
 * se descarga y el que lleve cualquier cartel que se haga después sean el
 * mismo código. Como el endpoint pide token, la imagen se trae como blob: un
 * `<img src>` a pelo iría sin la cabecera y devolvería un 401.
 */
export default function PreguntasManagement() {
  const [actividades, setActividades] = useState([]);
  const [elegida, setElegida] = useState('');
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState('');
  const [qr, setQr] = useState(null);
  const qrRef = useRef(null);

  // ---------------- Carga ----------------

  useEffect(() => {
    (async () => {
      try {
        const res = await adminFetch(`${API_URL}/api/capacitaciones/admin/list`);
        if (!res.ok) throw new Error('No se pudieron cargar las actividades');
        const lista = (await res.json()).capacitaciones || [];
        setActividades(lista);
        setElegida((actual) => actual || lista[0]?.id || '');
      } catch (err) {
        toast.error(err.message || 'Error de conexión');
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  const cargarPreguntas = useCallback(async () => {
    if (!elegida) return;
    try {
      const res = await adminFetch(`${API_URL}/api/capacitaciones/admin/${elegida}/preguntas`);
      if (!res.ok) throw new Error('No se pudieron cargar las preguntas');
      setDatos(await res.json());
    } catch (err) {
      toast.error(err.message || 'Error de conexión');
    }
  }, [elegida]);

  useEffect(() => { cargarPreguntas(); }, [cargarPreguntas]);

  useEffect(() => {
    if (!elegida) return undefined;
    let vigente = true;
    (async () => {
      try {
        const res = await adminFetch(`${API_URL}/api/capacitaciones/admin/${elegida}/preguntas/qr`);
        if (!res.ok || !vigente) return;
        const url = URL.createObjectURL(await res.blob());
        if (qrRef.current) URL.revokeObjectURL(qrRef.current);
        qrRef.current = url;
        setQr(url);
      } catch {
        /* el QR es un extra de la pantalla; el enlace se puede copiar igual */
      }
    })();
    return () => { vigente = false; };
  }, [elegida]);

  useEffect(() => () => {
    if (qrRef.current) URL.revokeObjectURL(qrRef.current);
  }, []);

  // ---------------- Acciones ----------------

  const abrirCerrar = async (abiertas) => {
    setOcupado('abrir');
    try {
      const res = await adminFetch(
        `${API_URL}/api/capacitaciones/admin/${elegida}/preguntas-abiertas`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ abiertas }),
        }
      );
      if (!res.ok) throw new Error('No se pudo cambiar');
      setActividades((lista) => lista.map(
        (a) => (a.id === elegida ? { ...a, preguntas_abiertas: abiertas } : a)
      ));
      await cargarPreguntas();
      toast.success(abiertas ? 'El QR ya recibe preguntas' : 'Cerrada la recogida de preguntas');
    } catch (err) {
      toast.error(err.message || 'Error de conexión');
    } finally {
      setOcupado('');
    }
  };

  const marcar = async (pregunta) => {
    setOcupado(pregunta.id);
    try {
      await adminFetch(`${API_URL}/api/capacitaciones/admin/${elegida}/preguntas/${pregunta.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ respondida: !pregunta.respondida }),
      });
      await cargarPreguntas();
    } finally {
      setOcupado('');
    }
  };

  const borrar = async (pregunta) => {
    if (!window.confirm('¿Quitar esta pregunta? No se puede deshacer.')) return;
    setOcupado(pregunta.id);
    try {
      const res = await adminFetch(
        `${API_URL}/api/capacitaciones/admin/${elegida}/preguntas/${pregunta.id}`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error('No se pudo quitar la pregunta');
      await cargarPreguntas();
      toast.success('Pregunta quitada');
    } catch (err) {
      toast.error(err.message || 'Error de conexión');
    } finally {
      setOcupado('');
    }
  };

  const copiarEnlace = async () => {
    const enlace = datos?.url || '';
    try {
      await navigator.clipboard.writeText(enlace);
      toast.success('Enlace copiado');
    } catch {
      window.prompt('Copia el enlace del formulario:', enlace);
    }
  };

  const descargarQr = async () => {
    const res = await adminFetch(`${API_URL}/api/capacitaciones/admin/${elegida}/preguntas/qr`);
    if (!res.ok) {
      toast.error('No se pudo descargar el QR');
      return;
    }
    descargarBlob(`preguntas-${elegida}.png`, await res.blob());
  };

  // ---------------- Pintado ----------------

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando…
      </div>
    );
  }

  if (!actividades.length) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-sm text-muted-foreground">
          Todavía no hay actividades. Crea una en Actividades y aquí aparecerá su QR de preguntas.
        </CardContent>
      </Card>
    );
  }

  const actividad = actividades.find((a) => a.id === elegida);
  const abiertas = actividad?.preguntas_abiertas !== false;
  const preguntas = datos?.preguntas || [];

  return (
    <div className="space-y-4">
      {/* Actividad */}
      <Card>
        <CardContent className="pt-6 flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground flex items-center gap-1.5 mr-1">
            <HelpCircle className="w-4 h-4" /> Actividad
          </span>
          {actividades.map((a) => (
            <Button
              key={a.id}
              size="sm"
              variant={a.id === elegida ? 'default' : 'outline'}
              onClick={() => { setElegida(a.id); setDatos(null); setQr(null); }}
            >
              {a.name}
            </Button>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        {/* QR y enlace */}
        <Card className="self-start">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <QrCode className="w-4 h-4" /> QR de la sala
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md border border-border bg-white p-3 flex justify-center">
              {qr
                ? <img src={qr} alt="Código QR del formulario de preguntas" className="w-full max-w-[220px]" />
                : <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
                    Preparando el QR…
                  </div>}
            </div>

            <p className="text-xs text-muted-foreground break-all">{datos?.url}</p>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={copiarEnlace}>
                <Copy className="w-4 h-4 mr-1.5" /> Enlace
              </Button>
              <Button variant="outline" size="sm" className="flex-1" onClick={descargarQr}>
                <Download className="w-4 h-4 mr-1.5" /> PNG
              </Button>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <Label className="flex items-center gap-1.5 text-sm">
                {abiertas ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                Recibir preguntas
              </Label>
              <Switch
                checked={abiertas}
                disabled={ocupado === 'abrir'}
                onCheckedChange={abrirCerrar}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Cerrada, el QR sigue llevando a la página, que avisa de que ya no se
              reciben preguntas en vez de dar un error.
            </p>

            <Button
              className="w-full"
              onClick={() => window.open(`/admin/preguntas/${elegida}`, '_blank')}
            >
              <MonitorPlay className="w-4 h-4 mr-2" /> Presentar
            </Button>
          </CardContent>
        </Card>

        {/* Preguntas */}
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">
              Preguntas recibidas
              {preguntas.length > 0 && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {datos?.pendientes} sin responder de {preguntas.length}
                </span>
              )}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={cargarPreguntas}>
              <RotateCcw className="w-4 h-4 mr-1.5" /> Actualizar
            </Button>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-border divide-y divide-border max-h-[32rem] overflow-y-auto">
              {preguntas.map((p) => (
                <div key={p.id} className="flex items-start gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${p.respondida ? 'text-muted-foreground line-through' : ''}`}>
                      {p.pregunta}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                      {p.anonima
                        ? <Badge variant="outline">Anónima</Badge>
                        : <span className="font-medium">{p.nombre}</span>}
                      <span>{fmtFecha(p.created_at)}</span>
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => marcar(p)}
                    disabled={ocupado === p.id}
                    title={p.respondida ? 'Devolver a la cola' : 'Marcar como respondida'}
                    className={p.respondida ? 'text-emerald-600' : ''}
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => borrar(p)}
                    disabled={ocupado === p.id}
                    title="Quitar la pregunta"
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              {!preguntas.length && (
                <div className="px-3 py-10 text-center text-sm text-muted-foreground">
                  Todavía no hay preguntas. Reparte el QR en la sala.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
