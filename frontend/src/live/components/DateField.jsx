import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { PickerSheet, Wheel } from './Picker';

// Selector de fecha compartido por todas las pantallas de la app: la fecha se
// elige con ruedas, no con el control nativo del navegador, que en el WebView
// se desborda de su columna y pisa el campo de al lado.

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];


export default function DateField({ T, value, onChange, fromYear, toYear, title = 'Fecha', claseBoton }) {
  const now = new Date();
  const startYear = fromYear ?? now.getFullYear() - 10;
  const endYear = toYear ?? 1930;
  const years = [];
  for (let i = startYear; i >= endYear; i--) years.push(String(i));

  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState({ y: '', m: '', d: '' });

  const openSheet = () => {
    const [y = '', m = '', d = ''] = (value || '').split('-');
    if (y) {
      setTemp({ y, m: String(parseInt(m, 10)), d: String(parseInt(d, 10)) });
    } else if (startYear >= now.getFullYear()) {
      // Fechas recientes (p. ej. fecha de pago): arranca en hoy
      setTemp({ y: String(now.getFullYear()), m: String(now.getMonth() + 1), d: String(now.getDate()) });
    } else {
      setTemp({ y: '1990', m: '6', d: '15' });
    }
    setOpen(true);
  };

  const daysInMonth = new Date(parseInt(temp.y || '2000', 10), parseInt(temp.m || '1', 10), 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));

  const confirm = () => {
    const d = Math.min(parseInt(temp.d || '1', 10), daysInMonth);
    onChange(`${temp.y}-${String(temp.m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    setOpen(false);
  };

  const label = value
    ? (() => {
        const [y, m, d] = value.split('-');
        return `${parseInt(d, 10)} de ${MESES[parseInt(m, 10) - 1]} de ${y}`;
      })()
    : 'Seleccionar fecha';

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        className={claseBoton || `w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm text-left ${T.input}`}
      >
        <span className={value ? '' : 'opacity-50'}>{label}</span>
        <ChevronDown className="w-4 h-4 opacity-60 shrink-0" />
      </button>
      {open && (
        <PickerSheet title={title} onClose={() => setOpen(false)} onConfirm={confirm}>
          <Wheel
            options={days}
            value={String(Math.min(parseInt(temp.d || '1', 10), daysInMonth))}
            onChange={(v) => setTemp((p) => ({ ...p, d: v }))}
          />
          <Wheel
            options={MESES.map((nombre, i) => ({ value: String(i + 1), label: nombre }))}
            value={temp.m}
            onChange={(v) => setTemp((p) => ({ ...p, m: v }))}
          />
          <Wheel
            options={years}
            value={temp.y}
            onChange={(v) => setTemp((p) => ({ ...p, y: v }))}
          />
        </PickerSheet>
      )}
    </>
  );
}
