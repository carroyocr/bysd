"""
Actividades de la carrera: alta desde el panel e inscripcion del corredor.
Incluye la hoja de asistencia en PDF (Nombre Completo + columna de firma).

Empezo siendo solo capacitaciones y de ahi vienen los nombres de la coleccion
y de las rutas, que no se tocan para no romper lo que ya hay publicado. Lo que
cambia es que ahora una actividad tiene tipo: junto a las capacitaciones caben
los entrenamientos, la entrega de kits y cualquier otro acto no competitivo de
la carrera. El funcionamiento es el mismo para todos.
"""
from fastapi import APIRouter, HTTPException, Header
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import io

from services.auth import has_permission, verify_admin_token

router = APIRouter(prefix="/capacitaciones", tags=["capacitaciones"])


def _verify_admin(authorization: Optional[str]):
    payload = verify_admin_token(authorization)
    if not has_permission(payload, "config"):
        raise HTTPException(status_code=403, detail="No tienes permiso para esta operacion")
    return payload


def _athlete_payload(authorization: Optional[str]):
    from routes.athletes import verify_athlete_token
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Debes iniciar sesión")
    try:
        return verify_athlete_token(authorization.replace("Bearer ", ""))
    except Exception:
        raise HTTPException(status_code=401, detail="Sesión inválida")


# Tipos de actividad. Los documentos antiguos no lo traen y son capacitaciones,
# que es lo unico que existia.
TIPOS_ACTIVIDAD = {
    "capacitacion": "Capacitación",
    "entrenamiento": "Entrenamiento",
    "entrega_kits": "Entrega de kits",
    "social": "Actividad social",
    "otro": "Otra actividad",
}
TIPO_POR_DEFECTO = "capacitacion"


class CapacitacionCreate(BaseModel):
    name: str
    datetime: str            # ISO string (fecha y hora)
    duration: str            # e.g. "2 horas"
    program: str             # agenda / descripción
    cost: float = 0.0
    is_free: bool = False
    tipo: str = TIPO_POR_DEFECTO


def _tipo_valido(tipo: Optional[str]) -> str:
    return tipo if tipo in TIPOS_ACTIVIDAD else TIPO_POR_DEFECTO


def _serialize(doc, count=0, my_registered=False):
    return {
        "id": str(doc["_id"]),
        "name": doc.get("name", ""),
        "datetime": doc.get("datetime", ""),
        "duration": doc.get("duration", ""),
        "program": doc.get("program", ""),
        "cost": doc.get("cost", 0.0),
        "is_free": doc.get("is_free", False),
        "tipo": _tipo_valido(doc.get("tipo")),
        "tipo_label": TIPOS_ACTIVIDAD[_tipo_valido(doc.get("tipo"))],
        "registered_count": count,
        "my_registered": my_registered,
    }


# ---------------- Admin ----------------

@router.post("/admin/create")
async def create_capacitacion(data: CapacitacionCreate, authorization: Optional[str] = Header(None)):
    from server import db as database
    _verify_admin(authorization)
    doc = {
        "name": data.name.strip(),
        "datetime": data.datetime,
        "duration": data.duration.strip(),
        "program": data.program.strip(),
        "cost": 0.0 if data.is_free else float(data.cost or 0),
        "is_free": data.is_free,
        "tipo": _tipo_valido(data.tipo),
        "created_at": datetime.now(timezone.utc),
    }
    res = await database.capacitaciones.insert_one(doc)
    return {"success": True, "id": str(res.inserted_id)}


@router.put("/admin/{cap_id}")
async def update_capacitacion(cap_id: str, data: CapacitacionCreate, authorization: Optional[str] = Header(None)):
    from server import db as database
    from bson import ObjectId
    _verify_admin(authorization)
    try:
        oid = ObjectId(cap_id)
    except Exception:
        raise HTTPException(status_code=400, detail="ID inválido")
    upd = {
        "name": data.name.strip(),
        "datetime": data.datetime,
        "duration": data.duration.strip(),
        "program": data.program.strip(),
        "cost": 0.0 if data.is_free else float(data.cost or 0),
        "is_free": data.is_free,
        "tipo": _tipo_valido(data.tipo),
    }
    r = await database.capacitaciones.update_one({"_id": oid}, {"$set": upd})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Capacitación no encontrada")
    return {"success": True}


