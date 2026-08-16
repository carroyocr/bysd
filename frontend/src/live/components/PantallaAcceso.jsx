import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { clic } from '../sonido';

/**
 * El haz de luz cálido sobre negro del camino de entrada. Las cuatro pantallas
 * que lo usan —elegir quién entra, el login del corredor, el del staff y la
 * portada de la carrera— se leen así como una sola pieza.
 */
export const FONDO_NOCTURNO =
  'radial-gradient(90% 55% at 50% -8%, rgba(231,118,34,.30) 0%, rgba(231,118,34,.06) 45%, transparent 72%),'
  + 'radial-gradient(70% 45% at 50% 108%, rgba(133,183,235,.10) 0%, transparent 70%),'
  + '#070707';

/**
 * Envoltorio de las pantallas de acceso: fondo nocturno, sin barra ni menú, y
 * una flecha para volver.
 *
 * Va siempre oscuro aunque el tema esté en claro. No es un descuido: el
 * nocturno es un haz de luz sobre negro, y sobre el crema del tema claro no
 * queda un haz, queda una mancha.
 */
export default function PantallaAcceso({ volverA = '/live/login', children }) {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-[100dvh] text-[#EFE9DD]"
      style={{ background: FONDO_NOCTURNO, WebkitTapHighlightColor: 'transparent' }}
    >
      <div className="w-full max-w-md mx-auto px-5 pb-10 pt-[calc(1.25rem+env(safe-area-inset-top))] min-h-[100dvh] flex flex-col">
        <button
          onClick={() => { clic(); navigate(volverA); }}
          className="self-start p-2 -ml-2 text-[#a49c8f]"
          aria-label="Volver"
        >
          <ArrowLeft className="w-5 h-5" strokeWidth={1.6} />
        </button>
        {children}
      </div>
    </div>
  );
}

/**
 * La tarjeta de vidrio donde vive cada formulario de acceso. Mismo material
 * que las píldoras de la pantalla de roles: fondo apenas iluminado y borde
 * tenue, para que la luz de arriba se siga viendo por detrás.
 */
export function TarjetaAcceso({ Icono, titulo, subtitulo, children }) {
  return (
    <div className="mt-6 rounded-[22px] border border-white/[0.09] bg-white/[0.04] px-5 py-6">
      <div className="flex flex-col items-center mb-5 text-center">
        {Icono && (
          <span
            className="w-14 h-14 rounded-full grid place-items-center mb-3 text-[#E77622]
              border border-[rgba(231,118,34,0.45)]
              shadow-[0_0_28px_rgba(231,118,34,0.22),inset_0_0_18px_rgba(231,118,34,0.12)]"
          >
            <Icono className="w-6 h-6" strokeWidth={1.6} />
          </span>
        )}
        <h2 className="text-[13px] font-normal uppercase tracking-[0.2em] text-white">{titulo}</h2>
        {subtitulo && (
          <p className="text-[11px] mt-2 text-[#a49c8f] leading-relaxed">{subtitulo}</p>
        )}
      </div>
      {children}
    </div>
  );
}
