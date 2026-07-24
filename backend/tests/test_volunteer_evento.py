"""Regression tests for Volunteer 'Evento' grouping (carrera vs campeonato)."""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    # Fallback to frontend env
    with open('/app/frontend/.env') as f:
        for line in f:
            if line.startswith('REACT_APP_BACKEND_URL='):
                BASE_URL = line.strip().split('=', 1)[1].strip('"').rstrip('/')
                break

TEST_POSITION_CAMP = "TEST_Campeonato_Puesto"
TEST_POSITION_CARR = "TEST_Carrera_Puesto"


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    yield s
    # Cleanup - best effort
    for name, ev in [(TEST_POSITION_CAMP, "campeonato"), (TEST_POSITION_CARR, "carrera")]:
        try:
            s.delete(f"{BASE_URL}/api/volunteer-config/positions/{name}?evento={ev}")
        except Exception:
            pass


# ---------- volunteer-config positions ----------

class TestPositionsEvento:
    def test_get_positions_carrera_returns_legacy(self, api):
        r = api.get(f"{BASE_URL}/api/volunteer-config/positions?evento=carrera")
        assert r.status_code == 200
        data = r.json()
        assert "positions" in data
        # Legacy 8 positions belong to carrera
        for p in data["positions"]:
            assert p.get("evento") == "carrera"
        assert len(data["positions"]) >= 1

    def test_get_positions_campeonato_initially_empty_or_no_carrera(self, api):
        r = api.get(f"{BASE_URL}/api/volunteer-config/positions?evento=campeonato")
        assert r.status_code == 200
        data = r.json()
        for p in data.get("positions", []):
            assert p.get("evento") == "campeonato"

    def test_create_campeonato_position_and_verify_isolation(self, api):
        # Cleanup first (in case of previous run)
        api.delete(f"{BASE_URL}/api/volunteer-config/positions/{TEST_POSITION_CAMP}?evento=campeonato")

        payload = {
            "nombre": TEST_POSITION_CAMP,
            "descripcion": "Test campeonato position",
            "evento": "campeonato",
            "turnos": [
                {"turno": "A", "hora_inicio": "08:00", "hora_fin": "12:00", "slots_count": 2, "dia_tipo": "carrera_dia1"},
                {"turno": "B", "hora_inicio": "12:00", "hora_fin": "16:00", "slots_count": 1, "dia_tipo": "carrera_dia1"},
            ]
        }
        r = api.post(f"{BASE_URL}/api/volunteer-config/positions", json=payload)
        assert r.status_code == 200, r.text

        # Verify visible under campeonato
        r_c = api.get(f"{BASE_URL}/api/volunteer-config/positions?evento=campeonato")
        assert r_c.status_code == 200
        names_camp = [p["nombre"] for p in r_c.json()["positions"]]
        assert TEST_POSITION_CAMP in names_camp

        # Verify NOT visible under carrera
        r_carr = api.get(f"{BASE_URL}/api/volunteer-config/positions?evento=carrera")
        names_carr = [p["nombre"] for p in r_carr.json()["positions"]]
        assert TEST_POSITION_CAMP not in names_carr

        # Verify slots created with evento=campeonato
        r_slots = api.get(f"{BASE_URL}/api/volunteers/slots?evento=campeonato")
        assert r_slots.status_code == 200
        slots = r_slots.json()
        camp_slots = [s for s in slots if s.get("puesto") == TEST_POSITION_CAMP]
        assert len(camp_slots) == 3, f"Expected 3 slots (2+1), got {len(camp_slots)}"
        for s in camp_slots:
            assert s.get("evento") == "campeonato"

    def test_available_slots_filter_by_evento(self, api):
        # Public endpoint - should show campeonato slots when filtered
        r = api.get(f"{BASE_URL}/api/volunteer-registration/available-slots?evento=campeonato")
        assert r.status_code == 200
        data = r.json()
        puestos_camp = [p["puesto"] for p in data.get("positions", [])]
        assert TEST_POSITION_CAMP in puestos_camp

        # Filter by carrera - test position should NOT be present
        r_carr = api.get(f"{BASE_URL}/api/volunteer-registration/available-slots?evento=carrera")
        assert r_carr.status_code == 200
        puestos_carr = [p["puesto"] for p in r_carr.json().get("positions", [])]
        assert TEST_POSITION_CAMP not in puestos_carr

    def test_update_campeonato_position(self, api):
        update_payload = {
            "descripcion": "Updated desc",
            "turnos": [
                {"turno": "A", "hora_inicio": "08:00", "hora_fin": "12:00", "slots_count": 2, "dia_tipo": "carrera_dia1"},
            ]
        }
        r = api.put(
            f"{BASE_URL}/api/volunteer-config/positions/{TEST_POSITION_CAMP}?evento=campeonato",
            json=update_payload
        )
        assert r.status_code == 200, r.text

        # Verify carrera positions untouched
        r_carr = api.get(f"{BASE_URL}/api/volunteer-config/positions?evento=carrera")
        carr_names = [p["nombre"] for p in r_carr.json()["positions"]]
        assert TEST_POSITION_CAMP not in carr_names

    def test_delete_campeonato_cleans_slots_only_for_that_event(self, api):
        # Get carrera slots count before
        r_before = api.get(f"{BASE_URL}/api/volunteers/slots?evento=carrera")
        carrera_count_before = len(r_before.json())

        # Delete
        r = api.delete(f"{BASE_URL}/api/volunteer-config/positions/{TEST_POSITION_CAMP}?evento=campeonato")
        assert r.status_code == 200

        # Verify slot rows removed for that position under campeonato
        r_slots = api.get(f"{BASE_URL}/api/volunteers/slots?evento=campeonato")
        camp_slots = [s for s in r_slots.json() if s.get("puesto") == TEST_POSITION_CAMP]
        assert len(camp_slots) == 0

        # Carrera slots unchanged
        r_after = api.get(f"{BASE_URL}/api/volunteers/slots?evento=carrera")
        carrera_count_after = len(r_after.json())
        assert carrera_count_before == carrera_count_after


# ---------- volunteer registration evento update ----------

class TestVolunteerEventoUpdate:
    def test_update_nonexistent_volunteer_evento_returns_404(self, api):
        r = api.put(
            f"{BASE_URL}/api/volunteer-registration/admin/registrations/nonexistent@example.com/evento",
            json={"evento": "campeonato"}
        )
        assert r.status_code == 404

    def test_admin_registrations_returns_evento_field(self, api):
        r = api.get(f"{BASE_URL}/api/volunteer-registration/admin/registrations")
        assert r.status_code == 200
        data = r.json()
        assert "registrations" in data
        # All registrations should have an evento field (default carrera)
        for reg in data["registrations"]:
            assert reg.get("evento") in ("carrera", "campeonato")


# ---------- slots evento filter for /api/volunteers/slots ----------

class TestSlotsEventoFilter:
    def test_slots_no_filter_returns_all(self, api):
        r = api.get(f"{BASE_URL}/api/volunteers/slots")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_slots_carrera_returns_legacy(self, api):
        r = api.get(f"{BASE_URL}/api/volunteers/slots?evento=carrera")
        assert r.status_code == 200
        slots = r.json()
        assert len(slots) > 0
        # All slots normalized to carrera (or legacy default)
        for s in slots:
            assert s.get("evento") == "carrera"

    def test_slots_invalid_evento_returns_all(self, api):
        r = api.get(f"{BASE_URL}/api/volunteers/slots?evento=invalid")
        assert r.status_code == 200
