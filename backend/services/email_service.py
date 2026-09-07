import smtplib
import os

from services.env_utils import get_env
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Dict
from datetime import datetime

GMAIL_USER = get_env("GMAIL_USER")
GMAIL_APP_PASSWORD = get_env("GMAIL_APP_PASSWORD")

# Interruptor para el entorno local. La copia local de la base trae los correos
# reales de los seguidores, asi que probar el panel contra ella manda avisos de
# verdad a gente de verdad: basta con marcar un DNF de prueba para que a alguien
# le llegue "tu atleta abandono". Con EMAILS_ACTIVOS=false se registra en el log
# lo que se habria enviado y no sale nada.
#
# Por defecto SI se envia: si esta variable faltara en Render, lo grave seria
# que produccion dejara de avisar sin que nadie se diera cuenta.
EMAILS_ACTIVOS = (get_env("EMAILS_ACTIVOS", "true") or "true").lower() not in ("false", "0", "no")

def get_email_template(subject: str, content: str, athletes_data: List[Dict], unsubscribe_link: str) -> str:
    """Aviso de seguimiento: como va cada corredor al que sigue esta persona."""
    from services import correo_estilo as estilo

    base_url = get_env("FRONTEND_URL", "https://backyardultrasantodomingo.com")

    ESTADOS = {"active": "En carrera", "retired": "DNF", "dns": "DNS"}

    bloques = [estilo.h1(subject)]
    if content:
        bloques.append(estilo.p(content))

    for athlete in athletes_data:
        bib = athlete.get("bib", "-")
        nombre = f"{athlete.get('nombre', '')} {athlete.get('apellidos', '')}".strip()
        estado = ESTADOS.get(athlete.get("status", "active"), "En carrera")
        bloques += [
            estilo.separador(),
            estilo.h2(f"#{bib} · {nombre}"),
            estilo.linea("Estado", estado),
            estilo.linea("Vueltas", str(athlete.get("laps_completed", 0))),
            estilo.linea("Kilómetros", str(athlete.get("total_km", 0))),
            estilo.boton("Enviar mensaje de ánimo", f"{base_url}/enviar-animo/{bib}"),
        ]

    bloques += [
        estilo.separador(),
        estilo.p(estilo.enlace("Ver la clasificación en vivo", f"{base_url}/en-vivo")),
    ]

    pie = estilo.nota(estilo.enlace("Cancelar estos avisos", unsubscribe_link))
    return estilo.documento("".join(bloques), preheader=subject, pie_extra=pie)


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
        base_url = get_env("FRONTEND_URL", "https://backyardultrasantodomingo.com")
        unsubscribe_link = f"{base_url}/api/race/unsubscribe/{subscription_id}"
        
        msg = MIMEMultipart('alternative')
        msg['Subject'] = f"{subject} · Backyard Ultra Santo Domingo"
        msg['From'] = f"Backyard Ultra SD <{GMAIL_USER}>"
        msg['To'] = to_email
        
        html_content = get_email_template(subject, content, athletes_data, unsubscribe_link)
        
        part = MIMEText(html_content, 'html', 'utf-8')
        msg.attach(part)
        
        if not EMAILS_ACTIVOS:
            print(f"[EMAILS_ACTIVOS=false] No se envia a {to_email}: {subject}")
            return True

        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(GMAIL_USER, GMAIL_APP_PASSWORD)
            server.sendmail(GMAIL_USER, to_email, msg.as_string())
        
        print(f"Email sent successfully to {to_email}")
        return True
        
    except Exception as e:
        print(f"Error sending email to {to_email}: {str(e)}")
        return False


def _filtro_de_carrera(race_code: str) -> dict:
    """Solo avisa a quien sigue esta carrera.

    Un dorsal no identifica a nadie por si solo: el 002 del campeonato mundial
    es otra persona que el 002 de la edicion de enero. Las suscripciones viejas
    no guardaban de que carrera eran; se dan por de la primera edicion, que era
    la unica que habia cuando se crearon.
    """
    if race_code in ("BYSD-2026",):
        return {"$or": [{"race_code": race_code}, {"race_code": {"$exists": False}}]}
    return {"race_code": race_code}


async def _buscar_corredores(db, race_code: str, bibs: list) -> list:
    """Corredores de una carrera por dorsal, sea cual sea la coleccion.

    Los avisos buscaban por dorsal a secas en la coleccion `participants`, que
    es la de la primera edicion. Con dos carreras vivas eso avisa a la gente
    equivocada: el dorsal 002 del campeonato mundial es otra persona que el 002
    de 2026, y a los seguidores de aquel les llegaba el aviso de este.
    """
    if not bibs:
        return []

    posibles = set()
    for bib in bibs:
        texto = str(bib).strip()
        posibles.add(texto)
        try:
            numero = int(texto)
            posibles |= {numero, str(numero), str(numero).zfill(3)}
        except ValueError:
            pass

    corredores = await db.registrations.find(
        {"race_code": race_code, "bib": {"$in": list(posibles)}},
        {"_id": 0, "edit_token": 0},
    ).to_list(100)

    if corredores:
        return corredores

    # Ediciones historicas, cuyos resultados viven en la coleccion antigua.
    return await db.participants.find(
        {
            "bib": {"$in": list(posibles)},
            "$or": [{"race_code": race_code}, {"race_code": {"$exists": False}}],
        },
        {"_id": 0},
    ).to_list(100)


