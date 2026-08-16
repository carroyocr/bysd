from fastapi import APIRouter, HTTPException, Depends, Header, Query, Request
from fastapi.responses import FileResponse
from typing import Optional, List
import bcrypt
from datetime import datetime, timedelta, timezone
import os
import urllib.parse
import logging
from pathlib import Path
from bson import ObjectId
from models.race import (
    AdminLogin, MarkRetiredRequest, CompleteLapRequest,
    RaceStats, SubscribeRequest,
    CheerMessageRequest, AdjustLapsRequest, EditParticipantRequest
)
from pydantic import BaseModel
from services.email_service import send_notification_email, send_lap_notifications, send_finish_notifications
from services.auth import encode_admin_token, require_permission, verify_admin_token
from services import clima, laps, races, rate_limit

router = APIRouter(prefix="/api/race", tags=["race"])

# Carreras historicas cuyos resultados viven en la coleccion legada
# `participants` (previa al sistema de inscripciones `registrations`). Solo se
# consultan: sobre ellas ya no se escribe nada.
LEGACY_RACE_CODES = ["BYSD-2026"]

KM_PER_LAP = races.KM_POR_VUELTA
CERTIFICATES_DIR = Path(__file__).parent.parent / "static" / "certificates" / "individual"


# Helper function to get active race code
async def get_active_race_code(database) -> str:
    """Codigo de la carrera que muestra el sitio publico."""
    active_race = await races.carrera_publica(database)
    if active_race:
        return active_race.get("code")
    return None


# Helper function to verify JWT token
def verify_token(authorization: Optional[str] = Header(None)):
    return verify_admin_token(authorization)

@router.post("/auth/admin-login")
async def admin_login(credentials: AdminLogin, request: Request = None, db=Depends(lambda: None)):
    from server import db as database

    ip = rate_limit.limitar_login(request, (credentials.username or "").strip().lower())

    # El usuario se guarda siempre en minusculas, pero aqui se buscaba tal cual
    # se escribia. Con los usuarios de siempre apenas se notaba; desde que los
    # voluntarios entran con su correo es un fallo constante, porque el teclado
    # del telefono capitaliza la primera letra y el espacio de mas que deja el
    # autocompletado tampoco perdonaba.
    usuario = (credentials.username or "").strip().lower()

    # Se mira primero en `accounts` y, si ahi no esta, en `admin_users` de
    # siempre. Esa caida permite desplegar esto **antes** de correr la
    # migracion: mientras `accounts` este vacia todo sigue igual, y en cuanto el
    # script pase, cada quien entra por su cuenta sin coordinar el minuto exacto.
    #
    # Se busca por correo y tambien por `staff_username` porque la cuenta de
    # `admin` no tiene correo: su identidad es el usuario. Sin esta segunda via
    # la migracion dejaria al administrador fuera de su propio panel.
    from services import cuentas as servicio_cuentas

    cuenta = await database[servicio_cuentas.COLECCION].find_one(
        {"$or": [{"email": usuario}, {"staff_username": usuario}]}
    )

    if cuenta:
        if not servicio_cuentas.verificar_password(credentials.password, cuenta.get("password_hash")):
            raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")
        if servicio_cuentas.STAFF not in (cuenta.get("roles") or []):
            raise HTTPException(status_code=403, detail="Esta zona es solo para el equipo")

        if servicio_cuentas.es_heredado(cuenta.get("password_hash")):
            await database[servicio_cuentas.COLECCION].update_one(
                {"_id": cuenta["_id"]},
                {"$set": {"password_hash": servicio_cuentas.hash_password(credentials.password)}},
            )

        await database[servicio_cuentas.COLECCION].update_one(
            {"_id": cuenta["_id"]}, {"$set": {"last_login_at": datetime.now(timezone.utc)}}
        )

        # Quien acierta no arrastra los fallos previos
        rate_limit.olvidar("login", ip)

        permissions = ["all"] if cuenta.get("is_admin") else (cuenta.get("permissions") or [])
        nombre_usuario = cuenta.get("staff_username") or cuenta["email"]
        return {
            "token": servicio_cuentas.emitir_token({**cuenta, "permissions": permissions}),
            "username": nombre_usuario,
            "is_admin": bool(cuenta.get("is_admin")),
            "permissions": permissions,
        }

    # Find admin user
    admin = await database.admin_users.find_one({"username": usuario}, {"_id": 0})

    if not admin:
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")

    # Verify password
    if not bcrypt.checkpw(credentials.password.encode('utf-8'), admin["password"].encode('utf-8')):
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")

    # Get user permissions (admin user has all permissions)
    is_admin = usuario == "admin"
    permissions = admin.get("permissions", [])

    # Create JWT token with permissions
    token_data = {
        "username": usuario,
        "is_admin": is_admin,
        "permissions": permissions if not is_admin else ["all"],
        "exp": datetime.now(timezone.utc) + timedelta(hours=12)
    }
    token = encode_admin_token(token_data)

    # Quien acierta no arrastra los fallos previos
    rate_limit.olvidar("login", ip)

    return {
        "token": token,
        "username": usuario,
        "is_admin": is_admin,
        "permissions": permissions if not is_admin else ["all"]
    }

@router.get("/stats")
async def get_race_stats(
    race_code: Optional[str] = Query(None, description="Race code to filter by"),
    db=Depends(lambda: None)
):
    from server import db as database
    
    carrera = await races.resolver_carrera(database, race_code)
    active_race_code = carrera.get("code")

    # La vuelta sale del reloj de la carrera, no de un contador aparte. El
    # contador vivia en la coleccion `race_config` sin decir de que carrera era,
    # asi que al haber mas de una se quedaba pegado en el de la anterior.
    current_lap = races.vuelta_actual(carrera)["current_lap"]
    carrera_cerrada = races.estado(carrera) == "cerrada" or carrera.get("is_legacy")

    # Determine data source based on race code
    # BYSD-2026 (and other legacy races) use the old participants collection
    # Newer races use the registrations collection
    participants = []

    if active_race_code in LEGACY_RACE_CODES:
        # Use legacy participants collection for historical races.
        # Se acepta que aun no tengan race_code: la coleccion nacio cuando solo
        # existia una carrera y la migracion se lo pone despues.
        participants = await database.participants.find(
            {"$or": [{"race_code": active_race_code}, {"race_code": {"$exists": False}}]},
            {"_id": 0},
        ).to_list(1000)
    else:
        # Try registrations collection first for new races
        if active_race_code:
            # Only get athletes who are active, paid, and have BIB
            registrations = await database.registrations.find(
                {
                    "race_code": active_race_code,
                    "status": {"$in": ["active", "retired", "dns", "winner", "honor"]},
                    "payment_status": "paid",
                    "bib": {"$exists": True, "$ne": None}
                },
                {"_id": 0, "edit_token": 0}
            ).to_list(1000)
            
            # Map registrations to participant format
            for reg in registrations:
                participants.append({
                    "bib": str(reg.get("bib")).zfill(3) if reg.get("bib") else None,
                    "nombre": reg.get("nombre"),
                    "apellidos": reg.get("apellidos"),
                    "nacionalidad": reg.get("nacionalidad", "DOM"),
                    "status": reg.get("status", "active"),
                    "laps_completed": reg.get("laps_completed", 0),
                    "total_km": reg.get("total_km", 0.0),
                    "retired_at_lap": reg.get("retired_at_lap")
                })
        
        # NO fallback for new races - only legacy races use old participants collection
    
    # Filter out participants without BIB for stats calculation
    participants_with_bib = [p for p in participants if p.get("bib")]

    if carrera_cerrada:
        # En una carrera terminada la cuenta la dan los corredores, no el reloj:
        # el reloj no sabe cuando se paro y seguiria sumando una vuelta por hora
        # para siempre.
        total_laps_completed = max(
            (p.get("laps_completed", 0) for p in participants_with_bib), default=0
        )
        current_lap = total_laps_completed + 1
    else:
        # Total laps completed is current_lap - 1 (not the sum of all athletes)
        total_laps_completed = max(0, current_lap - 1)

    athletes_dnf = sum(1 for p in participants_with_bib if p.get("status") == "retired")
    athletes_dns = sum(1 for p in participants_with_bib if p.get("status") == "dns")
    athletes_winner = sum(1 for p in participants_with_bib if p.get("status") == "winner")
    athletes_honor = sum(1 for p in participants_with_bib if p.get("status") == "honor")
    athletes_active = len(participants_with_bib) - athletes_dnf - athletes_dns - athletes_winner - athletes_honor
    
    # Total km is based on completed laps (not current lap)
    total_km = total_laps_completed * races.km_por_vuelta(carrera)
    
    # Total km of all athletes (sum of individual km)
    total_km_all_athletes = sum(p.get("total_km", 0) for p in participants_with_bib)
    
    # Check for winner: First check if there's a manually marked winner
    winner = None
    manual_winner = next((p for p in participants_with_bib if p.get("status") == "winner"), None)
    
    if manual_winner:
        winner = {
            "bib": manual_winner.get("bib"),
            "nombre": manual_winner.get("nombre"),
            "apellidos": manual_winner.get("apellidos"),
            "nacionalidad": manual_winner.get("nacionalidad"),
            "laps_completed": manual_winner.get("laps_completed", 0),
            "total_km": manual_winner.get("total_km", 0)
        }
    else:
        # Auto-detect winner: Only 1 active athlete who has completed at least one lap alone
        active_participants = [p for p in participants_with_bib if p.get("status") == "active"]
        retired_participants = [p for p in participants_with_bib if p.get("status") == "retired"]
        
        if len(active_participants) == 1 and len(retired_participants) > 0:
            winner_participant = active_participants[0]
            winner_laps = winner_participant.get("laps_completed", 0)
            
            # Find the maximum laps completed by any retired athlete
            max_retired_laps = max((p.get("laps_completed", 0) for p in retired_participants), default=0)
            
            # Winner must have completed MORE laps than all retired athletes
            if winner_laps > max_retired_laps:
                winner = {
                    "bib": winner_participant.get("bib"),
                    "nombre": winner_participant.get("nombre"),
                    "apellidos": winner_participant.get("apellidos"),
                    "nacionalidad": winner_participant.get("nacionalidad"),
                    "laps_completed": winner_laps,
                    "total_km": winner_participant.get("total_km", 0)
                }
    
    return RaceStats(
        current_lap=current_lap,
        total_laps_completed=total_laps_completed,
        athletes_dnf=athletes_dnf,
        athletes_active=athletes_active,
        athletes_dns=athletes_dns,
        total_km=round(total_km, 1),
        total_km_all_athletes=round(total_km_all_athletes, 1),
        winner=winner
    )

