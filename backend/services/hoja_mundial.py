"""La hoja de resultados del Campeonato Mundial, al dia sola.

Cada sede del World Team Championship reporta en una hoja de Google que les
reparte la organizacion mundial ("2026 Backyard Ultra - World Team Championship
- DOM"): una fila por corredor en la pestana `Timing` y una columna por yarda,
de la `I` (Yard 1) a la `EV` (Yard 144). Su hoja maestra la lee tal cual, asi
que no se mueve ni una celda: aqui solo se rellenan las de tiempo.

Lo que admite cada celda, segun sus instrucciones:

- el tiempo de la yarda como `mmss` (un numero: 5225 es 52:25);
- `RTC` si el corredor no salio a esa yarda (Refuse To Continue);
- `INC` si salio y no la completo;
- `Over` si la completo pasada la hora.

Todo sale del libro mayor de vueltas (`services/laps.py`): una vuelta
completada es su tiempo desde la salida de esa vuelta hasta el paso por el
arco, y el retiro se traduce a su marca en la yarda siguiente a la ultima
completada. Nada se guarda aparte: la hoja es una vista del libro, y
`sincronizar()` la rehace entera cada vez. Por eso una vuelta anulada o un
ajuste del panel tambien se reflejan: se borra lo que ya no vale.

Tres reglas que no se pueden saltar:

- **Solo se escriben las celdas que el libro conoce.** Una vuelta anotada a
  mano desde el panel no tiene hora real de paso; si su tiempo no cabe en la
  vuelta, la celda se deja en paz y se avisa en el panel para que alguien la
  escriba a mano. Para no pisar lo escrito a mano, se recuerda que celdas
  escribio este modulo (`hoja_mundial.escrito`) y solo esas se limpian.
- **La hoja no es nuestra.** La comparte la organizacion mundial con la cuenta
  de servicio del proyecto (la misma de las notificaciones push), que tiene
  que figurar como editora. Sin eso Google responde 403 y aqui se anota el
  error para que se vea en el panel, sin tocar nada mas.
- **Escribir en la hoja nunca frena una vuelta.** Se dispara en segundo plano
  desde `laps.recalcular()`, con unos segundos de espera para juntar en una
  sola llamada los escaneos que llegan seguidos en la meta.
"""
import asyncio
import logging
import re
import unicodedata
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple

import httpx

from services import google_servicio, laps, races

logger = logging.getLogger(__name__)

SCOPE = "https://www.googleapis.com/auth/spreadsheets"
API = "https://sheets.googleapis.com/v4/spreadsheets"

# La pestana y su cuadricula, tal como la reparte la organizacion mundial.
HOJA = "Timing"
PRIMERA_FILA = 3          # la 1 son los rotulos de grupo y la 2 los encabezados
ULTIMA_FILA_ROSTER = 60   # de sobra: el equipo son 15
COLUMNA_NUMERO = 1        # A: #
COLUMNA_NOMBRE = 2        # B: Runner
COLUMNA_DNS = 4           # D: DNS
PRIMERA_COLUMNA_VUELTA = 9  # I: Yard 1
MAX_VUELTAS = 144

OVER = "Over"
RTC = "RTC"
INC = "INC"
DNS = "DNS"

MARCA_DE_RETIRO = {
    laps.RETIRO_MANUAL: RTC,       # no salio a la siguiente
    laps.RETIRO_TEMPRANO: INC,     # salio y volvio sin completarla
    laps.RETIRO_POR_TIEMPO: OVER,  # la completo pasada la hora
}

# Segundos que se esperan antes de escribir, para juntar los escaneos que
# llegan seguidos en la meta en una sola llamada a Google.
ESPERA = 4


# ============= CUADRICULA =============


def letra_columna(numero: int) -> str:
    """1 -> A, 26 -> Z, 27 -> AA, 152 -> EV."""
    letras = ""
    while numero > 0:
        numero, resto = divmod(numero - 1, 26)
        letras = chr(65 + resto) + letras
    return letras


def columna_de_vuelta(vuelta: int) -> str:
    return letra_columna(PRIMERA_COLUMNA_VUELTA + vuelta - 1)


