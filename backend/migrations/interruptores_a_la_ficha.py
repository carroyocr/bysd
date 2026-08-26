"""Mueve los interruptores de Sitio y App del patrocinador a su ficha.

Desde el 26 de agosto de 2026, dónde se ve un patrocinador —en la web, en la
app— lo decide su ficha de publicidad, no su expediente comercial. Este script
copia los valores que ya había, para que nadie cambie de visibilidad al
desplegar, y limpia lo que queda muerto:

- Cada ficha recibe `publicar_web` y `publicar_app` de su patrocinador (por
  nombre y carrera). Sin patrocinador detrás, quedan encendidos, que es el
  valor por defecto de siempre.
- Se retira `is_active` de las fichas: se lo comió `publicar_app`. Una ficha
  encendida para la app entra en la rotación del pie; no hay dos decisiones.

El `is_active` viejo **no se hereda**, y eso es deliberado: las 42 fichas que
creó la migración anterior nacieron apagadas por una razón que ya no aplica
—no tenían imágenes—, y eso ahora lo resuelve el propio pie, que salta las
fichas sin pieza gráfica. Heredarlo apagaría en la app a patrocinadores que
hoy sí salen.

En los patrocinadores no borra nada: `publicar_web` y `publicar_app` se quedan
en su documento, aunque ya nadie los lea. Si esto hay que deshacerlo, el dato
sigue ahí.

Se puede correr más de una vez sin miedo.

    python3 backend/migrations/interruptores_a_la_ficha.py            # ensayo
    python3 backend/migrations/interruptores_a_la_ficha.py --escribir # de verdad
"""
import argparse
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402


async def migrar(escribir: bool) -> int:
    url = os.environ.get("MONGO_URL")
    if not url:
        print("Falta MONGO_URL en el entorno.")
        return 1

    cliente = AsyncIOMotorClient(url)
    db = cliente[os.environ.get("DB_NAME", "backyard_ultra")]

    patrocinadores = await db.sponsors.find(
        {}, {"_id": 0, "name": 1, "race_code": 1, "publicar_web": 1, "publicar_app": 1}
    ).to_list(1000)
    por_nombre = {
        ((s.get("race_code") or "").upper(), s.get("name")): s for s in patrocinadores
    }

    fichas = await db.ad_banners.find({}).sort("order", 1).to_list(1000)
    print(f"{len(fichas)} fichas de publicidad, {len(patrocinadores)} patrocinadores.\n")

    tocadas, iguales = 0, 0
    for ficha in fichas:
        race_code = (ficha.get("race_code") or "").upper()
        nombre = ficha.get("name")
        sponsor = por_nombre.get((race_code, nombre))

        # Sin campo guardado, encendido: es el valor por defecto de siempre.
        web = True if sponsor is None else sponsor.get("publicar_web") is not False
        app = True if sponsor is None else sponsor.get("publicar_app") is not False

        cambios = {"publicar_web": web, "publicar_app": app}
        hay_que_tocar = (
            ficha.get("publicar_web") != web
            or ficha.get("publicar_app") != app
            or "is_active" in ficha
        )
        if not hay_que_tocar:
            iguales += 1
            continue

        origen = "sin patrocinador detrás" if sponsor is None else "del patrocinador"
        print(f"  ✓ {race_code:<14} {(nombre or '')[:32]:<32} "
              f"sitio={'sí' if web else 'no':<3} app={'sí' if app else 'no':<3} {origen}")

        if escribir:
            await db.ad_banners.update_one(
                {"id": ficha["id"]},
                {"$set": cambios, "$unset": {"is_active": ""}},
            )
        tocadas += 1

    print()
    if escribir:
        print(f"Actualizadas {tocadas} fichas. Ya estaban bien {iguales}.")
    else:
        print(f"ENSAYO: se tocarían {tocadas} fichas. Ya están bien {iguales}.")
        print("Para escribir de verdad, repite con --escribir")

    cliente.close()
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--escribir", action="store_true",
                        help="escribe en la base; sin esto solo enseña qué haría")
    args = parser.parse_args()
    sys.exit(asyncio.run(migrar(args.escribir)))
