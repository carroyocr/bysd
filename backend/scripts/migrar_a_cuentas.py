"""Fase 3: mueve corredores y equipo a la coleccion `accounts`.

Una persona que corre y ademas es voluntaria tiene hoy dos cuentas, dos
contrasenas en dos algoritmos distintos y dos huellas registradas en el
telefono. Esto las junta en una sola identidad con roles, dejando los perfiles
donde estan: `athletes` conserva todo su contenido y solo gana `account_id`.

Que `athletes` y `admin_users` queden intactas es deliberado: mientras sigan
enteras, deshacer esto es volver a desplegar el backend anterior y no una
restauracion de la base.

Por defecto **no escribe nada**: enumera lo que haria y avisa de lo que no
cuadra. Para escribir hay que pedirlo con `--aplicar`.

    # ensayo sobre una copia restaurada
    .venv/bin/python scripts/migrar_a_cuentas.py --db ensayo_migracion
    .venv/bin/python scripts/migrar_a_cuentas.py --db ensayo_migracion --aplicar

    # produccion (exige decirlo dos veces)
    .venv/bin/python scripts/migrar_a_cuentas.py --db backyard_ultra --produccion --aplicar

Es idempotente: volver a correrlo sobre una base ya migrada no duplica nada.
Ver PLAN_CUENTA_UNICA.md, fase 3.
"""
import argparse
import pathlib
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone

from pymongo import MongoClient

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

FAN, ATLETA, STAFF = "fan", "athlete", "staff"


def normalizar(valor) -> str:
    return (valor or "").strip().lower()


def correo_de_staff(doc: dict) -> str:
    """El correo con el que entra alguien del panel.

    Los voluntarios se dan de alta con su correo como `username`, pero las
    cuentas antiguas del equipo tienen un usuario corto ("admin", "geizel26") y
    el correo aparte. Se prefiere el correo y se cae al usuario, que es lo que
    hace que ninguna cuenta se quede sin identidad.
    """
    return normalizar(doc.get("email")) or normalizar(doc.get("username"))


