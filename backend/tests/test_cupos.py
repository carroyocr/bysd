"""El cupo se asegura pagando, no inscribiendose.

Con 165 inscritos de 170 y solo 85 pagados, los cupos estaban retenidos por
quien no pagaba y el que llegaba a pagar caia en lista de espera. Lo que estos
tests protegen son las reglas de `services/cupos.py`:

- la inscripcion sin pagar sigue activa, pero no ocupa cupo;
- el cupo lo asegura el pago completo, la cortesia o el abono **aprobado**; un
  abono o un comprobante sin revisar guarda el sitio, pero no lo asegura;
- se puede seguir pagando mientras quede un cupo que nadie haya asegurado ni
  tenga en revision, y ni uno mas: el ultimo es de quien pago primero;
- la organizacion no puede aprobar pagos por encima del limite sin subirlo.

No necesitan servidor ni base de datos.

    backend/.venv/bin/python -m pytest tests/test_cupos.py -v
"""
import os

os.environ.setdefault("JWT_SECRET_KEY", "clave-solo-para-tests-" + "x" * 40)

from services import cupos  # noqa: E402

PAGADO = {"status": "registered", "payment_status": "paid"}
CORTESIA = {"status": "registered", "payment_status": "paid", "inscripcion_cortesia": True}
ABONO_APROBADO = {"status": "registered", "payment_status": "pending", "plazo_pago": {"estado": "aprobado"}}
ABONO_SIN_REVISAR = {"status": "registered", "payment_status": "pending", "plazo_pago": {"estado": "pendiente"}}
ABONO_RECHAZADO = {"status": "registered", "payment_status": "pending", "plazo_pago": {"estado": "rechazado"}}
COMPROBANTE_SIN_REVISAR = {"status": "registered", "payment_status": "pending",
                           "payment_receipt": {"status": "pending_review"}}
COMPROBANTE_RECHAZADO = {"status": "registered", "payment_status": "pending",
                         "payment_receipt": {"status": "rejected"}}
SIN_PAGAR = {"status": "registered", "payment_status": "pending"}
EN_LISTA_VIEJA = {"status": "waitlist", "payment_status": "pending"}
CANCELADO = {"status": "cancelled", "payment_status": "paid"}


def test_que_asegura_el_cupo_y_que_no():
    for registro in (PAGADO, CORTESIA, ABONO_APROBADO):
        assert cupos.asegurado(registro)
    for registro in (SIN_PAGAR, ABONO_SIN_REVISAR, ABONO_RECHAZADO,
                     COMPROBANTE_SIN_REVISAR, COMPROBANTE_RECHAZADO, EN_LISTA_VIEJA):
        assert not cupos.asegurado(registro)


def test_un_pago_sin_revisar_guarda_el_sitio_pero_no_lo_asegura():
    assert cupos.en_revision(ABONO_SIN_REVISAR)
    assert cupos.en_revision(COMPROBANTE_SIN_REVISAR)
    # Lo rechazado ya no guarda nada, y el saldo de un abono aprobado no es
    # "en revision": ese cupo ya esta asegurado.
    assert not cupos.en_revision(ABONO_RECHAZADO)
    assert not cupos.en_revision(COMPROBANTE_RECHAZADO)
    assert not cupos.en_revision({**ABONO_APROBADO, "payment_receipt": {"status": "pending_review"}})


def test_la_situacion_del_dia_que_se_cambio_la_regla():
    """165 inscritos de 170, 85 pagados: quedan 85 cupos, no 5."""
    registros = [PAGADO] * 85 + [SIN_PAGAR] * 80
    c = cupos.contar(registros, 170)
    assert (c["asegurados"], c["por_confirmar"], c["en_revision"]) == (85, 80, 0)
    assert c["disponibles"] == 85 and c["para_pagar"] == 85
    assert not c["completo"]
    # Quien no ha pagado sigue inscrito y puede pagar; no esta en espera.
    assert cupos.situacion(SIN_PAGAR, c) == cupos.POR_CONFIRMAR
    assert cupos.impedimento_para_pagar(SIN_PAGAR, c) is None


def test_los_cancelados_no_cuentan():
    c = cupos.contar([PAGADO, CANCELADO, SIN_PAGAR], 170)
    assert (c["asegurados"], c["por_confirmar"]) == (1, 1)


