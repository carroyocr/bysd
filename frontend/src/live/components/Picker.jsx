import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { useLiveTheme } from '../liveTheme';

const ITEM_H = 40; // alto de cada fila del rodillo
const WHEEL_H = 200; // 5 filas visibles
const PAD = (WHEEL_H - ITEM_H) / 2;

/**
 * Rodillo de opciones (estilo rueda de iOS pero con el tema de la app):
 * columna desplazable con imán al centro; la fila central es la elegida.
 */
export function Wheel({ options, value, onChange }) {
  const { T } = useLiveTheme();
  const ref = useRef(null);
  const timer = useRef(null);
  const opts = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  const [idx, setIdx] = useState(() => Math.max(0, opts.findIndex((o) => o.value === value)));

  useEffect(() => {
    const i = Math.max(0, opts.findIndex((o) => o.value === value));
    setIdx(i);
    if (ref.current) ref.current.scrollTop = i * ITEM_H;
    // eslint-disable-next-line
  }, []);

  const onScroll = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!ref.current) return;
      const i = Math.min(opts.length - 1, Math.max(0, Math.round(ref.current.scrollTop / ITEM_H)));
      setIdx(i);
      ref.current.scrollTo({ top: i * ITEM_H, behavior: 'smooth' });
      onChange(opts[i].value);
    }, 120);
  };

  const pick = (i) => {
    setIdx(i);
    ref.current?.scrollTo({ top: i * ITEM_H, behavior: 'smooth' });
    onChange(opts[i].value);
  };

  return (
    <div className="relative flex-1 min-w-0" style={{ height: WHEEL_H }}>
      {/* Banda central que marca la fila elegida */}
      <div
        className={`absolute inset-x-1 top-1/2 -translate-y-1/2 rounded-xl pointer-events-none ${T.itraBox}`}
        style={{ height: ITEM_H }}
      />
      <div
        ref={ref}
        onScroll={onScroll}
        className="h-full overflow-y-scroll no-scrollbar relative"
        style={{ scrollSnapType: 'y mandatory' }}
      >
        <div style={{ height: PAD }} />
        {opts.map(({ value: v, label }, i) => (
          <button
            key={v}
            onClick={() => pick(i)}
            className={`w-full flex items-center justify-center px-1 transition-colors ${
              i === idx ? 'text-[#E77622] font-extrabold text-[15px]' : `${T.muted} text-sm`
            }`}
            style={{ height: ITEM_H, scrollSnapAlign: 'center' }}
          >
            <span className="truncate">{label}</span>
          </button>
        ))}
        <div style={{ height: PAD }} />
      </div>
    </div>
  );
}

/** Hoja inferior con título, contenido (rodillos) y botón de confirmar. */
export function PickerSheet({ title, onClose, onConfirm, children }) {
  const { T } = useLiveTheme();
  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className={`absolute bottom-0 left-0 right-0 max-w-md mx-auto rounded-t-2xl flex flex-col pb-[calc(0.75rem+env(safe-area-inset-bottom))] ${T.drawer}`}>
        <div className={`flex items-center justify-between px-4 py-3.5 border-b shrink-0 ${T.divider}`}>
          <p className="text-sm font-bold">{title}</p>
          <button aria-label="Cerrar" onClick={onClose} className="w-8 h-8 flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-1 px-3 py-2">{children}</div>
        <div className="px-4 pt-1">
          <button
            onClick={onConfirm}
            className="w-full bg-[#E77622] hover:bg-[#d96a1a] text-white font-bold rounded-xl py-3 text-sm transition-colors"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Selector de una opción con el diseño de la app: botón estilo input que
 * abre una hoja inferior con un rodillo. Sustituye al <select> nativo.
 * options: array de strings o de objetos { value, label }.
 */
export default function Picker({ value, onSelect, options, placeholder = 'Selecciona', title }) {
  const { T } = useLiveTheme();
  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState(value);

  const opts = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  const current = opts.find((o) => o.value === value);

  const openSheet = () => {
    setTemp(value || opts[0]?.value);
    setOpen(true);
  };

  const confirm = () => {
    onSelect(temp ?? opts[0]?.value);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm text-left ${T.input}`}
      >
        <span className={`truncate ${current ? '' : 'opacity-50'}`}>
          {current ? current.label : placeholder}
        </span>
        <ChevronDown className="w-4 h-4 opacity-60 shrink-0" />
      </button>

      {open && (
        <PickerSheet title={title || placeholder} onClose={() => setOpen(false)} onConfirm={confirm}>
          <Wheel options={opts} value={temp} onChange={setTemp} />
        </PickerSheet>
      )}
    </>
  );
}
