import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ScanFace, Loader2, Flame, Eye } from 'lucide-react';
import { estadoBiometria, entrarConBiometria, ATLETA, STAFF } from '../biometria';
import { clic } from '../sonido';
import {
  TOKEN_ATLETA, TOKEN_STAFF, marcarAccesoAtleta, hayAtleta, hayStaff,
  rutaDeEntrada, guardarRol, ESPECTADOR,
} from '../sesion';

/**
 * Un corredor de perfil, en zancada.
 *
 * Dibujado a mano porque lucide no trae ninguno: lo más cercano eran unas
 * huellas o un monigote de pie, y esta app va de gente corriendo. Mismo trazo
 * y misma caja que el resto de iconos para que no desentone.
 */
function IconCorredor({ className, style, strokeWidth = 1.5 }) {
  return (
    <svg
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style} aria-hidden="true"
    >
      <circle cx="16.6" cy="4.4" r="2.1" />
      <path d="M14.4 8.4 11.7 12.9" />
      <path d="M11.7 12.9 14.3 16.4 13.3 20.6" />
      <path d="M11.7 12.9 8.2 15.6 5.3 14.5" />
      <path d="M14.7 9.2 17.9 11 19.9 8.7" />
      <path d="M14.2 8.7 10.5 9.7 8.3 11.9" />
    </svg>
  );
}

// Espectador entra directo a elegir carrera porque no tiene nada que
// acreditar. Corredor y staff pasan antes por su login; la carrera se la
// pregunta la app al terminar de entrar.
const ROLES = [
  { rol: ESPECTADOR, Icon: Eye, etiqueta: 'Espectador', ruta: '/live/carreras', destacado: true },
  { rol: ATLETA, Icon: IconCorredor, etiqueta: 'Corredor', ruta: '/live/perfil' },
  { rol: STAFF, Icon: ShieldCheck, etiqueta: 'Staff', ruta: '/live/staff' },
];

/**
 * Primera pantalla de la app: quién entra.
 *
 * Aquí no se habla de ninguna carrera todavía, y por eso no hay cuenta atrás:
 * cuál sea la carrera se decide en la pantalla siguiente, y prometer días
 * antes de saber a qué carrera es lo que hacía que el flujo no cuadrara.
 *
 * Los tres papeles llevan al mismo sitio —la selección de carrera—; lo que
 * cambia es a dónde va cada uno una vez elegida. Espectador no es una sesión:
 * es seguir la carrera sin identificarse, que es lo que hace la mayoría.
 *
 * Va sin barra superior y sin menú: es una puerta, no una pantalla donde haya
 * nada que consultar. El negro se mantiene aunque el tema esté en claro, igual
 * que la banda de marca: es lo que hace que se lea como la carrera y no como
 * un formulario.
 */
export default function LoginScreen() {
  const navigate = useNavigate();

  const [bioAtleta, setBioAtleta] = useState({ activada: false, nombre: '' });
  const [bioStaff, setBioStaff] = useState({ activada: false, nombre: '' });
  const [entrando, setEntrando] = useState(null);
  const [error, setError] = useState('');

  // Con sesión abierta aquí no hay nada que elegir: se pasa de largo. Cubre
  // llegar por enlace directo o por el botón de atrás.
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

  const elegir = (rol, ruta) => {
    clic();
    guardarRol(rol);
    navigate(ruta);
  };

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
    } else {
      localStorage.setItem(TOKEN_STAFF, token);
    }
    guardarRol(quien);
    navigate('/live/carreras');
  };

  const atajos = [
    { quien: ATLETA, bio: bioAtleta, prefijo: 'Entrar con' },
    { quien: STAFF, bio: bioStaff, prefijo: 'Entrar al staff con' },
  ].filter(({ bio }) => bio.activada);

  if (conSesion) return null;

  return (
    <div
      className="min-h-[100dvh] flex flex-col items-center text-center text-[#EFE9DD]"
      style={{
        // El haz cálido de arriba y el frío tenue de abajo son la identidad
        // "linterna nocturna": dan atmósfera sin necesidad de una sola foto.
        background:
          'radial-gradient(90% 55% at 50% -8%, rgba(231,118,34,.30) 0%, rgba(231,118,34,.06) 45%, transparent 72%),'
          + 'radial-gradient(70% 45% at 50% 108%, rgba(133,183,235,.10) 0%, transparent 70%),'
          + '#070707',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div className="w-full max-w-md px-7 pb-10 pt-[calc(3.5rem+env(safe-area-inset-top))] flex flex-col items-center flex-1">
        <div
          className="w-[74px] h-[74px] rounded-full grid place-items-center text-[#E77622]
            border border-[rgba(231,118,34,0.45)]
            shadow-[0_0_34px_rgba(231,118,34,0.32),inset_0_0_22px_rgba(231,118,34,0.14)]"
        >
          <Flame className="w-8 h-8" strokeWidth={1.5} />
        </div>

        <p className="mt-6 text-[15px] font-light uppercase tracking-[0.42em] indent-[0.42em] text-white">
          BYSD Live
        </p>
        <span className="w-7 h-px bg-white/20 mt-5 mb-6" />
        <p className="text-xs font-light uppercase tracking-[0.16em] text-[#a49c8f]">
          ¿Cómo entras?
        </p>

        {error && <p className="text-xs text-red-400 mt-5">{error}</p>}

        <div className="w-full mt-7 flex flex-col gap-3">
          {ROLES.map(({ rol, Icon, etiqueta, ruta, destacado }) => (
            <button
              key={rol}
              onClick={() => elegir(rol, ruta)}
              data-testid={`rol-${rol}`}
              className={`w-full rounded-full px-5 py-3.5 flex items-center gap-3.5 border
                transition-all duration-100 ease-out active:scale-[0.985]
                ${destacado
                  ? 'border-[rgba(231,118,34,0.5)] bg-white/[0.035] shadow-[0_0_26px_rgba(231,118,34,0.16)]'
                  : 'border-white/10 bg-white/[0.035]'}`}
            >
              <Icon className="w-[18px] h-[18px] shrink-0" style={{ color: destacado ? '#E77622' : '#EFE9DD' }} />
              <span className={`text-[12.5px] uppercase tracking-[0.14em] ${destacado ? 'text-[#E77622]' : ''}`}>
                {etiqueta}
              </span>
            </button>
          ))}
        </div>

        {atajos.map(({ quien, bio, prefijo }) => (
          <button
            key={quien}
            onClick={() => { clic(); entrarBio(quien); }}
            disabled={entrando === quien}
            className="w-full mt-4 rounded-full px-5 py-3 flex items-center justify-center gap-2
              border border-white/10 bg-white/[0.02] text-[11px] uppercase tracking-[0.14em]
              disabled:opacity-50 transition-all duration-100 active:scale-[0.985]"
          >
            {entrando === quien
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <ScanFace className="w-4 h-4 text-[#E77622]" />}
            {entrando === quien ? 'Verificando…' : `${prefijo} ${bio.nombre}`}
          </button>
        ))}

        <p className="mt-auto pt-8 text-[10px] uppercase tracking-[0.2em] text-[#6d655a]">
          Backyard Ultra Santo Domingo
        </p>
      </div>
    </div>
  );
}
