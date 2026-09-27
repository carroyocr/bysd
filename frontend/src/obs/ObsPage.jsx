import React, { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import useTransmision, { horaCorta, reloj } from './useTransmision';
import './obs.css';

/**
 * Las vistas que se enlazan en OBS como "Fuente de navegador".
 *
 * Son páginas sueltas, sin menú ni pie y con el fondo transparente, porque
 * debajo va el video. Todo lo que cambia (carrera, clave, tema) viaja en la
 * dirección: OBS solo sabe abrir una dirección, no tiene dónde configurar
 * nada. El panel arma esas direcciones y las da para copiar.
 *
 *   /obs/barra?clave=...&race=BYSD-2027
 *   /obs/crono?clave=...
 *   /obs/clasificacion?clave=...&filas=10
 */
export default function ObsPage() {
  const { vista } = useParams();
  const [params] = useSearchParams();
  const clave = params.get('clave') || '';
  const raceCode = params.get('race') || '';
  const fondo = params.get('fondo') || '';
  const filas = Math.max(1, Math.min(Number(params.get('filas')) || 10, 20));

  // El fondo del sitio es claro; aquí estorba. OBS deja pasar lo que sea
  // transparente, así que el body tiene que serlo también.
  useEffect(() => {
    const previo = document.body.style.background;
    document.body.style.background = 'transparent';
    return () => { document.body.style.background = previo; };
  }, []);

  const { datos, error, anuncio, cuentaAtras, esperandoSalida } = useTransmision({
    clave, raceCode, clasificacion: filas,
  });

  const clases = `obs-raiz${fondo ? ` obs-fondo-${fondo}` : ''}`;

  if (!clave) {
    return (
      <div className={clases}>
        <div className="obs-aviso">Falta la clave de transmisión en la dirección.</div>
      </div>
    );
  }

  if (error || !datos) {
    return (
      <div className={clases}>
        {error && <div className="obs-aviso">{error}</div>}
      </div>
    );
  }

  const { totales, reloj: r, clasificacion } = datos;

  // Cuánto se lleva andado de la vuelta, para la línea de progreso
  const duracion = (datos.carrera.minutos_por_vuelta || 60) * 60;
  const avance = r.empezada && cuentaAtras !== null
    ? Math.max(0, Math.min(1, (duracion - cuentaAtras) / duracion))
    : 0;

  const etiquetaCrono = esperandoSalida ? 'Salida en' : r.terminada ? 'Carrera terminada' : 'Próxima vuelta en';

  if (vista === 'crono') {
    return (
      <div className={clases}>
        <div className="obs-crono-suelto">
          <div className="obs-etiqueta">{etiquetaCrono}</div>
          <div className="obs-digitos">{r.terminada ? '--:--' : reloj(cuentaAtras)}</div>
        </div>
      </div>
    );
  }

  if (vista === 'clasificacion') {
    return (
      <div className={clases}>
        <div className="obs-clasificacion">
          <h2>Clasificación · Vuelta {r.vuelta}</h2>
          {clasificacion.map((c, i) => (
            <div key={c.bib} className={`obs-fila${['retired', 'dns'].includes(c.status) ? ' obs-fuera' : ''}`}>
              <span className="obs-puesto">{i + 1}</span>
              <span className="obs-bib">{c.bib}</span>
              <span className="obs-nombre">{`${c.nombre} ${c.apellidos}`.trim()}</span>
              <span className="obs-vueltas">{c.vueltas}</span>
              <span className="obs-km">{c.km.toFixed(1)} km</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={clases}>
      {anuncio ? (
        <div className="obs-barra obs-entra" key={anuncio.id}>
          <div className="obs-dorsal">{anuncio.bib}</div>
          <div className="obs-atleta">
            <div className="obs-atleta-vuelta">Completa la vuelta {anuncio.vuelta}</div>
            <div className="obs-atleta-nombre">{anuncio.nombre}</div>
          </div>
          <div className="obs-datos" style={{ flex: '0 0 auto' }}>
            <div className="obs-dato">
              <div className="obs-etiqueta">Vuelta</div>
              <div className="obs-valor">{reloj(anuncio.duracion_seg)}</div>
            </div>
            <div className="obs-dato">
              <div className="obs-etiqueta">Vueltas</div>
              <div className="obs-valor">{anuncio.vuelta}</div>
            </div>
            <div className="obs-dato">
              <div className="obs-etiqueta">Km</div>
              <div className="obs-valor">{anuncio.km}</div>
            </div>
          </div>
          <div className="obs-crono-barra">
            <div className="obs-etiqueta">Descanso</div>
            <div className="obs-valor">{reloj(cuentaAtras)}</div>
          </div>
        </div>
      ) : (
        <div className="obs-barra">
          <div className="obs-rotulo">EN VIVO</div>
          <div className="obs-datos">
            <div className="obs-dato">
              <div className="obs-etiqueta">Inicio</div>
              <div className="obs-valor">{horaCorta(r.hora_inicio)}</div>
            </div>
            <div className="obs-dato">
              <div className="obs-etiqueta">Vuelta</div>
              <div className="obs-valor">{r.vuelta}</div>
            </div>
            <div className="obs-dato">
              <div className="obs-etiqueta">Km recorridos</div>
              <div className="obs-valor">{totales.km_recorridos}</div>
            </div>
            <div className="obs-dato">
              <div className="obs-etiqueta">En carrera</div>
              <div className="obs-valor">{totales.en_carrera}</div>
            </div>
            <div className="obs-dato">
              <div className="obs-etiqueta">DNS</div>
              <div className="obs-valor">{totales.dns}</div>
            </div>
          </div>
          <div className="obs-crono-barra">
            <div className="obs-etiqueta">{etiquetaCrono}</div>
            <div className="obs-valor">{r.terminada ? '--:--' : reloj(cuentaAtras)}</div>
          </div>
          <div className="obs-progreso" style={{ width: `${avance * 100}%` }} />
        </div>
      )}
    </div>
  );
}
