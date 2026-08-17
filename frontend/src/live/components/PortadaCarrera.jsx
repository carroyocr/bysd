import React from 'react';
import { raceStartMs, formatCountdown } from '../liveApi';

export const fechaLarga = (iso) => {
  if (!iso) return '';
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString('es-DO', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch {
    return iso;
  }
};

export const hora12 = (hhmm) => {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':');
  const hora = parseInt(h, 10);
  const ampm = hora >= 12 ? 'PM' : 'AM';
  const h12 = hora % 12 === 0 ? 12 : hora % 12;
  return `${h12}:${m} ${ampm}`;
};

// A dónde va cada quien después de esta pantalla. El botón grande es siempre
// la carrera —es a lo que se viene—; corredor y staff llevan además su puerta
// propia justo debajo.
export const PUERTA_PROPIA = {
  atleta: { ruta: '/live/perfil', texto: 'Ir a mi perfil' },
  staff: { ruta: '/live/staff', texto: 'Ir al panel del staff' },
};

export function estadoCarrera(carrera, ahora) {
  const salida = raceStartMs(carrera);
  const arrancada = salida != null && ahora >= salida;
  return {
    arrancada,
    terminada: !!carrera?.finished_at,
    faltan: !arrancada && salida != null ? formatCountdown(salida - ahora) : null,
  };
}

/**
 * La cuenta atrás con su halo.
 *
 * Va aparte del resto porque la lista de carreras la despliega sobre la ficha
 * que ya estaba en pantalla, sin volver a pintar el nombre: ahí el nombre lo
 * pone la propia ficha, que se queda.
 */
export function CuentaAtras({ carrera, ahora }) {
  const { arrancada, terminada, faltan } = estadoCarrera(carrera, ahora);

  return (
    <>
      <div className="relative mt-6 bysd-halo">
        <span
          className="absolute inset-0 -m-10 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(231,118,34,.22) 0%, transparent 68%)' }}
        />
        {arrancada && !terminada ? (
          <p className="relative text-5xl font-extralight tracking-tight text-white drop-shadow-[0_0_40px_rgba(74,222,128,0.4)]">
            EN VIVO
          </p>
        ) : faltan ? (
          <p className="relative text-[74px] leading-none font-extralight tracking-tight text-white drop-shadow-[0_0_40px_rgba(231,118,34,0.42)]">
            {faltan.split(' ')[0].replace(/[a-z]/g, '')}
            <em className="not-italic text-[22px] font-light text-[#E77622]">
              {faltan.split(' ')[0].replace(/[0-9]/g, '')}
            </em>
            {faltan.split(' ')[1] && (
              <span className="text-[34px] font-extralight text-white/80"> {faltan.split(' ')[1]}</span>
            )}
          </p>
        ) : (
          <p className="relative text-4xl font-extralight tracking-tight text-white">Finalizada</p>
        )}
      </div>

      <p
        className="bysd-entra mt-2.5 text-[10px] uppercase tracking-[0.3em] text-[#a49c8f]"
        style={{ animationDelay: '.35s' }}
      >
        {arrancada && !terminada ? 'la carrera está corriendo' : faltan ? 'para la salida' : 'gracias por correrla'}
      </p>
    </>
  );
}

/** El botón de entrar y, para corredor y staff, su puerta propia. */
export function PieCarrera({ alEntrar, puertaPropia, alIrAPuerta, retraso = '.85s' }) {
  return (
    <div className="mt-auto w-full bysd-entra" style={{ animationDelay: retraso }}>
      <button
        onClick={alEntrar}
        data-testid="ver-la-carrera"
        className="w-full rounded-full py-3.5 text-xs font-medium uppercase tracking-[0.24em]
          text-[#E77622] border border-[rgba(231,118,34,0.6)] bg-[rgba(231,118,34,0.10)]
          shadow-[0_0_26px_rgba(231,118,34,0.16)]
          transition-transform duration-100 ease-out active:scale-[0.985]"
      >
        Ver la carrera
      </button>

      {puertaPropia && (
        <button
          onClick={alIrAPuerta}
          className="w-full mt-3 py-2 text-[11px] uppercase tracking-[0.16em] text-[#a49c8f]"
        >
          {puertaPropia.texto}
        </button>
      )}
    </div>
  );
}

/**
 * La portada completa, para quien llega por enlace directo.
 *
 * El camino normal ya no pasa por aquí: la lista de carreras monta estas
 * mismas piezas alrededor de la ficha que ya estaba en pantalla. Compartir los
 * trozos es lo que impide que las dos versiones se separen con el tiempo.
 */
export default function PortadaCarrera({ carrera, ahora, alEntrar, puertaPropia, alIrAPuerta }) {
  return (
    <>
      <CuentaAtras carrera={carrera} ahora={ahora} />

      <p
        className="bysd-entra mt-8 text-sm font-normal uppercase tracking-[0.2em] leading-relaxed text-white"
        style={{ animationDelay: '.5s' }}
      >
        {carrera?.name || carrera?.code}
      </p>

      <p
        className="bysd-entra mt-2.5 text-[10.5px] uppercase tracking-[0.16em] text-[#a49c8f]"
        style={{ animationDelay: '.62s' }}
      >
        {fechaLarga(carrera?.date)}
        {carrera?.start_time ? ` · ${hora12(carrera.start_time)}` : ''}
      </p>

      {carrera?.location && (
        <p
          className="bysd-entra mt-1.5 text-[10.5px] uppercase tracking-[0.16em] text-[#6d655a]"
          style={{ animationDelay: '.7s' }}
        >
          {carrera.location}
        </p>
      )}

      <PieCarrera alEntrar={alEntrar} puertaPropia={puertaPropia} alIrAPuerta={alIrAPuerta} />
    </>
  );
}
