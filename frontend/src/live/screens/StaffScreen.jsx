import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, QrCode, Timer, LayoutDashboard, LogOut, ChevronRight, Eye, EyeOff, Lock,
  HeartPulse, ScanFace, Loader2, Users, UserRound, Check,
} from 'lucide-react';
import { authJson } from '../liveApi';
import { useLiveTheme } from '../liveTheme';
import { Screen } from '../LiveApp';
import { estadoBiometria, activarBiometria, desactivarBiometria, entrarConBiometria, STAFF } from '../biometria';
import { cerrarSesionStaff } from '../sesion';

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

  // Biometría del staff: guarda su propio token, aparte del de corredor.
  const [bio, setBio] = useState({ disponible: false, nombre: '', activada: false });
  const [bioBusy, setBioBusy] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const estado = await estadoBiometria(STAFF);
      if (cancel) return;
      setBio(estado);
      // Con biometría activada se pide siempre, aunque quede sesión guardada:
      // estas herramientas abren la ficha médica de todos los inscritos.
      if (estado.activada && !localStorage.getItem('admin_token')) {
        const token = await entrarConBiometria(STAFF);
        if (!cancel && token) {
          localStorage.setItem('admin_token', token);
          setLogged(true);
        }
      }
    })();
    return () => { cancel = true; };
  }, []);

  const entrarBiometrico = async () => {
    if (bioBusy) return;
    setBioBusy(true);
    setError('');
    const token = await entrarConBiometria(STAFF);
    setBioBusy(false);
    if (token) {
      localStorage.setItem('admin_token', token);
      setLogged(true);
    } else {
      setError('No se pudo verificar. Entra con tu usuario y contraseña.');
    }
  };

  const toggleBiometria = async () => {
    if (bioBusy) return;
    setBioBusy(true);
    if (bio.activada) {
      await desactivarBiometria(STAFF);
      setBio((p) => ({ ...p, activada: false }));
    } else {
      const { ok } = await activarBiometria(
        localStorage.getItem('admin_username'), localStorage.getItem('admin_token'), STAFF,
      );
      if (ok) setBio((p) => ({ ...p, activada: true }));
    }
    setBioBusy(false);
  };

  // El acceso es un solo formulario que cambia de forma: credenciales del
  // panel, o alta de contraseña del voluntario en dos pasos. Se evita así una
  // segunda pantalla y una lista de campos que no vienen al caso.
  const [clave, setClave] = useState({
    modo: 'login',      // login | codigo | definir
    email: '', code: '', password: '',
    conBio: false, cargando: false, msg: '',
  });

  const cambiarModo = (modo) => {
    setError('');
    setClave((p) => ({ ...p, modo, msg: '', code: '', password: '' }));
  };

  const pedirCodigo = async () => {
    setClave((p) => ({ ...p, cargando: true, msg: '' }));
    setError('');
    const { ok, data } = await authJson('POST', '/api/staff/password/request-code', {
      body: { email: clave.email.trim().toLowerCase() },
    });
    setClave((p) => ({
      ...p,
      cargando: false,
      modo: ok ? 'definir' : p.modo,
      // Con biometría disponible viene marcado: es lo que casi todo el mundo
      // querrá, y desmarcarlo cuesta un toque.
      conBio: ok ? bio.disponible : p.conBio,
      msg: ok ? data.message : '',
    }));
    if (!ok) setError(data.detail || 'No se pudo enviar el código');
  };

  const definirClave = async () => {
    setClave((p) => ({ ...p, cargando: true, msg: '' }));
    setError('');
    const email = clave.email.trim().toLowerCase();
    const { ok, data } = await authJson('POST', '/api/staff/password/set', {
      body: { email, code: clave.code.trim(), password: clave.password },
    });
    if (!ok) {
      setClave((p) => ({ ...p, cargando: false }));
      setError(data.detail || 'No se pudo guardar la contraseña');
      return;
    }
    localStorage.setItem('admin_token', data.token);
    localStorage.setItem('admin_username', data.username);
    localStorage.setItem('admin_is_admin', 'false');
    localStorage.setItem('admin_permissions', JSON.stringify(data.permissions || []));

    if (clave.conBio && bio.disponible) {
      const { ok: okBio } = await activarBiometria(email, data.token, STAFF);
      if (okBio) setBio((p) => ({ ...p, activada: true }));
    }
    setClave({ modo: 'login', email: '', code: '', password: '', conBio: false, cargando: false, msg: '' });
    setLogged(true);
  };

  /** El mismo submit sirve para los tres estados del formulario. */
  const enviarFormulario = (e) => {
    e.preventDefault();
    if (clave.modo === 'login') return doLogin(e);
    if (clave.modo === 'codigo') return pedirCodigo();
    return definirClave();
  };

  const doLogin = async () => {
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

  const logout = async () => {
    cerrarSesionStaff();
    // El token del llavero es esta misma sesión: dejarlo haría que cerrar
    // sesión no cerrara nada.
    await desactivarBiometria(STAFF);
    setBio((p) => ({ ...p, activada: false }));
    setLogged(false);
  };

  if (!logged) {
    const enVoluntario = clave.modo !== 'login';

    return (
      <Screen title="Staff">
        <div className="px-4 py-6">
          <div className={`rounded-2xl px-5 py-6 ${T.card}`}>
            <div className="flex flex-col items-center mb-5">
              <span className="w-14 h-14 rounded-full bg-[#E77622]/15 flex items-center justify-center mb-3">
                <ShieldCheck className="w-7 h-7 text-[#E77622]" />
              </span>
              <h2 className="text-lg font-bold">Acceso del staff</h2>
              <p className={`text-xs mt-1 text-center ${T.muted}`}>
                {clave.modo === 'login' && 'Usa tus credenciales del panel'}
                {clave.modo === 'codigo' && 'Te enviamos un código al correo con el que te registraste'}
                {clave.modo === 'definir' && `Escribe el código que enviamos a ${clave.email}`}
              </p>
            </div>

            <form onSubmit={enviarFormulario} className="space-y-3">
              {/* Usuario, o correo del voluntario: el mismo hueco cambia de
                  papel para no llenar la pantalla de campos. */}
              <label className="block">
                <span className={`block text-[11px] font-bold mb-1 ${T.muted}`}>
                  {enVoluntario ? 'Tu correo' : 'Usuario'}
                </span>
                <input
                  type={enVoluntario ? 'email' : 'text'}
                  inputMode={enVoluntario ? 'email' : 'text'}
                  value={enVoluntario ? clave.email : username}
                  onChange={(e) => (enVoluntario
                    ? setClave((p) => ({ ...p, email: e.target.value }))
                    : setUsername(e.target.value))}
                  readOnly={clave.modo === 'definir'}
                  required
                  autoCapitalize="none"
                  className={`w-full rounded-xl px-3 py-2.5 text-sm outline-none ${T.input} ${clave.modo === 'definir' ? 'opacity-60' : ''}`}
                />
              </label>

              {clave.modo === 'definir' && (
                <>
                  <label className="block">
                    <span className={`block text-[11px] font-bold mb-1 ${T.muted}`}>Código de 6 dígitos</span>
                    <input
                      inputMode="numeric"
                      value={clave.code}
                      onChange={(e) => setClave((p) => ({ ...p, code: e.target.value }))}
                      required
                      className={`w-full rounded-xl px-3 py-2.5 text-sm outline-none ${T.input}`}
                    />
                  </label>
                  <label className="block">
                    <span className={`block text-[11px] font-bold mb-1 ${T.muted}`}>Nueva contraseña (mínimo 8)</span>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={clave.password}
                      onChange={(e) => setClave((p) => ({ ...p, password: e.target.value }))}
                      required
                      className={`w-full rounded-xl px-3 py-2.5 text-sm outline-none ${T.input}`}
                    />
                  </label>
                </>
              )}

              {clave.modo === 'login' && (
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
              )}

              {/* Activar la biometría aquí ahorra tener que buscarla después */}
              {clave.modo === 'definir' && bio.disponible && (
                <button
                  type="button"
                  onClick={() => setClave((p) => ({ ...p, conBio: !p.conBio }))}
                  className="w-full flex items-center gap-2.5 text-left"
                >
                  <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${clave.conBio ? 'bg-[#E77622] border-[#E77622]' : 'border-gray-500/50'}`}>
                    {clave.conBio && <Check className="w-3 h-3 text-white" />}
                  </span>
                  <span className="text-xs flex items-center gap-1.5">
                    <ScanFace className="w-4 h-4 text-[#E77622]" /> Entrar con {bio.nombre} la próxima vez
                  </span>
                </button>
              )}

              {error && <p className="text-xs text-red-500">{error}</p>}
              {clave.msg && <p className="text-xs text-green-500">{clave.msg}</p>}

              <button
                type="submit"
                disabled={loading || clave.cargando}
                className="w-full bg-[#E77622] hover:bg-[#d96a1a] text-white font-bold rounded-xl py-3 text-sm transition-colors disabled:opacity-50"
              >
                {clave.modo === 'login' && (loading ? 'Entrando…' : 'Iniciar sesión')}
                {clave.modo === 'codigo' && (clave.cargando ? 'Enviando…' : 'Enviarme el código')}
                {clave.modo === 'definir' && (clave.cargando ? 'Guardando…' : 'Guardar e ingresar')}
              </button>

              {clave.modo === 'login' && bio.activada && (
                <button
                  type="button"
                  onClick={entrarBiometrico}
                  disabled={bioBusy}
                  className={`w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold border disabled:opacity-50 ${T.divider}`}
                >
                  {bioBusy
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <ScanFace className="w-4 h-4 text-[#E77622]" />}
                  {bioBusy ? 'Verificando…' : `Entrar con ${bio.nombre}`}
                </button>
              )}

              <div className="flex flex-col items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => cambiarModo(clave.modo === 'login' ? 'codigo' : 'login')}
                  className={`text-xs underline ${T.muted}`}
                >
                  {clave.modo === 'login'
                    ? 'Soy voluntario y no tengo contraseña'
                    : 'Ya tengo contraseña, quiero entrar'}
                </button>
                {clave.modo === 'login' && (
                  <button
                    type="button"
                    onClick={() => navigate('/live/staff/voluntario')}
                    className="text-xs underline text-[#E77622]"
                  >
                    Quiero ser voluntario
                  </button>
                )}
              </div>
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
    can('scanner') && {
      to: '/live/staff/equipo',
      Icon: Users,
      title: 'Equipo',
      description: 'Salud y contacto de emergencia del propio staff',
    },
    // Su perfil lo ve cualquiera del equipo: no hace falta permiso para
    // consultar los datos de uno mismo.
    {
      to: '/live/staff/perfil',
      Icon: UserRound,
      title: 'Mi perfil',
      description: 'Tus datos y los turnos que tienes asignados',
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
            <p className="text-sm font-bold truncate">{isAdmin ? 'Administrador' : 'Staff'}</p>
            <p className={`text-xs truncate ${T.muted}`}>{localStorage.getItem('admin_username')}</p>
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

        {bio.disponible && (
          <div className={`rounded-2xl mt-4 px-4 py-4 flex items-center gap-3.5 ${T.card}`}>
            <ScanFace className="w-5 h-5 text-[#E77622] shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold">Entrar con {bio.nombre}</p>
              <p className={`text-[11px] mt-0.5 leading-relaxed ${T.muted}`}>
                Sin escribir usuario y contraseña cada vez.
              </p>
            </div>
            <button
              role="switch"
              aria-checked={bio.activada}
              onClick={toggleBiometria}
              disabled={bioBusy}
              className={`w-12 h-7 rounded-full relative transition-colors shrink-0 disabled:opacity-50 ${bio.activada ? 'bg-[#E77622]' : 'bg-gray-500/40'}`}
            >
              <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${bio.activada ? 'left-6' : 'left-1'}`} />
            </button>
          </div>
        )}

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
