import React from 'react';
import { CheckCircle2, AlertTriangle, Trophy, Ban, Leaf, Flag, Mountain } from 'lucide-react';
import { useLiveTheme } from '../liveTheme';
import { Screen } from '../LiveApp';
import { REGLAS } from '../../content/eventInfo';

function RuleCard({ T, Icon, title, items, danger = false, highlightLast = false }) {
  return (
    <div className={`rounded-2xl px-4 py-4 mb-4 ${T.card}`}>
      <h3 className={`text-sm font-bold flex items-center gap-2 mb-2 ${danger ? 'text-red-500' : ''}`}>
        <Icon className={`w-4 h-4 ${danger ? 'text-red-500' : 'text-[#E77622]'}`} /> {title}
      </h3>
      <ul className="space-y-2.5 mt-3">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${danger ? 'bg-red-500' : 'bg-[#E77622]'}`} />
            <span className={`text-sm leading-relaxed ${highlightLast && i === items.length - 1 ? 'font-bold text-red-500' : T.muted}`}>
              {item}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Reglas del Backyard Ultra dentro de la app, mismo contenido que el sitio. */
export default function ReglasScreen() {
  const { T } = useLiveTheme();

  return (
    <Screen title="Reglas de la carrera" back>
      <div className="px-4 py-4">
        <RuleCard T={T} Icon={CheckCircle2} title="Formato de carrera" items={REGLAS.formato} />
        <RuleCard T={T} Icon={AlertTriangle} title="Reglas obligatorias" items={REGLAS.obligatorias} />
        <RuleCard T={T} Icon={Trophy} title="Determinación del ganador" items={REGLAS.ganador} />
        <RuleCard T={T} Icon={Ban} title="Prohibiciones" items={REGLAS.prohibiciones} danger />
        <RuleCard T={T} Icon={CheckCircle2} title="Deportividad y conducta" items={REGLAS.deportividad} />
        <RuleCard T={T} Icon={Leaf} title="Protección ambiental (Leave No Trace)" items={REGLAS.ambiental} highlightLast />
        <RuleCard T={T} Icon={Flag} title="Señalización del circuito" items={REGLAS.senalizacion} />
        <RuleCard T={T} Icon={Mountain} title="Terreno del circuito" items={REGLAS.terreno} />
      </div>
    </Screen>
  );
}
