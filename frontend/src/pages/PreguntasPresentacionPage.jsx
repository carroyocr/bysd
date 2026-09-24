import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Check, ChevronLeft, ChevronRight, Loader2, Trash2, X,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { adminFetch } from '../lib/adminApi';
import { token as sesionToken } from '../lib/sesion';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Cada cuánto se vuelven a pedir las preguntas. La gente sigue mandando
// mientras se responden las primeras, y nadie va a estar recargando.
const REFRESCO_MS = 20000;

// Se proyecta en una sala, así que va en negro y con el naranja de la marca,
// igual que la pantalla de mensajes del evento.
const FONDO = 'min-h-screen bg-[#0C0C0C] text-white flex flex-col';

/**
 * Las preguntas de una actividad, en pantalla completa, para ir respondiéndolas
 * al terminar la charla.
 *
 * Pide token del panel: lo que llega por el QR no está moderado, y esta
 * pantalla es justo donde se vería. Por eso también se puede borrar desde
 * aquí: si aparece algo que no debe leerse, se quita sin salir de la vista.
 *
 * Se mueve con las flechas del teclado, que es lo que tiene a mano quien
 * presenta desde un portátil conectado al proyector.
 */
export default function PreguntasPresentacionPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [indice, setIndice] = useState(0);
  const [soloPendientes, setSoloPendientes] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!sesionToken()) navigate('/admin/login');
  }, [navigate]);

  const cargar = useCallback(async () => {
    try {
      const res = await adminFetch(`${API_URL}/api/capacitaciones/admin/${id}/preguntas`);
      if (res.status === 401) {
        navigate('/admin/login');
        return;
      }
      if (!res.ok) throw new Error();
      setDatos(await res.json());
    } catch {
      /* Un fallo de red no puede apagar la pantalla a media charla: se
         mantiene lo último que se cargó y se reintenta al siguiente refresco. */
    } finally {
      setCargando(false);
    }
  }, [id, navigate]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    const reloj = setInterval(cargar, REFRESCO_MS);
    return () => clearInterval(reloj);
  }, [cargar]);

  const preguntas = useMemo(() => {
    const todas = datos?.preguntas || [];
    return soloPendientes ? todas.filter((p) => !p.respondida) : todas;
  }, [datos, soloPendientes]);

  // Si se borra la última, o el filtro deja menos, el índice tiene que volver
  // a caer dentro de la lista.
  const posicion = Math.min(indice, Math.max(preguntas.length - 1, 0));
  const actual = preguntas[posicion];

  const mover = useCallback((paso) => {
    setIndice((i) => {
      const siguiente = Math.min(Math.max(i + paso, 0), Math.max(preguntas.length - 1, 0));
      return siguiente;
    });
  }, [preguntas.length]);

  const marcar = async (respondida) => {
    if (!actual) return;
    setOcupado(true);
    try {
      await adminFetch(`${API_URL}/api/capacitaciones/admin/${id}/preguntas/${actual.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ respondida }),
      });
      await cargar();
      if (respondida) mover(1);
    } finally {
      setOcupado(false);
    }
  };

  const borrar = async () => {
    if (!actual) return;
    if (!window.confirm('¿Quitar esta pregunta? No se puede deshacer.')) return;
    setOcupado(true);
    try {
      await adminFetch(`${API_URL}/api/capacitaciones/admin/${id}/preguntas/${actual.id}`, {
        method: 'DELETE',
      });
      await cargar();
    } finally {
      setOcupado(false);
    }
  };

  useEffect(() => {
    const tecla = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); mover(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); mover(-1); }
      if (e.key === 'Escape') navigate('/admin?tab=capacitaciones');
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [mover, navigate]);

  if (cargando) {
    return (
      <div className={`${FONDO} items-center justify-center`}>
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const pendientes = datos?.pendientes ?? 0;

  return (
    <div className={FONDO}>
      {/* Cabecera */}
      <header className="flex items-center gap-3 px-6 py-4 border-b border-white/10">
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-[0.18em] text-primary">Preguntas</p>
          <h1 className="text-lg font-semibold truncate">{datos?.actividad?.name || ''}</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setSoloPendientes((v) => !v); setIndice(0); }}
          className="bg-transparent border-white/20 text-white hover:bg-white/10"
        >
          {soloPendientes ? 'Ver todas' : `Solo pendientes (${pendientes})`}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/admin?tab=capacitaciones')}
          className="text-white hover:bg-white/10"
          aria-label="Salir"
        >
          <X className="w-5 h-5" />
        </Button>
      </header>

      {/* La pregunta */}
      <main className="flex-1 flex flex-col items-center justify-center px-8 py-10 text-center">
        {actual ? (
          <>
            <p className="text-sm text-white/50 mb-6">
              {posicion + 1} de {preguntas.length}
              {actual.respondida && ' · respondida'}
            </p>
            <p className="text-3xl sm:text-5xl font-semibold leading-snug max-w-5xl text-balance">
              {actual.pregunta}
            </p>
            <p className="mt-8 text-lg text-primary">
              {actual.anonima ? 'Anónimo' : actual.nombre}
            </p>
          </>
        ) : (
          <p className="text-2xl text-white/40">
            {soloPendientes ? 'No quedan preguntas pendientes.' : 'Todavía no hay preguntas.'}
          </p>
        )}
      </main>

      {/* Controles */}
      <footer className="flex items-center justify-center gap-3 px-6 py-6 border-t border-white/10">
        <Button
          variant="outline"
          size="lg"
          onClick={() => mover(-1)}
          disabled={!actual || posicion === 0}
          className="bg-transparent border-white/20 text-white hover:bg-white/10"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>

        {actual && (
          <>
            <Button
              size="lg"
              onClick={() => marcar(!actual.respondida)}
              disabled={ocupado}
              variant={actual.respondida ? 'outline' : 'default'}
              className={actual.respondida
                ? 'bg-transparent border-white/20 text-white hover:bg-white/10'
                : ''}
            >
              <Check className="w-5 h-5 mr-2" />
              {actual.respondida ? 'Sin responder' : 'Respondida'}
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={borrar}
              disabled={ocupado}
              className="bg-transparent border-red-500/40 text-red-300 hover:bg-red-500/10"
            >
              <Trash2 className="w-5 h-5" />
            </Button>
          </>
        )}

        <Button
          variant="outline"
          size="lg"
          onClick={() => mover(1)}
          disabled={!actual || posicion >= preguntas.length - 1}
          className="bg-transparent border-white/20 text-white hover:bg-white/10"
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
      </footer>
    </div>
  );
}
