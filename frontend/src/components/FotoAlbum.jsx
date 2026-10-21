import React, { useState } from 'react';
import { direccionFoto } from '../content/portada';

// Una foto del álbum de Google Photos (ver `content/portada.js`), ya resuelta
// con `resolverFotos` (lleva `url`) o, si no, por su clave. Si Google no la
// sirve —el álbum dejó de estar compartido, o la foto se borró— se quita del
// todo: una imagen rota en la portada se nota más que una que falta.
export default function FotoAlbum({ foto, ancho = 1200, className = '', loading = 'lazy' }) {
  const [rota, setRota] = useState(false);
  const src = direccionFoto(foto, ancho);
  if (rota === src) return null;
  return (
    <img
      src={src}
      alt={foto.alt}
      loading={loading}
      className={className}
      onError={() => setRota(src)}
    />
  );
}
