"""
QR Code Scanning System for Race Lap Control
Allows scanning athlete QR codes to register lap completions
"""

from fastapi import APIRouter, Header, HTTPException, Depends, Query
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import asyncio
import os
import qrcode
import secrets
from io import BytesIO
import base64
from pathlib import Path
import zipfile
import csv
import io

from services.auth import has_permission, require_permission, verify_admin_token
from services.file_storage import safe_filename
from services import laps, races

router = APIRouter(prefix="/api/qr-scan", tags=["qr-scan"])

# Los reportes de vueltas y la generacion de QR son parte del panel de control.
solo_control = Depends(require_permission("control"))

# Directory for QR codes
QR_CODES_DIR = Path(__file__).parent.parent / "static" / "qrcodes"
QR_CODES_DIR.mkdir(parents=True, exist_ok=True)


# ============= CLAVE DE ESCANEO =============
#
# Registrar vueltas y marcar DNF estaba abierto a cualquiera que conociera la
# URL. Exigir el login del panel en cada dispositivo el dia de la carrera es
# demasiada friccion, asi que cada carrera tiene su propia clave de escaneo:
# el personal la escribe una vez en el telefono y queda guardada. Un token del
# panel tambien sirve, para que el equipo de organizacion no tenga que buscarla.

SCAN_KEY_LENGTH = 5


# ============= AVISOS A LA APP =============
#
# El escaneo es lo unico que no puede ir lento el dia de la carrera: hay una
# fila de corredores esperando. Por eso los avisos push salen en una tarea
# aparte y el endpoint responde sin esperar a que FCM conteste.

_tareas_push = set()


def _avisar_push(database, race_code, athlete, titulo, cuerpo, data=None) -> None:
    """Aviso en segundo plano a los telefonos que siguen a este corredor."""
    from routes.push import avisar_a_seguidores

    tarea = asyncio.create_task(
        avisar_a_seguidores(
            database, race_code, str(athlete.get("bib")), titulo, cuerpo, data
        )
    )
    # Sin esta referencia, el recolector de basura puede llevarse la tarea
    # antes de que termine y el aviso no llegaria nunca.
    _tareas_push.add(tarea)
    tarea.add_done_callback(_tareas_push.discard)


nombre_completo = laps.nombre_completo


def generar_scan_key() -> str:
    """Clave corta, en mayusculas, facil de dictar por radio o WhatsApp."""
    alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # sin I, O, 0, 1
    return "".join(secrets.choice(alfabeto) for _ in range(SCAN_KEY_LENGTH))


async def obtener_scan_key(database, race_code: Optional[str] = None) -> tuple:
    """Devuelve (carrera, clave), creandola la primera vez que hace falta."""
    if race_code:
        carrera = await database.race_configurations.find_one({"code": race_code.upper()})
    else:
        carrera = await races.carrera_publica(database)

    if not carrera:
        raise HTTPException(status_code=400, detail="No hay carrera activa")

    clave = carrera.get("scan_key")
    if not clave:
        clave = generar_scan_key()
        await database.race_configurations.update_one(
            {"_id": carrera["_id"]}, {"$set": {"scan_key": clave}}
        )

    return carrera, clave


async def require_scan_access(
    race_code: Optional[str] = None,
    x_scan_key: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None),
):
    """Deja pasar con la clave de escaneo de la carrera o con token del panel."""
    from server import db as database

    if authorization:
        payload = verify_admin_token(authorization)
        if has_permission(payload, "scanner") or has_permission(payload, "control"):
            return payload
        raise HTTPException(status_code=403, detail="No tienes permiso para escanear")

    if not x_scan_key:
        raise HTTPException(
            status_code=401,
            detail="Falta la clave de escaneo. Pidesela a la organizacion.",
        )

    carrera, clave = await obtener_scan_key(database, race_code)
    if not secrets.compare_digest(x_scan_key.strip().upper(), clave):
        raise HTTPException(status_code=401, detail="Clave de escaneo incorrecta")

    # De que carrera es la clave que acaba de pasar. Ahora que se puede escanear
    # sobre carreras distintas, el endpoint tiene que comprobar que sea la misma
    # sobre la que va a escribir: si no, la clave del personal de una carrera
    # valdria para anotar vueltas en la otra.
    return {"scan_key": True, "race_code": carrera.get("code")}


@router.get("/scan-key", dependencies=[solo_control])
async def ver_scan_key(race_code: Optional[str] = None):
    """Panel: consultar la clave de escaneo vigente de la carrera."""
    from server import db as database

    carrera, clave = await obtener_scan_key(database, race_code)
    return {"race_code": carrera.get("code"), "scan_key": clave}


