import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, CalendarClock, Loader2, Droplet, HeartPulse, TriangleAlert, Phone, MapPin, Bell,
  Check, ChevronDown, X, IdCard, MailCheck, LogIn, Pencil, Plus, CircleCheck,
} from 'lucide-react';
import { API, authJson } from '../liveApi';
import { guardarArchivo } from '../../lib/nativeExport';
import { useLiveTheme } from '../liveTheme';
import { Screen } from '../LiveApp';
import { registrarStaff } from '../push';
import { cerrarSesion, token } from '../sesion';
import DateField from '../components/DateField';
import Picker from '../components/Picker';
import { COUNTRIES } from '../../data/countries';

// Las mismas tres pestañas que el perfil del voluntario en la web, en el mismo
// orden: primero se ve, luego lo que importa en una emergencia y al final los
// turnos, donde pide, confirma y cancela.
const TABS = [
  { key: 'datos', label: 'Mis datos', icon: User },
  { key: 'salud', label: 'Salud y emergencia', icon: HeartPulse },
  { key: 'turnos', label: 'Turnos', icon: CalendarClock },
];

const SEXOS = ['Masculino', 'Femenino', 'Otro'];
const SANGRES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'No sé'];
const TALLAS = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const SI_NO = ['No', 'Sí'];

const esSi = (valor) => /^s[ií]$/i.test(valor || '');
const soloHora = (hora) => (hora || '').slice(0, 5);

