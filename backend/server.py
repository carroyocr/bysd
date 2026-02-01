from fastapi import FastAPI, APIRouter
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Mount static files directory - use /api/uploads to ensure routing through backend
STATIC_DIR = ROOT_DIR / "static"
STATIC_DIR.mkdir(exist_ok=True)
app.mount("/api/uploads", StaticFiles(directory=str(STATIC_DIR / "uploads")), name="uploads")

# Mount receipts upload directory
RECEIPTS_DIR = ROOT_DIR / "uploads" / "receipts"
RECEIPTS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/api/uploads/receipts", StaticFiles(directory=str(RECEIPTS_DIR)), name="receipts")

# Startup event to create database indexes
@app.on_event("startup")
async def startup_db_indexes():
    """Create database indexes on application startup for optimal query performance"""
    try:
        # Create descending index on timestamp for efficient sorting in queries
        await db.status_checks.create_index([("timestamp", -1)])
        
        # Create indexes for race tracking
        await db.participants.create_index([("bib", 1)], unique=True)
        await db.laps_log.create_index([("participant_bib", 1)])
        await db.laps_log.create_index([("completed_at", -1)])
        
        # Initialize admin user if not exists
        await initialize_race_data()
        
        logging.info("Database indexes created successfully")
        
        # Initialize volunteer email scheduler
        await initialize_volunteer_scheduler()
        
    except Exception as e:
        logging.warning(f"Index creation warning (may already exist): {e}")


async def initialize_volunteer_scheduler():
    """Initialize the volunteer email scheduler on startup"""
    try:
        from services.volunteer_scheduler import init_scheduler, schedule_friday_email, schedule_all_reminders
        
        # Initialize scheduler
        init_scheduler()
        
        # Schedule the Friday 6pm mass email
        schedule_friday_email()
        
        # Schedule all 1-hour reminders
        result = await schedule_all_reminders()
        
        logging.info(f"Volunteer scheduler initialized: {result.get('scheduled', 0)} reminders scheduled")
        logging.info("Friday mass email scheduled for January 23, 2026 at 6:00 PM")
        
    except Exception as e:
        logging.error(f"Error initializing volunteer scheduler: {e}")

