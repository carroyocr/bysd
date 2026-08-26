// Catálogo de categorías de patrocinio: el esquema comercial con el que entra
// cada patrocinador. Es copia de `backend/services/sponsor_categories.py`
// (el backend valida contra esa lista), así que los slugs de las dos tienen
// que coincidir: el slug es lo que se guarda en el patrocinador.
//
// `cupos: null` = sin tope (se muestra `cuposLabel`). `monto: null` = aporte
// que no se paga en efectivo. `esPatrocinio: false` deja fuera de la vitrina
// a quien compra presencia pero no patrocina (Zona de Marcas).

export const SPONSOR_CATEGORIES = [
  {
    slug: 'titulo',
    label: 'Título',
    subtitle: 'Presenting',
    cupos: 1,
    cuposLabel: '1',
    monto: 350000,
    montoLabel: '350,000',
    incluye: 'Naming del evento, máxima visibilidad en camiseta, tarima, prensa y transmisión.',
    esPatrocinio: true,
    badgeClass: 'bg-neutral-900 text-white',
  },
  {
    slug: 'platino',
    label: 'Platino',
    subtitle: null,
    cupos: 3,
    cuposLabel: '3',
    monto: 175000,
    montoLabel: '175,000',
    incluye: 'Logo en espalda alta, trofeo con nombre de marca (Últ. Hombre / Últ. Mujer), banner y menciones en vivo.',
    esPatrocinio: true,
    badgeClass: 'bg-slate-200 text-slate-800',
  },
  {
    slug: 'oro',
    label: 'Oro',
    subtitle: null,
    cupos: 4,
    cuposLabel: '4',
    monto: 100000,
    montoLabel: '100,000',
    incluye: 'Logo en mangas o en camiseta finisher 7+, logo en cintillo de la medalla, logo en el bulto, banner y redes.',
    esPatrocinio: true,
    badgeClass: 'bg-amber-100 text-amber-800',
  },
  {
    slug: 'plata',
    label: 'Plata',
    subtitle: null,
    cupos: 4,
    cuposLabel: '4',
    monto: 55000,
    montoLabel: '55,000',
    incluye: 'Logo en el cintillo de la medalla, logo en el bulto del corredor, banner y redes.',
    esPatrocinio: true,
    badgeClass: 'bg-gray-200 text-gray-700',
  },
  {
    slug: 'bronce',
    label: 'Bronce',
    subtitle: null,
    cupos: 6,
    cuposLabel: '6',
    monto: 25000,
    montoLabel: '25,000',
    incluye: 'Logo en el bulto del corredor, presencia en web y redes.',
    esPatrocinio: true,
    badgeClass: 'bg-orange-100 text-orange-800',
  },
  {
    slug: 'experiencia_4x4',
    label: 'Experiencia 4x4',
    subtitle: 'Automotriz',
    cupos: 1,
    cuposLabel: '1',
    monto: 300000,
    montoLabel: '300,000',
    incluye: 'Categoría exclusiva: activación y pruebas de manejo en pista 4x4 / motocross, banner, redes y menciones.',
    esPatrocinio: true,
    badgeClass: 'bg-emerald-800 text-white',
  },
  {
    slug: 'especie',
    label: 'Aliado',
    subtitle: null,
    cupos: null,
    cuposLabel: 's/valor',
    monto: null,
    montoLabel: 'Especie',
    incluye: 'Hidratación, nutrición, servicio médico, cronometraje, tecnología. Se ubica en la categoría equivalente.',
    esPatrocinio: true,
    badgeClass: 'bg-stone-200 text-stone-700',
  },
  {
    slug: 'media_partner',
    label: 'Media Partner',
    subtitle: null,
    cupos: null,
    cuposLabel: 'libre',
    monto: null,
    montoLabel: 'Especie',
    incluye: 'Cobertura y difusión del evento: prensa, radio, televisión, podcast o medios digitales. Aporte en especie valorado a precio de mercado.',
    esPatrocinio: true,
    badgeClass: 'bg-sky-100 text-sky-800',
  },
  {
    slug: 'zona_marcas',
    label: 'Zona de Marcas',
    subtitle: null,
    cupos: null,
    cuposLabel: 'libre',
    monto: 3000,
    montoLabel: '3,000/ev',
    incluye: 'Stand para sampling. Flexible: RD$3,000/evento o RD$12,000 por los 5 eventos. No constituye patrocinio.',
    esPatrocinio: false,
    badgeClass: 'bg-neutral-100 text-neutral-600',
  },
];

export const NOTA_AL_PIE =
  'Precios de referencia sujetos a disponibilidad de cupos. ' +
  'Los aportes en especie se valoran a precio de mercado.';

export const getCategory = (slug) =>
  SPONSOR_CATEGORIES.find((c) => c.slug === slug) || null;

export const categoryLabel = (slug) => getCategory(slug)?.label || '';
