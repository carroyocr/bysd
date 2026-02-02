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
    
    # Send email with credentials
    try:
        from services.email_service import send_email
        
        # Get permission labels for email
        permission_labels = {
            'control': 'Panel de Control',
            'athletes': 'Atletas',
            'finances': 'Finanzas',
            'volunteers': 'Voluntarios',
            'sponsors': 'Patrocinadores',
            'surveys': 'Encuestas',
            'config': 'Configuración',
            'scanner': 'Escáner QR',
            'users': 'Usuarios'
        }
        
        permissions_html = ""
        if user.permissions:
            perms_list = [permission_labels.get(p, p) for p in user.permissions]
            permissions_html = f"""
            <div style="margin-top: 16px;">
                <p style="margin: 0 0 8px 0; color: #4b5563; font-size: 14px;"><strong>Permisos asignados:</strong></p>
                <ul style="margin: 0; padding-left: 20px; color: #6b7280; font-size: 14px;">
                    {"".join(f"<li>{p}</li>" for p in perms_list)}
                </ul>
            </div>
            """
        
        nombre = user.nombre or user.username
        
        subject = "Credenciales de Acceso - Panel de Administración Backyard Ultra"
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f5f5f4;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
                <div style="background: linear-gradient(135deg, #1f2937 0%, #374151 100%); padding: 24px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 20px;">BACKYARD ULTRA SANTO DOMINGO</h1>
                    <p style="color: #9ca3af; margin: 8px 0 0 0; font-size: 14px;">Panel de Administración</p>
                </div>
                
                <div style="padding: 32px 24px;">
                    <p style="color: #1f2937; margin: 0 0 16px 0; font-size: 16px;">
                        Hola <strong>{nombre}</strong>,
                    </p>
                    
                    <p style="color: #4b5563; margin: 0 0 24px 0; font-size: 14px; line-height: 1.6;">
                        Se ha creado una cuenta para ti en el panel de administración de Backyard Ultra Santo Domingo. 
                        A continuación encontrarás tus credenciales de acceso:
                    </p>
                    
                    <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 120px;">Usuario:</td>
                                <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: bold;">{user.username.lower()}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Contraseña:</td>
                                <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: bold; font-family: monospace;">{plain_password}</td>
                            </tr>
                        </table>
                    </div>
                    
                    {permissions_html}
                    
                    <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 24px 0;">
                        <p style="margin: 0; color: #92400e; font-size: 13px;">
                            <strong>⚠️ Importante:</strong> Por seguridad, te recomendamos cambiar tu contraseña después del primer inicio de sesión.
                        </p>
                    </div>
                    
                    <div style="text-align: center; margin-top: 24px;">
                        <a href="https://eventmaster-67.preview.emergentagent.com/admin/login" 
                           style="display: inline-block; background-color: #1f2937; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: bold;">
                            Acceder al Panel
                        </a>
                    </div>
                </div>
                
                <div style="background-color: #1f2937; padding: 20px; text-align: center;">
                    <p style="color: #9ca3af; margin: 0; font-size: 12px;">
                        © Backyard Ultra Santo Domingo
                    </p>
                </div>
            </div>
        </body>
        </html>
        """
        
        await send_email(user.email, subject, html_content)
        
    except Exception as e:
        print(f"Error sending credentials email: {e}")
        # Don't fail user creation if email fails
    
    return {"message": "Usuario creado exitosamente. Se han enviado las credenciales por correo.", "username": user.username}
    
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
