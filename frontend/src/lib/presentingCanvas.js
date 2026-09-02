import { getPresenting, logoPara, ETIQUETA_PRESENTING } from './presenting';

// El bloque "PRESENTED BY <marca>" para las tarjetas que se dibujan en canvas
// y se comparten (dorsal y resultados del corredor). Es el mismo naming que
// enseña el sitio, en versión mapa de bits: en un canvas no se puede pintar el
// SVG del logo directamente, así que se usa el PNG. Las tarjetas son negras,
// así que va siempre la versión en blanco de la marca.

/**
 * Carga el logo del naming de la carrera. Resuelve a null si esa carrera no
 * tiene naming o si la imagen no llega: la tarjeta se dibuja igual, sin bloque.
 */
export function cargarPresenting(raceCode) {
  const marca = getPresenting(raceCode);
  if (!marca) return Promise.resolve(null);

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ marca, img });
    img.onerror = () => resolve(null);
    img.src = logoPara(marca, { oscuro: true, png: true });
  });
}

/**
 * Pinta el bloque centrado en `x`, con `y` como línea base del rótulo. El logo
 * se apoya directo en el fondo negro de la tarjeta: viene ya en blanco, y la
 * placa blanca que llevaba antes era un parche por no tener esa versión.
 *
 * Los tamaños se pueden apretar (`anchoLogo`, `rotulo`, `separacion`) para
 * cuando el bloque no cierra la tarjeta, sino que es una línea pequeña bajo el
 * nombre de la carrera.
 */
export function dibujarPresenting(ctx, cargado, { x, y, anchoLogo = 280, rotulo = 28, separacion = 34 }) {
  if (!cargado) return;

  const { img } = cargado;
  const alto = (img.height / img.width) * anchoLogo;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#9a9a9a';
  ctx.font = `700 ${rotulo}px -apple-system, Helvetica, Arial`;
  ctx.fillText(ETIQUETA_PRESENTING, x, y);

  ctx.drawImage(img, x - anchoLogo / 2, y + separacion, anchoLogo, alto);
  ctx.restore();
}
