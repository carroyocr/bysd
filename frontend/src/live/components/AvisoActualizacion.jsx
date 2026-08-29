import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowUpCircle } from 'lucide-react';
import { useLiveTheme } from '../liveTheme';
import { buscarActualizacion, silenciarVersion } from '../actualizacion';
import { openExternal } from '../../lib/nativeExport';
import { clic } from '../sonido';
import { VERSION } from '../version';

/**
 * Aviso de versión nueva al abrir la app.
 *
 * Invita, no obliga: quien diga "ahora no" sigue usando la app y no se le
 * vuelve a preguntar por esa misma versión (cuando salga la siguiente, sí).
 *
 * No sale sobre la pantalla de bienvenida —esa dura cuatro segundos y ya
 * tiene su propio protagonismo—, sino en cuanto la app aterriza en una
 * pantalla de verdad.
 */
export default function AvisoActualizacion() {
  const { T } = useLiveTheme();
  const location = useLocation();
  const [nueva, setNueva] = useState(null);

  useEffect(() => {
    let cancel = false;
    buscarActualizacion().then((r) => { if (!cancel) setNueva(r); });
    return () => { cancel = true; };
  }, []);

  const enBienvenida = location.pathname === '/live' || location.pathname === '/live/';
  if (!nueva || enBienvenida) return null;

  const cerrar = () => {
    silenciarVersion(nueva.version);
    setNueva(null);
  };

  const actualizar = () => {
    clic();
    silenciarVersion(nueva.version);
    setNueva(null);
    openExternal(nueva.url);
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
          <ArrowUpCircle className="w-6 h-6 text-[#E77622]" />
        </div>

        <h2 className="mt-4 text-lg font-extrabold">Hay una versión nueva</h2>

        <p className={`mt-2 text-sm leading-relaxed ${T.muted}`}>
          BYSD Live {nueva.version} ya está en la tienda. Tienes la {VERSION}.
        </p>

        <button
          onClick={actualizar}
          className="mt-6 w-full rounded-2xl bg-[#E77622] text-white font-bold py-3.5 text-sm"
        >
          Actualizar
        </button>

        <button
          onClick={cerrar}
          className={`mt-3 w-full rounded-2xl py-3 text-sm font-semibold ${T.actionChip}`}
        >
          Ahora no
        </button>
      </div>
    </div>
  );
}
