import React from 'react';
import { Watch } from 'lucide-react';
import { Badge } from './ui/badge';

// Las tres tiendas donde vive la app. Android sigue en prueba cerrada de Play,
// así que se muestra igual que las demás pero sin enlace: la gente pregunta por
// ella y es mejor decir "viene en camino" que no decir nada.
const TIENDAS = [
  {
    id: 'ios',
    nombre: 'App Store',
    detalle: 'iPhone y iPad',
    url: 'https://apps.apple.com/do/app/bysd-live/id6802661105',
    icono: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7" aria-hidden="true">
        <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
      </svg>
    ),
  },
  {
    id: 'android',
    nombre: 'Google Play',
    detalle: 'Android',
    url: null,
    aviso: 'Próximamente',
    icono: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7" aria-hidden="true">
        <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.198l2.807 1.626a1 1 0 010 1.73l-2.808 1.626L15.198 12l2.5-2.491zM5.864 2.658L16.802 8.99l-2.303 2.303-8.635-8.635z" />
      </svg>
    ),
  },
  {
    id: 'garmin',
    nombre: 'Connect IQ',
    detalle: 'Relojes Garmin',
    url: 'https://apps.garmin.com/es-ES/apps/39077413-5fe7-438d-b932-d85cea576a0f',
    icono: <Watch className="w-7 h-7" aria-hidden="true" />,
  },
];

const BASE_TARJETA =
  'flex items-center gap-4 px-5 py-4 rounded-lg border border-border bg-card shadow-soft text-left w-full';

export default function DescargarApp() {
  return (
    <section className="py-16 sm:py-20 bg-secondary/20 border-t border-border">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <Badge className="bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold shadow-soft">
            BYSD Live
          </Badge>
          <h2 className="font-display text-3xl sm:text-4xl text-foreground">
            Descarga la app
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Sigue la carrera vuelta a vuelta desde el teléfono o desde el reloj: quién sigue en
            pie, en qué vuelta va cada corredor y los avisos de la organización.
          </p>
        </div>

        <div className="max-w-4xl mx-auto mt-10 grid gap-4 sm:grid-cols-3">
          {TIENDAS.map((tienda) =>
            tienda.url ? (
              <a
                key={tienda.id}
                href={tienda.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`${BASE_TARJETA} hover:shadow-medium hover:border-primary transition-all duration-300 group`}
                data-testid={`descargar-${tienda.id}`}
              >
                <span className="text-primary flex-shrink-0 group-hover:scale-110 transition-transform">
                  {tienda.icono}
                </span>
                <span>
                  <span className="block text-xs text-muted-foreground font-medium">
                    Descargar en
                  </span>
                  <span className="block text-base font-bold text-foreground group-hover:text-primary transition-colors">
                    {tienda.nombre}
                  </span>
                  <span className="block text-xs text-muted-foreground">{tienda.detalle}</span>
                </span>
              </a>
            ) : (
              <div
                key={tienda.id}
                className={`${BASE_TARJETA} opacity-60 cursor-not-allowed`}
                aria-disabled="true"
                title={tienda.aviso}
                data-testid={`descargar-${tienda.id}`}
              >
                <span className="text-muted-foreground flex-shrink-0">{tienda.icono}</span>
                <span>
                  <span className="block text-xs text-muted-foreground font-medium">
                    {tienda.aviso}
                  </span>
                  <span className="block text-base font-bold text-foreground">{tienda.nombre}</span>
                  <span className="block text-xs text-muted-foreground">{tienda.detalle}</span>
                </span>
              </div>
            )
          )}
        </div>
      </div>
    </section>
  );
}
