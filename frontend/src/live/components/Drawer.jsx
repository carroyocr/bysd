import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Home, Radio, Info, User, Building2, Settings, Trophy, X, RefreshCcw, ShieldCheck,
} from 'lucide-react';
import { useLiveTheme } from '../liveTheme';

/**
 * Menú lateral expandible de izquierda a derecha (estilo app de maratón).
 */
export default function Drawer({ open, onClose, raceCode, raceName }) {
  const { T } = useLiveTheme();
  const navigate = useNavigate();

  const go = (path) => {
    onClose();
    navigate(path);
  };

  const base = `/live/${raceCode}`;
  const items = [
    { label: 'Inicio', Icon: Home, action: () => go(base) },
    { label: 'Seguimiento', Icon: Radio, action: () => go(`${base}/seguimiento`) },
    { label: 'Ganadores', Icon: Trophy, action: () => go(`${base}/ganadores`) },
    { label: 'Información de la Carrera', Icon: Info, action: () => go(`${base}/info`) },
    { label: 'Perfil del corredor', Icon: User, action: () => go('/live/perfil') },
    { label: 'Patrocinadores', Icon: Building2, action: () => go(`${base}/patrocinadores`) },
    { label: 'Configuración', Icon: Settings, action: () => go(`${base}/config`) },
    { label: 'Cambiar de carrera', Icon: RefreshCcw, action: () => go('/live/carreras') },
    { label: 'Staff', Icon: ShieldCheck, action: () => go('/live/staff') },
  ];

  return (
    <div
      className={`fixed inset-0 z-50 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
    >
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <aside
        className={`absolute top-0 left-0 h-full w-[82%] max-w-[320px] flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] transition-transform duration-250 ease-out ${T.drawer} ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-4 h-16 shrink-0">
          <div className="font-extrabold tracking-wide text-base">
            BYSD <span className="text-[#E77622]">LIVE</span>
          </div>
          <button aria-label="Cerrar menú" onClick={onClose} className="w-9 h-9 flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>
        {raceName && (
          <p className={`px-4 pb-3 text-xs ${T.muted}`}>{raceName}</p>
        )}
        <nav className="flex-1 overflow-y-auto">
          {items.map(({ label, Icon, action }) => (
            <button
              key={label}
              onClick={action}
              className={`w-full flex items-center gap-3.5 px-4 py-4 text-left text-sm font-semibold ${T.drawerItem}`}
            >
              <Icon className="w-5 h-5 text-[#E77622] shrink-0" strokeWidth={2} />
              {label}
            </button>
          ))}
        </nav>
        <p className={`px-4 py-4 text-[10px] ${T.subtle}`}>
          Backyard Ultra Santo Domingo · backyardultrasantodomingo.com
        </p>
      </aside>
    </div>
  );
}
