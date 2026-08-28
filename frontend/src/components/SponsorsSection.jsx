import React, { useState, useEffect } from 'react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { IconSeguir } from './icons';
import { useRaceConfig } from '../contexts/RaceConfigContext';
import { SPONSOR_CATEGORIES, getCategory } from '../lib/sponsorCategories';
import { getPresenting, ETIQUETA_PRESENTING } from '../lib/presenting';

// Cómo se ve cada categoría en la vitrina. Es la segmentación hecha diseño:
// mientras más alta la categoría, más ancho ocupa la marca, más grande va su
// logo y más se cuenta de ella. Las de abajo se muestran en cuadrícula
// compacta, solo logo y nombre.
//
// `tono` y `fondoLogo` salen de los tokens del sitio (index.css), no de
// colores sueltos: así el modo oscuro sigue funcionando sin tocar nada.
const CLARO = 'bg-card border-border shadow-soft hover:shadow-medium';
const FONDO_LOGO_CLARO = 'bg-muted/20';

const PRESENTACION = {
  titulo: {
    // En la vitrina no se anuncia la categoría que compró, se anuncia lo que
    // significa. "Título / Presenting" es el nombre comercial y se queda en el
    // panel; el sitio dice de quién se trata.
    encabezado: 'Presentado por:',
    // Más angosta que el resto y al centro: no es una tarjeta más de una fila,
    // es la marca que da nombre al evento. El aire alrededor es lo que la
    // separa de la cuadrícula.
    centrado: true,
    grid: 'grid-cols-1 max-w-2xl mx-auto',
    logo: 'h-40',
    nombre: 'text-3xl sm:text-4xl',
    tono: 'bg-foreground text-background border-transparent shadow-strong',
    fondoLogo: 'bg-background/95',
  },
  platino: {
    grid: 'sm:grid-cols-2',
    logo: 'h-32',
    nombre: 'text-2xl',
    tono: CLARO,
    fondoLogo: FONDO_LOGO_CLARO,
  },
  oro: {
    grid: 'sm:grid-cols-2 lg:grid-cols-3',
    logo: 'h-28',
    nombre: 'text-xl',
    tono: CLARO,
    fondoLogo: FONDO_LOGO_CLARO,
  },
  plata: {
    grid: 'grid-cols-2 lg:grid-cols-4',
    logo: 'h-24',
    nombre: 'text-base',
    tono: CLARO,
    fondoLogo: FONDO_LOGO_CLARO,
  },
  bronce: {
    grid: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
    logo: 'h-20',
    nombre: 'text-sm',
    tono: CLARO,
    fondoLogo: FONDO_LOGO_CLARO,
  },
  experiencia_4x4: {
    grid: 'grid-cols-1',
    logo: 'h-32',
    nombre: 'text-2xl sm:text-3xl',
    tono: 'bg-accent text-accent-foreground border-transparent shadow-medium',
    fondoLogo: 'bg-background/95',
  },
  especie: {
    grid: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
    logo: 'h-24',
    nombre: 'text-base',
    tono: CLARO,
    fondoLogo: FONDO_LOGO_CLARO,
  },
  media_partner: {
    // En el panel la categoría es de uno ("Media Partner"); el bloque del
    // sitio agrupa a varios y por eso va en plural.
    encabezado: 'Media Partners',
    grid: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
    logo: 'h-24',
    nombre: 'text-base',
    tono: CLARO,
    fondoLogo: FONDO_LOGO_CLARO,
  },
  zona_marcas: {
    grid: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
    logo: 'h-16',
    nombre: 'text-sm',
    tono: 'bg-muted/30 border-border/60',
    fondoLogo: 'bg-background/60',
  },
};

// Los que todavía no tienen categoría asignada en el panel: se muestran como
// se mostraban antes, para que ninguno desaparezca del sitio mientras se
// clasifican.
const SIN_CATEGORIA = {
  grid: 'sm:grid-cols-2 lg:grid-cols-3',
  logo: 'h-32',
  nombre: 'text-xl',
  tono: CLARO,
  fondoLogo: FONDO_LOGO_CLARO,
};

// La vitrina enseña el logo, el nombre y poco más. La descripción y el
// Instagram se mudaron a la ficha de publicidad, que es donde vive lo que se
// le cuenta al público; aquí quedó lo que distingue un nivel de otro.
function TarjetaPatrocinador({ sponsor, estilo }) {
  return (
    <div
      className={`block rounded-xl border p-5 space-y-4 transition-all duration-300 hover-lift ${estilo.tono}`}
    >
      <div className={`w-full ${estilo.logo} flex items-center justify-center rounded-lg p-4 ${estilo.fondoLogo}`}>
        {sponsor.logo ? (
          <img
            src={sponsor.logo}
            alt={`Logo de ${sponsor.name}`}
            className="max-h-full max-w-full object-contain"
            loading="lazy"
          />
        ) : (
          <span className="text-sm text-muted-foreground text-center">{sponsor.name}</span>
        )}
      </div>

      <div className={`space-y-2 ${estilo.centrado ? 'text-center' : ''}`}>
        <h4 className={`font-display leading-tight ${estilo.nombre}`}>{sponsor.name}</h4>
      </div>
    </div>
  );
}

