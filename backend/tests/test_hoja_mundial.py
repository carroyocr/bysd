"""La hoja del Campeonato Mundial se rellena desde el libro de vueltas.

Lo que protegen estas pruebas son las reglas de `services/hoja_mundial.py`:

- cada vuelta completada se escribe como `mmss` medido desde la salida de esa
  vuelta segun el reloj de la carrera, y no desde el `lap_start_time` anotado;
- el retiro va en la yarda siguiente a la ultima completada, con la marca que
  pide la organizacion mundial: RTC si no salio, INC si volvio sin completar,
  Over si llego pasada la hora;
- lo que el libro no sabe (una vuelta anotada a mano, fuera de hora) no se
  escribe: se avisa;
- solo se borra en la hoja lo que escribio este modulo;
- las filas de la hoja se casan con los dorsales por nombre, sin adivinar.

No necesitan servidor, base de datos ni Google.

    backend/.venv/bin/python -m pytest tests/test_hoja_mundial.py -v
"""
import os
from datetime import datetime, timedelta, timezone

os.environ.setdefault("JWT_SECRET_KEY", "clave-solo-para-tests-" + "x" * 40)

from services import hoja_mundial, laps  # noqa: E402

TZ = timezone(timedelta(hours=-4))
SALIDA = datetime(2026, 10, 17, 8, 0, tzinfo=TZ)
CARRERA = {"code": "MUNDIAL-2026", "started_at": SALIDA.astimezone(timezone.utc).replace(tzinfo=None),
           "timezone_gmt": "GMT-4", "minutos_por_vuelta": 60}


def paso(vuelta, minutos, segundos=0, accion=laps.VUELTA_COMPLETADA, **extra):
    """Una anotacion del libro: el corredor cruza el arco a tantos minutos de
    la salida de esa vuelta. Guardada como la devuelve Mongo: UTC sin zona."""
    momento = SALIDA + timedelta(minutes=(vuelta - 1) * 60 + minutos, seconds=segundos)
    return {"action": accion, "lap_number": vuelta,
            "scan_time": momento.astimezone(timezone.utc).replace(tzinfo=None), **extra}


# ----- la cuadricula -----

def test_las_columnas_de_las_yardas_son_las_de_la_hoja():
    assert hoja_mundial.letra_columna(1) == "A"
    assert hoja_mundial.letra_columna(26) == "Z"
    assert hoja_mundial.letra_columna(27) == "AA"
    assert hoja_mundial.columna_de_vuelta(1) == "I"
    assert hoja_mundial.columna_de_vuelta(2) == "J"
    assert hoja_mundial.columna_de_vuelta(144) == "EV"
    assert hoja_mundial.celda("I", 3) == "'Timing'!I3"


def test_el_id_de_la_hoja_sale_de_la_direccion_o_del_id():
    url = ("https://docs.google.com/spreadsheets/d/1lgfiAul3ZCw5BjzQeCpDTHfWVdctIUCB2nHuIFVJyOg"
           "/edit?usp=sharing_eil&ts=6ad00196")
    assert hoja_mundial.id_de_hoja(url) == "1lgfiAul3ZCw5BjzQeCpDTHfWVdctIUCB2nHuIFVJyOg"
    assert hoja_mundial.id_de_hoja("  1lgfiAul3ZCw5BjzQeCpDTHfWVdctIUCB2nHuIFVJyOg ") == \
        "1lgfiAul3ZCw5BjzQeCpDTHfWVdctIUCB2nHuIFVJyOg"
    assert hoja_mundial.id_de_hoja("hola") is None
    assert hoja_mundial.id_de_hoja("") is None


# ----- del libro a las celdas -----

def test_el_tiempo_es_mmss_como_numero():
    assert hoja_mundial.valor_de_tiempo(52 * 60 + 25, 60) == 5225
    assert hoja_mundial.valor_de_tiempo(45 * 60 + 7, 60) == 4507
    assert hoja_mundial.valor_de_tiempo(59 * 60 + 59, 60) == 5959


