"""Pasa las categorías de patrocinio escritas a mano al código del catálogo.

El catálogo de categorías —con sus cupos, montos y códigos— entró el 13 de
agosto de 2026. Los patrocinadores dados de alta antes llevan en
`propuesta_categoria` el nombre escrito a mano («Naming», «Intercambio»,
«Experiencia 4x4»), no el código (`titulo`, `especie`, `experiencia_4x4`), y
aquel commit no los migró.

La vitrina agrupa comparando el código, así que esos patrocinadores caen en el
grupo «sin categoría» y la segmentación por niveles no se ve. Este script les
pone el código que les toca.

La equivalencia sale de dos sitios:

- **La etiqueta del catálogo.** «Experiencia 4x4» es la etiqueta de
  `experiencia_4x4`, así que se resuelve sola. Se compara sin distinguir
  mayúsculas ni acentos.
- **Los nombres viejos que ya no están en el catálogo**, que hay que decir a
  mano. Están en NOMBRES_VIEJOS, con el porqué de cada uno.

Lo que no reconoce no lo toca: prefiere dejarlo como está y avisar.

    python3 backend/migrations/categorias_a_codigos.py            # ensayo
    python3 backend/migrations/categorias_a_codigos.py --escribir # de verdad
"""
import argparse
import asyncio
import os
import sys
import unicodedata

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

from services import sponsor_categories  # noqa: E402

# Nombres de un catálogo anterior que ya no son etiqueta de nada. Confirmados
# con Cristhian el 26 de agosto de 2026.
NOMBRES_VIEJOS = {
    # «Naming» era como se llamaba el patrocinio del nombre del evento, que es
    # justo lo que incluye Título: "Naming del evento, máxima visibilidad...".
    "naming": "titulo",
    # «Intercambio» es el aporte que no se paga en efectivo: Aliado.
    "intercambio": "especie",
}


def normalizar(texto: str) -> str:
    """Minúsculas y sin acentos, para comparar «Título» con «titulo»."""
    sin_acentos = unicodedata.normalize("NFKD", (texto or "").strip().lower())
    return "".join(c for c in sin_acentos if not unicodedata.combining(c))


# Etiqueta normalizada -> código. «Experiencia 4x4» -> experiencia_4x4.
POR_ETIQUETA = {
    normalizar(c["label"]): c["slug"] for c in sponsor_categories.CATEGORIES
}


def codigo_de(valor: str) -> str | None:
    """El código que le toca a lo que hay guardado, o None si no se reconoce."""
    if not valor:
        return None
    if valor in sponsor_categories.CATEGORIES_BY_SLUG:
        return None  # ya es un código: nada que hacer
    clave = normalizar(valor)
    return POR_ETIQUETA.get(clave) or NOMBRES_VIEJOS.get(clave)


async def migrar(escribir: bool) -> int:
    url = os.environ.get("MONGO_URL")
    if not url:
        print("Falta MONGO_URL en el entorno.")
        return 1

    cliente = AsyncIOMotorClient(url)
    db = cliente[os.environ.get("DB_NAME", "backyard_ultra")]

    docs = await db.sponsors.find(
        {"propuesta_categoria": {"$nin": ["", None]}},
        {"_id": 0, "name": 1, "race_code": 1, "propuesta_categoria": 1},
    ).sort("race_code", 1).to_list(1000)

    print(f"{len(docs)} patrocinadores con categoría puesta.\n")

    cambiados, ya_estaban, sin_reconocer = 0, 0, []
    for doc in docs:
        valor = doc.get("propuesta_categoria") or ""
        nombre = doc.get("name") or ""
        race_code = doc.get("race_code") or ""

        if valor in sponsor_categories.CATEGORIES_BY_SLUG:
            ya_estaban += 1
            continue

        codigo = codigo_de(valor)
        if not codigo:
            sin_reconocer.append((race_code, nombre, valor))
            continue

        etiqueta = sponsor_categories.etiqueta(codigo)
        print(f"  ✓ {race_code:<14} {nombre[:30]:<30} "
              f"{valor!r:<20} -> {codigo} ({etiqueta})")

        if escribir:
            await db.sponsors.update_one(
                {"name": nombre, "race_code": race_code},
                {"$set": {"propuesta_categoria": codigo}},
            )
        cambiados += 1

    if sin_reconocer:
        print("\n  Sin reconocer, se quedan como están:")
        for race_code, nombre, valor in sin_reconocer:
            print(f"  · {race_code:<14} {nombre[:30]:<30} {valor!r}")

    print()
    if escribir:
        print(f"Cambiados {cambiados}. Ya tenían código {ya_estaban}. "
              f"Sin reconocer {len(sin_reconocer)}.")
    else:
        print(f"ENSAYO: se cambiarían {cambiados}. Ya tienen código {ya_estaban}. "
              f"Sin reconocer {len(sin_reconocer)}.")
        print("Para escribir de verdad, repite con --escribir")

    cliente.close()
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--escribir", action="store_true",
                        help="escribe en la base; sin esto solo enseña qué haría")
    args = parser.parse_args()
    sys.exit(asyncio.run(migrar(args.escribir)))
