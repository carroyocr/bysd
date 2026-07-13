"""
Event photo album: scrapes a public Google Photos shared album and exposes
the photo URLs plus download proxies (single + zip) for the frontend.
Photos are served directly from Google (lh3.googleusercontent.com); we only
proxy downloads to force attachment behaviour and bypass CORS.
"""
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response, StreamingResponse
import urllib.request
import gzip
import re
import io
import zipfile
import time
import asyncio

router = APIRouter(prefix="/album", tags=["album"])

# Public Google Photos shared album (2026 event)
ALBUM_SHARE_URL = "https://photos.app.goo.gl/u1R2bTHbA1fzgQd58"

_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
_PHOTO_RE = re.compile(r"https://lh3\.googleusercontent\.com/pw/[A-Za-z0-9_\-]+")
_ALLOWED_RE = re.compile(r"^https://lh3\.googleusercontent\.com/pw/[A-Za-z0-9_\-]+$")

# In-memory cache
_cache = {"urls": [], "ts": 0.0}
_CACHE_TTL = 60 * 30  # 30 minutes


def _fetch_url(url: str, timeout: int = 30) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": _UA})
    resp = urllib.request.urlopen(req, timeout=timeout)
    data = resp.read()
    if resp.headers.get("Content-Encoding") == "gzip":
        data = gzip.decompress(data)
    return data, resp


def _scrape_album() -> list:
    data, resp = _fetch_url(ALBUM_SHARE_URL)
    html = data.decode("utf-8", "ignore")
    seen = set()
    urls = []
    for u in _PHOTO_RE.findall(html):
        if u not in seen:
            seen.add(u)
            urls.append(u)
    return urls


def _get_photos(force: bool = False) -> list:
    now = time.time()
    if force or not _cache["urls"] or (now - _cache["ts"]) > _CACHE_TTL:
        try:
            urls = _scrape_album()
            if urls:
                _cache["urls"] = urls
                _cache["ts"] = now
        except Exception as e:
            # Keep any stale cache on failure
            if not _cache["urls"]:
                raise HTTPException(status_code=502, detail=f"No se pudo cargar el álbum: {e}")
    return _cache["urls"]


@router.get("/photos")
async def get_photos(refresh: bool = Query(False)):
    """Return the list of photo base URLs from the shared album."""
    urls = await asyncio.to_thread(_get_photos, refresh)
    photos = [{"index": i, "url": u} for i, u in enumerate(urls)]
    return {"photos": photos, "count": len(photos)}


def _validate(base_url: str) -> str:
    if not _ALLOWED_RE.match(base_url or ""):
        raise HTTPException(status_code=400, detail="URL no permitida")
    return base_url


@router.get("/download")
async def download_photo(u: str = Query(...)):
    """Proxy a single photo download (original quality) as an attachment."""
    base = _validate(u)

    def _dl():
        data, resp = _fetch_url(base + "=d")
        ct = resp.headers.get("Content-Type", "image/jpeg")
        return data, ct

    data, ct = await asyncio.to_thread(_dl)
    ext = "jpg" if "jpeg" in ct or "jpg" in ct else (ct.split("/")[-1] if "/" in ct else "jpg")
    return Response(
        content=data,
        media_type=ct,
        headers={"Content-Disposition": f'attachment; filename="foto-backyard-2026.{ext}"'},
    )


@router.post("/download-zip")
async def download_zip(payload: dict):
    """Bundle selected photos (originals) into a single ZIP for download."""
    urls = payload.get("urls") or []
    if not urls:
        raise HTTPException(status_code=400, detail="No hay fotos seleccionadas")
    if len(urls) > 60:
        raise HTTPException(status_code=400, detail="Máximo 60 fotos por descarga")
    valid = [_validate(u) for u in urls]

    def _build_zip():
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for i, base in enumerate(valid, start=1):
                try:
                    data, resp = _fetch_url(base + "=d")
                    ct = resp.headers.get("Content-Type", "image/jpeg")
                    ext = "jpg" if ("jpeg" in ct or "jpg" in ct) else (ct.split("/")[-1] if "/" in ct else "jpg")
                    zf.writestr(f"foto-backyard-2026-{i:03d}.{ext}", data)
                except Exception:
                    continue
        buf.seek(0)
        return buf.getvalue()

    content = await asyncio.to_thread(_build_zip)
    return Response(
        content=content,
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="fotos-backyard-2026.zip"'},
    )
