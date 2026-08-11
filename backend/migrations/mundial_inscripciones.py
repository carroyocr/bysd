"""La nomina del campeonato mundial pasa a ser inscripciones de MUNDIAL-2026.

Los seleccionados vivian en su propia coleccion, con el dorsal y las vueltas de
la edicion de 2026 -- es decir, con el resultado de *otra* carrera. Por eso el
campeonato no podia usar el control de vueltas: `/api/race/participants` tenia
una rama aparte que los devolvia siempre con cero vueltas, y el escaner QR, que
busca en `registrations`, sencillamente no los encontraba.

Convertidos en inscripciones normales de MUNDIAL-2026, el campeonato funciona
igual que cualquier otra carrera: QR, control de vueltas, dashboard en vivo,
app y resultados, sin ninguna ruta especial.

Que se conserva de cada uno: nombre, apellidos, sexo, nacionalidad y su
categoria (titular o reserva). Que NO se conserva: el dorsal y las vueltas de
2026, que son de aquella carrera.

    python migrations/mundial_inscripciones.py                 # simulacion
    python migrations/mundial_inscripciones.py --aplicar
"""
import argparse
import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from bson import ObjectId
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

from migrations.bib_email_2026 import BIB_EMAIL_MAP

MUNDIAL = "MUNDIAL-2026"

# Los titulares primero y las reservas despues, conservando dentro de cada grupo
# el orden en que se seleccionaron. Los dorsales se pueden cambiar luego uno a
# uno desde el panel.
ORDEN = {"titular": 0, "reserva": 1}


async def resolver_correo(db, seleccionado: dict) -> tuple:
    """Correo del atleta, si se puede averiguar. Devuelve (correo, de donde)."""
    bib_2026 = str(seleccionado.get("bib") or "").zfill(3)

    if bib_2026 in BIB_EMAIL_MAP:
        return BIB_EMAIL_MAP[bib_2026], "listado de 2026"

    result_id = seleccionado.get("result_id")
    if result_id:
        try:
            corredor = await db.participants.find_one({"_id": ObjectId(result_id)})
        except Exception:
            corredor = None
        if corredor and corredor.get("claimed_by"):
            try:
                atleta = await db.athletes.find_one({"_id": ObjectId(corredor["claimed_by"])})
            except Exception:
                atleta = None
            if atleta and atleta.get("email"):
                return atleta["email"], "ficha del atleta"

    return None, None


async def athlete_id_de(db, correo: str):
    if not correo:
        return None
    atleta = await db.athletes.find_one({"email": correo.lower()}, {"_id": 1})
    return str(atleta["_id"]) if atleta else None


async def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--aplicar", action="store_true", help="escribir de verdad")
    parser.add_argument("--uri", help="URI de Mongo (por defecto, la del .env)")
    parser.add_argument("--db", help="nombre de la base (por defecto, la del .env)")
    parser.add_argument(
        "--primer-dorsal", type=int, default=1,
        help="numero del primer dorsal (por defecto 1)",
    )
    args = parser.parse_args()

    uri = args.uri or os.environ["MONGO_URL"]
    nombre = args.db or os.environ["DB_NAME"]
    db = AsyncIOMotorClient(uri)[nombre]

    destino = uri.split("@")[-1].split("/")[0] if "@" in uri else uri
    print(f"Base: {nombre} en {destino}")
    print("Modo: APLICAR" if args.aplicar else "Modo: SIMULACION (nada se escribe)")

    carrera = await db.race_configurations.find_one({"code": MUNDIAL})
    if not carrera:
        print(f"\nNo existe la carrera {MUNDIAL}. Se sale sin tocar nada.")
        return

    seleccionados = await db.campeonato_seleccionados.find({}).to_list(500)
    seleccionados.sort(key=lambda d: (ORDEN.get(d.get("categoria"), 9), d.get("created_at") or ""))

    if not seleccionados:
        print("\nLa nomina esta vacia. No hay nada que convertir.")
        return

    ahora = datetime.now(timezone.utc)
    dorsal = args.primer_dorsal
    creadas = 0
    saltadas = 0
    sin_correo = []

    print(f"\n{len(seleccionados)} seleccionado(s) en la nomina\n")
    print(f"  {'Dorsal':>6}  {'Categoria':10} {'Nombre':32} Correo")
    print(f"  {'-'*6}  {'-'*10} {'-'*32} {'-'*40}")

    for seleccionado in seleccionados:
        nombre_completo = f"{seleccionado.get('nombre', '')} {seleccionado.get('apellidos', '')}".strip()

        correo, origen = await resolver_correo(db, seleccionado)

        # Ya convertido en una pasada anterior
        ya_esta = await db.registrations.find_one({
            "race_code": MUNDIAL,
            "seleccionado_id": seleccionado.get("id"),
        })
        if ya_esta:
            print(f"  {str(ya_esta.get('bib')):>6}  {'':10} {nombre_completo[:32]:32} (ya convertido)")
            saltadas += 1
            continue

        if not correo:
            # Direccion imposible de entregar (.invalid esta reservado para esto
            # justamente), para que nunca salga un correo a ciegas. La
            # organizacion la corrige desde el panel.
            correo = f"pendiente-{dorsal:03d}@mundial-2026.invalid"
            origen = "PENDIENTE"
            sin_correo.append(nombre_completo)

        inscripcion = {
            "race_code": MUNDIAL,
            "bib": f"{dorsal:03d}",
            "nombre": seleccionado.get("nombre"),
            "apellidos": seleccionado.get("apellidos") or "",
            "email": correo.lower(),
            "sexo": seleccionado.get("sexo") or "",
            "nacionalidad": seleccionado.get("nacionalidad") or "DOM",
            # En el campeonato no hay inscripcion que pagar: estar en la nomina
            # es lo que da la plaza.
            "status": "registered",
            "payment_status": "paid",
            "laps_completed": 0,
            "total_km": 0.0,
            # De donde salio, para poder rehacer el enlace
            "categoria": seleccionado.get("categoria"),
            "seleccionado_id": seleccionado.get("id"),
            "athlete_id": await athlete_id_de(db, correo),
            "correo_pendiente": origen == "PENDIENTE",
            "edit_token": uuid.uuid4().hex,
            "created_at": ahora,
            "updated_at": ahora,
        }

        marca = correo if origen != "PENDIENTE" else f"{correo}  <- PENDIENTE"
        print(f"  {inscripcion['bib']:>6}  {seleccionado.get('categoria', ''):10} {nombre_completo[:32]:32} {marca}")

        if args.aplicar:
            await db.registrations.insert_one(inscripcion)
        creadas += 1
        dorsal += 1

    print()
    if saltadas:
        print(f"{saltadas} ya estaban convertidos.")
    if sin_correo:
        print(f"{len(sin_correo)} sin correo conocido; hay que ponerselo desde el panel:")
        for quien in sin_correo:
            print(f"  - {quien}")
    if args.aplicar:
        print(f"\nHecho: {creadas} inscripcion(es) creadas en {MUNDIAL}.")
    else:
        print(f"\n{creadas} inscripcion(es) pendientes. Repite con --aplicar para crearlas.")


asyncio.run(main())
