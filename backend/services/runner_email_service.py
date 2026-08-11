import smtplib
import os

from services.env_utils import get_env
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Dict, Optional
from datetime import datetime
from services.email_service import EMAILS_ACTIVOS

GMAIL_USER = get_env("GMAIL_USER")
GMAIL_APP_PASSWORD = get_env("GMAIL_APP_PASSWORD")

# Base URL for the application
BASE_URL = get_env("FRONTEND_URL", "https://backyardultrasantodomingo.com")
LOGO_URL = f"{BASE_URL}/icon-bu.png"

# Hardcoded email mapping - BIB to Email
RUNNER_EMAILS = {
    "001": "lgaitanleal@gmail.com",
    "002": "hamletburgos@hotmail.com",
    "003": "carloscamejo83@gmail.com",
    "004": "tomas.ruizornes@gmail.com",
    "005": "biondi27@gmail.com",
    "006": "minimuri.mexico@gmail.com",
    "007": "coacherbscharf@gmail.com",
    "008": "judelkvargas@gmail.com",
    "009": "angelrondon86@gmail.com",
    "010": "iemdventas@gmail.com",
    "011": "luisemiliocabralrivera@gmail.com",
    "012": "abelperez1912@gmail.com",
    "013": "parrawalterdamian@gmail.com",
    "014": "elcadete8@gmail.com",
    "015": "oli.arellano.campos@gmail.com",
    "016": "aivaliklisjla@gmail.com",
    "017": "aguilarmendizabal@gmail.com",
    "018": "carlosnutrilitesport2009@gmail.com",
    "019": "gapercivaldi@gmail.com",
    "020": "ivaneguiluz@gmail.com",
    "021": "miguelvasquezruns@gmail.com",
    "022": "la.deleon.encarnacion@gmail.com",
    "023": "isabellaroussdomin@gmail.com",
    "024": "alijeronimo@gmail.com",
    "025": "rafael.arthurov@gmail.com",
    "026": "faustobatista21@gmail.com",
    "027": "miriambalaguer13@gmail.com",
    "028": "yosip0507@gmail.com",
    "029": "yesi0811.ym@gmail.com",
    "030": "jimenezbraulio@gmail.com",
    "031": "yeiryssoto11@gmail.com",
    "032": "tommygs90@gmail.com",
    "033": "heldragarib@gmail.com",
    "034": "jgab.rodriguez1@gmail.com",
    "035": "sissymencia@gmail.com",
    "036": "julicanahuate@gmail.com",
    "037": "omy2810@gmail.com",
    "038": "ismaelmorillo25@gmail.com",
    "039": "ambaresmeraldadls@gmail.com",
    "040": "margaretamabel1113@gmail.com",
    "041": "annekeblomer@gmail.com",
    "042": "pascalsterlin@gmail.com",
    "043": "luisnadielperezgonzalez@gmail.com",
    "044": "ajruiz67@gmail.com",
    "045": "daiyishiguetome@gmail.com",
    "046": "ernestovalles1103@gmail.com",
    "047": "orellana.david@gmail.com",
    "048": "simonbolivarcepeda@gmail.com",
    "049": "miltonnunezimbert@gmail.com",
    "050": "kkephasprp@gmail.com",
    "051": "rjfarach@gmail.com",
    "052": "bernardodejesus22@gmail.com",
    "053": "jhoelcam@gmail.com",
    "054": "losgarj007@gmail.com",
    "055": "victorkery@gmail.com",
    "056": "robert.duran1709@gmail.com",
    "057": "epaulinotj@gmail.com",
    "058": "cesar.encarnacion.r@gmail.com",
    "059": "rafael.altuna23@gmail.com",
    "060": "alexandra20049@gmail.com",
    "061": "even.lafay@gmail.com",
    "062": "cjballenilla@hotmail.com",
    "063": "georgecorre300@gmail.com",
    "064": "burgos772@gmail.com",
    "065": "serf42@gmail.com",
    "066": "pablitoclases33@gmail.com",
    "067": "ramonjose0127@gmail.com",
    "068": "oj.arch89@gmail.com",
    "069": "jomamanuelgv@gmail.com",
    "070": "oscarrmoquete@gmail.com",
    "071": "carlosogandomontas@gmail.com",
    "072": "daphneheyaime@gmail.com",
    "073": "mac222330@gmail.com",
    "074": "michelledominguez6@gmail.com",
    "075": "karinaanaortiz@gmail.com",
    "076": "isadelgam@gmail.com",
    "077": "pedrop2954.pt@gmail.com",
    "078": "rommellmorel121@gmail.com",
    "079": "avasquezcolon@gmail.com",
    "080": "jcblevinson@gmail.com",
    "081": "kensey.pichardo@gmail.com",
    "082": "ca.js.chaljub@gmail.com",
    "083": "scheidigsr@gmail.com",
    "084": "armandojosebisono@gmail.com",
    "085": "dirtsurfer.tenerife@hotmail.es",
    "086": "tapiagmt11@gmail.com",
    "087": "melvanegas2@gmail.com",
    "088": "lennysjimenez68@gmail.com",
    "090": "livio2020@gmail.com",
}


