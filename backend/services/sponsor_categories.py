"""Catalogo de categorias de patrocinio.

Es el esquema comercial con el que entra cada patrocinador: cada categoria
tiene sus cupos y su aporte de referencia. Vive en el codigo (no en la base)
porque es el mismo para todas las ediciones; cambiarlo es un commit.

El frontend tiene su copia en `frontend/src/lib/sponsorCategories.js`: los
slugs de las dos listas tienen que coincidir, porque el slug es lo que se
guarda en `sponsors.propuesta_categoria`.

`cupos` en None significa que la categoria no tiene tope (se muestra con
`cupos_label`). `monto` en None es el aporte que no se paga en efectivo.
`es_patrocinio` en False deja fuera de la vitrina de patrocinadores a quien
compra presencia pero no patrocina (Zona de Marcas).
"""

CATEGORIES = [
    {
        "slug": "titulo",
        "label": "Título",
        "subtitle": "Presenting",
        "cupos": 1,
        "cupos_label": "1",
        "monto": 350000,
        "monto_label": "350,000",
        "incluye": "Naming del evento, máxima visibilidad en camiseta, tarima, prensa y transmisión.",
        "es_patrocinio": True,
    },
    {
        "slug": "platino",
        "label": "Platino",
        "subtitle": None,
        "cupos": 3,
        "cupos_label": "3",
        "monto": 175000,
        "monto_label": "175,000",
        "incluye": "Logo en espalda alta, trofeo con nombre de marca (Últ. Hombre / Últ. Mujer), banner y menciones en vivo.",
        "es_patrocinio": True,
    },
    {
        "slug": "oro",
        "label": "Oro",
        "subtitle": None,
        "cupos": 4,
        "cupos_label": "4",
        "monto": 100000,
        "monto_label": "100,000",
        "incluye": "Logo en mangas o en camiseta finisher 7+, logo en cintillo de la medalla, logo en el bulto, banner y redes.",
        "es_patrocinio": True,
    },
    {
        "slug": "plata",
        "label": "Plata",
        "subtitle": None,
        "cupos": 4,
        "cupos_label": "4",
        "monto": 55000,
        "monto_label": "55,000",
        "incluye": "Logo en el cintillo de la medalla, logo en el bulto del corredor, banner y redes.",
        "es_patrocinio": True,
    },
    {
        "slug": "bronce",
        "label": "Bronce",
        "subtitle": None,
        "cupos": 6,
        "cupos_label": "6",
        "monto": 25000,
        "monto_label": "25,000",
        "incluye": "Logo en el bulto del corredor, presencia en web y redes.",
        "es_patrocinio": True,
    },
    {
        "slug": "experiencia_4x4",
        "label": "Experiencia 4x4",
        "subtitle": "Automotriz",
        "cupos": 1,
        "cupos_label": "1",
        "monto": 300000,
        "monto_label": "300,000",
        "incluye": "Categoría exclusiva: activación y pruebas de manejo en pista 4x4 / motocross, banner, redes y menciones.",
        "es_patrocinio": True,
    },
    {
        "slug": "especie",
        "label": "Aliado en Especie",
        "subtitle": None,
        "cupos": None,
        "cupos_label": "s/valor",
        "monto": None,
        "monto_label": "Especie",
        "incluye": "Hidratación, nutrición, servicio médico, cronometraje, tecnología. Se ubica en la categoría equivalente.",
        "es_patrocinio": True,
    },
    {
        "slug": "media_partner",
        "label": "Media Partner",
        "subtitle": None,
        "cupos": None,
        "cupos_label": "libre",
        "monto": None,
        "monto_label": "Especie",
        "incluye": "Cobertura y difusión del evento: prensa, radio, televisión, podcast o medios digitales. Aporte en especie valorado a precio de mercado.",
        "es_patrocinio": True,
    },
    {
        "slug": "zona_marcas",
        "label": "Zona de Marcas",
        "subtitle": None,
        "cupos": None,
        "cupos_label": "libre",
        "monto": 3000,
        "monto_label": "3,000/ev",
        "incluye": "Stand para sampling. Flexible: RD$3,000/evento o RD$12,000 por los 5 eventos. No constituye patrocinio.",
        "es_patrocinio": False,
    },
]

NOTA_AL_PIE = (
    "Precios de referencia sujetos a disponibilidad de cupos. "
    "Los aportes en especie se valoran a precio de mercado."
)

CATEGORIES_BY_SLUG = {c["slug"]: c for c in CATEGORIES}
CATEGORY_SLUGS = tuple(CATEGORIES_BY_SLUG)


def es_valida(slug: str) -> bool:
    """Vacio significa "sin categoria asignada" y tambien es valido."""
    return not slug or slug in CATEGORIES_BY_SLUG


def etiqueta(slug: str) -> str:
    categoria = CATEGORIES_BY_SLUG.get(slug or "")
    return categoria["label"] if categoria else (slug or "")
