import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Flame, Loader2, ScanFace, Eye, EyeOff, LogIn, ArrowLeft, UserPlus, Check,
} from 'lucide-react';
import { API } from '../liveApi';
import { clic } from '../sonido';
import { estadoBiometria, entrarConBiometria, activarBiometria } from '../biometria';
import {
  guardarSesion, haySesion, rutaDeEntrada, guardarRol, ESPECTADOR, marcarAcceso,
} from '../sesion';

// Los tres tipos de cuenta.
//
// Espectador y Atleta se crean solos. Staff NO: una cuenta de equipo solo
// existe si la organización ya tiene a esa persona apuntada como voluntaria.
// Dejar que cualquiera se marque "Staff" al registrarse sería concederse el
// rol a uno mismo, y con él las fichas médicas de todos los inscritos. Por eso
// esta opción no crea nada: comprueba el correo contra el registro de
// voluntarios y, si está, manda el código para poner contraseña.
const TIPOS = [
  { id: 'espectador', etiqueta: 'Espectador', pie: 'Seguir la carrera y animar' },
  { id: 'atleta', etiqueta: 'Atleta', pie: 'Correr e inscribirte' },
  { id: 'staff', etiqueta: 'Staff', pie: 'Si ya eres voluntario' },
];

const SEXOS = ['Masculino', 'Femenino'];

const CAMPO = 'w-full rounded-full px-5 py-3.5 bg-white/[0.05] border border-white/10 '
  + 'text-[13px] text-[#EFE9DD] placeholder:text-[#6d655a] outline-none '
  + 'focus:border-[rgba(231,118,34,0.5)]';

/**
 * Campo de contraseña con el ojo para mostrarla.
 *
 * A nivel de módulo, no dentro del render de LoginScreen: anidarlo haría que
 * React lo tratara como un tipo de componente nuevo en cada tecla, lo
 * remontaría, y el campo perdería el foco a la primera letra. El build no
 * detecta eso.
 */
function Clave({ valor, alCambiar, marcador, autocompletar, visible, alternar }) {
  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        value={valor}
        onChange={alCambiar}
        placeholder={marcador}
        autoComplete={autocompletar}
        className={`${CAMPO} pr-14`}
      />
      <button
        type="button"
        onClick={alternar}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6d655a] p-1"
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

const vacio = {
  nombre: '', apellidos: '', email: '', password: '', tipo: 'espectador',
  telefono: '', fecha_nacimiento: '', sexo: '', nacionalidad: '', ciudad_residencia: '',
  contacto_emergencia_nombre: '', contacto_emergencia_telefono: '',
  acepta_comunicaciones: false,
};

/**
 * Primera pantalla de la app: la puerta.
 *
 * Antes preguntaba "¿cómo entras?" y ofrecía tres caminos —corredor, staff,
 * espectador—, porque detrás había tres accesos distintos y había que elegir a
 * cuál ibas antes de saber quién eras. Con la cuenta única eso deja de tener
 * sentido: se entra una vez y el backend mira los roles para decidir qué se
 * abre.
 *
 * Todo lo que tenga que ver con la cuenta vive aquí —entrar, crearla,
 * recuperarla— y no repartido por dos pantallas distintas según el rol. El
 * registro es un solo formulario que crece: los mismos cuatro campos para
 * todos, y solo quien va a correr sigue rellenando.
 *
 * Va sin barra superior y sin menú: es una puerta, no una pantalla donde haya
 * nada que consultar. El negro se mantiene aunque el tema esté en claro, igual
 * que la banda de marca: es lo que hace que se lea como la carrera y no como un
 * formulario.
 */
