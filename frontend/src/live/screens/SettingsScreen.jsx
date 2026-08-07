import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sun, Moon, Bell, Star, Trash2, UserCog, ChevronRight } from 'lucide-react';
import { NOTIF_KEY, FOLLOWED_KEY } from '../liveApi';
import { useLiveTheme } from '../liveTheme';
import { Screen } from '../LiveApp';
import { isNative } from '../../lib/platform';
import { clearAppRole } from '../../lib/appRole';

function Toggle({ on, onChange }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={onChange}
      className={`w-12 h-7 rounded-full relative transition-colors ${on ? 'bg-[#E77622]' : 'bg-gray-500/40'}`}
    >
      <span
        className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? 'left-6' : 'left-1'}`}
      />
    </button>
  );
}

/**
 * Configuración: modo claro/oscuro y notificaciones de vueltas.
 */
export default function SettingsScreen() {
  const navigate = useNavigate();
  const { theme, toggleTheme, T } = useLiveTheme();
  const [notifOn, setNotifOn] = useState(() => localStorage.getItem(NOTIF_KEY) === 'on');
  const [notifMsg, setNotifMsg] = useState(null);

  const handleNotifToggle = async () => {
    if (notifOn) {
      localStorage.setItem(NOTIF_KEY, 'off');
      setNotifOn(false);
      setNotifMsg(null);
      return;
    }
    if (!('Notification' in window)) {
      setNotifMsg('Este navegador no soporta notificaciones.');
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      localStorage.setItem(NOTIF_KEY, 'on');
      setNotifOn(true);
      setNotifMsg('Recibirás un aviso cuando tus favoritos completen una vuelta (con la app abierta).');
    } else {
      setNotifMsg('Permiso denegado. Actívalo en la configuración de tu navegador.');
    }
  };

  const clearFavorites = () => {
    if (window.confirm('¿Borrar tu lista de corredores favoritos?')) {
      localStorage.setItem(FOLLOWED_KEY, JSON.stringify([]));
    }
  };

  return (
    <Screen title="Configuración">
      <div className="px-4 py-4">
        <div className={`rounded-2xl ${T.card}`}>
          <div className={`flex items-center gap-3.5 px-4 py-4 border-b ${T.divider}`}>
            {theme === 'dark' ? (
              <Moon className="w-5 h-5 text-[#E77622] shrink-0" />
            ) : (
              <Sun className="w-5 h-5 text-[#E77622] shrink-0" />
            )}
            <div className="flex-1">
              <p className="text-sm font-bold">Modo oscuro</p>
              <p className={`text-[11px] mt-0.5 ${T.muted}`}>
                {theme === 'dark' ? 'Ideal para las horas nocturnas de la carrera' : 'Cambia a oscuro para la noche'}
              </p>
            </div>
            <Toggle on={theme === 'dark'} onChange={toggleTheme} />
          </div>

          <div className="flex items-center gap-3.5 px-4 py-4">
            <Bell className="w-5 h-5 text-[#E77622] shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold">Notificaciones de vueltas</p>
              <p className={`text-[11px] mt-0.5 ${T.muted}`}>
                Aviso cuando tus favoritos completen una vuelta (con la app abierta)
              </p>
            </div>
            <Toggle on={notifOn} onChange={handleNotifToggle} />
          </div>
        </div>
        {notifMsg && <p className={`text-xs mt-2 px-1 ${T.muted}`}>{notifMsg}</p>}

        <div className={`rounded-2xl mt-4 ${T.card}`}>
          <button onClick={clearFavorites} className="w-full flex items-center gap-3.5 px-4 py-4 text-left">
            <Star className="w-5 h-5 text-[#E77622] shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold">Borrar favoritos</p>
              <p className={`text-[11px] mt-0.5 ${T.muted}`}>Vacía tu lista de corredores seguidos</p>
            </div>
            <Trash2 className={`w-4 h-4 ${T.subtle}`} />
          </button>
        </div>

        {isNative() && (
          <div className={`rounded-2xl mt-4 ${T.card}`}>
            <button
              onClick={() => {
                clearAppRole();
                navigate('/app');
              }}
              className="w-full flex items-center gap-3.5 px-4 py-4 text-left"
            >
              <UserCog className="w-5 h-5 text-[#E77622] shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-bold">Cambiar de rol</p>
                <p className={`text-[11px] mt-0.5 ${T.muted}`}>Volver a elegir espectador, atleta o staff</p>
              </div>
              <ChevronRight className={`w-4 h-4 ${T.subtle}`} />
            </button>
          </div>
        )}

        <p className={`text-[10px] text-center mt-8 ${T.subtle}`}>
          BYSD Live · Backyard Ultra Santo Domingo
        </p>
      </div>
    </Screen>
  );
}
