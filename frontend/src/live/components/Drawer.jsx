import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Home, Radio, Info, User, Building2, Settings, Trophy, X, RefreshCcw, ShieldCheck, LogIn,
  BadgeInfo,
} from 'lucide-react';
import { useLiveTheme } from '../liveTheme';
import { sesionesAbiertas } from '../sesion';
import { VERSION_CORTA } from '../version';

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

  // Cada acceso se muestra solo si su sesión está abierta: el corredor no ve
  // que exista un acceso de staff, y el del staff no ve el del corredor. Van
  // justo debajo de Inicio, que es lo primero que busca quien ya entró.
  const { atleta, staff } = sesionesAbiertas();
  const accesos = [];
  if (atleta) accesos.push({ label: 'Perfil del corredor', Icon: User, action: () => go('/live/perfil') });
  if (staff) accesos.push({ label: 'Staff', Icon: ShieldCheck, action: () => go('/live/staff') });

  const items = [
    { label: 'Inicio', Icon: Home, action: () => go(base) },
    { label: 'Información de la Carrera', Icon: Info, action: () => go(`${base}/info`) },
    { label: 'Seguimiento', Icon: Radio, action: () => go(`${base}/seguimiento`) },
    ...accesos,
    { label: 'Patrocinadores', Icon: Building2, action: () => go(`${base}/patrocinadores`) },
    { label: 'Ganadores', Icon: Trophy, action: () => go(`${base}/ganadores`) },
    { label: 'Cambiar de carrera', Icon: RefreshCcw, action: () => go('/live/carreras') },
    { label: 'Configuración', Icon: Settings, action: () => go(`${base}/config`) },
    // Sin sesión, la única entrada es "Iniciar sesión" y ahí dentro se elige
    // quién eres. El menú es para seguir la carrera.
    ...(accesos.length === 0
      ? [{ label: 'Iniciar sesión', Icon: LogIn, action: () => go('/live/login') }]
      : []),
    { label: 'Acerca de', Icon: BadgeInfo, action: () => go('/live/acerca') },
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
        <p className={`px-4 pt-4 pb-1 text-[10px] ${T.subtle}`}>
          Backyard Ultra Santo Domingo
        </p>
        {/* La versión a la vista: cuando alguien reporta algo, es lo primero
            que hace falta saber. */}
        <p className={`px-4 pb-4 text-[10px] font-mono ${T.subtle}`}>{VERSION_CORTA}</p>
      </aside>
    </div>
  );
}
