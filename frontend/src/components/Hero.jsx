import React from 'react';
import { ArrowRight, Youtube, Activity } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useRaceConfig } from '../contexts/RaceConfigContext';
import DescargarApp from './DescargarApp';
import PresentedBy from './PresentedBy';
import FotoAlbum from './FotoAlbum';
import { FOTOS_PORTADA } from '../content/portada';

// Portada del rediseño editorial (oct-2026): blanco, tipografía condensada muy
// grande y un collage de dos fotos de la edición anterior en lugar del logo
// flotando sobre un degradado. El logo sigue ahí, como pegatina sobre el
// collage. Los textos y los datos son los de siempre.

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
    <div className="py-6 sm:py-8 md:border-r border-border last:border-r-0 md:pl-6 md:first:pl-0">
      <div className="font-display text-6xl sm:text-7xl lg:text-8xl leading-none text-foreground">{valor}</div>
      <div className="mt-2 text-[11px] sm:text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{texto}</div>
    </div>
  );
}

export default function Hero() {
  const { getShortDate, getEditionLabel, getLogoUrl, config } = useRaceConfig();
  const navigate = useNavigate();
  const showInscription = config?.show_preregistration === true;
  // La transmision no es de la carrera publicada sino de la que se corre: el
  // backend la manda en `transmision_en_vivo` mientras alguna este en carrera
  // con enlace (el Mundial se transmitio con el sitio publicando enero).
  const transmision = config?.transmision_en_vivo?.url ? config.transmision_en_vivo : null;
  const showTracking = config?.show_tracking_page !== false;

  return (
    <section className="bg-background pt-28 sm:pt-32 overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="max-w-[1240px] mx-auto">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-14 items-center">
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

              {/* Titulo y naming van juntos: el naming es parte de la marca,
                  no una linea suelta. */}
              <h1 className="font-display uppercase text-[clamp(64px,10vw,150px)] leading-[0.88] tracking-tight text-foreground mt-5 mb-6">
                Backyard
                <br />
                Ultra
                <br />
                <span className="text-primary">Santo Domingo</span>
              </h1>

              <p className="text-lg sm:text-xl text-muted-foreground max-w-lg leading-relaxed">
                Un desafío personal. Un ejercicio de disciplina. Una prueba de voluntad. Vuelta tras vuelta.
              </p>

              {transmision && (
                <div className="space-y-2 mt-8" data-testid="transmision-en-vivo">
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

              <div className="flex flex-wrap items-center gap-3 mt-8">
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

              <PresentedBy size="md" className="mt-8" />
            </div>

            {/* Collage: una foto vertical grande, una horizontal encima con
                marco blanco y el logo como pegatina. Las alturas son fijas
                porque las fotos van en absoluto. */}
            <div className="relative h-[380px] sm:h-[520px] lg:h-[640px] mt-8 lg:mt-0 animate-scale-in">
              <FotoAlbum
                foto={FOTOS_PORTADA.grande}
                ancho={1400}
                loading="eager"
                className="absolute right-0 top-0 w-[78%] h-full object-cover"
              />
              <FotoAlbum
                foto={FOTOS_PORTADA.chica}
                ancho={1000}
                loading="eager"
                className="absolute left-0 -bottom-6 lg:-bottom-10 w-[48%] aspect-[4/3] object-cover border-[6px] lg:border-8 border-background shadow-strong"
              />
              <img
                src={getLogoUrl('home')}
                alt="Backyard Ultra Santo Domingo"
                className="absolute -right-2 -top-5 lg:-right-5 lg:-top-8 w-24 sm:w-32 lg:w-36 drop-shadow-xl"
              />
            </div>
          </div>

          {/* Cifras */}
          <div className="grid grid-cols-2 md:grid-cols-4 mt-20 sm:mt-28 lg:mt-32 border-t-2 border-foreground">
            {ESTADISTICAS.map((e) => (
              <Estadistica key={e.texto} {...e} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
