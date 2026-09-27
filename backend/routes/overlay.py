"""Las vistas de la transmision (OBS), en una sola llamada.

La barra que se pone debajo del video pregunta cada pocos segundos y necesita
todo a la vez: el reloj de la vuelta, los conteos, los kilometros, la
clasificacion y las ultimas llegadas. Pedirlo en cuatro llamadas distintas,
cada tres segundos y durante veinticuatro horas, es mucho ruido para nada.

Va con una clave en la direccion (`race_configurations.overlay_key`) en vez de
abierto: son los mismos datos que ya se ven en la pagina de seguimiento, pero
el feed de llegadas con la hora de cada paso no tiene por que quedar servido a
cualquiera que pruebe la direccion. La clave la da el panel y se puede cambiar
si la direccion se comparte de mas.
"""
import secrets
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from services import laps, races
from services.auth import require_permission

router = APIRouter(prefix="/api/overlay", tags=["overlay"])

FUERA = {"retired", "dns"}
EN_CARRERA = ["registered", "active", "retired", "dns", "winner", "honor"]

MAX_LLEGADAS = 30
MAX_CLASIFICACION = 50


def _iso(momento) -> Optional[str]:
    return momento.isoformat() if momento else None


async def _carrera_con_clave(db, race_code: Optional[str], clave: str) -> dict:
    """La carrera pedida, solo si la clave es la suya.

    La clave es por carrera, como la de escaneo: la de la edicion pasada no
    abre la transmision de esta.
    """
    carrera = await races.resolver_carrera(db, race_code)
    esperada = carrera.get("overlay_key")
    if not esperada or not clave or not secrets.compare_digest(str(clave), str(esperada)):
        raise HTTPException(status_code=403, detail="Clave de transmisión no válida")
    return carrera