@router.post("/scan-key/regenerate", dependencies=[solo_control])
async def regenerar_scan_key(race_code: Optional[str] = None):
    """Panel: cambiar la clave (invalida los dispositivos que tenian la vieja)."""
    from server import db as database

    carrera, _ = await obtener_scan_key(database, race_code)
    clave = generar_scan_key()
    await database.race_configurations.update_one(
        {"_id": carrera["_id"]}, {"$set": {"scan_key": clave}}
    )
    return {"race_code": carrera.get("code"), "scan_key": clave}

# El reloj de la carrera vive en services/races.py: es el mismo que usa el panel,
# para que escaner y panel no puedan discrepar sobre en que vuelta va la carrera.
MIN_LAP_TIME_MINUTES = races.MINUTOS_MINIMOS_POR_VUELTA


class LapConfirmRequest(BaseModel):
    """Request to confirm a lap completion"""
    bib: str
    confirmed_lap: int
    force_dnf: bool = False  # Manual DNF
    dnf_confirmation: Optional[str] = None  # Must be "DNF" to confirm
    scanned_by: Optional[str] = None  # User who performed the scan
    # De que carrera es este QR. Viaja dentro del propio codigo escaneado; sin
    # el, confirmar una vuelta del mundial la habria anotado en la carrera de
    # enero solo porque era la que estaba publicada.
    race_code: Optional[str] = None


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


# Estos nombres se conservan porque el resto del fichero los usa en cada
# endpoint; el calculo ya no vive aqui, sino en services/races.py.
get_race_time = races.ahora_en_carrera
get_race_time_str = races.hora_local_str
calculate_current_race_lap = races.vuelta_actual


# El QR se imprime, se pega en el dorsal o en una tarjeta y alguien lo busca
# entre un montón a las tres de la mañana. Sin el nombre y el número encima, un
# QR es indistinguible del de al lado.
MARGEN = 24
ALTO_DORSAL = 78
ALTO_NOMBRE = 34


def _ruta_de_la_fuente() -> Optional[str]:
    """Una tipografia que sepa escribir en espanol.

    La que Pillow trae dentro (Aileron) no tiene ni un solo glifo acentuado:
    "Peña" sale como "Pe▯a" y "León" como "Le▯n", que en un dorsal impreso es
    inaceptable. Bitstream Vera si cubre el latino completo y viene dentro de
    reportlab, que ya es dependencia del proyecto, asi que esta tambien en el
    contenedor de Render sin instalar nada.
    """
    try:
        import reportlab

        ruta = os.path.join(os.path.dirname(reportlab.__file__), "fonts", "VeraBd.ttf")
        if os.path.exists(ruta):
            return ruta
    except ImportError:
        pass

    for ruta in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    ):
        if os.path.exists(ruta):
            return ruta

    return None


def _fuente(tamano: int):
    from PIL import ImageFont

    ruta = _ruta_de_la_fuente()
    if ruta:
        try:
            return ImageFont.truetype(ruta, tamano)
        except OSError:
            pass

    try:
        return ImageFont.load_default(size=tamano)
    except TypeError:
        # Pillow antiguo: la de por defecto no escala, pero se lee.
        return ImageFont.load_default()


def _sin_acentos(texto: str) -> str:
    """Ultimo recurso si no hay ninguna fuente capaz.

    Mejor "PENA" que "PE▯A": se pierde la tilde, no el nombre.
    """
    import unicodedata

    return "".join(
        c for c in unicodedata.normalize("NFKD", texto) if not unicodedata.combining(c)
    )


def _centrar(dibujo, texto, fuente, ancho, y):
    izquierda, arriba, derecha, abajo = dibujo.textbbox((0, 0), texto, font=fuente)
    dibujo.text(((ancho - (derecha - izquierda)) / 2 - izquierda, y - arriba), texto, font=fuente, fill="black")
    return abajo - arriba


def _recortar(dibujo, texto, fuente, ancho_maximo):
    """Nombres largos: se recortan antes de salirse de la tarjeta."""
    if dibujo.textlength(texto, font=fuente) <= ancho_maximo:
        return texto
    while texto and dibujo.textlength(texto + "…", font=fuente) > ancho_maximo:
        texto = texto[:-1]
    return (texto.rstrip() + "…") if texto else ""


