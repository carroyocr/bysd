import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { getJson, raceStartMs, formatCountdown } from '../liveApi';
import { clic } from '../sonido';
import { rolElegido, ESPECTADOR } from '../sesion';


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
const PUERTA_PROPIA = {
  atleta: { ruta: '/live/perfil', texto: 'Ir a mi perfil' },
  staff: { ruta: '/live/staff', texto: 'Ir al panel del staff' },
};

/**
 * La carrera elegida, antes de entrar en ella.
 *
 * Aquí es donde la cuenta atrás significa algo: ya hay una carrera concreta
 * detrás del número. Aparece animada, escalonada de arriba abajo, porque es
 * el momento en que la app deja de preguntar y empieza a contar.
 *
 * Sin barra ni menú, como la pantalla de acceso: son las dos puertas de
 * entrada y en ninguna hay nada que consultar.
 */
export default function RacePortadaScreen() {
  const { raceCode } = useParams();
  const navigate = useNavigate();
  const [carrera, setCarrera] = useState(null);
  const [ahora, setAhora] = useState(Date.now());

  useEffect(() => {
    let cancel = false;
    getJson(`/api/race-config/${raceCode}`)
      .then((d) => { if (!cancel) setCarrera(d); })
      .catch(() => { if (!cancel) setCarrera({}); });
    return () => { cancel = true; };
  }, [raceCode]);

  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  const salida = raceStartMs(carrera);
  const arrancada = salida != null && ahora >= salida;
  const terminada = !!carrera?.finished_at;
  const faltan = !arrancada && salida != null ? formatCountdown(salida - ahora) : null;
  const propia = PUERTA_PROPIA[rolElegido()] || null;

  const entrar = () => { clic(); navigate(`/live/${raceCode}`); };

  return (
    <div
      className="min-h-[100dvh] flex flex-col items-center text-center text-[#EFE9DD]"
      style={{
        background:
          'radial-gradient(90% 55% at 50% -8%, rgba(231,118,34,.30) 0%, rgba(231,118,34,.06) 45%, transparent 72%),'
          + 'radial-gradient(70% 45% at 50% 108%, rgba(133,183,235,.10) 0%, transparent 70%),'
          + '#070707',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div className="w-full max-w-md px-7 pb-10 pt-[calc(1.25rem+env(safe-area-inset-top))] flex flex-col items-center flex-1">
        <button
          onClick={() => { clic(); navigate('/live/carreras'); }}
          className="self-start p-2 -ml-2 text-[#a49c8f]"
          aria-label="Volver a las carreras"
        >
          <ArrowLeft className="w-5 h-5" strokeWidth={1.6} />
        </button>

        {!carrera ? (
          <div className="flex-1 flex items-center text-[#a49c8f]">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <>
            {/* El número, con su halo. Es lo primero que aparece y lo único
                que respira: llamar la atención una vez es un gesto. */}
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
              {carrera.name || raceCode}
            </p>

            <p
              className="bysd-entra mt-2.5 text-[10.5px] uppercase tracking-[0.16em] text-[#a49c8f]"
              style={{ animationDelay: '.62s' }}
            >
              {fechaLarga(carrera.date)}
              {carrera.start_time ? ` · ${hora12(carrera.start_time)}` : ''}
            </p>

            {carrera.location && (
              <p
                className="bysd-entra mt-1.5 text-[10.5px] uppercase tracking-[0.16em] text-[#6d655a]"
                style={{ animationDelay: '.7s' }}
              >
                {carrera.location}
              </p>
            )}

            <div className="mt-auto w-full bysd-entra" style={{ animationDelay: '.85s' }}>
              <button
                onClick={entrar}
                data-testid="ver-la-carrera"
                className="w-full rounded-full py-3.5 text-xs font-medium uppercase tracking-[0.24em]
                  text-[#E77622] border border-[rgba(231,118,34,0.6)] bg-[rgba(231,118,34,0.10)]
                  shadow-[0_0_26px_rgba(231,118,34,0.16)]
                  transition-transform duration-100 ease-out active:scale-[0.985]"
              >
                Ver la carrera
              </button>

              {propia && (
                <button
                  onClick={() => { clic(); navigate(propia.ruta); }}
                  className="w-full mt-3 py-2 text-[11px] uppercase tracking-[0.16em] text-[#a49c8f]"
                >
                  {propia.texto}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
