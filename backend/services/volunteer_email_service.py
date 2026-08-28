import smtplib
import os

from services.env_utils import get_env
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Dict
from datetime import datetime
from services.email_service import EMAILS_ACTIVOS
from services import marca

GMAIL_USER = get_env("GMAIL_USER")
GMAIL_APP_PASSWORD = get_env("GMAIL_APP_PASSWORD")

# Base URL for the application - use environment variable for production
BASE_URL = get_env("FRONTEND_URL", "https://backyardultrasantodomingo.com")
LOGO_URL = f"{BASE_URL}/icon-bu.png"


def format_time_ampm(time_str: str) -> str:
    """Convert 24h time to 12h AM/PM format"""
    if not time_str:
        return ""
    try:
        parts = time_str.split(":")
        if len(parts) >= 2:
            hour = int(parts[0])
            minutes = parts[1]
            ampm = "PM" if hour >= 12 else "AM"
            hour = hour % 12
            if hour == 0:
                hour = 12
            return f"{hour}:{minutes} {ampm}"
    except:
        pass
    return time_str


def format_date_spanish(date_str: str) -> str:
    """Format date to Spanish format"""
    if not date_str:
        return ""
    try:
        # Parse date from YYYY-MM-DD
        parts = date_str.split("-")
        if len(parts) == 3:
            day = int(parts[2])
            month = int(parts[1])
            year = parts[0]
            months = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
                      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
            return f"{day} de {months[month]} {year}"
    except:
        pass
    return date_str