@router.get("/admin/list")
async def admin_list(authorization: Optional[str] = Header(None)):
    from server import db as database
    _verify_admin(authorization)
    caps = await database.capacitaciones.find({}).sort("datetime", 1).to_list(200)
    pipeline = [{"$group": {"_id": "$capacitacion_id", "count": {"$sum": 1}}}]
    agg = await database.capacitacion_registrations.aggregate(pipeline).to_list(1000)
    counts = {c["_id"]: c["count"] for c in agg}
    return {"capacitaciones": [_serialize(c, counts.get(str(c["_id"]), 0)) for c in caps]}


@router.delete("/admin/{cap_id}")
async def delete_capacitacion(cap_id: str, authorization: Optional[str] = Header(None)):
    from server import db as database
    from bson import ObjectId
    _verify_admin(authorization)
    try:
        oid = ObjectId(cap_id)
    except Exception:
        raise HTTPException(status_code=400, detail="ID inválido")
    r = await database.capacitaciones.delete_one({"_id": oid})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Capacitación no encontrada")
    await database.capacitacion_registrations.delete_many({"capacitacion_id": cap_id})
    return {"success": True}


@router.get("/admin/{cap_id}/participants")
async def admin_participants(cap_id: str, authorization: Optional[str] = Header(None)):
    from server import db as database
    _verify_admin(authorization)
    regs = await database.capacitacion_registrations.find(
        {"capacitacion_id": cap_id}, {"_id": 0}
    ).sort("nombre_completo", 1).to_list(1000)
    return {"participants": [
        {"nombre_completo": r.get("nombre_completo", ""), "email": r.get("email", ""),
         "registered_at": r.get("created_at").isoformat() if r.get("created_at") else None}
        for r in regs
    ]}


@router.get("/admin/{cap_id}/attendance")
async def attendance_pdf(cap_id: str, authorization: Optional[str] = Header(None)):
    """Generate a printable attendance sheet: Nombre Completo + signature column."""
    from server import db as database
    from bson import ObjectId
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import cm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

    _verify_admin(authorization)
    try:
        oid = ObjectId(cap_id)
    except Exception:
        raise HTTPException(status_code=400, detail="ID inválido")
    cap = await database.capacitaciones.find_one({"_id": oid})
    if not cap:
        raise HTTPException(status_code=404, detail="Capacitación no encontrada")

    regs = await database.capacitacion_registrations.find(
        {"capacitacion_id": cap_id}, {"_id": 0}
    ).sort("nombre_completo", 1).to_list(1000)

    # Format date
    fecha = cap.get("datetime", "")
    try:
        dt = datetime.fromisoformat(fecha.replace("Z", "+00:00")) if fecha else None
        fecha_str = dt.strftime("%d/%m/%Y %H:%M") if dt else fecha
    except Exception:
        fecha_str = fecha

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=1.5 * cm, bottomMargin=1.5 * cm,
                            leftMargin=1.5 * cm, rightMargin=1.5 * cm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("t", parent=styles["Title"], fontSize=16, textColor=colors.HexColor("#E8772E"))
    sub_style = ParagraphStyle("s", parent=styles["Normal"], fontSize=10, textColor=colors.HexColor("#444444"))

    elems = [
        Paragraph("Control de Asistencia", title_style),
        Paragraph(f"<b>Capacitación:</b> {cap.get('name','')}", sub_style),
        Paragraph(f"<b>Fecha y hora:</b> {fecha_str} &nbsp;&nbsp; <b>Duración:</b> {cap.get('duration','')}", sub_style),
        Paragraph(f"<b>Inscritos:</b> {len(regs)}", sub_style),
        Spacer(1, 0.5 * cm),
    ]

    data = [["#", "Nombre Completo", "Firma"]]
    for i, r in enumerate(regs, start=1):
        data.append([str(i), r.get("nombre_completo", ""), ""])
    # add a few blank rows for walk-ins
    for j in range(5):
        data.append([str(len(regs) + j + 1), "", ""])

    table = Table(data, colWidths=[1.2 * cm, 9 * cm, 7 * cm], repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E8772E")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
        ("ROWHEIGHT", (0, 1), (-1, -1), 1.1 * cm),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 1), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 8),
    ]))
    elems.append(table)
    doc.build(elems)
    buf.seek(0)

    safe_name = "".join(c for c in cap.get("name", "capacitacion") if c.isalnum() or c in " -_").strip().replace(" ", "-")[:40]
    return Response(
        content=buf.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="asistencia-{safe_name}.pdf"'},
    )


