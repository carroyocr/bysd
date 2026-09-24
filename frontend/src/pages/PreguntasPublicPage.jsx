import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Check, HelpCircle, Loader2, Lock, MessageSquarePlus } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const MAX_PREGUNTA = 500;

/**
 * Dejar una pregunta para la charla, escaneando el QR de la sala.
 *
 * No pide cuenta ni correo: quien está sentado escuchando no tiene por qué
 * registrarse para levantar la mano. El nombre es opcional y se puede pedir
 * que no salga en pantalla; marcado eso, el nombre ni siquiera se envía.
 *
 * Se puede preguntar varias veces: el formulario se vacía y se queda ahí.
 */
export default function PreguntasPublicPage() {
  const { id } = useParams();
  const [actividad, setActividad] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [enviadas, setEnviadas] = useState(0);
  const [pregunta, setPregunta] = useState('');
  const [nombre, setNombre] = useState('');
  const [anonima, setAnonima] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/capacitaciones/${id}/publica`);
      if (!res.ok) throw new Error('No encontramos esa actividad');
      setActividad(await res.json());
    } catch (err) {
      toast.error(err.message || 'Error de conexión');
    } finally {
      setCargando(false);
    }
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  const enviar = async (e) => {
    e.preventDefault();
    if (pregunta.trim().length < 5) {
      toast.error('Escribe tu pregunta');
      return;
    }
    setEnviando(true);
    try {
      const res = await fetch(`${API_URL}/api/capacitaciones/${id}/preguntas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pregunta,
          // Anónima: el nombre no viaja siquiera
          nombre: anonima ? '' : nombre,
          publicar_nombre: !anonima,
        }),
      });
      const datos = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(datos.detail || 'No se pudo enviar la pregunta');
      setPregunta('');
      setEnviadas((n) => n + 1);
      toast.success('Pregunta enviada');
    } catch (err) {
      toast.error(err.message || 'Error de conexión');
    } finally {
      setEnviando(false);
    }
  };

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando…
      </div>
    );
  }

  if (!actividad) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center text-muted-foreground">
        No encontramos esa actividad.
      </div>
    );
  }

  const cerrada = !actividad.preguntas_abiertas;

  return (
    <div className="max-w-md mx-auto px-4 py-10 space-y-4">
      <div className="text-center space-y-1">
        <HelpCircle className="w-8 h-8 mx-auto text-primary" />
        <h1 className="text-xl font-bold">Preguntas</h1>
        <p className="text-sm text-muted-foreground">{actividad.name}</p>
      </div>

      {cerrada ? (
        <Card>
          <CardContent className="pt-6 text-center space-y-2">
            <Lock className="w-6 h-6 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Esta actividad ya no recibe preguntas. ¡Gracias por participar!
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={enviar} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Tu nombre</Label>
                <Input
                  id="nombre"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  disabled={anonima}
                  maxLength={60}
                  placeholder={anonima ? 'Tu pregunta saldrá como anónima' : 'Nombre y apellido'}
                  autoComplete="name"
                />
                <label className="flex items-start gap-2 text-sm cursor-pointer pt-0.5">
                  <input
                    type="checkbox"
                    checked={anonima}
                    onChange={(e) => setAnonima(e.target.checked)}
                    className="w-4 h-4 mt-0.5 accent-orange-500 cursor-pointer"
                  />
                  <span className="text-muted-foreground">
                    No publicar mi nombre
                    <span className="block text-xs">
                      Tu pregunta saldrá como anónima y no guardamos tu nombre.
                    </span>
                  </span>
                </label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pregunta">Tu pregunta</Label>
                <Textarea
                  id="pregunta"
                  value={pregunta}
                  onChange={(e) => setPregunta(e.target.value.slice(0, MAX_PREGUNTA))}
                  rows={5}
                  placeholder="¿Qué te gustaría preguntar?"
                  required
                />
                <p className="text-xs text-muted-foreground text-right">
                  {pregunta.length}/{MAX_PREGUNTA}
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={enviando}>
                {enviando
                  ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  : <MessageSquarePlus className="w-4 h-4 mr-2" />}
                Enviar pregunta
              </Button>

              {enviadas > 0 && (
                <p className="text-sm text-emerald-600 flex items-center justify-center gap-1.5">
                  <Check className="w-4 h-4" />
                  {enviadas === 1
                    ? 'Enviamos tu pregunta. Puedes dejar otra.'
                    : `Llevas ${enviadas} preguntas enviadas.`}
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Las preguntas se leen al final de la actividad.
      </p>
    </div>
  );
}
