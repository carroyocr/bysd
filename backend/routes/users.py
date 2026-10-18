"""
User Management for Admin Panel
Handles user creation, permissions, and authentication
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import bcrypt

from services import cuentas, rate_limit
from services.auth import require_admin, require_permission

# Desde la cuenta unica, el acceso lee de `accounts`: los permisos, la
# contrasena y el propio rol de equipo salen de ahi. `admin_users` sigue viva
# hasta que se retire, pero lo que se cambie solo en ella no llega a ningun
# acceso de quien ya tiene cuenta. Por eso cada escritura de este fichero va a
# las dos, y la lista sale de las dos.

# La gestion de usuarios es la operacion mas sensible del panel: crear un
# usuario aqui equivale a repartir acceso al resto. Se exige el permiso
# "users", no solo un token valido.
solo_usuarios = Depends(require_permission("users"))

router = APIRouter(prefix="/api/users", tags=["users"], dependencies=[solo_usuarios])

# Cambiar la propia contrasena no es "gestionar usuarios": lo tiene que poder
# hacer cualquiera que entre al panel, con su propia sesion. Por eso va en un
# router aparte, sin el permiso "users".
cuenta_router = APIRouter(prefix="/api/cuenta", tags=["cuenta"])


class CambioPasswordRequest(BaseModel):
    password_actual: str
    password_nueva: str


MIN_PASSWORD = 12


@cuenta_router.post("/cambiar-password")
async def cambiar_password(
    datos: CambioPasswordRequest,
    request: Request = None,
    usuario=Depends(require_admin),
):
    """Cambia la contrasena del usuario que hace la peticion.

    Antes no habia forma de hacerlo desde el panel: cambiar la contrasena de
    'admin' obligaba a escribir el hash a mano en la base de datos.
    """
    from server import db

    rate_limit.limitar_login(request, usuario.get("username", ""))

    username = (usuario.get("username") or "").lower()
    cuenta = await cuentas.del_equipo(db, username)
    registro = await db.admin_users.find_one(
        {"username": (cuenta or {}).get("staff_username") or username}
    )
    if not cuenta and not registro:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    # La contrasena que vale es la de la cuenta, que es con la que se entra.
    actual = cuenta["password_hash"] if cuenta else registro["password"]

    if not cuentas.verificar_password(datos.password_actual, actual):
        raise HTTPException(status_code=400, detail="La contraseña actual es incorrecta")

    if len(datos.password_nueva) < MIN_PASSWORD:
        raise HTTPException(
            status_code=400,
            detail=f"La contraseña nueva debe tener al menos {MIN_PASSWORD} caracteres",
        )

    if cuentas.verificar_password(datos.password_nueva, actual):
        raise HTTPException(status_code=400, detail="La contraseña nueva debe ser distinta de la actual")

    hashed = cuentas.hash_password(datos.password_nueva)
    ahora = datetime.now(timezone.utc)
    if cuenta:
        await db[cuentas.COLECCION].update_one(
            {"_id": cuenta["_id"]}, {"$set": {"password_hash": hashed, "updated_at": ahora}}
        )
        # El perfil de corredor guarda su copia y hay endpoints que la miran.
        if cuenta.get("athlete_profile_id"):
            await db.athletes.update_one(
                {"_id": cuenta["athlete_profile_id"]},
                {"$set": {"password_hash": hashed, "updated_at": ahora}},
            )
    if registro:
        await db.admin_users.update_one(
            {"_id": registro["_id"]}, {"$set": {"password": hashed, "updated_at": ahora}}
        )

    return {"message": "Contraseña actualizada. Vuelve a iniciar sesión."}


async def _cuenta_del_equipo(db, username: str) -> Optional[dict]:
    """La cuenta con rol de equipo que corresponde a un usuario de la lista.

    Se busca por el usuario y, si no, por el correo de su fila de `admin_users`:
    los usuarios cortos de antes ("geizel26") tienen la cuenta a su correo.
    """
    username = (username or "").strip().lower()
    cuenta = await cuentas.del_equipo(db, username)
    if not cuenta:
        fila = await db.admin_users.find_one({"username": username}, {"email": 1})
        if fila and fila.get("email"):
            cuenta = await cuentas.por_email(db, fila["email"])
    if cuenta and cuentas.STAFF not in (cuenta.get("roles") or []):
        return None
    return cuenta


class UserCreate(BaseModel):
    username: str
    password: str
    nombre: Optional[str] = None
    email: Optional[str] = None
    permissions: List[str] = []


class UserUpdate(BaseModel):
    nombre: Optional[str] = None
    email: Optional[str] = None


class PermissionsUpdate(BaseModel):
    permissions: List[str]


class UserResponse(BaseModel):
    username: str
    nombre: Optional[str] = None
    email: Optional[str] = None
    permissions: List[str] = []
    is_admin: bool = False
    created_at: Optional[datetime] = None
    # Cuenta de staff creada en la app que aun no ha confirmado su correo: no se
    # sabe si quien la abrio es la persona cuyo correo lleva. No admite permisos.
    correo_sin_verificar: bool = False
    # Los que le llegan por sus turnos asignados (hoy `scanner`, por Control de
    # Vueltas o Corral de salida), sin que nadie se los marque. No se guardan
    # ni se editan aqui: salen del turno. Ver `cuentas.permisos_del_turno`.
    permisos_del_turno: List[str] = []


@router.get("")
async def get_users():
    """Get all users"""
    from server import db
    
    users = await db.admin_users.find(
        {},
        {"_id": 0, "password": 0}  # Exclude password
    ).to_list(1000)

    # Las cuentas del equipo. Los permisos que se ensenan son los de la cuenta,
    # que son los que valen al entrar; y quien tiene el rol sin fila en
    # `admin_users` —el staff que se dio de alta en la app, el corredor que
    # ademas es voluntario— sale tambien, o no habria forma de darle permisos.
    del_equipo = await db[cuentas.COLECCION].find(
        {"roles": cuentas.STAFF},
        {"email": 1, "staff_username": 1, "nombre": 1, "apellidos": 1,
         "permissions": 1, "is_admin": 1, "created_at": 1, "email_verified": 1},
    ).to_list(2000)
    por_usuario = {}
    for c in del_equipo:
        por_usuario[c.get("email")] = c
        if c.get("staff_username"):
            por_usuario[c["staff_username"]] = c

    con_escaner = await _correos_con_escaner_por_turno(db)

    result = []
    vistas = set()
    for user in users:
        cuenta = por_usuario.get(user.get("username")) or por_usuario.get((user.get("email") or "").lower())
        if cuenta:
            vistas.add(cuenta["_id"])
        # La cuenta sin demostrar que coincide por correo no es todavia la de
        # esta fila: los permisos que valen son los de la fila.
        sin_demostrar = cuenta is not None and not cuentas.demostrada(cuenta)
        if sin_demostrar:
            cuenta = None
        # Sin cuenta, al entrar se le hace una demostrada (`adoptar_del_panel`),
        # asi que el turno le vale igual; con una sin demostrar, no.
        correo = (cuenta or {}).get("email") or (user.get("email") or "").lower() or user.get("username")
        result.append(UserResponse(
            username=user.get("username"),
            nombre=user.get("nombre"),
            email=user.get("email"),
            permissions=(cuenta or user).get("permissions") or [],
            is_admin=user.get("username") == "admin",
            created_at=user.get("created_at"),
            permisos_del_turno=["scanner"] if correo in con_escaner and not sin_demostrar else [],
        ))

    for c in del_equipo:
        if c["_id"] in vistas:
            continue
        demostrada = cuentas.demostrada(c)
        result.append(UserResponse(
            username=c.get("staff_username") or c.get("email"),
            nombre=f"{c.get('nombre') or ''} {c.get('apellidos') or ''}".strip() or None,
            email=c.get("email") if "@" in (c.get("email") or "") else None,
            permissions=c.get("permissions") or [],
            is_admin=bool(c.get("is_admin")),
            created_at=c.get("created_at"),
            correo_sin_verificar=not demostrada,
            permisos_del_turno=["scanner"] if demostrada and c.get("email") in con_escaner else [],
        ))

    return result


async def _correos_con_escaner_por_turno(db) -> set:
    """Los correos con un turno asignado en un puesto que da el escaner."""
    puestos = [p for p in await db.volunteer_assignments.distinct("puesto") if cuentas.da_escaner(p)]
    if not puestos:
        return set()
    correos = await db.volunteer_assignments.distinct(
        "email_asignado", {"puesto": {"$in": puestos}, "email_asignado": {"$nin": [None, ""]}}
    )
    return {str(c).strip().lower() for c in correos}


@router.post("")
async def create_user(user: UserCreate):
    """Create a new user"""
    from server import db
    
    # Check if username already exists
    existing = await db.admin_users.find_one({"username": user.username.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="El usuario ya existe")
    
    # Validate password length
    if len(user.password) < 6:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 6 caracteres")
    
    # Validate email is provided for sending credentials
    if not user.email:
        raise HTTPException(status_code=400, detail="El email es requerido para enviar las credenciales")
    
    # Hash password
    hashed_password = bcrypt.hashpw(user.password.encode('utf-8'), bcrypt.gensalt())
    
    # Store plain password temporarily for email
    plain_password = user.password
    
    # Create user document
    user_doc = {
        "username": user.username.lower(),
        "password": hashed_password.decode('utf-8'),
        "nombre": user.nombre,
        "email": user.email,
        "permissions": user.permissions,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.admin_users.insert_one(user_doc)
    
    # Send email with credentials using template system
    try:
        from services.template_email_service import (
            send_email_with_template, build_race_data, build_general_data
        )
        
        # Get active race config
        race_config = await db.race_configurations.find_one({"is_active": True})
        
        merge_data = {
            **build_race_data(race_config),
            **build_general_data(username=user.username.lower(), password=plain_password),
        }
        
        await send_email_with_template(
            db=db,
            template_id="admin_credentials",
            to_email=user.email,
            data=merge_data
        )
        
    except Exception as e:
        print(f"Error sending credentials email: {e}")
        # Don't fail user creation if email fails
    
    return {"message": "Usuario creado exitosamente. Se han enviado las credenciales por correo.", "username": user.username}


@router.put("/{username}/permissions")
async def update_permissions(username: str, update: PermissionsUpdate):
    """Update user permissions"""
    from server import db
    
    # Don't allow modifying admin user
    if username.lower() == "admin":
        raise HTTPException(status_code=400, detail="No se pueden modificar los permisos del administrador principal")
    
    # Una cuenta de staff la crea cualquiera desde la app con el correo que
    # quiera, y sale en esta lista con ese correo. Si se le pudieran dar permisos
    # antes de que lo confirme, abrir una con el correo de un voluntario y
    # esperar a que la organizacion le marque el escaner seria la forma de leer
    # todas las fichas medicas. Hasta entonces solo se le pueden quitar.
    cuenta = await _cuenta_del_equipo(db, username)
    if cuenta and not cuentas.demostrada(cuenta):
        tiene_fila = await db.admin_users.find_one({"username": username.lower()}, {"_id": 1})
        if not tiene_fila and update.permissions:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Esta cuenta aun no ha confirmado su correo. Pidele que lo confirme "
                    "(le llego un codigo, o puede usar \"Soy voluntario y no tengo "
                    "contraseña\" en la app) y vuelve a intentarlo."
                ),
            )
        if tiene_fila:
            # Hay un usuario del panel con ese nombre: los permisos son suyos y
            # van a su fila. La cuenta sin confirmar que coincide por correo no
            # los hereda.
            cuenta = None

    cambios = {"permissions": update.permissions, "updated_at": datetime.now(timezone.utc)}
    result = await db.admin_users.update_one({"username": username.lower()}, {"$set": cambios})

    # Y en la cuenta, que es de donde los lee el acceso. Sin esto el panel dice
    # "permisos actualizados" y la persona sigue entrando con los de antes.
    if cuenta:
        await db[cuentas.COLECCION].update_one({"_id": cuenta["_id"]}, {"$set": cambios})

    if result.matched_count == 0 and not cuenta:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    return {"message": "Permisos actualizados"}


@router.delete("/{username}")
async def delete_user(username: str):
    """Delete a user"""
    from server import db
    
    # Don't allow deleting admin user
    if username.lower() == "admin":
        raise HTTPException(status_code=400, detail="No se puede eliminar el administrador principal")
    
    # Antes de borrar la fila: la cuenta puede estar atada a ella por el correo.
    cuenta = await _cuenta_del_equipo(db, username)
    if cuenta and cuenta.get("is_admin"):
        raise HTTPException(status_code=400, detail="No se puede eliminar el administrador principal")

    result = await db.admin_users.delete_one({"username": username.lower()})

    # La cuenta no se borra —puede ser tambien la de un corredor—: pierde el
    # rol de equipo y los permisos, que es lo que este boton quita. Sin esto,
    # el usuario "eliminado" seguia entrando al panel con su cuenta.
    if cuenta:
        await db[cuentas.COLECCION].update_one(
            {"_id": cuenta["_id"]},
            {"$pull": {"roles": cuentas.STAFF},
             "$set": {"permissions": [], "updated_at": datetime.now(timezone.utc)}},
        )

    if result.deleted_count == 0 and not cuenta:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    return {"message": "Usuario eliminado"}


@router.put("/{username}")
async def update_user(username: str, update: UserUpdate):
    """Update user info (name, email)"""
    from server import db
    
    update_data = {"updated_at": datetime.now(timezone.utc)}
    
    if update.nombre is not None:
        update_data["nombre"] = update.nombre
    if update.email is not None:
        update_data["email"] = update.email
    
    result = await db.admin_users.update_one(
        {"username": username.lower()},
        {"$set": update_data}
    )

    if result.matched_count == 0:
        # Quien solo tiene cuenta: se le corrige el nombre. El correo no, que
        # ahi es la identidad con la que entra.
        cuenta = await _cuenta_del_equipo(db, username)
        if not cuenta:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        if update.nombre is not None:
            await db[cuentas.COLECCION].update_one(
                {"_id": cuenta["_id"]},
                {"$set": {"nombre": update.nombre, "apellidos": "", "updated_at": update_data["updated_at"]}},
            )

    return {"message": "Usuario actualizado"}
