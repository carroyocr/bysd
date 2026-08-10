#!/usr/bin/env python3
"""Mete los patrocinadores de BYSD-2026 en la base, con sus logos.

Los 23 patrocinadores de la primera edicion nunca estuvieron en la base: vivian
escritos a mano en frontend/src/content/legacySponsors.js, con los logos en
frontend/public/sponsors/. Por eso el panel no los mostraba y no habia forma de
decidir cuales se invitan a las ediciones siguientes.

Este script los inserta como patrocinadores de verdad (race_code BYSD-2026) y
sube cada logo a GridFS, que es donde viven los archivos subidos. Se puede
correr las veces que haga falta: los que ya estan no se tocan ni se duplican.

Quedan en status "pago" porque fueron patrocinios cumplidos, y con
publicar_desde "cierre", que es lo que los mantiene publicados en la pagina de
la edicion 2026 tal como se ve hoy.

Uso:
    # 1. Respaldo primero (obligatorio antes de --aplicar)
    mongodump --uri "$(cat ~/Proyectos/bysd-secretos/atlas_propio_url.txt)" \\
        --collection sponsors --db backyard_ultra --out respaldo/

    # 2. Ver que se haria, sin escribir nada
    MONGO_URL="$(cat ~/Proyectos/bysd-secretos/atlas_propio_url.txt)" \\
        DB_NAME=backyard_ultra python scripts/importar_patrocinadores_2026.py

    # 3. Aplicar
    MONGO_URL="$(cat ~/Proyectos/bysd-secretos/atlas_propio_url.txt)" \\
        DB_NAME=backyard_ultra python scripts/importar_patrocinadores_2026.py --aplicar
"""
import argparse
import mimetypes
import os
import re
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

from gridfs import GridFSBucket
from pymongo import MongoClient

RACE_CODE = "BYSD-2026"
LOGOS_DIR = Path(__file__).resolve().parents[2] / "frontend" / "public" / "sponsors"

