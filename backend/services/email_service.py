import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Dict
from datetime import datetime

GMAIL_USER = os.environ.get("GMAIL_USER")
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD")

def get_email_template(subject: str, content: str, athletes_data: List[Dict], unsubscribe_link: str) -> str:
    """Generate HTML email template with race branding - Mobile optimized with cards"""
    
    # Base URL for community page - use environment variable for production
    base_url = os.environ.get("FRONTEND_URL", "https://backyardultrasantodomingo.com")
    
    # Generate athlete cards (mobile-friendly vertical layout)
    athletes_cards = ""
    for athlete in athletes_data:
        status = athlete.get("status", "active")
        bib = athlete.get('bib', '-')
        
        # Show appropriate status badge based on actual status
        if status == "active":
            status_badge = '<span style="background-color: #22c55e; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 500;">Activo</span>'
        elif status == "retired":
            status_badge = '<span style="background-color: #ef4444; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 500;">DNF</span>'
        elif status == "dns":
            status_badge = '<span style="background-color: #6b7280; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 500;">DNS</span>'
        else:
            status_badge = '<span style="background-color: #22c55e; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 500;">Activo</span>'
        
        athletes_cards += f"""
        <div style="background-color: #fafaf9; border-radius: 12px; padding: 16px; margin-bottom: 12px; border: 1px solid #e5e7eb;">
            <!-- Header: BIB + Status -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <div>
                    <span style="background-color: #ea580c; color: white; padding: 4px 10px; border-radius: 6px; font-weight: bold; font-size: 14px;">#{bib}</span>
                </div>
                {status_badge}
            </div>
            
            <!-- Name -->
            <div style="margin-bottom: 12px;">
                <p style="margin: 0; font-size: 16px; font-weight: bold; color: #1f2937;">{athlete.get('nombre', '')} {athlete.get('apellidos', '')}</p>
            </div>
            
            <!-- Stats Row -->
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="text-align: center; padding: 8px; background-color: #ffffff; border-radius: 8px 0 0 8px; border: 1px solid #e5e7eb; border-right: none;">
                        <p style="margin: 0; font-size: 10px; color: #6b7280; text-transform: uppercase;">Vueltas</p>
                        <p style="margin: 4px 0 0 0; font-size: 24px; font-weight: bold; color: #ea580c;">{athlete.get('laps_completed', 0)}</p>
                    </td>
                    <td style="text-align: center; padding: 8px; background-color: #ffffff; border-radius: 0 8px 8px 0; border: 1px solid #e5e7eb;">
                        <p style="margin: 0; font-size: 10px; color: #6b7280; text-transform: uppercase;">Kilómetros</p>
                        <p style="margin: 4px 0 0 0; font-size: 24px; font-weight: bold; color: #1f2937;">{athlete.get('total_km', 0)}</p>
                    </td>
                </tr>
            </table>
            
            <!-- Cheer Button -->
            <div style="margin-top: 12px; text-align: center;">
                <a href="{base_url}/enviar-animo/{bib}" style="display: inline-block; background: linear-gradient(135deg, #9333ea 0%, #ec4899 100%); color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500;">
                    💬 Enviar mensaje de ánimo
                </a>
            </div>
        </div>
        """
    
    # Define base_url for use in html template
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f4;">
        <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #ea580c 0%, #f97316 100%); padding: 24px 16px; text-align: center;">
                <img src="https://race-feedback.preview.emergentagent.com/icon-bu.png" alt="Backyard Ultra" style="width: 60px; height: 60px; border-radius: 50%; margin-bottom: 12px;">
                <h1 style="color: white; margin: 0; font-size: 20px; font-weight: bold;">BACKYARD ULTRA</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 4px 0 0 0; font-size: 12px; letter-spacing: 2px;">SANTO DOMINGO 2026</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 20px 16px;">
                <h2 style="color: #1f2937; margin: 0 0 8px 0; font-size: 18px;">{subject}</h2>
                <p style="color: #6b7280; margin: 0 0 20px 0; font-size: 14px; line-height: 1.5;">{content}</p>
                
                <!-- Athletes Cards -->
                {athletes_cards}
                
                <!-- Footer Info -->
                <div style="margin-top: 20px; padding: 16px; background-color: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
                    <p style="margin: 0; color: #92400e; font-size: 13px; line-height: 1.5;">
                        <strong>Seguimiento:</strong><br>
                        <a href="{base_url}/en-vivo" style="color: #ea580c;">Ver clasificación en vivo</a>
                    </p>
                </div>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #1f2937; padding: 16px; text-align: center;">
                <p style="color: #9ca3af; margin: 0 0 8px 0; font-size: 11px;">
                    Backyard Ultra Santo Domingo 2026
                </p>
                <p style="color: #6b7280; margin: 0; font-size: 10px;">
                    <a href="{unsubscribe_link}" style="color: #9ca3af;">Cancelar suscripción</a>
                </p>
            </div>
        </div>
    </body>
    </html>
    """
    return html


async def send_notification_email(
    to_email: str,
    subject: str,
    content: str,
    athletes_data: List[Dict],
    subscription_id: str
) -> bool:
    """Send notification email using Gmail SMTP"""
    
    if not GMAIL_USER or not GMAIL_APP_PASSWORD:
        print("Gmail credentials not configured")
        return False
    
    try:
        base_url = os.environ.get("FRONTEND_URL", "https://backyardultrasantodomingo.com")
        unsubscribe_link = f"{base_url}/api/race/unsubscribe/{subscription_id}"
        
        msg = MIMEMultipart('alternative')
        msg['Subject'] = f"🏃 {subject} - Backyard Ultra SD 2026"
        msg['From'] = f"Backyard Ultra SD <{GMAIL_USER}>"
        msg['To'] = to_email
        
        html_content = get_email_template(subject, content, athletes_data, unsubscribe_link)
        
        part = MIMEText(html_content, 'html', 'utf-8')
        msg.attach(part)
        
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(GMAIL_USER, GMAIL_APP_PASSWORD)
            server.sendmail(GMAIL_USER, to_email, msg.as_string())
        
        print(f"Email sent successfully to {to_email}")
        return True
        
    except Exception as e:
        print(f"Error sending email to {to_email}: {str(e)}")
        return False


async def send_lap_notifications(db, current_lap: int):
    """Send notifications to all subscribers who want lap updates.
    
    Only sends if at least one followed athlete:
    - Is still active, OR
    - Made DNF in the current lap (their last lap)
    """
    
    # Get all subscriptions that want lap notifications
    subscriptions = await db.email_subscriptions.find(
        {"notify_every_lap": True, "active": True}
    ).to_list(1000)
    
    for sub in subscriptions:
        # Get athlete data for followed athletes
        athletes = await db.participants.find(
            {"bib": {"$in": sub.get("athletes_bibs", [])}},
            {"_id": 0}
        ).to_list(100)
        
        if not athletes:
            continue
        
        # Check if we should send notification:
        # - At least one athlete is active, OR
        # - At least one athlete made DNF in this lap (retired_at_lap == current_lap)
        has_active_athlete = any(a.get("status") == "active" for a in athletes)
        has_dnf_this_lap = any(
            a.get("status") == "retired" and a.get("retired_at_lap") == current_lap 
            for a in athletes
        )
        
        if has_active_athlete or has_dnf_this_lap:
            await send_notification_email(
                to_email=sub.get("email"),
                subject=f"Vuelta {current_lap} Completada",
                content=f"Tus atletas seguidos han completado la vuelta {current_lap}. Aquí está su progreso actual:",
                athletes_data=athletes,
                subscription_id=str(sub.get("_id", ""))
            )
        else:
            # All followed athletes are DNF/DNS from previous laps - skip notification
            print(f"Skipping lap notification for {sub.get('email')} - all followed athletes are DNF/DNS")


async def send_finish_notifications(db, athlete_bib: str, is_winner: bool = False):
    """Send notifications when an athlete finishes (DNF or Winner)"""
    
    # Get athlete data
    athlete = await db.participants.find_one(
        {"bib": athlete_bib},
        {"_id": 0}
    )
    
    if not athlete:
        return
    
    # Get all subscriptions that follow this athlete and want finish notifications
    subscriptions = await db.email_subscriptions.find(
        {
            "athletes_bibs": athlete_bib,
            "notify_on_finish": True,
            "active": True
        }
    ).to_list(1000)
    
    for sub in subscriptions:
        if is_winner:
            subject = f"🏆 ¡{athlete.get('nombre')} es el GANADOR!"
            content = f"¡Felicitaciones! {athlete.get('nombre')} {athlete.get('apellidos')} ha ganado el Backyard Ultra Santo Domingo 2026."
        else:
            subject = f"{athlete.get('nombre')} ha terminado (DNF)"
            content = f"{athlete.get('nombre')} {athlete.get('apellidos')} ha decidido no continuar en la carrera."
        
        await send_notification_email(
            to_email=sub.get("email"),
            subject=subject,
            content=content,
            athletes_data=[athlete],
            subscription_id=str(sub.get("_id", ""))
        )
