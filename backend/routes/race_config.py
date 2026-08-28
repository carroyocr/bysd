from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Header
from typing import Optional
from pydantic import BaseModel
from datetime import datetime
import os
from pathlib import Path

router = APIRouter(prefix="/api/race-config", tags=["race-config"])

# Directory for uploaded logos and manuals
LOGOS_DIR = Path(__file__).parent.parent / "static" / "logos"
LOGOS_DIR.mkdir(parents=True, exist_ok=True)

MANUALS_DIR = Path(__file__).parent.parent / "static" / "manuals"
MANUALS_DIR.mkdir(parents=True, exist_ok=True)

from services.auth import require_permission, verify_admin_token
from services import races as carreras

# Configurar la carrera (fechas, logos, manuales, textos) es el permiso "config".
solo_config = Depends(require_permission("config"))


async def verify_token(authorization: Optional[str] = Header(None)):
    """Verify JWT token from Authorization header"""
    return verify_admin_token(authorization)


class PaymentInfoModel(BaseModel):
    account_name: Optional[str] = None
    account_id: Optional[str] = None  # Identificación/Cédula
    bank_name: Optional[str] = None
    account_type: Optional[str] = None  # Ahorro, Corriente
    account_number: Optional[str] = None


class RaceConfigCreate(BaseModel):
    code: str  # e.g., "BYSD-2026"
    name: str  # e.g., "Backyard Ultra Santo Domingo 2026"
    date: str  # e.g., "2026-01-24"
    start_time: str  # e.g., "09:00"
    location: str  # e.g., "Parque del Este, Santo Domingo"
    timezone_gmt: str = "GMT-4"  # e.g., "GMT-4" for Dominican Republic
    # Publicar la carrera en el sitio es una decision aparte de crearla: crear
    # el campeonato mundial no debe tumbar la pagina de inscripcion de la
    # carrera abierta.
    is_active: bool = False
    registration_cost: float = 3500.0  # Cost in local currency (RD$)
    edition_number: int = 1  # Edition number (1 = Primera, 2 = Segunda, etc.)
    max_participants: int = 120  # Maximum number of participants before waitlist
    es_campeonato: bool = False
    km_por_vuelta: Optional[float] = None  # el anillo no mide igual en toda sede
    # Codigo de otra carrera de la que copiar lo que se reutiliza: logos, datos
    # de pago y el cuadro de turnos de voluntario. Es casi todo el trabajo de
    # montar una edicion nueva.
    copiar_de: Optional[str] = None


class RaceConfigUpdate(BaseModel):
    name: Optional[str] = None
    date: Optional[str] = None
    start_time: Optional[str] = None
    location: Optional[str] = None
    logo_url: Optional[str] = None  # Legacy - main logo
    logo_home_url: Optional[str] = None  # Logo for home page (recommended: 400x400px PNG)
    logo_menu_url: Optional[str] = None  # Logo for navigation menu (recommended: 48x48px PNG)
    favicon_url: Optional[str] = None  # Favicon for browser tab (recommended: 32x32px ICO/PNG)
    registration_cost: Optional[float] = None
    edition_number: Optional[int] = None
    max_participants: Optional[int] = None
    timezone_gmt: Optional[str] = None  # e.g., "GMT-4"
    estado: Optional[str] = None  # borrador | inscripcion | en_carrera | cerrada
    km_por_vuelta: Optional[float] = None
    # Payment info
    payment_account_name: Optional[str] = None
    payment_account_id: Optional[str] = None
    payment_bank_name: Optional[str] = None
    payment_account_type: Optional[str] = None
    payment_account_number: Optional[str] = None
    # Page visibility
    show_tracking_page: Optional[bool] = None
    show_community_page: Optional[bool] = None
    show_preregistration: Optional[bool] = None
    # La pagina de patrocinadores se enciende y se apaga a mano, como las
    # demas. Antes se deducia de si la carrera tenia patrocinadores
    # publicados, y eso dejaba enlaces muertos en el menu.
    show_sponsors_page: Optional[bool] = None
    # Registro publico de voluntarios para la carrera (el campeonato mundial
    # siempre esta abierto). Apagado mientras solo se reclutan voluntarios
    # para el campeonato.
    show_volunteer_carrera: Optional[bool] = None


