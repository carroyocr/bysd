import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  AlertCircle, Calendar, CalendarClock, CheckCircle, Loader2, Upload, Wallet,
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const pesos = (n) => `RD$ ${Number(n || 0).toLocaleString('es-DO')}`;

const fechaLarga = (iso) => {
  if (!iso) return '';
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString('es-DO', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch {
    return iso;
  }
};

/**
 * Pedir más tiempo para terminar de pagar la inscripción.
 *
 * Se abona una parte, se propone cuándo se salda el resto y con eso el cupo
 * queda reservado en cuanto la organización lo apruebe.
 *
 * Va por token y no por sesión: el enlace sale en un correo a mucha gente, y
 * obligar a iniciar sesión primero es perder a la mitad por el camino. Es el
 * mismo token con el que ya se sube el comprobante o se cancela.
 */
export default function PlazoPagoPage() {
  const [params] = useSearchParams();
  const token = params.get('token');

  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);

  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState('');
  const [pago, setPago] = useState({ payment_date: '', bank_origin: '', transfer_number: '' });
  const [archivo, setArchivo] = useState(null);

  const cargar = useCallback(async () => {
    if (!token) {
      setError('Enlace no válido. Usa el que recibiste por correo.');
      setCargando(false);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/registration/plazo/${token}`);
      const cuerpo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(cuerpo.detail || 'No encontramos tu inscripción');
      setDatos(cuerpo);
    } catch (err) {
      setError(err.message || 'Error de conexión');
    } finally {
      setCargando(false);
    }
  }, [token]);

  useEffect(() => { cargar(); }, [cargar]);

  const enviar = async (e) => {
    e.preventDefault();
    if (!archivo) {
      toast.error('Adjunta el comprobante de tu abono');
      return;
    }
    setEnviando(true);
    try {
      const cuerpo = new FormData();
      cuerpo.append('monto_abonado', monto);
      cuerpo.append('fecha_propuesta', fecha);
      cuerpo.append('payment_date', pago.payment_date);
      cuerpo.append('bank_origin', pago.bank_origin);
      if (pago.transfer_number) cuerpo.append('transfer_number', pago.transfer_number);
      cuerpo.append('receipt_image', archivo);

      const res = await fetch(`${API_URL}/api/registration/plazo/${token}`, {
        method: 'POST',
        body: cuerpo,
      });
      const datosRes = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(datosRes.detail || 'No se pudo enviar la solicitud');
      setListo(true);
    } catch (err) {
      toast.error(err.message || 'Error de conexión');
    } finally {
      setEnviando(false);
    }
  };

  if (cargando) {
    return (
      <div className="flex items-center justify-center pt-32 pb-20 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando…
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto px-4 pt-24 pb-20 text-center space-y-2">
        <AlertCircle className="w-8 h-8 mx-auto text-destructive" />
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  const restante = Math.max((datos.costo || 0) - (Number(monto) || 0), 0);

  // pt-20: la barra de navegación es fija y taparía el título
  return (
    <div className="max-w-lg mx-auto px-4 pt-20 sm:pt-24 pb-12 space-y-4">
      <div className="text-center space-y-1">
        <CalendarClock className="w-8 h-8 mx-auto text-primary" />
        <h1 className="text-xl font-bold">Más tiempo para pagar</h1>
        <p className="text-sm text-muted-foreground">
          {datos.carrera?.name} · {datos.nombre}
        </p>
      </div>

      {listo ? (
        <Card>
          <CardContent className="pt-6 text-center space-y-3">
            <CheckCircle className="w-10 h-10 mx-auto text-emerald-600" />
            <p className="font-semibold">Solicitud enviada</p>
            <p className="text-sm text-muted-foreground">
              Revisamos tu abono y la fecha que propones, y te confirmamos por correo.
              Tu cupo queda reservado en cuanto la aprobemos.
            </p>
          </CardContent>
        </Card>
      ) : datos.impedimento ? (
        <Card>
          <CardContent className="pt-6 text-center space-y-2">
            <AlertCircle className="w-7 h-7 mx-auto text-amber-500" />
            <p className="text-sm text-muted-foreground">{datos.impedimento}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="pt-6 text-sm space-y-2">
              <p>
                Abona al menos <strong>{pesos(datos.abono_minimo)}</strong> y dinos
                cuándo saldas el resto, a más tardar el{' '}
                <strong>{fechaLarga(datos.fecha_tope)}</strong>. Con el abono aprobado,
                tu cupo queda reservado.
              </p>
              {datos.costo > 0 && (
                <p className="text-muted-foreground">
                  La inscripción cuesta {pesos(datos.costo)}.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Tu abono</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={enviar} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="monto" className="flex items-center gap-1.5">
                    <Wallet className="w-4 h-4" /> ¿Cuánto abonaste?
                  </Label>
                  <Input
                    id="monto"
                    type="number"
                    inputMode="numeric"
                    min={datos.abono_minimo}
                    max={datos.costo || undefined}
                    step="1"
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    placeholder={String(datos.abono_minimo)}
                    required
                  />
                  {Number(monto) > 0 && datos.costo > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Quedarían {pesos(restante)} por pagar.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fecha" className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" /> ¿Cuándo saldas el resto?
                  </Label>
                  <Input
                    id="fecha"
                    type="date"
                    min={datos.hoy}
                    max={datos.fecha_tope}
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="payment_date">Fecha del abono</Label>
                    <Input
                      id="payment_date"
                      type="date"
                      max={datos.hoy}
                      value={pago.payment_date}
                      onChange={(e) => setPago((p) => ({ ...p, payment_date: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bank_origin">Banco de origen</Label>
                    <Input
                      id="bank_origin"
                      value={pago.bank_origin}
                      onChange={(e) => setPago((p) => ({ ...p, bank_origin: e.target.value }))}
                      placeholder="Banco Popular"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="transfer_number">Número de transferencia (opcional)</Label>
                  <Input
                    id="transfer_number"
                    value={pago.transfer_number}
                    onChange={(e) => setPago((p) => ({ ...p, transfer_number: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="comprobante" className="flex items-center gap-1.5">
                    <Upload className="w-4 h-4" /> Comprobante del abono
                  </Label>
                  <Input
                    id="comprobante"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={(e) => setArchivo(e.target.files?.[0] || null)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">JPG, PNG, WebP o PDF, hasta 10 MB.</p>
                </div>

                <Button type="submit" className="w-full" disabled={enviando}>
                  {enviando
                    ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    : <CalendarClock className="w-4 h-4 mr-2" />}
                  Enviar solicitud
                </Button>
              </form>
            </CardContent>
          </Card>

          {datos.carrera?.payment_account_number && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Dónde abonar</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1 text-muted-foreground">
                <p><strong>{datos.carrera.payment_bank_name}</strong></p>
                <p>Cuenta {datos.carrera.payment_account_type}: {datos.carrera.payment_account_number}</p>
                <p>{datos.carrera.payment_account_name} · {datos.carrera.payment_account_id}</p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
