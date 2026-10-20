import { resumen, porVuelta, porCorredor, formatoTiempo, formatoHoras } from './estadisticasCarrera';

const corredores = [
  { bib: '001', nombre: 'Ana', apellidos: 'Pérez', status: 'winner', vueltas: 3, tiempos: [3000, 3100, 2900] },
  { bib: '002', nombre: 'Luis', apellidos: 'Gómez', status: 'retired', vueltas: 2, tiempos: [3200, null] },
  { bib: '003', nombre: 'Eva', apellidos: 'Ruiz', status: 'retired', vueltas: 0, tiempos: [] },
];

test('formatos', () => {
  expect(formatoTiempo(3125)).toBe('52:05');
  expect(formatoTiempo(null)).toBe('—');
  expect(formatoHoras(26)).toBe('26 h');
  expect(formatoHoras(3, 30)).toBe('1 h 30 min');
});

test('por corredor: medias solo con los tiempos conocidos', () => {
  const luis = porCorredor(corredores[1]);
  expect(luis.nombreCompleto).toBe('Luis Gómez');
  expect(luis.media).toBe(3200);
  expect(luis.conTiempo).toBe(1);
  const ana = porCorredor(corredores[0]);
  expect(ana.mejor).toBe(2900);
  expect(ana.mejorVuelta).toBe(3);
  expect(ana.peor).toBe(3100);
});

test('por vuelta: en pie y tiempos de cada vuelta', () => {
  const filas = porVuelta(corredores);
  expect(filas.map((f) => f.enPie)).toEqual([2, 2, 1]);
  expect(filas[0].media).toBe(3100);
  expect(filas[0].minimo).toBe(3000);
  expect(filas[0].maximo).toBe(3200);
  // La segunda vuelta de Luis no tiene hora: no entra en la media
  expect(filas[1].media).toBe(3100);
  expect(filas[1].conTiempo).toBe(1);
});

test('resumen del conjunto', () => {
  const r = resumen(corredores, { km_por_vuelta: 6.706 });
  expect(r.ganador.bib).toBe('001');
  expect(r.totalVueltas).toBe(5);
  expect(r.totalKm).toBe(33.5);
  expect(r.participantes).toBe(3);
  expect(r.masDeUnDia).toBe(0);
  expect(r.masRapida).toMatchObject({ segundos: 2900, vuelta: 3 });
  expect(r.masRapida.corredor.bib).toBe('001');
  expect(r.tiempoMedio).toBe((3000 + 3100 + 2900 + 3200) / 4);
  expect(r.vueltas).toHaveLength(3);
});

test('sin ganador marcado, gana quien más vueltas tiene', () => {
  const sinMarca = corredores.map((c) => ({ ...c, status: 'retired' }));
  expect(resumen(sinMarca).ganador.bib).toBe('001');
  expect(resumen([]).ganador).toBeNull();
});

test('detalle vuelta a vuelta', () => {
  const { detalleVueltas, formatoDiferencia, horaDesde } = require('./estadisticasCarrera');
  expect(horaDesde('2026-10-17T08:00:00-04:00', 90)).toBe('09:30');
  expect(horaDesde('2026-10-17T08:00:00-04:00', 16 * 60 + 0.5, true)).toBe('00:00:30');
  expect(horaDesde(null, 10)).toBe('—');
  expect(formatoDiferencia(83)).toBe('+1:23');
  expect(formatoDiferencia(-45)).toBe('−0:45');
  expect(formatoDiferencia(0)).toBe('0:00');
  const filas = detalleVueltas({ tiempos: [3000, null, 3120] }, '2026-10-17T08:00:00-04:00', 60);
  expect(filas).toHaveLength(3);
  expect(filas[0]).toMatchObject({ vuelta: 1, salida: '08:00', llegada: '08:50:00', tiempo: 3000, difPromedio: -60, difAnterior: null, descanso: 600 });
  expect(filas[1]).toMatchObject({ vuelta: 2, salida: '09:00', llegada: '—', tiempo: null, difPromedio: null, descanso: null });
  // La tercera se compara con la última con hora, no con el hueco
  expect(filas[2]).toMatchObject({ vuelta: 3, salida: '10:00', llegada: '10:52:00', difAnterior: 120, difPromedio: 60, descanso: 480 });
});
