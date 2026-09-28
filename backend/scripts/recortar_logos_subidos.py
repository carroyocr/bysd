#!/usr/bin/env python3
"""Recorta el aire de los logos de patrocinador que ya estan en GridFS.

Desde ahora los logos se recortan al subirlos (`services/logos.py`), pero los
que ya estaban guardados traen su margen dentro: entre el 0 % y el 77 % segun
quien exporto el archivo. Mientras no se recorten, la vitrina no puede
nivelarlos por superficie, porque la proporcion que lee es la del lienzo y no
la de la tinta.

Se pasa una vez y es idempotente: un logo ya ajustado no se toca. El nombre
del archivo no cambia, asi que la URL guardada en la ficha sigue valiendo y
las apps instaladas no se enteran. Ademas anota `logo_opaco`, que es lo que
le dice al sitio que ese logo necesita una placa debajo.

Uso:
    # 1. Respaldo primero (obligatorio antes de --aplicar)
    mongodump --uri "$(cat ~/Proyectos/bysd-secretos/atlas_propio_url.txt)" --out respaldo/

    # 2. Ver que se haria, sin tocar nada
    MONGO_URL="$(cat ~/Proyectos/bysd-secretos/atlas_propio_url.txt)" \\
        .venv/bin/python scripts/recortar_logos_subidos.py

    # 3. Aplicar
    MONGO_URL="$(cat ~/Proyectos/bysd-secretos/atlas_propio_url.txt)" \\
        .venv/bin/python scripts/recortar_logos_subidos.py --aplicar
"""
import argparse
import os
import sys

import gridfs
from pymongo import MongoClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services import logos  # noqa: E402

BUCKET = "uploads"
CARPETA = "sponsors"


def archivo_de_url(url: str) -> str:
    """El nombre del archivo dentro de la URL, sin la marca de version."""
    return url.rsplit("/", 1)[-1].split("?", 1)[0]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--aplicar", action="store_true", help="escribe los cambios")
    args = parser.parse_args()

    url = os.environ.get("MONGO_URL")
    if not url:
        print("Falta MONGO_URL", file=sys.stderr)
        return 1

    cliente = MongoClient(url)
    db = cliente[os.environ.get("DB_NAME", "backyard_ultra")]
    bucket = gridfs.GridFSBucket(db, bucket_name=BUCKET)

    recortados = 0
    revisados = 0

    for doc in db.sponsors.find({"logo_url": {"$nin": [None, ""]}}):
        nombre = archivo_de_url(doc.get("logo_url") or "")
        if not nombre:
            continue
        revisados += 1

        try:
            flujo = bucket.open_download_stream_by_name(nombre)
        except gridfs.NoFile:
            print(f"  · {doc['name']:38s} sin archivo en GridFS ({nombre})")
            continue

        contenido = flujo.read()
        metadatos = flujo.metadata or {}
        content_type = metadatos.get("content_type") or "image/png"
        ext = nombre.rsplit(".", 1)[-1].lower()

        nuevo, ext_nueva, tipo_nuevo, opaco = logos.recortar(contenido, ext, content_type)
        cambia = nuevo != contenido

        print(
            f"  · {doc['name']:38s} "
            f"{'recorta' if cambia else 'ya ajustado':12s} "
            f"{len(contenido)/1024:6.0f} KB -> {len(nuevo)/1024:6.0f} KB  opaco={opaco}"
        )

        if not args.aplicar:
            continue

        if cambia:
            if ext_nueva != ext:
                # El recorte no cambia de formato; si algun dia lo hiciera,
                # cambiaria el nombre del archivo y con el la URL de la ficha.
                # Antes que dejar un logo roto, se salta.
                print(f"    ! cambiaria la extension ({ext} -> {ext_nueva}), se salta")
                continue
            for viejo in bucket.find({"filename": nombre}):
                bucket.delete(viejo._id)
            bucket.upload_from_stream(
                nombre,
                nuevo,
                metadata={"folder": CARPETA, "content_type": tipo_nuevo},
            )
            recortados += 1

        db.sponsors.update_one({"id": doc["id"]}, {"$set": {"logo_opaco": opaco}})

    print()
    print(f"{revisados} logos revisados")
    if args.aplicar:
        print(f"{recortados} recortados")
    else:
        print("Ensayo: no se escribio nada. Pasa --aplicar para hacerlo.")

    cliente.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
