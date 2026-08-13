import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Footprints, ShieldCheck, ScanFace, Loader2, Eye, Flame } from 'lucide-react';
import { useLiveTheme } from '../liveTheme';
import { Screen } from '../LiveApp';
import { estadoBiometria, entrarConBiometria, ATLETA, STAFF } from '../biometria';
import { clic } from '../sonido';
import { TOKEN_ATLETA, TOKEN_STAFF, marcarAccesoAtleta, hayAtleta, hayStaff, rutaDeEntrada } from '../sesion';

const ESPECTADOR = 'espectador';

/**
 * Los tres accesos, cada uno con su color.
 *
 * El color no decora: dice a qué puerta lleva cada cosa, y es el mismo que
 * usan después las pantallas de cada rol. La franja de la portada y el
 * corredor comparten el naranja de la marca; staff y espectador traen los
 * suyos para no depender solo del icono.
 *
 * Cada rol lleva dos tonos porque la app tiene tema claro y oscuro: sobre el
 * crema del tema claro los fondos oscuros se ven como manchas.
 */
const ROLES = [
  {
    quien: ATLETA,
    Icon: Footprints,
    etiqueta: 'Corredor',
    ruta: '/live/perfil',
    color: { dark: '#E77622', light: '#C25F12' },
    fondo: { dark: '#2A1707', light: '#FDEEDF' },
    borde: { dark: 'rgba(231,118,34,0.40)', light: 'rgba(194,95,18,0.28)' },
  },
  {
    quien: STAFF,
    Icon: ShieldCheck,
    etiqueta: 'Staff',
    ruta: '/live/staff',
    color: { dark: '#5DCAA5', light: '#0F6E56' },
    fondo: { dark: '#0D2B23', light: '#E1F5EE' },
    borde: { dark: 'rgba(93,202,165,0.40)', light: 'rgba(15,110,86,0.24)' },
  },
  {
    quien: ESPECTADOR,
    Icon: Eye,
    etiqueta: 'Espectador',
    ruta: '/live/carreras',
    color: { dark: '#85B7EB', light: '#185FA5' },
    fondo: { dark: '#12212F', light: '#E6F1FB' },
    borde: { dark: 'rgba(133,183,235,0.40)', light: 'rgba(24,95,165,0.24)' },
  },
];

/**
 * El relieve de los cuadros, que es lo que los hace leer como botones.
 *
 * En oscuro una sombra negra no se ve: el volumen lo da una luz fina en el
 * borde de arriba, como si el botón recibiera luz cenital, más una sombra
 * oscura debajo para despegarlo del fondo. En claro basta la sombra de toda
 * la vida.
 */
const RELIEVE = {
  dark: 'inset 0 1px 0 rgba(255,255,255,0.10), 0 3px 8px rgba(0,0,0,0.55)',
  light: '0 2px 6px rgba(0,0,0,0.13)',
};

/**
 * Única puerta de entrada, y la primera pantalla al abrir la app: primero se
 * elige quién eres y solo entonces se ve el acceso que te toca.
 *
 * Antes el menú ofrecía "Perfil del corredor" y "Staff" a la vez, y cualquiera
 * podía asomarse al formulario de staff. Ahora el menú solo muestra "Iniciar
 * sesión" mientras no haya sesión, y desde aquí se va a uno u otro.
 *
 * Espectador no es una sesión: es seguir la carrera sin identificarse, que es
 * lo que hace la mayoría. Por eso los tres pesan lo mismo en pantalla y ninguno
 * pide nada hasta que se toca.
 *
 * Si el teléfono ya tiene la biometría activada para alguno de los dos accesos
 * con cuenta, se ofrece entrar directamente con la cara o la huella.
 */
export default function LoginScreen() {
  const { T, theme } = useLiveTheme();
  const navigate = useNavigate();
  const modo = theme === 'dark' ? 'dark' : 'light';

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

  // Un atajo por cada acceso que tenga la biometría puesta. Con los dos
  // activados hay que decir cuál es cuál; con uno solo, la frase corta basta.
  const atajos = [
    { quien: ATLETA, bio: bioAtleta, prefijo: 'Entrar con' },
    { quien: STAFF, bio: bioStaff, prefijo: 'Entrar al staff con' },
  ].filter(({ bio }) => bio.activada);

  // Mientras el efecto de arriba redirige, no se pinta la elección: verla
  // aparecer y desaparecer es peor que no verla.
  if (conSesion) return null;

  return (
    <Screen title="Iniciar sesión">
      {/* Portada: la banda oscura de marca se mantiene igual en los dos temas,
          que es lo que hace que la pantalla se lea como la carrera y no como
          un formulario. */}
      <div className="bg-[#2A1707] px-6 py-8 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-[#E77622] flex items-center justify-center">
          <Flame className="w-7 h-7 text-[#2A1707]" strokeWidth={2.2} />
        </div>
        <p className="mt-3.5 text-lg font-extrabold tracking-wide text-white">
          BYSD <span className="text-[#E77622]">LIVE</span>
        </p>
        <p className="mt-1.5 text-[11px] tracking-[0.18em] uppercase text-[#D6B18A]">
          Last one standing
        </p>
      </div>

      <div className="px-4 py-6">
        <p className={`text-xs text-center mb-5 ${T.muted}`}>¿Cómo quieres entrar?</p>

        {error && <p className="text-xs text-red-500 text-center mb-4">{error}</p>}

        <div className="flex gap-2.5">
          {ROLES.map(({ quien, Icon, etiqueta, ruta, color, fondo, borde }) => (
            <button
              key={quien}
              onClick={() => { clic(); navigate(ruta); }}
              // El hundido al tocar es lo que confirma la pulsación en un
              // teléfono, donde no hay puntero que se pose encima.
              className="flex-1 min-w-0 transition-transform duration-100 ease-out active:scale-[0.94]"
            >
              <span
                className="w-full aspect-square rounded-2xl border flex items-center justify-center"
                style={{ backgroundColor: fondo[modo], borderColor: borde[modo], boxShadow: RELIEVE[modo] }}
              >
                <Icon className="w-7 h-7" style={{ color: color[modo] }} strokeWidth={1.9} />
              </span>
              <span className="block mt-2 text-xs font-semibold">{etiqueta}</span>
            </button>
          ))}
        </div>

        {atajos.map(({ quien, bio, prefijo }) => (
          <button
            key={quien}
            onClick={() => { clic(); entrarBio(quien); }}
            disabled={entrando === quien}
            className={`w-full mt-5 flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-bold transition-transform duration-100 ease-out active:scale-[0.97] disabled:opacity-50 ${T.card}`}
            style={{ boxShadow: RELIEVE[modo] }}
          >
            {entrando === quien
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <ScanFace className="w-4 h-4 text-[#E77622]" />}
            {entrando === quien ? 'Verificando…' : `${prefijo} ${bio.nombre}`}
          </button>
        ))}
      </div>
    </Screen>
  );
}
