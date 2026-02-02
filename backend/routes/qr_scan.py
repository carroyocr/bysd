"""
QR Code Scanning System for Race Lap Control
Allows scanning athlete QR codes to register lap completions
"""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
import os
import qrcode
from io import BytesIO
import base64
from pathlib import Path
import zipfile

router = APIRouter(prefix="/api/qr-scan", tags=["qr-scan"])

# Directory for QR codes
QR_CODES_DIR = Path(__file__).parent.parent / "static" / "qrcodes"
QR_CODES_DIR.mkdir(parents=True, exist_ok=True)

# Constants
LAP_DURATION_MINUTES = 60  # Backyard Ultra: 1 hour per lap
KM_PER_LAP = 6.7


class LapConfirmRequest(BaseModel):
    """Request to confirm a lap completion"""
    bib: str
    confirmed_lap: int
    force_dnf: bool = False  # Manual DNF


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
    can_complete: bool  # Whether the athlete can still complete this lap
    auto_dnf: bool  # Whether athlete should be auto-DNF'd
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
            "lap_end_time": race_start + timedelta(minutes=LAP_DURATION_MINUTES),
            "seconds_remaining": int((race_start - current_time).total_seconds())
        }
    
    # Calculate time elapsed since race start
    time_elapsed = current_time - race_start
    time_elapsed_minutes = time_elapsed.total_seconds() / 60
    
    # Current lap number (1-indexed)
    # Lap 1: 0-60 minutes, Lap 2: 60-120 minutes, etc.
    current_lap = int(time_elapsed_minutes // LAP_DURATION_MINUTES) + 1
    
    # Time remaining in current lap
    minutes_into_current_lap = time_elapsed_minutes % LAP_DURATION_MINUTES
    seconds_remaining = int((LAP_DURATION_MINUTES - minutes_into_current_lap) * 60)
    
    # End time of current lap
    lap_end_time = race_start + timedelta(minutes=current_lap * LAP_DURATION_MINUTES)
    
    return {
        "current_lap": current_lap,
        "race_started": True,
        "time_elapsed_minutes": time_elapsed_minutes,
        "lap_end_time": lap_end_time,
        "seconds_remaining": seconds_remaining
    }


def generate_qr_code(bib: str, race_code: str, frontend_url: str) -> str:
    """
    Generate QR code for an athlete and save it.
    Returns the URL path to the QR code image.
    """
    # QR code contains URL to scan confirmation page
    scan_url = f"{frontend_url}/scan/confirmar?bib={bib}&race={race_code}"
    
    # Generate QR code
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    qr.add_data(scan_url)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Save QR code
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
            can_complete=False,
            auto_dnf=False,
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
            can_complete=False,
            auto_dnf=False,
            message=f"La carrera aún no ha comenzado. Inicia en {lap_info['seconds_remaining'] // 60} minutos."
        )
    
    current_race_lap = lap_info["current_lap"]
    athlete_laps = athlete.get("laps_completed", 0)
    lap_to_complete = athlete_laps + 1
    
    # Check if athlete is behind and should be auto-DNF
    # If athlete hasn't completed lap N-1 when lap N is in progress, they're out
    auto_dnf = False
    can_complete = True
    message = ""
    
    if lap_to_complete < current_race_lap:
        # Athlete is more than 1 lap behind - automatic DNF
        auto_dnf = True
        can_complete = False
        message = f"Tiempo agotado. El atleta debía completar la vuelta {lap_to_complete} pero ya estamos en la vuelta {current_race_lap}."
    elif lap_to_complete == current_race_lap:
        # Athlete is on track - can complete current lap
        can_complete = True
        message = f"Vuelta {lap_to_complete} - Quedan {lap_info['seconds_remaining'] // 60}:{lap_info['seconds_remaining'] % 60:02d} para completar."
    else:
        # lap_to_complete > current_race_lap - This shouldn't happen normally
        # Could be a timing issue or manual adjustment
        can_complete = True
        message = f"Registrando vuelta {lap_to_complete}"
    
    return ScanResult(
        bib=str(athlete.get("bib")),
        nombre=athlete.get("nombre", ""),
        apellidos=athlete.get("apellidos", ""),
        status=status,
        laps_completed=athlete_laps,
        current_race_lap=current_race_lap,
        lap_to_complete=lap_to_complete,
        time_remaining_seconds=lap_info["seconds_remaining"],
        can_complete=can_complete,
        auto_dnf=auto_dnf,
        message=message
    )


@router.post("/confirm-lap")
async def confirm_lap_completion(request: LapConfirmRequest):
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
    
    # Check if should be DNF
    if request.force_dnf:
        # Manual DNF
        await database.registrations.update_one(
            {"email": email, "race_code": race_code},
            {
                "$set": {
                    "status": "retired",
                    "retired_at_lap": current_laps,
                    "retired_at": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )
        
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
    
    # Re-check timing to ensure lap can still be completed
    lap_info = calculate_current_race_lap(active_race)
    
    if lap_info["race_started"] and expected_lap < lap_info["current_lap"]:
        # Time expired - auto DNF
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
        
        return {
            "success": True,
            "action": "auto_dnf",
            "message": f"Tiempo agotado. {athlete.get('nombre')} {athlete.get('apellidos')} marcado como DNF automáticamente.",
            "bib": bib,
            "laps_completed": current_laps
        }
    
    # Complete the lap
    new_laps = current_laps + 1
    new_km = new_laps * KM_PER_LAP
    
    await database.registrations.update_one(
        {"email": email, "race_code": race_code},
        {
            "$set": {
                "laps_completed": new_laps,
                "total_km": round(new_km, 1),
                "last_lap_time": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            },
            "$push": {
                "laps_log": {
                    "lap": new_laps,
                    "completed_at": datetime.now(timezone.utc),
                    "method": "qr_scan"
                }
            }
        }
    )
    
    return {
        "success": True,
        "action": "lap_completed",
        "message": f"¡Vuelta {new_laps} completada! {athlete.get('nombre')} {athlete.get('apellidos')}",
        "bib": bib,
        "laps_completed": new_laps,
        "total_km": round(new_km, 1)
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
        "time_elapsed_minutes": lap_info.get("time_elapsed_minutes", 0)
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
    
    frontend_url = os.environ.get("FRONTEND_URL", "https://race-admin-1.preview.emergentagent.com")
    
    # Generate QR code
    qr_url = generate_qr_code(bib, race_code, frontend_url)
    qr_base64 = generate_qr_code_base64(bib, race_code, frontend_url)
    
    # Update athlete record with QR code URL
    await database.registrations.update_one(
        {"email": athlete.get("email"), "race_code": race_code},
        {"$set": {"qr_code_url": qr_url}}
    )
    
    return {
        "success": True,
        "bib": bib,
        "nombre": f"{athlete.get('nombre', '')} {athlete.get('apellidos', '')}".strip(),
        "qr_code_url": qr_url,
        "qr_code_base64": qr_base64
    }
