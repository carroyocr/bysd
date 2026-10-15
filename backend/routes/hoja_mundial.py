"""El panel de la hoja del Campeonato Mundial (pestana En Vivo -> Hoja del Mundial).

Lo que hace la organizacion aqui: pegar la direccion de la hoja que les
reparte la organizacion mundial, emparejar sus filas con los dorsales,
encender la sincronizacion automatica y, si hace falta, forzar una. Las
reglas de que se escribe estan en `services/hoja_mundial.py`.
"""
from typing import Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from services import google_servicio, hoja_mundial, laps, races
from services.auth import require_permission

router = APIRouter(prefix="/api/hoja-mundial", tags=["hoja-mundial"])

solo_control = Depends(require_permission("control"))


class ConfigHoja(BaseModel):
    hoja: Optional[str] = None     # direccion completa o id de la hoja
    activa: Optional[bool] = None  # sincronizar sola con cada vuelta


class FilasHoja(BaseModel):
    filas: Dict[str, Optional[int]]  # dorsal -> fila de la hoja (None quita)


def _iso(momento) -> Optional[str]:
    return momento.isoformat() if momento else None


async def _estado(database, carrera: dict, filas_hoja: Optional[list] = None,
                  error_hoja: Optional[str] = None) -> dict:
    config = dict(carrera.get("hoja_mundial") or {})
    spreadsheet_id = config.get("spreadsheet_id")
    filas = config.get("filas") or {}

    atletas = await database.registrations.find(
        {"race_code": carrera["code"], "bib": {"$ne": None}},
        {"_id": 0, "bib": 1, "nombre": 1, "apellidos": 1, "status": 1, "laps_completed": 1},
    ).to_list(500)
    atletas.sort(key=lambda a: int(a.get("bib")) if str(a.get("bib")).isdigit() else 10 ** 6)

    if filas_hoja is None and spreadsheet_id and google_servicio.esta_configurado():
        try:
            filas_hoja = await hoja_mundial.leer_filas(spreadsheet_id)
        except hoja_mundial.ErrorDeHoja as e:
            error_hoja = str(e)
            filas_hoja = []

    fila_a_bib = {int(f): str(b) for b, f in filas.items()}
    nombre_en_hoja = {f["fila"]: f["nombre"] for f in (filas_hoja or [])}

    corredores = []
    for a in atletas:
        bib = str(a.get("bib"))
        fila = filas.get(bib)
        corredores.append({
            "bib": bib,
            "nombre": laps.nombre_completo(a),
            "status": a.get("status"),
            "laps_completed": a.get("laps_completed", 0),
            "fila": fila,
            "nombre_en_hoja": nombre_en_hoja.get(fila) if fila else None,
        })

    filas_sin_corredor = [
        f for f in (filas_hoja or []) if f["fila"] not in fila_a_bib
    ]

    return {
        "race_code": carrera["code"],
        "cuenta_configurada": google_servicio.esta_configurado(),
        "cuenta_servicio": google_servicio.correo_de_la_cuenta(),
        "spreadsheet_id": spreadsheet_id,
        "url": hoja_mundial.url_de_hoja(spreadsheet_id) if spreadsheet_id else None,
        "hoja": hoja_mundial.HOJA,
        "activa": bool(config.get("activa")),
        "lista": hoja_mundial.lista_para_sincronizar(carrera),
        "corredores": corredores,
        "filas_hoja": filas_hoja or [],
        "filas_sin_corredor": filas_sin_corredor,
        "error_hoja": error_hoja,
        "ultima_sync": _iso(config.get("ultima_sync")),
        "ultimo_intento": _iso(config.get("ultimo_intento")),
        "ultimo_error": config.get("ultimo_error"),
        "avisos": config.get("avisos") or [],
    }


@router.get("/estado", dependencies=[solo_control])
async def estado(race_code: str = Depends(races.carrera_del_panel)):
    from server import db
    carrera = await races.obtener_carrera(db, race_code)
    return await _estado(db, carrera)


