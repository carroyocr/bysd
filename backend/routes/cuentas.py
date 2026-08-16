"""Cuentas de espectador: la puerta por la que se empieza a saber quien anima.

De las 696 personas que han escrito alguno de los 1.625 mensajes de animo que hay
en la base no se conserva mas que un nombre suelto escrito a mano. No hay forma
de avisar a ninguna cuando empieza la carrera que vino a ver, ni de reconocerla
si vuelve al ano siguiente, ni de saber si dos mensajes son de la misma persona.
Lo que sigue a quien anima —a que corredores mira, que mensajes le gustaron, con
que nombre firma— vive hoy en el `localStorage` de su telefono y se pierde en
cuanto lo cambia.

Este router es aditivo: no toca ninguna ruta existente. Ver la carrera sigue sin
pedir nada, que es como lo hace la mayoria; la cuenta se pide en el momento de
hacer algo que deja rastro —animar, seguir a alguien— y no en la puerta. El
correo de quien quiere que le avisen cuando su hermano cierre la vuelta 30 es un
correo bueno; el de quien lo escribe para quitarse de encima una pantalla que le
estorba, no.

El alta no espera a la verificacion: se crea la cuenta y se anima en el mismo
gesto, y el codigo llega por correo detras. Solo las cuentas verificadas entran
en los envios, de modo que lo que no se confirme queda marcado y aparte en vez de
ensuciar las listas.

Ver PLAN_CUENTA_UNICA.md, fase 2.
"""
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field

from services import cuentas, rate_limit
from services.auth import require_cuenta, require_permission

logger = logging.getLogger(__name__)

# `/api/cuenta` (singular) ya lo ocupa el cambio de contrasena del panel, en
# routes/users.py. Este va en plural para no pisarlo.
router = APIRouter(prefix="/api/cuentas", tags=["cuentas"])

CODIGO_VALIDO_MINUTOS = 30
MAX_INTENTOS_CODIGO = 5

# Tope de dorsales que se pueden subir del telefono de una vez. El mismo que usa
# el registro de push: es la lista de a quien sigue una persona, no un almacen.
MAX_SEGUIDOS = 200


# ==================== Entradas ====================


class Registro(BaseModel):
    email: EmailStr
    nombre: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=cuentas.MIN_PASSWORD, max_length=200)
    acepta_comunicaciones: bool = False


class Acceso(BaseModel):
    email: EmailStr
    password: str


class Codigo(BaseModel):
    email: EmailStr
    code: str


class SoloCorreo(BaseModel):
    email: EmailStr


class NuevaPassword(BaseModel):
    email: EmailStr
    code: str
    password: str = Field(min_length=cuentas.MIN_PASSWORD, max_length=200)


class Perfil(BaseModel):
    nombre: Optional[str] = Field(default=None, max_length=80)
    apellidos: Optional[str] = Field(default=None, max_length=80)
    pais: Optional[str] = Field(default=None, max_length=60)
    relacion: Optional[str] = Field(default=None, max_length=30)
    acepta_comunicaciones: Optional[bool] = None


class EstadoLocal(BaseModel):
    """Lo que la app traia guardado en el telefono antes de haber cuenta."""
    followed: List[str] = Field(default_factory=list)
    fan_name: Optional[str] = None


# ==================== Ayudas ====================


def _codigo() -> str:
    """Seis digitos con `secrets`, no con `random`.

    El generador de `random` es un Mersenne Twister, predecible a partir de sus
    salidas anteriores, y estos codigos restablecen contrasenas.
    """
    return "".join(str(secrets.randbelow(10)) for _ in range(6))


