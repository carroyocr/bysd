from fastapi import APIRouter, HTTPException, Depends, Header
from typing import Optional, List
import bcrypt
import jwt
from datetime import datetime, timedelta
import os
from bson import ObjectId
from models.race import (
    AdminLogin, RaceConfig, Participant, LapLog,
    SetCurrentLapRequest, MarkRetiredRequest, CompleteLapRequest,
    RaceStats, ParticipantWithStats, EmailSubscription, SubscribeRequest
)
from services.email_service import send_notification_email, send_lap_notifications, send_finish_notifications

router = APIRouter(prefix="/api/race", tags=["race"])

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "backyard-ultra-secret-2026")
ALGORITHM = "HS256"
KM_PER_LAP = 6.7

# Helper function to verify JWT token
def verify_token(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No autorizado")
    
    token = authorization.replace("Bearer ", "")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")

@router.post("/auth/admin-login")
async def admin_login(credentials: AdminLogin, db=Depends(lambda: None)):
    from server import db as database
    
    # Find admin user
    admin = await database.admin_users.find_one({"username": credentials.username}, {"_id": 0})
    
    if not admin:
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")
    
    # Verify password
    if not bcrypt.checkpw(credentials.password.encode('utf-8'), admin["password"].encode('utf-8')):
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")
    
    # Create JWT token
    token_data = {
        "username": credentials.username,
        "exp": datetime.utcnow() + timedelta(hours=12)
    }
    token = jwt.encode(token_data, SECRET_KEY, algorithm=ALGORITHM)
    
    return {"token": token, "username": credentials.username}

@router.get("/stats")
async def get_race_stats(db=Depends(lambda: None)):
    from server import db as database
    
    # Get race config
    config = await database.race_config.find_one({}, {"_id": 0})
    if not config:
        config = {"current_lap": 1}
    
    current_lap = config.get("current_lap", 1)
    
    # Get participants stats
    participants = await database.participants.find({}, {"_id": 0}).to_list(1000)
    
    # Total laps completed is current_lap - 1 (not the sum of all athletes)
    total_laps_completed = max(0, current_lap - 1)
    
    athletes_dnf = sum(1 for p in participants if p.get("status") == "retired")
    athletes_dns = sum(1 for p in participants if p.get("status") == "dns")
    athletes_active = len(participants) - athletes_dnf - athletes_dns
    
    # Total km is based on completed laps (not current lap)
    total_km = total_laps_completed * KM_PER_LAP
    
    # Total km of all athletes (sum of individual km)
    total_km_all_athletes = sum(p.get("total_km", 0) for p in participants)
    
    # Check for winner: Only 1 active athlete who has completed at least one lap alone
    # Winner condition: Last athlete standing who completed the lap that all DNF athletes couldn't finish
    winner = None
    active_participants = [p for p in participants if p.get("status") == "active"]
    retired_participants = [p for p in participants if p.get("status") == "retired"]
    
    if len(active_participants) == 1 and len(retired_participants) > 0:
        winner_participant = active_participants[0]
        winner_laps = winner_participant.get("laps_completed", 0)
        
        # Find the maximum laps completed by any retired athlete
        max_retired_laps = max((p.get("laps_completed", 0) for p in retired_participants), default=0)
        
        # Winner must have completed MORE laps than all retired athletes
        # This means they finished one lap alone after the second-to-last person retired
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
    db=Depends(lambda: None)
):
    from server import db as database
    
    query = {}
    if status and status in ["active", "retired"]:
        query["status"] = status
    
    participants = await database.participants.find(query, {"_id": 0}).to_list(1000)
    
    # Filter by search term
    if search:
        search_lower = search.lower()
        participants = [
            p for p in participants
            if search_lower in p["bib"].lower() or
               search_lower in p["nombre"].lower() or
               search_lower in p["apellidos"].lower()
        ]
    
    # Sort by laps completed (descending), then by BIB
    participants.sort(key=lambda x: (-x.get("laps_completed", 0), x["bib"]))
    
    return participants

