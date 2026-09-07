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
    """Los mensajes de animo, como citas. Sin cajas: una linea fina a la
    izquierda y el nombre de quien lo escribio debajo."""
    from services import correo_estilo as estilo

    if not messages:
        return estilo.p("No recibiste mensajes de ánimo durante la carrera.", apagado=True)

    html = ""
    for msg in messages:
        fan_name = msg.get("fan_name", "Anónimo")
        message_text = msg.get("message", "")
        created_at = msg.get("created_at", "")
        try:
            dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            date_str = dt.strftime("%d/%m/%Y a las %I:%M %p")
        except Exception:
            date_str = created_at

        html += f"""
            <div style="margin: 0 0 22px 0; padding-left: 16px; border-left: 2px solid {estilo.LINEA};">
                <p style="margin: 0 0 6px 0; font-size: 17px; line-height: 1.6; color: {estilo.TINTA};">{message_text}</p>
                <p style="margin: 0; font-size: 13px; color: {estilo.APAGADO};">{fan_name} · {date_str}</p>
            </div>"""

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
    """Lo que recibe el corredor al terminar: sus numeros y lo que le escribieron."""
    from services import correo_estilo as estilo

    titulo = "Campeón del Backyard Ultra" if is_winner else "Se acabó tu carrera"
    entrada = (
        "Aguantaste más que nadie. Eres el campeón."
        if is_winner else
        "Esto es lo que hiciste ahí fuera."
    )

    bloques = [
        estilo.h1(titulo),
        estilo.p(f"Hola <strong>{runner_name}</strong>,"),
        estilo.p(entrada),
        estilo.cifra("Vueltas", str(laps_completed)),
        estilo.cifra("Kilómetros", f"{total_km:g}"),
        estilo.separador(),
        estilo.h2("Quién te acompañó"),
        estilo.linea("Personas siguiéndote", str(followers_count)),
        estilo.linea("Mensajes de ánimo", str(messages_count)),
    ]
    if messages_count:
        bloques += [estilo.h2("Lo que te escribieron"), format_messages_html(cheer_messages)]

    bloques.append(estilo.p("Gracias por correr con nosotros. Nos vemos en la próxima."))
    return estilo.documento("".join(bloques), preheader=entrada)


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
        subject = "Campeón · " if is_winner else ""
        subject += "Tu resumen del Backyard Ultra Santo Domingo 2026"
        
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
