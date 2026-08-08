import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HandHelping, ArrowLeft, Loader2 } from 'lucide-react';
import { authJson } from '../liveApi';
import { useLiveTheme } from '../liveTheme';
import { Screen } from '../LiveApp';

const SEXOS = ['Masculino', 'Femenino', 'Otro'];
const SANGRES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const TALLAS = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const SI_NO = ['No', 'Sí'];

const VACIO = {
  nombre: '', apellidos: '', fecha_nacimiento: '', sexo: '', nacionalidad: 'Dominicana',
  telefono: '', ciudad_residencia: '', experiencia_voluntariado: 'No',
  experiencia_voluntariado_detalle: '', tipo_sangre: '', condicion_medica: 'No',
  condicion_medica_detalle: '', alergias: 'No', alergias_detalle: '',
  contacto_emergencia_nombre: '', contacto_emergencia_relacion: '',
  contacto_emergencia_telefono: '', talla_camiseta: '', comentarios: '', password: '',
};

const OBLIGATORIOS = [
  ['nombre', 'el nombre'],
  ['apellidos', 'los apellidos'],
  ['fecha_nacimiento', 'la fecha de nacimiento'],
  ['sexo', 'el sexo'],
  ['nacionalidad', 'la nacionalidad'],
  ['telefono', 'el teléfono'],
  ['ciudad_residencia', 'la ciudad'],
  ['contacto_emergencia_nombre', 'el contacto de emergencia'],
  ['contacto_emergencia_telefono', 'el teléfono de emergencia'],
];

/**
 * Alta de voluntario desde la app.
 *
 * Hasta ahora solo se podía desde la web. El flujo es el mismo de allí —código
 * al correo, y con esa sesión se envía el formulario—, en una sola pantalla
 * porque en un teléfono un asistente de seis pasos se abandona a la mitad.
 *
 * La contraseña es lo que le deja entrar luego a ver sus turnos; el formulario
 * la exige aquí para no obligarle a un segundo paso con otro código.
 */
