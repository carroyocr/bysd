import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, QrCode, Timer, LayoutDashboard, LogOut, ChevronRight, Eye, EyeOff, Lock,
  HeartPulse,
} from 'lucide-react';
import { authJson } from '../liveApi';
import { useLiveTheme } from '../liveTheme';
import { Screen } from '../LiveApp';

/**
 * Acceso del staff dentro de BYSD Live: inicia sesión con las credenciales
 * del panel y muestra solo las herramientas que los permisos del perfil
 * habilitan (escáner QR, control de carrera, panel completo).
 */
export default function StaffScreen() {
  const { T } = useLiveTheme();
  const navigate = useNavigate();

  const [logged, setLogged] = useState(() => !!localStorage.getItem('admin_token'));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const doLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { ok, data } = await authJson('POST', '/api/race/auth/admin-login', {
      body: { username, password },
    });
    setLoading(false);
    if (!ok) {
      setError(data.detail || 'Usuario o contraseña incorrectos');
      return;
    }
    localStorage.setItem('admin_token', data.token);
    localStorage.setItem('admin_username', data.username);
    localStorage.setItem('admin_is_admin', data.is_admin ? 'true' : 'false');
    localStorage.setItem('admin_permissions', JSON.stringify(data.permissions || []));
    setPassword('');
    setLogged(true);
  };

  const logout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_username');
    localStorage.removeItem('admin_is_admin');
    localStorage.removeItem('admin_permissions');
    setLogged(false);
  };

  if (!logged) {
    return (
      <Screen title="Staff">
        <div className="px-4 py-6">
          <div className={`rounded-2xl px-5 py-6 ${T.card}`}>
            <div className="flex flex-col items-center mb-5">
              <span className="w-14 h-14 rounded-full bg-[#E77622]/15 flex items-center justify-center mb-3">
                <ShieldCheck className="w-7 h-7 text-[#E77622]" />
              </span>
              <h2 className="text-lg font-bold">Acceso del staff</h2>
              <p className={`text-xs mt-1 ${T.muted}`}>Usa tus credenciales del panel</p>
            </div>
            <form onSubmit={doLogin} className="space-y-3">
              <label className="block">
                <span className={`block text-[11px] font-bold mb-1 ${T.muted}`}>Usuario</span>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoCapitalize="none"
                  className={`w-full rounded-xl px-3 py-2.5 text-sm outline-none ${T.input}`}
                />
              </label>
              <label className="block">
                <span className={`block text-[11px] font-bold mb-1 ${T.muted}`}>Contraseña</span>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className={`w-full rounded-xl px-3 py-2.5 text-sm outline-none ${T.input}`}
                  />
                  <button type="button" onClick={() => setShowPwd(!showPwd)} className={`absolute right-3 top-1/2 -translate-y-1/2 ${T.muted}`} aria-label="Mostrar contraseña">
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </label>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#E77622] hover:bg-[#d96a1a] text-white font-bold rounded-xl py-3 text-sm transition-colors disabled:opacity-50"
              >
                {loading ? 'Entrando…' : 'Iniciar sesión'}
              </button>
            </form>
          </div>
        </div>
      </Screen>
    );
  }

  const isAdmin = localStorage.getItem('admin_is_admin') === 'true';
  let permissions = [];
  try {
    permissions = JSON.parse(localStorage.getItem('admin_permissions') || '[]');
  } catch { /* sin permisos */ }
  const can = (p) => isAdmin || permissions.includes(p);

  // Dentro de la app el staff solo opera el escáner; el control de carrera
  // y el panel administrativo se usan desde la web.
  const tools = [
    can('scanner') && {
      to: '/scan',
      Icon: QrCode,
      title: 'Escáner QR',
      description: 'Registrar vueltas escaneando el código de cada atleta',
    },
    can('scanner') && {
      to: '/live/staff/atletas',
      Icon: HeartPulse,
      title: 'Atletas',
      description: 'Dorsal, tipo de sangre, alergias y contacto de emergencia',
    },
  ].filter(Boolean);

  return (
    <Screen title="Staff">
      <div className="px-4 py-4">
        <div className={`rounded-2xl px-4 py-4 flex items-center gap-3 ${T.card}`}>
          <span className="w-11 h-11 rounded-full bg-[#E77622]/15 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-[#E77622]" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold truncate">{localStorage.getItem('admin_username')}</p>
            <p className={`text-xs ${T.muted}`}>{isAdmin ? 'Administrador' : 'Miembro del staff'}</p>
          </div>
        </div>

        {tools.length === 0 && (
          <p className={`text-xs mt-4 px-1 ${T.muted}`}>
            Tu usuario no tiene herramientas habilitadas. Contacta al administrador.
          </p>
        )}

        <div className={`rounded-2xl mt-4 ${T.card}`}>
          {tools.map(({ to, Icon, title, description }, i) => (
            <button
              key={to}
              onClick={() => navigate(to)}
              className={`w-full flex items-center gap-3.5 px-4 py-4 text-left ${i < tools.length - 1 ? `border-b ${T.divider}` : ''}`}
            >
              <Icon className="w-5 h-5 text-[#E77622] shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold">{title}</p>
                <p className={`text-[11px] mt-0.5 ${T.muted}`}>{description}</p>
              </div>
              <ChevronRight className={`w-4 h-4 shrink-0 ${T.subtle}`} />
            </button>
          ))}
        </div>

        <div className={`rounded-2xl mt-4 ${T.card}`}>
          <button onClick={logout} className="w-full flex items-center gap-3.5 px-4 py-4 text-left">
            <LogOut className="w-5 h-5 text-[#E77622] shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold">Cerrar sesión</p>
              <p className={`text-[11px] mt-0.5 ${T.muted}`}>Salir del acceso de staff</p>
            </div>
          </button>
        </div>

        <p className={`text-[10px] flex items-center justify-center gap-1 text-center mt-6 ${T.subtle}`}>
          <Lock className="w-3 h-3" /> Acceso restringido al equipo organizador
        </p>
      </div>
    </Screen>
  );
}
