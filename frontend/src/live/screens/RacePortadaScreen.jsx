import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { getJson } from '../liveApi';
import { clic } from '../sonido';
import { rolElegido } from '../sesion';
import PortadaCarrera, { PUERTA_PROPIA } from '../components/PortadaCarrera';

/**
 * La carrera elegida, cuando se llega por enlace directo.
 *
 * El camino normal ya no pasa por aquí: la lista de carreras despliega esta
 * misma portada en su propio sitio, con una transición, para que las dos se
 * lean como una sola pantalla. Esta ruta se queda para los enlaces y para el
 * botón de atrás, y usa el mismo componente para que no puedan separarse.
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

  const propia = PUERTA_PROPIA[rolElegido()] || null;

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
          <PortadaCarrera
            carrera={{ ...carrera, code: carrera.code || raceCode }}
            ahora={ahora}
            alEntrar={() => { clic(); navigate(`/live/${raceCode}`); }}
            puertaPropia={propia}
            alIrAPuerta={() => { clic(); navigate(propia.ruta); }}
          />
        )}
      </div>
    </div>
  );
}