export default function VoluntarioRegistroScreen() {
  const { T } = useLiveTheme();
  const navigate = useNavigate();

  const [paso, setPaso] = useState('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sesion, setSesion] = useState(null);
  const [eventos, setEventos] = useState([]);
  const [evento, setEvento] = useState('carrera');
  const [datos, setDatos] = useState(VACIO);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  const upd = (campo) => (e) => setDatos((p) => ({ ...p, [campo]: e.target.value }));

  const pedirCodigo = async () => {
    setCargando(true); setError('');
    const { ok, data } = await authJson('POST', '/api/volunteer-registration/send-verification', {
      body: { email: email.trim().toLowerCase() },
    });
    setCargando(false);
    if (ok) setPaso('codigo');
    else setError(data.detail || 'No se pudo enviar el código');
  };

  const verificar = async () => {
    setCargando(true); setError('');
    const { ok, data } = await authJson('POST', '/api/volunteer-registration/verify-code', {
      body: { email: email.trim().toLowerCase(), code: code.trim() },
    });
    setCargando(false);
    if (!ok) { setError(data.detail || 'Código incorrecto'); return; }
    if (data.registrations?.length && !data.eventos_disponibles?.length) {
      setError('Ya estás registrado como voluntario. Usa "no tengo contraseña" en el acceso de staff.');
      return;
    }
    setSesion(data.session_token);
    setEventos(data.eventos_disponibles || ['carrera']);
    setEvento((data.eventos_disponibles || ['carrera'])[0]);
    setPaso('datos');
  };

  const enviar = async () => {
    const falta = OBLIGATORIOS.find(([campo]) => !String(datos[campo] || '').trim());
    if (falta) { setError(`Falta ${falta[1]}`); return; }
    if (datos.password && datos.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres'); return;
    }
    setCargando(true); setError('');
    const url = `/api/volunteer-registration/register?email=${encodeURIComponent(email.trim().toLowerCase())}&session_token=${encodeURIComponent(sesion)}`;
    const { ok, data } = await authJson('POST', url, { body: { ...datos, evento, slots_interes: [] } });
    setCargando(false);
    if (ok) setPaso('listo');
    else setError(data.detail || 'No se pudo completar el registro');
  };

  const Campo = ({ label, children }) => (
    <label className="block">
      <span className={`block text-[11px] font-bold mb-1 ${T.muted}`}>{label}</span>
      {children}
    </label>
  );
  const clase = `w-full rounded-xl px-3 py-2.5 text-sm outline-none ${T.input}`;

  return (
    <Screen title="Ser voluntario" back>
      <div className="px-4 py-5 space-y-4">
        {paso !== 'listo' && (
          <div className="flex flex-col items-center mb-1">
            <span className="w-14 h-14 rounded-full bg-[#E77622]/15 flex items-center justify-center mb-2">
              <HandHelping className="w-7 h-7 text-[#E77622]" />
            </span>
            <p className={`text-xs text-center leading-relaxed ${T.muted}`}>
              {paso === 'email' && 'Te enviamos un código para confirmar tu correo.'}
              {paso === 'codigo' && `Escribe el código que enviamos a ${email}.`}
              {paso === 'datos' && 'Cuéntanos quién eres. Los datos de salud son para poder atenderte si hace falta.'}
            </p>
          </div>
        )}

        {error && <p className="text-xs text-red-500">{error}</p>}

        {paso === 'email' && (
          <div className="space-y-3">
            <Campo label="Tu correo">
              <input type="email" inputMode="email" autoCapitalize="none" value={email}
                onChange={(e) => setEmail(e.target.value)} className={clase} placeholder="tu@correo.com" />
            </Campo>
            <button onClick={pedirCodigo} disabled={cargando || !email.trim()}
              className="w-full bg-[#E77622] text-white font-bold rounded-xl py-3 text-sm disabled:opacity-50">
              {cargando ? 'Enviando…' : 'Enviarme el código'}
            </button>
          </div>
        )}

        {paso === 'codigo' && (
          <div className="space-y-3">
            <Campo label="Código de 6 dígitos">
              <input inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} className={clase} />
            </Campo>
            <button onClick={verificar} disabled={cargando || !code.trim()}
              className="w-full bg-[#E77622] text-white font-bold rounded-xl py-3 text-sm disabled:opacity-50">
              {cargando ? 'Verificando…' : 'Continuar'}
            </button>
            <button onClick={() => { setPaso('email'); setError(''); }}
              className={`flex items-center justify-center gap-1.5 mx-auto text-xs underline ${T.muted}`}>
              <ArrowLeft className="w-3.5 h-3.5" /> Cambiar el correo
            </button>
          </div>
        )}

        {paso === 'datos' && (
          <div className="space-y-3">
            {eventos.length > 1 && (
              <Campo label="¿En qué evento quieres ayudar?">
                <select value={evento} onChange={(e) => setEvento(e.target.value)} className={clase}>
                  {eventos.map((ev) => (
                    <option key={ev} value={ev}>{ev === 'campeonato' ? 'Campeonato' : 'Carrera'}</option>
                  ))}
                </select>
              </Campo>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Campo label="Nombre *"><input value={datos.nombre} onChange={upd('nombre')} className={clase} /></Campo>
              <Campo label="Apellidos *"><input value={datos.apellidos} onChange={upd('apellidos')} className={clase} /></Campo>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Fecha de nacimiento *">
                <input type="date" value={datos.fecha_nacimiento} onChange={upd('fecha_nacimiento')} className={clase} />
              </Campo>
              <Campo label="Sexo *">
                <select value={datos.sexo} onChange={upd('sexo')} className={clase}>
                  <option value="">Seleccionar</option>
                  {SEXOS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Campo>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Teléfono *"><input type="tel" inputMode="tel" value={datos.telefono} onChange={upd('telefono')} className={clase} /></Campo>
              <Campo label="Nacionalidad *"><input value={datos.nacionalidad} onChange={upd('nacionalidad')} className={clase} /></Campo>
            </div>
            <Campo label="Ciudad de residencia *"><input value={datos.ciudad_residencia} onChange={upd('ciudad_residencia')} className={clase} /></Campo>

            <div className="grid grid-cols-2 gap-3">
              <Campo label="¿Has sido voluntario antes?">
                <select value={datos.experiencia_voluntariado} onChange={upd('experiencia_voluntariado')} className={clase}>
                  {SI_NO.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Campo>
              <Campo label="Talla de camiseta">
                <select value={datos.talla_camiseta} onChange={upd('talla_camiseta')} className={clase}>
                  <option value="">Seleccionar</option>
                  {TALLAS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Campo>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Campo label="Tipo de sangre">
                <select value={datos.tipo_sangre} onChange={upd('tipo_sangre')} className={clase}>
                  <option value="">Seleccionar</option>
                  {SANGRES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Campo>
              <Campo label="¿Condición médica?">
                <select value={datos.condicion_medica} onChange={upd('condicion_medica')} className={clase}>
                  {SI_NO.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Campo>
            </div>
            {datos.condicion_medica === 'Sí' && (
              <Campo label="¿Cuál?"><input value={datos.condicion_medica_detalle} onChange={upd('condicion_medica_detalle')} className={clase} /></Campo>
            )}
            <Campo label="¿Alergias?">
              <select value={datos.alergias} onChange={upd('alergias')} className={clase}>
                {SI_NO.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Campo>
            {datos.alergias === 'Sí' && (
              <Campo label="¿A qué?"><input value={datos.alergias_detalle} onChange={upd('alergias_detalle')} className={clase} /></Campo>
            )}

            <Campo label="Contacto de emergencia *"><input value={datos.contacto_emergencia_nombre} onChange={upd('contacto_emergencia_nombre')} className={clase} /></Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Relación"><input value={datos.contacto_emergencia_relacion} onChange={upd('contacto_emergencia_relacion')} className={clase} /></Campo>
              <Campo label="Su teléfono *"><input type="tel" inputMode="tel" value={datos.contacto_emergencia_telefono} onChange={upd('contacto_emergencia_telefono')} className={clase} /></Campo>
            </div>

            <Campo label="Contraseña para tu perfil (mínimo 8)">
              <input type="password" autoComplete="new-password" value={datos.password} onChange={upd('password')} className={clase} />
            </Campo>
            <p className={`text-[11px] leading-relaxed ${T.muted}`}>
              Con ella entras a ver tus turnos y recibes un aviso 30 minutos antes de cada uno.
            </p>

            <button onClick={enviar} disabled={cargando}
              className="w-full bg-[#E77622] text-white font-bold rounded-xl py-3 text-sm disabled:opacity-50 flex items-center justify-center gap-2">
              {cargando && <Loader2 className="w-4 h-4 animate-spin" />}
              {cargando ? 'Enviando…' : 'Completar registro'}
            </button>
          </div>
        )}

        {paso === 'listo' && (
          <div className="text-center py-8">
            <span className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-4">
              <HandHelping className="w-8 h-8 text-green-500" />
            </span>
            <p className="font-bold">¡Listo, gracias!</p>
            <p className={`text-xs mt-2 leading-relaxed ${T.muted}`}>
              Te enviamos un correo de confirmación. Entra al acceso de staff con
              tu correo y tu contraseña para elegir tus turnos.
            </p>
            <button onClick={() => navigate('/live/staff')}
              className="w-full bg-[#E77622] text-white font-bold rounded-xl py-3 text-sm mt-6">
              Ir al acceso de staff
            </button>
          </div>
        )}
      </div>
    </Screen>
  );
}