def _imagen_qr(bib: str, race_code: str, frontend_url: str, nombre: Optional[str] = None):
    """El QR con el dorsal y el nombre encima."""
    from PIL import Image, ImageDraw

    scan_url = f"{frontend_url}/scan/confirmar?bib={bib}&race={race_code}"

    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    qr.add_data(scan_url)
    qr.make(fit=True)

    codigo = qr.make_image(fill_color="black", back_color="white").convert("RGB")

    nombre = (nombre or "").strip()
    if nombre and not _ruta_de_la_fuente():
        nombre = _sin_acentos(nombre)
    alto_cabecera = MARGEN + ALTO_DORSAL + (ALTO_NOMBRE if nombre else 0) + MARGEN // 2

    tarjeta = Image.new("RGB", (codigo.width, codigo.height + alto_cabecera), "white")
    dibujo = ImageDraw.Draw(tarjeta)

    y = MARGEN
    y += _centrar(dibujo, f"#{bib}", _fuente(ALTO_DORSAL), tarjeta.width, y) + 10

    if nombre:
        fuente = _fuente(ALTO_NOMBRE)
        y += _centrar(
            dibujo,
            _recortar(dibujo, nombre.upper(), fuente, tarjeta.width - 2 * MARGEN),
            fuente,
            tarjeta.width,
            y,
        )

    tarjeta.paste(codigo, (0, alto_cabecera))
    return tarjeta


def generate_qr_code(bib: str, race_code: str, frontend_url: str, nombre: Optional[str] = None) -> str:
    """
    Generate QR code for an athlete and save it.
    Returns the URL path to the QR code image.
    """
    filename = f"qr_{race_code}_{bib}.png"
    _imagen_qr(bib, race_code, frontend_url, nombre).save(QR_CODES_DIR / filename)
    return f"/api/qr-scan/image/{filename}"


def generate_qr_code_base64(bib: str, race_code: str, frontend_url: str, nombre: Optional[str] = None) -> str:
    """
    Generate QR code and return as base64 string for embedding.
    """
    buffer = BytesIO()
    _imagen_qr(bib, race_code, frontend_url, nombre).save(buffer, format="PNG")
    return f"data:image/png;base64,{base64.b64encode(buffer.getvalue()).decode()}"


@router.get("/image/{filename}", dependencies=[solo_control])
async def get_qr_image(filename: str):
    """Serve QR code image"""
    filepath = QR_CODES_DIR / safe_filename(filename)
    
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="QR code no encontrado")
    
    return FileResponse(filepath, media_type="image/png")


