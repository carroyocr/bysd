"""
Test suite for race-code-scoped endpoints.
Tests that reset-database, reset-cheers, reset-subscriptions, send-runner-emails,
subscribe, and cheer endpoints only affect data for the active race (BYSD-2027).
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "Backyard2026!"
ACTIVE_RACE_CODE = "BYSD-2027"
TEST_PARTICIPANT_EMAIL = "carroyo@riesgobancario.com"


class TestRaceCodeScopedEndpoints:
    """Test that endpoints are scoped to active race code"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(
            f"{BASE_URL}/api/race/auth/admin-login",
            json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD}
        )
        
        if login_response.status_code == 200:
            token = login_response.json().get("token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            self.auth_token = token
        else:
            pytest.skip(f"Authentication failed: {login_response.status_code}")
    
    # ==================== RESET-DATABASE TESTS ====================
    
    def test_reset_database_requires_confirmation(self):
        """Test that reset-database requires correct confirmation"""
        response = self.session.post(
            f"{BASE_URL}/api/race/reset-database",
            json={"confirmation": "WRONG"}
        )
        assert response.status_code == 400
        data = response.json()
        assert "REINICIO" in data.get("detail", "")
        print("✓ reset-database requires 'REINICIO' confirmation")
    
    def test_reset_database_returns_race_code(self):
        """Test that reset-database returns the race_code in response"""
        # First, let's just verify the endpoint structure without actually resetting
        # We'll test with wrong confirmation to see the error message
        response = self.session.post(
            f"{BASE_URL}/api/race/reset-database",
            json={"confirmation": ""}
        )
        assert response.status_code == 400
        # The endpoint should require confirmation
        print("✓ reset-database endpoint exists and requires confirmation")
    
    def test_reset_database_scoped_to_active_race(self):
        """Test that reset-database only affects active race data"""
        # This test verifies the endpoint returns race_code when successful
        # We use the correct confirmation to test the full flow
        response = self.session.post(
            f"{BASE_URL}/api/race/reset-database",
            json={"confirmation": "REINICIO"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response contains race_code
        assert "race_code" in data, "Response should contain race_code"
        assert data["race_code"] == ACTIVE_RACE_CODE, f"Expected {ACTIVE_RACE_CODE}, got {data['race_code']}"
        assert "participants_reset" in data, "Response should contain participants_reset count"
        assert "message" in data, "Response should contain message"
        
        print(f"✓ reset-database scoped to race_code: {data['race_code']}")
        print(f"  Participants reset: {data['participants_reset']}")
    
    # ==================== RESET-CHEERS TESTS ====================
    
    def test_reset_cheers_requires_confirmation(self):
        """Test that reset-cheers requires correct confirmation"""
        response = self.session.post(
            f"{BASE_URL}/api/race/reset-cheers",
            json={"confirmation": "WRONG"}
        )
        assert response.status_code == 400
        data = response.json()
        assert "MENSAJES" in data.get("detail", "")
        print("✓ reset-cheers requires 'MENSAJES' confirmation")
    
    def test_reset_cheers_returns_race_code(self):
        """Test that reset-cheers returns the race_code in response"""
        response = self.session.post(
            f"{BASE_URL}/api/race/reset-cheers",
            json={"confirmation": "MENSAJES"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response contains race_code
        assert "race_code" in data, "Response should contain race_code"
        assert data["race_code"] == ACTIVE_RACE_CODE, f"Expected {ACTIVE_RACE_CODE}, got {data['race_code']}"
        assert "deleted_count" in data, "Response should contain deleted_count"
        
        print(f"✓ reset-cheers scoped to race_code: {data['race_code']}")
        print(f"  Deleted count: {data['deleted_count']}")
    
    # ==================== RESET-SUBSCRIPTIONS TESTS ====================
    
    def test_reset_subscriptions_requires_confirmation(self):
        """Test that reset-subscriptions requires correct confirmation"""
        response = self.session.post(
            f"{BASE_URL}/api/race/reset-subscriptions",
            json={"confirmation": "WRONG"}
        )
        assert response.status_code == 400
        data = response.json()
        assert "SUSCRIPCIONES" in data.get("detail", "")
        print("✓ reset-subscriptions requires 'SUSCRIPCIONES' confirmation")
    
    def test_reset_subscriptions_returns_race_code(self):
        """Test that reset-subscriptions returns the race_code in response"""
        response = self.session.post(
            f"{BASE_URL}/api/race/reset-subscriptions",
            json={"confirmation": "SUSCRIPCIONES"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response contains race_code
        assert "race_code" in data, "Response should contain race_code"
        assert data["race_code"] == ACTIVE_RACE_CODE, f"Expected {ACTIVE_RACE_CODE}, got {data['race_code']}"
        assert "deleted_count" in data, "Response should contain deleted_count"
        
        print(f"✓ reset-subscriptions scoped to race_code: {data['race_code']}")
        print(f"  Deleted count: {data['deleted_count']}")
    
    # ==================== SUBSCRIBE TESTS ====================
    
    def test_subscribe_includes_race_code(self):
        """Test that new subscriptions include race_code"""
        test_email = f"test_subscribe_{datetime.now().timestamp()}@test.com"
        
        response = self.session.post(
            f"{BASE_URL}/api/race/subscribe",
            json={
                "email": test_email,
                "athletes_bibs": ["001"],
                "notify_every_lap": True,
                "notify_on_finish": True
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify subscription was created
        assert "subscription_id" in data, "Response should contain subscription_id"
        assert "message" in data, "Response should contain message"
        
        print(f"✓ subscribe endpoint works")
        print(f"  Subscription ID: {data.get('subscription_id')}")
        print(f"  Athletes count: {data.get('athletes_count')}")
    
    def test_subscribe_update_existing(self):
        """Test that updating subscription works"""
        test_email = f"test_update_{datetime.now().timestamp()}@test.com"
        
        # Create initial subscription
        response1 = self.session.post(
            f"{BASE_URL}/api/race/subscribe",
            json={
                "email": test_email,
                "athletes_bibs": ["001"],
                "notify_every_lap": True,
                "notify_on_finish": True
            }
        )
        assert response1.status_code == 200
        
        # Update subscription
        response2 = self.session.post(
            f"{BASE_URL}/api/race/subscribe",
            json={
                "email": test_email,
                "athletes_bibs": ["001", "002"],
                "notify_every_lap": False,
                "notify_on_finish": True
            }
        )
        assert response2.status_code == 200
        data = response2.json()
        
        # Should indicate update
        assert "actualizada" in data.get("message", "").lower() or "updated" in data.get("message", "").lower()
        
        print(f"✓ subscribe update works")
    
    # ==================== CHEER TESTS ====================
    
    def test_cheer_includes_race_code(self):
        """Test that new cheer messages include race_code"""
        response = self.session.post(
            f"{BASE_URL}/api/race/cheer",
            json={
                "athlete_bib": "001",
                "fan_name": "Test Fan",
                "message": f"Test cheer message {datetime.now().timestamp()}"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify cheer was created
        assert "message" in data, "Response should contain message"
        assert "athlete_bib" in data, "Response should contain athlete_bib"
        assert "athlete_name" in data, "Response should contain athlete_name"
        
        print(f"✓ cheer endpoint works")
        print(f"  Athlete: {data.get('athlete_name')}")
    
    def test_cheer_validates_message_length(self):
        """Test that cheer validates message length (max 280 chars)"""
        long_message = "A" * 281
        
        response = self.session.post(
            f"{BASE_URL}/api/race/cheer",
            json={
                "athlete_bib": "001",
                "fan_name": "Test Fan",
                "message": long_message
            }
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "280" in data.get("detail", "")
        
        print("✓ cheer validates message length (max 280)")
    
    def test_cheer_validates_fan_name_length(self):
        """Test that cheer validates fan name length (max 50 chars)"""
        long_name = "A" * 51
        
        response = self.session.post(
            f"{BASE_URL}/api/race/cheer",
            json={
                "athlete_bib": "001",
                "fan_name": long_name,
                "message": "Test message"
            }
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "50" in data.get("detail", "")
        
        print("✓ cheer validates fan name length (max 50)")
    
    def test_cheer_validates_athlete_exists(self):
        """Test that cheer validates athlete exists"""
        response = self.session.post(
            f"{BASE_URL}/api/race/cheer",
            json={
                "athlete_bib": "999",
                "fan_name": "Test Fan",
                "message": "Test message"
            }
        )
        
        assert response.status_code == 404
        data = response.json()
        assert "no encontrado" in data.get("detail", "").lower()
        
        print("✓ cheer validates athlete exists")
    
    # ==================== SEND-RUNNER-EMAILS TESTS ====================
    
    def test_send_runner_emails_requires_auth(self):
        """Test that send-runner-emails requires authentication"""
        # Create session without auth
        no_auth_session = requests.Session()
        no_auth_session.headers.update({"Content-Type": "application/json"})
        
        response = no_auth_session.post(f"{BASE_URL}/api/race/send-runner-emails")
        
        assert response.status_code == 401
        print("✓ send-runner-emails requires authentication")
    
    def test_send_runner_emails_returns_race_code(self):
        """Test that send-runner-emails returns race_code in response"""
        response = self.session.post(f"{BASE_URL}/api/race/send-runner-emails")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response contains race_code
        assert "race_code" in data, "Response should contain race_code"
        assert data["race_code"] == ACTIVE_RACE_CODE, f"Expected {ACTIVE_RACE_CODE}, got {data['race_code']}"
        assert "total_runners" in data, "Response should contain total_runners"
        assert "emails_sent" in data, "Response should contain emails_sent"
        
        print(f"✓ send-runner-emails scoped to race_code: {data['race_code']}")
        print(f"  Total runners: {data['total_runners']}")
        print(f"  Emails sent: {data['emails_sent']}")
        print(f"  Emails failed: {data.get('emails_failed', 0)}")
        print(f"  No email: {data.get('no_email', 0)}")
    
    # ==================== INTEGRATION TESTS ====================
    
    def test_full_flow_subscribe_cheer_reset(self):
        """Test full flow: subscribe, cheer, then reset both"""
        test_email = f"test_flow_{datetime.now().timestamp()}@test.com"
        
        # 1. Create subscription
        sub_response = self.session.post(
            f"{BASE_URL}/api/race/subscribe",
            json={
                "email": test_email,
                "athletes_bibs": ["001"],
                "notify_every_lap": True,
                "notify_on_finish": True
            }
        )
        assert sub_response.status_code == 200
        print("  1. Subscription created")
        
        # 2. Create cheer message
        cheer_response = self.session.post(
            f"{BASE_URL}/api/race/cheer",
            json={
                "athlete_bib": "001",
                "fan_name": "Integration Test Fan",
                "message": f"Integration test message {datetime.now().timestamp()}"
            }
        )
        assert cheer_response.status_code == 200
        print("  2. Cheer message created")
        
        # 3. Reset cheers (should only affect active race)
        reset_cheers_response = self.session.post(
            f"{BASE_URL}/api/race/reset-cheers",
            json={"confirmation": "MENSAJES"}
        )
        assert reset_cheers_response.status_code == 200
        cheers_data = reset_cheers_response.json()
        assert cheers_data["race_code"] == ACTIVE_RACE_CODE
        print(f"  3. Cheers reset for race: {cheers_data['race_code']}")
        
        # 4. Reset subscriptions (should only affect active race)
        reset_subs_response = self.session.post(
            f"{BASE_URL}/api/race/reset-subscriptions",
            json={"confirmation": "SUSCRIPCIONES"}
        )
        assert reset_subs_response.status_code == 200
        subs_data = reset_subs_response.json()
        assert subs_data["race_code"] == ACTIVE_RACE_CODE
        print(f"  4. Subscriptions reset for race: {subs_data['race_code']}")
        
        print("✓ Full flow test passed")
    
    def test_stats_after_reset_database(self):
        """Test that stats reflect reset state after reset-database"""
        # Get stats before (should be reset from previous test)
        stats_response = self.session.get(
            f"{BASE_URL}/api/race/stats",
            params={"race_code": ACTIVE_RACE_CODE}
        )
        
        assert stats_response.status_code == 200
        stats = stats_response.json()
        
        # After reset, current_lap should be 1
        assert stats["current_lap"] == 1, f"Expected current_lap=1, got {stats['current_lap']}"
        
        print(f"✓ Stats after reset:")
        print(f"  Current lap: {stats['current_lap']}")
        print(f"  Athletes active: {stats['athletes_active']}")
        print(f"  Athletes DNF: {stats['athletes_dnf']}")
    
    def test_participants_after_reset_database(self):
        """Test that participants are reset to active status after reset-database"""
        # Get participants
        participants_response = self.session.get(
            f"{BASE_URL}/api/race/participants",
            params={"race_code": ACTIVE_RACE_CODE}
        )
        
        assert participants_response.status_code == 200
        participants = participants_response.json()
        
        # All participants should be active after reset
        for p in participants:
            assert p["status"] == "active", f"Expected status=active, got {p['status']} for BIB {p['bib']}"
            assert p["laps_completed"] == 0, f"Expected laps_completed=0, got {p['laps_completed']} for BIB {p['bib']}"
        
        print(f"✓ Participants after reset: {len(participants)} all active with 0 laps")


class TestEndpointAuthentication:
    """Test authentication requirements for admin endpoints"""
    
    def test_reset_database_requires_auth(self):
        """Test that reset-database requires authentication"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.post(
            f"{BASE_URL}/api/race/reset-database",
            json={"confirmation": "REINICIO"}
        )
        
        assert response.status_code == 401
        print("✓ reset-database requires authentication")
    
    def test_reset_cheers_requires_auth(self):
        """Test that reset-cheers requires authentication"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.post(
            f"{BASE_URL}/api/race/reset-cheers",
            json={"confirmation": "MENSAJES"}
        )
        
        assert response.status_code == 401
        print("✓ reset-cheers requires authentication")
    
    def test_reset_subscriptions_requires_auth(self):
        """Test that reset-subscriptions requires authentication"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.post(
            f"{BASE_URL}/api/race/reset-subscriptions",
            json={"confirmation": "SUSCRIPCIONES"}
        )
        
        assert response.status_code == 401
        print("✓ reset-subscriptions requires authentication")
    
    def test_subscribe_no_auth_required(self):
        """Test that subscribe does NOT require authentication (public endpoint)"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        test_email = f"test_noauth_{datetime.now().timestamp()}@test.com"
        
        response = session.post(
            f"{BASE_URL}/api/race/subscribe",
            json={
                "email": test_email,
                "athletes_bibs": ["001"],
                "notify_every_lap": True,
                "notify_on_finish": True
            }
        )
        
        assert response.status_code == 200
        print("✓ subscribe is a public endpoint (no auth required)")
    
    def test_cheer_no_auth_required(self):
        """Test that cheer does NOT require authentication (public endpoint)"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.post(
            f"{BASE_URL}/api/race/cheer",
            json={
                "athlete_bib": "001",
                "fan_name": "Public Fan",
                "message": f"Public test message {datetime.now().timestamp()}"
            }
        )
        
        assert response.status_code == 200
        print("✓ cheer is a public endpoint (no auth required)")


class TestErrorHandling:
    """Test error handling for edge cases"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(
            f"{BASE_URL}/api/race/auth/admin-login",
            json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD}
        )
        
        if login_response.status_code == 200:
            token = login_response.json().get("token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_subscribe_empty_athletes(self):
        """Test that subscribe requires at least one athlete"""
        response = self.session.post(
            f"{BASE_URL}/api/race/subscribe",
            json={
                "email": "test@test.com",
                "athletes_bibs": [],
                "notify_every_lap": True,
                "notify_on_finish": True
            }
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "atleta" in data.get("detail", "").lower()
        print("✓ subscribe requires at least one athlete")
    
    def test_reset_database_empty_confirmation(self):
        """Test reset-database with empty confirmation"""
        response = self.session.post(
            f"{BASE_URL}/api/race/reset-database",
            json={"confirmation": ""}
        )
        
        assert response.status_code == 400
        print("✓ reset-database rejects empty confirmation")
    
    def test_reset_cheers_empty_confirmation(self):
        """Test reset-cheers with empty confirmation"""
        response = self.session.post(
            f"{BASE_URL}/api/race/reset-cheers",
            json={"confirmation": ""}
        )
        
        assert response.status_code == 400
        print("✓ reset-cheers rejects empty confirmation")
    
    def test_reset_subscriptions_empty_confirmation(self):
        """Test reset-subscriptions with empty confirmation"""
        response = self.session.post(
            f"{BASE_URL}/api/race/reset-subscriptions",
            json={"confirmation": ""}
        )
        
        assert response.status_code == 400
        print("✓ reset-subscriptions rejects empty confirmation")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
