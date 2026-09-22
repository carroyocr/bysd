"""Reglas de un patrocinador: una ficha por marca, una participacion por carrera.

Hasta septiembre de 2026 un patrocinador se guardaba una vez **por cada
edicion**: Cedimat en BYSD-2026 y Cedimat en BYSD-2027 eran dos documentos sin
relacion, cada uno con su razon social, su contacto y su telefono copiados a
mano. Eran 55 documentos para 31 marcas, y 21 de esas marcas estaban repetidas.
Corregir un telefono obligaba a acordarse de todas las ediciones donde la marca
saliera; en los datos reales, 5 marcas acabaron con contactos distintos y 4 con
telefonos distintos sin que nadie lo decidiera.

Ahora la marca se guarda una sola vez y lleva dentro la lista de carreras que
patrocina. El reparto es el siguiente, y es el que contesta a "¿esto cambia de
una edicion a otra?":

- **La ficha de la marca** (una por empresa): nombre, razon social, RNC,
  contacto y su posicion, telefono, correo, pagina web, descripcion, Instagram
  y logo. Es quien es la empresa, y no cambia porque cambie el ano.
- **La participacion** (una por carrera que patrocina): el proceso comercial
  (`status`, `publicar_desde`, bitacora), lo negociado (categoria y monto),
  donde se ve y desde cuando (`publicar_web`, `publicar_app`, vigencia, peso,
  orden), el arte de esa campana (texto, enlace, banner, imagen ampliada) y
  las metricas. Todo eso se negocia y se paga por evento.

La vitrina del sitio y el pie de la app siguen viendo lo de siempre: las
funciones `vista_vitrina` y `vista_anuncio` aplanan la ficha con la
participacion de la carrera que se pida, y devuelven exactamente los mismos
campos que antes. Hay apps instaladas (1.3.x) leyendo esa forma.
"""
from datetime import datetime, timezone
from typing import Optional
import uuid

from fastapi import HTTPException

# Las tres piezas graficas de un patrocinador, y el campo donde vive cada una.
#
# - logo:   el cuadrado de la marca. Es de la ficha: la misma empresa no
#           cambia de logo entre una edicion y la siguiente, y sirve por igual
#           a la vitrina del sitio y al pie de la app.
# - banner: la pieza que ocupa la barra entera del pie (1200x240, 5:1).
# - detail: la imagen que se abre dentro de la app al tocar el banner.
#
# Las dos ultimas son el arte de la campana de esa edicion, asi que viven en
# la participacion.
IMAGEN_MARCA = {"logo": "logo_url"}
IMAGENES_CARRERA = {"banner": "banner_url", "detail": "detail_url"}
IMAGENES = {**IMAGEN_MARCA, **IMAGENES_CARRERA}

# Pipeline del proceso de cierre. "prospecto" (aun sin primer contacto) y
# "declinado" (no se concreto) cubren el inicio y la salida negativa. Se lleva
# por carrera: una marca puede estar cobrada en el Mundial y en primera
# reunion para la edicion siguiente.
STATUSES = (
    "prospecto",
    "envio_informacion",
    "llamada_primer_contacto",
    "reunion",
    "retroalimentacion",
    "cierre",
    "facturacion",
    "pago",
    "declinado",
)

STATUS_LABELS = {
    "prospecto": "Prospecto",
    "envio_informacion": "Envío de Información",
    "llamada_primer_contacto": "Llamada de Primer Contacto",
    "reunion": "Reunión (física o virtual)",
    "retroalimentacion": "Retroalimentación",
    "cierre": "Cierre",
    "facturacion": "Facturación",
    "pago": "Pago",
    "declinado": "Declinado",
}

# Orden del pipeline (sin "declinado", que nunca se publica). Cada
# participacion define en `publicar_desde` el momento a partir del cual puede
# salir; por defecto, cuando cierra.
PIPELINE = [s for s in STATUSES if s != "declinado"]
PUBLICAR_DESDE_POR_DEFECTO = "cierre"

# Los campos de la ficha: lo que es de la marca y no de una edicion.
CAMPOS_FICHA = (
    "razon_social", "rnc", "nombre_contacto", "posicion_contacto",
    "telefono", "correo", "pagina_web", "description", "instagram",
)

