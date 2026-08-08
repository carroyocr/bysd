import React, { useState } from 'react';
import { Phone, Save, ShieldAlert, X } from 'lucide-react';
import { SOS_CONTACT_KEY } from '../liveApi';
import { useLiveTheme } from '../liveTheme';
import { Screen } from '../LiveApp';

/**
 * SOS: contacto de emergencia guardado en el dispositivo y llamada directa.
 */
export default function SosScreen() {
  const { T } = useLiveTheme();
  const [contact, setContact] = useState(() => localStorage.getItem(SOS_CONTACT_KEY) || '');
  const [draft, setDraft] = useState(contact);
  const [showWhy, setShowWhy] = useState(!contact);
  const [saved, setSaved] = useState(false);

  const save = () => {
    const clean = draft.replace(/[^+\d]/g, '');
    localStorage.setItem(SOS_CONTACT_KEY, clean);
    setContact(clean);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <Screen title="SOS" back>
      <div className="px-4 py-5">
        <div className={`rounded-2xl p-4 mb-4 ${T.card}`}>
          <p className={`text-xs font-bold tracking-wider uppercase mb-2 ${T.subtle}`}>Contacto de emergencia</p>
          <p className={`text-xs mb-3 ${T.muted}`}>
            Guarda un número de confianza en este dispositivo para llamarlo con un toque durante el evento.
          </p>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            inputMode="tel"
            placeholder="+1 809 555 0000"
            className={`w-full rounded-xl px-3 py-3 text-sm mb-2.5 ${T.input}`}
          />
          <button
            onClick={save}
            disabled={!draft.trim()}
            className="w-full rounded-xl py-2.5 text-sm font-bold bg-[#E77622] text-white flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> Guardar
          </button>
          {saved && <p className="text-xs text-green-500 mt-2">Contacto guardado en este dispositivo.</p>}
        </div>

        {contact && (
          <a
            href={`tel:${contact}`}
            className="w-full rounded-xl py-3.5 mb-3 text-sm font-bold bg-red-600 text-white flex items-center justify-center gap-2"
          >
            <Phone className="w-4 h-4" /> Llamar a mi contacto ({contact})
          </a>
        )}

        <a
          href="tel:911"
          className={`w-full rounded-xl py-3.5 text-sm font-bold flex items-center justify-center gap-2 border-2 border-red-600 text-red-600 ${T.card}`}
        >
          <ShieldAlert className="w-4 h-4" /> Llamar al 911
        </a>

        <button onClick={() => setShowWhy(true)} className="w-full mt-6 text-xs font-bold text-[#E77622]">
          ¿Por qué SOS?
        </button>
      </div>

      {showWhy && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-6" onClick={() => setShowWhy(false)}>
          <div className={`rounded-2xl p-5 max-w-sm w-full relative ${T.card}`} onClick={(e) => e.stopPropagation()}>
            <button
              aria-label="Cerrar"
              onClick={() => setShowWhy(false)}
              className="absolute top-3 right-3"
            >
              <X className="w-5 h-5 text-red-500" />
            </button>
            <p className="text-base font-extrabold text-center mb-3">¿Por qué SOS?</p>
            <p className={`text-sm leading-relaxed text-center ${T.muted}`}>
              Configurar SOS te ayuda en una emergencia durante el evento.
              Guarda el número de una persona de confianza y podrás llamarla en
              cualquier momento tocando el botón SOS de la barra superior.
            </p>
          </div>
        </div>
      )}
    </Screen>
  );
}
