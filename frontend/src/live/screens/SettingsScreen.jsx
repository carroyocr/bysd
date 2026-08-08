import React, { useState } from 'react';
import { Sun, Moon, Bell, Star, Trash2 } from 'lucide-react';
import { NOTIF_KEY, FOLLOWED_KEY } from '../liveApi';
import { pushDisponible, activarPush, desactivarPush, sincronizarSeguidos } from '../push';
import { useLiveTheme } from '../liveTheme';
import { Screen, useRace } from '../LiveApp';

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
  const { theme, toggleTheme, T } = useLiveTheme();
  const { raceCode } = useRace() || {};
  const [notifOn, setNotifOn] = useState(() => localStorage.getItem(NOTIF_KEY) === 'on');
  const [notifMsg, setNotifMsg] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  // En la app instalada los avisos llegan por push (aunque esté cerrada); en
  // el navegador solo se puede avisar con la pestaña abierta.
  const nativo = pushDisponible();

  const MOTIVOS = {
    denegado: 'Permiso denegado. Actívalo en los ajustes del teléfono, en las notificaciones de BYSD Live.',
    'sin-token': 'No se pudo registrar el dispositivo. Revisa tu conexión e inténtalo de nuevo.',
    error: 'No se pudo activar. Revisa tu conexión e inténtalo de nuevo.',
  };

  const apagar = async () => {
    localStorage.setItem(NOTIF_KEY, 'off');
    setNotifOn(false);
    setNotifMsg(null);
    if (nativo) await desactivarPush();
  };

  const handleNotifToggle = async () => {
    if (ocupado) return;
    if (notifOn) {
      setOcupado(true);
      await apagar();
      setOcupado(false);
      return;
    }

    if (nativo) {
      setOcupado(true);
      const { ok, motivo } = await activarPush(raceCode);
      setOcupado(false);
      if (ok) {
        localStorage.setItem(NOTIF_KEY, 'on');
        setNotifOn(true);
        setNotifMsg('Te avisaremos cuando tus favoritos completen una vuelta o queden fuera, aunque la app esté cerrada.');
      } else {
        setNotifMsg(MOTIVOS[motivo] || MOTIVOS.error);
      }
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
      // Sin esto el backend seguiría mandando avisos de los que ya no sigue.
      sincronizarSeguidos(raceCode);
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
                {nativo
                  ? 'Aviso cuando tus favoritos completen una vuelta o queden fuera'
                  : 'Aviso cuando tus favoritos completen una vuelta (con la app abierta)'}
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

        <p className={`text-[10px] text-center mt-8 ${T.subtle}`}>
          BYSD Live · Backyard Ultra Santo Domingo
        </p>
      </div>
    </Screen>
  );
}