def get_runner_email(bib: str) -> Optional[str]:
    """Get email for a runner by BIB number"""
    # Normalize BIB to 3 digits
    normalized_bib = bib.zfill(3)
    return RUNNER_EMAILS.get(normalized_bib)


def format_messages_html(messages: List[Dict]) -> str:
    """Format cheer messages as HTML list"""
    if not messages:
        return "<p style='color: #6b7280; font-style: italic;'>No recibiste mensajes de ánimo durante la carrera.</p>"
    
    html = ""
    for msg in messages:
        fan_name = msg.get("fan_name", "Anónimo")
        message_text = msg.get("message", "")
        created_at = msg.get("created_at", "")
        
        # Format date
        try:
            dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            date_str = dt.strftime("%d/%m/%Y a las %I:%M %p")
        except:
            date_str = created_at
        
        html += f"""
        <div style="background-color: #f9fafb; border-left: 4px solid #ea580c; padding: 12px 16px; margin-bottom: 12px; border-radius: 0 8px 8px 0;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <span style="font-weight: 600; color: #1f2937;">{fan_name}</span>
                <span style="color: #9ca3af; font-size: 12px;">•</span>
                <span style="color: #6b7280; font-size: 12px;">{date_str}</span>
            </div>
            <p style="margin: 0; color: #374151; font-size: 14px;">"{message_text}"</p>
        </div>
        """
    
    return html


def get_runner_completion_template(
    runner_name: str,
    total_km: float,
    laps_completed: int,
    followers_count: int,
    messages_count: int,
    cheer_messages: List[Dict],
    is_winner: bool = False
) -> str:
    """Generate HTML email template for runner completion notification"""
    
    winner_badge = ""
    if is_winner:
        winner_badge = """
        <div style="background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); padding: 16px; text-align: center; margin-bottom: 24px; border-radius: 12px;">
            <span style="font-size: 48px;">🏆</span>
            <p style="color: #78350f; font-size: 24px; font-weight: bold; margin: 8px 0 0 0;">¡CAMPEÓN DEL BACKYARD ULTRA!</p>
        </div>
        """
    
    messages_html = format_messages_html(cheer_messages)
    
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
            
            <!-- Content -->
            <div style="padding: 32px 24px;">
                {winner_badge}
                
                <p style="color: #1f2937; margin: 0 0 16px 0; font-size: 18px; line-height: 1.6;">
                    Hola <strong>{runner_name}</strong>,
                </p>
                
                <!-- Main Message -->
                <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 16px; padding: 24px; margin-bottom: 24px;">
                    <p style="color: #92400e; font-size: 20px; font-weight: bold; margin: 0 0 16px 0; text-align: center;">
                        ¡Felicidades! 🎉
                    </p>
                    <p style="color: #78350f; margin: 0; font-size: 15px; line-height: 1.8; text-align: center;">
                        Completar este Backyard no es solo cruzar vueltas, es una decisión consciente de ir más allá del cansancio, de la duda y de los propios límites.
                    </p>
                    <p style="color: #78350f; margin: 16px 0 0 0; font-size: 15px; line-height: 1.8; text-align: center;">
                        Gracias por aceptar el reto, por no rendirte y por demostrar que la verdadera carrera también se corre en la cabeza y en el corazón.
                    </p>
                    <p style="color: #78350f; margin: 16px 0 0 0; font-size: 15px; line-height: 1.8; text-align: center; font-weight: 600;">
                        Hoy no solo terminaste un Backyard: te llevas una versión más fuerte de ti mismo. 🏃‍♂️🔥
                    </p>
                </div>
                
                <!-- Stats Summary -->
                <h2 style="color: #1f2937; font-size: 18px; margin: 0 0 16px 0; border-bottom: 2px solid #ea580c; padding-bottom: 8px;">
                    📊 Tu Resumen de Carrera
                </h2>
                
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 24px;">
                    <!-- KM -->
                    <div style="background-color: #fef3c7; border-radius: 12px; padding: 16px; text-align: center;">
                        <p style="margin: 0; font-size: 32px; font-weight: bold; color: #ea580c;">{total_km}</p>
                        <p style="margin: 4px 0 0 0; font-size: 12px; color: #92400e; text-transform: uppercase;">Kilómetros</p>
                    </div>
                    
                    <!-- Laps -->
                    <div style="background-color: #dbeafe; border-radius: 12px; padding: 16px; text-align: center;">
                        <p style="margin: 0; font-size: 32px; font-weight: bold; color: #2563eb;">{laps_completed}</p>
                        <p style="margin: 4px 0 0 0; font-size: 12px; color: #1e40af; text-transform: uppercase;">Vueltas</p>
                    </div>
                    
                    <!-- Followers -->
                    <div style="background-color: #dcfce7; border-radius: 12px; padding: 16px; text-align: center;">
                        <p style="margin: 0; font-size: 32px; font-weight: bold; color: #16a34a;">{followers_count}</p>
                        <p style="margin: 4px 0 0 0; font-size: 12px; color: #166534; text-transform: uppercase;">Seguidores</p>
                    </div>
                    
                    <!-- Messages -->
                    <div style="background-color: #f3e8ff; border-radius: 12px; padding: 16px; text-align: center;">
                        <p style="margin: 0; font-size: 32px; font-weight: bold; color: #9333ea;">{messages_count}</p>
                        <p style="margin: 4px 0 0 0; font-size: 12px; color: #6b21a8; text-transform: uppercase;">Mensajes</p>
                    </div>
                </div>
                
                <!-- Cheer Messages Section -->
                <h2 style="color: #1f2937; font-size: 18px; margin: 0 0 16px 0; border-bottom: 2px solid #9333ea; padding-bottom: 8px;">
                    💬 Mensajes de Ánimo Recibidos ({messages_count})
                </h2>
                
                <div style="margin-bottom: 24px;">
                    {messages_html}
                </div>
                
                <!-- CTA -->
                <div style="text-align: center; margin-top: 24px;">
                    <a href="{BASE_URL}/comunidad" style="display: inline-block; background: linear-gradient(135deg, #ea580c 0%, #f97316 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: 600;">
                        Ver Comunidad
                    </a>
                </div>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #1f2937; padding: 24px; text-align: center;">
                <p style="color: #f97316; margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">
                    ¡Gracias por ser parte del Backyard Ultra! 🧡
                </p>
                <p style="color: #9ca3af; margin: 0 0 12px 0; font-size: 13px;">
                    Nos vemos en la próxima edición
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