@router.get("/active")
async def get_active_race(db=Depends(lambda: None)):
    """Get the currently active race configuration"""
    from server import db as database
    
    config = await database.race_configurations.find_one(
        {"is_active": True}, 
        {"_id": 0, "scan_key": 0}
    )
    
    if not config:
        # Return default values if no active race is configured
        return {
            "code": "BYSD-2026",
            "name": "Backyard Ultra Santo Domingo 2026",
            "date": "2026-01-24",
            "start_time": "09:00",
            "location": "Parque del Este, Santo Domingo, República Dominicana",
            "logo_url": "/icon-bu.png",
            "is_active": True,
            "is_default": True,
            "registration_cost": 3500.0,
            "edition_number": 1,
            "max_participants": 120
        }
    
    # Ensure defaults for new fields if not present
    if "registration_cost" not in config:
        config["registration_cost"] = 3500.0
    if "edition_number" not in config:
        config["edition_number"] = 1
    if "max_participants" not in config:
        config["max_participants"] = 120
    if "show_tracking_page" not in config:
        config["show_tracking_page"] = True
    if "show_community_page" not in config:
        config["show_community_page"] = True
    if "show_preregistration" not in config:
        config["show_preregistration"] = True
    if "show_sponsors_page" not in config:
        config["show_sponsors_page"] = True
    # Por defecto apagado: solo se reciben voluntarios del campeonato mundial
    if "show_volunteer_carrera" not in config:
        config["show_volunteer_carrera"] = False

    return config


@router.get("/branding")
async def get_race_branding(db=Depends(lambda: None)):
    """Get branding images for the active race (public endpoint for frontend)"""
    from server import db as database
    
    config = await database.race_configurations.find_one(
        {"is_active": True}, 
        {"_id": 0, "logo_url": 1, "logo_home_url": 1, "logo_menu_url": 1, "favicon_url": 1, "name": 1, "code": 1}
    )
    
    # Default values
    defaults = {
        "logo_url": "/icon-bu.png",
        "logo_home_url": "/icon-bu.png",
        "logo_menu_url": "/icon-bu.png",
        "favicon_url": "/favicon.ico"
    }
    
    if not config:
        return {
            **defaults,
            "race_name": "Backyard Ultra Santo Domingo",
            "race_code": ""
        }
    
    return {
        "logo_url": config.get("logo_url") or defaults["logo_url"],
        "logo_home_url": config.get("logo_home_url") or config.get("logo_url") or defaults["logo_home_url"],
        "logo_menu_url": config.get("logo_menu_url") or defaults["logo_menu_url"],
        "favicon_url": config.get("favicon_url") or defaults["favicon_url"],
        "race_name": config.get("name", "Backyard Ultra Santo Domingo"),
        "race_code": config.get("code", "")
    }


@router.get("/page-visibility")
async def get_page_visibility(db=Depends(lambda: None)):
    """Get the visibility settings for public pages (no auth required)"""
    from server import db as database
    
    config = await database.race_configurations.find_one(
        {"is_active": True},
        {"_id": 0, "show_tracking_page": 1, "show_community_page": 1, "show_preregistration": 1, "show_sponsors_page": 1, "show_volunteer_carrera": 1, "name": 1, "code": 1}
    )

    if not config:
        return {
            "show_tracking_page": True,
            "show_community_page": True,
            "show_preregistration": True,
            "show_sponsors_page": True,
            "show_volunteer_carrera": False,
            "race_name": "Backyard Ultra Santo Domingo",
            "race_code": ""
        }

    return {
        "show_tracking_page": config.get("show_tracking_page", True),
        "show_community_page": config.get("show_community_page", True),
        "show_preregistration": config.get("show_preregistration", True),
        "show_sponsors_page": config.get("show_sponsors_page", True) is not False,
        "show_volunteer_carrera": config.get("show_volunteer_carrera", False) is True,
        "race_name": config.get("name", "Backyard Ultra Santo Domingo"),
        "race_code": config.get("code", "")
    }


