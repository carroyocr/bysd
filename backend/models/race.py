from pydantic import BaseModel, Field, EmailStr
from typing import Optional, Literal, List
from datetime import datetime

class AdminUser(BaseModel):
    username: str
    password: str

class AdminLogin(BaseModel):
    username: str
    password: str

class Participant(BaseModel):
    bib: str
    nombre: str
    apellidos: str
    nacionalidad: str
    status: Literal["active", "retired", "dns", "winner", "honor"] = "active"
    laps_completed: int = 0
    total_km: float = 0.0
    retired_at_lap: Optional[int] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class MarkRetiredRequest(BaseModel):
    bib: str
    retired_at_lap: int

class CompleteLapRequest(BaseModel):
    bib: str
    lap_number: int

class AdjustLapsRequest(BaseModel):
    bib: str
    new_laps: int

class EditParticipantRequest(BaseModel):
    bib: str
    nombre: str
    apellidos: str
    nacionalidad: str

class RaceStats(BaseModel):
    current_lap: int
    total_laps_completed: int
    athletes_dnf: int
    athletes_active: int
    athletes_dns: int
    total_km: float
    total_km_all_athletes: float
    winner: Optional[dict] = None

class ParticipantWithStats(BaseModel):
    bib: str
    nombre: str
    apellidos: str
    nacionalidad: str
    status: str
    laps_completed: int
    total_km: float
    retired_at_lap: Optional[int] = None

class EmailSubscription(BaseModel):
    email: str
    athletes_bibs: List[str]
    notify_every_lap: bool = False
    notify_on_finish: bool = True
    active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

class SubscribeRequest(BaseModel):
    email: str
    athletes_bibs: List[str]
    notify_every_lap: bool = False
    notify_on_finish: bool = True


class CheerMessage(BaseModel):
    athlete_bib: str
    fan_name: str
    message: str
    approved: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)


class CheerMessageRequest(BaseModel):
    athlete_bib: str
    fan_name: str
    message: str
    # La carrera que la app tiene abierta. Opcional porque las versiones ya
    # instaladas no lo mandan: esas caen en la carrera publica, que era el
    # comportamiento de siempre.
    race_code: Optional[str] = None
