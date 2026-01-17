from pydantic import BaseModel, Field, EmailStr
from typing import Optional, Literal, List
from datetime import datetime

class AdminUser(BaseModel):
    username: str
    password: str

class AdminLogin(BaseModel):
    username: str
    password: str

class RaceConfig(BaseModel):
    current_lap: int = 1
    race_status: Literal["active", "paused", "finished"] = "active"
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class Participant(BaseModel):
    bib: str
    nombre: str
    apellidos: str
    nacionalidad: str
    status: Literal["active", "retired", "dns"] = "active"
    laps_completed: int = 0
    total_km: float = 0.0
    retired_at_lap: Optional[int] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class LapLog(BaseModel):
    participant_bib: str
    lap_number: int
    completed_at: datetime = Field(default_factory=datetime.utcnow)
    recorded_by: str = "admin"

class SetCurrentLapRequest(BaseModel):
    current_lap: int

class MarkRetiredRequest(BaseModel):
    bib: str
    retired_at_lap: int

class CompleteLapRequest(BaseModel):
    bib: str
    lap_number: int

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
