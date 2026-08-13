import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, ShieldCheck, ChevronRight, ScanFace, Loader2, Eye } from 'lucide-react';
import { useLiveTheme } from '../liveTheme';
import { Screen } from '../LiveApp';
import { estadoBiometria, entrarConBiometria, ATLETA, STAFF } from '../biometria';
import { TOKEN_ATLETA, TOKEN_STAFF, marcarAccesoAtleta, hayAtleta, hayStaff, rutaDeEntrada } from '../sesion';

/**
 * Única puerta de entrada, y la primera pantalla al abrir la app: primero se
 * elige quién eres y solo entonces se ve el acceso que te toca.
 *
 * Antes el menú ofrecía "Perfil del corredor" y "Staff" a la vez, y cualquiera
 * podía asomarse al formulario de staff. Ahora el menú solo muestra "Iniciar
 * sesión" mientras no haya sesión, y desde aquí se va a uno u otro.
 *
 * Espectador no es una sesión: es seguir la carrera sin identificarse, que es
 * lo que hace la mayoría. Va aparte de los otros dos, y pasa directo al
 * selector de carreras sin pedir nada.
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

  // Con sesión abierta aquí no hay nada que elegir: se pasa de largo. Cubre
  // llegar por enlace directo o por el botón de atrás; la bienvenida ya manda
  // a cada uno a su sitio sin pasar por aquí.
  const conSesion = hayAtleta() || hayStaff();
  useEffect(() => {
    if (conSesion) navigate(rutaDeEntrada(), { replace: true });
  }, [conSesion, navigate]);

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
    { quien: ATLETA, Icon: User, titulo: 'Soy corredor', ruta: '/live/perfil', bio: bioAtleta },
    { quien: STAFF, Icon: ShieldCheck, titulo: 'Soy del staff', ruta: '/live/staff', bio: bioStaff },
  ];

  // Mientras el efecto de arriba redirige, no se pinta la elección: verla
  // aparecer y desaparecer es peor que no verla.
  if (conSesion) return null;

  return (
    <Screen title="Iniciar sesión">
      <div className="px-4 py-5">
        <p className={`text-sm mb-4 ${T.muted}`}>¿Cómo quieres entrar?</p>

        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

        {opciones.map(({ quien, Icon, titulo, ruta, bio }) => (
          <div key={quien} className={`rounded-2xl mb-3 ${T.card}`}>
            <button
              onClick={() => navigate(ruta)}
              className="w-full flex items-center gap-3.5 px-4 py-4 text-left"
            >
              <span className="w-11 h-11 rounded-full bg-[#E77622]/15 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-[#E77622]" />
              </span>
              <p className="flex-1 min-w-0 text-sm font-bold">{titulo}</p>
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

        <div className={`rounded-2xl mt-5 ${T.card}`}>
          <button
            onClick={() => navigate('/live/carreras')}
            className="w-full flex items-center gap-3.5 px-4 py-4 text-left"
          >
            <span className="w-11 h-11 rounded-full bg-[#E77622]/15 flex items-center justify-center shrink-0">
              <Eye className="w-5 h-5 text-[#E77622]" />
            </span>
            <span className="flex-1 min-w-0">
              <p className="text-sm font-bold">Soy espectador</p>
              <p className={`text-xs mt-0.5 ${T.muted}`}>Sigue la carrera sin iniciar sesión</p>
            </span>
            <ChevronRight className={`w-4 h-4 shrink-0 ${T.subtle}`} />
          </button>
        </div>
      </div>
    </Screen>
  );
}
