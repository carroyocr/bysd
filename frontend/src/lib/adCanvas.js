import { API, getJson } from '../live/liveApi';

// El patrocinador que viaja en las imágenes que comparte el corredor.
//
// Es el mismo pie de publicidad de la app, dibujado en el lienzo: quien manda
// su historia a Instagram lleva la marca con él, que es donde la publicidad de
// una carrera de verdad vale algo. Se elige uno al azar entre los publicados,
// con su peso, para que a la larga salgan todos y no siempre el primero.

/** Carga una imagen para el lienzo sin contaminarlo (hace falta CORS). */
function cargarImagen(url) {
  return new Promise((resolve) => {
    const img = new Image();
    // Sin esto el lienzo queda "sucio" y `toBlob` revienta al exportar: la
    // imagen viene del backend, que es otro origen.
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    // El `?lienzo=1` no es un capricho: el pie de la app ya bajó esta misma
    // imagen con una etiqueta <img> normal, sin CORS, y el navegador guarda esa
    // respuesta sin permiso de lectura. Al pedirla otra vez con CORS reutiliza
    // la copia guardada y la rechaza, así que el logo no se dibujaba. Con la
    // dirección distinta se baja una copia propia, ya con permiso.
    img.src = `${url}${url.includes('?') ? '&' : '?'}lienzo=1`;
  });
}

/**
 * Elige un banner al azar (ponderado) y trae su imagen.
 * Devuelve null si la carrera no tiene publicidad o si algo falla: la tarjeta
 * se dibuja igual, sin la banda.
 */
export async function cargarAnuncio(raceCode) {
  try {
    const { banners } = await getJson(`/api/ads/pie${raceCode ? `?race_code=${raceCode}` : ''}`);
    const baraja = [];
    (banners || []).forEach((b) => {
      for (let i = 0; i < Math.max(1, b.weight || 1); i += 1) baraja.push(b);
    });
    if (!baraja.length) return null;

    const ad = baraja[Math.floor(Math.random() * baraja.length)];
    const ruta = ad.banner_url || ad.logo_url;
    const img = ruta ? await cargarImagen(`${API}${ruta}`) : null;
    return { ad, img, esBanner: !!ad.banner_url && !!img };
  } catch {
    return null;
  }
}

function caja(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/**
 * Pinta la banda del patrocinador. Con pieza completa la usa tal cual,
 * recortada a la caja; si el patrocinador solo tiene logo, se compone la banda
 * aquí mismo: placa blanca, logo a la izquierda y su nombre al lado.
 */
export function dibujarAnuncio(ctx, anuncio, { x, y, w, h }) {
  if (!anuncio) return;
  const { ad, img, esBanner } = anuncio;

  ctx.save();
  caja(ctx, x, y, w, h, 20);
  ctx.clip();

  if (esBanner) {
    // Cubrir la caja sin deformar la pieza del patrocinador.
    const escala = Math.max(w / img.width, h / img.height);
    const ancho = img.width * escala;
    const alto = img.height * escala;
    ctx.drawImage(img, x + (w - ancho) / 2, y + (h - alto) / 2, ancho, alto);
  } else {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x, y, w, h);

    const lado = h - 36;
    if (img) {
      // Contenido dentro de su cuadro: los logos vienen de todas las formas.
      const escala = Math.min(lado / img.width, lado / img.height);
      const ancho = img.width * escala;
      const alto = img.height * escala;
      ctx.drawImage(img, x + 18 + (lado - ancho) / 2, y + 18 + (lado - alto) / 2, ancho, alto);
    }

    const textoX = x + 18 + lado + 24;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#111111';
    ctx.font = '800 38px -apple-system, Helvetica, Arial';
    ctx.fillText(ad.name || '', textoX, y + h / 2 - (ad.text ? 4 : -12), w - (textoX - x) - 24);
    if (ad.text) {
      ctx.fillStyle = '#666666';
      ctx.font = '600 30px -apple-system, Helvetica, Arial';
      ctx.fillText(ad.text, textoX, y + h / 2 + 40, w - (textoX - x) - 24);
    }
  }
  ctx.restore();

  // La nota, en voz baja, como en el pie de la app: tiene que distinguirse de
  // lo que es contenido, sin quitarle sitio al patrocinador.
  if (ad.mostrar_marca !== false) {
    ctx.save();
    ctx.textAlign = 'right';
    ctx.fillStyle = esBanner ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.35)';
    ctx.font = '700 18px -apple-system, Helvetica, Arial';
    ctx.fillText('PATROCINADOR', x + w - 16, y + 28);
    ctx.restore();
  }
}
