// Estadísticas de una carrera a partir de lo que devuelve
// `GET /api/race/resultados`: por corredor, por vuelta y del conjunto.
//
// Todo es puro y sin red, para poder probarlo (`estadisticasCarrera.test.js`).
// Los tiempos vienen en segundos por vuelta completada, y `null` cuando el
// libro de vueltas no tiene la hora real de esa vuelta: esas vueltas cuentan
// como vueltas (y como km) pero quedan fuera de cualquier promedio.

const validos = (tiempos) => (tiempos || []).filter((t) => typeof t === 'number' && t >= 0);

const media = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

const mediana = (xs) => {
  if (!xs.length) return null;
  const orden = [...xs].sort((a, b) => a - b);
  const m = Math.floor(orden.length / 2);
  return orden.length % 2 ? orden[m] : (orden[m - 1] + orden[m]) / 2;
};

export const nombreCompleto = (c) => [c.nombre, c.apellidos].filter(Boolean).join(' ').trim();

// mm:ss de un tiempo en segundos; «—» si no se sabe.
export function formatoTiempo(segundos) {
  if (segundos == null || Number.isNaN(segundos)) return '—';
  const s = Math.round(segundos);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// Horas en carrera a partir de las vueltas: cada vuelta es una hora de reloj.
export function formatoHoras(vueltas, minutosPorVuelta = 60) {
  const minutos = (vueltas || 0) * minutosPorVuelta;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function porCorredor(c) {
  const t = validos(c.tiempos);
  const mejor = t.length ? Math.min(...t) : null;
  return {
    ...c,
    nombreCompleto: nombreCompleto(c),
    media: media(t),
    mejor,
    mejorVuelta: mejor == null ? null : (c.tiempos || []).indexOf(mejor) + 1,
    peor: t.length ? Math.max(...t) : null,
    conTiempo: t.length,
  };
}

// Para cada vuelta n (1..máxima): cuántos la completaron, y la media, la
// más rápida y la más lenta de los tiempos conocidos.
export function porVuelta(corredores) {
  const maximo = Math.max(0, ...corredores.map((c) => c.vueltas || 0));
  const filas = [];
  for (let n = 1; n <= maximo; n += 1) {
    const enPie = corredores.filter((c) => (c.vueltas || 0) >= n).length;
    const t = validos(corredores.map((c) => (c.tiempos || [])[n - 1]));
    filas.push({
      vuelta: n,
      enPie,
      media: media(t),
      minimo: t.length ? Math.min(...t) : null,
      maximo: t.length ? Math.max(...t) : null,
      conTiempo: t.length,
    });
  }
  return filas;
}

export function resumen(corredores, carrera = {}) {
  const kmPorVuelta = carrera.km_por_vuelta || 6.706;
  const fichas = corredores.map(porCorredor);
  const conVueltas = fichas.filter((c) => c.vueltas > 0);
  const ganador = fichas.find((c) => c.status === 'winner') || (conVueltas.length ? conVueltas.reduce((a, b) => (b.vueltas > a.vueltas ? b : a)) : null);
  const totalVueltas = fichas.reduce((s, c) => s + (c.vueltas || 0), 0);
  const todos = validos(fichas.flatMap((c) => c.tiempos || []));
  let masRapida = null;
  fichas.forEach((c) => {
    if (c.mejor != null && (masRapida == null || c.mejor < masRapida.segundos)) {
      masRapida = { segundos: c.mejor, corredor: c, vuelta: c.mejorVuelta };
    }
  });
  const vueltasPorCorredor = fichas.map((c) => c.vueltas || 0);
  return {
    ganador,
    corredores: fichas,
    participantes: fichas.length,
    totalVueltas,
    totalKm: Math.round(totalVueltas * kmPorVuelta * 10) / 10,
    promedioVueltas: media(vueltasPorCorredor),
    medianaVueltas: mediana(vueltasPorCorredor),
    masDeUnDia: fichas.filter((c) => (c.vueltas || 0) >= 24).length,
    tiempoMedio: media(todos),
    tiempoMediana: mediana(todos),
    masRapida,
    masLenta: todos.length ? Math.max(...todos) : null,
    vueltas: porVuelta(fichas),
  };
}
