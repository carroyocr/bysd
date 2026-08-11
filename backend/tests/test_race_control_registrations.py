"""
Test Race Control Panel with Registrations Collection
Tests the modified /api/race/stats and /api/race/participants endpoints
that now prioritize the registrations collection over the old participants collection.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
RACE_CODE = "BYSD-2027"
TEST_EMAIL = "carroyo@riesgobancario.com"


class TestRaceStatsWithRegistrations:
    """Test /api/race/stats endpoint with race_code parameter"""
    
    def test_stats_endpoint_returns_200(self):
        """GET /api/race/stats?race_code=BYSD-2027 returns 200"""
        response = requests.get(f"{BASE_URL}/api/race/stats?race_code={RACE_CODE}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✓ Stats endpoint returns 200")
    
    def test_stats_response_structure(self):
        """Stats response has correct structure"""
        response = requests.get(f"{BASE_URL}/api/race/stats?race_code={RACE_CODE}")
        data = response.json()
        
        required_fields = ['current_lap', 'total_laps_completed', 'athletes_dnf', 
                          'athletes_active', 'athletes_dns', 'total_km', 
                          'total_km_all_athletes', 'winner']
        
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        print(f"✓ Stats response has all required fields: {required_fields}")
    
    def test_stats_athletes_active_from_registrations(self):
        """Stats shows athletes_active from registrations collection"""
        response = requests.get(f"{BASE_URL}/api/race/stats?race_code={RACE_CODE}")
        data = response.json()
        
        # Should have at least 1 active athlete (Cristhian Arroyo)
        assert data['athletes_active'] >= 1, f"Expected at least 1 active athlete, got {data['athletes_active']}"
        print(f"✓ Stats shows {data['athletes_active']} active athlete(s) from registrations")
    
    def test_stats_without_race_code_uses_active_race(self):
        """Stats without race_code parameter uses active race"""
        response = requests.get(f"{BASE_URL}/api/race/stats")
        assert response.status_code == 200
        data = response.json()
        
        # Should still return valid stats
        assert 'athletes_active' in data
        print(f"✓ Stats without race_code returns valid response")
    
    def test_stats_numeric_values(self):
        """Stats numeric values are correct types"""
        response = requests.get(f"{BASE_URL}/api/race/stats?race_code={RACE_CODE}")
        data = response.json()
        
        assert isinstance(data['current_lap'], int), "current_lap should be int"
        assert isinstance(data['athletes_active'], int), "athletes_active should be int"
        assert isinstance(data['athletes_dnf'], int), "athletes_dnf should be int"
        assert isinstance(data['athletes_dns'], int), "athletes_dns should be int"
        assert isinstance(data['total_km'], (int, float)), "total_km should be numeric"
        print(f"✓ All numeric values have correct types")


class TestRaceParticipantsWithRegistrations:
    """Test /api/race/participants endpoint with race_code parameter"""
    
    def test_participants_endpoint_returns_200(self):
        """GET /api/race/participants?race_code=BYSD-2027 returns 200"""
        response = requests.get(f"{BASE_URL}/api/race/participants?race_code={RACE_CODE}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✓ Participants endpoint returns 200")
    
    def test_participants_returns_list(self):
        """Participants endpoint returns a list"""
        response = requests.get(f"{BASE_URL}/api/race/participants?race_code={RACE_CODE}")
        data = response.json()
        
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"✓ Participants endpoint returns list with {len(data)} items")
    
    def test_participants_from_registrations_have_active_status(self):
        """Participants from registrations have status 'active'"""
        response = requests.get(f"{BASE_URL}/api/race/participants?race_code={RACE_CODE}")
        data = response.json()
        
        # All returned participants should have valid race statuses
        valid_statuses = ['active', 'retired', 'dns', 'winner', 'honor']
        for p in data:
            assert p.get('status') in valid_statuses, f"Invalid status: {p.get('status')}"
        print(f"✓ All participants have valid race statuses")
    
    def test_participants_have_required_fields(self):
        """Participants have required fields for race control"""
        response = requests.get(f"{BASE_URL}/api/race/participants?race_code={RACE_CODE}")
        data = response.json()
        
        if len(data) > 0:
            required_fields = ['bib', 'nombre', 'apellidos', 'status', 'laps_completed', 'total_km']
            for field in required_fields:
                assert field in data[0], f"Missing field: {field}"
            print(f"✓ Participants have all required fields: {required_fields}")
        else:
            print("⚠ No participants to verify fields")
    
    def test_participants_exclude_pre_registered(self):
        """Participants endpoint excludes pre_registered status"""
        response = requests.get(f"{BASE_URL}/api/race/participants?race_code={RACE_CODE}")
        data = response.json()
        
        for p in data:
            assert p.get('status') != 'pre_registered', f"Found pre_registered participant: {p.get('nombre')}"
        print(f"✓ No pre_registered participants in response")
    
    def test_participants_have_bib_assigned(self):
        """All participants have BIB assigned"""
        response = requests.get(f"{BASE_URL}/api/race/participants?race_code={RACE_CODE}")
        data = response.json()
        
        for p in data:
            assert p.get('bib') is not None, f"Participant without BIB: {p.get('nombre')}"
        print(f"✓ All participants have BIB assigned")
    
    def test_test_participant_in_list(self):
        """Test participant (Cristhian Arroyo) appears in participants list"""
        response = requests.get(f"{BASE_URL}/api/race/participants?race_code={RACE_CODE}")
        data = response.json()
        
        found = any(p.get('email') == TEST_EMAIL for p in data)
        assert found, f"Test participant {TEST_EMAIL} not found in participants list"
        print(f"✓ Test participant {TEST_EMAIL} found in participants list")
    
    def test_participants_filter_by_status(self):
        """Participants can be filtered by status"""
        response = requests.get(f"{BASE_URL}/api/race/participants?race_code={RACE_CODE}&status=active")
        assert response.status_code == 200
        data = response.json()
        
        for p in data:
            assert p.get('status') == 'active', f"Expected active status, got {p.get('status')}"
        print(f"✓ Status filter works correctly")
    
    def test_participants_search_by_name(self):
        """Participants can be searched by name"""
        response = requests.get(f"{BASE_URL}/api/race/participants?race_code={RACE_CODE}&search=Cristhian")
        assert response.status_code == 200
        data = response.json()
        
        # Should find Cristhian Arroyo
        assert len(data) >= 1, "Search should return at least 1 result"
        print(f"✓ Search by name works correctly")


class TestRegistrationStatusChange:
    """Test that changing status from pre_registered to active makes participant appear in Race Control"""
    
    def test_active_registration_appears_in_stats(self):
        """Registration with status 'active' is counted in stats"""
        # Get stats
        response = requests.get(f"{BASE_URL}/api/race/stats?race_code={RACE_CODE}")
        data = response.json()
        
        # Should have at least 1 active athlete
        assert data['athletes_active'] >= 1, "Should have at least 1 active athlete"
        print(f"✓ Active registration counted in stats: {data['athletes_active']} active")
    
    def test_active_registration_appears_in_participants(self):
        """Registration with status 'active' appears in participants list"""
        response = requests.get(f"{BASE_URL}/api/race/participants?race_code={RACE_CODE}")
        data = response.json()
        
        # Find our test participant
        test_participant = next((p for p in data if p.get('email') == TEST_EMAIL), None)
        assert test_participant is not None, f"Test participant {TEST_EMAIL} not found"
        assert test_participant.get('status') == 'active', f"Expected active status, got {test_participant.get('status')}"
        print(f"✓ Active registration appears in participants list with status 'active'")


class TestFallbackToOldParticipants:
    """Test fallback behavior when no registrations exist"""
    
    def test_stats_with_nonexistent_race_code(self):
        """Pedir una carrera que no existe es un 404, no unas cifras en blanco.

        Antes caia en la carrera activa y devolvia 200: con una sola carrera
        viva apenas se notaba, pero con el campeonato y la carrera abierta a la
        vez un codigo mal escrito ensenaba las cifras de otra carrera como si
        fueran las pedidas.
        """
        response = requests.get(f"{BASE_URL}/api/race/stats?race_code=NONEXISTENT-RACE")
        assert response.status_code == 404
        print(f"✓ Stats with non-existent race_code returns 404")
    
    def test_participants_with_nonexistent_race_code(self):
        """Participants with non-existent race_code falls back to old participants"""
        response = requests.get(f"{BASE_URL}/api/race/participants?race_code=NONEXISTENT-RACE")
        assert response.status_code == 200
        data = response.json()
        
        # Should return list (possibly from old participants)
        assert isinstance(data, list)
        print(f"✓ Participants with non-existent race_code returns valid list")


class TestRaceControlPanelIntegration:
    """Integration tests for Race Control Panel with registrations"""
    
    def test_stats_and_participants_consistency(self):
        """Stats athletes_active matches participants count"""
        stats_response = requests.get(f"{BASE_URL}/api/race/stats?race_code={RACE_CODE}")
        participants_response = requests.get(f"{BASE_URL}/api/race/participants?race_code={RACE_CODE}&status=active")
        
        stats = stats_response.json()
        participants = participants_response.json()
        
        # Active count should match
        assert stats['athletes_active'] == len(participants), \
            f"Stats shows {stats['athletes_active']} active, but participants list has {len(participants)}"
        print(f"✓ Stats and participants are consistent: {stats['athletes_active']} active athletes")
    
    def test_participant_data_completeness(self):
        """Participant data is complete for race control display"""
        response = requests.get(f"{BASE_URL}/api/race/participants?race_code={RACE_CODE}")
        data = response.json()
        
        if len(data) > 0:
            p = data[0]
            # Check all fields needed for race control panel
            assert p.get('bib') is not None, "BIB is required"
            assert p.get('nombre') is not None, "nombre is required"
            assert p.get('apellidos') is not None, "apellidos is required"
            assert p.get('status') is not None, "status is required"
            assert 'laps_completed' in p, "laps_completed is required"
            assert 'total_km' in p, "total_km is required"
            print(f"✓ Participant data is complete for race control display")
        else:
            print("⚠ No participants to verify completeness")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
