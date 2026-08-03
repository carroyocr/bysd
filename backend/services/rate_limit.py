"""Limite de intentos por IP para los endpoints que se pueden abusar.

Que cubre:
  - Logins: probar contrasenas a toda velocidad.
  - Envio de codigos por correo: disparar cientos de correos agota la cuota
    diaria de Gmail y deja al sitio sin poder mandar nada.

Es un contador en memoria del proceso, no en la base de datos. Da para lo que
hay: el backend corre en una sola instancia en Render y esto no necesita ser
exacto, solo cortar el abuso automatizado. Si algun dia hay varias instancias,
cada una llevara su propia cuenta y los limites efectivos se multiplicaran por
el numero de instancias; a partir de ahi tocaria llevarlo a Redis o a Mongo.
"""
import os
import time
from collections import defaultdict, deque
from typing import Deque, Dict, Optional, Tuple

from fastapi import HTTPException, Request

# (bucket, clave) -> marcas de tiempo de los intentos recientes
_intentos: Dict[Tuple[str, str], Deque[float]] = defaultdict(deque)

# Cada cuantos registros se hace limpieza de claves viejas, para que el dict no
# crezca sin fin con IPs que pasaron una vez.
_LIMPIEZA_CADA = 500
_desde_ultima_limpieza = 0


def ip_cliente(request: Optional[Request]) -> str:
    """IP real del visitante.

    Render pone un proxy delante, asi que request.client.host es el del proxy;
    la del visitante viene en X-Forwarded-For (el primero de la lista).
    """
    if request is None:
        return "desconocida"

    reenviada = request.headers.get("x-forwarded-for")
    if reenviada:
        return reenviada.split(",")[0].strip()

    return request.client.host if request.client else "desconocida"


def _limpiar(ahora: float) -> None:
    vacias = [k for k, v in _intentos.items() if not v or ahora - v[-1] > 3600]
    for k in vacias:
        del _intentos[k]


def comprobar(
    bucket: str,
    clave: str,
    limite: int,
    ventana_segundos: int,
    mensaje: str = "Demasiados intentos. Espera un momento e intentalo de nuevo.",
) -> None:
    """Registra un intento y corta con 429 si se pasa del limite.

    bucket: nombre del endpoint ("admin-login", "envio-codigo"...).
    clave:  con que se agrupa, normalmente la IP.
    """
    global _desde_ultima_limpieza

    # Llave solo para pruebas locales: con RATE_LIMIT_OFF=1 no se limita nada.
    # Produccion no define esta variable, asi que alli siempre se aplica.
    if os.getenv("RATE_LIMIT_OFF") == "1":
        return

    ahora = time.time()
    marcas = _intentos[(bucket, clave)]

    while marcas and ahora - marcas[0] > ventana_segundos:
        marcas.popleft()

    _desde_ultima_limpieza += 1
    if _desde_ultima_limpieza >= _LIMPIEZA_CADA:
        _desde_ultima_limpieza = 0
        _limpiar(ahora)

    if len(marcas) >= limite:
        espera = int(ventana_segundos - (ahora - marcas[0])) + 1
        raise HTTPException(
            status_code=429,
            detail=mensaje,
            headers={"Retry-After": str(espera)},
        )

    marcas.append(ahora)


def olvidar(bucket: str, clave: str) -> None:
    """Borra el historial de una clave. Se usa tras un login correcto: quien
    acierta no tiene por que arrastrar los fallos anteriores."""
    _intentos.pop((bucket, clave), None)


# ---- Perfiles usados en las rutas -------------------------------------------
#
# Los numeros salen de lo que hace una persona real: nadie escribe su contrasena
# mal diez veces en cinco minutos, ni pide cuatro codigos seguidos.

def limitar_login(request: Optional[Request], usuario: str = "") -> str:
    """10 intentos por IP cada 5 minutos. Devuelve la clave, para 'olvidar'."""
    ip = ip_cliente(request)
    comprobar(
        "login", ip, limite=10, ventana_segundos=300,
        mensaje="Demasiados intentos de acceso. Espera unos minutos.",
    )
    return ip


def limitar_envio_codigo(request: Optional[Request]) -> None:
    """5 correos con codigo por IP cada 15 minutos."""
    comprobar(
        "envio-codigo", ip_cliente(request), limite=5, ventana_segundos=900,
        mensaje="Ya pediste varios codigos. Espera unos minutos antes de pedir otro.",
    )


def limitar_verificacion(request: Optional[Request]) -> None:
    """20 comprobaciones de codigo por IP cada 15 minutos.

    Complementa al contador por cuenta: ese anula el codigo a los 5 fallos,
    pero sin esto se podrian recorrer muchas cuentas distintas desde una IP.
    """
    comprobar(
        "verificacion", ip_cliente(request), limite=20, ventana_segundos=900,
        mensaje="Demasiados intentos. Espera unos minutos.",
    )
