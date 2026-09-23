"""Los dorsales de una carrera, para mandar a imprimir.

Una sola pantalla del panel para las dos carreras que conviven: el campeonato
mundial (titulares y reservas, que estan inscritos en `registrations` como
cualquier corredor, con su `categoria`) y la carrera abierta de enero. Por eso
todo aqui cuelga de `race_code` y no hay una sola rama que distinga una de la
otra: si manana hay una tercera, funciona sin tocar nada.

El nombre que se imprime **no** es el nombre completo: es el que el propio
atleta escribio para personalizar su dorsal y su camiseta
(`personalizacion_camiseta`), que puede estar en la inscripcion o en su perfil.
Se miran los dos sitios, en ese orden, igual que hace el desglose de camisetas:
la nomina se arma antes de que el atleta llene nada, y lo que llene despues
puede quedar en cualquiera de los dos.

El diseno se guarda por carrera (`dorsal_disenos`): los textos, los colores y
el tamano del QR, mas la imagen base y la tipografia que se hayan subido. Esas
dos van a GridFS, como todo lo que sube un usuario -- el disco del contenedor
se borra en cada despliegue.

El PDF lo arma `services/dorsales.py`, que es donde estan las medidas de la
imprenta y donde no entra ni un color RGB.
"""
import logging
import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from services import dorsales, file_storage, races
from services.auth import require_permission
from services.env_utils import get_env

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/dorsales", tags=["dorsales"])

# Mismo permiso que las inscripciones y la nomina del campeonato: quien lleva
# los atletas es quien manda los dorsales a la imprenta.
solo_atletas = Depends(require_permission("athletes"))

COLECCION = "dorsal_disenos"

SITIO = (get_env("FRONTEND_URL", "https://backyardultrasantodomingo.com") or "").rstrip("/")

# La imagen base se guarda tal cual la mando la organizacion; el limite es el
# de un arte de 300 dpi a tamano de dorsal con margen de sobra.
MAX_FONDO = 20 * 1024 * 1024
MAX_FUENTE = 4 * 1024 * 1024
TIPOS_FONDO = {"image/png", "image/jpeg", "image/jpg", "image/webp"}
EXTENSION = {"image/png": "png", "image/jpeg": "jpg", "image/jpg": "jpg", "image/webp": "webp"}

# Por debajo de esto la imagen sale pixelada en un dorsal que se mira de cerca.
DPI_MINIMO = 200

DISENO_POR_DEFECTO = {
    "evento": "",
    "pie": "",
    "color_fondo": dorsales.COLOR_FONDO,
    "color_banda": dorsales.COLOR_BANDA,
    "color_texto_banda": dorsales.COLOR_TEXTO_BANDA,
    "color_numero": dorsales.COLOR_NUMERO,
    "color_nombre": dorsales.COLOR_NOMBRE,
    "mostrar_bandas": True,
    "mostrar_qr": True,
    "qr_posicion": "derecha",
    "qr_lado_mm": 40,
    "marcas_corte": True,
    "guias": False,
    "usar_nombre_si_falta": True,
}

# El campeonato lleva su nombre oficial en ingles, que no es el nombre con el
# que la carrera esta dada de alta en el sistema.
EVENTO_POR_CARRERA = {
    "MUNDIAL-2026": "Big's Backyard Ultra World Team Championship 2026",
}


def get_db():
    from server import db

    return db


# ==================== LOS CORREDORES ====================


def _texto(*valores) -> str:
    """El primero de esos campos que traiga algo."""
    for valor in valores:
        limpio = (valor or "").strip() if isinstance(valor, str) else ""
        if limpio:
            return limpio
    return ""


async def _perfiles_de(db, inscripciones: list) -> dict:
    """Los perfiles de atleta de esas inscripciones, en una sola consulta.

    Devuelve el perfil indexado por correo y por id, que son las dos formas en
    que una inscripcion puede apuntar al suyo.
    """
    from bson import ObjectId

    ids, correos = [], []
    for inscripcion in inscripciones:
        if inscripcion.get("athlete_id"):
            try:
                ids.append(ObjectId(inscripcion["athlete_id"]))
            except Exception:
                pass
        correo = (inscripcion.get("email") or "").lower()
        if correo and not correo.endswith(".invalid"):
            correos.append(correo)

    if not ids and not correos:
        return {}

    atletas = await db.athletes.find(
        {"$or": [{"_id": {"$in": ids}}, {"email": {"$in": correos}}]},
        {"email": 1, "personalizacion_camiseta": 1},
    ).to_list(1000)

    indice = {}
    for atleta in atletas:
        indice[str(atleta["_id"])] = atleta
        indice[(atleta.get("email") or "").lower()] = atleta
    return indice


