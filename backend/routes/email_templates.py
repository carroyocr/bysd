"""
Email Templates Management Routes
Allows admin users to manage email templates with merge fields
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import re

from services.auth import require_permission

# Las plantillas definen el contenido de todos los correos que envia el sitio,
# y /test manda correo desde la cuenta oficial: solo el permiso "emails".
router = APIRouter(
    prefix="/email-templates",
    tags=["Email Templates"],
    dependencies=[Depends(require_permission("emails"))],
)

# Merge field definitions by source
MERGE_FIELDS = {
    "race": {
        "label": "Carrera",
        "fields": [
            {"key": "{{race_name}}", "label": "Nombre de la carrera", "example": "Backyard Ultra Santo Domingo 2027"},
            {"key": "{{race_code}}", "label": "Código de carrera", "example": "BYSD-2027"},
            {"key": "{{race_date}}", "label": "Fecha de la carrera", "example": "23 de Enero, 2027"},
            {"key": "{{race_location}}", "label": "Ubicación", "example": "Santo Domingo, RD"},
            {"key": "{{race_logo_url}}", "label": "URL del logo", "example": "https://..."},
            {"key": "{{frontend_url}}", "label": "URL del sitio web", "example": "https://backyardultrasantodomingo.com"},
        ]
    },
    "athlete": {
        "label": "Atleta",
        "fields": [
            {"key": "{{athlete_nombre}}", "label": "Nombre", "example": "Juan"},
            {"key": "{{athlete_apellidos}}", "label": "Apellidos", "example": "Pérez García"},
            {"key": "{{athlete_nombre_completo}}", "label": "Nombre completo", "example": "Juan Pérez García"},
            {"key": "{{athlete_email}}", "label": "Correo electrónico", "example": "juan@email.com"},
            {"key": "{{athlete_bib}}", "label": "Número de BIB", "example": "042"},
            {"key": "{{athlete_nacionalidad}}", "label": "Nacionalidad", "example": "DOM"},
            {"key": "{{athlete_sexo}}", "label": "Sexo", "example": "Masculino"},
            {"key": "{{athlete_telefono}}", "label": "Teléfono", "example": "+1 809-555-1234"},
            {"key": "{{athlete_laps_completed}}", "label": "Vueltas completadas", "example": "12"},
            {"key": "{{athlete_total_km}}", "label": "Kilómetros totales", "example": "80.4"},
            {"key": "{{athlete_status}}", "label": "Estado", "example": "active"},
            {"key": "{{athlete_edit_link}}", "label": "Link de edición", "example": "https://.../editar/abc123"},
        ]
    },
    "volunteer": {
        "label": "Voluntario",
        "fields": [
            {"key": "{{event_name}}", "label": "Evento del voluntario (carrera o campeonato)", "example": "Campeonato Mundial por Equipos"},
            {"key": "{{volunteer_nombre}}", "label": "Nombre", "example": "María"},
            {"key": "{{volunteer_apellidos}}", "label": "Apellidos", "example": "López Díaz"},
            {"key": "{{volunteer_nombre_completo}}", "label": "Nombre completo", "example": "María López Díaz"},
            {"key": "{{volunteer_email}}", "label": "Correo electrónico", "example": "maria@email.com"},
            {"key": "{{volunteer_telefono}}", "label": "Teléfono", "example": "+1 809-555-5678"},
            {"key": "{{volunteer_puesto}}", "label": "Puesto asignado", "example": "Hidratación"},
            {"key": "{{volunteer_turno}}", "label": "Turno", "example": "A"},
            {"key": "{{volunteer_dia}}", "label": "Día del turno", "example": "23 de Enero, 2027"},
            {"key": "{{volunteer_hora_inicio}}", "label": "Hora de inicio", "example": "8:00 AM"},
            {"key": "{{volunteer_hora_fin}}", "label": "Hora de fin", "example": "12:00 PM"},
            {"key": "{{volunteer_edit_link}}", "label": "Link de edición", "example": "https://.../voluntarios/editar/abc123"},
            {"key": "{{volunteer_turnos}}", "label": "Lista de turnos (solo en 'Asignación de Varios Turnos')", "example": "Puesto, turno, fecha y horario de cada turno"},
            {"key": "{{volunteer_turnos_total}}", "label": "Cantidad de turnos asignados", "example": "3"},
            {"key": "{{rechazo_motivo}}", "label": "Motivo del rechazo (solo en las plantillas de rechazo)", "example": "Ese puesto ya quedó cubierto"},
        ]
    },
    "payment": {
        "label": "Pago",
        "fields": [
            {"key": "{{payment_amount}}", "label": "Monto", "example": "RD$ 3,500.00"},
            {"key": "{{payment_method}}", "label": "Método de pago", "example": "Transferencia bancaria"},
            {"key": "{{payment_reference}}", "label": "Referencia", "example": "REF-123456"},
            {"key": "{{payment_date}}", "label": "Fecha de pago", "example": "15 de Enero, 2027"},
            {"key": "{{payment_status}}", "label": "Estado del pago", "example": "Confirmado"},
            {"key": "{{payment_bank_name}}", "label": "Nombre del banco", "example": "Banco Popular"},
            {"key": "{{payment_account_name}}", "label": "Titular de cuenta", "example": "Backyard Ultra SD"},
            {"key": "{{payment_account_number}}", "label": "Número de cuenta", "example": "123-456789-0"},
            {"key": "{{payment_account_type}}", "label": "Tipo de cuenta", "example": "Corriente"},
            {"key": "{{payment_account_id}}", "label": "Identificación (Cédula/RNC)", "example": "001-1234567-8"},
            {"key": "{{payment_upload_url}}", "label": "Link subir comprobante", "example": "https://.../subir-comprobante"},
            {"key": "{{payment_cancel_url}}", "label": "Link cancelar registro", "example": "https://.../cancelar"},
        ]
    },
    "general": {
        "label": "General",
        "fields": [
            {"key": "{{current_date}}", "label": "Fecha actual", "example": "2 de Febrero, 2027"},
            {"key": "{{current_year}}", "label": "Año actual", "example": "2027"},
            {"key": "{{verification_code}}", "label": "Código de verificación", "example": "123456"},
            {"key": "{{username}}", "label": "Usuario", "example": "admin.user"},
            {"key": "{{password}}", "label": "Contraseña", "example": "********"},
        ]
    }
}

# Default email templates
#
# El contenido no se escribe a mano: se arma con las piezas de
# `services.correo_estilo`, que es donde vive el diseno de los correos. Asi un
# cambio de estilo (tipografia, color del boton, pie) se hace una vez y sale en
# los treinta y uno, en vez de repetirse pegado en cada plantilla.
#
# Quien edite una plantilla desde el panel escribe HTML suelto y eso sigue
# valiendo: esto es solo el punto de partida.
from services import correo_estilo as e


def _correo(*bloques: str) -> str:
    """Junta los bloques y los envuelve. Fragmento y no documento completo:
    `send_templated_email` pega detras la banda del patrocinador."""
    return e.fragmento("".join(bloques))


_PIE_CARRERA = "{{race_name}} · {{race_date}}"

DEFAULT_TEMPLATES = [
    {
        "id": "athlete_waitlist_confirmation",
        "name": "Registro en Lista de Espera - Atleta",
        "description": "Se envía cuando un atleta se registra pero el cupo máximo ya está completo",
        "subject": "Estás en lista de espera - {{race_name}}",
        "category": "atletas",
        "merge_sources": ["race", "athlete"],
        "content": _correo(
            e.h1("Estás en lista de espera"),
            e.p("Hola <strong>{{athlete_nombre_completo}}</strong>,"),
            e.p("Gracias por tu interés en <strong>{{race_name}}</strong>. Ahora mismo el cupo "
                "está completo, así que tu registro queda en la <strong>lista de espera</strong>."),
            e.p("Si se libera un lugar te escribimos a este mismo correo, siguiendo el orden de "
                "la lista. No tienes que hacer nada por ahora."),
            e.boton("Editar mi registro", "{{athlete_edit_link}}"),
            e.nota(_PIE_CARRERA),
        ),
    },
    {
        "id": "athlete_registration_confirmation",
        "name": "Confirmación de Registro - Atleta",
        "description": "Se envía cuando un atleta completa su pre-registro",
        "subject": "Registro confirmado - {{race_name}}",
        "category": "atletas",
        "merge_sources": ["race", "athlete"],
        "content": _correo(
            e.h1("Registro confirmado"),
            e.p("Hola <strong>{{athlete_nombre_completo}}</strong>,"),
            "{{proximos_pasos}}",
            e.boton("Editar mi registro", "{{athlete_edit_link}}"),
            e.nota(_PIE_CARRERA),
        ),
    },
    {
        "id": "volunteer_registration_confirmation",
        "name": "Confirmación de Registro - Voluntario",
        "description": "Se envía cuando un voluntario completa su registro",
        "subject": "Registro de voluntario confirmado - {{race_name}}",
        "category": "voluntarios",
        "merge_sources": ["race", "volunteer"],
        "content": _correo(
            e.h1("Gracias por ser voluntario"),
            e.p("Hola <strong>{{volunteer_nombre_completo}}</strong>,"),
            e.p("Recibimos tu registro como voluntario para <strong>{{race_name}}</strong>. "
                "Te escribimos próximamente para confirmarte el turno."),
            e.boton("Modificar mi registro", "{{volunteer_edit_link}}"),
            e.nota(_PIE_CARRERA),
        ),
    },
    {
        "id": "volunteer_shift_assignment",
        "name": "Asignación de Turno - Voluntario",
        "description": "Se envía cuando se asigna un turno a un voluntario",
        "subject": "Tu turno ha sido asignado - {{race_name}}",
        "category": "voluntarios",
        "merge_sources": ["race", "volunteer"],
        "content": _correo(
            e.h1("Turno asignado"),
            e.p("Hola <strong>{{volunteer_nombre_completo}}</strong>,"),
            e.p("Este es el turno que te toca:"),
            e.h2("{{volunteer_puesto}}"),
            e.linea("Turno", "{{volunteer_turno}}"),
            e.linea("Fecha", "{{volunteer_dia}}"),
            e.linea("Horario", "{{volunteer_hora_inicio}} a {{volunteer_hora_fin}}"),
            e.separador(),
            e.p("Llega 15 minutos antes y ponte la camiseta oficial de staff."),
            e.nota("{{race_name}}"),
        ),
    },
    {
        "id": "volunteer_shifts_assignment",
        "name": "Asignación de Varios Turnos - Voluntario",
        "description": "Se envía cuando se le confirman varios turnos de una vez a un voluntario (un solo correo con todos)",
        "subject": "Tus turnos han sido asignados - {{race_name}}",
        "category": "voluntarios",
        "merge_sources": ["race", "volunteer"],
        "content": _correo(
            e.h1("Turnos asignados"),
            e.p("Hola <strong>{{volunteer_nombre_completo}}</strong>,"),
            e.p("Te tocan <strong>{{volunteer_turnos_total}}</strong> turnos:"),
            "{{volunteer_turnos}}",
            e.p("Llega 15 minutos antes de cada uno."),
            e.nota("{{race_name}}"),
        ),
    },
    {
        "id": "volunteer_shift_reminder",
        "name": "Recordatorio de Turno - Voluntario",
        "description": "Se envía 1 hora antes del inicio del turno",
        "subject": "Tu turno comienza en 1 hora - {{race_name}}",
        "category": "voluntarios",
        "merge_sources": ["race", "volunteer"],
        "content": _correo(
            e.h1("Tu turno empieza en una hora"),
            e.p("Hola <strong>{{volunteer_nombre_completo}}</strong>,"),
            e.h2("{{volunteer_puesto}}"),
            e.linea("Horario", "{{volunteer_hora_inicio}} a {{volunteer_hora_fin}}"),
            e.separador(),
            e.p("Acuérdate de la camiseta oficial de staff."),
            e.nota("{{race_name}}"),
        ),
    },
    {
        "id": "payment_reminder",
        "name": "Recordatorio de Pago",
        "description": "Se envía para recordar un pago pendiente con datos bancarios",
        "subject": "Recordatorio: Pago pendiente - {{race_name}}",
        "category": "pagos",
        "merge_sources": ["race", "athlete", "payment"],
        "content": _correo(
            e.h1("Tienes un pago pendiente"),
            e.p("Hola <strong>{{athlete_nombre_completo}}</strong>,"),
            e.p("Tu pago de inscripción para <strong>{{race_name}}</strong> sigue pendiente."),
            e.cifra("Monto a pagar", "{{payment_amount}}"),
            e.h2("Datos para el pago"),
            e.linea("Banco", "{{payment_bank_name}}"),
            e.linea("Titular", "{{payment_account_name}}"),
            e.linea("Tipo de cuenta", "{{payment_account_type}}"),
            e.linea("Número de cuenta", "{{payment_account_number}}"),
            e.linea("Número de pasaporte", "{{payment_account_id}}"),
            e.separador(),
            e.p("Cuando pagues, sube el comprobante para que confirmemos tu inscripción."),
            e.boton("Subir comprobante", "{{payment_upload_url}}"),
            e.nota("Si al final no puedes participar, puedes "
                   + e.enlace("cancelar tu registro", "{{payment_cancel_url}}") + "."),
            e.nota("{{race_name}}"),
        ),
    },
    {
        "id": "payment_received",
        "name": "Pago Recibido",
        "description": "Se envía cuando se recibe un comprobante de pago",
        "subject": "Pago recibido - {{race_name}}",
        "category": "pagos",
        "merge_sources": ["race", "athlete", "payment"],
        "content": _correo(
            e.h1("Recibimos tu pago"),
            e.p("Hola <strong>{{athlete_nombre_completo}}</strong>,"),
            e.p("Nos llegó tu comprobante para <strong>{{race_name}}</strong>."),
            e.linea("Monto", "{{payment_amount}}"),
            e.linea("Referencia", "{{payment_reference}}"),
            e.linea("Estado", "En revisión"),
            e.separador(),
            e.p("Lo estamos revisando. Te avisamos en cuanto quede confirmado."),
            e.nota("{{race_name}}"),
        ),
    },
    {
        "id": "payment_receipt_received",
        "name": "Comprobante de Pago Recibido",
        "description": "Se envía cuando un atleta sube su comprobante de pago",
        "subject": "Comprobante Recibido - {{race_name}}",
        "category": "pagos",
        "merge_sources": ["race", "athlete"],
        "content": _correo(
            e.h1("Comprobante recibido"),
            e.p("Hola <strong>{{athlete_nombre_completo}}</strong>,"),
            e.p("Esto es lo que nos llegó:"),
            e.linea("Fecha de pago", "{{payment_date}}"),
            e.linea("Banco origen", "{{bank_origin}}"),
            e.linea("No. de transferencia", "{{transfer_number}}"),
            e.linea("Estado", "En revisión"),
            e.separador(),
            e.p("Te avisamos por correo en cuanto el pago quede confirmado."),
            e.nota("{{race_name}}"),
        ),
    },
    {
        "id": "payment_confirmed",
        "name": "Pago Confirmado",
        "description": "Se envía cuando se confirma un pago",
        "subject": "Pago confirmado - {{race_name}}",
        "category": "pagos",
        "merge_sources": ["race", "athlete", "payment"],
        "content": _correo(
            e.h1("Pago confirmado"),
            e.p("Hola <strong>{{athlete_nombre_completo}}</strong>,"),
            e.p("Confirmamos tu pago para <strong>{{race_name}}</strong>. Tu lugar en la carrera "
                "está asegurado."),
            e.linea("Monto", "{{payment_amount}}"),
            e.linea("Fecha", "{{payment_date}}"),
            e.linea("Estado", "Confirmado"),
            e.separador(),
            e.p("En tu perfil tienes tus datos, tu inscripción y las actividades a las que "
                "puedes apuntarte."),
            e.boton("Ir a mi perfil", "{{frontend_url}}/mi-perfil"),
            e.nota("Guarda este correo: es tu comprobante de inscripción."),
            e.nota(_PIE_CARRERA),
        ),
    },
    {
        "id": "registration_courtesy",
        "name": "Inscripción Confirmada (sin costo)",
        "description": (
            "Se envía al marcar a un atleta como inscripción libre de costo "
            "(invitados y cupones de patrocinio). Confirma el cupo sin hablar de dinero: "
            "el motivo de la bonificación queda en el panel, no en el correo."
        ),
        "subject": "Inscripción confirmada - {{race_name}}",
        "category": "atletas",
        "merge_sources": ["race", "athlete"],
        "content": _correo(
            e.h1("Inscripción confirmada"),
            e.p("Hola <strong>{{athlete_nombre_completo}}</strong>,"),
            e.p("Ya tienes tu lugar en la línea de salida. No te queda ningún trámite pendiente."),
            e.linea("Carrera", "{{race_name}}"),
            e.linea("Fecha", "{{race_date}}"),
            e.linea("Estado", "Confirmada"),
            e.separador(),
            e.p("Aprovecha para revisar que tus datos estén correctos."),
            e.boton("Ir a mi perfil", "{{frontend_url}}/mi-perfil"),
            e.nota(_PIE_CARRERA),
        ),
    },
    {
        "id": "payment_period_opening",
        "name": "Apertura del Período de Pagos",
        "description": "Anuncia el inicio del período de pagos de la inscripción, con fecha límite del 15 de septiembre",
        "subject": "Inicia el período de pagos - {{race_name}}",
        "category": "pagos",
        "merge_sources": ["race", "athlete", "payment"],
        "content": _correo(
            e.h1("Abre el período de pagos"),
            e.p("Hola <strong>{{athlete_nombre_completo}}</strong>,"),
            e.p("Ya puedes pagar tu inscripción para <strong>{{race_name}}</strong>."),
            e.cifra("Tienes hasta el", "15 de septiembre"),
            e.h2("Datos para el pago"),
            e.linea("Monto", "{{payment_amount}}"),
            e.linea("Banco", "{{payment_bank_name}}"),
            e.linea("Titular", "{{payment_account_name}}"),
            e.linea("Tipo de cuenta", "{{payment_account_type}}"),
            e.linea("Número de cuenta", "{{payment_account_number}}"),
            e.linea("Número de pasaporte", "{{payment_account_id}}"),
            e.h2("Cómo notificar tu pago"),
            e.lista([
                "Haz el pago con los datos de arriba.",
                "Entra a tu perfil en el sitio.",
                "Ve a <strong>Carreras inscritas</strong>.",
                "Pulsa <strong>Notificar pago</strong> y adjunta el comprobante.",
            ]),
            e.boton("Ir a mi perfil", "{{frontend_url}}/mi-perfil"),
            e.separador(),
            e.p("<strong>Importante:</strong> a partir del <strong>15 de septiembre</strong>, si no "
                "hemos recibido tu pago, tu inscripción se cancela y el lugar pasa a la lista "
                "de espera."),
            e.nota(_PIE_CARRERA),
        ),
    },
    {
        "id": "email_verification",
        "name": "Verificación de Email",
        "description": "Se envía con el código de verificación",
        "subject": "Código de verificación - {{race_name}}",
        "category": "sistema",
        "merge_sources": ["race", "general"],
        "content": _correo(
            e.h1("Tu código de verificación"),
            e.codigo("{{verification_code}}"),
            e.p("Escríbelo en la página donde lo pediste. Caduca en 30 minutos."),
            e.nota("{{race_name}}"),
        ),
    },
    {
        "id": "admin_credentials",
        "name": "Credenciales de Administrador",
        "description": "Se envía cuando se crea un nuevo usuario admin",
        "subject": "Tus credenciales de acceso - {{race_name}}",
        "category": "sistema",
        "merge_sources": ["race", "general"],
        "content": _correo(
            e.h1("Tus credenciales de acceso"),
            e.p("Te creamos una cuenta en el panel de <strong>{{race_name}}</strong>."),
            e.linea("Usuario", "{{username}}"),
            e.linea("Contraseña", "{{password}}"),
            e.separador(),
            e.p("Cambia la contraseña la primera vez que entres."),
            e.boton("Ir al panel", "{{frontend_url}}/admin"),
            e.nota("{{race_name}}"),
        ),
    },
    {
        "id": "bib_assignment",
        "name": "Asignación de BIB",
        "description": "Se envía cuando se asigna un número de BIB al atleta",
        "subject": "Tu número de BIB: #{{athlete_bib}} - {{race_name}}",
        "category": "atletas",
        "merge_sources": ["race", "athlete"],
        "content": _correo(
            e.h1("Ya tienes número"),
            e.p("Hola <strong>{{athlete_nombre_completo}}</strong>,"),
            e.p("Este es tu número de corredor para <strong>{{race_name}}</strong>."),
            e.cifra("Tu BIB", "#{{athlete_bib}}"),
            e.p("Nos vemos en la línea de salida."),
            e.nota(_PIE_CARRERA),
        ),
    },
    {
        "id": "runner_summary",
        "name": "Resumen Post-Carrera - Corredor",
        "description": "Se envía después de la carrera con el resumen del corredor",
        "subject": "Tu resumen del {{race_name}}",
        "category": "atletas",
        "merge_sources": ["race", "athlete"],
        "content": _correo(
            e.h1("Lo que hiciste"),
            e.p("Hola <strong>{{athlete_nombre_completo}}</strong>,"),
            e.p("Gracias por correr <strong>{{race_name}}</strong>. Así quedó tu carrera:"),
            e.cifra("Vueltas", "{{athlete_laps_completed}}"),
            e.cifra("Kilómetros", "{{athlete_total_km}}"),
            e.p("Nos vemos en la próxima edición."),
            e.nota("{{race_name}}"),
        ),
    },
    {
        "id": "athlete_cancellation",
        "name": "Confirmación de Cancelación - Atleta",
        "description": "Se envía cuando un atleta cancela su registro",
        "subject": "Confirmación de Cancelación - {{race_name}}",
        "category": "atletas",
        "merge_sources": ["race", "athlete"],
        "content": _correo(
            e.h1("Registro cancelado"),
            e.p("Hola <strong>{{athlete_nombre_completo}}</strong>,"),
            e.p("Tu registro para <strong>{{race_name}}</strong> queda cancelado y borrado de "
                "nuestro sistema."),
            e.linea("Razón", "{{cancellation_reason}}"),
            e.separador(),
            e.p("Si cambias de opinión, puedes volver a registrarte cuando quieras."),
            e.nota("{{race_name}}"),
        ),
    },
    {
        "id": "volunteer_cancellation",
        "name": "Confirmación de Cancelación - Voluntario",
        "description": "Se envía cuando un voluntario cancela su registro",
        "subject": "Confirmación de Cancelación - Voluntario {{race_name}}",
        "category": "voluntarios",
        "merge_sources": ["race", "volunteer"],
        "content": _correo(
            e.h1("Postulación cancelada"),
            e.p("Hola <strong>{{volunteer_nombre_completo}}</strong>,"),
            e.p("Tu postulación como voluntario para <strong>{{race_name}}</strong> queda cancelada "
                "y borrada de nuestro sistema."),
            e.linea("Razón", "{{cancellation_reason}}"),
            e.separador(),
            e.p("Si cambias de opinión, puedes postularte de nuevo cuando quieras."),
            e.nota("{{race_name}}"),
        ),
    },
    {
        "id": "volunteer_shift_rejected",
        "name": "Turno Rechazado - Voluntario",
        "description": "Se envía cuando se rechaza uno de los turnos que pidió un voluntario (sigue postulado)",
        "subject": "Sobre uno de tus turnos - {{race_name}}",
        "category": "voluntarios",
        "merge_sources": ["race", "volunteer"],
        "content": _correo(
            e.h1("Sobre uno de tus turnos"),
            e.p("Hola <strong>{{volunteer_nombre_completo}}</strong>,"),
            e.p("Gracias por ofrecerte en <strong>{{race_name}}</strong>. En este turno no vamos a "
                "poder contar contigo:"),
            e.h2("{{volunteer_puesto}}"),
            e.linea("Turno", "{{volunteer_turno}}"),
            e.linea("Día", "{{volunteer_dia}}"),
            e.linea("Horario", "{{volunteer_hora_inicio}} a {{volunteer_hora_fin}}"),
            e.linea("Motivo", "{{rechazo_motivo}}"),
            e.separador(),
            e.p("Tu postulación sigue activa: los demás turnos que pediste no se ven afectados."),
            e.nota("{{race_name}}"),
        ),
    },
    {
        "id": "volunteer_application_rejected",
        "name": "Solicitud Rechazada - Voluntario",
        "description": "Se envía cuando se rechaza la postulación completa de un voluntario",
        "subject": "Sobre tu postulación como voluntario - {{race_name}}",
        "category": "voluntarios",
        "merge_sources": ["race", "volunteer"],
        "content": _correo(
            e.h1("Sobre tu postulación"),
            e.p("Hola <strong>{{volunteer_nombre_completo}}</strong>,"),
            e.p("Gracias por ofrecerte como voluntario en <strong>{{race_name}}</strong>. En esta "
                "ocasión no vamos a poder contar contigo."),
            e.linea("Motivo", "{{rechazo_motivo}}"),
            e.separador(),
            e.p("Agradecemos de verdad tu disposición y esperamos verte en una próxima edición."),
            e.nota("{{race_name}}"),
        ),
    },
    {
        "id": "volunteer_verification_code",
        "name": "Código de Verificación - Voluntario",
        "description": "Se envía con el código de verificación para voluntarios",
        "subject": "Código de Verificación - Voluntarios {{race_name}}",
        "category": "voluntarios",
        "merge_sources": ["race", "general"],
        "content": _correo(
            e.h1("Tu código de verificación"),
            e.p("Para completar tu registro como voluntario:"),
            e.codigo("{{verification_code}}"),
            e.p("Caduca en 30 minutos."),
            e.nota("{{race_name}}"),
        ),
    },
    {
        "id": "volunteer_edit_link",
        "name": "Link de Edición - Voluntario",
        "description": "Se envía con el link para editar la postulación",
        "subject": "Link para Editar tu Postulación - {{race_name}}",
        "category": "voluntarios",
        "merge_sources": ["race", "volunteer"],
        "content": _correo(
            e.h1("Editar tu postulación"),
            e.p("Hola <strong>{{volunteer_nombre_completo}}</strong>,"),
            e.p("Desde aquí puedes cambiar tus datos y tus turnos:"),
            e.boton("Editar mi postulación", "{{volunteer_edit_link}}"),
            e.nota("Si no pediste este enlace, ignora este correo."),
            e.nota("{{race_name}}"),
        ),
    },
    {
        "id": "payment_rejected",
        "name": "Pago Rechazado",
        "description": "Se envía cuando se rechaza un comprobante de pago",
        "subject": "Comprobante de Pago Rechazado - {{race_name}}",
        "category": "pagos",
        "merge_sources": ["race", "athlete", "payment"],
        "content": _correo(
            e.h1("No pudimos verificar tu comprobante"),
            e.p("Hola <strong>{{athlete_nombre_completo}}</strong>,"),
            e.p("El comprobante que enviaste no se pudo verificar. Suele ser por una de estas "
                "razones:"),
            e.lista([
                "La imagen está borrosa o no se lee.",
                "El monto no coincide.",
                "La cuenta de destino no es la del evento.",
                "El comprobante ya se había usado.",
            ]),
            e.p("Envía uno nuevo para completar tu inscripción."),
            e.boton("Subir otro comprobante", "{{frontend_url}}/mi-perfil"),
            e.nota("{{race_name}}"),
        ),
    },
    {
        "id": "athlete_edit_code",
        "name": "Código de Acceso - Atleta",
        "description": "Se envía con el código para editar el registro del atleta",
        "subject": "Código de Acceso - {{race_name}}",
        "category": "atletas",
        "merge_sources": ["race", "athlete", "general"],
        "content": _correo(
            e.h1("Tu código de acceso"),
            e.p("Hola <strong>{{athlete_nombre_completo}}</strong>,"),
            e.p("Con este código entras a tu registro para cambiar lo que necesites:"),
            e.codigo("{{verification_code}}"),
            e.p("Caduca en 30 minutos."),
            e.nota("{{race_name}}"),
        ),
    },
    {
        "id": "password_reset",
        "name": "Recuperación de Contraseña",
        "description": "Se envía con el código para restablecer la contraseña del perfil",
        "subject": "Código para restablecer tu contraseña - {{race_name}}",
        "category": "sistema",
        "merge_sources": ["race", "athlete", "general"],
        "content": _correo(
            e.h1("Restablecer tu contraseña"),
            e.p("Hola <strong>{{athlete_nombre}}</strong>,"),
            e.p("Pediste restablecer la contraseña de tu perfil. Usa este código:"),
            e.codigo("{{verification_code}}"),
            e.p("Caduca en 30 minutos."),
            e.nota("Si no fuiste tú, ignora este correo: tu contraseña actual sigue funcionando."),
            e.nota("{{race_name}}"),
        ),
    },
]
class EmailTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    subject: Optional[str] = None
    content: Optional[str] = None


class TestEmailRequest(BaseModel):
    template_id: str
    to_email: str


# Helper function to get database
def get_db():
    from server import db
    return db


@router.get("/merge-fields")
async def get_merge_fields():
    """Get all available merge fields organized by source"""
    return MERGE_FIELDS


@router.get("/")
async def get_templates(db=Depends(get_db)):
    """Get all email templates"""
    templates = await db.email_templates.find({}, {"_id": 0}).to_list(100)
    
    # If no templates exist, initialize with defaults
    if not templates:
        for template in DEFAULT_TEMPLATES:
            template_copy = template.copy()
            template_copy["created_at"] = datetime.now(timezone.utc)
            template_copy["updated_at"] = datetime.now(timezone.utc)
            await db.email_templates.insert_one(template_copy)
        templates = await db.email_templates.find({}, {"_id": 0}).to_list(100)
    else:
        # Check for missing templates and add them
        existing_ids = {t["id"] for t in templates}
        for template in DEFAULT_TEMPLATES:
            if template["id"] not in existing_ids:
                template_copy = template.copy()
                template_copy["created_at"] = datetime.now(timezone.utc)
                template_copy["updated_at"] = datetime.now(timezone.utc)
                await db.email_templates.insert_one(template_copy)
        
        # Refresh list if we added any
        if len(existing_ids) < len(DEFAULT_TEMPLATES):
            templates = await db.email_templates.find({}, {"_id": 0}).to_list(100)
    
    return templates


@router.get("/{template_id}")
async def get_template(template_id: str, db=Depends(get_db)):
    """Get a specific email template"""
    template = await db.email_templates.find_one({"id": template_id}, {"_id": 0})
    
    if not template:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")
    
    return template


@router.put("/{template_id}")
async def update_template(template_id: str, update: EmailTemplateUpdate, db=Depends(get_db)):
    """Update an email template"""
    template = await db.email_templates.find_one({"id": template_id})
    
    if not template:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")
    
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.email_templates.update_one(
        {"id": template_id},
        {"$set": update_data}
    )
    
    updated = await db.email_templates.find_one({"id": template_id}, {"_id": 0})
    return updated


@router.post("/reset-all")
async def reset_all_templates(db=Depends(get_db)):
    """Reset every template to its default content (discards manual edits)."""
    now = datetime.now(timezone.utc)
    for default in DEFAULT_TEMPLATES:
        default_copy = default.copy()
        default_copy["updated_at"] = now
        await db.email_templates.update_one(
            {"id": default["id"]},
            {"$set": default_copy},
            upsert=True
        )
    return {"message": f"{len(DEFAULT_TEMPLATES)} plantillas restablecidas a valores por defecto"}


@router.post("/reset/{template_id}")
async def reset_template(template_id: str, db=Depends(get_db)):
    """Reset a template to its default content"""
    default = next((t for t in DEFAULT_TEMPLATES if t["id"] == template_id), None)
    
    if not default:
        raise HTTPException(status_code=404, detail="Plantilla por defecto no encontrada")
    
    default_copy = default.copy()
    default_copy["updated_at"] = datetime.now(timezone.utc)
    
    await db.email_templates.update_one(
        {"id": template_id},
        {"$set": default_copy},
        upsert=True
    )
    
    return {"message": "Plantilla restablecida a valores por defecto"}


@router.post("/test")
async def send_test_email(request: TestEmailRequest, db=Depends(get_db)):
    """Send a test email with sample data"""
    from services.template_email_service import render_template, send_templated_email_with_error

    template = await db.email_templates.find_one({"id": request.template_id}, {"_id": 0})
    
    if not template:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")
    
    # Get active race for sample data
    race_config = await db.race_configurations.find_one({"is_active": True}, {"_id": 0})
    
    # Build sample data based on merge sources
    sample_data = {
        # Race data
        "race_name": race_config.get("name", "Backyard Ultra Santo Domingo 2027") if race_config else "Backyard Ultra Santo Domingo 2027",
        "race_code": race_config.get("code", "BYSD-2027") if race_config else "BYSD-2027",
        "race_date": race_config.get("date", "23 de Enero, 2027") if race_config else "23 de Enero, 2027",
        "race_location": race_config.get("location", "Santo Domingo, RD") if race_config else "Santo Domingo, RD",
        "race_logo_url": race_config.get("logo_url", "") if race_config else "",
        "frontend_url": "https://backyardultrasantodomingo.com",
        
        # Athlete data (sample)
        "athlete_nombre": "Juan",
        "athlete_apellidos": "Pérez García",
        "athlete_nombre_completo": "Juan Pérez García",
        "athlete_email": request.to_email,
        "athlete_bib": "042",
        "athlete_nacionalidad": "DOM",
        "athlete_sexo": "Masculino",
        "athlete_telefono": "+1 809-555-1234",
        "athlete_laps_completed": "12",
        "athlete_total_km": "80.4",
        "athlete_status": "active",
        "athlete_edit_link": "https://backyardultrasantodomingo.com/editar/sample-token",
        
        # Volunteer data (sample)
        "volunteer_nombre": "María",
        "volunteer_apellidos": "López Díaz",
        "volunteer_nombre_completo": "María López Díaz",
        "volunteer_email": request.to_email,
        "volunteer_telefono": "+1 809-555-5678",
        "volunteer_puesto": "Hidratación - Punto 3",
        "volunteer_turno": "A",
        "volunteer_dia": "23 de Enero, 2027",
        "volunteer_hora_inicio": "8:00 AM",
        "volunteer_hora_fin": "12:00 PM",
        "volunteer_edit_link": "https://backyardultrasantodomingo.com/voluntarios/editar/sample-token",
        
        # Payment data (sample)
        "payment_amount": "RD$ 3,500.00",
        "payment_method": "Transferencia bancaria",
        "payment_reference": "REF-123456",
        "payment_date": "15 de Enero, 2027",
        "payment_status": "Confirmado",
        "payment_bank_name": "Banco Popular",
        "payment_account_name": "Backyard Ultra SD",
        "payment_account_number": "123-456789-0",
        "payment_account_type": "Corriente",
        "payment_account_id": "001-1234567-8",
        "payment_upload_url": "https://backyardultrasantodomingo.com/subir-comprobante",
        "payment_cancel_url": "https://backyardultrasantodomingo.com/cancelar-registro",

        # General data
        "current_date": datetime.now().strftime("%d de %B, %Y"),
        "current_year": str(datetime.now().year),
        "verification_code": "123456",
        "username": "test.user",
        "password": "TempPass123!",
    }
    
    # Render template
    rendered_subject = render_template(template["subject"], sample_data, escape=False)
    rendered_content = render_template(template["content"], sample_data)
    
    # Send test email
    success, error = await send_templated_email_with_error(
        to_email=request.to_email,
        subject=f"[PRUEBA] {rendered_subject}",
        html_content=rendered_content
    )

    if success:
        return {"message": f"Correo de prueba enviado a {request.to_email}"}
    else:
        raise HTTPException(status_code=500, detail=f"Error al enviar el correo de prueba. {error}")


@router.post("/preview")
async def preview_template(template_id: str, db=Depends(get_db)):
    """Get a rendered preview of a template with sample data"""
    from services.template_email_service import render_template
    
    template = await db.email_templates.find_one({"id": template_id}, {"_id": 0})
    
    if not template:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")
    
    # Get active race
    race_config = await db.race_configurations.find_one({"is_active": True}, {"_id": 0})
    
    # Sample data for preview
    sample_data = {
        "race_name": race_config.get("name", "Backyard Ultra Santo Domingo 2027") if race_config else "Backyard Ultra Santo Domingo 2027",
        "race_code": race_config.get("code", "BYSD-2027") if race_config else "BYSD-2027",
        "race_date": "23 de Enero, 2027",
        "race_location": "Santo Domingo, RD",
        "frontend_url": "https://backyardultrasantodomingo.com",
        "athlete_nombre": "Juan",
        "athlete_apellidos": "Pérez García",
        "athlete_nombre_completo": "Juan Pérez García",
        "athlete_bib": "042",
        "athlete_laps_completed": "12",
        "athlete_total_km": "80.4",
        "athlete_edit_link": "#",
        "volunteer_nombre_completo": "María López Díaz",
        "volunteer_puesto": "Hidratación",
        "volunteer_turno": "A",
        "volunteer_dia": "23 de Enero, 2027",
        "volunteer_hora_inicio": "8:00 AM",
        "volunteer_hora_fin": "12:00 PM",
        "volunteer_edit_link": "#",
        "payment_amount": "RD$ 3,500.00",
        "payment_reference": "REF-123456",
        "payment_date": "15 de Enero, 2027",
        "payment_bank_name": "Banco Popular",
        "payment_account_name": "Backyard Ultra SD",
        "payment_account_number": "123-456789-0",
        "payment_account_type": "Corriente",
        "payment_account_id": "001-1234567-8",
        "payment_upload_url": "https://backyardultrasantodomingo.com/subir-comprobante",
        "payment_cancel_url": "https://backyardultrasantodomingo.com/cancelar-registro",
        "verification_code": "123456",
        "username": "usuario.ejemplo",
        "password": "********",
        "current_date": datetime.now().strftime("%d de %B, %Y"),
        "current_year": str(datetime.now().year),
    }
    
    rendered_subject = render_template(template["subject"], sample_data, escape=False)
    rendered_content = render_template(template["content"], sample_data)
    
    return {
        "subject": rendered_subject,
        "content": rendered_content
    }
