// Piezas comunes de las tarjetas para compartir (BIB y resultados).

const FUENTE = '-apple-system, Helvetica, Arial';

/**
 * Dónde seguir la carrera: la app, por su nombre y las dos tiendas.
 *
 * Va sin enlace a propósito. En una historia de Instagram un enlace escrito no
 * se puede pulsar, y la web en vivo no es donde queremos a la gente: buscar
 * "BYSD Live" en la tienda sí lleva a la app.
 */
export function dibujarDescargaApp(ctx, { x, y }) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#E77622';
  ctx.font = `800 44px ${FUENTE}`;
  ctx.fillText('Descarga la app BYSD Live', x, y);
  ctx.fillStyle = '#9a9a9a';
  ctx.font = `600 34px ${FUENTE}`;
  ctx.fillText('Disponible en App Store y Google Play', x, y + 55);
  ctx.restore();
}