def _orden_por_dorsal(inscripcion: dict):
    numero = str(inscripcion.get("bib") or "")
    digitos = re.sub(r"\D", "", numero)
    return (0, int(digitos)) if digitos else (1, numero)


@router.get("/corredores", dependencies=[solo_atletas])
async def corredores(race_code: str = Depends(races.carrera_del_panel), db=Depends(get_db)):
    """Quien tiene dorsal en esa carrera y que nombre le toca impreso.

    Salen tambien los que no han llenado la personalizacion: son justo los que
    hay que reclamar antes de mandar nada a la imprenta, asi que ocultarlos
    seria lo contrario de lo util.
    """
    carrera = await races.obtener_carrera(db, race_code)

    inscripciones = await db.registrations.find(
        {"race_code": race_code, "bib": {"$nin": [None, ""]}},
        {
            "_id": 0, "bib": 1, "nombre": 1, "apellidos": 1, "email": 1, "athlete_id": 1,
            "categoria": 1, "status": 1, "payment_status": 1, "personalizacion_camiseta": 1,
        },
    ).to_list(2000)
    inscripciones.sort(key=_orden_por_dorsal)

    perfiles = await _perfiles_de(db, inscripciones)

    lista = []
    for inscripcion in inscripciones:
        perfil = perfiles.get(inscripcion.get("athlete_id") or "") or perfiles.get(
            (inscripcion.get("email") or "").lower()
        ) or {}
        lista.append({
            "bib": str(inscripcion.get("bib")),
            "nombre": _texto(inscripcion.get("nombre")),
            "apellidos": _texto(inscripcion.get("apellidos")),
            "personalizacion": _texto(
                inscripcion.get("personalizacion_camiseta"),
                perfil.get("personalizacion_camiseta"),
            ),
            "categoria": _texto(inscripcion.get("categoria")),
            "status": _texto(inscripcion.get("status")),
            "payment_status": _texto(inscripcion.get("payment_status")),
        })

    return {
        "race_code": race_code,
        "race_name": carrera.get("name") or race_code,
        "total": len(lista),
        "sin_personalizacion": sum(1 for c in lista if not c["personalizacion"]),
        "corredores": lista,
    }


# ==================== EL DISENO ====================


class Diseno(BaseModel):
    evento: Optional[str] = Field(None, max_length=120)
    pie: Optional[str] = Field(None, max_length=160)
    color_fondo: Optional[str] = None
    color_banda: Optional[str] = None
    color_texto_banda: Optional[str] = None
    color_numero: Optional[str] = None
    color_nombre: Optional[str] = None
    mostrar_bandas: Optional[bool] = None
    mostrar_qr: Optional[bool] = None
    qr_posicion: Optional[str] = None
    qr_lado_mm: Optional[float] = Field(None, ge=20, le=70)
    marcas_corte: Optional[bool] = None
    guias: Optional[bool] = None
    usar_nombre_si_falta: Optional[bool] = None


class Corredor(BaseModel):
    bib: str = Field(..., max_length=20)
    nombre: Optional[str] = Field(None, max_length=40)


class Peticion(BaseModel):
    diseno: Diseno = Diseno()
    corredores: list[Corredor] = []


def _nombre_fondo(race_code: str, extension: str) -> str:
    return f"dorsal_fondo_{race_code}.{extension}"


def _nombre_fuente(race_code: str) -> str:
    return f"dorsal_fuente_{race_code}.ttf"


MESES = (
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
)


def _fecha_larga(iso: Optional[str]) -> str:
    """"2026-10-17" -> "17 de octubre de 2026". Lo que se lee en un dorsal."""
    try:
        anio, mes, dia = (int(p) for p in (iso or "").split("-"))
        return f"{dia} de {MESES[mes - 1]} de {anio}"
    except (ValueError, IndexError):
        return iso or ""


