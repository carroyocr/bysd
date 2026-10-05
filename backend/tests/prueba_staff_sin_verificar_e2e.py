"""Prueba por HTTP: una cuenta de staff recien creada no ve la ficha de nadie.

Reproduce el hueco tal como se encontro —darse de alta como staff con el correo
de un voluntario y pedir su perfil— y comprueba que queda cerrado, que quien ya
era del equipo no pierde nada y que el camino de vuelta funciona.

Contra el backend local, que tiene que correr con `EMAILS_ACTIVOS=false` y
`RATE_LIMIT_OFF=1` (asi viene el `.env` de desarrollo):

    cd backend && .venv/bin/uvicorn server:app --port 8001
    .venv/bin/python tests/prueba_staff_sin_verificar_e2e.py

Los codigos se leen de la base, porque en local el correo no sale: hace falta la
misma `MONGO_URL` y `DB_NAME` que usa el backend. Otra direccion u otro puerto,
con `PRUEBA_API`. Todo lo que crea lleva un correo `@prueba.example` y se borra
al terminar.
"""
import asyncio
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
load_dotenv(BACKEND / ".env")

API = os.environ.get("PRUEBA_API", "http://localhost:8001").rstrip("/")
if not API.startswith(("http://localhost", "http://127.0.0.1")):
    sys.exit("Esta prueba crea cuentas y fichas: solo contra un backend local.")

from services.auth import encode_admin_token  # noqa: E402

ADMIN = {"Authorization": "Bearer " + encode_admin_token({
    "username": "prueba", "is_admin": True, "permissions": ["all"],
    "exp": datetime.now(timezone.utc) + timedelta(hours=1),
})}

MARCA = uuid.uuid4().hex[:8]
VOLUNTARIA = f"voluntaria-{MARCA}@prueba.example"
SIN_FICHA = f"nadie-{MARCA}@prueba.example"
VETERANA = f"veterana-{MARCA}@prueba.example"
NUEVA = f"nueva-{MARCA}@prueba.example"
TURNO = 900000 + int(MARCA[:4], 16)
CLAVE_INTRUSO = "la-del-intruso-123"
CLAVE_DUENA = "la-de-la-duena-456"

fallos = []


def revisar(desc, cond, detalle=""):
    print(f"  [{'OK  ' if cond else 'FALLA'}] {desc}" + (f"  -> {detalle}" if detalle and not cond else ""))
    if not cond:
        fallos.append(desc)


def cab(token):
    return {"Authorization": f"Bearer {token}"}


async def sembrar(db):
    for correo in (VOLUNTARIA, VETERANA, NUEVA):
        await db.volunteer_registrations.insert_one({
            "email": correo, "nombre": "Ana", "apellidos": "Prueba", "status": "confirmed",
            "telefono": "809-555-0100", "tipo_sangre": "O+", "condicion_medica": "si",
            "condicion_medica_detalle": "asma", "alergias": "no",
            "contacto_emergencia_nombre": "Luis", "contacto_emergencia_telefono": "809-555-0199",
            "race_code": f"PRUEBA-{MARCA}", "evento": "carrera", "slots_interes": [TURNO],
            "created_at": datetime.now(timezone.utc),
        })
    await db.volunteer_assignments.insert_one({
        "id": TURNO, "puesto": "Avituallamiento", "turno": "A", "dia": "2026-10-17",
        "hora_inicio": "06:00:00", "hora_fin": "10:00:00",
        "email_asignado": VOLUNTARIA, "nombre_asignado": "Ana Prueba",
    })


async def limpiar(db):
    correos = {"$regex": f"-{MARCA}@prueba\\.example$"}
    await db.accounts.delete_many({"email": correos})
    await db.admin_users.delete_many({"username": correos})
    await db.volunteer_registrations.delete_many({"email": correos})
    await db.volunteer_verification_tokens.delete_many({"email": correos})
    await db.volunteer_assignments.delete_many({"id": TURNO})


async def codigo_de(db, correo, campo="verification_code"):
    """El codigo sale en una tarea aparte del perfil: se le da un momento."""
    for _ in range(30):
        cuenta = await db.accounts.find_one({"email": correo})
        if cuenta and cuenta.get(campo):
            return cuenta[campo]
        await asyncio.sleep(0.1)
    return None


