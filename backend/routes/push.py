"""Notificaciones push de la app BYSD Live.

Cada instalacion de la app registra aqui su token de FCM junto con la lista de
corredores que sigue. Cuando uno de esos corredores completa una vuelta o
queda fuera, el escaneo dispara el aviso a los telefonos que lo siguen; el
panel de control puede ademas mandar un mensaje suelto a todo el mundo.

La lista de seguidos vive en el telefono (localStorage) y se copia aqui en
cada registro: el backend no sabe quien es el usuario ni lo necesita, solo
necesita saber a que tokens mandar cada aviso.
"""
import logging
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from services import push_service, rate_limit
from services.auth import require_permission

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/push", tags=["push"])

solo_control = Depends(require_permission("control"))

# Un token de FCM ronda los 160-300 caracteres; el tope es para que nadie use
# el endpoint publico como almacen de texto.
MAX_TOKEN = 512
MAX_SEGUIDOS = 200


class RegistroDispositivo(BaseModel):
    token: str
    platform: str = "unknown"
    race_code: Optional[str] = None
    followed: List[str] = Field(default_factory=list)


class Baja(BaseModel):
    token: str


class Aviso(BaseModel):
    title: str
    body: str
    race_code: Optional[str] = None


def _ahora() -> datetime:
    return datetime.now(timezone.utc)


def variantes_bib(bib) -> List[str]:
    """Las formas en que un mismo dorsal puede estar escrito.

    La app guarda los favoritos como los devuelve `/api/race/participants`, con
    ceros delante ("042"), mientras que el escaneo lee el dorsal de
    `registrations`, donde puede ser 42, "42" o "042". Buscar solo por una
    forma dejaba el aviso sin destinatarios sin que nada fallara.
    """
    crudo = str(bib).strip()
    if not crudo:
        return []
    formas = {crudo}
    sin_ceros = crudo.lstrip("0") or "0"
    formas.add(sin_ceros)
    if sin_ceros.isdigit():
        formas.add(sin_ceros.zfill(3))
    return list(formas)


async def _borrar_tokens(database, tokens: List[str]) -> None:
    """Quita de la base los tokens que FCM ya no reconoce."""
    if tokens:
        await database.push_devices.delete_many({"token": {"$in": tokens}})


async def _enviar_y_limpiar(database, tokens, titulo, cuerpo, data=None) -> dict:
    resultado = await push_service.enviar(tokens, titulo, cuerpo, data)
    await _borrar_tokens(database, resultado.get("tokens_muertos", []))
    return resultado


# ============= API PUBLICA DE LA APP =============


@router.post("/register")
async def registrar_dispositivo(registro: RegistroDispositivo, request: Request):
    """Alta o actualizacion del token de un telefono y de a quien sigue."""
    from server import db as database

    token = (registro.token or "").strip()
    if not token or len(token) > MAX_TOKEN:
        raise HTTPException(status_code=400, detail="Token invalido")

    rate_limit.comprobar(
        "push_register",
        rate_limit.ip_cliente(request),
        limite=30,
        ventana_segundos=300,
        mensaje="Demasiados registros de notificaciones. Espera un momento.",
    )

    seguidos = [str(b).strip() for b in (registro.followed or []) if str(b).strip()]
    seguidos = list(dict.fromkeys(seguidos))[:MAX_SEGUIDOS]

    await database.push_devices.update_one(
        {"token": token},
        {
            "$set": {
                "platform": registro.platform or "unknown",
                "race_code": registro.race_code,
                "followed": seguidos,
                "updated_at": _ahora(),
            },
            "$setOnInsert": {"created_at": _ahora()},
        },
        upsert=True,
    )

    return {"success": True, "followed": len(seguidos), "push_activo": push_service.esta_configurado()}


@router.post("/unregister")
async def dar_de_baja(baja: Baja):
    """El usuario apago las notificaciones o desinstalo: fuera de la lista."""
    from server import db as database

    token = (baja.token or "").strip()
    if not token:
        raise HTTPException(status_code=400, detail="Token invalido")

    await database.push_devices.delete_one({"token": token})
    return {"success": True}


# ============= PANEL DE CONTROL =============


@router.get("/stats", dependencies=[solo_control])
async def estadisticas(race_code: Optional[str] = None):
    """Cuantos telefonos hay registrados, para saber a cuantos llegaria un aviso."""
    from server import db as database

    filtro = {"race_code": race_code} if race_code else {}
    total = await database.push_devices.count_documents(filtro)
    android = await database.push_devices.count_documents({**filtro, "platform": "android"})
    ios = await database.push_devices.count_documents({**filtro, "platform": "ios"})

    return {
        "total": total,
        "android": android,
        "ios": ios,
        "configurado": push_service.esta_configurado(),
    }


@router.post("/broadcast", dependencies=[solo_control])
async def enviar_aviso(aviso: Aviso):
    """Manda un mensaje escrito a mano a todas las apps instaladas."""
    from server import db as database

    titulo = (aviso.title or "").strip()
    cuerpo = (aviso.body or "").strip()
    if not titulo or not cuerpo:
        raise HTTPException(status_code=400, detail="El aviso necesita titulo y mensaje")

    if not push_service.esta_configurado():
        raise HTTPException(
            status_code=503,
            detail="Las notificaciones push no estan configuradas (falta FCM_SERVICE_ACCOUNT_JSON)",
        )

    filtro = {"race_code": aviso.race_code} if aviso.race_code else {}
    tokens = [d["token"] async for d in database.push_devices.find(filtro, {"token": 1})]

    resultado = await _enviar_y_limpiar(
        database, tokens, titulo, cuerpo, {"tipo": "aviso"}
    )

    return {
        "success": True,
        "dispositivos": len(tokens),
        "enviados": resultado["enviados"],
        "fallidos": resultado["fallidos"],
    }


# ============= AVISOS AUTOMATICOS =============


async def avisar_a_seguidores(
    database,
    race_code: Optional[str],
    bib: str,
    titulo: str,
    cuerpo: str,
    data: Optional[dict] = None,
) -> None:
    """Aviso a los telefonos que siguen a un corredor concreto.

    Pensada para llamarse con `asyncio.create_task` desde el escaneo: el
    escaneo no debe esperar a que FCM responda, y un fallo de red al enviar no
    puede tumbar el registro de la vuelta. Por eso se traga sus propios
    errores y solo los deja en el log.
    """
    try:
        if not push_service.esta_configurado():
            return

        formas = variantes_bib(bib)
        if not formas:
            return

        filtro = {"followed": {"$in": formas}}
        if race_code:
            # Se acepta tambien el dispositivo que aun no habia guardado carrera.
            filtro["race_code"] = {"$in": [race_code, None]}

        tokens = [d["token"] async for d in database.push_devices.find(filtro, {"token": 1})]
        if not tokens:
            return

        await _enviar_y_limpiar(database, tokens, titulo, cuerpo, data)
    except Exception as e:
        logger.warning(f"No se pudo enviar el aviso push del BIB {bib}: {e}")
