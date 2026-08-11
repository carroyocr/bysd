"""Prueba del control de carrera del panel: dar la salida, cerrar y deshacer vueltas."""
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

from services.auth import encode_admin_token  # noqa: E402

CAB = {"Authorization": "Bearer " + encode_admin_token({
    "username": "prueba", "is_admin": True, "permissions": ["all"],
    "exp": datetime.now(timezone.utc) + timedelta(hours=1),
})}

fallos = []


def revisar(desc, cond, detalle=""):
    print(f"  [{'OK  ' if cond else 'FALLA'}] {desc}" + (f"  -> {detalle}" if detalle and not cond else ""))
    if not cond:
        fallos.append(desc)


async def main():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]

    await db.registrations.delete_many({"race_code": MUNDIAL, "email": {"$regex": "@prueba.local$"}})
    await db.lap_registrations.delete_many({"race_code": MUNDIAL})
    for bib, nombre in [("901", "Ana"), ("902", "Luis"), ("903", "Sara")]:
        await db.registrations.insert_one({
            "race_code": MUNDIAL, "bib": bib, "nombre": nombre, "apellidos": "Prueba",
            "email": f"{nombre.lower()}@prueba.local", "nacionalidad": "DOM",
            "status": "active", "payment_status": "paid", "laps_completed": 0,
        })
    # Sin salida sellada: la carrera no ha empezado
    await db.race_configurations.update_one(
        {"code": MUNDIAL}, {"$unset": {"started_at": "", "finished_at": ""}, "$set": {"estado": "inscripcion"}}
    )

    async with httpx.AsyncClient(timeout=20) as c:
        print("\nAntes de la salida")
        e = (await c.get(f"{API}/api/race/lap-status", params={"race_code": MUNDIAL})).json()
        revisar("la carrera figura sin empezar", e["race_started"] is False, str(e))

        r = await c.post(f"{API}/api/qr-scan/confirm", headers=CAB, json={
            "bib": "901", "confirmed_lap": 1, "race_code": MUNDIAL, "scanned_by": "x"})
        revisar("el escaner no acepta vueltas todavia",
                r.json().get("action") == "lap_not_started", r.text[:160])

        print("\nDar la salida")
        inscritos_antes = await db.registrations.count_documents(
            {"race_code": MUNDIAL, "status": "registered", "payment_status": "paid",
             "bib": {"$exists": True, "$ne": None}})
        r = await c.post(f"{API}/api/race/start", headers=CAB, params={"race_code": MUNDIAL})
        revisar("se sella la hora de salida", r.status_code == 200 and r.json().get("started_at"), r.text[:160])

        carrera = await db.race_configurations.find_one({"code": MUNDIAL})
        revisar("y la carrera pasa a 'en_carrera'", carrera.get("estado") == "en_carrera",
                str(carrera.get("estado")))
        revisar(f"los {inscritos_antes} inscritos pasan a estar en carrera",
                r.json().get("en_carrera") == inscritos_antes, r.text[:200])
        quedan = await db.registrations.count_documents(
            {"race_code": MUNDIAL, "status": "registered", "payment_status": "paid",
             "bib": {"$exists": True, "$ne": None}})
        revisar("y no queda nadie sin salir", quedan == 0, f"{quedan} sin salir")

        e = (await c.get(f"{API}/api/race/lap-status", params={"race_code": MUNDIAL})).json()
        revisar("el reloj arranca en la vuelta 1", e["current_lap"] == 1, str(e))

        print("\nCorregir la hora de salida")
        # La salida fue de verdad hace 2h50m: la carrera va por la vuelta 3
        real = datetime.now(timezone(timedelta(hours=-4))) - timedelta(hours=2, minutes=50)
        r = await c.post(f"{API}/api/race/start-time", headers=CAB, params={"race_code": MUNDIAL},
                         json={"started_at": real.strftime("%Y-%m-%dT%H:%M:%S")})
        revisar("se corrige la salida", r.status_code == 200, r.text[:160])

        e = (await c.get(f"{API}/api/race/lap-status", params={"race_code": MUNDIAL})).json()
        revisar("y el reloj se recoloca en la vuelta 3", e["current_lap"] == 3, str(e))

        print("\nCerrar vueltas para todos")
        # El mundial ya tiene sus propios corredores (los seleccionados), asi
        # que se cuenta sobre los activos que haya, no sobre los tres de prueba.
        activos = await db.registrations.count_documents(
            {"race_code": MUNDIAL, "status": "active", "bib": {"$ne": None}})
        for vuelta in (1, 2):
            r = await c.post(f"{API}/api/race/complete-lap-all-active", headers=CAB,
                             params={"race_code": MUNDIAL, "lap_number": vuelta})
            revisar(f"se cierra la vuelta {vuelta} para los {activos} activos",
                    r.json().get("updated_count") == activos, r.text[:160])

        r = await c.post(f"{API}/api/race/complete-lap-all-active", headers=CAB,
                         params={"race_code": MUNDIAL, "lap_number": 2})
        revisar("repetir la misma vuelta no la duplica",
                r.json().get("skipped_count") == activos, r.text[:160])

        doc = await db.registrations.find_one({"race_code": MUNDIAL, "bib": "901"})
        revisar("cada corredor lleva 2 vueltas", doc.get("laps_completed") == 2, str(doc.get("laps_completed")))
        revisar("con sus kilometros al dia", doc.get("total_km") == 13.4, str(doc.get("total_km")))

        print("\nDeshacer una vuelta")
        # Sara se retira en la 3, y luego resulta que la vuelta 3 no valia
        await c.post(f"{API}/api/race/mark-retired", headers=CAB, params={"race_code": MUNDIAL},
                     json={"bib": "903", "retired_at_lap": 3})
        await c.post(f"{API}/api/race/complete-lap-all-active", headers=CAB,
                     params={"race_code": MUNDIAL, "lap_number": 3})

        doc = await db.registrations.find_one({"race_code": MUNDIAL, "bib": "903"})
        revisar("Sara queda retirada con 2 vueltas",
                doc.get("status") == "retired" and doc.get("laps_completed") == 2,
                f"{doc.get('status')} / {doc.get('laps_completed')}")

        r = await c.post(f"{API}/api/race/revert-lap", headers=CAB,
                         params={"race_code": MUNDIAL, "lap_number": 3})
        datos = r.json()
        revisar("se deshace la vuelta 3", r.status_code == 200, r.text[:160])
        revisar("y Sara vuelve a la carrera", datos.get("reactivated_count") == 1, str(datos))

        doc = await db.registrations.find_one({"race_code": MUNDIAL, "bib": "903"})
        revisar("figura activa otra vez", doc.get("status") == "active", str(doc.get("status")))

        doc = await db.registrations.find_one({"race_code": MUNDIAL, "bib": "901"})
        revisar("y a Ana se le descuenta la vuelta 3", doc.get("laps_completed") == 2,
                str(doc.get("laps_completed")))

        vivas = await db.lap_registrations.count_documents({"race_code": MUNDIAL, "anulada": {"$ne": True}})
        anuladas = await db.lap_registrations.count_documents({"race_code": MUNDIAL, "anulada": True})
        # El retiro de Sara mas la vuelta 3 de cada uno de los demas
        revisar("nada se borro: lo deshecho queda anulado", anuladas == activos,
                f"{anuladas} anuladas, {vivas} vivas")

        print("\nLa otra carrera sigue intacta")
        e = (await c.get(f"{API}/api/race/lap-status", params={"race_code": "BYSD-2027"})).json()
        revisar("la de enero sigue sin empezar", e["race_started"] is False, str(e))

    print()
    if fallos:
        print(f"{len(fallos)} comprobacion(es) fallaron:")
        for f in fallos:
            print("  -", f)
        sys.exit(1)
    print("Todas las comprobaciones pasaron.")


asyncio.run(main())
