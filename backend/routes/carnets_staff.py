"""Carnets del staff: el suyo para cada voluntario y la tanda para imprimir.

El carnet sale del registro de voluntario (`volunteer_registrations`): uno por
persona y por evento, porque el mismo voluntario puede trabajar en la carrera
y en el campeonato y cada uno lleva su nombre de evento. El puesto es el que
mas se repite entre sus turnos asignados; mientras no tenga, dice Voluntario.

El QR del reverso lleva a una pagina publica del sitio que confirma que el
carnet es bueno. Va con un codigo al azar guardado en el registro
(`carnet_codigo`), no con el correo ni con un numero correlativo: asi nadie
puede ir probando numeros para sacar la lista del staff. Esa pagina solo dice
nombre, puesto y evento; los datos medicos se quedan en el carnet impreso.
"""
import logging
import secrets
from collections import Counter
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse

from services import carnet_staff, marca, rate_limit, races
from services.auth import require_admin, require_permission
from services.env_utils import get_env

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/staff", tags=["staff"])

SITIO = (get_env("FRONTEND_URL", "https://backyardultrasantodomingo.com") or "").rstrip("/")

# Sin 0/O, 1/I/L: el codigo tambien va impreso y alguien puede teclearlo
ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
LARGO_CODIGO = 8

ACTIVO = {"status": {"$ne": "cancelled"}}


def _numero(codigo: str) -> str:
    return f"STF-{codigo[:4]}-{codigo[4:]}"


async def _codigo_de(db, registro: dict) -> str:
    """El codigo del carnet de ese registro; lo crea la primera vez."""
    if registro.get("carnet_codigo"):
        return registro["carnet_codigo"]

    while True:
        codigo = "".join(secrets.choice(ALFABETO) for _ in range(LARGO_CODIGO))
        if not await db.volunteer_registrations.find_one({"carnet_codigo": codigo}, {"_id": 1}):
            break

    # Si dos descargas llegan a la vez, gana la primera y la otra lo relee
    await db.volunteer_registrations.update_one(
        {"_id": registro["_id"], "carnet_codigo": {"$exists": False}},
        {"$set": {"carnet_codigo": codigo}},
    )
    guardado = await db.volunteer_registrations.find_one({"_id": registro["_id"]}, {"carnet_codigo": 1})
    return (guardado or {}).get("carnet_codigo") or codigo


async def _puesto(db, email: str, race_code: Optional[str], evento: str) -> str:
    from routes.volunteer_registration import evento_query

    filtro = {"email_asignado": email, **evento_query(evento)}
    if race_code:
        filtro["race_code"] = race_code
    turnos = await db.volunteer_assignments.find(filtro, {"_id": 0, "puesto": 1}).to_list(200)
    puestos = Counter(t["puesto"] for t in turnos if t.get("puesto"))
    return puestos.most_common(1)[0][0] if puestos else "Voluntario"


async def _nombre_del_evento(db, race_code: Optional[str], evento: str, cache: dict) -> str:
    from routes.volunteer_registration import nombre_evento

    if race_code not in cache:
        cache[race_code] = await db.race_configurations.find_one({"code": race_code}) if race_code else None
    return nombre_evento(cache[race_code], evento)


def _uno_por_evento(registros: list) -> list:
    """El registro mas reciente de cada persona en cada evento.

    Llegan ordenados del mas nuevo al mas viejo; hay quien se registro dos
    veces y no se le van a imprimir dos carnets.
    """
    vistos = set()
    unicos = []
    for r in registros:
        llave = ((r.get("email") or "").lower(), r.get("evento") or "carrera")
        if llave not in vistos:
            vistos.add(llave)
            unicos.append(r)
    return unicos


async def _armar_carnets(db, registros: list) -> list:
    cache = {}
    marcas = {}
    carnets = []
    for r in registros:
        evento = r.get("evento") or "carrera"
        email = (r.get("email") or "").lower()
        codigo = await _codigo_de(db, r)
        # La marca que presenta esa edicion. Se lee una vez por carrera: el
        # logo son 60 KB y una tanda son doscientos carnets.
        race_code = r.get("race_code")
        if race_code not in marcas:
            marcas[race_code] = marca.logo_impreso(race_code)
        carnets.append({
            "nombre": (r.get("nombre") or "").strip(),
            "apellidos": (r.get("apellidos") or "").strip(),
            "puesto": await _puesto(db, email, r.get("race_code"), evento),
            "evento": await _nombre_del_evento(db, r.get("race_code"), evento, cache),
            "tipo_sangre": r.get("tipo_sangre"),
            "contacto_nombre": r.get("contacto_emergencia_nombre"),
            "contacto_relacion": r.get("contacto_emergencia_relacion"),
            "contacto_telefono": r.get("contacto_emergencia_telefono"),
            "numero": _numero(codigo),
            "url_verificacion": f"{SITIO}/staff/verificar/{codigo}",
            "presenting_logo": marcas[race_code],
            "presenting_etiqueta": marca.ETIQUETA if marcas[race_code] else "",
        })
    return carnets


