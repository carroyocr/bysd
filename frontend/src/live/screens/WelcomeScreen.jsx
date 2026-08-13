import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame } from 'lucide-react';
import { VERSION_CORTA } from '../version';

/**
 * Pantalla de bienvenida: marca a pantalla completa y pase automático a la
 * pantalla de acceso (o toque para saltarla).
 *
 * De aquí se sale siempre al login, que es donde se elige quién entra:
 * corredor, staff o espectador. Antes se caía directo en el selector de
 * carreras y el acceso quedaba escondido en el menú lateral.
 */
export default function WelcomeScreen() {
  const navigate = useNavigate();

  useEffect(() => {
    // 4 s: da tiempo a leer la version antes de pasar, y se puede saltar tocando
    const id = setTimeout(() => navigate('/live/login', { replace: true }), 4000);
    return () => clearTimeout(id);
  }, [navigate]);

  return (
    <div
      className="min-h-[100dvh] bg-[#0C0C0C] text-white flex flex-col items-center justify-center px-8 cursor-pointer"
      onClick={() => navigate('/live/login', { replace: true })}
    >
      <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-[#E77622] to-[#F5A623] flex items-center justify-center shadow-[0_0_60px_rgba(231,118,34,0.45)] animate-pulse">
        <Flame className="w-12 h-12 text-white" strokeWidth={2.2} />
      </div>
      <h1 className="mt-8 text-3xl font-extrabold tracking-wide text-center">
        BYSD <span className="text-[#E77622]">LIVE</span>
      </h1>
      <p className="mt-2 text-sm text-[#9a9a9a] text-center">
        Backyard Ultra Santo Domingo
      </p>
      <p className="mt-1.5 text-[11px] font-mono text-[#6b6b6b] text-center">{VERSION_CORTA}</p>
      <p className="mt-10 text-[11px] tracking-[0.25em] text-[#666666] uppercase">
        Last One Standing
      </p>
    </div>
  );
}
