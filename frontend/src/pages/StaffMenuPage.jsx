import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, LayoutDashboard, LogOut, QrCode, Timer, UserCog } from 'lucide-react';
import AdminLogin from '../components/AdminLogin';
import { adminToken } from '../lib/adminApi';
import { useRaceConfig } from '../contexts/RaceConfigContext';
import { clearAppRole } from '../lib/appRole';

/**
 * Menú del rol Staff en la app: tras iniciar sesión con las credenciales del
 * panel, muestra solo las herramientas que los permisos del perfil habilitan.
 */
export default function StaffMenuPage() {
  const navigate = useNavigate();
  const { raceName } = useRaceConfig();

  // Sin sesión: mismo login del panel, pero regresando aquí al entrar.
  if (!adminToken()) {
    return <AdminLogin redirectTo="/staff" />;
  }

  const username = localStorage.getItem('admin_username') || '';
  const isAdmin = localStorage.getItem('admin_is_admin') === 'true';
  let permissions = [];
  try {
    permissions = JSON.parse(localStorage.getItem('admin_permissions') || '[]');
  } catch {
    permissions = [];
  }
  const can = (permission) => isAdmin || permissions.includes(permission);

  const tools = [
    can('scanner') && {
      to: '/scan',
      icon: QrCode,
      title: 'Escáner QR',
      description: 'Registrar vueltas escaneando el código de cada atleta',
    },
    can('control') && {
      to: '/admin/race-control',
      icon: Timer,
      title: 'Control de carrera',
      description: 'Vueltas, retiros y estado de los corredores',
    },
    (isAdmin || permissions.length > 0) && {
      to: '/admin',
      icon: LayoutDashboard,
      title: 'Panel administrativo',
      description: 'Todas las secciones que tu perfil tiene habilitadas',
    },
  ].filter(Boolean);

  const logout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_username');
    localStorage.removeItem('admin_is_admin');
    localStorage.removeItem('admin_permissions');
    navigate('/staff');
  };

  const changeRole = () => {
    clearAppRole();
    navigate('/app');
  };

  return (
    <div className="min-h-screen bg-[#0C0C0C] text-white px-6 pb-10 pt-[calc(2.5rem+env(safe-area-inset-top))]">
      <div className="max-w-md w-full mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <span className="w-12 h-12 rounded-full bg-[#E77622]/15 flex items-center justify-center shrink-0">
            <UserCog className="w-6 h-6 text-[#E77622]" />
          </span>
          <div>
            <h1 className="text-xl font-bold">Staff</h1>
            <p className="text-xs text-gray-400">
              {username} · {raceName}
            </p>
          </div>
        </div>

        {tools.length === 0 && (
          <p className="text-sm text-gray-400 mb-4">
            Tu usuario no tiene herramientas habilitadas. Contacta al administrador.
          </p>
        )}

        <div className="space-y-4">
          {tools.map(({ to, icon: Icon, title, description }) => (
            <button
              key={to}
              onClick={() => navigate(to)}
              className="w-full flex items-center gap-4 text-left rounded-2xl bg-[#161616] border border-[#242424] px-5 py-5 hover:border-[#E77622] transition-colors"
            >
              <span className="w-12 h-12 rounded-full bg-[#E77622]/15 flex items-center justify-center shrink-0">
                <Icon className="w-6 h-6 text-[#E77622]" />
              </span>
              <span className="flex-1">
                <span className="block text-base font-bold">{title}</span>
                <span className="block text-xs text-gray-400 mt-1">{description}</span>
              </span>
              <ChevronRight className="w-5 h-5 text-gray-500 shrink-0" />
            </button>
          ))}
        </div>

        <div className="mt-8 space-y-3">
          <button
            onClick={changeRole}
            className="w-full text-sm text-gray-400 hover:text-white py-2 transition-colors"
          >
            Cambiar de rol
          </button>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-white py-2 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