@router.get("/athlete/{bib}")
async def get_athlete_for_scan(
    bib: str,
    race_code: Optional[str] = None,
    _acceso=Depends(require_scan_access),
):
    """
    Get athlete information for QR scan confirmation.
    Calculates current lap and whether athlete can complete.
    """
    from server import db as database

    active_race = await races.resolver_carrera(database, race_code)
    race_code = active_race.get("code")

    athlete = await laps.exigir_atleta(database, race_code, bib)

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
    
    # Solo cuenta como repetida otra vuelta completada, y solo si sigue en pie:
    # antes bastaba con cualquier anotacion de esa vuelta, asi que un retiro
    # anotado en la vuelta N hacia creer que la vuelta N ya estaba corrida.
    already_registered = bool(
        await laps.vuelta_ya_registrada(database, race_code, athlete.get("bib"), lap_to_complete)
    )

    # Check if athlete returned too early (less than 35 minutes into the lap)
    early_return = minutes_into_lap < MIN_LAP_TIME_MINUTES and lap_to_complete == current_race_lap
    
    # Determine if can complete
    can_complete = True
    auto_dnf = False
    message = ""
    
    if already_registered:
        can_complete = False
        message = f"¡Vuelta {lap_to_complete} ya fue registrada! No se puede registrar dos veces."
    elif lap_to_complete > current_race_lap:
        # Athlete trying to register a lap that hasn't started yet
        can_complete = False
        auto_dnf = False
        message = f"⚠️ La vuelta {lap_to_complete} aún no ha iniciado. Vuelta actual: {current_race_lap}. Debe esperar."
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
async def confirm_lap(
    request: LapConfirmRequest,
    _acceso=Depends(require_scan_access),
):
    """
    Confirm a lap completion or mark as DNF.
    """
    from server import db as database

    # La carrera sale del propio QR. Antes se ignoraba y siempre se usaba la
    # carrera publicada, asi que escanear un dorsal del mundial habria sumado
    # la vuelta a la carrera de enero.
    carrera = await races.resolver_carrera(database, request.race_code)
    race_code = carrera.get("code")

    # Quien entra con la clave de escaneo solo puede anotar en su carrera.
    # Quien entra con token del panel ya paso por el permiso correspondiente.
    if _acceso.get("scan_key") and _acceso.get("race_code") != race_code:
        raise HTTPException(
            status_code=403,
            detail="Esa clave de escaneo no es de esta carrera",
        )

    bib = request.bib
    athlete = await laps.exigir_atleta(database, race_code, bib)

    current_laps = athlete.get("laps_completed", 0)
    lap_info = races.vuelta_actual(carrera)
    minutes_into_lap = lap_info.get("minutes_into_lap", 0)
    current_race_lap = lap_info.get("current_lap", 0)
    autor = request.scanned_by

    def aviso_de_retiro():
        _avisar_push(
            database,
            race_code,
            athlete,
            f"{nombre_completo(athlete)} ya no sigue en carrera",
            f"#{athlete.get('bib')} \u00b7 Termin\u00f3 con {current_laps} vueltas",
            {"tipo": "dnf", "bib": str(athlete.get("bib")), "race_code": race_code},
        )

    # ----- Retiro pedido a mano por el personal -----
    if request.force_dnf:
        if request.dnf_confirmation != "DNF":
            raise HTTPException(
                status_code=400,
                detail="Debe escribir 'DNF' para confirmar el retiro del atleta",
            )

        await laps.registrar_retiro(
            database, carrera, athlete, laps.RETIRO_MANUAL, current_laps,
            laps.ORIGEN_QR, autor, "DNF manual confirmado", lap_info,
        )
        aviso_de_retiro()

        return {
            "success": True,
            "action": "dnf",
            "message": f"Atleta {athlete.get('nombre')} {athlete.get('apellidos')} marcado como DNF en vuelta {current_laps}",
            "bib": bib,
            "laps_completed": current_laps,
        }

    # ----- Vuelta normal -----
    # Lo primero, si la vuelta que traen ya estaba anotada. Dos personas
    # escaneando al mismo corredor a la vez es lo normal en la meta, y antes la
    # segunda recibia "error de sincronizacion", que no dice nada util: parece
    # una averia cuando en realidad todo esta bien y la vuelta ya conto.
    expected_lap = current_laps + 1
    repetida = await laps.vuelta_ya_registrada(
        database, race_code, athlete.get("bib"), request.confirmed_lap
    )
    if repetida:
        hora = repetida.get("scan_time")
        return {
            "success": False,
            "action": "already_registered",
            "message": f"La vuelta {request.confirmed_lap} ya fue registrada a las {hora.strftime('%H:%M:%S') if hora else 'N/A'}",
            "bib": bib,
            "laps_completed": current_laps,
            "registered_at": hora,
        }

    if request.confirmed_lap != expected_lap:
        raise HTTPException(
            status_code=400,
            detail=f"Error de sincronizaci\u00f3n. Vuelta esperada: {expected_lap}, vuelta recibida: {request.confirmed_lap}",
        )

    # No se puede fichar una vuelta que todavia no ha empezado.
    if expected_lap > current_race_lap:
        return {
            "success": False,
            "action": "lap_not_started",
            "message": f"La vuelta {expected_lap} a\u00fan no ha iniciado. Vuelta actual: {current_race_lap}. Debe esperar a que inicie.",
            "bib": bib,
            "laps_completed": current_laps,
            "current_race_lap": current_race_lap,
        }

    # Volver antes del minuto minimo significa que abandono el anillo.
    if minutes_into_lap < MIN_LAP_TIME_MINUTES and expected_lap == current_race_lap:
        motivo = f"Regres\u00f3 antes de tiempo ({minutes_into_lap} min < {MIN_LAP_TIME_MINUTES} min)"
        await laps.registrar_retiro(
            database, carrera, athlete, laps.RETIRO_TEMPRANO, expected_lap,
            laps.ORIGEN_QR, autor, motivo, lap_info,
            {"minutes_into_lap": minutes_into_lap},
        )
        aviso_de_retiro()

        return {
            "success": True,
            "action": "dnf_early_return",
            "message": f"\u26a0\ufe0f {athlete.get('nombre')} regres\u00f3 muy temprano ({minutes_into_lap} min). Marcado como DNF. No se complet\u00f3 vuelta {expected_lap}.",
            "bib": bib,
            "laps_completed": current_laps,
            "minutes_into_lap": minutes_into_lap,
        }

    # Se le paso la hora de esa vuelta.
    if lap_info["race_started"] and expected_lap < current_race_lap:
        await laps.registrar_retiro(
            database, carrera, athlete, laps.RETIRO_POR_TIEMPO, expected_lap,
            laps.ORIGEN_QR, autor,
            f"Tiempo agotado. Vuelta {expected_lap} debi\u00f3 completarse antes.",
            lap_info,
        )
        aviso_de_retiro()

        return {
            "success": True,
            "action": "auto_dnf",
            "message": f"Tiempo agotado. {athlete.get('nombre')} {athlete.get('apellidos')} marcado como DNF autom\u00e1ticamente.",
            "bib": bib,
            "laps_completed": current_laps,
        }

    # Todo en orden: la vuelta cuenta.
    estado = await laps.registrar_vuelta(
        database, carrera, athlete, expected_lap, laps.ORIGEN_QR, autor, lap_info,
        {"minutes_into_lap": minutes_into_lap},
    )

    _avisar_push(
        database,
        race_code,
        athlete,
        f"{nombre_completo(athlete)} complet\u00f3 la vuelta {estado['laps_completed']}",
        f"#{athlete.get('bib')} \u00b7 {estado['total_km']} km acumulados",
        {
            "tipo": "vuelta",
            "bib": str(athlete.get("bib")),
            "race_code": race_code,
            "vuelta": estado["laps_completed"],
        },
    )

    return {
        "success": True,
        "action": "lap_completed",
        "message": f"\u00a1Vuelta {estado['laps_completed']} completada! {athlete.get('nombre')} {athlete.get('apellidos')}",
        "bib": bib,
        "laps_completed": estado["laps_completed"],
        "total_km": estado["total_km"],
        "scan_time": races.ahora_en_carrera(carrera).isoformat(),
    }


