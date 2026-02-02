"""
User Management for Admin Panel
Handles user creation, permissions, and authentication
"""

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import bcrypt
import jwt
import os

router = APIRouter(prefix="/api/users", tags=["users"])

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "backyard-ultra-secret-2026")
ALGORITHM = "HS256"


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


def verify_admin_token(authorization: str = Header(...)):
    """Verify JWT token and check if user is admin"""
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")


@router.get("")
async def get_users(authorization: str = Header(...)):
    """Get all users"""
    verify_admin_token(authorization)
    
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
async def create_user(user: UserCreate, authorization: str = Header(...)):
    """Create a new user"""
    verify_admin_token(authorization)
    
    from server import db
    
    # Check if username already exists
    existing = await db.admin_users.find_one({"username": user.username.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="El usuario ya existe")
    
    # Validate password length
    if len(user.password) < 6:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 6 caracteres")
    
    # Hash password
    hashed_password = bcrypt.hashpw(user.password.encode('utf-8'), bcrypt.gensalt())
    
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
    
    return {"message": "Usuario creado exitosamente", "username": user.username}


@router.put("/{username}/permissions")
async def update_permissions(username: str, update: PermissionsUpdate, authorization: str = Header(...)):
    """Update user permissions"""
    verify_admin_token(authorization)
    
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
async def delete_user(username: str, authorization: str = Header(...)):
    """Delete a user"""
    verify_admin_token(authorization)
    
    from server import db
    
    # Don't allow deleting admin user
    if username.lower() == "admin":
        raise HTTPException(status_code=400, detail="No se puede eliminar el administrador principal")
    
    result = await db.admin_users.delete_one({"username": username.lower()})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    return {"message": "Usuario eliminado"}


@router.put("/{username}")
async def update_user(username: str, update: UserUpdate, authorization: str = Header(...)):
    """Update user info (name, email)"""
    verify_admin_token(authorization)
    
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