@router.get("/all")
async def get_all_races(db=Depends(lambda: None)):
    """Get all race configurations (active and archived)"""
    from server import db as database
    
    races = await database.race_configurations.find(
        {}, 
        {"_id": 0, "scan_key": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Ensure legacy race BYSD-2026 is always included for historical results
    existing_codes = {r.get("code") for r in races}
    for codigo, legacy_race in carreras.CARRERAS_HISTORICAS.items():
        if codigo not in existing_codes:
            races.append(dict(legacy_race))
    
    # Sort by date descending
    races.sort(key=lambda x: x.get("date", ""), reverse=True)
    
    return {"races": races}


@router.get("/{code}")
async def get_race_by_code(code: str, db=Depends(lambda: None)):
    """Get a specific race configuration by code"""
    from server import db as database
    
    config = await database.race_configurations.find_one(
        {"code": code}, 
        {"_id": 0, "scan_key": 0}
    )
    
    # If not found in DB, check if it's a legacy race
    if not config:
        historica = carreras.CARRERAS_HISTORICAS.get(code.upper())
        if historica:
            return dict(historica)

        raise HTTPException(status_code=404, detail="Carrera no encontrada")
    
    return config


@router.post("/create")
async def create_race(
    config: RaceConfigCreate,
    user=Depends(verify_token),
    db=Depends(lambda: None)
):
    """Crea una carrera. Con `copiar_de`, hereda lo que se reutiliza de otra."""
    from server import db as database

    codigo = config.code.strip().upper()

    # Check if code already exists
    existing = await database.race_configurations.find_one({"code": codigo})
    if existing:
        raise HTTPException(status_code=400, detail=f"Ya existe una carrera con el código {codigo}")

    # Solo una carrera se publica en el sitio a la vez.
    if config.is_active:
        await database.race_configurations.update_many(
            {"is_active": True},
            {"$set": {"is_active": False, "archived_at": datetime.utcnow()}}
        )

    datos = config.dict(exclude={"copiar_de"})
    datos["code"] = codigo

    race_data = {
        **datos,
        "logo_url": "/icon-bu.png",  # Default logo
        "estado": carreras.ESTADO_POR_DEFECTO,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }

    copiado = {}
    if config.copiar_de:
        copiado = await _copiar_de_otra_carrera(database, config.copiar_de.upper(), race_data)

    await database.race_configurations.insert_one(race_data)

    if config.copiar_de:
        copiado["turnos"] = await _copiar_turnos(database, config.copiar_de.upper(), codigo)

    # Remove _id from response
    race_data.pop("_id", None)

    return {
        "message": f"Carrera '{config.name}' creada exitosamente",
        "race": race_data,
        "copiado": copiado,
    }


# Lo que vale la pena heredar de una edicion a la siguiente. El resto (fechas,
# cupo, estado, resultados) es propio de cada una.
CAMPOS_HEREDABLES = [
    "logo_url", "logo_home_url", "logo_menu_url", "favicon_url", "portada_url",
    "payment_account_name", "payment_account_id", "payment_bank_name",
    "payment_account_type", "payment_account_number",
    "km_por_vuelta", "timezone_gmt",
]


async def _copiar_de_otra_carrera(database, origen_code: str, race_data: dict) -> dict:
    """Hereda logos y datos de pago. Lo que ya venga puesto no se pisa."""
    origen = await database.race_configurations.find_one({"code": origen_code})
    if not origen:
        raise HTTPException(status_code=404, detail=f"No existe la carrera {origen_code} para copiar")

    heredados = []
    for campo in CAMPOS_HEREDABLES:
        valor = origen.get(campo)
        if valor in (None, "") or race_data.get(campo) not in (None, "", "/icon-bu.png"):
            continue
        race_data[campo] = valor
        heredados.append(campo)

    return {"campos": heredados, "origen": origen_code}


async def _copiar_turnos(database, origen_code: str, destino_code: str) -> int:
    """Copia el cuadro de puestos y turnos de voluntario.

    Montarlo a mano cada edicion son horas de trabajo y siempre es casi el
    mismo: los puestos del recorrido no cambian de un anio para otro.
    """
    import uuid as uuid_module

    puestos = await database.volunteer_positions.find(
        {"$or": [{"race_code": origen_code}, {"race_code": {"$exists": False}}]}
    ).to_list(500)

    copiados = 0
    for puesto in puestos:
        puesto.pop("_id", None)
        puesto["race_code"] = destino_code
        puesto["id"] = str(uuid_module.uuid4())
        await database.volunteer_positions.insert_one(puesto)
        copiados += 1

    return copiados


@router.put("/update/{code}")
async def update_race(
    code: str,
    config: RaceConfigUpdate,
    user=Depends(verify_token),
    db=Depends(lambda: None)
):
    """Update a race configuration"""
    from server import db as database
    
    existing = await database.race_configurations.find_one({"code": code})
    if not existing:
        raise HTTPException(status_code=404, detail="Carrera no encontrada")
    
    # Build update data
    update_data = {"updated_at": datetime.utcnow()}
    for field, value in config.dict(exclude_unset=True).items():
        if value is not None:
            update_data[field] = value
    
    await database.race_configurations.update_one(
        {"code": code},
        {"$set": update_data}
    )
    
    updated = await database.race_configurations.find_one({"code": code}, {"_id": 0})
    
    return {
        "message": f"Carrera '{code}' actualizada",
        "race": updated
    }


@router.post("/activate/{code}")
async def activate_race(
    code: str,
    user=Depends(verify_token),
    db=Depends(lambda: None)
):
    """Set a race as the active one (archives the previous active race)"""
    from server import db as database
    
    existing = await database.race_configurations.find_one({"code": code})
    if not existing:
        raise HTTPException(status_code=404, detail="Carrera no encontrada")
    
    # Archive all other active races
    await database.race_configurations.update_many(
        {"is_active": True},
        {"$set": {"is_active": False, "archived_at": datetime.utcnow()}}
    )
    
    # Activate this race
    await database.race_configurations.update_one(
        {"code": code},
        {"$set": {"is_active": True, "updated_at": datetime.utcnow()}}
    )
    
    return {"message": f"Carrera '{code}' activada"}


@router.post("/close/{code}", dependencies=[solo_config])
async def cerrar_carrera(code: str):
    """Da la carrera por terminada y congela sus resultados.

    No mueve ni borra nada: todo lo de esta carrera ya lleva su `race_code` y se
    queda donde esta, consultable. Lo que cambia es que el reloj deja de contar
    -- una carrera terminada seguia sumando una vuelta por hora para siempre --
    y que deja de aparecer como carrera de trabajo en el panel.
    """
    from server import db as database

    carrera = await carreras.obtener_carrera(database, code)
    codigo = carrera["code"]

    if carreras.estado(carrera) == "cerrada":
        raise HTTPException(status_code=400, detail="Esa carrera ya está cerrada")

    ahora = carreras.ahora_en_carrera(carrera)
    await database.race_configurations.update_one(
        {"code": codigo},
        {"$set": {"estado": "cerrada", "finished_at": ahora, "updated_at": ahora}},
    )

    vueltas = await database.lap_registrations.count_documents(
        {"race_code": codigo, "action": "lap_completed", "anulada": {"$ne": True}}
    )
    corredores = await database.registrations.count_documents({"race_code": codigo})

    return {
        "message": f"Carrera '{codigo}' cerrada. Sus resultados quedan congelados.",
        "race_code": codigo,
        "finished_at": ahora.isoformat(),
        "vueltas_registradas": vueltas,
        "corredores": corredores,
    }


@router.post("/reopen/{code}", dependencies=[solo_config])
async def reabrir_carrera(code: str):
    """Deshace el cierre, por si se cerro antes de tiempo."""
    from server import db as database

    carrera = await carreras.obtener_carrera(database, code)
    codigo = carrera["code"]

    if carreras.estado(carrera) != "cerrada":
        raise HTTPException(status_code=400, detail="Esa carrera no está cerrada")

    await database.race_configurations.update_one(
        {"code": codigo},
        {"$unset": {"finished_at": ""},
         "$set": {"estado": "en_carrera", "updated_at": datetime.utcnow()}},
    )

    return {"message": f"Carrera '{codigo}' reabierta", "race_code": codigo}


@router.post("/upload-logo/{code}")
async def upload_logo(
    code: str,
    file: UploadFile = File(...),
    user=Depends(verify_token),
    db=Depends(lambda: None)
):
    """Upload a logo for a race (legacy endpoint - uploads to logo_url)"""
    from server import db as database
    
    existing = await database.race_configurations.find_one({"code": code})
    if not existing:
        raise HTTPException(status_code=404, detail="Carrera no encontrada")
    
    # Validate file type
    # SVG fuera: un SVG puede llevar JavaScript dentro y se sirve desde el
    # dominio del backend, asi que abrirlo ejecutaria ese script en nuestro
    # origen. Los formatos de imagen normales no tienen ese problema.
    allowed_types = ["image/png", "image/jpeg", "image/jpg", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Tipo de archivo no permitido. Use PNG, JPG o WEBP")
    
    # Generate filename
    ext = file.filename.split(".")[-1] if "." in file.filename else "png"
    filename = f"logo_{code}.{ext}"

    # Guardar en GridFS: el disco del contenedor se borra en cada despliegue.
    from services import file_storage

    await file_storage.save(filename, await file.read(), file.content_type, file_storage.FOLDER_LOGOS)

    # Update database with logo URL
    logo_url = f"/api/race-config/logo/{filename}"
    await database.race_configurations.update_one(
        {"code": code},
        {"$set": {"logo_url": logo_url, "updated_at": datetime.utcnow()}}
    )
    
    return {
        "message": "Logo subido exitosamente",
        "logo_url": logo_url
    }


@router.post("/upload-image/{code}/{image_type}")
async def upload_race_image(
    code: str,
    image_type: str,
    file: UploadFile = File(...),
    user=Depends(verify_token),
    db=Depends(lambda: None)
):
    """
    Upload a specific image for a race.
    
    Image types:
    - home: Logo for home page hero section (recommended: 1024x1024px PNG, transparent background)
    - menu: Logo for navigation menu (recommended: 256x256px PNG, transparent background;
      se dibuja a 64px, que en una pantalla retina son 192px reales)
    - favicon: Browser tab icon (recommended: 180x180px PNG)
    - portada: Foto de fondo del Home de BYSD Live (recomendado: 1080x1920px JPG)
    """
    from server import db as database

    valid_types = ["home", "menu", "favicon", "portada"]
    if image_type not in valid_types:
        raise HTTPException(
            status_code=400, 
            detail=f"Tipo de imagen inválido. Use: {', '.join(valid_types)}"
        )
    
    existing = await database.race_configurations.find_one({"code": code})
    if not existing:
        raise HTTPException(status_code=404, detail="Carrera no encontrada")
    
    # Validate file type
    # Sin SVG, por lo mismo que en upload-logo.
    allowed_types = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/x-icon", "image/vnd.microsoft.icon"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Tipo de archivo no permitido. Use PNG, JPG, WEBP o ICO")
    
    # Generate filename based on type
    ext = file.filename.split(".")[-1] if "." in file.filename else "png"
    filename = f"{image_type}_{code}.{ext}"

    # Guardar en GridFS: el disco del contenedor se borra en cada despliegue.
    from services import file_storage

    await file_storage.save(filename, await file.read(), file.content_type, file_storage.FOLDER_LOGOS)

    # Build the URL
    image_url = f"/api/race-config/logo/{filename}"
    
    # Map image type to database field
    field_map = {
        "home": "logo_home_url",
        "menu": "logo_menu_url",
        "favicon": "favicon_url",
        "portada": "portada_url"
    }
    
    # Update database
    await database.race_configurations.update_one(
        {"code": code},
        {"$set": {field_map[image_type]: image_url, "updated_at": datetime.utcnow()}}
    )
    
    # Recommended sizes for reference
    size_recommendations = {
        "home": "400x400px PNG con fondo transparente",
        "menu": "48x48px PNG con fondo transparente",
        "favicon": "32x32px PNG o ICO",
        "portada": "1080x1920px JPG (foto del evento para el Home de BYSD Live)"
    }
    
    return {
        "message": f"Imagen '{image_type}' subida exitosamente",
        "url": image_url,
        "field": field_map[image_type],
        "recommendation": size_recommendations[image_type]
    }


@router.get("/logo/{filename}")
async def get_logo(filename: str):
    """Serve a logo file"""
    from services import file_storage

    # Cache corta: el nombre del logo es fijo, asi que al reemplazarlo el
    # navegador tiene que volver a pedirlo.
    return await file_storage.serve(filename, disk_dir=LOGOS_DIR, max_age=300)


# `archive-data` y `prepare-new-race` vivian aqui. Copiaban `participants`,
# `cheer_messages` y `sponsors` a colecciones "archived_" y luego vaciaban las
# originales, porque nacieron cuando solo podia haber una carrera y "pasar a la
# siguiente" significaba hacer sitio. Ahora cada dato lleva su `race_code` y
# conviven varias carreras: vaciar colecciones globales se llevaria por delante
# los datos de las otras. Cerrar una carrera (POST /close/{code}) no mueve nada.


@router.get("/data-summary/{code}", dependencies=[solo_config])
async def get_race_data_summary(
    code: str,
    db=Depends(lambda: None)
):
    """Get a summary of all data associated with a race"""
    from server import db as database
    
    existing = await database.race_configurations.find_one({"code": code})
    if not existing:
        raise HTTPException(status_code=404, detail="Carrera no encontrada")
    
    summary = {
        "race_code": code,
        "race_name": existing.get("name", ""),
        "is_active": existing.get("is_active", False),
        "data_archived": existing.get("data_archived", False),
        "collections": {}
    }
    
    # Count data in each collection
    collections_to_check = [
        ("registrations", {"race_code": code}),
        ("volunteer_registrations", {"race_code": code}),
        ("volunteer_assignments", {"race_code": code}),
        ("sponsors", {"race_code": code}),
        ("surveys", {"race_code": code}),
        ("archived_participants", {"race_code": code}),
        ("archived_cheer_messages", {"race_code": code}),
        ("archived_sponsors", {"race_code": code}),
    ]
    
    for col_name, query in collections_to_check:
        try:
            count = await database[col_name].count_documents(query)
            summary["collections"][col_name] = count
        except:
            summary["collections"][col_name] = 0
    
    # Legacy collections (no race_code filter)
    legacy_collections = ["participants", "cheer_messages", "fans"]
    for col_name in legacy_collections:
        try:
            count = await database[col_name].count_documents({})
            summary["collections"][f"{col_name}_legacy"] = count
        except:
            summary["collections"][f"{col_name}_legacy"] = 0
    
    return summary


@router.get("/archived/{code}/participants")
async def get_archived_participants(code: str, db=Depends(lambda: None)):
    """Get archived participants for a specific race"""
    from server import db as database
    
    participants = await database.archived_participants.find(
        {"race_code": code},
        {"_id": 0}
    ).to_list(1000)
    
    return {"participants": participants, "race_code": code}


@router.get("/archived/{code}/cheers")
async def get_archived_cheers(code: str, skip: int = 0, limit: int = 100, db=Depends(lambda: None)):
    """Get archived cheer messages for a specific race"""
    from server import db as database
    
    cheers = await database.archived_cheer_messages.find(
        {"race_code": code},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await database.archived_cheer_messages.count_documents({"race_code": code})
    
    return {"cheers": cheers, "total": total, "race_code": code}


@router.get("/archived/{code}/sponsors")
async def get_archived_sponsors(code: str, db=Depends(lambda: None)):
    """Get archived sponsors for a specific race"""
    from server import db as database
    
    sponsors = await database.archived_sponsors.find(
        {"race_code": code},
        {"_id": 0}
    ).to_list(100)
    
    return {"sponsors": sponsors, "race_code": code}


# ============== MANUAL UPLOADS ==============

@router.post("/upload-manual/{code}/{manual_type}")
async def upload_manual(
    code: str,
    manual_type: str,  # "runners" or "volunteers"
    file: UploadFile = File(...),
    user=Depends(verify_token),
    db=Depends(lambda: None)
):
    """Upload a manual (PDF) for a race - runners or volunteers"""
    from server import db as database
    
    if manual_type not in ["runners", "volunteers"]:
        raise HTTPException(status_code=400, detail="Tipo de manual inválido. Use 'runners' o 'volunteers'")
    
    existing = await database.race_configurations.find_one({"code": code})
    if not existing:
        raise HTTPException(status_code=404, detail="Carrera no encontrada")
    
    # Validate file type
    allowed_types = ["application/pdf"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Solo se permiten archivos PDF")
    
    # Generate filename
    filename = f"manual_{manual_type}_{code}.pdf"

    # Guardar en GridFS: el disco del contenedor se borra en cada despliegue.
    from services import file_storage

    await file_storage.save(filename, await file.read(), "application/pdf", file_storage.FOLDER_MANUALS)

    # Update database with manual URL
    manual_url = f"/api/race-config/manual/{filename}"
    field_name = f"manual_{manual_type}_url"
    
    await database.race_configurations.update_one(
        {"code": code},
        {"$set": {field_name: manual_url, "updated_at": datetime.utcnow()}}
    )
    
    return {
        "message": f"Manual de {'corredores' if manual_type == 'runners' else 'voluntarios'} subido exitosamente",
        "manual_url": manual_url
    }


@router.delete("/delete-manual/{code}/{manual_type}")
async def delete_manual(
    code: str,
    manual_type: str,
    user=Depends(verify_token),
    db=Depends(lambda: None)
):
    """Delete a manual for a race"""
    from server import db as database
    
    if manual_type not in ["runners", "volunteers"]:
        raise HTTPException(status_code=400, detail="Tipo de manual inválido")
    
    existing = await database.race_configurations.find_one({"code": code})
    if not existing:
        raise HTTPException(status_code=404, detail="Carrera no encontrada")
    
    # Delete file if exists
    from services import file_storage

    filename = f"manual_{manual_type}_{code}.pdf"
    await file_storage.delete(filename)

    filepath = MANUALS_DIR / filename
    if filepath.exists():
        os.remove(filepath)

    # Remove URL from database
    field_name = f"manual_{manual_type}_url"
    await database.race_configurations.update_one(
        {"code": code},
        {"$unset": {field_name: ""}, "$set": {"updated_at": datetime.utcnow()}}
    )
    
    return {"message": f"Manual de {'corredores' if manual_type == 'runners' else 'voluntarios'} eliminado"}


@router.get("/manual/{filename}")
async def get_manual(filename: str):
    """Serve a manual PDF file"""
    from services import file_storage

    # Cache corta: el nombre del manual es fijo y se reemplaza al subir uno nuevo.
    return await file_storage.serve(
        filename, disk_dir=MANUALS_DIR, media_type="application/pdf", max_age=300
    )


@router.get("/manuals/{code}")
async def get_race_manuals(code: str, db=Depends(lambda: None)):
    """Get manual URLs for a specific race"""
    from server import db as database
    
    race = await database.race_configurations.find_one({"code": code}, {"_id": 0})
    if not race:
        raise HTTPException(status_code=404, detail="Carrera no encontrada")
    
    return {
        "runners_manual": race.get("manual_runners_url"),
        "volunteers_manual": race.get("manual_volunteers_url"),
        "race_code": code
    }



# ============== MANUAL NOTIFICATIONS ==============

@router.get("/notify-runners-count/{code}")
async def get_runners_count_for_notification(
    code: str,
    user=Depends(verify_token),
    db=Depends(lambda: None)
):
    """Get count of active runners who will receive the manual notification"""
    from server import db as database
    
    # Count active athletes for this race
    count = await database.registrations.count_documents({
        "race_code": code,
        "status": "active"
    })
    
    return {"count": count, "race_code": code}


@router.get("/notify-volunteers-count/{code}")
async def get_volunteers_count_for_notification(
    code: str,
    user=Depends(verify_token),
    db=Depends(lambda: None)
):
    """Get count of registered volunteers who will receive the manual notification"""
    from server import db as database
    
    # Count registered volunteers for this race
    count = await database.volunteer_registrations.count_documents({
        "race_code": code
    })
    
    return {"count": count, "race_code": code}


@router.post("/notify-runners-manual/{code}")
async def notify_runners_manual_available(
    code: str,
    user=Depends(verify_token),
    db=Depends(lambda: None)
):
    """Send email notification to all active runners that the manual is available"""
    from server import db as database
    from services.email_service import send_manual_notification_email
    
    # Get race config to verify manual exists
    race = await database.race_configurations.find_one({"code": code})
    if not race:
        raise HTTPException(status_code=404, detail="Carrera no encontrada")
    
    manual_url = race.get("manual_runners_url")
    if not manual_url:
        raise HTTPException(status_code=400, detail="No hay manual de corredores configurado para esta carrera")
    
    # Get all active athletes for this race
    athletes = await database.registrations.find(
        {"race_code": code, "status": "active"},
        {"_id": 0, "email": 1, "nombre": 1, "apellidos": 1}
    ).to_list(1000)
    
    if not athletes:
        raise HTTPException(status_code=400, detail="No hay atletas activos registrados para esta carrera")
    
    # Build URLs
    frontend_url = os.environ.get("FRONTEND_URL", "https://backyardultrasantodomingo.com")
    view_url = f"{frontend_url}/corredores"
    download_url = f"{frontend_url}{manual_url}"
    race_name = race.get("name", "Backyard Ultra Santo Domingo")
    
    # Send emails
    sent_count = 0
    failed_emails = []
    
    for athlete in athletes:
        email = athlete.get("email")
        if not email:
            continue
            
        nombre = f"{athlete.get('nombre', '')} {athlete.get('apellidos', '')}".strip()
        if not nombre:
            nombre = "Corredor"
        
        success = await send_manual_notification_email(
            to_email=email,
            recipient_name=nombre,
            manual_type="runners",
            race_name=race_name,
            view_url=view_url,
            download_url=download_url
        )
        
        if success:
            sent_count += 1
        else:
            failed_emails.append(email)
    
    return {
        "message": f"Notificación enviada a {sent_count} corredores",
        "sent_count": sent_count,
        "failed_count": len(failed_emails),
        "total_athletes": len(athletes)
    }


@router.post("/notify-volunteers-manual/{code}")
async def notify_volunteers_manual_available(
    code: str,
    user=Depends(verify_token),
    db=Depends(lambda: None)
):
    """Send email notification to all registered volunteers that the manual is available"""
    from server import db as database
    from services.email_service import send_manual_notification_email
    
    # Get race config to verify manual exists
    race = await database.race_configurations.find_one({"code": code})
    if not race:
        raise HTTPException(status_code=404, detail="Carrera no encontrada")
    
    manual_url = race.get("manual_volunteers_url")
    if not manual_url:
        raise HTTPException(status_code=400, detail="No hay manual de voluntarios configurado para esta carrera")
    
    # Get all registered volunteers for this race
    volunteers = await database.volunteer_registrations.find(
        {"race_code": code},
        {"_id": 0, "email": 1, "nombre": 1, "apellidos": 1}
    ).to_list(1000)
    
    if not volunteers:
        raise HTTPException(status_code=400, detail="No hay voluntarios registrados para esta carrera")
    
    # Build URLs
    frontend_url = os.environ.get("FRONTEND_URL", "https://backyardultrasantodomingo.com")
    view_url = f"{frontend_url}/voluntarios"
    download_url = f"{frontend_url}{manual_url}"
    race_name = race.get("name", "Backyard Ultra Santo Domingo")
    
    # Send emails
    sent_count = 0
    failed_emails = []
    
    for volunteer in volunteers:
        email = volunteer.get("email")
        if not email:
            continue
            
        nombre = f"{volunteer.get('nombre', '')} {volunteer.get('apellidos', '')}".strip()
        if not nombre:
            nombre = "Voluntario"
        
        success = await send_manual_notification_email(
            to_email=email,
            recipient_name=nombre,
            manual_type="volunteers",
            race_name=race_name,
            view_url=view_url,
            download_url=download_url
        )
        
        if success:
            sent_count += 1
        else:
            failed_emails.append(email)
    
    return {
        "message": f"Notificación enviada a {sent_count} voluntarios",
        "sent_count": sent_count,
        "failed_count": len(failed_emails),
        "total_volunteers": len(volunteers)
    }



# ==================== FOTOS DEL EVENTO (BYSD LIVE) ====================

@router.get("/live-photos/{code}")
async def get_live_photos(code: str):
    """Fotos del evento para BYSD Live (público).

    Si la carrera pedida aún no tiene fotos propias (una edición futura), se
    devuelven las de la edición más reciente que sí tenga, para que la app no
    quede vacía.
    """
    from server import db as database

    code = code.upper()
    photos = await database.live_photos.find(
        {"race_code": code}, {"_id": 0}
    ).sort("order", 1).to_list(200)
    source = code

    if not photos:
        otras = await database.live_photos.distinct("race_code")
        if otras:
            source = sorted(otras)[-1]
            photos = await database.live_photos.find(
                {"race_code": source}, {"_id": 0}
            ).sort("order", 1).to_list(200)

    return {"photos": photos, "source_race": source if photos else None}


@router.post("/live-photos/{code}", dependencies=[solo_config])
async def upload_live_photos(code: str, files: list[UploadFile] = File(...)):
    """Sube fotos del evento (varias a la vez) a GridFS."""
    from server import db as database
    from services import file_storage
    import uuid as uuid_module

    code = code.upper()
    race = await database.race_configurations.find_one({"code": code})
    if not race and code != "BYSD-2026":  # la legado no vive en race_configurations
        raise HTTPException(status_code=404, detail="Carrera no encontrada")

    allowed_types = ["image/png", "image/jpeg", "image/jpg", "image/webp"]
    count = await database.live_photos.count_documents({"race_code": code})
    subidas = []
    for file in files:
        if file.content_type not in allowed_types:
            raise HTTPException(status_code=400, detail=f"Tipo no permitido ({file.filename}). Use PNG, JPG o WEBP")
        content = await file.read()
        ext_original = file.filename.split(".")[-1] if file.filename and "." in file.filename else "jpg"
        content, ext, content_type = file_storage.compress_image(content, ext_original, file.content_type)
        filename = f"{code}_{uuid_module.uuid4().hex[:10]}.{ext}"
        await file_storage.save(filename, content, content_type, file_storage.FOLDER_LIVE_PHOTOS)
        doc = {
            "race_code": code,
            "filename": filename,
            "url": f"/api/uploads/live_photos/{filename}",
            "order": count + len(subidas),
            "uploaded_at": datetime.utcnow(),
        }
        await database.live_photos.insert_one(doc)
        doc.pop("_id", None)
        subidas.append(doc)

    return {"message": f"{len(subidas)} foto(s) subidas", "photos": subidas}


@router.delete("/live-photos/{code}/{filename}", dependencies=[solo_config])
async def delete_live_photo(code: str, filename: str):
    from server import db as database
    from services import file_storage

    result = await database.live_photos.delete_one({"race_code": code.upper(), "filename": filename})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Foto no encontrada")
    await file_storage.delete(filename)
    return {"message": "Foto eliminada"}
