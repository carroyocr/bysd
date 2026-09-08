import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Newspaper } from 'lucide-react';
import { fmtFecha } from './PrensaPage';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/** Un comunicado, para leerlo dentro del sitio. Las apariciones no pasan por
 *  aquí: esas se van al medio que las publicó. */
export default function NotaPrensaPage() {
  const { slug } = useParams();
  const [nota, setNota] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/prensa/notas/${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setNota)
      .catch(() => setNota(null))
      .finally(() => setCargando(false));
  }, [slug]);

  if (cargando) {
    return (
      <div className="flex justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!nota) {
    return (
      <div className="pt-20 pb-20 max-w-2xl mx-auto px-4 text-center">
        <Newspaper className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-40" />
        <h1 className="text-xl font-semibold mb-2">Nota no encontrada</h1>
        <p className="text-muted-foreground mb-6">
          El enlace puede estar incompleto o la nota ya no está publicada.
        </p>
        <Link to="/prensa" className="text-primary font-medium hover:underline">
          Ver todas las notas
        </Link>
      </div>
    );
  }

  const imagen = nota.imagen_url
    ? (nota.imagen_url.startsWith('/api') ? `${API_URL}${nota.imagen_url}` : nota.imagen_url)
    : null;

  return (
    <article className="pt-20 sm:pt-24 pb-20" data-testid="nota-prensa">
      <div className="max-w-2xl mx-auto px-4">
        <Link
          to="/prensa"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-8"
        >
          <ArrowLeft className="w-4 h-4" />Prensa
        </Link>

        <p className="text-sm text-muted-foreground">{fmtFecha(nota.fecha)}</p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight mt-2">
          {nota.titulo}
        </h1>
        {nota.resumen && (
          <p className="text-lg text-muted-foreground mt-4 leading-relaxed">{nota.resumen}</p>
        )}

        {imagen && (
          <img src={imagen} alt="" className="w-full rounded-xl mt-8 bg-muted" />
        )}

        {/* El texto lo escribe la organización desde el panel, con el mismo
            editor que los correos: llega como HTML ya formado. */}
        <div
          className="nota-prensa-cuerpo mt-8"
          dangerouslySetInnerHTML={{ __html: nota.contenido || '' }}
        />
      </div>
    </article>
  );
}
