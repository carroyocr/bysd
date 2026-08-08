import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Loader2, Phone, Droplet, HeartPulse, TriangleAlert, UserRound, Lock,
} from 'lucide-react';
import { authJson } from '../liveApi';
import { useLiveTheme } from '../liveTheme';
import { Screen } from '../LiveApp';

/**
 * Ficha de emergencia de los inscritos, para el equipo de la carrera.
 *
 * Si un corredor se descompone en el corral no hay tiempo de abrir el panel en
 * un portátil: se busca por dorsal y salen su tipo de sangre, sus alergias y a
 * quién llamar.
 *
 * Exige haber entrado como staff con el permiso "scanner". El listado se pide
 * una vez y se filtra en el teléfono, para que la búsqueda siga funcionando
 * aunque la cobertura del recinto sea mala.
 */
export default function StaffAtletasScreen() {
  const { T } = useLiveTheme();
  const navigate = useNavigate();

  const [atletas, setAtletas] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [abierto, setAbierto] = useState(null);

  const cargar = useCallback(async () => {
    const token = localStorage.getItem('admin_token');
    if (!token) { navigate('/live/staff'); return; }
    const { ok, status, data } = await authJson('GET', '/api/athletes/staff/emergency-info', { token });
    if (ok) {
      setAtletas(data.atletas || []);
    } else {
      setAtletas([]);
      setError(status === 403
        ? 'Tu usuario no tiene permiso para ver estos datos.'
        : (data.detail || 'No se pudo cargar la lista.'));
    }
  }, [navigate]);

  useEffect(() => { cargar(); }, [cargar]);

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return atletas || [];
    return (atletas || []).filter((a) =>
      (a.nombre_completo || '').toLowerCase().includes(q) ||
      (a.bib || '').toLowerCase().includes(q.replace(/^#/, ''))
    );
  }, [atletas, search]);

  const tieneAviso = (a) => a.condicion_medica === 'Sí' || a.condicion_medica === 'Si' ||
    a.alergias === 'Sí' || a.alergias === 'Si';

  return (
    <Screen title="Atletas">
      <div className="px-3.5 py-3">
        <div className={`flex items-center gap-2.5 rounded-xl px-3.5 mb-3 ${T.input}`}>
          <Search className="w-4 h-4 shrink-0 opacity-70" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por dorsal o nombre"
            inputMode="search"
            className="w-full bg-transparent py-2.5 text-sm outline-none"
          />
        </div>

        {error && <p className="text-xs text-red-500 px-1 mb-2">{error}</p>}

        {atletas === null && (
          <div className={`flex justify-center py-16 ${T.muted}`}>
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        )}

        {atletas !== null && filtrados.length === 0 && !error && (
          <div className={`text-center py-14 px-6 ${T.muted}`}>
            <UserRound className="w-10 h-10 mx-auto mb-3 opacity-60" />
            <p className="font-semibold">Ningún atleta coincide</p>
          </div>
        )}

        {filtrados.map((a, idx) => {
          const abierta = abierto === (a.bib || idx);
          return (
            <div key={a.bib || `sin-bib-${idx}`} className={`rounded-2xl mb-2.5 ${T.card}`}>
              <button
                onClick={() => setAbierto(abierta ? null : (a.bib || idx))}
                className="w-full flex items-center gap-3 px-3 py-3 text-left"
              >
                <span className={`text-xs font-mono font-bold w-11 shrink-0 ${T.muted}`}>
                  {a.bib ? `#${a.bib}` : '—'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold truncate">{a.nombre_completo}</p>
                  <div className={`flex items-center gap-2 mt-0.5 text-[11px] ${T.muted}`}>
                    {a.tipo_sangre && (
                      <span className="flex items-center gap-1">
                        <Droplet className="w-3.5 h-3.5" /> {a.tipo_sangre}
                      </span>
                    )}
                    {tieneAviso(a) && (
                      <span className="flex items-center gap-1 text-amber-500 font-semibold">
                        <TriangleAlert className="w-3.5 h-3.5" /> Con aviso médico
                      </span>
                    )}
                  </div>
                </div>
              </button>

              {abierta && (
                <div className={`px-3 pb-3.5 border-t pt-3 ${T.divider}`}>
                  <Dato T={T} icon={Droplet} label="Tipo de sangre" value={a.tipo_sangre} />
                  <Dato
                    T={T}
                    icon={HeartPulse}
                    label="Condición médica"
                    value={/^s[ií]$/i.test(a.condicion_medica || '')
                      ? (a.condicion_medica_detalle || 'Sí, sin detalle')
                      : 'No'}
                    alerta={/^s[ií]$/i.test(a.condicion_medica || '')}
                  />
                  <Dato
                    T={T}
                    icon={TriangleAlert}
                    label="Alergias"
                    value={/^s[ií]$/i.test(a.alergias || '')
                      ? (a.alergias_detalle || 'Sí, sin detalle')
                      : 'No'}
                    alerta={/^s[ií]$/i.test(a.alergias || '')}
                  />

                  <p className="text-[11px] font-bold uppercase tracking-wide text-[#E77622] mt-3 mb-1">
                    Contacto de emergencia
                  </p>
                  <Dato T={T} icon={UserRound} label="Nombre"
                    value={[a.contacto_emergencia_nombre, a.contacto_emergencia_relacion].filter(Boolean).join(' · ')} />

                  {a.contacto_emergencia_telefono && (
                    <a
                      href={`tel:${a.contacto_emergencia_telefono}`}
                      className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg mt-2 w-fit ${T.actionChip}`}
                    >
                      <Phone className="w-3.5 h-3.5 text-[#E77622]" /> Llamar a {a.contacto_emergencia_telefono}
                    </a>
                  )}
                  {a.telefono && (
                    <a
                      href={`tel:${a.telefono}`}
                      className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg mt-2 w-fit ${T.actionChip}`}
                    >
                      <Phone className="w-3.5 h-3.5" /> Teléfono del atleta {a.telefono}
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {atletas !== null && atletas.length > 0 && (
          <p className={`text-[10px] flex items-center justify-center gap-1 text-center mt-5 ${T.subtle}`}>
            <Lock className="w-3 h-3" /> Datos médicos: úsalos solo para atender una emergencia
          </p>
        )}
      </div>
    </Screen>
  );
}

function Dato({ T, icon: Icon, label, value, alerta }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 py-1">
      <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${alerta ? 'text-amber-500' : T.subtle}`} />
      <div className="min-w-0 flex-1">
        <p className={`text-[10px] uppercase tracking-wide ${T.subtle}`}>{label}</p>
        <p className={`text-xs ${alerta ? 'font-bold text-amber-500' : ''}`}>{value}</p>
      </div>
    </div>
  );
}
