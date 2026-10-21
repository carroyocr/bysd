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

// Diferencia con signo, en mm:ss: «+1:23» más lento, «−0:45» más rápido.
export function formatoDiferencia(segundos) {
  if (segundos == null || Number.isNaN(segundos)) return '—';
  const s = Math.round(segundos);
  if (s === 0) return '0:00';
  const abs = Math.abs(s);
  return `${s < 0 ? '−' : '+'}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')}`;
}

// Hora del reloj («HH:MM») a tantos minutos de la salida. `salidaIso` es la
// salida con su zona («2026-10-17T08:00:00-04:00»): se toma la hora tal como
// viene, que ya es la de la sede, y no se pasa por la zona del navegador.
export function horaDesde(salidaIso, minutos, conSegundos = false) {
  const m = typeof salidaIso === 'string' && salidaIso.match(/T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m || minutos == null) return '—';
  const total = ((Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3] || 0) + Math.round(minutos * 60)) % 86400 + 86400) % 86400;
  const hh = String(Math.floor(total / 3600)).padStart(2, '0');
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return conSegundos ? `${hh}:${mm}:${ss}` : `${hh}:${mm}`;
}

// El detalle vuelta a vuelta de un corredor: hora de salida y de llegada,
// tiempo, diferencia con su promedio y con la vuelta anterior, y cuánto
// descansó antes de la siguiente salida.
export function detalleVueltas(c, salidaIso, minutosPorVuelta = 60) {
  const t = c.tiempos || [];
  const promedio = media(validos(t));
  let anterior = null;
  return t.map((tiempo, i) => {
    const inicio = i * minutosPorVuelta;
    const fila = {
      vuelta: i + 1,
      salida: horaDesde(salidaIso, inicio),
      llegada: tiempo == null ? '—' : horaDesde(salidaIso, inicio + tiempo / 60, true),
      tiempo,
      difPromedio: tiempo == null || promedio == null ? null : tiempo - promedio,
      difAnterior: tiempo == null || anterior == null ? null : tiempo - anterior,
      descanso: tiempo == null ? null : minutosPorVuelta * 60 - tiempo,
    };
    if (tiempo != null) anterior = tiempo;
    return fila;
  });
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