// El naming de la edición cuando todavía no está cargado como patrocinador en
// el panel: sale del catálogo del sitio (`lib/presenting.js`) para que la marca
// que da nombre al evento no falte en su propia página. En cuanto se registra
// en el panel con categoría Título, manda la vitrina y esta ficha se retira.
function PresentedByCard({ raceCode }) {
  const marca = getPresenting(raceCode);
  if (!marca) return null;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="rounded-xl border border-transparent bg-foreground text-background p-6 sm:p-8 shadow-strong space-y-5 text-center">
        <span className="block text-xs font-semibold italic uppercase tracking-[0.2em] text-primary">
          {ETIQUETA_PRESENTING}
        </span>
        <a
          href={marca.web}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-lg bg-background/95 p-6 transition-opacity hover:opacity-90"
        >
          <img
            src={marca.logo}
            alt={marca.descripcion}
            className="h-24 sm:h-28 w-auto mx-auto object-contain"
          />
        </a>
        <h3 className="font-display text-3xl sm:text-4xl leading-tight">{marca.nombre}</h3>
      </div>
    </div>
  );
}

function GrupoCategoria({ titulo, subtitulo, nota, sponsors, estilo }) {
  // El grupo centrado no lleva la línea que cierra el encabezado: esa línea
  // marca el ancho de una cuadrícula, y aquí no hay cuadrícula que marcar.
  return (
    <div className="space-y-5">
      {estilo.centrado ? (
        <h3 className="font-display text-2xl text-foreground text-center">{titulo}</h3>
      ) : (
        <div className="flex items-baseline gap-3">
          <h3 className="font-display text-2xl text-foreground whitespace-nowrap">{titulo}</h3>
          {subtitulo && (
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{subtitulo}</span>
          )}
          <span className="h-px flex-1 bg-border" />
        </div>
      )}
      {nota && <p className="text-sm text-muted-foreground -mt-2">{nota}</p>}
      <div className={`grid gap-6 ${estilo.grid}`}>
        {sponsors.map((sponsor) => (
          <TarjetaPatrocinador key={sponsor.name} sponsor={sponsor} estilo={estilo} />
        ))}
      </div>
    </div>
  );
}

export default function SponsorsSection({ raceCode }) {
  const { raceName, config } = useRaceConfig();

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
              logo: s.logo_url ? `${process.env.REACT_APP_BACKEND_URL}${s.logo_url}` : null
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

  // Un grupo por categoría, en el orden del catálogo, y solo los que tienen
  // marcas dentro. Lo que no cae en ninguna categoría del esquema (todavía sin
  // asignar, o un valor viejo escrito a mano) va a un grupo final.
  const grupos = SPONSOR_CATEGORIES
    .map((categoria) => ({
      categoria,
      estilo: PRESENTACION[categoria.slug],
      marcas: sponsors.filter((s) => s.categoria === categoria.slug),
    }))
    .filter((g) => g.marcas.length > 0);

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
        <div className="max-w-6xl mx-auto space-y-12">
          {/* Header */}
          <div className="text-center space-y-4">
            <h2 className="font-display text-4xl sm:text-5xl text-foreground">
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

          {/* Naming de la edición: sale del catálogo de la carrera y no de la
              lista de patrocinadores, así que se ve aunque la vitrina todavía
              esté vacía o el patrocinador no se haya publicado. */}
          {!hayTitulo && <PresentedByCard raceCode={displayRaceCode} />}

          {/* Show message if no sponsors */}
          {sponsors.length === 0 ? (
            <Card className="bg-muted/50">
              <CardContent className="py-12 text-center">
                <IconSeguir className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">
                  Aún no hay patrocinadores registrados para esta carrera
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Introduction */}
          <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20 shadow-medium">
            <CardContent className="p-8 md:p-10 space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <IconSeguir className="w-6 h-6 text-primary" />
                </div>
                <div className="space-y-4">
                  <p className="text-muted-foreground leading-relaxed">
                    El {getDisplayRaceName()} es posible gracias al apoyo de marcas e instituciones líderes en sus respectivos sectores, que creen en el deporte, la resiliencia y el poder de la comunidad.
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    Cada patrocinador aporta experiencia, calidad y compromiso, haciendo posible que atletas locales e internacionales vivan una competencia segura, bien organizada y al nivel de un evento de clase mundial. Sin su apoyo, nada de esto sería posible.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Separator className="my-8" />

          {/* Vitrina por categoría */}
          <div className="space-y-14">
            {grupos.map(({ categoria, estilo, marcas }) => (
              <GrupoCategoria
                key={categoria.slug}
                titulo={estilo.encabezado || categoria.label}
                subtitulo={estilo.encabezado ? null : categoria.subtitle}
                nota={categoria.esPatrocinio ? null : 'Marcas presentes en el evento con activación propia.'}
                sponsors={marcas}
                estilo={estilo}
              />
            ))}

            {sinCategoria.length > 0 && (
              <GrupoCategoria
                titulo={grupos.length > 0 ? 'Otros patrocinadores' : 'Patrocinadores'}
                sponsors={sinCategoria}
                estilo={SIN_CATEGORIA}
              />
            )}
          </div>

          {/* Thank You Message */}
          <Card className="bg-gradient-to-br from-secondary/30 to-muted/30 border-border shadow-medium">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <IconSeguir className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-display text-2xl text-foreground">
                Gracias a Todos Nuestros Patrocinadores
              </h3>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Su compromiso hace posible que este evento sea una realidad. Juntos, estamos creando
                una experiencia inolvidable para todos los atletas y la comunidad.
              </p>
            </CardContent>
          </Card>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
