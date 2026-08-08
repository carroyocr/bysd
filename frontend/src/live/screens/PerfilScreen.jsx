import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Eye, EyeOff, LogOut, Pencil, KeyRound, Trophy, FileText, Image as ImageIcon,
  ChevronDown, Medal, Heart, Upload, Paperclip, Camera, Loader2,
} from 'lucide-react';
import { API, authJson, flagOf, initialsOf, statusLabel } from '../liveApi';
import { useLiveTheme } from '../liveTheme';
import { Screen } from '../LiveApp';
import { openExternal } from '../../lib/nativeExport';
import { useRaceConfig } from '../../contexts/RaceConfigContext';
import Picker, { PickerSheet, Wheel } from '../components/Picker';

const TOKEN_KEY = 'athlete_token';

const SEXOS = ['Masculino', 'Femenino'];
const SANGRES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const TALLAS = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const VUELTAS_OPCIONES = [
  'Al menos 1', 'De 2 a 5', 'De 6 a 10', 'De 11 a 15', 'De 16 a 20',
  'De 21 a 24', 'Hasta que sea el ganador', 'No estoy seguro',
];

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

  const token = () => localStorage.getItem(TOKEN_KEY);

  const fetchAll = async () => {
    const { ok, data } = await authJson('GET', '/api/athletes/profile', { token: token() });
    if (!ok) {
      localStorage.removeItem(TOKEN_KEY);
      setView('login');
      return;
    }
    setAthlete(data);
    setView('panel');
    authJson('GET', '/api/athletes/my-races', { token: token() })
      .then((r) => { if (r.ok) setMyRaces(r.data.races || []); });
    authJson('GET', '/api/athletes/race-history', { token: token() })
      .then((r) => { if (r.ok) setHistory(r.data.history || []); });
  };

  useEffect(() => {
    if (token()) fetchAll();
  }, []);

  const doLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    const { ok, status, data } = await authJson('POST', '/api/athletes/login', { body: { email, password } });
    setLoading(false);
    if (ok) {
      localStorage.setItem(TOKEN_KEY, data.token);
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

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
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
            <div className="flex justify-between pt-1">
              <button type="button" onClick={doForgot} className={`text-xs underline ${T.muted}`}>
                Olvidé mi contraseña
              </button>
              <button type="button" onClick={() => navigate('/mi-perfil')} className="text-xs underline text-[#E77622]">
                Crear cuenta
              </button>
            </div>
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

        {/* Datos personales */}
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
              // Igual que en la web: se puede subir el comprobante mientras el
              // pago no esté confirmado, incluso desde la lista de espera.
              const puedeSubirComprobante = race.edit_token &&
                race.payment_status !== 'paid' && !receiptPending;
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

                  {puedeSubirComprobante && receiptRace !== race.registration_id && (
                    <button
                      onClick={() => openReceiptForm(race)}
                      className={`mt-2.5 flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg ${T.actionChip}`}
                    >
                      <Upload className="w-3.5 h-3.5 text-[#E77622]" /> Subir comprobante de pago
                    </button>
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

        {/* Historial y certificados */}
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

        {/* Contraseña */}
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

        {/* Cerrar sesión */}
        <button onClick={logout} className={`w-full flex items-center justify-center gap-2 py-3 text-sm font-bold ${T.muted}`}>
          <LogOut className="w-4 h-4" /> Cerrar sesión
        </button>
      </div>
    </Screen>
  );
}
