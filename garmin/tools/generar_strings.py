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
    #                    eng                      spa                   fre                    deu                     ita                    por
    "appName":         ("BYSD Live",              "BYSD Live",          "BYSD Live",           "BYSD Live",            "BYSD Live",           "BYSD Live"),
    # El nombre del campo de datos, tal y como sale en la lista donde el
    # corredor elige que poner en cada hueco de su pantalla de carrera.
    "fieldName":       ("BYSD Margin",            "BYSD Margen",        "BYSD Marge",          "BYSD Puffer",          "BYSD Margine",        "BYSD Margem"),
    "lap":             ("Lap",                    "Vuelta",             "Tour",                "Runde",                "Giro",                "Volta"),
    "nextStart":       ("Next start",             "Próxima salida",     "Prochain départ",     "Nächster Start",       "Prossima partenza",   "Próxima partida"),
    "beforeStart":     ("For lap 1",              "Para la vuelta 1",   "Pour le tour 1",      "Für Runde 1",          "Per il giro 1",       "Para a volta 1"),
    # Corral, yard y DNF ya son las palabras del deporte en todos los idiomas.
    # Traducirlas confunde mas de lo que ayuda.
    "corral":          ("Corral",                 "Corral",             "Corral",              "Corral",               "Corral",              "Corral"),
    "toTheLine":       ("To the line",            "A la línea",         "Sur la ligne",        "An die Linie",         "In linea",            "Para a linha"),
    "rest":            ("Rest",                   "De descanso",        "De repos",            "Pause",                "Di riposo",           "De descanso"),
    "paceTooSlow":     ("Pace too slow",          "Ritmo insuficiente", "Rythme insuffisant",  "Tempo zu langsam",     "Ritmo insufficiente", "Ritmo insuficiente"),
    "laps":            ("Laps",                   "Vueltas",            "Tours",               "Runden",               "Giri",                "Voltas"),
    "stillIn":         ("Still in",               "En carrera",         "En course",           "Noch dabei",           "In gara",             "Em prova"),
    "of":              ("of",                     "de",                 "sur",                 "von",                  "di",                  "de"),
    "notStarted":      ("Not started",            "Sin empezar",        "Pas commencé",        "Nicht gestartet",      "Non iniziata",        "Não começou"),
    "raceClosed":      ("Race closed",            "Carrera cerrada",    "Course terminée",     "Rennen beendet",       "Gara chiusa",         "Prova encerrada"),
    "syncing":         ("Syncing",                "Sincronizando",      "Synchronisation",     "Synchronisiert",       "Sincronizzo",         "Sincronizando"),
    "noBib":           ("No bib set",             "Sin dorsal",         "Sans dossard",        "Keine Nummer",         "Nessun pettorale",    "Sem dorsal"),

    # Ajustes: se leen en el telefono, no en el reloj, asi que aqui el largo
    # no aprieta.
    "settingBib":      ("Bib number",             "Dorsal",             "Dossard",             "Startnummer",          "Pettorale",           "Dorsal"),
    "settingRace":     ("Race code",              "Código de carrera",  "Code de course",      "Rennkürzel",           "Codice gara",         "Código da prova"),
    "settingCorral":   ("Corral alert",           "Aviso de corral",    "Alerte corral",       "Corral-Warnung",       "Avviso corral",       "Aviso de corral"),
    "settingRefresh":  ("Refresh (seconds)",      "Refresco (segundos)","Rafraîchissement (s)","Aktualisierung (Sek.)","Aggiornamento (s)",   "Atualização (s)"),
}

# Las que se dibujan en la esfera. No cuentan para el aviso de largo ni las de
# ajustes, que se leen en el telefono, ni los dos nombres, que salen en listas
# donde el reloj ya se encarga de recortar.
FUERA_DE_LA_ESFERA = ["appName", "fieldName"]
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