async def main():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    await limpiar(db)
    await sembrar(db)

    try:
        async with httpx.AsyncClient(base_url=API, timeout=20) as c:
            print("\nEl hueco: alta de staff con el correo de una voluntaria")
            r = await c.post("/api/cuentas/registro", json={
                "email": VOLUNTARIA, "nombre": "Intruso", "password": CLAVE_INTRUSO, "tipo": "staff"})
            revisar("el alta sigue devolviendo la sesion (la app instalada la espera)",
                    r.status_code == 200 and r.json().get("token"), r.text[:200])
            intruso = r.json()["token"]
            revisar("y la cuenta nace sin confirmar", r.json()["cuenta"]["email_verified"] is False)

            r = await c.get("/api/staff/mi-perfil", headers=cab(intruso))
            perfil = r.json()
            revisar("mi-perfil responde 200 con el perfil vacio",
                    r.status_code == 200 and perfil.get("perfil") is None, r.text[:200])
            revisar("sin turnos ni lo que pidio la voluntaria",
                    perfil.get("turnos") == [] and perfil.get("slots_interes") == [], r.text[:200])
            revisar("y avisa de que falta confirmar el correo", perfil.get("verificacion_pendiente") is True)
            revisar("en la respuesta no hay ni un dato de la ficha",
                    not any(dato in r.text for dato in ("809-555", "O+", "asma", "Luis")), r.text[:200])

            r2 = await c.post("/api/cuentas/registro", json={
                "email": SIN_FICHA, "nombre": "Otro", "password": CLAVE_INTRUSO, "tipo": "staff"})
            otro = (await c.get("/api/staff/mi-perfil", headers=cab(r2.json()["token"]))).json()
            revisar("la respuesta es la misma para un correo que no es de ningun voluntario",
                    {**otro, "username": ""} == {**perfil, "username": ""}, str(otro))

            r = await c.delete(f"/api/staff/mi-perfil/turnos/{TURNO}", headers=cab(intruso))
            turno = await db.volunteer_assignments.find_one({"id": TURNO})
            revisar("no puede soltarle el turno",
                    r.status_code == 403 and turno["email_asignado"] == VOLUNTARIA, r.text[:160])
            r = await c.put("/api/staff/mi-perfil/turnos", headers=cab(intruso),
                            json={"evento": "carrera", "slots_interes": []})
            registro = await db.volunteer_registrations.find_one({"email": VOLUNTARIA})
            revisar("ni cambiarle los turnos que pidio",
                    r.status_code == 403 and registro["slots_interes"] == [TURNO], r.text[:160])
            r = await c.get("/api/staff/mi-perfil/turnos-disponibles", headers=cab(intruso))
            revisar("ni ver los turnos como si fuera ella", r.status_code == 403, r.text[:160])
            r = await c.get("/api/staff/mi-perfil/carnet", headers=cab(intruso))
            revisar("ni bajarse su carnet", r.status_code == 403, r.text[:160])
            r = await c.get("/api/staff/mi-perfil/postulaciones", headers=cab(intruso))
            revisar("ni llevarse el enlace para editar su postulacion",
                    r.status_code == 403 and "edit_token" not in r.text, r.text[:160])
            r = await c.put("/api/staff/mi-perfil/datos", headers=cab(intruso),
                            json={"telefono": "000", "contacto_emergencia_telefono": "000"})
            registro = await db.volunteer_registrations.find_one({"email": VOLUNTARIA})
            revisar("ni cambiarle el telefono o el contacto de emergencia",
                    r.status_code == 403 and registro["telefono"] == "809-555-0100", r.text[:160])
            r = await c.post(f"/api/staff/mi-perfil/turnos/{TURNO}/confirmar", headers=cab(intruso))
            turno = await db.volunteer_assignments.find_one({"id": TURNO})
            revisar("ni confirmar el turno en su nombre",
                    r.status_code == 403 and "confirmado_por" not in turno, r.text[:160])

            print("\nSin el buzon no puede confirmar la cuenta")
            codigo = await codigo_de(db, VOLUNTARIA)
            revisar("el alta dejo un codigo para el correo", bool(codigo))
            r = await c.post("/api/cuentas/verificar", json={
                "email": VOLUNTARIA, "code": "000000" if codigo != "000000" else "111111",
                "password": CLAVE_INTRUSO})
            revisar("con un codigo inventado, no", r.status_code == 400, r.text[:160])

            print("\nNi la duena del correo se la confirma sin querer")
            r = await c.post("/api/cuentas/verificar", json={"email": VOLUNTARIA, "code": codigo})
            cuenta = await db.accounts.find_one({"email": VOLUNTARIA})
            revisar("el codigo solo, sin la contrasena de la cuenta, no la confirma",
                    r.status_code == 401 and not cuenta["email_verified"], r.text[:160])

            print("\nDesde el panel no se le pueden dar permisos")
            r = await c.get("/api/users", headers=ADMIN)
            fila = next((u for u in r.json() if u["username"] == VOLUNTARIA), None)
            revisar("sale en Usuarios marcada como correo sin verificar",
                    bool(fila) and fila.get("correo_sin_verificar") is True, str(fila))
            r = await c.put(f"/api/users/{VOLUNTARIA}/permissions", headers=ADMIN,
                            json={"permissions": ["scanner"]})
            cuenta = await db.accounts.find_one({"email": VOLUNTARIA})
            revisar("y darle el escaner se rechaza",
                    r.status_code == 409 and cuenta["permissions"] == [], r.text[:160])
            r = await c.get("/api/staff/equipo/emergency-info", headers=cab(intruso))
            revisar("las fichas medicas del equipo siguen cerradas", r.status_code == 403, r.text[:160])

            print("\nLa duena se pone su contrasena con el codigo (lo que trae la app instalada)")
            r = await c.post("/api/staff/password/request-code", json={"email": VOLUNTARIA})
            ficha = await db.volunteer_verification_tokens.find_one({"email": VOLUNTARIA})
            revisar("le llega el codigo de voluntaria", r.status_code == 200 and bool(ficha), r.text[:160])
            r = await c.post("/api/staff/password/set", json={
                "email": VOLUNTARIA, "code": ficha["code"], "password": CLAVE_DUENA})
            revisar("y entra", r.status_code == 200 and r.json().get("token"), r.text[:160])
            duena = r.json()["token"]

            r = await c.get("/api/staff/mi-perfil", headers=cab(duena))
            perfil = r.json()
            revisar("ve su ficha",
                    (perfil.get("perfil") or {}).get("tipo_sangre") == "O+", r.text[:200])
            revisar("y su turno", [t["slot_id"] for t in perfil.get("turnos", [])] == [TURNO], r.text[:200])
            r = await c.get("/api/staff/mi-perfil/carnet", headers=cab(duena))
            revisar("y puede bajar su carnet", r.status_code == 200, r.text[:160])

            r = await c.post(f"/api/staff/mi-perfil/turnos/{TURNO}/confirmar", headers=cab(duena))
            revisar("reconfirma su turno",
                    r.status_code == 200 and r.json()["turno"]["confirmado"] is True, r.text[:200])
            r = await c.get("/api/staff/mi-perfil", headers=cab(duena))
            revisar("y su perfil lo ensena confirmado", r.json()["turnos"][0].get("confirmado") is True,
                    r.text[:200])
            r = await c.get("/api/volunteers/slots", headers=ADMIN)
            del_panel = next((t for t in r.json() if t.get("id") == TURNO), {})
            revisar("y el panel ve quien lo confirmo", del_panel.get("confirmado_por") == VOLUNTARIA,
                    str(del_panel)[:200])
            r = await c.put("/api/staff/mi-perfil/datos", headers=cab(duena),
                            json={"telefono": "829-555-0200", "ciudad_residencia": "Santiago"})
            registro = await db.volunteer_registrations.find_one({"email": VOLUNTARIA})
            revisar("corrige sus datos desde su perfil",
                    r.status_code == 200 and r.json()["perfil"]["telefono"] == "829-555-0200"
                    and registro["ciudad_residencia"] == "Santiago" and registro["tipo_sangre"] == "O+",
                    r.text[:200])
            r = await c.put("/api/staff/mi-perfil/datos", headers=cab(duena), json={"nombre": " "})
            revisar("pero no puede dejar el nombre vacio", r.status_code == 400, r.text[:160])

            r = await c.post("/api/cuentas/login", json={"email": VOLUNTARIA, "password": CLAVE_INTRUSO})
            revisar("la contrasena del intruso ya no entra", r.status_code == 401, r.text[:160])
            r = await c.get("/api/staff/mi-perfil", headers=cab(intruso))
            revisar("y la sesion que tenia abierta sigue sin ver nada",
                    r.json().get("perfil") is None and r.json().get("sesion_caducada") is True, r.text[:200])
            r = await c.delete(f"/api/staff/mi-perfil/turnos/{TURNO}", headers=cab(intruso))
            revisar("ni tocar el turno", r.status_code == 403, r.text[:160])

            r = await c.put(f"/api/users/{VOLUNTARIA}/permissions", headers=ADMIN,
                            json={"permissions": ["scanner"]})
            revisar("ahora si se le puede dar el escaner", r.status_code == 200, r.text[:160])
            await c.put(f"/api/users/{VOLUNTARIA}/permissions", headers=ADMIN, json={"permissions": []})

            print("\nQuien se dio de alta de verdad confirma con su codigo y su contrasena")
            codigo = await codigo_de(db, SIN_FICHA)
            r = await c.post("/api/cuentas/verificar", json={
                "email": SIN_FICHA, "code": codigo, "password": CLAVE_INTRUSO})
            revisar("y queda confirmada", r.status_code == 200 and r.json()["cuenta"]["email_verified"],
                    r.text[:160])
            r = await c.post("/api/cuentas/verificar", json={"email": SIN_FICHA, "code": codigo})
            revisar("la ruta de confirmar no da sesion a una cuenta ya confirmada",
                    r.status_code == 409, r.text[:160])

            print("\n«Ingresar» en la web: la voluntaria que nunca se puso contrasena")
            r = await c.get("/api/staff/account-status", params={"email": NUEVA})
            revisar("el estado dice que es voluntaria y que no tiene contrasena",
                    r.json().get("es_voluntario") is True and r.json().get("tiene_password") is False,
                    r.text[:160])
            r = await c.post("/api/cuentas/login", json={"email": NUEVA, "password": CLAVE_DUENA})
            revisar("sin contrasena no entra", r.status_code == 401, r.text[:160])
            await c.post("/api/staff/password/request-code", json={"email": NUEVA})
            ficha = await db.volunteer_verification_tokens.find_one({"email": NUEVA})
            r = await c.post("/api/staff/password/set", json={
                "email": NUEVA, "code": "000000" if ficha["code"] != "000000" else "111111",
                "password": CLAVE_DUENA})
            revisar("con un codigo que no es el suyo no se crea la contrasena",
                    r.status_code == 400, r.text[:160])
            r = await c.post("/api/staff/password/set", json={
                "email": NUEVA, "code": ficha["code"], "password": CLAVE_DUENA})
            revisar("con su codigo elige la contrasena y entra",
                    r.status_code == 200 and r.json().get("token"), r.text[:160])

            r = await c.post("/api/cuentas/login", json={"email": NUEVA, "password": CLAVE_DUENA})
            revisar("y desde entonces entra con correo y contrasena",
                    r.status_code == 200 and r.json()["cuenta"]["email_verified"], r.text[:160])
            nueva = r.json()["token"]
            r = await c.get("/api/staff/mi-perfil", headers=cab(nueva))
            revisar("ve sus datos", (r.json().get("perfil") or {}).get("telefono") == "809-555-0100",
                    r.text[:200])
            r = await c.get("/api/staff/mi-perfil/postulaciones", headers=cab(nueva))
            postulaciones = r.json().get("postulaciones") or []
            revisar("y recibe el enlace para editar su postulacion",
                    r.status_code == 200 and len(postulaciones) == 1 and postulaciones[0]["edit_token"],
                    r.text[:200])
            if postulaciones:
                r = await c.get(f"/api/volunteer-registration/by-token/{postulaciones[0]['edit_token']}")
                revisar("que abre la suya", r.status_code == 200 and r.json().get("email") == NUEVA,
                        r.text[:160])
            r = await c.get("/api/staff/account-status", params={"email": f"nadie-mas-{MARCA}@prueba.example"})
            revisar("un correo que no es de nadie no pasa del primer paso",
                    r.json().get("es_voluntario") is False and r.json().get("tiene_cuenta") is False,
                    r.text[:160])

            print("\nQuien ya era del equipo no pierde nada")
            # Cuenta como las que dejo la migracion de admin_users: sin verificar,
            # con su usuario del panel.
            from services import cuentas as servicio_cuentas
            await servicio_cuentas.crear(
                db, email=VETERANA, password=CLAVE_DUENA, nombre="Ana", roles=["staff"],
                email_verified=False, staff_username=VETERANA,
            )
            r = await c.post("/api/cuentas/login", json={"email": VETERANA, "password": CLAVE_DUENA})
            r = await c.get("/api/staff/mi-perfil", headers=cab(r.json()["token"]))
            revisar("la cuenta migrada del panel ve su ficha sin confirmar nada",
                    (r.json().get("perfil") or {}).get("tipo_sangre") == "O+", r.text[:200])

            heredado = encode_admin_token({
                "username": VETERANA, "is_admin": False, "permissions": [],
                "exp": datetime.now(timezone.utc) + timedelta(hours=1),
            })
            r = await c.get("/api/staff/mi-perfil", headers=cab(heredado))
            revisar("y el token heredado del panel tambien",
                    (r.json().get("perfil") or {}).get("telefono") == "809-555-0100", r.text[:200])
    finally:
        await limpiar(db)

    print()
    if fallos:
        print(f"FALLARON {len(fallos)}:")
        for f in fallos:
            print("  -", f)
        sys.exit(1)
    print("Todo en orden.")


if __name__ == "__main__":
    asyncio.run(main())