async def initialize_race_data():
    """Initialize race data: admin user and participants"""
    import bcrypt
    
    # Create admin user if doesn't exist
    admin_exists = await db.admin_users.find_one({"username": "admin"})
    if not admin_exists:
        hashed_password = bcrypt.hashpw("Backyard2026!".encode('utf-8'), bcrypt.gensalt())
        await db.admin_users.insert_one({
            "username": "admin",
            "password": hashed_password.decode('utf-8'),
            "created_at": datetime.now(timezone.utc)
        })
        logging.info("Admin user created")
    
    # Initialize race config if doesn't exist
    config_exists = await db.race_config.find_one({})
    if not config_exists:
        await db.race_config.insert_one({
            "current_lap": 1,
            "race_status": "active",
            "updated_at": datetime.now(timezone.utc)
        })
        logging.info("Race config initialized")
    
    # Initialize participants if doesn't exist
    participants_count = await db.participants.count_documents({})
    if participants_count == 0:
        participants_data = [
            {'bib': '001', 'nombre': 'Lucas', 'apellidos': 'Gaitán', 'nacionalidad': 'COL'},
            {'bib': '002', 'nombre': 'Hamlet', 'apellidos': 'Burgos Frías', 'nacionalidad': 'DOM'},
            {'bib': '003', 'nombre': 'Carlos', 'apellidos': 'Camejo', 'nacionalidad': 'VEN'},
            {'bib': '004', 'nombre': 'Tomas', 'apellidos': 'Ruíz Ornes', 'nacionalidad': 'DOM'},
            {'bib': '005', 'nombre': 'Francesco', 'apellidos': 'Biondi', 'nacionalidad': 'DOM'},
            {'bib': '006', 'nombre': 'Víctor Hugo', 'apellidos': 'Moreno Contreras', 'nacionalidad': 'MEX'},
            {'bib': '007', 'nombre': 'Herbert Martin Klaus', 'apellidos': 'Scharf Rodríguez', 'nacionalidad': 'DOM'},
            {'bib': '008', 'nombre': 'Judelka Altagracia', 'apellidos': 'Vargas Almonte', 'nacionalidad': 'DOM'},
            {'bib': '009', 'nombre': 'José Ángel', 'apellidos': 'Rondón', 'nacionalidad': 'VEN'},
            {'bib': '010', 'nombre': 'Cristian', 'apellidos': 'Minaya Domínguez', 'nacionalidad': 'DOM'},
            {'bib': '011', 'nombre': 'Luis Emilio', 'apellidos': 'Cabral Rivera', 'nacionalidad': 'DOM'},
            {'bib': '012', 'nombre': 'Enemencio', 'apellidos': 'Pérez', 'nacionalidad': 'DOM'},
            {'bib': '013', 'nombre': 'Walter Damián', 'apellidos': 'Parra', 'nacionalidad': 'VEN'},
            {'bib': '014', 'nombre': 'Jorge', 'apellidos': 'Toribio', 'nacionalidad': 'DOM'},
            {'bib': '015', 'nombre': 'Olimpia', 'apellidos': 'Arellano Campos', 'nacionalidad': 'MEX'},
            {'bib': '016', 'nombre': 'Aivaliklis', 'apellidos': 'Jeanluc', 'nacionalidad': 'FRA'},
            {'bib': '017', 'nombre': 'Ma Eugenia', 'apellidos': 'Aguilar Mendizabal', 'nacionalidad': 'MEX'},
            {'bib': '018', 'nombre': 'Carlos Alberto', 'apellidos': 'Ovalle', 'nacionalidad': 'DOM'},
            {'bib': '019', 'nombre': 'Gustavo', 'apellidos': 'Percivaldi', 'nacionalidad': 'ARG'},
            {'bib': '020', 'nombre': 'Iván', 'apellidos': 'Ortega', 'nacionalidad': 'MEX'},
            {'bib': '021', 'nombre': 'Miguel', 'apellidos': 'Vásquez', 'nacionalidad': 'DOM'},
            {'bib': '022', 'nombre': 'Luis Antonio', 'apellidos': 'De León Encarnación', 'nacionalidad': 'DOM'},
            {'bib': '023', 'nombre': 'Moisés', 'apellidos': 'Encarnación Tapia', 'nacionalidad': 'DOM'},
            {'bib': '024', 'nombre': 'Alexandra', 'apellidos': 'Jeronimo', 'nacionalidad': 'USA'},
            {'bib': '025', 'nombre': 'Arturo', 'apellidos': 'Valdez', 'nacionalidad': 'DOM'},
            {'bib': '026', 'nombre': 'Fausto', 'apellidos': 'Batista Meléndez', 'nacionalidad': 'DOM'},
            {'bib': '027', 'nombre': 'Kathy', 'apellidos': 'Español', 'nacionalidad': 'DOM'},
            {'bib': '028', 'nombre': 'Yoselin', 'apellidos': 'Peña', 'nacionalidad': 'DOM'},
            {'bib': '029', 'nombre': 'Yesenia', 'apellidos': 'Grullon', 'nacionalidad': 'DOM'},
            {'bib': '030', 'nombre': 'Braulio', 'apellidos': 'Jiménez De La Rosa', 'nacionalidad': 'DOM'},
            {'bib': '031', 'nombre': 'Yeirys', 'apellidos': 'Soto', 'nacionalidad': 'DOM'},
            {'bib': '032', 'nombre': 'Tommy', 'apellidos': 'García Sánchez', 'nacionalidad': 'DOM'},
            {'bib': '033', 'nombre': 'Heldra', 'apellidos': 'Garib Valori', 'nacionalidad': 'DOM'},
            {'bib': '034', 'nombre': 'José Gabriel', 'apellidos': 'Rodríguez López', 'nacionalidad': 'DOM'},
            {'bib': '035', 'nombre': 'Sissy', 'apellidos': 'Jorge De Mencía', 'nacionalidad': 'DOM'},
            {'bib': '036', 'nombre': 'Julio Eduardo', 'apellidos': 'Molina Canahuate', 'nacionalidad': 'DOM'},
            {'bib': '037', 'nombre': 'George Omar', 'apellidos': 'Tejada Pimentel', 'nacionalidad': 'DOM'},
            {'bib': '038', 'nombre': 'Ismael', 'apellidos': 'Morillo Guzmán', 'nacionalidad': 'DOM'},
            {'bib': '039', 'nombre': 'Ámbar Esmeralda', 'apellidos': 'De Los Santos', 'nacionalidad': 'DOM'},
            {'bib': '040', 'nombre': 'Margaret', 'apellidos': 'Medrano', 'nacionalidad': 'DOM'},
            {'bib': '041', 'nombre': 'Ana Amalia', 'apellidos': 'Blömer Mueses', 'nacionalidad': 'DOM'},
            {'bib': '042', 'nombre': 'Pascal', 'apellidos': 'Sterlin', 'nacionalidad': 'HAI'},
            {'bib': '043', 'nombre': 'Luis', 'apellidos': 'Pérez Ernst', 'nacionalidad': 'PER'},
            {'bib': '044', 'nombre': 'Alberto', 'apellidos': 'Ruiz', 'nacionalidad': 'DOM'},
            {'bib': '045', 'nombre': 'DAIYI', 'apellidos': 'Shiguetome Rodríguez', 'nacionalidad': 'JAP'},
            {'bib': '046', 'nombre': 'Ernesto', 'apellidos': 'Ovalles Javier', 'nacionalidad': 'DOM'},
            {'bib': '047', 'nombre': 'David', 'apellidos': 'Orellana', 'nacionalidad': 'VEN'},
            {'bib': '048', 'nombre': 'Simón Bolívar', 'apellidos': 'Cepeda Lora', 'nacionalidad': 'DOM'},
            {'bib': '049', 'nombre': 'Miltón', 'apellidos': 'Núñez Imbert', 'nacionalidad': 'DOM'},
            {'bib': '050', 'nombre': 'Pedro', 'apellidos': 'Rodríguez Pérez', 'nacionalidad': 'DOM'},
            {'bib': '051', 'nombre': 'Rodrigo', 'apellidos': 'Farach Aldana', 'nacionalidad': 'GUA'},
            {'bib': '052', 'nombre': 'Bernardo', 'apellidos': 'De Jesús', 'nacionalidad': 'DOM'},
            {'bib': '053', 'nombre': 'Jhoel', 'apellidos': 'Camacho Tejada', 'nacionalidad': 'DOM'},
            {'bib': '054', 'nombre': 'Esteban Gabriel', 'apellidos': 'Senna', 'nacionalidad': 'BRA'},
            {'bib': '055', 'nombre': 'Victor', 'apellidos': 'Kery', 'nacionalidad': 'DOM'},
            {'bib': '056', 'nombre': 'Robert', 'apellidos': 'Duran Suarez', 'nacionalidad': 'DOM'},
            {'bib': '057', 'nombre': 'Erick', 'apellidos': 'Paulino', 'nacionalidad': 'DOM'},
            {'bib': '058', 'nombre': 'Cesar', 'apellidos': 'Encarnación Rodríguez', 'nacionalidad': 'DOM'},
            {'bib': '059', 'nombre': 'Rafael', 'apellidos': 'Altuna Martínez', 'nacionalidad': 'DOM'},
            {'bib': '060', 'nombre': 'Alexandra', 'apellidos': 'Mateo', 'nacionalidad': 'DOM'},
            {'bib': '061', 'nombre': 'Even', 'apellidos': 'Lafay', 'nacionalidad': 'FRA'},
            {'bib': '062', 'nombre': 'Cristian', 'apellidos': 'Ballenilla', 'nacionalidad': 'DOM'},
            {'bib': '063', 'nombre': 'Jorge Lewis', 'apellidos': 'Camilo Tejada', 'nacionalidad': 'DOM'},
            {'bib': '064', 'nombre': 'Carlos', 'apellidos': 'Burgos', 'nacionalidad': 'DOM'},
            {'bib': '065', 'nombre': 'Samuel', 'apellidos': 'Rosario Franco', 'nacionalidad': 'DOM'},
            {'bib': '066', 'nombre': 'Juan', 'apellidos': 'Pérez', 'nacionalidad': 'DOM'},
            {'bib': '067', 'nombre': 'Ramon Alfredo', 'apellidos': 'Jose Rojas', 'nacionalidad': 'DOM'},
            {'bib': '068', 'nombre': 'Juan Omar', 'apellidos': 'Jiménez Ortiz', 'nacionalidad': 'DOM'},
            {'bib': '069', 'nombre': 'Joan', 'apellidos': 'Gomez Velazquez', 'nacionalidad': 'DOM'},
            {'bib': '070', 'nombre': 'Oscar', 'apellidos': 'Moquete', 'nacionalidad': 'DOM'},
            {'bib': '071', 'nombre': 'Carlos Bienvenido', 'apellidos': 'Ogando Montás', 'nacionalidad': 'DOM'},
            {'bib': '072', 'nombre': 'Daphne Liliana', 'apellidos': 'Heyaime Fernández', 'nacionalidad': 'DOM'},
            {'bib': '073', 'nombre': 'José Antonio', 'apellidos': 'Santos Leonardo', 'nacionalidad': 'DOM'},
            {'bib': '074', 'nombre': 'Michelle', 'apellidos': 'Domínguez Ramírez', 'nacionalidad': 'DOM'},
            {'bib': '075', 'nombre': 'Ana (Karina)', 'apellidos': 'Ortiz Guerrero', 'nacionalidad': 'DOM'},
            {'bib': '076', 'nombre': 'Isabel', 'apellidos': 'Delgado', 'nacionalidad': 'DOM'},
            {'bib': '077', 'nombre': 'Pedro Pablo', 'apellidos': 'Taveras', 'nacionalidad': 'DOM'},
            {'bib': '078', 'nombre': 'Rommell', 'apellidos': 'Morel Tejada', 'nacionalidad': 'DOM'},
            {'bib': '079', 'nombre': 'Alexis', 'apellidos': 'Vásquez', 'nacionalidad': 'DOM'},
            {'bib': '080', 'nombre': 'Jacob', 'apellidos': 'Levinson', 'nacionalidad': 'USA'},
            {'bib': '081', 'nombre': 'Kensey', 'apellidos': 'Pichardo Guillen', 'nacionalidad': 'DOM'},
            {'bib': '082', 'nombre': 'Carlos Ariel', 'apellidos': 'De Jesús Chaljub', 'nacionalidad': 'DOM'},
            {'bib': '083', 'nombre': 'Rudolf', 'apellidos': 'Scheidig', 'nacionalidad': 'DOM'},
            {'bib': '084', 'nombre': 'Armando José', 'apellidos': 'Bisonó Estrella', 'nacionalidad': 'USA'},
            {'bib': '085', 'nombre': 'Julio Alberto', 'apellidos': 'Minaya Fernández', 'nacionalidad': 'ESP'},
            {'bib': '086', 'nombre': 'Gabriel', 'apellidos': 'Tapia', 'nacionalidad': 'DOM'},
            {'bib': '087', 'nombre': 'Melany', 'apellidos': 'Vanegas', 'nacionalidad': 'DOM'},
            {'bib': '088', 'nombre': 'Lennys del Rosario', 'apellidos': 'Jimenez Gonzalez', 'nacionalidad': 'VEN'},
            {'bib': '089', 'nombre': 'Thais', 'apellidos': 'Herrera', 'nacionalidad': 'DOM'},
            {'bib': '090', 'nombre': 'Livio', 'apellidos': 'Feliz', 'nacionalidad': 'DOM'},
        ]
        
        # Add default fields to each participant
        for p in participants_data:
            p['status'] = 'active'
            p['laps_completed'] = 0
            p['total_km'] = 0.0
            p['retired_at_lap'] = None
            p['created_at'] = datetime.now(timezone.utc)
            p['updated_at'] = datetime.now(timezone.utc)
        
        await db.participants.insert_many(participants_data)
        logging.info(f"Initialized {len(participants_data)} participants")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")  # Ignore MongoDB's _id field
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    
    # Convert to dict and serialize datetime to ISO string for MongoDB
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks(skip: int = 0, limit: int = 50):
    # Validate pagination parameters
    if limit > 100:
        limit = 100
    if skip < 0:
        skip = 0
    
    # Exclude MongoDB's _id field from the query results
    # Sort by timestamp descending (newest first) and apply pagination
    status_checks = await db.status_checks.find(
        {}, 
        {"_id": 0}
    ).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    
    # Convert ISO string timestamps back to datetime objects
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    
    return status_checks

