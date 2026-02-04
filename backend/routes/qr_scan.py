"""
QR Code Scanning System for Race Lap Control
Allows scanning athlete QR codes to register lap completions
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import os
import qrcode
from io import BytesIO
import base64
from pathlib import Path
import zipfile
import csv
import io

router = APIRouter(prefix="/api/qr-scan", tags=["qr-scan"])

# Directory for QR codes
QR_CODES_DIR = Path(__file__).parent.parent / "static" / "qrcodes"
QR_CODES_DIR.mkdir(parents=True, exist_ok=True)

# Constants
LAP_DURATION_MINUTES = 60  # Backyard Ultra: 1 hour per lap
KM_PER_LAP = 6.7
MIN_LAP_TIME_MINUTES = 35  # Minimum time to complete a valid lap


class LapConfirmRequest(BaseModel):
    """Request to confirm a lap completion"""
    bib: str
    confirmed_lap: int
    force_dnf: bool = False  # Manual DNF
    dnf_confirmation: Optional[str] = None  # Must be "DNF" to confirm
    scanned_by: Optional[str] = None  # User who performed the scan


class ScanResult(BaseModel):
    """Result of scanning a QR code"""
    bib: str
    nombre: str
    apellidos: str
    status: str
    laps_completed: int
    current_race_lap: int
    lap_to_complete: int  # The lap this scan would complete
    time_remaining_seconds: int  # Seconds remaining to complete this lap
    minutes_into_lap: int = 0  # Minutes elapsed since lap started
    can_complete: bool  # Whether the athlete can still complete this lap
    auto_dnf: bool  # Whether athlete should be auto-DNF'd
    already_registered: bool = False  # Whether lap was already registered
    early_return: bool = False  # Whether athlete returned too early (< 35 min)
    message: str


def parse_timezone_offset(tz_string: str) -> int:
    """Parse timezone string like 'GMT-4' to offset hours"""
    if not tz_string:
        return -4  # Default to Dominican Republic
    
    tz_string = tz_string.upper().replace("GMT", "").replace("UTC", "")
    try:
        return int(tz_string)
    except ValueError:
        return -4


def get_race_time(race_config: dict) -> datetime:
    """Get current time adjusted for race timezone"""
    tz_offset = parse_timezone_offset(race_config.get("timezone_gmt", "GMT-4"))
    tz = timezone(timedelta(hours=tz_offset))
    return datetime.now(tz)


def get_race_start_datetime(race_config: dict) -> datetime:
    """Get race start datetime from config"""
    tz_offset = parse_timezone_offset(race_config.get("timezone_gmt", "GMT-4"))
    tz = timezone(timedelta(hours=tz_offset))
    
    date_str = race_config.get("date", "")
    time_str = race_config.get("start_time", "09:00")
    
    if not date_str:
        # If no date, return a far future date
        return datetime(2099, 1, 1, 9, 0, 0, tzinfo=tz)
    
    try:
        # Parse date and time
        dt = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
        return dt.replace(tzinfo=tz)
    except ValueError:
        return datetime(2099, 1, 1, 9, 0, 0, tzinfo=tz)


def calculate_current_race_lap(race_config: dict) -> dict:
    """
    Calculate current race lap based on time elapsed since race start.
    Returns dict with lap info and timing details.
    """
    race_start = get_race_start_datetime(race_config)
    current_time = get_race_time(race_config)
    
    # If race hasn't started yet
    if current_time < race_start:
        return {
            "current_lap": 0,
            "race_started": False,
            "time_elapsed_minutes": 0,
            "minutes_into_lap": 0,
            "lap_start_time": race_start,
            "lap_end_time": race_start + timedelta(minutes=LAP_DURATION_MINUTES),
            "seconds_remaining": int((race_start - current_time).total_seconds())
        }
    
    # Calculate time elapsed since race start
    time_elapsed = current_time - race_start
    time_elapsed_minutes = time_elapsed.total_seconds() / 60
    
    # Current lap number (1-indexed)
    # Lap 1: 0-60 minutes, Lap 2: 60-120 minutes, etc.
    current_lap = int(time_elapsed_minutes // LAP_DURATION_MINUTES) + 1
    
    # Time into current lap
    minutes_into_current_lap = time_elapsed_minutes % LAP_DURATION_MINUTES
    seconds_remaining = int((LAP_DURATION_MINUTES - minutes_into_current_lap) * 60)
    
    # Start and end time of current lap
    lap_start_time = race_start + timedelta(minutes=(current_lap - 1) * LAP_DURATION_MINUTES)
    lap_end_time = race_start + timedelta(minutes=current_lap * LAP_DURATION_MINUTES)
    
    return {
        "current_lap": current_lap,
        "race_started": True,
        "time_elapsed_minutes": time_elapsed_minutes,
        "minutes_into_lap": int(minutes_into_current_lap),
        "lap_start_time": lap_start_time,
        "lap_end_time": lap_end_time,
        "seconds_remaining": seconds_remaining
    }


def generate_qr_code(bib: str, race_code: str, frontend_url: str) -> str:
    """
    Generate QR code for an athlete and save it.
    Returns the URL path to the QR code image.
    """
    scan_url = f"{frontend_url}/scan/confirmar?bib={bib}&race={race_code}"
    
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    qr.add_data(scan_url)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Save to file
    filename = f"qr_{race_code}_{bib}.png"
    filepath = QR_CODES_DIR / filename
    img.save(filepath)
    
    return f"/api/qr-scan/image/{filename}"


def generate_qr_code_base64(bib: str, race_code: str, frontend_url: str) -> str:
    """
    Generate QR code and return as base64 string for embedding.
    """
    scan_url = f"{frontend_url}/scan/confirmar?bib={bib}&race={race_code}"
    
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    qr.add_data(scan_url)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Convert to base64
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    img_str = base64.b64encode(buffer.getvalue()).decode()
    
    return f"data:image/png;base64,{img_str}"


@router.get("/image/{filename}")
async def get_qr_image(filename: str):
    """Serve QR code image"""
    filepath = QR_CODES_DIR / filename
    
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="QR code no encontrado")
    
    return FileResponse(filepath, media_type="image/png")


@router.get("/athlete/{bib}")
async def get_athlete_for_scan(bib: str, race_code: Optional[str] = None):
    """
    Get athlete information for QR scan confirmation.
    Calculates current lap and whether athlete can complete.
    """
    from server import db as database
    
    # Get active race if not specified
    if not race_code:
        active_race = await database.race_configurations.find_one({"is_active": True})
        if not active_race:
            raise HTTPException(status_code=400, detail="No hay carrera activa")
        race_code = active_race.get("code")
    else:
        active_race = await database.race_configurations.find_one({"code": race_code})
    
    if not active_race:
        raise HTTPException(status_code=404, detail="Carrera no encontrada")
    
    # Find athlete by BIB
    # Try to match BIB as integer or string
    try:
        bib_int = int(bib)
        athlete = await database.registrations.find_one({
            "race_code": race_code,
            "$or": [
                {"bib": bib_int},
                {"bib": str(bib_int)},
                {"bib": str(bib_int).zfill(3)}
            ]
        })
    except ValueError:
        athlete = await database.registrations.find_one({
            "race_code": race_code,
            "bib": bib
        })
    
    if not athlete:
        raise HTTPException(status_code=404, detail=f"Atleta con BIB {bib} no encontrado")
    
    # Check athlete status
    status = athlete.get("status", "active")
    if status in ["retired", "dns", "winner"]:
        status_messages = {
            "retired": "Este atleta ya fue marcado como DNF",
            "dns": "Este atleta no inició la carrera (DNS)",
            "winner": "Este atleta ya fue declarado ganador"
        }
        return ScanResult(
            bib=str(athlete.get("bib")),
            nombre=athlete.get("nombre", ""),
            apellidos=athlete.get("apellidos", ""),
            status=status,
            laps_completed=athlete.get("laps_completed", 0),
            current_race_lap=0,
            lap_to_complete=0,
            time_remaining_seconds=0,
            minutes_into_lap=0,
            can_complete=False,
            auto_dnf=False,
            already_registered=False,
            early_return=False,
            message=status_messages.get(status, "Atleta inactivo")
        )
    
    # Calculate current race lap based on time
    lap_info = calculate_current_race_lap(active_race)
    
    if not lap_info["race_started"]:
        return ScanResult(
            bib=str(athlete.get("bib")),
            nombre=athlete.get("nombre", ""),
            apellidos=athlete.get("apellidos", ""),
            status=status,
            laps_completed=athlete.get("laps_completed", 0),
            current_race_lap=0,
            lap_to_complete=1,
            time_remaining_seconds=lap_info["seconds_remaining"],
            minutes_into_lap=0,
            can_complete=False,
            auto_dnf=False,
            already_registered=False,
            early_return=False,
            message=f"La carrera aún no ha comenzado. Inicia en {lap_info['seconds_remaining'] // 60} minutos."
        )
    
    current_race_lap = lap_info["current_lap"]
    athlete_laps = athlete.get("laps_completed", 0)
    lap_to_complete = athlete_laps + 1
    minutes_into_lap = lap_info["minutes_into_lap"]
    
    # Check if lap was already registered for this lap
    already_registered = False
    existing_scan = await database.lap_registrations.find_one({
        "bib": str(athlete.get("bib")),
        "race_code": race_code,
        "lap_number": lap_to_complete
    })
    if existing_scan:
        already_registered = True
    
    # Check if athlete returned too early (less than 35 minutes into the lap)
    early_return = minutes_into_lap < MIN_LAP_TIME_MINUTES and lap_to_complete == current_race_lap
    
    # Determine if can complete
    can_complete = True
    auto_dnf = False
    message = ""
    
    if already_registered:
        can_complete = False
        message = f"¡Vuelta {lap_to_complete} ya fue registrada! No se puede registrar dos veces."
    elif early_return:
        can_complete = False
        auto_dnf = True
        message = f"⚠️ Regresó muy temprano ({minutes_into_lap} minutos). Mínimo requerido: {MIN_LAP_TIME_MINUTES} minutos. Se marcará como DNF."
    elif lap_to_complete < current_race_lap:
        # Athlete is behind - time expired
        can_complete = False
        auto_dnf = True
        message = f"⚠️ Tiempo agotado. El atleta debió completar la vuelta {lap_to_complete} antes. Se marcará como DNF automáticamente."
    else:
        message = f"Vuelta {lap_to_complete} - Quedan {lap_info['seconds_remaining'] // 60}:{lap_info['seconds_remaining'] % 60:02d} para completar."
    
    return ScanResult(
        bib=str(athlete.get("bib")),
        nombre=athlete.get("nombre", ""),
        apellidos=athlete.get("apellidos", ""),
        status=status,
        laps_completed=athlete_laps,
        current_race_lap=current_race_lap,
        lap_to_complete=lap_to_complete,
        time_remaining_seconds=lap_info["seconds_remaining"],
        minutes_into_lap=minutes_into_lap,
        can_complete=can_complete,
        auto_dnf=auto_dnf,
        already_registered=already_registered,
        early_return=early_return,
        message=message
    )


@router.post("/confirm")
async def confirm_lap(request: LapConfirmRequest):
    """
    Confirm a lap completion or mark as DNF.
    """
    from server import db as database
    
    bib = request.bib
    
    # Get active race
    active_race = await database.race_configurations.find_one({"is_active": True})
    if not active_race:
        raise HTTPException(status_code=400, detail="No hay carrera activa")
    
    race_code = active_race.get("code")
    
    # Find athlete
    try:
        bib_int = int(bib)
        athlete = await database.registrations.find_one({
            "race_code": race_code,
            "$or": [
                {"bib": bib_int},
                {"bib": str(bib_int)},
                {"bib": str(bib_int).zfill(3)}
            ]
        })
    except ValueError:
        athlete = await database.registrations.find_one({
            "race_code": race_code,
            "bib": bib
        })
    
    if not athlete:
        raise HTTPException(status_code=404, detail=f"Atleta con BIB {bib} no encontrado")
    
    email = athlete.get("email")
    current_laps = athlete.get("laps_completed", 0)
    lap_info = calculate_current_race_lap(active_race)
    
    # Check if should be DNF (manual request)
    if request.force_dnf:
        # Require DNF confirmation text
        if request.dnf_confirmation != "DNF":
            raise HTTPException(
                status_code=400, 
                detail="Debe escribir 'DNF' para confirmar el retiro del atleta"
            )
        
        # Manual DNF
        await database.registrations.update_one(
            {"email": email, "race_code": race_code},
            {
                "$set": {
                    "status": "retired",
                    "retired_at_lap": current_laps,
                    "retired_at": datetime.now(timezone.utc),
                    "retired_reason": "DNF manual por QR scan",
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )
        
        # Register DNF in lap_registrations
        await database.lap_registrations.insert_one({
            "bib": str(athlete.get("bib")),
            "race_code": race_code,
            "athlete_name": f"{athlete.get('nombre', '')} {athlete.get('apellidos', '')}".strip(),
            "lap_number": current_laps,
            "action": "dnf",
            "lap_start_time": lap_info.get("lap_start_time"),
            "scan_time": datetime.now(timezone.utc),
            "scanned_by": request.scanned_by or "unknown",
            "reason": "DNF manual confirmado",
            "created_at": datetime.now(timezone.utc)
        })
        
        return {
            "success": True,
            "action": "dnf",
            "message": f"Atleta {athlete.get('nombre')} {athlete.get('apellidos')} marcado como DNF en vuelta {current_laps}",
            "bib": bib,
            "laps_completed": current_laps
        }
    
    # Verify lap number matches expected
    expected_lap = current_laps + 1
    if request.confirmed_lap != expected_lap:
        raise HTTPException(
            status_code=400, 
            detail=f"Error de sincronización. Vuelta esperada: {expected_lap}, vuelta recibida: {request.confirmed_lap}"
        )
    
    # Check if this lap was already registered (duplicate scan)
    existing_scan = await database.lap_registrations.find_one({
        "bib": str(athlete.get("bib")),
        "race_code": race_code,
        "lap_number": expected_lap,
        "action": "lap_completed"
    })
    
    if existing_scan:
        return {
            "success": False,
            "action": "already_registered",
            "message": f"La vuelta {expected_lap} ya fue registrada a las {existing_scan.get('scan_time', '').strftime('%H:%M:%S') if existing_scan.get('scan_time') else 'N/A'}",
            "bib": bib,
            "laps_completed": current_laps,
            "registered_at": existing_scan.get("scan_time")
        }
    
    # Check timing constraints
    minutes_into_lap = lap_info.get("minutes_into_lap", 0)
    
    # Rule 2: If scanned within 35 minutes, athlete returned too early - DNF
    if minutes_into_lap < MIN_LAP_TIME_MINUTES and expected_lap == lap_info["current_lap"]:
        await database.registrations.update_one(
            {"email": email, "race_code": race_code},
            {
                "$set": {
                    "status": "retired",
                    "retired_at_lap": current_laps,
                    "retired_at": datetime.now(timezone.utc),
                    "retired_reason": f"Regresó antes de tiempo ({minutes_into_lap} min < {MIN_LAP_TIME_MINUTES} min)",
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )
        
        # Register early return DNF
        await database.lap_registrations.insert_one({
            "bib": str(athlete.get("bib")),
            "race_code": race_code,
            "athlete_name": f"{athlete.get('nombre', '')} {athlete.get('apellidos', '')}".strip(),
            "lap_number": expected_lap,
            "action": "dnf_early_return",
            "lap_start_time": lap_info.get("lap_start_time"),
            "scan_time": datetime.now(timezone.utc),
            "minutes_into_lap": minutes_into_lap,
            "scanned_by": request.scanned_by or "unknown",
            "reason": f"Regresó a los {minutes_into_lap} minutos (mínimo {MIN_LAP_TIME_MINUTES})",
            "created_at": datetime.now(timezone.utc)
        })
        
        return {
            "success": True,
            "action": "dnf_early_return",
            "message": f"⚠️ {athlete.get('nombre')} regresó muy temprano ({minutes_into_lap} min). Marcado como DNF. No se completó vuelta {expected_lap}.",
            "bib": bib,
            "laps_completed": current_laps,
            "minutes_into_lap": minutes_into_lap
        }
    
    # Rule 3: If lap time expired, auto-DNF
    if lap_info["race_started"] and expected_lap < lap_info["current_lap"]:
        await database.registrations.update_one(
            {"email": email, "race_code": race_code},
            {
                "$set": {
                    "status": "retired",
                    "retired_at_lap": current_laps,
                    "retired_at": datetime.now(timezone.utc),
                    "retired_reason": "Tiempo agotado (auto-DNF por QR scan)",
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )
        
        # Register timeout DNF
        await database.lap_registrations.insert_one({
            "bib": str(athlete.get("bib")),
            "race_code": race_code,
            "athlete_name": f"{athlete.get('nombre', '')} {athlete.get('apellidos', '')}".strip(),
            "lap_number": expected_lap,
            "action": "dnf_timeout",
            "lap_start_time": lap_info.get("lap_start_time"),
            "scan_time": datetime.now(timezone.utc),
            "scanned_by": request.scanned_by or "unknown",
            "reason": f"Tiempo agotado. Vuelta {expected_lap} debió completarse antes.",
            "created_at": datetime.now(timezone.utc)
        })
        
        return {
            "success": True,
            "action": "auto_dnf",
            "message": f"Tiempo agotado. {athlete.get('nombre')} {athlete.get('apellidos')} marcado como DNF automáticamente.",
            "bib": bib,
            "laps_completed": current_laps
        }
    
    # All checks passed - Complete the lap
    new_laps = current_laps + 1
    new_km = new_laps * KM_PER_LAP
    scan_time = datetime.now(timezone.utc)
    
    await database.registrations.update_one(
        {"email": email, "race_code": race_code},
        {
            "$set": {
                "laps_completed": new_laps,
                "total_km": round(new_km, 1),
                "last_lap_time": scan_time,
                "updated_at": scan_time
            },
            "$push": {
                "laps_log": {
                    "lap": new_laps,
                    "completed_at": scan_time,
                    "method": "qr_scan",
                    "scanned_by": request.scanned_by
                }
            }
        }
    )
    
    # Register lap completion
    await database.lap_registrations.insert_one({
        "bib": str(athlete.get("bib")),
        "race_code": race_code,
        "athlete_name": f"{athlete.get('nombre', '')} {athlete.get('apellidos', '')}".strip(),
        "lap_number": new_laps,
        "action": "lap_completed",
        "lap_start_time": lap_info.get("lap_start_time"),
        "scan_time": scan_time,
        "minutes_into_lap": minutes_into_lap,
        "scanned_by": request.scanned_by or "unknown",
        "created_at": scan_time
    })
    
    return {
        "success": True,
        "action": "lap_completed",
        "message": f"¡Vuelta {new_laps} completada! {athlete.get('nombre')} {athlete.get('apellidos')}",
        "bib": bib,
        "laps_completed": new_laps,
        "total_km": round(new_km, 1),
        "scan_time": scan_time.isoformat()
    }


@router.get("/race-status")
async def get_race_status():
    """Get current race timing status for the scanner UI"""
    from server import db as database
    
    active_race = await database.race_configurations.find_one({"is_active": True})
    if not active_race:
        return {
            "race_active": False,
            "message": "No hay carrera activa"
        }
    
    lap_info = calculate_current_race_lap(active_race)
    
    return {
        "race_active": True,
        "race_code": active_race.get("code"),
        "race_name": active_race.get("name"),
        "race_started": lap_info["race_started"],
        "current_lap": lap_info["current_lap"],
        "seconds_remaining": lap_info["seconds_remaining"],
        "minutes_into_lap": lap_info.get("minutes_into_lap", 0),
        "time_elapsed_minutes": lap_info.get("time_elapsed_minutes", 0),
        "lap_start_time": lap_info.get("lap_start_time").isoformat() if lap_info.get("lap_start_time") else None,
        "lap_end_time": lap_info.get("lap_end_time").isoformat() if lap_info.get("lap_end_time") else None
    }


# ============= LAP REGISTRATIONS ENDPOINTS =============

@router.get("/lap-registrations")
async def get_lap_registrations(
    race_code: Optional[str] = None,
    lap_number: Optional[int] = None,
    athlete_name: Optional[str] = None,
    scanned_by: Optional[str] = None
):
    """Get lap registration records with optional filters"""
    from server import db as database
    
    # Get active race if not specified
    if not race_code:
        active_race = await database.race_configurations.find_one({"is_active": True})
        if not active_race:
            return {"registrations": [], "total": 0}
        race_code = active_race.get("code")
    
    # Build query
    query = {"race_code": race_code}
    
    if lap_number:
        query["lap_number"] = lap_number
    
    if athlete_name:
        query["athlete_name"] = {"$regex": athlete_name, "$options": "i"}
    
    if scanned_by:
        query["scanned_by"] = {"$regex": scanned_by, "$options": "i"}
    
    # Get registrations
    registrations = await database.lap_registrations.find(
        query,
        {"_id": 0}
    ).sort([("lap_number", 1), ("scan_time", 1)]).to_list(5000)
    
    # Get unique laps for filter
    unique_laps = await database.lap_registrations.distinct("lap_number", {"race_code": race_code})
    unique_laps.sort()
    
    # Get unique scanners for filter
    unique_scanners = await database.lap_registrations.distinct("scanned_by", {"race_code": race_code})
    
    return {
        "registrations": registrations,
        "total": len(registrations),
        "available_laps": unique_laps,
        "available_scanners": unique_scanners
    }


@router.get("/lap-registrations/export")
async def export_lap_registrations(
    race_code: Optional[str] = None,
    lap_number: Optional[int] = None,
    athlete_name: Optional[str] = None,
    scanned_by: Optional[str] = None
):
    """Export lap registrations to CSV"""
    from server import db as database
    
    # Get active race if not specified
    if not race_code:
        active_race = await database.race_configurations.find_one({"is_active": True})
        if not active_race:
            raise HTTPException(status_code=400, detail="No hay carrera activa")
        race_code = active_race.get("code")
    
    # Build query
    query = {"race_code": race_code}
    
    if lap_number:
        query["lap_number"] = lap_number
    
    if athlete_name:
        query["athlete_name"] = {"$regex": athlete_name, "$options": "i"}
    
    if scanned_by:
        query["scanned_by"] = {"$regex": scanned_by, "$options": "i"}
    
    # Get registrations
    registrations = await database.lap_registrations.find(
        query,
        {"_id": 0}
    ).sort([("lap_number", 1), ("scan_time", 1)]).to_list(5000)
    
    # Create CSV
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow([
        "BIB", "Nombre", "Vuelta", "Acción", 
        "Hora Inicio Vuelta", "Hora Registro", 
        "Minutos en Vuelta", "Registrado Por", "Razón/Notas"
    ])
    
    # Data rows
    for reg in registrations:
        lap_start = reg.get("lap_start_time")
        scan_time = reg.get("scan_time")
        
        writer.writerow([
            reg.get("bib", ""),
            reg.get("athlete_name", ""),
            reg.get("lap_number", ""),
            reg.get("action", ""),
            lap_start.strftime("%Y-%m-%d %H:%M:%S") if lap_start else "",
            scan_time.strftime("%Y-%m-%d %H:%M:%S") if scan_time else "",
            reg.get("minutes_into_lap", ""),
            reg.get("scanned_by", ""),
            reg.get("reason", "")
        ])
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=registro_vueltas_{race_code}.csv"
        }
    )


@router.get("/lap-registrations/summary")
async def get_lap_registrations_summary(race_code: Optional[str] = None):
    """Get summary statistics for lap registrations"""
    from server import db as database
    
    # Get active race if not specified
    if not race_code:
        active_race = await database.race_configurations.find_one({"is_active": True})
        if not active_race:
            return {"total": 0, "by_lap": [], "by_action": {}}
        race_code = active_race.get("code")
    
    # Count by lap
    pipeline = [
        {"$match": {"race_code": race_code}},
        {"$group": {
            "_id": "$lap_number",
            "count": {"$sum": 1},
            "completed": {
                "$sum": {"$cond": [{"$eq": ["$action", "lap_completed"]}, 1, 0]}
            },
            "dnf": {
                "$sum": {"$cond": [{"$in": ["$action", ["dnf", "dnf_early_return", "dnf_timeout"]]}, 1, 0]}
            }
        }},
        {"$sort": {"_id": 1}}
    ]
    
    by_lap = await database.lap_registrations.aggregate(pipeline).to_list(100)
    
    # Count by action
    action_pipeline = [
        {"$match": {"race_code": race_code}},
        {"$group": {"_id": "$action", "count": {"$sum": 1}}}
    ]
    
    by_action_list = await database.lap_registrations.aggregate(action_pipeline).to_list(10)
    by_action = {item["_id"]: item["count"] for item in by_action_list}
    
    # Total
    total = await database.lap_registrations.count_documents({"race_code": race_code})
    
    return {
        "total": total,
        "by_lap": [{"lap": item["_id"], "count": item["count"], "completed": item["completed"], "dnf": item["dnf"]} for item in by_lap],
        "by_action": by_action
    }


@router.post("/generate-qr/{bib}")
async def generate_athlete_qr(bib: str, race_code: Optional[str] = None):
    """Generate QR code for an athlete"""
    from server import db as database
    
    # Get active race if not specified
    if not race_code:
        active_race = await database.race_configurations.find_one({"is_active": True})
        if not active_race:
            raise HTTPException(status_code=400, detail="No hay carrera activa")
        race_code = active_race.get("code")
    
    # Find athlete
    try:
        bib_int = int(bib)
        athlete = await database.registrations.find_one({
            "race_code": race_code,
            "$or": [
                {"bib": bib_int},
                {"bib": str(bib_int)},
                {"bib": str(bib_int).zfill(3)}
            ]
        })
    except ValueError:
        athlete = await database.registrations.find_one({
            "race_code": race_code,
            "bib": bib
        })
    
    if not athlete:
        raise HTTPException(status_code=404, detail=f"Atleta con BIB {bib} no encontrado")
    
    # Generate QR code
    frontend_url = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:3000")
    if "/api" in frontend_url:
        frontend_url = frontend_url.replace("/api", "")
    
    qr_url = generate_qr_code(bib, race_code, frontend_url)
    qr_base64 = generate_qr_code_base64(bib, race_code, frontend_url)
    
    return {
        "bib": bib,
        "nombre": athlete.get("nombre"),
        "apellidos": athlete.get("apellidos"),
        "qr_url": qr_url,
        "qr_base64": qr_base64,
        "race_code": race_code
    }


@router.get("/generate-all-qr")
async def generate_all_qr_codes(race_code: Optional[str] = None):
    """Generate QR codes for all active athletes"""
    from server import db as database
    
    # Get active race if not specified
    if not race_code:
        active_race = await database.race_configurations.find_one({"is_active": True})
        if not active_race:
            raise HTTPException(status_code=400, detail="No hay carrera activa")
        race_code = active_race.get("code")
    
    # Find all active athletes with BIB
    athletes = await database.registrations.find({
        "race_code": race_code,
        "bib": {"$exists": True, "$ne": None},
        "status": {"$in": ["active", "registered", "confirmed"]}
    }).to_list(500)
    
    frontend_url = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:3000")
    if "/api" in frontend_url:
        frontend_url = frontend_url.replace("/api", "")
    
    results = []
    for athlete in athletes:
        bib = str(athlete.get("bib"))
        qr_url = generate_qr_code(bib, race_code, frontend_url)
        results.append({
            "bib": bib,
            "nombre": athlete.get("nombre"),
            "apellidos": athlete.get("apellidos"),
            "qr_url": qr_url
        })
    
    return {
        "race_code": race_code,
        "count": len(results),
        "qr_codes": results
    }


@router.get("/download-all-qr")
async def download_all_qr_codes(race_code: Optional[str] = None):
    """Download all QR codes as a ZIP file"""
    from server import db as database
    
    # Get active race if not specified
    if not race_code:
        active_race = await database.race_configurations.find_one({"is_active": True})
        if not active_race:
            raise HTTPException(status_code=400, detail="No hay carrera activa")
        race_code = active_race.get("code")
    
    # Generate all QR codes first
    athletes = await database.registrations.find({
        "race_code": race_code,
        "bib": {"$exists": True, "$ne": None},
        "status": {"$in": ["active", "registered", "confirmed"]}
    }).to_list(500)
    
    frontend_url = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:3000")
    if "/api" in frontend_url:
        frontend_url = frontend_url.replace("/api", "")
    
    # Generate QR codes
    for athlete in athletes:
        bib = str(athlete.get("bib"))
        generate_qr_code(bib, race_code, frontend_url)
    
    # Create ZIP file
    zip_buffer = BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for qr_file in QR_CODES_DIR.glob(f"qr_{race_code}_*.png"):
            zip_file.write(qr_file, qr_file.name)
    
    zip_buffer.seek(0)
    
    return StreamingResponse(
        iter([zip_buffer.getvalue()]),
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename=qr_codes_{race_code}.zip"
        }
    )
