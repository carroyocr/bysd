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

/** Posición en el mapa del mundo de Web Mercator, de 0 a 1 en cada eje. */
function mercator(lat, lon) {
  const seno = Math.sin(rad(lat));
  return {
    x: (lon + 180) / 360,
    y: 0.5 - Math.log((1 + seno) / (1 - seno)) / (4 * Math.PI),
  };
}

/**
 * Coloca los puntos en una caja de `ancho` x `alto` respetando la forma.
 *
 * Se proyecta en Web Mercator, la misma proyección de los mosaicos del mapa:
 * así el trazado cae justo encima de los caminos de la foto. Además de los
 * puntos devuelve el encuadre (`escala`, `x0`, `y0`), que es lo que necesita
 * `mosaicos` para colocar el mapa debajo.
 */
export function encuadrar(ruta, ancho, alto, margen = 14) {
  const mundo = ruta.puntos.map((p) => mercator(p.lat, p.lon));
  const xs = mundo.map((m) => m.x);
  const ys = mundo.map((m) => m.y);
  const xMin = Math.min(...xs);
  const yMin = Math.min(...ys);
  const anchoM = Math.max(Math.max(...xs) - xMin, 1e-12);
  const altoM = Math.max(Math.max(...ys) - yMin, 1e-12);

  const escala = Math.min((ancho - margen * 2) / anchoM, (alto - margen * 2) / altoM);
  // El punto del mundo que queda en la esquina superior izquierda de la caja,
  // con el trazado centrado.
  const x0 = xMin - (ancho / escala - anchoM) / 2;
  const y0 = yMin - (alto / escala - altoM) / 2;

  return {
    puntos: mundo.map((m) => ({ x: (m.x - x0) * escala, y: (m.y - y0) * escala })),
    escala,
    x0,
    y0,
  };
}

/**
 * Los mosaicos de mapa que cubren la caja entera, ya colocados en ella.
 *
 * El zoom se elige para que cada mosaico ocupe como mucho `lado` unidades de
 * la caja: con menos se ve borroso en pantallas de alta densidad, con más se
 * piden mosaicos de sobra.
 */
export function mosaicos({ escala, x0, y0 }, ancho, alto, { lado = 80, zoomMax = 18 } = {}) {
  const z = Math.max(0, Math.min(zoomMax, Math.ceil(Math.log2(escala / lado))));
  const n = 2 ** z;
  const tamano = escala / n;
  const lista = [];
  for (let y = Math.floor(y0 * n); y <= Math.floor((y0 + alto / escala) * n); y += 1) {
    if (y < 0 || y >= n) continue;
    for (let x = Math.floor(x0 * n); x <= Math.floor((x0 + ancho / escala) * n); x += 1) {
      lista.push({
        z, x: ((x % n) + n) % n, y,
        px: (x / n - x0) * escala,
        py: (y / n - y0) * escala,
        tamano,
      });
    }
  }
  return lista;
}
