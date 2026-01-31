from fastapi import APIRouter, HTTPException, Depends, Header, Query
from fastapi.responses import FileResponse
from typing import Optional, List
import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
import os
from pathlib import Path
from bson import ObjectId
from models.race import (
    AdminLogin, RaceConfig, Participant, LapLog,
    SetCurrentLapRequest, MarkRetiredRequest, CompleteLapRequest,
    RaceStats, ParticipantWithStats, EmailSubscription, SubscribeRequest,
    CheerMessage, CheerMessageRequest, AdjustLapsRequest, EditParticipantRequest
)
from services.email_service import send_notification_email, send_lap_notifications, send_finish_notifications

router = APIRouter(prefix="/api/race", tags=["race"])

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "backyard-ultra-secret-2026")
ALGORITHM = "HS256"
KM_PER_LAP = 6.7
CERTIFICATES_DIR = Path(__file__).parent.parent / "static" / "certificates" / "individual"


# Helper function to get active race code
async def get_active_race_code(database) -> str:
    """Get the code of the currently active race"""
    active_race = await database.race_configurations.find_one({"is_active": True})
    if active_race:
        return active_race.get("code")
    return None


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
async def get_race_stats(
    race_code: Optional[str] = Query(None, description="Race code to filter by"),
    db=Depends(lambda: None)
):
    from server import db as database
    
    # Get race code - use parameter or get active race
    active_race_code = race_code
    if not active_race_code:
        active_race_code = await get_active_race_code(database)
    
    # Get race config for this race (current lap tracking)
    race_config_key = f"race_config_{active_race_code}" if active_race_code else "race_config"
    config = await database.race_config.find_one({"race_code": active_race_code} if active_race_code else {}, {"_id": 0})
    if not config:
        config = {"current_lap": 1}
    
    current_lap = config.get("current_lap", 1)
    
    # Try to get participants from registrations collection first (for new races)
    participants = []
    if active_race_code:
        # Get from registrations - only those with status "active" in the race (not pre_registered)
        registrations = await database.registrations.find(
            {"race_code": active_race_code, "status": {"$in": ["active", "retired", "dns", "winner", "honor"]}},
            {"_id": 0, "edit_token": 0}
        ).to_list(1000)
        
        # Map registrations to participant format
        for reg in registrations:
            participants.append({
                "bib": str(reg.get("bib")) if reg.get("bib") else None,
                "nombre": reg.get("nombre"),
                "apellidos": reg.get("apellidos"),
                "nacionalidad": reg.get("nacionalidad", "DOM"),
                "status": reg.get("status", "active"),
                "laps_completed": reg.get("laps_completed", 0),
                "total_km": reg.get("total_km", 0.0),
                "retired_at_lap": reg.get("retired_at_lap")
            })
    
    # Fallback to old participants collection if no registrations
    if not participants:
        participants = await database.participants.find({}, {"_id": 0}).to_list(1000)
    
    # Filter out participants without BIB for stats calculation
    participants_with_bib = [p for p in participants if p.get("bib")]
    
    # Total laps completed is current_lap - 1 (not the sum of all athletes)
    total_laps_completed = max(0, current_lap - 1)
    
    athletes_dnf = sum(1 for p in participants_with_bib if p.get("status") == "retired")
    athletes_dns = sum(1 for p in participants_with_bib if p.get("status") == "dns")
    athletes_winner = sum(1 for p in participants_with_bib if p.get("status") == "winner")
    athletes_honor = sum(1 for p in participants_with_bib if p.get("status") == "honor")
    athletes_active = len(participants_with_bib) - athletes_dnf - athletes_dns - athletes_winner - athletes_honor
    
    # Total km is based on completed laps (not current lap)
    total_km = total_laps_completed * KM_PER_LAP
    
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
    db=Depends(lambda: None)
):
    from server import db as database
    
    # Get race code - use parameter or get active race
    active_race_code = race_code
    if not active_race_code:
        active_race_code = await get_active_race_code(database)
    
    participants = []
    
    # Try registrations collection first
    if active_race_code:
        # Build query for registrations - only race participants (not pre_registered)
        query = {
            "race_code": active_race_code,
            "status": {"$in": ["active", "retired", "dns", "winner", "honor"]},
            "bib": {"$ne": None}  # Must have BIB assigned
        }
        
        if status and status in ["active", "retired", "dns", "winner", "honor"]:
            query["status"] = status
        
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
                "personalizacion_camiseta": reg.get("personalizacion_camiseta"),
                "talla_camiseta": reg.get("talla_camiseta")
            })
    
    # Fallback to old participants collection if no registrations found
    if not participants:
        query = {}
        if status and status in ["active", "retired"]:
            query["status"] = status
        
        participants = await database.participants.find(query, {"_id": 0}).to_list(1000)
    
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
    participants.sort(key=lambda x: (-x.get("laps_completed", 0), x.get("bib", "999")))
    
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
    
    # Get active race code
    active_race_code = await get_active_race_code(database)
    
    # Update or create race config (with race_code for multi-race support)
    await database.race_config.update_one(
        {"race_code": active_race_code} if active_race_code else {},
        {
            "$set": {
                "current_lap": request.current_lap,
                "race_code": active_race_code,
                "updated_at": datetime.now(timezone.utc)
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
    
    # Get active race code
    active_race_code = await get_active_race_code(database)
    
    # Try registrations first
    participant = None
    use_registrations = False
    
    if active_race_code:
        participant = await database.registrations.find_one(
            {"race_code": active_race_code, "bib": int(request.bib.lstrip('0')) if request.bib.lstrip('0').isdigit() else None},
            {"_id": 0, "edit_token": 0}
        )
        if participant:
            use_registrations = True
    
    # Fallback to participants collection
    if not participant:
        participant = await database.participants.find_one({"bib": request.bib}, {"_id": 0})
    
    if not participant:
        raise HTTPException(status_code=404, detail="Participante no encontrado")
    
    if participant.get("status") == "retired":
        raise HTTPException(status_code=400, detail="El participante ya está marcado como retirado")
    
    if participant.get("status") == "dns":
        raise HTTPException(status_code=400, detail="El participante está marcado como DNS")
    
    # DNF: The athlete did NOT complete this lap, so we keep their current laps/km
    current_laps = participant.get("laps_completed", 0)
    current_km = participant.get("total_km", 0.0)
    
    # Update participant status only (no lap increment)
    if use_registrations:
        await database.registrations.update_one(
            {"race_code": active_race_code, "email": participant.get("email")},
            {
                "$set": {
                    "status": "retired",
                    "retired_at_lap": request.retired_at_lap,
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )
    else:
        await database.participants.update_one(
            {"bib": request.bib},
            {
                "$set": {
                    "status": "retired",
                    "retired_at_lap": request.retired_at_lap,
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )
    
    # Send DNF notifications in background
    import asyncio
    asyncio.create_task(send_finish_notifications(database, request.bib, is_winner=False))
    
    return {
        "message": f"Participante {request.bib} marcado como DNF en vuelta {request.retired_at_lap}. Vueltas: {current_laps} ({current_km} km)",
        "laps_completed": current_laps,
        "total_km": current_km
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
    
    # Update participant status - reset laps and km to 0
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
    
    # Also delete any lap logs for this participant
    await database.laps_log.delete_many({"participant_bib": bib})
    
    return {"message": f"Participante {bib} marcado como DNS (No se presentó). Vueltas reseteadas a 0."}


@router.post("/adjust-laps")
async def adjust_participant_laps(
    request: AdjustLapsRequest,
    user=Depends(verify_token),
    db=Depends(lambda: None)
):
    """Manually adjust the number of laps for a participant"""
    from server import db as database
    
    participant = await database.participants.find_one({"bib": request.bib}, {"_id": 0})
    
    if not participant:
        raise HTTPException(status_code=404, detail="Participante no encontrado")
    
    if participant.get("status") == "dns":
        raise HTTPException(status_code=400, detail="No se pueden ajustar vueltas de un participante DNS")
    
    if request.new_laps < 0:
        raise HTTPException(status_code=400, detail="Las vueltas no pueden ser negativas")
    
    old_laps = participant.get("laps_completed", 0)
    new_km = round(request.new_laps * KM_PER_LAP, 1)
    
    # Update participant laps
    await database.participants.update_one(
        {"bib": request.bib},
        {
            "$set": {
                "laps_completed": request.new_laps,
                "total_km": new_km,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    return {
        "message": f"Vueltas de {request.bib} ajustadas de {old_laps} a {request.new_laps}",
        "bib": request.bib,
        "old_laps": old_laps,
        "new_laps": request.new_laps,
        "total_km": new_km
    }


@router.post("/edit-participant")
async def edit_participant(
    request: EditParticipantRequest,
    user=Depends(verify_token),
    db=Depends(lambda: None)
):
    """Edit participant data (name, last name, nationality)"""
    from server import db as database
    
    participant = await database.participants.find_one({"bib": request.bib}, {"_id": 0})
    
    if not participant:
        raise HTTPException(status_code=404, detail="Participante no encontrado")
    
    # Update participant data
    await database.participants.update_one(
        {"bib": request.bib},
        {
            "$set": {
                "nombre": request.nombre,
                "apellidos": request.apellidos,
                "nacionalidad": request.nacionalidad.upper(),
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    return {
        "message": f"Datos del participante {request.bib} actualizados",
        "bib": request.bib,
        "nombre": request.nombre,
        "apellidos": request.apellidos,
        "nacionalidad": request.nacionalidad.upper()
    }


@router.post("/mark-winner")
async def mark_winner(
    request: dict,
    user=Depends(verify_token),
    db=Depends(lambda: None)
):
    """Mark a participant as the race winner"""
    from server import db as database
    
    bib = request.get("bib")
    participant = await database.participants.find_one({"bib": bib}, {"_id": 0})
    
    if not participant:
        raise HTTPException(status_code=404, detail="Participante no encontrado")
    
    if participant.get("status") == "winner":
        raise HTTPException(status_code=400, detail="Este participante ya es el ganador")
    
    # Check if there's already a winner
    existing_winner = await database.participants.find_one({"status": "winner"}, {"_id": 0})
    if existing_winner:
        raise HTTPException(
            status_code=400, 
            detail=f"Ya existe un ganador: {existing_winner.get('nombre')} {existing_winner.get('apellidos')} (BIB: {existing_winner.get('bib')})"
        )
    
    # Mark as winner
    await database.participants.update_one(
        {"bib": bib},
        {
            "$set": {
                "status": "winner",
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    return {
        "message": f"¡{participant.get('nombre')} {participant.get('apellidos')} ha sido marcado como GANADOR!",
        "bib": bib,
        "nombre": participant.get("nombre"),
        "apellidos": participant.get("apellidos")
    }


@router.post("/mark-honor")
async def mark_honor(
    request: dict,
    user=Depends(verify_token),
    db=Depends(lambda: None)
):
    """Mark a participant as Guest of Honor (Invitada de Honor)"""
    from server import db as database
    
    bib = request.get("bib")
    participant = await database.participants.find_one({"bib": bib}, {"_id": 0})
    
    if not participant:
        raise HTTPException(status_code=404, detail="Participante no encontrado")
    
    if participant.get("status") == "honor":
        raise HTTPException(status_code=400, detail="Este participante ya es Invitada de Honor")
    
    # Mark as honor
    await database.participants.update_one(
        {"bib": bib},
        {
            "$set": {
                "status": "honor",
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    return {
        "message": f"¡{participant.get('nombre')} {participant.get('apellidos')} ha sido marcado como Invitada de Honor!",
        "bib": bib,
        "nombre": participant.get("nombre"),
        "apellidos": participant.get("apellidos")
    }


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
    
    # Get active race code
    active_race_code = await get_active_race_code(database)
    
    # Get current lap (filtered by race)
    config = await database.race_config.find_one(
        {"race_code": active_race_code} if active_race_code else {},
        {"_id": 0}
    )
    if not config:
        config = {"current_lap": 1}
    
    current_lap = config.get("current_lap", 1)
    
    # Get all active participants - try registrations first
    active_participants = []
    use_registrations = False
    
    if active_race_code:
        registrations = await database.registrations.find(
            {
                "race_code": active_race_code,
                "status": "active",
                "bib": {"$ne": None}
            },
            {"_id": 0, "edit_token": 0}
        ).to_list(1000)
        
        if registrations:
            use_registrations = True
            for reg in registrations:
                active_participants.append({
                    "bib": str(reg.get("bib")).zfill(3),
                    "email": reg.get("email"),
                    "laps_completed": reg.get("laps_completed", 0)
                })
    
    # Fallback to participants collection
    if not active_participants:
        participants_docs = await database.participants.find(
            {"status": "active"},
            {"_id": 0}
        ).to_list(1000)
        active_participants = participants_docs
    
    if not active_participants:
        return {
            "message": "No hay participantes activos",
            "updated_count": 0,
            "skipped_count": 0,
            "new_lap": current_lap + 1
        }
    
    updated_count = 0
    skipped_count = 0
    
    # Update all active participants
    for participant in active_participants:
        current_laps = participant.get("laps_completed", 0)
        
        # Skip if participant already has the current lap completed
        if current_laps >= current_lap:
            skipped_count += 1
            continue
        
        new_laps = current_laps + 1
        new_km = round(new_laps * KM_PER_LAP, 1)
        
        # Update participant
        if use_registrations:
            await database.registrations.update_one(
                {"race_code": active_race_code, "email": participant.get("email")},
                {
                    "$set": {
                        "laps_completed": new_laps,
                        "total_km": new_km,
                        "updated_at": datetime.now(timezone.utc)
                    }
                }
            )
        else:
            await database.participants.update_one(
                {"bib": participant["bib"]},
                {
                    "$set": {
                        "laps_completed": new_laps,
                        "total_km": new_km,
                        "updated_at": datetime.now(timezone.utc)
                    }
                }
            )
        
        # Log the lap
        lap_log = LapLog(
            participant_bib=participant.get("bib", ""),
            lap_number=current_lap,
            recorded_by=user.get("username", "admin")
        )
        await database.laps_log.insert_one(lap_log.dict())
        
        updated_count += 1
    
    # Increment current lap
    new_lap = current_lap + 1
    await database.race_config.update_one(
        {"race_code": active_race_code} if active_race_code else {},
        {
            "$set": {
                "current_lap": new_lap,
                "race_code": active_race_code,
                "updated_at": datetime.now(timezone.utc)
            }
        },
        upsert=True
    )
    
    # Send lap notifications in background (don't wait for completion)
    import asyncio
    asyncio.create_task(send_lap_notifications(database, current_lap))
    
    message = f"Vuelta {current_lap} completada para {updated_count} atletas"
    if skipped_count > 0:
        message += f" ({skipped_count} ya tenían la vuelta registrada)"
    
    return {
        "message": message,
        "updated_count": updated_count,
        "skipped_count": skipped_count,
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
        # DNF does NOT increment laps, so we keep current laps when reactivating
        current_laps = participant.get("laps_completed", 0)
        current_km = participant.get("total_km", 0.0)
        
        await database.participants.update_one(
            {"bib": participant["bib"]},
            {
                "$set": {
                    "status": "active",
                    "retired_at_lap": None,
                    "laps_completed": current_laps,
                    "total_km": current_km,
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
    """Reset race data for the active race only (participants tracking, not pre-registration data)"""
    from server import db as database
    
    # Verify confirmation
    confirmation = request.get("confirmation", "")
    if confirmation != "REINICIO":
        raise HTTPException(status_code=400, detail="Confirmación incorrecta. Debe escribir REINICIO")
    
    # Get active race code
    active_race_code = await get_active_race_code(database)
    
    if not active_race_code:
        raise HTTPException(status_code=400, detail="No hay carrera activa configurada")
    
    # Reset race tracking data for active race only (in registrations collection)
    # This resets laps_completed, total_km, retired_at_lap for participants with status 'active', 'retired', etc.
    result = await database.registrations.update_many(
        {
            "race_code": active_race_code,
            "status": {"$in": ["active", "retired", "winner", "honor"]}
        },
        {
            "$set": {
                "laps_completed": 0,
                "total_km": 0.0,
                "retired_at_lap": None,
                "status": "active",  # Reset to active
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    # Reset race config for this race
    await database.race_config.update_one(
        {"race_code": active_race_code},
        {
            "$set": {
                "current_lap": 1,
                "race_status": "active",
                "updated_at": datetime.now(timezone.utc)
            }
        },
        upsert=True
    )
    
    # Delete lap logs for this race only
    await database.laps_log.delete_many({"race_code": active_race_code})
    
    return {
        "message": f"Datos de carrera {active_race_code} reiniciados exitosamente",
        "race_code": active_race_code,
        "participants_reset": result.modified_count
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
    
    is_new_subscription = existing is None
    
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
    
    # Get full athlete data for confirmation (including laps and km)
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
    user=Depends(verify_token),
    db=Depends(lambda: None)
):
    """Reset cheer messages for the active race only (admin only)"""
    from server import db as database
    
    # Verify confirmation
    confirmation = request.get("confirmation", "")
    if confirmation != "MENSAJES":
        raise HTTPException(status_code=400, detail="Confirmación incorrecta. Debe escribir MENSAJES")
    
    # Get active race code
    active_race_code = await get_active_race_code(database)
    
    if not active_race_code:
        raise HTTPException(status_code=400, detail="No hay carrera activa configurada")
    
    # Count before deletion for active race
    cheers_count = await database.cheer_messages.count_documents({"race_code": active_race_code})
    
    # Delete only messages for this race
    result = await database.cheer_messages.delete_many({"race_code": active_race_code})
    
    return {
        "message": f"Se han eliminado {result.deleted_count} mensajes de ánimo de la carrera {active_race_code}",
        "deleted_count": result.deleted_count,
        "race_code": active_race_code
    }


@router.get("/subscribers-count-public")
async def get_subscribers_count_public(
    db=Depends(lambda: None)
):
    """Get the count of subscribers for each athlete (public endpoint for ranking)"""
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
    user=Depends(verify_token),
    db=Depends(lambda: None)
):
    """Reset email subscriptions for the active race only (admin only)"""
    from server import db as database
    
    # Verify confirmation
    confirmation = request.get("confirmation", "")
    if confirmation != "SUSCRIPCIONES":
        raise HTTPException(status_code=400, detail="Confirmación incorrecta. Debe escribir SUSCRIPCIONES")
    
    # Get active race code
    active_race_code = await get_active_race_code(database)
    
    if not active_race_code:
        raise HTTPException(status_code=400, detail="No hay carrera activa configurada")
    
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
    db=Depends(lambda: None)
):
    """Submit a cheer message for an athlete"""
    from server import db as database
    from services.twitter_service import post_cheer_to_twitter
    
    # Get active race code
    active_race_code = await get_active_race_code(database)
    
    # Validate athlete exists - check registrations first, then participants
    athlete = None
    if active_race_code:
        athlete = await database.registrations.find_one(
            {"race_code": active_race_code, "bib": int(request.athlete_bib.lstrip('0')) if request.athlete_bib.lstrip('0').isdigit() else None, "status": {"$in": ["active", "retired", "winner"]}},
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
    
    # Create cheer message with race_code
    cheer_data = {
        "athlete_bib": request.athlete_bib,
        "fan_name": request.fan_name,
        "message": request.message,
        "race_code": active_race_code,
        "created_at": datetime.now(timezone.utc)
    }
    
    await database.cheer_messages.insert_one(cheer_data)
    
    # Try to post to Twitter (non-blocking, don't fail if Twitter fails)
    athlete_name = f"{athlete['nombre']} {athlete['apellidos']}"
    nacionalidad = athlete.get('nacionalidad', '')
    
    twitter_result = await post_cheer_to_twitter(
        fan_name=request.fan_name,
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


@router.get("/cheers")
async def get_cheer_messages(
    limit: int = 50,
    page: int = 1,
    athlete_bib: Optional[str] = None,
    db=Depends(lambda: None)
):
    """Get cheer messages with pagination (most recent first)"""
    from server import db as database
    
    query = {}
    if athlete_bib:
        query["athlete_bib"] = athlete_bib
    
    # Calculate skip for pagination
    skip = (page - 1) * limit
    
    # Get total count for pagination info
    total_count = await database.cheer_messages.count_documents(query)
    total_pages = (total_count + limit - 1) // limit  # Ceiling division
    
    # Get messages sorted by created_at descending with pagination
    messages = await database.cheer_messages.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Enrich with athlete names
    for msg in messages:
        athlete = await database.participants.find_one(
            {"bib": msg["athlete_bib"]},
            {"_id": 0, "nombre": 1, "apellidos": 1, "nacionalidad": 1}
        )
        if athlete:
            msg["athlete_name"] = f"{athlete['nombre']} {athlete['apellidos']}"
            msg["athlete_nacionalidad"] = athlete.get("nacionalidad", "")
    
    return {
        "messages": messages,
        "pagination": {
            "page": page,
            "limit": limit,
            "total_count": total_count,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1
        }
    }


@router.get("/cheers/count")
async def get_cheer_count(
    db=Depends(lambda: None)
):
    """Get total count of cheer messages"""
    from server import db as database
    
    count = await database.cheer_messages.count_documents({})
    return {"count": count}


@router.get("/cheers/leaderboard")
async def get_cheer_leaderboard(
    limit: int = 10,
    db=Depends(lambda: None)
):
    """Get leaderboard of athletes with most cheer messages"""
    from server import db as database
    
    # Aggregate cheer messages by athlete
    pipeline = [
        {"$group": {
            "_id": "$athlete_bib",
            "cheer_count": {"$sum": 1}
        }},
        {"$sort": {"cheer_count": -1}},
        {"$limit": limit}
    ]
    
    results = await database.cheer_messages.aggregate(pipeline).to_list(limit)
    
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
    db=Depends(lambda: None)
):
    """Get leaderboard of fans with most cheer messages sent"""
    from server import db as database
    
    pipeline = [
        {"$group": {
            "_id": "$fan_name",
            "cheer_count": {"$sum": 1},
            "athletes_cheered": {"$addToSet": "$athlete_bib"}
        }},
        {"$sort": {"cheer_count": -1}},
        {"$limit": limit}
    ]
    
    results = await database.cheer_messages.aggregate(pipeline).to_list(limit)
    
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
    db=Depends(lambda: None)
):
    """Get badge info for a specific fan"""
    from server import db as database
    
    # Count messages by this fan
    count = await database.cheer_messages.count_documents({"fan_name": fan_name})
    
    # Get unique athletes cheered
    pipeline = [
        {"$match": {"fan_name": fan_name}},
        {"$group": {"_id": "$athlete_bib"}}
    ]
    athletes = await database.cheer_messages.aggregate(pipeline).to_list(100)
    
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
    user=Depends(verify_token),
    db=Depends(lambda: None)
):
    """Send completion emails to all runners of the active race when there is a winner (excludes DNS)"""
    from server import db as database
    from services.runner_email_service import send_runner_completion_email
    
    # Get active race code
    active_race_code = await get_active_race_code(database)
    
    if not active_race_code:
        raise HTTPException(status_code=400, detail="No hay carrera activa configurada")
    
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


@router.get("/certificate/{bib}")
async def get_certificate(bib: str, db=Depends(lambda: None)):
    """Get certificate PDF for a participant. Opens in browser for viewing."""
    from server import db as database
    
    # Check participant exists and has valid status
    participant = await database.participants.find_one({"bib": bib}, {"_id": 0})
    
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
    filename = f"Certificado_{nombre}_{apellidos}_{bib}.pdf".replace(" ", "_")
    
    # Return with inline disposition so it opens in browser
    return FileResponse(
        path=certificate_path,
        media_type="application/pdf",
        filename=filename,
        headers={
            "Content-Disposition": f"inline; filename={filename}"
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
    
    # Convert PDF to high-resolution image
    doc = fitz.open(str(certificate_path))
    page = doc[0]
    
    # High resolution: 300 DPI (default is 72, so multiply by ~4.17)
    zoom = 4.0  # 4x zoom for high resolution (~288 DPI)
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    
    # Convert to PNG bytes
    img_bytes = pix.tobytes("png")
    doc.close()
    
    # Get participant name for filename
    nombre = participant.get("nombre", "")
    apellidos = participant.get("apellidos", "")
    filename = f"Certificado_{nombre}_{apellidos}_{bib}.png".replace(" ", "_")
    
    return Response(
        content=img_bytes,
        media_type="image/png",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )


@router.get("/certificate-check/{bib}")
async def check_certificate(bib: str, db=Depends(lambda: None)):
    """Check if a participant can download their certificate"""
    from server import db as database
    
    participant = await database.participants.find_one({"bib": bib}, {"_id": 0})
    
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
