import { LH3, resolverFotos, direccionFoto } from './portada';

const deseadas = [
  { indice: 2, clave: 'AAA', alt: 'a' },
  { indice: 0, clave: 'BBB', alt: 'b' },
];

test('sin álbum, va con la clave guardada', () => {
  expect(resolverFotos(null, deseadas).map((f) => f.url)).toEqual([LH3 + 'AAA', LH3 + 'BBB']);
  expect(resolverFotos([], deseadas).map((f) => f.url)).toEqual([LH3 + 'AAA', LH3 + 'BBB']);
});

test('con la clave en el álbum, toma esa dirección aunque haya cambiado de sitio', () => {
  const album = [LH3 + 'BBB', LH3 + 'XXX', LH3 + 'YYY', LH3 + 'AAA'];
  expect(resolverFotos(album, deseadas).map((f) => f.url)).toEqual([LH3 + 'AAA', LH3 + 'BBB']);
});

test('si la clave ya no está, toma la del mismo sitio del álbum sin repetir', () => {
  const album = [LH3 + 'P', LH3 + 'Q', LH3 + 'R'];
  // AAA no está: cae en el índice 2 (R). BBB tampoco: índice 0 (P).
  expect(resolverFotos(album, deseadas).map((f) => f.url)).toEqual([LH3 + 'R', LH3 + 'P']);
  // Dos fotos que caen en el mismo sitio no se repiten: la segunda salta a la siguiente.
  const mismas = [
    { indice: 1, clave: 'AAA' },
    { indice: 1, clave: 'BBB' },
  ];
  expect(resolverFotos(album, mismas).map((f) => f.url)).toEqual([LH3 + 'Q', LH3 + 'R']);
});

test('conserva lo demás de la foto y arma la dirección con el ancho', () => {
  const [foto] = resolverFotos([LH3 + 'AAA'], [{ indice: 0, clave: 'AAA', alt: 'a', pie: 'p' }]);
  expect(foto).toMatchObject({ alt: 'a', pie: 'p', url: LH3 + 'AAA' });
  expect(direccionFoto(foto, 800)).toBe(LH3 + 'AAA=w800');
  expect(direccionFoto({ clave: 'ZZZ' }, 1000)).toBe(LH3 + 'ZZZ=w1000');
});
