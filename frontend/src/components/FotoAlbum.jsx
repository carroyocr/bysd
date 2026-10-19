import React, { useState } from 'react';
import { direccionFoto } from '../content/portada';

// Una foto del álbum de Google Photos (ver `content/portada.js`). Si Google no
// la sirve —el álbum dejó de estar compartido, o la foto se borró— se quita
// del todo: una imagen rota en la portada se nota más que una que falta.
export default function FotoAlbum({ foto, ancho = 1200, className = '', loading = 'lazy' }) {
  const [rota, setRota] = useState(false);
  if (rota) return null;
  return (
    <img
      src={direccionFoto(foto.clave, ancho)}
      alt={foto.alt}
      loading={loading}
      className={className}
      onError={() => setRota(true)}
    />
  );
}