@router.get("/tipos")
async def tipos_de_actividad():
    """Tipos disponibles. El panel los pinta desde aqui y no de una copia."""
    return {"tipos": [{"value": v, "label": l} for v, l in TIPOS_ACTIVIDAD.items()]}


# ---------------- Athlete ----------------

@router.get("/list")
async def list_for_athlete(authorization: Optional[str] = Header(None)):
    """List available trainings with the athlete's registration status (if logged in)."""
    from server import db as database
    caps = await database.capacitaciones.find({}).sort("datetime", 1).to_list(200)

    pipeline = [{"$group": {"_id": "$capacitacion_id", "count": {"$sum": 1}}}]
    agg = await database.capacitacion_registrations.aggregate(pipeline).to_list(1000)
    counts = {c["_id"]: c["count"] for c in agg}

    my_ids = set()
    if authorization and authorization.startswith("Bearer "):
        try:
            from routes.athletes import verify_athlete_token
            payload = verify_athlete_token(authorization.replace("Bearer ", ""))
            regs = await database.capacitacion_registrations.find(
                {"athlete_id": payload["athlete_id"]}, {"capacitacion_id": 1}
            ).to_list(500)
            my_ids = {r["capacitacion_id"] for r in regs}
        except Exception:
            pass

    return {"capacitaciones": [
        _serialize(c, counts.get(str(c["_id"]), 0), str(c["_id"]) in my_ids) for c in caps
    ]}


@router.post("/{cap_id}/register")
async def register(cap_id: str, authorization: Optional[str] = Header(None)):
    from server import db as database
    from bson import ObjectId
    payload = _athlete_payload(authorization)
    athlete_id = payload["athlete_id"]

    try:
        oid = ObjectId(cap_id)
    except Exception:
        raise HTTPException(status_code=400, detail="ID inválido")
    cap = await database.capacitaciones.find_one({"_id": oid})
    if not cap:
        raise HTTPException(status_code=404, detail="Capacitación no encontrada")

    athlete = await database.athletes.find_one({"_id": ObjectId(athlete_id)})
    if not athlete:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")

    nombre_completo = f"{athlete.get('nombre','')} {athlete.get('apellidos','')}".strip()
    await database.capacitacion_registrations.update_one(
        {"capacitacion_id": cap_id, "athlete_id": athlete_id},
        {"$set": {
            "nombre_completo": nombre_completo,
            "email": athlete.get("email", ""),
        }, "$setOnInsert": {"created_at": datetime.now(timezone.utc)}},
        upsert=True
    )
    return {"success": True}


@router.delete("/{cap_id}/register")
async def unregister(cap_id: str, authorization: Optional[str] = Header(None)):
    from server import db as database
    payload = _athlete_payload(authorization)
    await database.capacitacion_registrations.delete_one(
        {"capacitacion_id": cap_id, "athlete_id": payload["athlete_id"]}
    )
    return {"success": True}
