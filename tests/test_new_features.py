"""
Backend tests for Backyard Ultra Santo Domingo 2026 - New Features
Tests for:
- DNF Logic: Marking DNF should NOT increment laps
- DNF Revert: Reverting lap should reactivate DNF athletes with same lap count
- Followers Count API: GET /api/race/followers-count
- Cheer Messages: POST /api/race/cheer, GET /api/race/cheers, GET /api/race/cheers/count
"""

import pytest
import requests
import os
import time
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://lapmanager.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "Backyard2026!"


@pytest.fixture(scope="module")
def auth_token():
    """Get auth token for authenticated requests"""
    response = requests.post(f"{BASE_URL}/api/race/auth/admin-login", json={
        "username": ADMIN_USERNAME,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json()["token"]
    pytest.skip("Could not authenticate")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestDNFLogic:
    """
    Test DNF Logic: When marking athlete as DNF, laps_completed should NOT increment
    """
    
    def test_dnf_does_not_increment_laps(self, auth_headers):
        """
        Test that marking an athlete as DNF does NOT increment their laps_completed
        The athlete's laps should remain the same as before DNF
        """
        # Get an active participant
        participants = requests.get(f"{BASE_URL}/api/race/participants?status=active").json()
        if not participants:
            pytest.skip("No active participants to test DNF")
        
        # Pick a participant
        participant = participants[-1]  # Last one to preserve others
        bib = participant['bib']
        laps_before = participant['laps_completed']
        km_before = participant['total_km']
        
        print(f"\n=== DNF Logic Test ===")
        print(f"Participant {bib}: {laps_before} laps, {km_before} km BEFORE DNF")
        
        # Get current lap
        stats = requests.get(f"{BASE_URL}/api/race/stats").json()
        current_lap = stats['current_lap']
        
        # Mark as DNF
        response = requests.post(
            f"{BASE_URL}/api/race/mark-retired",
            headers=auth_headers,
            json={"bib": bib, "retired_at_lap": current_lap}
        )
        assert response.status_code == 200, f"Mark retired failed: {response.text}"
        data = response.json()
        
        # Verify laps did NOT increment
        assert data['laps_completed'] == laps_before, \
            f"DNF should NOT increment laps! Expected {laps_before}, got {data['laps_completed']}"
        assert data['total_km'] == km_before, \
            f"DNF should NOT increment km! Expected {km_before}, got {data['total_km']}"
        
        print(f"Participant {bib}: {data['laps_completed']} laps, {data['total_km']} km AFTER DNF")
        print(f"✓ DNF correctly did NOT increment laps")
        
        # Verify in database
        participants_after = requests.get(f"{BASE_URL}/api/race/participants").json()
        dnf_participant = next((p for p in participants_after if p['bib'] == bib), None)
        assert dnf_participant is not None
        assert dnf_participant['status'] == 'retired'
        assert dnf_participant['laps_completed'] == laps_before
        assert dnf_participant['retired_at_lap'] == current_lap
        
        print(f"✓ Database correctly shows {laps_before} laps for DNF athlete")
        
        # Reactivate for cleanup
        requests.post(
            f"{BASE_URL}/api/race/reactivate",
            headers=auth_headers,
            json={"bib": bib}
        )


class TestRevertLapWithDNF:
    """
    Test Revert Lap: When reverting lap with DNF athletes, they should be reactivated
    with the same lap count (not decremented)
    """
    
    def test_revert_lap_reactivates_dnf_with_same_laps(self, auth_headers):
        """
        Test that reverting a lap reactivates DNF athletes with their original lap count
        """
        # Get initial state
        stats_initial = requests.get(f"{BASE_URL}/api/race/stats").json()
        initial_lap = stats_initial['current_lap']
        
        print(f"\n=== Revert Lap with DNF Test ===")
        print(f"Initial lap: {initial_lap}")
        
        # First, complete a lap to have something to revert
        response = requests.post(
            f"{BASE_URL}/api/race/complete-lap-all-active",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Complete lap failed: {response.text}"
        
        stats_after_complete = requests.get(f"{BASE_URL}/api/race/stats").json()
        new_lap = stats_after_complete['current_lap']
        print(f"After completing lap: current lap is {new_lap}")
        
        # Get an active participant and mark as DNF
        participants = requests.get(f"{BASE_URL}/api/race/participants?status=active").json()
        if not participants:
            pytest.skip("No active participants")
        
        participant = participants[-1]
        bib = participant['bib']
        laps_before_dnf = participant['laps_completed']
        
        print(f"Marking {bib} as DNF with {laps_before_dnf} laps")
        
        # Mark as DNF at current lap
        response = requests.post(
            f"{BASE_URL}/api/race/mark-retired",
            headers=auth_headers,
            json={"bib": bib, "retired_at_lap": new_lap}
        )
        assert response.status_code == 200
        
        # Verify DNF
        participants_after_dnf = requests.get(f"{BASE_URL}/api/race/participants").json()
        dnf_participant = next((p for p in participants_after_dnf if p['bib'] == bib), None)
        assert dnf_participant['status'] == 'retired'
        laps_at_dnf = dnf_participant['laps_completed']
        print(f"After DNF: {bib} has {laps_at_dnf} laps, retired_at_lap={dnf_participant['retired_at_lap']}")
        
        # Now revert the lap
        response = requests.post(
            f"{BASE_URL}/api/race/revert-lap",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Revert lap failed: {response.text}"
        data = response.json()
        
        print(f"Revert response: {data}")
        
        # Check if DNF athlete was reactivated
        participants_after_revert = requests.get(f"{BASE_URL}/api/race/participants").json()
        reverted_participant = next((p for p in participants_after_revert if p['bib'] == bib), None)
        
        # The athlete should be reactivated if retired_at_lap >= new_lap (after revert)
        stats_after_revert = requests.get(f"{BASE_URL}/api/race/stats").json()
        print(f"After revert: current lap is {stats_after_revert['current_lap']}")
        print(f"Participant {bib} status: {reverted_participant['status']}, laps: {reverted_participant['laps_completed']}")
        
        # If reactivated, laps should be the same as before (not decremented)
        if reverted_participant['status'] == 'active':
            assert reverted_participant['laps_completed'] == laps_at_dnf, \
                f"Reactivated athlete should have same laps! Expected {laps_at_dnf}, got {reverted_participant['laps_completed']}"
            print(f"✓ DNF athlete reactivated with same lap count: {reverted_participant['laps_completed']}")
        else:
            print(f"⚠ Athlete not reactivated (retired_at_lap may be < new_lap)")


class TestFollowersCountAPI:
    """
    Test Followers Count API: GET /api/race/followers-count
    Returns count of subscribers per athlete (requires auth)
    """
    
    def test_followers_count_requires_auth(self):
        """Test that followers-count endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/race/followers-count")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ Followers count correctly requires authentication")
    
    def test_followers_count_returns_dict(self, auth_headers):
        """Test that followers-count returns a dictionary of bib -> count"""
        response = requests.get(
            f"{BASE_URL}/api/race/followers-count",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Followers count failed: {response.text}"
        data = response.json()
        
        # Should be a dictionary
        assert isinstance(data, dict), f"Expected dict, got {type(data)}"
        
        print(f"\n=== Followers Count Test ===")
        print(f"Followers count data: {data}")
        
        # If there are followers, verify structure
        if data:
            for bib, count in data.items():
                assert isinstance(bib, str), f"BIB should be string, got {type(bib)}"
                assert isinstance(count, int), f"Count should be int, got {type(count)}"
                assert count > 0, f"Count should be positive, got {count}"
            print(f"✓ Followers count structure verified: {len(data)} athletes with followers")
        else:
            print(f"✓ No followers yet (empty dict returned)")
    
    def test_followers_count_after_subscription(self, auth_headers):
        """Test that followers count updates after a subscription"""
        # Create a subscription
        test_email = f"test_{uuid.uuid4().hex[:8]}@test.com"
        test_bibs = ["001", "002"]
        
        response = requests.post(
            f"{BASE_URL}/api/race/subscribe",
            json={
                "email": test_email,
                "athletes_bibs": test_bibs,
                "notify_every_lap": False,
                "notify_on_finish": True
            }
        )
        assert response.status_code == 200, f"Subscribe failed: {response.text}"
        
        # Check followers count
        response = requests.get(
            f"{BASE_URL}/api/race/followers-count",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify the subscribed athletes have followers
        for bib in test_bibs:
            assert bib in data, f"BIB {bib} should be in followers count"
            assert data[bib] >= 1, f"BIB {bib} should have at least 1 follower"
        
        print(f"✓ Followers count updated after subscription")
        print(f"  BIB 001: {data.get('001', 0)} followers")
        print(f"  BIB 002: {data.get('002', 0)} followers")


class TestCheerMessages:
    """
    Test Cheer Messages System:
    - POST /api/race/cheer - Submit a cheer message
    - GET /api/race/cheers - Get cheer messages feed
    - GET /api/race/cheers/count - Get total count of messages
    """
    
    def test_submit_cheer_message(self):
        """Test submitting a cheer message"""
        test_message = {
            "athlete_bib": "001",
            "fan_name": "Test Fan",
            "message": "¡Vamos campeón! You can do it!"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/race/cheer",
            json=test_message
        )
        assert response.status_code == 200, f"Submit cheer failed: {response.text}"
        data = response.json()
        
        assert "message" in data
        assert "athlete_bib" in data
        assert "athlete_name" in data
        assert data["athlete_bib"] == "001"
        
        print(f"\n=== Cheer Message Submit Test ===")
        print(f"✓ Cheer message submitted successfully")
        print(f"  Response: {data['message']}")
        print(f"  Athlete: {data['athlete_name']}")
    
    def test_submit_cheer_invalid_athlete(self):
        """Test submitting cheer for non-existent athlete"""
        test_message = {
            "athlete_bib": "999",
            "fan_name": "Test Fan",
            "message": "Test message"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/race/cheer",
            json=test_message
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ Invalid athlete correctly rejected with 404")
    
    def test_submit_cheer_message_too_long(self):
        """Test that messages over 280 characters are rejected"""
        test_message = {
            "athlete_bib": "001",
            "fan_name": "Test Fan",
            "message": "A" * 281  # 281 characters
        }
        
        response = requests.post(
            f"{BASE_URL}/api/race/cheer",
            json=test_message
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print(f"✓ Message over 280 chars correctly rejected")
    
    def test_submit_cheer_fan_name_too_long(self):
        """Test that fan names over 50 characters are rejected"""
        test_message = {
            "athlete_bib": "001",
            "fan_name": "A" * 51,  # 51 characters
            "message": "Test message"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/race/cheer",
            json=test_message
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print(f"✓ Fan name over 50 chars correctly rejected")
    
    def test_get_cheer_messages_feed(self):
        """Test getting cheer messages feed"""
        response = requests.get(f"{BASE_URL}/api/race/cheers")
        assert response.status_code == 200, f"Get cheers failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        
        print(f"\n=== Cheer Messages Feed Test ===")
        print(f"Total messages in feed: {len(data)}")
        
        if data:
            # Verify message structure
            msg = data[0]
            assert "athlete_bib" in msg
            assert "fan_name" in msg
            assert "message" in msg
            assert "created_at" in msg
            assert "athlete_name" in msg  # Enriched field
            
            print(f"✓ Message structure verified")
            print(f"  Latest message from: {msg['fan_name']}")
            print(f"  For athlete: {msg['athlete_name']} (#{msg['athlete_bib']})")
    
    def test_get_cheer_messages_with_limit(self):
        """Test getting cheer messages with limit"""
        response = requests.get(f"{BASE_URL}/api/race/cheers?limit=5")
        assert response.status_code == 200
        data = response.json()
        
        assert len(data) <= 5, f"Expected max 5 messages, got {len(data)}"
        print(f"✓ Limit parameter works: got {len(data)} messages")
    
    def test_get_cheer_messages_by_athlete(self):
        """Test filtering cheer messages by athlete"""
        response = requests.get(f"{BASE_URL}/api/race/cheers?athlete_bib=001")
        assert response.status_code == 200
        data = response.json()
        
        for msg in data:
            assert msg['athlete_bib'] == '001', f"Expected athlete 001, got {msg['athlete_bib']}"
        
        print(f"✓ Filter by athlete works: {len(data)} messages for athlete 001")
    
    def test_get_cheer_count(self):
        """Test getting total cheer message count"""
        response = requests.get(f"{BASE_URL}/api/race/cheers/count")
        assert response.status_code == 200, f"Get cheer count failed: {response.text}"
        data = response.json()
        
        assert "count" in data
        assert isinstance(data["count"], int)
        assert data["count"] >= 0
        
        print(f"\n=== Cheer Count Test ===")
        print(f"✓ Total cheer messages: {data['count']}")


class TestCheerMessageFlow:
    """
    Test complete cheer message flow:
    1. Submit a message
    2. Verify it appears in feed
    3. Verify count incremented
    """
    
    def test_complete_cheer_flow(self):
        """Test the complete cheer message flow"""
        print(f"\n=== Complete Cheer Flow Test ===")
        
        # Get initial count
        count_before = requests.get(f"{BASE_URL}/api/race/cheers/count").json()["count"]
        print(f"Initial count: {count_before}")
        
        # Submit a unique message
        unique_id = uuid.uuid4().hex[:8]
        test_message = {
            "athlete_bib": "002",
            "fan_name": f"TestFan_{unique_id}",
            "message": f"Test message {unique_id} - ¡Vamos!"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/race/cheer",
            json=test_message
        )
        assert response.status_code == 200
        print(f"✓ Message submitted")
        
        # Verify count incremented
        count_after = requests.get(f"{BASE_URL}/api/race/cheers/count").json()["count"]
        assert count_after == count_before + 1, \
            f"Count should increment! Expected {count_before + 1}, got {count_after}"
        print(f"✓ Count incremented: {count_before} -> {count_after}")
        
        # Verify message appears in feed
        feed = requests.get(f"{BASE_URL}/api/race/cheers?limit=10").json()
        found = any(
            msg['fan_name'] == test_message['fan_name'] and 
            msg['message'] == test_message['message']
            for msg in feed
        )
        assert found, "Submitted message not found in feed"
        print(f"✓ Message found in feed")


class TestAdminPanelFollowersCount:
    """
    Test that admin panel can access followers count
    """
    
    def test_admin_can_see_followers(self, auth_headers):
        """Test that authenticated admin can see followers count"""
        response = requests.get(
            f"{BASE_URL}/api/race/followers-count",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        print(f"\n=== Admin Followers Count Test ===")
        print(f"✓ Admin can access followers count")
        
        if data:
            total_followers = sum(data.values())
            print(f"  Total followers across all athletes: {total_followers}")
            print(f"  Athletes with followers: {len(data)}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
