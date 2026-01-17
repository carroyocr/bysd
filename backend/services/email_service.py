import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Dict
from datetime import datetime

GMAIL_USER = os.environ.get("GMAIL_USER")
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD")

def get_email_template(subject: str, content: str, athletes_data: List[Dict], unsubscribe_link: str) -> str:
    """Generate HTML email template with race branding"""
    
    athletes_rows = ""
    for athlete in athletes_data:
        status_color = "#22c55e" if athlete.get("status") == "active" else "#ef4444" if athlete.get("status") == "retired" else "#6b7280"
        status_text = "Activo" if athlete.get("status") == "active" else "DNF" if athlete.get("status") == "retired" else "DNS"
        
        athletes_rows += f"""
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">{athlete.get('bib', '-')}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">{athlete.get('nombre', '')} {athlete.get('apellidos', '')}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
                <span style="background-color: {status_color}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px;">{status_text}</span>
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: bold; font-size: 18px;">{athlete.get('laps_completed', 0)}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">{athlete.get('total_km', 0)} km</td>
        </tr>
        """
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f4;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #ea580c 0%, #f97316 100%); padding: 30px; text-align: center;">
                <img src="https://racetracking.preview.emergentagent.com/icon-bu.png" alt="Backyard Ultra" style="width: 80px; height: 80px; border-radius: 50%; margin-bottom: 15px;">
                <h1 style="color: white; margin: 0; font-size: 24px; font-weight: bold;">BACKYARD ULTRA</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px; letter-spacing: 2px;">SANTO DOMINGO 2026</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 30px;">
                <h2 style="color: #1f2937; margin: 0 0 10px 0; font-size: 20px;">{subject}</h2>
                <p style="color: #6b7280; margin: 0 0 25px 0; font-size: 14px;">{content}</p>
                
                <!-- Athletes Table -->
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; background-color: #fafaf9; border-radius: 8px; overflow: hidden;">
                        <thead>
                            <tr style="background-color: #f5f5f4;">
                                <th style="padding: 12px; text-align: left; font-size: 12px; color: #6b7280; text-transform: uppercase;">BIB</th>
                                <th style="padding: 12px; text-align: left; font-size: 12px; color: #6b7280; text-transform: uppercase;">Nombre</th>
                                <th style="padding: 12px; text-align: center; font-size: 12px; color: #6b7280; text-transform: uppercase;">Estado</th>
                                <th style="padding: 12px; text-align: center; font-size: 12px; color: #6b7280; text-transform: uppercase;">Vueltas</th>
                                <th style="padding: 12px; text-align: center; font-size: 12px; color: #6b7280; text-transform: uppercase;">Km</th>
                            </tr>
                        </thead>
                        <tbody>
                            {athletes_rows}
                        </tbody>
                    </table>
                </div>
                
                <!-- Footer Info -->
                <div style="margin-top: 25px; padding: 20px; background-color: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
                    <p style="margin: 0; color: #92400e; font-size: 14px;">
                        <strong>📍 Seguimiento en vivo:</strong><br>
                        <a href="https://racetracking.preview.emergentagent.com/en-vivo" style="color: #ea580c;">https://racetracking.preview.emergentagent.com/en-vivo</a>
                    </p>
                </div>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #1f2937; padding: 20px; text-align: center;">
                <p style="color: #9ca3af; margin: 0 0 10px 0; font-size: 12px;">
                    Backyard Ultra Santo Domingo 2026
                </p>
                <p style="color: #6b7280; margin: 0; font-size: 11px;">
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
        unsubscribe_link = f"https://racetracking.preview.emergentagent.com/api/race/unsubscribe/{subscription_id}"
        
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
    """Send notifications to all subscribers who want lap updates"""
    
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
        
        if athletes:
            await send_notification_email(
                to_email=sub.get("email"),
                subject=f"Vuelta {current_lap} Completada",
                content=f"Tus atletas seguidos han completado la vuelta {current_lap}. Aquí está su progreso actual:",
                athletes_data=athletes,
                subscription_id=str(sub.get("_id", ""))
            )


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
