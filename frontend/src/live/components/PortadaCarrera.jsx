import React from 'react';
import { raceStartMs, formatCountdown } from '../liveApi';

const fechaLarga = (iso) => {
  if (!iso) return '';
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString('es-DO', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch {
    return iso;
  }
};

const hora12 = (hhmm) => {
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

/**
 * La carrera elegida: cuenta atrás, nombre, fecha y la puerta de entrada.
 *
 * Vive aparte porque lo usan dos sitios: la ruta `/live/portada/:code`, para
 * quien llega por un enlace, y la propia lista de carreras, que ahora lo
 * despliega en el mismo sitio en vez de saltar a otra pantalla. Teniendo el
 * mismo componente detrás, las dos no pueden separarse con el tiempo.
 *
 * Aparece escalonado de arriba abajo: es el momento en que la app deja de
 * preguntar y empieza a contar.
 */
export default function PortadaCarrera({ carrera, ahora, alEntrar, puertaPropia, alIrAPuerta }) {
  const salida = raceStartMs(carrera);
  const arrancada = salida != null && ahora >= salida;
  const terminada = !!carrera?.finished_at;
  const faltan = !arrancada && salida != null ? formatCountdown(salida - ahora) : null;

  return (
    <>
      {/* El número, con su halo. Es lo primero que aparece y lo único que
          respira: llamar la atención una vez es un gesto. */}
      <div className="relative mt-10 bysd-halo">
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

      <div className="mt-auto w-full bysd-entra" style={{ animationDelay: '.85s' }}>
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
    </>
  );
}
