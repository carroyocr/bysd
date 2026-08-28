import React from 'react';
import { useRaceConfig } from '../contexts/RaceConfigContext';
import { getPresenting, ETIQUETA_PRESENTING } from '../lib/presenting';

// El bloque "PRESENTED BY <marca>" que acompaña al logo de la carrera en todo
// el sitio. Quién es esa marca sale de `lib/presenting.js`, por código de
// carrera: si la carrera no tiene naming, el componente no pinta nada.
//
// Sin `raceCode` usa la carrera pública (la del contexto). Las pantallas de la
// app en vivo sí lo pasan, porque ahí la carrera la manda la URL y no siempre
// es la pública.

const ALTURA_LOGO = {
  xs: 'h-4',
  sm: 'h-5',
  md: 'h-7',
  lg: 'h-9',
  xl: 'h-12',
};

const TAMANO_ETIQUETA = {
  xs: 'text-[8px] tracking-[0.12em]',
  sm: 'text-[9px] tracking-[0.14em]',
  md: 'text-[11px] tracking-[0.16em]',
  lg: 'text-xs tracking-[0.18em]',
  xl: 'text-sm tracking-[0.2em]',
};

const SEPARACION = {
  xs: 'gap-1.5',
  sm: 'gap-2',
  md: 'gap-2.5',
  lg: 'gap-3',
  xl: 'gap-4',
};

export default function PresentedBy({
  raceCode,
  size = 'sm',
  orientacion = 'fila',
  fondo = 'claro',
  enlace = false,
  className = '',
}) {
  const { config } = useRaceConfig();
  const marca = getPresenting(raceCode || config?.code);

  if (!marca) return null;

  const enColumna = orientacion === 'columna';
  const oscuro = fondo === 'oscuro';

  const etiqueta = (
    <span
      className={`font-semibold italic uppercase leading-none whitespace-nowrap ${
        TAMANO_ETIQUETA[size]
      } ${oscuro ? 'text-primary/90' : 'text-primary'}`}
    >
      {ETIQUETA_PRESENTING}
    </span>
  );

  // Sobre fondo oscuro el logo va en una placa blanca: el azul de la marca
  // desaparece contra el negro de la app y no existe versión en blanco.
  const logo = (
    <img
      src={marca.logo}
      alt={marca.descripcion}
      className={`${ALTURA_LOGO[size]} w-auto ${oscuro ? '' : 'object-contain'}`}
      loading="lazy"
    />
  );

  const logoConFondo = oscuro ? (
    <span className="inline-flex items-center rounded-md bg-white px-2 py-1.5">{logo}</span>
  ) : (
    logo
  );

  const logoFinal = enlace ? (
    <a
      href={marca.web}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={marca.descripcion}
      className="inline-flex items-center transition-opacity hover:opacity-80"
    >
      {logoConFondo}
    </a>
  ) : (
    logoConFondo
  );

  return (
    <div
      className={`flex ${enColumna ? 'flex-col items-center gap-1' : `items-center ${SEPARACION[size]}`} ${className}`}
      data-testid="presented-by"
    >
      {etiqueta}
      {!enColumna && (
        <span
          aria-hidden="true"
          className={`w-px self-stretch ${oscuro ? 'bg-white/25' : 'bg-border'}`}
        />
      )}
      {logoFinal}
    </div>
  );
}
