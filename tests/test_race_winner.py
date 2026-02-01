"""
Backend tests for Backyard Ultra Santo Domingo 2026 - Race Tracking System
Tests for winner detection logic, lap completion, and athlete retirement

Key features tested:
- GET /api/race/stats - Winner detection logic
- POST /api/race/complete-lap-all-active - Lap completion for active athletes
- POST /api/race/mark-retired - Marking athletes as DNF
- POST /api/race/auth/admin-login - Admin authentication
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://eventadmin-6.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "Backyard2026!"


class TestAdminAuth:
    """Test admin authentication"""
    
    def test_admin_login_success(self):
        """Test successful admin login"""
        response = requests.post(f"{BASE_URL}/api/race/auth/admin-login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "Token not in response"
        assert "username" in data, "Username not in response"
        assert data["username"] == ADMIN_USERNAME
        print(f"✓ Admin login successful, token received")
    
    def test_admin_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/race/auth/admin-login", json={
            "username": "wrong_user",
            "password": "wrong_pass"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ Invalid credentials correctly rejected")


class TestRaceStats:
    """Test race statistics endpoint"""
    
    def test_get_stats_initial_state(self):
        """Test stats when race is in initial state (no winner)"""
        response = requests.get(f"{BASE_URL}/api/race/stats")
        assert response.status_code == 200, f"Stats request failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "current_lap" in data
        assert "total_laps_completed" in data
        assert "athletes_dnf" in data
        assert "athletes_active" in data
        assert "athletes_dns" in data
        assert "total_km" in data
        assert "total_km_all_athletes" in data
        assert "winner" in data
        
        print(f"✓ Stats structure verified")
        print(f"  Current lap: {data['current_lap']}")
        print(f"  Active athletes: {data['athletes_active']}")
        print(f"  DNF athletes: {data['athletes_dnf']}")
        print(f"  Winner: {data['winner']}")
        
        return data
    
    def test_winner_null_with_multiple_active(self):
        """Test that winner is null when multiple athletes are active"""
        response = requests.get(f"{BASE_URL}/api/race/stats")
        assert response.status_code == 200
        data = response.json()
        
        if data['athletes_active'] > 1:
            assert data['winner'] is None, f"Winner should be null with {data['athletes_active']} active athletes"
            print(f"✓ Winner correctly null with {data['athletes_active']} active athletes")
        else:
            print(f"⚠ Only {data['athletes_active']} active athlete(s), skipping multi-active test")


class TestParticipants:
    """Test participants endpoint"""
    
    def test_get_all_participants(self):
        """Test getting all participants"""
        response = requests.get(f"{BASE_URL}/api/race/participants")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0, "No participants found"
        
        # Verify participant structure
        participant = data[0]
        assert "bib" in participant
        assert "nombre" in participant
        assert "apellidos" in participant
        assert "nacionalidad" in participant
        assert "status" in participant
        assert "laps_completed" in participant
        assert "total_km" in participant
        
        print(f"✓ Got {len(data)} participants")
        return data
    
    def test_filter_active_participants(self):
        """Test filtering active participants"""
        response = requests.get(f"{BASE_URL}/api/race/participants?status=active")
        assert response.status_code == 200
        data = response.json()
        
        for p in data:
            assert p['status'] == 'active', f"Participant {p['bib']} is not active"
        
        print(f"✓ Filtered {len(data)} active participants")
    
    def test_filter_retired_participants(self):
        """Test filtering retired participants"""
        response = requests.get(f"{BASE_URL}/api/race/participants?status=retired")
        assert response.status_code == 200
        data = response.json()
        
        for p in data:
            assert p['status'] == 'retired', f"Participant {p['bib']} is not retired"
        
        print(f"✓ Filtered {len(data)} retired participants")


class TestWinnerLogic:
    """
    Test the winner detection logic
    Winner conditions:
    1. Only 1 active athlete remaining
    2. At least 1 retired athlete
    3. Active athlete has MORE laps than all retired athletes
    """
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/race/auth/admin-login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json()["token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Could not authenticate")
    
    def test_complete_lap_all_active(self):
        """Test completing a lap for all active athletes"""
        # Get initial stats
        stats_before = requests.get(f"{BASE_URL}/api/race/stats").json()
        initial_lap = stats_before['current_lap']
        
        # Complete lap for all active
        response = requests.post(
            f"{BASE_URL}/api/race/complete-lap-all-active",
            headers=self.headers
        )
        assert response.status_code == 200, f"Complete lap failed: {response.text}"
        data = response.json()
        
        assert "updated_count" in data
        assert "new_lap" in data
        assert data['new_lap'] == initial_lap + 1
        
        print(f"✓ Completed lap {initial_lap} for {data['updated_count']} athletes")
        print(f"  New current lap: {data['new_lap']}")
        
        # Verify stats updated
        stats_after = requests.get(f"{BASE_URL}/api/race/stats").json()
        assert stats_after['current_lap'] == initial_lap + 1
        assert stats_after['total_laps_completed'] == initial_lap
        
        print(f"✓ Stats correctly updated after lap completion")
    
    def test_mark_retired(self):
        """Test marking an athlete as retired (DNF)"""
        # Get an active participant
        participants = requests.get(f"{BASE_URL}/api/race/participants?status=active").json()
        if not participants:
            pytest.skip("No active participants to retire")
        
        # Pick the last active participant (to preserve others for winner test)
        participant = participants[-1]
        bib = participant['bib']
        
        # Get current lap
        stats = requests.get(f"{BASE_URL}/api/race/stats").json()
        current_lap = stats['current_lap']
        
        # Mark as retired
        response = requests.post(
            f"{BASE_URL}/api/race/mark-retired",
            headers=self.headers,
            json={"bib": bib, "retired_at_lap": current_lap}
        )
        assert response.status_code == 200, f"Mark retired failed: {response.text}"
        data = response.json()
        
        assert "laps_completed" in data
        assert "total_km" in data
        
        print(f"✓ Marked participant {bib} as DNF at lap {current_lap}")
        print(f"  Laps completed: {data['laps_completed']}")
        print(f"  Total km: {data['total_km']}")
        
        # Verify participant is now retired
        participants_after = requests.get(f"{BASE_URL}/api/race/participants").json()
        retired_participant = next((p for p in participants_after if p['bib'] == bib), None)
        assert retired_participant is not None
        assert retired_participant['status'] == 'retired'
        
        print(f"✓ Participant {bib} status correctly updated to retired")
    
    def test_mark_retired_already_retired(self):
        """Test that marking an already retired athlete fails"""
        # Get a retired participant
        participants = requests.get(f"{BASE_URL}/api/race/participants?status=retired").json()
        if not participants:
            pytest.skip("No retired participants to test")
        
        participant = participants[0]
        bib = participant['bib']
        
        # Try to mark as retired again
        response = requests.post(
            f"{BASE_URL}/api/race/mark-retired",
            headers=self.headers,
            json={"bib": bib, "retired_at_lap": 1}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print(f"✓ Correctly rejected re-retiring participant {bib}")


class TestWinnerScenario:
    """
    Full scenario test for winner detection
    This test simulates the race progression to determine a winner
    """
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/race/auth/admin-login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json()["token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Could not authenticate")
    
    def test_winner_scenario_simulation(self):
        """
        Simulate a winner scenario:
        1. Start with multiple active athletes
        2. Retire all but one
        3. Complete a lap with the last athlete
        4. Verify winner is detected
        
        NOTE: This test modifies the database state significantly
        """
        # Get initial state
        stats = requests.get(f"{BASE_URL}/api/race/stats").json()
        print(f"\n=== Winner Scenario Test ===")
        print(f"Initial state: {stats['athletes_active']} active, {stats['athletes_dnf']} DNF")
        
        # Get all active participants
        active = requests.get(f"{BASE_URL}/api/race/participants?status=active").json()
        
        if len(active) < 2:
            print(f"⚠ Not enough active athletes ({len(active)}) to run full scenario")
            # Check if we already have a winner
            if stats['winner']:
                print(f"✓ Winner already determined: {stats['winner']['nombre']} {stats['winner']['apellidos']}")
                return
            pytest.skip("Not enough active athletes for winner scenario")
        
        # Keep track of the potential winner (first active athlete)
        potential_winner = active[0]
        print(f"Potential winner: {potential_winner['bib']} - {potential_winner['nombre']} {potential_winner['apellidos']}")
        
        # Retire all other athletes
        current_lap = stats['current_lap']
        retired_count = 0
        
        for participant in active[1:]:  # Skip the first one (potential winner)
            response = requests.post(
                f"{BASE_URL}/api/race/mark-retired",
                headers=self.headers,
                json={"bib": participant['bib'], "retired_at_lap": current_lap}
            )
            if response.status_code == 200:
                retired_count += 1
            else:
                print(f"⚠ Failed to retire {participant['bib']}: {response.text}")
        
        print(f"Retired {retired_count} athletes")
        
        # Check stats - should have 1 active, but no winner yet
        stats_mid = requests.get(f"{BASE_URL}/api/race/stats").json()
        print(f"After retirements: {stats_mid['athletes_active']} active, {stats_mid['athletes_dnf']} DNF")
        
        # At this point, the last active athlete has the same laps as retired athletes
        # So there should be NO winner yet
        if stats_mid['athletes_active'] == 1:
            # The winner logic requires the active athlete to have MORE laps than retired
            # Since retired athletes completed the lap before retiring, they have the same laps
            # So winner should still be null
            print(f"Winner status (before final lap): {stats_mid['winner']}")
            
            # Now complete a lap with the last active athlete
            response = requests.post(
                f"{BASE_URL}/api/race/complete-lap-all-active",
                headers=self.headers
            )
            assert response.status_code == 200, f"Complete lap failed: {response.text}"
            
            # Now check for winner
            stats_final = requests.get(f"{BASE_URL}/api/race/stats").json()
            print(f"After final lap: Current lap {stats_final['current_lap']}")
            print(f"Winner: {stats_final['winner']}")
            
            # Verify winner is detected
            assert stats_final['winner'] is not None, "Winner should be detected after final lap"
            assert stats_final['winner']['bib'] == potential_winner['bib'], "Wrong winner detected"
            
            print(f"\n✓ WINNER DETECTED!")
            print(f"  BIB: {stats_final['winner']['bib']}")
            print(f"  Name: {stats_final['winner']['nombre']} {stats_final['winner']['apellidos']}")
            print(f"  Nationality: {stats_final['winner']['nacionalidad']}")
            print(f"  Laps: {stats_final['winner']['laps_completed']}")
            print(f"  Total KM: {stats_final['winner']['total_km']}")
        else:
            print(f"⚠ Expected 1 active athlete, got {stats_mid['athletes_active']}")


class TestUnauthorizedAccess:
    """Test that protected endpoints require authentication"""
    
    def test_complete_lap_unauthorized(self):
        """Test that complete-lap-all-active requires auth"""
        response = requests.post(f"{BASE_URL}/api/race/complete-lap-all-active")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ Complete lap correctly requires authentication")
    
    def test_mark_retired_unauthorized(self):
        """Test that mark-retired requires auth"""
        response = requests.post(
            f"{BASE_URL}/api/race/mark-retired",
            json={"bib": "001", "retired_at_lap": 1}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ Mark retired correctly requires authentication")
    
    def test_set_current_lap_unauthorized(self):
        """Test that set-current-lap requires auth"""
        response = requests.post(
            f"{BASE_URL}/api/race/set-current-lap",
            json={"current_lap": 5}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ Set current lap correctly requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