# Copiados tal cual de legacySponsors.js. El nombre del logo es el archivo que
# esta en frontend/public/sponsors/.
PATROCINADORES = [
    ("AFP Atlántico",
     "Referente en administración de fondos de pensiones, destacándose por su enfoque en planificación financiera y bienestar a largo plazo.",
     "https://www.instagram.com/afpatlantico/", "afp-atlantico.png"),
    ("AGESS",
     "Empresa de logística en la República Dominicana especializada en servicios de envío, logística e importación, ofreciendo soluciones eficientes y confiables para el manejo de paquetes y carga.",
     "https://www.instagram.com/agesscorp/", "agess.png"),
    ("Águila Logistics",
     "Especialistas en soluciones logísticas, reconocidos por su eficiencia y confiabilidad en operaciones de alta exigencia.",
     "https://www.instagram.com/aguilalogisticsrd/", "aguila-logistics.png"),
    ("Banco Atlántico",
     "Institución financiera líder, con una trayectoria sólida apoyando el desarrollo económico, social y deportivo del país.",
     "https://www.instagram.com/banco_atlantico/", "banco-atlantico.png"),
    ("Banderas del Mundo, S.R.L.",
     "Empresa dedicada a la fabricación y comercialización de banderas, mástiles y artículos institucionales, reconocida por ofrecer productos de calidad en el mercado dominicano.",
     "https://www.instagram.com/banderasdelmundosrl/", "banderas.png"),
    ("Café Santo Domingo",
     "Marca emblemática de la República Dominicana, reconocida por la calidad de su café y su compromiso con la tradición cafetera, acompañando a generaciones con productos que reflejan identidad, sabor y orgullo nacional.",
     "https://www.instagram.com/cafesantodomingo/", "cafe-santo-domingo.png"),
    ("Centro de Terapia Física y Rehabilitación Dra. Vilma Arias",
     "Centro especializado en terapia física y rehabilitación, reconocido por ofrecer servicios profesionales orientados a la recuperación funcional, el manejo del dolor y la mejora del rendimiento físico, posicionándose como una referencia en su área en la República Dominicana.",
     "https://www.instagram.com/rehabilitaciondrarias/", "dra-vilma-arias.png"),
    ("Ciclón",
     "Bebida energetizante reconocida por acompañar el rendimiento físico en contextos de alta demanda deportiva.",
     "https://www.instagram.com/ciclonrd/", "ciclon.png"),
    ("El Catador",
     "Referente en vinos y destilados en la República Dominicana, reconocido por su curaduría especializada y su compromiso con la calidad, ofreciendo experiencias que combinan tradición, conocimiento y buen gusto.",
     "https://www.instagram.com/loscatadores/", "el-catador.png"),
    ("En la Montaña Podcast",
     "Podcast enfocado en la vida outdoor y las experiencias en la montaña, compartiendo historias, rutas y aventuras que inspiran a conectar con la naturaleza y el trail running.",
     "https://www.instagram.com/enla.montanapodcast/", "en-la-montana-podcast.png"),
    ("Fiduciaria Reservas",
     "Entidad fiduciaria del Grupo Reservas, especializada en la administración de fideicomisos, ofreciendo soluciones transparentes y seguras para la gestión eficiente de recursos y el desarrollo de proyectos públicos y privados.",
     "https://www.instagram.com/fidureservas/", "fiduciaria-reservas.png"),
    ("Gatorade",
     "Marca líder mundial en hidratación deportiva, ampliamente asociada al alto rendimiento y la resistencia.",
     "https://www.instagram.com/gatoraderd/", "gatorade.png"),
    ("General de Seguros",
     "Aseguradora de referencia, enfocada en protección y prevención, clave para la seguridad de eventos deportivos.",
     "https://www.instagram.com/generaldeseguros/", "general-seguros.png"),
    ("Lupa Graph",
     "Estudio creativo de alto nivel, reconocido por su capacidad para construir identidades visuales sólidas y comunicación efectiva.",
     "https://www.instagram.com/lupa_graph/", "lupa-graph.png"),
    ("Max Sport Uniforms",
     "Especialistas en indumentaria deportiva, destacados por combinar rendimiento, comodidad e identidad de marca.",
     "https://www.instagram.com/max_sportuniforms/", "max-sport.png"),
    ("Michelob Ultra",
     "Cerveza premium enfocada en un estilo de vida activo, reconocida por su perfil ligero y refrescante, ideal para quienes buscan equilibrio entre rendimiento, bienestar y disfrute.",
     "https://www.instagram.com/michelobultradom/", "michelob-ultra.png"),
    ("Molino del Sol",
     "Marca referente en alimentos, alineada con nutrición, energía y bienestar para un estilo de vida activo.",
     "https://www.instagram.com/molinodelsolrd/", "molino-del-sol.png"),
    ("Panaca",
     "Parque temático agropecuario en Punta Cana que celebra la cultura, naturaleza y vida rural con experiencias interactivas, espectáculos ecuestres y rutas educativas que conectan visitantes con el campo dominicano.",
     "https://www.instagram.com/panacapuntacana/", "panaca.png"),
    ("Pico Diego de Ocampo Trail",
     "Evento Deportivo de Trail Running. 🎖️5K- 9K - 21k y 5K Kids 🇩🇴 ⛰️Montaña más alta de la Cordillera Septentrional.",
     "https://www.instagram.com/picodiegodeocampotrail1/", "pico-diego-ocampo.png"),
    ("Senderitmo",
     "Comunidad líder en trail running, reconocida por impulsar el crecimiento del deporte y la conexión con la naturaleza.",
     "https://www.instagram.com/senderitmo/", "senderitmo.png"),
    ("Simpex",
     "Empresa destacada por traer al mercado dominicano una variada gama de productos de la más alta calidad, ampliando el acceso del consumidor a marcas confiables.",
     "https://www.instagram.com/simpexrd/", "en-simpex.png"),
    ("Suzuki",
     "Suzuki es una marca reconocida por ofrecer al mercado dominicano vehículos confiables, versátiles y de alto desempeño, alineados con un estilo de vida activo y aventurero, respaldando iniciativas que promueven el deporte y la superación personal.",
     "https://www.instagram.com/suzukird/", "suzuki.png"),
    ("Vida Sana Vida Ultra Sports Club",
     "Club referente en ultra resistencia, promotor del alto rendimiento y la vida saludable en la República Dominicana.",
     "https://www.instagram.com/vidasanavidaultra/", "vida-sana-ultra.png"),
]