# ============= ESCANEO FUERA DE LINEA =============
#
# En el anillo la senal se cae, y la fila de corredores no espera. El telefono
# descarga antes la lista de corredores y el reloj de la carrera, escanea y
# guarda cada paso con su hora, y cuando vuelve la senal lo manda todo aqui.
#
# La regla que no se puede romper: cada escaneo se evalua con el reloj de la
# carrera EN LA HORA EN QUE OCURRIO (`scanned_at`), no en la hora en que llega.
# Si se evaluara al llegar, cualquier vuelta sincronizada una hora tarde
# pareceria fuera de tiempo y el corredor acabaria DNF por una averia de red.


class EscaneoFueraDeLinea(BaseModel):
    bib: str
    lap_number: int
    action: str  # "lap_completed" o "dnf" (retiro manual confirmado en el telefono)
    scanned_at: datetime
    scanned_by: Optional[str] = None


class SincronizarRequest(BaseModel):
    race_code: str
    scans: List[EscaneoFueraDeLinea]


@router.post("/sync-offline")
async def sincronizar_escaneos(
    request: SincronizarRequest,
    _acceso=Depends(require_scan_access),
):
    """Recibe los escaneos hechos sin senal y los anota en el libro mayor.

    Devuelve el resultado de cada uno: `ok` (anotado), `already_registered`
    (otro escaner ya la habia anotado: no es un error), `dnf` (el retiro quedo
    registrado) o `conflicto` (no se pudo aplicar sola; queda en el telefono
    para que la organizacion la resuelva por el panel con la vuelta manual).
    """
    from server import db as database

    carrera = await races.obtener_carrera(database, request.race_code)
    race_code = carrera.get("code")

    if _acceso.get("scan_key") and _acceso.get("race_code") != race_code:
        raise HTTPException(
            status_code=403,
            detail="Esa clave de escaneo no es de esta carrera",
        )

    resultados = []
    # En orden de ocurrencia: las vueltas de un mismo corredor deben aplicarse
    # como pasaron, o la segunda chocaria con el contador.
    for scan in sorted(request.scans, key=lambda s: s.scanned_at):
        registro = {"bib": scan.bib, "lap_number": scan.lap_number,
                    "scanned_at": scan.scanned_at.isoformat()}

        atleta = await laps.buscar_atleta(database, race_code, scan.bib)
        if not atleta:
            resultados.append({**registro, "status": "conflicto",
                               "message": f"No hay ningun corredor con el dorsal {scan.bib}"})
            continue

        autor = scan.scanned_by
        info = races.vuelta_actual(carrera, en=scan.scanned_at)

        # ----- Retiro manual confirmado en el telefono -----
        if scan.action == "dnf":
            if atleta.get("status") == "retired":
                resultados.append({**registro, "status": "already_registered",
                                   "message": "Ya estaba marcado como DNF"})
                continue
            estado = await laps.registrar_retiro(
                database, carrera, atleta, laps.RETIRO_MANUAL,
                atleta.get("laps_completed", 0), laps.ORIGEN_QR, autor,
                "DNF manual (escaneo fuera de linea)", info,
                {"offline": True}, momento=scan.scanned_at,
            )
            resultados.append({**registro, "status": "dnf",
                               "message": "Retiro registrado",
                               "laps_completed": estado["laps_completed"]})
            continue

        if scan.action != "lap_completed":
            resultados.append({**registro, "status": "conflicto",
                               "message": f"Accion desconocida: {scan.action}"})
            continue

        # ----- Vuelta completada -----
        repetida = await laps.vuelta_ya_registrada(
            database, race_code, atleta.get("bib"), scan.lap_number
        )
        if repetida:
            resultados.append({**registro, "status": "already_registered",
                               "message": f"La vuelta {scan.lap_number} ya estaba registrada",
                               "laps_completed": atleta.get("laps_completed", 0)})
            continue

        esperada = atleta.get("laps_completed", 0) + 1
        if scan.lap_number != esperada:
            resultados.append({**registro, "status": "conflicto",
                               "message": f"El servidor lleva {atleta.get('laps_completed', 0)} vueltas; "
                                          f"la esperada era la {esperada}, no la {scan.lap_number}. "
                                          "Revisar en el panel."})
            continue

        if not info["race_started"] or scan.lap_number > info["current_lap"]:
            resultados.append({**registro, "status": "conflicto",
                               "message": f"A esa hora la vuelta {scan.lap_number} no habia iniciado "
                                          f"(iba la {info['current_lap']})"})
            continue

        # Las mismas reglas del escaneo en linea, con el reloj a la hora del paso.
        if (info["minutes_into_lap"] < MIN_LAP_TIME_MINUTES
                and scan.lap_number == info["current_lap"]):
            estado = await laps.registrar_retiro(
                database, carrera, atleta, laps.RETIRO_TEMPRANO, scan.lap_number,
                laps.ORIGEN_QR, autor,
                f"Regreso antes de tiempo ({info['minutes_into_lap']} min < {MIN_LAP_TIME_MINUTES} min)",
                info, {"minutes_into_lap": info["minutes_into_lap"], "offline": True},
                momento=scan.scanned_at,
            )
            resultados.append({**registro, "status": "dnf",
                               "message": f"Regreso muy temprano ({info['minutes_into_lap']} min): DNF",
                               "laps_completed": estado["laps_completed"]})
            continue

        if scan.lap_number < info["current_lap"]:
            estado = await laps.registrar_retiro(
                database, carrera, atleta, laps.RETIRO_POR_TIEMPO, scan.lap_number,
                laps.ORIGEN_QR, autor,
                f"Tiempo agotado. La vuelta {scan.lap_number} debio completarse antes.",
                info, {"offline": True}, momento=scan.scanned_at,
            )
            resultados.append({**registro, "status": "dnf",
                               "message": "Tiempo agotado: DNF",
                               "laps_completed": estado["laps_completed"]})
            continue

        estado = await laps.registrar_vuelta(
            database, carrera, atleta, scan.lap_number, laps.ORIGEN_QR, autor,
            info, {"minutes_into_lap": info["minutes_into_lap"], "offline": True},
            momento=scan.scanned_at,
        )
        # Sin aviso push: la vuelta ocurrio hace rato y avisarla ahora
        # confundiria mas de lo que informa.
        resultados.append({**registro, "status": "ok",
                           "message": f"Vuelta {scan.lap_number} anotada",
                           "laps_completed": estado["laps_completed"],
                           "total_km": estado["total_km"]})

    return {"race_code": race_code, "results": resultados}


