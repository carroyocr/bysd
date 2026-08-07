import React, { useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { useLiveTheme } from '../liveTheme';

/**
 * Selector con el diseño de la app: botón estilo input que abre una hoja
 * inferior oscura con las opciones. Sustituye al <select> nativo, cuyo
 * desplegable del sistema desentona con el tema.
 *
 * options: array de strings o de objetos { value, label }.
 */
export default function Picker({ value, onSelect, options, placeholder = 'Selecciona', title }) {
  const { T } = useLiveTheme();
  const [open, setOpen] = useState(false);

  const opts = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  const current = opts.find((o) => o.value === value);

  const choose = (v) => {
    onSelect(v);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm text-left ${T.input}`}
      >
        <span className={`truncate ${current ? '' : 'opacity-50'}`}>
          {current ? current.label : placeholder}
        </span>
        <ChevronDown className="w-4 h-4 opacity-60 shrink-0" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div
            className={`absolute bottom-0 left-0 right-0 max-w-md mx-auto rounded-t-2xl flex flex-col max-h-[65dvh] pb-[env(safe-area-inset-bottom)] ${T.drawer}`}
          >
            <div className={`flex items-center justify-between px-4 py-3.5 border-b shrink-0 ${T.divider}`}>
              <p className="text-sm font-bold">{title || placeholder}</p>
              <button aria-label="Cerrar" onClick={() => setOpen(false)} className="w-8 h-8 flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto">
              {opts.map(({ value: v, label }) => {
                const selected = v === value;
                return (
                  <button
                    key={v}
                    onClick={() => choose(v)}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left text-sm border-b last:border-b-0 ${T.divider} ${selected ? 'font-bold text-[#E77622]' : ''}`}
                  >
                    {label}
                    {selected && <Check className="w-4 h-4 shrink-0 text-[#E77622]" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