/** "2027-01-23" -> "sábado, 23 de enero". */
function diaDelTurno(dia) {
  if (!dia) return '';
  const d = new Date(`${dia}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dia;
  return d.toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** Guarda solo los campos de una tarjeta y devuelve la ficha como queda. */
async function guardarMisDatos(cambios) {
  const { ok, status, data } = await authJson('PUT', '/api/staff/mi-perfil/datos', {
    token: token(), body: cambios,
  });
  if (ok) return { perfil: data.perfil };
  if (status === 0) return { error: 'No se pudo conectar. Inténtalo de nuevo.' };
  // Los errores de validación llegan como lista; el resto, como texto.
  return { error: typeof data.detail === 'string' ? data.detail : 'Revisa los datos e inténtalo de nuevo.' };
}

// Todo lo de aquí abajo va FUERA de la pantalla a propósito. Un componente
// definido dentro de otro es un tipo distinto en cada render: React desmonta el
// input, este pierde el foco y el teclado del teléfono se cierra tras escribir
// una sola letra.

function Fila({ T, label, value, Icon }) {
  if (!value) return null;
  return (
    <div className={`flex items-start justify-between gap-3 py-2 border-b last:border-b-0 ${T.divider}`}>
      <span className={`text-xs flex items-center gap-1.5 shrink-0 ${T.muted}`}>
        {Icon && <Icon className="w-3.5 h-3.5" />} {label}
      </span>
      <span className="text-xs font-semibold text-right">{value}</span>
    </div>
  );
}

function Campo({ T, label, children }) {
  return (
    <label className="block">
      <span className={`block text-[11px] font-bold mb-1 ${T.muted}`}>{label}</span>
      {children}
    </label>
  );
}

/** El título de la tarjeta y, a la derecha, «Editar». */
function CabeceraTarjeta({ T, Icon, titulo, editando, onEditar }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-2">
      <h3 className="text-sm font-bold flex items-center gap-2">
        <Icon className="w-4 h-4 text-[#E77622]" /> {titulo}
      </h3>
      {!editando && (
        <button
          onClick={onEditar}
          className={`shrink-0 flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg ${T.chip}`}
        >
          <Pencil className="w-3.5 h-3.5" /> Editar
        </button>
      )}
    </div>
  );
}

function BotonesDeEdicion({ T, guardando, onCancelar }) {
  return (
    <div className="flex gap-2 pt-1">
      <button
        type="submit"
        disabled={guardando}
        className="flex-1 bg-[#E77622] text-white font-bold rounded-xl py-2.5 text-sm disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
        Guardar
      </button>
      <button
        type="button"
        disabled={guardando}
        onClick={onCancelar}
        className={`flex-1 font-bold rounded-xl py-2.5 text-sm disabled:opacity-50 ${T.chip}`}
      >
        Cancelar
      </button>
    </div>
  );
}

function TarjetaDatos({ T, p, onGuardado }) {
  const [editando, setEditando] = useState(false);
  const [f, setF] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const clase = `w-full rounded-xl px-3 py-2.5 text-sm outline-none ${T.input}`;

  const editar = () => {
    setF({
      nombre: p.nombre || '',
      apellidos: p.apellidos || '',
      telefono: p.telefono || '',
      fecha_nacimiento: p.fecha_nacimiento || '',
      sexo: p.sexo || '',
      nacionalidad: p.nacionalidad || '',
      ciudad_residencia: p.ciudad_residencia || '',
      talla_camiseta: p.talla_camiseta || '',
    });
    setError('');
    setEditando(true);
  };

  const cambiar = (campo) => (e) => setF((prev) => ({ ...prev, [campo]: e.target.value }));

  const guardar = async (e) => {
    e.preventDefault();
    if (!f.nombre.trim() || !f.apellidos.trim() || !f.telefono.trim()) {
      setError('El nombre, los apellidos y el teléfono no pueden quedar vacíos.');
      return;
    }
    setGuardando(true);
    setError('');
    const { perfil, error: fallo } = await guardarMisDatos(f);
    setGuardando(false);
    if (fallo) { setError(fallo); return; }
    onGuardado(perfil);
    setEditando(false);
  };

  // Hay fichas con la nacionalidad escrita de otra forma (un código, otro
  // nombre): se conserva como opción para no borrarla al guardar.
  const paises = COUNTRIES.map((c) => ({ value: c.name, label: c.name }));
  if (f.nacionalidad && !paises.some((o) => o.value === f.nacionalidad)) {
    paises.unshift({ value: f.nacionalidad, label: f.nacionalidad });
  }

  return (
    <div className={`rounded-2xl px-4 py-4 ${T.card}`}>
      <CabeceraTarjeta T={T} Icon={User} titulo="Mis datos" editando={editando} onEditar={editar} />

      {!editando ? (
        <>
          <Fila T={T} label="Nombre" value={`${p.nombre || ''} ${p.apellidos || ''}`.trim()} />
          <Fila T={T} label="Correo" value={p.email} />
          <Fila T={T} label="Teléfono" value={p.telefono} />
          <Fila T={T} label="Fecha de nacimiento" value={p.fecha_nacimiento} />
          <Fila T={T} label="Sexo" value={p.sexo} />
          <Fila T={T} label="Nacionalidad" value={p.nacionalidad} />
          <Fila T={T} label="Ciudad" value={p.ciudad_residencia} />
          <Fila T={T} label="Talla de camiseta" value={p.talla_camiseta} />
        </>
      ) : (
        <form onSubmit={guardar} className="space-y-3">
          <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
            <Campo T={T} label="Nombre *"><input value={f.nombre} onChange={cambiar('nombre')} maxLength={80} className={clase} /></Campo>
            <Campo T={T} label="Apellidos *"><input value={f.apellidos} onChange={cambiar('apellidos')} maxLength={80} className={clase} /></Campo>
          </div>
          <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
            <Campo T={T} label="Teléfono *">
              <input type="tel" inputMode="tel" value={f.telefono} onChange={cambiar('telefono')} maxLength={40} className={clase} />
            </Campo>
            <Campo T={T} label="Fecha de nacimiento">
              <DateField
                T={T}
                title="Fecha de nacimiento"
                value={f.fecha_nacimiento}
                onChange={(v) => setF((prev) => ({ ...prev, fecha_nacimiento: v }))}
              />
            </Campo>
          </div>
          <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
            <Campo T={T} label="Sexo">
              <select value={f.sexo} onChange={cambiar('sexo')} className={clase}>
                <option value="">Seleccionar</option>
                {SEXOS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Campo>
            <Campo T={T} label="Talla de camiseta">
              <select value={f.talla_camiseta} onChange={cambiar('talla_camiseta')} className={clase}>
                <option value="">Seleccionar</option>
                {TALLAS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Campo>
          </div>
          <Campo T={T} label="Nacionalidad">
            <Picker
              title="Nacionalidad"
              value={f.nacionalidad}
              onSelect={(v) => setF((prev) => ({ ...prev, nacionalidad: v }))}
              options={paises}
            />
          </Campo>
          <Campo T={T} label="Ciudad de residencia">
            <input value={f.ciudad_residencia} onChange={cambiar('ciudad_residencia')} maxLength={80} className={clase} />
          </Campo>
          <p className={`text-[11px] ${T.muted}`}>El correo no se cambia desde aquí: es con el que entras.</p>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <BotonesDeEdicion T={T} guardando={guardando} onCancelar={() => setEditando(false)} />
        </form>
      )}
    </div>
  );
}

function TarjetaSalud({ T, p, onGuardado }) {
  const [editando, setEditando] = useState(false);
  const [f, setF] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const clase = `w-full rounded-xl px-3 py-2.5 text-sm outline-none ${T.input}`;

  const editar = () => {
    setF({
      tipo_sangre: p.tipo_sangre || '',
      condicion_medica: esSi(p.condicion_medica) ? 'Sí' : 'No',
      condicion_medica_detalle: p.condicion_medica_detalle || '',
      alergias: esSi(p.alergias) ? 'Sí' : 'No',
      alergias_detalle: p.alergias_detalle || '',
      contacto_emergencia_nombre: p.contacto_emergencia_nombre || '',
      contacto_emergencia_relacion: p.contacto_emergencia_relacion || '',
      contacto_emergencia_telefono: p.contacto_emergencia_telefono || '',
    });
    setError('');
    setEditando(true);
  };

  const cambiar = (campo) => (e) => setF((prev) => ({ ...prev, [campo]: e.target.value }));

  const guardar = async (e) => {
    e.preventDefault();
    if (!f.contacto_emergencia_nombre.trim() || !f.contacto_emergencia_telefono.trim()) {
      setError('El contacto de emergencia necesita nombre y teléfono.');
      return;
    }
    setGuardando(true);
    setError('');
    const { perfil, error: fallo } = await guardarMisDatos(f);
    setGuardando(false);
    if (fallo) { setError(fallo); return; }
    onGuardado(perfil);
    setEditando(false);
  };

  const sangres = f.tipo_sangre && !SANGRES.includes(f.tipo_sangre)
    ? [f.tipo_sangre, ...SANGRES]
    : SANGRES;

  return (
    <div className={`rounded-2xl px-4 py-4 ${T.card}`}>
      <CabeceraTarjeta T={T} Icon={HeartPulse} titulo="Salud y emergencia" editando={editando} onEditar={editar} />

      {!editando ? (
        <>
          <Fila T={T} label="Tipo de sangre" value={p.tipo_sangre} Icon={Droplet} />
          <Fila
            T={T}
            label="Condición médica"
            value={esSi(p.condicion_medica) ? (p.condicion_medica_detalle || 'Sí') : 'No'}
            Icon={HeartPulse}
          />
          <Fila
            T={T}
            label="Alergias"
            value={esSi(p.alergias) ? (p.alergias_detalle || 'Sí') : 'No'}
            Icon={TriangleAlert}
          />
          <Fila
            T={T}
            label="Contacto de emergencia"
            value={[p.contacto_emergencia_nombre, p.contacto_emergencia_relacion].filter(Boolean).join(' · ')}
          />
          {p.contacto_emergencia_telefono && (
            <a
              href={`tel:${p.contacto_emergencia_telefono}`}
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg mt-2 w-fit ${T.actionChip}`}
            >
              <Phone className="w-3.5 h-3.5 text-[#E77622]" /> {p.contacto_emergencia_telefono}
            </a>
          )}
        </>
      ) : (
        <form onSubmit={guardar} className="space-y-3">
          <Campo T={T} label="Tipo de sangre">
            <select value={f.tipo_sangre} onChange={cambiar('tipo_sangre')} className={clase}>
              <option value="">Seleccionar</option>
              {sangres.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Campo>
          <Campo T={T} label="¿Tienes alguna condición médica?">
            <select value={f.condicion_medica} onChange={cambiar('condicion_medica')} className={clase}>
              {SI_NO.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Campo>
          {f.condicion_medica === 'Sí' && (
            <Campo T={T} label="¿Cuál?">
              <input value={f.condicion_medica_detalle} onChange={cambiar('condicion_medica_detalle')} maxLength={500} className={clase} />
            </Campo>
          )}
          <Campo T={T} label="¿Tienes alergias?">
            <select value={f.alergias} onChange={cambiar('alergias')} className={clase}>
              {SI_NO.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Campo>
          {f.alergias === 'Sí' && (
            <Campo T={T} label="¿A qué?">
              <input value={f.alergias_detalle} onChange={cambiar('alergias_detalle')} maxLength={500} className={clase} />
            </Campo>
          )}
          <Campo T={T} label="Contacto de emergencia *">
            <input value={f.contacto_emergencia_nombre} onChange={cambiar('contacto_emergencia_nombre')} maxLength={120} className={clase} />
          </Campo>
          <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
            <Campo T={T} label="Relación">
              <input value={f.contacto_emergencia_relacion} onChange={cambiar('contacto_emergencia_relacion')} maxLength={60} className={clase} />
            </Campo>
            <Campo T={T} label="Su teléfono *">
              <input type="tel" inputMode="tel" value={f.contacto_emergencia_telefono} onChange={cambiar('contacto_emergencia_telefono')} maxLength={40} className={clase} />
            </Campo>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <BotonesDeEdicion T={T} guardando={guardando} onCancelar={() => setEditando(false)} />
        </form>
      )}
    </div>
  );
}

