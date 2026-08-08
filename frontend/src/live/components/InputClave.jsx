import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/**
 * Campo de contraseña con botón para verla.
 *
 * En un teléfono el teclado acierta poco y la contraseña se escribe a ciegas;
 * poder mirar lo que se ha tecleado evita el clásico "no me deja entrar" por
 * un dedazo. Se comparte entre las pantallas que crean una contraseña nueva
 * para que se comporten igual en todas.
 */
export default function InputClave({ T, value, onChange, autoComplete = 'new-password', ...resto }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
        className={`w-full rounded-xl pl-3 pr-11 py-2.5 text-sm outline-none ${T.input}`}
        {...resto}
      />
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        className={`absolute right-3 top-1/2 -translate-y-1/2 ${T.muted}`}
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}