@router.get("/participants")
async def get_participants(
    search: Optional[str] = None,
    status: Optional[str] = None,
    race_code: Optional[str] = Query(None, description="Race code to filter by"),
    include_waitlist: bool = Query(
        False,
        description="Incluir tambien a los de lista de espera (los usa la app movil)",
    ),
    db=Depends(lambda: None)
):
    """Corredores de una carrera.

    Cada uno trae `confirmado`: es quien ya tiene su lugar asegurado. En las
    carreras normales eso significa que pago; en el Campeonato son los
    seleccionados, y en las historicas todos, porque ya corrieron. La app lo
    usa para separar "Confirmados" de "Inscritos", y asi el resto de pantallas
    no tiene que saber nada de pagos.

    La lista de espera queda fuera salvo que se pida: este endpoint alimenta
    tambien el panel de control, la web y los conteos de la carrera, y sumar
    ahi gente que todavia no tiene plaza descuadraria todos esos numeros.
    """
    from server import db as database

    # Get race code - use parameter or get active race
    active_race_code = race_code
    if not active_race_code:
        active_race_code = await get_active_race_code(database)
    
    participants = []

    # El campeonato ya no tiene rama aparte. Su nomina se devolvia desde
    # `campeonato_seleccionados` con las vueltas fijadas a cero, asi que el
    # campeonato no podia correrse: ni el control de vueltas ni el escaner QR
    # (que busca en `registrations`) encontraban a nadie. Ahora los
    # seleccionados son inscripciones de su carrera, como los de cualquier otra.

    if active_race_code in LEGACY_RACE_CODES:
        # Use legacy participants collection for historical races
        query = {"$or": [{"race_code": active_race_code}, {"race_code": {"$exists": False}}]}
        if status and status in ["active", "retired", "dns", "winner", "honor"]:
            query["status"] = status

        participants = await database.participants.find(query, {"_id": 0}).to_list(1000)
        # Carreras ya corridas: no queda pago pendiente que distinguir.
        for p in participants:
            p["confirmado"] = True
    else:
        # Try registrations collection first for new races
        if active_race_code:
            # Antes de la salida los inscritos estan en "registered": tambien
            # se muestran, incluidos los pendientes de pago (la lista de
            # espera y cancelados quedan fuera por el filtro de status).
            estados = ["registered", "active", "retired", "dns", "winner", "honor"]
            query = {
                "race_code": active_race_code,
                "status": {"$in": estados},
                "bib": {"$exists": True, "$ne": None},  # Must have BIB assigned
                # Atletas que pidieron no aparecer publicamente
                "perfil_publico": {"$ne": False},
            }

            if include_waitlist:
                # A quien esta en espera aun puede no haberle tocado dorsal, asi
                # que se le exime del filtro de BIB; los demas lo siguen
                # necesitando para no sacar inscripciones a medio procesar.
                del query["status"]
                del query["bib"]
                query["$or"] = [
                    {"status": {"$in": estados}, "bib": {"$exists": True, "$ne": None}},
                    {"status": "waitlist"},
                ]

            if status and status in estados:
                query.pop("$or", None)
                query["status"] = status
                query["bib"] = {"$exists": True, "$ne": None}
            
            registrations = await database.registrations.find(
                query,
                {"_id": 0, "edit_token": 0}
            ).to_list(1000)
            
            # Map registrations to participant format
            for reg in registrations:
                participants.append({
                    "bib": str(reg.get("bib")).zfill(3) if reg.get("bib") else None,
                    "nombre": reg.get("nombre"),
                    "apellidos": reg.get("apellidos"),
                    "nacionalidad": reg.get("nacionalidad", "DOM"),
                    "status": reg.get("status", "active"),
                    "laps_completed": reg.get("laps_completed", 0),
                    "total_km": reg.get("total_km", 0.0),
                    "retired_at_lap": reg.get("retired_at_lap"),
                    "email": reg.get("email"),
                    # Confirmado = pago verificado. Es lo que separa
                    # "Confirmados" de "Inscritos" en la app.
                    "confirmado": reg.get("payment_status") == "paid",
                    "personalizacion_camiseta": reg.get("personalizacion_camiseta"),
                    "talla_camiseta": reg.get("talla_camiseta")
                })
        
        # NO fallback for new races - if no eligible participants, return empty list
        # The fallback to old participants collection should ONLY happen for legacy races
    
    # Filter by search term
    if search:
        search_lower = search.lower()
        participants = [
            p for p in participants
            if (p.get("bib") and search_lower in p["bib"].lower()) or
               search_lower in p.get("nombre", "").lower() or
               search_lower in p.get("apellidos", "").lower()
        ]
    
    # Sort by laps completed (descending), then by BIB
    # `or "999"` y no un default del get: quien esta en lista de espera puede
    # traer bib None, y comparar None con texto reventaria el orden.
    participants.sort(key=lambda x: (-(x.get("laps_completed") or 0), x.get("bib") or "999"))
    
    return participants

# ============= CONTROL DE CARRERA DESDE EL PANEL =============
#
# Todo lo de aqui abajo trabaja sobre la carrera que diga `race_code`. Antes
# caia en silencio sobre la carrera publicada, lo que bastaba mientras solo
# podia haber una viva; con el campeonato mundial y la carrera abierta a la vez
# eso significaba escribir vueltas en la carrera equivocada sin enterarse.
#
# Las vueltas no se tocan a mano en la ficha del corredor: pasan por
# `services/laps.py`, el mismo libro donde escribe el escaner QR.


async def _carrera_y_atleta(database, race_code: str, bib):
    carrera = await races.obtener_carrera(database, race_code)
    atleta = await laps.exigir_atleta(database, carrera["code"], bib)
    return carrera, atleta


def _autor(user: dict) -> str:
    return (user or {}).get("username") or "panel"


@router.post("/start")
async def iniciar_carrera(
    race_code: str = Depends(races.carrera_del_panel),
    user=Depends(verify_token),
):
    """Sella la hora real de salida: a partir de ahi se cuentan las vueltas.

    La hora prevista de la ficha sirve para anunciar la carrera, pero la salida
    se retrasa con facilidad y nadie corrige la ficha en ese momento. Lo que
    manda es esta marca.
    """
    from server import db as database

    carrera = await races.obtener_carrera(database, race_code)
    ahora = races.ahora_en_carrera(carrera)

    await database.race_configurations.update_one(
        {"code": carrera["code"]},
        {
            "$set": {
                "started_at": ahora,
                "estado": "en_carrera",
                "started_by": _autor(user),
                "updated_at": ahora,
            }
        },
    )

    # Dar la salida es lo que convierte a un inscrito en corredor. Nadie hacia
    # ese paso: los inscritos se quedaban en "registered" para siempre, que en
    # el contexto de la carrera no cuenta como en carrera. El dia de la carrera
    # el panel habria ensenado cero atletas activos con la linea de salida
    # llena, y "retirar" a alguien no habria tenido a quien retirar.
    en_la_salida = await database.registrations.update_many(
        {
            "race_code": carrera["code"],
            "status": "registered",
            "payment_status": "paid",
            "bib": {"$exists": True, "$ne": None},
        },
        {"$set": {"status": "active", "updated_at": ahora}},
    )

    carrera["started_at"] = ahora
    return {
        "message": (
            f"Carrera {carrera['code']} iniciada a las {ahora.strftime('%H:%M:%S')} "
            f"con {en_la_salida.modified_count} corredores en la salida"
        ),
        "started_at": ahora.isoformat(),
        "en_carrera": en_la_salida.modified_count,
        **races.vuelta_actual(carrera),
    }


class HoraDeSalida(BaseModel):
    started_at: str  # "2026-10-17T08:12:00"


@router.post("/start-time")
async def corregir_hora_de_salida(
    datos: HoraDeSalida,
    race_code: str = Depends(races.carrera_del_panel),
    user=Depends(verify_token),
):
    """Corrige la hora de salida cuando se sello tarde o se sello mal."""
    from server import db as database

    carrera = await races.obtener_carrera(database, race_code)

    try:
        salida = datetime.fromisoformat(datos.started_at)
    except ValueError:
        raise HTTPException(status_code=400, detail="Hora de salida invalida")

    if salida.tzinfo is None:
        salida = salida.replace(tzinfo=races.zona_horaria(carrera))

    await database.race_configurations.update_one(
        {"code": carrera["code"]},
        {"$set": {"started_at": salida, "updated_at": races.ahora_en_carrera(carrera)}},
    )

    carrera["started_at"] = salida
    return {
        "message": f"Hora de salida corregida a {salida.strftime('%Y-%m-%d %H:%M')}",
        "started_at": salida.isoformat(),
        **races.vuelta_actual(carrera),
    }


