import smtplib
import os

from services.env_utils import get_env
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Dict
from datetime import datetime
from services.email_service import EMAILS_ACTIVOS

GMAIL_USER = get_env("GMAIL_USER")
GMAIL_APP_PASSWORD = get_env("GMAIL_APP_PASSWORD")

# Base URL for the application - use environment variable for production


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
    """Aviso una hora antes del turno."""
    from services import correo_estilo as estilo

    puesto = assignment.get("puesto", "")
    turno = assignment.get("turno", "")
    dia = format_date_spanish(assignment.get("dia", ""))
    hora_inicio = format_time_ampm(assignment.get("hora_inicio", ""))
    hora_fin = format_time_ampm(assignment.get("hora_fin", ""))

    cuerpo = "".join([
        estilo.h1("Tu turno empieza en una hora"),
        estilo.p(f"Hola <strong>{volunteer_name}</strong>,"),
        estilo.cifra(puesto, f"{hora_inicio} a {hora_fin}"),
        estilo.linea("Turno", turno),
        estilo.linea("Fecha", dia),
        estilo.separador(),
        estilo.h2("Antes de salir"),
        estilo.lista([
            "Llega puntual a tu puesto.",
            "Ponte la camiseta oficial de staff.",
            "Ten el WhatsApp a mano.",
        ]),
        estilo.p("Gracias por estar en el equipo."),
    ])
    return estilo.documento(cuerpo, preheader=f"{puesto} · {hora_inicio} a {hora_fin}")


def get_volunteer_assignments_template(volunteer_name: str, assignments: List[Dict]) -> str:
    """Todos los turnos del voluntario, en un solo correo."""
    from services import correo_estilo as estilo

    bloques = [
        estilo.h1("Tus turnos"),
        estilo.p(f"Hola <strong>{volunteer_name}</strong>,"),
        estilo.p(f"Te tocan <strong>{len(assignments)}</strong> turnos:"),
    ]
    for a in assignments:
        bloques += [
            estilo.h2(a.get("puesto", "")),
            estilo.linea("Turno", a.get("turno", "")),
            estilo.linea("Fecha", format_date_spanish(a.get("dia", ""))),
            estilo.linea(
                "Horario",
                f'{format_time_ampm(a.get("hora_inicio", ""))} a {format_time_ampm(a.get("hora_fin", ""))}',
            ),
        ]

    bloques += [
        estilo.separador(),
        estilo.p("Llega 15 minutos antes de cada turno, con la camiseta oficial de staff."),
        estilo.p("Gracias por estar en el equipo."),
    ]
    return estilo.documento("".join(bloques), preheader=f"{len(assignments)} turnos asignados")


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
        msg['Subject'] = f"Tu turno en {puesto} empieza en una hora"
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
        msg['Subject'] = f"Tus turnos de voluntario {subject_suffix}".strip()
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
