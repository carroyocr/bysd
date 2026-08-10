import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, CalendarClock, Loader2, Droplet, HeartPulse, TriangleAlert, Phone, MapPin, Bell,
  ListChecks, Check, Users as UsersIcon, ChevronDown, X,
} from 'lucide-react';
import { authJson } from '../liveApi';
import { useLiveTheme } from '../liveTheme';
import { Screen } from '../LiveApp';
import { registrarStaff } from '../push';

// El orden sigue lo que hace el voluntario: primero se ve, luego pide turnos y
// al final consulta lo que le confirmaron. "Asignados" y no "Turnos", que se
// confundía con los que uno elige.
const TABS = [
  { key: 'datos', label: 'Datos', icon: User },
  { key: 'elegir', label: 'Elegir', icon: ListChecks },
  { key: 'turnos', label: 'Asignados', icon: CalendarClock },
];

const EVENTOS = [
  { valor: 'carrera', label: 'Carrera' },
  { valor: 'campeonato', label: 'Campeonato' },
];

/** "2027-01-23" + "06:30:00" -> "sáb, 23 ene · 6:30 a. m." */
function formatoTurno(dia, hora) {
  if (!dia) return '';
  const d = new Date(`${dia}T${(hora || '00:00:00')}`);
  if (Number.isNaN(d.getTime())) return `${dia} ${hora || ''}`.trim();
  return `${d.toLocaleDateString('es-DO', { weekday: 'short', day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString('es-DO', { hour: 'numeric', minute: '2-digit' })}`;
}

const soloHora = (hora) => (hora || '').slice(0, 5);

/**
 * Momento de entrada y de salida de un turno, en milisegundos.
 * El que cierra a medianoche —o a una hora menor que la de entrada— termina
 * al día siguiente; sin esto, el de 20:00 a 00:00 parecería durar menos veinte
 * horas y no chocaría con ninguno.
 */
function tramoTurno(t) {
  if (!t?.fecha) return null;
  const ini = new Date(`${t.fecha}T${soloHora(t.hora_inicio) || '00:00'}`);
  let fin = new Date(`${t.fecha}T${soloHora(t.hora_fin) || '00:00'}`);
  if (Number.isNaN(ini.getTime()) || Number.isNaN(fin.getTime())) return null;
  if (fin <= ini) fin = new Date(fin.getTime() + 86400000);
  return [ini.getTime(), fin.getTime()];
}

/** "2027-01-23" -> "sáb, 23 ene". Sin la hora, para encabezar un turno. */
function diaFecha(fecha) {
  if (!fecha) return '';
  const d = new Date(`${fecha}T12:00:00`);
  if (Number.isNaN(d.getTime())) return fecha;
  return d.toLocaleDateString('es-DO', { weekday: 'short', day: 'numeric', month: 'short' });
}

/**
 * Perfil del miembro del staff: sus datos y los turnos que le asignaron.
 *
 * El equipo también pasa 24 horas en pie, así que sus datos de salud importan
 * tanto como los de un corredor; aquí los ve él, y en la ficha del equipo los
 * ve quien tenga permiso para atender una emergencia.
 */