@router.get("/race-status")
async def get_race_status(race_code: Optional[str] = None):
    """Get current race timing status for the scanner UI"""
    from server import db as database

    if race_code:
        active_race = await database.race_configurations.find_one({"code": race_code.upper()})
    else:
        active_race = await races.carrera_publica(database)

    if not active_race:
        return {
            "race_active": False,
            "message": "No hay carrera activa"
        }

    lap_info = races.vuelta_actual(active_race)

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

@router.get("/lap-registrations", dependencies=[solo_control])
async def get_lap_registrations(
    race_code: Optional[str] = None,
    lap_number: Optional[int] = None,
    athlete_name: Optional[str] = None,
    scanned_by: Optional[str] = None,
    source: Optional[str] = None,
    incluir_anuladas: bool = True,
):
    """Get lap registration records with optional filters"""
    from server import db as database

    # Get active race if not specified
    if not race_code:
        active_race = await races.carrera_publica(database)
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

    # De donde salio la anotacion: del escaneo o puesta a mano en el panel.
    if source:
        query["source"] = source

    if not incluir_anuladas:
        query["anulada"] = {"$ne": True}

    # Get registrations
    registrations = await database.lap_registrations.find(
        query
    ).sort([("lap_number", 1), ("scan_time", 1)]).to_list(5000)

    # El panel necesita el identificador para poder anular una anotacion
    # concreta; el _id de Mongo no viaja como JSON, asi que va como texto.
    for registro in registrations:
        registro["id"] = str(registro.pop("_id"))
        # Lo anotado antes de que existiera el campo vino del escaner: era el
        # unico que escribia aqui.
        registro.setdefault("source", laps.ORIGEN_QR)
        registro.setdefault("anulada", False)

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