export default function LoginScreen() {
  const navigate = useNavigate();

  // 'puerta' | 'acceso' | 'recuperar' | 'registro'
  const [modo, setModo] = useState('puerta');
  const [bio, setBio] = useState({ activada: false, disponible: false, nombre: '', usuario: '' });
  const [verClave, setVerClave] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  // Acceso
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [conBio, setConBio] = useState(false);

  // Recuperar y códigos: 'pedir' | 'codigo'
  const [pasoCodigo, setPasoCodigo] = useState('pedir');
  const [codigo, setCodigo] = useState('');
  const [passwordNueva, setPasswordNueva] = useState('');

  // Registro
  const [paso, setPaso] = useState(1);
  const [f, setF] = useState(vacio);
  const set = (k) => (ev) => setF((p) => ({ ...p, [k]: ev.target.value }));

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

  const ir = (siguiente) => {
    clic();
    setModo(siguiente);
    setError('');
    setAviso('');
    setVerClave(false);
    setPasoCodigo('pedir');
    if (siguiente === 'registro') { setPaso(1); setF({ ...vacio, email }); }
  };

  const entrada = async (datos, correoBio) => {
    guardarSesion(datos);
    if (conBio && bio.disponible && !bio.activada && datos.token) {
      await activarBiometria(correoBio, datos.token);
    }
    navigate('/live/carreras');
  };

  // ---------- Acceso ----------

  const entrarBio = async () => {
    setOcupado(true);
    setError('');
    const token = await entrarConBiometria();
    setOcupado(false);
    if (!token) {
      setError('No se pudo verificar. Entra con tu contraseña.');
      return;
    }
    guardarSesion({ token });
    marcarAcceso();
    navigate('/live/carreras');
  };

  const entrar = async (ev) => {
    ev.preventDefault();
    if (!email.trim() || !password) { setError('Faltan el correo y la contraseña.'); return; }
    setOcupado(true); setError('');
    try {
      const r = await fetch(`${API}/api/cuentas/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.detail || 'No se pudo entrar'); setOcupado(false); return; }
      await entrada({
        token: d.token,
        username: d.cuenta?.email,
        is_admin: d.cuenta?.is_admin,
        permissions: d.cuenta?.permissions || [],
      }, email.trim());
    } catch {
      setError('No se pudo conectar.'); setOcupado(false);
    }
  };

  // ---------- Recuperar contraseña ----------

  const pedirCodigo = async (ev) => {
    ev.preventDefault();
    if (!email.trim()) { setError('Escribe tu correo.'); return; }
    setOcupado(true); setError('');
    try {
      await fetch(`${API}/api/cuentas/recuperar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      // Se responde igual exista o no la cuenta: decir cuál existe sería una
      // forma cómoda de averiguar quién está registrado.
      setAviso('Si ese correo tiene cuenta, te enviamos un código.');
      setPasoCodigo('codigo');
    } catch {
      setError('No se pudo conectar.');
    }
    setOcupado(false);
  };

  const cambiarPassword = async (ev) => {
    ev.preventDefault();
    setOcupado(true); setError('');
    try {
      const r = await fetch(`${API}/api/cuentas/nueva-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: codigo.trim(), password: passwordNueva }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.detail || 'No se pudo cambiar'); setOcupado(false); return; }
      await entrada({ token: d.token }, email.trim());
    } catch {
      setError('No se pudo conectar.'); setOcupado(false);
    }
  };

  // ---------- Registro ----------

  const siguientePaso = (ev) => {
    ev.preventDefault();
    if (!f.nombre.trim() || !f.apellidos.trim()) { setError('Faltan tu nombre y tus apellidos.'); return; }
    if (!f.email.trim()) { setError('Falta el correo.'); return; }
    if (f.password.length < 8) { setError('La contraseña necesita al menos 8 caracteres.'); return; }
    setError('');

    if (f.tipo === 'espectador') return crearEspectador();
    if (f.tipo === 'staff') return comprobarStaff();
    setPaso(2);
    return undefined;
  };

  const crearEspectador = async () => {
    setOcupado(true); setError('');
    try {
      const r = await fetch(`${API}/api/cuentas/registro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: f.email.trim(), nombre: f.nombre.trim(), apellidos: f.apellidos.trim(),
          password: f.password, acepta_comunicaciones: f.acepta_comunicaciones,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.detail || 'No se pudo crear la cuenta'); setOcupado(false); return; }
      await entrada({ token: d.token }, f.email.trim());
    } catch {
      setError('No se pudo conectar.'); setOcupado(false);
    }
  };

  const crearAtleta = async (ev) => {
    ev.preventDefault();
    setOcupado(true); setError('');
    try {
      const r = await fetch(`${API}/api/athletes/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: f.email.trim(), password: f.password,
          nombre: f.nombre.trim(), apellidos: f.apellidos.trim(),
          telefono: f.telefono || null,
          fecha_nacimiento: f.fecha_nacimiento || null,
          sexo: f.sexo || null,
          nacionalidad: f.nacionalidad || null,
          ciudad_residencia: f.ciudad_residencia || null,
          contacto_emergencia_nombre: f.contacto_emergencia_nombre || null,
          contacto_emergencia_telefono: f.contacto_emergencia_telefono || null,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.detail || 'No se pudo crear la cuenta'); setOcupado(false); return; }
      setAviso('Te enviamos un código para confirmar tu correo.');
      setPasoCodigo('codigo');
      setPaso(3);
    } catch {
      setError('No se pudo conectar.');
    }
    setOcupado(false);
  };

  const verificarAtleta = async (ev) => {
    ev.preventDefault();
    setOcupado(true); setError('');
    try {
      const r = await fetch(`${API}/api/athletes/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: f.email.trim(), code: codigo.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.detail || 'Código incorrecto'); setOcupado(false); return; }
      await entrada({ token: d.token }, f.email.trim());
    } catch {
      setError('No se pudo conectar.'); setOcupado(false);
    }
  };

  const comprobarStaff = async () => {
    setOcupado(true); setError('');
    try {
      const r = await fetch(`${API}/api/staff/account-status?email=${encodeURIComponent(f.email.trim())}`);
      const d = await r.json().catch(() => ({}));
      if (!d.es_voluntario && !d.tiene_cuenta) {
        setError('Ese correo no está apuntado como voluntario. Apúntate primero desde Voluntarios y luego vuelve aquí.');
        setOcupado(false);
        return;
      }
      await fetch(`${API}/api/staff/password/request-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: f.email.trim() }),
      });
      setAviso('Te enviamos un código al correo.');
      setPasoCodigo('codigo');
      setPaso(3);
    } catch {
      setError('No se pudo conectar.');
    }
    setOcupado(false);
  };

  const activarStaff = async (ev) => {
    ev.preventDefault();
    setOcupado(true); setError('');
    try {
      const r = await fetch(`${API}/api/staff/password/set`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: f.email.trim(), code: codigo.trim(), password: f.password }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.detail || 'No se pudo activar la cuenta'); setOcupado(false); return; }
      await entrada({
        token: d.token, username: d.username,
        is_admin: d.is_admin, permissions: d.permissions || [],
      }, f.email.trim());
    } catch {
      setError('No se pudo conectar.'); setOcupado(false);
    }
  };

  if (conSesion) return null;

  // ---------- Piezas visuales ----------

  const campo = CAMPO;

  const botonPrincipal = 'w-full rounded-full px-5 py-3.5 flex items-center justify-center gap-2 '
    + 'border border-[rgba(231,118,34,0.5)] bg-white/[0.035] text-[12.5px] uppercase '
    + 'tracking-[0.14em] text-[#E77622] disabled:opacity-50 transition-all duration-100 '
    + 'active:scale-[0.985]';

  const botonPlano = 'w-full rounded-full px-5 py-3.5 flex items-center gap-3.5 border '
    + 'border-white/10 bg-white/[0.035] transition-all duration-100 ease-out active:scale-[0.985]';

  const enlace = 'w-full flex items-center justify-center gap-2 text-[11px] uppercase '
    + 'tracking-[0.14em] text-[#6d655a] py-2.5';

  const volver = (destino, texto = 'Volver') => (
    <button type="button" onClick={() => ir(destino)} className={enlace}>
      <ArrowLeft className="w-3.5 h-3.5" />
      {texto}
    </button>
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
      <div className="w-full max-w-md px-7 pb-10 pt-[calc(3rem+env(safe-area-inset-top))] flex flex-col items-center flex-1">
        <div
          className="w-[66px] h-[66px] rounded-full grid place-items-center text-[#E77622] shrink-0
            border border-[rgba(231,118,34,0.45)]
            shadow-[0_0_34px_rgba(231,118,34,0.32),inset_0_0_22px_rgba(231,118,34,0.14)]"
        >
          <Flame className="w-7 h-7" strokeWidth={1.5} />
        </div>

        <p className="mt-5 text-[15px] font-light uppercase tracking-[0.42em] indent-[0.42em] text-white">
          BYSD Live
        </p>
        <span className="w-7 h-px bg-white/20 mt-4 mb-5" />

        {error && <p className="text-xs text-red-400 mb-4 px-2">{error}</p>}
        {aviso && !error && (
          <p className="text-xs text-[#85B7EB] mb-4 px-2 flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5" />{aviso}
          </p>
        )}

        {/* ---------- PUERTA ---------- */}
        {modo === 'puerta' && (
          <>
            <div className="w-full flex flex-col gap-3">
              <button
                onClick={() => { clic(); guardarRol(ESPECTADOR); navigate('/live/carreras'); }}
                data-testid="ver-sin-cuenta"
                className={`${botonPlano} border-[rgba(231,118,34,0.5)] shadow-[0_0_26px_rgba(231,118,34,0.16)]`}
              >
                <Eye className="w-[18px] h-[18px] shrink-0 text-[#E77622]" />
                <span className="text-[12.5px] uppercase tracking-[0.14em] text-[#E77622]">
                  Ver la carrera
                </span>
              </button>

              <button onClick={() => ir('acceso')} data-testid="entrar" className={botonPlano}>
                <LogIn className="w-[18px] h-[18px] shrink-0" />
                <span className="text-[12.5px] uppercase tracking-[0.14em]">Entrar</span>
              </button>

              <button onClick={() => ir('registro')} data-testid="crear-cuenta" className={botonPlano}>
                <UserPlus className="w-[18px] h-[18px] shrink-0" />
                <span className="text-[12.5px] uppercase tracking-[0.14em]">Crear cuenta</span>
              </button>
            </div>

            {bio.activada && (
              <button
                onClick={() => { clic(); entrarBio(); }}
                disabled={ocupado}
                className="w-full mt-4 rounded-full px-5 py-3 flex items-center justify-center gap-2
                  border border-white/10 bg-white/[0.02] text-[11px] uppercase tracking-[0.14em]
                  disabled:opacity-50 transition-all duration-100 active:scale-[0.985]"
              >
                {ocupado ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <ScanFace className="w-4 h-4 text-[#E77622]" />}
                {ocupado ? 'Verificando…' : `Entrar con ${bio.nombre}`}
              </button>
            )}
          </>
        )}

        {/* ---------- ACCESO ---------- */}
        {modo === 'acceso' && (
          <form onSubmit={entrar} className="w-full flex flex-col gap-3">
            <input
              type="email" value={email} onChange={(ev) => setEmail(ev.target.value)}
              placeholder="Correo" autoComplete="email" className={campo}
            />
            <Clave
              valor={password} alCambiar={(ev) => setPassword(ev.target.value)}
              marcador="Contraseña" autocompletar="current-password"
              visible={verClave} alternar={() => setVerClave((v) => !v)}
            />

            {bio.disponible && !bio.activada && (
              <label className="flex items-center gap-2.5 px-2 text-[11px] text-[#a49c8f]">
                <input type="checkbox" checked={conBio} onChange={(ev) => setConBio(ev.target.checked)} />
                Entrar con {bio.nombre} la próxima vez
              </label>
            )}

            <button type="submit" disabled={ocupado} className={botonPrincipal}>
              {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              {ocupado ? 'Entrando…' : 'Entrar'}
            </button>

            <button type="button" onClick={() => ir('recuperar')} className={enlace}>
              Olvidé mi contraseña
            </button>
            <button type="button" onClick={() => ir('registro')} className={enlace}>
              <UserPlus className="w-3.5 h-3.5" />
              Crear una cuenta
            </button>
            {volver('puerta')}
          </form>
        )}

        {/* ---------- RECUPERAR ---------- */}
        {modo === 'recuperar' && (
          <form onSubmit={pasoCodigo === 'pedir' ? pedirCodigo : cambiarPassword} className="w-full flex flex-col gap-3">
            <p className="text-[11px] text-[#a49c8f] px-2 mb-1">
              {pasoCodigo === 'pedir'
                ? 'Te mandamos un código de seis dígitos para poner una contraseña nueva.'
                : 'Escribe el código que te llegó y la contraseña nueva.'}
            </p>

            <input
              type="email" value={email} onChange={(ev) => setEmail(ev.target.value)}
              placeholder="Correo" autoComplete="email"
              disabled={pasoCodigo === 'codigo'} className={`${campo} disabled:opacity-60`}
            />

            {pasoCodigo === 'codigo' && (
              <>
                <input
                  value={codigo} onChange={(ev) => setCodigo(ev.target.value)}
                  placeholder="000000" maxLength={6} inputMode="numeric"
                  className={`${campo} text-center tracking-[0.5em]`}
                />
                <Clave
                  valor={passwordNueva} alCambiar={(ev) => setPasswordNueva(ev.target.value)}
                  marcador="Contraseña nueva" autocompletar="new-password"
                  visible={verClave} alternar={() => setVerClave((v) => !v)}
                />
              </>
            )}

            <button type="submit" disabled={ocupado} className={botonPrincipal}>
              {ocupado && <Loader2 className="w-4 h-4 animate-spin" />}
              {pasoCodigo === 'pedir' ? 'Enviarme el código' : 'Guardar y entrar'}
            </button>
            {volver('acceso')}
          </form>
        )}

        {/* ---------- REGISTRO ---------- */}
        {modo === 'registro' && paso === 1 && (
          <form onSubmit={siguientePaso} className="w-full flex flex-col gap-3">
            <input value={f.nombre} onChange={set('nombre')} placeholder="Nombre"
              autoComplete="given-name" className={campo} />
            <input value={f.apellidos} onChange={set('apellidos')} placeholder="Apellidos"
              autoComplete="family-name" className={campo} />
            <input type="email" value={f.email} onChange={set('email')} placeholder="Correo"
              autoComplete="email" className={campo} />
            <Clave
              valor={f.password} alCambiar={set('password')}
              marcador="Contraseña (mínimo 8)" autocompletar="new-password"
              visible={verClave} alternar={() => setVerClave((v) => !v)}
            />

            <p className="text-[10px] uppercase tracking-[0.16em] text-[#6d655a] mt-2">
              Tipo de cuenta
            </p>
            <div className="flex flex-col gap-2">
              {TIPOS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { clic(); setF((p) => ({ ...p, tipo: t.id })); setError(''); }}
                  className={`w-full rounded-2xl px-4 py-3 text-left border transition-all duration-100
                    active:scale-[0.985] ${f.tipo === t.id
                      ? 'border-[rgba(231,118,34,0.55)] bg-[rgba(231,118,34,0.08)]'
                      : 'border-white/10 bg-white/[0.03]'}`}
                >
                  <span className={`block text-[12.5px] uppercase tracking-[0.12em] ${f.tipo === t.id ? 'text-[#E77622]' : ''}`}>
                    {t.etiqueta}
                  </span>
                  <span className="block text-[10.5px] text-[#6d655a] mt-0.5 normal-case tracking-normal">
                    {t.pie}
                  </span>
                </button>
              ))}
            </div>

            {f.tipo === 'espectador' && (
              <label className="flex items-start gap-2.5 px-2 text-[11px] text-[#a49c8f] text-left mt-1">
                <input
                  type="checkbox" checked={f.acepta_comunicaciones}
                  onChange={(ev) => setF((p) => ({ ...p, acepta_comunicaciones: ev.target.checked }))}
                  className="mt-0.5"
                />
                Quiero recibir avisos de la carrera por correo.
              </label>
            )}

            {f.tipo === 'staff' && (
              <p className="text-[10.5px] text-[#6d655a] px-2 text-left">
                Las cuentas de equipo las da la organización. Comprobaremos que tu
                correo esté apuntado como voluntario y te mandaremos un código.
              </p>
            )}

            <button type="submit" disabled={ocupado} className={botonPrincipal}>
              {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              {f.tipo === 'espectador' ? 'Crear cuenta' : 'Continuar'}
            </button>
            {volver('puerta')}
          </form>
        )}

        {/* Paso 2: solo lo rellena quien va a correr. */}
        {modo === 'registro' && paso === 2 && (
          <form onSubmit={crearAtleta} className="w-full flex flex-col gap-3">
            <p className="text-[11px] text-[#a49c8f] px-2 mb-1 text-left">
              Tus datos de corredor. Los médicos, la talla y el resto se completan
              después en tu perfil o al inscribirte.
            </p>

            <input value={f.telefono} onChange={set('telefono')} placeholder="Teléfono"
              inputMode="tel" autoComplete="tel" className={campo} />
            <input value={f.fecha_nacimiento} onChange={set('fecha_nacimiento')}
              placeholder="Fecha de nacimiento" type="date" className={campo} />

            <div className="flex gap-2">
              {SEXOS.map((s) => (
                <button
                  key={s} type="button"
                  onClick={() => { clic(); setF((p) => ({ ...p, sexo: s })); }}
                  className={`flex-1 rounded-full px-4 py-3 text-[11.5px] uppercase tracking-[0.12em]
                    border transition-all duration-100 active:scale-[0.985]
                    ${f.sexo === s
                      ? 'border-[rgba(231,118,34,0.55)] bg-[rgba(231,118,34,0.08)] text-[#E77622]'
                      : 'border-white/10 bg-white/[0.03]'}`}
                >
                  {s}
                </button>
              ))}
            </div>

            <input value={f.nacionalidad} onChange={set('nacionalidad')}
              placeholder="Nacionalidad" autoComplete="country-name" className={campo} />
            <input value={f.ciudad_residencia} onChange={set('ciudad_residencia')}
              placeholder="Ciudad de residencia" className={campo} />

            <p className="text-[10px] uppercase tracking-[0.16em] text-[#6d655a] mt-2 text-left px-2">
              Contacto de emergencia
            </p>
            <input value={f.contacto_emergencia_nombre} onChange={set('contacto_emergencia_nombre')}
              placeholder="Nombre" className={campo} />
            <input value={f.contacto_emergencia_telefono} onChange={set('contacto_emergencia_telefono')}
              placeholder="Teléfono" inputMode="tel" className={campo} />

            <button type="submit" disabled={ocupado} className={botonPrincipal}>
              {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Crear cuenta
            </button>
            <button type="button" onClick={() => { clic(); setPaso(1); setError(''); }} className={enlace}>
              <ArrowLeft className="w-3.5 h-3.5" />
              Volver
            </button>
          </form>
        )}

        {/* Paso 3: el código, para atleta y para staff. */}
        {modo === 'registro' && paso === 3 && (
          <form onSubmit={f.tipo === 'staff' ? activarStaff : verificarAtleta} className="w-full flex flex-col gap-3">
            <p className="text-[11px] text-[#a49c8f] px-2 mb-1">
              Escribe el código de seis dígitos que enviamos a {f.email}.
            </p>
            <input
              value={codigo} onChange={(ev) => setCodigo(ev.target.value)}
              placeholder="000000" maxLength={6} inputMode="numeric"
              className={`${campo} text-center tracking-[0.5em]`}
            />
            <button type="submit" disabled={ocupado || codigo.length < 6} className={botonPrincipal}>
              {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Confirmar y entrar
            </button>
            {volver('puerta', 'Cancelar')}
          </form>
        )}

        <p className="mt-auto pt-8 text-[10px] uppercase tracking-[0.2em] text-[#6d655a]">
          Backyard Ultra Santo Domingo
        </p>
      </div>
    </div>
  );
}
