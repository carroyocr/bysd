import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Home, Radio, Info, User, Building2, Settings, Trophy, X, ShieldCheck, LogIn,
  LogOut, BadgeInfo, ChevronDown, Loader2, CalendarDays,
} from 'lucide-react';
import { getJson } from '../liveApi';
import { useLiveTheme } from '../liveTheme';
import { zonasAbiertas, cerrarSesion, haySesion } from '../sesion';
import { guardarCarrera, agruparCarreras } from '../carrera';
import { VERSION_CORTA } from '../version';
import PresentedBy from '../../components/PresentedBy';

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

  // Ganadores y Patrocinadores no se ofrecen vacios: hasta que hay un ganador
  // publicado, o al menos un patrocinador, esas pantallas no tienen nada que
  // ensenar y solo defraudan a quien entra. Se consulta al abrir el menu y no
  // al montarlo: durante la carrera el ganador aparece con la app abierta.
  const [hayGanador, setHayGanador] = useState(false);
  const [hayPatrocinadores, setHayPatrocinadores] = useState(false);

  useEffect(() => {
    if (!open || !raceCode) return;
    let cancel = false;

    getJson(`/api/race/stats?race_code=${raceCode}`)
      .then((d) => { if (!cancel) setHayGanador(!!d?.winner); })
      .catch(() => {});

    getJson(`/api/sponsors/race/${raceCode}?destino=app`)
      .then((d) => {
        if (cancel) return;
        const lista = Array.isArray(d) ? d : (d?.sponsors || []);
        setHayPatrocinadores(lista.length > 0);
      })
      .catch(() => {});

    return () => { cancel = true; };
  }, [open, raceCode]);

  // Evento es un acordeón: dentro van las carreras en dos grupos, próximas y
  // pasadas, y elegir una desde aquí es LA forma de cambiar de carrera (la
  // entrada "Cambiar de carrera" se retiró). La elección abre el home de ese
  // evento, se guarda en el teléfono y es con la que la app abre la próxima
  // vez.
  const [segAbierto, setSegAbierto] = useState(false);
  const [grupo, setGrupo] = useState('proximas');
  const [carreras, setCarreras] = useState(null);

  // Al cerrar el menú, el acordeón vuelve a su posición de partida: quien lo
  // reabre busca el menú de siempre, no el estado en que lo dejó.
  useEffect(() => {
    if (!open) { setSegAbierto(false); setGrupo('proximas'); }
  }, [open]);

  useEffect(() => {
    if (!segAbierto || carreras !== null) return;
    getJson('/api/race-config/all')
      .then((d) => setCarreras(d?.races || []))
      .catch(() => setCarreras([]));
  }, [segAbierto, carreras]);

  const grupos = agruparCarreras(carreras || []);

  const irACarrera = (code) => {
    guardarCarrera(code);
    onClose();
    navigate(`/live/${code}`);
  };

  // Cada acceso se muestra solo si su sesión está abierta: el corredor no ve
  // que exista un acceso de staff, y el del staff no ve el del corredor. Van
  // justo debajo de Home, que es lo primero que busca quien ya entró.
  const { atleta, staff } = zonasAbiertas();
  const accesos = [];
  if (atleta) accesos.push({ label: 'Perfil del corredor', Icon: User, action: () => go('/live/perfil') });
  if (staff) accesos.push({ label: 'Staff', Icon: ShieldCheck, action: () => go('/live/staff') });

  // Salir se hace desde aquí, no desde el perfil: es donde se busca, y desde
  // cualquier pantalla. Cierra lo que haya abierto y deja la app en el acceso,
  // que es la primera pantalla de la app.
  const salir = async () => {
    onClose();
    await cerrarSesion();
    navigate('/live/login', { replace: true });
  };

  const items = [
    { label: 'Home', Icon: Home, action: () => go(base) },
    // "Evento" es el acordeón de carreras: elegir una abre su home y queda
    // guardada. "Seguimiento" va directo a los corredores de la actual, igual
    // que el botón de la parte baja del home.
    { evento: true },
    { label: 'Seguimiento', Icon: Radio, action: () => go(`${base}/seguimiento`) },
    { label: 'Información de la Carrera', Icon: Info, action: () => go(`${base}/info`) },
    ...accesos,
    hayPatrocinadores && { label: 'Patrocinadores', Icon: Building2, action: () => go(`${base}/patrocinadores`) },
    hayGanador && { label: 'Ganadores', Icon: Trophy, action: () => go(`${base}/ganadores`) },
    { label: 'Configuración', Icon: Settings, action: () => go(`${base}/config`) },
    // Sin sesión, la única entrada es "Iniciar sesión" y ahí dentro se elige
    // quién eres. Lo que decide es la sesión, no los accesos: el espectador no
    // tiene zona propia en el menú, pero su sesión es tan real como las demás
    // y también se cierra desde aquí.
    ...(haySesion()
      ? [{ label: 'Cerrar sesión', Icon: LogOut, action: salir }]
      : [{ label: 'Iniciar sesión', Icon: LogIn, action: () => go('/live/login') }]),
    { label: 'Acerca de', Icon: BadgeInfo, action: () => go('/live/acerca') },
  ].filter(Boolean);

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
          {items.map((item) => (item.evento ? (
            <div key="evento">
              <button
                onClick={() => setSegAbierto((v) => !v)}
                className={`w-full flex items-center gap-3.5 px-4 py-4 text-left text-sm font-semibold ${T.drawerItem}`}
              >
                <CalendarDays className="w-5 h-5 text-[#E77622] shrink-0" strokeWidth={2} />
                Evento
                <ChevronDown
                  className={`w-4 h-4 ml-auto shrink-0 transition-transform ${T.muted} ${segAbierto ? 'rotate-180' : ''}`}
                />
              </button>

              {segAbierto && carreras === null && (
                <div className={`flex justify-center py-3 ${T.muted}`}>
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              )}

              {segAbierto && carreras !== null && [
                { key: 'proximas', etiqueta: 'Próximas carreras', lista: grupos.proximas },
                { key: 'pasadas', etiqueta: 'Carreras pasadas', lista: grupos.pasadas },
              ].map(({ key, etiqueta, lista }) => (
                <div key={key}>
                  <button
                    onClick={() => setGrupo((g) => (g === key ? null : key))}
                    className={`w-full flex items-center gap-2 pl-[52px] pr-4 py-3 text-left text-[12px] font-semibold ${T.drawerItem}`}
                  >
                    {etiqueta}
                    <span className={`text-[11px] font-normal ${T.subtle}`}>({lista.length})</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 ml-auto shrink-0 transition-transform ${T.subtle} ${grupo === key ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {grupo === key && lista.map((r) => (
                    <button
                      key={r.code}
                      onClick={() => irACarrera(r.code)}
                      className={`w-full flex items-center gap-2 pl-[64px] pr-4 py-2.5 text-left ${T.drawerItem}`}
                    >
                      <span className={`text-[12px] leading-snug ${r.code === raceCode ? 'font-bold text-[#E77622]' : ''}`}>
                        {r.name}
                      </span>
                    </button>
                  ))}
                  {grupo === key && lista.length === 0 && (
                    <p className={`pl-[64px] pr-4 py-2.5 text-[11px] ${T.subtle}`}>
                      No hay carreras aquí.
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <button
              key={item.label}
              onClick={item.action}
              className={`w-full flex items-center gap-3.5 px-4 py-4 text-left text-sm font-semibold ${T.drawerItem}`}
            >
              <item.Icon className="w-5 h-5 text-[#E77622] shrink-0" strokeWidth={2} />
              {item.label}
            </button>
          )))}
        </nav>
        <p className={`px-4 pt-4 pb-1 text-[10px] ${T.subtle}`}>
          Backyard Ultra Santo Domingo
        </p>
        <PresentedBy
          raceCode={raceCode}
          size="xs"
          fondo={T.name === 'dark' ? 'oscuro' : 'claro'}
          className="px-4 pb-2"
        />
        {/* La versión a la vista: cuando alguien reporta algo, es lo primero
            que hace falta saber. */}
        <p className={`px-4 pb-4 text-[10px] font-mono ${T.subtle}`}>{VERSION_CORTA}</p>
      </aside>
    </div>
  );
}
