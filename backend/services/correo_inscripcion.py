"""Lo que se le manda a quien se acaba de inscribir en una carrera.

Desde que los cupos se aseguran pagando (`services/cupos.py`), inscribirse no
confirma nada: la inscripcion queda recibida y el cupo se asegura cuando la
organizacion verifica la transferencia. El correo tiene que decir eso y llevar
lo necesario para pagar en el momento —los datos de la cuenta y el enlace para
subir el comprobante—, porque quien paga primero se queda el cupo y mandarle a
buscar la cuenta a otro sitio es hacerle perder el turno.

Aqui se arma ese bloque. La plantilla es `athlete_registration_pending_payment`
(`routes/email_templates.py`) y quien lo envia es `routes/athletes.py`.
"""
import html
from typing import Optional

from services import correo_estilo as e
from services import cupos


def datos_de_la_cuenta(carrera: Optional[dict]) -> str:
    """Los datos para la transferencia, tal como estan en la configuracion de
    la carrera. Los escribe un administrador en el panel, y se escapan igual."""
    cfg = carrera or {}
    monto = cfg.get("registration_cost") or 0
    filas = [
        ("Monto", f"RD$ {monto:,.0f}" if monto else ""),
        ("Banco", cfg.get("payment_bank_name")),
        ("Titular", cfg.get("payment_account_name")),
        ("Tipo de cuenta", cfg.get("payment_account_type")),
        ("Número de cuenta", cfg.get("payment_account_number")),
        ("Documento del titular", cfg.get("payment_account_id")),
    ]
    return "".join(e.linea(etiqueta, html.escape(str(valor))) for etiqueta, valor in filas if valor)


def bloque_de_pago(carrera: Optional[dict], edit_token: Optional[str]) -> str:
    """Los pasos para asegurar el cupo: la cuenta, como avisar del pago y la
    opcion de abonar una parte."""
    from services.template_email_service import BASE_URL

    cuenta = datos_de_la_cuenta(carrera)
    comprobante = f"{BASE_URL}/subir-comprobante?token={edit_token}" if edit_token else f"{BASE_URL}/mi-perfil"
    plazo = f"{BASE_URL}/plazo-de-pago?token={edit_token}" if edit_token else f"{BASE_URL}/mi-perfil"

    bloques = []
    if cuenta:
        bloques += [e.h2("Datos para la transferencia"), cuenta]
    bloques += [
        e.h2("Cómo confirmar tu pago"),
        e.lista([
            "Haz la transferencia con los datos de arriba.",
            "Sube el comprobante con el botón de abajo, o desde tu perfil en «Carreras inscritas».",
            "Cuando verifiquemos la transferencia te avisamos: ahí tu inscripción queda confirmada.",
        ]),
        e.boton("Subir mi comprobante", comprobante),
        e.h2("¿Necesitas más tiempo?"),
        e.p(cupos.MENSAJE_ABONO),
        e.boton("Abonar una parte", plazo),
    ]
    return "".join(bloques)
