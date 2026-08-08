import React, { useState } from 'react';
import { HelpCircle, ChevronDown } from 'lucide-react';
import { useLiveTheme } from '../liveTheme';
import { Screen } from '../LiveApp';
import { FAQS } from '../../content/eventInfo';

/** Preguntas frecuentes dentro de la app, mismo contenido que el sitio. */
export default function FaqScreen() {
  const { T } = useLiveTheme();
  const [open, setOpen] = useState(null);

  return (
    <Screen title="Preguntas frecuentes" back>
      <div className="px-4 py-4">
        <div className={`rounded-2xl ${T.card}`}>
          {FAQS.map(({ question, answer }, i) => (
            <div key={i} className={`${i < FAQS.length - 1 ? `border-b ${T.divider}` : ''}`}>
              <button
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
                className="w-full flex items-start gap-3 px-4 py-3.5 text-left"
              >
                <HelpCircle className="w-4 h-4 text-[#E77622] shrink-0 mt-0.5" />
                <span className="flex-1 text-sm font-semibold leading-snug">{question}</span>
                <ChevronDown className={`w-4 h-4 shrink-0 mt-0.5 transition-transform ${open === i ? 'rotate-180' : ''} ${T.subtle}`} />
              </button>
              {open === i && (
                <p className={`px-11 pb-4 text-sm leading-relaxed ${T.muted}`}>{answer}</p>
              )}
            </div>
          ))}
        </div>
        <p className={`text-xs text-center mt-6 ${T.muted}`}>
          ¿No encontraste la respuesta que buscabas? Contáctanos y con gusto te ayudamos.
        </p>
      </div>
    </Screen>
  );
}