@router.get("/lap-registrations/export", dependencies=[solo_control])
async def export_lap_registrations(
    race_code: Optional[str] = None,
    lap_number: Optional[int] = None,
    athlete_name: Optional[str] = None,
    scanned_by: Optional[str] = None
):
    """Export lap registrations to CSV"""
    from server import db as database

    active_race = await races.resolver_carrera(database, race_code)
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
    
    # Header - using local time fields
    writer.writerow([
        "BIB", "Nombre", "Vuelta", "Acción", "Origen",
        "Hora Inicio Vuelta", "Hora Registro",
        "Minutos en Vuelta", "Ritmo (min/km)", "Registrado Por", "Razón/Notas",
        "Anulada", "Anulada por", "Motivo anulación",
    ])

    # El anillo no mide lo mismo en todas las sedes.
    KM_PER_LAP = races.km_por_vuelta(active_race)

    # Data rows
    for reg in registrations:
        # Use local time strings if available, otherwise format UTC
        lap_start_str = reg.get("lap_start_time_local", "")
        scan_time_str = reg.get("scan_time_local", "")
        
        # Fallback to UTC formatted if local not available
        if not lap_start_str and reg.get("lap_start_time"):
            lap_start_str = reg.get("lap_start_time").strftime("%H:%M:%S")
        if not scan_time_str and reg.get("scan_time"):
            scan_time_str = reg.get("scan_time").strftime("%H:%M:%S")
        
        # Calculate pace (min/km) only for completed laps - format as mm:ss
        minutes_into_lap = reg.get("minutes_into_lap")
        pace_str = ""
        if minutes_into_lap is not None and reg.get("action") == "lap_completed":
            pace_decimal = minutes_into_lap / KM_PER_LAP
            pace_minutes = int(pace_decimal)
            pace_seconds = round((pace_decimal - pace_minutes) * 60)
            pace_str = f"{pace_minutes}:{pace_seconds:02d}"
        
        writer.writerow([
            reg.get("bib", ""),
            reg.get("athlete_name", ""),
            reg.get("lap_number", ""),
            reg.get("action", ""),
            reg.get("source", laps.ORIGEN_QR),
            lap_start_str,
            scan_time_str,
            minutes_into_lap if minutes_into_lap is not None else "",
            pace_str,
            reg.get("scanned_by", ""),
            reg.get("reason", ""),
            "sí" if reg.get("anulada") else "",
            reg.get("anulada_por", ""),
            reg.get("motivo_anulacion", ""),
        ])
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=registro_vueltas_{race_code}.csv"
        }
    )


@router.get("/lap-registrations/summary", dependencies=[solo_control])
async def get_lap_registrations_summary(race_code: Optional[str] = None):
    """Get summary statistics for lap registrations"""
    from server import db as database
    
    # Get active race if not specified
    if not race_code:
        active_race = await races.carrera_publica(database)
        if not active_race:
            return {"total": 0, "by_lap": [], "by_action": {}}
        race_code = active_race.get("code")

    # Lo anulado no cuenta en los totales: si contara, una correccion inflaria
    # las cifras del dia en vez de arreglarlas. Se informa aparte.
    vigentes = {"race_code": race_code, "anulada": {"$ne": True}}

    # Count by lap
    pipeline = [
        {"$match": vigentes},
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
        {"$match": vigentes},
        {"$group": {"_id": "$action", "count": {"$sum": 1}}}
    ]

    by_action_list = await database.lap_registrations.aggregate(action_pipeline).to_list(10)
    by_action = {item["_id"]: item["count"] for item in by_action_list}

    # De donde salieron: escaneo o panel
    origen_list = await database.lap_registrations.aggregate([
        {"$match": vigentes},
        {"$group": {"_id": "$source", "count": {"$sum": 1}}}
    ]).to_list(10)
    by_source = {(item["_id"] or laps.ORIGEN_QR): item["count"] for item in origen_list}

    total = await database.lap_registrations.count_documents(vigentes)
    anuladas = await database.lap_registrations.count_documents(
        {"race_code": race_code, "anulada": True}
    )

    return {
        "total": total,
        "anuladas": anuladas,
        "by_lap": [{"lap": item["_id"], "count": item["count"], "completed": item["completed"], "dnf": item["dnf"]} for item in by_lap],
        "by_action": by_action,
        "by_source": by_source,
    }


# ============= VUELTAS A MANO DESDE EL PANEL =============
#
# El escaneo es la via normal, pero falla: un telefono sin bateria, un QR
# mojado, una fila de corredores y alguien que pasa sin fichar. El panel es el
# repuesto, y escribe en el mismo libro que el escaner para que al final del dia
# haya una sola version de lo que paso.


