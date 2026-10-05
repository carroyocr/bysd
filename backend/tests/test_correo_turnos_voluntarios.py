"""El correo «tus turnos y la app» para los voluntarios.

Lo redacta la organizacion desde Enviar Correos con la plantilla
`volunteer_turnos_y_app`. Lo que estos tests protegen:

- que cada voluntario reciba **sus** turnos, con fecha, hora de inicio y hora
  de termino, y no los de otro ni una lista en blanco;
- que la fecha salga de la programacion del evento: los turnos guardan el dia
  como «dia 1, dia 2», no como fecha;
- que el correo lleve lo que tiene que llevar: las dos tiendas, el portal y la
  peticion de cancelar si no se puede ir;
- que «solo con turnos asignados» deje fuera a quien no tiene ninguno.

Con una base de usar y tirar en el Mongo local:

    backend/.venv/bin/python -m pytest tests/test_correo_turnos_voluntarios.py -v
"""
import asyncio
import os
import uuid

import pytest

os.environ.setdefault("JWT_SECRET_KEY", "clave-solo-para-tests-" + "x" * 40)
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "bysd_test_rutas")
os.environ.setdefault("EMAILS_ACTIVOS", "false")

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402
from pymongo import MongoClient  # noqa: E402
from pymongo.errors import PyMongoError  # noqa: E402

import server  # noqa: E402,F401
from routes import athletes  # noqa: E402
from routes.email_templates import DEFAULT_TEMPLATES  # noqa: E402
from services import correo_turnos  # noqa: E402
from services.template_email_service import render_template  # noqa: E402

MONGO = os.environ.get("TEST_MONGO_URL", "mongodb://localhost:27017")
ANA = "ana@correo.com"
LUIS = "luis@correo.com"
SIN_TURNO = "eva@correo.com"

PLANTILLA = next(t for t in DEFAULT_TEMPLATES if t["id"] == "volunteer_turnos_y_app")


def _hay_mongo() -> bool:
    try:
        MongoClient(MONGO, serverSelectionTimeoutMS=800).admin.command("ping")
        return True
    except PyMongoError:
        return False


con_mongo = pytest.mark.skipif(not _hay_mongo(), reason="Hace falta un Mongo local")


def correr(caso):
    async def _todo():
        cliente = AsyncIOMotorClient(MONGO)
        nombre = f"bysd_test_{uuid.uuid4().hex[:12]}"
        db = cliente[nombre]
        try:
            return await caso(db)
        finally:
            await cliente.drop_database(nombre)
            cliente.close()

    return asyncio.run(_todo())


async def _sembrar(db):
    await db.race_configurations.insert_one(
        {"code": "BYSD-2027", "name": "Backyard Ultra Santo Domingo 2027", "date": "2027-01-23",
         "is_active": True})
    await db.volunteer_event_schedules.insert_one({"evento": "campeonato", "fecha_inicio": "2026-10-17"})
    await db.volunteer_registrations.insert_many([
        {"email": ANA, "nombre": "Ana", "apellidos": "Perez", "race_code": "BYSD-2027", "evento": "campeonato"},
        {"email": ANA, "nombre": "Ana", "apellidos": "Perez", "race_code": "BYSD-2027", "evento": "carrera"},
        {"email": LUIS, "nombre": "Luis", "apellidos": "Diaz", "race_code": "BYSD-2027", "evento": "campeonato"},
        {"email": SIN_TURNO, "nombre": "Eva", "apellidos": "Sosa", "race_code": "BYSD-2027", "evento": "campeonato"},
    ])

    def turno(id_, evento, puesto, inicio, fin, dia_tipo, asignado):
        return {"id": id_, "evento": evento, "puesto": puesto, "turno": "A", "hora_inicio": inicio,
                "hora_fin": fin, "dia_tipo": dia_tipo, "email_asignado": asignado}

    await db.volunteer_assignments.insert_many([
        # Ana: dos del campeonato (se guardan desordenados) y uno de la carrera.
        turno(2, "campeonato", "Control de Vueltas", "15:00", "19:00", "carrera_dia2", ANA),
        turno(1, "campeonato", "Hidratacion", "07:00", "11:00", "carrera_dia1", ANA),
        turno(3, "carrera", "Meta", "06:00:00", "10:00:00", "carrera_dia1", ANA),
        turno(4, "campeonato", "Corral <de> salida", "11:00", "15:00", "carrera_dia1", LUIS),
        turno(5, "campeonato", "Registro", "07:00", "11:00", "carrera_dia1", None),
    ])


