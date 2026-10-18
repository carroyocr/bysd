import React, { useState, useEffect, useCallback } from 'react';
import { Badge } from './ui/badge';
import { useRaceConfig } from '../contexts/RaceConfigContext';
import { SPONSOR_CATEGORIES, getCategory } from '../lib/sponsorCategories';
import { getPresenting, ETIQUETA_PRESENTING } from '../lib/presenting';

// La vitrina es un muro de marcas: los logos van sobre el papel, como en un
// programa de mano, sin una caja por patrocinador. El nivel se lee por el
// tamaño y por el aire alrededor, no por un marco ni por un rótulo debajo de
// cada logo (el logo ya dice el nombre).
//
// Lo que distingue un nivel de otro es cuánta SUPERFICIE ocupa su logo, y de
// ahí salen estos números: el área óptica en píxeles cuadrados a pantalla
// ancha. No se fija la altura, porque entonces un logo alargado pesaría el
// triple que uno cuadrado puesto a su lado.
const AREA = {
  titulo: 34000,
  platino: 20000,
  experiencia_4x4: 18800,
  oro: 13300,
  plata: 8300,
  bronce: 6300,
  especie: 6300,
  media_partner: 6300,
  zona_marcas: 4500,
};

// Los que todavía no tienen categoría asignada en el panel: se muestran para
// que ninguno desaparezca del sitio mientras se clasifican.
const AREA_SIN_CATEGORIA = 6300;

// En el panel algunas categorías se llaman en singular porque describen a un
// patrocinador; el bloque del sitio agrupa a varios.
const ENCABEZADOS = {
  titulo: 'Presentado por',
  especie: 'Aliados',
  media_partner: 'Media Partners',
};

// Cuánto aire va entre marcas del mismo nivel. Arriba se respira más: es
// parte de lo que dice que esa marca está por encima.
const SEPARACION = {
  titulo: 'gap-x-16 gap-y-10',
  platino: 'gap-x-16 gap-y-10',
  experiencia_4x4: 'gap-x-16 gap-y-10',
  oro: 'gap-x-14 gap-y-10',
};
const SEPARACION_POR_DEFECTO = 'gap-x-12 gap-y-8';

// En pantalla estrecha baja de escala el muro entero, no solo los logos que
// no caben: si unos se encogieran y otros no, se perdería la jerarquía, que
// es lo único que ordena esta página. El factor multiplica el área, así que
// el ancho baja por su raíz (0,42 de área = 0,65 de ancho).
function useFactorDeEscala() {
  const [factor, setFactor] = useState(1);

  useEffect(() => {
    const medir = () => {
      const ancho = window.innerWidth;
      setFactor(ancho < 640 ? 0.42 : ancho < 1024 ? 0.7 : 1);
    };
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, []);

  return factor;
}

// Misma superficie, no misma altura:
//
//     ancho = raíz(A · r)      alto = raíz(A / r)      r = ancho/alto
//
// Así un logo alargado y uno cuadrado pesan igual en la página. `r` es la
// proporción del archivo, y sirve porque el archivo llega recortado al borde
// de la tinta: eso lo hace `backend/services/logos.py` al subirlo. Sin ese
// recorte, `r` sería la proporción del lienzo —con hasta un 77 % de margen
// dentro— y nivelar por área no arreglaría nada.
//
// Solo se fija el ancho: el alto lo pone el propio archivo, y `max-w-full`
// deja que se encoja entero cuando la fila no da más de sí.
function LogoNivelado({ sponsor, area, factor }) {
  const [ratio, setRatio] = useState(null);

  // Por `ref` y no solo por `onLoad`: una imagen que ya está en la caché
  // puede haber terminado de cargar antes de que React ate el manejador.
  const medir = useCallback((img) => {
    if (img && img.naturalWidth && img.naturalHeight) {
      setRatio(img.naturalWidth / img.naturalHeight);
    }
  }, []);

  if (!sponsor.logo) {
    return (
      <span className="text-sm text-muted-foreground text-center px-2">{sponsor.name}</span>
    );
  }

  // Mientras no se ha medido se reserva el cuadrado del área y se deja
  // invisible: así ocupa sitio (y la carga diferida se dispara) sin enseñar
  // un salto de tamaño al llegar la medida.
  const ancho = Math.round(Math.sqrt(area * factor * (ratio || 1)));

  const imagen = (
    <img
      ref={medir}
      onLoad={(event) => medir(event.currentTarget)}
      src={sponsor.logo}
      alt={`Logo de ${sponsor.name}`}
      title={sponsor.name}
      loading="lazy"
      style={{ width: `${ancho}px` }}
      className={`h-auto max-w-full transition-opacity duration-300 ${ratio ? 'opacity-100' : 'opacity-0'}`}
    />
  );

  // Un logo sin transparencia enseña su rectángulo sobre el papel. El fondo
  // no se le quita en el servidor —podría ser parte de la marca, y eso no se
  // adivina—, así que aquí se le da una placa y el rectángulo pasa de ser un
  // descuido a ser deliberado.
  if (!sponsor.logoOpaco) return imagen;

  return (
    <span className="inline-flex max-w-full rounded-lg bg-white p-2.5 ring-1 ring-black/5">
      {imagen}
    </span>
  );
}

function NivelDeMarcas({ titulo, subtitulo, nota, sponsors, area, separacion, factor }) {
  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          {titulo}
          {subtitulo && <span className="ml-2 font-normal tracking-[0.14em] opacity-60">{subtitulo}</span>}
        </div>
        {nota && <p className="text-sm text-muted-foreground">{nota}</p>}
      </div>
      <div className={`flex flex-wrap items-center justify-center ${separacion}`}>
        {sponsors.map((sponsor) => (
          <LogoNivelado key={sponsor.name} sponsor={sponsor} area={area} factor={factor} />
        ))}
      </div>
    </div>
  );
}