@router.get("/live")
async def panel_en_vivo(
    race_code: str = Depends(races.carrera_del_panel),
    movimientos: int = 40,
    user=Depends(verify_token),
):
    """Todo lo que hace falta para llevar la carrera, en una sola llamada.

    Durante la carrera la pregunta no es cuantas vueltas lleva cada uno, sino
    quien ha vuelto ya de la vuelta en curso y quien no. Eso solo se responde
    cruzando al corredor con el libro de vueltas, y eso es lo que se devuelve
    aqui ya cruzado: la pantalla no tiene que juntar dos listas ni pedir el
    libro entero para saber quien falta.
    """
    from server import db as database

    carrera = await races.obtener_carrera(database, race_code)
    codigo = carrera["code"]
    info = races.vuelta_actual(carrera)
    vuelta = info["current_lap"]

    corredores = await database.registrations.find(
        {
            "race_code": codigo,
            "status": {"$in": ["registered", "active", "retired", "dns", "winner", "honor"]},
            "bib": {"$exists": True, "$ne": None},
        },
        {"_id": 0, "edit_token": 0},
    ).to_list(1000)

    # Quien ya cerro la vuelta en curso
    hechas = set()
    if vuelta:
        for anotacion in await database.lap_registrations.find(
            {
                "race_code": codigo,
                "lap_number": vuelta,
                "action": laps.VUELTA_COMPLETADA,
                "anulada": {"$ne": True},
            },
            {"bib": 1},
        ).to_list(2000):
            hechas.add(str(anotacion.get("bib")))

    # La ultima marca de cada uno, para ver de un vistazo por donde va
    ultimas = {}
    async for anotacion in database.lap_registrations.aggregate([
        {"$match": {"race_code": codigo, "anulada": {"$ne": True}}},
        {"$sort": {"scan_time": 1}},
        {"$group": {"_id": "$bib", "ultima": {"$last": "$$ROOT"}}},
    ]):
        u = anotacion["ultima"]
        ultimas[str(anotacion["_id"])] = {
            "lap": u.get("lap_number"),
            "action": u.get("action"),
            "source": u.get("source") or laps.ORIGEN_QR,
            "hora": u.get("scan_time_local"),
        }

    fuera = {"retired", "dns"}
    lista = []
    for reg in corredores:
        bib = str(reg.get("bib")).zfill(3) if reg.get("bib") else None
        lista.append({
            "bib": bib,
            "nombre": reg.get("nombre"),
            "apellidos": reg.get("apellidos"),
            "nacionalidad": reg.get("nacionalidad", "DOM"),
            "email": reg.get("email"),
            "status": reg.get("status", "active"),
            "laps_completed": reg.get("laps_completed", 0),
            "total_km": reg.get("total_km", 0.0),
            "retired_at_lap": reg.get("retired_at_lap"),
            "categoria": reg.get("categoria"),
            "confirmado": reg.get("payment_status") == "paid",
            # Lo que de verdad se mira durante la carrera
            "vuelta_en_curso_hecha": bib in hechas or str(reg.get("bib")) in hechas,
            "ultima_marca": ultimas.get(bib) or ultimas.get(str(reg.get("bib"))),
        })

    # Orden de carrera: primero quien sigue dentro, y dentro de eso quien mas
    # vueltas lleva. Los que ya salieron, al final.
    lista.sort(key=lambda p: (
        p["status"] in fuera,
        -p["laps_completed"],
        p["bib"] or "999",
    ))

    ultimos = await database.lap_registrations.find(
        {"race_code": codigo}
    ).sort("scan_time", -1).to_list(max(1, min(movimientos, 200)))
    for m in ultimos:
        m["id"] = str(m.pop("_id"))
        m.setdefault("source", laps.ORIGEN_QR)
        m.setdefault("anulada", False)

    en_carrera = sum(1 for p in lista if p["status"] not in fuera)

    return {
        "race": {
            "code": codigo,
            "name": carrera.get("name"),
            "estado": races.estado(carrera),
            "km_por_vuelta": races.km_por_vuelta(carrera),
        },
        "lap": {
            "current_lap": vuelta,
            "race_started": info["race_started"],
            "race_finished": info["race_finished"],
            "minutes_into_lap": info["minutes_into_lap"],
            "seconds_remaining": info["seconds_remaining"],
            "started_at": info["started_at"].isoformat() if info["started_at"] else None,
            "lap_start_time": info["lap_start_time"].isoformat() if info["lap_start_time"] else None,
            "lap_end_time": info["lap_end_time"].isoformat() if info["lap_end_time"] else None,
        },
        "totales": {
            "en_carrera": en_carrera,
            "fuera": len(lista) - en_carrera,
            "inscritos": len(lista),
            "vuelta_en_curso_hecha": sum(1 for p in lista if p["vuelta_en_curso_hecha"]),
            # Antes de la salida no falta nadie por volver: no ha salido nadie.
            "faltan_por_volver": sum(
                1 for p in lista
                if p["status"] not in fuera and not p["vuelta_en_curso_hecha"]
            ) if info["race_started"] else 0,
        },
        "corredores": lista,
        "movimientos": ultimos,
    }


@router.get("/lap-status")
async def estado_de_vuelta(race_code: Optional[str] = None):
    """En que vuelta va la carrera, segun el reloj. Publico: lo usa la app."""
    from server import db as database

    carrera = await races.resolver_carrera(database, race_code)
    info = races.vuelta_actual(carrera)

    return {
        "race_code": carrera.get("code"),
        "race_name": carrera.get("name"),
        "estado": races.estado(carrera),
        "current_lap": info["current_lap"],
        "race_started": info["race_started"],
        "race_finished": info["race_finished"],
        "minutes_into_lap": info["minutes_into_lap"],
        "seconds_remaining": info["seconds_remaining"],
        "started_at": info["started_at"].isoformat() if info["started_at"] else None,
        "finished_at": info["finished_at"].isoformat() if info.get("finished_at") else None,
        "lap_start_time": info["lap_start_time"].isoformat() if info["lap_start_time"] else None,
        "lap_end_time": info["lap_end_time"].isoformat() if info["lap_end_time"] else None,
    }


@router.get("/clima")
async def clima_de_la_carrera(race_code: Optional[str] = None):
    """El tiempo en la sede. Publico: lo usa el tablero de la app.

    Devuelve `clima: null` en vez de fallar cuando Open-Meteo no responde: el
    tablero se queda sin ese bloque y el resto sigue funcionando.
    """
    from server import db as database

    carrera = await races.resolver_carrera(database, race_code)
    return {
        "race_code": carrera.get("code"),
        "clima": await clima.actual(carrera),
    }


@router.post("/mark-retired")
async def mark_retired(
    request: MarkRetiredRequest,
    race_code: str = Depends(races.carrera_del_panel),
    user=Depends(verify_token),
):
    """DNF: el corredor abandona conservando las vueltas que ya completo."""
    from server import db as database

    carrera, atleta = await _carrera_y_atleta(database, race_code, request.bib)

    if atleta.get("status") == "retired":
        raise HTTPException(status_code=400, detail="El participante ya está marcado como retirado")
    if atleta.get("status") == "dns":
        raise HTTPException(status_code=400, detail="El participante está marcado como DNS")

    estado = await laps.registrar_retiro(
        database, carrera, atleta, laps.RETIRO_MANUAL, request.retired_at_lap,
        laps.ORIGEN_PANEL, _autor(user), "DNF marcado desde el panel",
    )

    import asyncio
    asyncio.create_task(
        send_finish_notifications(database, carrera["code"], request.bib, is_winner=False)
    )

    return {
        "message": (
            f"Participante {request.bib} marcado como DNF en vuelta {request.retired_at_lap}. "
            f"Vueltas: {estado['laps_completed']} ({estado['total_km']} km)"
        ),
        **estado,
    }


@router.post("/mark-dns")
async def mark_dns(
    request: dict,
    race_code: str = Depends(races.carrera_del_panel),
    user=Depends(verify_token),
):
    """DNS: no se presento. Sus vueltas vuelven a cero."""
    from server import db as database

    carrera, atleta = await _carrera_y_atleta(database, race_code, request.get("bib"))

    if atleta.get("status") == "dns":
        raise HTTPException(status_code=400, detail="El participante ya está marcado como DNS")
    if atleta.get("status") == "retired":
        raise HTTPException(status_code=400, detail="El participante ya está retirado")

    # El ajuste a cero queda anotado en el libro: asi se ve que fue una decision
    # y no que se perdieron los escaneos.
    await laps.ajustar_vueltas(
        database, carrera, atleta, 0, _autor(user), "No se presento (DNS)"
    )
    await database.registrations.update_one(
        {"_id": atleta["_id"]},
        {
            "$set": {
                "status": "dns",
                "retired_at_lap": None,
                "updated_at": races.ahora_en_carrera(carrera),
            }
        },
    )

    bib = atleta.get("bib")
    return {"message": f"Participante {bib} marcado como DNS (No se presentó). Vueltas reseteadas a 0."}


@router.post("/adjust-laps")
async def adjust_participant_laps(
    request: AdjustLapsRequest,
    race_code: str = Depends(races.carrera_del_panel),
    user=Depends(verify_token),
):
    """Fija a mano las vueltas de un corredor."""
    from server import db as database

    carrera, atleta = await _carrera_y_atleta(database, race_code, request.bib)

    if atleta.get("status") == "dns":
        raise HTTPException(status_code=400, detail="No se pueden ajustar vueltas de un participante DNS")

    anteriores = atleta.get("laps_completed", 0)
    estado = await laps.ajustar_vueltas(
        database, carrera, atleta, request.new_laps, _autor(user), "Ajuste desde el panel"
    )

    return {
        "message": f"Vueltas de {request.bib} ajustadas de {anteriores} a {estado['laps_completed']}",
        "bib": request.bib,
        "old_laps": anteriores,
        "new_laps": estado["laps_completed"],
        "total_km": estado["total_km"],
    }


@router.post("/edit-participant")
async def edit_participant(
    request: EditParticipantRequest,
    race_code: str = Depends(races.carrera_del_panel),
    user=Depends(verify_token),
):
    """Corrige el nombre o la nacionalidad de un corredor."""
    from server import db as database

    carrera, atleta = await _carrera_y_atleta(database, race_code, request.bib)

    await database.registrations.update_one(
        {"_id": atleta["_id"]},
        {
            "$set": {
                "nombre": request.nombre,
                "apellidos": request.apellidos,
                "nacionalidad": request.nacionalidad.upper(),
                "updated_at": races.ahora_en_carrera(carrera),
            }
        },
    )

    return {
        "message": f"Datos del participante {request.bib} actualizados",
        "bib": request.bib,
        "nombre": request.nombre,
        "apellidos": request.apellidos,
        "nacionalidad": request.nacionalidad.upper(),
    }


@router.post("/mark-winner")
async def mark_winner(
    request: dict,
    race_code: str = Depends(races.carrera_del_panel),
    user=Depends(verify_token),
):
    """Declara el ganador. Solo puede haber uno por carrera."""
    from server import db as database

    carrera, atleta = await _carrera_y_atleta(database, race_code, request.get("bib"))

    if atleta.get("status") == "winner":
        raise HTTPException(status_code=400, detail="Este participante ya es el ganador")

    ya_hay = await database.registrations.find_one(
        {"race_code": carrera["code"], "status": "winner"}, {"_id": 0}
    )
    if ya_hay:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Ya existe un ganador: {ya_hay.get('nombre')} {ya_hay.get('apellidos')} "
                f"(BIB: {ya_hay.get('bib')})"
            ),
        )

    ahora = races.ahora_en_carrera(carrera)
    await database.registrations.update_one(
        {"_id": atleta["_id"]},
        {"$set": {"status": "winner", "won_at": ahora, "updated_at": ahora}},
    )

    return {
        "message": f"¡{atleta.get('nombre')} {atleta.get('apellidos')} ha sido marcado como GANADOR!",
        "bib": atleta.get("bib"),
        "nombre": atleta.get("nombre"),
        "apellidos": atleta.get("apellidos"),
    }


