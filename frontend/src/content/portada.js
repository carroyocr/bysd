// Fotos de la edición 2026 que visten la portada y la página del evento.
//
// Salen del álbum público de Google Photos, el mismo que lee `/api/album` para
// la página de Fotos; por eso las direcciones son de lh3.googleusercontent.com
// y valen mientras el álbum siga compartido. Se eligieron a mano por su
// encuadre (una vertical para la foto grande, horizontales para el resto), y
// `indice` es el sitio que ocupaba cada una en el álbum cuando se eligió.
//
// Las direcciones de Google no son para siempre: por eso la portada no se fía
// solo de la clave guardada aquí, sino que pide el álbum al backend
// (`lib/useAlbum.js`) y `resolverFotos` casa cada foto elegida con la que el
// álbum sirve hoy; si la clave ya no está, toma la del mismo sitio del álbum,
// y si el álbum no responde, prueba con la clave tal cual. Así la portada
// tiene fotos siempre que la página de Fotos las tenga.
//
// `ancho` es el que pide Google al servirla (`=w1400`), no el que ocupa en
// pantalla: pedir la original entera para una miniatura es tirar ancho de
// banda del visitante.

export const LH3 = 'https://lh3.googleusercontent.com/pw/';

export const direccionFoto = (foto, ancho) => `${foto.url || LH3 + foto.clave}=w${ancho}`;

export const FOTOS_PORTADA = [
  {
    indice: 308,
    clave: 'AP1GczM7lz1xSaTlN2RJ9F7IoLzJbb3-Sni5rUyMGRKakJfA6zkEeYBxbEw-TkAvsvGNG_riK56ZBZJGGADi_7dLBNBXLZ-7bDgHifRAKWpgNXVRgc8WVffn',
    alt: 'Corredor sonriendo en el circuito, edición 2026',
  },
  {
    indice: 280,
    clave: 'AP1GczMC1vt5v1GlzEF9HGSmF_NNo2DfPTRZ1AoPfM5PjR-YCgbAvWuHi-c7mA2_CfHOgOCLHNbpQr_eH2QVyWyfe-qeAs9E-dKlOsEE9AocFnwo06mnr44N',
    alt: 'Grupo de corredores bajo los árboles, edición 2026',
  },
  {
    indice: 434,
    clave: 'AP1GczMRq547EtwufBXhWlQIXhYj5E9oY8UZdK_QUzu3NH3zYf1sotCYBBPw36aubwUsRvdEn2f5o9_i0HydarM1aTsd7YfH7KcgcaTwienQ0GHXYXO7oJhN',
    alt: 'Dos corredores bajo el arco de salida de noche',
  },
  {
    indice: 602,
    clave: 'AP1GczOEvoCFq2nwhu6-I_CDwa-3uhsXfpgy0zOMfdv-QVoCm6rf2enA_KDeeb_lhSScb7ybV6KrYBjezulcXd_EhRoXXNZli9EIYgG_kCUrVvzt1KF3v3sV',
    alt: 'Edición 2026 del Backyard Ultra Santo Domingo',
  },
  {
    indice: 252,
    clave: 'AP1GczNa6Mm2E0o2b0sqPcVNPKl0Au--J3LlmrzRBPgAJ4uGVz7nh8Rsgiyl8lcOBBvkaROkuSYiCOGwTHZMhGu5USB5Z1vheiLq04qQ4nwwfIU9yY1VzSVN',
    alt: 'Edición 2026 del Backyard Ultra Santo Domingo',
  },
];

export const FOTOS_EVENTO = [
  {
    indice: 28,
    clave: 'AP1GczMFItypUWF33pPdwSgPr3s0My7VQuYeifFxzInm9KZy5zGPwoFyjNUVK8oFtw3NQj_nm3YXop7R4cit450ssoI5bkPvTEiMFqXdqT2S-i-MkN-z39TT',
    alt: 'El camino del circuito entre árboles',
    pie: 'El circuito, Sierra Prieta',
  },
  {
    indice: 490,
    clave: 'AP1GczNHuobzFh7WTxkrHhjBwISkdZmeMuTtckLMX4IRO8IpdkeSxTYKZ4dy6quI4BF5vNqNtpQ45e6VpA5txdp-s3FOwYEoczohKnaNn4BYEQwY-LXkamc_',
    alt: 'Corredores agrupados en el corral de salida',
    pie: 'La salida, cada hora en punto',
  },
  {
    indice: 434,
    clave: 'AP1GczMRq547EtwufBXhWlQIXhYj5E9oY8UZdK_QUzu3NH3zYf1sotCYBBPw36aubwUsRvdEn2f5o9_i0HydarM1aTsd7YfH7KcgcaTwienQ0GHXYXO7oJhN',
    alt: 'Dos corredores bajo el arco de salida de noche',
    pie: 'La noche, edición 2026',
  },
];

// Casa las fotos elegidas con las direcciones que el álbum sirve hoy.
//
// `album` es la lista de direcciones base (sin `=w…`) que devuelve
// `/api/album/photos`, en el orden del álbum; `null` mientras carga y `[]` si
// no se pudo leer. Devuelve las mismas fotos con `url` puesta:
//   - la del álbum que lleva la misma clave, si sigue ahí;
//   - si no, la que hoy ocupa su `indice` (o la siguiente que no se haya
//     usado ya, para no repetir una foto en el mismo mosaico);
//   - sin álbum, la clave guardada, y que `FotoAlbum` la esconda si falla.
export function resolverFotos(album, deseadas) {
  const usadas = new Set();
  return deseadas.map((foto) => {
    let url = null;
    if (album && album.length) {
      const porClave = album.find((u) => u.endsWith('/' + foto.clave));
      if (porClave && !usadas.has(porClave)) {
        url = porClave;
      } else {
        for (let salto = 0; salto < album.length; salto += 1) {
          const candidata = album[(foto.indice + salto) % album.length];
          if (!usadas.has(candidata)) {
            url = candidata;
            break;
          }
        }
      }
    }
    if (!url) url = LH3 + foto.clave;
    usadas.add(url);
    return { ...foto, url };
  });
}
