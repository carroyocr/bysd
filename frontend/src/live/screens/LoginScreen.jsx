import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, Loader2, ScanFace, Eye, LogIn, ArrowLeft } from 'lucide-react';
import { API } from '../liveApi';
import { clic } from '../sonido';
import { estadoBiometria, entrarConBiometria, activarBiometria } from '../biometria';
import {
  guardarSesion, haySesion, rutaDeEntrada, guardarRol, ESPECTADOR, marcarAcceso,
} from '../sesion';

/**
 * Primera pantalla de la app: la puerta.
 *
 * Antes preguntaba "¿cómo entras?" y ofrecía tres caminos —corredor, staff,
 * espectador—, porque detrás había tres accesos distintos y había que elegir a
 * cuál ibas antes de saber quién eras. Con la cuenta única eso deja de tener
 * sentido: se entra una vez y el backend mira los roles para decidir qué se
 * abre. Quien corre y además es del equipo ya no tiene que elegir cuál de sus
 * dos vidas usa hoy.
 *
 * Quedan dos cosas, que son las dos que de verdad hay: entrar, o ver la carrera
 * sin cuenta. Lo segundo es lo que hace la mayoría y por eso no está escondido.
 *
 * Va sin barra superior y sin menú: es una puerta, no una pantalla donde haya
 * nada que consultar. El negro se mantiene aunque el tema esté en claro, igual
 * que la banda de marca: es lo que hace que se lea como la carrera y no como un
 * formulario.
 */
export default function LoginScreen() {
  const navigate = useNavigate();

  const [modo, setModo] = useState('puerta');   // 'puerta' | 'acceso'
  const [bio, setBio] = useState({ activada: false, disponible: false, nombre: '', usuario: '' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [conBio, setConBio] = useState(false);
  const [entrando, setEntrando] = useState(false);
  const [error, setError] = useState('');

  // Con sesión abierta aquí no hay nada que elegir: se pasa de largo. Cubre
  // llegar por enlace directo o por el botón de atrás.
  const conSesion = haySesion();
  useEffect(() => {
    if (conSesion) navigate(rutaDeEntrada(), { replace: true });
  }, [conSesion, navigate]);

  useEffect(() => {
    let cancel = false;
    estadoBiometria().then((e) => {
      if (cancel) return;
      setBio(e);
      if (e.usuario) setEmail(e.usuario);
      setConBio(e.disponible && !e.activada);
    });
    return () => { cancel = true; };
  }, []);

  const verSinCuenta = () => {
    clic();
    guardarRol(ESPECTADOR);
    navigate('/live/carreras');
  };

  const entrarBio = async () => {
    setEntrando(true);
    setError('');
    const token = await entrarConBiometria();
    setEntrando(false);
    if (!token) {
      setError('No se pudo verificar. Entra con tu contraseña.');
      return;
    }
    guardarSesion({ token });
    marcarAcceso();
    navigate('/live/carreras');
  };

  const entrar = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Faltan el correo y la contraseña.');
      return;
    }
    setEntrando(true);
    setError('');
    try {
      const r = await fetch(`${API}/api/cuentas/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const datos = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(datos.detail || 'No se pudo entrar');
        setEntrando(false);
        return;
      }

      guardarSesion({
        token: datos.token,
        username: datos.cuenta?.email,
        is_admin: datos.cuenta?.is_admin,
        permissions: datos.cuenta?.permissions || [],
      });

      if (conBio && bio.disponible && !bio.activada) {
        await activarBiometria(email.trim(), datos.token);
      }
      navigate('/live/carreras');
    } catch {
      setError('No se pudo conectar.');
      setEntrando(false);
    }
  };

  if (conSesion) return null;

  const marco = (
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

      {error && <p className="text-xs text-red-400 mb-4">{error}</p>}

      {modo === 'puerta' ? (
        <>
          <div className="w-full flex flex-col gap-3">
            <button
              onClick={verSinCuenta}
              data-testid="ver-sin-cuenta"
              className="w-full rounded-full px-5 py-3.5 flex items-center gap-3.5 border
                border-[rgba(231,118,34,0.5)] bg-white/[0.035]
                shadow-[0_0_26px_rgba(231,118,34,0.16)]
                transition-all duration-100 ease-out active:scale-[0.985]"
            >
              <Eye className="w-[18px] h-[18px] shrink-0 text-[#E77622]" />
              <span className="text-[12.5px] uppercase tracking-[0.14em] text-[#E77622]">
                Ver la carrera
              </span>
            </button>

            <button
              onClick={() => { clic(); setModo('acceso'); setError(''); }}
              data-testid="entrar"
              className="w-full rounded-full px-5 py-3.5 flex items-center gap-3.5 border
                border-white/10 bg-white/[0.035]
                transition-all duration-100 ease-out active:scale-[0.985]"
            >
              <LogIn className="w-[18px] h-[18px] shrink-0" />
              <span className="text-[12.5px] uppercase tracking-[0.14em]">Entrar</span>
            </button>
          </div>

          {bio.activada && (
            <button
              onClick={() => { clic(); entrarBio(); }}
              disabled={entrando}
              className="w-full mt-4 rounded-full px-5 py-3 flex items-center justify-center gap-2
                border border-white/10 bg-white/[0.02] text-[11px] uppercase tracking-[0.14em]
                disabled:opacity-50 transition-all duration-100 active:scale-[0.985]"
            >
              {entrando
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <ScanFace className="w-4 h-4 text-[#E77622]" />}
              {entrando ? 'Verificando…' : `Entrar con ${bio.nombre}`}
            </button>
          )}
        </>
      ) : (
        <form onSubmit={entrar} className="w-full flex flex-col gap-3">
          <input
            type="email"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            placeholder="Correo"
            autoComplete="email"
            className="w-full rounded-full px-5 py-3.5 bg-white/[0.05] border border-white/10
              text-[13px] text-[#EFE9DD] placeholder:text-[#6d655a] outline-none
              focus:border-[rgba(231,118,34,0.5)]"
          />
          <input
            type="password"
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            placeholder="Contraseña"
            autoComplete="current-password"
            className="w-full rounded-full px-5 py-3.5 bg-white/[0.05] border border-white/10
              text-[13px] text-[#EFE9DD] placeholder:text-[#6d655a] outline-none
              focus:border-[rgba(231,118,34,0.5)]"
          />

          {bio.disponible && !bio.activada && (
            <label className="flex items-center gap-2.5 px-2 text-[11px] text-[#a49c8f]">
              <input type="checkbox" checked={conBio} onChange={(ev) => setConBio(ev.target.checked)} />
              Entrar con {bio.nombre} la próxima vez
            </label>
          )}

          <button
            type="submit"
            disabled={entrando}
            className="w-full rounded-full px-5 py-3.5 flex items-center justify-center gap-2
              border border-[rgba(231,118,34,0.5)] bg-white/[0.035] text-[12.5px]
              uppercase tracking-[0.14em] text-[#E77622] disabled:opacity-50
              transition-all duration-100 active:scale-[0.985]"
          >
            {entrando ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            {entrando ? 'Entrando…' : 'Entrar'}
          </button>

          <button
            type="button"
            onClick={() => { clic(); setModo('puerta'); setError(''); }}
            className="w-full mt-1 flex items-center justify-center gap-2 text-[11px]
              uppercase tracking-[0.14em] text-[#6d655a] py-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver
          </button>
        </form>
      )}

      <p className="mt-auto pt-8 text-[10px] uppercase tracking-[0.2em] text-[#6d655a]">
        Backyard Ultra Santo Domingo
      </p>
    </div>
  );

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
      {marco}
    </div>
  );
}
