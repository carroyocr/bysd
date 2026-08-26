#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Comprueba la lista de relojes de los dos manifest contra el SDK.

La lista de dispositivos es la parte del proyecto que envejece sola, y falla
en silencio de tres maneras distintas:

  1. Un id mal escrito no rompe la compilacion: monkeyc suelta un WARNING y
     deja al reloj fuera.
  2. Un reloj sin linea de icono se lleva el de 65 px escalado por Garmin, que
     es justo lo que este proyecto evita generando un PNG por talla.
  3. Una linea de dispositivo REEMPLAZA a la regla de familia del jungle, asi
     que si lleva icono pero no repite el emblema, el reloj se queda con el
     de 240 px aunque su pantalla sea de 454.

Las tres se ven aqui en un segundo, y ninguna se ve compilando.

    python3 tools/verificar_dispositivos.py

Sale con codigo 1 si hay algo que arreglar, para poder colgarlo de un hook.
"""

import json
import os
import re
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEVICES = os.path.expanduser(
    "~/Library/Application Support/Garmin/ConnectIQ/Devices")

# El emblema va por familia de pantalla, no por modelo. Las familias que no
# estan aqui se llevan el emblema base de 240 px, que es el de resources/.
EMBLEMA = {
    "round-218x218": "resources-small",
    "semioctagon-176x176": "resources-small",
    "round-390x390": "resources-large",
    "round-416x416": "resources-large",
    "round-454x454": "resources-large",
}

# El tamano del icono del lanzador va por dispositivo y no correlaciona con la
# pantalla. El de 65 px es el de shared/resources, asi que esos no llevan linea.
ICONO_POR_DEFECTO = (65, 65)


def productos(proyecto):
    ruta = os.path.join(RAIZ, proyecto, "manifest.xml")
    with open(ruta, encoding="utf-8") as f:
        return re.findall(r'<iq:product id="([^"]+)"/>', f.read())


def reglas(proyecto):
    ruta = os.path.join(RAIZ, proyecto, "monkey.jungle")
    salida = {}
    with open(ruta, encoding="utf-8") as f:
        for linea in f:
            m = re.match(r"^([a-z0-9_]+)\.resourcePath\s*=\s*(.+)$", linea.strip())
            if m:
                salida[m.group(1)] = m.group(2)
    return salida


def revisar(proyecto):
    fallos = []
    regla_de = reglas(proyecto)
    lista = productos(proyecto)
    for id_reloj in lista:
        perfil = os.path.join(DEVICES, id_reloj, "compiler.json")
        if not os.path.exists(perfil):
            fallos.append("%s: no existe en el SDK (id mal escrito, o falta "
                          "descargarlo en el SdkManager)" % id_reloj)
            continue
        with open(perfil, encoding="utf-8") as f:
            j = json.load(f)
        icono = j["launcherIcon"]
        w, h = icono["width"], icono["height"]
        regla = regla_de.get(id_reloj, "")
        carpeta = ("resources-icon%d" % w if w == h
                   else "resources-icon%dx%d" % (w, h))

        if (w, h) == ICONO_POR_DEFECTO:
            if "resources-icon" in regla:
                fallos.append("%s: pide 65x65, que es el icono de "
                              "shared/resources; sobra la linea de icono"
                              % id_reloj)
        elif carpeta not in regla:
            fallos.append("%s: pide un icono de %dx%d y su regla es %s"
                          % (id_reloj, w, h, regla or "(ninguna: se lleva el "
                             "de 65 px escalado por Garmin)"))
        elif not os.path.isdir(os.path.join(RAIZ, "shared", carpeta)):
            fallos.append("%s: apunta a shared/%s, que no existe"
                          % (id_reloj, carpeta))

        # El emblema solo esta en la app: el campo de datos no lo lleva.
        if proyecto == "app" and regla:
            debe = EMBLEMA.get(j["deviceFamily"])
            if debe and debe not in regla:
                fallos.append("%s: la linea de dispositivo pisa la regla de "
                              "familia y no repite %s, asi que se queda sin "
                              "su emblema" % (id_reloj, debe))
            if not debe and ("resources-small" in regla
                             or "resources-large" in regla):
                fallos.append("%s: lleva un emblema que no le toca (familia "
                              "%s)" % (id_reloj, j["deviceFamily"]))
    return lista, fallos


def main():
    if not os.path.isdir(DEVICES):
        print("No encuentro los perfiles de dispositivo en:\n  %s\n"
              "Abre SdkManager.app y descargalos en la pestana Devices."
              % DEVICES)
        return 1
    total = 0
    todos = []
    for proyecto in ("app", "datafield"):
        lista, fallos = revisar(proyecto)
        print("%-10s %3d relojes declarados, %d fallos"
              % (proyecto, len(lista), len(fallos)))
        total += len(fallos)
        todos.extend("  [%s] %s" % (proyecto, f) for f in fallos)
    if todos:
        print()
        print("\n".join(todos))
        return 1
    print("\nTodos apuntan al icono de su talla y al emblema de su familia.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
