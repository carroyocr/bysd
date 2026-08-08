"""
Volunteer Email Scheduler

This module handles automatic scheduling of volunteer notification emails:
1. Reminder emails sent 1 hour before each shift starts
2. Mass email on Friday January 23, 2026 at 6:00 PM with all assignments

The scheduler runs as a background task and uses APScheduler.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.date import DateTrigger
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)

# Global scheduler instance
scheduler: Optional[AsyncIOScheduler] = None

# Timezone for Santo Domingo (AST = UTC-4)
TIMEZONE = "America/Santo_Domingo"

# Event dates
EVENT_DAY_1 = "2026-01-24"
EVENT_DAY_2 = "2026-01-25"
FRIDAY_EMAIL_DATE = "2026-01-23"
FRIDAY_EMAIL_HOUR = 18  # 6:00 PM


async def send_shift_reminder(slot_id: int):
    """Send reminder email for a specific shift"""
    try:
        # Import here to avoid circular imports
        from server import db as database
        from services.volunteer_email_service import send_volunteer_reminder_email
        
        # Get the assignment
        assignment = await database.volunteer_assignments.find_one(
            {"id": slot_id},
            {"_id": 0}
        )
        
        if not assignment or not assignment.get("email_asignado"):
            logger.warning(f"No assignment found or no volunteer assigned for slot {slot_id}")
            return
        
        # Get volunteer info
        volunteer = await database.volunteers.find_one(
            {"email": assignment["email_asignado"]},
            {"_id": 0}
        )
        
        if not volunteer:
            logger.warning(f"Volunteer not found for email {assignment['email_asignado']}")
            return
        
        volunteer_name = f"{volunteer.get('nombre', '')} {volunteer.get('apellidos', '')}".strip()
        
        from services.volunteer_dates import con_fecha

        success = await send_volunteer_reminder_email(
            to_email=assignment["email_asignado"],
            volunteer_name=volunteer_name,
            assignment=await con_fecha(database, assignment)
        )
        
        if success:
            logger.info(f"Reminder sent to {volunteer_name} ({assignment['email_asignado']}) for slot {slot_id}")
        else:
            logger.error(f"Failed to send reminder for slot {slot_id}")
            
    except Exception as e:
        logger.error(f"Error sending reminder for slot {slot_id}: {str(e)}")


async def send_shift_push(slot_id: int):
    """Aviso push al voluntario, media hora antes de su turno.

    Se manda a los telefonos que ese voluntario tenga registrados en la app.
    Si no tiene ninguno, o el push no esta configurado, no pasa nada: el correo
    de la hora previa sigue saliendo igual.
    """
    try:
        from server import db as database
        from services import push_service

        if not push_service.esta_configurado():
            return

        slot = await database.volunteer_assignments.find_one({"id": slot_id}, {"_id": 0})
        if not slot:
            return
        email = (slot.get("email_asignado") or "").lower()
        if not email:
            return

        tokens = [
            d["token"]
            async for d in database.push_devices.find({"staff_email": email}, {"token": 1})
        ]
        if not tokens:
            return

        hora = (slot.get("hora_inicio") or "")[:5]
        puesto = slot.get("puesto") or "tu puesto"
        resultado = await push_service.enviar(
            tokens,
            "Tu turno empieza en 30 minutos",
            f"{hora} · {puesto}",
            {"tipo": "turno", "slot_id": str(slot_id)},
        )
        muertos = resultado.get("tokens_muertos") or []
        if muertos:
            await database.push_devices.delete_many({"token": {"$in": muertos}})
        logger.info(f"Push de turno {slot_id} enviado a {resultado.get('enviados')} dispositivos")
    except Exception as e:
        logger.error(f"No se pudo enviar el push del turno {slot_id}: {e}")


async def send_friday_mass_email():
    """Send assignments summary email to all volunteers with assignments"""
    try:
        from server import db as database
        from services.volunteer_email_service import send_volunteer_assignments_email
        
        logger.info("Starting Friday mass email send...")
        
        # Get all unique emails with assignments
        pipeline = [
            {"$match": {"email_asignado": {"$ne": None}}},
            {"$group": {"_id": "$email_asignado"}}
        ]
        
        unique_emails = await database.volunteer_assignments.aggregate(pipeline).to_list(1000)
        
        sent_count = 0
        failed_count = 0
        
        for item in unique_emails:
            email = item["_id"]
            
            # Get volunteer info
            volunteer = await database.volunteers.find_one(
                {"email": email},
                {"_id": 0}
            )
            
            if not volunteer:
                failed_count += 1
                continue
            
            # Get all assignments for this volunteer
            assignments = await database.volunteer_assignments.find(
                {"email_asignado": email},
                {"_id": 0}
            ).to_list(100)
            
            volunteer_name = f"{volunteer.get('nombre', '')} {volunteer.get('apellidos', '')}".strip()
            
            from services.volunteer_dates import con_fecha_varios

            success = await send_volunteer_assignments_email(
                to_email=email,
                volunteer_name=volunteer_name,
                assignments=await con_fecha_varios(database, assignments)
            )
            
            if success:
                sent_count += 1
            else:
                failed_count += 1
            
            # Small delay between emails to avoid rate limiting
            await asyncio.sleep(0.5)
        
        logger.info(f"Friday mass email complete: {sent_count} sent, {failed_count} failed")
        
    except Exception as e:
        logger.error(f"Error in Friday mass email: {str(e)}")


def parse_time_to_datetime(date_str: str, time_str: str) -> datetime:
    """Convert date and time strings to datetime object in local timezone"""
    try:
        # Parse time (format: HH:MM:SS)
        time_parts = time_str.split(":")
        hour = int(time_parts[0])
        minute = int(time_parts[1]) if len(time_parts) > 1 else 0
        
        # Parse date (format: YYYY-MM-DD)
        date_parts = date_str.split("-")
        year = int(date_parts[0])
        month = int(date_parts[1])
        day = int(date_parts[2])
        
        return datetime(year, month, day, hour, minute, 0)
    except Exception as e:
        logger.error(f"Error parsing datetime: {date_str} {time_str}: {str(e)}")
        return None


async def schedule_all_reminders():
    """Schedule reminder emails for all assigned slots (1 hour before start)"""
    global scheduler
    
    if not scheduler:
        logger.error("Scheduler not initialized")
        return {"error": "Scheduler not initialized"}
    
    try:
        from server import db as database
        
        # Get all assigned slots
        slots = await database.volunteer_assignments.find(
            {"email_asignado": {"$ne": None}},
            {"_id": 0}
        ).to_list(1000)
        
        scheduled_count = 0
        skipped_count = 0
        now = datetime.now()
        
        from services.volunteer_dates import fecha_y_hora_de_slot

        for slot in slots:
            slot_id = slot.get("id")

            # La fecha sale del dia_tipo + la programacion del evento; los
            # slots no guardan una fecha concreta
            start_time = await fecha_y_hora_de_slot(database, slot)
            if not start_time:
                skipped_count += 1
                continue
            
            reminder_time = start_time - timedelta(hours=1)

            # Only schedule if reminder time is in the future
            if reminder_time > now:
                job_id = f"reminder_slot_{slot_id}"

                # Remove existing job if any
                existing_job = scheduler.get_job(job_id)
                if existing_job:
                    scheduler.remove_job(job_id)

                # Schedule the reminder
                scheduler.add_job(
                    send_shift_reminder,
                    trigger=DateTrigger(run_date=reminder_time),
                    args=[slot_id],
                    id=job_id,
                    name=f"Reminder for slot {slot_id}"
                )
                scheduled_count += 1
                logger.info(f"Scheduled reminder for slot {slot_id} at {reminder_time}")
            else:
                skipped_count += 1

            # Aviso push media hora antes, aparte del correo de la hora previa.
            # El correo se lee cuando se lee; el push llega al bolsillo justo
            # cuando toca salir hacia el puesto.
            push_time = start_time - timedelta(minutes=30)
            if push_time > now:
                push_job = f"push_slot_{slot_id}"
                if scheduler.get_job(push_job):
                    scheduler.remove_job(push_job)
                scheduler.add_job(
                    send_shift_push,
                    trigger=DateTrigger(run_date=push_time),
                    args=[slot_id],
                    id=push_job,
                    name=f"Push for slot {slot_id}",
                )
        
        logger.info(f"Scheduled {scheduled_count} reminders, skipped {skipped_count} (past dates)")
        return {
            "scheduled": scheduled_count,
            "skipped": skipped_count,
            "message": f"Scheduled {scheduled_count} reminder emails"
        }
        
    except Exception as e:
        logger.error(f"Error scheduling reminders: {str(e)}")
        return {"error": str(e)}


def schedule_friday_email():
    """Schedule the Friday 6pm mass email"""
    global scheduler
    
    if not scheduler:
        logger.error("Scheduler not initialized")
        return
    
    job_id = "friday_mass_email"
    
    # Remove existing job if any
    existing_job = scheduler.get_job(job_id)
    if existing_job:
        scheduler.remove_job(job_id)
    
    # Schedule for Friday Jan 23, 2026 at 6:00 PM
    run_date = datetime(2026, 1, 23, 18, 0, 0)
    
    scheduler.add_job(
        send_friday_mass_email,
        trigger=DateTrigger(run_date=run_date),
        id=job_id,
        name="Friday 6PM Mass Email"
    )
    
    logger.info(f"Scheduled Friday mass email for {run_date}")


def init_scheduler():
    """Initialize the APScheduler"""
    global scheduler
    
    if scheduler is not None:
        logger.warning("Scheduler already initialized")
        return scheduler
    
    scheduler = AsyncIOScheduler(timezone=TIMEZONE)
    scheduler.start()
    
    logger.info("Volunteer email scheduler initialized")
    return scheduler


def shutdown_scheduler():
    """Shutdown the scheduler gracefully"""
    global scheduler
    
    if scheduler:
        scheduler.shutdown()
        scheduler = None
        logger.info("Scheduler shutdown complete")


def schedule_single_reminder(slot_id: int, dia: str, hora_inicio: str) -> bool:
    """Schedule a reminder for a single slot (called when a new assignment is made)"""
    global scheduler
    
    if not scheduler:
        logger.warning("Scheduler not initialized, cannot schedule reminder")
        return False
    
    try:
        # Calculate reminder time (1 hour before)
        start_time = parse_time_to_datetime(dia, hora_inicio)
        if not start_time:
            logger.warning(f"Could not parse datetime for slot {slot_id}")
            return False
        
        reminder_time = start_time - timedelta(hours=1)
        now = datetime.now()
        
        # Only schedule if reminder time is in the future
        if reminder_time > now:
            job_id = f"reminder_slot_{slot_id}"
            
            # Remove existing job if any
            existing_job = scheduler.get_job(job_id)
            if existing_job:
                scheduler.remove_job(job_id)
            
            # Schedule the reminder
            scheduler.add_job(
                send_shift_reminder,
                trigger=DateTrigger(run_date=reminder_time),
                args=[slot_id],
                id=job_id,
                name=f"Reminder for slot {slot_id}"
            )
            logger.info(f"Scheduled reminder for slot {slot_id} at {reminder_time}")
            return True
        else:
            logger.info(f"Reminder time for slot {slot_id} is in the past, not scheduling")
            return False
            
    except Exception as e:
        logger.error(f"Error scheduling reminder for slot {slot_id}: {str(e)}")
        return False


def cancel_single_reminder(slot_id: int) -> bool:
    """Cancel a reminder for a single slot (called when an assignment is removed)"""
    global scheduler
    
    if not scheduler:
        logger.warning("Scheduler not initialized, cannot cancel reminder")
        return False
    
    try:
        job_id = f"reminder_slot_{slot_id}"
        existing_job = scheduler.get_job(job_id)
        
        if existing_job:
            scheduler.remove_job(job_id)
            logger.info(f"Cancelled reminder for slot {slot_id}")
            return True
        else:
            logger.info(f"No reminder found for slot {slot_id}")
            return False
            
    except Exception as e:
        logger.error(f"Error cancelling reminder for slot {slot_id}: {str(e)}")
        return False


def get_scheduled_jobs():
    """Get list of all scheduled jobs"""
    global scheduler
    
    if not scheduler:
        return []
    
    jobs = []
    for job in scheduler.get_jobs():
        jobs.append({
            "id": job.id,
            "name": job.name,
            "next_run_time": str(job.next_run_time) if job.next_run_time else None,
            "trigger": str(job.trigger)
        })
    
    return jobs
