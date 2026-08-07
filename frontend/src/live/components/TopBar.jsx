import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, ChevronLeft } from 'lucide-react';
import { useLiveTheme } from '../liveTheme';

/**
 * Barra superior fija: hamburguesa (o atrás), título y botón SOS siempre visible.
 */
export default function TopBar({ title, onMenu, back = false, raceCode }) {
  const { T } = useLiveTheme();
  const navigate = useNavigate();

  return (
    <header className={`sticky top-0 z-40 flex items-center gap-2 px-2 h-14 ${T.bar}`}>
      {back ? (
        <button
          aria-label="Volver"
          onClick={() => navigate(-1)}
          className="w-10 h-10 flex items-center justify-center"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      ) : (
        <button
          aria-label="Menú"
          onClick={onMenu}
          className="w-10 h-10 flex items-center justify-center"
        >
          <Menu className="w-6 h-6" />
        </button>
      )}
      <h1 className="flex-1 text-center font-bold text-[15px] truncate">{title}</h1>
      <button
        aria-label="SOS"
        onClick={() => navigate(`/live/${raceCode || ''}/sos`.replace('//', '/'))}
        className="w-10 h-10 flex items-center justify-center"
      >
        <span className="bg-white text-red-600 text-[10px] font-extrabold rounded-full w-9 h-9 flex items-center justify-center shadow-md border border-red-600/30">
          SOS
        </span>
      </button>
    </header>
  );
}
