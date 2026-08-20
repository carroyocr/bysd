#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Genera los strings.xml de todos los idiomas desde una sola tabla.

Las traducciones viven aqui, juntas y en columnas, y no repartidas en seis
archivos XML. Es lo unico que garantiza que no se quede una clave a medias: si
falta una casilla, este script no escribe nada y avisa.

    python3 tools/generar_strings.py

Al final imprime la etiqueta mas larga de cada clave. Ese listado es la lista
de lo que hay que mirar en el simulador: en una esfera de 208 pixeles el
diseno lo decide la traduccion mas larga, nunca el espanol.
"""
import os
import sys
from xml.sax.saxutils import escape

# Codigos de tres letras del SDK de Connect IQ. El primero es el respaldo: es
# lo que ve un reloj configurado en un idioma que la app no trae.
IDIOMAS = ["eng", "spa", "fre", "deu", "ita", "por"]

# Cuantos caracteres caben comodos en una etiqueta pequena del reloj mas
# pequeno que soportamos (208 px). Por encima de esto, a probar a mano.
LARGO_COMODO = 18

TABLA = {
    #                     eng                       spa                    fre                     deu                      ita                     por
    "appName":          ("Backyard",                "Backyard",            "Backyard",             "Backyard",              "Backyard",             "Backyard"),
    # El nombre del campo de datos, tal y como sale en la lista donde el
    # corredor elige que poner en cada hueco de su pantalla de carrera.
    "fieldName":        ("Backyard Margin",         "Backyard Margen",     "Backyard Marge",       "Backyard Puffer",       "Backyard Margine",     "Backyard Margem"),
    "lap":              ("Lap",                     "Vuelta",              "Tour",                 "Runde",                 "Giro",                 "Volta"),
    "nextStart":        ("Next start",              "Próxima salida",      "Prochain départ",      "Nächster Start",        "Prossima partenza",    "Próxima partida"),
    "beforeStart":      ("For lap 1",               "Para la vuelta 1",    "Pour le tour 1",       "Für Runde 1",           "Per il giro 1",        "Para a volta 1"),
    # Corral, yard y DNF ya son las palabras del deporte en todos los idiomas.
    # Traducirlas confunde mas de lo que ayuda.
    "corral":           ("Corral",                  "Corral",              "Corral",               "Corral",                "Corral",               "Corral"),
    "toTheLine":        ("To the line",             "A la línea",          "Sur la ligne",         "An die Linie",          "In linea",             "Para a linha"),
    "rest":             ("Rest",                    "De descanso",         "De repos",             "Pause",                 "Di riposo",            "De descanso"),
    "paceTooSlow":      ("Pace too slow",           "Ritmo insuficiente",  "Rythme insuffisant",   "Tempo zu langsam",      "Ritmo insufficiente",  "Ritmo insuficiente"),
    "laps":             ("Laps",                    "Vueltas",             "Tours",                "Runden",                "Giri",                 "Voltas"),
    # Sin actividad grabando no hay cronometro del que colgar la carrera, y
    # esta app no tiene otro: se dice y no se inventa una cuenta atras.
    "noActivity":       ("No activity",             "Sin actividad",       "Pas d'activité",       "Keine Aktivität",       "Nessuna attività",     "Sem atividade"),
    "battery":          ("Battery",                 "Batería",             "Batterie",             "Akku",                  "Batteria",             "Bateria"),

    # Los rotulos de cabecera y las lineas de contexto de los bocetos del 20
    # de agosto: cada pagina se presenta, y la de vuelta dice que se esta
    # haciendo ("Vuelta 7 · corriendo" / "· De descanso").
    "running":          ("running",                 "corriendo",           "en course",            "läuft",                 "in corsa",             "correndo"),
    "margin":           ("Margin",                  "Margen",              "Marge",                "Puffer",                "Margine",              "Margem"),
    # "Faltan 2.4 km ≈ 14:36": la palabra va delante en los seis idiomas.
    "toGo":             ("To go",                   "Faltan",              "Reste",                "Noch",                  "Mancano",              "Faltam"),
    "total":            ("Total",                   "Total",               "Total",                "Gesamt",                "Totale",               "Total"),
    "lapsDone":         ("laps done",               "vueltas completadas", "tours bouclés",        "Runden geschafft",      "giri completati",      "voltas completas"),
    "clock":            ("Clock",                   "Reloj",               "Heure",                "Uhr",                   "Ora",                  "Hora"),


    # La linea de salida y el menu de terminar. Los del menu y el dialogo los
    # envuelve el sistema; los de la esfera son cortos.
    "pressStart":       ("START to begin",          "START para salir",    "START pour partir",    "START zum Start",       "START per partire",    "START para largar"),
    "gpsReady":         ("GPS ready",               "GPS listo",           "GPS prêt",             "GPS bereit",            "GPS pronto",           "GPS pronto"),
    "gpsWait":          ("Searching GPS",           "Buscando GPS",        "Recherche GPS",        "GPS-Suche",             "Ricerca GPS",          "Procurando GPS"),
    "endTitle":         ("Finish?",                 "¿Terminar?",          "Terminer ?",           "Beenden?",              "Terminare?",           "Terminar?"),
    "resume":           ("Resume",                  "Reanudar",            "Reprendre",            "Weiter",                "Riprendi",             "Retomar"),
    "save":             ("Save",                    "Guardar",             "Enregistrer",          "Speichern",             "Salva",                "Guardar"),
    "discard":          ("Discard",                 "Descartar",           "Supprimer",            "Verwerfen",             "Scarta",               "Descartar"),
    "discardSure":      ("Discard the race?",       "¿Descartar la carrera?","Supprimer la course ?","Rennen verwerfen?",   "Scartare la gara?",    "Descartar a prova?"),

    # Ajustes: se leen en el telefono, no en el reloj, asi que aqui el largo
    # no aprieta.
    "settingLapMinutes":("Lap duration (minutes)",  "Vuelta (minutos)",    "Tour (minutes)",       "Runde (Minuten)",       "Giro (minuti)",        "Volta (minutos)"),
    # En kilometros siempre, y la etiqueta lo dice. Es la unica asimetria con
    # el dibujo, que si obedece a la unidad del reloj: un ajuste que cambiara
    # de unidad no podria tener un valor por defecto correcto para todos.
    "settingLapDistance":("Lap distance (km)",      "Vuelta (km)",         "Tour (km)",            "Rundenlänge (km)",      "Giro (km)",            "Volta (km)"),
    "settingCorral":    ("Corral alert",            "Aviso de corral",     "Alerte corral",        "Corral-Warnung",        "Avviso corral",        "Aviso de corral"),
    # La vuelta automatica: marcar al llegar al punto de salida, sin boton.
    "settingAutoLap":   ("Auto lap at start point", "Vuelta auto en la salida","Tour auto au départ","Auto-Runde am Start",  "Giro auto alla partenza","Volta auto na largada"),
}

# Las que se dibujan en la esfera. No cuentan para el aviso de largo ni las de
# ajustes, que se leen en el telefono, ni los nombres, ni las del menu de
# terminar y sus dialogos, que los envuelve el sistema.
FUERA_DE_LA_ESFERA = ["appName", "fieldName",
                      "endTitle", "resume", "save", "discard", "discardSure"]
EN_LA_ESFERA = [c for c in TABLA
                if not c.startswith("setting") and c not in FUERA_DE_LA_ESFERA]


def revisar():
    fallos = []
    for clave, fila in TABLA.items():
        if len(fila) != len(IDIOMAS):
            fallos.append("%s: %d traducciones, hacen falta %d" % (clave, len(fila), len(IDIOMAS)))
        for idioma, texto in zip(IDIOMAS, fila):
            if not texto.strip():
                fallos.append("%s: falta el %s" % (clave, idioma))
    return fallos


def escribir(raiz):
    for i, idioma in enumerate(IDIOMAS):
        carpeta = "resources" if i == 0 else "resources-%s" % idioma
        destino = os.path.join(raiz, carpeta, "strings", "strings.xml")
        os.makedirs(os.path.dirname(destino), exist_ok=True)

        nota = ("%s. Es tambien el respaldo: lo que ve un reloj configurado en\n"
                "     un idioma que la app no trae." % idioma) if i == 0 else idioma
        lineas = ['<?xml version="1.0" encoding="UTF-8"?>',
                  '<!-- Generado por tools/generar_strings.py. No editar a mano.',
                  '     %s -->' % nota,
                  '<strings>']
        for clave, fila in TABLA.items():
            lineas.append('    <string id="%s">%s</string>' % (clave, escape(fila[i])))
        lineas.append('</strings>')

        with open(destino, "w", encoding="utf-8") as f:
            f.write("\n".join(lineas) + "\n")
        print("%-32s %d cadenas" % (destino, len(TABLA)))


def avisar_de_los_largos():
    largas = []
    for clave in EN_LA_ESFERA:
        fila = TABLA[clave]
        j = max(range(len(fila)), key=lambda k: len(fila[k]))
        if len(fila[j]) > LARGO_COMODO:
            largas.append((clave, fila[j], IDIOMAS[j], len(fila[j])))
    if not largas:
        return
    print("\nA probar en el simulador, que pasan de %d caracteres:" % LARGO_COMODO)
    for clave, texto, idioma, largo in sorted(largas, key=lambda x: -x[3]):
        print("  %-14s %-22s %s, %d car." % (clave, texto, idioma, largo))


if __name__ == "__main__":
    problemas = revisar()
    if problemas:
        for p in problemas:
            print("ERROR " + p, file=sys.stderr)
        sys.exit(1)
    # Las traducciones son las mismas para la app y para el campo de datos,
    # pero hay que escribirlas dos veces, una en cada proyecto.
    #
    # No es por gusto: monkeyc solo mira las carpetas resources-<idioma> que
    # son hermanas del manifest.xml del proyecto que compila. Una carpeta
    # compartida en ../shared no la lee, y no avisa: compila igual y el reloj
    # sale en ingles. Por eso los XML se generan y no se editan, y por eso
    # este script es el unico sitio donde estan las palabras.
    raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    for proyecto in ["app", "datafield"]:
        escribir(os.path.join(raiz, proyecto))
    avisar_de_los_largos()
