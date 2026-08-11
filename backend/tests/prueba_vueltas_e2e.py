"""Prueba de punta a punta del libro mayor de vueltas, contra el Mongo local.

Comprueba lo que se pidio: que el escaneo QR y el panel escriban en la misma
base, y que se pueda trabajar sobre dos carreras a la vez sin que una pise a la
otra.
"""
import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone

import httpx
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

sys.path.insert(0, "/Users/nexxusmac/Proyectos/bysd/backend")
load_dotenv("/Users/nexxusmac/Proyectos/bysd/backend/.env")

API = "http://localhost:8001"
MUNDIAL = "MUNDIAL-2026"
ABIERTA = "BYSD-2027"

from services.auth import encode_admin_token  # noqa: E402

TOKEN = encode_admin_token({
    "username": "prueba",
    "is_admin": True,
    "permissions": ["all"],
    "exp": datetime.now(timezone.utc) + timedelta(hours=1),
})
CAB = {"Authorization": f"Bearer {TOKEN}"}

fallos = []


def revisar(descripcion, condicion, detalle=""):
    marca = "OK  " if condicion else "FALLA"
    print(f"  [{marca}] {descripcion}" + (f"  -> {detalle}" if detalle and not condicion else ""))
    if not condicion:
        fallos.append(descripcion)


async def preparar(db):
    """Tres corredores de prueba en el mundial, con dorsales propios."""
    await db.registrations.delete_many({"race_code": MUNDIAL, "email": {"$regex": "@prueba.local$"}})
    await db.lap_registrations.delete_many({"race_code": MUNDIAL})

    for i, (bib, nombre) in enumerate([("901", "Ana"), ("902", "Luis"), ("903", "Sara")]):
        await db.registrations.insert_one({
            "race_code": MUNDIAL,
            "bib": bib,
            "nombre": nombre,
            "apellidos": "Prueba",
            "email": f"{nombre.lower()}@prueba.local",
            "nacionalidad": "DOM",
            "status": "active",
            "payment_status": "paid",
            "laps_completed": 0,
        })

    # Salida hace 1 h 50 min: va por la vuelta 2, con 50 minutos corridos.
    # Asi un corredor que ya lleva 1 vuelta puede fichar la 2 sin caer ni en
    # "volvio muy temprano" ni en "se le paso la hora".
    salida = datetime.now(timezone(timedelta(hours=-4))) - timedelta(hours=1, minutes=50)
    await db.race_configurations.update_one(
        {"code": MUNDIAL}, {"$set": {"started_at": salida, "estado": "en_carrera"}}
    )
    return salida