def get_volunteer_reminder_template(volunteer_name: str, assignment: Dict) -> str:
    """Generate HTML email template for 1-hour reminder"""
    
    puesto = assignment.get("puesto", "")
    turno = assignment.get("turno", "")
    dia = format_date_spanish(assignment.get("dia", ""))
    hora_inicio = format_time_ampm(assignment.get("hora_inicio", ""))
    hora_fin = format_time_ampm(assignment.get("hora_fin", ""))
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f4;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #ea580c 0%, #f97316 100%); padding: 32px 24px; text-align: center;">
                <img src="{LOGO_URL}" alt="Backyard Ultra" style="width: 80px; height: 80px; border-radius: 50%; margin-bottom: 16px; border: 3px solid rgba(255,255,255,0.3);">
                <h1 style="color: white; margin: 0; font-size: 24px; font-weight: bold;">BACKYARD ULTRA</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px; letter-spacing: 3px;">SANTO DOMINGO 2026</p>
            </div>
            {marca.bloque_html()}
            
            <!-- Alert Banner -->
            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px 24px; margin: 0;">
                <p style="margin: 0; color: #92400e; font-size: 16px; font-weight: 600;">
                    ⏰ ¡Tu turno comienza en 1 hora!
                </p>
            </div>
            
            <!-- Content -->
            <div style="padding: 32px 24px;">
                <p style="color: #1f2937; margin: 0 0 24px 0; font-size: 18px; line-height: 1.6;">
                    Hola <strong>{volunteer_name}</strong>,
                </p>
                
                <p style="color: #4b5563; margin: 0 0 24px 0; font-size: 16px; line-height: 1.6;">
                    Te recordamos que tu turno como voluntario está próximo a comenzar. Aquí están los detalles de tu asignación:
                </p>
                
                <!-- Assignment Card -->
                <div style="background: linear-gradient(135deg, #fafaf9 0%, #f5f5f4 100%); border-radius: 16px; padding: 24px; margin-bottom: 24px; border: 2px solid #ea580c;">
                    <!-- Position -->
                    <div style="margin-bottom: 20px;">
                        <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px;">Posición</p>
                        <p style="margin: 0; font-size: 20px; font-weight: bold; color: #ea580c;">{puesto}</p>
                    </div>
                    
                    <!-- Details Grid -->
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 12px; background-color: #ffffff; border-radius: 8px; text-align: center; width: 33%;">
                                <p style="margin: 0 0 4px 0; font-size: 11px; color: #6b7280; text-transform: uppercase;">Turno</p>
                                <p style="margin: 0; font-size: 24px; font-weight: bold; color: #1f2937;">{turno}</p>
                            </td>
                            <td style="width: 8px;"></td>
                            <td style="padding: 12px; background-color: #ffffff; border-radius: 8px; text-align: center;">
                                <p style="margin: 0 0 4px 0; font-size: 11px; color: #6b7280; text-transform: uppercase;">Fecha</p>
                                <p style="margin: 0; font-size: 14px; font-weight: 600; color: #1f2937;">{dia}</p>
                            </td>
                        </tr>
                    </table>
                    
                    <!-- Time -->
                    <div style="margin-top: 16px; padding: 16px; background-color: #ffffff; border-radius: 8px; text-align: center;">
                        <p style="margin: 0 0 4px 0; font-size: 11px; color: #6b7280; text-transform: uppercase;">Horario</p>
                        <p style="margin: 0; font-size: 22px; font-weight: bold; color: #1f2937;">
                            {hora_inicio} - {hora_fin}
                        </p>
                    </div>
                </div>
                
                <!-- Reminder Box -->
                <div style="background-color: #ecfdf5; border-radius: 12px; padding: 20px; border-left: 4px solid #10b981;">
                    <p style="margin: 0 0 8px 0; color: #065f46; font-size: 14px; font-weight: 600;">
                        📋 Recuerda:
                    </p>
                    <ul style="margin: 0; padding-left: 20px; color: #047857; font-size: 14px; line-height: 1.8;">
                        <li>Llegar puntualmente a tu posición</li>
                        <li>Usar la camiseta oficial de Staff</li>
                        <li>Mantener comunicación vía WhatsApp</li>
                    </ul>
                </div>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #1f2937; padding: 24px; text-align: center;">
                <p style="color: #f97316; margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">
                    ¡Gracias por ser parte del equipo! 🧡
                </p>
                <p style="color: #9ca3af; margin: 0; font-size: 12px;">
                    Backyard Ultra Santo Domingo 2026
                </p>
            </div>
        </div>
    </body>
    </html>
    """
    return html


def get_volunteer_assignments_template(volunteer_name: str, assignments: List[Dict]) -> str:
    """Generate HTML email template for complete assignments summary"""
    
    # Generate assignment cards
    assignments_html = ""
    for idx, assignment in enumerate(assignments, 1):
        puesto = assignment.get("puesto", "")
        turno = assignment.get("turno", "")
        dia = format_date_spanish(assignment.get("dia", ""))
        hora_inicio = format_time_ampm(assignment.get("hora_inicio", ""))
        hora_fin = format_time_ampm(assignment.get("hora_fin", ""))
        
        # Alternate background colors
        bg_color = "#fafaf9" if idx % 2 == 1 else "#ffffff"
        
        assignments_html += f"""
        <div style="background-color: {bg_color}; border-radius: 12px; padding: 20px; margin-bottom: 16px; border: 1px solid #e5e7eb;">
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <span style="background-color: #ea580c; color: white; padding: 6px 14px; border-radius: 20px; font-weight: bold; font-size: 12px;">
                    TURNO {turno}
                </span>
                <span style="color: #6b7280; font-size: 13px;">{dia}</span>
            </div>
            
            <!-- Position -->
            <p style="margin: 0 0 12px 0; font-size: 17px; font-weight: bold; color: #1f2937;">
                {puesto}
            </p>
            
            <!-- Time -->
            <div style="display: inline-block; background-color: #f3f4f6; padding: 8px 16px; border-radius: 8px;">
                <span style="color: #4b5563; font-size: 14px;">
                    🕐 {hora_inicio} - {hora_fin}
                </span>
            </div>
        </div>
        """
    
    total_turnos = len(assignments)
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f4;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #ea580c 0%, #f97316 100%); padding: 32px 24px; text-align: center;">
                <img src="{LOGO_URL}" alt="Backyard Ultra" style="width: 80px; height: 80px; border-radius: 50%; margin-bottom: 16px; border: 3px solid rgba(255,255,255,0.3);">
                <h1 style="color: white; margin: 0; font-size: 24px; font-weight: bold;">BACKYARD ULTRA</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px; letter-spacing: 3px;">SANTO DOMINGO 2026</p>
            </div>
            {marca.bloque_html()}
            
            <!-- Content -->
            <div style="padding: 32px 24px;">
                <p style="color: #1f2937; margin: 0 0 16px 0; font-size: 18px; line-height: 1.6;">
                    Hola <strong>{volunteer_name}</strong>,
                </p>
                
                <p style="color: #4b5563; margin: 0 0 24px 0; font-size: 16px; line-height: 1.6;">
                    ¡El evento está por comenzar! Te compartimos el resumen de tus asignaciones como voluntario para el Backyard Ultra Santo Domingo 2026.
                </p>
                
                <!-- Stats Summary -->
                <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; padding: 20px; margin-bottom: 24px; text-align: center;">
                    <p style="margin: 0 0 8px 0; font-size: 14px; color: #92400e;">Total de turnos asignados</p>
                    <p style="margin: 0; font-size: 48px; font-weight: bold; color: #ea580c;">{total_turnos}</p>
                </div>
                
                <!-- Section Title -->
                <h2 style="color: #1f2937; margin: 0 0 16px 0; font-size: 18px; border-bottom: 2px solid #ea580c; padding-bottom: 8px;">
                    📋 Tus Asignaciones
                </h2>
                
                <!-- Assignment Cards -->
                {assignments_html}
                
                <!-- Important Info Box -->
                <div style="background-color: #eff6ff; border-radius: 12px; padding: 20px; margin-top: 24px; border-left: 4px solid #3b82f6;">
                    <p style="margin: 0 0 12px 0; color: #1e40af; font-size: 15px; font-weight: 600;">
                        📌 Información Importante
                    </p>
                    <ul style="margin: 0; padding-left: 20px; color: #1e3a8a; font-size: 14px; line-height: 1.8;">
                        <li>Llega <strong>15 minutos antes</strong> de tu turno</li>
                        <li>Usa la <strong>camiseta oficial de Staff</strong></li>
                        <li>Mantén tu celular cargado para comunicación</li>
                        <li>Revisa el <strong>manual de voluntarios</strong> antes del evento</li>
                    </ul>
                </div>
                
                <!-- CTA Button -->
                <div style="text-align: center; margin-top: 24px;">
                    <a href="{BASE_URL}/voluntarios" style="display: inline-block; background: linear-gradient(135deg, #ea580c 0%, #f97316 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: 600;">
                        Ver Manual de Voluntarios
                    </a>
                </div>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #1f2937; padding: 24px; text-align: center;">
                <p style="color: #f97316; margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">
                    ¡Gracias por ser parte del equipo! 🧡
                </p>
                <p style="color: #9ca3af; margin: 0 0 12px 0; font-size: 13px;">
                    Tu apoyo hace posible este evento
                </p>
                <p style="color: #6b7280; margin: 0; font-size: 12px;">
                    Backyard Ultra Santo Domingo 2026
                </p>
            </div>
        </div>
    </body>
    </html>
    """
    return html