async def _mandar_codigo(db, cuenta: dict, proposito: str) -> None:
    """Genera el codigo, lo guarda en la cuenta y lo manda por correo.

    Se traga sus errores: que el correo no salga no puede tumbar un registro que
    por lo demas fue bien. Quien no lo reciba puede pedir otro.
    """
    codigo = _codigo()
    campo = "verification_code" if proposito == "verificar" else "reset_code"

    await db[cuentas.COLECCION].update_one(
        {"_id": cuenta["_id"]},
        {"$set": {
            campo: codigo,
            f"{campo}_expires": datetime.now(timezone.utc) + timedelta(minutes=CODIGO_VALIDO_MINUTOS),
            f"{campo}_attempts": 0,
        }},
    )

    try:
        from services.template_email_service import build_race_data, send_email_with_template

        carrera = await db.race_configurations.find_one({"is_active": True})
        await send_email_with_template(
            db,
            "email_verification",
            cuenta["email"],
            {
                **(build_race_data(carrera) if carrera else {"race_name": "Backyard Ultra Santo Domingo"}),
                "nombre": cuenta.get("nombre") or "",
                "verification_code": codigo,
                "expires_minutes": str(CODIGO_VALIDO_MINUTOS),
            },
        )
    except Exception as e:
        logger.error("No se pudo enviar el codigo a %s: %s", cuenta["email"], e)


async def _comprobar_codigo(db, cuenta: dict, code: str, proposito: str) -> None:
    """Valida el codigo o levanta el error que toque.

    Seis digitos son un millon de combinaciones: sin limite de intentos se agotan
    en minutos. Al quinto fallo el codigo se anula y hay que pedir otro.
    """
    campo = "verification_code" if proposito == "verificar" else "reset_code"
    guardado = cuenta.get(campo)
    caduca = cuenta.get(f"{campo}_expires")

    if not guardado:
        raise HTTPException(status_code=400, detail="Pide un codigo nuevo")

    if caduca and caduca.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="El codigo caduco. Pide uno nuevo.")

    if not secrets.compare_digest(str(guardado), (code or "").strip()):
        intentos = (cuenta.get(f"{campo}_attempts") or 0) + 1
        if intentos >= MAX_INTENTOS_CODIGO:
            await db[cuentas.COLECCION].update_one(
                {"_id": cuenta["_id"]},
                {"$set": {campo: None, f"{campo}_attempts": 0}},
            )
            raise HTTPException(status_code=429, detail="Demasiados intentos. Pide un codigo nuevo.")

        await db[cuentas.COLECCION].update_one(
            {"_id": cuenta["_id"]}, {"$set": {f"{campo}_attempts": intentos}}
        )
        raise HTTPException(status_code=400, detail="Codigo incorrecto")


def _sesion(cuenta: dict) -> dict:
    return {"token": cuentas.emitir_token(cuenta), "cuenta": cuentas.publica(cuenta)}


# ==================== Alta y acceso ====================


@router.post("/registro")
async def registro(datos: Registro, request: Request = None):
    """Crea la cuenta de espectador y devuelve la sesion en el acto.

    **No se manda codigo de verificacion.** Ser espectador no da acceso a nada
    que no sea ya publico: se anima, se sigue a un corredor y se reciben avisos.
    Pedir que confirme el correo para eso es un tramite sin nada detras, y cada
    tramite cuesta altas.

    La verificacion se exige cuando la cuenta pasa a tener consecuencias —al
    ganar el rol de corredor o de equipo, donde hay inscripciones, pagos, fichas
    medicas y turnos— y no antes. Para eso siguen vivos `/verificar` y
    `/reenviar-codigo`.

    Que un correo sea falso no rompe nada: esa cuenta simplemente nunca recibira
    lo que se le mande. Lo que decide a quien se escribe es el consentimiento.
    """
    from server import db

    # Antes esto usaba `limitar_envio_codigo` (5 cada 15 min) porque el alta
    # mandaba un correo. Ya no lo manda, y ese limite era demasiado estrecho
    # para lo que ahora es: varias personas apuntandose desde la misma red —el
    # wifi del evento, una casa— chocarian entre ellas. El tope de aqui deja
    # pasar un grupo real y sigue cortando el alta masiva por script.
    rate_limit.comprobar(
        "registro-cuenta",
        rate_limit.ip_cliente(request),
        limite=20,
        ventana_segundos=900,
        mensaje="Demasiadas cuentas creadas desde aqui. Espera unos minutos.",
    )

    if await cuentas.por_email(db, datos.email):
        raise HTTPException(
            status_code=409,
            detail="Ese correo ya tiene cuenta. Entra con tu contrasena.",
        )

    cuenta = await cuentas.crear(
        db,
        email=datos.email,
        password=datos.password,
        nombre=datos.nombre,
        acepta_comunicaciones=datos.acepta_comunicaciones,
    )

    return _sesion(cuenta)