export default function StaffPerfilScreen() {
  const { T } = useLiveTheme();
  const navigate = useNavigate();

  const [datos, setDatos] = useState(undefined);
  const [tab, setTab] = useState('datos');

  // Elegir turnos: lo que el voluntario PIDE, distinto de lo que le asignan.
  const [evento, setEvento] = useState('carrera');
  const [oferta, setOferta] = useState(null);
  const [elegidos, setElegidos] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState(null);

  // Acordeón de puestos: la lista completa son decenas de turnos y llegaba
  // toda desplegada. Arrancan cerrados y solo se abre uno a la vez.
  const [puestoAbierto, setPuestoAbierto] = useState(null);

  // Al desplegar, subir el puesto al borde de arriba. Si no, la lista que se
  // abre empuja la pantalla y el nombre y la descripción quedan fuera de
  // vista: se ve el final de los turnos sin saber de qué puesto son.
  const refsPuesto = useRef({});
  useEffect(() => {
    if (!puestoAbierto) return;
    refsPuesto.current[puestoAbierto]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [puestoAbierto]);

  const cargarOferta = useCallback(async (ev) => {
    setOferta(null);
    setPuestoAbierto(null);
    const token = localStorage.getItem('admin_token');
    const { ok, data } = await authJson('GET', `/api/staff/mi-perfil/turnos-disponibles?evento=${ev}`, { token });
    setOferta(ok ? (data.positions || []) : []);
  }, []);

  useEffect(() => {
    if (tab === 'elegir') cargarOferta(evento);
  }, [tab, evento, cargarOferta]);

  // Horario que ya ocupa lo marcado. El mismo turno (misma letra, mismo
  // horario) se ofrece en varios puestos, así que marcar dos era fácil; y
  // nadie puede cubrir dos puestos a la vez.
  const tramosElegidos = useMemo(() => {
    const porSlot = new Map();
    (oferta || []).forEach((p) => (p.turnos || []).forEach((t) => porSlot.set(t.slot_id, t)));
    return elegidos.map((id) => tramoTurno(porSlot.get(id))).filter(Boolean);
  }, [oferta, elegidos]);

  const chocaConLoElegido = (t) => {
    const tramo = tramoTurno(t);
    if (!tramo) return false;
    return tramosElegidos.some(([ini, fin]) => tramo[0] < fin && ini < tramo[1]);
  };

  const alternar = (slotId) => {
    setElegidos((p) => (p.includes(slotId) ? p.filter((s) => s !== slotId) : [...p, slotId]));
    setAviso(null);
  };

  /**
   * Soltar un turno asignado. Antes habia que escribir a la organizacion para
   * que lo quitara a mano.
   */
  const [soltando, setSoltando] = useState(null);

  const soltarTurno = async (turno) => {
    if (!window.confirm(`¿Cancelar el turno de ${turno.puesto}? Quedará libre para otro voluntario.`)) return;
    setSoltando(turno.slot_id);
    setAviso(null);
    const token = localStorage.getItem('admin_token');
    const { ok, data } = await authJson('DELETE', `/api/staff/mi-perfil/turnos/${turno.slot_id}`, { token });
    setSoltando(null);
    if (ok) {
      setDatos((p) => ({ ...p, turnos: (p.turnos || []).filter((t) => t.slot_id !== turno.slot_id) }));
      setAviso({ tipo: 'ok', texto: 'Turno cancelado. Ya no cuentas para ese puesto.' });
    } else {
      setAviso({ tipo: 'error', texto: data.detail || 'No se pudo cancelar el turno' });
    }
  };

  const guardarTurnos = async () => {
    setGuardando(true);
    setAviso(null);
    const token = localStorage.getItem('admin_token');
    const { ok, data } = await authJson('PUT', '/api/staff/mi-perfil/turnos', {
      token, body: { evento, slots_interes: elegidos },
    });
    setGuardando(false);
    if (ok) {
      setAviso({ tipo: 'ok', texto: 'Turnos guardados. La organización confirmará la asignación.' });
    } else {
      setAviso({ tipo: 'error', texto: data.detail || 'No se pudieron guardar' });
      cargarOferta(evento);   // alguien pudo quedarse con un turno mientras tanto
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) { navigate('/live/login'); return; }
    authJson('GET', '/api/staff/mi-perfil', { token })
      .then(({ ok, data }) => {
        setDatos(ok ? data : null);
        if (ok) {
          setEvento(data.evento || 'carrera');
          setElegidos(data.slots_interes || []);
        }
        // Ligar el teléfono al voluntario es lo que permite avisarle 30 min
        // antes del turno; se hace aquí, que es donde ve que existen.
        if (ok && data.turnos?.length) registrarStaff(data.username);
      });
  }, [navigate]);

  const p = datos?.perfil;
  const turnos = datos?.turnos || [];

  return (
    <Screen title="Mi perfil">
      <div className="px-4 py-4 space-y-4">
        <div className="flex gap-1.5">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-bold ${tab === key ? T.chipOn : T.chip}`}
            >
              <Icon className="w-4 h-4" /> {label}
              {key === 'turnos' && turnos.length > 0 && (
                <span className="opacity-60 font-normal">{turnos.length}</span>
              )}
            </button>
          ))}
        </div>

        {datos === undefined && (
          <div className={`flex justify-center py-16 ${T.muted}`}>
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        )}

        {datos && !p && (
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
            <div className={`rounded-2xl px-4 py-4 ${T.card}`}>
              <h3 className="text-sm font-bold flex items-center gap-2 mb-2">
                <User className="w-4 h-4 text-[#E77622]" /> Datos personales
              </h3>
              <Fila T={T} label="Nombre" value={`${p.nombre || ''} ${p.apellidos || ''}`.trim()} />
              <Fila T={T} label="Correo" value={p.email} />
              <Fila T={T} label="Teléfono" value={p.telefono} />
              <Fila T={T} label="Fecha de nacimiento" value={p.fecha_nacimiento} />
              <Fila T={T} label="Sexo" value={p.sexo} />
              <Fila T={T} label="Ciudad" value={p.ciudad_residencia} />
              <Fila T={T} label="Talla de camiseta" value={p.talla_camiseta} />
            </div>

            <div className={`rounded-2xl px-4 py-4 ${T.card}`}>
              <h3 className="text-sm font-bold flex items-center gap-2 mb-2">
                <HeartPulse className="w-4 h-4 text-[#E77622]" /> Salud y emergencia
              </h3>
              <Fila T={T} label="Tipo de sangre" value={p.tipo_sangre} Icon={Droplet} />
              <Fila
                T={T}
                label="Condición médica"
                value={/^s[ií]$/i.test(p.condicion_medica || '') ? (p.condicion_medica_detalle || 'Sí') : 'No'}
                Icon={HeartPulse}
              />
              <Fila
                T={T}
                label="Alergias"
                value={/^s[ií]$/i.test(p.alergias || '') ? (p.alergias_detalle || 'Sí') : 'No'}
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
            </div>
          </>
        )}

        {p && tab === 'turnos' && (
          <div className={`rounded-2xl px-4 py-4 ${T.card}`}>
            <h3 className="text-sm font-bold flex items-center gap-2 mb-1">
              <CalendarClock className="w-4 h-4 text-[#E77622]" /> Turnos asignados
            </h3>
            {turnos.length === 0 ? (
              <p className={`text-xs py-3 ${T.muted}`}>
                Todavía no tienes turnos asignados. La organización te avisará.
              </p>
            ) : (
              <>
                <p className={`text-[11px] mb-2 flex items-center gap-1.5 ${T.muted}`}>
                  <Bell className="w-3.5 h-3.5 text-[#E77622]" />
                  Te avisamos 15 minutos antes de cada turno.
                </p>
                {turnos.map((t) => (
                  <div key={t.slot_id} className={`py-3 border-b last:border-b-0 ${T.divider}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold">{formatoTurno(t.dia, t.hora_inicio)}</p>
                        <p className={`text-xs mt-0.5 ${T.muted}`}>
                          {soloHora(t.hora_inicio)} – {soloHora(t.hora_fin)}
                          {t.turno ? ` · Turno ${t.turno}` : ''}
                        </p>
                        <p className="text-[11px] mt-1 flex items-start gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[#E77622] shrink-0 mt-px" />
                          <span>{t.puesto}</span>
                        </p>
                      </div>
                      <button
                        onClick={() => soltarTurno(t)}
                        disabled={soltando === t.slot_id}
                        className={`shrink-0 flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg disabled:opacity-40 ${T.chip}`}
                      >
                        {soltando === t.slot_id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <X className="w-3.5 h-3.5" />}
                        Cancelar
                      </button>
                    </div>
                  </div>
                ))}
                {aviso && (
                  <p className={`text-xs mt-3 ${aviso.tipo === 'ok' ? 'text-green-500' : 'text-red-500'}`}>
                    {aviso.texto}
                  </p>
                )}
              </>
            )}
          </div>
        )}
        {p && tab === 'elegir' && (
          <div className={`rounded-2xl px-4 py-4 ${T.card}`}>
            <h3 className="text-sm font-bold flex items-center gap-2 mb-1">
              <ListChecks className="w-4 h-4 text-[#E77622]" /> Elegir turnos
            </h3>
            <p className={`text-[11px] leading-relaxed mb-3 ${T.muted}`}>
              Marca los turnos que puedes cubrir. Es una solicitud: la
              organización confirma después la asignación final.
            </p>

            <div className="flex gap-1.5 mb-3">
              {EVENTOS.map(({ valor, label }) => (
                <button
                  key={valor}
                  onClick={() => { setEvento(valor); setAviso(null); }}
                  className={`flex-1 py-2 rounded-xl text-[11px] font-bold ${evento === valor ? T.chipOn : T.chip}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {oferta === null && (
              <div className={`flex justify-center py-10 ${T.muted}`}>
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            )}

            {oferta && oferta.length === 0 && (
              <p className={`text-xs py-3 ${T.muted}`}>
                No hay turnos publicados para este evento.
              </p>
            )}

            {(oferta || []).map((puesto) => {
              const abierto = puestoAbierto === puesto.puesto;
              const marcadosAqui = (puesto.turnos || []).filter((t) => elegidos.includes(t.slot_id)).length;
              return (
              <div
                key={puesto.puesto}
                ref={(el) => { refsPuesto.current[puesto.puesto] = el; }}
                // El margen de desplazamiento deja sitio a la barra superior,
                // que es fija y taparía el nombre del puesto.
                className={`py-1 border-b last:border-b-0 scroll-mt-[calc(4.5rem+env(safe-area-inset-top))] ${T.divider}`}
              >
                <button
                  onClick={() => setPuestoAbierto(abierto ? null : puesto.puesto)}
                  className="w-full flex items-center gap-2 py-2.5 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold">{puesto.puesto}</p>
                    <p className={`text-[11px] mt-0.5 ${T.subtle}`}>
                      {(puesto.turnos || []).length} turno{(puesto.turnos || []).length === 1 ? '' : 's'} con plazas
                      {marcadosAqui > 0 ? ` · ${marcadosAqui} marcado${marcadosAqui === 1 ? '' : 's'}` : ''}
                    </p>
                  </div>
                  <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${T.muted} ${abierto ? 'rotate-180' : ''}`} />
                </button>
                {abierto && puesto.descripcion && (
                  <p className={`text-[11px] mb-2 leading-relaxed ${T.muted}`}>{puesto.descripcion}</p>
                )}
                <div className={`space-y-1.5 ${abierto ? 'mb-3' : 'hidden'}`}>
                  {(puesto.turnos || []).map((t) => {
                    const marcado = elegidos.includes(t.slot_id);
                    // Un turno lleno solo se puede tocar si ya es tuyo
                    const lleno = (t.available_count || 0) === 0 && !marcado;
                    const choca = !marcado && !lleno && chocaConLoElegido(t);
                    const bloqueado = lleno || choca;
                    return (
                      <button
                        key={t.slot_id}
                        onClick={() => !bloqueado && alternar(t.slot_id)}
                        disabled={bloqueado}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left ${marcado ? 'bg-[#E77622]/15' : T.input} ${bloqueado ? 'opacity-40' : ''}`}
                      >
                        <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${marcado ? 'bg-[#E77622] border-[#E77622]' : 'border-gray-500/50'}`}>
                          {marcado && <Check className="w-3 h-3 text-white" />}
                        </span>
                        <div className="flex-1 min-w-0">
                          {/* El día y la fecha delante: sin ellos dos turnos de
                              días distintos se ven idénticos. */}
                          <p className="text-xs font-semibold">
                            {diaFecha(t.fecha)}
                            {t.fecha ? ' · ' : ''}
                            {soloHora(t.hora_inicio)} – {soloHora(t.hora_fin)}
                          </p>
                          <p className={`text-[10px] mt-0.5 flex items-center gap-1 ${T.subtle}`}>
                            <UsersIcon className="w-3 h-3" />
                            {t.turno ? `Turno ${t.turno} · ` : ''}
                            {lleno && 'Sin plazas'}
                            {choca && 'Coincide con otro turno que ya marcaste'}
                            {!lleno && !choca && `${t.available_count} de ${t.total_count} libres`}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              );
            })}

            {aviso && (
              <p className={`text-xs mt-3 ${aviso.tipo === 'ok' ? 'text-green-500' : 'text-red-500'}`}>
                {aviso.texto}
              </p>
            )}

            {oferta && oferta.length > 0 && (
              <button
                onClick={guardarTurnos}
                disabled={guardando}
                className="w-full bg-[#E77622] text-white font-bold rounded-xl py-3 text-sm mt-4 disabled:opacity-50"
              >
                {guardando ? 'Guardando…' : `Guardar ${elegidos.length} turno${elegidos.length === 1 ? '' : 's'}`}
              </button>
            )}
          </div>
        )}
      </div>
    </Screen>
  );
}

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
