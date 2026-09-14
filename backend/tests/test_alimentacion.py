"""Las reglas de comida de los voluntarios, sobre turnos de mentira.

No toca la base de datos: services/alimentacion.py es calculo puro.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services import alimentacion  # noqa: E402


def turno(hora_inicio, hora_fin, dia_tipo="carrera_dia1", puesto="Hidratación", letra="A"):
    return {
        "puesto": puesto,
        "turno": letra,
        "dia_tipo": dia_tipo,
        "hora_inicio": hora_inicio,
        "hora_fin": hora_fin,
    }


class TestFranjas:
    def test_la_franja_la_da_la_hora_de_inicio(self):
        assert alimentacion.franja(0) == "madrugada"        # 00:00
        assert alimentacion.franja(4 * 60) == "madrugada"   # 04:00, aunque acabe de mañana
        assert alimentacion.franja(8 * 60) == "mañana"
        assert alimentacion.franja(12 * 60) == "tarde"
        assert alimentacion.franja(16 * 60) == "tarde"
        assert alimentacion.franja(20 * 60) == "noche"


class TestRefrigerio:
    def test_un_turno_de_cuatro_horas_da_refrigerio(self):
        cuenta = alimentacion.calcular_voluntario([turno("08:00", "12:00")])
        assert cuenta["refrigerio"] == 1
        assert cuenta["total_comidas"] == 0

    def test_un_turno_corto_no_da_refrigerio(self):
        cuenta = alimentacion.calcular_voluntario([turno("06:00", "08:30")])
        assert cuenta["refrigerio"] == 0

    def test_cada_turno_largo_suma_su_refrigerio(self):
        cuenta = alimentacion.calcular_voluntario([
            turno("08:00", "12:00"),
            turno("12:00", "16:00"),
        ])
        assert cuenta["refrigerio"] == 2

    def test_dos_puestos_a_la_misma_hora_son_un_solo_refrigerio(self):
        # Pasa en los datos reales: la misma persona ocupando dos cupos que se
        # pisan. Es un conflicto de asignacion, no una persona que come doble.
        cuenta = alimentacion.calcular_voluntario([
            turno("07:30", "12:00", puesto="Hidratación"),
            turno("07:30", "12:00", puesto="Hidratación"),
            turno("12:00", "16:00", puesto="Hidratación"),
            turno("12:00", "16:00", puesto="Hidratación"),
        ])
        assert cuenta["refrigerio"] == 2
        assert cuenta["almuerzo"] == 1

    def test_el_turno_que_cruza_medianoche_cuenta_cuatro_horas(self):
        cuenta = alimentacion.calcular_voluntario([turno("20:00", "00:00")])
        assert cuenta["refrigerio"] == 1


class TestComidas:
    def test_mañana_y_tarde_seguidas_dan_almuerzo(self):
        cuenta = alimentacion.calcular_voluntario([
            turno("08:00", "12:00"),
            turno("12:00", "16:00"),
        ])
        assert cuenta["almuerzo"] == 1
        assert cuenta["desayuno"] == 0 and cuenta["cena"] == 0
        # Las comidas se suman al refrigerio, no lo sustituyen
        assert cuenta["refrigerio"] == 2

    def test_tarde_y_noche_seguidas_dan_cena(self):
        cuenta = alimentacion.calcular_voluntario([
            turno("16:00", "20:00"),
            turno("20:00", "00:00"),
        ])
        assert cuenta["cena"] == 1
        assert cuenta["almuerzo"] == 0

    def test_madrugada_y_mañana_seguidas_dan_desayuno(self):
        cuenta = alimentacion.calcular_voluntario([
            turno("04:00", "08:00"),
            turno("08:00", "12:00"),
        ])
        assert cuenta["desayuno"] == 1

    def test_una_jornada_larga_da_las_dos_comidas_que_cruza(self):
        cuenta = alimentacion.calcular_voluntario([
            turno("04:00", "08:00"),
            turno("08:00", "12:00"),
            turno("12:00", "16:00"),
        ])
        assert cuenta["desayuno"] == 1
        assert cuenta["almuerzo"] == 1
        assert cuenta["refrigerio"] == 3

    def test_dos_turnos_de_la_misma_franja_no_dan_comida(self):
        cuenta = alimentacion.calcular_voluntario([
            turno("12:00", "16:00"),
            turno("16:00", "20:00"),
        ])
        assert cuenta["total_comidas"] == 0
        assert cuenta["refrigerio"] == 2


class TestContinuidad:
    def test_turnos_sueltos_solo_dan_refrigerio(self):
        cuenta = alimentacion.calcular_voluntario([
            turno("08:00", "12:00"),
            turno("16:00", "20:00"),
        ])
        assert cuenta["total_comidas"] == 0
        assert cuenta["refrigerio"] == 2
        assert len(cuenta["jornadas"]) == 2

    def test_media_hora_de_hueco_sigue_siendo_la_misma_jornada(self):
        cuenta = alimentacion.calcular_voluntario([
            turno("07:30", "11:30"),
            turno("12:00", "16:00"),
        ])
        assert cuenta["almuerzo"] == 1
        assert len(cuenta["jornadas"]) == 1

    def test_una_hora_de_hueco_ya_son_dos_jornadas(self):
        cuenta = alimentacion.calcular_voluntario([
            turno("07:00", "11:00"),
            turno("12:00", "16:00"),
        ])
        assert cuenta["almuerzo"] == 0
        assert len(cuenta["jornadas"]) == 2

    def test_la_noche_y_la_madrugada_siguiente_no_dan_comida(self):
        cuenta = alimentacion.calcular_voluntario([
            turno("20:00", "00:00", dia_tipo="carrera_dia1"),
            turno("00:00", "04:00", dia_tipo="carrera_dia2"),
        ])
        assert cuenta["total_comidas"] == 0
        assert len(cuenta["jornadas"]) == 1


class TestDias:
    def test_la_comida_se_anota_en_el_dia_del_turno_al_que_se_entra(self):
        cuenta = alimentacion.calcular_voluntario([
            turno("20:00", "00:00", dia_tipo="carrera_dia1"),
            turno("00:00", "04:00", dia_tipo="carrera_dia2"),
            turno("04:00", "08:00", dia_tipo="carrera_dia2"),
            turno("08:00", "12:00", dia_tipo="carrera_dia2"),
        ])
        # El desayuno lo genera el paso de 04-08 a 08-12, ambos del dia 2
        assert cuenta["desayuno"] == 1
        assert cuenta["por_dia"][1]["desayuno"] == 1
        assert cuenta["por_dia"][0].get("desayuno", 0) == 0

    def test_los_turnos_con_fecha_se_ordenan_por_su_fecha(self):
        turnos = [
            {"dia": "2026-01-24", "hora_inicio": "08:00:00", "hora_fin": "12:00:00"},
            {"dia": "2026-01-24", "hora_inicio": "12:00:00", "hora_fin": "16:00:00"},
            {"dia": "2026-01-25", "hora_inicio": "08:00:00", "hora_fin": "12:00:00"},
        ]
        base = alimentacion.base_del_evento(turnos)
        cuenta = alimentacion.calcular_voluntario(turnos, base)
        assert cuenta["almuerzo"] == 1
        assert cuenta["refrigerio"] == 3
        assert len(cuenta["jornadas"]) == 2
        assert alimentacion.etiqueta_dia(0, base) == "2026-01-24"


class TestEntregas:
    """Quien recibe que, y a que hora se le entrega."""

    def test_el_refrigerio_se_recoge_en_el_reparto_de_su_turno(self):
        # 08-12 pasa por la mesa de las 9:30
        cuenta = alimentacion.calcular_voluntario([turno("08:00", "12:00", puesto="Hidratación")])
        assert cuenta["entregas"] == [{
            "tipo": "refrigerio",
            "minuto": 9 * 60 + 30,
            "cantidad": 1,
            "puesto": "Hidratación",
            "turno": "A",
            "horario": "08:00-12:00",
        }]

    def test_cada_turno_recoge_en_la_mesa_que_le_cae_dentro(self):
        casos = {
            ("00:00", "04:00"): 1 * 60,
            ("07:30", "12:00"): 9 * 60 + 30,
            ("08:00", "12:00"): 9 * 60 + 30,
            ("12:00", "16:00"): 14 * 60 + 30,
            ("20:00", "00:00"): 20 * 60 + 30,
        }
        for (desde, hasta), minuto in casos.items():
            cuenta = alimentacion.calcular_voluntario([turno(desde, hasta)])
            assert cuenta["entregas"][0]["minuto"] == minuto, (desde, hasta)

    def test_el_turno_sin_mesa_dentro_recoge_en_la_mas_cercana(self):
        # 16-20 no alcanza ninguna de las cuatro: la de las 20:30 es la de al
        # lado (media hora despues de salir), y nunca una anterior a entrar
        cuenta = alimentacion.calcular_voluntario([turno("16:00", "20:00")])
        assert cuenta["entregas"][0]["minuto"] == 20 * 60 + 30

        # 04-08 recoge en la de las 9:30, hora y media despues de salir
        cuenta = alimentacion.calcular_voluntario([turno("04:00", "08:00")])
        assert cuenta["entregas"][0]["minuto"] == 9 * 60 + 30

    def test_dos_refrigerios_en_la_misma_mesa_salen_en_una_linea(self):
        # 04-08 y 08-12 recogen los dos a las 9:30
        cuenta = alimentacion.calcular_voluntario([
            turno("04:00", "08:00"),
            turno("08:00", "12:00"),
        ])
        refrigerios = [e for e in cuenta["entregas"] if e["tipo"] == "refrigerio"]
        assert len(refrigerios) == 1
        assert refrigerios[0]["cantidad"] == 2
        assert refrigerios[0]["minuto"] == 9 * 60 + 30
        # La cuenta no cambia: siguen siendo dos raciones
        assert cuenta["refrigerio"] == 2

    def test_la_comida_se_entrega_en_el_cambio_de_turno(self):
        cuenta = alimentacion.calcular_voluntario([
            turno("08:00", "12:00", puesto="Control de Vueltas"),
            turno("12:00", "16:00", puesto="Hidratación"),
        ])
        almuerzo = [e for e in cuenta["entregas"] if e["tipo"] == "almuerzo"]
        assert len(almuerzo) == 1
        # A las 12:00, en el puesto al que llega
        assert almuerzo[0]["minuto"] == 12 * 60
        assert almuerzo[0]["puesto"] == "Hidratación"

    def test_las_entregas_salen_en_orden_de_hora(self):
        cuenta = alimentacion.calcular_voluntario([
            turno("16:00", "20:00"),
            turno("08:00", "12:00"),
            turno("12:00", "16:00"),
        ])
        minutos = [e["minuto"] for e in cuenta["entregas"]]
        assert minutos == sorted(minutos)
        # 3 refrigerios (9:30, 14:30, 20:30) + 1 almuerzo (mañana a tarde)
        assert len(cuenta["entregas"]) == 4
        assert sum(e["cantidad"] for e in cuenta["entregas"]) == 4

    def test_la_entrega_de_madrugada_cae_en_el_dia_siguiente(self):
        cuenta = alimentacion.calcular_voluntario([
            turno("20:00", "00:00", dia_tipo="carrera_dia1"),
            turno("00:00", "04:00", dia_tipo="carrera_dia2"),
        ])
        # 20:30 del dia 1 y 01:00 del dia 2
        horas = [(e["minuto"] // 1440, e["minuto"] % 1440) for e in cuenta["entregas"]]
        assert horas == [(0, 20 * 60 + 30), (1, 60)]


class TestTotales:
    def test_los_totales_suman_a_todas_las_personas(self):
        resultado = alimentacion.calcular({
            "ana@example.com": [turno("08:00", "12:00"), turno("12:00", "16:00")],
            "luis@example.com": [turno("16:00", "20:00"), turno("20:00", "00:00")],
            "sol@example.com": [turno("08:00", "12:00")],
        })
        assert resultado["totales"]["voluntarios"] == 3
        assert resultado["totales"]["refrigerio"] == 5
        assert resultado["totales"]["almuerzo"] == 1
        assert resultado["totales"]["cena"] == 1
        assert resultado["totales"]["total_comidas"] == 2
        assert resultado["por_dia"][0]["refrigerio"] == 5
