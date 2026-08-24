import React from 'react';
import { Watch } from 'lucide-react';

// Los tres sitios donde vive BYSD Live. Van dentro del Hero, sin scroll: son
// un botón cada uno, casi todo icono. Android sigue en prueba cerrada de Play,
// así que se ve apagado y sin enlace hasta que salga.
const TIENDAS = [
  {
    id: 'ios',
    nombre: 'App Store',
    url: 'https://apps.apple.com/do/app/bysd-live/id6802661105',
    icono: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6" aria-hidden="true">
        <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
      </svg>
    ),
  },
  {
    id: 'android',
    nombre: 'Google Play',
    url: null,
    aviso: 'Próximamente',
    icono: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6" aria-hidden="true">
        <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.198l2.807 1.626a1 1 0 010 1.73l-2.808 1.626L15.198 12l2.5-2.491zM5.864 2.658L16.802 8.99l-2.303 2.303-8.635-8.635z" />
      </svg>
    ),
  },
  {
    id: 'garmin',
    nombre: 'Garmin',
    url: 'https://apps.garmin.com/es-ES/apps/39077413-5fe7-438d-b932-d85cea576a0f',
    icono: <Watch className="w-6 h-6" aria-hidden="true" />,
  },
];

const TARJETA =
  'flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card shadow-soft';

export default function DescargarApp() {
  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3 justify-center lg:justify-start">
      {TIENDAS.map((tienda) =>
        tienda.url ? (
          <a
            key={tienda.id}
            href={tienda.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`${TARJETA} hover:shadow-medium hover:border-primary transition-all duration-300 group`}
            aria-label={`Descargar BYSD Live en ${tienda.nombre}`}
            data-testid={`descargar-${tienda.id}`}
          >
            <span className="text-primary flex-shrink-0 group-hover:scale-110 transition-transform">
              {tienda.icono}
            </span>
            <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors whitespace-nowrap">
              {tienda.nombre}
            </span>
          </a>
        ) : (
          <div
            key={tienda.id}
            className={`${TARJETA} opacity-50 cursor-not-allowed`}
            aria-disabled="true"
            aria-label={`${tienda.nombre}: ${tienda.aviso}`}
            title={tienda.aviso}
            data-testid={`descargar-${tienda.id}`}
          >
            <span className="text-muted-foreground flex-shrink-0">{tienda.icono}</span>
            <span className="text-xs font-bold text-foreground whitespace-nowrap">
              {tienda.nombre}
            </span>
          </div>
        )
      )}
    </div>
  );
}
