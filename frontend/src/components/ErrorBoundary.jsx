import React from 'react';
import { isNative } from '../lib/platform';

/**
 * Red de seguridad de la interfaz.
 *
 * Sin esto, un error de renderizado desmonta el árbol entero de React y deja
 * la pantalla en blanco —negra en la app, que va sobre fondo oscuro— sin decir
 * nada: ni el usuario sabe qué pasó ni nosotros qué falló. Aquí al menos se
 * explica, se ofrece una salida y se enseña el error en pequeño, que es lo que
 * hace falta cuando alguien manda una captura para reportarlo.
 *
 * El detalle va abajo y en letra menuda a propósito: quien no lo necesita no
 * lo lee, y quien lo necesita lo tiene.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Queda en el registro del navegador (y en el log del teléfono, que es
    // por donde se puede leer en la app instalada).
    console.error('Fallo de la interfaz:', error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    // La app siempre vuelve a su propio inicio; el sitio, a la portada.
    const inicio = isNative() ? '/live' : '/';

    return (
      <div className="min-h-[100dvh] bg-[#0C0C0C] text-white flex flex-col items-center justify-center px-8 text-center">
        <h1 className="text-xl font-extrabold">Algo salió mal</h1>

        <p className="mt-3 text-sm text-[#9a9a9a] leading-relaxed max-w-xs">
          La pantalla no se pudo mostrar. Vuelve al inicio y prueba otra vez.
        </p>

        <button
          onClick={() => { window.location.href = inicio; }}
          className="mt-7 rounded-2xl bg-[#E77622] text-white font-bold px-8 py-3.5 text-sm"
        >
          Volver al inicio
        </button>

        <p className="mt-8 text-[10px] font-mono text-[#5a5a5a] break-words max-w-xs">
          {String(error?.message || error)}
        </p>
      </div>
    );
  }
}