/** Una fila de turno: día, horario y puesto arriba; sus botones debajo. */
function FilaTurno({ T, turno, children }) {
  return (
    <div className={`py-3 border-b last:border-b-0 ${T.divider}`}>
      <p className="text-sm font-bold capitalize">{diaDelTurno(turno.dia)}</p>
      <p className={`text-xs mt-0.5 ${T.muted}`}>
        {soloHora(turno.hora_inicio)} – {soloHora(turno.hora_fin)}
        {turno.turno ? ` · Turno ${turno.turno}` : ''}
      </p>
      <p className="text-[11px] mt-1 flex items-start gap-1.5">
        <MapPin className="w-3.5 h-3.5 text-[#E77622] shrink-0 mt-px" />
        <span>{turno.puesto}</span>
      </p>
      <div className="flex items-center gap-2 mt-2.5">{children}</div>
    </div>
  );
}

function BotonTurno({ T, Icon, texto, girando, destacado, ...resto }) {
  return (
    <button
      type="button"
      className={`flex items-center gap-1 text-[11px] font-bold px-3 py-2 rounded-lg disabled:opacity-40 ${destacado ? 'bg-[#E77622] text-white' : T.chip}`}
      {...resto}
    >
      {girando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
      {texto}
    </button>
  );
}

function SeccionTurnos({ T, titulo, nota, children }) {
  return (
    <section className={`pt-4 mt-4 border-t first:border-t-0 first:pt-0 first:mt-0 ${T.divider}`}>
      <h4 className={`text-[11px] font-bold uppercase tracking-wider ${T.subtle}`}>{titulo}</h4>
      {nota && <p className={`text-[11px] mt-1 leading-relaxed ${T.muted}`}>{nota}</p>}
      <div className="mt-2">{children}</div>
    </section>
  );
}

/** Los turnos disponibles, juntos por puesto. */
function agruparPorPuesto(turnos) {
  const grupos = new Map();
  turnos.forEach((t) => {
    if (!grupos.has(t.puesto)) grupos.set(t.puesto, { puesto: t.puesto, descripcion: t.descripcion, turnos: [] });
    grupos.get(t.puesto).turnos.push(t);
  });
  return [...grupos.values()].sort((a, b) => a.puesto.localeCompare(b.puesto, 'es'));
}

const ACCIONES = {
  confirmar: { metodo: 'POST', ruta: (id) => `/turnos/${id}/confirmar`, listo: 'Turno confirmado. Gracias: contamos contigo.' },
  cancelar: { metodo: 'DELETE', ruta: (id) => `/turnos/${id}`, listo: 'Turno cancelado. Quedó libre para otro voluntario.' },
  solicitar: { metodo: 'POST', ruta: (id) => `/turnos/${id}/solicitar`, listo: 'Turno solicitado. La organización confirmará la asignación.' },
  retirar: { metodo: 'DELETE', ruta: (id) => `/turnos/${id}/solicitud`, listo: 'Solicitud cancelada.' },
};

/**
 * La pestaña «Turnos»: se elige el evento y, dentro, hasta tres secciones.
 *
 * - **Solicitados**: los que pidió y la organización aún no le asignó. Se
 *   pueden cancelar.
 * - **Asignados**: los que ya son suyos. «Confirmar» es reconfirmar que va
 *   —entre que se asigna un turno y llega el evento pasan semanas, y así la
 *   organización sabe con quién sigue contando—; «Cancelar» lo deja libre.
 * - **Disponibles**: los que puede pedir.
 *
 * Cada sección sale solo si tiene algo dentro. Tras cada acción se vuelve a
 * pedir todo al servidor: pedir o soltar un turno cambia también lo que queda
 * disponible, y recalcularlo aquí sería adivinar.
 */
function TarjetaTurnos({ T, onAsignadosCambian }) {
  // undefined = cargando · [] = sin postulaciones
  const [eventos, setEventos] = useState(undefined);
  const [elegido, setElegido] = useState(null);
  // { id, accion } del turno sobre el que se está actuando
  const [enCurso, setEnCurso] = useState(null);
  const [aviso, setAviso] = useState(null);
  // Los disponibles van por puesto y plegados: en un evento con todo por
  // cubrir son decenas de turnos, y sueltos tapaban lo demás.
  const [puestoAbierto, setPuestoAbierto] = useState(null);

  const cargar = useCallback(async () => {
    const { ok, data } = await authJson('GET', '/api/staff/mi-perfil/turnos', { token: token() });
    if (!ok) {
      setEventos((actual) => actual || []);
      setAviso({ tipo: 'error', texto: 'No se pudieron cargar los turnos. Inténtalo de nuevo.' });
      return;
    }
    const lista = data.eventos || [];
    setEventos(lista);
    setElegido((actual) => (lista.some((e) => e.evento === actual) ? actual : (lista[0]?.evento || null)));
    onAsignadosCambian(lista.flatMap((e) => e.asignados));
  }, [onAsignadosCambian]);

  useEffect(() => { cargar(); }, [cargar]);

  const actuar = async (turno, accion) => {
    const { metodo, ruta, listo } = ACCIONES[accion];
    setEnCurso({ id: turno.slot_id, accion });
    setAviso(null);
    const { ok, status, data } = await authJson(metodo, `/api/staff/mi-perfil${ruta(turno.slot_id)}`, { token: token() });
    if (status === 0) {
      setEnCurso(null);
      setAviso({ tipo: 'error', texto: 'No se pudo conectar. Inténtalo de nuevo.' });
      return;
    }
    await cargar();
    setEnCurso(null);
    setAviso(ok
      ? { tipo: 'ok', texto: listo }
      : { tipo: 'error', texto: typeof data.detail === 'string' ? data.detail : 'No se pudo completar. Inténtalo de nuevo.' });
  };

  const cancelarAsignado = (turno) => {
    if (!window.confirm(`¿Cancelar tu turno de ${turno.puesto}? Quedará libre para otro voluntario.`)) return;
    actuar(turno, 'cancelar');
  };

  const haciendo = (turno, accion) => enCurso?.id === turno.slot_id && enCurso.accion === accion;
  const evento = (eventos || []).find((e) => e.evento === elegido);

  return (
    <div className={`rounded-2xl px-4 py-4 ${T.card}`}>
      <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
        <CalendarClock className="w-4 h-4 text-[#E77622]" /> Turnos
      </h3>

      {eventos === undefined && (
        <div className={`flex justify-center py-10 ${T.muted}`}>
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      )}

      {eventos && eventos.length > 0 && (
        <div className="flex gap-1.5 mb-4">
          {eventos.map((e) => (
            <button
              key={e.evento}
              onClick={() => { setElegido(e.evento); setAviso(null); setPuestoAbierto(null); }}
              className={`flex-1 py-2 rounded-xl text-[11px] font-bold ${e.evento === elegido ? T.chipOn : T.chip}`}
            >
              {e.etiqueta}
            </button>
          ))}
        </div>
      )}

      {evento && (
        <div>
          {evento.solicitados.length > 0 && (
            <SeccionTurnos
              T={T}
              titulo="Turnos solicitados"
              nota="Los pediste y están pendientes de que la organización los asigne."
            >
              {evento.solicitados.map((t) => (
                <FilaTurno key={t.slot_id} T={T} turno={t}>
                  <BotonTurno
                    T={T}
                    Icon={X}
                    texto="Cancelar"
                    girando={haciendo(t, 'retirar')}
                    disabled={!!enCurso}
                    onClick={() => actuar(t, 'retirar')}
                  />
                </FilaTurno>
              ))}
            </SeccionTurnos>
          )}

          {evento.asignados.length > 0 && (
            <SeccionTurnos
              T={T}
              titulo="Turnos asignados"
              nota="Confirma cada uno para que sepamos que contamos contigo. Si no puedes cubrirlo, cancélalo."
            >
              <p className={`text-[11px] mb-1 flex items-center gap-1.5 ${T.muted}`}>
                <Bell className="w-3.5 h-3.5 text-[#E77622]" />
                Te avisamos 15 minutos antes de cada turno.
              </p>
              {evento.asignados.map((t) => (
                <FilaTurno key={t.slot_id} T={T} turno={t}>
                  {t.confirmado ? (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-green-500 px-1">
                      <CircleCheck className="w-3.5 h-3.5" /> Confirmado
                    </span>
                  ) : (
                    <BotonTurno
                      T={T}
                      Icon={Check}
                      texto="Confirmar"
                      destacado
                      girando={haciendo(t, 'confirmar')}
                      disabled={!!enCurso}
                      onClick={() => actuar(t, 'confirmar')}
                    />
                  )}
                  <BotonTurno
                    T={T}
                    Icon={X}
                    texto="Cancelar"
                    girando={haciendo(t, 'cancelar')}
                    disabled={!!enCurso}
                    onClick={() => cancelarAsignado(t)}
                  />
                </FilaTurno>
              ))}
            </SeccionTurnos>
          )}

          {evento.disponibles.length > 0 && (
            <SeccionTurnos
              T={T}
              titulo="Turnos disponibles"
              nota="Pide los que puedas cubrir. Es una solicitud: la organización confirma después."
            >
              {agruparPorPuesto(evento.disponibles).map((grupo) => {
                const abierto = puestoAbierto === grupo.puesto;
                return (
                  <div key={grupo.puesto} className={`border-b last:border-b-0 ${T.divider}`}>
                    <button
                      onClick={() => setPuestoAbierto(abierto ? null : grupo.puesto)}
                      className="w-full flex items-center gap-2 py-2.5 text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold">{grupo.puesto}</p>
                        <p className={`text-[11px] mt-0.5 ${T.subtle}`}>
                          {grupo.turnos.length} turno{grupo.turnos.length === 1 ? '' : 's'} con plazas
                        </p>
                      </div>
                      <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${T.muted} ${abierto ? 'rotate-180' : ''}`} />
                    </button>
                    {abierto && (
                      <div className="pb-2">
                        {grupo.descripcion && (
                          <p className={`text-[11px] mb-1 leading-relaxed ${T.muted}`}>{grupo.descripcion}</p>
                        )}
                        {grupo.turnos.map((t) => (
                          <FilaTurno key={t.slot_id} T={T} turno={t}>
                            <BotonTurno
                              T={T}
                              Icon={Plus}
                              texto="Solicitar"
                              girando={haciendo(t, 'solicitar')}
                              disabled={!!enCurso}
                              onClick={() => actuar(t, 'solicitar')}
                            />
                          </FilaTurno>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </SeccionTurnos>
          )}

          {evento.solicitados.length + evento.asignados.length + evento.disponibles.length === 0 && (
            <p className={`text-xs py-2 ${T.muted}`}>No hay turnos para {evento.nombre} por ahora.</p>
          )}
        </div>
      )}

      {eventos && eventos.length === 0 && !aviso && (
        <p className={`text-xs py-2 ${T.muted}`}>No tienes postulaciones con turnos.</p>
      )}

      {aviso && (
        <p className={`text-xs mt-3 ${aviso.tipo === 'ok' ? 'text-green-500' : 'text-red-500'}`}>
          {aviso.texto}
        </p>
      )}
    </div>
  );
}

/**
 * Perfil del miembro del staff: sus datos, lo que importa en una emergencia y
 * sus turnos.
 *
 * El equipo también pasa 24 horas en pie, así que sus datos de salud importan
 * tanto como los de un corredor; aquí los ve y los corrige él, y en la ficha
 * del equipo los ve quien tenga permiso para atender una emergencia.
 */
export default function StaffPerfilScreen() {
  const { T } = useLiveTheme();
  const navigate = useNavigate();

  const [datos, setDatos] = useState(undefined);
  const [tab, setTab] = useState('datos');
  const [bajandoCarnet, setBajandoCarnet] = useState(false);
  const [errorCarnet, setErrorCarnet] = useState(null);

  // El carnet para imprimir: anverso y reverso con sus marcas de corte.
  const descargarCarnet = async () => {
    setBajandoCarnet(true);
    setErrorCarnet(null);
    try {
      const res = await fetch(`${API}/api/staff/mi-perfil/carnet`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) throw new Error();
      await guardarArchivo('carnet-staff.pdf', await res.blob(), 'Carnet de staff');
    } catch {
      setErrorCarnet('No se pudo descargar el carnet. Inténtalo de nuevo.');
    } finally {
      setBajandoCarnet(false);
    }
  };

  const cargarPerfil = useCallback(() => {
    const t = token();
    if (!t) { navigate('/live/login'); return; }
    authJson('GET', '/api/staff/mi-perfil', { token: t })
      .then(({ ok, data }) => {
        setDatos(ok ? data : null);
        // Ligar el teléfono al voluntario es lo que permite avisarle antes
        // del turno; se hace aquí, que es donde ve que existen.
        if (ok && data.turnos?.length) registrarStaff(data.username);
      });
  }, [navigate]);

  useEffect(() => { cargarPerfil(); }, [cargarPerfil]);

  // La pestaña de turnos avisa de cómo quedan los asignados tras cada acción,
  // para que el aviso de «por confirmar» no se quede atrás.
  const alCambiarAsignados = useCallback(
    (turnos) => setDatos((d) => (d ? { ...d, turnos } : d)),
    [],
  );

  // Confirmar el correo. Quien se da de alta como staff entra en el acto, pero
  // su ficha y sus turnos se buscan por el correo: hasta que no demuestra que
  // es suyo, el servidor no los enseña. El código le llegó al darse de alta, o
  // al abrir esta pantalla si la cuenta era de antes.
  const [codigo, setCodigo] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [avisoCodigo, setAvisoCodigo] = useState(null);

  const confirmarCorreo = async (e) => {
    e.preventDefault();
    setConfirmando(true);
    setAvisoCodigo(null);
    // Con la sesión puesta: el código demuestra el buzón, y la sesión, que
    // quien lo escribe es quien abrió la cuenta.
    const { ok, data } = await authJson('POST', '/api/cuentas/verificar', {
      token: token(), body: { email: datos.username, code: codigo.trim() },
    });
    setConfirmando(false);
    if (ok) {
      setCodigo('');
      setDatos(undefined);
      cargarPerfil();
    } else {
      setAvisoCodigo({ tipo: 'error', texto: data.detail || 'No se pudo confirmar el correo' });
    }
  };

  const otroCodigo = async () => {
    setAvisoCodigo(null);
    const { ok, data } = await authJson('POST', '/api/cuentas/reenviar-codigo', {
      body: { email: datos.username },
    });
    setAvisoCodigo(ok
      ? { tipo: 'ok', texto: `Te enviamos otro código a ${datos.username}.` }
      : { tipo: 'error', texto: data.detail || 'No se pudo enviar el código' });
  };

  const volverAEntrar = async () => {
    await cerrarSesion();
    navigate('/live/login');
  };

  const p = datos?.perfil;
  const sinConfirmar = (datos?.turnos || []).filter((t) => t.confirmado === false).length;

  return (
    <Screen title="Mi perfil">
      <div className="px-4 py-4 space-y-4">
        <div className="flex gap-1.5">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 px-1 py-2 rounded-xl text-[11px] leading-tight font-bold text-center ${tab === key ? T.chipOn : T.chip}`}
            >
              <Icon className="w-4 h-4" />
              <span>
                {label}
                {key === 'turnos' && sinConfirmar > 0 && (
                  <span className="opacity-70 font-normal"> · {sinConfirmar}</span>
                )}
              </span>
            </button>
          ))}
        </div>

        {datos === undefined && (
          <div className={`flex justify-center py-16 ${T.muted}`}>
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        )}

        {datos?.verificacion_pendiente && (
          <form onSubmit={confirmarCorreo} className={`rounded-2xl px-4 py-5 ${T.card}`}>
            <h3 className="text-sm font-bold flex items-center gap-2">
              <MailCheck className="w-4 h-4 text-[#E77622]" /> Confirma tu correo
            </h3>
            <p className={`text-xs mt-1.5 leading-relaxed ${T.muted}`}>
              Te enviamos un código de seis dígitos a {datos.username}. Escríbelo
              aquí para ver tu ficha de voluntario, tus turnos y tu carnet.
            </p>
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="000000"
              maxLength={6}
              inputMode="numeric"
              autoComplete="one-time-code"
              className={`w-full rounded-xl px-3 py-2.5 text-sm mt-3 tracking-[0.3em] ${T.input}`}
            />
            <button
              type="submit"
              disabled={confirmando || codigo.trim().length < 6}
              className={`w-full flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-2.5 rounded-xl mt-2 disabled:opacity-40 ${T.chipOn}`}
            >
              {confirmando
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Check className="w-3.5 h-3.5" />}
              Confirmar
            </button>
            <button
              type="button"
              onClick={otroCodigo}
              className={`w-full text-[11px] font-bold py-2 mt-1 ${T.muted}`}
            >
              Enviarme otro código
            </button>
            {avisoCodigo && (
              <p className={`text-xs mt-1 ${avisoCodigo.tipo === 'ok' ? 'text-green-500' : 'text-red-500'}`}>
                {avisoCodigo.texto}
              </p>
            )}
          </form>
        )}

        {datos?.sesion_caducada && (
          <div className={`rounded-2xl px-4 py-6 text-center ${T.card}`}>
            <p className="text-sm font-bold">Vuelve a entrar</p>
            <p className={`text-xs mt-1.5 leading-relaxed ${T.muted}`}>
              La contraseña de esta cuenta cambió después de abrir esta sesión.
              Entra otra vez para ver tu ficha y tus turnos.
            </p>
            <button
              onClick={volverAEntrar}
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg mt-3 mx-auto ${T.actionChip}`}
            >
              <LogIn className="w-3.5 h-3.5 text-[#E77622]" /> Entrar otra vez
            </button>
          </div>
        )}

        {datos && !p && !datos.verificacion_pendiente && !datos.sesion_caducada && (
          <div className={`rounded-2xl px-4 py-6 text-center ${T.card}`}>
            <p className="text-sm font-bold">Sin ficha de voluntario</p>
            <p className={`text-xs mt-1.5 leading-relaxed ${T.muted}`}>
              Tu usuario no está asociado a un registro de voluntariado, así que
              no hay datos personales ni turnos que mostrar.
            </p>
          </div>
        )}

        {p && tab === 'datos' && (
          <>
            <TarjetaDatos T={T} p={p} onGuardado={(perfil) => setDatos((d) => ({ ...d, perfil }))} />

            <div className={`rounded-2xl px-4 py-4 ${T.card}`}>
              <h3 className="text-sm font-bold flex items-center gap-2 mb-1">
                <IdCard className="w-4 h-4 text-[#E77622]" /> Carnet de staff
              </h3>
              <p className={`text-xs leading-relaxed ${T.muted}`}>
                Imprímelo, recórtalo por las marcas, dóblalo por la mitad y
                llévalo visible durante el evento.
              </p>
              <button
                onClick={descargarCarnet}
                disabled={bajandoCarnet}
                className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg mt-3 w-fit ${T.actionChip}`}
              >
                {bajandoCarnet
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#E77622]" />
                  : <IdCard className="w-3.5 h-3.5 text-[#E77622]" />}
                Descargar carnet (PDF)
              </button>
              {errorCarnet && <p className="text-xs text-red-500 mt-2">{errorCarnet}</p>}
            </div>
          </>
        )}

        {p && tab === 'salud' && (
          <TarjetaSalud T={T} p={p} onGuardado={(perfil) => setDatos((d) => ({ ...d, perfil }))} />
        )}

        {p && tab === 'turnos' && (
          <TarjetaTurnos T={T} onAsignadosCambian={alCambiarAsignados} />
        )}
      </div>
    </Screen>
  );
}