def celda(columna: str, fila: int) -> str:
    return f"'{HOJA}'!{columna}{fila}"


def id_de_hoja(texto: Optional[str]) -> Optional[str]:
    """El id de la hoja, venga como direccion completa o como id suelto."""
    if not texto:
        return None
    texto = texto.strip()
    encontrado = re.search(r"/spreadsheets/d/([A-Za-z0-9_-]+)", texto)
    if encontrado:
        return encontrado.group(1)
    if re.fullmatch(r"[A-Za-z0-9_-]{20,}", texto):
        return texto
    return None


def url_de_hoja(spreadsheet_id: str) -> str:
    return f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/edit"


# ============= DEL LIBRO A LAS CELDAS =============


def valor_de_tiempo(segundos: float, minutos_por_vuelta: int) -> Optional[int]:
    """El `mmss` de una vuelta completada, o None si el tiempo no cabe en ella.

    `Over` no sale de aqui a proposito: una vuelta completada pasada la hora
    es un retiro (`RETIRO_POR_TIEMPO`) y se marca como tal. Si el tiempo de
    una vuelta que si cuenta se sale de la hora es que la hora de paso no es
    la real (se anoto tarde desde el panel), y eso se avisa, no se escribe.
    """
    if segundos < 0 or segundos >= minutos_por_vuelta * 60:
        return None
    enteros = int(segundos)
    return (enteros // 60) * 100 + enteros % 60


def _en_utc(momento: Optional[datetime]) -> Optional[datetime]:
    if momento is None:
        return None
    if momento.tzinfo is None:
        # Mongo devuelve las fechas sin zona: son UTC.
        return momento.replace(tzinfo=timezone.utc)
    return momento


def celdas(carrera: dict, anotaciones: List[dict], status: Optional[str]) -> Tuple[Dict[int, object], List[str]]:
    """Lo que debe decir cada yarda de un corredor, a partir de su historial.

    `anotaciones` es el historial sin anuladas y en orden (`laps.historial`).
    Devuelve `{vuelta: valor}` con solo las celdas que se conocen, y una lista
    de avisos con lo que hay que escribir a mano.

    La cuenta de vueltas sigue la misma regla que `laps.recalcular`: arranca
    en el ultimo ajuste y suma las completadas despues. El tiempo de cada una
    se mide desde la salida de esa vuelta segun el reloj de la carrera, no
    desde el `lap_start_time` anotado, porque el panel anota la vuelta
    anterior con el reloj de la que corre.
    """
    duracion = races.minutos_por_vuelta(carrera)
    salida = races.hora_de_salida(carrera)

    vueltas = 0
    pasos: Dict[int, dict] = {}
    for registro in anotaciones:
        accion = registro.get("action")
        if accion == laps.AJUSTE:
            vueltas = int(registro.get("lap_number") or 0)
        elif accion == laps.VUELTA_COMPLETADA:
            vueltas += 1
            pasos[int(registro.get("lap_number") or vueltas)] = registro

    valores: Dict[int, object] = {}
    avisos: List[str] = []
    for vuelta in range(1, min(vueltas, MAX_VUELTAS) + 1):
        paso = pasos.get(vuelta)
        valor = None
        momento = _en_utc((paso or {}).get("scan_time"))
        if salida is not None and momento is not None:
            inicio = salida + timedelta(minutes=(vuelta - 1) * duracion)
            valor = valor_de_tiempo((momento - inicio).total_seconds(), duracion)
        if valor is None:
            avisos.append(f"vuelta {vuelta} sin hora de paso valida: escribe su tiempo a mano")
        else:
            valores[vuelta] = valor

    if status == "retired":
        retiros = [r for r in anotaciones if r.get("action") in laps.RETIROS]
        accion = retiros[-1].get("action") if retiros else laps.RETIRO_MANUAL
        siguiente = vueltas + 1
        if siguiente <= MAX_VUELTAS:
            valores[siguiente] = MARCA_DE_RETIRO.get(accion, RTC)

    return valores, avisos


def cambios(escrito: Dict[str, object], deseado: Dict[int, object]) -> Dict[int, object]:
    """Que celdas hay que mandar: las nuevas o distintas, y en blanco las que
    este modulo escribio y ya no valen. Lo que nunca escribio no se toca."""
    pendientes: Dict[int, object] = {}
    for vuelta, valor in deseado.items():
        if escrito.get(str(vuelta)) != valor:
            pendientes[vuelta] = valor
    for clave, valor in escrito.items():
        if not clave.isdigit():
            continue
        if int(clave) not in deseado and valor not in (None, ""):
            pendientes[int(clave)] = ""
    return pendientes


# ============= EMPAREJAR FILAS CON DORSALES =============


def _tokens(nombre: str) -> List[str]:
    sin_acentos = "".join(
        c for c in unicodedata.normalize("NFKD", nombre or "") if not unicodedata.combining(c)
    )
    return [t for t in re.split(r"[^a-z0-9]+", sin_acentos.lower()) if t]


def emparejar(filas_hoja: List[dict], atletas: List[dict]) -> Tuple[Dict[str, int], List[dict], List[dict]]:
    """Casa cada fila de la hoja (por nombre) con un corredor (por dorsal).

    Primero el nombre completo igual; si no, que todas las palabras del nombre
    de la hoja esten en el del corredor o al reves (la hoja trae «Juan Perez»
    y la inscripcion «Juan Alberto Perez Gomez»); si no, el primer nombre y el
    primer apellido. Un empate se deja sin pareja antes que adivinar.
    """
    disponibles = [a for a in atletas if a.get("bib") not in (None, "")]
    filas: Dict[str, int] = {}
    sin_fila: List[dict] = []
    usados = set()

    def candidatos(fila_tokens):
        exactos, contenidos, por_puntas = [], [], []
        for a in disponibles:
            if a["bib"] in usados:
                continue
            at = _tokens(laps.nombre_completo(a))
            if not at:
                continue
            if at == fila_tokens:
                exactos.append(a)
            elif set(fila_tokens) <= set(at) or set(at) <= set(fila_tokens):
                contenidos.append(a)
            elif len(fila_tokens) >= 2 and len(at) >= 2 and fila_tokens[0] == at[0] and fila_tokens[-1] in at:
                por_puntas.append(a)
        for grupo in (exactos, contenidos, por_puntas):
            if len(grupo) == 1:
                return grupo[0]
            if len(grupo) > 1:
                return None
        return None

    for fila in filas_hoja:
        tokens = _tokens(fila.get("nombre") or "")
        pareja = candidatos(tokens) if tokens else None
        if pareja is None:
            sin_fila.append(fila)
            continue
        filas[str(pareja["bib"])] = int(fila["fila"])
        usados.add(pareja["bib"])

    sin_pareja = [a for a in disponibles if a["bib"] not in usados]
    return filas, sin_fila, sin_pareja


# ============= GOOGLE SHEETS =============


class ErrorDeHoja(Exception):
    pass


async def _token() -> str:
    if not google_servicio.esta_configurado():
        raise ErrorDeHoja("No hay cuenta de servicio de Google configurada en el backend")
    token = await google_servicio.access_token(SCOPE)
    if not token:
        raise ErrorDeHoja("Google no dio acceso a la cuenta de servicio")
    return token


def _explicar(respuesta: httpx.Response) -> str:
    try:
        error = respuesta.json().get("error", {})
        mensaje = error.get("message") or respuesta.text
    except ValueError:
        mensaje = respuesta.text
    if respuesta.status_code == 403:
        if "has not been used" in mensaje or "is disabled" in mensaje:
            return ("La API de Google Sheets no esta habilitada en el proyecto de la cuenta de servicio: "
                    f"{mensaje}")
        return (f"La hoja no esta compartida con {google_servicio.correo_de_la_cuenta()} como editor: "
                f"{mensaje}")
    if respuesta.status_code == 404:
        return "No existe una hoja con ese id (o la cuenta no la ve)"
    return f"Google respondio {respuesta.status_code}: {mensaje}"


async def leer_filas(spreadsheet_id: str) -> List[dict]:
    """Las filas del roster: numero, nombre y en que fila de la hoja estan."""
    token = await _token()
    rango = f"'{HOJA}'!{letra_columna(COLUMNA_NUMERO)}{PRIMERA_FILA}:{letra_columna(COLUMNA_NOMBRE)}{ULTIMA_FILA_ROSTER}"
    async with httpx.AsyncClient(timeout=20) as cliente:
        respuesta = await cliente.get(
            f"{API}/{spreadsheet_id}/values/{rango}",
            headers={"Authorization": f"Bearer {token}"},
        )
    if respuesta.status_code != 200:
        raise ErrorDeHoja(_explicar(respuesta))

    filas = []
    for desplazamiento, valores in enumerate(respuesta.json().get("values", [])):
        nombre = (valores[COLUMNA_NOMBRE - 1] if len(valores) >= COLUMNA_NOMBRE else "").strip()
        if not nombre:
            continue
        filas.append({
            "fila": PRIMERA_FILA + desplazamiento,
            "numero": (valores[0] if valores else "").strip(),
            "nombre": nombre,
        })
    return filas


async def _escribir(spreadsheet_id: str, datos: List[dict]) -> None:
    if not datos:
        return
    token = await _token()
    async with httpx.AsyncClient(timeout=30) as cliente:
        respuesta = await cliente.post(
            f"{API}/{spreadsheet_id}/values:batchUpdate",
            headers={"Authorization": f"Bearer {token}"},
            # RAW: el numero queda numero (es lo que valida la hoja) y «Over»
            # queda texto. Con USER_ENTERED, Google tomaria 5225 por una fecha.
            json={"valueInputOption": "RAW", "data": datos},
        )
    if respuesta.status_code != 200:
        raise ErrorDeHoja(_explicar(respuesta))


# ============= SINCRONIZAR =============


def _config(carrera: dict) -> dict:
    return dict((carrera or {}).get("hoja_mundial") or {})


def lista_para_sincronizar(carrera: dict) -> bool:
    config = _config(carrera)
    return bool(config.get("spreadsheet_id") and config.get("filas"))


_cerrojos: Dict[str, asyncio.Lock] = {}


def _cerrojo(code: str) -> asyncio.Lock:
    if code not in _cerrojos:
        _cerrojos[code] = asyncio.Lock()
    return _cerrojos[code]


async def sincronizar(database, carrera: dict) -> dict:
    """Pone la hoja al dia con el libro mayor. Devuelve lo que paso.

    Siempre deja constancia en `hoja_mundial` de la carrera: `ultima_sync` y
    `ultimo_error` para el panel, y `escrito` con lo que quedo en la hoja, que
    es lo unico que una sincronizacion posterior se permite borrar.
    """
    code = carrera.get("code")
    config = _config(carrera)
    spreadsheet_id = config.get("spreadsheet_id")
    filas: Dict[str, int] = config.get("filas") or {}
    if not spreadsheet_id or not filas:
        return {"ok": False, "error": "La hoja no esta configurada o no tiene dorsales emparejados"}

    async with _cerrojo(code):
        # La ficha pudo cambiar mientras se esperaba el cerrojo (otra
        # sincronizacion acaba de guardar `escrito`): se relee.
        fresca = await database.race_configurations.find_one({"code": code}) or carrera
        config = _config(fresca)
        escrito: Dict[str, Dict[str, object]] = config.get("escrito") or {}

        datos: List[dict] = []
        # La columna DNS es del roster, no de los tiempos, y puede estar
        # protegida: va en una llamada aparte para que, si Google la rechaza,
        # los tiempos entren igual y aqui solo quede un aviso.
        datos_dns: List[dict] = []
        nuevo_escrito: Dict[str, Dict[str, object]] = {}
        avisos: List[str] = []

        for bib, fila in filas.items():
            atleta = await laps.buscar_atleta(database, code, bib)
            if not atleta:
                avisos.append(f"#{bib}: no hay ningun corredor con ese dorsal en {code}")
                continue
            anotaciones = await laps.historial(database, code, bib)
            deseado, avisos_bib = celdas(fresca, anotaciones, atleta.get("status"))
            if atleta.get("status") == "dns":
                deseado_dns = DNS
            else:
                deseado_dns = None

            previo = escrito.get(str(bib)) or {}
            for vuelta, valor in cambios(previo, deseado).items():
                datos.append({"range": celda(columna_de_vuelta(vuelta), int(fila)), "values": [[valor]]})
            if (previo.get("dns") or None) != deseado_dns:
                datos_dns.append({"range": celda(letra_columna(COLUMNA_DNS), int(fila)),
                                  "values": [[deseado_dns or ""]]})

            registro = {str(v): valor for v, valor in deseado.items()}
            if deseado_dns:
                registro["dns"] = deseado_dns
            elif previo.get("dns"):
                # Si la columna DNS no se pudo limpiar, se recuerda para
                # volver a intentarlo.
                registro["dns"] = previo["dns"]
            nuevo_escrito[str(bib)] = registro
            nombre = laps.nombre_completo(atleta)
            avisos.extend(f"#{bib} {nombre}: {aviso}" for aviso in avisos_bib)

        ahora = datetime.now(timezone.utc)
        try:
            await _escribir(spreadsheet_id, datos)
        except ErrorDeHoja as e:
            await database.race_configurations.update_one(
                {"code": code},
                {"$set": {"hoja_mundial.ultimo_error": str(e), "hoja_mundial.ultimo_intento": ahora}},
            )
            logger.error(f"Hoja del Mundial ({code}): {e}")
            return {"ok": False, "error": str(e), "celdas": len(datos)}

        if datos_dns:
            try:
                await _escribir(spreadsheet_id, datos_dns)
                for bib in filas:
                    registro = nuevo_escrito.get(str(bib))
                    if registro is not None and registro.get("dns") != DNS:
                        registro.pop("dns", None)
            except ErrorDeHoja as e:
                avisos.append(f"La columna DNS no se pudo escribir ({e}); marca el DNS a mano en la hoja")
                for bib in filas:
                    registro = nuevo_escrito.get(str(bib))
                    if registro is not None:
                        registro.pop("dns", None)

        await database.race_configurations.update_one(
            {"code": code},
            {"$set": {
                "hoja_mundial.escrito": nuevo_escrito,
                "hoja_mundial.ultima_sync": ahora,
                "hoja_mundial.ultimo_intento": ahora,
                "hoja_mundial.ultimo_error": None,
                "hoja_mundial.avisos": avisos,
            }},
        )
        if datos:
            logger.info(f"Hoja del Mundial ({code}): {len(datos)} celda(s) escritas")
        return {"ok": True, "celdas": len(datos), "avisos": avisos}


# ============= EN SEGUNDO PLANO =============

_tareas: Dict[str, asyncio.Task] = {}
_repetir: set = set()


def programar(database, carrera: dict) -> None:
    """Pide una sincronizacion en breve, sin bloquear a quien la pide.

    Varias llamadas seguidas (los escaneos de una llegada en grupo) acaban en
    una sola escritura: si ya hay una tarea esperando, no se abre otra; si la
    que hay ya esta escribiendo, se le deja dicho que repita al terminar.
    """
    if not _config(carrera).get("activa") or not lista_para_sincronizar(carrera):
        return
    code = carrera.get("code")
    tarea = _tareas.get(code)
    if tarea and not tarea.done():
        _repetir.add(code)
        return
    try:
        _tareas[code] = asyncio.get_running_loop().create_task(_en_breve(database, code))
    except RuntimeError:
        # Sin bucle de eventos (scripts, pruebas): no hay segundo plano.
        pass


async def _en_breve(database, code: str) -> None:
    await asyncio.sleep(ESPERA)
    while True:
        _repetir.discard(code)
        try:
            carrera = await database.race_configurations.find_one({"code": code})
            if carrera and _config(carrera).get("activa"):
                await sincronizar(database, carrera)
        except Exception:
            logger.exception(f"Hoja del Mundial ({code}): fallo la sincronizacion en segundo plano")
        if code not in _repetir:
            return
        await asyncio.sleep(ESPERA)
