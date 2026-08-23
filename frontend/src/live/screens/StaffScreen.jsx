import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, QrCode, Timer, LayoutDashboard, LogOut, ChevronRight, Eye, EyeOff, Lock,
  HeartPulse, ScanFace, Loader2, Users, UserRound, Check,
} from 'lucide-react';
import { authJson } from '../liveApi';
import { useLiveTheme, THEMES } from '../liveTheme';
import { Screen } from '../LiveApp';
import PantallaAcceso, { TarjetaAcceso } from '../components/PantallaAcceso';
import { estadoBiometria, activarBiometria, desactivarBiometria, entrarConBiometria } from '../biometria';
import { cerrarSesion, guardarSesion, token as tokenSesion } from '../sesion';
import InputClave from '../components/InputClave';

/**
 * Acceso del staff dentro de BYSD Live: inicia sesión con las credenciales
 * del panel y muestra solo las herramientas que los permisos del perfil
 * habilitan (escáner QR, control de carrera, panel completo).
 */
export default function StaffScreen() {
  const { T } = useLiveTheme();
  const navigate = useNavigate();

  const [logged, setLogged] = useState(() => !!tokenSesion());
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
      const estado = await estadoBiometria();
      if (cancel) return;
      setBio(estado);
      // Igual que en el perfil del corredor: si luego prefiere la contraseña,
      // el usuario ya está puesto.
      // El usuario de la última sesión sirve de respaldo para quien ya tenía
      // la biometría puesta antes de que esto se guardara.
      const recordado = estado.usuario || localStorage.getItem('admin_username') || '';
      if (recordado) setUsername(recordado);
      // Marcada de entrada: activarla desde el propio login es lo que casi
      // todo el mundo quiere, y desmarcarla cuesta un toque.
      setClave((p) => ({ ...p, conBio: estado.disponible && !estado.activada }));
      // Con biometría activada se pide siempre, aunque quede sesión guardada:
      // estas herramientas abren la ficha médica de todos los inscritos.
      if (estado.activada && !tokenSesion()) {
        const token = await entrarConBiometria();
        if (!cancel && token) {
          guardarSesion({ token });
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
    const token = await entrarConBiometria();
    setBioBusy(false);
    if (token) {
      guardarSesion({ token });
      setLogged(true);
      navigate('/live/ir');
    } else {
      setError('No se pudo verificar. Entra con tu usuario y contraseña.');
    }
  };

  const toggleBiometria = async () => {
    if (bioBusy) return;
    setBioBusy(true);
    if (bio.activada) {
      await desactivarBiometria();
      setBio((p) => ({ ...p, activada: false }));
    } else {
      const { ok } = await activarBiometria(
        localStorage.getItem('admin_username'), tokenSesion(),
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
    email: '', code: '', password: '', password2: '',
    conBio: false, cargando: false, msg: '',
  });

  const cambiarModo = (modo) => {
    setError('');
    setClave((p) => ({ ...p, modo, msg: '', code: '', password: '', password2: '' }));
  };

  /**
   * Que se puede hacer con este correo. Se pregunta antes de meter a nadie en
   * un camino que no le toca: sin esto, quien no esta registrado pedia codigo,
   * esperaba un correo que no llegaba y volvia a empezar.
   */
  const estadoDelCorreo = async (correo) => {
    const { ok, data } = await authJson(
      'GET', `/api/staff/account-status?email=${encodeURIComponent(correo)}`,
    );
    return ok ? data : null;
  };

  const pedirCodigo = async () => {
    const correo = clave.email.trim().toLowerCase();
    setClave((p) => ({ ...p, cargando: true, msg: '' }));
    setError('');

    const estado = await estadoDelCorreo(correo);
    if (estado && !estado.es_voluntario && !estado.tiene_cuenta) {
      setClave((p) => ({ ...p, cargando: false }));
      setError('Ese correo no está registrado en el equipo. Si quieres ser voluntario, usa "Quiero ser voluntario".');
      return;
    }

    const { ok, data } = await authJson('POST', '/api/staff/password/request-code', {
      body: { email: correo },
    });
    setClave((p) => ({
      ...p,
      cargando: false,
      modo: ok ? 'definir' : p.modo,
      // Con biometría disponible viene marcado: es lo que casi todo el mundo
      // querrá, y desmarcarlo cuesta un toque.
      conBio: ok ? (bio.disponible && !bio.activada) : p.conBio,
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
    guardarSesion({ ...data, is_admin: false, permissions: data.permissions || [] });

    if (clave.conBio && bio.disponible) {
      const { ok: okBio } = await activarBiometria(email, data.token);
      if (okBio) setBio((p) => ({ ...p, activada: true }));
    }
    setClave({ modo: 'login', email: '', code: '', password: '', password2: '', conBio: false, cargando: false, msg: '' });
    setLogged(true);
    navigate('/live/ir');
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
      body: { username: username.trim(), password },
    });
    setLoading(false);
    if (!ok) {
      // Si es un voluntario que aun no se ha puesto contrasena, ninguna que
      // escriba va a funcionar: se le lleva directo a ponersela en vez de
      // dejarlo probando.
      const correo = username.trim().toLowerCase();
      if (correo.includes('@')) {
        const estado = await estadoDelCorreo(correo);
        if (estado?.es_voluntario && !estado.tiene_password) {
          setError('');
          setClave((p) => ({
            ...p, modo: 'codigo', email: correo, code: '', password: '', password2: '',
            msg: 'Todavía no tienes contraseña. Te enviamos un código para ponerla.',
          }));
          setPassword('');
          return;
        }
      }
      setError(data.detail || 'Usuario o contraseña incorrectos');
      return;
    }
    guardarSesion({ ...data, permissions: data.permissions || [] });
    if (clave.conBio && bio.disponible && !bio.activada) {
      const { ok: okBio } = await activarBiometria(username.trim(), data.token);
      if (okBio) setBio((p) => ({ ...p, activada: true }));
    }
    setPassword('');
    setLogged(true);
    // Entró: a la carrera de entrada (la elegida o la más próxima).
    navigate('/live/ir');
  };

  const logout = async () => {
    // `cerrarSesion` apaga también la biometría: el token del llavero es esta
    // misma sesión, y dejarlo haría que cerrar sesión no cerrara nada.
    await cerrarSesion();
    setBio((p) => ({ ...p, activada: false }));
    setLogged(false);
  };

  if (!logged) {
    const enVoluntario = clave.modo !== 'login';
    // Paleta oscura fija: el acceso es nocturno aunque el tema esté claro.
    const Tacc = THEMES.dark;

    return (
      <PantallaAcceso>
        <TarjetaAcceso
          Icono={ShieldCheck}
          titulo="Acceso del staff"
          subtitulo={
            (clave.modo === 'login' && 'Usa tus credenciales del panel')
            || (clave.modo === 'codigo' && 'Te enviamos un código al correo de tu cuenta para que pongas una contraseña nueva')
            || (clave.modo === 'definir' && `Escribe el código que enviamos a ${clave.email}`)
          }
        >

            <form onSubmit={enviarFormulario} className="space-y-3">
              {/* Usuario, o correo del voluntario: el mismo hueco cambia de
                  papel para no llenar la pantalla de campos. */}
              <label className="block">
                <span className={`block text-[11px] font-bold mb-1 ${Tacc.muted}`}>
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
                  className={`w-full rounded-xl px-3 py-2.5 text-sm outline-none ${Tacc.input} ${clave.modo === 'definir' ? 'opacity-60' : ''}`}
                />
              </label>

              {clave.modo === 'definir' && (
                <>
                  <label className="block">
                    <span className={`block text-[11px] font-bold mb-1 ${Tacc.muted}`}>Código de 6 dígitos</span>
                    <input
                      inputMode="numeric"
                      value={clave.code}
                      onChange={(e) => setClave((p) => ({ ...p, code: e.target.value }))}
                      required
                      className={`w-full rounded-xl px-3 py-2.5 text-sm outline-none ${Tacc.input}`}
                    />
                  </label>
                  <label className="block">
                    <span className={`block text-[11px] font-bold mb-1 ${Tacc.muted}`}>Nueva contraseña (mínimo 8)</span>
                    <InputClave
                      T={Tacc}
                      value={clave.password}
                      onChange={(e) => setClave((p) => ({ ...p, password: e.target.value }))}
                      required
                    />
                  </label>
                  {/* Repetirla: es la unica ocasion en que se escribe a ciegas
                      y no hay forma de recuperarla si sale un dedazo. */}
                  <label className="block">
                    <span className={`block text-[11px] font-bold mb-1 ${Tacc.muted}`}>Repite la contraseña</span>
                    <InputClave
                      T={Tacc}
                      value={clave.password2}
                      onChange={(e) => setClave((p) => ({ ...p, password2: e.target.value }))}
                      required
                    />
                    {clave.password2 && clave.password !== clave.password2 && (
                      <span className="text-[11px] text-red-500 mt-1 block">Las contraseñas no coinciden</span>
                    )}
                  </label>
                </>
              )}

              {clave.modo === 'login' && (
                <label className="block">
                  <span className={`block text-[11px] font-bold mb-1 ${Tacc.muted}`}>Contraseña</span>
                  <div className="relative">
                    <input
                      type={showPwd ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className={`w-full rounded-xl px-3 py-2.5 text-sm outline-none ${Tacc.input}`}
                    />
                    <button type="button" onClick={() => setShowPwd(!showPwd)} className={`absolute right-3 top-1/2 -translate-y-1/2 ${Tacc.muted}`} aria-label="Mostrar contraseña">
                      {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </label>
              )}

              {/* Activar la biometría aquí ahorra tener que buscarla después */}
              {clave.modo !== 'codigo' && bio.disponible && !bio.activada && (
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
                disabled={loading || clave.cargando || (clave.modo === 'definir' && (clave.password.length < 8 || clave.password !== clave.password2))}
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
                  className={`w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold border disabled:opacity-50 ${Tacc.divider}`}
                >
                  {bioBusy
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <ScanFace className="w-4 h-4 text-[#E77622]" />}
                  {bioBusy ? 'Verificando…' : `Entrar con ${bio.nombre}`}
                </button>
              )}

              {/* El código al correo sirve para las dos cosas: ponerse la
                  primera contraseña y recuperar la que se olvidó. Se enuncian
                  por separado porque quien la olvidó no se busca en "soy
                  voluntario y no tengo contraseña". */}
              <div className="flex flex-col items-center gap-2 pt-1">
                {clave.modo === 'login' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => cambiarModo('codigo')}
                      className={`text-xs underline ${Tacc.muted}`}
                    >
                      Olvidé mi contraseña
                    </button>
                    <button
                      type="button"
                      onClick={() => cambiarModo('codigo')}
                      className={`text-xs underline ${Tacc.muted}`}
                    >
                      Soy voluntario y no tengo contraseña
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/live/staff/voluntario')}
                      className="text-xs underline text-[#E77622]"
                    >
                      Quiero ser voluntario
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => cambiarModo('login')}
                    className={`text-xs underline ${Tacc.muted}`}
                  >
                    Ya tengo contraseña, quiero entrar
                  </button>
                )}
              </div>
            </form>
        </TarjetaAcceso>
      </PantallaAcceso>
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
        {tools.length === 0 && (
          <p className={`text-xs px-1 ${T.muted}`}>
            Tu usuario no tiene herramientas habilitadas. Contacta al administrador.
          </p>
        )}

        <div className={`rounded-2xl ${T.card}`}>
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
