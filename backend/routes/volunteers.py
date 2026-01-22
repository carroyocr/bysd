from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

router = APIRouter()

# Models
class VolunteerBase(BaseModel):
    email: str
    nombre: str
    apellidos: str
    sexo: Optional[str] = None
    lugar_residencia: Optional[str] = None
    telefono: Optional[str] = None

class AssignmentSlot(BaseModel):
    id: int
    puesto: str
    turno: str
    dia: str
    hora_inicio: str
    hora_fin: str
    slot: int
    email_asignado: Optional[str] = None
    nombre_asignado: Optional[str] = None

class AssignmentRequest(BaseModel):
    email: str

class AssignmentResponse(BaseModel):
    message: str
    success: bool


# Get all assignment slots with volunteer names
@router.get("/slots")
async def get_assignment_slots():
    """Get all assignment slots with assigned volunteer names"""
    from server import db as database
    
    slots = await database.volunteer_assignments.find({}, {"_id": 0}).to_list(1000)
    
    # Get volunteer names for assigned slots
    for slot in slots:
        if slot.get("email_asignado"):
            volunteer = await database.volunteers.find_one(
                {"email": slot["email_asignado"]},
                {"_id": 0, "nombre": 1, "apellidos": 1}
            )
            if volunteer:
                slot["nombre_asignado"] = f"{volunteer.get('nombre', '')} {volunteer.get('apellidos', '')}".strip()
            else:
                slot["nombre_asignado"] = slot["email_asignado"]
        else:
            slot["nombre_asignado"] = None
    
    return slots


# Get available positions (unique puesto values)
@router.get("/positions")
async def get_positions():
    """Get list of unique positions"""
    from server import db as database
    
    positions = await database.volunteer_assignments.distinct("puesto")
    return sorted(positions)


# Get available shifts (unique turno values)
@router.get("/shifts")
async def get_shifts():
    """Get list of unique shifts"""
    from server import db as database
    
    shifts = await database.volunteer_assignments.distinct("turno")
    return sorted(shifts)


# Assign volunteer to a slot
@router.post("/assign/{slot_id}")
async def assign_volunteer(slot_id: int, request: AssignmentRequest):
    """Assign a volunteer to a slot"""
    from server import db as database
    
    email = request.email.strip().lower()
    
    # Verify volunteer exists
    volunteer = await database.volunteers.find_one({"email": email})
    if not volunteer:
        raise HTTPException(
            status_code=400, 
            detail="El correo electrónico no corresponde a un voluntario registrado. No es posible realizar la asignación."
        )
    
    # Check slot exists and is available
    slot = await database.volunteer_assignments.find_one({"id": slot_id})
    if not slot:
        raise HTTPException(status_code=404, detail="Slot no encontrado")
    
    if slot.get("email_asignado"):
        raise HTTPException(
            status_code=400, 
            detail="Este espacio ya está asignado a otro voluntario"
        )
    
    # Assign volunteer
    await database.volunteer_assignments.update_one(
        {"id": slot_id},
        {"$set": {"email_asignado": email, "updated_at": datetime.utcnow()}}
    )
    
    volunteer_name = f"{volunteer.get('nombre', '')} {volunteer.get('apellidos', '')}".strip()
    
    return {
        "message": f"¡Asignación exitosa! {volunteer_name} ha sido asignado/a al turno.",
        "success": True,
        "volunteer_name": volunteer_name
    }


# Remove assignment from a slot
@router.post("/unassign/{slot_id}")
async def unassign_volunteer(slot_id: int, request: AssignmentRequest):
    """Remove a volunteer assignment from a slot"""
    from server import db as database
    
    email = request.email.strip().lower()
    
    # Check slot exists
    slot = await database.volunteer_assignments.find_one({"id": slot_id})
    if not slot:
        raise HTTPException(status_code=404, detail="Slot no encontrado")
    
    if not slot.get("email_asignado"):
        raise HTTPException(status_code=400, detail="Este espacio no tiene asignación")
    
    # Verify the email matches the assigned volunteer
    if slot["email_asignado"].lower() != email:
        raise HTTPException(
            status_code=400, 
            detail="El correo electrónico no corresponde al voluntario asignado. No es posible eliminar la asignación."
        )
    
    # Remove assignment
    await database.volunteer_assignments.update_one(
        {"id": slot_id},
        {"$set": {"email_asignado": None, "updated_at": datetime.utcnow()}}
    )
    
    return {
        "message": "Asignación eliminada exitosamente",
        "success": True
    }