async def main():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    salida = await preparar(db)
    print(f"\nMundial arrancado a las {salida.strftime('%H:%M')} (hace 2h10m)\n")

    async with httpx.AsyncClient(timeout=20) as c:
        # --- El reloj: cada carrera va por su cuenta ---
        print("El reloj de cada carrera")
        m = (await c.get(f"{API}/api/race/lap-status", params={"race_code": MUNDIAL})).json()
        a = (await c.get(f"{API}/api/race/lap-status", params={"race_code": ABIERTA})).json()
        revisar("el mundial va por la vuelta 2", m["current_lap"] == 2, str(m))
        revisar("la carrera de enero sigue sin empezar", a["race_started"] is False, str(a))

        # --- El escaneo QR anota en la carrera del propio QR ---
        print("\nEscaneo QR")
        # Ana ya lleva la vuelta 1 corrida
        await c.post(f"{API}/api/qr-scan/lap-registrations/ajuste", headers=CAB, json={
            "race_code": MUNDIAL, "bib": "901", "laps_completed": 1, "motivo": "Estado de partida",
        })

        r = await c.get(f"{API}/api/qr-scan/athlete/901", params={"race_code": MUNDIAL}, headers=CAB)
        ficha = r.json()
        revisar("la ficha sale con la vuelta en curso", ficha.get("current_race_lap") == 2, str(ficha)[:200])
        revisar("y sabe que le toca la vuelta 2", ficha.get("lap_to_complete") == 2, str(ficha)[:200])
        revisar("y que puede cerrarla", ficha.get("can_complete") is True, str(ficha)[:200])

        r = await c.post(f"{API}/api/qr-scan/confirm", headers=CAB, json={
            "bib": "901", "confirmed_lap": 2, "race_code": MUNDIAL, "scanned_by": "escaner1",
        })
        revisar("se anota la vuelta 2 de Ana", r.json().get("laps_completed") == 2, r.text[:200])

        r = await c.post(f"{API}/api/qr-scan/confirm", headers=CAB, json={
            "bib": "901", "confirmed_lap": 2, "race_code": MUNDIAL, "scanned_by": "escaner1",
        })
        revisar("el mismo escaneo repetido no cuenta dos veces",
                r.json().get("action") == "already_registered", r.text[:200])

        # --- El panel escribe en el mismo libro ---
        print("\nVueltas puestas a mano desde el panel")
        r = await c.post(f"{API}/api/qr-scan/lap-registrations/manual", headers=CAB, json={
            "race_code": MUNDIAL, "bib": "902", "motivo": "El telefono se quedo sin bateria",
        })
        revisar("el panel anota la vuelta 1 de Luis", r.json().get("laps_completed") == 1, r.text[:200])

        r = await c.post(f"{API}/api/race/complete-lap", headers=CAB,
                         params={"race_code": MUNDIAL}, json={"bib": "902", "lap_number": 2})
        revisar("el control de carrera anota la vuelta 2 de Luis",
                r.json().get("laps_completed") == 2, r.text[:200])

        r = await c.get(f"{API}/api/qr-scan/lap-registrations",
                        params={"race_code": MUNDIAL}, headers=CAB)
        libro = r.json()["registrations"]
        origenes = {x["source"] for x in libro}
        revisar("escaneo y panel estan en el mismo libro", origenes == {"qr", "panel"}, str(origenes))
        revisar("el libro junta el ajuste de Ana, su vuelta y las dos de Luis",
                len(libro) == 4, f"{len(libro)} anotaciones")

        # --- Correcciones ---
        print("\nCorrecciones")
        r = await c.post(f"{API}/api/qr-scan/lap-registrations/ajuste", headers=CAB, json={
            "race_code": MUNDIAL, "bib": "903", "laps_completed": 1, "motivo": "Vuelta de juez",
        })
        revisar("un ajuste deja a Sara con 1 vuelta", r.json().get("laps_completed") == 1, r.text[:200])

        r = await c.post(f"{API}/api/qr-scan/confirm", headers=CAB, json={
            "bib": "903", "confirmed_lap": 2, "race_code": MUNDIAL, "scanned_by": "escaner1",
        })
        revisar("tras el ajuste, la siguiente vuelta suma sobre el",
                r.json().get("laps_completed") == 2, r.text[:200])

        vuelta_de_ana = [x for x in libro if x["bib"] == "901" and x["action"] == "lap_completed"][-1]
        r = await c.post(f"{API}/api/qr-scan/lap-registrations/{vuelta_de_ana['id']}/anular",
                         headers=CAB, json={"race_code": MUNDIAL, "motivo": "Se conto de mas"})
        revisar("anular una vuelta la descuenta", r.json().get("laps_completed") == 1, r.text[:200])

        r = await c.get(f"{API}/api/qr-scan/lap-registrations/summary",
                        params={"race_code": MUNDIAL}, headers=CAB)
        resumen = r.json()
        revisar("lo anulado no cuenta en el resumen", resumen.get("anuladas") == 1, str(resumen))

        # --- Retiros ---
        print("\nRetiros")
        r = await c.post(f"{API}/api/race/mark-retired", headers=CAB,
                         params={"race_code": MUNDIAL}, json={"bib": "902", "retired_at_lap": 2})
        revisar("Luis se retira conservando sus 2 vueltas",
                r.json().get("laps_completed") == 2, r.text[:200])

        doc = await db.registrations.find_one({"race_code": MUNDIAL, "bib": "902"})
        revisar("la ficha de Luis queda como retirado", doc.get("status") == "retired", str(doc.get("status")))

        r = await c.post(f"{API}/api/race/reactivate", headers=CAB,
                         params={"race_code": MUNDIAL}, json={"bib": "902"})
        revisar("se le puede devolver a la carrera", r.status_code == 200, r.text[:200])
        doc = await db.registrations.find_one({"race_code": MUNDIAL, "bib": "902"})
        revisar("y vuelve a figurar como activo", doc.get("status") == "active", str(doc.get("status")))
        revisar("con sus vueltas intactas", doc.get("laps_completed") == 2, str(doc.get("laps_completed")))

        # --- Que no se cruce con la otra carrera ---
        print("\nSeparacion entre carreras")
        n_abierta = await db.lap_registrations.count_documents({"race_code": ABIERTA})
        revisar("nada de esto toco la carrera de enero", n_abierta == 7, f"{n_abierta} anotaciones")

        r = await c.post(f"{API}/api/race/complete-lap", headers=CAB, json={"bib": "902", "lap_number": 3})
        revisar("sin decir la carrera, el panel se niega", r.status_code == 422, f"HTTP {r.status_code}")

        r = await c.post(f"{API}/api/qr-scan/confirm", headers=CAB, json={
            "bib": "997", "confirmed_lap": 1, "race_code": ABIERTA, "scanned_by": "x",
        })
        revisar("un dorsal que no existe en esa carrera se rechaza",
                r.status_code == 404, f"HTTP {r.status_code}")

    print()
    if fallos:
        print(f"{len(fallos)} comprobacion(es) fallaron:")
        for f in fallos:
            print(f"  - {f}")
        sys.exit(1)
    print("Todas las comprobaciones pasaron.")


asyncio.run(main())
