import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, UserPlus } from 'lucide-react';
import { useLiveTheme } from '../liveTheme';
import { haySesion } from '../sesion';
import { clic } from '../sonido';

// El favorito queda marcado igual: esto no es una barrera, es el momento de
// contar que los avisos en tiempo real —el push cuando su corredor completa
// una vuelta— van atados a una cuenta. Se enseña al marcar, que es cuando la
// persona acaba de demostrar que ese corredor le importa.
const AVISO_KEY = 'bysd_live_aviso_favorito';

/** true si al marcar un favorito toca enseñar el aviso de registro. */
export function debeAvisarFavorito() {
  if (haySesion()) return false;
  try { return localStorage.getItem(AVISO_KEY) !== 'off'; } catch { return false; }
}

/**
 * Emergente al marcar un favorito sin sesión: para recibir las actualizaciones
 * en tiempo real hace falta una cuenta. Ofrece ir al registro (de espectador,
 * el tipo que ya sale elegido) y un "no volver a mostrar" que se respeta.
 */
export default function AvisoFavorito({ abierto, onCerrar }) {
  const navigate = useNavigate();
  const { T } = useLiveTheme();
  const [noMostrar, setNoMostrar] = useState(false);

  if (!abierto) return null;

  const cerrar = () => {
    if (noMostrar) {
      try { localStorage.setItem(AVISO_KEY, 'off'); } catch { /* modo privado */ }
    }
    onCerrar();
  };

  const crearCuenta = () => {
    clic();
    cerrar();
    navigate('/live/login', { state: { modo: 'registro' } });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-7"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(2px)' }}
      onClick={cerrar}
    >
      <div
        onClick={(ev) => ev.stopPropagation()}
        className={`w-full max-w-sm rounded-3xl border border-white/12 px-6 py-7 text-center
          shadow-[0_20px_60px_rgba(0,0,0,0.6)] ${T.drawer}`}
      >
        <div className="w-12 h-12 rounded-full grid place-items-center mx-auto
          border border-[rgba(231,118,34,0.45)] bg-[rgba(231,118,34,0.10)]">
          <Star className="w-5 h-5 text-[#E77622] fill-[#E77622]" />
        </div>

        <p className="mt-4 text-[13px] font-bold">Favorito guardado</p>
        <p className={`mt-2 text-[11.5px] leading-relaxed ${T.muted}`}>
          Para recibir actualizaciones en tiempo real de tus corredores
          favoritos —como el aviso de cada vuelta completada— necesitas
          registrarte.
        </p>

        <button
          type="button"
          onClick={crearCuenta}
          className="w-full mt-6 rounded-full px-5 py-3.5 flex items-center justify-center gap-2
            border border-[rgba(231,118,34,0.5)] bg-[rgba(231,118,34,0.06)] text-[12px]
            uppercase tracking-[0.14em] text-[#E77622] active:scale-[0.985]
            transition-all duration-100"
        >
          <UserPlus className="w-4 h-4" />
          Crear cuenta
        </button>
        <button
          type="button"
          onClick={cerrar}
          className={`w-full mt-2 py-2.5 text-[11px] uppercase tracking-[0.14em] ${T.muted}`}
        >
          Ahora no
        </button>

        <label className={`flex items-center justify-center gap-2 mt-3 text-[11px] ${T.muted}`}>
          <input
            type="checkbox"
            checked={noMostrar}
            onChange={(ev) => setNoMostrar(ev.target.checked)}
          />
          No volver a mostrar
        </label>
      </div>
    </div>
  );
}
