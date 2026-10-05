"""Los cupos de una carrera se aseguran pagando, no inscribiendose.

Hasta octubre de 2026 el cupo lo ocupaba la inscripcion: con 165 inscritos de
170 y solo 85 pagados, 80 cupos estaban retenidos por quien no habia pagado, y
a quien llegaba con el dinero en la mano se le mandaba a lista de espera.

Desde entonces la inscripcion sin pagar **sigue activa pero no garantiza el
cupo**. Nadie se borra ni se pasa a lista de espera; lo que cambia es que
reserva el cupo:

- **asegurado**: pago completo, entro sin costo o tiene un abono aprobado (el
  plazo para saldar sigue hasta el 15 de noviembre, `services/plazos.py`);
- **en revision**: mando un comprobante o un abono y la organizacion aun no lo
  ha revisado. No esta asegurado, pero se le guarda el sitio mientras tanto:
  es lo que hace que el ultimo cupo sea de quien pago primero y no de a quien
  se le aprobo primero;
- **por confirmar**: inscrito, sin pago. Puede pagar mientras queden cupos;
- **en espera**: inscrito, sin pago, y ya no quedan cupos que pagar. Si se
  libera uno, vuelve a «por confirmar» sin que nadie tenga que tocar nada.

Los cupos se aseguran por orden de pago, igual para quien se inscribio en agosto
que para quien se inscriba hoy. Por eso una inscripcion nueva ya no cae en lista
de espera mientras queden cupos sin asegurar.

La situacion se **calcula**, no se guarda: no hay un estado nuevo en la base ni
un cambio masivo que deshacer. Aqui viven las reglas; las rutas solo preguntan.
"""
from typing import Optional

from services import plazos

ASEGURADO = "asegurado"
EN_REVISION = "en_revision"
POR_CONFIRMAR = "por_confirmar"
EN_ESPERA = "en_espera"
CANCELADO = "cancelado"

# El limite de la carrera cuando su configuracion no lo trae.
LIMITE_POR_DEFECTO = 120

# Lo que hace falta leer de una inscripcion para saber como esta su cupo.
CAMPOS = {
    "status": 1, "payment_status": 1, "inscripcion_cortesia": 1,
    "plazo_pago.estado": 1, "payment_receipt.status": 1,
}

# El aviso, con las mismas palabras en el correo, en la web y en la app.
MENSAJE_POR_CONFIRMAR = (
    "Tu inscripción sigue activa, pero tu cupo no está garantizado. Los cupos se "
    "aseguran por orden de pago: si alguien más completa su registro y paga antes, "
    "podrías perder tu derecho a participar."
)
MENSAJE_ABONO = (
    "Si no puedes pagar todo ahora, abona una parte —desde RD$ 1,000— y salda el "
    "resto hasta el 15 de noviembre: con el abono aprobado tu cupo queda asegurado."
)
MENSAJE_EN_REVISION = (
    "Recibimos tu pago y lo estamos revisando. Tu cupo queda guardado mientras tanto."
)
MENSAJE_EN_ESPERA = (
    "Todos los cupos están asegurados o con un pago en revisión. Tu inscripción sigue "
    "activa y quedas en lista de espera: si se libera un cupo, podrás pagar y asegurarlo."
)


def asegurado(registro: dict) -> bool:
    """Si esta inscripcion tiene el cupo a salvo."""
    return plazos.estado_pago(registro) in (
        plazos.PAGO_PAGADO, plazos.PAGO_ABONO, plazos.PAGO_SIN_COSTO,
    )


def en_revision(registro: dict) -> bool:
    """Si mando un pago —comprobante o abono— que esta sin revisar."""
    if asegurado(registro):
        return False
    if (registro.get("payment_receipt") or {}).get("status") == "pending_review":
        return True
    return (registro.get("plazo_pago") or {}).get("estado") == plazos.PENDIENTE


