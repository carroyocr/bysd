import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, CalendarClock, Loader2, Droplet, HeartPulse, TriangleAlert, Phone, MapPin, Bell,
} from 'lucide-react';
import { authJson } from '../liveApi';
import { useLiveTheme } from '../liveTheme';
import { Screen } from '../LiveApp';
import { registrarStaff } from '../push';

const TABS = [
  { key: 'datos', label: 'Datos', icon: User },
  { key: 'turnos', label: 'Turnos', icon: CalendarClock },
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

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) { navigate('/live/login'); return; }
    authJson('GET', '/api/staff/mi-perfil', { token })
      .then(({ ok, data }) => {
        setDatos(ok ? data : null);
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
              <CalendarClock className="w-4 h-4 text-[#E77622]" /> Mis turnos
            </h3>
            {turnos.length === 0 ? (
              <p className={`text-xs py-3 ${T.muted}`}>
                Todavía no tienes turnos asignados. La organización te avisará.
              </p>
            ) : (
              <>
                <p className={`text-[11px] mb-2 flex items-center gap-1.5 ${T.muted}`}>
                  <Bell className="w-3.5 h-3.5 text-[#E77622]" />
                  Te avisamos 30 minutos antes de cada turno.
                </p>
                {turnos.map((t) => (
                  <div key={t.slot_id} className={`py-3 border-b last:border-b-0 ${T.divider}`}>
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
                ))}
              </>
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
