"""Plazo para terminar de pagar la inscripcion.

Quien no puede pagar completo antes de la fecha limite abona una parte, propone
cuando salda el resto y con eso conserva el cupo. La organizacion revisa cada
solicitud: el cupo queda asegurado cuando se aprueba, no cuando se envia.

Aqui viven las reglas y nada mas -- ni base de datos, ni correo, ni archivos --
porque son las que duele equivocarse: un abono por debajo del minimo o una
fecha despues del tope dejan un cupo bloqueado por alguien que no va a pagar,
que es justo lo que este plazo existe para evitar.
"""
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import HTTPException

# Lo minimo que hay que abonar para que el cupo se considere reservado. Por
# debajo de esto el abono no compromete a nadie y el cupo se queda bloqueado.
ABONO_MINIMO = 1000.0

# Hasta cuando se puede proponer saldar. Mas alla no da tiempo a reasignar el
# cupo si el pago no llega.
FECHA_TOPE = date(2026, 11, 15)

# Los tres estados de una solicitud.
PENDIENTE = "pendiente"
APROBADO = "aprobado"
RECHAZADO = "rechazado"
ESTADOS = (PENDIENTE, APROBADO, RECHAZADO)


def hoy() -> date:
    return datetime.now(timezone.utc).date()


def _fecha(texto) -> date:
    """Una fecha ISO (AAAA-MM-DD) del formulario."""
    try:
        return date.fromisoformat(str(texto)[:10])
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Elige una fecha válida")


def revisar_solicitud(monto, fecha_propuesta, costo: float, desde: Optional[date] = None) -> dict:
    """Comprueba lo que manda el atleta y devuelve lo que se guarda.

    `costo` es lo que cuesta la inscripcion; el abono no puede pasarse de ahi,
    porque un abono mayor que el total es un error de tecleo, no un regalo.
    """
    desde = desde or hoy()

    try:
        abonado = float(monto)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Escribe cuánto abonaste")

    if abonado < ABONO_MINIMO:
        raise HTTPException(
            status_code=400,
            detail=f"El abono mínimo para reservar el cupo es de RD$ {ABONO_MINIMO:,.0f}",
        )
    if costo and abonado > costo:
        raise HTTPException(
            status_code=400,
            detail=f"El abono no puede pasar del costo de la inscripción (RD$ {costo:,.0f})",
        )

    fecha = _fecha(fecha_propuesta)
    if fecha < desde:
        raise HTTPException(status_code=400, detail="La fecha no puede ser anterior a hoy")
    if fecha > FECHA_TOPE:
        raise HTTPException(
            status_code=400,
            detail=f"La fecha máxima para saldar es el {FECHA_TOPE.strftime('%d/%m/%Y')}",
        )

    return {
        "estado": PENDIENTE,
        "monto_abonado": abonado,
        "fecha_propuesta": fecha.isoformat(),
        "solicitado_at": datetime.now(timezone.utc),
    }


def restante(plazo: Optional[dict], costo: float) -> float:
    """Lo que queda por pagar. Sin solicitud, el costo entero."""
    abonado = float((plazo or {}).get("monto_abonado") or 0)
    return max(float(costo or 0) - abonado, 0)


def monto_esperado(registro: dict, costo: float) -> float:
    """Lo que tiene que traer un comprobante de pago completo.

    Con un plazo aprobado es lo que faltaba; si no, el costo entero. Un plazo
    pendiente o rechazado no descuenta nada: ese abono todavia no cuenta.
    """
    plazo = registro.get("plazo_pago") or {}
    if plazo.get("estado") == APROBADO:
        return restante(plazo, costo)
    return float(costo or 0)


# Como se ve el pago en el panel. Son cuatro y no dos porque "pendiente" a
# secas escondia a quien ya abono una parte: el saldo que falta no es el
# costo entero, y el cupo ya esta reservado.
PAGO_PAGADO = "pagado"
PAGO_ABONO = "abono"
PAGO_PENDIENTE = "pendiente"
PAGO_SIN_COSTO = "sin_costo"
ESTADOS_PAGO = (PAGO_PAGADO, PAGO_ABONO, PAGO_PENDIENTE, PAGO_SIN_COSTO)


def estado_pago(registro: dict) -> str:
    """El estado del pago tal como lo lee el panel.

    La cortesia manda sobre todo: por dentro cuenta como pagado, pero decir
    "pagado" esconderia que entro sin costo. Un plazo pendiente o rechazado
    **no** es un abono: ese dinero todavia no cuenta y el saldo es el total.
    """
    if registro.get("inscripcion_cortesia"):
        return PAGO_SIN_COSTO
    if registro.get("payment_status") == "paid":
        return PAGO_PAGADO
    if (registro.get("plazo_pago") or {}).get("estado") == APROBADO:
        return PAGO_ABONO
    return PAGO_PENDIENTE


