"""El libro mayor de vueltas: un solo registro, venga de donde venga.

Hasta ahora una vuelta se anotaba en un sitio distinto segun quien la anotara.
El escaner QR escribia en `lap_registrations`; el panel escribia en la coleccion
`laps_log`, que ni siquiera guardaba de que carrera era. Resultado: las vueltas
puestas a mano desde el panel no aparecian en la pestana Vueltas, y no habia
forma de reconstruir lo que habia pasado si los numeros no cuadraban.

Aqui todo pasa por `lap_registrations`, siempre con `race_code`, con `source`
(`qr` o `panel`) y con quien lo hizo. `registrations.laps_completed` sigue
existiendo porque es lo que leen el dashboard, la app y los resultados sin tener
que sumar nada, pero deja de ser un numero que se toca a mano: se recalcula
desde el libro mayor, para que una correccion no deje los dos valores peleados.

Nada se borra. Corregir una vuelta es **anularla** dejando quien y por que; asi
el dia despues de la carrera se puede explicar cada numero.
"""
from datetime import datetime
from typing import Optional

from fastapi import HTTPException

from services import races

# Lo que puede pasarle a un corredor en el anillo. Los cuatro primeros son los
# que ya escribia el escaner; se conservan tal cual para no romper la pestana
# Vueltas ni las exportaciones.
VUELTA_COMPLETADA = "lap_completed"
RETIRO_MANUAL = "dnf"
RETIRO_TEMPRANO = "dnf_early_return"
RETIRO_POR_TIEMPO = "dnf_timeout"
# Nuevo: fija las vueltas de un corredor sin fingir escaneos que no ocurrieron
# (correcciones de juez, o el estado con el que se arranco el libro mayor).
AJUSTE = "ajuste"

RETIROS = (RETIRO_MANUAL, RETIRO_TEMPRANO, RETIRO_POR_TIEMPO)

ORIGEN_QR = "qr"
ORIGEN_PANEL = "panel"


# ============= ENCONTRAR AL CORREDOR =============


async def buscar_atleta(database, race_code: str, bib) -> Optional[dict]:
    """El dorsal se guardo unas veces como numero y otras como texto.

    Ademas se muestra con ceros delante ("007"), asi que hay que probar las
    tres formas. Estaba copiado en cuatro endpoints distintos, cada uno con sus
    propias variantes; aqui se prueba lo mismo siempre.
    """
    if bib is None:
        return None

    texto = str(bib).strip()
    if not texto:
        return None

    posibles = {texto, texto.lstrip("0") or texto}
    try:
        numero = int(texto)
        posibles |= {numero, str(numero), str(numero).zfill(3)}
    except ValueError:
        pass

    return await database.registrations.find_one(
        {"race_code": race_code, "bib": {"$in": list(posibles)}}
    )


async def exigir_atleta(database, race_code: str, bib) -> dict:
    atleta = await buscar_atleta(database, race_code, bib)
    if not atleta:
        raise HTTPException(
            status_code=404,
            detail=f"No hay ningun corredor con el dorsal {bib} en {race_code}",
        )
    return atleta


def nombre_completo(atleta: dict) -> str:
    return f"{atleta.get('nombre', '')} {atleta.get('apellidos', '')}".strip()


# ============= ESCRIBIR EN EL LIBRO =============


async def _anotar(
    database,
    carrera: dict,
    atleta: dict,
    accion: str,
    vuelta: int,
    origen: str,
    autor: Optional[str],
    info_vuelta: Optional[dict] = None,
    extra: Optional[dict] = None,
) -> dict:
    ahora = races.ahora_en_carrera(carrera)
    inicio_vuelta = (info_vuelta or {}).get("lap_start_time")

    registro = {
        "race_code": carrera.get("code"),
        "bib": str(atleta.get("bib")),
        "athlete_name": nombre_completo(atleta),
        "lap_number": vuelta,
        "action": accion,
        "source": origen,
        "lap_start_time": inicio_vuelta,
        "lap_start_time_local": inicio_vuelta.strftime("%H:%M") if inicio_vuelta else None,
        "scan_time": ahora,
        "scan_time_local": races.hora_local_str(carrera),
        "scanned_by": autor or "desconocido",
        "anulada": False,
        "created_at": ahora,
        **(extra or {}),
    }

    resultado = await database.lap_registrations.insert_one(dict(registro))
    registro["_id"] = resultado.inserted_id
    return registro


async def registrar_vuelta(
    database,
    carrera: dict,
    atleta: dict,
    vuelta: int,
    origen: str,
    autor: Optional[str] = None,
    info_vuelta: Optional[dict] = None,
    extra: Optional[dict] = None,
) -> dict:
    """Anota una vuelta completada y deja al dia el contador del corredor."""
    await _anotar(
        database, carrera, atleta, VUELTA_COMPLETADA, vuelta, origen, autor,
        info_vuelta, extra,
    )
    return await recalcular(database, carrera, atleta.get("bib"))


