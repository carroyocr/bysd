import React from 'react';
import { ArrowRight, Youtube, Activity } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useRaceConfig } from '../contexts/RaceConfigContext';
import DescargarApp from './DescargarApp';
import PresentedBy from './PresentedBy';
import FotoAlbum from './FotoAlbum';
import useAlbum from '../lib/useAlbum';
import { FOTOS_PORTADA, resolverFotos } from '../content/portada';

// Portada del rediseño editorial (oct-2026): blanco, tipografía condensada
// grande y un mosaico de cinco fotos de la edición anterior en lugar del logo
// flotando sobre un degradado. El logo sigue ahí, como pegatina sobre el
// mosaico. Los textos y los datos son los de siempre.
//
// La portada entera —texto, mosaico y cifras— cabe en una pantalla de
// escritorio sin hacer scroll: la sección mide el alto de la ventana, el
// contenido se centra y las cifras se pegan abajo. En el teléfono se apila
// y se lee bajando, como todo lo demás.

const ESTADISTICAS = [
  { valor: '6.7', texto: 'KM por vuelta' },
  { valor: '60', texto: 'Minutos límite' },
  { valor: '24h+', texto: 'Duración estimada' },
  { valor: '1', texto: 'Último en pie' },
];

function Punto() {
  return <span className="w-1 h-1 rounded-full bg-primary" aria-hidden="true" />;
}

function Estadistica({ valor, texto }) {
  return (
    <div className="py-4 lg:py-5 md:border-r border-border last:border-r-0 md:pl-6 md:first:pl-0">
      <div className="font-display text-4xl sm:text-5xl lg:text-6xl leading-none text-foreground">{valor}</div>
      <div className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{texto}</div>
    </div>
  );
}

export default function Hero() {
  const { getShortDate, getEditionLabel, getLogoUrl, config } = useRaceConfig();
  const navigate = useNavigate();
  const album = useAlbum();
  const fotos = resolverFotos(album, FOTOS_PORTADA);
  const showInscription = config?.show_preregistration === true;
  // La transmision no es de la carrera publicada sino de la que se corre: el
  // backend la manda en `transmision_en_vivo` mientras alguna este en carrera
  // con enlace (el Mundial se transmitio con el sitio publicando enero).
  const transmision = config?.transmision_en_vivo?.url ? config.transmision_en_vivo : null;
  const showTracking = config?.show_tracking_page !== false;

  return (
    <section className="bg-background pt-24 sm:pt-28 lg:pt-20 lg:min-h-screen lg:flex lg:flex-col overflow-hidden">
      <div className="container mx-auto px-4 lg:flex-1 lg:flex lg:flex-col">
        <div className="max-w-[1240px] w-full mx-auto lg:flex-1 lg:flex lg:flex-col lg:justify-center lg:py-4">
          <div className="grid lg:grid-cols-[1fr_1.15fr] gap-10 lg:gap-12 items-center">
            {/* Texto */}
            <div className="animate-slide-up">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium text-muted-foreground">
                <span>{getEditionLabel()}</span>
                <Punto />
                <span>{getShortDate()}</span>
                <Punto />
                <a
                  href="https://maps.app.goo.gl/ZRMgpWA65jDLZgwcA"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                >
                  Hotel Caribbean Adventure
                </a>
              </div>

              {/* Dos lineas: el nombre y la ciudad en cobalto. El tamaño va
                  con el ancho de la ventana para que las dos quepan en la
                  columna sin partirse. */}
              <h1 className="font-display uppercase text-[clamp(52px,6.4vw,100px)] leading-[0.9] tracking-tight text-foreground mt-4 mb-5">
                Backyard Ultra
                <br />
                <span className="text-marca">Santo Domingo</span>
              </h1>

              <p className="text-base sm:text-lg text-muted-foreground max-w-md leading-relaxed">
                Un desafío personal. Un ejercicio de disciplina. Una prueba de voluntad. Vuelta tras vuelta.
              </p>

              {transmision && (
                <div className="space-y-2 mt-6" data-testid="transmision-en-vivo">
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                    <a
                      href={transmision.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-3 px-5 py-3 rounded bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors duration-300"
                      data-testid="transmision-en-vivo-youtube"
                    >
                      <Youtube className="w-5 h-5" />
                      Ver la transmisión en vivo
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold tracking-wider">
                        <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        EN VIVO
                      </span>
                    </a>
                    {showTracking && (
                      <Link
                        to={transmision.race_code ? `/resultados/${transmision.race_code}` : '/en-vivo'}
                        className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded border border-foreground font-semibold text-foreground hover:bg-foreground hover:text-background transition-colors duration-300"
                      >
                        <Activity className="w-5 h-5" />
                        Seguimiento en vivo
                      </Link>
                    )}
                  </div>
                  {transmision.race_name && (
                    <p className="text-sm text-muted-foreground">{transmision.race_name}</p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 mt-6">
                {showInscription && (
                  <button
                    onClick={() => navigate('/mi-perfil')}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors duration-300"
                    data-testid="inscription-open-card"
                  >
                    Inscripciones abiertas
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
                {/* Bajar la app: junto a la inscripcion, se ve sin hacer scroll */}
                <DescargarApp />
              </div>

              <PresentedBy size="md" className="mt-6" />
            </div>

            {/* Mosaico: una foto vertical a la izquierda y cuatro en
                cuadrícula a la derecha, con el logo como pegatina. El alto
                va con la ventana en escritorio para que la portada entera
                quepa sin scroll. */}
            <div
              className="relative grid grid-cols-[1.15fr_1fr_1fr] grid-rows-2 gap-2 sm:gap-3 h-[400px] sm:h-[500px] lg:h-[min(60vh,600px)] animate-scale-in"
              data-testid="portada-mosaico"
            >
              <FotoAlbum foto={fotos[0]} ancho={1200} loading="eager" className="row-span-2 w-full h-full object-cover" />
              <FotoAlbum foto={fotos[1]} ancho={800} loading="eager" className="w-full h-full object-cover" />
              <FotoAlbum foto={fotos[2]} ancho={800} loading="eager" className="w-full h-full object-cover" />
              <FotoAlbum foto={fotos[3]} ancho={800} loading="eager" className="w-full h-full object-cover" />
              <FotoAlbum foto={fotos[4]} ancho={800} loading="eager" className="w-full h-full object-cover" />
              <img
                src={getLogoUrl('home')}
                alt="Backyard Ultra Santo Domingo"
                className="absolute -left-3 -bottom-4 sm:-left-5 sm:-bottom-6 w-24 sm:w-28 lg:w-32 drop-shadow-xl"
              />
            </div>
          </div>
        </div>

        {/* Cifras: pegadas abajo en escritorio */}
        <div className="max-w-[1240px] w-full mx-auto grid grid-cols-2 md:grid-cols-4 mt-12 lg:mt-0 border-t-2 border-foreground">
          {ESTADISTICAS.map((e) => (
            <Estadistica key={e.texto} {...e} />
          ))}
        </div>
      </div>
    </section>
  );
}
