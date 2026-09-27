import React, { useEffect, useLayoutEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import useTransmision, { horaCorta, reloj } from './useTransmision';
import usePatrocinadores, { urlLogo } from './usePatrocinadores';
import useCharla from './useCharla';
import './obs.css';

/**
 * Las vistas que se enlazan en OBS como "Fuente de navegador".
 *
 * Son páginas sueltas, sin menú ni pie y con el fondo transparente, porque
 * debajo va el video. Todo lo que cambia (carrera, clave, filas) viaja en la
 * dirección: OBS solo sabe abrir una dirección, no tiene dónde configurar
 * nada. El panel arma esas direcciones y las da para copiar.
 *
 *   /obs/barra?clave=...&race=BYSD-2027
 *   /obs/crono?clave=...
 *   /obs/clasificacion?clave=...&filas=10
 *   /obs/patrocinadores?clave=...
 *   /obs/charla?actividad=<id>&race=BYSD-2027   (sin clave: no lleva datos de carrera)
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

  // El lienzo mide 1920x1080 siempre y se encoge entero para caber en la
  // ventana. En OBS, que abre justo a esa medida, la escala es 1 y no se toca
  // nada; en una ventana normal se ve igual, en pequeño.
  const [escala, setEscala] = useState(1);
  useLayoutEffect(() => {
    const ajustar = () => setEscala(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    ajustar();
    window.addEventListener('resize', ajustar);
    return () => window.removeEventListener('resize', ajustar);
  }, []);

  const { datos, error, anuncio, cuentaAtras, esperandoSalida } = useTransmision({
    clave, raceCode, clasificacion: filas,
  });
  // Solo la vista de patrocinadores lo usa, pero un hook no puede ir dentro
  // de un if: se declara siempre y en las demás vistas queda apagado.
  const patrocinador = usePatrocinadores(raceCode, vista === 'patrocinadores' || vista === 'charla');
  const charla = useCharla(params.get('actividad'), vista === 'charla');

  // Es una función que devuelve marcado, no un componente: un componente
  // definido aquí dentro sería uno nuevo en cada latido del reloj y React
  // volvería a montar la barra una vez por segundo, cortando la animación.
  const enLienzo = (contenido) => (
    <div className={`obs-raiz${fondo ? ` obs-fondo-${fondo}` : ''}`}>
      <div className="obs-lienzo" style={{ transform: `scale(${escala})` }}>
        {contenido}
      </div>
    </div>
  );

  if (vista === 'charla') {
    // La barra de una charla: nada de carrera. La hora en el bloque rojo, el
    // patrocinador de turno en el cuerpo y quien expone en la caja de la
    // derecha, donde en la carrera va el cronómetro.
    if (charla.error) return enLienzo(<div className="obs-aviso">{charla.error}</div>);
    const expositor = charla.expositor;
    return enLienzo(
      (patrocinador || expositor) && (
        <div className="obs-barra">
          <div className="obs-marca">
            <div className="obs-marca-arriba">HORA</div>
            <div className="obs-marca-grande obs-hora">{charla.hora}</div>
          </div>
          {patrocinador ? (
            <>
              {urlLogo(patrocinador.logo_url) && (
                <div className="obs-logo">
                  <img src={urlLogo(patrocinador.logo_url)} alt="" />
                </div>
              )}
              <div className="obs-cuerpo obs-entra" key={patrocinador.id}>
                <div className="obs-antetitulo">Patrocinador</div>
                <div className="obs-titulo">{patrocinador.name}</div>
                {patrocinador.text && <div className="obs-texto">{patrocinador.text}</div>}
              </div>
            </>
          ) : (
            <div className="obs-cuerpo">
              <div className="obs-antetitulo">{charla.actividad?.tipo_label || 'Actividad'}</div>
              <div className="obs-titulo">{charla.actividad?.name}</div>
            </div>
          )}
          {expositor && (
            <div className="obs-expositor obs-entra" key={`${expositor.nombre}-${expositor.especialidad}`}>
              <div className="obs-crono-rotulo">Expositor</div>
              <div className="obs-expositor-nombre">{expositor.nombre}</div>
              {expositor.especialidad && <div className="obs-expositor-especialidad">{expositor.especialidad}</div>}
            </div>
          )}
        </div>
      )
    );
  }

  if (!clave) {
    return enLienzo(<div className="obs-aviso">Falta la clave de transmisión en la dirección.</div>);
  }

  if (error || !datos) {
    return enLienzo(error ? <div className="obs-aviso">{error}</div> : null);
  }

  const { totales, reloj: r, clasificacion } = datos;

  // Cuánto se lleva andado de la vuelta, para la línea de progreso
  const duracion = (datos.carrera.minutos_por_vuelta || 60) * 60;
  const avance = r.empezada && cuentaAtras !== null
    ? Math.max(0, Math.min(1, (duracion - cuentaAtras) / duracion))
    : 0;

  const rotuloCrono = esperandoSalida ? 'Salida en' : r.terminada ? 'Carrera terminada' : 'Próxima vuelta';
  const digitos = r.terminada ? '--:--' : reloj(cuentaAtras);

  if (vista === 'crono') {
    return enLienzo(
      <div className="obs-crono-suelto">
        <div className="obs-crono-rotulo">{rotuloCrono}</div>
        <div className="obs-crono-digitos">{digitos}</div>
      </div>
    );
  }

  if (vista === 'patrocinadores') {
    // La misma barra, con el patrocinador donde iban los datos de carrera y
    // la vuelta en el bloque rojo. Sin patrocinadores encendidos no se pinta
    // nada: mejor un hueco que una barra que anuncia a nadie.
    return enLienzo(
      patrocinador && (
        <div className="obs-barra obs-entra" key={patrocinador.id}>
          <div className="obs-marca">
            <div className="obs-marca-arriba">VUELTA</div>
            <div className="obs-marca-grande">{r.vuelta}</div>
          </div>
          {urlLogo(patrocinador.logo_url) && (
            <div className="obs-logo">
              <img src={urlLogo(patrocinador.logo_url)} alt="" />
            </div>
          )}
          <div className="obs-cuerpo">
            <div className="obs-antetitulo">Patrocinador</div>
            <div className="obs-titulo">{patrocinador.name}</div>
            {patrocinador.text && <div className="obs-texto">{patrocinador.text}</div>}
          </div>
          <div className="obs-crono">
            <div className="obs-crono-rotulo">{rotuloCrono}</div>
            <div className="obs-crono-digitos">{digitos}</div>
          </div>
          <div className="obs-progreso" style={{ width: `${avance * 100}%` }} />
        </div>
      )
    );
  }

  if (vista === 'clasificacion') {
    return enLienzo(
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
    );
  }

  return enLienzo(
    anuncio ? (
      <div className="obs-barra obs-entra" key={anuncio.id}>
        <div className="obs-marca">
          <div className="obs-marca-arriba">DORSAL</div>
          <div className="obs-marca-grande">{anuncio.bib}</div>
        </div>
        <div className="obs-cuerpo">
          <div className="obs-antetitulo">Completa la vuelta {anuncio.vuelta}</div>
          <div className="obs-titulo">{anuncio.nombre}</div>
          <div className="obs-linea">
            <span className="obs-dato"><span className="obs-cifra">{reloj(anuncio.duracion_seg)}</span><span className="obs-palabra">vuelta</span></span>
            <span className="obs-dato"><span className="obs-cifra">{anuncio.vuelta}</span><span className="obs-palabra">vueltas</span></span>
            <span className="obs-dato"><span className="obs-cifra">{anuncio.km}</span><span className="obs-palabra">km</span></span>
          </div>
        </div>
        <div className="obs-crono">
          <div className="obs-crono-rotulo">Descanso</div>
          <div className="obs-crono-digitos">{digitos}</div>
        </div>
      </div>
    ) : (
      <div className="obs-barra">
        <div className="obs-marca">
          <div className="obs-marca-arriba">EN VIVO</div>
        </div>
        <div className="obs-cuerpo">
          {/* El nombre sale de la carrera que se está transmitiendo: el
              campeonato y la carrera abierta no se llaman igual */}
          <div className="obs-antetitulo">{datos.carrera.nombre}</div>
          <div className="obs-titulo">
            Vuelta {r.vuelta}
            <span style={{ color: '#a9c6f2' }}> · Salida {horaCorta(r.hora_inicio)}</span>
          </div>
          <div className="obs-linea">
            <span className="obs-dato"><span className="obs-cifra">{totales.km_recorridos}</span><span className="obs-palabra">km</span></span>
            <span className="obs-dato"><span className="obs-cifra">{totales.en_carrera}</span><span className="obs-palabra">en carrera</span></span>
            <span className="obs-dato"><span className="obs-cifra">{totales.dnf}</span><span className="obs-palabra">DNF</span></span>
            <span className="obs-dato"><span className="obs-cifra">{totales.dns}</span><span className="obs-palabra">DNS</span></span>
          </div>
        </div>
        <div className="obs-crono">
          <div className="obs-crono-rotulo">{rotuloCrono}</div>
          <div className="obs-crono-digitos">{digitos}</div>
        </div>
        <div className="obs-progreso" style={{ width: `${avance * 100}%` }} />
      </div>
    )
  );
}