# ==================== La plantilla ====================


def test_la_plantilla_lleva_las_dos_tiendas_como_imagen_el_portal_y_la_cancelacion():
    html = PLANTILLA["content"]
    assert PLANTILLA["category"] == "voluntarios"
    assert "{{volunteer_turnos_asignados}}" in html

    # Las dos fichas, cada una enlazada desde su imagen.
    assert 'href="https://apps.apple.com/ar/app/bysd-live/id6802661105"' in html
    assert 'href="https://play.google.com/store/apps/details?id=com.backyardultrasd.app&amp;hl=es_DO"' in html
    assert 'src="https://backyardultrasantodomingo.com/correo/app-store.png"' in html
    assert 'src="https://backyardultrasantodomingo.com/correo/google-play.png"' in html
    # Media bandeja bloquea las imagenes: el texto alternativo dice a donde va.
    assert "App Store" in html and "Google Play" in html

    assert 'href="https://backyardultrasantodomingo.com/voluntarios"' in html
    assert "canceles tu participación" in html


def test_las_imagenes_de_las_tiendas_existen_en_el_sitio():
    """El correo las pide por su direccion publica: si faltan, sale roto."""
    from pathlib import Path

    publico = Path(__file__).resolve().parents[2] / "frontend" / "public"
    for tienda in correo_turnos.TIENDAS:
        ruta = publico / tienda["imagen"].replace(correo_turnos.SITIO + "/", "")
        assert ruta.is_file(), f"Falta {ruta}"


# ==================== Los turnos de cada uno ====================


def test_la_fecha_se_escribe_entera():
    assert correo_turnos.fecha_larga("2026-10-17") == "Sábado 17 de octubre de 2026"
    assert correo_turnos.fecha_larga("2027-01-24") == "Domingo 24 de enero de 2027"
    assert correo_turnos.fecha_larga("") == ""


def test_cada_turno_dice_fecha_puesto_hora_de_inicio_y_de_termino():
    html = correo_turnos.bloque_de_turnos([
        {"puesto": "Control de Vueltas", "dia": "2026-10-18", "hora_inicio": "15:00", "hora_fin": "19:00"},
        {"puesto": "Hidratacion", "dia": "2026-10-17", "hora_inicio": "07:00:00", "hora_fin": "11:00:00"},
    ])
    # En orden de fecha, aunque lleguen al reves.
    assert html.index("Sábado 17 de octubre de 2026") < html.index("Domingo 18 de octubre de 2026")
    assert "Hidratacion" in html and "Control de Vueltas" in html
    assert "Hora de inicio" in html and "7:00 AM" in html
    assert "Hora de término" in html and "11:00 AM" in html
    assert "3:00 PM" in html and "7:00 PM" in html
    # Con un solo evento, nombrarlo es ruido.
    assert "Evento" not in html


def test_sin_turnos_se_dice_y_no_se_deja_en_blanco():
    assert correo_turnos.bloque_de_turnos([]) == correo_turnos.SIN_TURNOS
    assert "no tienes turnos asignados" in correo_turnos.SIN_TURNOS


def test_el_nombre_del_puesto_no_puede_meter_html_en_el_correo():
    html = correo_turnos.bloque_de_turnos(
        [{"puesto": "<script>x</script>", "dia": "2026-10-17", "hora_inicio": "07:00", "hora_fin": "11:00"}])
    assert "<script>" not in html and "&lt;script&gt;" in html