# Los campos de una participacion, sin contar `race_code`, `id` ni la bitacora.
CAMPOS_PARTICIPACION = (
    "order", "status", "publicar_desde", "propuesta_categoria", "propuesta_monto",
    "publicar_web", "publicar_app", "mostrar_marca", "weight",
    "start_at", "end_at", "text", "link_url",
)


def parse_iso(value: Optional[str]) -> Optional[datetime]:
    """Una fecha de vigencia, o None. Revienta con 400 si no se entiende."""
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except ValueError:
        raise HTTPException(status_code=400, detail="Fecha de vigencia no válida (use ISO 8601)")


def vigente(part: dict, ahora: datetime) -> bool:
    """Si la fecha de hoy cae dentro de la vigencia declarada (o no hay)."""
    inicio = parse_iso(part.get("start_at"))
    fin = parse_iso(part.get("end_at"))
    if inicio and ahora < inicio:
        return False
    if fin and ahora > fin:
        return False
    return True


def tiene_pieza(doc: dict, part: dict) -> bool:
    """Si hay con que pintar el anuncio en el pie.

    Desde septiembre de 2026 el pie ya no pinta el arte de la marca: lleva el
    nombre, una linea de texto y un boton que abre la pieza grafica o, si no
    hay, el enlace. Asi que basta con cualquiera de esas cosas: una imagen, el
    texto o el enlace. Lo que se sigue saltando es el patrocinador que solo
    tiene nombre, un hueco que no dice nada ni lleva a ningun sitio.

    El logo es de la ficha y las otras dos piezas de la participacion, por eso
    hacen falta las dos mitades para contestar.
    """
    if doc.get("logo_url") or any(part.get(c) for c in IMAGENES_CARRERA.values()):
        return True
    return bool((part.get("text") or "").strip() or (part.get("link_url") or "").strip())


def proceso_permite_publicar(part: dict) -> bool:
    """Si el proceso comercial de esa carrera ya llego al momento de salir.

    Es la puerta comercial -"no lo ensenes hasta que firme"-, distinta de los
    interruptores de donde se ve. Las dos tienen que dar el visto bueno.
    """
    status = part.get("status") or "prospecto"
    if status not in PIPELINE:
        return False  # declinado, o un valor que no reconocemos
    desde = part.get("publicar_desde") or PUBLICAR_DESDE_POR_DEFECTO
    if desde not in PIPELINE:
        desde = PUBLICAR_DESDE_POR_DEFECTO
    return PIPELINE.index(status) >= PIPELINE.index(desde)


def sale_en(doc: dict, part: dict, destino: str) -> bool:
    """Si esta participacion se ensena en la vitrina de `destino` ("web"/"app").

    Tres condiciones: que la marca no este retirada, que el proceso comercial
    de esa carrera lo permita y que el interruptor de ese destino este
    encendido. Ausente cuenta como encendido, que es como nacieron los que
    vienen de antes de la unificacion.
    """
    if doc.get("is_active") is False:
        return False
    if not proceso_permite_publicar(part):
        return False
    interruptor = "publicar_app" if destino == "app" else "publicar_web"
    return part.get(interruptor) is not False


def participacion(doc: dict, race_code: str) -> Optional[dict]:
    """La participacion de esa carrera dentro de la ficha, si la hay."""
    code = (race_code or "").upper()
    for part in doc.get("participaciones") or []:
        if (part.get("race_code") or "").upper() == code:
            return part
    return None


def vista_vitrina(doc: dict, part: dict) -> dict:
    """Lo que sale en la vitrina de patrocinadores (sitio y app).

    Es la lista corta de siempre: el logo, el nombre y la categoria, que es lo
    que distingue un nivel de otro. Mismas claves que antes de partir la ficha
    en dos: quien lo lee no se entera del cambio.
    """
    return {
        "id": part.get("id"),
        "name": doc.get("name"),
        "logo_url": doc.get("logo_url"),
        "order": part.get("order", 0),
        "race_code": part.get("race_code"),
        "is_active": doc.get("is_active", True),
        "propuesta_categoria": part.get("propuesta_categoria"),
    }


