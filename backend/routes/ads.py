"""Pie publicitario de BYSD Live: la cara de anuncio de un patrocinador.

Este router ya no administra nada: el CRUD vive en `routes/sponsors.py`. Aqui
quedan solo los tres endpoints publicos que consume la app, con **la misma
forma de respuesta de siempre**: hay versiones instaladas (1.3.x en App Store
y en Play) que los leen tal cual, y romperlas dejaria el pie vacio en
telefonos que no podemos actualizar.

Cada marca es un documento de `sponsors` con una participacion por carrera, y
el anuncio se arma juntando las dos mitades: el nombre, el logo y la
descripcion salen de la ficha; el texto, el enlace, el banner, la vigencia y
las metricas, de la participacion de esa carrera. La coleccion `ad_banners`
quedo retirada en septiembre de 2026.
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

    Tienen que cumplir las cuatro: que la marca no este retirada, tener
    encendido el interruptor de la app, estar en vigencia y traer algo que
    ensenar (una imagen, el texto o el enlace: ver `patrocinios.tiene_pieza`).
    Se les exige tambien haber llegado al momento comercial de publicar: el pie
    es la vitrina mas visible que tenemos y no deberia estrenar una marca que
    todavia no ha firmado.
    """
    code = race_code.upper()
    docs = await db.sponsors.find({"participaciones.race_code": code}).to_list(400)

    ahora = datetime.now(timezone.utc)
    vigentes = []
    for doc in docs:
        part = patrocinios.participacion(doc, code)
        if not part:
            continue
        if (
            patrocinios.sale_en(doc, part, "app")
            and patrocinios.vigente(part, ahora)
            and patrocinios.tiene_pieza(doc, part)
        ):
            vigentes.append(patrocinios.vista_anuncio(doc, part))

    vigentes.sort(key=lambda b: b.get("order") or 0)
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

    hay_patrocinadores = await db.sponsors.count_documents(
        {"participaciones.race_code": code}
    )
    return {"banners": [], "origen": "pausados" if hay_patrocinadores else "vacio"}


class TrackRequest(BaseModel):
    banner_id: str
    event: str  # "impression" | "click"


@router.post("/track")
async def track_banner_event(data: TrackRequest, db=Depends(get_db)):
    """Acumula una impresion o clic (publico, sin datos personales)."""
    if data.event not in ("impression", "click"):
        raise HTTPException(status_code=400, detail="Evento no válido")
    field = "impressions" if data.event == "impression" else "clicks"
    # `banner_id` es el `id` de la participacion -no el de la marca-, porque
    # las metricas se cuentan por carrera. Al unificar las fichas cada
    # participacion heredo el `id` del documento que habia, asi que los
    # contadores ya recogidos siguen sumando donde estaban.
    await db.sponsors.update_one(
        {"participaciones.id": data.banner_id},
        {"$inc": {f"participaciones.$.{field}": 1}},
    )
    return {"ok": True}