@router.put("/config", dependencies=[solo_control])
async def configurar(datos: ConfigHoja, race_code: str = Depends(races.carrera_del_panel)):
    """Guarda la hoja (direccion o id) y si se sincroniza sola."""
    from server import db
    carrera = await races.obtener_carrera(db, race_code)

    cambios = {}
    if datos.hoja is not None:
        if datos.hoja.strip() == "":
            cambios["hoja_mundial.spreadsheet_id"] = None
        else:
            spreadsheet_id = hoja_mundial.id_de_hoja(datos.hoja)
            if not spreadsheet_id:
                raise HTTPException(status_code=400, detail="Esa no parece la direccion de una hoja de Google")
            if spreadsheet_id != (carrera.get("hoja_mundial") or {}).get("spreadsheet_id"):
                # Otra hoja: lo escrito en la anterior ya no cuenta.
                cambios["hoja_mundial.escrito"] = {}
                cambios["hoja_mundial.filas"] = {}
            cambios["hoja_mundial.spreadsheet_id"] = spreadsheet_id
    if datos.activa is not None:
        cambios["hoja_mundial.activa"] = bool(datos.activa)

    if cambios:
        await db.race_configurations.update_one({"code": carrera["code"]}, {"$set": cambios})
        carrera = await races.obtener_carrera(db, race_code)

    return await _estado(db, carrera)


@router.post("/emparejar", dependencies=[solo_control])
async def emparejar(race_code: str = Depends(races.carrera_del_panel)):
    """Lee los nombres de la hoja y los casa con los dorsales por nombre."""
    from server import db
    carrera = await races.obtener_carrera(db, race_code)
    spreadsheet_id = (carrera.get("hoja_mundial") or {}).get("spreadsheet_id")
    if not spreadsheet_id:
        raise HTTPException(status_code=400, detail="Primero guarda la direccion de la hoja")

    try:
        filas_hoja = await hoja_mundial.leer_filas(spreadsheet_id)
    except hoja_mundial.ErrorDeHoja as e:
        raise HTTPException(status_code=502, detail=str(e))

    atletas = await db.registrations.find(
        {"race_code": carrera["code"], "bib": {"$ne": None}},
        {"_id": 0, "bib": 1, "nombre": 1, "apellidos": 1},
    ).to_list(500)

    filas, sin_fila, sin_pareja = hoja_mundial.emparejar(filas_hoja, atletas)
    await db.race_configurations.update_one(
        {"code": carrera["code"]}, {"$set": {"hoja_mundial.filas": filas}}
    )
    carrera = await races.obtener_carrera(db, race_code)
    resultado = await _estado(db, carrera, filas_hoja=filas_hoja)
    resultado["emparejados"] = len(filas)
    resultado["sin_fila"] = sin_fila
    resultado["sin_pareja"] = [
        {"bib": str(a.get("bib")), "nombre": laps.nombre_completo(a)} for a in sin_pareja
    ]
    return resultado


@router.put("/filas", dependencies=[solo_control])
async def fijar_filas(datos: FilasHoja, race_code: str = Depends(races.carrera_del_panel)):
    """Corrige a mano a que fila va cada dorsal."""
    from server import db
    carrera = await races.obtener_carrera(db, race_code)
    filas = dict((carrera.get("hoja_mundial") or {}).get("filas") or {})

    for bib, fila in datos.filas.items():
        bib = str(bib).strip()
        if fila is None:
            filas.pop(bib, None)
            continue
        if fila < hoja_mundial.PRIMERA_FILA:
            raise HTTPException(status_code=400, detail=f"La fila {fila} es de encabezados")
        if any(f == fila and b != bib for b, f in filas.items()):
            raise HTTPException(status_code=400, detail=f"La fila {fila} ya esta asignada a otro dorsal")
        filas[bib] = int(fila)

    await db.race_configurations.update_one(
        {"code": carrera["code"]}, {"$set": {"hoja_mundial.filas": filas}}
    )
    carrera = await races.obtener_carrera(db, race_code)
    return await _estado(db, carrera)


@router.post("/sincronizar", dependencies=[solo_control])
async def sincronizar(race_code: str = Depends(races.carrera_del_panel)):
    """Rehace la hoja entera con el libro de vueltas, ahora."""
    from server import db
    carrera = await races.obtener_carrera(db, race_code)
    if not hoja_mundial.lista_para_sincronizar(carrera):
        raise HTTPException(status_code=400, detail="Falta la hoja o el emparejamiento de dorsales")
    resultado = await hoja_mundial.sincronizar(db, carrera)
    carrera = await races.obtener_carrera(db, race_code)
    estado_actual = await _estado(db, carrera)
    estado_actual["resultado"] = resultado
    return estado_actual
