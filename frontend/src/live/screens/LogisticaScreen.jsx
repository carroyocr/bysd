import React from 'react';
import {
  MapPin, Car, Tent, Bed, Utensils, Droplet, TreePine, ExternalLink,
} from 'lucide-react';
import { useLiveTheme } from '../liveTheme';
import { Screen } from '../LiveApp';
import { LOGISTICA } from '../../content/eventInfo';
import { openExternal } from '../../lib/nativeExport';

const ICONS = { MapPin, Car, Tent, Bed, Utensils, Droplet };

/** Logística e instalaciones dentro de la app, mismo contenido que el sitio. */
export default function LogisticaScreen() {
  const { T } = useLiveTheme();

  return (
    <Screen title="Logística y llegada" back>
      <div className="px-4 py-4">
        {LOGISTICA.instalaciones.map(({ icon, title, items, link }) => {
          const Icon = ICONS[icon] || MapPin;
          return (
            <div key={title} className={`rounded-2xl px-4 py-4 mb-4 ${T.card}`}>
              <h3 className="text-sm font-bold flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4 text-[#E77622]" /> {title}
              </h3>
              <ul className="space-y-2 mt-3">
                {items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#E77622] mt-1.5 shrink-0" />
                    <span className={`text-sm leading-relaxed ${T.muted}`}>{item}</span>
                  </li>
                ))}
              </ul>
              {link && (
                <button
                  onClick={() => openExternal(link)}
                  className="flex items-center gap-1.5 text-xs font-bold text-[#E77622] mt-3"
                >
                  Ver en Google Maps <ExternalLink className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}

        <div className={`rounded-2xl px-4 py-4 mb-4 ${T.card}`}>
          <h3 className="text-sm font-bold flex items-center gap-2 mb-2">
            <Droplet className="w-4 h-4 text-[#E77622]" /> Baños y agua potable
          </h3>
          <ul className="space-y-2 mt-3">
            {LOGISTICA.banos.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#E77622] mt-1.5 shrink-0" />
                <span className={`text-sm leading-relaxed ${T.muted}`}>{item}</span>
              </li>
            ))}
          </ul>
          <div className={`rounded-xl px-3 py-3 mt-3 ${T.itraBox}`}>
            <p className={`text-xs leading-relaxed ${T.muted}`}>
              <strong>Importante:</strong> los atletas son responsables de mantener su área
              limpia y organizada. Puntos de eliminación de basura disponibles en todo el sitio.
            </p>
          </div>
        </div>

        <div className={`rounded-2xl px-4 py-4 mb-4 ${T.card}`}>
          <h3 className="text-sm font-bold flex items-center gap-2 mb-2">
            <TreePine className="w-4 h-4 text-[#E77622]" /> Acompañantes y equipo de apoyo
          </h3>
          <ul className="space-y-2 mt-3">
            {LOGISTICA.acompanantes.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#E77622] mt-1.5 shrink-0" />
                <span className={`text-sm leading-relaxed ${T.muted}`}>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          {[['2', 'Puntos de control'], ['150', 'Banderas'], ['24/7', 'Supervisión']].map(([n, label]) => (
            <div key={label} className={`rounded-2xl px-2 py-4 text-center ${T.card}`}>
              <p className="text-2xl font-extrabold text-[#E77622]">{n}</p>
              <p className={`text-[10px] mt-1 ${T.muted}`}>{label}</p>
            </div>
          ))}
        </div>

        <div className={`rounded-2xl px-4 py-4 ${T.itraBox}`}>
          <p className={`text-xs leading-relaxed ${T.muted}`}>
            Se recomienda previsualizar el circuito el día anterior, solo cuando esté autorizado
            por la organización, a pie y sin alterar la señalización. Este evento es sin fines de
            lucro y la preservación ambiental es una prioridad.
          </p>
        </div>
      </div>
    </Screen>
  );
}
