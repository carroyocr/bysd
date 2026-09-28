"""El plazo para terminar de pagar la inscripcion.

No toca la base de datos: entran los datos del formulario y sale lo que se
guarda, o el error que ve el atleta. Se prueba aqui porque es donde duele
equivocarse -- un abono corto o una fecha pasada del tope dejan un cupo
bloqueado por alguien que no va a pagar, que es lo que este plazo existe
para evitar.
"""
import os
import sys
from datetime import date, timedelta

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services import plazos  # noqa: E402

COSTO = 4000.0
HOY = date(2026, 9, 28)


# Centinela: `fecha or "..."` se tragaria los casos de "" y None, que son
# justo dos de los que hay que comprobar.
SIN_DECIR = object()


def solicitar(monto=2000, fecha=SIN_DECIR, costo=COSTO, desde=HOY):
    if fecha is SIN_DECIR:
        fecha = "2026-11-10"
    return plazos.revisar_solicitud(monto, fecha, costo, desde=desde)


# ---------------- El abono ----------------


def test_una_solicitud_normal_se_guarda_pendiente():
    """Pendiente y no aprobada: el cupo se asegura al revisarla, no al enviarla."""
    guardado = solicitar(monto=2000, fecha="2026-10-30")
    assert guardado["estado"] == plazos.PENDIENTE
    assert guardado["monto_abonado"] == 2000.0
    assert guardado["fecha_propuesta"] == "2026-10-30"


def test_el_abono_minimo_son_mil_pesos():
    assert plazos.ABONO_MINIMO == 1000.0
    assert solicitar(monto=1000)["monto_abonado"] == 1000.0

    with pytest.raises(HTTPException) as caida:
        solicitar(monto=999)
    assert caida.value.status_code == 400
    assert "1,000" in caida.value.detail


def test_el_abono_no_puede_pasarse_del_costo():
    """Un abono mayor que el total es un error de tecleo, no un regalo."""
    assert solicitar(monto=COSTO)["monto_abonado"] == COSTO
    with pytest.raises(HTTPException):
        solicitar(monto=COSTO + 1)


@pytest.mark.parametrize("basura", ["", None, "dos mil", "1.000,50"])
def test_un_monto_que_no_es_numero_se_rechaza(basura):
    with pytest.raises(HTTPException) as caida:
        solicitar(monto=basura)
    assert caida.value.status_code == 400


def test_sin_costo_configurado_no_se_pone_tope_al_abono():
    """Una carrera sin precio no puede rechazar un abono por pasarse de el."""
    assert solicitar(monto=99999, costo=0)["monto_abonado"] == 99999.0


# ---------------- La fecha ----------------


def test_hoy_mismo_vale_como_fecha():
    assert solicitar(fecha=HOY.isoformat())["fecha_propuesta"] == HOY.isoformat()


def test_una_fecha_de_ayer_se_rechaza():
    with pytest.raises(HTTPException) as caida:
        solicitar(fecha=(HOY - timedelta(days=1)).isoformat())
    assert "anterior a hoy" in caida.value.detail


def test_el_tope_es_el_15_de_noviembre():
    assert plazos.FECHA_TOPE == date(2026, 11, 15)
    assert solicitar(fecha="2026-11-15")["fecha_propuesta"] == "2026-11-15"

    with pytest.raises(HTTPException) as caida:
        solicitar(fecha="2026-11-16")
    assert "15/11/2026" in caida.value.detail


@pytest.mark.parametrize("basura", ["", None, "mañana", "15-11-2026", "2026-13-01"])
def test_una_fecha_que_no_es_fecha_se_rechaza(basura):
    with pytest.raises(HTTPException) as caida:
        solicitar(fecha=basura)
    assert caida.value.status_code == 400


# ---------------- Quien puede pedirlo ----------------


def registro(**extra):
    return {"status": "registered", "payment_status": "pending", **extra}


def test_un_inscrito_pendiente_puede_pedirlo():
    assert plazos.puede_solicitar(registro()) is None


def test_desde_la_lista_de_espera_no_hay_cupo_que_reservar():
    motivo = plazos.puede_solicitar(registro(status="waitlist"))
    assert motivo and "lista de espera" in motivo


def test_quien_ya_pago_no_lo_necesita():
    motivo = plazos.puede_solicitar(registro(payment_status="paid"))
    assert motivo and "pagada completa" in motivo


def test_no_se_pide_dos_veces():
    """Una segunda solicitud sobre una sin revisar solo duplica el trabajo."""
    motivo = plazos.puede_solicitar(registro(plazo_pago={"estado": plazos.PENDIENTE}))
    assert motivo and "en revisión" in motivo

    motivo = plazos.puede_solicitar(registro(plazo_pago={"estado": plazos.APROBADO}))
    assert motivo and "plazo aprobado" in motivo


def test_con_un_comprobante_en_revision_se_espera():
    motivo = plazos.puede_solicitar(
        registro(payment_receipt={"status": "pending_review"})
    )
    assert motivo and "comprobante en revisión" in motivo


def test_una_solicitud_rechazada_se_puede_volver_a_intentar():
    """Se rechaza por una fecha mala, se corrige y se vuelve a enviar."""
    assert plazos.puede_solicitar(registro(plazo_pago={"estado": plazos.RECHAZADO})) is None


# ---------------- El cupo ----------------


def test_el_cupo_no_se_asegura_con_solo_enviar_la_solicitud():
    """Si bastara con enviarla, cualquiera reserva un cupo escribiendo una fecha."""
    assert not plazos.cupo_asegurado(registro(plazo_pago={"estado": plazos.PENDIENTE}))
    assert plazos.cupo_asegurado(registro(plazo_pago={"estado": plazos.APROBADO}))
    assert plazos.cupo_asegurado(registro(payment_status="paid"))
    assert not plazos.cupo_asegurado(registro())


def test_lo_que_queda_por_pagar():
    assert plazos.restante({"monto_abonado": 1500}, COSTO) == 2500.0
    assert plazos.restante(None, COSTO) == COSTO
    # Nunca negativo, aunque el abono sea mayor por un ajuste a mano
    assert plazos.restante({"monto_abonado": 9999}, COSTO) == 0
