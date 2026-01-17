from fastapi import APIRouter, HTTPException, Depends, Header
from typing import Optional, List
import bcrypt
import jwt
from datetime import datetime, timedelta
import os
from models.race import (
    AdminLogin, RaceConfig, Participant, LapLog,
    SetCurrentLapRequest, MarkRetiredRequest, CompleteLapRequest,
    RaceStats, ParticipantWithStats
)

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
    
    # Get participants stats
    participants = await database.participants.find({}, {"_id": 0}).to_list(1000)
    
    total_laps = sum(p.get("laps_completed", 0) for p in participants)
    athletes_retired = sum(1 for p in participants if p.get("status") == "retired")
    athletes_active = len(participants) - athletes_retired
    total_km = total_laps * KM_PER_LAP
    
    return RaceStats(
        current_lap=config.get("current_lap", 1),
        total_laps_completed=total_laps,
        athletes_retired=athletes_retired,
        athletes_active=athletes_active,
        total_km=round(total_km, 1)
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
    
    # Update participant status
    await database.participants.update_one(
        {"bib": request.bib},
        {
            "$set": {
                "status": "retired",
                "retired_at_lap": request.retired_at_lap,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    return {"message": f"Participante {request.bib} marcado como retirado"}

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
    
    return {"message": f"Participante {bib} reactivado"}

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