class Migracion:
    def __init__(self, db, aplicar: bool):
        self.db = db
        self.aplicar = aplicar
        self.avisos = []
        self.contadores = Counter()
        # En seco no se escribe nada, asi que las cuentas que "crea" el paso de
        # corredores no estan en la base cuando llega el paso del equipo. Sin
        # llevar la cuenta aparte, el solape se contaria como cuenta nueva en vez
        # de como fusion, y el ensayo daria justo el numero que se quiere
        # validar: mal. Este registro simula lo ya creado.
        self.simulados = {}

    def avisar(self, texto):
        self.avisos.append(texto)

    def buscar_cuenta(self, correo):
        """La cuenta con ese correo, exista en la base o solo en el ensayo."""
        real = self.db.accounts.find_one({"email": correo})
        if real:
            return real
        return self.simulados.get(correo)

    # ---------- 1. Revision previa ----------

    def revisar(self):
        """Todo lo que podria salir mal, antes de escribir una sola linea."""
        print("\n" + "=" * 70)
        print("1. REVISION PREVIA")
        print("=" * 70)

        atletas = list(self.db.athletes.find({}, {"email": 1, "password_hash": 1,
                                                  "nombre": 1, "apellidos": 1,
                                                  "email_verified": 1}))
        staff = list(self.db.admin_users.find({}))

        # Correos repetidos dentro de cada coleccion: el indice unico de
        # `accounts` los rechazaria a mitad de la migracion.
        por_correo = defaultdict(list)
        for a in atletas:
            por_correo[normalizar(a.get("email"))].append(a["_id"])

        sin_correo = [a["_id"] for a in atletas if not normalizar(a.get("email"))]
        repetidos = {c: ids for c, ids in por_correo.items() if c and len(ids) > 1}

        print(f"  atletas ....................... {len(atletas)}")
        print(f"    sin correo .................. {len(sin_correo)}")
        print(f"    correos repetidos ........... {len(repetidos)}")
        for c, ids in repetidos.items():
            self.avisar(f"Correo repetido en athletes: {c} ({len(ids)} documentos)")

        sin_hash = [a["_id"] for a in atletas if not a.get("password_hash")]
        if sin_hash:
            self.avisar(f"{len(sin_hash)} atletas sin password_hash: no podran entrar")

        por_usuario = defaultdict(list)
        for u in staff:
            por_usuario[correo_de_staff(u)].append(u["_id"])
        staff_repetido = {c: ids for c, ids in por_usuario.items() if len(ids) > 1}

        print(f"  usuarios de panel ............. {len(staff)}")
        print(f"    identidades repetidas ....... {len(staff_repetido)}")
        for c, ids in staff_repetido.items():
            self.avisar(
                f"Usuario de panel duplicado: '{c}' ({len(ids)} documentos). "
                "Se migra el primero y se ignoran los demas."
            )

        no_son_correo = [c for c in por_usuario if c and "@" not in c]
        for c in no_son_correo:
            self.avisar(
                f"El usuario de panel '{c}' no es un correo. Se le crea cuenta con "
                "ese identificador; el login del panel debe seguir aceptando el usuario."
            )

        solape = {c for c in por_correo if c} & {c for c in por_usuario if c}
        print(f"  personas en las dos ........... {len(solape)}")
        for c in sorted(solape):
            self.avisar(
                f"SOLAPE: '{c}' esta en athletes y en admin_users con contrasenas "
                "distintas. Se conserva la del corredor; la del panel queda guardada "
                "en `password_hash_staff_legacy` y hay que resolverla a mano."
            )

        self.atletas = atletas
        self.staff = staff
        self.solape = solape
        return not repetidos  # los repetidos si bloquean

    # ---------- 2. Migracion ----------

    def _crear(self, doc):
        if self.aplicar:
            doc["_id"] = self.db.accounts.insert_one(doc).inserted_id
        else:
            doc.setdefault("_id", f"simulada:{doc['email']}")
        self.simulados[doc["email"]] = doc
        return doc["_id"]

    def migrar_atletas(self):
        print("\n" + "=" * 70)
        print("2. CORREDORES -> accounts")
        print("=" * 70)

        for a in self.atletas:
            correo = normalizar(a.get("email"))
            if not correo:
                self.contadores["atleta_sin_correo"] += 1
                continue

            ya = self.buscar_cuenta(correo)
            if ya:
                # Idempotencia: si ya tiene cuenta, solo se asegura el rol.
                if ATLETA not in (ya.get("roles") or []) and self.aplicar:
                    self.db.accounts.update_one(
                        {"_id": ya["_id"]},
                        {"$addToSet": {"roles": ATLETA},
                         "$set": {"athlete_profile_id": a["_id"]}},
                    )
                self.contadores["atleta_ya_estaba"] += 1
                cuenta_id = ya["_id"]
            else:
                ahora = datetime.now(timezone.utc)
                cuenta_id = self._crear({
                    "email": correo,
                    # El hash PBKDF2 viaja tal cual: `cuentas.verificar_password`
                    # lo reconoce y lo reescribe en bcrypt en el primer acceso.
                    "password_hash": a.get("password_hash"),
                    "nombre": a.get("nombre") or "",
                    "apellidos": a.get("apellidos") or "",
                    "roles": [FAN, ATLETA],
                    "permissions": [],
                    "is_admin": False,
                    "email_verified": bool(a.get("email_verified")),
                    "athlete_profile_id": a["_id"],
                    "followed": [],
                    "acepta_comunicaciones": False,
                    "created_at": ahora,
                    "updated_at": ahora,
                    "last_login_at": None,
                })
                self.contadores["atleta_creado"] += 1

            if self.aplicar and cuenta_id:
                self.db.athletes.update_one({"_id": a["_id"]}, {"$set": {"account_id": cuenta_id}})

        print(f"  cuentas nuevas ................ {self.contadores['atleta_creado']}")
        print(f"  ya tenian cuenta .............. {self.contadores['atleta_ya_estaba']}")
        print(f"  sin correo (se saltan) ........ {self.contadores['atleta_sin_correo']}")

    def migrar_staff(self):
        print("\n" + "=" * 70)
        print("3. EQUIPO -> accounts")
        print("=" * 70)

        vistos = set()
        for u in self.staff:
            correo = correo_de_staff(u)
            if not correo:
                self.contadores["staff_sin_identidad"] += 1
                continue
            if correo in vistos:
                self.contadores["staff_duplicado_ignorado"] += 1
                continue
            vistos.add(correo)

            permisos = list(u.get("permissions") or [])
            es_admin = normalizar(u.get("username")) == "admin"

            ya = self.buscar_cuenta(correo)
            if ya:
                # La misma persona que ya vino por athletes: gana el rol, no
                # una segunda cuenta. Esto es todo el objetivo del proyecto.
                cambios = {
                    "$addToSet": {"roles": STAFF},
                    "$set": {
                        "permissions": permisos,
                        "is_admin": es_admin,
                        "staff_username": u.get("username"),
                        "updated_at": datetime.now(timezone.utc),
                    },
                }
                if correo in self.solape:
                    cambios["$set"]["password_hash_staff_legacy"] = u.get("password")
                if self.aplicar:
                    self.db.accounts.update_one({"_id": ya["_id"]}, cambios)
                self.contadores["staff_fusionado"] += 1
            else:
                ahora = datetime.now(timezone.utc)
                self._crear({
                    "email": correo,
                    "password_hash": u.get("password"),   # bcrypt, ya en formato bueno
                    "nombre": u.get("nombre") or "",
                    "apellidos": "",
                    "roles": [FAN, STAFF],
                    "permissions": permisos,
                    "is_admin": es_admin,
                    "email_verified": False,
                    "athlete_profile_id": None,
                    "staff_username": u.get("username"),
                    "followed": [],
                    "acepta_comunicaciones": False,
                    "created_at": ahora,
                    "updated_at": ahora,
                    "last_login_at": None,
                })
                self.contadores["staff_creado"] += 1

        print(f"  cuentas nuevas ................ {self.contadores['staff_creado']}")
        print(f"  fusionados con un corredor .... {self.contadores['staff_fusionado']}")
        print(f"  duplicados ignorados .......... {self.contadores['staff_duplicado_ignorado']}")

    def enlazar_dispositivos(self):
        """Los telefonos pasan de llevar dos correos a llevar una cuenta."""
        print("\n" + "=" * 70)
        print("4. push_devices -> account_id")
        print("=" * 70)

        for d in self.db.push_devices.find({}):
            correo = normalizar(d.get("athlete_email")) or normalizar(d.get("staff_email"))
            if not correo:
                self.contadores["dispositivo_sin_cuenta"] += 1
                continue
            cuenta = self.buscar_cuenta(correo)
            if not cuenta:
                self.contadores["dispositivo_sin_pareja"] += 1
                continue
            if self.aplicar:
                self.db.push_devices.update_one(
                    {"_id": d["_id"]}, {"$set": {"account_id": cuenta["_id"]}}
                )
            self.contadores["dispositivo_enlazado"] += 1

        print(f"  enlazados ..................... {self.contadores['dispositivo_enlazado']}")
        print(f"  sin cuenta en el aparato ...... {self.contadores['dispositivo_sin_cuenta']}")
        print(f"  con correo sin pareja ......... {self.contadores['dispositivo_sin_pareja']}")

        # Los animos no se pueden enlazar: solo guardan `fan_name`, texto libre.
        # Atarlos por nombre daria falsos positivos, y un falso positivo aqui es
        # atribuirle a alguien un mensaje que no escribio.
        print("\n  (los animos antiguos no se enlazan: solo tienen nombre escrito a mano)")

    # ---------- 3. Comprobacion ----------

    def comprobar(self):
        print("\n" + "=" * 70)
        print("5. COMPROBACION")
        print("=" * 70)

        if not self.aplicar:
            print("  (ensayo en seco: no hay nada que comprobar todavia)")
            return True

        bien = True
        total = self.db.accounts.count_documents({})
        correos = self.db.accounts.distinct("email")
        print(f"  cuentas ....................... {total}")

        if total != len(correos):
            print(f"  FALLA: hay correos repetidos ({total} cuentas, {len(correos)} correos)")
            bien = False

        con_atleta = self.db.accounts.count_documents({"roles": ATLETA})
        con_staff = self.db.accounts.count_documents({"roles": STAFF})
        ambos = self.db.accounts.count_documents({"roles": {"$all": [ATLETA, STAFF]}})
        print(f"    con rol de corredor ......... {con_atleta}")
        print(f"    con rol de equipo ........... {con_staff}")
        print(f"    con los dos ................. {ambos}")

        atletas_con_correo = len([a for a in self.atletas if normalizar(a.get("email"))])
        if con_atleta != atletas_con_correo:
            print(f"  FALLA: {atletas_con_correo} corredores con correo pero {con_atleta} cuentas")
            bien = False

        sin_enlazar = self.db.athletes.count_documents({"account_id": {"$exists": False},
                                                        "email": {"$nin": [None, ""]}})
        if sin_enlazar:
            print(f"  FALLA: {sin_enlazar} atletas se quedaron sin account_id")
            bien = False

        sin_hash = self.db.accounts.count_documents({"password_hash": {"$in": [None, ""]}})
        if sin_hash:
            print(f"  AVISO: {sin_hash} cuentas sin contrasena (no podran entrar)")

        formatos = Counter()
        for c in self.db.accounts.find({}, {"password_hash": 1}):
            h = c.get("password_hash") or ""
            formatos["bcrypt" if h.startswith("$2") else ("pbkdf2" if ":" in h else "otro")] += 1
        print(f"  formatos de contrasena ........ {dict(formatos)}")
        print("    (los pbkdf2 se reescriben en bcrypt segun entre cada persona)")

        return bien


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--db", required=True, help="Base sobre la que trabajar")
    p.add_argument("--uri", default="mongodb://localhost:27017")
    p.add_argument("--aplicar", action="store_true", help="Escribir de verdad")
    p.add_argument("--produccion", action="store_true",
                   help="Obligatorio para tocar backyard_ultra")
    args = p.parse_args()

    if args.db == "backyard_ultra" and not args.produccion:
        sys.exit("Para tocar produccion hay que pasar tambien --produccion.")

    db = MongoClient(args.uri, serverSelectionTimeoutMS=20000).get_database(args.db)

    modo = "APLICANDO CAMBIOS" if args.aplicar else "ENSAYO EN SECO (no escribe nada)"
    print(f"\nBase: {args.db}    Modo: {modo}")

    m = Migracion(db, args.aplicar)
    if not m.revisar():
        print("\nHay correos repetidos: eso rompe el indice unico. Resuelvelos antes.")
        sys.exit(1)

    m.migrar_atletas()
    m.migrar_staff()
    m.enlazar_dispositivos()
    bien = m.comprobar()

    if m.avisos:
        print("\n" + "=" * 70)
        print("AVISOS (nada de esto detiene la migracion, pero hay que mirarlo)")
        print("=" * 70)
        for a in m.avisos:
            print(f"  - {a}")

    print()
    if not args.aplicar:
        print("Ensayo terminado. Nada se escribio. Repite con --aplicar cuando cuadre.")
    else:
        print("Migracion aplicada." if bien else "Migracion aplicada CON FALLOS: revisalos.")
    sys.exit(0 if bien else 1)


if __name__ == "__main__":
    main()
