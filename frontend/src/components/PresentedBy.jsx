import React from 'react';
import { useRaceConfig } from '../contexts/RaceConfigContext';
import { getPresenting, logoPara, ETIQUETA_PRESENTING } from '../lib/presenting';

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
      } ${oscuro ? 'text-primary drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]' : 'text-primary'}`}
    >
      {ETIQUETA_PRESENTING}
    </span>
  );

  // Cada fondo lleva su versión de la marca: la de color sobre claro y la
  // blanca sobre oscuro. Antes, a falta de versión en blanco, el logo iba
  // sobre una placa blanca; con el arte en blanco el logo se apoya directo en
  // el fondo, que es como está pensada la marca.
  const logo = (
    <img
      src={logoPara(marca, { oscuro })}
      alt={marca.descripcion}
      className={`${ALTURA_LOGO[size]} w-auto object-contain`}
    />
  );

  const logoFinal = enlace ? (
    <a
      href={marca.web}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={marca.descripcion}
      className="inline-flex items-center transition-opacity hover:opacity-80"
    >
      {logo}
    </a>
  ) : (
    logo
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
