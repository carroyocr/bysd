"""Deja los datos listos para que convivan varias carreras.

Todo el sistema cuelga de `race_code`, pero hay colecciones que nacieron cuando
solo podia haber una carrera y nunca lo llevaron: mientras hubo una sola no se
notaba, porque "todo" y "lo de esta carrera" eran lo mismo. Con el campeonato
mundial y la carrera abierta a la vez, "todo" empieza a incluir datos ajenos.

Tambien deja de fabricarse la primera edicion en el codigo: pasa a ser una fila
normal en `race_configurations`, cerrada, para que se consulte como cualquier
otra.

Se ejecuta las veces que haga falta: lo que ya esta hecho lo salta.

    python migrations/carreras_multiples.py                  # simulacion
    python migrations/carreras_multiples.py --aplicar
    python migrations/carreras_multiples.py --uri "..." --aplicar
"""
import argparse
import asyncio
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

PRIMERA = "BYSD-2026"
MUNDIAL = "MUNDIAL-2026"
ABIERTA = "BYSD-2027"

# Cada coleccion sin `race_code`, y a que carrera pertenece lo que hay dentro.
# Solo se toca lo que no lo tenga: si algo ya dice de que carrera es, se respeta.
COLECCIONES = [
    ("participants", PRIMERA, "corredores de la primera edicion"),
    ("laps_log", PRIMERA, "vueltas de la primera edicion"),
    ("cheer_messages", PRIMERA, "mensajes de animo"),
    ("email_subscriptions", PRIMERA, "suscripciones de seguimiento"),
    ("campeonato_seleccionados", MUNDIAL, "nomina del campeonato"),
    ("volunteer_assignments", ABIERTA, "asignaciones de voluntario"),
    ("volunteer_positions", ABIERTA, "puestos de voluntario"),
    ("volunteer_event_schedules", ABIERTA, "cuadros de turnos"),
]

# La ficha de la primera edicion, que hasta ahora se inventaba en el codigo.
FICHA_PRIMERA = {
    "code": PRIMERA,
    "name": "Backyard Ultra Santo Domingo 2026",
    "date": "2026-01-24",
    "start_time": "09:00",
    "location": "Parque del Este, Santo Domingo, República Dominicana",
    "logo_url": "/icon-bu.png",
    "timezone_gmt": "GMT-4",
    "is_active": False,
    "estado": "cerrada",
    "edition_number": 1,
    "max_participants": 120,
    # Termino en la vuelta 31, un dia despues de la salida.
    "finished_at": datetime(2026, 1, 25, 16, 0, 0, tzinfo=timezone.utc),
    "archived_at": datetime(2026, 1, 25, 4, 0, 0, tzinfo=timezone.utc),
}

# Lo que le falta a la ficha del campeonato para poder operarlo como carrera.
FICHA_MUNDIAL = {
    "edition_number": 1,
    "max_participants": 20,
    # No hay inscripcion que pagar: estar en la nomina es lo que da la plaza.
    "registration_cost": 0.0,
    "estado": "inscripcion",
    "show_preregistration": False,
    "show_tracking_page": True,
}


class Registro:
    """Va anotando lo que se hace (o lo que se haria) para poder revisarlo."""

    def __init__(self, aplicar: bool, retirar_contador: bool = False):
        self.aplicar = aplicar
        self.retirar_contador = retirar_contador
        self.lineas = []

    def paso(self, texto: str):
        print(("  " if self.aplicar else "  [simulacion] ") + texto)
        self.lineas.append(texto)

    def nada(self, texto: str):
        print(f"  - {texto}")


async def poner_race_code(db, reg: Registro):
    print("\n1. race_code en las colecciones que no lo llevan")
    for coleccion, carrera, descripcion in COLECCIONES:
        faltan = await db[coleccion].count_documents({"race_code": {"$exists": False}})
        if not faltan:
            reg.nada(f"{coleccion}: al dia")
            continue

        if reg.aplicar:
            await db[coleccion].update_many(
                {"race_code": {"$exists": False}}, {"$set": {"race_code": carrera}}
            )
        reg.paso(f"{coleccion}: {faltan} {descripcion} -> {carrera}")


async def ficha_primera_edicion(db, reg: Registro):
    print("\n2. La primera edicion pasa a ser una carrera normal")
    existente = await db.race_configurations.find_one({"code": PRIMERA})
    if existente:
        reg.nada(f"{PRIMERA}: ya tiene ficha")
        return

    if reg.aplicar:
        await db.race_configurations.insert_one(
            {**FICHA_PRIMERA, "created_at": datetime.now(timezone.utc)}
        )
    reg.paso(f"{PRIMERA}: ficha creada, en estado cerrada")


async def estados_de_carrera(db, reg: Registro):
    print("\n3. Estado de cada carrera")
    for codigo, estado in ((ABIERTA, "inscripcion"), (MUNDIAL, "inscripcion")):
        carrera = await db.race_configurations.find_one({"code": codigo})
        if not carrera:
            reg.nada(f"{codigo}: no existe, se salta")
            continue
        if carrera.get("estado"):
            reg.nada(f"{codigo}: ya en '{carrera['estado']}'")
            continue
        if reg.aplicar:
            await db.race_configurations.update_one(
                {"code": codigo}, {"$set": {"estado": estado}}
            )
        reg.paso(f"{codigo}: estado '{estado}'")


