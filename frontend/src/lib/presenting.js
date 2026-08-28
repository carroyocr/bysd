// Patrocinador Título (naming) de cada carrera: la marca que acompaña al logo
// del evento en todo el sitio, la app y los correos.
//
// Va por código de carrera y no en la base porque es una decisión de marca por
// edición: la carrera de 2027 la presenta CEDIMAT, y las anteriores no llevan
// nada. Cuando entre el naming de la próxima edición, se agrega una línea aquí
// (y su gemela en `backend/services/marca.py`, que es la que usan los correos).
//
// El logo se sirve desde `public/sponsors/`: el SVG para pantalla y el PNG para
// donde no se puede usar SVG (correos, miniaturas).

export const PRESENTING_POR_CARRERA = {
  'BYSD-2027': {
    nombre: 'CEDIMAT',
    descripcion: 'CEDIMAT Plaza de la Salud',
    logo: '/sponsors/cedimat.svg',
    logoPng: '/sponsors/cedimat.png',
    web: 'https://cedimat.com',
  },
};

// El rótulo va en inglés porque así está el arte oficial de la carrera.
export const ETIQUETA_PRESENTING = 'PRESENTED BY';

export const getPresenting = (raceCode) =>
  PRESENTING_POR_CARRERA[(raceCode || '').toUpperCase()] || null;