class VueltaManual(BaseModel):
    race_code: str
    bib: str
    lap_number: Optional[int] = None  # por defecto, la siguiente que le toca
    motivo: Optional[str] = None


class AjusteVueltas(BaseModel):
    race_code: str
    bib: str
    laps_completed: int
    motivo: Optional[str] = None


class Anulacion(BaseModel):
    race_code: str
    motivo: Optional[str] = None


def _autor(user: dict) -> str:
    return user.get("username") or "panel"


@router.post("/lap-registrations/manual")
async def registrar_vuelta_a_mano(
    datos: VueltaManual,
    user=Depends(require_permission("control")),
):
    """Anota una vuelta que el escaner no llego a registrar."""
    from server import db as database

    carrera = await races.obtener_carrera(database, datos.race_code)
    atleta = await laps.exigir_atleta(database, carrera["code"], datos.bib)

    vuelta = datos.lap_number or (atleta.get("laps_completed", 0) + 1)

    repetida = await laps.vuelta_ya_registrada(database, carrera["code"], atleta.get("bib"), vuelta)
    if repetida:
        raise HTTPException(
            status_code=400,
            detail=f"La vuelta {vuelta} de ese corredor ya estaba registrada",
        )

    estado = await laps.registrar_vuelta(
        database, carrera, atleta, vuelta, laps.ORIGEN_PANEL, _autor(user),
        races.vuelta_actual(carrera),
        {"reason": datos.motivo},
    )

    return {
        "message": f"Vuelta {vuelta} anotada a {laps.nombre_completo(atleta)}",
        **estado,
    }


@router.post("/lap-registrations/ajuste")
async def ajustar_vueltas_a_mano(
    datos: AjusteVueltas,
    user=Depends(require_permission("control")),
):
    """Fija las vueltas de un corredor, dejando dicho por que."""
    from server import db as database

    carrera = await races.obtener_carrera(database, datos.race_code)
    atleta = await laps.exigir_atleta(database, carrera["code"], datos.bib)

    estado = await laps.ajustar_vueltas(
        database, carrera, atleta, datos.laps_completed, _autor(user), datos.motivo
    )

    return {
        "message": f"{laps.nombre_completo(atleta)} queda con {estado['laps_completed']} vueltas",
        **estado,
    }


@router.post("/lap-registrations/{registro_id}/anular")
async def anular_registro_de_vuelta(
    registro_id: str,
    datos: Anulacion,
    user=Depends(require_permission("control")),
):
    """Deja sin efecto una anotacion, sin borrarla del libro."""
    from server import db as database
    from bson import ObjectId
    from bson.errors import InvalidId

    carrera = await races.obtener_carrera(database, datos.race_code)

    try:
        identificador = ObjectId(registro_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Identificador de registro invalido")

    estado = await laps.anular(database, carrera, identificador, _autor(user), datos.motivo)

    return {"message": "Registro anulado", **estado}


@router.post("/generate-qr/{bib}", dependencies=[solo_control])
async def generate_athlete_qr(bib: str, race_code: Optional[str] = None):
    """Generate QR code for an athlete"""
    from server import db as database
    
    active_race = await races.resolver_carrera(database, race_code)
    race_code = active_race.get("code")
    
    athlete = await laps.exigir_atleta(database, race_code, bib)
    
    # Generate QR code
    frontend_url = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:3000")
    if "/api" in frontend_url:
        frontend_url = frontend_url.replace("/api", "")
    
    quien = laps.nombre_completo(athlete)
    qr_url = generate_qr_code(bib, race_code, frontend_url, quien)
    qr_base64 = generate_qr_code_base64(bib, race_code, frontend_url, quien)
    
    return {
        "bib": bib,
        "nombre": athlete.get("nombre"),
        "apellidos": athlete.get("apellidos"),
        "qr_url": qr_url,
        "qr_base64": qr_base64,
        "race_code": race_code
    }


@router.get("/generate-all-qr", dependencies=[solo_control])
async def generate_all_qr_codes(race_code: Optional[str] = None):
    """Generate QR codes for all active athletes"""
    from server import db as database
    
    active_race = await races.resolver_carrera(database, race_code)
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
        qr_url = generate_qr_code(bib, race_code, frontend_url, laps.nombre_completo(athlete))
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


@router.get("/download-all-qr", dependencies=[solo_control])
async def download_all_qr_codes(race_code: Optional[str] = None):
    """Download all QR codes as a ZIP file"""
    from server import db as database
    
    active_race = await races.resolver_carrera(database, race_code)
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
        generate_qr_code(bib, race_code, frontend_url, laps.nombre_completo(athlete))
    
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