def test_un_tiempo_que_no_cabe_en_la_vuelta_no_se_escribe():
    assert hoja_mundial.valor_de_tiempo(60 * 60, 60) is None
    assert hoja_mundial.valor_de_tiempo(-5, 60) is None


def test_cada_vuelta_completada_va_en_su_yarda():
    valores, avisos = hoja_mundial.celdas(
        CARRERA, [paso(1, 52, 25), paso(2, 50, 3), paso(3, 55, 40)], "active"
    )
    assert valores == {1: 5225, 2: 5003, 3: 5540}
    assert avisos == []


def test_el_tiempo_se_mide_desde_la_salida_de_esa_vuelta_no_desde_lo_anotado():
    # El panel anota la vuelta 1 con el reloj de la 2: `lap_start_time` dice
    # la salida de la 2 pero el paso fue a los 51 minutos de la 1.
    anotacion = paso(1, 51, 0, lap_start_time=SALIDA + timedelta(hours=1))
    valores, _ = hoja_mundial.celdas(CARRERA, [anotacion], "active")
    assert valores == {1: 5100}


def test_rtc_cuando_se_retira_sin_salir_a_la_siguiente():
    anotaciones = [paso(1, 52), paso(2, 53), paso(3, 0, accion=laps.RETIRO_MANUAL)]
    valores, _ = hoja_mundial.celdas(CARRERA, anotaciones, "retired")
    assert valores == {1: 5200, 2: 5300, 3: hoja_mundial.RTC}


def test_inc_cuando_vuelve_sin_completar():
    anotaciones = [paso(1, 52), paso(2, 10, accion=laps.RETIRO_TEMPRANO)]
    valores, _ = hoja_mundial.celdas(CARRERA, anotaciones, "retired")
    assert valores == {1: 5200, 2: hoja_mundial.INC}


def test_over_cuando_llega_pasada_la_hora():
    anotaciones = [paso(1, 52), paso(2, 63, accion=laps.RETIRO_POR_TIEMPO)]
    valores, _ = hoja_mundial.celdas(CARRERA, anotaciones, "retired")
    assert valores == {1: 5200, 2: hoja_mundial.OVER}


def test_el_retiro_anulado_no_deja_marca():
    # `laps.historial` ya deja fuera las anuladas: el corredor vuelve a estar
    # activo y la hoja no debe decir RTC.
    valores, _ = hoja_mundial.celdas(CARRERA, [paso(1, 52)], "active")
    assert valores == {1: 5200}


def test_un_ajuste_fija_la_cuenta_y_lo_que_no_tiene_hora_se_avisa():
    # Dos escaneadas, la organizacion ajusta a 4: las vueltas 3 y 4 no tienen
    # paso por el arco, asi que no se inventa un tiempo.
    anotaciones = [paso(1, 52), paso(2, 53), paso(4, 0, accion=laps.AJUSTE)]
    valores, avisos = hoja_mundial.celdas(CARRERA, anotaciones, "active")
    assert valores == {1: 5200, 2: 5300}
    assert len(avisos) == 2 and "vuelta 3" in avisos[0] and "vuelta 4" in avisos[1]


def test_un_ajuste_a_la_baja_deja_fuera_las_vueltas_sobrantes():
    anotaciones = [paso(1, 52), paso(2, 53), paso(3, 50), paso(2, 0, accion=laps.AJUSTE)]
    valores, avisos = hoja_mundial.celdas(CARRERA, anotaciones, "active")
    assert valores == {1: 5200, 2: 5300}
    assert avisos == []


def test_una_vuelta_anotada_tarde_desde_el_panel_se_avisa_en_vez_de_escribirse():
    # La vuelta 1 se anoto a mano 70 minutos despues de su salida: no cabe.
    valores, avisos = hoja_mundial.celdas(CARRERA, [paso(1, 70)], "active")
    assert valores == {}
    assert len(avisos) == 1 and "vuelta 1" in avisos[0]


