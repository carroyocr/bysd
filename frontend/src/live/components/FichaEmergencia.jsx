import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Loader2, Phone, Droplet, HeartPulse, TriangleAlert, UserRound, Lock,
} from 'lucide-react';
import { authJson } from '../liveApi';
import { useLiveTheme } from '../liveTheme';
import { Screen } from '../LiveApp';
import { token } from '../sesion';

const esSi = (v) => /^s[ií]$/i.test(v || '');

/**
 * Listado buscable de fichas de emergencia, con el mismo formato para los
 * corredores y para el equipo de staff: si alguien se descompone hay que ver
 * en segundos su tipo de sangre, sus alergias y a quién llamar.
 *
 * Es un solo componente porque la pantalla es idéntica en los dos casos; lo
 * único que cambia es de dónde salen los datos y qué se enseña en la línea de
 * cabecera (el dorsal en los corredores, el teléfono en el equipo).
 *
 * El listado se pide una vez y se filtra en el teléfono, para que la búsqueda
 * siga funcionando aunque la cobertura del recinto sea mala.
 */
export default function FichaEmergencia({ titulo, endpoint, campoLista, encabezado, vacio }) {
  const { T } = useLiveTheme();
  const navigate = useNavigate();

  const [gente, setGente] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [abierto, setAbierto] = useState(null);

  const cargar = useCallback(async () => {
    const t = token();
    if (!t) { navigate('/live/login'); return; }
    const { ok, status, data } = await authJson('GET', endpoint, { token: t });
    if (ok) {
      setGente(data[campoLista] || []);
    } else {
      setGente([]);
      setError(status === 403
        ? 'Tu usuario no tiene permiso para ver estos datos.'
        : (data.detail || 'No se pudo cargar la lista.'));
    }
  }, [navigate, endpoint, campoLista]);

  useEffect(() => { cargar(); }, [cargar]);

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return gente || [];
    return (gente || []).filter((a) =>
      (a.nombre_completo || '').toLowerCase().includes(q) ||
      (a.bib || '').toLowerCase().includes(q.replace(/^#/, '')) ||
      (a.email || '').toLowerCase().includes(q)
    );
  }, [gente, search]);

  const tieneAviso = (a) => esSi(a.condicion_medica) || esSi(a.alergias);

  return (
    <Screen title={titulo} back>
      <div className="px-3.5 py-3">
        <div className={`flex items-center gap-2.5 rounded-xl px-3.5 mb-3 ${T.input}`}>
          <Search className="w-4 h-4 shrink-0 opacity-70" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre"
            inputMode="search"
            className="w-full bg-transparent py-2.5 text-sm outline-none"
          />
        </div>

        {error && <p className="text-xs text-red-500 px-1 mb-2">{error}</p>}

        {gente === null && (
          <div className={`flex justify-center py-16 ${T.muted}`}>
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        )}

        {gente !== null && filtrados.length === 0 && !error && (
          <div className={`text-center py-14 px-6 ${T.muted}`}>
            <UserRound className="w-10 h-10 mx-auto mb-3 opacity-60" />
            <p className="font-semibold">{vacio || 'Nadie coincide'}</p>
          </div>
        )}

        {filtrados.map((a, idx) => {
          const clave = a.bib || a.email || idx;
          const abierta = abierto === clave;
          return (
            <div key={clave} className={`rounded-2xl mb-2.5 ${T.card}`}>
              <button
                onClick={() => setAbierto(abierta ? null : clave)}
                className="w-full flex items-center gap-3 px-3 py-3 text-left"
              >
                {a.bib !== undefined && (
                  <span className={`text-xs font-mono font-bold w-11 shrink-0 ${T.muted}`}>
                    {a.bib ? `#${a.bib}` : '—'}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold truncate">{a.nombre_completo}</p>
                  <div className={`flex items-center gap-2 mt-0.5 text-[11px] ${T.muted}`}>
                    {a.tipo_sangre && (
                      <span className="flex items-center gap-1">
                        <Droplet className="w-3.5 h-3.5" /> {a.tipo_sangre}
                      </span>
                    )}
                    {encabezado && <span className="truncate">{encabezado(a)}</span>}
                    {tieneAviso(a) && (
                      <span className="flex items-center gap-1 text-amber-500 font-semibold shrink-0">
                        <TriangleAlert className="w-3.5 h-3.5" /> Aviso médico
                      </span>
                    )}
                  </div>
                </div>
              </button>

              {abierta && (
                <div className={`px-3 pb-3.5 border-t pt-3 ${T.divider}`}>
                  <Dato T={T} icon={Droplet} label="Tipo de sangre" value={a.tipo_sangre} />
                  <Dato
                    T={T} icon={HeartPulse} label="Condición médica"
                    value={esSi(a.condicion_medica) ? (a.condicion_medica_detalle || 'Sí, sin detalle') : 'No'}
                    alerta={esSi(a.condicion_medica)}
                  />
                  <Dato
                    T={T} icon={TriangleAlert} label="Alergias"
                    value={esSi(a.alergias) ? (a.alergias_detalle || 'Sí, sin detalle') : 'No'}
                    alerta={esSi(a.alergias)}
                  />

                  <p className="text-[11px] font-bold uppercase tracking-wide text-[#E77622] mt-3 mb-1">
                    Contacto de emergencia
                  </p>
                  <Dato
                    T={T} icon={UserRound} label="Nombre"
                    value={[a.contacto_emergencia_nombre, a.contacto_emergencia_relacion].filter(Boolean).join(' · ')}
                  />

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
                      <Phone className="w-3.5 h-3.5" /> Su teléfono {a.telefono}
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {gente !== null && gente.length > 0 && (
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