@router.post("/mark-honor")
async def mark_honor(
    request: dict,
    race_code: str = Depends(races.carrera_del_panel),
    user=Depends(verify_token),
):
    """Marca a un corredor como Invitada de Honor."""
    from server import db as database

    carrera, atleta = await _carrera_y_atleta(database, race_code, request.get("bib"))

    if atleta.get("status") == "honor":
        raise HTTPException(status_code=400, detail="Este participante ya es Invitada de Honor")

    await database.registrations.update_one(
        {"_id": atleta["_id"]},
        {"$set": {"status": "honor", "updated_at": races.ahora_en_carrera(carrera)}},
    )

    return {
        "message": f"¡{atleta.get('nombre')} {atleta.get('apellidos')} ha sido marcado como Invitada de Honor!",
        "bib": atleta.get("bib"),
        "nombre": atleta.get("nombre"),
        "apellidos": atleta.get("apellidos"),
    }


@router.post("/reactivate")
async def reactivate_participant(
    request: dict,
    race_code: str = Depends(races.carrera_del_panel),
    user=Depends(verify_token),
):
    """Devuelve a la carrera a alguien marcado por error.

    Si el retiro estaba anotado en el libro, se anula: de lo contrario la ficha
    diria que corre y el libro que se retiro.
    """
    from server import db as database

    carrera, atleta = await _carrera_y_atleta(database, race_code, request.get("bib"))

    if atleta.get("status") == "active":
        raise HTTPException(status_code=400, detail="El participante ya está activo")

    anotaciones = await laps.historial(database, carrera["code"], atleta.get("bib"))
    retiros = [a for a in anotaciones if a.get("action") in laps.RETIROS]
    if retiros:
        await laps.anular(
            database, carrera, retiros[-1]["_id"], _autor(user), "Reactivado desde el panel"
        )
    else:
        await database.registrations.update_one(
            {"_id": atleta["_id"]},
            {
                "$set": {"status": "active", "updated_at": races.ahora_en_carrera(carrera)},
                "$unset": {"retired_at_lap": "", "retired_at": "", "retired_reason": ""},
            },
        )

    return {
        "message": f"Participante {atleta.get('bib')} reactivado. ATENCIÓN: Puede que necesite ajustar sus vueltas manualmente."
    }


@router.post("/complete-lap")
async def complete_lap(
    request: CompleteLapRequest,
    race_code: str = Depends(races.carrera_del_panel),
    user=Depends(verify_token),
):
    """Anota una vuelta a mano, cuando el escaneo no llego a hacerse."""
    from server import db as database

    carrera, atleta = await _carrera_y_atleta(database, race_code, request.bib)

    if atleta.get("status") == "retired":
        raise HTTPException(status_code=400, detail="No se puede registrar vuelta de un participante retirado")

    vuelta = request.lap_number or (atleta.get("laps_completed", 0) + 1)

    if await laps.vuelta_ya_registrada(database, carrera["code"], atleta.get("bib"), vuelta):
        raise HTTPException(status_code=400, detail=f"La vuelta {vuelta} ya estaba registrada")

    estado = await laps.registrar_vuelta(
        database, carrera, atleta, vuelta, laps.ORIGEN_PANEL, _autor(user),
        races.vuelta_actual(carrera),
    )

    return {"message": f"Vuelta {vuelta} registrada para {request.bib}", **estado}


@router.post("/complete-lap-all-active")
async def complete_lap_all_active(
    race_code: str = Depends(races.carrera_del_panel),
    lap_number: Optional[int] = None,
    user=Depends(verify_token),
):
    """Cierra una vuelta para todos los que siguen en carrera.

    Por defecto cierra la ultima vuelta terminada segun el reloj. Se puede
    indicar otra a proposito, porque la corrección del dia despues casi nunca
    coincide con la vuelta en curso.
    """
    from server import db as database

    carrera = await races.obtener_carrera(database, race_code)
    info = races.vuelta_actual(carrera)

    vuelta = lap_number or max(1, info["current_lap"] - 1)

    activos = await database.registrations.find(
        {"race_code": carrera["code"], "status": "active", "bib": {"$ne": None}}
    ).to_list(1000)

    registrados = 0
    omitidos = 0
    for atleta in activos:
        if await laps.vuelta_ya_registrada(database, carrera["code"], atleta.get("bib"), vuelta):
            omitidos += 1
            continue
        await laps.registrar_vuelta(
            database, carrera, atleta, vuelta, laps.ORIGEN_PANEL, _autor(user), info,
            {"reason": "Cierre de vuelta para todos los activos"},
        )
        registrados += 1

    import asyncio
    asyncio.create_task(send_lap_notifications(database, carrera["code"], vuelta))

    mensaje = f"Vuelta {vuelta} completada para {registrados} atletas"
    if omitidos:
        mensaje += f" ({omitidos} ya tenían la vuelta registrada)"

    return {
        "message": mensaje,
        "updated_count": registrados,
        "skipped_count": omitidos,
        "lap_number": vuelta,
        "current_lap": info["current_lap"],
    }


@router.post("/revert-lap")
async def revert_lap(
    race_code: str = Depends(races.carrera_del_panel),
    lap_number: Optional[int] = None,
    user=Depends(verify_token),
):
    """Deshace una vuelta que se cerro por error.

    Anula lo anotado en esa vuelta -- vueltas y retiros -- y devuelve a la
    carrera a quienes se hubieran retirado en ella. Nada se borra: las
    anotaciones quedan marcadas como anuladas, con quien y cuando.
    """
    from server import db as database

    carrera = await races.obtener_carrera(database, race_code)
    info = races.vuelta_actual(carrera)

    vuelta = lap_number or max(1, info["current_lap"] - 1)

    anotaciones = await database.lap_registrations.find(
        {"race_code": carrera["code"], "lap_number": vuelta, "anulada": {"$ne": True}}
    ).to_list(2000)

    if not anotaciones:
        raise HTTPException(status_code=400, detail=f"No hay nada anotado en la vuelta {vuelta}")

    anuladas = 0
    reactivados = 0
    for anotacion in anotaciones:
        if anotacion.get("action") == laps.AJUSTE:
            # Un ajuste manual no es parte de la vuelta: se respeta.
            continue
        if anotacion.get("action") in laps.RETIROS:
            reactivados += 1
        await laps.anular(
            database, carrera, anotacion["_id"], _autor(user),
            f"Vuelta {vuelta} deshecha desde el panel",
        )
        anuladas += 1

    mensaje = f"Vuelta {vuelta} deshecha: {anuladas} anotacion(es) anuladas."
    if reactivados:
        mensaje += f" {reactivados} atleta(s) DNF reactivado(s)."

    return {
        "message": mensaje,
        "lap_number": vuelta,
        "updated_count": anuladas,
        "reactivated_count": reactivados,
    }


@router.post("/reset-database")
async def reset_database(
    request: dict,
    race_code: str = Depends(races.carrera_del_panel),
    user=Depends(verify_token),
):
    """Borra el seguimiento de una carrera y la deja lista para volver a correr.

    Es para simulacros: deja las inscripciones intactas y se lleva las vueltas.
    Pide el codigo de la carrera a proposito -- antes borraba lo de la carrera
    publicada, que con varias vivas ya no tiene por que ser la que se ensaya.
    """
    from server import db as database

    # Verify confirmation
    confirmation = request.get("confirmation", "")
    if confirmation != "REINICIO":
        raise HTTPException(status_code=400, detail="Confirmación incorrecta. Debe escribir REINICIO")

    carrera = await races.obtener_carrera(database, race_code)
    codigo = carrera["code"]

    result = await database.registrations.update_many(
        {
            "race_code": codigo,
            "status": {"$in": ["active", "retired", "winner", "honor"]}
        },
        {
            "$set": {
                "laps_completed": 0,
                "total_km": 0.0,
                "retired_at_lap": None,
                # Vuelven a ser inscritos: es "Iniciar carrera" quien los pone
                # en carrera, y asi el ensayo se repite desde el principio.
                "status": "registered",
                "updated_at": datetime.now(timezone.utc)
            },
            "$unset": {"retired_at": "", "retired_reason": "", "laps_log": ""},
        }
    )

    # La hora de salida tambien vuelve atras: si no, el reloj seguiria contando
    # desde la salida del ensayo anterior.
    await database.race_configurations.update_one(
        {"code": codigo},
        {"$unset": {"started_at": "", "started_by": ""},
         "$set": {"estado": "inscripcion", "updated_at": datetime.now(timezone.utc)}},
    )

    borradas = await database.lap_registrations.delete_many({"race_code": codigo})

    return {
        "message": f"Datos de carrera {codigo} reiniciados exitosamente",
        "race_code": codigo,
        "participants_reset": result.modified_count,
        "lap_registrations_deleted": borradas.deleted_count,
    }


