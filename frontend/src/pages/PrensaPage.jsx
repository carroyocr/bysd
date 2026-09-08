import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Newspaper, ExternalLink, Loader2, ArrowRight } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const fmtFecha = (iso) => {
  if (!iso) return '';
  const [a, m, d] = iso.split('-').map(Number);
  if (!a || !m || !d) return iso;
  return new Date(a, m - 1, d).toLocaleDateString('es-DO', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
};

/**
 * Sala de prensa: lo que se ha publicado sobre la carrera, de lo más reciente
 * a lo más viejo. Dos clases de nota en la misma lista, porque para quien la
 * consulta es lo mismo: el comunicado se lee aquí dentro y la aparición
 * manda al medio que la publicó.
 */
export default function PrensaPage() {
  const [notas, setNotas] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/prensa/notas`)
      .then((r) => (r.ok ? r.json() : { notas: [] }))
      .then((d) => setNotas(d.notas || []))
      .catch(() => setNotas([]))
      .finally(() => setCargando(false));
  }, []);

  return (
    // Mismo encabezado que Reglas, Patrocinadores y las demas: seccion con el
    // degradado, titulo centrado en la fuente de display y la bajada debajo.
    <section className="pt-16 pb-20 bg-gradient-to-b from-muted/20 to-background">
      <div className="container mx-auto px-4 py-10">
        <div className="max-w-3xl mx-auto">
          <div className="text-center space-y-4 mb-12">
            <h1 className="font-display text-4xl sm:text-5xl text-foreground">Prensa</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Comunicados de la organización y lo que se ha publicado sobre la carrera
            </p>
          </div>

          {cargando ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : notas.length === 0 ? (
            <div className="py-20 text-center">
              <Newspaper className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-40" />
              <p className="text-muted-foreground">Todavía no hay notas publicadas.</p>
            </div>
          ) : (
            <div className="divide-y divide-border" data-testid="lista-notas">
              {notas.map((n) => <Nota key={n.id} nota={n} />)}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// Una nota de la lista. Misma pinta para las dos clases: lo que cambia es a
// dónde lleva y quién la firma.
function Nota({ nota }) {
  const esAparicion = nota.tipo === 'aparicion';

  const interior = (
    <>
      {nota.imagen_url && (
        <img
          src={nota.imagen_url.startsWith('/api') ? `${API_URL}${nota.imagen_url}` : nota.imagen_url}
          alt=""
          loading="lazy"
          className="w-full sm:w-40 sm:shrink-0 aspect-[16/10] object-cover rounded-lg bg-muted"
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground mb-1.5">
          {fmtFecha(nota.fecha)}
          {esAparicion && nota.medio ? <> · <span className="font-medium text-foreground">{nota.medio}</span></> : null}
        </p>
        <h2 className="titular-nota text-lg sm:text-xl font-semibold leading-snug break-words group-hover:text-primary transition-colors">
          {nota.titulo}
        </h2>
        {nota.resumen && (
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{nota.resumen}</p>
        )}
        <span className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-primary">
          {esAparicion ? <>Leer en {nota.medio || 'el medio'}<ExternalLink className="w-3.5 h-3.5" /></>
            : <>Leer la nota<ArrowRight className="w-3.5 h-3.5" /></>}
        </span>
      </div>
    </>
  );

  const clases = 'group flex flex-col sm:flex-row gap-4 py-7 first:pt-0';

  return esAparicion ? (
    <a
      href={nota.url}
      target="_blank"
      rel="noopener noreferrer"
      className={clases}
      data-testid={`nota-${nota.slug}`}
    >
      {interior}
    </a>
  ) : (
    <Link to={`/prensa/${nota.slug}`} className={clases} data-testid={`nota-${nota.slug}`}>
      {interior}
    </Link>
  );
}
