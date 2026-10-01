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


# ---------------- Abonos subidos como pago completo ----------------
#
# Hay quien paga una parte y la sube por el boton del pago completo. Si el
# panel la aprueba tal cual, lo que falta desaparece de los papeles. Dos
# frenos: el atleta declara cuanto pago, y el panel puede tomar el comprobante
# como abono en vez de aprobarlo o rechazarlo.


def test_lo_esperado_es_el_costo_o_lo_que_faltaba():
    assert plazos.monto_esperado(registro(), COSTO) == COSTO
    aprobado = registro(plazo_pago={"estado": plazos.APROBADO, "monto_abonado": 1500})
    assert plazos.monto_esperado(aprobado, COSTO) == 2500.0
    # Un plazo sin aprobar no descuenta: ese abono todavia no cuenta
    pendiente = registro(plazo_pago={"estado": plazos.PENDIENTE, "monto_abonado": 1500})
    assert plazos.monto_esperado(pendiente, COSTO) == COSTO


def test_el_pago_completo_pasa_y_el_abono_se_frena():
    assert plazos.comprobar_pago_completo(COSTO, registro(), COSTO) == COSTO
    assert plazos.comprobar_pago_completo("4000", registro(), COSTO) == COSTO
    # Pagar de mas no es un abono; se guarda lo declarado
    assert plazos.comprobar_pago_completo(COSTO + 500, registro(), COSTO) == COSTO + 500

    with pytest.raises(HTTPException) as caida:
        plazos.comprobar_pago_completo(2000, registro(), COSTO)
    assert caida.value.status_code == 400
    assert "abono" in caida.value.detail
    assert "4,000" in caida.value.detail


def test_con_plazo_aprobado_el_pago_final_es_lo_que_faltaba():
    aprobado = registro(plazo_pago={"estado": plazos.APROBADO, "monto_abonado": 1500})
    assert plazos.comprobar_pago_completo(2500, aprobado, COSTO) == 2500.0
    with pytest.raises(HTTPException):
        plazos.comprobar_pago_completo(2000, aprobado, COSTO)


@pytest.mark.parametrize("sin_monto", [None, ""])
def test_sin_monto_declarado_no_se_comprueba_nada(sin_monto):
    """Las apps ya instaladas no mandan el monto; no se les puede cerrar la puerta."""
    assert plazos.comprobar_pago_completo(sin_monto, registro(), COSTO) is None


@pytest.mark.parametrize("basura", ["cero", "0", "-100"])
def test_un_monto_que_no_sirve_se_rechaza(basura):
    with pytest.raises(HTTPException) as caida:
        plazos.comprobar_pago_completo(basura, registro(), COSTO)
    assert caida.value.status_code == 400


def test_sin_costo_configurado_cualquier_monto_pasa():
    assert plazos.comprobar_pago_completo(100, registro(), 0) == 100.0


RECIBO = {
    "image_path": "/api/uploads/receipts/receipt_x.jpg",
    "payment_date": "2026-09-28",
    "bank_origin": "Banreservas",
    "transfer_number": "123",
    "submitted_at": "2026-09-28T10:00:00",
    "status": "pending_review",
}


def test_solo_se_mueve_un_comprobante_en_revision():
    assert plazos.puede_pasar_a_plazo(registro(payment_receipt=RECIBO)) is None
    assert plazos.puede_pasar_a_plazo(registro()) is not None
    aprobado = {**RECIBO, "status": "approved"}
    motivo = plazos.puede_pasar_a_plazo(registro(payment_receipt=aprobado, payment_status="paid"))
    assert motivo and "en revisión" in motivo
    rechazado = {**RECIBO, "status": "rejected"}
    assert plazos.puede_pasar_a_plazo(registro(payment_receipt=rechazado)) is not None


def test_con_plazo_aprobado_el_comprobante_es_el_pago_final_y_no_se_mueve():
    con_plazo = registro(payment_receipt=RECIBO,
                         plazo_pago={"estado": plazos.APROBADO, "monto_abonado": 1500})
    motivo = plazos.puede_pasar_a_plazo(con_plazo)
    assert motivo and "pago final" in motivo


def test_el_comprobante_pasa_al_plazo_con_sus_datos():
    solicitud = plazos.desde_comprobante(RECIBO, 1500, "2026-11-01", COSTO, desde=HOY)
    assert solicitud["estado"] == plazos.PENDIENTE
    assert solicitud["monto_abonado"] == 1500.0
    assert solicitud["fecha_propuesta"] == "2026-11-01"
    assert solicitud["origen"] == "comprobante"
    # El comprobante viaja con la solicitud, pero sin el estado de revision
    assert solicitud["comprobante"] == {
        "image_path": RECIBO["image_path"],
        "payment_date": "2026-09-28",
        "bank_origin": "Banreservas",
        "transfer_number": "123",
    }


@pytest.mark.parametrize("sin_fecha", [None, ""])
def test_sin_fecha_propuesta_se_toma_el_tope(sin_fecha):
    """El atleta no propuso fecha; el tope es lo mas que se puede conceder."""
    solicitud = plazos.desde_comprobante(RECIBO, 1500, sin_fecha, COSTO, desde=HOY)
    assert solicitud["fecha_propuesta"] == plazos.FECHA_TOPE.isoformat()


def test_al_mover_rigen_las_mismas_reglas_del_abono():
    with pytest.raises(HTTPException):
        plazos.desde_comprobante(RECIBO, 500, None, COSTO, desde=HOY)
    with pytest.raises(HTTPException):
        plazos.desde_comprobante(RECIBO, 1500, "2026-12-01", COSTO, desde=HOY)