@con_mongo
def test_a_cada_voluntario_sus_turnos_con_la_fecha_del_evento():
    async def caso(db):
        await _sembrar(db)
        return await correo_turnos.turnos_asignados(db, [ANA, LUIS, SIN_TURNO], "campeonato")

    turnos = correr(caso)
    assert [t["id"] for t in turnos[ANA]] == [1, 2]
    # El dia sale de la programacion del campeonato: dia 1 y dia 2.
    assert [t["dia"] for t in turnos[ANA]] == ["2026-10-17", "2026-10-18"]
    assert [t["id"] for t in turnos[LUIS]] == [4]
    assert SIN_TURNO not in turnos


@con_mongo
def test_sin_filtrar_por_evento_salen_todos_y_se_nombra_cada_evento():
    async def caso(db):
        await _sembrar(db)
        return await correo_turnos.datos_por_destinatario(db, [ANA])

    datos = correr(caso)[ANA]
    assert datos["volunteer_turnos_total"] == "3"
    html = datos["volunteer_turnos_asignados"]
    assert "Campeonato Mundial por Equipos" in html
    assert "Backyard Ultra Santo Domingo 2027" in html
    # El de la carrera cae en su propia fecha, no en la del campeonato.
    assert "Sábado 23 de enero de 2027" in html


# ==================== El redactor ====================


@con_mongo
def test_el_redactor_rellena_los_turnos_de_cada_destinatario():
    async def caso(db):
        await _sembrar(db)
        destinatarios = (await athletes._volunteer_recipients(db, "BYSD-2027", "campeonato"))["recipients"]
        destinatarios = await athletes._con_turnos_de_voluntario(
            db, destinatarios, PLANTILLA["content"], evento="campeonato")
        globales = {"race_name": "Backyard Ultra Santo Domingo 2027"}
        return {
            r["email"]: render_template(PLANTILLA["content"], athletes._template_recipient_data(globales, r))
            for r in destinatarios
        }

    correos = correr(caso)
    assert set(correos) == {ANA, LUIS, SIN_TURNO}

    assert "Hola <strong>Ana</strong>" in correos[ANA]
    assert "Hidratacion" in correos[ANA] and "Control de Vueltas" in correos[ANA]
    assert "Sábado 17 de octubre de 2026" in correos[ANA]
    # Solo los del campeonato, y ninguno de los de Luis.
    assert "Meta" not in correos[ANA] and "Corral" not in correos[ANA]

    assert "Corral &lt;de&gt; salida" in correos[LUIS]
    assert "Hidratacion" not in correos[LUIS]

    assert "no tienes turnos asignados" in correos[SIN_TURNO]
    # Nada se queda sin rellenar.
    assert all("{{" not in html for html in correos.values())


@con_mongo
def test_solo_con_turnos_asignados_deja_fuera_a_quien_no_tiene():
    async def caso(db):
        await _sembrar(db)
        todos = await athletes._volunteer_recipients(db, "BYSD-2027", "campeonato")
        asignados = await athletes._volunteer_recipients(db, "BYSD-2027", "campeonato", solo_asignados=True)
        return todos, asignados

    todos, asignados = correr(caso)
    assert todos["total"] == 3
    assert {r["email"] for r in asignados["recipients"]} == {ANA, LUIS}


@con_mongo
def test_una_prueba_enviada_a_mano_saluda_por_el_nombre_del_registro():
    """El correo escrito a mano llega sin nombre: se toma el de su registro."""
    async def caso(db):
        await _sembrar(db)
        manual = [{"email": ANA, "nombre": "", "apellidos": "", "nombre_completo": "", "source": "manual"}]
        return await athletes._con_turnos_de_voluntario(db, manual, PLANTILLA["content"])

    destinatario = correr(caso)[0]
    assert destinatario["nombre"] == "Ana"
    assert destinatario["merge_extra"]["volunteer_turnos_total"] == "3"


@con_mongo
def test_un_correo_que_no_habla_de_turnos_no_los_busca():
    async def caso(db):
        await _sembrar(db)
        destinatarios = [{"email": ANA, "nombre": "Ana"}]
        return await athletes._con_turnos_de_voluntario(db, destinatarios, "<p>Hola {{nombre}}</p>")

    assert "merge_extra" not in correr(caso)[0]