# Include the router in the main app
app.include_router(api_router)

# Include race routes
from routes.race import router as race_router
app.include_router(race_router)

# Include volunteer routes
from routes.volunteers import router as volunteers_router
app.include_router(volunteers_router, prefix="/api/volunteers", tags=["volunteers"])

# Include survey routes
from routes.surveys import router as surveys_router
app.include_router(surveys_router, prefix="/api/surveys", tags=["surveys"])

# Include race configuration routes
from routes.race_config import router as race_config_router
app.include_router(race_config_router)

# Include registration routes
from routes.registration import router as registration_router
app.include_router(registration_router)

# Include sponsors routes
from routes.sponsors import router as sponsors_router
app.include_router(sponsors_router)

# Include volunteer registration routes
from routes.volunteer_registration import router as volunteer_registration_router
app.include_router(volunteer_registration_router, prefix="/api")

# Include volunteer config routes
from routes.volunteer_config import router as volunteer_config_router
app.include_router(volunteer_config_router, prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Error-Detail"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    # Shutdown volunteer scheduler
    try:
        from services.volunteer_scheduler import shutdown_scheduler
        shutdown_scheduler()
        logging.info("Volunteer scheduler shutdown complete")
    except Exception as e:
        logging.warning(f"Error shutting down scheduler: {e}")
    
    client.close()