async def _diseno_guardado(db, race_code: str, carrera: dict) -> dict:
    guardado = await db[COLECCION].find_one({"race_code": race_code}, {"_id": 0}) or {}
    diseno = {**DISENO_POR_DEFECTO, **guardado}
    # Textos de arranque, solo la primera vez: se mira si el campo esta
    # guardado, no si trae algo. Vaciar el pie es como se quita la banda de
    # abajo, y rellenarlo otra vez seria no dejar quitarla nunca.
    if "evento" not in guardado:
        diseno["evento"] = EVENTO_POR_CARRERA.get(race_code) or carrera.get("name") or race_code
    if "pie" not in guardado:
        diseno["pie"] = " · ".join(
            p for p in (_fecha_larga(carrera.get("date")), carrera.get("location")) if p
        )
    diseno.pop("updated_at", None)
    diseno.pop("updated_by", None)
    return diseno


@router.get("/diseno", dependencies=[solo_atletas])
async def leer_diseno(race_code: str = Depends(races.carrera_del_panel), db=Depends(get_db)):
    carrera = await races.obtener_carrera(db, race_code)
    return {"race_code": race_code, "diseno": await _diseno_guardado(db, race_code, carrera)}


@router.put("/diseno")
async def guardar_diseno(
    datos: Diseno,
    race_code: str = Depends(races.carrera_del_panel),
    usuario: dict = solo_atletas,
    db=Depends(get_db),
):
    carrera = await races.obtener_carrera(db, race_code)
    cambios = {k: v for k, v in datos.model_dump().items() if v is not None}
    cambios["updated_at"] = datetime.now(timezone.utc)
    cambios["updated_by"] = usuario.get("username")
    await db[COLECCION].update_one(
        {"race_code": race_code}, {"$set": cambios}, upsert=True
    )
    return {"race_code": race_code, "diseno": await _diseno_guardado(db, race_code, carrera)}


# ==================== LA IMAGEN BASE Y LA TIPOGRAFIA ====================


