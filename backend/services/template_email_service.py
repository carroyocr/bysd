"""
Template Email Service
Centralized service for rendering and sending templated emails
"""

import smtplib
import os
import re
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any, Optional
from datetime import datetime, timezone

GMAIL_USER = os.environ.get("GMAIL_USER")
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD")
BASE_URL = os.environ.get("FRONTEND_URL", "https://backyardultrasantodomingo.com")


def render_template(template_str: str, data: Dict[str, Any]) -> str:
    """
    Render a template string by replacing merge fields with actual data.
    
    Merge fields are in the format {{field_name}}
    """
    if not template_str:
        return ""
    
    result = template_str
    
    # Replace all {{field_name}} patterns
    pattern = r'\{\{(\w+)\}\}'
    
    def replacer(match):
        field_name = match.group(1)
        value = data.get(field_name, "")
        return str(value) if value is not None else ""
    
    result = re.sub(pattern, replacer, result)
    
    return result


async def get_template_by_id(db, template_id: str) -> Optional[Dict]:
    """Get a template from database by ID"""
    return await db.email_templates.find_one({"id": template_id}, {"_id": 0})


async def send_templated_email(
    to_email: str,
    subject: str,
    html_content: str,
    is_plain: bool = False
) -> bool:
    """Send an email with rendered HTML content (or plain text if is_plain=True)"""
    
    if not GMAIL_USER or not GMAIL_APP_PASSWORD:
        print("Gmail credentials not configured")
        return False
    
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f"Backyard Ultra SD <{GMAIL_USER}>"
        msg['To'] = to_email
        
        part = MIMEText(html_content, 'plain' if is_plain else 'html', 'utf-8')
        msg.attach(part)
        
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(GMAIL_USER, GMAIL_APP_PASSWORD)
            server.sendmail(GMAIL_USER, to_email, msg.as_string())
        
        print(f"Templated email sent to {to_email}")
        return True
        
    except Exception as e:
        print(f"Error sending templated email to {to_email}: {str(e)}")
        return False


async def send_email_with_template(
    db,
    template_id: str,
    to_email: str,
    data: Dict[str, Any],
    subject_prefix: str = ""
) -> bool:
    """
    Send an email using a template from the database.
    
    Args:
        db: Database connection
        template_id: ID of the template to use
        to_email: Recipient email address
        data: Dictionary of merge field values
        subject_prefix: Optional prefix to add to subject (e.g., "[PRUEBA]")
    
    Returns:
        bool: True if email was sent successfully
    """
    
    # Get template
    template = await get_template_by_id(db, template_id)
    
    if not template:
        print(f"Template {template_id} not found, using fallback")
        return False
    
    # Render template
    rendered_subject = render_template(template["subject"], data)
    rendered_content = render_template(template["content"], data)
    
    if subject_prefix:
        rendered_subject = f"{subject_prefix} {rendered_subject}"
    
    # Send email
    return await send_templated_email(to_email, rendered_subject, rendered_content)


def build_race_data(race_config: Dict) -> Dict[str, str]:
    """Build race merge field data from race configuration"""
    if not race_config:
        return {
            "race_name": "Backyard Ultra Santo Domingo",
            "race_code": "",
            "race_date": "",
            "race_location": "",
            "race_logo_url": "",
            "frontend_url": BASE_URL,
        }
    
    return {
        "race_name": race_config.get("name", "Backyard Ultra Santo Domingo"),
        "race_code": race_config.get("code", ""),
        "race_date": race_config.get("date", ""),
        "race_location": race_config.get("location", ""),
        "race_logo_url": race_config.get("logo_url", ""),
        "frontend_url": BASE_URL,
    }