def test_el_ultimo_cupo_es_de_quien_pago_primero():
    """169 asegurados y un comprobante sin revisar: el sitio ya esta guardado."""
    c = cupos.contar([PAGADO] * 169 + [COMPROBANTE_SIN_REVISAR] + [SIN_PAGAR] * 10, 170)
    assert c["disponibles"] == 1 and c["para_pagar"] == 0

    # Nadie mas puede mandar un pago: habria que devolverselo.
    assert cupos.impedimento_para_pagar(SIN_PAGAR, c)
    assert cupos.situacion(SIN_PAGAR, c) == cupos.EN_ESPERA
    # Y a quien ya pago si se le puede aprobar.
    assert cupos.situacion(COMPROBANTE_SIN_REVISAR, c) == cupos.EN_REVISION
    assert cupos.impedimento_para_asegurar(COMPROBANTE_SIN_REVISAR, c) is None


def test_con_la_carrera_llena_los_que_no_pagaron_quedan_en_espera():
    c = cupos.contar([PAGADO] * 150 + [ABONO_APROBADO] * 18 + [CORTESIA] * 2 + [SIN_PAGAR] * 30, 170)
    assert c["completo"] and c["disponibles"] == 0
    assert cupos.situacion(SIN_PAGAR, c) == cupos.EN_ESPERA
    assert cupos.situacion(PAGADO, c) == cupos.ASEGURADO
    assert cupos.mensaje(cupos.EN_ESPERA) and "lista de espera" in cupos.mensaje(cupos.EN_ESPERA)


def test_si_se_libera_un_cupo_vuelven_a_poder_pagar_sin_tocar_nada():
    lleno = cupos.contar([PAGADO] * 170 + [SIN_PAGAR] * 5, 170)
    assert cupos.situacion(SIN_PAGAR, lleno) == cupos.EN_ESPERA
    # Un abono que no se saldo y se rechaza, o una baja.
    con_hueco = cupos.contar([PAGADO] * 169 + [CANCELADO] + [SIN_PAGAR] * 5, 170)
    assert cupos.situacion(SIN_PAGAR, con_hueco) == cupos.POR_CONFIRMAR
    assert cupos.impedimento_para_pagar(SIN_PAGAR, con_hueco) is None


def test_quien_tiene_el_abono_aprobado_siempre_puede_pagar_el_resto():
    lleno = cupos.contar([PAGADO] * 169 + [ABONO_APROBADO], 170)
    assert lleno["para_pagar"] == 0
    assert cupos.impedimento_para_pagar(ABONO_APROBADO, lleno) is None
    assert cupos.impedimento_para_asegurar(ABONO_APROBADO, lleno) is None


def test_la_organizacion_no_aprueba_por_encima_del_limite():
    lleno = cupos.contar([PAGADO] * 170 + [COMPROBANTE_SIN_REVISAR], 170)
    motivo = cupos.impedimento_para_asegurar(COMPROBANTE_SIN_REVISAR, lleno)
    assert motivo and "170" in motivo and "límite" in motivo
    # Subiendo el limite, pasa.
    con_mas = cupos.contar([PAGADO] * 170 + [COMPROBANTE_SIN_REVISAR], 171)
    assert cupos.impedimento_para_asegurar(COMPROBANTE_SIN_REVISAR, con_mas) is None


def test_quien_estaba_en_la_lista_de_espera_vieja_tambien_puede_pagar():
    """«Cualquiera que se inscriba pasa directo»: tambien los que ya esperaban."""
    c = cupos.contar([PAGADO] * 85 + [EN_LISTA_VIEJA] * 3, 170)
    assert cupos.situacion(EN_LISTA_VIEJA, c) == cupos.POR_CONFIRMAR
    assert cupos.impedimento_para_pagar(EN_LISTA_VIEJA, c) is None


def test_lo_que_ve_el_corredor():
    c = cupos.contar([PAGADO] * 85 + [SIN_PAGAR] * 80, 170)
    sin_pagar = cupos.para_el_corredor(SIN_PAGAR, c)
    assert sin_pagar["situacion"] == cupos.POR_CONFIRMAR
    assert "sigue activa" in sin_pagar["mensaje"] and "no está garantizado" in sin_pagar["mensaje"]
    assert "15 de noviembre" in sin_pagar["mensaje_abono"]
    assert sin_pagar["disponibles"] == 85

    pagado = cupos.para_el_corredor(PAGADO, c)
    assert pagado["situacion"] == cupos.ASEGURADO and pagado["mensaje"] == ""
