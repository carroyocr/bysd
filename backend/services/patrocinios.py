"""Reglas de un patrocinador: una sola ficha, tres bloques.

Hasta septiembre de 2026 un patrocinador vivia partido en dos colecciones:
`sponsors` (el expediente comercial) y `ad_banners` (la ficha de publicidad),
unidas por nombre y carrera. Eran 44 y 44 -uno a uno-, con la descripcion y el
Instagram guardados en las dos, el logo cargado dos veces en dos carpetas de
GridFS distintas, y los interruptores de "donde se ve" viviendo en la ficha
aunque decidieran tambien la vitrina del sitio. Renombrar en un lado
desenganchaba el otro en silencio.

Ahora es un solo documento en `sponsors` con tres bloques:

- **Comercial**: razon social, RNC, contactos, categoria, monto, el pipeline
  (`status`) y la bitacora. Es lo que nunca sale del panel.
- **Marca**: el logo, el banner de la barra, la imagen ampliada, la
  descripcion y el Instagram. Es lo que ve el publico.
- **Publicacion**: donde se ve (`publicar_web`, `publicar_app`), desde cuando
  (`start_at`/`end_at`), con cuanta frecuencia (`weight`) y las metricas.

Este modulo tiene lo que necesitan por igual el router de patrocinadores y el
de publicidad, para que las dos vistas del mismo dato no vuelvan a divergir.
"""
from datetime import datetime, timezone
from typing import Optional
import uuid

from fastapi import HTTPException

# Las tres piezas graficas de un patrocinador, y el campo donde vive cada una.
#
# - logo:   el cuadrado de la marca. Sirve a la vitrina del sitio Y al pie de
#           la app: es el mismo logo, cargado una vez.
# - banner: la pieza que ocupa la barra entera del pie (1200x240, 5:1).
#           Cuando existe, sustituye al logo y al texto.
# - detail: la imagen que se abre dentro de la app al tocar el banner.
IMAGENES = {
    "logo": "logo_url",
    "banner": "banner_url",
    "detail": "detail_url",
}

# Pipeline del proceso de cierre. "prospecto" (aun sin primer contacto) y
# "declinado" (no se concreto) cubren el inicio y la salida negativa.
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
# patrocinador define en `publicar_desde` el momento a partir del cual puede
# salir; por defecto, cuando cierra.
PIPELINE = [s for s in STATUSES if s != "declinado"]
PUBLICAR_DESDE_POR_DEFECTO = "cierre"

# Lo que sale en la vitrina de patrocinadores (sitio y app). Es la lista corta:
# el logo, el nombre y la categoria, que es lo que distingue un nivel de otro.
CAMPOS_VITRINA = {
    "_id": 0, "id": 1, "name": 1, "logo_url": 1, "order": 1,
    "race_code": 1, "is_active": 1, "propuesta_categoria": 1,
}

# Lo que necesita un anuncio para pintarse en el pie de BYSD Live. Es la misma
# forma que devolvia `ad_banners`, y no se toca: hay apps instaladas (1.3.x)
# leyendola tal cual.
CAMPOS_ANUNCIO = {
    "_id": 0, "id": 1, "name": 1, "text": 1, "link_url": 1,
    "logo_url": 1, "banner_url": 1, "detail_url": 1, "weight": 1, "order": 1,
    "mostrar_marca": 1, "description": 1, "instagram": 1,
    "publicar_web": 1, "publicar_app": 1,
}


def parse_iso(value: Optional[str]) -> Optional[datetime]:
    """Una fecha de vigencia, o None. Revienta con 400 si no se entiende."""
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except ValueError:
        raise HTTPException(status_code=400, detail="Fecha de vigencia no válida (use ISO 8601)")


def vigente(doc: dict, ahora: datetime) -> bool:
    """Si la fecha de hoy cae dentro de la vigencia declarada (o no hay)."""
    inicio = parse_iso(doc.get("start_at"))
    fin = parse_iso(doc.get("end_at"))
    if inicio and ahora < inicio:
        return False
    if fin and ahora > fin:
        return False
    return True