def logo_filename(race_code: str, sponsor_name: str, ext: str = "png") -> str:
    """Mismo nombre que le pone el panel al subir un logo (routes/sponsors.py)."""
    safe_name = unicodedata.normalize("NFKD", sponsor_name.lower())
    safe_name = safe_name.encode("ascii", "ignore").decode("ascii")
    safe_name = re.sub(r"[^a-z0-9\-]", "-", safe_name)
    safe_name = re.sub(r"-+", "-", safe_name).strip("-")
    return f"{race_code.upper()}_{safe_name}.{ext}"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--aplicar", action="store_true", help="escribe en la base (sin esto solo informa)")
    args = parser.parse_args()

    mongo_url = os.getenv("MONGO_URL")
    db_name = os.getenv("DB_NAME")
    if not mongo_url or not db_name:
        sys.exit("Faltan MONGO_URL y/o DB_NAME")

    db = MongoClient(mongo_url)[db_name]
    bucket = GridFSBucket(db, bucket_name="uploads")

    faltan_logos = [f for _, _, _, f in PATROCINADORES if not (LOGOS_DIR / f).is_file()]
    if faltan_logos:
        sys.exit(f"No encuentro estos logos en {LOGOS_DIR}: {', '.join(faltan_logos)}")

    nuevos, existentes = [], []
    for name, _, _, _ in PATROCINADORES:
        if db.sponsors.find_one({"name": name, "race_code": RACE_CODE}):
            existentes.append(name)
        else:
            nuevos.append(name)

    print(f"Base: {db_name} · carrera {RACE_CODE}")
    print(f"  ya estaban: {len(existentes)}")
    print(f"  se insertan: {len(nuevos)}")
    for name in nuevos:
        print(f"    + {name}")

    if not args.aplicar:
        print("\nSimulación. Repite con --aplicar para escribir.")
        return

    if not nuevos:
        print("\nNo hay nada que insertar.")
        return

    ahora = datetime.now(timezone.utc)
    insertados = 0

    # El orden es el alfabetico en que se muestran en la pagina
    for orden, (name, description, instagram, logo) in enumerate(PATROCINADORES, start=1):
        if name in existentes:
            continue

        ruta = LOGOS_DIR / logo
        ext = ruta.suffix.lstrip(".") or "png"
        destino = logo_filename(RACE_CODE, name, ext)
        content_type = mimetypes.guess_type(destino)[0] or "image/png"

        # Sin duplicar revisiones si el archivo ya estaba de una corrida previa
        for viejo in bucket.find({"filename": destino}):
            bucket.delete(viejo._id)
        bucket.upload_from_stream(
            destino,
            ruta.read_bytes(),
            metadata={"folder": "sponsors", "content_type": content_type},
        )

        db.sponsors.insert_one({
            "name": name,
            "description": description,
            "instagram": instagram,
            "race_code": RACE_CODE,
            "order": orden,
            "logo_url": f"/api/uploads/sponsors/{destino}",
            "is_active": True,
            "razon_social": "",
            "rnc": "",
            "nombre_contacto": "",
            "posicion_contacto": "",
            "telefono": "",
            "correo": "",
            "pagina_web": "",
            "propuesta_categoria": "",
            "propuesta_monto": None,
            "status": "pago",
            "publicar_desde": "cierre",
            "bitacora": [{
                "id": f"import-2026-{orden}",
                "fecha": ahora.isoformat(),
                "nota": "Patrocinador de la edición 2026, incorporado al panel.",
                "tipo": "status",
            }],
            "created_at": ahora,
            "updated_at": ahora,
        })
        insertados += 1
        print(f"  ✓ {name}")

    print(f"\nListo: {insertados} patrocinador(es) insertados en {RACE_CODE}.")


if __name__ == "__main__":
    main()
