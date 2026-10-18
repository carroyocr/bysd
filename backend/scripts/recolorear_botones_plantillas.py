#!/usr/bin/env python3
"""Escribe en las plantillas guardadas el diseno que dice el codigo.

Las plantillas se guardan en `email_templates` con su HTML ya montado, y el
sembrado de `routes/email_templates.py` solo inserta las que faltan: nunca
reescribe una que ya existe.

**Ya no hace falta pasarlo para que los correos salgan bien**: desde octubre de
2026 el diseno se pone al dia al rendir cada plantilla y al servirla al panel
(`correo_estilo.al_dia`). Esto solo deja la base escrita con el diseno de hoy,
por si se quiere que lo guardado y lo enviado sean lo mismo.

Solo cambia los estilos que escribian las piezas de `correo_estilo`. El texto,
y cualquier cosa que se haya editado a mano desde el panel, se quedan igual.

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

    print(f"Diseno del codigo: boton {correo_estilo.BOTON}, texto {correo_estilo.TEXTO}")
    print()

    revisadas = 0
    cambiadas = 0

    for doc in db.email_templates.find({}, {"id": 1, "name": 1, "content": 1}):
        revisadas += 1
        viejo = doc.get("content") or ""
        nuevo = correo_estilo.al_dia(viejo)
        if nuevo == viejo:
            continue
        cambiadas += 1
        print(f"  · {doc.get('id', '?'):36s} {doc.get('name', '')}")
        if args.aplicar:
            db.email_templates.update_one({"id": doc["id"]}, {"$set": {"content": nuevo}})

    print()
    print(f"{revisadas} plantillas revisadas, {cambiadas} con el diseno anterior")
    if not args.aplicar:
        print("Ensayo: no se escribio nada. Pasa --aplicar para hacerlo.")

    cliente.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
