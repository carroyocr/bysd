"""
Event photo album: scrapes a public Google Photos shared album and exposes
the photo URLs plus download proxies (single + zip) for the frontend.
Photos are served directly from Google (lh3.googleusercontent.com); we only
proxy downloads to force attachment behaviour and bypass CORS.
Pagination: the shared album loads photos in batches via the internal
`snAcKc` batchexecute RPC (public album, no auth needed).
"""
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response, StreamingResponse
import urllib.request
import urllib.parse
import gzip
import re
import io
import zipfile
import time
import asyncio
import json
import logging
import threading

router = APIRouter(prefix="/album", tags=["album"])

# Public Google Photos shared album (2026 event)
ALBUM_SHARE_URL = "https://photos.app.goo.gl/u1R2bTHbA1fzgQd58"

_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
_ALLOWED_RE = re.compile(r"^https://lh3\.googleusercontent\.com/pw/[A-Za-z0-9_\-]+$")

# In-memory cache
_cache = {"urls": [], "ts": 0.0}
_CACHE_TTL = 60 * 30  # 30 minutes
# El scraping tarda varios segundos: sin candado cada visita simultanea lanzaria
# el suyo y ninguna terminaria a tiempo.
_scrape_lock = threading.Lock()


def _http(url: str, data: bytes = None, headers: dict = None, timeout: int = 30):
    h = {"User-Agent": _UA}
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, data=data, headers=h, method="POST" if data else "GET")
    resp = urllib.request.urlopen(req, timeout=timeout)
    raw = resp.read()
    if resp.headers.get("Content-Encoding") == "gzip":
        raw = gzip.decompress(raw)
    return raw, resp


def _bracket_match(s: str, start: int):
    depth = 0
    i = start
    while i < len(s):
        c = s[i]
        if c == "[":
            depth += 1
        elif c == "]":
            depth -= 1
            if depth == 0:
                return s[start:i + 1]
        i += 1
    return None


def _initial_block(html: str):
    """Find the AF_initDataCallback data array that contains the media items.

    La página trae varios bloques `data:` con URLs de fotos y su orden cambia
    entre respuestas, así que no vale quedarse con el primero: se escoge el que
    de verdad contiene la lista de fotos (el que más URLs aporta).
    """
    best = None
    best_count = 0
    for m in re.finditer(r"data:", html):
        start = html.find("[", m.end())
        if start < 0:
            continue
        blk = _bracket_match(html, start)
        if not blk or "googleusercontent.com/pw" not in blk:
            continue
        try:
            parsed = json.loads(blk)
        except Exception:
            continue
        media = parsed[1] if isinstance(parsed, list) and len(parsed) > 1 and isinstance(parsed[1], list) else []
        count = len(_extract_urls(media))
        if count > best_count:
            best, best_count = parsed, count
    return best


def _extract_urls(media_items: list) -> list:
    urls = []
    for it in media_items:
        try:
            u = it[1][0]
            if isinstance(u, str) and u.startswith("https://lh3.googleusercontent.com/pw/"):
                urls.append(u)
        except Exception:
            continue
    return urls


def _urls_from_html(html: str) -> list:
    """Último recurso: sacar las URLs del HTML sin entender su estructura."""
    seen = set(); out = []
    for u in re.findall(r"https://lh3\.googleusercontent\.com/pw/[A-Za-z0-9_\-]+", html):
        if u not in seen:
            seen.add(u); out.append(u)
    return out


def _scrape_album() -> list:
    """Fetch ALL photos from the public shared album, following pagination."""
    raw, resp = _http(ALBUM_SHARE_URL)
    html = raw.decode("utf-8", "ignore")
    final = resp.geturl()

    m = re.search(r"/share/([^?/]+)\?key=([^&\"]+)", final)
    if not m:
        # Album may have no key; fall back to simple regex extraction
        return _urls_from_html(html)

    album_key, auth_key = m.group(1), m.group(2)
    path = urllib.parse.urlparse(final).path

    def wiz(key):
        mm = re.search(r'"%s":"(.*?)"' % key, html)
        return mm.group(1) if mm else ""
    at, fsid, bl = wiz("SNlM0e"), wiz("FdrFJe"), wiz("cfb2h")

    arr = _initial_block(html)
    if not arr:
        return _urls_from_html(html)
    media_all = list(arr[1]) if len(arr) > 1 and isinstance(arr[1], list) else []
    token = arr[2] if len(arr) > 2 else None

    def get_page(page_id):
        req_data = [album_key, page_id, None, auth_key]
        wrapped = [[["snAcKc", json.dumps(req_data), None, "generic"]]]
        body = "f.req=" + urllib.parse.quote(json.dumps(wrapped)) + "&at=" + urllib.parse.quote(at) + "&"
        params = {"rpcids": "snAcKc", "source-path": path, "f.sid": fsid, "bl": bl, "hl": "en", "_reqid": "1", "rt": "c"}
        url = "https://photos.google.com/_/PhotosUi/data/batchexecute?" + urllib.parse.urlencode(params)
        raw2, _ = _http(url, data=body.encode(), headers={"content-type": "application/x-www-form-urlencoded;charset=UTF-8"})
        txt = raw2.decode("utf-8", "ignore")
        lines = [l for l in txt.split("\n") if "wrb.fr" in l]
        if not lines:
            return None, None
        parsed = json.loads(lines[0])
        payload = json.loads(parsed[0][2])
        media = payload[1] if len(payload) > 1 and isinstance(payload[1], list) else []
        tok = payload[2] if len(payload) > 2 else None
        return media, tok

    guard = 0
    while token and guard < 50:
        media, token = get_page(token)
        guard += 1
        if not media:
            break
        media_all.extend(media)

    urls = _extract_urls(media_all)
    # dedupe preserving order
    seen = set(); out = []
    for u in urls:
        if u not in seen:
            seen.add(u); out.append(u)
    return out


def _is_fresh() -> bool:
    return bool(_cache["urls"]) and (time.time() - _cache["ts"]) <= _CACHE_TTL


def _get_photos(force: bool = False) -> list:
    if _is_fresh() and not force:
        return _cache["urls"]

    with _scrape_lock:
        # Otra petición pudo haber refrescado la caché mientras esperábamos aquí.
        if _is_fresh() and not force:
            return _cache["urls"]
        try:
            urls = _scrape_album()
            if urls:
                _cache["urls"] = urls
                _cache["ts"] = time.time()
        except Exception as e:
            logging.warning(f"Album: fallo al leer el álbum compartido: {e}")
        return _cache["urls"]


def prewarm_cache():
    """Llenar la caché al arrancar para que la primera visita no espere el scraping."""
    try:
        urls = _get_photos()
        logging.info(f"Album: caché precargada con {len(urls)} fotos")
    except Exception as e:
        logging.warning(f"Album: no se pudo precargar la caché: {e}")


@router.get("/photos")
async def get_photos(refresh: bool = Query(False)):
    """Return the list of photo base URLs from the shared album."""
    urls = await asyncio.to_thread(_get_photos, refresh)
    # Sin fotos no distinguimos "álbum vacío" de "no se pudo leer": devolvemos 503
    # para que el frontend reintente en vez de anunciar que no hay fotos.
    if not urls:
        raise HTTPException(status_code=503, detail="El álbum aún no está disponible, inténtalo en unos segundos")
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
        data, resp = _http(base + "=d")
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
                    data, resp = _http(base + "=d")
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
