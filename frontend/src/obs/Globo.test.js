import { globoDe, relojForzado } from './Globo';

describe('globoDe', () => {
  it('no hay globo fuera de los últimos tres minutos', () => {
    expect(globoDe(null)).toBeNull();
    expect(globoDe(181)).toBeNull();
    expect(globoDe(3600)).toBeNull();
    expect(globoDe(0)).toBeNull();
    expect(globoDe(-4)).toBeNull();
  });

  it('a 3:00 aparece el amarillo entero y se vacía hasta 2:00', () => {
    expect(globoDe(180)).toEqual({ minuto: 3, color: 'amarillo', fraccion: 1 });
    expect(globoDe(150).fraccion).toBeCloseTo(0.5);
    expect(globoDe(121)).toMatchObject({ minuto: 3, fraccion: 1 / 60 });
  });

  it('a 2:00 entra el naranja entero y a 1:00 el rojo', () => {
    expect(globoDe(120)).toEqual({ minuto: 2, color: 'naranja', fraccion: 1 });
    expect(globoDe(60)).toEqual({ minuto: 1, color: 'rojo', fraccion: 1 });
    expect(globoDe(1)).toMatchObject({ minuto: 1, color: 'rojo' });
  });
});

describe('relojForzado', () => {
  const inicio = '2027-01-23T07:00:00-04:00';
  const t = (iso) => new Date(iso).getTime();

  it('antes de la salida cuenta hasta la hora forzada', () => {
    const r = relojForzado(inicio, 60, t('2027-01-23T06:30:00-04:00'));
    expect(r.empezada).toBe(false);
    expect(r.vuelta).toBe(0);
    expect(t(r.hora_inicio)).toBe(t(inicio));
  });

  it('después, la vuelta y su fin salen de la hora forzada', () => {
    const r = relojForzado(inicio, 60, t('2027-01-23T09:15:00-04:00'));
    expect(r.empezada).toBe(true);
    expect(r.vuelta).toBe(3);
    expect(t(r.fin_de_vuelta)).toBe(t('2027-01-23T10:00:00-04:00'));
  });

  it('una hora que no se entiende no fuerza nada', () => {
    expect(relojForzado('ayer', 60, Date.now())).toBeNull();
  });
});