@router.get("/estado")
async def estado_para_la_transmision(
    clave: str = Query(..., description="Clave de transmisión de la carrera"),
    race_code: Optional[str] = None,
    llegadas: int = 12,
    clasificacion: int = 10,
):
    """Todo lo que pintan las vistas de OBS, en una sola llamada."""
    from server import db

    carrera = await _carrera_con_clave(db, race_code, clave)
    codigo = carrera["code"]
    reloj = races.vuelta_actual(carrera)
    km_vuelta = races.km_por_vuelta(carrera)
    vuelta = reloj["current_lap"]

    corredores = await db.registrations.find(
        {
            "race_code": codigo,
            "status": {"$in": EN_CARRERA},
            "bib": {"$exists": True, "$ne": None},
            "categoria": {"$ne": "reserva"},
        },
        {"_id": 0, "bib": 1, "nombre": 1, "apellidos": 1, "nacionalidad": 1,
         "status": 1, "laps_completed": 1, "total_km": 1},
    ).to_list(1000)

    dnf = sum(1 for c in corredores if c.get("status") == "retired")
    dns = sum(1 for c in corredores if c.get("status") == "dns")
    en_carrera = sum(1 for c in corredores if c.get("status") not in FUERA)

    corredores.sort(key=lambda c: (
        c.get("status") in FUERA,
        -(c.get("laps_completed") or 0),
        str(c.get("bib") or "999"),
    ))
    tabla = [
        {
            "bib": str(c.get("bib")).zfill(3),
            "nombre": c.get("nombre") or "",
            "apellidos": c.get("apellidos") or "",
            "nacionalidad": c.get("nacionalidad") or "DOM",
            "status": c.get("status") or "active",
            "vueltas": c.get("laps_completed") or 0,
            "km": round(c.get("total_km") or 0, 1),
        }
        for c in corredores[:max(0, min(clasificacion, MAX_CLASIFICACION))]
    ]

    # Las llegadas se leen del libro de vueltas, que es donde queda la hora
    # real del paso por el arco. Las anuladas no se anuncian.
    anotaciones = await db.lap_registrations.find(
        {"race_code": codigo, "action": laps.VUELTA_COMPLETADA, "anulada": {"$ne": True}},
        {"bib": 1, "athlete_name": 1, "lap_number": 1, "scan_time": 1, "lap_start_time": 1},
    ).sort("scan_time", -1).to_list(max(1, min(llegadas, MAX_LLEGADAS)))

    recientes = []
    for a in anotaciones:
        paso = a.get("scan_time")
        inicio = a.get("lap_start_time")
        if paso is not None and paso.tzinfo is None:
            paso = paso.replace(tzinfo=timezone.utc)
        if inicio is not None and inicio.tzinfo is None:
            inicio = inicio.replace(tzinfo=timezone.utc)
        recientes.append({
            "id": str(a["_id"]),
            "bib": str(a.get("bib") or "").zfill(3),
            "nombre": a.get("athlete_name") or "",
            "vuelta": a.get("lap_number"),
            "hora": _iso(paso),
            # Lo que tardo en esa vuelta, desde que arranco hasta que volvio
            "duracion_seg": int((paso - inicio).total_seconds()) if paso and inicio else None,
            "km": round((a.get("lap_number") or 0) * km_vuelta, 1),
        })

    completadas = max(0, vuelta - 1) if reloj["race_started"] else 0

    return {
        "carrera": {
            "code": codigo,
            "nombre": carrera.get("name"),
            "estado": races.estado(carrera),
            "km_por_vuelta": km_vuelta,
            "minutos_por_vuelta": races.minutos_por_vuelta(carrera),
        },
        "reloj": {
            "vuelta": vuelta,
            "empezada": reloj["race_started"],
            "terminada": reloj["race_finished"],
            "segundos_restantes": reloj["seconds_remaining"],
            "minutos_de_vuelta": reloj["minutes_into_lap"],
            "hora_inicio": _iso(reloj["started_at"]),
            "inicio_de_vuelta": _iso(reloj["lap_start_time"]),
            # El descanso de quien acaba de llegar es lo que queda de la
            # vuelta en curso: la vista lo cuenta desde aqui, en vivo.
            "fin_de_vuelta": _iso(reloj["lap_end_time"]),
            # Con la hora del servidor la vista corrige el desfase del reloj
            # del ordenador que transmite, que puede ir minutos adelantado.
            "ahora": datetime.now(timezone.utc).isoformat(),
        },
        "totales": {
            "en_carrera": en_carrera,
            "dns": dns,
            "dnf": dnf,
            "inscritos": len(corredores),
            "vueltas_completadas": completadas,
            "km_recorridos": round(completadas * km_vuelta, 1),
            "km_de_todos": round(sum(c.get("total_km") or 0 for c in corredores), 1),
        },
        "clasificacion": tabla,
        "llegadas": recientes,
    }


# ==================== LAS DIRECCIONES, DESDE EL PANEL ====================


async def _clave_de(db, race_code: str) -> str:
    """La clave de la carrera; la crea la primera vez que se piden las vistas."""
    carrera = await races.obtener_carrera(db, race_code)
    if carrera.get("overlay_key"):
        return carrera["overlay_key"]

    clave = secrets.token_urlsafe(18)
    await db.race_configurations.update_one(
        {"code": carrera["code"]}, {"$set": {"overlay_key": clave}}
    )
    return clave


@router.get("/enlaces", dependencies=[Depends(require_permission("control"))])
async def enlaces_de_la_transmision(race_code: str = Depends(races.carrera_del_panel)):
    """La clave de la carrera, para armar las direcciones que se pegan en OBS."""
    from server import db

    return {"race_code": race_code.upper(), "clave": await _clave_de(db, race_code)}


@router.post("/clave", dependencies=[Depends(require_permission("control"))])
async def cambiar_la_clave(race_code: str = Depends(races.carrera_del_panel)):
    """Cambia la clave: las direcciones repartidas antes dejan de funcionar."""
    from server import db

    carrera = await races.obtener_carrera(db, race_code)
    clave = secrets.token_urlsafe(18)
    await db.race_configurations.update_one(
        {"code": carrera["code"]}, {"$set": {"overlay_key": clave}}
    )
    return {"race_code": carrera["code"], "clave": clave}