def tiene_pieza(doc: dict) -> bool:
    """Si hay con que pintar el anuncio en el pie.

    Sin logo, sin banner y sin imagen ampliada no hay nada que ensenar, y un
    hueco con un nombre dentro es peor que no ensenar nada. Por eso el pie los
    salta aunque esten encendidos: encender es una intencion, tener pieza es
    poder cumplirla.
    """
    return any(doc.get(campo) for campo in IMAGENES.values())


def proceso_permite_publicar(doc: dict) -> bool:
    """Si el proceso comercial ya llego al momento de salir a la luz.

    Es la puerta comercial -"no lo ensenes hasta que firme"-, distinta de los
    interruptores de donde se ve. Las dos tienen que dar el visto bueno.
    """
    status = doc.get("status") or "prospecto"
    if status not in PIPELINE:
        return False  # declinado, o un valor que no reconocemos
    desde = doc.get("publicar_desde") or PUBLICAR_DESDE_POR_DEFECTO
    if desde not in PIPELINE:
        desde = PUBLICAR_DESDE_POR_DEFECTO
    return PIPELINE.index(status) >= PIPELINE.index(desde)


def sale_en(doc: dict, destino: str) -> bool:
    """Si este patrocinador se ensena en la vitrina de `destino` ("web"/"app").

    Las dos condiciones juntas: que el proceso comercial lo permita y que el
    interruptor de ese destino este encendido. Ausente cuenta como encendido,
    que es como nacieron los que vienen de antes de la unificacion.
    """
    if not proceso_permite_publicar(doc):
        return False
    interruptor = "publicar_app" if destino == "app" else "publicar_web"
    return doc.get(interruptor) is not False


def nuevo(race_code: str, name: str, *, order: int, **campos) -> dict:
    """El documento de un patrocinador recien dado de alta.

    Nace con los tres bloques puestos, aunque casi todos vacios: si un campo
    falta, el panel lo lee como vacio y nadie se entera de que nunca existio.

    El `id` es estable y no se recalcula nunca: es con lo que la app cuenta
    impresiones y clics (`POST /api/ads/track`), asi que sobrevive a cambios
    de nombre.
    """
    ahora = datetime.now(timezone.utc)
    texto = lambda k: (campos.get(k) or "").strip()  # noqa: E731

    return {
        "id": campos.get("id") or str(uuid.uuid4()),
        "name": name.strip(),
        "race_code": race_code.upper(),
        "order": order,
        "is_active": True,

        # Comercial
        "razon_social": texto("razon_social"),
        "rnc": texto("rnc"),
        "nombre_contacto": texto("nombre_contacto"),
        "posicion_contacto": texto("posicion_contacto"),
        "telefono": texto("telefono"),
        "correo": texto("correo"),
        "pagina_web": texto("pagina_web"),
        "propuesta_categoria": texto("propuesta_categoria"),
        "propuesta_monto": campos.get("propuesta_monto"),
        "status": campos.get("status") or "prospecto",
        "publicar_desde": campos.get("publicar_desde") or PUBLICAR_DESDE_POR_DEFECTO,
        "bitacora": campos.get("bitacora") or [],

        # Marca
        "logo_url": campos.get("logo_url"),
        "banner_url": campos.get("banner_url"),
        "detail_url": campos.get("detail_url"),
        "description": texto("description"),
        "instagram": texto("instagram"),
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

        "created_at": ahora,
        "updated_at": ahora,
    }


def entrada_bitacora(nota: str, tipo: str = "contacto") -> dict:
    """Una linea de la bitacora, con su sello de tiempo."""
    return {
        "id": str(uuid.uuid4()),
        "fecha": datetime.now(timezone.utc).isoformat(),
        "nota": nota,
        "tipo": tipo,
    }
