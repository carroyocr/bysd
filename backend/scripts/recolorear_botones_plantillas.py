#!/usr/bin/env python3
"""Pone en las plantillas guardadas el color de boton que dice el codigo.

Las plantillas se guardan en `email_templates` con su HTML ya montado, y el
sembrado de `routes/email_templates.py` solo inserta las que faltan: nunca
reescribe una que ya existe. Por eso cambiar `BOTON` en
`services/correo_estilo.py` no cambia ni un correo de los que ya estaban, y
no falla nada ni avisa nadie: siguen saliendo del color viejo.

Solo toca el fondo de la celda del boton. El texto, los enlaces y cualquier
cosa que se haya editado a mano desde el panel se quedan igual.

Es idempotente: pasarlo dos veces no cambia nada.

Uso:
    # 1. Respaldo primero (obligatorio antes de --aplicar)
    mongodump --uri "$(cat ~/Proyectos/bysd-secretos/atlas_propio_url.txt)" --out respaldo/

    # 2. Ver que se haria, sin tocar nada
    MONGO_URL="$(cat ~/Proyectos/bysd-secretos/atlas_propio_url.txt)" \\
        .venv/bin/python scripts/recolorear_botones_plantillas.py

    # 3. Aplicar
    MONGO_URL="$(cat ~/Proyectos/bysd-secretos/atlas_propio_url.txt)" \\
        .venv/bin/python scripts/recolorear_botones_plantillas.py --aplicar
"""
import argparse
import os
import sys

from dotenv import load_dotenv
from pymongo import MongoClient

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)

# Sin MONGO_URL en el entorno valen las del backend, como hace `server.py`.
# Con MONGO_URL puesta no se toca el `.env`: si solo se saltara esa variable,
# el DB_NAME del fichero se colaria junto a la URL de produccion y el guion
# miraria una base que no existe, sin un solo aviso.
if not os.environ.get("MONGO_URL"):
    load_dotenv(os.path.join(RAIZ, ".env"))

from services import correo_estilo  # noqa: E402


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

    print(f"Color de boton del codigo: {correo_estilo.BOTON}")
    print()

    revisadas = 0
    cambiadas = 0

    for doc in db.email_templates.find({}, {"id": 1, "name": 1, "content": 1}):
        revisadas += 1
        viejo = doc.get("content") or ""
        nuevo = correo_estilo.recolorear_botones(viejo)
        if nuevo == viejo:
            continue
        cambiadas += 1
        print(f"  · {doc.get('id', '?'):36s} {doc.get('name', '')}")
        if args.aplicar:
            db.email_templates.update_one({"id": doc["id"]}, {"$set": {"content": nuevo}})

    print()
    print(f"{revisadas} plantillas revisadas, {cambiadas} con el boton de otro color")
    if not args.aplicar:
        print("Ensayo: no se escribio nada. Pasa --aplicar para hacerlo.")

    cliente.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
