import { elegir } from './useMensajes';

const m = (id, hace = 60) => ({ id, message: `m${id}`, created_at: new Date(1_000_000 - hace * 1000).toISOString() });
const AHORA = 1_000_000;

describe('elegir', () => {
  // Del más nuevo al más viejo, como contesta el servidor
  const recientes = [m('c'), m('b'), m('a')];

  it('un mensaje nuevo en cola pasa antes que la rotación', () => {
    const r = elegir({ cola: [m('c')], recientes, rotar: 10, actualId: 'a', ahora: AHORA });
    expect(r.mensaje.id).toBe('c');
    expect(r.cola).toEqual([]);
  });

  it('sin cola rota los últimos del más viejo al más nuevo y vuelve a empezar', () => {
    expect(elegir({ cola: [], recientes, rotar: 10, actualId: null, ahora: AHORA }).mensaje.id).toBe('a');
    expect(elegir({ cola: [], recientes, rotar: 10, actualId: 'a', ahora: AHORA }).mensaje.id).toBe('b');
    expect(elegir({ cola: [], recientes, rotar: 10, actualId: 'c', ahora: AHORA }).mensaje.id).toBe('a');
  });

  it('rota solo entre los últimos `rotar`', () => {
    const r = elegir({ cola: [], recientes, rotar: 2, actualId: null, ahora: AHORA });
    expect(r.mensaje.id).toBe('b');
  });

  it('con rotar en cero y nada nuevo, la pantalla se queda en blanco', () => {
    expect(elegir({ cola: [], recientes, rotar: 0, actualId: null, ahora: AHORA }).mensaje).toBeNull();
  });

  it('un mensaje de la cola que ya no está en el muro se descarta sin enseñarse', () => {
    const r = elegir({ cola: [m('x'), m('c')], recientes, rotar: 0, actualId: null, ahora: AHORA });
    expect(r.mensaje.id).toBe('c');
    expect(r.cola).toEqual([]);
  });

  it('con espera, retiene el mensaje hasta que cumpla y mientras sigue la rotación', () => {
    const nuevo = m('n', 5);
    const lista = [nuevo, ...recientes];
    const r = elegir({ cola: [nuevo], recientes: lista, rotar: 10, actualId: 'c', ahora: AHORA, esperaSeg: 30 });
    expect(r.mensaje.id).toBe('a');
    expect(r.cola).toEqual([nuevo]);
    const luego = elegir({ cola: [nuevo], recientes: lista, rotar: 10, actualId: 'a', ahora: AHORA + 30_000, esperaSeg: 30 });
    expect(luego.mensaje.id).toBe('n');
    expect(luego.cola).toEqual([]);
  });

  it('sin mensajes no hay nada que enseñar', () => {
    expect(elegir({ cola: [], recientes: [], rotar: 10, actualId: null, ahora: AHORA }).mensaje).toBeNull();
  });
});
