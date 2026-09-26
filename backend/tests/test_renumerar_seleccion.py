"""El reparto de dorsales del campeonato: la seleccion desde el 1 y la reserva
a continuacion.

No toca la base de datos: entra la lista de inscripciones y sale a que numero
va cada una. Lo que se fija aqui es lo que costaria caro equivocarse: que la
reserva no se cuele entre los titulares, que nadie se mueva de sitio sin
motivo y que no se pierda ninguna inscripcion por el camino.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault("JWT_SECRET_KEY", "clave-de-prueba-larga-de-sobra-para-pasar-el-minimo")

from routes.seleccionados import plan_de_renumeracion  # noqa: E402


def inscripcion(bib, categoria="titular", nombre=None):
    return {"bib": bib, "categoria": categoria, "nombre": nombre or f"Corredor {bib}"}


def repartir(inscripciones):
    """El plan como {dorsal_viejo: dorsal_nuevo}."""
    return {i["bib"]: nuevo for i, nuevo in plan_de_renumeracion(inscripciones)}


def test_la_seleccion_va_del_uno_en_adelante():
    plan = repartir([inscripcion(b) for b in ("001", "002", "003")])
    assert plan == {"001": "001", "002": "002", "003": "003"}


def test_la_reserva_continua_detras_de_la_seleccion():
    """Aunque sus numeros de ahora sean mas bajos que los de algun titular."""
    plan = repartir([
        inscripcion("023", "titular"),
        inscripcion("001", "titular"),
        inscripcion("016", "reserva"),
        inscripcion("021", "reserva"),
    ])
    assert plan == {"001": "001", "023": "002", "016": "003", "021": "004"}


def test_se_cierran_los_huecos_que_dejan_las_bajas():
    """Es para lo que existe: alguien se cae y su numero queda vacio."""
    plan = repartir([inscripcion(b) for b in ("001", "002", "014", "023")])
    assert list(plan.values()) == ["001", "002", "003", "004"]


def test_no_se_reordena_a_quien_no_hace_falta_mover():
    """Reordenar por nombre cambiaria el dorsal de gente sin motivo."""
    plan = repartir([
        inscripcion("001", "titular", "Zacarias"),
        inscripcion("002", "titular", "Ana"),
    ])
    assert plan == {"001": "001", "002": "002"}


def test_los_dorsales_se_ordenan_por_numero_y_no_por_texto():
    """Con cadenas, "100" iria antes que "020"."""
    plan = repartir([inscripcion(b) for b in ("020", "100", "003")])
    assert plan == {"003": "001", "020": "002", "100": "003"}


def test_una_inscripcion_sin_categoria_va_al_final_pero_no_se_pierde():
    plan = repartir([
        inscripcion("005", "reserva"),
        inscripcion("009", None),
        inscripcion("001", "titular"),
    ])
    assert plan == {"001": "001", "005": "002", "009": "003"}


def test_los_dorsales_salen_a_tres_cifras():
    plan = repartir([inscripcion(str(n)) for n in range(1, 4)])
    assert set(plan.values()) == {"001", "002", "003"}


def test_no_se_repite_ni_se_pierde_ningun_numero():
    """Dos corredores con el mismo dorsal es un dorsal mal impreso."""
    inscripciones = (
        [inscripcion(f"{n:03d}", "titular") for n in (1, 2, 5, 9, 14, 23)]
        + [inscripcion(f"{n:03d}", "reserva") for n in (16, 17, 21)]
    )
    nuevos = [nuevo for _i, nuevo in plan_de_renumeracion(inscripciones)]
    assert nuevos == [f"{n:03d}" for n in range(1, 10)]
    assert len(set(nuevos)) == len(nuevos)


def test_el_caso_de_hoy_deja_la_seleccion_en_1_15_y_la_reserva_en_16_19():
    """La nomina real: 15 titulares con huecos y 4 reservas."""
    titulares = [f"{n:03d}" for n in range(1, 15)] + ["023"]
    reservas = ["016", "017", "018", "021"]
    plan = repartir(
        [inscripcion(b, "titular") for b in titulares]
        + [inscripcion(b, "reserva") for b in reservas]
    )
    assert plan["023"] == "015"      # el ultimo titular cierra el hueco
    assert plan["016"] == "016"
    assert plan["021"] == "019"      # la reserva queda de corrido
    assert sorted(plan.values()) == [f"{n:03d}" for n in range(1, 20)]


def test_sin_inscripciones_no_pasa_nada():
    assert plan_de_renumeracion([]) == []
