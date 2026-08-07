"""Almacenamiento de archivos subidos, en GridFS (MongoDB).

El sistema de archivos del contenedor en Render es efimero: se borra completo en
cada despliegue y en cada reinicio. Por eso nada que suba un usuario puede
guardarse en disco; todo vive aqui, en GridFS, junto a los datos en Atlas.

Los archivos que llegan con el build (los que estan commiteados en git, como los
certificados y las fotos de la migracion de abril) siguen en disco y se sirven
como respaldo cuando el nombre no esta en GridFS.
"""
import io
import mimetypes
import logging
from pathlib import Path
from typing import Optional, Tuple

from fastapi import HTTPException
from fastapi.responses import FileResponse, Response
from gridfs.errors import NoFile
from motor.motor_asyncio import AsyncIOMotorGridFSBucket

logger = logging.getLogger(__name__)

BUCKET_NAME = "uploads"

# Las fotos se reescalan antes de guardarse para no llenar el espacio de Atlas.
# 1600px en el lado mayor equivale a ~5 pulgadas a 300dpi: suficiente para la
# credencial impresa, y baja un JPG de camara de ~4MB a ~400KB.
PHOTO_MAX_SIDE = 1600
PHOTO_QUALITY = 88

# Carpetas logicas (el equivalente a los directorios que se usaban en disco).
FOLDER_ATHLETE_PHOTOS = "athlete_photos"
FOLDER_PARTICIPANT_PHOTOS = "participant_photos"
FOLDER_RECEIPTS = "receipts"
FOLDER_SPONSORS = "sponsors"
FOLDER_ADS = "ads"
FOLDER_LIVE_PHOTOS = "live_photos"
FOLDER_LOGOS = "logos"
FOLDER_MANUALS = "manuals"


def _bucket():
    # Import diferido: server importa las rutas, que importan este modulo.
    from server import db

    return AsyncIOMotorGridFSBucket(db, bucket_name=BUCKET_NAME)


def safe_filename(filename: str) -> str:
    """Rechaza nombres que intenten salir de la carpeta al servir desde disco."""
    if not filename or "/" in filename or "\\" in filename or filename.startswith("."):
        raise HTTPException(status_code=400, detail="Nombre de archivo no valido")
    return filename


def guess_content_type(filename: str) -> str:
    return mimetypes.guess_type(filename)[0] or "application/octet-stream"


async def save(filename: str, content: bytes, content_type: str, folder: str) -> str:
    """Guarda el archivo en GridFS y devuelve su nombre."""
    await delete(filename)
    await _bucket().upload_from_stream(
        filename,
        content,
        metadata={"folder": folder, "content_type": content_type},
    )
    return filename


async def load(filename: str) -> Optional[Tuple[bytes, str]]:
    """Devuelve (contenido, content_type) o None si el archivo no esta en GridFS."""
    try:
        stream = await _bucket().open_download_stream_by_name(filename)
    except NoFile:
        return None
    content = await stream.read()
    metadata = stream.metadata or {}
    return content, metadata.get("content_type") or guess_content_type(filename)


async def delete(filename: str) -> int:
    """Borra todas las revisiones de un nombre. Devuelve cuantas borro."""
    bucket = _bucket()
    borrados = 0
    # bucket.find() entrega objetos GridOut, no diccionarios.
    async for archivo in bucket.find({"filename": filename}):
        await bucket.delete(archivo._id)
        borrados += 1
    return borrados


async def exists(filename: str) -> bool:
    return await _bucket().find({"filename": filename}).to_list(length=1) != []


async def serve(
    filename: str,
    disk_dir: Optional[Path] = None,
    media_type: Optional[str] = None,
    max_age: int = 86400,
) -> Response:
    """Sirve un archivo: primero GridFS, luego el disco (archivos del build).

    max_age corto para nombres fijos que se reemplazan (logos, manuales); largo
    para los que llevan un hash aleatorio y nunca cambian de contenido.
    """
    safe_filename(filename)
    cache = {"Cache-Control": f"public, max-age={max_age}"}

    encontrado = await load(filename)
    if encontrado:
        content, content_type = encontrado
        return Response(content=content, media_type=media_type or content_type, headers=cache)

    if disk_dir:
        filepath = disk_dir / filename
        if filepath.is_file():
            return FileResponse(filepath, media_type=media_type, headers=cache)

    raise HTTPException(status_code=404, detail="Archivo no encontrado")


def compress_image(
    content: bytes,
    ext_original: str = "jpg",
    content_type_original: str = "image/jpeg",
) -> Tuple[bytes, str, str]:
    """Reescala y comprime una foto. Devuelve (contenido, extension, content_type).

    Se queda con la version mas liviana de las dos: pasar a JPEG casi siempre
    gana con fotos de camara, pero una captura de pantalla con colores planos
    puede pesar menos como PNG, y ahi convertirla seria contraproducente.

    Si la imagen no se puede procesar, devuelve el original sin tocar para no
    perder la subida del usuario por un formato raro.
    """
    try:
        from PIL import Image, ImageOps

        imagen = Image.open(io.BytesIO(content))
        # Respeta la orientacion EXIF: sin esto las fotos de celular salen giradas.
        imagen = ImageOps.exif_transpose(imagen)
        if imagen.mode not in ("RGB", "L"):
            imagen = imagen.convert("RGB")
        imagen.thumbnail((PHOTO_MAX_SIDE, PHOTO_MAX_SIDE), Image.LANCZOS)

        salida = io.BytesIO()
        imagen.save(salida, format="JPEG", quality=PHOTO_QUALITY, optimize=True, progressive=True)
        comprimida = salida.getvalue()

        if len(comprimida) >= len(content):
            return content, ext_original, content_type_original
        return comprimida, "jpg", "image/jpeg"
    except Exception as e:
        logger.warning(f"No se pudo comprimir la imagen, se guarda el original: {e}")
        return content, ext_original, content_type_original