def _pdf(carnets: list, nombre_archivo: str, titulo: str) -> StreamingResponse:
    return StreamingResponse(
        carnet_staff.construir_pdf(carnets, titulo),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{nombre_archivo}"'},
    )


# ==================== EL SUYO ====================


@router.get("/mi-perfil/carnet")
async def mi_carnet(payload: dict = Depends(require_admin)):
    """El carnet de quien lo pide, uno por cada evento en que trabaja.

    Solo los de su edicion mas reciente: si ya fue voluntario el ano pasado,
    ese carnet no le sirve de nada.
    """
    from server import db

    email = (payload.get("username") or "").lower()
    registros = await db.volunteer_registrations.find(
        {"email": email, **ACTIVO}
    ).sort("created_at", -1).to_list(20)
    if not registros:
        raise HTTPException(status_code=404, detail="No tienes un registro de staff")

    edicion = registros[0].get("race_code")
    registros = [r for r in _uno_por_evento(registros) if r.get("race_code") == edicion]

    carnets = await _armar_carnets(db, registros)
    return _pdf(carnets, "carnet-staff.pdf", "Carnet de staff")


# ==================== LA TANDA DEL PANEL ====================


@router.get("/carnets", dependencies=[Depends(require_permission("volunteers"))])
async def carnets_para_imprimir(
    race_code: str = Depends(races.carrera_del_panel),
    email: Optional[str] = None,
    evento: Optional[str] = None,
):
    """Los carnets de la carrera, cuatro por hoja, o solo el de una persona."""
    from server import db
    from routes.volunteer_registration import VALID_EVENTOS, evento_query

    filtro = {"race_code": race_code, **ACTIVO}
    if email:
        filtro["email"] = email.strip().lower()
    if evento in VALID_EVENTOS:
        filtro.update(evento_query(evento))

    registros = await db.volunteer_registrations.find(filtro).sort("created_at", -1).to_list(2000)
    if email and not registros:
        raise HTTPException(status_code=404, detail="Ese voluntario no tiene registro en esta carrera")

    registros = _uno_por_evento(registros)
    registros.sort(key=lambda r: f"{r.get('nombre', '')} {r.get('apellidos', '')}".strip().lower())

    carnets = await _armar_carnets(db, registros)
    sufijo = email.split("@")[0] if email else (evento or "todos")
    return _pdf(carnets, f"carnets-staff-{race_code}-{sufijo}.pdf", "Carnets de staff")


# ==================== VERIFICACION DEL QR ====================


@router.get("/carnet/verificar/{codigo}")
async def verificar_carnet(codigo: str, request: Request = None):
    """Lo que ve quien escanea el QR del carnet: si es bueno, y de quien."""
    from server import db

    rate_limit.comprobar(
        "verificar_carnet",
        rate_limit.ip_cliente(request),
        limite=60,
        ventana_segundos=300,
        mensaje="Demasiadas consultas. Espera un momento.",
    )

    codigo = (codigo or "").strip().upper().replace("-", "")
    if codigo.startswith("STF"):
        codigo = codigo[3:]
    if len(codigo) != LARGO_CODIGO:
        raise HTTPException(status_code=404, detail="Carnet no encontrado")

    registro = await db.volunteer_registrations.find_one({"carnet_codigo": codigo})
    if not registro:
        raise HTTPException(status_code=404, detail="Carnet no encontrado")

    evento = registro.get("evento") or "carrera"
    return {
        "valido": registro.get("status") != "cancelled",
        "nombre": f"{registro.get('nombre', '')} {registro.get('apellidos', '')}".strip(),
        "puesto": await _puesto(db, (registro.get("email") or "").lower(), registro.get("race_code"), evento),
        "evento": await _nombre_del_evento(db, registro.get("race_code"), evento, {}),
        "numero": _numero(codigo),
    }