async def registrar_retiro(
    database,
    carrera: dict,
    atleta: dict,
    accion: str,
    vuelta: int,
    origen: str,
    autor: Optional[str] = None,
    motivo: Optional[str] = None,
    info_vuelta: Optional[dict] = None,
    extra: Optional[dict] = None,
) -> dict:
    """Marca el retiro en el libro y en la ficha del corredor.

    El retiro no toca las vueltas: un corredor que abandona conserva las que ya
    habia completado.
    """
    if accion not in RETIROS:
        raise HTTPException(status_code=400, detail=f"Tipo de retiro invalido: {accion}")

    await _anotar(
        database, carrera, atleta, accion, vuelta, origen, autor, info_vuelta,
        {"reason": motivo, **(extra or {})},
    )

    ahora = races.ahora_en_carrera(carrera)
    await database.registrations.update_one(
        {"race_code": carrera.get("code"), "email": atleta.get("email")},
        {
            "$set": {
                "status": "retired",
                "retired_at_lap": atleta.get("laps_completed", 0),
                "retired_at": ahora,
                "retired_reason": motivo,
                "updated_at": ahora,
            }
        },
    )

    return await recalcular(database, carrera, atleta.get("bib"))


async def ajustar_vueltas(
    database,
    carrera: dict,
    atleta: dict,
    vueltas: int,
    autor: Optional[str] = None,
    motivo: Optional[str] = None,
) -> dict:
    """Fija a mano cuantas vueltas lleva un corredor.

    Se anota como un ajuste con su motivo en vez de inventar escaneos: en el
    libro se ve que fue una decision de la organizacion y no un paso por el
    arco.
    """
    if vueltas < 0:
        raise HTTPException(status_code=400, detail="Las vueltas no pueden ser negativas")

    await _anotar(
        database, carrera, atleta, AJUSTE, vueltas, ORIGEN_PANEL, autor, None,
        {"reason": motivo, "desde": atleta.get("laps_completed", 0), "hasta": vueltas},
    )
    return await recalcular(database, carrera, atleta.get("bib"))


async def anular(
    database,
    carrera: dict,
    registro_id,
    autor: Optional[str] = None,
    motivo: Optional[str] = None,
) -> dict:
    """Deja sin efecto una anotacion, sin borrarla del libro."""
    registro = await database.lap_registrations.find_one(
        {"_id": registro_id, "race_code": carrera.get("code")}
    )
    if not registro:
        raise HTTPException(status_code=404, detail="Ese registro de vuelta no existe")
    if registro.get("anulada"):
        raise HTTPException(status_code=400, detail="Ese registro ya estaba anulado")

    ahora = races.ahora_en_carrera(carrera)
    await database.lap_registrations.update_one(
        {"_id": registro_id},
        {
            "$set": {
                "anulada": True,
                "anulada_por": autor or "desconocido",
                "anulada_at": ahora,
                "motivo_anulacion": motivo,
            }
        },
    )

    # Anular el retiro devuelve al corredor a la carrera: si no, quedaria fuera
    # sin ningun registro que lo justifique.
    if registro.get("action") in RETIROS:
        atleta = await buscar_atleta(database, carrera.get("code"), registro.get("bib"))
        if atleta and atleta.get("status") == "retired":
            await database.registrations.update_one(
                {"race_code": carrera.get("code"), "email": atleta.get("email")},
                {
                    "$set": {"status": "active", "updated_at": ahora},
                    "$unset": {"retired_at_lap": "", "retired_at": "", "retired_reason": ""},
                },
            )

    return await recalcular(database, carrera, registro.get("bib"))


# ============= LEER EL LIBRO =============


async def historial(database, race_code: str, bib, incluir_anuladas: bool = False) -> list:
    """Todo lo anotado de un corredor, en orden."""
    filtro = {"race_code": race_code, "bib": str(bib)}
    if not incluir_anuladas:
        filtro["anulada"] = {"$ne": True}

    return await database.lap_registrations.find(filtro).sort("scan_time", 1).to_list(2000)


async def recalcular(database, carrera: dict, bib) -> dict:
    """Rehace `laps_completed` y `total_km` a partir del libro mayor.

    La cuenta arranca en el ultimo ajuste (si lo hay) y suma las vueltas
    completadas despues de el. Asi un ajuste manual no se pierde en cuanto el
    corredor vuelve a pasar por el arco, y las vueltas escaneadas antes del
    ajuste no se cuentan dos veces.
    """
    race_code = carrera.get("code")
    anotaciones = await historial(database, race_code, bib)

    vueltas = 0
    for registro in anotaciones:
        if registro.get("action") == AJUSTE:
            vueltas = int(registro.get("lap_number") or 0)
        elif registro.get("action") == VUELTA_COMPLETADA:
            vueltas += 1

    km = round(vueltas * races.km_por_vuelta(carrera), 1)
    ahora = races.ahora_en_carrera(carrera)

    atleta = await buscar_atleta(database, race_code, bib)
    if atleta:
        await database.registrations.update_one(
            {"_id": atleta["_id"]},
            {"$set": {"laps_completed": vueltas, "total_km": km, "updated_at": ahora}},
        )

    return {"bib": str(bib), "laps_completed": vueltas, "total_km": km}


async def vuelta_ya_registrada(database, race_code: str, bib, vuelta: int) -> Optional[dict]:
    """Evita contar dos veces el mismo paso por el arco."""
    return await database.lap_registrations.find_one(
        {
            "race_code": race_code,
            "bib": str(bib),
            "lap_number": vuelta,
            "action": VUELTA_COMPLETADA,
            "anulada": {"$ne": True},
        }
    )
