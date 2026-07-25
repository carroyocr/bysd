#!/usr/bin/env python3
"""Encuentra y limpia referencias a archivos que ya no existen.

Antes de guardar los archivos subidos en GridFS, todo se escribia al disco del
contenedor, que Render borra en cada despliegue. Quedaron registros en Mongo
apuntando a archivos que ya no existen: por eso el perfil mostraba una imagen
rota en vez del icono de usuario.

Este script pregunta por HTTP si cada URL guardada responde de verdad (es lo
mismo que hace el navegador) y limpia solo las que no. Por defecto no escribe
nada: hay que pasar --aplicar.

Uso:
    # 1. Respaldo primero (obligatorio antes de --aplicar)
    mongodump --uri "$(cat ~/Proyectos/bysd-secretos/prod_mongo_url.txt)" --out respaldo/

    # 2. Ver que se encontraria, sin tocar nada
    MONGO_URL="$(cat ~/Proyectos/bysd-secretos/prod_mongo_url.txt)" \\
        python scripts/limpiar_archivos_huerfanos.py

    # 3. Aplicar
    MONGO_URL="$(cat ~/Proyectos/bysd-secretos/prod_mongo_url.txt)" \\
        python scripts/limpiar_archivos_huerfanos.py --aplicar
"""
import argparse
import os
import sys

import requests
from pymongo import MongoClient

BASE_URL_POR_DEFECTO = "https://bysd-backend.onrender.com"

# Solo se revisan las URLs que sirve este backend. Cualquier otra cosa (por
# ejemplo /icon-bu.png, que lo sirve el frontend) se deja en paz: contra el
# backend daria 404 y borrarla romperia el logo por defecto.
PREFIJOS_DEL_BACKEND = (
    "/api/static/athlete_photos/",
    "/api/static/participant_photos/",
    "/static/participant_photos/",
    "/api/uploads/receipts/",
    "/api/uploads/sponsors/",
    "/api/race-config/logo/",
    "/api/race-config/manual/",
)

# (coleccion, campo, etiqueta). El campo puede ser anidado con punto.
CAMPOS = [
    ("athletes", "photo_url", "Foto de perfil de atleta"),
    ("registrations", "photo_url", "Foto de participante"),
    ("registrations", "payment_receipt.image_path", "Comprobante de pago"),
    ("sponsors", "logo_url", "Logo de patrocinador"),
    ("race_configurations", "logo_url", "Logo de carrera"),
    ("race_configurations", "logo_home_url", "Logo de inicio"),
    ("race_configurations", "logo_menu_url", "Logo de menu"),
    ("race_configurations", "favicon_url", "Favicon"),
    ("race_configurations", "manual_runners_url", "Manual de corredores"),
    ("race_configurations", "manual_volunteers_url", "Manual de voluntarios"),
]


def obtener(doc, campo):
    valor = doc
    for parte in campo.split("."):
        if not isinstance(valor, dict):
            return None
        valor = valor.get(parte)
    return valor


def describir(doc):
    for clave in ("email", "name", "nombre", "code", "bib"):
        if doc.get(clave):
            return str(doc[clave])
    return str(doc.get("_id"))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--aplicar", action="store_true", help="escribir los cambios (por defecto solo reporta)")
    parser.add_argument("--base-url", default=os.environ.get("BASE_URL", BASE_URL_POR_DEFECTO),
                        help="backend contra el que se comprueban las URLs")
    args = parser.parse_args()

    mongo_url = os.environ.get("MONGO_URL")
    if not mongo_url:
        sys.exit("Falta MONGO_URL en el entorno.")

    db = MongoClient(mongo_url)[os.environ.get("DB_NAME", "backyard_ultra")]
    base = args.base_url.rstrip("/")
    print(f"Base de datos: {db.name}")
    print(f"Comprobando URLs contra: {base}")
    print(f"Modo: {'APLICAR (va a escribir)' if args.aplicar else 'solo reporte (no escribe nada)'}\n")

    cache = {}
    huerfanos = []
    ignoradas = []
    total_revisadas = 0

    for coleccion, campo, etiqueta in CAMPOS:
        docs = list(db[coleccion].find({campo: {"$nin": [None, ""]}}, {campo: 1, "email": 1, "name": 1,
                                                                      "nombre": 1, "code": 1, "bib": 1}))
        if not docs:
            continue
        print(f"{etiqueta} ({coleccion}.{campo}): {len(docs)} registro(s)")

        for doc in docs:
            url = obtener(doc, campo)
            if not isinstance(url, str) or not url.startswith(PREFIJOS_DEL_BACKEND):
                if isinstance(url, str) and url:
                    ignoradas.append((etiqueta, describir(doc), url))
                continue
            total_revisadas += 1

            if url not in cache:
                try:
                    r = requests.get(f"{base}{url}", timeout=60, stream=True)
                    cache[url] = r.status_code
                    r.close()
                except requests.RequestException as e:
                    print(f"  ! no se pudo comprobar {url}: {e}")
                    cache[url] = None

            estado = cache[url]
            if estado == 404:
                huerfanos.append((coleccion, campo, doc["_id"], describir(doc), url, etiqueta))
                print(f"  HUERFANO  {describir(doc)}  ->  {url}")
            elif estado != 200:
                print(f"  ? {describir(doc)} -> {url} (HTTP {estado}, se deja igual)")
        print()

    print("=" * 70)
    print(f"URLs revisadas: {total_revisadas}   Huerfanas (404): {len(huerfanos)}")

    if ignoradas:
        print(f"\nNo gestionadas por el backend, se dejan como estan ({len(ignoradas)}):")
        for etiqueta, quien, url in ignoradas:
            print(f"  {etiqueta} de {quien}: {url}")

    if not huerfanos:
        print("No hay nada que limpiar.")
        return

    print("\nResumen por tipo:")
    for etiqueta in dict.fromkeys(h[5] for h in huerfanos):
        cuantos = sum(1 for h in huerfanos if h[5] == etiqueta)
        print(f"  {etiqueta}: {cuantos}")

    # Los comprobantes de pago no se pueden volver a generar: hay que pedirselos
    # de nuevo a la persona, asi que se listan aparte.
    comprobantes = [h for h in huerfanos if h[1] == "payment_receipt.image_path"]
    if comprobantes:
        print("\nOJO - comprobantes de pago perdidos. Hay que pedirlos de nuevo a:")
        for _, _, _, quien, _, _ in comprobantes:
            print(f"  - {quien}")

    if not args.aplicar:
        print("\nNada se modifico. Corre con --aplicar (despues del mongodump) para limpiar.")
        return

    print("\nAplicando...")
    limpiados = 0
    for coleccion, campo, _id, quien, url, _ in huerfanos:
        if campo == "payment_receipt.image_path":
            # No se borra el comprobante completo: se conservan banco, fecha y
            # numero de transferencia, y se marca que falta la imagen.
            db[coleccion].update_one(
                {"_id": _id},
                {"$unset": {"payment_receipt.image_path": ""},
                 "$set": {"payment_receipt.image_lost": True}}
            )
        else:
            db[coleccion].update_one({"_id": _id}, {"$unset": {campo: ""}})
        limpiados += 1
        print(f"  limpiado {coleccion}.{campo} de {quien}")

    print(f"\nListo: {limpiados} referencia(s) limpiada(s).")


if __name__ == "__main__":
    main()
