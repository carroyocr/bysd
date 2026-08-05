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
DEFAULT_TEMPLATES = [
    {
        "id": "athlete_waitlist_confirmation",
        "name": "Registro en Lista de Espera - Atleta",
        "description": "Se envía cuando un atleta se registra pero el cupo máximo ya está completo",
        "subject": "Estás en lista de espera - {{race_name}}",
        "category": "atletas",
        "merge_sources": ["race", "athlete"],
        "content": """
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: #1f2937; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Estás en Lista de Espera</h1></div>
    <div style="padding: 30px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none;">
        <p style="font-size: 16px; color: #1f2937;">Hola <strong>{{athlete_nombre_completo}}</strong>,</p>
        <p style="font-size: 16px; color: #4b5563; line-height: 1.6;">¡Gracias por tu interés en <strong>{{race_name}}</strong>! En este momento hemos alcanzado el cupo máximo de participantes, por lo que tu registro ha quedado en nuestra <strong>lista de espera</strong>.</p>
        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #9ca3af;">
            <p style="margin: 0; color: #374151; line-height: 1.6;">Si se libera un espacio (por ejemplo, una cancelación), te contactaremos por este mismo correo siguiendo el orden de la lista de espera para confirmar tu inscripción.</p></div>
        <p style="font-size: 14px; color: #6b7280; line-height: 1.6;">No necesitas hacer nada por ahora. Si necesitas modificar tus datos, usa este enlace:<br>
            <a href="{{athlete_edit_link}}" style="color: #1f2937;">Editar mi registro</a></p></div>
    <div style="background: #1f2937; padding: 20px; text-align: center; border-radius: 0 0 10px 10px;">
        <p style="color: #9ca3af; margin: 0; font-size: 12px;">{{race_name}} • {{race_date}}</p></div>
</div>
"""
    },
    {
        "id": "athlete_registration_confirmation",
        "name": "Confirmación de Registro - Atleta",
        "description": "Se envía cuando un atleta completa su pre-registro",
        "subject": "Registro confirmado - {{race_name}}",
        "category": "atletas",
        "merge_sources": ["race", "athlete"],
        "content": """
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: #1f2937; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">¡Registro Confirmado!</h1></div>
    <div style="padding: 30px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none;">
        <p style="font-size: 16px; color: #1f2937;">Hola <strong>{{athlete_nombre_completo}}</strong>,</p>
        {{proximos_pasos}}
        <p style="font-size: 14px; color: #6b7280;">Si necesitas modificar tu registro, usa este enlace:<br>
            <a href="{{athlete_edit_link}}" style="color: #1f2937;">Editar mi registro</a></p></div>
    <div style="background: #1f2937; padding: 20px; text-align: center; border-radius: 0 0 10px 10px;">
        <p style="color: #9ca3af; margin: 0; font-size: 12px;">{{race_name}} • {{race_date}}</p></div>
</div>
"""
    },
    {
        "id": "volunteer_registration_confirmation",
        "name": "Confirmación de Registro - Voluntario",
        "description": "Se envía cuando un voluntario completa su registro",
        "subject": "Registro de voluntario confirmado - {{race_name}}",
        "category": "voluntarios",
        "merge_sources": ["race", "volunteer"],
        "content": """
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: #1f2937; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">¡Gracias por ser Voluntario!</h1></div>
    <div style="padding: 30px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none;">
        <p style="font-size: 16px; color: #1f2937;">Hola <strong>{{volunteer_nombre_completo}}</strong>,</p>
        <p style="font-size: 16px; color: #4b5563; line-height: 1.6;">Tu registro como voluntario para <strong>{{race_name}}</strong> ha sido recibido.</p>
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4b5563;">
            <p style="margin: 0; color: #374151;">Te contactaremos próximamente para confirmar tu asignación de turno.</p></div>
        <p style="font-size: 14px; color: #6b7280;">Para editar tu información:<br>
            <a href="{{volunteer_edit_link}}" style="color: #1f2937;">Modificar mi registro</a></p></div>
    <div style="background: #1f2937; padding: 20px; text-align: center; border-radius: 0 0 10px 10px;">
        <p style="color: #9ca3af; margin: 0; font-size: 12px;">{{race_name}} • {{race_date}}</p></div>
</div>
"""
    },
    {
        "id": "volunteer_shift_assignment",
        "name": "Asignación de Turno - Voluntario",
        "description": "Se envía cuando se asigna un turno a un voluntario",
        "subject": "Tu turno ha sido asignado - {{race_name}}",
        "category": "voluntarios",
        "merge_sources": ["race", "volunteer"],
        "content": """
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: #1f2937; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">¡Turno Asignado!</h1></div>
    <div style="padding: 30px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none;">
        <p style="font-size: 16px; color: #1f2937;">Hola <strong>{{volunteer_nombre_completo}}</strong>,</p>
        <p style="font-size: 16px; color: #4b5563; line-height: 1.6;">Te ha sido asignado el siguiente turno:</p>
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #9ca3af;">
            <table style="width: 100%;">
                <tr>
                    <td style="padding: 8px 0;"><strong>Puesto:</strong></td>
                    <td style="text-align: right; color: #1f2937; font-weight: bold;">{{volunteer_puesto}}</td></tr>
                <tr>
                    <td style="padding: 8px 0;"><strong>Turno:</strong></td>
                    <td style="text-align: right;">{{volunteer_turno}}</td></tr>
                <tr>
                    <td style="padding: 8px 0;"><strong>Fecha:</strong></td>
                    <td style="text-align: right;">{{volunteer_dia}}</td></tr>
                <tr>
                    <td style="padding: 8px 0;"><strong>Horario:</strong></td>
                    <td style="text-align: right;">{{volunteer_hora_inicio}} - {{volunteer_hora_fin}}</td></tr></table></div>
        <p style="font-size: 14px; color: #6b7280;">Recuerda llegar 15 minutos antes de tu turno.</p></div>
    <div style="background: #1f2937; padding: 20px; text-align: center; border-radius: 0 0 10px 10px;">
        <p style="color: #9ca3af; margin: 0; font-size: 12px;">{{race_name}}</p></div>
</div>
"""
    },
    {
        "id": "volunteer_shift_reminder",
        "name": "Recordatorio de Turno - Voluntario",
        "description": "Se envía 1 hora antes del inicio del turno",
        "subject": "Tu turno comienza en 1 hora - {{race_name}}",
        "category": "voluntarios",
        "merge_sources": ["race", "volunteer"],
        "content": """
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: #1f2937; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">¡1 Hora para tu Turno!</h1></div>
    <div style="padding: 30px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none;">
        <p style="font-size: 16px; color: #1f2937;">Hola <strong>{{volunteer_nombre_completo}}</strong>,</p>
        <p style="font-size: 16px; color: #4b5563; line-height: 1.6;">Tu turno está por comenzar:</p>
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <p style="font-size: 24px; font-weight: bold; color: #1f2937; margin: 0;">{{volunteer_puesto}}</p>
            <p style="font-size: 18px; color: #1f2937; margin: 10px 0 0 0;">{{volunteer_hora_inicio}} - {{volunteer_hora_fin}}</p></div>
        <p style="font-size: 14px; color: #6b7280;">Recuerda usar la camiseta oficial de Staff</p></div>
    <div style="background: #1f2937; padding: 20px; text-align: center; border-radius: 0 0 10px 10px;">
        <p style="color: #9ca3af; margin: 0; font-size: 14px;">¡Gracias por ser parte del equipo!</p></div>
</div>
"""
    },
    {
        "id": "payment_reminder",
        "name": "Recordatorio de Pago",
        "description": "Se envía para recordar un pago pendiente con datos bancarios",
        "subject": "Recordatorio: Pago pendiente - {{race_name}}",
        "category": "pagos",
        "merge_sources": ["race", "athlete", "payment"],
        "content": """
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: #1f2937; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Recordatorio de Pago</h1></div>
    <div style="padding: 30px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none;">
        <p style="font-size: 16px; color: #1f2937;">Hola <strong>{{athlete_nombre_completo}}</strong>,</p>
        <p style="font-size: 16px; color: #4b5563; line-height: 1.6;">Te recordamos que tu pago de inscripción para <strong>{{race_name}}</strong> está pendiente.</p>
        
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <p style="font-size: 14px; color: #374151; margin: 0 0 10px 0;">Monto a pagar:</p>
            <p style="font-size: 32px; font-weight: bold; color: #1f2937; margin: 0;">{{payment_amount}}</p></div>
        
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="font-size: 14px; font-weight: bold; color: #1f2937; margin: 0 0 15px 0;">Datos para el pago:</p>
            <table style="width: 100%; font-size: 14px;">
                <tr>
                    <td style="padding: 6px 0; color: #6b7280;">Banco:</td>
                    <td style="padding: 6px 0; text-align: right; font-weight: 500;">{{payment_bank_name}}</td></tr>
                <tr>
                    <td style="padding: 6px 0; color: #6b7280;">Titular:</td>
                    <td style="padding: 6px 0; text-align: right; font-weight: 500;">{{payment_account_name}}</td></tr>
                <tr>
                    <td style="padding: 6px 0; color: #6b7280;">Tipo de cuenta:</td>
                    <td style="padding: 6px 0; text-align: right; font-weight: 500;">{{payment_account_type}}</td></tr>
                <tr>
                    <td style="padding: 6px 0; color: #6b7280;">Número de cuenta:</td>
                    <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #1f2937;">{{payment_account_number}}</td></tr>
                <tr>
                    <td style="padding: 6px 0; color: #6b7280;">Número de Pasaporte:</td>
                    <td style="padding: 6px 0; text-align: right; font-weight: 500;">{{payment_account_id}}</td></tr></table></div>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="{{payment_upload_url}}" style="display: inline-block; background: #1f2937; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">Subir Comprobante de Pago</a></div>
        
        <p style="font-size: 14px; color: #6b7280; text-align: center;">Una vez realizado el pago, sube tu comprobante para confirmar tu inscripción.</p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        
        <p style="font-size: 12px; color: #9ca3af; text-align: center;">Si no puedes participar, puedes <a href="{{payment_cancel_url}}" style="color: #1f2937;">cancelar tu registro aquí</a>.</p></div>
    <div style="background: #1f2937; padding: 20px; text-align: center; border-radius: 0 0 10px 10px;">
        <p style="color: #9ca3af; margin: 0; font-size: 12px;">{{race_name}}</p></div>
</div>
"""
    },
    {
        "id": "payment_received",
        "name": "Pago Recibido",
        "description": "Se envía cuando se recibe un comprobante de pago",
        "subject": "Pago recibido - {{race_name}}",
        "category": "pagos",
        "merge_sources": ["race", "athlete", "payment"],
        "content": """
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: #1f2937; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Pago Recibido</h1></div>
    <div style="padding: 30px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none;">
        <p style="font-size: 16px; color: #1f2937;">Hola <strong>{{athlete_nombre_completo}}</strong>,</p>
        <p style="font-size: 16px; color: #4b5563; line-height: 1.6;">Hemos recibido tu comprobante de pago para <strong>{{race_name}}</strong>.</p>
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <table style="width: 100%;">
                <tr>
                    <td style="padding: 8px 0;"><strong>Monto:</strong></td>
                    <td style="text-align: right;">{{payment_amount}}</td></tr>
                <tr>
                    <td style="padding: 8px 0;"><strong>Referencia:</strong></td>
                    <td style="text-align: right;">{{payment_reference}}</td></tr>
                <tr>
                    <td style="padding: 8px 0;"><strong>Estado:</strong></td>
                    <td style="text-align: right; color: #6b7280;">En revisión</td></tr></table></div>
        <p style="font-size: 14px; color: #6b7280;">Estamos procesando tu pago. Te notificaremos cuando sea confirmado.</p></div>
    <div style="background: #1f2937; padding: 20px; text-align: center; border-radius: 0 0 10px 10px;">
        <p style="color: #9ca3af; margin: 0; font-size: 12px;">{{race_name}}</p></div>
</div>
"""
    },
    {
        "id": "payment_receipt_received",
        "name": "Comprobante de Pago Recibido",
        "description": "Se envía cuando un atleta sube su comprobante de pago",
        "subject": "Comprobante Recibido - {{race_name}}",
        "category": "pagos",
        "merge_sources": ["race", "athlete"],
        "content": """
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: #1f2937; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Comprobante Recibido</h1></div>
    <div style="padding: 30px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none;">
        <p style="font-size: 16px; color: #1f2937;">¡Hola <strong>{{athlete_nombre_completo}}</strong>!</p>
        <p style="font-size: 16px; color: #4b5563; line-height: 1.6;">Hemos recibido tu comprobante de pago con los siguientes detalles:</p>
        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
            <table style="width: 100%;">
                <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Fecha de pago:</td>
                    <td style="padding: 8px 0; color: #1f2937; font-weight: 600;">{{payment_date}}</td></tr>
                <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Banco origen:</td>
                    <td style="padding: 8px 0; color: #1f2937;">{{bank_origin}}</td></tr>
                <tr>
                    <td style="padding: 8px 0; color: #6b7280;">No. Transferencia:</td>
                    <td style="padding: 8px 0; color: #1f2937;">{{transfer_number}}</td></tr></table></div>
        <div style="background: #f3f4f6; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <p style="color: #374151; margin: 0; font-size: 14px;">
                <strong>Estado:</strong>En revisión. Te notificaremos una vez que tu pago sea confirmado.</p></div></div>
    <div style="background: #1f2937; padding: 20px; text-align: center; border-radius: 0 0 10px 10px;">
        <p style="color: #9ca3af; margin: 0; font-size: 12px;">{{race_name}}</p></div>
</div>
"""
    },
    {
        "id": "payment_confirmed",
        "name": "Pago Confirmado",
        "description": "Se envía cuando se confirma un pago",
        "subject": "Pago confirmado - {{race_name}}",
        "category": "pagos",
        "merge_sources": ["race", "athlete", "payment"],
        "content": """
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: #1f2937; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">¡Pago Confirmado!</h1></div>
    <div style="padding: 30px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none;">
        <p style="font-size: 16px; color: #1f2937;">Hola <strong>{{athlete_nombre_completo}}</strong>,</p>
        <p style="font-size: 16px; color: #4b5563; line-height: 1.6;">Tu pago para <strong>{{race_name}}</strong> ha sido confirmado exitosamente.</p>
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #4b5563;">
            <table style="width: 100%;">
                <tr>
                    <td style="padding: 8px 0;"><strong>Monto:</strong></td>
                    <td style="text-align: right;">{{payment_amount}}</td></tr>
                <tr>
                    <td style="padding: 8px 0;"><strong>Fecha:</strong></td>
                    <td style="text-align: right;">{{payment_date}}</td></tr>
                <tr>
                    <td style="padding: 8px 0;"><strong>Estado:</strong></td>
                    <td style="text-align: right; color: #4b5563; font-weight: bold;">Confirmado</td></tr></table></div>
        <p style="font-size: 14px; color: #6b7280;">Tu lugar en la carrera está asegurado. ¡Nos vemos en la línea de salida!</p></div>
    <div style="background: #1f2937; padding: 20px; text-align: center; border-radius: 0 0 10px 10px;">
        <p style="color: #4b5563; margin: 0; font-size: 14px;">¡Gracias por tu inscripción!</p></div>
</div>
"""
    },
    {
        "id": "payment_period_opening",
        "name": "Apertura del Período de Pagos",
        "description": "Anuncia el inicio del período de pagos de la inscripción, con fecha límite del 15 de septiembre",
        "subject": "Inicia el período de pagos - {{race_name}}",
        "category": "pagos",
        "merge_sources": ["race", "athlete", "payment"],
        "content": """
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: #1f2937; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">¡Inicia el Período de Pagos!</h1></div>
    <div style="padding: 30px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none;">
        <p style="font-size: 16px; color: #1f2937;">Hola <strong>{{athlete_nombre_completo}}</strong>,</p>
        <p style="font-size: 16px; color: #4b5563; line-height: 1.6;">Te informamos que queda abierto el proceso de pagos de la inscripción para <strong>{{race_name}}</strong>.</p>

        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; border: 2px solid #9ca3af;">
            <p style="font-size: 14px; color: #374151; margin: 0 0 10px 0;">Tienes tiempo para completar tu pago hasta el:</p>
            <p style="font-size: 28px; font-weight: bold; color: #1f2937; margin: 0;">15 de septiembre</p></div>

        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="font-size: 14px; font-weight: bold; color: #1f2937; margin: 0 0 15px 0;">Datos para el pago:</p>
            <table style="width: 100%; font-size: 14px;">
                <tr>
                    <td style="padding: 6px 0; color: #6b7280;">Monto:</td>
                    <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #1f2937;">{{payment_amount}}</td></tr>
                <tr>
                    <td style="padding: 6px 0; color: #6b7280;">Banco:</td>
                    <td style="padding: 6px 0; text-align: right; font-weight: 500;">{{payment_bank_name}}</td></tr>
                <tr>
                    <td style="padding: 6px 0; color: #6b7280;">Titular:</td>
                    <td style="padding: 6px 0; text-align: right; font-weight: 500;">{{payment_account_name}}</td></tr>
                <tr>
                    <td style="padding: 6px 0; color: #6b7280;">Tipo de cuenta:</td>
                    <td style="padding: 6px 0; text-align: right; font-weight: 500;">{{payment_account_type}}</td></tr>
                <tr>
                    <td style="padding: 6px 0; color: #6b7280;">Número de cuenta:</td>
                    <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #1f2937;">{{payment_account_number}}</td></tr>
                <tr>
                    <td style="padding: 6px 0; color: #6b7280;">Número de Pasaporte:</td>
                    <td style="padding: 6px 0; text-align: right; font-weight: 500;">{{payment_account_id}}</td></tr></table></div>

        <p style="font-size: 15px; font-weight: bold; color: #1f2937; margin: 25px 0 10px 0;">¿Cómo notificar tu pago?</p>
        <ol style="font-size: 14px; color: #4b5563; line-height: 1.8; margin: 0; padding-left: 20px;">
            <li>Realiza el pago con los datos indicados arriba.</li>
            <li>Ingresa a tu <strong>perfil</strong> en nuestro sitio web.</li>
            <li>Ve a la sección <strong>Carreras Inscritas</strong>.</li>
            <li>Pulsa <strong>Notificar pago</strong> y adjunta tu comprobante de pago.</li></ol>

        <div style="text-align: center; margin: 30px 0;">
            <a href="{{frontend_url}}/mi-perfil" style="display: inline-block; background: #1f2937; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">Ir a mi Perfil</a></div>

        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6b7280;">
            <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.6;">
                 <strong>Importante:</strong> a partir del <strong>15 de septiembre</strong>, si no hemos recibido tu pago,
                tu inscripción será <strong>cancelada</strong> y tu espacio se reasignará a las personas que se encuentran
                en la lista de espera.</p></div></div>
    <div style="background: #1f2937; padding: 20px; text-align: center; border-radius: 0 0 10px 10px;">
        <p style="color: #9ca3af; margin: 0; font-size: 12px;">{{race_name}} • {{race_date}}</p></div>
</div>
"""
    },
    {
        "id": "email_verification",
        "name": "Verificación de Email",
        "description": "Se envía con el código de verificación",
        "subject": "Código de verificación - {{race_name}}",
        "category": "sistema",
        "merge_sources": ["race", "general"],
        "content": """
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: #1f2937; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Código de Verificación</h1></div>
    <div style="padding: 30px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none; text-align: center;">
        <p style="font-size: 16px; color: #4b5563; line-height: 1.6;">Tu código de verificación es:</p>
        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="font-size: 36px; font-weight: bold; color: #1f2937; margin: 0; letter-spacing: 8px;">{{verification_code}}</p></div>
        <p style="font-size: 14px; color: #6b7280;">Este código expira en 30 minutos.</p></div>
    <div style="background: #1f2937; padding: 20px; text-align: center; border-radius: 0 0 10px 10px;">
        <p style="color: #9ca3af; margin: 0; font-size: 12px;">{{race_name}}</p></div>
</div>
"""
    },
    {
        "id": "admin_credentials",
        "name": "Credenciales de Administrador",
        "description": "Se envía cuando se crea un nuevo usuario admin",
        "subject": "Tus credenciales de acceso - {{race_name}}",
        "category": "sistema",
        "merge_sources": ["race", "general"],
        "content": """
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: #1f2937; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Credenciales de Acceso</h1></div>
    <div style="padding: 30px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none;">
        <p style="font-size: 16px; color: #4b5563; line-height: 1.6;">Se ha creado una cuenta de administrador para ti en el panel de {{race_name}}.</p>
        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #e5e7eb;">
            <table style="width: 100%;">
                <tr>
                    <td style="padding: 8px 0;"><strong>Usuario:</strong></td>
                    <td style="text-align: right; font-family: monospace;">{{username}}</td></tr>
                <tr>
                    <td style="padding: 8px 0;"><strong>Contraseña:</strong></td>
                    <td style="text-align: right; font-family: monospace;">{{password}}</td></tr></table></div>
        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; border-left: 4px solid #9ca3af;">
            <p style="margin: 0; color: #374151; font-size: 14px;">Por seguridad, te recomendamos cambiar tu contraseña después del primer inicio de sesión.</p></div>
        <div style="text-align: center; margin-top: 20px;">
            <a href="{{frontend_url}}/admin" style="display: inline-block; background: #1f2937; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Ir al Panel de Administración</a></div></div>
    <div style="background: #1f2937; padding: 20px; text-align: center; border-radius: 0 0 10px 10px;">
        <p style="color: #9ca3af; margin: 0; font-size: 12px;">{{race_name}}</p></div>
</div>
"""
    },
    {
        "id": "bib_assignment",
        "name": "Asignación de BIB",
        "description": "Se envía cuando se asigna un número de BIB al atleta",
        "subject": "Tu número de BIB: #{{athlete_bib}} - {{race_name}}",
        "category": "atletas",
        "merge_sources": ["race", "athlete"],
        "content": """
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: #1f2937; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">¡BIB Asignado!</h1></div>
    <div style="padding: 30px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none;">
        <p style="font-size: 16px; color: #1f2937;">Hola <strong>{{athlete_nombre_completo}}</strong>,</p>
        <p style="font-size: 16px; color: #4b5563; line-height: 1.6;">¡Te ha sido asignado tu número de corredor para <strong>{{race_name}}</strong>!</p>
        <div style="background: #f3f4f6; padding: 30px; border-radius: 12px; margin: 20px 0; text-align: center;">
            <p style="font-size: 14px; color: #374151; margin: 0 0 10px 0;">Tu número de BIB</p>
            <p style="font-size: 64px; font-weight: bold; color: #1f2937; margin: 0;">#{{athlete_bib}}</p></div>
        <p style="font-size: 14px; color: #6b7280; text-align: center;">¡Nos vemos en la línea de salida!</p></div>
    <div style="background: #1f2937; padding: 20px; text-align: center; border-radius: 0 0 10px 10px;">
        <p style="color: #9ca3af; margin: 0; font-size: 14px;">{{race_name}} • {{race_date}}</p></div>
</div>
"""
    },
    {
        "id": "runner_summary",
        "name": "Resumen Post-Carrera - Corredor",
        "description": "Se envía después de la carrera con el resumen del corredor",
        "subject": "Tu resumen del {{race_name}}",
        "category": "atletas",
        "merge_sources": ["race", "athlete"],
        "content": """
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: #1f2937; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">¡Felicidades!</h1></div>
    <div style="padding: 30px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none;">
        <p style="font-size: 16px; color: #1f2937;">Hola <strong>{{athlete_nombre_completo}}</strong>,</p>
        <p style="font-size: 16px; color: #4b5563; line-height: 1.6;">¡Gracias por participar en <strong>{{race_name}}</strong>! Aquí está tu resumen:</p>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0;">
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center;">
                <p style="font-size: 32px; font-weight: bold; color: #1f2937; margin: 0;">{{athlete_laps_completed}}</p>
                <p style="font-size: 12px; color: #374151; margin: 5px 0 0 0;">VUELTAS</p></div>
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center;">
                <p style="font-size: 32px; font-weight: bold; color: #111827; margin: 0;">{{athlete_total_km}}</p>
                <p style="font-size: 12px; color: #374151; margin: 5px 0 0 0;">KILÓMETROS</p></div></div>
        <p style="font-size: 14px; color: #6b7280; text-align: center;">¡Nos vemos en la próxima edición!</p></div>
    <div style="background: #1f2937; padding: 20px; text-align: center; border-radius: 0 0 10px 10px;">
        <p style="color: #9ca3af; margin: 0; font-size: 14px;">{{race_name}}</p></div>
</div>
"""
    },
    {
        "id": "athlete_cancellation",
        "name": "Confirmación de Cancelación - Atleta",
        "description": "Se envía cuando un atleta cancela su registro",
        "subject": "Confirmación de Cancelación - {{race_name}}",
        "category": "atletas",
        "merge_sources": ["race", "athlete"],
        "content": """
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: #1f2937; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Registro Cancelado</h1></div>
    <div style="padding: 30px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none;">
        <p style="font-size: 16px; color: #1f2937;">Hola <strong>{{athlete_nombre_completo}}</strong>,</p>
        <p style="font-size: 16px; color: #4b5563; line-height: 1.6;">Confirmamos que tu registro para <strong>{{race_name}}</strong> ha sido cancelado y eliminado de nuestro sistema.</p>
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0 0 8px 0; color: #4b5563;"><strong>Razón de cancelación:</strong></p>
            <p style="margin: 0; color: #4b5563;">{{cancellation_reason}}</p></div>
        <p style="font-size: 14px; color: #6b7280;">Si cambiaste de opinión, puedes volver a registrarte en cualquier momento desde nuestra página web.</p></div>
    <div style="background: #1f2937; padding: 20px; text-align: center; border-radius: 0 0 10px 10px;">
        <p style="color: #9ca3af; margin: 0; font-size: 12px;">{{race_name}}</p></div>
</div>
"""
    },
    {
        "id": "volunteer_cancellation",
        "name": "Confirmación de Cancelación - Voluntario",
        "description": "Se envía cuando un voluntario cancela su registro",
        "subject": "Confirmación de Cancelación - Voluntario {{race_name}}",
        "category": "voluntarios",
        "merge_sources": ["race", "volunteer"],
        "content": """
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: #1f2937; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Postulación Cancelada</h1></div>
    <div style="padding: 30px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none;">
        <p style="font-size: 16px; color: #1f2937;">Hola <strong>{{volunteer_nombre_completo}}</strong>,</p>
        <p style="font-size: 16px; color: #4b5563; line-height: 1.6;">Confirmamos que tu postulación como voluntario para <strong>{{race_name}}</strong> ha sido cancelada y eliminada de nuestro sistema.</p>
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0 0 8px 0; color: #4b5563;"><strong>Razón de cancelación:</strong></p>
            <p style="margin: 0; color: #4b5563;">{{cancellation_reason}}</p></div>
        <p style="font-size: 14px; color: #6b7280;">Si cambiaste de opinión, puedes postularte nuevamente en cualquier momento.</p></div>
    <div style="background: #1f2937; padding: 20px; text-align: center; border-radius: 0 0 10px 10px;">
        <p style="color: #9ca3af; margin: 0; font-size: 12px;">{{race_name}}</p></div>
</div>
"""
    },
    {
        "id": "volunteer_verification_code",
        "name": "Código de Verificación - Voluntario",
        "description": "Se envía con el código de verificación para voluntarios",
        "subject": "Código de Verificación - Voluntarios {{race_name}}",
        "category": "voluntarios",
        "merge_sources": ["race", "general"],
        "content": """
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: #1f2937; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Código de Verificación</h1></div>
    <div style="padding: 30px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none; text-align: center;">
        <p style="font-size: 16px; color: #4b5563; line-height: 1.6;">Tu código de verificación para el registro de voluntario es:</p>
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="font-size: 36px; font-weight: bold; color: #4b5563; margin: 0; letter-spacing: 8px;">{{verification_code}}</p></div>
        <p style="font-size: 14px; color: #6b7280;">Este código expira en 30 minutos.</p></div>
    <div style="background: #1f2937; padding: 20px; text-align: center; border-radius: 0 0 10px 10px;">
        <p style="color: #9ca3af; margin: 0; font-size: 14px;">¡Gracias por querer ser parte del equipo!</p></div>
</div>
"""
    },
    {
        "id": "volunteer_edit_link",
        "name": "Link de Edición - Voluntario",
        "description": "Se envía con el link para editar la postulación",
        "subject": "Link para Editar tu Postulación - {{race_name}}",
        "category": "voluntarios",
        "merge_sources": ["race", "volunteer"],
        "content": """
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: #1f2937; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Editar Postulación</h1></div>
    <div style="padding: 30px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none;">
        <p style="font-size: 16px; color: #1f2937;">Hola <strong>{{volunteer_nombre_completo}}</strong>,</p>
        <p style="font-size: 16px; color: #4b5563; line-height: 1.6;">Usa el siguiente enlace para editar tu postulación como voluntario:</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="{{volunteer_edit_link}}" style="display: inline-block; background: #1f2937; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">Editar mi Postulación</a></div>
        <p style="font-size: 14px; color: #6b7280;">Si no solicitaste este enlace, puedes ignorar este correo.</p></div>
    <div style="background: #1f2937; padding: 20px; text-align: center; border-radius: 0 0 10px 10px;">
        <p style="color: #9ca3af; margin: 0; font-size: 12px;">{{race_name}}</p></div>
</div>
"""
    },
    {
        "id": "payment_rejected",
        "name": "Pago Rechazado",
        "description": "Se envía cuando se rechaza un comprobante de pago",
        "subject": "Comprobante de Pago Rechazado - {{race_name}}",
        "category": "pagos",
        "merge_sources": ["race", "athlete", "payment"],
        "content": """
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: #1f2937; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Comprobante Rechazado</h1></div>
    <div style="padding: 30px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none;">
        <p style="font-size: 16px; color: #1f2937;">Hola <strong>{{athlete_nombre_completo}}</strong>,</p>
        <p style="font-size: 16px; color: #4b5563; line-height: 1.6;">Lamentamos informarte que el comprobante de pago que enviaste no pudo ser verificado.</p>
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6b7280;">
            <p style="margin: 0; color: #374151;">
                <strong>Posibles razones:</strong></p>
            <ul style="color: #374151; margin: 10px 0 0 0; padding-left: 20px;">
                <li>Imagen borrosa o ilegible</li>
                <li>Monto incorrecto</li>
                <li>Cuenta de destino incorrecta</li>
                <li>Comprobante duplicado o ya utilizado</li></ul></div>
        <p style="font-size: 14px; color: #6b7280;">Por favor, envía un nuevo comprobante válido para completar tu inscripción.</p></div>
    <div style="background: #1f2937; padding: 20px; text-align: center; border-radius: 0 0 10px 10px;">
        <p style="color: #9ca3af; margin: 0; font-size: 12px;">{{race_name}}</p></div>
</div>
"""
    },
    {
        "id": "athlete_edit_code",
        "name": "Código de Acceso - Atleta",
        "description": "Se envía con el código para editar el registro del atleta",
        "subject": "Código de Acceso - {{race_name}}",
        "category": "atletas",
        "merge_sources": ["race", "athlete", "general"],
        "content": """
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: #1f2937; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Código de Acceso</h1></div>
    <div style="padding: 30px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none;">
        <p style="font-size: 16px; color: #1f2937;">Hola <strong>{{athlete_nombre_completo}}</strong>,</p>
        <p style="font-size: 16px; color: #4b5563; line-height: 1.6;">Tu código de acceso para editar tu registro es:</p>
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <p style="font-size: 36px; font-weight: bold; color: #1f2937; margin: 0; letter-spacing: 8px;">{{verification_code}}</p></div>
        <p style="font-size: 14px; color: #6b7280;">Este código es válido por 30 minutos. Úsalo para acceder a tu registro y realizar cambios.</p></div>
    <div style="background: #1f2937; padding: 20px; text-align: center; border-radius: 0 0 10px 10px;">
        <p style="color: #9ca3af; margin: 0; font-size: 12px;">{{race_name}}</p></div>
</div>
"""
    },
    {
        "id": "password_reset",
        "name": "Recuperación de Contraseña",
        "description": "Se envía con el código para restablecer la contraseña del perfil",
        "subject": "Código para restablecer tu contraseña - {{race_name}}",
        "category": "sistema",
        "merge_sources": ["race", "athlete", "general"],
        "content": """
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: #1f2937; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Restablecer Contraseña</h1></div>
    <div style="padding: 30px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none;">
        <p style="font-size: 16px; color: #1f2937;">Hola <strong>{{athlete_nombre}}</strong>,</p>
        <p style="font-size: 16px; color: #4b5563; line-height: 1.6;">Recibimos una solicitud para restablecer la contraseña de tu perfil. Usa este código para crear una nueva contraseña:</p>
        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <p style="font-size: 36px; font-weight: bold; color: #1f2937; margin: 0; letter-spacing: 8px;">{{verification_code}}</p></div>
        <p style="font-size: 14px; color: #6b7280;">Este código expira en 30 minutos.</p>
        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; border-left: 4px solid #9ca3af; margin-top: 20px;">
            <p style="margin: 0; color: #374151; font-size: 14px;">Si no solicitaste este cambio, puedes ignorar este correo: tu contraseña actual seguirá funcionando.</p></div></div>
    <div style="background: #1f2937; padding: 20px; text-align: center; border-radius: 0 0 10px 10px;">
        <p style="color: #9ca3af; margin: 0; font-size: 12px;">{{race_name}}</p></div>
</div>
"""
    }
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
