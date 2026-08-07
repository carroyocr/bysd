import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame } from 'lucide-react';

/**
 * Pantalla de bienvenida: marca a pantalla completa y pase automático al
 * selector de carreras (o toque para saltarla).
 */
export default function WelcomeScreen() {
  const navigate = useNavigate();

  useEffect(() => {
    const id = setTimeout(() => navigate('/live/carreras', { replace: true }), 2000);
    return () => clearTimeout(id);
  }, [navigate]);

  return (
    <div
      className="min-h-[100dvh] bg-[#0C0C0C] text-white flex flex-col items-center justify-center px-8 cursor-pointer"
      onClick={() => navigate('/live/carreras', { replace: true })}
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
      <p className="mt-10 text-[11px] tracking-[0.25em] text-[#666666] uppercase">
        Solo puede quedar uno
      </p>
    </div>
  );
}
