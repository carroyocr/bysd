import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { getJson } from '../liveApi';
import { carreraDeEntrada } from '../carrera';

// El mismo haz de luz que la puerta: este paso dura un instante y debe leerse
// como parte de ella, no como una pantalla distinta que parpadea.
const FONDO_NOCTURNO =
  'radial-gradient(90% 55% at 50% -8%, rgba(231,118,34,.30) 0%, rgba(231,118,34,.06) 45%, transparent 72%),'
  + 'radial-gradient(70% 45% at 50% 108%, rgba(133,183,235,.10) 0%, transparent 70%),'
  + '#070707';

/**
 * Paso invisible entre la puerta y la carrera: decide con cuál abrir.
 *
 * Aquí no se elige nada; se entra directo a la carrera guardada o, en su
 * defecto, a la más próxima. Elegir otra se hace desde el menú lateral, en el
 * acordeón de Seguimiento. Si el backend no responde o no hay carreras, se cae
 * al selector clásico, que es la única pantalla que sabe decir "no hay nada".
 */
export default function EntradaScreen() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancel = false;
    getJson('/api/race-config/all')
      .then((data) => {
        if (cancel) return;
        const carrera = carreraDeEntrada(data?.races || []);
        navigate(carrera ? `/live/${carrera.code}` : '/live/carreras', { replace: true });
      })
      .catch(() => { if (!cancel) navigate('/live/carreras', { replace: true }); });
    return () => { cancel = true; };
  }, [navigate]);

  return (
    <div
      className="min-h-[100dvh] flex items-center justify-center text-[#a49c8f]"
      style={{ background: FONDO_NOCTURNO }}
    >
      <Loader2 className="w-6 h-6 animate-spin" />
    </div>
  );
}
