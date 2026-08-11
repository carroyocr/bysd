"""Prueba del ciclo de vida: crear heredando, cerrar y reabrir."""
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
NUEVA = "PRUEBA-2028"

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
    await db.race_configurations.delete_many({"code": NUEVA})
    await db.volunteer_positions.delete_many({"race_code": NUEVA})

    publica_antes = await db.race_configurations.find_one({"is_active": True})

    async with httpx.AsyncClient(timeout=30) as c:
        print("\nCrear la siguiente edicion heredando de la actual")
        r = await c.post(f"{API}/api/race-config/create", headers=CAB, json={
            "code": NUEVA.lower(),  # se guarda en mayusculas
            "name": "Backyard Ultra Santo Domingo 2028",
            "date": "2028-01-22",
            "start_time": "09:00",
            "location": "Sierra Prieta, Santo Domingo",
            "edition_number": 3,
            "copiar_de": "BYSD-2027",
        })
        datos = r.json()
        revisar("se crea la carrera", r.status_code == 200, r.text[:200])
        revisar("el codigo queda en mayusculas", datos.get("race", {}).get("code") == NUEVA,
                str(datos.get("race", {}).get("code")))

        copiado = datos.get("copiado", {})
        revisar("hereda ajustes de la anterior", len(copiado.get("campos", [])) > 0, str(copiado))
        revisar("hereda los puestos de voluntario", copiado.get("turnos", 0) > 0, str(copiado))

        nueva = await db.race_configurations.find_one({"code": NUEVA})
        revisar("con los datos de pago ya puestos",
                bool(nueva.get("payment_account_number")), str(nueva.get("payment_account_number")))
        revisar("y arranca en estado 'inscripcion'", nueva.get("estado") == "inscripcion",
                str(nueva.get("estado")))

        print("\nCrearla no toca el sitio publico")
        publica = await db.race_configurations.find_one({"is_active": True})
        revisar("la carrera publicada sigue siendo la misma",
                publica and publica.get("code") == publica_antes.get("code"),
                f"{publica_antes.get('code')} -> {(publica or {}).get('code')}")
        revisar("la nueva no se publica sola", not nueva.get("is_active"), str(nueva.get("is_active")))

        print("\nNo se puede repetir el codigo")
        r = await c.post(f"{API}/api/race-config/create", headers=CAB, json={
            "code": NUEVA, "name": "Otra", "date": "2028-02-01",
            "start_time": "09:00", "location": "x",
        })
        revisar("codigo repetido se rechaza", r.status_code == 400, f"HTTP {r.status_code}")

        print("\nCerrar una carrera")
        r = await c.post(f"{API}/api/race-config/close/{NUEVA}", headers=CAB)
        revisar("se cierra", r.status_code == 200, r.text[:200])

        nueva = await db.race_configurations.find_one({"code": NUEVA})
        revisar("queda en estado 'cerrada'", nueva.get("estado") == "cerrada", str(nueva.get("estado")))
        revisar("con hora de fin sellada", nueva.get("finished_at") is not None, str(nueva.get("finished_at")))

        r = await c.post(f"{API}/api/race-config/close/{NUEVA}", headers=CAB)
        revisar("cerrarla dos veces se rechaza", r.status_code == 400, f"HTTP {r.status_code}")

        print("\nUna carrera cerrada deja de contar vueltas")
        # Salida hace 3h10m y cierre hace 2h05m: la carrera se paro en la vuelta
        # 3. Sin el cierre, el reloj seguiria y ya iria por la 4.
        ahora = datetime.now(timezone(timedelta(hours=-4)))
        await db.race_configurations.update_one({"code": NUEVA}, {"$set": {
            "started_at": ahora - timedelta(hours=3, minutes=10),
            "finished_at": ahora - timedelta(hours=1, minutes=5),
        }})
        e = (await c.get(f"{API}/api/race/lap-status", params={"race_code": NUEVA})).json()
        revisar("el reloj se paro en la hora de cierre", e["current_lap"] == 3, str(e))
        revisar("y la carrera figura terminada", e.get("race_finished") is True, str(e))
        revisar("sin tiempo restante", e["seconds_remaining"] == 0, str(e))

        print("\nReabrir")
        r = await c.post(f"{API}/api/race-config/reopen/{NUEVA}", headers=CAB)
        revisar("se reabre", r.status_code == 200, r.text[:200])
        e = (await c.get(f"{API}/api/race/lap-status", params={"race_code": NUEVA})).json()
        revisar("y el reloj vuelve a contar", e["current_lap"] == 4, str(e))
        revisar("ya no figura terminada", e.get("race_finished") is False, str(e))

        print("\nLos endpoints peligrosos ya no existen")
        for ruta in (f"/api/race-config/archive-data/{NUEVA}", "/api/race-config/prepare-new-race/BYSD-2027"):
            r = await c.post(f"{API}{ruta}", headers=CAB)
            revisar(f"{ruta.split('/')[3]} retirado", r.status_code == 404, f"HTTP {r.status_code}")

    await db.race_configurations.delete_many({"code": NUEVA})
    await db.volunteer_positions.delete_many({"race_code": NUEVA})

    print()
    if fallos:
        print(f"{len(fallos)} comprobacion(es) fallaron:")
        for f in fallos:
            print("  -", f)
        sys.exit(1)
    print("Todas las comprobaciones pasaron.")


asyncio.run(main())
