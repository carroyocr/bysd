import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Eye, Medal, ShieldCheck } from 'lucide-react';
import { useRaceConfig } from '../contexts/RaceConfigContext';
import { APP_ROLES, roleHome, setAppRole } from '../lib/appRole';

const ROLE_OPTIONS = [
  {
    role: APP_ROLES.ESPECTADOR,
    icon: Eye,
    title: 'Espectador',
    description: 'Sigue la carrera en vivo, tus corredores favoritos y envía ánimos. Sin registro.',
  },
  {
    role: APP_ROLES.ATLETA,
    icon: Medal,
    title: 'Atleta',
    description: 'Consulta y edita tu inscripción, tu perfil y tus comprobantes con tu código de acceso.',
  },
  {
    role: APP_ROLES.STAFF,
    icon: ShieldCheck,
    title: 'Staff',
    description: 'Acceso con usuario y contraseña a las herramientas del equipo, como el escáner QR.',
  },
];

/**
 * Pantalla de entrada de la app nativa: define con qué rol se usa la app.
 * El rol queda guardado y en próximos arranques se entra directo a su inicio;
 * siempre se puede volver aquí con "Cambiar de rol".
 */
export default function RoleSelectPage() {
  const navigate = useNavigate();
  const { raceName } = useRaceConfig();

  const choose = (role) => {
    setAppRole(role);
    navigate(roleHome(role));
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0C0C0C] text-white px-6 pb-10 pt-[calc(2.5rem+env(safe-area-inset-top))]">
      <div className="flex-1 flex flex-col justify-center max-w-md w-full mx-auto">
        <img
          src="/logo-backyard-ultra.png"
          alt="Backyard Ultra Santo Domingo"
          className="w-24 h-24 mx-auto mb-6"
        />
        <h1 className="text-2xl font-bold text-center">{raceName || 'Backyard Ultra Santo Domingo'}</h1>
        <p className="text-sm text-center text-gray-400 mt-2 mb-8">¿Cómo quieres usar la app?</p>

        <div className="space-y-4">
          {ROLE_OPTIONS.map(({ role, icon: Icon, title, description }) => (
            <button
              key={role}
              onClick={() => choose(role)}
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

        <p className="text-[11px] text-center text-gray-500 mt-8">
          Podrás cambiar de rol cuando quieras desde el menú de la app.
        </p>
      </div>
    </div>
  );
}
