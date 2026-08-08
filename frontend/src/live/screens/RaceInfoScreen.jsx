import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Clock, MapPin, Repeat, ChevronRight, Info, Navigation } from 'lucide-react';
import { useLiveTheme } from '../liveTheme';
import { Screen, useRace } from '../LiveApp';
import { mapsUrlDe } from '../../content/eventInfo';
import { openExternal } from '../../lib/nativeExport';

const fmtDate = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString('es-DO', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch {
    return iso;
  }
};

/**
 * Información de la carrera: datos básicos de la edición seleccionada y el
 * formato backyard, con enlaces al sitio principal.
 */
export default function RaceInfoScreen() {
  const { T } = useLiveTheme();
  const { race, raceCode } = useRace();
  const navigate = useNavigate();
  const base = `/live/${(raceCode || '').toLowerCase()}`;

  const mapsUrl = mapsUrlDe(race?.location);
  const rows = [
    { Icon: CalendarDays, label: 'Fecha', value: fmtDate(race?.date) },
    { Icon: Clock, label: 'Hora de inicio', value: race?.start_time ? `${race.start_time} (hora RD)` : '—' },
    { Icon: MapPin, label: 'Lugar', value: race?.location || '—', mapsUrl },
    { Icon: Repeat, label: 'Formato', value: 'Vueltas de 6.7 km cada hora, hasta el Last One Standing' },
  ];

  // Secciones integradas dentro de la app (no salen de BYSD Live)
  const links = [
    { label: 'Reglas de la carrera', to: `${base}/reglas` },
    { label: 'Logística y llegada', to: `${base}/logistica` },
    { label: 'Preguntas frecuentes', to: `${base}/faq` },
  ];

  return (
    <Screen title="Información de la Carrera">
      <div className="px-4 py-4">
        <div className={`rounded-2xl p-4 mb-4 ${T.card}`}>
          <p className="text-base font-extrabold mb-3">{race?.name || 'Backyard Ultra Santo Domingo'}</p>
          {rows.map(({ Icon, label, value, mapsUrl: url }) => (
            <div key={label} className={`flex items-start gap-3 py-2.5 border-t ${T.divider}`}>
              <Icon className="w-5 h-5 text-[#E77622] shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className={`text-[10px] tracking-widest uppercase ${T.subtle}`}>{label}</p>
                <p className="text-sm font-semibold mt-0.5">{value}</p>
                {url && (
                  <button
                    onClick={() => openExternal(url)}
                    className="flex items-center gap-1.5 text-xs font-bold text-[#E77622] mt-1.5"
                  >
                    <Navigation className="w-3.5 h-3.5" /> Cómo llegar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className={`rounded-2xl p-4 mb-4 ${T.itraBox}`}>
          <p className="text-xs font-extrabold tracking-wider text-[#E77622] mb-2">¿CÓMO FUNCIONA UN BACKYARD ULTRA?</p>
          <p className={`text-sm leading-relaxed ${T.muted}`}>
            Cada hora en punto arranca una vuelta de 6.7 km. Quien no complete la vuelta a tiempo,
            o decida no salir a la siguiente, queda fuera (DNF). La carrera continúa hasta que
            solo una persona logre completar una vuelta más que el resto: el Last One Standing.
          </p>
        </div>

        <p className={`text-xs font-bold tracking-wider uppercase mb-2 ${T.subtle}`}>Más información</p>
        {links.map(({ label, to }) => (
          <button
            key={label}
            onClick={() => navigate(to)}
            className={`w-full flex items-center justify-between rounded-2xl px-4 py-3.5 mb-2.5 text-sm font-semibold text-left ${T.card}`}
          >
            <span className="flex items-center gap-3">
              <Info className="w-4 h-4 text-[#E77622]" /> {label}
            </span>
            <ChevronRight className={`w-4 h-4 ${T.subtle}`} />
          </button>
        ))}
      </div>
    </Screen>
  );
}
