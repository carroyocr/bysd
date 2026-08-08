import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Eye, EyeOff, LogOut, Pencil, KeyRound, Trophy, FileText, Image as ImageIcon,
  ChevronDown, Medal, Heart, Upload, Paperclip, Camera, Loader2,
  GraduationCap, Check, XCircle, Calendar, Users as UsersIcon, Coffee,
  Mountain, ExternalLink, ScanFace, RefreshCw,
} from 'lucide-react';
import { API, authJson, flagOf, initialsOf, statusLabel } from '../liveApi';
import { useLiveTheme } from '../liveTheme';
import { Screen } from '../LiveApp';
import { openExternal } from '../../lib/nativeExport';
import { useRaceConfig } from '../../contexts/RaceConfigContext';
import { estadoBiometria, activarBiometria, desactivarBiometria, entrarConBiometria } from '../biometria';
import { marcarAccesoAtleta, accesoAtletaCaducado, cerrarSesionAtleta, HORAS_SESION } from '../sesion';
import Picker, { PickerSheet, Wheel } from '../components/Picker';

const TOKEN_KEY = 'athlete_token';

const SEXOS = ['Masculino', 'Femenino'];
const SANGRES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const TALLAS = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const TABS = [
  { key: 'datos', label: 'Datos', icon: User },
  { key: 'carreras', label: 'Mis carreras', icon: Medal },
  { key: 'capacitaciones', label: 'Capacitaciones', icon: GraduationCap },
  { key: 'experiencia', label: 'Experiencia', icon: Mountain },
  { key: 'historial', label: 'Historial', icon: Trophy },
];

const VUELTAS_OPCIONES = [
  'Al menos 1', 'De 2 a 5', 'De 6 a 10', 'De 11 a 15', 'De 16 a 20',
  'De 21 a 24', 'Hasta que sea el ganador', 'No estoy seguro',
];

// Fecha y hora de una capacitación, en formato corto y legible.
function formatCapDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const fecha = d.toLocaleDateString('es-DO', { weekday: 'short', day: 'numeric', month: 'short' });
  const hora = d.toLocaleTimeString('es-DO', { hour: 'numeric', minute: '2-digit' });
  return `${fecha} · ${hora}`;
}

// La duración se escribe a mano en el panel y casi siempre es un número suelto
// ("2"), que sin unidad no dice nada.
function formatDuracion(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  return /^\d+([.,]\d+)?$/.test(s) ? `${s} h` : s;
}

/**
 * Convierte el programa (texto libre del panel) en una lista de piezas.
 *
 * Viene escrito con una convención estable: líneas "Módulo N — título",
 * viñetas que abren con ●, y la pausa marcada con ☕. Volcarlo tal cual en HTML
 * aplasta los saltos de línea y queda un ladrillo ilegible, así que se
 * reconoce cada tipo de línea y se pinta por separado.
 */
function parsePrograma(raw) {
  if (!raw) return [];
  return String(raw)
    .split('\n')
    .map((linea) => linea.trim())
    .filter(Boolean)
    .map((linea) => {
      if (/^[●•*-]\s*/.test(linea)) {
        return { tipo: 'punto', texto: linea.replace(/^[●•*-]\s*/, '').trim() };
      }
      if (/^☕/.test(linea)) {
        // El icono lo pone la interfaz; el emoji del texto sobra.
        return { tipo: 'pausa', texto: linea.replace(/^☕\s*/, '').trim() };
      }
      if (/^m[óo]dulo\s*\d+/i.test(linea)) {
        return { tipo: 'modulo', texto: linea };
      }
      return { tipo: 'parrafo', texto: linea };
    });
}

/* ---------- piezas de formulario con el tema de LiveApp ---------- */

function Field({ T, label, children }) {
  return (
    <label className="block">
      <span className={`block text-[11px] font-bold mb-1 ${T.muted}`}>{label}</span>
      {children}
    </label>
  );
}

function TextInput({ T, ...props }) {
  return <input {...props} className={`w-full rounded-xl px-3 py-2.5 text-sm outline-none ${T.input}`} />;
}

// Mantiene la firma de un <select> (onChange con e.target.value) pero usa el
// Picker propio de la app en vez del desplegable nativo del sistema.
function SelectInput({ T, options, placeholder, value, onChange }) {
  return (
    <Picker
      options={options}
      placeholder={placeholder}
      value={value}
      onSelect={(v) => onChange({ target: { value: v } })}
    />
  );
}

function PrimaryButton({ children, ...props }) {
  return (
    <button
      {...props}
      className="w-full bg-[#E77622] hover:bg-[#d96a1a] text-white font-bold rounded-xl py-3 text-sm transition-colors disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function Msg({ T, msg }) {
  if (!msg) return null;
  return (
    <p className={`text-xs mt-2 ${msg.type === 'error' ? 'text-red-500' : 'text-green-500'}`}>
      {msg.text}
    </p>
  );
}

/**
 * Selector de fecha con el diseño de la app (día/mes/año): el calendario
 * nativo del sistema desentona con el tema oscuro y no se puede estilizar.
 */
function DateField({ T, value, onChange, fromYear, toYear, title = 'Fecha' }) {
  const now = new Date();
  const startYear = fromYear ?? now.getFullYear() - 10;
  const endYear = toYear ?? 1930;
  const years = [];
  for (let i = startYear; i >= endYear; i--) years.push(String(i));

  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState({ y: '', m: '', d: '' });

  const openSheet = () => {
    const [y = '', m = '', d = ''] = (value || '').split('-');
    if (y) {
      setTemp({ y, m: String(parseInt(m, 10)), d: String(parseInt(d, 10)) });
    } else if (startYear >= now.getFullYear()) {
      // Fechas recientes (p. ej. fecha de pago): arranca en hoy
      setTemp({ y: String(now.getFullYear()), m: String(now.getMonth() + 1), d: String(now.getDate()) });
    } else {
      setTemp({ y: '1990', m: '6', d: '15' });
    }
    setOpen(true);
  };

  const daysInMonth = new Date(parseInt(temp.y || '2000', 10), parseInt(temp.m || '1', 10), 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));

  const confirm = () => {
    const d = Math.min(parseInt(temp.d || '1', 10), daysInMonth);
    onChange(`${temp.y}-${String(temp.m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    setOpen(false);
  };

  const label = value
    ? (() => {
        const [y, m, d] = value.split('-');
        return `${parseInt(d, 10)} de ${MESES[parseInt(m, 10) - 1]} de ${y}`;
      })()
    : 'Seleccionar fecha';

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm text-left ${T.input}`}
      >
        <span className={value ? '' : 'opacity-50'}>{label}</span>
        <ChevronDown className="w-4 h-4 opacity-60 shrink-0" />
      </button>
      {open && (
        <PickerSheet title={title} onClose={() => setOpen(false)} onConfirm={confirm}>
          <Wheel
            options={days}
            value={String(Math.min(parseInt(temp.d || '1', 10), daysInMonth))}
            onChange={(v) => setTemp((p) => ({ ...p, d: v }))}
          />
          <Wheel
            options={MESES.map((nombre, i) => ({ value: String(i + 1), label: nombre }))}
            value={temp.m}
            onChange={(v) => setTemp((p) => ({ ...p, m: v }))}
          />
          <Wheel
            options={years}
            value={temp.y}
            onChange={(v) => setTemp((p) => ({ ...p, y: v }))}
          />
        </PickerSheet>
      )}
    </>
  );
}

