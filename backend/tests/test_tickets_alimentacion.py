"""Los tickets de comida que se entregan con la camiseta.

No toca la base de datos: entran las raciones ya calculadas y sale el PDF.
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services import tickets_alimentacion as tickets  # noqa: E402


def entrega(nombre, tipo, hora, cantidad=1, dia="2026-01-24"):
    return {
        "nombre": nombre,
        "tipo": tipo,
        "dia": dia,
        "hora": hora,
        "cantidad": cantidad,
        "puesto": "Hidratación y Snacks",
        "turno": "A",
        "horario_turno": "08:00-12:00",
    }


class TestPreparar:
    def test_una_racion_es_un_ticket(self):
        preparados = tickets.preparar([entrega("Ana Ortiz", "refrigerio", "09:30")])
        assert len(preparados) == 1
        assert preparados[0]["numero"] == 1

    def test_la_linea_de_dos_raciones_da_dos_tickets(self):
        # Quien recoge sus dos refrigerios en la misma mesa canjea dos tickets
        preparados = tickets.preparar([entrega("Ana Ortiz", "refrigerio", "20:30", cantidad=2)])
        assert len(preparados) == 2
        assert [t["numero"] for t in preparados] == [1, 2]

    def test_los_tickets_de_una_persona_salen_juntos(self):
        preparados = tickets.preparar([
            entrega("Sol Díaz", "refrigerio", "09:30"),
            entrega("Ana Ortiz", "refrigerio", "14:30"),
            entrega("Sol Díaz", "almuerzo", "12:00"),
            entrega("Ana Ortiz", "refrigerio", "09:30"),
        ])
        assert [t["nombre"] for t in preparados] == [
            "Ana Ortiz", "Ana Ortiz", "Sol Díaz", "Sol Díaz",
        ]
        # Y dentro de cada persona, en orden de hora
        assert [t["hora"] for t in preparados] == ["09:30", "14:30", "09:30", "12:00"]

    def test_los_numeros_son_correlativos_sin_huecos(self):
        preparados = tickets.preparar([
            entrega("Ana Ortiz", "refrigerio", "09:30", cantidad=2),
            entrega("Sol Díaz", "cena", "20:00"),
        ])
        assert [t["numero"] for t in preparados] == [1, 2, 3]


class TestPdf:
    def test_genera_un_pdf(self):
        preparados = tickets.preparar([entrega("Ana Ortiz", "almuerzo", "12:00")])
        datos = tickets.construir_pdf(preparados, "Carrera Activa").getvalue()
        assert datos.startswith(b"%PDF")
        assert len(datos) > 500

    def test_diez_tickets_por_hoja(self):
        for cuantos, hojas in ((1, 1), (10, 1), (11, 2), (25, 3)):
            preparados = tickets.preparar([
                entrega(f"Voluntario {i:02d}", "refrigerio", "09:30") for i in range(cuantos)
            ])
            datos = tickets.construir_pdf(preparados, "Carrera Activa").getvalue()
            assert re.findall(rb"/Count (\d+)", datos) == [str(hojas).encode()], cuantos

    def test_sin_raciones_sale_una_hoja_que_lo_dice(self):
        datos = tickets.construir_pdf([], "Carrera Activa").getvalue()
        assert datos.startswith(b"%PDF")

    def test_el_nombre_larguisimo_no_se_sale_del_ticket(self):
        largo = tickets.preparar([entrega("Wilhelmina Buenaventura de los Santos Villalobos", "cena", "20:00")])
        datos = tickets.construir_pdf(largo, "Carrera Activa").getvalue()
        assert datos.startswith(b"%PDF")
