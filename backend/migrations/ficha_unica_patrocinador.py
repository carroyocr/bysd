"""Funde las fichas repetidas de una marca en una sola, con sus participaciones.

Hasta hoy un patrocinador se guardaba una vez **por cada edicion**: Cedimat en
BYSD-2026 y Cedimat en BYSD-2027 eran dos documentos sin relacion, cada uno con
la razon social, el contacto y el telefono copiados a mano. En produccion eran
55 documentos para 31 marcas: 21 marcas repetidas, y como nadie sincronizaba
nada, 5 acabaron con contactos distintos y 4 con telefonos distintos entre una
edicion y otra.

Esta migracion deja **una ficha por marca** con una lista de `participaciones`,
una por carrera que patrocina.

Que se lleva cada mitad:

- **La ficha** (lo que es de la empresa): nombre, razon social, RNC, contacto y
  su posicion, telefono, correo, pagina web, descripcion, Instagram y logo.
  Cuando las ediciones no coinciden **gana la mas reciente** que traiga el dato
  -las carreras se ordenan por su fecha de inicio-, y cada desacuerdo se
  imprime al final con los dos valores para poder revisarlo.
- **La participacion** (lo que se negocia por evento): status, publicar_desde,
  categoria, monto, bitacora, los interruptores, la vigencia, el peso, el
  orden, el texto y el enlace del anuncio, el banner, la imagen ampliada y las
  metricas.

El `id` de cada participacion es el `id` del documento que habia para esa
carrera, que es con lo que la app cuenta impresiones y clics
(`POST /api/ads/track`): los contadores siguen sumando donde estaban. La ficha
estrena `id` propio, el que usan las rutas del panel.

No se borra ningun archivo de GridFS: la ficha se queda con un logo, y los de
las otras ediciones siguen ahi por si hay que volver atras. Se listan al final.

Se puede correr mas de una vez sin miedo: una marca ya fundida se salta.

    python3 backend/migrations/ficha_unica_patrocinador.py            # ensayo
    python3 backend/migrations/ficha_unica_patrocinador.py --escribir # de verdad
"""
import argparse
import asyncio
import os
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

from services import patrocinios  # noqa: E402

# Lo que es de la empresa y sube a la ficha.
CAMPOS_FICHA = ("logo_url",) + patrocinios.CAMPOS_FICHA

# Lo que es de la edicion y baja a la participacion.
CAMPOS_PARTICIPACION = (
    "id", "status", "publicar_desde", "propuesta_categoria",
    "propuesta_monto", "bitacora", "banner_url", "detail_url", "text",
    "link_url", "publicar_web", "publicar_app", "mostrar_marca", "weight",
    "start_at", "end_at", "impressions", "clicks", "created_at",
)


async def fechas_de_carreras(db) -> dict:
    """Cada `race_code` con la fecha de su carrera, para saber cual es mas nueva.

    Es `date` ("2027-01-23"), la fecha del evento. `created_at` no sirve: las
    ediciones pasadas se cargaron despues que las futuras -BYSD-2026 se creo en
    agosto de 2026, seis meses despues que BYSD-2027- y ordenar por ahi daria
    justo la vuelta.
    """
    carreras = await db.race_configurations.find({}).to_list(100)
    return {
        (c.get("code") or c.get("race_code") or "").upper(): c.get("date") or ""
        for c in carreras
        if c.get("code") or c.get("race_code")
    }


def clave_recencia(code: str, fechas: dict):
    """Con que se ordenan las ediciones de una marca, de la mas vieja a la mas nueva.

    Manda la fecha de la carrera; si esa edicion no la tiene, el propio codigo,
    que lleva el ano dentro (BYSD-2026 antes que BYSD-2027).
    """
    fecha = fechas.get(code) or ""
    return (1, fecha) if fecha else (0, code)