def vista_anuncio(doc: dict, part: dict) -> dict:
    """Lo que necesita un anuncio para pintarse en el pie de BYSD Live.

    Es la misma forma que devolvia `ad_banners`, y no se toca: hay apps
    instaladas (1.3.x) leyendola tal cual. El `id` es el de la participacion,
    porque las metricas se cuentan por carrera.
    """
    return {
        "id": part.get("id"),
        "name": doc.get("name"),
        "text": part.get("text"),
        "link_url": part.get("link_url"),
        "logo_url": doc.get("logo_url"),
        "banner_url": part.get("banner_url"),
        "detail_url": part.get("detail_url"),
        "weight": part.get("weight", 1),
        "order": part.get("order", 0),
        "mostrar_marca": part.get("mostrar_marca", True),
        "description": doc.get("description"),
        "instagram": doc.get("instagram"),
        "publicar_web": part.get("publicar_web", True),
        "publicar_app": part.get("publicar_app", True),
    }


def nueva_ficha(name: str, **campos) -> dict:
    """La ficha de una marca recien dada de alta, sin ninguna carrera todavia.

    Nace con todos los campos puestos, aunque casi todos vacios: si un campo
    falta, el panel lo lee como vacio y nadie se entera de que nunca existio.

    El `id` es estable y no se recalcula nunca: identifica a la marca en todas
    las rutas del panel, asi que sobrevive a cambios de nombre.
    """
    ahora = datetime.now(timezone.utc)
    texto = lambda k: (campos.get(k) or "").strip()  # noqa: E731

    ficha = {
        "id": campos.get("id") or str(uuid.uuid4()),
        "name": name.strip(),
        "is_active": campos.get("is_active", True),
        "logo_url": campos.get("logo_url"),
        "participaciones": campos.get("participaciones") or [],
        "created_at": campos.get("created_at") or ahora,
        "updated_at": ahora,
    }
    for campo in CAMPOS_FICHA:
        ficha[campo] = texto(campo)
    return ficha


def nueva_participacion(race_code: str, *, order: int, **campos) -> dict:
    """Lo que una marca patrocina en una carrera concreta.

    El `id` es con lo que la app cuenta impresiones y clics
    (`POST /api/ads/track`). Al unificar las fichas se hereda el del documento
    que habia para esa carrera, para que los contadores ya recogidos sigan
    sumando donde estaban.
    """
    texto = lambda k: (campos.get(k) or "").strip()  # noqa: E731

    return {
        "id": campos.get("id") or str(uuid.uuid4()),
        "race_code": race_code.upper(),
        "order": order,

        # Comercial
        "status": campos.get("status") or "prospecto",
        "publicar_desde": campos.get("publicar_desde") or PUBLICAR_DESDE_POR_DEFECTO,
        "propuesta_categoria": texto("propuesta_categoria"),
        "propuesta_monto": campos.get("propuesta_monto"),
        "bitacora": campos.get("bitacora") or [],

        # Arte de esta campana
        "banner_url": campos.get("banner_url"),
        "detail_url": campos.get("detail_url"),
        "text": texto("text"),
        "link_url": texto("link_url"),

        # Publicacion
        "publicar_web": campos.get("publicar_web", True),
        "publicar_app": campos.get("publicar_app", True),
        "mostrar_marca": campos.get("mostrar_marca", True),
        "weight": campos.get("weight") or 1,
        "start_at": campos.get("start_at") or None,
        "end_at": campos.get("end_at") or None,

        # Metricas
        "impressions": campos.get("impressions") or 0,
        "clicks": campos.get("clicks") or 0,

        "created_at": campos.get("created_at") or datetime.now(timezone.utc),
    }


def entrada_bitacora(nota: str, tipo: str = "contacto") -> dict:
    """Una linea de la bitacora, con su sello de tiempo."""
    return {
        "id": str(uuid.uuid4()),
        "fecha": datetime.now(timezone.utc).isoformat(),
        "nota": nota,
        "tipo": tipo,
    }
