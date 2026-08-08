import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, ShieldCheck, ChevronRight, ScanFace, Loader2 } from 'lucide-react';
import { useLiveTheme } from '../liveTheme';
import { Screen } from '../LiveApp';
import { estadoBiometria, entrarConBiometria, ATLETA, STAFF } from '../biometria';
import { TOKEN_ATLETA, TOKEN_STAFF, marcarAccesoAtleta, hayAtleta, hayStaff } from '../sesion';

/**
 * Única puerta de entrada: primero se elige quién eres y solo entonces se ve
 * el acceso que te toca.
 *
 * Antes el menú ofrecía "Perfil del corredor" y "Staff" a la vez, y cualquiera
 * podía asomarse al formulario de staff. Ahora el menú solo muestra "Iniciar
 * sesión" mientras no haya sesión, y desde aquí se va a uno u otro.
 *
 * Si el teléfono ya tiene la biometría activada para alguno de los dos, se
 * ofrece entrar directamente con la cara o la huella.
 */
export default function LoginScreen() {
  const { T } = useLiveTheme();
  const navigate = useNavigate();

  const [bioAtleta, setBioAtleta] = useState({ activada: false, nombre: '' });
  const [bioStaff, setBioStaff] = useState({ activada: false, nombre: '' });
  const [entrando, setEntrando] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancel = false;
    Promise.all([estadoBiometria(ATLETA), estadoBiometria(STAFF)]).then(([a, s]) => {
      if (cancel) return;
      setBioAtleta(a);
      setBioStaff(s);
    });
    return () => { cancel = true; };
  }, []);

  const entrarBio = async (quien) => {
    setEntrando(quien);
    setError('');
    const token = await entrarConBiometria(quien);
    setEntrando(null);
    if (!token) {
      setError('No se pudo verificar. Entra con tu contraseña.');
      return;
    }
    if (quien === ATLETA) {
      localStorage.setItem(TOKEN_ATLETA, token);
      marcarAccesoAtleta();
      navigate('/live/perfil');
    } else {
      localStorage.setItem(TOKEN_STAFF, token);
      navigate('/live/staff');
    }
  };

  const opciones = [
    {
      quien: ATLETA,
      Icon: User,
      titulo: 'Soy corredor',
      texto: hayAtleta()
        ? 'Vuelve a tu perfil'
        : 'Tu perfil, inscripciones, capacitaciones y resultados',
      ruta: '/live/perfil',
      bio: bioAtleta,
    },
    {
      quien: STAFF,
      Icon: ShieldCheck,
      titulo: 'Soy del staff',
      texto: hayStaff()
        ? 'Vuelve a las herramientas del staff'
        : 'Escáner de vueltas y ficha de emergencia de los atletas',
      ruta: '/live/staff',
      bio: bioStaff,
    },
  ];

  return (
    <Screen title="Iniciar sesión">
      <div className="px-4 py-5">
        <p className={`text-sm mb-4 ${T.muted}`}>¿Cómo quieres entrar?</p>

        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

        {opciones.map(({ quien, Icon, titulo, texto, ruta, bio }) => (
          <div key={quien} className={`rounded-2xl mb-3 ${T.card}`}>
            <button
              onClick={() => navigate(ruta)}
              className="w-full flex items-center gap-3.5 px-4 py-4 text-left"
            >
              <span className="w-11 h-11 rounded-full bg-[#E77622]/15 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-[#E77622]" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold">{titulo}</p>
                <p className={`text-[11px] mt-0.5 leading-relaxed ${T.muted}`}>{texto}</p>
              </div>
              <ChevronRight className={`w-4 h-4 shrink-0 ${T.subtle}`} />
            </button>

            {bio.activada && (
              <button
                onClick={() => entrarBio(quien)}
                disabled={entrando === quien}
                className={`w-full flex items-center justify-center gap-2 py-3 text-xs font-bold border-t disabled:opacity-50 ${T.divider}`}
              >
                {entrando === quien
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <ScanFace className="w-4 h-4 text-[#E77622]" />}
                {entrando === quien ? 'Verificando…' : `Entrar con ${bio.nombre}`}
              </button>
            )}
          </div>
        ))}
      </div>
    </Screen>
  );
}
