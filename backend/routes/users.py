"""
User Management for Admin Panel
Handles user creation, permissions, and authentication
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import bcrypt

from services import rate_limit
from services.auth import require_admin, require_permission

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
    registro = await db.admin_users.find_one({"username": username})
    if not registro:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if not bcrypt.checkpw(datos.password_actual.encode("utf-8"), registro["password"].encode("utf-8")):
        raise HTTPException(status_code=400, detail="La contraseña actual es incorrecta")

    if len(datos.password_nueva) < MIN_PASSWORD:
        raise HTTPException(
            status_code=400,
            detail=f"La contraseña nueva debe tener al menos {MIN_PASSWORD} caracteres",
        )

    if bcrypt.checkpw(datos.password_nueva.encode("utf-8"), registro["password"].encode("utf-8")):
        raise HTTPException(status_code=400, detail="La contraseña nueva debe ser distinta de la actual")

    hashed = bcrypt.hashpw(datos.password_nueva.encode("utf-8"), bcrypt.gensalt())
    await db.admin_users.update_one(
        {"username": username},
        {"$set": {"password": hashed.decode("utf-8"), "updated_at": datetime.now(timezone.utc)}},
    )

    return {"message": "Contraseña actualizada. Vuelve a iniciar sesión."}


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


@router.get("")
async def get_users():
    """Get all users"""
    from server import db
    
    users = await db.admin_users.find(
        {},
        {"_id": 0, "password": 0}  # Exclude password
    ).to_list(100)
    
    result = []
    for user in users:
        result.append(UserResponse(
            username=user.get("username"),
            nombre=user.get("nombre"),
            email=user.get("email"),
            permissions=user.get("permissions", []),
            is_admin=user.get("username") == "admin",
            created_at=user.get("created_at")
        ))
    
    return result


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
    
    result = await db.admin_users.update_one(
        {"username": username.lower()},
        {
            "$set": {
                "permissions": update.permissions,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    return {"message": "Permisos actualizados"}


@router.delete("/{username}")
async def delete_user(username: str):
    """Delete a user"""
    from server import db
    
    # Don't allow deleting admin user
    if username.lower() == "admin":
        raise HTTPException(status_code=400, detail="No se puede eliminar el administrador principal")
    
    result = await db.admin_users.delete_one({"username": username.lower()})
    
    if result.deleted_count == 0:
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
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    return {"message": "Usuario actualizado"}