async def send_volunteer_reminder_email(
    to_email: str,
    volunteer_name: str,
    assignment: Dict
) -> bool:
    """Send 1-hour reminder email to volunteer"""
    
    if not GMAIL_USER or not GMAIL_APP_PASSWORD:
        print("Gmail credentials not configured")
        return False
    
    try:
        puesto = assignment.get("puesto", "tu posición")
        hora_inicio = format_time_ampm(assignment.get("hora_inicio", ""))
        
        msg = MIMEMultipart('alternative')
        msg['Subject'] = f"⏰ Recordatorio: Tu turno en {puesto} comienza en 1 hora"
        msg['From'] = f"Backyard Ultra SD <{GMAIL_USER}>"
        msg['To'] = to_email
        
        html_content = get_volunteer_reminder_template(volunteer_name, assignment)
        
        part = MIMEText(html_content, 'html', 'utf-8')
        msg.attach(part)
        
        if not EMAILS_ACTIVOS:
            print(f"[EMAILS_ACTIVOS=false] No se envia a {to_email}")
            return True

        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(GMAIL_USER, GMAIL_APP_PASSWORD)
            server.sendmail(GMAIL_USER, to_email, msg.as_string())
        
        print(f"Volunteer reminder email sent to {to_email}")
        return True
        
    except Exception as e:
        print(f"Error sending volunteer reminder to {to_email}: {str(e)}")
        return False


async def send_volunteer_assignments_email(
    to_email: str,
    volunteer_name: str,
    assignments: List[Dict]
) -> bool:
    """Send complete assignments summary email to volunteer"""
    
    if not GMAIL_USER or not GMAIL_APP_PASSWORD:
        print("Gmail credentials not configured")
        return False
    
    try:
        total = len(assignments)
        subject_suffix = f"({total} turno{'s' if total > 1 else ''})" if total > 0 else ""
        
        msg = MIMEMultipart('alternative')
        msg['Subject'] = f"📋 Tu asignación de voluntario - Backyard Ultra SD 2026 {subject_suffix}"
        msg['From'] = f"Backyard Ultra SD <{GMAIL_USER}>"
        msg['To'] = to_email
        
        html_content = get_volunteer_assignments_template(volunteer_name, assignments)
        
        part = MIMEText(html_content, 'html', 'utf-8')
        msg.attach(part)
        
        if not EMAILS_ACTIVOS:
            print(f"[EMAILS_ACTIVOS=false] No se envia a {to_email}")
            return True

        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(GMAIL_USER, GMAIL_APP_PASSWORD)
            server.sendmail(GMAIL_USER, to_email, msg.as_string())
        
        print(f"Volunteer assignments email sent to {to_email}")
        return True
        
    except Exception as e:
        print(f"Error sending volunteer assignments to {to_email}: {str(e)}")
        return False