def build_athlete_data(athlete: Dict, edit_token: str = None) -> Dict[str, str]:
    """Build athlete merge field data from athlete record"""
    nombre = athlete.get("nombre", "")
    apellidos = athlete.get("apellidos", "")
    bib = athlete.get("bib", "")
    
    # Format BIB with leading zeros
    if bib:
        bib = str(bib).zfill(3)
    
    edit_link = ""
    if edit_token:
        edit_link = f"{BASE_URL}/inscripcion/editar/{edit_token}"
    
    return {
        "athlete_nombre": nombre,
        "athlete_apellidos": apellidos,
        "athlete_nombre_completo": f"{nombre} {apellidos}".strip(),
        "athlete_email": athlete.get("email", ""),
        "athlete_bib": bib,
        "athlete_nacionalidad": athlete.get("nacionalidad", ""),
        "athlete_sexo": athlete.get("sexo", ""),
        "athlete_telefono": athlete.get("telefono", ""),
        "athlete_laps_completed": str(athlete.get("laps_completed", 0)),
        "athlete_total_km": str(athlete.get("total_km", 0)),
        "athlete_status": athlete.get("status", ""),
        "athlete_edit_link": edit_link,
    }


def build_volunteer_data(volunteer: Dict, assignment: Dict = None, edit_token: str = None) -> Dict[str, str]:
    """Build volunteer merge field data from volunteer record"""
    nombre = volunteer.get("nombre", "")
    apellidos = volunteer.get("apellidos", "")
    
    edit_link = ""
    if edit_token:
        edit_link = f"{BASE_URL}/voluntarios/editar/{edit_token}"
    
    data = {
        "volunteer_nombre": nombre,
        "volunteer_apellidos": apellidos,
        "volunteer_nombre_completo": f"{nombre} {apellidos}".strip(),
        "volunteer_email": volunteer.get("email", ""),
        "volunteer_telefono": volunteer.get("telefono", ""),
        "volunteer_edit_link": edit_link,
        "volunteer_puesto": "",
        "volunteer_turno": "",
        "volunteer_dia": "",
        "volunteer_hora_inicio": "",
        "volunteer_hora_fin": "",
    }
    
    if assignment:
        data["volunteer_puesto"] = assignment.get("puesto", "")
        data["volunteer_turno"] = assignment.get("turno", "")
        data["volunteer_dia"] = format_date_spanish(assignment.get("dia", ""))
        data["volunteer_hora_inicio"] = format_time_ampm(assignment.get("hora_inicio", ""))
        data["volunteer_hora_fin"] = format_time_ampm(assignment.get("hora_fin", ""))
    
    return data


def build_payment_data(payment: Dict = None, race_config: Dict = None, edit_token: str = None) -> Dict[str, str]:
    """Build payment merge field data"""
    
    # Default values
    data = {
        "payment_amount": "",
        "payment_method": "",
        "payment_reference": "",
        "payment_date": "",
        "payment_status": "",
        "payment_bank_name": "",
        "payment_account_name": "",
        "payment_account_number": "",
        "payment_account_type": "",
        "payment_upload_url": "",
        "payment_cancel_url": "",
    }
    
    # Fill from payment data if provided
    if payment:
        data["payment_amount"] = payment.get("amount", "")
        data["payment_method"] = payment.get("method", "")
        data["payment_reference"] = payment.get("reference", "")
        data["payment_date"] = payment.get("date", "")
        data["payment_status"] = payment.get("status", "")
    
    # Fill from race_config for bank details
    if race_config:
        amount = race_config.get("registration_cost", 3500)
        data["payment_amount"] = data["payment_amount"] or f"RD$ {amount:,}"
        data["payment_bank_name"] = race_config.get("payment_bank_name", "")
        data["payment_account_name"] = race_config.get("payment_account_name", "")
        data["payment_account_number"] = race_config.get("payment_account_number", "")
        data["payment_account_type"] = race_config.get("payment_account_type", "")
    
    # Build URLs if edit_token provided
    if edit_token:
        data["payment_upload_url"] = f"{BASE_URL}/subir-comprobante?token={edit_token}"
        data["payment_cancel_url"] = f"{BASE_URL}/cancelar-registro?token={edit_token}"
    
    return data


def build_general_data(verification_code: str = None, username: str = None, password: str = None) -> Dict[str, str]:
    """Build general merge field data"""
    now = datetime.now()
    
    return {
        "current_date": format_date_spanish(now.strftime("%Y-%m-%d")),
        "current_year": str(now.year),
        "verification_code": verification_code or "",
        "username": username or "",
        "password": password or "",
    }


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
            return f"{day} de {months[month]}, {year}"
    except:
        pass
    return date_str