async def completar_mundial(db, reg: Registro):
    print("\n4. Ficha del campeonato")
    carrera = await db.race_configurations.find_one({"code": MUNDIAL})
    if not carrera:
        reg.nada(f"{MUNDIAL}: no existe, se salta")
        return

    faltantes = {k: v for k, v in FICHA_MUNDIAL.items() if k not in carrera}
    if not faltantes:
        reg.nada(f"{MUNDIAL}: ficha completa")
        return

    if reg.aplicar:
        await db.race_configurations.update_one({"code": MUNDIAL}, {"$set": faltantes})
    reg.paso(f"{MUNDIAL}: se completan {', '.join(sorted(faltantes))}")


async def retirar_contador_huerfano(db, reg: Registro):
    print("\n5. El contador de vueltas suelto")
    #
    # La coleccion `race_config` guardaba la vuelta en curso en un unico
    # documento que no decia de que carrera era. Quedo congelado en la vuelta 31
    # de enero de 2026; ahora la vuelta la da el reloj de cada carrera.
    #
    # Eliminarla es un paso APARTE, con --retirar-contador, y va DESPUES de
    # desplegar: mientras el codigo viejo siga en produccion, es el quien la
    # lee, y quitarsela de debajo le deja las estadisticas en cero.
    if "race_config" not in await db.list_collection_names():
        reg.nada("race_config: ya no existe")
        return

    documentos = await db.race_config.find({}).to_list(100)
    for doc in documentos:
        reg.nada(f"race_config contiene: {dict(doc)}")

    if not reg.retirar_contador:
        reg.nada("race_config: se conserva (usa --retirar-contador DESPUES de desplegar)")
        return

    if reg.aplicar:
        if documentos:
            await db.race_config_retirada.delete_many({})
            await db.race_config_retirada.insert_many(documentos)
        await db.race_config.drop()
    reg.paso(f"race_config: {len(documentos)} documento(s) copiados a race_config_retirada y coleccion eliminada")


async def indices(db, reg: Registro):
    print("\n6. Indices del libro mayor de vueltas")
    #
    # El libro se consulta siempre por carrera, y casi siempre ademas por dorsal
    # o por vuelta. El dia de la carrera se escribe y se lee sin parar.
    existentes = {i["name"] async for i in db.lap_registrations.list_indexes()}
    deseados = [
        ([("race_code", 1), ("bib", 1), ("lap_number", 1)], "carrera_dorsal_vuelta"),
        ([("race_code", 1), ("scan_time", -1)], "carrera_hora"),
    ]
    for claves, nombre in deseados:
        if nombre in existentes:
            reg.nada(f"lap_registrations.{nombre}: ya existe")
            continue
        if reg.aplicar:
            await db.lap_registrations.create_index(claves, name=nombre)
        reg.paso(f"lap_registrations: indice {nombre}")

    existentes_reg = {i["name"] async for i in db.registrations.list_indexes()}
    if "carrera_dorsal" not in existentes_reg:
        if reg.aplicar:
            await db.registrations.create_index(
                [("race_code", 1), ("bib", 1)], name="carrera_dorsal"
            )
        reg.paso("registrations: indice carrera_dorsal")
    else:
        reg.nada("registrations.carrera_dorsal: ya existe")


async def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--aplicar", action="store_true", help="escribir de verdad")
    parser.add_argument("--uri", help="URI de Mongo (por defecto, la del .env)")
    parser.add_argument("--db", help="nombre de la base (por defecto, la del .env)")
    parser.add_argument(
        "--retirar-contador", action="store_true",
        help="elimina la coleccion race_config. Solo DESPUES de desplegar: el "
             "codigo viejo todavia la lee y sin ella deja las estadisticas en cero",
    )
    args = parser.parse_args()

    uri = args.uri or os.environ["MONGO_URL"]
    nombre = args.db or os.environ["DB_NAME"]

    db = AsyncIOMotorClient(uri)[nombre]
    reg = Registro(args.aplicar, args.retirar_contador)

    destino = uri.split("@")[-1].split("/")[0] if "@" in uri else uri
    print(f"Base: {nombre} en {destino}")
    print("Modo: APLICAR" if args.aplicar else "Modo: SIMULACION (nada se escribe)")

    await poner_race_code(db, reg)
    await ficha_primera_edicion(db, reg)
    await estados_de_carrera(db, reg)
    await completar_mundial(db, reg)
    await retirar_contador_huerfano(db, reg)
    await indices(db, reg)

    print()
    if not reg.lineas:
        print("No hay nada que hacer: los datos ya estan al dia.")
    elif args.aplicar:
        print(f"Hecho: {len(reg.lineas)} cambio(s).")
    else:
        print(f"{len(reg.lineas)} cambio(s) pendientes. Repite con --aplicar para hacerlos.")


asyncio.run(main())
