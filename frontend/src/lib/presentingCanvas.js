import { getPresenting, ETIQUETA_PRESENTING } from './presenting';

// El bloque "PRESENTED BY <marca>" para las tarjetas que se dibujan en canvas
// y se comparten (dorsal y resultados del corredor). Es el mismo naming que
// enseña el sitio, en versión mapa de bits: en un canvas no se puede pintar el
// SVG del logo directamente, así que se usa el PNG.

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
    img.src = marca.logoPng;
  });
}

/**
 * Pinta el bloque centrado en `x`, con `y` como línea base del rótulo. El logo
 * va sobre una placa blanca: las tarjetas son negras y el logo es azul oscuro.
 *
 * Los tamaños se pueden apretar (`anchoLogo`, `rotulo`, `margen`, `separacion`)
 * para cuando el bloque no cierra la tarjeta, sino que es una línea pequeña
 * bajo el nombre de la carrera.
 */
export function dibujarPresenting(ctx, cargado, { x, y, anchoLogo = 280, rotulo = 28, margen = 24, separacion = 22 }) {
  if (!cargado) return;

  const { img } = cargado;
  const alto = (img.height / img.width) * anchoLogo;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#9a9a9a';
  ctx.font = `700 ${rotulo}px -apple-system, Helvetica, Arial`;
  ctx.fillText(ETIQUETA_PRESENTING, x, y);

  const placaY = y + separacion;
  ctx.beginPath();
  ctx.roundRect(x - anchoLogo / 2 - margen, placaY, anchoLogo + margen * 2, alto + margen, 16);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.drawImage(img, x - anchoLogo / 2, placaY + margen / 2, anchoLogo, alto);
  ctx.restore();
}