function Toggle({ on, onChange, disabled }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={onChange}
      disabled={disabled}
      className={`w-12 h-7 rounded-full relative transition-colors shrink-0 disabled:opacity-50 ${on ? 'bg-[#E77622]' : 'bg-gray-500/40'}`}
    >
      <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? 'left-6' : 'left-1'}`} />
    </button>
  );
}

function InfoRow({ T, label, value }) {
  return (
    <div className={`flex justify-between gap-3 py-2 border-b last:border-b-0 ${T.divider}`}>
      <span className={`text-xs ${T.muted}`}>{label}</span>
      <span className="text-xs font-semibold text-right">{value || '—'}</span>
    </div>
  );
}

/**
 * Perfil del corredor dentro de BYSD Live: inicia sesión con la cuenta de
 * atleta del sitio (mismos endpoints) y muestra sus datos, carreras y
 * certificados con el diseño de la app.
 */
export default function PerfilScreen() {
  const { T } = useLiveTheme();
  const navigate = useNavigate();
  const { config } = useRaceConfig();

  const [view, setView] = useState(() => (localStorage.getItem(TOKEN_KEY) ? 'cargando' : 'login'));
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  // Login / verificación / restablecer
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [regData, setRegData] = useState({});
  const [bio, setBio] = useState({ disponible: false, nombre: '', activada: false });
  const [bioBusy, setBioBusy] = useState(false);

  // Panel
  const [athlete, setAthlete] = useState(null);
  const [myRaces, setMyRaces] = useState([]);
  const [history, setHistory] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({});
  const [showPwdForm, setShowPwdForm] = useState(false);
  const [pwdData, setPwdData] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Inscripción a la carrera activa (mismo flujo que /mi-perfil en la web)
  const [showInscription, setShowInscription] = useState(false);
  const [inscribing, setInscribing] = useState(false);
  const [inscriptionData, setInscriptionData] = useState({
    motivacion: '', anos_experiencia: '', maxima_distancia_km: '',
    vueltas_aspiradas: '', tiene_carpa: '', hospedaje: '', acompanantes: '',
  });

  // Comprobante de pago (mismo endpoint que /subir-comprobante en la web)
  const [receiptRace, setReceiptRace] = useState(null);
  const [receiptInfo, setReceiptInfo] = useState(null);
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptData, setReceiptData] = useState({ payment_date: '', bank_origin: '', transfer_number: '' });
  const [submittingReceipt, setSubmittingReceipt] = useState(false);

  // Capacitaciones (mismos endpoints que la pestaña de /mi-perfil en la web)
  const [caps, setCaps] = useState([]);
  const [capBusy, setCapBusy] = useState(null);
  // Acordeón: los programas son largos, así que arrancan cerrados y solo se
  // abre uno a la vez.
  const [capAbierta, setCapAbierta] = useState(null);

  // Cancelar la inscripción a una carrera
  const [cancelando, setCancelando] = useState(null);

  const [tab, setTab] = useState('datos');

  // Perfil público. Se guarda al vuelo y se pinta de inmediato, para que el
  // interruptor no se quede quieto mientras responde el backend.
  const [savingPrivacidad, setSavingPrivacidad] = useState(false);
  const perfilPublico = athlete?.perfil_publico !== false;

  const togglePerfilPublico = async () => {
    if (savingPrivacidad) return;
    const siguiente = !perfilPublico;
    setSavingPrivacidad(true);
    setMsg(null);
    setAthlete((p) => ({ ...p, perfil_publico: siguiente }));
    const { ok, data } = await authJson('PUT', '/api/athletes/profile', {
      token: token(),
      body: { perfil_publico: siguiente },
    });
    setSavingPrivacidad(false);
    if (ok) {
      setMsg({
        type: 'ok',
        text: siguiente
          ? 'Tu perfil vuelve a ser público.'
          : 'Tu perfil ya no aparece en las listas públicas.',
      });
    } else {
      setAthlete((p) => ({ ...p, perfil_publico: perfilPublico }));  // se deshace
      setMsg({ type: 'error', text: data.detail || 'No se pudo guardar' });
    }
  };

  // Experiencia ITRA. ITRA no tiene API pública y bloquea la lectura desde
  // servidores, así que el atleta copia sus datos a mano desde itra.run.
  const [itraEdit, setItraEdit] = useState(false);
  const [savingItra, setSavingItra] = useState(false);
  const [itraData, setItraData] = useState({});
  const [cargandoItra, setCargandoItra] = useState(false);
  const itraSnap = athlete?.itra_snapshot || {};

  /**
   * Trae los datos desde itra.run. Es lo que hace innecesario copiarlos a
   * mano; el formulario manual se queda como plan B, porque esto depende de
   * una página ajena que puede cambiar o no dejarse leer.
   */
  const cargarDesdeItra = async (url) => {
    const enlace = (url ?? athlete?.itra_url ?? '').trim();
    if (!enlace) {
      setMsg({ type: 'error', text: 'Escribe primero el enlace de tu perfil de ITRA' });
      return;
    }
    setCargandoItra(true);
    setMsg(null);
    const { ok, data } = await authJson('POST', '/api/athletes/itra/sync', {
      token: token(),
      body: { itra_url: enlace },
    });
    setCargandoItra(false);
    if (ok) {
      setAthlete((p) => ({ ...p, itra_url: data.itra_url, itra_snapshot: data.itra_snapshot }));
      setItraEdit(false);
      const n = (data.itra_snapshot?.results || []).length;
      setMsg({ type: 'ok', text: `Datos actualizados desde ITRA${n ? ` · ${n} carreras` : ''}.` });
    } else {
      setMsg({ type: 'error', text: data.detail || 'No se pudieron cargar los datos' });
    }
  };

  const startItra = () => {
    setItraData({
      itra_url: athlete?.itra_url || '',
      performance_index: itraSnap.performance_index ?? '',
      level: itraSnap.level || '',
      age_category: itraSnap.age_category || '',
      finished_races: itraSnap.finished_races ?? '',
      total_distance_km: itraSnap.total_distance_km ?? '',
      total_elevation_m: itraSnap.total_elevation_m ?? '',
      total_race_time: itraSnap.total_race_time || '',
    });
    setMsg(null);
    setItraEdit(true);
  };

  const saveItra = async () => {
    const url = (itraData.itra_url || '').trim();
    if (url && !/^https?:\/\//i.test(url)) {
      setMsg({ type: 'error', text: 'El enlace debe empezar por http:// o https://' });
      return;
    }
    setSavingItra(true);
    setMsg(null);
    const numero = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
    const { ok, data } = await authJson('PUT', '/api/athletes/profile', {
      token: token(),
      body: {
        itra_url: url,
        itra_snapshot: {
          performance_index: numero(itraData.performance_index),
          level: itraData.level || null,
          age_category: itraData.age_category || null,
          finished_races: numero(itraData.finished_races),
          total_distance_km: numero(itraData.total_distance_km),
          total_elevation_m: numero(itraData.total_elevation_m),
          total_race_time: itraData.total_race_time || null,
          // El backend reemplaza el snapshot entero, así que los resultados
          // que se cargaron desde la web hay que devolverlos tal cual o se
          // perderían al guardar desde aquí.
          results: itraSnap.results || [],
        },
      },
    });
    setSavingItra(false);
    if (ok) {
      setItraEdit(false);
      setMsg({ type: 'ok', text: 'Experiencia actualizada' });
      fetchAll();
    } else {
      setMsg({ type: 'error', text: data.detail || 'No se pudo guardar' });
    }
  };

  const token = () => localStorage.getItem(TOKEN_KEY);

  /** Devuelve si la sesión seguía siendo válida, para poder avisar al llamar. */
  const fetchAll = async () => {
    const { ok, data } = await authJson('GET', '/api/athletes/profile', { token: token() });
    if (!ok) {
      localStorage.removeItem(TOKEN_KEY);
      setView('login');
      return false;
    }
    setAthlete(data);
    setView('panel');
    authJson('GET', '/api/athletes/my-races', { token: token() })
      .then((r) => { if (r.ok) setMyRaces(r.data.races || []); });
    authJson('GET', '/api/athletes/race-history', { token: token() })
      .then((r) => { if (r.ok) setHistory(r.data.history || []); });
    fetchCaps();
    return true;
  };

  /**
   * La sesión que guarda la biometría caduca a los 3 días como cualquier otra.
   * Sin esto, pasado ese plazo el teléfono te reconocía la cara y te dejaba en
   * el login sin explicación, como si Face ID estuviera roto. Se avisa y se
   * borra la credencial guardada, que ya no sirve para nada.
   */
  const sesionBiometricaCaducada = async () => {
    await desactivarBiometria();
    setBio((p) => ({ ...p, activada: false }));
    setMsg({
      type: 'error',
      text: `Tu sesión caducó (dura 3 días). Entra con tu contraseña y vuelve a activar ${bio.nombre || 'la biometría'}.`,
    });
  };

  const fetchCaps = () =>
    authJson('GET', '/api/capacitaciones/list', { token: token() })
      .then((r) => { if (r.ok) setCaps(r.data.capacitaciones || []); });

  /** Inscribirse o darse de baja de una capacitación (el mismo endpoint, según el verbo). */
  const toggleCap = async (cap) => {
    if (capBusy) return;
    if (cap.my_registered &&
        !window.confirm(`¿Cancelar tu inscripción a "${cap.name}"?`)) return;
    setCapBusy(cap.id);
    setMsg(null);
    const { ok, data } = await authJson(
      cap.my_registered ? 'DELETE' : 'POST',
      `/api/capacitaciones/${cap.id}/register`,
      { token: token() },
    );
    setCapBusy(null);
    if (ok) {
      setMsg({ type: 'ok', text: cap.my_registered ? 'Inscripción cancelada' : '¡Te inscribiste!' });
      fetchCaps();
    } else {
      setMsg({ type: 'error', text: data.detail || 'No se pudo completar la operación' });
    }
  };

  /**
   * Cancelar la inscripción a una carrera. El backend solo lo permite mientras
   * no haya comprobante de pago; aquí el botón ya se esconde en ese caso, pero
   * la comprobación buena es la suya.
   */
  const cancelarCarrera = async (race) => {
    if (cancelando) return;
    const nombre = race.race_name || race.race_code;
    if (!window.confirm(
      `¿Cancelar tu inscripción a ${nombre}?\n\nPerderás tu lugar y no se puede deshacer.`
    )) return;
    setCancelando(race.registration_id);
    setMsg(null);
    const { ok, data } = await authJson(
      'DELETE', `/api/athletes/cancel-race/${race.registration_id}`, { token: token() },
    );
    setCancelando(null);
    if (ok) {
      setMsg({ type: 'ok', text: 'Inscripción cancelada' });
      authJson('GET', '/api/athletes/my-races', { token: token() })
        .then((r) => { if (r.ok) setMyRaces(r.data.races || []); });
    } else {
      setMsg({ type: 'error', text: data.detail || 'No se pudo cancelar' });
    }
  };

  /**
   * Puerta de entrada al perfil.
   *
   * Con biometría activada se pide la cara o la huella SIEMPRE, aunque la
   * sesión siga abierta: el teléfono se presta y se deja encima de la mesa, y
   * aquí dentro hay datos médicos y de contacto. Sin biometría, la sesión de la
   * app dura 3 horas y luego toca la contraseña, aunque el token del backend
   * aguante más.
   */
  useEffect(() => {
    let cancelado = false;
    (async () => {
      const estado = await estadoBiometria();
      if (cancelado) return;
      setBio(estado);

      if (estado.activada) {
        setView('bloqueado');
        const guardado = await entrarConBiometria();
        if (cancelado) return;
        if (!guardado) return;                       // canceló: se queda bloqueado
        localStorage.setItem(TOKEN_KEY, guardado);
        marcarAccesoAtleta();
        if (!(await fetchAll()) && !cancelado) await sesionBiometricaCaducada();
        return;
      }

      if (accesoAtletaCaducado()) {
        cerrarSesionAtleta();
        setMsg({ type: 'error', text: `Han pasado más de ${HORAS_SESION} horas. Entra otra vez.` });
        setView('login');
        return;
      }
      if (token()) fetchAll();
    })();
    return () => { cancelado = true; };
  }, []);

  const doLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    const { ok, status, data } = await authJson('POST', '/api/athletes/login', { body: { email, password } });
    setLoading(false);
    if (ok) {
      localStorage.setItem(TOKEN_KEY, data.token);
      marcarAccesoAtleta();
      if (bio.disponible && !bio.activada) {
        setMsg({ type: 'ok', text: `Puedes entrar con ${bio.nombre} la próxima vez: actívalo en la pestaña Datos.` });
      }
      fetchAll();
    } else if (status === 403) {
      setPendingEmail(email);
      setCode('');
      setMsg({ type: 'ok', text: 'Te enviamos un código de verificación a tu correo.' });
      setView('verificar');
    } else {
      setMsg({ type: 'error', text: data.detail || 'Error al iniciar sesión' });
    }
  };

  const entrarBiometrico = async () => {
    if (bioBusy) return;
    setBioBusy(true);
    setMsg(null);
    const guardado = await entrarConBiometria();
    setBioBusy(false);
    if (guardado) {
      localStorage.setItem(TOKEN_KEY, guardado);
      marcarAccesoAtleta();
      if (!(await fetchAll())) await sesionBiometricaCaducada();
    } else {
      setMsg({ type: 'error', text: 'No se pudo verificar. Entra con tu contraseña.' });
    }
  };

  /** Activa o quita el acceso con cara o huella para esta cuenta. */
  const toggleBiometria = async () => {
    if (bioBusy) return;
    setBioBusy(true);
    setMsg(null);
    if (bio.activada) {
      await desactivarBiometria();
      setBio((p) => ({ ...p, activada: false }));
      setMsg({ type: 'ok', text: `${bio.nombre} desactivado.` });
    } else {
      const { ok } = await activarBiometria(athlete?.email, token());
      if (ok) {
        setBio((p) => ({ ...p, activada: true }));
        setMsg({ type: 'ok', text: `Listo: la próxima vez entra con ${bio.nombre}.` });
      } else {
        setMsg({ type: 'error', text: 'No se pudo activar. Inténtalo de nuevo.' });
      }
    }
    setBioBusy(false);
  };

  const startRegistro = () => {
    setRegData({
      email: email || '', password: '', nombre: '', apellidos: '', telefono: '',
      fecha_nacimiento: '', sexo: '', ciudad_residencia: '',
    });
    setMsg(null);
    setView('registro');
  };

  const updReg = (campo) => (e) => setRegData((p) => ({ ...p, [campo]: e.target.value }));

  /**
   * Alta de cuenta. El backend crea el perfil y manda un código al correo, así
   * que se sigue por la misma pantalla de verificación que ya usaba el login.
   */
  const doRegistro = async (e) => {
    e.preventDefault();
    if ((regData.password || '').length < 8) {
      setMsg({ type: 'error', text: 'La contraseña debe tener al menos 8 caracteres' });
      return;
    }
    setLoading(true);
    setMsg(null);
    const { ok, data } = await authJson('POST', '/api/athletes/register', {
      body: {
        ...regData,
        email: (regData.email || '').trim().toLowerCase(),
        nacionalidad: 'DOM',
      },
    });
    setLoading(false);
    if (ok) {
      setPendingEmail(regData.email.trim().toLowerCase());
      setCode('');
      setMsg({ type: 'ok', text: 'Cuenta creada. Te enviamos un código a tu correo.' });
      setView('verificar');
    } else {
      setMsg({ type: 'error', text: data.detail || 'No se pudo crear la cuenta' });
    }
  };

  const doVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    const { ok, data } = await authJson('POST', '/api/athletes/verify-email', {
      body: { email: pendingEmail, code },
    });
    setLoading(false);
    if (ok) {
      localStorage.setItem(TOKEN_KEY, data.token);
      marcarAccesoAtleta();
      fetchAll();
    } else {
      setMsg({ type: 'error', text: data.detail || 'Código incorrecto' });
    }
  };

  const doForgot = async (e) => {
    e.preventDefault();
    if (!email) {
      setMsg({ type: 'error', text: 'Escribe tu email primero' });
      return;
    }
    setLoading(true);
    setMsg(null);
    const { ok } = await authJson('POST', '/api/athletes/forgot-password', { body: { email } });
    setLoading(false);
    if (ok) {
      setPendingEmail(email);
      setCode('');
      setNewPassword('');
      setMsg({ type: 'ok', text: 'Código enviado a tu correo.' });
      setView('restablecer');
    } else {
      setMsg({ type: 'error', text: 'No se pudo enviar el código' });
    }
  };

  const doReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    const { ok, data } = await authJson('POST', '/api/athletes/reset-password', {
      body: { email: pendingEmail, code, new_password: newPassword },
    });
    setLoading(false);
    if (ok) {
      setMsg({ type: 'ok', text: 'Contraseña actualizada. Inicia sesión.' });
      setView('login');
    } else {
      setMsg({ type: 'error', text: data.detail || 'Error al restablecer' });
    }
  };

  const startEdit = () => {
    setEditData({
      nombre: athlete?.nombre || '', apellidos: athlete?.apellidos || '',
      telefono: athlete?.telefono || '', fecha_nacimiento: athlete?.fecha_nacimiento || '',
      sexo: athlete?.sexo || '', nacionalidad: athlete?.nacionalidad || '',
      ciudad_residencia: athlete?.ciudad_residencia || '',
      tipo_sangre: athlete?.tipo_sangre || '',
      condicion_medica: athlete?.condicion_medica || 'No',
      condicion_medica_detalle: athlete?.condicion_medica_detalle || '',
      alergias: athlete?.alergias || 'No',
      alergias_detalle: athlete?.alergias_detalle || '',
      contacto_emergencia_nombre: athlete?.contacto_emergencia_nombre || '',
      contacto_emergencia_relacion: athlete?.contacto_emergencia_relacion || '',
      contacto_emergencia_telefono: athlete?.contacto_emergencia_telefono || '',
      talla_camiseta: athlete?.talla_camiseta || '',
      personalizacion_camiseta: athlete?.personalizacion_camiseta || '',
      como_se_entero: athlete?.como_se_entero || '',
    });
    setEditMode(true);
    setMsg(null);
  };

  const saveEdit = async () => {
    setLoading(true);
    setMsg(null);
    const { ok, data } = await authJson('PUT', '/api/athletes/profile', { token: token(), body: editData });
    setLoading(false);
    if (ok) {
      setEditMode(false);
      setMsg({ type: 'ok', text: 'Perfil actualizado' });
      fetchAll();
    } else {
      setMsg({ type: 'error', text: data.detail || 'Error al guardar' });
    }
  };

  const changePassword = async () => {
    if (!pwdData.current_password || !pwdData.new_password) {
      setMsg({ type: 'error', text: 'Completa todos los campos' });
      return;
    }
    if (pwdData.new_password.length < 6) {
      setMsg({ type: 'error', text: 'La nueva contraseña debe tener al menos 6 caracteres' });
      return;
    }
    if (pwdData.new_password !== pwdData.confirm_password) {
      setMsg({ type: 'error', text: 'Las contraseñas no coinciden' });
      return;
    }
    setLoading(true);
    setMsg(null);
    const { ok, data } = await authJson('POST', '/api/athletes/change-password', {
      token: token(),
      body: { current_password: pwdData.current_password, new_password: pwdData.new_password },
    });
    setLoading(false);
    if (ok) {
      setShowPwdForm(false);
      setPwdData({ current_password: '', new_password: '', confirm_password: '' });
      setMsg({ type: 'ok', text: 'Contraseña actualizada' });
    } else {
      setMsg({ type: 'error', text: data.detail || 'Error al cambiar la contraseña' });
    }
  };

  const inscribeRace = async () => {
    if (!inscriptionData.motivacion) {
      setMsg({ type: 'error', text: 'Indica qué te motiva a participar' });
      return;
    }
    setInscribing(true);
    setMsg(null);
    const { ok, data } = await authJson('POST', '/api/athletes/register-race', {
      token: token(),
      body: {
        race_code: config?.code,
        motivacion: inscriptionData.motivacion,
        anos_experiencia: inscriptionData.anos_experiencia ? parseInt(inscriptionData.anos_experiencia, 10) : null,
        maxima_distancia_km: inscriptionData.maxima_distancia_km ? parseFloat(inscriptionData.maxima_distancia_km) : null,
        vueltas_aspiradas: inscriptionData.vueltas_aspiradas,
        tiene_carpa: inscriptionData.tiene_carpa,
        hospedaje: inscriptionData.hospedaje,
        acompanantes: inscriptionData.acompanantes ? parseInt(inscriptionData.acompanantes, 10) : null,
      },
    });
    setInscribing(false);
    if (ok) {
      setShowInscription(false);
      setMsg({
        type: 'ok',
        text: data.waitlisted
          ? 'Inscripción recibida: la carrera alcanzó su cupo y quedaste en lista de espera. Te avisaremos por correo si se libera un lugar.'
          : `¡Inscripción realizada! Tu BIB es el #${data.bib}`,
      });
      authJson('GET', '/api/athletes/my-races', { token: token() })
        .then((r) => { if (r.ok) setMyRaces(r.data.races || []); });
    } else {
      setMsg({ type: 'error', text: data.detail || 'Error al inscribirse' });
    }
  };

  const uploadPhoto = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    // Mismos límites que el sitio: alta resolución para la credencial
    if (file.size < 1024 * 1024) {
      setMsg({ type: 'error', text: 'La foto debe ser de alta resolución (mínimo 1MB)' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setMsg({ type: 'error', text: 'El archivo es demasiado grande (máximo 10MB)' });
      return;
    }
    setUploadingPhoto(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      const res = await fetch(`${API}/api/athletes/upload-photo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` },
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'No se pudo subir la foto');
      }
      setMsg({ type: 'ok', text: 'Foto actualizada' });
      fetchAll();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const openReceiptForm = async (race) => {
    setReceiptRace(race.registration_id);
    setReceiptFile(null);
    setReceiptData({ payment_date: '', bank_origin: '', transfer_number: '' });
    setReceiptInfo(null);
    setMsg(null);
    try {
      const res = await fetch(`${API}/api/registration/payment-info/${race.edit_token}`);
      if (res.ok) {
        const data = await res.json();
        setReceiptInfo(data.race_config || null);
      }
    } catch { /* la info bancaria es opcional */ }
  };

  const pickReceiptFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type)) {
      setMsg({ type: 'error', text: 'Formato no válido. Usa JPG, PNG, WebP o PDF.' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setMsg({ type: 'error', text: 'El archivo es demasiado grande (máximo 10MB)' });
      return;
    }
    setMsg(null);
    setReceiptFile(file);
  };

  const submitReceipt = async (race) => {
    if (!receiptFile) {
      setMsg({ type: 'error', text: 'Selecciona la imagen o PDF del comprobante' });
      return;
    }
    if (!receiptData.payment_date) {
      setMsg({ type: 'error', text: 'Indica la fecha del pago' });
      return;
    }
    if (!receiptData.bank_origin) {
      setMsg({ type: 'error', text: 'Indica el banco desde donde pagaste' });
      return;
    }
    setSubmittingReceipt(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append('receipt_image', receiptFile);
      fd.append('payment_date', receiptData.payment_date);
      fd.append('bank_origin', receiptData.bank_origin);
      if (receiptData.transfer_number) fd.append('transfer_number', receiptData.transfer_number);
      const res = await fetch(`${API}/api/registration/submit-payment-receipt/${race.edit_token}`, {
        method: 'POST',
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Error al enviar el comprobante');
      }
      setReceiptRace(null);
      setMsg({ type: 'ok', text: '¡Comprobante enviado! El equipo lo revisará pronto.' });
      authJson('GET', '/api/athletes/my-races', { token: token() })
        .then((r) => { if (r.ok) setMyRaces(r.data.races || []); });
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setSubmittingReceipt(false);
    }
  };

  const logout = async () => {
    cerrarSesionAtleta();
    // El token guardado en el llavero es esta misma sesión: si se deja, cerrar
    // sesión no cerraría nada, bastaría la cara para volver a entrar.
    await desactivarBiometria();
    setBio((p) => ({ ...p, activada: false }));
    setAthlete(null);
    setEditMode(false);
    setMsg(null);
    setView('login');
  };

  const upd = (field) => (e) => setEditData((p) => ({ ...p, [field]: e.target.value }));

  /* ---------------- vistas de autenticación ---------------- */

  const authCard = (title, subtitle, body) => (
    <div className="px-4 py-6">
      <div className={`rounded-2xl px-5 py-6 ${T.card}`}>
        <div className="flex flex-col items-center mb-5">
          <span className="w-14 h-14 rounded-full bg-[#E77622]/15 flex items-center justify-center mb-3">
            <User className="w-7 h-7 text-[#E77622]" />
          </span>
          <h2 className="text-lg font-bold">{title}</h2>
          {subtitle && <p className={`text-xs mt-1 text-center ${T.muted}`}>{subtitle}</p>}
        </div>
        {body}
        <Msg T={T} msg={msg} />
      </div>
    </div>
  );

  if (view === 'cargando') {
    return (
      <Screen title="Perfil del corredor">
        <p className={`text-center text-sm py-16 ${T.muted}`}>Cargando…</p>
      </Screen>
    );
  }

  // Biometría activada y todavía sin pasar: el perfil no se enseña.
  if (view === 'bloqueado') {
    return (
      <Screen title="Perfil del corredor">
        <div className="px-4 py-10 text-center">
          <span className="w-20 h-20 rounded-full bg-[#E77622]/15 flex items-center justify-center mx-auto mb-5">
            <ScanFace className="w-9 h-9 text-[#E77622]" />
          </span>
          <p className="font-bold">Perfil protegido</p>
          <p className={`text-xs mt-1.5 mb-6 leading-relaxed ${T.muted}`}>
            Usa {bio.nombre || 'tu biometría'} para entrar.
          </p>
          <Msg T={T} msg={msg} />
          <button
            onClick={entrarBiometrico}
            disabled={bioBusy}
            className="w-full flex items-center justify-center gap-2 bg-[#E77622] text-white font-bold rounded-xl py-3 text-sm disabled:opacity-50"
          >
            {bioBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanFace className="w-4 h-4" />}
            {bioBusy ? 'Verificando…' : `Entrar con ${bio.nombre}`}
          </button>
          <button
            onClick={async () => { await desactivarBiometria(); setBio((p) => ({ ...p, activada: false })); cerrarSesionAtleta(); setView('login'); }}
            className={`block mx-auto text-xs underline mt-5 ${T.muted}`}
          >
            Entrar con mi contraseña
          </button>
        </div>
      </Screen>
    );
  }

  if (view === 'login') {
    return (
      <Screen title="Perfil del corredor">
        {authCard('Mi cuenta de atleta', 'Usa la misma cuenta del sitio web', (
          <form onSubmit={doLogin} className="space-y-3">
            <Field T={T} label="Email">
              <TextInput T={T} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </Field>
            <Field T={T} label="Contraseña">
              <div className="relative">
                <TextInput T={T} type={showPwd ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
                <button type="button" onClick={() => setShowPwd(!showPwd)} className={`absolute right-3 top-1/2 -translate-y-1/2 ${T.muted}`} aria-label="Mostrar contraseña">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </Field>
            <PrimaryButton type="submit" disabled={loading}>
              {loading ? 'Entrando…' : 'Iniciar sesión'}
            </PrimaryButton>
            {bio.activada && (
              <button
                type="button"
                onClick={entrarBiometrico}
                disabled={bioBusy}
                className={`w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold border disabled:opacity-50 ${T.divider}`}
              >
                <ScanFace className="w-4 h-4 text-[#E77622]" />
                {bioBusy ? 'Verificando…' : `Entrar con ${bio.nombre}`}
              </button>
            )}
            <div className="flex justify-between pt-1">
              <button type="button" onClick={doForgot} className={`text-xs underline ${T.muted}`}>
                Olvidé mi contraseña
              </button>
              <button type="button" onClick={startRegistro} className="text-xs underline text-[#E77622]">
                Crear cuenta
              </button>
            </div>
          </form>
        ))}
      </Screen>
    );
  }

  if (view === 'registro') {
    return (
      <Screen title="Crear cuenta">
        {authCard('Crear mi cuenta', 'Con ella te inscribes y sigues tu carrera', (
          <form onSubmit={doRegistro} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field T={T} label="Nombre *">
                <TextInput T={T} value={regData.nombre} onChange={updReg('nombre')} required autoComplete="given-name" />
              </Field>
              <Field T={T} label="Apellidos *">
                <TextInput T={T} value={regData.apellidos} onChange={updReg('apellidos')} required autoComplete="family-name" />
              </Field>
            </div>
            <Field T={T} label="Email *">
              <TextInput T={T} type="email" inputMode="email" autoCapitalize="none" value={regData.email} onChange={updReg('email')} required autoComplete="email" />
            </Field>
            <Field T={T} label="Contraseña * (mínimo 8 caracteres)">
              <div className="relative">
                <TextInput T={T} type={showPwd ? 'text' : 'password'} value={regData.password} onChange={updReg('password')} required autoComplete="new-password" />
                <button type="button" onClick={() => setShowPwd(!showPwd)} className={`absolute right-3 top-1/2 -translate-y-1/2 ${T.muted}`} aria-label="Mostrar contraseña">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field T={T} label="Teléfono">
                <TextInput T={T} type="tel" inputMode="tel" value={regData.telefono} onChange={updReg('telefono')} autoComplete="tel" />
              </Field>
              <Field T={T} label="Sexo">
                <SelectInput T={T} options={SEXOS} value={regData.sexo} onChange={updReg('sexo')} />
              </Field>
            </div>
            <Field T={T} label="Fecha de nacimiento">
              <DateField
                T={T}
                title="Fecha de nacimiento"
                value={regData.fecha_nacimiento}
                onChange={(v) => setRegData((p) => ({ ...p, fecha_nacimiento: v }))}
              />
            </Field>
            <Field T={T} label="Ciudad de residencia">
              <TextInput T={T} value={regData.ciudad_residencia} onChange={updReg('ciudad_residencia')} />
            </Field>
            <p className={`text-[11px] leading-relaxed ${T.muted}`}>
              Los datos médicos y el contacto de emergencia se completan después,
              en la pestaña Datos. Hacen falta para poder inscribirte a la carrera.
            </p>
            <PrimaryButton type="submit" disabled={loading}>
              {loading ? 'Creando…' : 'Crear cuenta'}
            </PrimaryButton>
            <button type="button" onClick={() => { setView('login'); setMsg(null); }} className={`block mx-auto text-xs underline ${T.muted}`}>
              Ya tengo cuenta
            </button>
          </form>
        ))}
      </Screen>
    );
  }

  if (view === 'verificar') {
    return (
      <Screen title="Verificar email">
        {authCard('Verifica tu email', `Enviamos un código a ${pendingEmail}`, (
          <form onSubmit={doVerify} className="space-y-3">
            <Field T={T} label="Código de verificación">
              <TextInput T={T} inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} required />
            </Field>
            <PrimaryButton type="submit" disabled={loading}>
              {loading ? 'Verificando…' : 'Verificar'}
            </PrimaryButton>
            <button type="button" onClick={() => setView('login')} className={`block mx-auto text-xs underline ${T.muted}`}>
              Volver
            </button>
          </form>
        ))}
      </Screen>
    );
  }

  if (view === 'restablecer') {
    return (
      <Screen title="Restablecer contraseña">
        {authCard('Restablecer contraseña', `Enviamos un código a ${pendingEmail}`, (
          <form onSubmit={doReset} className="space-y-3">
            <Field T={T} label="Código recibido">
              <TextInput T={T} inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} required />
            </Field>
            <Field T={T} label="Nueva contraseña">
              <TextInput T={T} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
            </Field>
            <PrimaryButton type="submit" disabled={loading}>
              {loading ? 'Guardando…' : 'Guardar contraseña'}
            </PrimaryButton>
            <button type="button" onClick={() => setView('login')} className={`block mx-auto text-xs underline ${T.muted}`}>
              Volver
            </button>
          </form>
        ))}
      </Screen>
    );
  }

  /* ---------------- panel del atleta ---------------- */

  return (
    <Screen title="Perfil del corredor">
      <div className="px-4 py-4 space-y-4">
        {/* Cabecera */}
        <div className={`rounded-2xl px-4 py-4 flex items-center gap-4 ${T.card}`}>
          {/* Tocar la foto abre la cámara o la galería del teléfono */}
          <label className="relative shrink-0 cursor-pointer">
            {athlete?.photo_url ? (
              <img
                src={`${API}${athlete.photo_url}`}
                alt={athlete.nombre}
                className="w-16 h-16 rounded-full object-cover border-2 border-[#E77622]"
              />
            ) : (
              <span className={`w-16 h-16 rounded-full flex items-center justify-center text-lg font-extrabold ${T.avatar}`}>
                {initialsOf(athlete?.nombre, athlete?.apellidos)}
              </span>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-[#E77622] flex items-center justify-center border-2 border-[#0C0C0C]">
              {uploadingPhoto
                ? <Loader2 className="w-3 h-3 text-white animate-spin" />
                : <Camera className="w-3 h-3 text-white" />}
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={uploadPhoto}
              disabled={uploadingPhoto}
              className="hidden"
            />
          </label>
          <div className="min-w-0 flex-1">
            <p className="font-bold truncate">{athlete?.nombre} {athlete?.apellidos}</p>
            <p className={`text-xs truncate ${T.muted}`}>{athlete?.email}</p>
            {athlete?.nacionalidad && (
              <p className={`text-xs mt-0.5 ${T.muted}`}>{flagOf(athlete.nacionalidad)} {athlete.nacionalidad}</p>
            )}
          </div>
        </div>

        <Msg T={T} msg={msg} />

        {/* Pestañas solo con icono: con texto no caben las cinco en un teléfono
            estrecho y alguna quedaba fuera de la pantalla. Repartidas a partes
            iguales entran siempre. El nombre de la sección lo dice el título de
            la tarjeta que se abre debajo. */}
        <div className="flex gap-1.5">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              aria-current={tab === key}
              aria-label={label}
              title={label}
              className={`flex-1 flex items-center justify-center py-2.5 rounded-xl ${
                tab === key ? T.chipOn : T.chip
              }`}
            >
              <Icon className="w-[18px] h-[18px]" />
            </button>
          ))}
        </div>

        {tab === 'datos' && (
        <div className={`rounded-2xl px-4 py-4 ${T.card}`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <User className="w-4 h-4 text-[#E77622]" /> Datos personales
            </h3>
            {!editMode && (
              <button onClick={startEdit} className="flex items-center gap-1 text-xs font-bold text-[#E77622]">
                <Pencil className="w-3.5 h-3.5" /> Editar
              </button>
            )}
          </div>

          {/* Sin estos datos el bloque de inscripción no aparece; decirlo evita
              que alguien recién registrado no entienda por qué no puede
              inscribirse. */}
          {!editMode && athlete && !athlete.profile_complete && (
            <div className={`rounded-xl px-3 py-3 mb-3 ${T.itraBox}`}>
              <p className={`text-[11px] leading-relaxed ${T.muted}`}>
                Para poder inscribirte a la carrera faltan tu <strong>tipo de sangre</strong>,
                la <strong>talla de camiseta</strong> y el <strong>contacto de emergencia</strong>.
                Toca Editar y complétalos.
              </p>
            </div>
          )}

          {!editMode ? (
            <div>
              <InfoRow T={T} label="Teléfono" value={athlete?.telefono} />
              <InfoRow T={T} label="Fecha de nacimiento" value={athlete?.fecha_nacimiento} />
              <InfoRow T={T} label="Sexo" value={athlete?.sexo} />
              <InfoRow T={T} label="Ciudad" value={athlete?.ciudad_residencia} />
              <InfoRow T={T} label="Tipo de sangre" value={athlete?.tipo_sangre} />
              <InfoRow T={T} label="Condición médica" value={athlete?.condicion_medica === 'Si' ? athlete?.condicion_medica_detalle : 'No'} />
              <InfoRow T={T} label="Alergias" value={athlete?.alergias === 'Si' ? athlete?.alergias_detalle : 'No'} />
              <InfoRow T={T} label="Contacto de emergencia" value={athlete?.contacto_emergencia_nombre} />
              <InfoRow T={T} label="Teléfono de emergencia" value={athlete?.contacto_emergencia_telefono} />
              <InfoRow T={T} label="Talla de camiseta" value={athlete?.talla_camiseta} />
              <InfoRow T={T} label="Nombre en camiseta" value={athlete?.personalizacion_camiseta} />
            </div>
          ) : (
            <div className="space-y-3 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <Field T={T} label="Nombre"><TextInput T={T} value={editData.nombre} onChange={upd('nombre')} /></Field>
                <Field T={T} label="Apellidos"><TextInput T={T} value={editData.apellidos} onChange={upd('apellidos')} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field T={T} label="Teléfono"><TextInput T={T} value={editData.telefono} onChange={upd('telefono')} /></Field>
                <Field T={T} label="Fecha de nacimiento">
                  <DateField T={T} title="Fecha de nacimiento" value={editData.fecha_nacimiento} onChange={(v) => setEditData((p) => ({ ...p, fecha_nacimiento: v }))} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field T={T} label="Sexo"><SelectInput T={T} options={SEXOS} value={editData.sexo} onChange={upd('sexo')} /></Field>
                <Field T={T} label="Tipo de sangre"><SelectInput T={T} options={SANGRES} value={editData.tipo_sangre} onChange={upd('tipo_sangre')} /></Field>
              </div>
              <Field T={T} label="Ciudad de residencia"><TextInput T={T} value={editData.ciudad_residencia} onChange={upd('ciudad_residencia')} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field T={T} label="¿Condición médica?"><SelectInput T={T} options={['No', 'Si']} value={editData.condicion_medica} onChange={upd('condicion_medica')} /></Field>
                <Field T={T} label="¿Alergias?"><SelectInput T={T} options={['No', 'Si']} value={editData.alergias} onChange={upd('alergias')} /></Field>
              </div>
              {editData.condicion_medica === 'Si' && (
                <Field T={T} label="Detalle de condición médica"><TextInput T={T} value={editData.condicion_medica_detalle} onChange={upd('condicion_medica_detalle')} /></Field>
              )}
              {editData.alergias === 'Si' && (
                <Field T={T} label="Detalle de alergias"><TextInput T={T} value={editData.alergias_detalle} onChange={upd('alergias_detalle')} /></Field>
              )}
              <Field T={T} label="Contacto de emergencia"><TextInput T={T} value={editData.contacto_emergencia_nombre} onChange={upd('contacto_emergencia_nombre')} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field T={T} label="Relación"><TextInput T={T} value={editData.contacto_emergencia_relacion} onChange={upd('contacto_emergencia_relacion')} /></Field>
                <Field T={T} label="Teléfono"><TextInput T={T} value={editData.contacto_emergencia_telefono} onChange={upd('contacto_emergencia_telefono')} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field T={T} label="Talla de camiseta"><SelectInput T={T} options={TALLAS} value={editData.talla_camiseta} onChange={upd('talla_camiseta')} /></Field>
                <Field T={T} label="Nombre en camiseta"><TextInput T={T} maxLength={15} value={editData.personalizacion_camiseta} onChange={upd('personalizacion_camiseta')} /></Field>
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setEditMode(false)} className={`flex-1 rounded-xl py-3 text-sm font-bold border ${T.divider}`}>
                  Cancelar
                </button>
                <button onClick={saveEdit} disabled={loading} className="flex-1 bg-[#E77622] text-white font-bold rounded-xl py-3 text-sm disabled:opacity-50">
                  {loading ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </div>
          )}
        </div>

        )}

        {tab === 'datos' && (
          <div className={`rounded-2xl px-4 py-4 ${T.card}`}>
            <div className="flex items-center gap-3.5">
              {perfilPublico
                ? <Eye className="w-5 h-5 text-[#E77622] shrink-0" />
                : <EyeOff className="w-5 h-5 text-[#E77622] shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold">Perfil público</p>
                <p className={`text-[11px] mt-0.5 leading-relaxed ${T.muted}`}>
                  {perfilPublico
                    ? 'Apareces en la lista de corredores y cualquiera puede ver tu ficha.'
                    : 'No apareces en la lista de corredores ni en el seguimiento público.'}
                </p>
              </div>
              <Toggle on={perfilPublico} disabled={savingPrivacidad} onChange={togglePerfilPublico} />
            </div>

            {bio.disponible && (
              <div className={`flex items-center gap-3.5 pt-4 mt-4 border-t ${T.divider}`}>
                <ScanFace className="w-5 h-5 text-[#E77622] shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold">Entrar con {bio.nombre}</p>
                  <p className={`text-[11px] mt-0.5 leading-relaxed ${T.muted}`}>
                    Sin escribir la contraseña. Tu sesión queda guardada en el
                    llavero del teléfono, no en la app.
                  </p>
                </div>
                <Toggle on={bio.activada} disabled={bioBusy} onChange={toggleBiometria} />
              </div>
            )}
          </div>
        )}

        {tab === 'carreras' && (<>
        {/* Inscripción a la carrera activa */}
        {config && config.show_preregistration !== false && athlete?.profile_complete &&
          !myRaces.some((r) => r.is_active) && (
          <div className={`rounded-2xl px-4 py-4 ${T.card}`}>
            <h3 className="text-sm font-bold flex items-center gap-2 mb-1">
              <Heart className="w-4 h-4 text-[#E77622]" /> {config.name || 'Próxima edición'}
            </h3>
            {!showInscription ? (
              <>
                <p className={`text-xs mb-3 ${T.muted}`}>
                  Inscríbete a la próxima edición desde la app. Completar el formulario
                  garantiza tu espacio en la carrera.
                </p>
                <PrimaryButton onClick={() => { setShowInscription(true); setMsg(null); }}>
                  Inscribirme
                </PrimaryButton>
              </>
            ) : (
              <div className="space-y-3 mt-2">
                <div className={`rounded-xl px-3 py-3 ${T.itraBox}`}>
                  <p className={`text-xs leading-relaxed ${T.muted}`}>
                    El costo de la carrera será de{' '}
                    <strong className="text-[#E77622]">
                      RD${(config.registration_cost || 4000).toLocaleString('es-DO')}
                    </strong>. Cuatro meses antes del evento te enviaremos por correo las
                    instrucciones de pago, con 30 días de plazo; si no se completa, el
                    pre-registro se desestima y el cupo puede reasignarse. Revisa también
                    tu carpeta de spam.
                  </p>
                </div>
                <Field T={T} label="¿Qué te motiva a participar en este evento? *">
                  <textarea
                    value={inscriptionData.motivacion}
                    onChange={(e) => setInscriptionData((p) => ({ ...p, motivacion: e.target.value }))}
                    maxLength={1000}
                    placeholder="Cuéntanos tu motivación…"
                    className={`w-full min-h-[90px] rounded-xl px-3 py-2.5 text-sm outline-none ${T.input}`}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field T={T} label="Años de experiencia">
                    <TextInput T={T} type="number" min="0" inputMode="numeric" placeholder="Ej: 5" value={inscriptionData.anos_experiencia} onChange={(e) => setInscriptionData((p) => ({ ...p, anos_experiencia: e.target.value }))} />
                  </Field>
                  <Field T={T} label="Máxima distancia (km)">
                    <TextInput T={T} type="number" min="0" step="0.1" inputMode="decimal" placeholder="Ej: 42.2" value={inscriptionData.maxima_distancia_km} onChange={(e) => setInscriptionData((p) => ({ ...p, maxima_distancia_km: e.target.value }))} />
                  </Field>
                </div>
                <Field T={T} label="¿Cuántas vueltas aspiras completar?">
                  <SelectInput T={T} options={VUELTAS_OPCIONES} value={inscriptionData.vueltas_aspiradas} onChange={(e) => setInscriptionData((p) => ({ ...p, vueltas_aspiradas: e.target.value }))} />
                </Field>
                <div className="grid grid-cols-2 gap-3 items-end">
                  <Field T={T} label="¿Tienes carpa o toldo?">
                    <SelectInput T={T} options={['Si', 'No', 'Tal vez']} value={inscriptionData.tiene_carpa} onChange={(e) => setInscriptionData((p) => ({ ...p, tiene_carpa: e.target.value }))} />
                  </Field>
                  <Field T={T} label="Acompañantes">
                    <TextInput T={T} type="number" min="0" max="20" inputMode="numeric" placeholder="0" value={inscriptionData.acompanantes} onChange={(e) => setInscriptionData((p) => ({ ...p, acompanantes: e.target.value }))} />
                  </Field>
                </div>
                <Field T={T} label="¿Te gustaría dormir en el lugar?">
                  <Picker
                    title="¿Te gustaría dormir en el lugar?"
                    value={inscriptionData.hospedaje}
                    onSelect={(v) => setInscriptionData((p) => ({ ...p, hospedaje: v }))}
                    options={[
                      { value: 'Si quiero acampar', label: 'Sí, quiero acampar' },
                      { value: 'Si quisiera hospedarme en el hotel', label: 'Sí, quisiera hospedarme en el hotel' },
                      { value: 'No lo he decidido aun', label: 'No lo he decidido aún' },
                    ]}
                  />
                </Field>
                <div className="flex gap-3 pt-1">
                  <button onClick={() => setShowInscription(false)} className={`flex-1 rounded-xl py-3 text-sm font-bold border ${T.divider}`}>
                    Cancelar
                  </button>
                  <button onClick={inscribeRace} disabled={inscribing} className="flex-1 bg-[#E77622] text-white font-bold rounded-xl py-3 text-sm disabled:opacity-50">
                    {inscribing ? 'Enviando…' : 'Confirmar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Mis carreras */}
        <div className={`rounded-2xl px-4 py-4 ${T.card}`}>
          <h3 className="text-sm font-bold flex items-center gap-2 mb-2">
            <Medal className="w-4 h-4 text-[#E77622]" /> Mis carreras
          </h3>
          {myRaces.length === 0 ? (
            <p className={`text-xs py-3 ${T.muted}`}>No tienes inscripciones activas.</p>
          ) : (
            myRaces.map((race) => {
              const enEspera = race.status === 'waitlist';
              const receiptPending = race.payment_receipt_status === 'pending';
              // Desde la lista de espera no se paga: aún no hay cupo, y cobrar
              // antes obliga a devolver el dinero. Y con un comprobante ya
              // enviado, otro solo duplica el trabajo de revisión.
              const puedeSubirComprobante = race.edit_token && !enEspera &&
                race.payment_status !== 'paid' && !receiptPending &&
                !race.payment_receipt_status;
              // Una vez hay comprobante o pago no se puede soltar el lugar:
              // habría que devolver dinero y eso lo lleva la organización.
              const puedeCancelar = !race.payment_receipt_status &&
                race.payment_status !== 'paid' &&
                ['registered', 'waitlist'].includes(race.status);
              const badge = enEspera
                ? { cls: 'bg-orange-500/15 text-[#E77622]', label: 'Lista de espera' }
                : race.payment_status === 'paid'
                  ? { cls: 'bg-green-500/15 text-green-500', label: 'Pagado' }
                  : receiptPending
                    ? { cls: 'bg-sky-500/15 text-sky-500', label: 'Comprobante en revisión' }
                    : { cls: 'bg-yellow-500/15 text-yellow-600', label: 'Pendiente de pago' };
              return (
                <div key={race.registration_id} className={`py-3 border-b last:border-b-0 ${T.divider}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold truncate">{race.race_name || race.race_code}</p>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </div>
                  {race.bib && !enEspera && <p className={`text-xs mt-1 ${T.muted}`}>BIB #{race.bib}</p>}
                  {enEspera && (
                    <p className={`text-xs mt-1.5 leading-relaxed ${T.muted}`}>
                      La carrera alcanzó su cupo. Estás en lista de espera: si se libera un
                      lugar te avisaremos por correo y podrás completar el pago.
                    </p>
                  )}
                  {receiptPending && (
                    <p className={`text-xs mt-1.5 ${T.muted}`}>
                      Tu comprobante está siendo revisado por el equipo.
                    </p>
                  )}

                  {receiptRace !== race.registration_id && (puedeSubirComprobante || puedeCancelar) && (
                    <div className="flex flex-wrap items-center gap-2 mt-2.5">
                      {puedeSubirComprobante && (
                        <button
                          onClick={() => openReceiptForm(race)}
                          className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg ${T.actionChip}`}
                        >
                          <Upload className="w-3.5 h-3.5 text-[#E77622]" /> Subir comprobante de pago
                        </button>
                      )}
                      {puedeCancelar && (
                        <button
                          onClick={() => cancelarCarrera(race)}
                          disabled={cancelando === race.registration_id}
                          className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg text-red-500 disabled:opacity-50"
                        >
                          {cancelando === race.registration_id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <XCircle className="w-3.5 h-3.5" />}
                          Cancelar inscripción
                        </button>
                      )}
                    </div>
                  )}

                  {receiptRace === race.registration_id && (
                    <div className="space-y-3 mt-3">
                      {receiptInfo && (receiptInfo.payment_bank_name || receiptInfo.payment_account_number) && (
                        <div className={`rounded-xl px-3 py-3 ${T.itraBox}`}>
                          <p className={`text-xs leading-relaxed ${T.muted}`}>
                            Transfiere a: <strong>{receiptInfo.payment_bank_name}</strong>
                            {receiptInfo.payment_account_type && <> · {receiptInfo.payment_account_type}</>}
                            {receiptInfo.payment_account_number && <> · Cuenta {receiptInfo.payment_account_number}</>}
                            {receiptInfo.payment_account_name && <> · A nombre de {receiptInfo.payment_account_name}</>}
                            {receiptInfo.registration_cost && (
                              <> · Monto RD${Number(receiptInfo.registration_cost).toLocaleString('es-DO')}</>
                            )}
                          </p>
                        </div>
                      )}
                      <Field T={T} label="Comprobante (JPG, PNG, WebP o PDF) *">
                        <label className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm cursor-pointer ${T.input}`}>
                          <Paperclip className="w-4 h-4 text-[#E77622] shrink-0" />
                          <span className={`truncate ${receiptFile ? '' : 'opacity-50'}`}>
                            {receiptFile ? receiptFile.name : 'Seleccionar archivo o foto'}
                          </span>
                          <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={pickReceiptFile} className="hidden" />
                        </label>
                      </Field>
                      <Field T={T} label="Fecha del pago *">
                        <DateField
                          T={T}
                          title="Fecha del pago"
                          value={receiptData.payment_date}
                          onChange={(v) => setReceiptData((p) => ({ ...p, payment_date: v }))}
                          fromYear={new Date().getFullYear()}
                          toYear={new Date().getFullYear() - 1}
                        />
                      </Field>
                      <div className="grid grid-cols-2 gap-3 items-end">
                        <Field T={T} label="Banco de origen *">
                          <TextInput T={T} value={receiptData.bank_origin} onChange={(e) => setReceiptData((p) => ({ ...p, bank_origin: e.target.value }))} placeholder="Ej: Banreservas" />
                        </Field>
                        <Field T={T} label="Nº de transferencia">
                          <TextInput T={T} value={receiptData.transfer_number} onChange={(e) => setReceiptData((p) => ({ ...p, transfer_number: e.target.value }))} placeholder="Opcional" />
                        </Field>
                      </div>
                      <div className="flex gap-3">
                        <button onClick={() => setReceiptRace(null)} className={`flex-1 rounded-xl py-3 text-sm font-bold border ${T.divider}`}>
                          Cancelar
                        </button>
                        <button onClick={() => submitReceipt(race)} disabled={submittingReceipt} className="flex-1 bg-[#E77622] text-white font-bold rounded-xl py-3 text-sm disabled:opacity-50">
                          {submittingReceipt ? 'Enviando…' : 'Enviar'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        </>)}

        {tab === 'capacitaciones' && (
          <div className={`rounded-2xl px-4 py-4 ${T.card}`}>
            <h3 className="text-sm font-bold flex items-center gap-2 mb-2">
              <GraduationCap className="w-4 h-4 text-[#E77622]" /> Capacitaciones
            </h3>
            {caps.length === 0 && (
              <p className={`text-xs py-3 ${T.muted}`}>
                No hay capacitaciones publicadas por ahora.
              </p>
            )}
            {caps.map((cap) => {
              const abierta = capAbierta === cap.id;
              const programa = abierta ? parsePrograma(cap.program) : [];
              return (
                <div key={cap.id} className={`border-b last:border-b-0 ${T.divider}`}>
                  {/* Cabecera: lo justo para decidir si interesa abrirla */}
                  <button
                    onClick={() => setCapAbierta(abierta ? null : cap.id)}
                    aria-expanded={abierta}
                    className="w-full flex items-start gap-2.5 py-3 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold truncate">{cap.name}</p>
                        {cap.my_registered && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 bg-green-500/15 text-green-500">
                            Inscrito
                          </span>
                        )}
                      </div>
                      <div className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[11px] ${T.muted}`}>
                        {cap.datetime && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 shrink-0" /> {formatCapDate(cap.datetime)}
                          </span>
                        )}
                        {cap.duration && <span>· {formatDuracion(cap.duration)}</span>}
                        <span className={cap.is_free ? 'text-green-500 font-semibold' : ''}>
                          · {cap.is_free ? 'Gratis' : `RD$${Number(cap.cost || 0).toLocaleString('es-DO')}`}
                        </span>
                      </div>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 mt-0.5 shrink-0 transition-transform ${abierta ? 'rotate-180' : ''} ${T.muted}`}
                    />
                  </button>

                  {abierta && (
                    <div className="pb-3.5">
                      {programa.length > 0 && (
                        <div className="space-y-2">
                          {programa.map((item, i) => {
                            if (item.tipo === 'modulo') {
                              return (
                                <p key={i} className="text-[11px] font-bold uppercase tracking-wide text-[#E77622] pt-1.5">
                                  {item.texto}
                                </p>
                              );
                            }
                            if (item.tipo === 'pausa') {
                              return (
                                <p key={i} className={`flex items-center gap-1.5 text-[11px] italic ${T.subtle}`}>
                                  <Coffee className="w-3.5 h-3.5 shrink-0" /> {item.texto}
                                </p>
                              );
                            }
                            if (item.tipo === 'punto') {
                              return (
                                <div key={i} className="flex gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#E77622] shrink-0 mt-[6px]" />
                                  <p className={`text-[12px] leading-relaxed flex-1 ${T.muted}`}>{item.texto}</p>
                                </div>
                              );
                            }
                            return (
                              <p key={i} className={`text-[12px] leading-relaxed ${T.muted}`}>{item.texto}</p>
                            );
                          })}
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-3 mt-3.5">
                        <span className={`flex items-center gap-1.5 text-[11px] ${T.subtle}`}>
                          <UsersIcon className="w-3.5 h-3.5" /> {cap.registered_count} inscritos
                        </span>
                        <button
                          onClick={() => toggleCap(cap)}
                          disabled={capBusy === cap.id}
                          className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg disabled:opacity-50 ${
                            cap.my_registered ? 'text-red-500' : T.actionChip
                          }`}
                        >
                          {capBusy === cap.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : cap.my_registered
                              ? <XCircle className="w-3.5 h-3.5" />
                              : <Check className="w-3.5 h-3.5 text-[#E77622]" />}
                          {cap.my_registered ? 'Cancelar inscripción' : 'Inscribirme'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {tab === 'experiencia' && (
          <div className={`rounded-2xl px-4 py-4 ${T.card}`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Mountain className="w-4 h-4 text-[#E77622]" /> Experiencia ITRA
              </h3>
              {!itraEdit && (
                <button onClick={startItra} className="flex items-center gap-1 text-xs font-bold text-[#E77622]">
                  <Pencil className="w-3.5 h-3.5" /> Editar
                </button>
              )}
            </div>

            {!itraEdit ? (
              <div>
                <p className={`text-[11px] leading-relaxed mb-2 ${T.muted}`}>
                  Se leen de tu ficha pública de itra.run cuando pulsas actualizar.
                </p>
                {athlete?.itra_url ? (
                  <div className="flex flex-wrap gap-2 mb-2">
                    <button
                      onClick={() => cargarDesdeItra()}
                      disabled={cargandoItra}
                      className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-[#E77622] text-white disabled:opacity-50"
                    >
                      {cargandoItra
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <RefreshCw className="w-3.5 h-3.5" />}
                      {cargandoItra ? 'Cargando…' : 'Actualizar desde ITRA'}
                    </button>
                    <button
                      onClick={() => openExternal(athlete.itra_url)}
                      className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg ${T.actionChip}`}
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-[#E77622]" /> Ver en ITRA
                    </button>
                  </div>
                ) : (
                  <p className={`text-xs py-2 ${T.muted}`}>Aún no has añadido tu perfil de ITRA.</p>
                )}
                <InfoRow T={T} label="Índice de rendimiento" value={itraSnap.performance_index} />
                <InfoRow T={T} label="Nivel" value={itraSnap.level} />
                <InfoRow T={T} label="Categoría de edad" value={itraSnap.age_category} />
                <InfoRow T={T} label="Carreras finalizadas" value={itraSnap.finished_races} />
                <InfoRow T={T} label="Distancia total" value={itraSnap.total_distance_km ? `${itraSnap.total_distance_km} km` : null} />
                <InfoRow T={T} label="Desnivel total" value={itraSnap.total_elevation_m ? `${itraSnap.total_elevation_m} m` : null} />
                <InfoRow T={T} label="Tiempo total en carrera" value={itraSnap.total_race_time} />

                {(itraSnap.results || []).length > 0 && (
                  <div className="mt-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-[#E77622] mb-1.5">
                      Resultados
                    </p>
                    {itraSnap.results.map((r, i) => (
                      <div key={i} className={`py-2 border-b last:border-b-0 ${T.divider}`}>
                        <p className="text-xs font-bold">{r.race}</p>
                        <div className={`flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-[11px] ${T.muted}`}>
                          {r.date && <span>{r.date}</span>}
                          {r.distance_km != null && <span>{r.distance_km} km</span>}
                          {r.time && <span>{r.time}</span>}
                          {r.position && <span>Puesto {r.position}</span>}
                        </div>
                      </div>
                    ))}
                    <p className={`text-[11px] mt-2 ${T.subtle}`}>
                      Vienen de tu ficha de ITRA. Vuelve a cargarlos cuando corras algo nuevo.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3 mt-2">
                <Field T={T} label="Enlace a tu perfil de ITRA">
                  <TextInput
                    T={T}
                    type="url"
                    inputMode="url"
                    autoCapitalize="none"
                    placeholder="https://itra.run/RunnerSpace/..."
                    value={itraData.itra_url}
                    onChange={(e) => setItraData((p) => ({ ...p, itra_url: e.target.value }))}
                  />
                </Field>
                <button
                  onClick={() => cargarDesdeItra(itraData.itra_url)}
                  disabled={cargandoItra || !(itraData.itra_url || '').trim()}
                  className="w-full flex items-center justify-center gap-2 bg-[#E77622] text-white font-bold rounded-xl py-3 text-sm disabled:opacity-50"
                >
                  {cargandoItra
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <RefreshCw className="w-4 h-4" />}
                  {cargandoItra ? 'Cargando desde ITRA…' : 'Cargar datos de ITRA'}
                </button>
                <p className={`text-[11px] leading-relaxed ${T.muted}`}>
                  Se leen solos de tu ficha pública de itra.run. Si ITRA no responde,
                  puedes escribirlos abajo a mano.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Field T={T} label="Índice de rendimiento">
                    <TextInput T={T} type="number" inputMode="numeric" placeholder="Ej: 520"
                      value={itraData.performance_index}
                      onChange={(e) => setItraData((p) => ({ ...p, performance_index: e.target.value }))} />
                  </Field>
                  <Field T={T} label="Nivel">
                    <TextInput T={T} placeholder="Ej: Intermediate 3" value={itraData.level}
                      onChange={(e) => setItraData((p) => ({ ...p, level: e.target.value }))} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field T={T} label="Categoría de edad">
                    <TextInput T={T} placeholder="Ej: M 45-49" value={itraData.age_category}
                      onChange={(e) => setItraData((p) => ({ ...p, age_category: e.target.value }))} />
                  </Field>
                  <Field T={T} label="Carreras finalizadas">
                    <TextInput T={T} type="number" inputMode="numeric" placeholder="Ej: 24"
                      value={itraData.finished_races}
                      onChange={(e) => setItraData((p) => ({ ...p, finished_races: e.target.value }))} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field T={T} label="Distancia total (km)">
                    <TextInput T={T} type="number" step="0.1" inputMode="decimal" placeholder="Ej: 1840"
                      value={itraData.total_distance_km}
                      onChange={(e) => setItraData((p) => ({ ...p, total_distance_km: e.target.value }))} />
                  </Field>
                  <Field T={T} label="Desnivel total (m)">
                    <TextInput T={T} type="number" step="1" inputMode="numeric" placeholder="Ej: 42000"
                      value={itraData.total_elevation_m}
                      onChange={(e) => setItraData((p) => ({ ...p, total_elevation_m: e.target.value }))} />
                  </Field>
                </div>
                <Field T={T} label="Tiempo total en carrera">
                  <TextInput T={T} placeholder="Ej: 187:39:05" value={itraData.total_race_time}
                    onChange={(e) => setItraData((p) => ({ ...p, total_race_time: e.target.value }))} />
                </Field>
                <div className="flex gap-3 pt-1">
                  <button onClick={() => setItraEdit(false)} className={`flex-1 rounded-xl py-3 text-sm font-bold border ${T.divider}`}>
                    Cancelar
                  </button>
                  <button onClick={saveItra} disabled={savingItra} className="flex-1 bg-[#E77622] text-white font-bold rounded-xl py-3 text-sm disabled:opacity-50">
                    {savingItra ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'historial' && (
        <div className={`rounded-2xl px-4 py-4 ${T.card}`}>
          <h3 className="text-sm font-bold flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-[#E77622]" /> Historial de carreras
          </h3>
          {history.length === 0 ? (
            <p className={`text-xs py-3 ${T.muted}`}>Aún no tienes historial de carreras.</p>
          ) : (
            history.map((race) => (
              <div key={race.registration_id} className={`py-3 border-b last:border-b-0 ${T.divider}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold truncate">{race.race_name || race.race_code}</p>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${T.chipOn}`}>
                    {statusLabel(race.status)}
                  </span>
                </div>
                <div className={`flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs ${T.muted}`}>
                  <span>{race.laps_completed} vueltas</span>
                  <span>{race.total_km || (race.laps_completed * 6.7).toFixed(1)} km</span>
                  {race.overall_position && <span>General {race.overall_position}/{race.overall_total}</span>}
                  {race.gender_position && <span>Sexo {race.gender_position}/{race.gender_total}</span>}
                </div>
                {race.certificate_available && race.bib && (
                  <div className="flex gap-2 mt-2.5">
                    <button
                      onClick={() => openExternal(`${API}/api/race/certificate/${race.bib}`)}
                      className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg ${T.actionChip}`}
                    >
                      <FileText className="w-3.5 h-3.5" /> Certificado
                    </button>
                    <button
                      onClick={() => openExternal(`${API}/api/race/certificate/${race.bib}/image`)}
                      className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg ${T.actionChip}`}
                    >
                      <ImageIcon className="w-3.5 h-3.5" /> Imagen
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        )}

        {/* La contraseña es cosa de la cuenta: va con los datos personales */}
        {tab === 'datos' && (
        <div className={`rounded-2xl px-4 py-4 ${T.card}`}>
          <button onClick={() => setShowPwdForm(!showPwdForm)} className="w-full flex items-center justify-between">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#E77622]" /> Cambiar contraseña
            </h3>
            <ChevronDown className={`w-4 h-4 transition-transform ${showPwdForm ? 'rotate-180' : ''} ${T.muted}`} />
          </button>
          {showPwdForm && (
            <div className="space-y-3 mt-3">
              <Field T={T} label="Contraseña actual">
                <TextInput T={T} type="password" value={pwdData.current_password} onChange={(e) => setPwdData((p) => ({ ...p, current_password: e.target.value }))} />
              </Field>
              <Field T={T} label="Nueva contraseña">
                <TextInput T={T} type="password" value={pwdData.new_password} onChange={(e) => setPwdData((p) => ({ ...p, new_password: e.target.value }))} />
              </Field>
              <Field T={T} label="Confirmar nueva contraseña">
                <TextInput T={T} type="password" value={pwdData.confirm_password} onChange={(e) => setPwdData((p) => ({ ...p, confirm_password: e.target.value }))} />
              </Field>
              <PrimaryButton onClick={changePassword} disabled={loading}>
                {loading ? 'Guardando…' : 'Actualizar contraseña'}
              </PrimaryButton>
            </div>
          )}
        </div>

        )}

        {/* Cerrar sesión: fuera de las pestañas, para no tener que buscarlo */}
        <button onClick={logout} className={`w-full flex items-center justify-center gap-2 py-3 text-sm font-bold ${T.muted}`}>
          <LogOut className="w-4 h-4" /> Cerrar sesión
        </button>
      </div>
    </Screen>
  );
}