async def migrar(db, escribir: bool) -> None:
    docs = await db.sponsors.find({}).to_list(1000)
    viejos = [d for d in docs if not d.get("participaciones")]
    ya_fundidos = len(docs) - len(viejos)

    if not viejos:
        print(f"No hay nada que fundir: las {ya_fundidos} fichas ya tienen participaciones.")
        return

    fechas = await fechas_de_carreras(db)

    # Las ediciones de una misma marca, agrupadas por el nombre normalizado.
    por_marca = {}
    for doc in viejos:
        clave = (doc.get("name") or "").strip().lower()
        por_marca.setdefault(clave, []).append(doc)

    conflictos, logos_sueltos = [], []
    fichas = []

    for clave, ediciones in sorted(por_marca.items()):
        ediciones.sort(key=lambda d: clave_recencia((d.get("race_code") or "").upper(), fechas))
        mas_reciente = ediciones[-1]

        # La ficha: gana el valor de la edicion mas nueva que traiga el dato.
        datos = {}
        for campo in CAMPOS_FICHA:
            elegido, de_donde = None, None
            for doc in reversed(ediciones):
                valor = doc.get(campo)
                if valor not in (None, "", []):
                    elegido, de_donde = valor, (doc.get("race_code") or "").upper()
                    break
            if elegido is not None:
                datos[campo] = elegido
            # Los desacuerdos se anotan para revisarlos despues.
            vistos = {
                (doc.get("race_code") or "").upper(): doc.get(campo)
                for doc in ediciones
                if doc.get(campo) not in (None, "", [])
            }
            if campo != "logo_url" and len(set(vistos.values())) > 1:
                conflictos.append({
                    "marca": mas_reciente.get("name"),
                    "campo": campo,
                    "elegido": f"{elegido}  ({de_donde})",
                    "descartados": [f"{v}  ({k})" for k, v in vistos.items() if v != elegido],
                })
            if campo == "logo_url":
                logos_sueltos += [v for v in vistos.values() if v != elegido]

        ficha = patrocinios.nueva_ficha(
            mas_reciente.get("name"),
            id=str(uuid.uuid4()),
            is_active=any(d.get("is_active", True) for d in ediciones),
            created_at=min((d.get("created_at") for d in ediciones if d.get("created_at")), default=None),
            **datos,
        )

        for doc in ediciones:
            code = (doc.get("race_code") or "").upper()
            if not code:
                continue
            campos = {c: doc.get(c) for c in CAMPOS_PARTICIPACION if doc.get(c) is not None}
            # Una edicion retirada no debe revivir al fundirse con las demas:
            # se apaga en sus dos destinos en vez de perderse el dato.
            if doc.get("is_active") is False:
                campos["publicar_web"] = False
                campos["publicar_app"] = False
            ficha["participaciones"].append(
                patrocinios.nueva_participacion(code, order=doc.get("order") or 0, **campos)
            )

        fichas.append((ficha, [d["_id"] for d in ediciones]))

    print(f"Fichas viejas: {len(viejos)}  →  marcas: {len(fichas)}"
          f"{f' (y {ya_fundidos} ya fundidas, se saltan)' if ya_fundidos else ''}")
    for ficha, _ in fichas:
        carreras = ", ".join(p["race_code"] for p in ficha["participaciones"])
        print(f"  {ficha['name']:<38} {carreras}")

    if conflictos:
        print(f"\nDatos que no coincidian entre ediciones ({len(conflictos)}). Gana el mas reciente:")
        for c in conflictos:
            print(f"  {c['marca']} · {c['campo']}")
            print(f"      queda:    {c['elegido']}")
            for d in c["descartados"]:
                print(f"      descarta: {d}")

    if logos_sueltos:
        print(f"\nLogos que dejan de usarse ({len(logos_sueltos)}). Siguen en GridFS por si acaso:")
        for url in logos_sueltos:
            print(f"  {url}")

    if not escribir:
        print("\nEnsayo: no se escribio nada. Repite con --escribir para aplicarlo.")
        return

    for ficha, ids_viejos in fichas:
        await db.sponsors.insert_one(ficha)
        await db.sponsors.delete_many({"_id": {"$in": ids_viejos}})

    print(f"\nListo: {len(fichas)} fichas escritas, {len(viejos)} documentos viejos retirados.")


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--escribir", action="store_true", help="aplica los cambios")
    parser.add_argument("--mongo-url", default=os.environ.get("MONGO_URL"))
    args = parser.parse_args()

    if not args.mongo_url:
        print("Falta MONGO_URL (variable de entorno o --mongo-url)")
        sys.exit(1)

    client = AsyncIOMotorClient(args.mongo_url)
    db = client[os.environ.get("DB_NAME", "backyard_ultra")]
    try:
        await migrar(db, args.escribir)
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
