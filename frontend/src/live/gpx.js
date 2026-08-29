// Lectura del GPX de la ruta.
//
// Un GPX es XML: aquí solo se saca lo que la pantalla necesita —los puntos del
// track con su altura— y se calculan la distancia y el desnivel. No se usa
// ninguna librería: son treinta líneas y así la app no engorda por un archivo
// que se abre una vez.

const RADIO_TIERRA_KM = 6371;

const rad = (grados) => (grados * Math.PI) / 180;

/** Distancia entre dos puntos por la fórmula del semiverseno, en kilómetros. */
function distanciaKm(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * RADIO_TIERRA_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * Convierte el texto de un GPX en lo que dibuja la pantalla.
 *
 * Devuelve null si el archivo no trae puntos: la pantalla lo dice en vez de
 * enseñar un lienzo vacío.
 */
export function leerGpx(texto) {
  const doc = new DOMParser().parseFromString(texto, 'application/xml');
  if (doc.querySelector('parsererror')) return null;

  // `trkpt` es el track; si el archivo viniera solo con ruta planificada
  // (`rtept`), sirve igual.
  const nodos = [...doc.querySelectorAll('trkpt, rtept')];
  const puntos = nodos
    .map((n) => ({
      lat: parseFloat(n.getAttribute('lat')),
      lon: parseFloat(n.getAttribute('lon')),
      ele: parseFloat(n.querySelector('ele')?.textContent ?? 'NaN'),
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));

  if (puntos.length < 2) return null;

  // Distancia acumulada punto a punto: es lo que permite poner las marcas de
  // kilómetro y saber por dónde va el recorrido animado.
  const acumulado = [0];
  let total = 0;
  for (let i = 1; i < puntos.length; i += 1) {
    total += distanciaKm(puntos[i - 1], puntos[i]);
    acumulado.push(total);
  }

  const alturas = puntos.map((p) => p.ele).filter(Number.isFinite);

  // El desnivel se suma sobre la altura suavizada -media de cinco puntos-, no
  // sobre la cruda: el GPS baila medio metro arriba y abajo en llano y sumar
  // ese temblor infla la cuesta. Descartar en cambio los saltos pequeños uno a
  // uno tampoco vale: en un circuito suave *todos* los saltos son pequeños y
  // la cuenta daba cero metros de subida en una vuelta que sube veintisiete.
  const suave = alturas.map((_, i) => {
    const trozo = alturas.slice(Math.max(0, i - 2), i + 3);
    return trozo.reduce((a, b) => a + b, 0) / trozo.length;
  });
  let subida = 0;
  for (let i = 1; i < suave.length; i += 1) {
    const dif = suave[i] - suave[i - 1];
    if (dif > 0) subida += dif;
  }

  const lats = puntos.map((p) => p.lat);
  const lons = puntos.map((p) => p.lon);

  return {
    puntos,
    acumulado,
    distanciaKm: total,
    subidaM: Math.round(subida),
    alturaMin: alturas.length ? Math.min(...alturas) : null,
    alturaMax: alturas.length ? Math.max(...alturas) : null,
    nombre: doc.querySelector('trk > name, metadata > name')?.textContent?.trim() || null,
    limites: {
      latMin: Math.min(...lats),
      latMax: Math.max(...lats),
      lonMin: Math.min(...lons),
      lonMax: Math.max(...lons),
    },
  };
}

/**
 * Coloca los puntos en una caja de `ancho` x `alto` respetando la forma.
 *
 * Un grado de longitud mide menos que uno de latitud según se sube de
 * paralelo; sin corregirlo, un circuito redondo se dibuja aplastado.
 */
export function proyectar(ruta, ancho, alto, margen = 14) {
  const { limites } = ruta;
  const latMedia = (limites.latMin + limites.latMax) / 2;
  const escalaLon = Math.cos(rad(latMedia));

  const anchoGeo = Math.max((limites.lonMax - limites.lonMin) * escalaLon, 1e-9);
  const altoGeo = Math.max(limites.latMax - limites.latMin, 1e-9);
  const escala = Math.min((ancho - margen * 2) / anchoGeo, (alto - margen * 2) / altoGeo);

  const desplazaX = (ancho - anchoGeo * escala) / 2;
  const desplazaY = (alto - altoGeo * escala) / 2;

  return ruta.puntos.map((p) => ({
    x: desplazaX + (p.lon - limites.lonMin) * escalaLon * escala,
    // La latitud crece hacia el norte y la pantalla hacia abajo: se invierte.
    y: desplazaY + (limites.latMax - p.lat) * escala,
  }));
}