@router.post("/login")
async def login(datos: Acceso, request: Request = None):
    from server import db

    ip = rate_limit.limitar_login(request, datos.email.lower())

    cuenta = await cuentas.autenticar(db, datos.email, datos.password)
    if not cuenta:
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")

    rate_limit.olvidar("login", ip)
    return _sesion(cuenta)


@router.post("/verificar")
async def verificar(datos: Codigo, request: Request = None):
    from server import db

    rate_limit.limitar_verificacion(request)

    cuenta = await cuentas.por_email(db, datos.email)
    if not cuenta:
        raise HTTPException(status_code=404, detail="No hay cuenta con ese correo")

    if cuenta.get("email_verified"):
        return _sesion(cuenta)

    await _comprobar_codigo(db, cuenta, datos.code, "verificar")

    await db[cuentas.COLECCION].update_one(
        {"_id": cuenta["_id"]},
        {"$set": {"email_verified": True, "verification_code": None,
                  "updated_at": datetime.now(timezone.utc)}},
    )
    cuenta["email_verified"] = True
    return _sesion(cuenta)


@router.post("/reenviar-codigo")
async def reenviar(datos: SoloCorreo, request: Request = None):
    from server import db

    rate_limit.limitar_envio_codigo(request)

    cuenta = await cuentas.por_email(db, datos.email)
    if cuenta and not cuenta.get("email_verified"):
        await _mandar_codigo(db, cuenta, "verificar")

    # Misma respuesta exista o no: si no, esto diria quien tiene cuenta.
    return {"message": "Si ese correo tiene cuenta sin verificar, te enviamos un codigo."}


@router.post("/recuperar")
async def recuperar(datos: SoloCorreo, request: Request = None):
    from server import db

    rate_limit.limitar_envio_codigo(request)

    cuenta = await cuentas.por_email(db, datos.email)
    if cuenta:
        await _mandar_codigo(db, cuenta, "reset")

    return {"message": "Si ese correo tiene cuenta, te enviamos un codigo."}


@router.post("/nueva-password")
async def nueva_password(datos: NuevaPassword, request: Request = None):
    from server import db

    rate_limit.limitar_verificacion(request)

    cuenta = await cuentas.por_email(db, datos.email)
    if not cuenta:
        raise HTTPException(status_code=404, detail="No hay cuenta con ese correo")

    await _comprobar_codigo(db, cuenta, datos.code, "reset")

    await db[cuentas.COLECCION].update_one(
        {"_id": cuenta["_id"]},
        {"$set": {
            "password_hash": cuentas.hash_password(datos.password),
            "reset_code": None,
            # Quien prueba el correo con un codigo lo ha demostrado igual que
            # verificandolo: no tiene sentido pedirselo otra vez.
            "email_verified": True,
            "updated_at": datetime.now(timezone.utc),
        }},
    )
    cuenta["email_verified"] = True
    return _sesion(cuenta)


# ==================== Perfil ====================


@router.get("/perfil")
async def ver_perfil(payload: dict = Depends(require_cuenta)):
    from server import db

    cuenta = await cuentas.por_id(db, payload.get("sub"))
    if not cuenta:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")

    return {
        **cuentas.publica(cuenta),
        "pais": cuenta.get("pais"),
        "relacion": cuenta.get("relacion"),
        "followed": cuenta.get("followed") or [],
    }


@router.put("/perfil")
async def editar_perfil(datos: Perfil, payload: dict = Depends(require_cuenta)):
    from server import db

    cuenta = await cuentas.por_id(db, payload.get("sub"))
    if not cuenta:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")

    cambios = {k: v for k, v in datos.model_dump(exclude_none=True).items()}
    if cambios:
        cambios["updated_at"] = datetime.now(timezone.utc)
        await db[cuentas.COLECCION].update_one({"_id": cuenta["_id"]}, {"$set": cambios})

    return {**cuentas.publica({**cuenta, **cambios})}