async def send_lap_notifications(db, race_code: str, current_lap: int):
    """Send notifications to all subscribers who want lap updates.

    Only sends if at least one followed athlete:
    - Is still active, OR
    - Made DNF in the current lap (their last lap)
    """

    # Get all subscriptions that want lap notifications
    subscriptions = await db.email_subscriptions.find(
        {"notify_every_lap": True, "active": True, **_filtro_de_carrera(race_code)}
    ).to_list(1000)

    for sub in subscriptions:
        # Get athlete data for followed athletes
        athletes = await _buscar_corredores(db, race_code, sub.get("athletes_bibs", []))

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


async def send_finish_notifications(db, race_code: str, athlete_bib: str, is_winner: bool = False):
    """Send notifications when an athlete finishes (DNF or Winner)"""

    corredores = await _buscar_corredores(db, race_code, [athlete_bib])
    if not corredores:
        return
    athlete = corredores[0]

    # Get all subscriptions that follow this athlete and want finish notifications
    subscriptions = await db.email_subscriptions.find(
        {
            "athletes_bibs": athlete_bib,
            "notify_on_finish": True,
            "active": True,
            **_filtro_de_carrera(race_code),
        }
    ).to_list(1000)

    for sub in subscriptions:
        if is_winner:
            subject = f"{athlete.get('nombre')} ganó el Backyard Ultra"
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



async def send_email(to_email: str, subject: str, html_content: str) -> bool:
    """Send a simple HTML email using Gmail SMTP"""
    
    if not GMAIL_USER or not GMAIL_APP_PASSWORD:
        print("Gmail credentials not configured")
        return False
    
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f"Backyard Ultra SD <{GMAIL_USER}>"
        msg['To'] = to_email
        
        part = MIMEText(html_content, 'html', 'utf-8')
        msg.attach(part)
        
        if not EMAILS_ACTIVOS:
            print(f"[EMAILS_ACTIVOS=false] No se envia a {to_email}: {subject}")
            return True

        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(GMAIL_USER, GMAIL_APP_PASSWORD)
            server.sendmail(GMAIL_USER, to_email, msg.as_string())
        
        print(f"Email sent to {to_email}")
        return True
        
    except Exception as e:
        print(f"Error sending email to {to_email}: {str(e)}")
        return False


def get_manual_notification_template(
    recipient_name: str,
    manual_type: str,  # "runners" or "volunteers"
    race_name: str,
    view_url: str,
    download_url: str
) -> str:
    """Aviso de que ya esta publicada la guia del corredor o el manual de staff."""
    from services import correo_estilo as estilo

    if manual_type == "runners":
        titulo = "Ya está la guía del corredor"
        descripcion = ("La guía oficial del corredor ya está publicada. Ahí tienes todo lo que "
                       "necesitas para prepararte.")
        boton = "Ver la guía"
        puntos = [
            "El circuito y la ruta",
            "Equipo obligatorio y recomendado",
            "Horarios y puntos de hidratación",
            "Reglas de la competencia",
            "Protocolos de seguridad",
        ]
    else:
        titulo = "Ya está el manual de voluntarios"
        descripcion = ("El manual oficial para voluntarios ya está publicado. Ahí tienes todo lo "
                       "que necesitas para tu turno.")
        boton = "Ver el manual"
        puntos = [
            "Roles y responsabilidades",
            "Horarios y turnos",
            "Cómo nos comunicamos",
            "Qué hacer en una emergencia",
            "Vestimenta y lineamientos",
        ]

    cuerpo = "".join([
        estilo.h1(titulo),
        estilo.p(f"Hola <strong>{recipient_name}</strong>,"),
        estilo.p(descripcion),
        estilo.h2("Qué encontrarás dentro"),
        estilo.lista(puntos),
        estilo.boton(boton, view_url),
        estilo.p(estilo.enlace("O descargar el PDF", download_url)),
        estilo.separador(),
        estilo.p("Léelo con tiempo, no el día del evento."),
        estilo.nota(race_name),
    ])
    pie = estilo.nota("Recibes este correo porque estás registrado para el evento.")
    return estilo.documento(cuerpo, preheader=descripcion, pie_extra=pie)


async def send_manual_notification_email(
    to_email: str,
    recipient_name: str,
    manual_type: str,
    race_name: str,
    view_url: str,
    download_url: str
) -> bool:
    """Send manual availability notification email"""
    
    if not GMAIL_USER or not GMAIL_APP_PASSWORD:
        print("Gmail credentials not configured")
        return False
    
    try:
        if manual_type == "runners":
            subject = f"Ya está la guía del corredor · {race_name}"
        else:
            subject = f"Ya está el manual de voluntarios · {race_name}"
        
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f"Backyard Ultra SD <{GMAIL_USER}>"
        msg['To'] = to_email
        
        html_content = get_manual_notification_template(
            recipient_name=recipient_name,
            manual_type=manual_type,
            race_name=race_name,
            view_url=view_url,
            download_url=download_url
        )
        
        part = MIMEText(html_content, 'html', 'utf-8')
        msg.attach(part)
        
        if not EMAILS_ACTIVOS:
            print(f"[EMAILS_ACTIVOS=false] No se envia a {to_email}: {subject}")
            return True

        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(GMAIL_USER, GMAIL_APP_PASSWORD)
            server.sendmail(GMAIL_USER, to_email, msg.as_string())
        
        print(f"Manual notification email sent to {to_email}")
        return True
        
    except Exception as e:
        print(f"Error sending manual notification to {to_email}: {str(e)}")
        return False