def test_sin_hora_de_salida_no_hay_tiempos_pero_si_marca_de_retiro():
    sin_reloj = {"code": "X", "timezone_gmt": "GMT-4"}
    anotaciones = [paso(1, 52), paso(2, 0, accion=laps.RETIRO_MANUAL)]
    valores, avisos = hoja_mundial.celdas(sin_reloj, anotaciones, "retired")
    assert valores == {2: hoja_mundial.RTC}
    assert len(avisos) == 1


# ----- solo se borra lo propio -----

def test_solo_se_mandan_las_celdas_nuevas_o_cambiadas():
    escrito = {"1": 5200, "2": 5300}
    assert hoja_mundial.cambios(escrito, {1: 5200, 2: 5300, 3: 5100}) == {3: 5100}
    assert hoja_mundial.cambios(escrito, {1: 5200, 2: 5311}) == {2: 5311}
    assert hoja_mundial.cambios(escrito, {1: 5200, 2: 5300}) == {}


def test_lo_que_este_modulo_escribio_y_ya_no_vale_se_borra():
    # La vuelta 3 se anulo en el panel: su celda vuelve a blanco. La marca
    # `dns` no es una yarda y no entra aqui.
    escrito = {"1": 5200, "2": 5300, "3": 5100, "dns": "DNS"}
    assert hoja_mundial.cambios(escrito, {1: 5200, 2: 5300}) == {3: ""}


def test_lo_escrito_a_mano_no_se_toca():
    # La yarda 3 la escribio alguien a mano en la hoja (no esta en `escrito`):
    # aunque el libro no la tenga, no se borra.
    assert hoja_mundial.cambios({"1": 5200}, {1: 5200}) == {}


# ----- emparejar filas con dorsales -----

FILAS = [
    {"fila": 3, "numero": "1", "nombre": "Livio Feliz"},
    {"fila": 4, "numero": "2", "nombre": "Jorge Camilo"},
    {"fila": 5, "numero": "3", "nombre": "Luis Antonio De León Encarnación"},
    {"fila": 6, "numero": "4", "nombre": "Lucas Gaitán"},
]
ATLETAS = [
    {"bib": 7, "nombre": "Livio", "apellidos": "Féliz"},
    {"bib": 12, "nombre": "Jorge Luis", "apellidos": "Camilo Pérez"},
    {"bib": 3, "nombre": "Luis Antonio", "apellidos": "de Leon Encarnacion"},
    {"bib": 9, "nombre": "Pedro", "apellidos": "Taveras"},
    {"bib": None, "nombre": "Lucas", "apellidos": "Gaitan"},
]


def test_empareja_por_nombre_sin_acentos_y_con_nombres_de_mas():
    filas, sin_fila, sin_pareja = hoja_mundial.emparejar(FILAS, ATLETAS)
    assert filas == {"7": 3, "12": 4, "3": 5}
    # Lucas no tiene dorsal todavia: su fila queda sin corredor.
    assert [f["nombre"] for f in sin_fila] == ["Lucas Gaitán"]
    assert [a["bib"] for a in sin_pareja] == [9]


def test_un_empate_no_se_adivina():
    dos_juanes = [
        {"bib": 1, "nombre": "Juan", "apellidos": "Pérez Gómez"},
        {"bib": 2, "nombre": "Juan", "apellidos": "Pérez Díaz"},
    ]
    filas, sin_fila, _ = hoja_mundial.emparejar(
        [{"fila": 3, "numero": "1", "nombre": "Juan Perez"}], dos_juanes
    )
    assert filas == {}
    assert len(sin_fila) == 1


def test_el_que_ya_tiene_fila_no_se_vuelve_a_usar():
    filas, _, _ = hoja_mundial.emparejar(
        [{"fila": 3, "nombre": "Livio Feliz"}, {"fila": 4, "nombre": "Livio Feliz"}],
        [{"bib": 7, "nombre": "Livio", "apellidos": "Feliz"}],
    )
    assert filas == {"7": 3}
