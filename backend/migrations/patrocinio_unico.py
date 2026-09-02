"""Funde la ficha de publicidad dentro del patrocinador: una sola tarjeta.

Hasta septiembre de 2026 un patrocinador vivia en dos colecciones unidas por
nombre y carrera: `sponsors` (comercial) y `ad_banners` (publicidad). Eran 44
y 44 —uno a uno—, con la descripcion y el Instagram guardados en las dos,
el logo cargado dos veces en dos carpetas de GridFS, y los interruptores de
«donde se ve» viviendo en la ficha aunque mandaran tambien en la vitrina del
sitio. Renombrar en un lado desenganchaba el otro sin avisar.

Esta migracion vuelca cada ficha en su patrocinador y deja `ad_banners` como
esta, sin borrar nada: si hay que volver atras, el dato sigue ahi.

Que se lleva de cada lado:

- **`id`**: se hereda el de la ficha. Es con lo que la app cuenta impresiones
  y clics (`POST /api/ads/track`), asi que las metricas ya recogidas siguen
  sumando donde estaban. Un patrocinador sin ficha estrena uno nuevo.
- **Logo**: manda el del patrocinador (43 de 44 lo tienen, contra 4 en las
  fichas). Solo si no tiene ninguno se toma el de la ficha. Es la decision de
  «un solo logo para todo»: el mismo archivo sirve a la vitrina y al pie.
- **Descripcion e Instagram**: manda el de la ficha, que es lo que la app
  lee hoy; si viene vacio, se conserva el del patrocinador. Coincidian en 43
  de 44 casos —estaban duplicados—, y en el que no, gana lo que se esta
  viendo.
- **Interruptores, vigencia, peso, marca y metricas**: se copian tal cual.
  Nadie cambia de visibilidad al desplegar.

Un patrocinador sin ficha queda encendido en los dos destinos, que es
exactamente como se comporta hoy: sin ficha que lo apagara, salia.

Las fichas huerfanas —sin patrocinador detras— no se tocan ni se pierden: se
listan al final para decidir a mano que se hace con ellas.

Se puede correr mas de una vez sin miedo.

    python3 backend/migrations/patrocinio_unico.py            # ensayo
    python3 backend/migrations/patrocinio_unico.py --escribir # de verdad
"""
import argparse
import asyncio
import os
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

# Lo que se copia tal cual de la ficha, con el valor que toma si no lo trae.
DE_LA_FICHA = {
    "banner_url": None,
    "detail_url": None,
    "text": "",
    "link_url": "",
    "weight": 1,
    "start_at": None,
    "end_at": None,
    "publicar_web": True,
    "publicar_app": True,
    "mostrar_marca": True,
    "impressions": 0,
    "clicks": 0,
}

# Lo que el patrocinador ya tenia y solo hay que asegurar que exista.
POR_DEFECTO_SIN_FICHA = {
    "banner_url": None,
    "detail_url": None,
    "description": "",
    "instagram": "",
    "text": "",
    "link_url": "",
    "weight": 1,
    "start_at": None,
    "end_at": None,
    "publicar_web": True,
    "publicar_app": True,
    "mostrar_marca": True,
    "impressions": 0,
    "clicks": 0,
}


def cambios_para(sponsor: dict, ficha: dict | None) -> dict:
    """Lo que hay que escribirle a este patrocinador. Vacio si ya esta al dia."""
    nuevos: dict = {}

    def poner(campo, valor):
        if sponsor.get(campo) != valor:
            nuevos[campo] = valor

    if ficha is None:
        poner("id", sponsor.get("id") or str(uuid.uuid4()))
        for campo, defecto in POR_DEFECTO_SIN_FICHA.items():
            if campo not in sponsor:
                nuevos[campo] = defecto
        return nuevos

    # El id de la ficha es el que conocen las metricas ya recogidas.
    poner("id", sponsor.get("id") or ficha.get("id") or str(uuid.uuid4()))

    for campo, defecto in DE_LA_FICHA.items():
        valor = ficha.get(campo)
        # La vigencia vacia se guarda como null, que es lo que el backend lee
        # como "sin limite"; algunas fichas la traen como cadena vacia.
        if campo in ("start_at", "end_at") and valor == "":
            valor = None
        poner(campo, defecto if valor is None else valor)

    # Un solo logo: manda el del patrocinador, que es el que esta cargado.
    if not sponsor.get("logo_url") and ficha.get("logo_url"):
        poner("logo_url", ficha["logo_url"])

    # Descripcion e Instagram: manda lo que la app esta ensenando hoy.
    for campo in ("description", "instagram"):
        poner(campo, ficha.get(campo) or sponsor.get(campo) or "")

    return nuevos


async def migrar(escribir: bool) -> int:
    url = os.environ.get("MONGO_URL")
    if not url:
        print("Falta MONGO_URL en el entorno.")
        return 1

    cliente = AsyncIOMotorClient(url)
    db = cliente.backyard_ultra

    sponsors = await db.sponsors.find({}).to_list(1000)
    fichas = await db.ad_banners.find({}).to_list(1000)
    por_clave = {(f.get("race_code"), f.get("name")): f for f in fichas}
    usadas = set()

    print(f"{len(sponsors)} patrocinadores · {len(fichas)} fichas de publicidad\n")

    tocados = sin_ficha = al_dia = 0

    for sponsor in sorted(sponsors, key=lambda s: (s.get("race_code", ""), s.get("name", ""))):
        clave = (sponsor.get("race_code"), sponsor.get("name"))
        ficha = por_clave.get(clave)
        if ficha:
            usadas.add(clave)
        else:
            sin_ficha += 1

        nuevos = cambios_para(sponsor, ficha)
        if not nuevos:
            al_dia += 1
            continue

        tocados += 1
        marca = "" if ficha else "  (sin ficha, valores por defecto)"
        print(f"  {clave[0]:<11} {clave[1]:<45}{marca}")
        for campo in sorted(nuevos):
            print(f"        {campo} = {nuevos[campo]!r}")

        if escribir:
            await db.sponsors.update_one({"_id": sponsor["_id"]}, {"$set": nuevos})

    huerfanas = [c for c in por_clave if c not in usadas]

    print(f"\n{'Escritos' if escribir else 'Se escribirian'}: {tocados}")
    print(f"Ya al dia: {al_dia}")
    print(f"Sin ficha de publicidad: {sin_ficha}")

    if huerfanas:
        print(f"\nFichas SIN patrocinador detras ({len(huerfanas)}) — no se tocan:")
        for race_code, name in sorted(huerfanas):
            f = por_clave[(race_code, name)]
            piezas = [t for t, c in (("logo", "logo_url"), ("banner", "banner_url"), ("ampliada", "detail_url")) if f.get(c)]
            print(f"  {race_code:<11} {name:<30} piezas: {', '.join(piezas) or 'ninguna'}")
        print("  Decidir a mano: renombrar el patrocinador para que enganche, o borrarlas.")

    if not escribir:
        print("\nEnsayo. Vuelve a correrlo con --escribir para aplicarlo.")

    cliente.close()
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--escribir", action="store_true", help="aplica los cambios")
    sys.exit(asyncio.run(migrar(parser.parse_args().escribir)))
