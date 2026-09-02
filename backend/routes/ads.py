"""Pie publicitario de BYSD Live: la cara de anuncio de un patrocinador.

Este router ya no administra nada. Desde septiembre de 2026 un patrocinador es
un solo documento en `sponsors` -comercial, marca y publicacion juntos- y su
CRUD vive en `routes/sponsors.py`. Aqui quedan solo los tres endpoints
publicos que consume la app, con **la misma forma de respuesta de siempre**:
hay versiones instaladas (1.3.x en App Store y en Play) que los leen tal cual,
y romperlas dejaria el pie vacio en telefonos que no podemos actualizar.

La coleccion `ad_banners` quedo retirada; la migracion
`migrations/patrocinio_unico.py` volco su contenido en `sponsors`.
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from pydantic import BaseModel
from datetime import datetime, timezone

from services import patrocinios

router = APIRouter(prefix="/api/ads", tags=["ads"])


def get_db():
    from server import db
    return db


async def _active_race_code(database) -> Optional[str]:
    from routes.race import get_active_race_code
    return await get_active_race_code(database)


async def _anuncios(db, race_code: str) -> list[dict]:
    """Los patrocinadores de esa carrera que pueden salir como anuncio.

    Tienen que cumplir las cuatro: estar activos, tener encendido el
    interruptor de la app, estar en vigencia y traer alguna pieza grafica.
    A diferencia de antes, se les exige tambien haber llegado al momento
    comercial de publicar: el pie es la vitrina mas visible que tenemos y no
    deberia estrenar una marca que todavia no ha firmado.
    """
    docs = await db.sponsors.find(
        {"race_code": race_code.upper(), "is_active": True},
        patrocinios.CAMPOS_ANUNCIO | {
            "start_at": 1, "end_at": 1, "status": 1, "publicar_desde": 1,
        },
    ).sort("order", 1).to_list(200)

    ahora = datetime.now(timezone.utc)
    vigentes = [
        d for d in docs
        if patrocinios.sale_en(d, "app")
        and patrocinios.vigente(d, ahora)
        and patrocinios.tiene_pieza(d)
    ]
    for d in vigentes:
        for campo in ("start_at", "end_at", "status", "publicar_desde"):
            d.pop(campo, None)
    return vigentes


@router.get("/public")
async def get_public_banners(race_code: Optional[str] = None, db=Depends(get_db)):
    """Anuncios vigentes de una carrera (publico)."""
    code = race_code or await _active_race_code(db)
    if not code:
        return []
    return await _anuncios(db, code)


@router.get("/pie")
async def pie_publicitario(race_code: Optional[str] = None, db=Depends(get_db)):
    """Lo que va en el pie de la app, ya resuelto. Publico.

    `origen` distingue "no hay nada montado" de "lo hay, pero apagado, fuera
    de fecha o sin pieza": la app lo usa para no dejar un hueco donde antes
    habia una barra.
    """
    code = race_code or await _active_race_code(db)
    if not code:
        return {"banners": [], "origen": "vacio"}
    code = code.upper()

    vigentes = await _anuncios(db, code)
    for b in vigentes:
        b.pop("publicar_web", None)
        b.pop("publicar_app", None)

    if vigentes:
        return {"banners": vigentes, "origen": "ads"}

    hay_patrocinadores = await db.sponsors.count_documents({"race_code": code})
    return {"banners": [], "origen": "pausados" if hay_patrocinadores else "vacio"}


class TrackRequest(BaseModel):
    banner_id: str
    event: str  # "impression" | "click"


@router.post("/track")
async def track_banner_event(data: TrackRequest, db=Depends(get_db)):
    """Acumula una impresion o clic (publico, sin datos personales).

    `banner_id` es el `id` del patrocinador, que la migracion heredo del de su
    antigua ficha: los contadores que ya habia siguen sumando donde estaban.
    """
    if data.event not in ("impression", "click"):
        raise HTTPException(status_code=400, detail="Evento no válido")
    field = "impressions" if data.event == "impression" else "clicks"
    await db.sponsors.update_one({"id": data.banner_id}, {"$inc": {field: 1}})
    return {"ok": True}