def contar(registros, limite: int) -> dict:
    """El estado de los cupos de una carrera a partir de sus inscripciones.

    - `disponibles`: cupos sin asegurar. Es lo que decide si se puede aprobar
      un pago mas.
    - `para_pagar`: cupos que nadie ha asegurado ni tiene en revision. Es lo
      que decide si alguien mas puede mandar un pago.
    """
    limite = int(limite or 0)
    asegurados = revision = por_confirmar = 0
    for r in registros:
        if r.get("status") == "cancelled":
            continue
        if asegurado(r):
            asegurados += 1
        elif en_revision(r):
            revision += 1
        else:
            por_confirmar += 1

    return {
        "limite": limite,
        "asegurados": asegurados,
        "en_revision": revision,
        "por_confirmar": por_confirmar,
        "disponibles": max(limite - asegurados, 0),
        "para_pagar": max(limite - asegurados - revision, 0),
        "completo": asegurados >= limite,
    }


async def resumen(db, race_code: str, carrera: Optional[dict] = None) -> dict:
    """Los cupos de la carrera, leidos de la base."""
    if carrera is None:
        carrera = await db["race_configurations"].find_one(
            {"code": race_code}, {"max_participants": 1}
        )
    limite = (carrera or {}).get("max_participants") or LIMITE_POR_DEFECTO
    registros = await db["registrations"].find(
        {"race_code": race_code, "status": {"$ne": "cancelled"}}, CAMPOS
    ).to_list(5000)
    return contar(registros, limite)


def situacion(registro: dict, cupos: dict) -> str:
    """Como esta el cupo de esta inscripcion, dado el estado de la carrera."""
    if registro.get("status") == "cancelled":
        return CANCELADO
    if asegurado(registro):
        return ASEGURADO
    if en_revision(registro):
        return EN_REVISION
    return POR_CONFIRMAR if cupos.get("para_pagar", 0) > 0 else EN_ESPERA


def mensaje(situacion_: str) -> str:
    """Lo que se le dice al corredor segun su situacion. Vacio si no hay nada
    que decirle."""
    return {
        POR_CONFIRMAR: MENSAJE_POR_CONFIRMAR,
        EN_REVISION: MENSAJE_EN_REVISION,
        EN_ESPERA: MENSAJE_EN_ESPERA,
    }.get(situacion_, "")


def para_el_corredor(registro: dict, cupos: dict) -> dict:
    """Lo que las pantallas del corredor necesitan saber de su cupo."""
    como = situacion(registro, cupos)
    return {
        "situacion": como,
        "mensaje": mensaje(como),
        "mensaje_abono": MENSAJE_ABONO if como == POR_CONFIRMAR else "",
        "limite": cupos.get("limite"),
        "asegurados": cupos.get("asegurados"),
        "disponibles": cupos.get("disponibles"),
    }


def impedimento_para_pagar(registro: dict, cupos: dict) -> Optional[str]:
    """None si puede mandar un pago (comprobante o abono); si no, por que no.

    Quien ya tiene el cupo asegurado siempre puede: es el saldo de su abono.
    Los demas, mientras quede algun cupo que nadie haya asegurado ni tenga en
    revision. Cobrarle a alguien un cupo que ya no hay obliga a devolverle el
    dinero.
    """
    if asegurado(registro):
        return None
    if cupos.get("para_pagar", 0) > 0:
        return None
    return MENSAJE_EN_ESPERA


def impedimento_para_asegurar(registro: dict, cupos: dict) -> Optional[str]:
    """None si la organizacion puede asegurarle el cupo (aprobar su pago, su
    abono o darle una cortesia); si no, por que no.

    Es la ultima puerta: sin ella, aprobar comprobantes de mas dejaria la
    carrera por encima de su limite sin que nadie lo hubiera decidido.
    """
    if asegurado(registro):
        return None
    if cupos.get("disponibles", 0) > 0:
        return None
    return (
        f"Ya hay {cupos.get('asegurados')} cupos asegurados de {cupos.get('limite')}. "
        "Para aprobar uno más, sube antes el límite de participantes de la carrera."
    )