@router.post("/importar-local")
async def importar_local(datos: EstadoLocal, payload: dict = Depends(require_cuenta)):
    """Sube a la cuenta lo que el telefono llevaba guardado sin ella.

    Quien lleva meses siguiendo a diez corredores desde la app no tiene por que
    perderlos por darse de alta. Se hace en el primer acceso y es idempotente:
    los dorsales se unen sin repetir.
    """
    from server import db

    cuenta = await cuentas.por_id(db, payload.get("sub"))
    if not cuenta:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")

    seguidos = [str(b).strip() for b in datos.followed if str(b).strip()]
    seguidos = list(dict.fromkeys(seguidos))[:MAX_SEGUIDOS]

    cambios = {"updated_at": datetime.now(timezone.utc)}
    # El nombre con el que ya venia firmando solo se toma si no puso otro.
    if datos.fan_name and not (cuenta.get("nombre") or "").strip():
        cambios["nombre"] = datos.fan_name.strip()[:80]

    await db[cuentas.COLECCION].update_one(
        {"_id": cuenta["_id"]},
        {"$addToSet": {"followed": {"$each": seguidos}}, "$set": cambios},
    )

    actualizada = await cuentas.por_id(db, cuenta["_id"])
    return {"success": True, "followed": actualizada.get("followed") or []}


@router.delete("/perfil")
async def borrar_cuenta(payload: dict = Depends(require_cuenta)):
    """Borra la cuenta del espectador.

    Solo se deja borrar la cuenta que es *solo* de espectador. Si lleva rol de
    corredor o de equipo, detras hay inscripciones, vueltas y turnos que no se
    pueden quedar sin dueno desde un boton de la app: eso lo lleva la
    organizacion a mano.

    Los animos que haya escrito se quedan, pero pierden el vinculo con la cuenta:
    son parte del hilo publico de la carrera, y borrarlos dejaria huecos en
    conversaciones de otras personas.
    """
    from server import db

    cuenta = await cuentas.por_id(db, payload.get("sub"))
    if not cuenta:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")

    roles = set(cuenta.get("roles") or [])
    if roles - {cuentas.FAN}:
        raise HTTPException(
            status_code=409,
            detail="Esta cuenta tiene perfil de corredor o de equipo. Escribe a la organizacion para darla de baja.",
        )

    await db.cheer_messages.update_many(
        {"account_id": cuenta["_id"]}, {"$unset": {"account_id": ""}}
    )
    await db.push_devices.update_many(
        {"account_id": cuenta["_id"]}, {"$unset": {"account_id": ""}}
    )
    await db[cuentas.COLECCION].delete_one({"_id": cuenta["_id"]})

    return {"success": True}


# ==================== Panel ====================


@router.get("/admin/espectadores", dependencies=[Depends(require_permission("emails"))])
async def listado_espectadores(limit: int = 200, solo_escribibles: bool = False):
    """Quien sigue la carrera sin correr ni trabajar en ella.

    Va con el permiso de comunicaciones porque para lo que sirve esta lista es
    para escribirles. Y lo que decide a quien se puede escribir es **solo el
    consentimiento**: el espectador no verifica su correo, asi que exigir
    `email_verified` dejaria la lista vacia para siempre sin que nada fallara a
    la vista.
    """
    from server import db

    solo_fan = {"roles": [cuentas.FAN]}

    total = await db[cuentas.COLECCION].count_documents(solo_fan)
    escribibles = await db[cuentas.COLECCION].count_documents(
        {**solo_fan, "acepta_comunicaciones": True}
    )

    filtro = dict(solo_fan)
    if solo_escribibles:
        filtro["acepta_comunicaciones"] = True

    docs = await db[cuentas.COLECCION].find(
        filtro,
        {"password_hash": 0, "verification_code": 0, "reset_code": 0},
    ).sort("created_at", -1).to_list(min(limit, 1000))

    return {
        "total": total,
        "escribibles": escribibles,
        "espectadores": [
            {
                **cuentas.publica(d),
                "pais": d.get("pais"),
                "relacion": d.get("relacion"),
                "sigue_a": len(d.get("followed") or []),
                "created_at": d.get("created_at"),
                "last_login_at": d.get("last_login_at"),
            }
            for d in docs
        ],
    }
