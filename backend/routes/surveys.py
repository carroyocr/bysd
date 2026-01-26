from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone

router = APIRouter()

# ============================================================================
# MODELS
# ============================================================================

class AthletesSurvey(BaseModel):
    # Datos personales
    nombre: str
    email: str
    bib: Optional[str] = None
    
    # Preguntas de satisfacción (1-5)
    satisfaccion_general: int = Field(..., ge=1, le=5)
    organizacion_evento: int = Field(..., ge=1, le=5)
    comunicacion_previa: int = Field(..., ge=1, le=5)
    proceso_registro: int = Field(..., ge=1, le=5)
    kit_corredor: int = Field(..., ge=1, le=5)
    marcacion_ruta: int = Field(..., ge=1, le=5)
    seguridad_ruta: int = Field(..., ge=1, le=5)
    estaciones_hidratacion: int = Field(..., ge=1, le=5)
    atencion_medica: int = Field(..., ge=1, le=5)
    instalaciones: int = Field(..., ge=1, le=5)
    ambiente_comunidad: int = Field(..., ge=1, le=5)
    
    # Preguntas de texto
    lo_mejor: Optional[str] = None
    areas_mejora: Optional[str] = None
    participaria_nuevamente: str  # Sí / No / Tal vez
    recomendaria: str  # Sí / No / Tal vez
    comentarios_adicionales: Optional[str] = None
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class VolunteersSurvey(BaseModel):
    # Datos personales
    nombre: str
    email: str
    area_voluntariado: Optional[str] = None
    
    # Preguntas de satisfacción (1-5)
    satisfaccion_general: int = Field(..., ge=1, le=5)
    claridad_funciones: int = Field(..., ge=1, le=5)
    capacitacion_recibida: int = Field(..., ge=1, le=5)
    comunicacion_coordinadores: int = Field(..., ge=1, le=5)
    materiales_recursos: int = Field(..., ge=1, le=5)
    trato_organizacion: int = Field(..., ge=1, le=5)
    alimentacion_hidratacion: int = Field(..., ge=1, le=5)
    horarios_turnos: int = Field(..., ge=1, le=5)
    ambiente_equipo: int = Field(..., ge=1, le=5)
    reconocimiento: int = Field(..., ge=1, le=5)
    
    # Preguntas de texto
    lo_mejor: Optional[str] = None
    areas_mejora: Optional[str] = None
    voluntario_nuevamente: str  # Sí / No / Tal vez
    recomendaria: str  # Sí / No / Tal vez
    comentarios_adicionales: Optional[str] = None
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SpectatorsSurvey(BaseModel):
    # Datos personales
    nombre: str
    email: str
    relacion_evento: Optional[str] = None  # Familiar, Amigo, Aficionado, etc.
    
    # Preguntas de satisfacción (1-5)
    satisfaccion_general: int = Field(..., ge=1, le=5)
    facilidad_acceso: int = Field(..., ge=1, le=5)
    informacion_evento: int = Field(..., ge=1, le=5)
    visibilidad_recorrido: int = Field(..., ge=1, le=5)
    servicios_disponibles: int = Field(..., ge=1, le=5)
    ambiente_general: int = Field(..., ge=1, le=5)
    atencion_personal: int = Field(..., ge=1, le=5)
    
    # Preguntas de texto
    lo_mejor: Optional[str] = None
    areas_mejora: Optional[str] = None
    asistiria_nuevamente: str  # Sí / No / Tal vez
    recomendaria: str  # Sí / No / Tal vez
    comentarios_adicionales: Optional[str] = None
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ============================================================================
# ENDPOINTS - SUBMIT SURVEYS
# ============================================================================

@router.post("/athletes")
async def submit_athletes_survey(survey: AthletesSurvey):
    """Submit athlete satisfaction survey"""
    from server import db as database
    
    try:
        result = await database.surveys_athletes.insert_one(survey.dict())
        return {
            "message": "¡Gracias por completar la encuesta!",
            "success": True,
            "id": str(result.inserted_id)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/volunteers")
async def submit_volunteers_survey(survey: VolunteersSurvey):
    """Submit volunteer satisfaction survey"""
    from server import db as database
    
    try:
        result = await database.surveys_volunteers.insert_one(survey.dict())
        return {
            "message": "¡Gracias por completar la encuesta!",
            "success": True,
            "id": str(result.inserted_id)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/spectators")
async def submit_spectators_survey(survey: SpectatorsSurvey):
    """Submit spectator satisfaction survey"""
    from server import db as database
    
    try:
        result = await database.surveys_spectators.insert_one(survey.dict())
        return {
            "message": "¡Gracias por completar la encuesta!",
            "success": True,
            "id": str(result.inserted_id)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# ENDPOINTS - GET SURVEYS (ADMIN)
# ============================================================================

@router.get("/athletes/responses")
async def get_athletes_responses():
    """Get all athlete survey responses"""
    from server import db as database
    
    responses = await database.surveys_athletes.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    return {
        "total": len(responses),
        "responses": responses
    }


@router.get("/volunteers/responses")
async def get_volunteers_responses():
    """Get all volunteer survey responses"""
    from server import db as database
    
    responses = await database.surveys_volunteers.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    return {
        "total": len(responses),
        "responses": responses
    }


@router.get("/spectators/responses")
async def get_spectators_responses():
    """Get all spectator survey responses"""
    from server import db as database
    
    responses = await database.surveys_spectators.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    return {
        "total": len(responses),
        "responses": responses
    }


@router.get("/stats")
async def get_surveys_stats():
    """Get survey statistics"""
    from server import db as database
    
    athletes_count = await database.surveys_athletes.count_documents({})
    volunteers_count = await database.surveys_volunteers.count_documents({})
    spectators_count = await database.surveys_spectators.count_documents({})
    
    return {
        "athletes": athletes_count,
        "volunteers": volunteers_count,
        "spectators": spectators_count,
        "total": athletes_count + volunteers_count + spectators_count
    }