@router.post("/fondo", dependencies=[solo_atletas])
async def subir_fondo(
    race_code: str = Depends(races.carrera_del_panel),
    archivo: UploadFile = File(...),
    db=Depends(get_db),
):
    """El arte de fondo del dorsal, a tamano de sangrado (8.5 x 5.75 pulgadas).

    Se avisa de la resolucion a la que queda, no se rechaza: a veces se prueba
    con un boceto ligero antes de tener el arte final.
    """
    if archivo.content_type not in TIPOS_FONDO:
        raise HTTPException(status_code=400, detail="El diseño base debe ser PNG, JPG o WEBP")

    contenido = await archivo.read()
    if len(contenido) > MAX_FONDO:
        raise HTTPException(status_code=400, detail="La imagen no puede pasar de 20 MB")

    dpi = dorsales.dpi_del_fondo(contenido)
    if dpi is None:
        raise HTTPException(status_code=400, detail="Esa imagen no se pudo leer")

    anterior = await db[COLECCION].find_one({"race_code": race_code}, {"fondo_archivo": 1})
    if anterior and anterior.get("fondo_archivo"):
        await file_storage.delete(anterior["fondo_archivo"])

    nombre = _nombre_fondo(race_code, EXTENSION[archivo.content_type])
    await file_storage.save(nombre, contenido, archivo.content_type, file_storage.FOLDER_DORSALES)
    await db[COLECCION].update_one(
        {"race_code": race_code},
        {"$set": {
            "fondo_archivo": nombre,
            "fondo_nombre_original": archivo.filename,
            "fondo_dpi": dpi,
            "updated_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )
    return {
        "fondo_archivo": nombre,
        "fondo_nombre_original": archivo.filename,
        "fondo_dpi": dpi,
        "aviso": None if dpi >= DPI_MINIMO else (
            f"La imagen queda a {dpi} dpi al tamaño del dorsal; para imprenta se piden 300."
        ),
    }


@router.delete("/fondo", dependencies=[solo_atletas])
async def quitar_fondo(race_code: str = Depends(races.carrera_del_panel), db=Depends(get_db)):
    guardado = await db[COLECCION].find_one({"race_code": race_code}, {"fondo_archivo": 1})
    if guardado and guardado.get("fondo_archivo"):
        await file_storage.delete(guardado["fondo_archivo"])
    await db[COLECCION].update_one(
        {"race_code": race_code},
        {"$unset": {"fondo_archivo": "", "fondo_nombre_original": "", "fondo_dpi": ""}},
    )
    return {"message": "Diseño base quitado"}


@router.post("/fuente", dependencies=[solo_atletas])
async def subir_fuente(
    race_code: str = Depends(races.carrera_del_panel),
    archivo: UploadFile = File(...),
    db=Depends(get_db),
):
    """La tipografia del dorsal, incrustada en el PDF.

    La imprenta pide que las fuentes especiales viajen con el arte; incrustada
    ya no hay nada que mandar aparte.
    """
    if not (archivo.filename or "").lower().endswith((".ttf", ".otf")):
        raise HTTPException(status_code=400, detail="La tipografía debe ser un .ttf")

    contenido = await archivo.read()
    if len(contenido) > MAX_FUENTE:
        raise HTTPException(status_code=400, detail="La tipografía no puede pasar de 4 MB")
    if dorsales.registrar_fuente(contenido) == dorsales.FUENTE_BASE:
        raise HTTPException(
            status_code=400,
            detail="Ese archivo no se pudo leer como tipografía (debe ser TrueType, .ttf)",
        )

    nombre = _nombre_fuente(race_code)
    await file_storage.save(nombre, contenido, "font/ttf", file_storage.FOLDER_DORSALES)
    await db[COLECCION].update_one(
        {"race_code": race_code},
        {"$set": {
            "fuente_archivo": nombre,
            "fuente_nombre_original": archivo.filename,
            "updated_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )
    return {"fuente_archivo": nombre, "fuente_nombre_original": archivo.filename}


@router.delete("/fuente", dependencies=[solo_atletas])
async def quitar_fuente(race_code: str = Depends(races.carrera_del_panel), db=Depends(get_db)):
    guardado = await db[COLECCION].find_one({"race_code": race_code}, {"fuente_archivo": 1})
    if guardado and guardado.get("fuente_archivo"):
        await file_storage.delete(guardado["fuente_archivo"])
    await db[COLECCION].update_one(
        {"race_code": race_code},
        {"$unset": {"fuente_archivo": "", "fuente_nombre_original": ""}},
    )
    return {"message": "Tipografía quitada"}


# ==================== EL PDF ====================


async def _archivo(db, race_code: str, campo: str) -> Optional[bytes]:
    guardado = await db[COLECCION].find_one({"race_code": race_code}, {campo: 1})
    nombre = (guardado or {}).get(campo)
    if not nombre:
        return None
    archivo = await file_storage.load(nombre)
    return archivo[0] if archivo else None


@router.post("/pdf", dependencies=[solo_atletas])
async def generar_pdf(
    peticion: Peticion,
    race_code: str = Depends(races.carrera_del_panel),
    db=Depends(get_db),
):
    """Los dorsales pedidos, uno por pagina, listos para la imprenta.

    El QR no se acepta de fuera: se arma aqui con el dorsal y la carrera, que
    es lo unico que hace que el escaneo anote la vuelta donde debe. Por eso
    tampoco se admite un dorsal que no este inscrito en esta carrera: un QR
    bonito que no lleva a nadie es peor que no llevar QR.
    """
    carrera = await races.obtener_carrera(db, race_code)
    diseno = {**await _diseno_guardado(db, race_code, carrera),
              **{k: v for k, v in peticion.diseno.model_dump().items() if v is not None}}

    if not peticion.corredores:
        raise HTTPException(status_code=400, detail="No hay ningún corredor seleccionado")

    inscritos = await db.registrations.find(
        {"race_code": race_code, "bib": {"$nin": [None, ""]}}, {"_id": 0, "bib": 1}
    ).to_list(2000)
    validos = {str(i["bib"]) for i in inscritos}

    lista = []
    for corredor in peticion.corredores:
        bib = corredor.bib.strip()
        if bib not in validos:
            raise HTTPException(
                status_code=400, detail=f"El dorsal {bib} no está inscrito en {race_code}"
            )
        lista.append({
            "numero": bib,
            "nombre": (corredor.nombre or "").strip(),
            "qr_url": _url_de_escaneo(bib, race_code) if diseno.get("mostrar_qr") else "",
        })

    pdf = dorsales.construir_pdf(
        lista,
        diseno,
        fondo=await _archivo(db, race_code, "fondo_archivo"),
        fuente=await _archivo(db, race_code, "fuente_archivo"),
    )
    sufijo = lista[0]["numero"] if len(lista) == 1 else f"{len(lista)}"
    return StreamingResponse(
        pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="dorsales-{race_code}-{sufijo}.pdf"'},
    )


def _url_de_escaneo(bib: str, race_code: str) -> str:
    from routes.qr_scan import url_de_escaneo

    return url_de_escaneo(bib, race_code, SITIO)