# Email Subscription Endpoints
@router.post("/subscribe")
async def subscribe_to_notifications(
    request: SubscribeRequest,
    db=Depends(lambda: None)
):
    """Subscribe to email notifications for followed athletes"""
    from server import db as database
    
    if not request.athletes_bibs:
        raise HTTPException(status_code=400, detail="Debe seleccionar al menos un atleta para seguir")
    
    # Get active race code
    active_race_code = await get_active_race_code(database)
    
    # Check if subscription already exists for this email and race
    existing = await database.email_subscriptions.find_one({
        "email": request.email,
        "race_code": active_race_code
    })
    
    is_new_subscription = existing is None
    
    if existing:
        # Update existing subscription
        await database.email_subscriptions.update_one(
            {"email": request.email, "race_code": active_race_code},
            {
                "$set": {
                    "athletes_bibs": request.athletes_bibs,
                    "notify_every_lap": request.notify_every_lap,
                    "notify_on_finish": request.notify_on_finish,
                    "active": True,
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )
        subscription_id = str(existing.get("_id"))
        message = "Suscripción actualizada exitosamente"
    else:
        # Create new subscription with race_code
        subscription_data = {
            "email": request.email,
            "athletes_bibs": request.athletes_bibs,
            "notify_every_lap": request.notify_every_lap,
            "notify_on_finish": request.notify_on_finish,
            "race_code": active_race_code,
            "active": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        result = await database.email_subscriptions.insert_one(subscription_data)
        subscription_id = str(result.inserted_id)
        message = "Suscripción creada exitosamente"
    
    # Get full athlete data for confirmation - check registrations first
    athletes = []
    if active_race_code:
        for bib in request.athletes_bibs:
            athlete = await database.registrations.find_one(
                {"race_code": active_race_code, "bib": int(bib.lstrip('0')) if bib.lstrip('0').isdigit() else None},
                {"_id": 0, "edit_token": 0}
            )
            if athlete:
                athlete["bib"] = bib  # Keep original BIB format
                athletes.append(athlete)
    
    # Fallback to participants
    if not athletes:
        athletes = await database.participants.find(
            {"bib": {"$in": request.athletes_bibs}},
            {"_id": 0}
        ).to_list(100)
    
    # Only send confirmation email for NEW subscriptions
    if is_new_subscription:
        await send_notification_email(
            to_email=request.email,
            subject="Confirmación de Suscripción",
            content=f"Te has suscrito exitosamente para recibir notificaciones de {len(athletes)} atleta(s). "
                    f"Recibirás actualizaciones {'cada vuelta completada' if request.notify_every_lap else ''}"
                    f"{' y ' if request.notify_every_lap and request.notify_on_finish else ''}"
                    f"{'cuando finalicen' if request.notify_on_finish else ''}.",
            athletes_data=athletes,
            subscription_id=subscription_id
        )
    
    return {
        "message": message,
        "subscription_id": subscription_id,
        "athletes_count": len(request.athletes_bibs),
        "notify_every_lap": request.notify_every_lap,
        "notify_on_finish": request.notify_on_finish
    }


@router.post("/subscribe-update")
async def update_subscription_silent(
    request: SubscribeRequest,
    db=Depends(lambda: None)
):
    """Update subscription silently without sending email (for auto-updates when following athletes)"""
    from server import db as database
    
    if not request.athletes_bibs:
        return {"message": "No athletes to follow", "updated": False}
    
    # Check if subscription exists for this email
    existing = await database.email_subscriptions.find_one({"email": request.email})
    
    if not existing:
        return {"message": "No subscription found", "updated": False}
    
    # Update existing subscription silently
    await database.email_subscriptions.update_one(
        {"email": request.email},
        {
            "$set": {
                "athletes_bibs": request.athletes_bibs,
                "notify_every_lap": request.notify_every_lap,
                "notify_on_finish": request.notify_on_finish,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    return {
        "message": "Subscription updated",
        "updated": True,
        "athletes_count": len(request.athletes_bibs)
    }


@router.post("/reset-cheers")
async def reset_cheers(
    request: dict,
    race_code: str = Depends(races.carrera_del_panel),
    user=Depends(verify_token),
):
    """Borra los mensajes de animo de una carrera (solo administracion)."""
    from server import db as database

    # Verify confirmation
    confirmation = request.get("confirmation", "")
    if confirmation != "MENSAJES":
        raise HTTPException(status_code=400, detail="Confirmación incorrecta. Debe escribir MENSAJES")

    carrera = await races.obtener_carrera(database, race_code)
    active_race_code = carrera["code"]
    
    # IMPORTANT: Only delete messages that explicitly belong to the active race
    # Do NOT delete legacy messages without race_code as they may belong to archived races
    delete_query = {"race_code": active_race_code}
    
    # Count before deletion
    cheers_count = await database.cheer_messages.count_documents(delete_query)
    
    # Delete messages matching the query
    result = await database.cheer_messages.delete_many(delete_query)
    
    return {
        "message": f"Se han eliminado {result.deleted_count} mensajes de ánimo de la carrera {active_race_code}",
        "deleted_count": result.deleted_count,
        "race_code": active_race_code
    }


@router.get("/subscribers-count-public")
async def get_subscribers_count_public(
    race_code: Optional[str] = Query(None, description="Race code to filter by"),
    db=Depends(lambda: None)
):
    """Get the count of subscribers for each athlete (public endpoint for ranking)"""
    from server import db as database
    
    # Get race code - use parameter or get active race
    active_race_code = race_code
    if not active_race_code:
        active_race_code = await get_active_race_code(database)
    
    # Build match query
    match_query = {"active": True}
    if active_race_code:
        match_query["race_code"] = active_race_code
    
    # Aggregate to count how many active subscriptions include each athlete
    pipeline = [
        {"$match": match_query},
        {"$unwind": "$athletes_bibs"},
        {"$group": {
            "_id": "$athletes_bibs",
            "count": {"$sum": 1}
        }}
    ]
    
    results = await database.email_subscriptions.aggregate(pipeline).to_list(1000)
    
    # Convert to dict {bib: count}
    subscribers_count = {item["_id"]: item["count"] for item in results}
    
    return subscribers_count


@router.get("/unsubscribe/{subscription_id}")
async def unsubscribe(
    subscription_id: str,
    db=Depends(lambda: None)
):
    """Unsubscribe from email notifications"""
    from server import db as database
    
    try:
        result = await database.email_subscriptions.update_one(
            {"_id": ObjectId(subscription_id)},
            {"$set": {"active": False, "updated_at": datetime.utcnow()}}
        )
        
        if result.modified_count == 0:
            return {"message": "Suscripción no encontrada o ya cancelada"}
        
        return {"message": "Te has dado de baja exitosamente. Ya no recibirás más notificaciones."}
    except Exception as e:
        raise HTTPException(status_code=400, detail="ID de suscripción inválido")


@router.post("/unsubscribe-by-email/{email}")
async def unsubscribe_by_email(
    email: str,
    db=Depends(lambda: None)
):
    """Unsubscribe from email notifications using email address"""
    from server import db as database
    
    result = await database.email_subscriptions.update_one(
        {"email": email},
        {"$set": {"active": False, "updated_at": datetime.utcnow()}}
    )
    
    if result.modified_count == 0:
        return {"message": "Suscripción no encontrada o ya cancelada", "success": False}
    
    return {"message": "Te has dado de baja exitosamente.", "success": True}


@router.get("/subscription/{email}")
async def get_subscription(
    email: str,
    db=Depends(lambda: None)
):
    """Get subscription details for an email"""
    from server import db as database
    
    subscription = await database.email_subscriptions.find_one(
        {"email": email, "active": True},
        {"_id": 0, "email": 1, "athletes_bibs": 1, "notify_every_lap": 1, "notify_on_finish": 1}
    )
    
    if not subscription:
        return {"subscribed": False}
    
    return {
        "subscribed": True,
        **subscription
    }


@router.get("/followers-count")
async def get_followers_count(
    user=Depends(verify_token),
    db=Depends(lambda: None)
):
    """Get the count of followers for each athlete (admin only)"""
    from server import db as database
    
    # Aggregate to count how many active subscriptions include each athlete
    pipeline = [
        {"$match": {"active": True}},
        {"$unwind": "$athletes_bibs"},
        {"$group": {
            "_id": "$athletes_bibs",
            "count": {"$sum": 1}
        }}
    ]
    
    results = await database.email_subscriptions.aggregate(pipeline).to_list(1000)
    
    # Convert to dict {bib: count}
    followers_count = {item["_id"]: item["count"] for item in results}
    
    return followers_count


@router.post("/reset-subscriptions")
async def reset_subscriptions(
    request: dict,
    race_code: str = Depends(races.carrera_del_panel),
    user=Depends(verify_token),
):
    """Borra las suscripciones de correo de una carrera (solo administracion)."""
    from server import db as database

    # Verify confirmation
    confirmation = request.get("confirmation", "")
    if confirmation != "SUSCRIPCIONES":
        raise HTTPException(status_code=400, detail="Confirmación incorrecta. Debe escribir SUSCRIPCIONES")

    carrera = await races.obtener_carrera(database, race_code)
    active_race_code = carrera["code"]
    
    # Count before deletion for active race
    subs_count = await database.email_subscriptions.count_documents({"race_code": active_race_code})
    
    # Delete only subscriptions for this race
    result = await database.email_subscriptions.delete_many({"race_code": active_race_code})
    
    return {
        "message": f"Se han eliminado {result.deleted_count} suscripciones de correo de la carrera {active_race_code}",
        "deleted_count": result.deleted_count,
        "race_code": active_race_code
    }


@router.get("/subscribers-count")
async def get_subscribers_count_public(
    db=Depends(lambda: None)
):
    """Get the count of email subscribers for each athlete (public endpoint)"""
    from server import db as database
    
    # Aggregate to count how many active subscriptions include each athlete
    pipeline = [
        {"$match": {"active": True}},
        {"$unwind": "$athletes_bibs"},
        {"$group": {
            "_id": "$athletes_bibs",
            "count": {"$sum": 1}
        }}
    ]
    
    results = await database.email_subscriptions.aggregate(pipeline).to_list(1000)
    
    # Convert to dict {bib: count}
    subscribers_count = {item["_id"]: item["count"] for item in results}
    
    return subscribers_count



# Cheer Messages Endpoints
@router.post("/cheer")
async def submit_cheer_message(
    request: CheerMessageRequest,
    authorization: Optional[str] = Header(None),
    db=Depends(lambda: None)
):
    """Submit a cheer message for an athlete.

    El token es opcional a proposito. Animar sin cuenta sigue funcionando igual
    que siempre —es como llega la mayoria, y cerrarlo de golpe cortaria el hilo
    de la carrera—, pero cuando viene firmado se guarda `account_id` y el
    mensaje deja de ser un nombre suelto: se sabe quien anima, se le puede
    avisar, y el ano que viene se le reconoce.
    """
    from server import db as database
    from services.twitter_service import post_cheer_to_twitter
    
    # Get active race code
    active_race_code = await get_active_race_code(database)

    # El hilo de animos se cierra un mes despues de la carrera. Se comprueba
    # aqui y no solo en la pantalla: la app vieja que siga instalada, o
    # cualquiera que llame al endpoint, tiene que encontrarse la puerta cerrada
    # igual.
    from services import races as servicio_carreras

    carrera = await database.race_configurations.find_one({"code": active_race_code}) if active_race_code else None
    if servicio_carreras.animos_cerrados(carrera):
        cierre = servicio_carreras.cierre_de_animos(carrera)
        raise HTTPException(
            status_code=403,
            detail=(
                "Los mensajes de ánimo de esta carrera se cerraron el "
                f"{cierre.strftime('%d/%m/%Y')}. Los que ya se enviaron siguen visibles."
            ),
        )

    # Validate athlete exists - check registrations first, then participants.
    # El bib se guarda como texto con ceros ("017") al inscribirse, pero hay
    # registros viejos con entero: se buscan ambas formas.
    athlete = None
    if active_race_code:
        bib_digits = request.athlete_bib.lstrip('0')
        bib_formas = [request.athlete_bib, request.athlete_bib.zfill(3)]
        if bib_digits.isdigit():
            bib_formas.append(int(bib_digits))
        # "waitlist" incluido: la app los muestra en la categoria Espera y en la
        # ficha, asi que se les podia escribir y el envio moria con un 404.
        athlete = await database.registrations.find_one(
            {"race_code": active_race_code, "bib": {"$in": bib_formas}, "status": {"$in": ["registered", "active", "retired", "winner", "honor", "waitlist"]}},
            {"_id": 0, "edit_token": 0}
        )
    
    if not athlete:
        athlete = await database.participants.find_one({"bib": request.athlete_bib}, {"_id": 0})
    
    if not athlete:
        raise HTTPException(status_code=404, detail="Atleta no encontrado")
    
    # Validate message length
    if len(request.message) > 280:
        raise HTTPException(status_code=400, detail="El mensaje no puede exceder 280 caracteres")
    
    if len(request.fan_name) > 50:
        raise HTTPException(status_code=400, detail="El nombre no puede exceder 50 caracteres")
    
    # Quien viene con sesion abierta firma el mensaje con su cuenta. Un token
    # invalido o caducado no tumba el envio: se anima igual, sin cuenta, que es
    # lo que se hacia hasta ahora.
    cuenta = None
    if authorization:
        try:
            from services import cuentas as servicio_cuentas
            from services.auth import verify_cuenta_token

            payload = verify_cuenta_token(authorization)
            cuenta = await servicio_cuentas.por_id(database, payload.get("sub"))
        except Exception:
            cuenta = None

    # Create cheer message with race_code
    cheer_data = {
        "athlete_bib": request.athlete_bib,
        "fan_name": request.fan_name,
        "message": request.message,
        "race_code": active_race_code,
        "created_at": datetime.now(timezone.utc)
    }
    if cuenta:
        cheer_data["account_id"] = cuenta["_id"]
        # El nombre de la cuenta manda sobre el que venga escrito en el cuerpo:
        # es el que la persona eligio para si, no uno tecleado de paso.
        if (cuenta.get("nombre") or "").strip():
            cheer_data["fan_name"] = cuenta["nombre"].strip()

    await database.cheer_messages.insert_one(cheer_data)
    
    # Try to post to Twitter (non-blocking, don't fail if Twitter fails)
    athlete_name = f"{athlete['nombre']} {athlete['apellidos']}"
    nacionalidad = athlete.get('nacionalidad', '')
    
    twitter_result = await post_cheer_to_twitter(
        # El mismo nombre que se guardo, que con cuenta es el de la cuenta.
        fan_name=cheer_data["fan_name"],
        athlete_name=athlete_name,
        athlete_bib=request.athlete_bib,
        message=request.message,
        nacionalidad=nacionalidad
    )
    
    response = {
        "message": "¡Mensaje de ánimo enviado! Gracias por apoyar a los atletas.",
        "athlete_bib": request.athlete_bib,
        "athlete_name": athlete_name
    }
    
    if twitter_result.get("success"):
        response["twitter_posted"] = True
        response["tweet_url"] = twitter_result.get("tweet_url")
    else:
        response["twitter_posted"] = False
        # Don't expose internal error to user
    
    return response


# Un mensaje borrado por el corredor no se enseña en ninguna parte, pero el
# documento se conserva: lo normal es que se borre por ofensivo, y ahi la
# organizacion necesita poder verlo.
SIN_BORRADOS = {"deleted_by_athlete": {"$ne": True}}


@router.get("/cheers")
async def get_cheer_messages(
    limit: int = 50,
    page: int = 1,
    athlete_bib: Optional[str] = None,
    race_code: Optional[str] = Query(None, description="Race code to filter by"),
    include_legacy: bool = Query(False, description="Include messages without race_code"),
    db=Depends(lambda: None)
):
    """Get cheer messages with pagination (most recent first)"""
    from server import db as database
    
    # Legacy race codes - races that existed before race_code was added to messages
    LEGACY_RACE_CODES = ["BYSD-2026"]
    
    # Get race code - use parameter or get active race
    active_race_code = race_code
    if not active_race_code:
        active_race_code = await get_active_race_code(database)
    
    # Check if this is an archived race - if so, query from archived_cheer_messages
    race_config = await database.race_configurations.find_one({"code": active_race_code})
    is_archived_race = race_config and race_config.get("data_archived", False)
    
    # Choose the correct collection
    collection = database.archived_cheer_messages if is_archived_race else database.cheer_messages
    
    # For legacy races, automatically include messages without race_code
    is_legacy_race = active_race_code in LEGACY_RACE_CODES
    should_include_legacy = include_legacy or is_legacy_race
    
    # Build query
    query = {}
    if active_race_code:
        if should_include_legacy:
            # Include messages with this race_code OR messages without race_code (legacy)
            query["$or"] = [
                {"race_code": active_race_code},
                {"race_code": {"$exists": False}},
                {"race_code": None},
                {"race_code": ""}
            ]
        else:
            # Only show messages for the specified race
            query["race_code"] = active_race_code
    
    if athlete_bib:
        if "$or" in query:
            query = {"$and": [{"$or": query["$or"]}, {"athlete_bib": athlete_bib}]}
        else:
            query["athlete_bib"] = athlete_bib

    query = {"$and": [query, SIN_BORRADOS]} if query else dict(SIN_BORRADOS)
    
    # Calculate skip for pagination
    skip = (page - 1) * limit
    
    # Get total count for pagination info
    total_count = await collection.count_documents(query)
    total_pages = (total_count + limit - 1) // limit  # Ceiling division
    
    # Get messages sorted by created_at descending with pagination
    messages = await collection.find(
        query
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    # El identificador sale para que se le pueda dar "me gusta"; el _id crudo no
    # es serializable y ademas no hace falta fuera.
    for msg in messages:
        msg["id"] = str(msg.pop("_id"))
        msg["likes"] = msg.get("likes", 0)
        # La respuesta del corredor sale en el muro: quien escribio merece ver
        # que le contestaron, y es aqui donde lo busca.
        msg["reply"] = msg.get("athlete_reply")
        msg["replied_at"] = (
            msg["athlete_reply_at"].isoformat() if msg.get("athlete_reply_at") else None
        )
        msg.pop("athlete_reply", None)
        msg.pop("athlete_reply_at", None)
    
    # Enrich with athlete names - check registrations first for new races
    for msg in messages:
        athlete = None
        if active_race_code and active_race_code not in LEGACY_RACE_CODES:
            # Try registrations first for new races. El bib se guarda como
            # texto con ceros ("017"); hay registros viejos con entero.
            bib_digits = msg["athlete_bib"].lstrip('0')
            bib_formas = [msg["athlete_bib"], msg["athlete_bib"].zfill(3)]
            if bib_digits.isdigit():
                bib_formas.append(int(bib_digits))
            athlete = await database.registrations.find_one(
                {"race_code": active_race_code, "bib": {"$in": bib_formas}},
                {"_id": 0, "nombre": 1, "apellidos": 1, "nacionalidad": 1}
            )
        
        # Fallback to participants
        if not athlete:
            athlete = await database.participants.find_one(
                {"bib": msg["athlete_bib"]},
                {"_id": 0, "nombre": 1, "apellidos": 1, "nacionalidad": 1}
            )
        
        if athlete:
            msg["athlete_name"] = f"{athlete['nombre']} {athlete['apellidos']}"
            msg["athlete_nacionalidad"] = athlete.get("nacionalidad", "")
    
    # Para que la pantalla sepa si todavía se puede escribir sin tener que
    # intentarlo y comerse el error
    from services import races as servicio_carreras

    cierre = servicio_carreras.cierre_de_animos(race_config)

    return {
        "messages": messages,
        "animo_abierto": not servicio_carreras.animos_cerrados(race_config),
        "animo_cierra_el": cierre.isoformat() if cierre else None,
        "pagination": {
            "page": page,
            "limit": limit,
            "total_count": total_count,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1
        }
    }


@router.post("/cheers/{cheer_id}/like")
async def like_cheer_message(cheer_id: str, quitar: bool = False):
    """Suma o resta un "me gusta" a un mensaje de animo.

    Quien anima no tiene cuenta, asi que no hay a quien atribuir el voto: el
    telefono recuerda a cuales dio y el servidor solo lleva la cuenta. Es un
    muro de apoyo, no una votacion; no merece la pena montar identidades para
    esto. El contador no baja de cero por si llegan dos "quitar" seguidos.
    """
    from server import db as database
    from bson import ObjectId
    from bson.errors import InvalidId

    try:
        oid = ObjectId(cheer_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")

    for coleccion in (database.cheer_messages, database.archived_cheer_messages):
        doc = await coleccion.find_one({"_id": oid}, {"likes": 1})
        if not doc:
            continue
        actuales = doc.get("likes", 0)
        nuevos = max(0, actuales - 1) if quitar else actuales + 1
        await coleccion.update_one({"_id": oid}, {"$set": {"likes": nuevos}})
        return {"id": cheer_id, "likes": nuevos}

    raise HTTPException(status_code=404, detail="Mensaje no encontrado")


@router.get("/cheers/count")
async def get_cheer_count(
    race_code: Optional[str] = Query(None, description="Race code to get count for"),
    db=Depends(lambda: None)
):
    """Get total count of cheer messages for a race"""
    from server import db as database
    
    # Legacy race codes
    LEGACY_RACE_CODES = ["BYSD-2026"]
    
    # Get race code - use parameter or get active race
    target_race_code = race_code
    if not target_race_code:
        target_race_code = await get_active_race_code(database)
    
    # Check if this is an archived race
    race_config = await database.race_configurations.find_one({"code": target_race_code})
    is_archived_race = race_config and race_config.get("data_archived", False)
    
    # Choose the correct collection
    collection = database.archived_cheer_messages if is_archived_race else database.cheer_messages
    
    # For legacy races, include messages without race_code
    is_legacy_race = target_race_code in LEGACY_RACE_CODES
    
    # Count messages
    if target_race_code:
        if is_legacy_race:
            count = await collection.count_documents({
                "$or": [
                    {"race_code": target_race_code},
                    {"race_code": {"$exists": False}},
                    {"race_code": None},
                    {"race_code": ""}
                ],
                **SIN_BORRADOS,
            })
        else:
            count = await collection.count_documents({"race_code": target_race_code, **SIN_BORRADOS})
    else:
        count = 0
    
    return {"count": count, "race_code": target_race_code, "is_archived": is_archived_race, "is_legacy": is_legacy_race}


@router.get("/cheers/leaderboard")
async def get_cheer_leaderboard(
    limit: int = 10,
    race_code: Optional[str] = Query(None, description="Race code to get leaderboard for"),
    db=Depends(lambda: None)
):
    """Get leaderboard of athletes with most cheer messages"""
    from server import db as database
    
    # Legacy race codes
    LEGACY_RACE_CODES = ["BYSD-2026"]
    
    # Get race code - use parameter or get active race
    target_race_code = race_code
    if not target_race_code:
        target_race_code = await get_active_race_code(database)
    
    # Check if this is an archived race
    race_config = await database.race_configurations.find_one({"code": target_race_code})
    is_archived_race = race_config and race_config.get("data_archived", False)
    
    # Choose the correct collection for messages
    messages_collection = database.archived_cheer_messages if is_archived_race else database.cheer_messages
    
    # For legacy races, include messages without race_code
    is_legacy_race = target_race_code in LEGACY_RACE_CODES
    
    # Build match stage
    if target_race_code:
        if is_legacy_race:
            match_stage = {
                "$or": [
                    {"race_code": target_race_code},
                    {"race_code": {"$exists": False}},
                    {"race_code": None},
                    {"race_code": ""}
                ]
            }
        else:
            match_stage = {"race_code": target_race_code}
    else:
        match_stage = {}

    match_stage = {**match_stage, **SIN_BORRADOS}

    pipeline = [
        {"$match": match_stage},
        {"$group": {
            "_id": "$athlete_bib",
            "cheer_count": {"$sum": 1}
        }},
        {"$sort": {"cheer_count": -1}},
        {"$limit": limit}
    ]
    
    results = await messages_collection.aggregate(pipeline).to_list(limit)
    
    # Enrich with athlete data
    leaderboard = []
    for i, item in enumerate(results):
        athlete = await database.participants.find_one(
            {"bib": item["_id"]},
            {"_id": 0, "bib": 1, "nombre": 1, "apellidos": 1, "nacionalidad": 1, "status": 1, "laps_completed": 1}
        )
        if athlete:
            leaderboard.append({
                "rank": i + 1,
                "bib": athlete["bib"],
                "nombre": athlete["nombre"],
                "apellidos": athlete["apellidos"],
                "nacionalidad": athlete.get("nacionalidad", ""),
                "status": athlete.get("status", "active"),
                "laps_completed": athlete.get("laps_completed", 0),
                "cheer_count": item["cheer_count"]
            })
    
    return leaderboard


def get_fan_badge(cheer_count: int) -> dict:
    """Get badge info based on number of cheers sent"""
    if cheer_count >= 10:
        return {"level": "legend", "name": "Leyenda", "emoji": "🏆", "color": "gold"}
    elif cheer_count >= 5:
        return {"level": "super_fan", "name": "Súper Fan", "emoji": "⭐", "color": "purple"}
    elif cheer_count >= 3:
        return {"level": "cheerleader", "name": "Animador", "emoji": "📣", "color": "blue"}
    else:
        return {"level": "rookie", "name": "Novato", "emoji": "🌱", "color": "green"}


@router.get("/fans/leaderboard")
async def get_fans_leaderboard(
    limit: int = 10,
    race_code: Optional[str] = Query(None, description="Race code to filter by"),
    db=Depends(lambda: None)
):
    """Get leaderboard of fans with most cheer messages sent"""
    from server import db as database
    
    # Legacy race codes
    LEGACY_RACE_CODES = ["BYSD-2026"]
    
    # Get race code - use parameter or get active race
    target_race_code = race_code
    if not target_race_code:
        target_race_code = await get_active_race_code(database)
    
    # Check if this is an archived race
    race_config = await database.race_configurations.find_one({"code": target_race_code})
    is_archived_race = race_config and race_config.get("data_archived", False)
    
    # Choose the correct collection for messages
    messages_collection = database.archived_cheer_messages if is_archived_race else database.cheer_messages
    
    # For legacy races, include messages without race_code
    is_legacy_race = target_race_code in LEGACY_RACE_CODES
    
    # Build match stage
    if target_race_code:
        if is_legacy_race:
            match_stage = {"$match": {
                "$or": [
                    {"race_code": target_race_code},
                    {"race_code": {"$exists": False}},
                    {"race_code": None},
                    {"race_code": ""}
                ]
            }}
        else:
            match_stage = {"$match": {"race_code": target_race_code}}
    else:
        match_stage = None
    
    pipeline = []
    if match_stage:
        pipeline.append(match_stage)
    
    pipeline.extend([
        {"$group": {
            "_id": "$fan_name",
            "cheer_count": {"$sum": 1},
            "athletes_cheered": {"$addToSet": "$athlete_bib"}
        }},
        {"$sort": {"cheer_count": -1}},
        {"$limit": limit}
    ])
    
    results = await messages_collection.aggregate(pipeline).to_list(limit)
    
    leaderboard = []
    for i, item in enumerate(results):
        badge = get_fan_badge(item["cheer_count"])
        leaderboard.append({
            "rank": i + 1,
            "fan_name": item["_id"],
            "cheer_count": item["cheer_count"],
            "athletes_cheered": len(item["athletes_cheered"]),
            "badge": badge
        })
    
    return leaderboard


@router.get("/fans/badge/{fan_name}")
async def get_fan_badge_info(
    fan_name: str,
    race_code: Optional[str] = Query(None, description="Race code to filter by"),
    db=Depends(lambda: None)
):
    """Get badge info for a specific fan"""
    from server import db as database
    
    # Legacy race codes
    LEGACY_RACE_CODES = ["BYSD-2026"]
    
    # Get race code - use parameter or get active race
    target_race_code = race_code
    if not target_race_code:
        target_race_code = await get_active_race_code(database)
    
    # Check if this is an archived race
    race_config = await database.race_configurations.find_one({"code": target_race_code})
    is_archived_race = race_config and race_config.get("data_archived", False)
    
    # Choose the correct collection for messages
    messages_collection = database.archived_cheer_messages if is_archived_race else database.cheer_messages
    
    # For legacy races, include messages without race_code
    is_legacy_race = target_race_code in LEGACY_RACE_CODES
    
    # Build query
    if target_race_code:
        if is_legacy_race:
            query = {
                "fan_name": fan_name,
                "$or": [
                    {"race_code": target_race_code},
                    {"race_code": {"$exists": False}},
                    {"race_code": None},
                    {"race_code": ""}
                ]
            }
        else:
            query = {"fan_name": fan_name, "race_code": target_race_code}
    else:
        query = {"fan_name": fan_name}
    
    # Count messages by this fan for this race
    count = await messages_collection.count_documents(query)
    
    # Get unique athletes cheered
    pipeline = [
        {"$match": query},
        {"$group": {"_id": "$athlete_bib"}}
    ]
    athletes = await messages_collection.aggregate(pipeline).to_list(100)
    
    badge = get_fan_badge(count)
    
    # Calculate progress to next badge
    next_badge = None
    progress = 0
    if count < 3:
        next_badge = {"name": "Animador", "emoji": "📣", "required": 3}
        progress = (count / 3) * 100
    elif count < 5:
        next_badge = {"name": "Súper Fan", "emoji": "⭐", "required": 5}
        progress = (count / 5) * 100
    elif count < 10:
        next_badge = {"name": "Leyenda", "emoji": "🏆", "required": 10}
        progress = (count / 10) * 100
    else:
        progress = 100
    
    return {
        "fan_name": fan_name,
        "cheer_count": count,
        "athletes_cheered": len(athletes),
        "badge": badge,
        "next_badge": next_badge,
        "progress": round(progress, 1)
    }


@router.get("/twitter/status")
async def get_twitter_status():
    """Check Twitter integration status"""
    from services.twitter_service import check_twitter_config
    return check_twitter_config()


@router.post("/send-runner-emails")
async def send_runner_completion_emails(
    race_code: str = Depends(races.carrera_del_panel),
    user=Depends(verify_token),
):
    """Correo de cierre a los corredores de una carrera, cuando ya hay ganador.

    Pide la carrera a proposito: mandar el correo de cierre a los corredores
    equivocados no tiene vuelta atras.
    """
    from server import db as database
    from services.runner_email_service import send_runner_completion_email

    carrera = await races.obtener_carrera(database, race_code)
    active_race_code = carrera["code"]

    # Get participants from registrations collection
    active_participants = await database.registrations.find(
        {"race_code": active_race_code, "status": "active", "bib": {"$ne": None}},
        {"_id": 0, "edit_token": 0}
    ).to_list(100)
    
    retired_participants = await database.registrations.find(
        {"race_code": active_race_code, "status": "retired", "bib": {"$ne": None}},
        {"_id": 0, "edit_token": 0}
    ).to_list(100)
    
    # Check winner conditions
    winner_bib = None
    if len(active_participants) == 1 and len(retired_participants) > 0:
        winner = active_participants[0]
        winner_laps = winner.get("laps_completed", 0)
        max_retired_laps = max([p.get("laps_completed", 0) for p in retired_participants], default=0)
        if winner_laps > max_retired_laps:
            winner_bib = str(winner.get("bib")).zfill(3)
    
    # Get all participants except DNS
    participants = await database.registrations.find(
        {
            "race_code": active_race_code,
            "status": {"$in": ["active", "retired", "winner"]},
            "bib": {"$ne": None}
        },
        {"_id": 0, "edit_token": 0}
    ).to_list(100)
    
    results = {
        "total_runners": len(participants),
        "emails_sent": 0,
        "emails_failed": 0,
        "no_email": 0,
        "winner_bib": winner_bib,
        "race_code": active_race_code,
        "details": []
    }
    
    for participant in participants:
        bib = str(participant.get("bib")).zfill(3) if participant.get("bib") else ""
        nombre = participant.get("nombre", "")
        apellidos = participant.get("apellidos", "")
        full_name = f"{nombre} {apellidos}".strip()
        total_km = participant.get("total_km", 0)
        laps_completed = participant.get("laps_completed", 0)
        
        # Get email from registration
        email = participant.get("email")
        if not email:
            results["no_email"] += 1
            results["details"].append({
                "bib": bib,
                "name": full_name,
                "status": "no_email"
            })
            continue
        
        # Get followers count (for this race)
        followers_count = await database.email_subscriptions.count_documents({
            "athletes_bibs": bib,
            "race_code": active_race_code,
            "active": True
        })
        
        # Get cheer messages (for this race)
        cheer_messages = await database.cheer_messages.find(
            {"athlete_bib": bib, "race_code": active_race_code},
            {"_id": 0}
        ).sort("created_at", 1).to_list(500)
        
        messages_count = len(cheer_messages)
        is_winner = bib == winner_bib
        
        # Send email
        success = await send_runner_completion_email(
            to_email=email,
            runner_name=full_name,
            total_km=total_km,
            laps_completed=laps_completed,
            followers_count=followers_count,
            messages_count=messages_count,
            cheer_messages=cheer_messages,
            is_winner=is_winner
        )
        
        if success:
            results["emails_sent"] += 1
            results["details"].append({
                "bib": bib,
                "name": full_name,
                "email": email,
                "is_winner": is_winner,
                "laps": laps_completed,
                "messages": messages_count,
                "status": "sent"
            })
        else:
            results["emails_failed"] += 1
            results["details"].append({
                "bib": bib,
                "name": full_name,
                "email": email,
                "status": "failed"
            })
    
    return results


@router.post("/send-runner-email-test")
async def send_test_runner_email(
    bib: str,
    test_email: str,
    user=Depends(verify_token),
    db=Depends(lambda: None)
):
    """Send a test completion email for a specific runner to a test email address"""
    from server import db as database
    from services.runner_email_service import send_runner_completion_email
    
    # Get participant
    participant = await database.participants.find_one(
        {"bib": bib},
        {"_id": 0}
    )
    
    if not participant:
        raise HTTPException(status_code=404, detail="Participante no encontrado")
    
    nombre = participant.get("nombre", "")
    apellidos = participant.get("apellidos", "")
    full_name = f"{nombre} {apellidos}".strip()
    total_km = participant.get("total_km", 0)
    laps_completed = participant.get("laps_completed", 0)
    
    # Get followers count
    followers_count = await database.email_subscriptions.count_documents({
        "athletes_bibs": bib,
        "is_active": True
    })
    
    # Get cheer messages
    cheer_messages = await database.cheer_messages.find(
        {"athlete_bib": bib},
        {"_id": 0}
    ).sort("created_at", 1).to_list(500)
    
    messages_count = len(cheer_messages)
    
    # Send test email
    success = await send_runner_completion_email(
        to_email=test_email,
        runner_name=full_name,
        total_km=total_km,
        laps_completed=laps_completed,
        followers_count=followers_count,
        messages_count=messages_count,
        cheer_messages=cheer_messages,
        is_winner=False
    )
    
    if success:
        return {
            "message": f"Email de prueba enviado a {test_email}",
            "runner": full_name,
            "bib": bib,
            "stats": {
                "total_km": total_km,
                "laps": laps_completed,
                "followers": followers_count,
                "messages": messages_count
            }
        }
    else:
        raise HTTPException(status_code=500, detail="Error al enviar el email")


def _fix_certificate_name(pdf_path: str, correct_name: str) -> bytes:
    """Fix corrupted name in certificate PDF on-the-fly. Returns corrected PDF bytes."""
    import fitz

    doc = fitz.open(pdf_path)
    page = doc[0]

    # Find the name text (first text block at y ~284-317)
    pdf_name = None
    name_bbox = None
    for block in page.get_text("dict")["blocks"]:
        if "lines" not in block:
            continue
        for line in block["lines"]:
            for span in line["spans"]:
                b = span["bbox"]
                if 280 < b[1] < 320 and b[0] < 500:
                    pdf_name = span["text"].strip()
                    name_bbox = fitz.Rect(b)
                    break
            if name_bbox:
                break
        if name_bbox:
            break

    if not name_bbox or pdf_name == correct_name:
        # Already correct or can't find name area
        pdf_bytes = doc.tobytes()
        doc.close()
        return pdf_bytes

    logging.info(f"Fixing certificate name: '{pdf_name}' -> '{correct_name}'")

    # Redact old name (preserve background image)
    page.add_redact_annot(name_bbox)
    page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE)

    # Insert correct name at same baseline
    baseline_y = name_bbox.y0 + 12 * 1.621
    page.insert_text(
        fitz.Point(name_bbox.x0, baseline_y),
        correct_name,
        fontsize=12,
        fontname="helv",
        color=(0, 0, 0),
    )

    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


@router.get("/certificate/{bib}")
async def get_certificate(bib: str, db=Depends(lambda: None)):
    """Get certificate PDF for a participant. Opens in browser for viewing."""
    from server import db as database
    
    # Check participant exists and has valid status
    participant = await database.participants.find_one({"bib": bib}, {"_id": 0})
    
    if not participant:
        participant = await database.archived_participants.find_one({"bib": bib}, {"_id": 0})
    
    if not participant:
        raise HTTPException(status_code=404, detail="Participante no encontrado")
    
    status = participant.get("status", "active")
    
    # DNS athletes cannot download certificates
    if status == "dns":
        raise HTTPException(
            status_code=403, 
            detail="Los atletas DNS no tienen certificado disponible"
        )
    
    # Check if certificate exists
    certificate_path = CERTIFICATES_DIR / f"{bib}.pdf"
    
    if not certificate_path.exists():
        raise HTTPException(
            status_code=404, 
            detail="Certificado no disponible para este participante"
        )
    
    # Get participant name for filename
    nombre = participant.get("nombre", "")
    apellidos = participant.get("apellidos", "")
    correct_name = f"{nombre} {apellidos}"
    from unicodedata import normalize
    import re
    safe_name = re.sub(r'[^\w\s-]', '', normalize('NFKD', f"{nombre}_{apellidos}").encode('ascii', 'ignore').decode()).replace(" ", "_")
    safe_filename = f"Certificado_{safe_name}_{bib}.pdf"
    utf8_filename = f"Certificado_{nombre}_{apellidos}_{bib}.pdf".replace(" ", "_")
    
    # Fix name in PDF on-the-fly if corrupted
    from fastapi.responses import Response
    pdf_bytes = _fix_certificate_name(str(certificate_path), correct_name)
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"inline; filename=\"{safe_filename}\"; filename*=UTF-8''{urllib.parse.quote(utf8_filename)}"
        }
    )


@router.get("/certificate/{bib}/image")
async def get_certificate_image(bib: str, db=Depends(lambda: None)):
    """Get certificate as high-resolution PNG image for social media sharing."""
    import fitz  # PyMuPDF
    from fastapi.responses import Response
    from server import db as database
    
    # Check participant exists and has valid status
    participant = await database.participants.find_one({"bib": bib}, {"_id": 0})
    
    if not participant:
        participant = await database.archived_participants.find_one({"bib": bib}, {"_id": 0})
    
    if not participant:
        raise HTTPException(status_code=404, detail="Participante no encontrado")
    
    status = participant.get("status", "active")
    
    if status == "dns":
        raise HTTPException(
            status_code=403, 
            detail="Los atletas DNS no tienen certificado disponible"
        )
    
    certificate_path = CERTIFICATES_DIR / f"{bib}.pdf"
    
    if not certificate_path.exists():
        raise HTTPException(
            status_code=404, 
            detail="Certificado no disponible para este participante"
        )
    
    # Convert PDF to high-resolution image (fix name on-the-fly)
    nombre = participant.get("nombre", "")
    apellidos = participant.get("apellidos", "")
    correct_name = f"{nombre} {apellidos}"
    
    pdf_bytes = _fix_certificate_name(str(certificate_path), correct_name)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    page = doc[0]
    
    # High resolution: 300 DPI (default is 72, so multiply by ~4.17)
    zoom = 4.0  # 4x zoom for high resolution (~288 DPI)
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    
    # Convert to PNG bytes
    img_bytes = pix.tobytes("png")
    doc.close()
    
    # Get participant name for filename
    from unicodedata import normalize
    import re
    safe_name = re.sub(r'[^\w\s-]', '', normalize('NFKD', f"{nombre}_{apellidos}").encode('ascii', 'ignore').decode()).replace(" ", "_")
    safe_filename = f"Certificado_{safe_name}_{bib}.png"
    utf8_filename = f"Certificado_{nombre}_{apellidos}_{bib}.png".replace(" ", "_")
    
    return Response(
        content=img_bytes,
        media_type="image/png",
        headers={
            "Content-Disposition": f"attachment; filename=\"{safe_filename}\"; filename*=UTF-8''{urllib.parse.quote(utf8_filename)}"
        }
    )


@router.get("/certificate-check/{bib}")
async def check_certificate(bib: str, db=Depends(lambda: None)):
    """Check if a participant can download their certificate"""
    from server import db as database
    
    participant = await database.participants.find_one({"bib": bib}, {"_id": 0})
    
    if not participant:
        participant = await database.archived_participants.find_one({"bib": bib}, {"_id": 0})
    
    if not participant:
        return {"available": False, "reason": "Participante no encontrado"}
    
    status = participant.get("status", "active")
    
    if status == "dns":
        return {"available": False, "reason": "No disponible para DNS"}
    
    certificate_path = CERTIFICATES_DIR / f"{bib}.pdf"
    
    if not certificate_path.exists():
        return {"available": False, "reason": "Certificado no generado"}
    
    return {
        "available": True, 
        "status": status,
        "nombre": participant.get("nombre"),
        "apellidos": participant.get("apellidos")
    }


@router.get("/athlete-laps/{bib}")
async def get_athlete_laps(bib: str, race_code: Optional[str] = None, db=Depends(lambda: None)):
    """Vueltas de un atleta para BYSD Live: hora, duración y pace por vuelta.

    Sale todo del libro mayor de vueltas, escaneadas o puestas a mano: antes
    habia que juntar dos fuentes porque el panel y el escaner anotaban en sitios
    distintos. Público: no expone quién escaneó ni datos del scanner.
    """
    from server import db as database

    carrera = await races.resolver_carrera(database, race_code)
    active_race_code = carrera.get("code")
    km_vuelta = races.km_por_vuelta(carrera)

    bib_str = str(bib).zfill(3)

    registros = await database.lap_registrations.find(
        {
            "race_code": active_race_code,
            "bib": {"$in": [bib_str, bib_str.lstrip("0"), bib]},
            "action": "lap_completed",
            "anulada": {"$ne": True},
        },
        {"_id": 0, "lap_number": 1, "lap_start_time": 1, "scan_time": 1, "scan_time_local": 1},
    ).sort("lap_number", 1).to_list(500)

    vistos = set()
    laps = []
    for r in registros:
        numero = r.get("lap_number")
        if numero in vistos:
            continue
        vistos.add(numero)

        inicio = r.get("lap_start_time")
        fin = r.get("scan_time")
        duracion_seg = None
        if inicio and fin:
            try:
                delta = (fin - inicio).total_seconds()
                # Descarta valores imposibles (relojes desfasados o datos sucios)
                if 0 < delta <= 2 * 3600:
                    duracion_seg = int(delta)
            except TypeError:
                duracion_seg = None

        pace_seg_km = int(duracion_seg / km_vuelta) if duracion_seg else None

        laps.append({
            "lap": numero,
            "hora": r.get("scan_time_local"),
            "duracion_seg": duracion_seg,
            "pace_seg_km": pace_seg_km,
        })

    laps.sort(key=lambda x: x["lap"])
    return {"laps": laps, "km_per_lap": km_vuelta}
