"""Rutas que sirven los archivos subidos.

Se registran antes de los mounts de StaticFiles en server.py para que tengan
prioridad: primero se busca en GridFS y, si no esta, se cae al disco (ahi viven
los archivos que llegan con el build). Las URLs son las mismas que ya estan
guardadas en Mongo, para que los registros viejos sigan funcionando.
"""
from pathlib import Path

from fastapi import APIRouter

from services import file_storage

router = APIRouter(tags=["files"])

BACKEND_DIR = Path(__file__).parent.parent
STATIC_DIR = BACKEND_DIR / "static"


@router.get("/api/static/athlete_photos/{filename}")
async def get_athlete_photo(filename: str):
    return await file_storage.serve(filename, disk_dir=STATIC_DIR / "athlete_photos")


@router.get("/api/static/participant_photos/{filename}")
async def get_participant_photo(filename: str):
    return await file_storage.serve(filename, disk_dir=STATIC_DIR / "participant_photos")


# Las inscripciones viejas guardaron la foto con esta URL, sin el prefijo /api.
@router.get("/static/participant_photos/{filename}")
async def get_participant_photo_legacy(filename: str):
    return await file_storage.serve(filename, disk_dir=STATIC_DIR / "participant_photos")


@router.get("/api/uploads/receipts/{filename}")
async def get_receipt(filename: str):
    return await file_storage.serve(filename, disk_dir=BACKEND_DIR / "uploads" / "receipts")


@router.get("/api/uploads/live_photos/{filename}")
async def serve_live_photo(filename: str):
    return await file_storage.serve(filename, disk_dir=STATIC_DIR / "uploads" / "live_photos")


@router.get("/api/uploads/ads/{filename}")
async def serve_ad_logo(filename: str):
    return await file_storage.serve(filename, disk_dir=STATIC_DIR / "uploads" / "ads")


@router.get("/api/uploads/sponsors/{filename}")
async def get_sponsor_logo(filename: str):
    return await file_storage.serve(filename, disk_dir=STATIC_DIR / "uploads" / "sponsors")