async def send_runner_completion_email(
    to_email: str,
    runner_name: str,
    total_km: float,
    laps_completed: int,
    followers_count: int,
    messages_count: int,
    cheer_messages: List[Dict],
    is_winner: bool = False
) -> bool:
    """Send completion email to a runner"""
    
    if not GMAIL_USER or not GMAIL_APP_PASSWORD:
        print("Gmail credentials not configured")
        return False
    
    try:
        subject = "🏆 ¡CAMPEÓN! " if is_winner else "🎉 "
        subject += f"Tu resumen del Backyard Ultra Santo Domingo 2026"
        
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f"Backyard Ultra SD <{GMAIL_USER}>"
        msg['To'] = to_email
        
        html_content = get_runner_completion_template(
            runner_name=runner_name,
            total_km=total_km,
            laps_completed=laps_completed,
            followers_count=followers_count,
            messages_count=messages_count,
            cheer_messages=cheer_messages,
            is_winner=is_winner
        )
        
        part = MIMEText(html_content, 'html', 'utf-8')
        msg.attach(part)
        
        if not EMAILS_ACTIVOS:
            print(f"[EMAILS_ACTIVOS=false] No se envia a {to_email}")
            return True

        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(GMAIL_USER, GMAIL_APP_PASSWORD)
            server.sendmail(GMAIL_USER, to_email, msg.as_string())
        
        print(f"Runner completion email sent to {to_email}")
        return True
        
    except Exception as e:
        print(f"Error sending runner completion email to {to_email}: {str(e)}")
        return False


async def send_email(to_email: str, subject: str, html_content: str) -> bool:
    """Send a generic email with HTML content"""
    
    if not GMAIL_USER or not GMAIL_APP_PASSWORD:
        print("Gmail credentials not configured")
        raise Exception("Gmail credentials not configured")
    
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f"Backyard Ultra SD <{GMAIL_USER}>"
        msg['To'] = to_email
        
        part = MIMEText(html_content, 'html', 'utf-8')
        msg.attach(part)
        
        if not EMAILS_ACTIVOS:
            print(f"[EMAILS_ACTIVOS=false] No se envia a {to_email}")
            return True

        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(GMAIL_USER, GMAIL_APP_PASSWORD)
            server.sendmail(GMAIL_USER, to_email, msg.as_string())
        
        print(f"Email sent to {to_email}")
        return True
        
    except Exception as e:
        print(f"Error sending email to {to_email}: {str(e)}")
        raise
