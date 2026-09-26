"""
Seleccionados del Campeonato Mundial por Equipos.

Mantenimiento del roster (titulares y reservas). Los candidatos salen de los
atletas del evento previo (BYSD-2026), que viven en las colecciones
archived_participants / participants; al seleccionar uno se copia su ficha a
la colección campeonato_seleccionados.
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import csv
import io
import re
import uuid

from services.auth import require_permission

router = APIRouter(prefix="/seleccionados", tags=["seleccionados"])

# Mismo permiso que las pantallas de atletas (Resultados 2026, Perfiles)
solo_atletas = Depends(require_permission("athletes"))

CATEGORIAS = ("titular", "reserva")

# La nomina es la lista de quien va al campeonato; la carrera se corre sobre
# `registrations`, como cualquier otra. Se mantienen a la par: entrar en la
# nomina inscribe, y salir de ella desinscribe. Antes el campeonato tenia su
# propia rama en el control de carrera y por eso no podia correrse -- ni el QR
# ni el control de vueltas miraban en esta coleccion.
MUNDIAL = "MUNDIAL-2026"


async def _siguiente_dorsal(db) -> str:
    inscritos = await db.registrations.find(
        {"race_code": MUNDIAL}, {"bib": 1}
    ).to_list(500)

    numeros = []
    for i in inscritos:
        try:
            numeros.append(int(str(i.get("bib") or "").lstrip("0") or 0))
        except ValueError:
            continue

    return f"{(max(numeros) if numeros else 0) + 1:03d}"


# Orden en el que se reparten los dorsales: primero la seleccion, detras la
# reserva. Lo que no traiga categoria va al final, que es mejor que perderlo.
ORDEN_CATEGORIAS = {"titular": 0, "reserva": 1}


def _orden_de_dorsal(bib) -> tuple:
    """Para ordenar dorsales que son cadenas: "009" antes que "023"."""
    texto = str(bib or "")
    digitos = re.sub(r"\D", "", texto)
    return (0, int(digitos)) if digitos else (1, texto)


def plan_de_renumeracion(inscripciones: list) -> list:
    """Los dorsales que le tocan a cada inscripcion: 1..N la seleccion y la
    reserva a continuacion.

    No reordena a nadie: respeta el orden que ya tenian y solo cierra los
    huecos que dejan las altas y bajas de la nomina. Reordenar por nombre
    cambiaria el dorsal de gente que no tiene por que cambiarlo.

    Devuelve la lista entera de (inscripcion, dorsal_nuevo), tambien las que
    no cambian: quien lo aplique decide, y quien lo lea ve el cuadro completo.
    """
    ordenadas = sorted(
        inscripciones,
        key=lambda i: (
            ORDEN_CATEGORIAS.get((i.get("categoria") or "").lower(), 2),
            _orden_de_dorsal(i.get("bib")),
        ),
    )
    return [(i, f"{n:03d}") for n, i in enumerate(ordenadas, start=1)]


async def _correo_conocido(db, seleccionado: dict) -> Optional[str]:
    """Correo del atleta, si se puede averiguar por su paso por 2026."""
    from bson import ObjectId
    from migrations.bib_email_2026 import BIB_EMAIL_MAP

    bib_previo = str(seleccionado.get("bib") or "").zfill(3)
    if bib_previo in BIB_EMAIL_MAP:
        return BIB_EMAIL_MAP[bib_previo]

    if seleccionado.get("result_id"):
        try:
            corredor = await db.participants.find_one({"_id": ObjectId(seleccionado["result_id"])})
        except Exception:
            corredor = None
        if corredor and corredor.get("claimed_by"):
            try:
                atleta = await db.athletes.find_one({"_id": ObjectId(corredor["claimed_by"])})
            except Exception:
                atleta = None
            if atleta and atleta.get("email"):
                return atleta["email"]

    return None


async def inscribir_en_el_mundial(db, seleccionado: dict) -> Optional[dict]:
    """Da de alta al seleccionado como corredor del campeonato."""
    carrera = await db.race_configurations.find_one({"code": MUNDIAL})
    if not carrera:
        return None

    ya_esta = await db.registrations.find_one(
        {"race_code": MUNDIAL, "seleccionado_id": seleccionado["id"]}
    )
    if ya_esta:
        return None

    dorsal = await _siguiente_dorsal(db)
    correo = await _correo_conocido(db, seleccionado)
    pendiente = correo is None
    if pendiente:
        # Direccion imposible de entregar, para que no salga un correo a ciegas.
        # La organizacion la corrige desde el panel.
        correo = f"pendiente-{dorsal}@mundial-2026.invalid"

    ahora = datetime.now(timezone.utc)
    inscripcion = {
        "race_code": MUNDIAL,
        "bib": dorsal,
        "nombre": seleccionado.get("nombre"),
        "apellidos": seleccionado.get("apellidos") or "",
        "email": correo.lower(),
        "sexo": seleccionado.get("sexo") or "",
        "nacionalidad": seleccionado.get("nacionalidad") or "DOM",
        # En el campeonato no hay inscripcion que pagar: estar en la nomina es
        # lo que da la plaza.
        "status": "registered",
        "payment_status": "paid",
        "laps_completed": 0,
        "total_km": 0.0,
        "categoria": seleccionado.get("categoria"),
        "seleccionado_id": seleccionado["id"],
        "correo_pendiente": pendiente,
        "edit_token": uuid.uuid4().hex,
        "created_at": ahora,
        "updated_at": ahora,
    }
    await db.registrations.insert_one(inscripcion)
    inscripcion.pop("_id", None)
    inscripcion.pop("edit_token", None)
    return inscripcion


def get_db():
    from server import db
    return db


class SeleccionadoCreate(BaseModel):
    result_id: str  # _id del participante del evento previo
    categoria: str  # titular | reserva


class SeleccionadoManualCreate(BaseModel):
    """Atleta externo: no corrio el evento previo, se digita a mano."""
    nombre: str
    apellidos: Optional[str] = ""
    categoria: str  # titular | reserva
    sexo: Optional[str] = ""
    nacionalidad: Optional[str] = ""
    bib: Optional[str] = None
    laps_completed: Optional[int] = 0


class SeleccionadoUpdate(BaseModel):
    categoria: str


@router.get("/public")
async def public_seleccionados(db=Depends(get_db)):
    """Nomina para la pagina publica del campeonato: solo nombre y vueltas."""
    docs = await db.campeonato_seleccionados.find(
        {}, {"_id": 0, "nombre": 1, "apellidos": 1, "laps_completed": 1, "categoria": 1}
    ).to_list(500)

    def publicos(categoria):
        grupo = [d for d in docs if d.get("categoria") == categoria]
        grupo.sort(key=lambda d: (-(d.get("laps_completed") or 0), d.get("nombre", "")))
        return [
            {
                "name": f"{d.get('nombre', '')} {d.get('apellidos', '')}".strip(),
                "laps": d.get("laps_completed") or 0,
            }
            for d in grupo
        ]

    return {"titulares": publicos("titular"), "reservas": publicos("reserva")}


@router.get("/admin", dependencies=[solo_atletas])
async def list_seleccionados(db=Depends(get_db)):
    docs = await db.campeonato_seleccionados.find({}, {"_id": 0}).sort("created_at", 1).to_list(500)
    titulares = sum(1 for d in docs if d.get("categoria") == "titular")
    return {
        "seleccionados": docs,
        "stats": {
            "titulares": titulares,
            "reservas": len(docs) - titulares,
            "total": len(docs),
        },
    }


@router.post("/admin/renumerar", dependencies=[solo_atletas])
async def renumerar_dorsales(db=Depends(get_db)):
    """Reparte los dorsales del campeonato de corrido: 1..N la seleccion y la
    reserva a continuacion.

    Las altas y bajas de la nomina dejan huecos -- alguien se cae y su numero
    se queda vacio -- y el que entra despues se lleva el siguiente libre, que
    puede ser el 23 con la seleccion en el 14. Esto los cierra.

    Se hace en dos pasadas, por los numeros de paso: renumerar en el sitio
    puede chocar a mitad de camino (dar el 005 a uno cuando el 005 todavia es
    de otro), y aunque el indice de dorsales no sea unico, dos corredores con
    el mismo numero durante un instante es un dorsal mal impreso esperando a
    pasar.
    """
    inscripciones = await db.registrations.find(
        {"race_code": MUNDIAL}, {"_id": 1, "bib": 1, "categoria": 1, "nombre": 1, "apellidos": 1}
    ).to_list(500)

    plan = plan_de_renumeracion(inscripciones)
    cambian = [(i, nuevo) for i, nuevo in plan if str(i.get("bib") or "") != nuevo]

    for paso, (inscripcion, _nuevo) in enumerate(cambian):
        await db.registrations.update_one(
            {"_id": inscripcion["_id"]}, {"$set": {"bib": f"TMP-{paso}"}}
        )
    ahora = datetime.now(timezone.utc)
    for inscripcion, nuevo in cambian:
        await db.registrations.update_one(
            {"_id": inscripcion["_id"]}, {"$set": {"bib": nuevo, "updated_at": ahora}}
        )

    return {
        "success": True,
        "total": len(plan),
        "cambiados": len(cambian),
        "dorsales": [
            {
                "nombre": f"{i.get('nombre', '')} {i.get('apellidos', '')}".strip(),
                "categoria": i.get("categoria") or "",
                "antes": str(i.get("bib") or ""),
                "ahora": nuevo,
            }
            for i, nuevo in plan
        ],
    }


@router.get("/admin/camisetas/export", dependencies=[solo_atletas])
async def export_camisetas(db=Depends(get_db)):
    """Desglose de camisetas de la seleccion, en CSV, para el taller.

    La talla y el nombre que va estampado no se digitan aqui: los pone el
    propio atleta, en su inscripcion al campeonato o en su perfil. Se miran
    los dos sitios, en ese orden, porque la nomina se arma antes de que el
    atleta llene nada y lo que llene despues puede quedar en cualquiera de
    los dos. Lo que siga vacio sale vacio: es justo lo que hay que reclamar.
    """
    from bson import ObjectId

    seleccionados = await db.campeonato_seleccionados.find({}, {"_id": 0}).to_list(500)

    inscripciones = await db.registrations.find(
        {"race_code": MUNDIAL},
        {
            "_id": 0, "seleccionado_id": 1, "athlete_id": 1, "email": 1,
            "sexo": 1, "talla_camiseta": 1, "personalizacion_camiseta": 1,
        },
    ).to_list(500)
    inscripcion_de = {
        i["seleccionado_id"]: i for i in inscripciones if i.get("seleccionado_id")
    }

    # Los perfiles que hagan falta, de una sola pasada
    ids, correos = [], []
    for inscripcion in inscripcion_de.values():
        if inscripcion.get("athlete_id"):
            try:
                ids.append(ObjectId(inscripcion["athlete_id"]))
            except Exception:
                pass
        correo = (inscripcion.get("email") or "").lower()
        if correo and not correo.endswith(".invalid"):
            correos.append(correo)

    atletas = []
    if ids or correos:
        atletas = await db.athletes.find(
            {"$or": [{"_id": {"$in": ids}}, {"email": {"$in": correos}}]},
            {"sexo": 1, "talla_camiseta": 1, "personalizacion_camiseta": 1, "email": 1},
        ).to_list(500)
    atleta_por_id = {str(a["_id"]): a for a in atletas}
    atleta_por_correo = {(a.get("email") or "").lower(): a for a in atletas}

    def perfil(inscripcion):
        if not inscripcion:
            return {}
        por_id = atleta_por_id.get(inscripcion.get("athlete_id") or "")
        if por_id:
            return por_id
        return atleta_por_correo.get((inscripcion.get("email") or "").lower(), {})

    filas = []
    for sel in seleccionados:
        inscripcion = inscripcion_de.get(sel.get("id")) or {}
        atleta = perfil(inscripcion)

        def dato(campo):
            for fuente in (inscripcion, atleta, sel):
                valor = (fuente.get(campo) or "").strip()
                if valor:
                    return valor
            return ""

        filas.append([
            dato("sexo"),
            dato("talla_camiseta"),
            f"{sel.get('nombre', '')} {sel.get('apellidos', '')}".strip(),
            dato("personalizacion_camiseta"),
        ])

    filas.sort(key=lambda f: f[2].lower())

    salida = io.StringIO()
    salida.write("\ufeff")  # para que Excel abra los acentos bien
    escritor = csv.writer(salida)
    escritor.writerow(["Sexo", "Talla", "Nombre completo", "Nombre en camiseta"])
    escritor.writerows(filas)
    salida.seek(0)

    return StreamingResponse(
        iter([salida.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=camisetas_seleccionados.csv"
        },
    )


@router.post("/admin", dependencies=[solo_atletas])
async def add_seleccionado(data: SeleccionadoCreate, db=Depends(get_db)):
    from bson import ObjectId

    if data.categoria not in CATEGORIAS:
        raise HTTPException(status_code=400, detail="Categoría inválida (titular o reserva)")

    try:
        obj_id = ObjectId(data.result_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Identificador de atleta inválido")

    participante = None
    for coll_name in ["archived_participants", "participants"]:
        participante = await db[coll_name].find_one({"_id": obj_id})
        if participante:
            break
    if not participante:
        raise HTTPException(status_code=404, detail="Atleta del evento previo no encontrado")

    bib = participante.get("bib")
    ya_esta = await db.campeonato_seleccionados.find_one(
        {"$or": [{"result_id": data.result_id}, {"bib": bib}]}
    )
    if ya_esta:
        raise HTTPException(status_code=400, detail="Ese atleta ya está en la selección")

    doc = {
        "id": str(uuid.uuid4()),
        "result_id": data.result_id,
        "bib": bib,
        "nombre": participante.get("nombre", ""),
        "apellidos": participante.get("apellidos", ""),
        "sexo": participante.get("sexo", ""),
        "nacionalidad": participante.get("nacionalidad", ""),
        "laps_completed": participante.get("laps_completed", 0),
        "categoria": data.categoria,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.campeonato_seleccionados.insert_one({**doc})
    inscripcion = await inscribir_en_el_mundial(db, doc)
    return {"success": True, "seleccionado": doc, "inscripcion": inscripcion}


@router.post("/admin/manual", dependencies=[solo_atletas])
async def add_seleccionado_manual(data: SeleccionadoManualCreate, db=Depends(get_db)):
    """Agrega un seleccionado externo, digitado a mano.

    Para atletas que no corrieron el evento previo y por tanto no aparecen
    entre los candidatos. Quedan marcados con externo=True y sin result_id.
    """
    if data.categoria not in CATEGORIAS:
        raise HTTPException(status_code=400, detail="Categoría inválida (titular o reserva)")

    nombre = (data.nombre or "").strip()
    apellidos = (data.apellidos or "").strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="El nombre es obligatorio")

    bib = (data.bib or "").strip() or None
    if bib:
        # El BIB, si se digita, no puede chocar con otro ya seleccionado
        if await db.campeonato_seleccionados.find_one({"bib": bib}):
            raise HTTPException(status_code=400, detail=f"Ya hay un seleccionado con el BIB {bib}")

    # Evitar duplicar a la misma persona por nombre completo
    patron = f"^{re.escape(nombre)}$"
    patron_apellidos = f"^{re.escape(apellidos)}$"
    repetido = await db.campeonato_seleccionados.find_one({
        "nombre": {"$regex": patron, "$options": "i"},
        "apellidos": {"$regex": patron_apellidos, "$options": "i"},
    })
    if repetido:
        raise HTTPException(status_code=400, detail="Ya hay un seleccionado con ese nombre")

    doc = {
        "id": str(uuid.uuid4()),
        "result_id": None,
        "externo": True,
        "bib": bib,
        "nombre": nombre,
        "apellidos": apellidos,
        "sexo": (data.sexo or "").strip(),
        "nacionalidad": (data.nacionalidad or "").strip(),
        "laps_completed": data.laps_completed or 0,
        "categoria": data.categoria,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.campeonato_seleccionados.insert_one({**doc})
    inscripcion = await inscribir_en_el_mundial(db, doc)
    return {"success": True, "seleccionado": doc, "inscripcion": inscripcion}


@router.put("/admin/{seleccionado_id}", dependencies=[solo_atletas])
async def update_seleccionado(seleccionado_id: str, data: SeleccionadoUpdate, db=Depends(get_db)):
    if data.categoria not in CATEGORIAS:
        raise HTTPException(status_code=400, detail="Categoría inválida (titular o reserva)")

    result = await db.campeonato_seleccionados.update_one(
        {"id": seleccionado_id}, {"$set": {"categoria": data.categoria}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Seleccionado no encontrado")

    await db.registrations.update_one(
        {"race_code": MUNDIAL, "seleccionado_id": seleccionado_id},
        {"$set": {"categoria": data.categoria}},
    )
    return {"success": True}


@router.delete("/admin/{seleccionado_id}", dependencies=[solo_atletas])
async def delete_seleccionado(seleccionado_id: str, db=Depends(get_db)):
    # Si ya corrio, no se le saca de la carrera desde aqui: eso borraria un
    # resultado. Primero hay que resolverlo en el control de carrera.
    inscripcion = await db.registrations.find_one(
        {"race_code": MUNDIAL, "seleccionado_id": seleccionado_id}
    )
    if inscripcion and inscripcion.get("laps_completed", 0) > 0:
        raise HTTPException(
            status_code=400,
            detail=(
                f"{inscripcion.get('nombre')} ya tiene {inscripcion['laps_completed']} "
                "vuelta(s) corridas en el campeonato. Quítalo desde el control de carrera."
            ),
        )

    result = await db.campeonato_seleccionados.delete_one({"id": seleccionado_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Seleccionado no encontrado")

    if inscripcion:
        await db.registrations.delete_one({"_id": inscripcion["_id"]})

    return {"success": True}
