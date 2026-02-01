"""
Test suite for manual notification endpoints
Tests the new functionality to send email notifications when manuals are available
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestManualNotifications:
    """Tests for manual notification endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        response = requests.post(
            f"{BASE_URL}/api/race/auth/admin-login",
            json={"username": "admin", "password": "Backyard2026!"}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        self.race_code = "BYSD-2027"
    
    def test_get_runners_notification_count(self):
        """Test GET /api/race-config/notify-runners-count/{code} returns correct count"""
        response = requests.get(
            f"{BASE_URL}/api/race-config/notify-runners-count/{self.race_code}",
            headers=self.headers
        )
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Data assertions
        data = response.json()
        assert "count" in data, "Response should contain 'count' field"
        assert "race_code" in data, "Response should contain 'race_code' field"
        assert isinstance(data["count"], int), "Count should be an integer"
        assert data["count"] >= 0, "Count should be non-negative"
        assert data["race_code"] == self.race_code, f"Race code should be {self.race_code}"
        print(f"Runners count: {data['count']}")
    
    def test_get_volunteers_notification_count(self):
        """Test GET /api/race-config/notify-volunteers-count/{code} returns correct count"""
        response = requests.get(
            f"{BASE_URL}/api/race-config/notify-volunteers-count/{self.race_code}",
            headers=self.headers
        )
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Data assertions
        data = response.json()
        assert "count" in data, "Response should contain 'count' field"
        assert "race_code" in data, "Response should contain 'race_code' field"
        assert isinstance(data["count"], int), "Count should be an integer"
        assert data["count"] >= 0, "Count should be non-negative"
        assert data["race_code"] == self.race_code, f"Race code should be {self.race_code}"
        print(f"Volunteers count: {data['count']}")
    
    def test_notify_runners_manual_success(self):
        """Test POST /api/race-config/notify-runners-manual/{code} sends emails to active runners"""
        response = requests.post(
            f"{BASE_URL}/api/race-config/notify-runners-manual/{self.race_code}",
            headers=self.headers
        )
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Data assertions
        data = response.json()
        assert "message" in data, "Response should contain 'message' field"
        assert "sent_count" in data, "Response should contain 'sent_count' field"
        assert "failed_count" in data, "Response should contain 'failed_count' field"
        assert "total_athletes" in data, "Response should contain 'total_athletes' field"
        
        # Verify counts are integers
        assert isinstance(data["sent_count"], int), "sent_count should be an integer"
        assert isinstance(data["failed_count"], int), "failed_count should be an integer"
        assert isinstance(data["total_athletes"], int), "total_athletes should be an integer"
        
        # Verify sent + failed = total
        assert data["sent_count"] + data["failed_count"] == data["total_athletes"], \
            "sent_count + failed_count should equal total_athletes"
        
        print(f"Runners notification: {data['message']}")
        print(f"Sent: {data['sent_count']}, Failed: {data['failed_count']}, Total: {data['total_athletes']}")
    
    def test_notify_volunteers_manual_success(self):
        """Test POST /api/race-config/notify-volunteers-manual/{code} sends emails to volunteers"""
        response = requests.post(
            f"{BASE_URL}/api/race-config/notify-volunteers-manual/{self.race_code}",
            headers=self.headers
        )
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Data assertions
        data = response.json()
        assert "message" in data, "Response should contain 'message' field"
        assert "sent_count" in data, "Response should contain 'sent_count' field"
        assert "failed_count" in data, "Response should contain 'failed_count' field"
        assert "total_volunteers" in data, "Response should contain 'total_volunteers' field"
        
        # Verify counts are integers
        assert isinstance(data["sent_count"], int), "sent_count should be an integer"
        assert isinstance(data["failed_count"], int), "failed_count should be an integer"
        assert isinstance(data["total_volunteers"], int), "total_volunteers should be an integer"
        
        # Verify sent + failed = total
        assert data["sent_count"] + data["failed_count"] == data["total_volunteers"], \
            "sent_count + failed_count should equal total_volunteers"
        
        print(f"Volunteers notification: {data['message']}")
        print(f"Sent: {data['sent_count']}, Failed: {data['failed_count']}, Total: {data['total_volunteers']}")
    
    def test_notify_runners_requires_auth(self):
        """Test that notify-runners-manual endpoint requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/race-config/notify-runners-manual/{self.race_code}"
        )
        
        # Should return 422 (missing header) or 401 (unauthorized)
        assert response.status_code in [401, 422], \
            f"Expected 401 or 422 without auth, got {response.status_code}"
    
    def test_notify_volunteers_requires_auth(self):
        """Test that notify-volunteers-manual endpoint requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/race-config/notify-volunteers-manual/{self.race_code}"
        )
        
        # Should return 422 (missing header) or 401 (unauthorized)
        assert response.status_code in [401, 422], \
            f"Expected 401 or 422 without auth, got {response.status_code}"
    
    def test_notify_runners_invalid_race_code(self):
        """Test notify-runners-manual with invalid race code returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/race-config/notify-runners-manual/INVALID-CODE",
            headers=self.headers
        )
        
        assert response.status_code == 404, \
            f"Expected 404 for invalid race code, got {response.status_code}"
    
    def test_notify_volunteers_invalid_race_code(self):
        """Test notify-volunteers-manual with invalid race code returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/race-config/notify-volunteers-manual/INVALID-CODE",
            headers=self.headers
        )
        
        assert response.status_code == 404, \
            f"Expected 404 for invalid race code, got {response.status_code}"
    
    def test_count_endpoints_require_auth(self):
        """Test that count endpoints require authentication"""
        # Test runners count without auth
        response = requests.get(
            f"{BASE_URL}/api/race-config/notify-runners-count/{self.race_code}"
        )
        assert response.status_code in [401, 422], \
            f"Expected 401 or 422 for runners count without auth, got {response.status_code}"
        
        # Test volunteers count without auth
        response = requests.get(
            f"{BASE_URL}/api/race-config/notify-volunteers-count/{self.race_code}"
        )
        assert response.status_code in [401, 422], \
            f"Expected 401 or 422 for volunteers count without auth, got {response.status_code}"


class TestManualNotificationPrerequisites:
    """Tests for manual notification prerequisites (manual must exist)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        response = requests.post(
            f"{BASE_URL}/api/race/auth/admin-login",
            json={"username": "admin", "password": "Backyard2026!"}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        self.race_code = "BYSD-2027"
    
    def test_race_has_runners_manual(self):
        """Verify that the race has a runners manual uploaded"""
        response = requests.get(
            f"{BASE_URL}/api/race-config/{self.race_code}"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Check manual_runners_url exists
        assert "manual_runners_url" in data, "Race should have manual_runners_url field"
        assert data["manual_runners_url"] is not None, "Runners manual should be uploaded"
        print(f"Runners manual URL: {data['manual_runners_url']}")
    
    def test_race_has_volunteers_manual(self):
        """Verify that the race has a volunteers manual uploaded"""
        response = requests.get(
            f"{BASE_URL}/api/race-config/{self.race_code}"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Check manual_volunteers_url exists
        assert "manual_volunteers_url" in data, "Race should have manual_volunteers_url field"
        assert data["manual_volunteers_url"] is not None, "Volunteers manual should be uploaded"
        print(f"Volunteers manual URL: {data['manual_volunteers_url']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
