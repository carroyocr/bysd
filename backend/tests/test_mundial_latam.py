"""El ranking de Latinoamérica sacado de la hoja del Mundial, sobre un CSV de mentira.

No toca la red: services/mundial.parsear es cálculo puro.
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services import mundial  # noqa: E402

# Un recorte de la hoja real (18 de octubre de 2026, vuelta 18): las filas de
# arriba con el título, la cabecera y unos equipos, latinos y no latinos.
HOJA = """Backyard Ultra - World Team Championship 2026  -  Yard 18,,,,,,,,,,,"16,417",Race Time:  17:55:17  (18 Oct 2026  05:55:17 UTC),,,,,,Dashboard
,,,,,,,,,,,,,,,,,,,,18,17
819 Runners / 69 Countries,,,,,,,Key:,Completed Yard 18
Rank,Tm,Team,Flag,#,Yards,Avg,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,Local,Class
1,POL,Poland,,15,270,44:40,Wróbel,Cyganski,Pszczolkowski,Sitarek,Sikora,Fudali,Tatara,Sułek,Kowalik,Pawlak,Bucholc,Gil,Szymański,Kowalski,Marczuk,07:55:17,AAA
3,MEX,Mexico,,15,270,46:08,Leonides,Muñoz,Santiago,Valenzuela,González,Bernardo,Juárez,Misael,Marcelo,Elox,Jordan,Susano,Garcia,Godinez,Espino,23:55:17,AAA
21,BOL,Bolivia,,14,264,51:11,Guzman,Aguilar,Mullisaca,Suárez,Balderrama,Llajsa,Porco,Gutierrez,Castillo,Patino,Chambi,15-Puma,Martinez,Flores,Sahonero,01:55:17,A
24,URU,Uruguay,,11,261,48:45,Rodríguez,Rodriguez,Molina,Rocío,17-Fernandez,15-Arias,Azaian,Bentancourt,16-Delfino,Odela,Ferreira,16-Gomez,Correa,Nascente,Sosa,02:55:17,A
34,ESP,Spain,,15,255,50:47,Verdugo,Pastor,Rodríguez,Garcia,Bravo,Torres,Gomez,Machi,Gonzalez,Jimenez,Girona,Hernandez,Huallpa,Jordi,Dominguez,07:55:17,AAA
55,DOM,Dominican Republic,,8,225,50:56,Feliz,04-Camilo,Ortega,14-Shiguetome,Minaya,Ovalle,Soto,17-Perez,13-Taveras,Cepeda,08-Gomez,10-Santos,Aldana,Encarnación,15-Gaitán,01:55:17,A
68,MRI,Mauritius,,0,0,,00-Deffrenne,00-Martin,00-Parisot,00-Mootealoo,00-Ricaud,00-Kiecken,00-Domun,00-Shun,00-Larosee,00-Sury,00-Chavan,00-Seewoolall,00-Etiennette,00-Prosper,00-Martin,09:55:17,A
,,,,,,,,,,,,,,,,,,,,,,,
,,,,,,"Winner 24+ yards, golden ticket to Big's 2027",,,,,,Winner < 24 yards (or winner not yet determined)
"""


class TestParsear:
    def test_la_vuelta_y_la_hora_salen_del_titulo(self):
        datos = mundial.parsear(HOJA)
        assert datos["vuelta"] == 18
        assert datos["hora_carrera"] == "17:55:17"

    def test_solo_quedan_los_equipos_latinos_en_el_orden_de_la_hoja(self):
        equipos = mundial.parsear(HOJA)["equipos"]
        assert [e["codigo"] for e in equipos] == ["MEX", "BOL", "URU", "DOM"]
        assert [e["puesto"] for e in equipos] == [1, 2, 3, 4]
        assert [e["puesto_mundial"] for e in equipos] == [3, 21, 24, 55]

    def test_cada_equipo_trae_sus_cifras_y_el_nombre_en_espanol(self):
        dom = mundial.parsear(HOJA)["equipos"][-1]
        assert dom["pais"] == "República Dominicana"
        assert dom["pais_hoja"] == "Dominican Republic"
        assert dom["en_pie"] == 8
        assert dom["vueltas"] == 225
        assert dom["promedio"] == "50:56"

    def test_una_columna_de_mas_no_descoloca_nada(self):
        # Si la organización mete una columna antes de Yards, se sigue
        # leyendo por el nombre de la columna
        hoja = HOJA.replace("Rank,Tm,Team,Flag,#,Yards", "Rank,Tm,Team,Flag,#,Extra,Yards")
        hoja = hoja.replace("3,MEX,Mexico,,15,270", "3,MEX,Mexico,,15,x,270")
        mex = next(e for e in mundial.parsear(hoja)["equipos"] if e["codigo"] == "MEX")
        assert mex["vueltas"] == 270

    def test_sin_cabecera_es_un_error_y_no_un_ranking_vacio(self):
        with pytest.raises(ValueError):
            mundial.parsear("a,b,c\n1,2,3\n")
