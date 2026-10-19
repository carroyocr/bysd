// Fotos de la edición 2026 que visten la portada y la página del evento.
//
// Salen del álbum público de Google Photos, el mismo que lee `/api/album` para
// la página de Fotos; por eso las direcciones son de lh3.googleusercontent.com
// y valen mientras el álbum siga compartido. Se eligieron a mano por su
// encuadre (una vertical para la foto grande, horizontales para el resto). Si
// alguna deja de cargar, `FotoAlbum` la oculta en vez de dejar un hueco roto.
//
// `ancho` es el que pide Google al servirla (`=w1400`), no el que ocupa en
// pantalla: pedir la original entera para una miniatura es tirar ancho de
// banda del visitante.

const LH3 = 'https://lh3.googleusercontent.com/pw/';

export const direccionFoto = (clave, ancho) => `${LH3}${clave}=w${ancho}`;

export const FOTOS_PORTADA = {
  grande: {
    clave: 'AP1GczM7lz1xSaTlN2RJ9F7IoLzJbb3-Sni5rUyMGRKakJfA6zkEeYBxbEw-TkAvsvGNG_riK56ZBZJGGADi_7dLBNBXLZ-7bDgHifRAKWpgNXVRgc8WVffn',
    alt: 'Corredor sonriendo en el circuito, edición 2026',
  },
  chica: {
    clave: 'AP1GczMC1vt5v1GlzEF9HGSmF_NNo2DfPTRZ1AoPfM5PjR-YCgbAvWuHi-c7mA2_CfHOgOCLHNbpQr_eH2QVyWyfe-qeAs9E-dKlOsEE9AocFnwo06mnr44N',
    alt: 'Grupo de corredores bajo los árboles, edición 2026',
  },
};

export const FOTOS_EVENTO = [
  {
    clave: 'AP1GczMFItypUWF33pPdwSgPr3s0My7VQuYeifFxzInm9KZy5zGPwoFyjNUVK8oFtw3NQj_nm3YXop7R4cit450ssoI5bkPvTEiMFqXdqT2S-i-MkN-z39TT',
    alt: 'El camino del circuito entre árboles',
    pie: 'El circuito, Sierra Prieta',
  },
  {
    clave: 'AP1GczNHuobzFh7WTxkrHhjBwISkdZmeMuTtckLMX4IRO8IpdkeSxTYKZ4dy6quI4BF5vNqNtpQ45e6VpA5txdp-s3FOwYEoczohKnaNn4BYEQwY-LXkamc_',
    alt: 'Corredores agrupados en el corral de salida',
    pie: 'La salida, cada hora en punto',
  },
  {
    clave: 'AP1GczMRq547EtwufBXhWlQIXhYj5E9oY8UZdK_QUzu3NH3zYf1sotCYBBPw36aubwUsRvdEn2f5o9_i0HydarM1aTsd7YfH7KcgcaTwienQ0GHXYXO7oJhN',
    alt: 'Dos corredores bajo el arco de salida de noche',
    pie: 'La noche, edición 2026',
  },
];
