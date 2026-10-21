import React, { useEffect, useLayoutEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import useTransmision, { horaCorta, reloj } from './useTransmision';
import usePatrocinadores, { urlLogo } from './usePatrocinadores';
import useCharla from './useCharla';
import useSuper from './useSuper';
import useMundial from './useMundial';
import useMensajes from './useMensajes';
import { Heart } from 'lucide-react';
import Globo, { globoDe } from './Globo';
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
 *   /obs/salida?clave=...&race=BYSD-2027                   (pantalla completa, para el monitor del corral)
 *   /obs/salida?clave=...&inicio=2027-01-23T07:00          (con una salida forzada, para ensayar)
 *   /obs/patrocinadores?clave=...
 *   /obs/patrocinador-esquina?race=BYSD-2027                 (sin clave: no lleva datos de carrera)
 *   /obs/charla?actividad=<id>&race=BYSD-2027&expositor=1   (sin clave: no lleva datos de carrera)
 *   /obs/super?id=<id>   (dos líneas de texto libre, escritas en el panel)
 *   /obs/latam?filas=20  (sin clave: el ranking de Latinoamérica del Mundial, de la hoja pública de la organización)
 *   /obs/mensajes?race=BYSD-2027&recientes=10&segundos=10     (sin clave: el muro de apoyo es público)
 *   /obs/mensajes?race=BYSD-2027&recientes=0&espera=30&sobre=barra
 */
export default function ObsPage() {
  const { vista } = useParams();
  const [params] = useSearchParams();
  const clave = params.get('clave') || '';
  const raceCode = params.get('race') || '';
  // La pantalla de salida va para un monitor, no sobre un video: siempre
  // pinta su fondo.
  const fondo = vista === 'salida' ? 'oscuro' : (params.get('fondo') || '');
  const inicio = params.get('inicio') || '';
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

  const { datos, error, anuncio, reloj: r, ahora, cuentaAtras, esperandoSalida, salida } = useTransmision({
    clave, raceCode, clasificacion: filas, inicio,
  });
  // Solo la vista de patrocinadores lo usa, pero un hook no puede ir dentro
  // de un if: se declara siempre y en las demás vistas queda apagado.
  // El super sabe de qué carrera es: sus patrocinadores salen de ahí, y la
  // dirección no tiene que llevar más que su id.
  const superTexto = useSuper(params.get('id'), vista === 'super');
  const patrocinador = usePatrocinadores(
    vista === 'super' ? (superTexto.datos?.race_code || '') : raceCode,
    ['patrocinadores', 'patrocinador-esquina', 'charla'].includes(vista)
      || (vista === 'super' && !!superTexto.datos),
  );
  const charla = useCharla(params.get('actividad'), vista === 'charla', params.get('expositor'));
  const mundial = useMundial(vista === 'latam');
  // Los mensajes de apoyo: cuántos de los últimos se rotan cuando no llega
  // nada nuevo (0 = solo los nuevos), cuánto dura cada uno y cuánto se retiene
  // cada mensaje desde que se publica, por si lo reportan antes de salir.
  const numero = (nombre, porDefecto, max) => {
    const v = params.get(nombre);
    return v === null || v === '' ? porDefecto : Math.max(0, Math.min(Number(v) || 0, max));
  };
  const mensajes = useMensajes({
    raceCode,
    activo: vista === 'mensajes',
    rotar: numero('recientes', 10, 30),
    segundos: numero('segundos', 10, 120),
    esperaSeg: numero('espera', 0, 3600),
  });

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
    // La barra de una charla: nada de carrera. La hora en el bloque rojo,
    // quien expone en el centro y el patrocinador de turno en la esquina
    // derecha, donde en la carrera va el cronómetro.
    if (charla.error) return enLienzo(<div className="obs-aviso">{charla.error}</div>);
    const expositor = charla.expositor;
    return enLienzo(
      charla.actividad && (
        <div className="obs-barra">
          <div className="obs-marca">
            <div className="obs-marca-arriba">HORA</div>
            <div className="obs-marca-grande obs-hora">{charla.hora}</div>
          </div>
          {expositor ? (
            <div className="obs-cuerpo obs-entra" key={`${expositor.nombre}-${expositor.especialidad}`}>
              <div className="obs-antetitulo">Expositor</div>
              <div className="obs-titulo">{expositor.nombre}</div>
              {expositor.especialidad && <div className="obs-texto">{expositor.especialidad}</div>}
            </div>
          ) : (
            <div className="obs-cuerpo">
              <div className="obs-antetitulo">{charla.actividad.tipo_label || 'Actividad'}</div>
              <div className="obs-titulo">{charla.actividad.name}</div>
            </div>
          )}
          {patrocinador && (
            <div className="obs-patrocinio obs-entra" key={patrocinador.id}>
              {urlLogo(patrocinador.logo_url) && (
                <div className="obs-logo obs-logo-chico">
                  <img src={urlLogo(patrocinador.logo_url)} alt="" />
                </div>
              )}
              <div className="obs-patrocinio-texto">
                <div className="obs-crono-rotulo">Patrocinador</div>
                <div className="obs-patrocinio-nombre">{patrocinador.name}</div>
                {patrocinador.text && <div className="obs-patrocinio-frase">{patrocinador.text}</div>}
              </div>
            </div>
          )}
        </div>
      )
    );
  }

  if (vista === 'super') {
    // La barra de la charla con texto libre: la hora, dos líneas escritas en
    // el panel y el patrocinador de turno a la derecha. El tamaño es un
    // porcentaje que se sube o se baja desde el panel.
    if (superTexto.error) return enLienzo(<div className="obs-aviso">{superTexto.error}</div>);
    const su = superTexto.datos;
    const factor = (su?.tamano || 100) / 100;
    return enLienzo(
      su && (
        <div className="obs-barra">
          <div className="obs-marca">
            <div className="obs-marca-arriba">HORA</div>
            <div className="obs-marca-grande obs-hora">{superTexto.hora}</div>
          </div>
          <div className="obs-cuerpo">
            {su.linea1 && <div className="obs-super-linea1" style={{ fontSize: `${40 * factor}px` }}>{su.linea1}</div>}
            {su.linea2 && <div className="obs-super-linea2" style={{ fontSize: `${28 * factor}px` }}>{su.linea2}</div>}
          </div>
          {patrocinador && (
            <div className="obs-patrocinio obs-entra" key={patrocinador.id}>
              {urlLogo(patrocinador.logo_url) && (
                <div className="obs-logo obs-logo-chico">
                  <img src={urlLogo(patrocinador.logo_url)} alt="" />
                </div>
              )}
              <div className="obs-patrocinio-texto">
                <div className="obs-crono-rotulo">Patrocinador</div>
                <div className="obs-patrocinio-nombre">{patrocinador.name}</div>
                {patrocinador.text && <div className="obs-patrocinio-frase">{patrocinador.text}</div>}
              </div>
            </div>
          )}
        </div>
      )
    );
  }

  if (vista === 'latam') {
    // El ranking de Latinoamérica del Mundial por equipos, en la esquina
    // inferior derecha, donde va la clasificación. No sale de nuestra base
    // sino de la hoja pública de la organización, que es la oficial: aquí
    // solo se filtran los países latinos y se numeran. Sin clave.
    if (mundial.error) return enLienzo(<div className="obs-aviso">{mundial.error}</div>);
    const m = mundial.datos;
    if (!m) return enLienzo(null);
    const equipos = m.equipos.slice(0, filas);
    return enLienzo(
      <div className="obs-latam">
        <h2>
          <span>Ranking Latinoamérica</span>
          {m.vuelta && <span className="obs-latam-vuelta">Vuelta {m.vuelta}</span>}
        </h2>
        <div className="obs-fila obs-latam-cabecera">
          <span className="obs-puesto">#</span>
          <span className="obs-bib">País</span>
          <span className="obs-nombre" />
          <span className="obs-latam-cifra">En pie</span>
          <span className="obs-latam-cifra">Vueltas</span>
          <span className="obs-latam-mundial">Mundial</span>
        </div>
        {equipos.map((e) => (
          <div key={e.codigo} className={`obs-fila${e.en_pie === 0 ? ' obs-fuera' : ''}`}>
            <span className="obs-puesto">{e.puesto}</span>
            <span className="obs-bib">{e.codigo}</span>
            <span className="obs-nombre">{e.pais}</span>
            <span className="obs-latam-cifra">{e.en_pie}</span>
            <span className="obs-latam-cifra">{e.vueltas}</span>
            <span className="obs-latam-mundial">{e.puesto_mundial}º</span>
          </div>
        ))}
      </div>
    );
  }

  if (vista === 'patrocinador-esquina') {
    // El mismo bloque de patrocinador que lleva la barra de las charlas, pero
    // solo él y en la esquina, donde van el cronómetro suelto y la
    // clasificación: sirve para cualquier escena, con barra o sin ella, y no
    // tapa lo que pase por el centro del video.
    // Va antes de la comprobación de la clave: los patrocinadores son los
    // mismos que los de la app y no llevan ningún dato de carrera.
    return enLienzo(
      patrocinador && (
        <div className="obs-patrocinio obs-patrocinio-suelto obs-entra" key={patrocinador.id}>
          {urlLogo(patrocinador.logo_url) && (
            <div className="obs-logo obs-logo-chico">
              <img src={urlLogo(patrocinador.logo_url)} alt="" />
            </div>
          )}
          <div className="obs-patrocinio-texto">
            <div className="obs-crono-rotulo">Patrocinador</div>
            <div className="obs-patrocinio-nombre">{patrocinador.name}</div>
            {patrocinador.text && <div className="obs-patrocinio-frase">{patrocinador.text}</div>}
          </div>
        </div>
      )
    );
  }

  if (vista === 'mensajes') {
    // Un mensaje de apoyo cada vez, en la esquina inferior izquierda: lo que
    // la gente escribe en la app según lo escribe, y entre medias los últimos.
    // Sin clave: es el muro público de la app. Con &sobre=barra sube para
    // dejar sitio a la barra inferior.
    if (mensajes.error) return enLienzo(<div className="obs-aviso">{mensajes.error}</div>);
    const msj = mensajes.mensaje;
    if (!msj) return enLienzo(null);
    const largo = (msj.message || '').length;
    const tamano = largo > 160 ? ' obs-mensaje-largo' : largo > 80 ? ' obs-mensaje-medio' : '';
    return enLienzo(
      <div className={`obs-mensaje obs-entra${tamano}${params.get('sobre') === 'barra' ? ' obs-mensaje-sobre-barra' : ''}`} key={msj.id}>
        <div className="obs-mensaje-cab">
          <Heart className="obs-mensaje-icono" />
          <span className="obs-crono-rotulo">Mensaje de apoyo</span>
        </div>
        <div className="obs-mensaje-texto">{msj.message}</div>
        <div className="obs-mensaje-pie">
          <span className="obs-mensaje-de">{msj.fan_name}</span>
          <span className="obs-mensaje-para">
            para <span className="obs-bib">{String(msj.athlete_bib || '').padStart(3, '0')}</span>
            {msj.athlete_name ? ` ${msj.athlete_name}` : ''}
          </span>
        </div>
      </div>
    );
  }

  if (!clave) {
    return enLienzo(<div className="obs-aviso">Falta la clave de transmisión en la dirección.</div>);
  }

  if (error || !datos) {
    return enLienzo(error ? <div className="obs-aviso">{error}</div> : null);
  }

  const { totales, clasificacion } = datos;

  // Cuánto se lleva andado de la vuelta, para la línea de progreso
  const duracion = (datos.carrera.minutos_por_vuelta || 60) * 60;
  const avance = r.empezada && cuentaAtras !== null
    ? Math.max(0, Math.min(1, (duracion - cuentaAtras) / duracion))
    : 0;

  const rotuloCrono = esperandoSalida ? 'Salida en' : r.terminada ? 'Carrera terminada' : 'Próxima vuelta';
  const digitos = r.terminada ? '--:--' : reloj(cuentaAtras);
  const globo = globoDe(cuentaAtras);

  // El recuadro del cronómetro, con el globo de aviso a su izquierda en los
  // últimos tres minutos. Es el mismo en la barra, en patrocinadores y suelto.
  const cajaCrono = (rotulo, clase = 'obs-crono') => (
    <div className={`${clase}${globo ? ' obs-crono-con-globo' : ''}`}>
      <Globo segundos={cuentaAtras} className="obs-globo-chico obs-entra" />
      <div className="obs-crono-texto">
        <div className="obs-crono-rotulo">{rotulo}</div>
        <div className="obs-crono-digitos">{digitos}</div>
      </div>
    </div>
  );

  if (vista === 'crono') {
    // Suelto en la esquina habla de la salida, que es lo que se espera en
    // el corral; dentro de la barra sigue siendo la vuelta.
    const rotuloSuelto = esperandoSalida || r.terminada ? rotuloCrono : 'Tiempo restante';
    return enLienzo(cajaCrono(rotuloSuelto, 'obs-crono-suelto'));
  }

  if (vista === 'salida') {
    // La pantalla completa del corral: el reloj grande y, a la izquierda, el
    // anillo que se cierra con la vuelta o el globo de los últimos minutos.
    const CIRC = 295.3; // perímetro del anillo de radio 47 en el viewBox de 100
    const alerta = !r.terminada && cuentaAtras !== null && cuentaAtras > 0 && cuentaAtras <= 10;
    const conHoras = cuentaAtras !== null && cuentaAtras >= 3600;
    const fuera = (totales.dnf || 0) + (totales.dns || 0);
    // Al cruzar el cero el servidor tarda unos segundos en pasar de vuelta
    const vueltaQueEmpieza = cuentaAtras !== null && cuentaAtras <= 0 ? r.vuelta + 1 : Math.max(1, r.vuelta);
    const horaAhora = new Date(ahora).toLocaleTimeString('es-DO', { hour: 'numeric', minute: '2-digit', second: '2-digit' });
    const rotulo = esperandoSalida
      ? 'La carrera empieza en'
      : r.terminada ? 'Carrera terminada' : `Tiempo restante · salida ${horaCorta(r.fin_de_vuelta)}`;

    return enLienzo(
      <div className="obs-salida">
        <div className="obs-salida-cab">
          <div className="obs-salida-marca">
            <img src="/icon-bu.png" alt="" />
            <span>{datos.carrera.nombre}</span>
          </div>
          <div className="obs-salida-hora"><small>Hora</small>{horaAhora}</div>
        </div>

        <div className="obs-salida-cuerpo">
          <div className="obs-salida-disco">
            {globo ? (
              <Globo segundos={cuentaAtras} className="obs-entra" />
            ) : (
              <>
                <svg viewBox="0 0 100 100">
                  <circle className="obs-anillo-fondo" cx="50" cy="50" r="47" />
                  {r.empezada && !r.terminada && (
                    <circle
                      className="obs-anillo"
                      cx="50" cy="50" r="47"
                      strokeDasharray={CIRC}
                      strokeDashoffset={CIRC * (1 - avance)}
                    />
                  )}
                </svg>
                <div className="obs-salida-centro">
                  {esperandoSalida ? (
                    <>
                      <img src="/icon-bu.png" alt="" />
                      <div className="obs-crono-rotulo">Salida</div>
                      <div className="obs-salida-num obs-salida-num-chico">{horaCorta(r.hora_inicio)}</div>
                    </>
                  ) : (
                    <>
                      <div className="obs-crono-rotulo">Vuelta</div>
                      <div className="obs-salida-num">{r.vuelta}</div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="obs-salida-cuenta">
            <div className="obs-salida-rotulo">{rotulo}</div>
            <div className={`obs-salida-digitos${conHoras ? ' obs-salida-digitos-chico' : ''}${alerta ? ' obs-salida-alerta' : ''}`}>
              {digitos}
            </div>
            <div className="obs-salida-sub">
              {esperandoSalida ? (
                <>{fechaLarga(r.hora_inicio)} · <b>{totales.inscritos} inscritos</b></>
              ) : (
                <>Vuelta {r.vuelta} · <b>{totales.en_carrera} en carrera</b> · {fuera} fuera</>
              )}
            </div>
          </div>
        </div>

        <div className="obs-salida-pie">
          <span className="obs-dato"><span className="obs-cifra">{totales.km_recorridos}</span><span className="obs-palabra">km</span></span>
          <span className="obs-dato"><span className="obs-cifra">{totales.en_carrera}</span><span className="obs-palabra">en carrera</span></span>
          <span className="obs-dato"><span className="obs-cifra">{totales.dnf}</span><span className="obs-palabra">DNF</span></span>
          <span className="obs-dato"><span className="obs-cifra">{totales.dns}</span><span className="obs-palabra">DNS</span></span>
        </div>
        <div className="obs-salida-progreso-fondo" />
        <div className="obs-salida-progreso" style={{ width: `${avance * 100}%` }} />

        {salida && (
          <div className="obs-salida-destello">
            <div className="obs-salida-grande">¡SALIDA!</div>
            <div className="obs-salida-rotulo">Vuelta {vueltaQueEmpieza} · {horaCorta(salida.en)}</div>
          </div>
        )}
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
          {cajaCrono(rotuloCrono)}
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
        {cajaCrono('Descanso')}
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
        {cajaCrono(rotuloCrono)}
        <div className="obs-progreso" style={{ width: `${avance * 100}%` }} />
      </div>
    )
  );
}

/** "2027-01-23T07:00:00-04:00" -> "Sábado 23 de enero · 7:00 a. m." */
function fechaLarga(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const fecha = d.toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long' });
  return `${fecha.charAt(0).toUpperCase()}${fecha.slice(1)} · ${horaCorta(iso)}`;
}
