import React from 'react';

/** Cuántos segundos antes de la salida aparece el primer globo. */
export const AVISO_SEG = 180;

/**
 * El globo de aviso de los últimos tres minutos: qué color toca y cuánto
 * queda de él, a partir de los segundos que faltan para la salida.
 *
 * Es un disco lleno al que se le va comiendo un sector en sentido contrario a
 * las agujas del reloj: a 3:00 aparece entero el amarillo y a 2:00 no queda
 * nada de él; ahí entra entero el naranja, y a 1:00 el rojo. `fraccion` es lo
 * que queda del minuto en curso, de 1 a 0.
 *
 * Fuera de esos tres minutos (o sin cuenta) devuelve null: no hay globo.
 */
export function globoDe(segundos) {
  if (segundos === null || segundos === undefined || Number.isNaN(segundos)) return null;
  if (segundos <= 0 || segundos > AVISO_SEG) return null;
  const minuto = Math.ceil(segundos / 60); // 3, 2 o 1
  const dentro = segundos - (minuto - 1) * 60; // de 60 a 1 dentro del minuto
  return {
    minuto,
    color: minuto === 3 ? 'amarillo' : minuto === 2 ? 'naranja' : 'rojo',
    fraccion: dentro / 60,
  };
}

/**
 * El reloj de una salida forzada desde la dirección (`&inicio=…`), para
 * ensayar la pantalla la víspera sin tocar la carrera ni dar la salida de
 * verdad. Devuelve lo mismo que `reloj` del backend, calculado aquí.
 */
export function relojForzado(inicioIso, minutosPorVuelta, ahoraMs) {
  const inicio = new Date(inicioIso).getTime();
  if (Number.isNaN(inicio)) return null;
  const duracion = (minutosPorVuelta || 60) * 60 * 1000;
  if (ahoraMs < inicio) {
    return {
      vuelta: 0,
      empezada: false,
      terminada: false,
      hora_inicio: new Date(inicio).toISOString(),
      fin_de_vuelta: new Date(inicio + duracion).toISOString(),
    };
  }
  const vuelta = Math.floor((ahoraMs - inicio) / duracion) + 1;
  return {
    vuelta,
    empezada: true,
    terminada: false,
    hora_inicio: new Date(inicio).toISOString(),
    fin_de_vuelta: new Date(inicio + vuelta * duracion).toISOString(),
  };
}

/**
 * El globo pintado. No devuelve nada fuera de los últimos tres minutos, así
 * que se puede dejar puesto siempre y aparece solo cuando toca.
 */
export default function Globo({ segundos, className = '' }) {
  const g = globoDe(segundos);
  if (!g) return null;
  return (
    <div
      className={`obs-globo obs-globo-${g.color} ${className}`.trim()}
      style={{ '--ang': `${(g.fraccion * 360).toFixed(1)}deg` }}
      data-testid="obs-globo"
    >
      <div className="obs-globo-ficha">{g.minuto}</div>
    </div>
  );
}
