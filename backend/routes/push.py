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

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field

from services import push_service, rate_limit
from services.auth import has_permission, require_permission, verify_admin_token

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
    # Correo del voluntario, cuando quien usa el telefono entro como staff. Es
    # lo que permite avisarle media hora antes de su turno.
    staff_email: Optional[str] = None
    # Correo del corredor, cuando entro con su cuenta de atleta. Sin esto no
    # habia forma de mandar un aviso "a los inscritos": el registro solo sabia
    # a quien sigue el telefono, no de quien es.
    athlete_email: Optional[str] = None


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

    campos = {
        "platform": registro.platform or "unknown",
        "race_code": registro.race_code,
        "followed": seguidos,
        "updated_at": _ahora(),
    }
    # Solo se toca si viene: la app del corredor y la del staff registran el
    # mismo token desde pantallas distintas y una no debe borrar lo de la otra.
    if registro.staff_email is not None:
        campos["staff_email"] = registro.staff_email.strip().lower() or None
    if registro.athlete_email is not None:
        campos["athlete_email"] = registro.athlete_email.strip().lower() or None

    await database.push_devices.update_one(
        {"token": token},
        {
            "$set": campos,
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


# ============= ENVIO DIRIGIDO (modulo de mensajes) =============
#
# El aviso automatico de vuelta va a quien sigue a un corredor, y /broadcast va
# a todo el mundo. Faltaba lo de en medio: escribir a un grupo concreto —los
# inscritos de una carrera, los que aun deben el pago, el equipo de un evento,
# una persona suelta— igual que ya se hace con el correo.
#
# Un telefono queda ligado a una cuenta al entrar en la app: al de staff por
# `staff_email` y al del corredor por `athlete_email`. Ahi es donde se apoya
# todo lo que sigue; un telefono sin cuenta solo es alcanzable por "todos".


class FiltroPush(BaseModel):
    # 'todos' | 'atletas' | 'staff' | 'seguidores' | 'manual'
    audiencia: str
    race_code: Optional[str] = None
    # Solo 'atletas'
    reg_status: Optional[str] = None
    payment: Optional[str] = None
    # Solo 'staff'
    evento: Optional[str] = None
    solo_con_turno: bool = False
    # Solo 'seguidores': dorsales concretos
    bibs: List[str] = Field(default_factory=list)
    # Solo 'manual': correos de las cuentas a las que escribir
    correos: List[str] = Field(default_factory=list)


class EnvioPush(FiltroPush):
    title: str
    body: str


def _puede_enviar(authorization: Optional[str] = Header(None)) -> dict:
    """Manda quien lleva las comunicaciones ("emails") o el control de carrera.

    Son los dos perfiles que hoy escriben a los participantes; exigir uno solo
    dejaria fuera a la mitad de quienes ya hacen esto por correo.
    """
    payload = verify_admin_token(authorization)
    if not (has_permission(payload, "emails") or has_permission(payload, "control")):
        raise HTTPException(status_code=403, detail="No tienes permiso para enviar avisos")
    return payload


async def _correos_atletas(database, filtro: FiltroPush) -> List[str]:
    """Correos de los corredores que cumplen el filtro de inscripcion."""
    query: dict = {}
    if filtro.race_code:
        query["race_code"] = filtro.race_code
    if filtro.reg_status:
        query["status"] = filtro.reg_status
    if filtro.payment:
        query["payment_status"] = filtro.payment

    correos = await database.registrations.distinct("email", query)
    return [c.strip().lower() for c in correos if isinstance(c, str) and c.strip()]


async def _correos_staff(database, filtro: FiltroPush) -> List[str]:
    """Correos del equipo: todos, los de un evento, o solo los que tienen turno."""
    if filtro.solo_con_turno:
        query = {"email_asignado": {"$nin": [None, ""]}}
        if filtro.evento:
            from routes.volunteer_registration import evento_query
            query.update(evento_query(filtro.evento))
        correos = await database.volunteer_assignments.distinct("email_asignado", query)
    else:
        query = {"status": {"$ne": "cancelled"}}
        if filtro.evento:
            query["evento"] = filtro.evento
        correos = await database.volunteer_registrations.distinct("email", query)

    return [c.strip().lower() for c in correos if isinstance(c, str) and c.strip()]


async def _dispositivos_de(database, filtro: FiltroPush) -> List[dict]:
    """Dispositivos alcanzados por el filtro, sin repetir token."""
    if filtro.audiencia == "todos":
        query = {"race_code": filtro.race_code} if filtro.race_code else {}

    elif filtro.audiencia == "seguidores":
        formas: List[str] = []
        for bib in filtro.bibs:
            formas.extend(variantes_bib(bib))
        if not formas:
            return []
        query = {"followed": {"$in": formas}}
        if filtro.race_code:
            query["race_code"] = {"$in": [filtro.race_code, None]}

    else:
        if filtro.audiencia == "atletas":
            correos = await _correos_atletas(database, filtro)
            campo = "athlete_email"
        elif filtro.audiencia == "staff":
            correos = await _correos_staff(database, filtro)
            campo = "staff_email"
        elif filtro.audiencia == "manual":
            correos = [c.strip().lower() for c in filtro.correos if c and c.strip()]
            # A mano no se sabe si el correo es de un corredor o del equipo: se
            # busca por los dos lados.
            if not correos:
                return []
            query = {"$or": [{"athlete_email": {"$in": correos}}, {"staff_email": {"$in": correos}}]}
            return await database.push_devices.find(query, {"_id": 0}).to_list(5000)
        else:
            raise HTTPException(status_code=400, detail="Audiencia desconocida")

        if not correos:
            return []
        query = {campo: {"$in": correos}}

    return await database.push_devices.find(query, {"_id": 0}).to_list(5000)


@router.post("/destinatarios")
async def previsualizar_destinatarios(filtro: FiltroPush, _=Depends(_puede_enviar)):
    """A cuantos telefonos llegaria este envio, antes de mandarlo.

    Los correos con cuenta pero sin la app instalada se cuentan aparte: es la
    diferencia entre "no le llego" y "no lo tiene instalado", y sin ese numero
    parece que el envio falla cuando en realidad no hay a donde mandarlo.
    """
    from server import db as database

    dispositivos = await _dispositivos_de(database, filtro)
    tokens = {d["token"] for d in dispositivos if d.get("token")}

    esperados = 0
    if filtro.audiencia == "atletas":
        esperados = len(await _correos_atletas(database, filtro))
    elif filtro.audiencia == "staff":
        esperados = len(await _correos_staff(database, filtro))
    elif filtro.audiencia == "manual":
        esperados = len([c for c in filtro.correos if c and c.strip()])

    con_app = len({
        (d.get("athlete_email") or d.get("staff_email"))
        for d in dispositivos
        if d.get("athlete_email") or d.get("staff_email")
    })

    return {
        "dispositivos": len(tokens),
        "android": sum(1 for d in dispositivos if d.get("platform") == "android"),
        "ios": sum(1 for d in dispositivos if d.get("platform") == "ios"),
        "personas_con_app": con_app,
        "personas_en_la_lista": esperados,
        "sin_app": max(0, esperados - con_app) if esperados else 0,
        "configurado": push_service.esta_configurado(),
    }


@router.post("/enviar")
async def enviar_push_dirigido(envio: EnvioPush, payload: dict = Depends(_puede_enviar)):
    """Manda el aviso al grupo elegido y guarda el envio en el historial."""
    from server import db as database

    titulo = (envio.title or "").strip()
    cuerpo = (envio.body or "").strip()
    if not titulo or not cuerpo:
        raise HTTPException(status_code=400, detail="El aviso necesita titulo y mensaje")

    if not push_service.esta_configurado():
        raise HTTPException(
            status_code=503,
            detail="Las notificaciones push no estan configuradas (falta FCM_SERVICE_ACCOUNT_JSON)",
        )

    dispositivos = await _dispositivos_de(database, envio)
    tokens = list({d["token"] for d in dispositivos if d.get("token")})
    if not tokens:
        raise HTTPException(
            status_code=400,
            detail="Ese grupo no tiene ningun telefono con la app instalada y los avisos activados",
        )

    resultado = await _enviar_y_limpiar(
        database, tokens, titulo, cuerpo, {"tipo": "mensaje"}
    )

    await database.push_history.insert_one({
        "title": titulo,
        "body": cuerpo,
        "audiencia": envio.audiencia,
        "filtro": envio.model_dump(exclude={"title", "body"}),
        "dispositivos": len(tokens),
        "enviados": resultado["enviados"],
        "fallidos": resultado["fallidos"],
        "enviado_por": payload.get("username"),
        "created_at": _ahora(),
    })

    return {
        "success": True,
        "dispositivos": len(tokens),
        "enviados": resultado["enviados"],
        "fallidos": resultado["fallidos"],
    }


@router.get("/historial")
async def historial_envios(limit: int = 30, _=Depends(_puede_enviar)):
    """Ultimos avisos enviados a mano, para saber que se dijo y a quien."""
    from server import db as database

    envios = await database.push_history.find({}, {"_id": 0}).sort("created_at", -1).to_list(min(limit, 100))
    return {"envios": envios}
