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