@router.post("/set-current-lap")
async def set_current_lap(
    request: SetCurrentLapRequest,
    user=Depends(verify_token),
    db=Depends(lambda: None)
):
    from server import db as database
    
    if request.current_lap < 1:
        raise HTTPException(status_code=400, detail="La vuelta debe ser mayor a 0")
    
    # Update or create race config
    await database.race_config.update_one(
        {},
        {
            "$set": {
                "current_lap": request.current_lap,
                "updated_at": datetime.utcnow()
            }
        },
        upsert=True
    )
    
    return {"message": "Vuelta actual actualizada", "current_lap": request.current_lap}

@router.post("/mark-retired")
async def mark_retired(
    request: MarkRetiredRequest,
    user=Depends(verify_token),
    db=Depends(lambda: None)
):
    from server import db as database
    
    participant = await database.participants.find_one({"bib": request.bib}, {"_id": 0})
    
    if not participant:
        raise HTTPException(status_code=404, detail="Participante no encontrado")
    
    if participant.get("status") == "retired":
        raise HTTPException(status_code=400, detail="El participante ya está marcado como retirado")
    
    if participant.get("status") == "dns":
        raise HTTPException(status_code=400, detail="El participante está marcado como DNS")
    
    # The athlete completed this lap before retiring
    # So we need to increment their laps and km
    new_laps = participant.get("laps_completed", 0) + 1
    new_km = round(new_laps * KM_PER_LAP, 1)
    
    # Update participant status and stats
    await database.participants.update_one(
        {"bib": request.bib},
        {
            "$set": {
                "status": "retired",
                "retired_at_lap": request.retired_at_lap,
                "laps_completed": new_laps,
                "total_km": new_km,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    return {
        "message": f"Participante {request.bib} completó vuelta {request.retired_at_lap} ({new_km} km) y DNF",
        "laps_completed": new_laps,
        "total_km": new_km
    }

@router.post("/mark-dns")
async def mark_dns(
    request: dict,
    user=Depends(verify_token),
    db=Depends(lambda: None)
):
    from server import db as database
    
    bib = request.get("bib")
    participant = await database.participants.find_one({"bib": bib}, {"_id": 0})
    
    if not participant:
        raise HTTPException(status_code=404, detail="Participante no encontrado")
    
    if participant.get("status") == "dns":
        raise HTTPException(status_code=400, detail="El participante ya está marcado como DNS")
    
    if participant.get("status") == "retired":
        raise HTTPException(status_code=400, detail="El participante ya está retirado")
    
    if participant.get("laps_completed", 0) > 0:
        raise HTTPException(
            status_code=400, 
            detail="No se puede marcar como DNS a un participante que ya completó vueltas. Use 'Marcar Retirado' en su lugar."
        )
    
    # Update participant status - keep laps and km at 0
    await database.participants.update_one(
        {"bib": bib},
        {
            "$set": {
                "status": "dns",
                "laps_completed": 0,
                "total_km": 0.0,
                "retired_at_lap": None,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    return {"message": f"Participante {bib} marcado como DNS (No se presentó)"}

@router.post("/reactivate")
async def reactivate_participant(
    request: dict,
    user=Depends(verify_token),
    db=Depends(lambda: None)
):
    from server import db as database
    
    bib = request.get("bib")
    participant = await database.participants.find_one({"bib": bib}, {"_id": 0})
    
    if not participant:
        raise HTTPException(status_code=404, detail="Participante no encontrado")
    
    if participant.get("status") == "active":
        raise HTTPException(status_code=400, detail="El participante ya está activo")
    
    # WARNING: Reactivating a participant during an active race
    # This should only be used for correcting mistakes
    
    # Reactivate participant
    await database.participants.update_one(
        {"bib": bib},
        {
            "$set": {
                "status": "active",
                "retired_at_lap": None,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    return {"message": f"Participante {bib} reactivado. ATENCIÓN: Puede que necesite ajustar sus vueltas manualmente."}

@router.post("/complete-lap")
async def complete_lap(
    request: CompleteLapRequest,
    user=Depends(verify_token),
    db=Depends(lambda: None)
):
    from server import db as database
    
    participant = await database.participants.find_one({"bib": request.bib}, {"_id": 0})
    
    if not participant:
        raise HTTPException(status_code=404, detail="Participante no encontrado")
    
    if participant.get("status") == "retired":
        raise HTTPException(status_code=400, detail="No se puede registrar vuelta de un participante retirado")
    
    new_laps = participant.get("laps_completed", 0) + 1
    new_km = round(new_laps * KM_PER_LAP, 1)
    
    # Update participant
    await database.participants.update_one(
        {"bib": request.bib},
        {
            "$set": {
                "laps_completed": new_laps,
                "total_km": new_km,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    # Log the lap
    lap_log = LapLog(
        participant_bib=request.bib,
        lap_number=request.lap_number,
        recorded_by=user.get("username", "admin")
    )
    await database.laps_log.insert_one(lap_log.dict())
    
    return {
        "message": f"Vuelta {request.lap_number} registrada para {request.bib}",
        "laps_completed": new_laps,
        "total_km": new_km
    }

@router.post("/complete-lap-all-active")
async def complete_lap_all_active(
    user=Depends(verify_token),
    db=Depends(lambda: None)
):
    from server import db as database
    
    # Get current lap
    config = await database.race_config.find_one({}, {"_id": 0})
    if not config:
        raise HTTPException(status_code=400, detail="Configuración de carrera no encontrada")
    
    current_lap = config.get("current_lap", 1)
    
    # Get all active participants
    active_participants = await database.participants.find(
        {"status": "active"},
        {"_id": 0}
    ).to_list(1000)
    
    if not active_participants:
        return {
            "message": "No hay participantes activos",
            "updated_count": 0,
            "new_lap": current_lap + 1
        }
    
    updated_count = 0
    
    # Update all active participants
    for participant in active_participants:
        new_laps = participant.get("laps_completed", 0) + 1
        new_km = round(new_laps * KM_PER_LAP, 1)
        
        # Update participant
        await database.participants.update_one(
            {"bib": participant["bib"]},
            {
                "$set": {
                    "laps_completed": new_laps,
                    "total_km": new_km,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        # Log the lap
        lap_log = LapLog(
            participant_bib=participant["bib"],
            lap_number=current_lap,
            recorded_by=user.get("username", "admin")
        )
        await database.laps_log.insert_one(lap_log.dict())
        
        updated_count += 1
    
    # Increment current lap
    new_lap = current_lap + 1
    await database.race_config.update_one(
        {},
        {
            "$set": {
                "current_lap": new_lap,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    return {
        "message": f"Vuelta {current_lap} completada para {updated_count} atletas activos",
        "updated_count": updated_count,
        "new_lap": new_lap,
        "previous_lap": current_lap
    }

@router.post("/revert-lap")
async def revert_lap(
    user=Depends(verify_token),
    db=Depends(lambda: None)
):
    """
    Revierte la vuelta actual a la anterior.
    Esto es útil cuando se avanzó la vuelta por error.
    ADVERTENCIA: 
    - Reduce las vueltas de todos los atletas activos en 1
    - Reactiva los atletas DNF que tienen retired_at_lap >= new_lap (vueltas que "no ocurrieron")
    """
    from server import db as database
    
    # Get current lap
    config = await database.race_config.find_one({}, {"_id": 0})
    if not config:
        raise HTTPException(status_code=400, detail="Configuración de carrera no encontrada")
    
    current_lap = config.get("current_lap", 1)
    
    if current_lap <= 1:
        raise HTTPException(status_code=400, detail="No se puede retroceder más. Ya está en la vuelta 1.")
    
    new_lap = current_lap - 1
    
    updated_count = 0
    reactivated_count = 0
    
    # 1. Reduce laps for all active participants who have at least 1 lap completed
    active_participants = await database.participants.find(
        {"status": "active", "laps_completed": {"$gt": 0}},
        {"_id": 0}
    ).to_list(1000)
    
    for participant in active_participants:
        new_laps = max(0, participant.get("laps_completed", 1) - 1)
        new_km = round(new_laps * KM_PER_LAP, 1)
        
        await database.participants.update_one(
            {"bib": participant["bib"]},
            {
                "$set": {
                    "laps_completed": new_laps,
                    "total_km": new_km,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        updated_count += 1
    
    # 2. Reactivate DNF athletes with retired_at_lap >= new_lap
    # When we go back to lap 2, anyone who retired at lap 2 or later should be reactivated
    # Because those retirements "didn't happen yet" in the reverted state
    dnf_to_reactivate = await database.participants.find(
        {"status": "retired", "retired_at_lap": {"$gte": new_lap}},
        {"_id": 0}
    ).to_list(1000)
    
    for participant in dnf_to_reactivate:
        # DNF incremented laps when marked, so reduce it back
        new_laps = max(0, participant.get("laps_completed", 1) - 1)
        new_km = round(new_laps * KM_PER_LAP, 1)
        
        await database.participants.update_one(
            {"bib": participant["bib"]},
            {
                "$set": {
                    "status": "active",
                    "retired_at_lap": None,
                    "laps_completed": new_laps,
                    "total_km": new_km,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        reactivated_count += 1
    
    # 3. Decrement current lap
    await database.race_config.update_one(
        {},
        {
            "$set": {
                "current_lap": new_lap,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    # 4. Remove lap logs for the reverted lap
    await database.laps_log.delete_many({"lap_number": current_lap - 1})
    
    message = f"Vuelta revertida. Ahora está en la vuelta {new_lap}."
    if reactivated_count > 0:
        message += f" {reactivated_count} atleta(s) DNF reactivado(s)."
    
    return {
        "message": message,
        "updated_count": updated_count,
        "reactivated_count": reactivated_count,
        "new_lap": new_lap,
        "previous_lap": current_lap
    }

@router.post("/reset-database")
async def reset_database(
    request: dict,
    user=Depends(verify_token),
    db=Depends(lambda: None)
):
    from server import db as database
    import bcrypt
    
    # Verify confirmation
    confirmation = request.get("confirmation", "")
    if confirmation != "REINICIO":
        raise HTTPException(status_code=400, detail="Confirmación incorrecta. Debe escribir REINICIO")
    
    # Drop collections
    await database.participants.drop()
    await database.race_config.drop()
    await database.laps_log.drop()
    
    # Don't drop admin_users, just reset it
    # This way the user stays logged in
    
    # Reinitialize race config
    await database.race_config.insert_one({
        "current_lap": 1,
        "race_status": "active",
        "updated_at": datetime.utcnow()
    })
    
    # Reinitialize participants
    participants_data = [
        {'bib': '001', 'nombre': 'Lucas', 'apellidos': 'Gaitán', 'nacionalidad': 'COL'},
        {'bib': '002', 'nombre': 'Hamlet', 'apellidos': 'Burgos Frías', 'nacionalidad': 'DOM'},
        {'bib': '003', 'nombre': 'Carlos', 'apellidos': 'Camejo', 'nacionalidad': 'VEN'},
        {'bib': '004', 'nombre': 'Tomas', 'apellidos': 'Ruíz Ornes', 'nacionalidad': 'DOM'},
        {'bib': '005', 'nombre': 'Francesco', 'apellidos': 'Biondi', 'nacionalidad': 'DOM'},
        {'bib': '006', 'nombre': 'Víctor Hugo', 'apellidos': 'Moreno Contreras', 'nacionalidad': 'MEX'},
        {'bib': '007', 'nombre': 'Herbert Martin Klaus', 'apellidos': 'Scharf Rodríguez', 'nacionalidad': 'DOM'},
        {'bib': '008', 'nombre': 'Judelka Altagracia', 'apellidos': 'Vargas Almonte', 'nacionalidad': 'DOM'},
        {'bib': '009', 'nombre': 'José Ángel', 'apellidos': 'Rondón', 'nacionalidad': 'VEN'},
        {'bib': '010', 'nombre': 'Cristian', 'apellidos': 'Minaya Domínguez', 'nacionalidad': 'DOM'},
        {'bib': '011', 'nombre': 'Luis Emilio', 'apellidos': 'Cabral Rivera', 'nacionalidad': 'DOM'},
        {'bib': '012', 'nombre': 'Enemencio', 'apellidos': 'Pérez', 'nacionalidad': 'DOM'},
        {'bib': '013', 'nombre': 'Walter Damián', 'apellidos': 'Parra', 'nacionalidad': 'DOM'},
        {'bib': '014', 'nombre': 'Jorge', 'apellidos': 'Toribio', 'nacionalidad': 'DOM'},
        {'bib': '015', 'nombre': 'Olimpia', 'apellidos': 'Arellano Campos', 'nacionalidad': 'MEX'},
        {'bib': '016', 'nombre': 'Aivaliklis', 'apellidos': 'Jeanluc', 'nacionalidad': 'FRA'},
        {'bib': '017', 'nombre': 'Ma Eugenia', 'apellidos': 'Aguilar Mendizabal', 'nacionalidad': 'MEX'},
        {'bib': '018', 'nombre': 'Carlos Alberto', 'apellidos': 'Ovalle', 'nacionalidad': 'DOM'},
        {'bib': '019', 'nombre': 'Gustavo', 'apellidos': 'Percivaldi', 'nacionalidad': 'ARG'},
        {'bib': '020', 'nombre': 'Iván', 'apellidos': 'Ortega', 'nacionalidad': 'MEX'},
        {'bib': '021', 'nombre': 'Miguel', 'apellidos': 'Vásquez', 'nacionalidad': 'DOM'},
        {'bib': '022', 'nombre': 'Luis Antonio', 'apellidos': 'De León Encarnación', 'nacionalidad': 'DOM'},
        {'bib': '023', 'nombre': 'Moisés', 'apellidos': 'Encarnación Tapia', 'nacionalidad': 'DOM'},
        {'bib': '024', 'nombre': 'Alexandra', 'apellidos': 'Jeronimo', 'nacionalidad': 'USA'},
        {'bib': '025', 'nombre': 'Arturo', 'apellidos': 'Valdez', 'nacionalidad': 'DOM'},
        {'bib': '026', 'nombre': 'Fausto', 'apellidos': 'Batista Meléndez', 'nacionalidad': 'DOM'},
        {'bib': '027', 'nombre': 'Kathy', 'apellidos': 'Español', 'nacionalidad': 'DOM'},
        {'bib': '028', 'nombre': 'Yoselin', 'apellidos': 'Peña', 'nacionalidad': 'DOM'},
        {'bib': '029', 'nombre': 'Yesenia', 'apellidos': 'Grullon', 'nacionalidad': 'DOM'},
        {'bib': '030', 'nombre': 'Braulio', 'apellidos': 'Jiménez De La Rosa', 'nacionalidad': 'DOM'},
        {'bib': '031', 'nombre': 'Yeirys', 'apellidos': 'Soto', 'nacionalidad': 'DOM'},
        {'bib': '032', 'nombre': 'Tommy', 'apellidos': 'García Sánchez', 'nacionalidad': 'DOM'},
        {'bib': '033', 'nombre': 'Heldra', 'apellidos': 'Garib Valori', 'nacionalidad': 'DOM'},
        {'bib': '034', 'nombre': 'José Gabriel', 'apellidos': 'Rodríguez López', 'nacionalidad': 'DOM'},
        {'bib': '035', 'nombre': 'Sissy', 'apellidos': 'Jorge De Mencía', 'nacionalidad': 'DOM'},
        {'bib': '036', 'nombre': 'Julio Eduardo', 'apellidos': 'Molina Canahuate', 'nacionalidad': 'DOM'},
        {'bib': '037', 'nombre': 'George Omar', 'apellidos': 'Tejada Pimentel', 'nacionalidad': 'DOM'},
        {'bib': '038', 'nombre': 'Ismael', 'apellidos': 'Morillo Guzmán', 'nacionalidad': 'DOM'},
        {'bib': '039', 'nombre': 'Ámbar Esmeralda', 'apellidos': 'De Los Santos', 'nacionalidad': 'DOM'},
        {'bib': '040', 'nombre': 'Margaret', 'apellidos': 'Medrano', 'nacionalidad': 'DOM'},
        {'bib': '041', 'nombre': 'Ana Amalia', 'apellidos': 'Blömer Mueses', 'nacionalidad': 'DOM'},
        {'bib': '042', 'nombre': 'Pascal', 'apellidos': 'Sterlin', 'nacionalidad': 'HAI'},
        {'bib': '043', 'nombre': 'Luis', 'apellidos': 'Pérez Ernst', 'nacionalidad': 'PER'},
        {'bib': '044', 'nombre': 'Alberto', 'apellidos': 'Ruiz', 'nacionalidad': 'DOM'},
        {'bib': '045', 'nombre': 'DAIYI', 'apellidos': 'Shiguetome Rodríguez', 'nacionalidad': 'JAP'},
        {'bib': '046', 'nombre': 'Ernesto', 'apellidos': 'Ovalles Javier', 'nacionalidad': 'DOM'},
        {'bib': '047', 'nombre': 'David', 'apellidos': 'Orellana', 'nacionalidad': 'VEN'},
        {'bib': '048', 'nombre': 'Simón Bolívar', 'apellidos': 'Cepeda Lora', 'nacionalidad': 'DOM'},
        {'bib': '049', 'nombre': 'Miltón', 'apellidos': 'Núñez Imbert', 'nacionalidad': 'DOM'},
        {'bib': '050', 'nombre': 'Pedro', 'apellidos': 'Rodríguez Pérez', 'nacionalidad': 'DOM'},
        {'bib': '051', 'nombre': 'Rodrigo', 'apellidos': 'Farach Aldana', 'nacionalidad': 'GUA'},
        {'bib': '052', 'nombre': 'Bernardo', 'apellidos': 'De Jesús', 'nacionalidad': 'DOM'},
        {'bib': '053', 'nombre': 'Jhoel', 'apellidos': 'Camacho Tejada', 'nacionalidad': 'DOM'},
        {'bib': '054', 'nombre': 'Esteban Gabriel', 'apellidos': 'Senna', 'nacionalidad': 'BRA'},
        {'bib': '055', 'nombre': 'Victor', 'apellidos': 'Kery', 'nacionalidad': 'DOM'},
        {'bib': '056', 'nombre': 'Robert', 'apellidos': 'Duran Suarez', 'nacionalidad': 'DOM'},
        {'bib': '057', 'nombre': 'Erick', 'apellidos': 'Paulino', 'nacionalidad': 'DOM'},
        {'bib': '058', 'nombre': 'Cesar', 'apellidos': 'Encarnación Rodríguez', 'nacionalidad': 'DOM'},
        {'bib': '059', 'nombre': 'Rafael', 'apellidos': 'Altuna Martínez', 'nacionalidad': 'DOM'},
        {'bib': '060', 'nombre': 'Alexandra', 'apellidos': 'Mateo', 'nacionalidad': 'DOM'},
        {'bib': '061', 'nombre': 'Even', 'apellidos': 'Lafay', 'nacionalidad': 'FRA'},
        {'bib': '062', 'nombre': 'Cristian', 'apellidos': 'Ballenilla', 'nacionalidad': 'DOM'},
        {'bib': '063', 'nombre': 'Jorge Lewis', 'apellidos': 'Camilo Tejada', 'nacionalidad': 'DOM'},
        {'bib': '064', 'nombre': 'Carlos', 'apellidos': 'Burgos', 'nacionalidad': 'DOM'},
        {'bib': '065', 'nombre': 'Samuel', 'apellidos': 'Rosario Franco', 'nacionalidad': 'DOM'},
        {'bib': '066', 'nombre': 'Juan', 'apellidos': 'Pérez', 'nacionalidad': 'DOM'},
        {'bib': '067', 'nombre': 'Ramon Alfredo', 'apellidos': 'Jose Rojas', 'nacionalidad': 'DOM'},
        {'bib': '068', 'nombre': 'Juan Omar', 'apellidos': 'Jiménez Ortiz', 'nacionalidad': 'DOM'},
        {'bib': '069', 'nombre': 'Joan', 'apellidos': 'Gomez Velazquez', 'nacionalidad': 'DOM'},
        {'bib': '070', 'nombre': 'Oscar', 'apellidos': 'Moquete', 'nacionalidad': 'DOM'},
        {'bib': '071', 'nombre': 'Carlos Bienvenido', 'apellidos': 'Ogando Montás', 'nacionalidad': 'DOM'},
        {'bib': '072', 'nombre': 'Daphne Liliana', 'apellidos': 'Heyaime Fernández', 'nacionalidad': 'DOM'},
        {'bib': '073', 'nombre': 'José Antonio', 'apellidos': 'Santos Leonardo', 'nacionalidad': 'DOM'},
        {'bib': '074', 'nombre': 'Michelle', 'apellidos': 'Domínguez Ramírez', 'nacionalidad': 'DOM'},
        {'bib': '075', 'nombre': 'Ana (Karina)', 'apellidos': 'Ortiz Guerrero', 'nacionalidad': 'DOM'},
        {'bib': '076', 'nombre': 'Isabel', 'apellidos': 'Delgado', 'nacionalidad': 'DOM'},
        {'bib': '077', 'nombre': 'Pedro Pablo', 'apellidos': 'Taveras', 'nacionalidad': 'DOM'},
        {'bib': '078', 'nombre': 'Rommell', 'apellidos': 'Morel Tejada', 'nacionalidad': 'DOM'},
        {'bib': '079', 'nombre': 'Alexis', 'apellidos': 'Vásquez', 'nacionalidad': 'DOM'},
        {'bib': '080', 'nombre': 'Jacob', 'apellidos': 'Levinson', 'nacionalidad': 'USA'},
        {'bib': '081', 'nombre': 'Kensey', 'apellidos': 'Pichardo Guillen', 'nacionalidad': 'DOM'},
        {'bib': '082', 'nombre': 'Carlos Ariel', 'apellidos': 'De Jesús Chaljub', 'nacionalidad': 'DOM'},
        {'bib': '083', 'nombre': 'Rudolf', 'apellidos': 'Scheidig', 'nacionalidad': 'DOM'},
        {'bib': '084', 'nombre': 'Armando José', 'apellidos': 'Bisonó Estrella', 'nacionalidad': 'USA'},
        {'bib': '085', 'nombre': 'Julio Alberto', 'apellidos': 'Minaya Fernández', 'nacionalidad': 'ESP'},
        {'bib': '086', 'nombre': 'Gabriel', 'apellidos': 'Tapia', 'nacionalidad': 'DOM'},
        {'bib': '087', 'nombre': 'Melany', 'apellidos': 'Vanegas', 'nacionalidad': 'DOM'},
        {'bib': '088', 'nombre': 'Lennys del Rosario', 'apellidos': 'Jimenez Gonzalez', 'nacionalidad': 'VEN'},
        {'bib': '089', 'nombre': 'Thais', 'apellidos': 'Herrera', 'nacionalidad': 'DOM'},
        {'bib': '090', 'nombre': 'Livio', 'apellidos': 'Feliz', 'nacionalidad': 'DOM'},
    ]
    
    # Add default fields to each participant
    for p in participants_data:
        p['status'] = 'active'
        p['laps_completed'] = 0
        p['total_km'] = 0.0
        p['retired_at_lap'] = None
        p['created_at'] = datetime.utcnow()
        p['updated_at'] = datetime.utcnow()
    
    await database.participants.insert_many(participants_data)
    
    # Recreate indexes
    await database.participants.create_index([("bib", 1)], unique=True)
    await database.laps_log.create_index([("participant_bib", 1)])
    await database.laps_log.create_index([("completed_at", -1)])
    
    return {
        "message": "Base de datos reiniciada exitosamente",
        "participants_reset": len(participants_data),
        "current_lap": 1,
        "laps_log_cleared": True
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
    
    # Check if subscription already exists for this email
    existing = await database.email_subscriptions.find_one({"email": request.email})
    
    if existing:
        # Update existing subscription
        await database.email_subscriptions.update_one(
            {"email": request.email},
            {
                "$set": {
                    "athletes_bibs": request.athletes_bibs,
                    "notify_every_lap": request.notify_every_lap,
                    "notify_on_finish": request.notify_on_finish,
                    "active": True,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        subscription_id = str(existing.get("_id"))
        message = "Suscripción actualizada exitosamente"
    else:
        # Create new subscription
        subscription = EmailSubscription(
            email=request.email,
            athletes_bibs=request.athletes_bibs,
            notify_every_lap=request.notify_every_lap,
            notify_on_finish=request.notify_on_finish
        )
        result = await database.email_subscriptions.insert_one(subscription.dict())
        subscription_id = str(result.inserted_id)
        message = "Suscripción creada exitosamente"
    
    # Get athlete names for confirmation
    athletes = await database.participants.find(
        {"bib": {"$in": request.athletes_bibs}},
        {"_id": 0, "nombre": 1, "apellidos": 1, "bib": 1}
    ).to_list(100)
    
    # Send confirmation email
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
