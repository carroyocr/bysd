"""Le estrena su ficha de publicidad a los patrocinadores que ya existían.

Desde el 26 de agosto de 2026 la descripción y el Instagram no viven en la
ficha del patrocinador —ahí queda solo lo comercial— sino en la de publicidad,
y cada alta de patrocinador estrena la suya. Los que se dieron de alta antes
no la tienen, así que se la crea este script, con su descripción y su
Instagram ya dentro.

La ficha nace **apagada** y sin imágenes: lo único que queda por hacer es
subirle el logo, el banner y la imagen de detalle, y encenderla. Un banner sin
pieza gráfica en el pie de BYSD Live se vería como un hueco con un nombre.

No borra nada. La descripción y el Instagram se quedan también en el documento
del patrocinador, aunque ya nadie los lea: si esto hay que deshacerlo, el dato
sigue ahí.

Se puede correr más de una vez sin miedo: salta a quien ya tenga ficha.

    python3 backend/migrations/fichas_publicidad.py            # ensayo
    python3 backend/migrations/fichas_publicidad.py --escribir # de verdad
"""
import argparse
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

from routes.ads import nuevo_banner  # noqa: E402


async def migrar(escribir: bool) -> int:
    url = os.environ.get("MONGO_URL")
    if not url:
        print("Falta MONGO_URL en el entorno.")
        return 1

    cliente = AsyncIOMotorClient(url)
    db = cliente[os.environ.get("DB_NAME", "backyard_ultra")]

    patrocinadores = await db.sponsors.find({}).sort("order", 1).to_list(1000)
    print(f"{len(patrocinadores)} patrocinadores en la base.\n")

    # El orden de cada ficha nueva se cuenta por carrera, y hay que llevarlo a
    # mano porque en el ensayo no se escribe nada y count_documents no cambia.
    ordenes = {}
    creadas, saltadas = 0, 0

    for sponsor in patrocinadores:
        race_code = (sponsor.get("race_code") or "").upper()
        nombre = sponsor.get("name") or ""
        if not race_code or not nombre:
            print(f"  · saltado (sin nombre o sin carrera): {sponsor.get('_id')}")
            saltadas += 1
            continue

        ya_hay = await db.ad_banners.find_one({"race_code": race_code, "name": nombre})
        if ya_hay:
            print(f"  · {race_code:<14} {nombre[:34]:<34} ya tenía ficha")
            saltadas += 1
            continue

        if race_code not in ordenes:
            ordenes[race_code] = await db.ad_banners.count_documents({"race_code": race_code})

        banner = nuevo_banner(
            race_code,
            nombre,
            order=ordenes[race_code],
            sponsor_id=sponsor.get("id"),
            description=sponsor.get("description"),
            instagram=sponsor.get("instagram"),
            is_active=False,
        )
        ordenes[race_code] += 1

        marcas = []
        if banner["description"]:
            marcas.append("descripción")
        if banner["instagram"]:
            marcas.append("instagram")
        detalle = (" con " + " y ".join(marcas)) if marcas else " vacía"

        if escribir:
            await db.ad_banners.insert_one(banner)
        print(f"  ✓ {race_code:<14} {nombre[:34]:<34} ficha nueva{detalle}")
        creadas += 1

    print()
    if escribir:
        print(f"Creadas {creadas} fichas. Saltadas {saltadas}.")
    else:
        print(f"ENSAYO: se crearían {creadas} fichas. Saltadas {saltadas}.")
        print("Para escribirlas de verdad, repite con --escribir")

    cliente.close()
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--escribir", action="store_true",
                        help="escribe en la base; sin esto solo enseña qué haría")
    args = parser.parse_args()
    sys.exit(asyncio.run(migrar(args.escribir)))