def saldo_pendiente(registro: dict, costo: float) -> float:
    """Lo que le falta por pagar a un inscrito: nada si pago o entro sin
    costo; si no, lo que se espera de su comprobante."""
    if estado_pago(registro) in (PAGO_PAGADO, PAGO_SIN_COSTO):
        return 0.0
    return monto_esperado(registro, costo)


def comprobar_pago_completo(monto_pagado, registro: dict, costo: float) -> Optional[float]:
    """El control de la pagina de subir comprobante: que lo que se declara
    pagado cubra lo que se debe.

    Hay quien paga una parte y la sube como si fuera el pago entero. Si pasa,
    el panel la aprueba como pago completo y lo que falta desaparece de los
    papeles. Declarar el monto es lo que lo frena: un monto por debajo de lo
    esperado es un abono y va por el plazo, no por aqui.

    El monto es opcional porque las apps ya instaladas no lo mandan; si no
    llega, no se comprueba nada y se devuelve None. Si llega, se devuelve el
    numero para guardarlo con el comprobante.
    """
    if monto_pagado in (None, ""):
        return None
    try:
        pagado = float(monto_pagado)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Escribe cuánto pagaste")
    if pagado <= 0:
        raise HTTPException(status_code=400, detail="Escribe cuánto pagaste")

    esperado = monto_esperado(registro, costo)
    if esperado and pagado < esperado:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Lo que pagaste (RD$ {pagado:,.0f}) no cubre lo que falta "
                f"(RD$ {esperado:,.0f}). Si es un abono, pide más tiempo para "
                "pagar: ahí se anota lo abonado y cuándo saldas el resto."
            ),
        )
    return pagado


def puede_pasar_a_plazo(registro: dict) -> Optional[str]:
    """None si el comprobante se puede tomar como abono; si no, por que no.

    Solo se mueve un comprobante que aun esta en revision. Uno ya aprobado
    entro en finanzas como pago completo, y moverlo sin deshacer eso deja un
    ingreso que no existe.
    """
    recibo = registro.get("payment_receipt") or {}
    if not recibo:
        return "Este atleta no tiene comprobante que mover."
    if recibo.get("status") != "pending_review":
        return "Solo se puede tomar como abono un comprobante que esté en revisión."
    if registro.get("payment_status") == "paid":
        return "Esta inscripción ya está pagada completa."
    if (registro.get("plazo_pago") or {}).get("estado") == APROBADO:
        return "Ya tiene un plazo aprobado: este comprobante sería el pago final."
    return None


def desde_comprobante(recibo: dict, monto_abonado, fecha_propuesta, costo: float,
                      desde: Optional[date] = None) -> dict:
    """Convierte un comprobante enviado como pago completo en una solicitud de
    plazo: mismas reglas que si la hubiera pedido el atleta, con el comprobante
    que ya subio.

    Sin fecha propuesta se toma el tope: el atleta no la propuso, y el tope es
    lo mas que la organizacion puede conceder.
    """
    fecha = fecha_propuesta if fecha_propuesta not in (None, "") else FECHA_TOPE.isoformat()
    solicitud = revisar_solicitud(monto_abonado, fecha, costo, desde=desde)
    solicitud["origen"] = "comprobante"
    solicitud["comprobante"] = {
        "image_path": recibo.get("image_path"),
        "payment_date": recibo.get("payment_date"),
        "bank_origin": recibo.get("bank_origin"),
        "transfer_number": recibo.get("transfer_number"),
    }
    return solicitud


def cupo_asegurado(registro: dict) -> bool:
    """Si el cupo esta a salvo: pagado del todo, o con el plazo ya aprobado.

    Una solicitud enviada y sin revisar **no** asegura nada: cualquiera podria
    reservar un cupo escribiendo una fecha.
    """
    if registro.get("payment_status") == "paid":
        return True
    return (registro.get("plazo_pago") or {}).get("estado") == APROBADO


def puede_solicitar(registro: dict) -> Optional[str]:
    """None si puede pedir el plazo; si no, por que no puede.

    Devolver el motivo y no un booleano es lo que deja que la pagina se lo
    explique al atleta en vez de esconderle el boton sin decir nada.
    """
    if registro.get("status") == "waitlist":
        return ("Estás en lista de espera: todavía no tienes cupo que reservar. "
                "Te avisamos en cuanto se libere uno.")
    if registro.get("status") == "cancelled":
        return "Esta inscripción está cancelada."
    if registro.get("payment_status") == "paid":
        return "Tu inscripción ya está pagada completa."

    plazo = registro.get("plazo_pago") or {}
    if plazo.get("estado") == PENDIENTE:
        return "Ya enviaste una solicitud y está en revisión."
    if plazo.get("estado") == APROBADO:
        return "Ya tienes un plazo aprobado."

    recibo = registro.get("payment_receipt") or {}
    if recibo.get("status") == "pending_review":
        return "Tienes un comprobante en revisión. Espera a que lo revisemos."
    return None
