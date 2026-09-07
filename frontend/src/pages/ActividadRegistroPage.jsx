import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  GraduationCap, Calendar, Clock, DollarSign, Users, Check, Loader2,
  CalendarX, User, Mail, Phone,
} from 'lucide-react';
import { toast } from 'sonner';
import { getEndTime } from '../lib/duracion';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const fmtFecha = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('es-DO', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

/**
 * Inscripción abierta a una actividad: charlas, entrenamientos, entrega de
 * kits. No pide cuenta ni contraseña, solo el nombre, el correo y el teléfono,
 * porque a las charlas viene gente que no corre la carrera y no tiene por qué
 * crearse un perfil para sentarse a escuchar.
 *
 * El enlace se copia desde el panel (Actividades) y se reparte por correo o
 * WhatsApp. Admite ?nombre=, ?email= y ?telefono= para llegar con los datos ya
 * puestos y que la persona solo tenga que confirmarlos.
 */
export default function ActividadRegistroPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const [actividad, setActividad] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [hecho, setHecho] = useState(null);
  const [datos, setDatos] = useState({
    nombre_completo: params.get('nombre') || '',
    email: params.get('email') || '',
    telefono: params.get('telefono') || '',
  });

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/capacitaciones/${id}/publica`);
      if (res.ok) {
        setActividad(await res.json());
      } else {
        setActividad(null);
      }
    } catch {
      setActividad(null);
    } finally {
      setCargando(false);
    }
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  const cambiar = (campo) => (e) => setDatos((d) => ({ ...d, [campo]: e.target.value }));

  const enviar = async (e) => {
    e.preventDefault();
    if (!datos.nombre_completo.trim() || !datos.email.trim() || !datos.telefono.trim()) {
      toast.error('Completa los tres datos para confirmar');
      return;
    }
    setEnviando(true);
    try {
      const res = await fetch(`${API_URL}/api/capacitaciones/${id}/inscripcion-publica`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      });
      const respuesta = await res.json().catch(() => ({}));
      if (res.ok) {
        setHecho(respuesta);
        cargar();
      } else {
        // Un 422 de validación trae `detail` como lista de objetos, no como texto
        const motivo = typeof respuesta.detail === 'string' ? respuesta.detail : '';
        toast.error(motivo || 'No se pudo completar la inscripción');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setEnviando(false);
    }
  };

  if (cargando) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!actividad) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <CalendarX className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
        <h1 className="text-xl font-semibold mb-2">Actividad no encontrada</h1>
        <p className="text-muted-foreground">
          El enlace puede estar incompleto o la actividad ya no está disponible.
        </p>
      </div>
    );
  }

  const horaFin = getEndTime(actividad.datetime, actividad.duration);

  return (
    // pt-20: la barra de navegacion es fija y taparia el titulo
    <div className="max-w-2xl mx-auto px-4 pt-20 sm:pt-24 pb-12 space-y-6" data-testid="actividad-registro">
      {/* Cabecera de la actividad */}
      <div className="space-y-3">
        {actividad.tipo_label && (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary">
            <GraduationCap className="w-3.5 h-3.5" />
            {actividad.tipo_label}
          </span>
        )}
        {/* Sin icono al lado: en el telefono el nombre parte en dos lineas y
            el icono le robaba el ancho */}
        <h1 className="text-2xl sm:text-3xl font-bold leading-tight">{actividad.name}</h1>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-muted-foreground">
          <span className="flex items-start gap-2 sm:col-span-2">
            <Calendar className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="first-letter:uppercase">
              {fmtFecha(actividad.datetime)}{horaFin ? ` a ${horaFin}` : ''}
            </span>
          </span>
          {actividad.duration && !horaFin && (
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4 shrink-0" />{actividad.duration}
            </span>
          )}
          <span className="flex items-center gap-2 font-medium">
            <DollarSign className="w-4 h-4 shrink-0" />
            {actividad.is_free
              ? <span className="text-green-600">Entrada gratis</span>
              : `RD$${(actividad.cost || 0).toLocaleString('es-DO')}`}
          </span>
          <span className="flex items-center gap-2">
            <Users className="w-4 h-4 shrink-0" />{actividad.registered_count} inscritos
          </span>
        </div>
      </div>

      {/* Programa */}
      {actividad.program && (
        <Card>
          <CardContent className="p-5 sm:p-6">
            <h2 className="font-semibold mb-3">Programa</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {actividad.program}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Inscripción */}
      {hecho ? (
        <Card className="border-green-300 bg-green-50/40" data-testid="actividad-registro-listo">
          <CardContent className="p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <Check className="w-6 h-6 text-green-700" />
            </div>
            <h2 className="text-lg font-semibold">
              {hecho.ya_estaba ? 'Ya estabas inscrito' : '¡Listo, quedaste inscrito!'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {hecho.ya_estaba
                ? 'Actualizamos tus datos con lo que acabas de confirmar.'
                : 'Te esperamos. Guarda la fecha y llega unos minutos antes.'}
            </p>
            <div className="text-sm text-left inline-block space-y-1 pt-2">
              <p className="flex items-center gap-2"><User className="w-4 h-4 text-muted-foreground" />{hecho.nombre_completo}</p>
              <p className="flex items-center gap-2"><Mail className="w-4 h-4 text-muted-foreground" />{hecho.email}</p>
              <p className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground" />{hecho.telefono}</p>
            </div>
            <div className="pt-2">
              <Button variant="outline" onClick={() => setHecho(null)} data-testid="actividad-registro-otro">
                Inscribir a otra persona
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-5 sm:p-6">
            <h2 className="font-semibold">Confirma tus datos</h2>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              No hace falta crear una cuenta: con estos tres datos queda hecha tu inscripción.
            </p>
            <form onSubmit={enviar} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="nombre">Nombre y apellido</Label>
                <Input
                  id="nombre"
                  value={datos.nombre_completo}
                  onChange={cambiar('nombre_completo')}
                  placeholder="María Pérez"
                  autoComplete="name"
                  required
                  data-testid="actividad-nombre"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Correo</Label>
                <Input
                  id="email"
                  type="email"
                  value={datos.email}
                  onChange={cambiar('email')}
                  placeholder="maria@correo.com"
                  autoComplete="email"
                  required
                  data-testid="actividad-email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="telefono">Teléfono</Label>
                <Input
                  id="telefono"
                  type="tel"
                  value={datos.telefono}
                  onChange={cambiar('telefono')}
                  placeholder="809 555 1234"
                  autoComplete="tel"
                  required
                  data-testid="actividad-telefono"
                />
              </div>
              <Button
                type="submit"
                disabled={enviando}
                className="w-full"
                data-testid="actividad-confirmar"
              >
                {enviando
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Confirmando…</>
                  : 'Confirmar inscripción'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