# Get all volunteers
@router.get("/list")
async def get_volunteers():
    """Get all registered volunteers"""
    from server import db as database
    
    volunteers = await database.volunteers.find(
        {}, 
        {"_id": 0, "email": 1, "nombre": 1, "apellidos": 1}
    ).to_list(1000)
    
    return volunteers


# Initialize data from Excel files
@router.post("/init-data")
async def init_volunteer_data():
    """Initialize volunteer and assignment data from Excel files"""
    import pandas as pd
    from server import db as database
    
    try:
        # Read assignments
        assignments_url = "https://customer-assets.emergentagent.com/job_ultra-track-sd/artifacts/9euvepdl_Asigacio%CC%81n.xlsx"
        df_assign = pd.read_excel(assignments_url)
        
        # Read volunteers
        volunteers_url = "https://customer-assets.emergentagent.com/job_ultra-track-sd/artifacts/g0om8zpx_base%20de%20voluntarios%20final.xlsx"
        df_vol = pd.read_excel(volunteers_url)
        
        # Clear existing data
        await database.volunteer_assignments.drop()
        await database.volunteers.drop()
        
        # Process assignments
        assignments = []
        for idx, row in df_assign.iterrows():
            hora_inicio = str(row['Hora Inicio']) if pd.notna(row['Hora Inicio']) else ""
            hora_fin = str(row['Hora Fin']) if pd.notna(row['Hora Fin']) else ""
            
            if " " in hora_inicio:
                hora_inicio = hora_inicio.split()[0]
            if " " in hora_fin:
                hora_fin = hora_fin.split()[0]
            
            email = str(row['Email']).strip().lower() if pd.notna(row['Email']) else None
            if email == 'nan':
                email = None
                
            assignments.append({
                "id": idx + 1,
                "puesto": str(row['Puesto']) if pd.notna(row['Puesto']) else "",
                "turno": str(row['Turno']) if pd.notna(row['Turno']) else "",
                "dia": str(row['Día']).split()[0] if pd.notna(row['Día']) else "",
                "hora_inicio": hora_inicio,
                "hora_fin": hora_fin,
                "slot": int(row['Slot #']) if pd.notna(row['Slot #']) else 1,
                "email_asignado": email,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            })
        
        # Process volunteers
        volunteers = []
        seen_emails = set()
        for idx, row in df_vol.iterrows():
            email = str(row['Dirección de correo electrónico']).strip().lower() if pd.notna(row['Dirección de correo electrónico']) else None
            if email and email != 'nan' and email not in seen_emails:
                seen_emails.add(email)
                volunteers.append({
                    "email": email,
                    "nombre": str(row['Nombre']).strip() if pd.notna(row['Nombre']) else "",
                    "apellidos": str(row['Apellidos']).strip() if pd.notna(row['Apellidos']) else "",
                    "sexo": str(row['Sexo']) if pd.notna(row['Sexo']) else None,
                    "lugar_residencia": str(row['Lugar de Residencia']) if pd.notna(row['Lugar de Residencia']) else None,
                    "telefono": str(row['Número Celular']) if pd.notna(row['Número Celular']) else None,
                    "created_at": datetime.utcnow()
                })
        
        # Insert data
        if assignments:
            await database.volunteer_assignments.insert_many(assignments)
        if volunteers:
            await database.volunteers.insert_many(volunteers)
        
        return {
            "message": "Datos inicializados exitosamente",
            "assignments_count": len(assignments),
            "volunteers_count": len(volunteers)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