// El naming de la edición cuando todavía no está cargado como patrocinador en
// el panel: sale del catálogo del sitio (`lib/presenting.js`) para que la marca
// que da nombre al evento no falte en su propia página. En cuanto se registra
// en el panel con categoría Título, manda la vitrina y esta ficha se retira.
function PresentedByCard({ raceCode, factor }) {
  const marca = getPresenting(raceCode);
  if (!marca) return null;

  const ancho = Math.round(Math.sqrt(AREA.titulo * factor * 3.5));

  return (
    <div className="text-center space-y-6">
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        {ETIQUETA_PRESENTING}
      </div>
      <a
        href={marca.web}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block transition-opacity hover:opacity-80"
      >
        <img
          src={marca.logo}
          alt={marca.descripcion}
          title={marca.nombre}
          style={{ width: `${ancho}px` }}
          className="h-auto max-w-full"
        />
      </a>
    </div>
  );
}

export default function SponsorsSection({ raceCode }) {
  const { raceName, config } = useRaceConfig();
  const factor = useFactorDeEscala();

  // Determine which race to show - from URL param or active race
  const displayRaceCode = raceCode ? raceCode.toUpperCase() : config?.code;
  const [raceInfo, setRaceInfo] = useState(null);
  const [sponsors, setSponsors] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch race info if viewing a specific race
  useEffect(() => {
    const fetchRaceInfo = async () => {
      if (displayRaceCode) {
        try {
          const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/race-config/${displayRaceCode}`);
          if (response.ok) {
            const data = await response.json();
            setRaceInfo(data);
          }
        } catch (error) {
          console.error('Error fetching race info:', error);
        }
      }
    };
    fetchRaceInfo();
  }, [displayRaceCode]);

  // Fetch sponsors based on race code
  useEffect(() => {
    const fetchSponsors = async () => {
      setLoading(true);

      if (displayRaceCode) {
        try {
          const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/sponsors/race/${displayRaceCode}`);
          if (response.ok) {
            const data = await response.json();
            // Map API response to match the expected format
            const mappedSponsors = (data.sponsors || []).map(s => ({
              name: s.name,
              categoria: s.propuesta_categoria || '',
              // Convert relative logo URL to full URL
              logo: s.logo_url ? `${process.env.REACT_APP_BACKEND_URL}${s.logo_url}` : null,
              logoOpaco: Boolean(s.logo_opaco),
            }));
            setSponsors(mappedSponsors);
          }
        } catch (error) {
          console.error('Error fetching sponsors:', error);
        }
      }

      setLoading(false);
    };

    fetchSponsors();
  }, [displayRaceCode]);

  // Get display name for the race
  const getDisplayRaceName = () => {
    if (raceInfo) return raceInfo.name;
    return raceName;
  };

  // Un grupo por categoría y solo los que tienen marcas dentro. Van ordenados
  // de mayor a menor área, que es tanto como decir de mayor a menor nivel: en
  // un muro la jerarquía la marca el tamaño, así que el orden de la página y
  // el de los logos tienen que decir lo mismo. (El orden del catálogo es el
  // del listado comercial y ahí no coinciden: deja Experiencia 4x4, que está
  // por encima de Oro, detrás de Bronce.)
  const grupos = SPONSOR_CATEGORIES
    .map((categoria) => ({
      categoria,
      area: AREA[categoria.slug] || AREA_SIN_CATEGORIA,
      marcas: sponsors.filter((s) => s.categoria === categoria.slug),
    }))
    .filter((g) => g.marcas.length > 0)
    .sort((a, b) => b.area - a.area);

  const sinCategoria = sponsors.filter((s) => !getCategory(s.categoria));

  // Si el naming ya está cargado como patrocinador, la vitrina lo enseña con
  // el tratamiento de la categoría Título y no hace falta la ficha de arriba.
  const hayTitulo = sponsors.some((s) => s.categoria === 'titulo');

  if (loading) {
    return (
      <section className="py-10 bg-gradient-to-b from-muted/20 to-background">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-10 bg-gradient-to-b from-muted/20 to-background">
      <div className="container mx-auto px-4">
        <div className="max-w-5xl mx-auto space-y-14">
          {/* Encabezado */}
          <div className="text-center space-y-4">
            <h2 className="font-sans font-normal text-3xl sm:text-4xl tracking-tight text-foreground">
              Patrocinadores
            </h2>
            <p className="text-muted-foreground">
              {getDisplayRaceName()}
            </p>
            {displayRaceCode && (
              <Badge variant="outline" className="text-primary border-primary">
                {displayRaceCode}
              </Badge>
            )}
          </div>

          {sponsors.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              Aún no hay patrocinadores registrados para esta carrera
            </p>
          ) : (
            <>
              <div className="max-w-3xl mx-auto text-center space-y-4">
                <p className="text-muted-foreground leading-relaxed">
                  El {getDisplayRaceName()} es posible gracias al apoyo de marcas e instituciones líderes en sus respectivos sectores, que creen en el deporte, la resiliencia y el poder de la comunidad.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Cada patrocinador aporta experiencia, calidad y compromiso, haciendo posible que atletas locales e internacionales vivan una competencia segura, bien organizada y al nivel de un evento de clase mundial. Sin su apoyo, nada de esto sería posible.
                </p>
              </div>

              {/* Naming de la edición: sale del catálogo de la carrera y no de
                  la lista de patrocinadores, así que se ve aunque la vitrina
                  todavía esté vacía o el patrocinador no se haya publicado. */}
              {!hayTitulo && (
                <>
                  <div className="h-px bg-border" />
                  <PresentedByCard raceCode={displayRaceCode} factor={factor} />
                </>
              )}

              {/* El muro: un nivel debajo de otro, separados por una línea de
                  pelo. La línea no encierra nada, solo dice dónde acaba un
                  nivel y empieza el siguiente. */}
              {grupos.map(({ categoria, area, marcas }) => (
                <React.Fragment key={categoria.slug}>
                  <div className="h-px bg-border" />
                  <NivelDeMarcas
                    titulo={ENCABEZADOS[categoria.slug] || categoria.label}
                    subtitulo={ENCABEZADOS[categoria.slug] ? null : categoria.subtitle}
                    nota={categoria.esPatrocinio ? null : 'Marcas presentes en el evento con activación propia.'}
                    sponsors={marcas}
                    area={area}
                    separacion={SEPARACION[categoria.slug] || SEPARACION_POR_DEFECTO}
                    factor={factor}
                  />
                </React.Fragment>
              ))}

              {sinCategoria.length > 0 && (
                <>
                  <div className="h-px bg-border" />
                  <NivelDeMarcas
                    titulo={grupos.length > 0 ? 'Otros patrocinadores' : 'Patrocinadores'}
                    sponsors={sinCategoria}
                    area={AREA_SIN_CATEGORIA}
                    separacion={SEPARACION_POR_DEFECTO}
                    factor={factor}
                  />
                </>
              )}

              <div className="h-px bg-border" />

              <div className="max-w-2xl mx-auto text-center space-y-3">
                <h3 className="font-sans font-normal text-xl tracking-tight text-foreground">
                  Gracias a todos nuestros patrocinadores
                </h3>
                <p className="text-muted-foreground">
                  Su compromiso hace posible que este evento sea una realidad. Juntos, estamos creando
                  una experiencia inolvidable para todos los atletas y la comunidad.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
