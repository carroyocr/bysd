"""
Test suite for Race Configuration API endpoints
Tests: GET /api/race-config/active, POST /api/race-config/create, PUT /api/race-config/update/{code}
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestRaceConfigAPI:
    """Race Configuration endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Get auth token
        login_response = self.session.post(
            f"{BASE_URL}/api/race/auth/admin-login",
            json={"username": "admin", "password": "Backyard2026!"}
        )
        if login_response.status_code == 200:
            self.token = login_response.json().get("token")
            self.auth_headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.token}"
            }
        else:
            pytest.skip("Authentication failed - skipping authenticated tests")
    
    # ==================== GET /api/race-config/active ====================
    
    def test_get_active_race_returns_200(self):
        """GET /api/race-config/active should return 200"""
        response = self.session.get(f"{BASE_URL}/api/race-config/active")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    def test_get_active_race_returns_correct_structure(self):
        """GET /api/race-config/active should return correct data structure"""
        response = self.session.get(f"{BASE_URL}/api/race-config/active")
        assert response.status_code == 200
        data = response.json()
        
        # Verify required fields exist
        assert "code" in data, "Response should have 'code' field"
        assert "name" in data, "Response should have 'name' field"
        assert "date" in data, "Response should have 'date' field"
        assert "start_time" in data, "Response should have 'start_time' field"
        assert "location" in data, "Response should have 'location' field"
        assert "is_active" in data, "Response should have 'is_active' field"
    
    def test_get_active_race_returns_active_race(self):
        """GET /api/race-config/active should return a race with is_active=True"""
        response = self.session.get(f"{BASE_URL}/api/race-config/active")
        assert response.status_code == 200
        data = response.json()
        
        # Either is_active is True or is_default is True (default values)
        assert data.get("is_active") == True or data.get("is_default") == True, \
            "Active race should have is_active=True or is_default=True"
    
    def test_get_active_race_has_bysd_2026(self):
        """GET /api/race-config/active should return BYSD-2026 as active race"""
        response = self.session.get(f"{BASE_URL}/api/race-config/active")
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("code") == "BYSD-2026", f"Expected code 'BYSD-2026', got '{data.get('code')}'"
        assert "Backyard Ultra Santo Domingo" in data.get("name", ""), \
            f"Expected name to contain 'Backyard Ultra Santo Domingo', got '{data.get('name')}'"
    
    # ==================== GET /api/race-config/all ====================
    
    def test_get_all_races_returns_200(self):
        """GET /api/race-config/all should return 200"""
        response = self.session.get(f"{BASE_URL}/api/race-config/all")
        assert response.status_code == 200
    
    def test_get_all_races_returns_list(self):
        """GET /api/race-config/all should return a list of races"""
        response = self.session.get(f"{BASE_URL}/api/race-config/all")
        assert response.status_code == 200
        data = response.json()
        
        assert "races" in data, "Response should have 'races' field"
        assert isinstance(data["races"], list), "'races' should be a list"
    
    # ==================== GET /api/race-config/{code} ====================
    
    def test_get_race_by_code_returns_200(self):
        """GET /api/race-config/{code} should return 200 for existing race"""
        response = self.session.get(f"{BASE_URL}/api/race-config/BYSD-2026")
        assert response.status_code == 200
    
    def test_get_race_by_code_returns_correct_data(self):
        """GET /api/race-config/{code} should return correct race data"""
        response = self.session.get(f"{BASE_URL}/api/race-config/BYSD-2026")
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("code") == "BYSD-2026"
        assert "name" in data
        assert "date" in data
    
    def test_get_race_by_code_returns_404_for_nonexistent(self):
        """GET /api/race-config/{code} should return 404 for non-existent race"""
        response = self.session.get(f"{BASE_URL}/api/race-config/NONEXISTENT-9999")
        assert response.status_code == 404
    
    # ==================== POST /api/race-config/create (with JWT auth) ====================
    
    def test_create_race_without_auth_returns_422(self):
        """POST /api/race-config/create without auth should return 422 (missing header)"""
        response = self.session.post(
            f"{BASE_URL}/api/race-config/create",
            json={
                "code": "TEST-9999",
                "name": "Test Race",
                "date": "2027-01-01",
                "start_time": "09:00",
                "location": "Test Location",
                "is_active": False
            }
        )
        # Should fail due to missing Authorization header
        assert response.status_code in [401, 422], f"Expected 401 or 422, got {response.status_code}"
    
    def test_create_race_with_auth_returns_200(self):
        """POST /api/race-config/create with auth should create race successfully"""
        unique_code = f"TEST-{uuid.uuid4().hex[:6].upper()}"
        
        response = requests.post(
            f"{BASE_URL}/api/race-config/create",
            headers=self.auth_headers,
            json={
                "code": unique_code,
                "name": f"Test Race {unique_code}",
                "date": "2027-06-15",
                "start_time": "08:00",
                "location": "Test Location, Test City",
                "is_active": False  # Don't activate to avoid affecting other tests
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "message" in data, "Response should have 'message' field"
        assert "race" in data, "Response should have 'race' field"
        assert data["race"]["code"] == unique_code
    
    def test_create_race_duplicate_code_returns_400(self):
        """POST /api/race-config/create with duplicate code should return 400"""
        response = requests.post(
            f"{BASE_URL}/api/race-config/create",
            headers=self.auth_headers,
            json={
                "code": "BYSD-2026",  # Already exists
                "name": "Duplicate Race",
                "date": "2027-01-01",
                "start_time": "09:00",
                "location": "Test Location",
                "is_active": False
            }
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
    
    def test_create_race_missing_required_fields_returns_422(self):
        """POST /api/race-config/create with missing fields should return 422"""
        response = requests.post(
            f"{BASE_URL}/api/race-config/create",
            headers=self.auth_headers,
            json={
                "code": "TEST-INCOMPLETE"
                # Missing: name, date, start_time, location
            }
        )
        
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
    
    # ==================== PUT /api/race-config/update/{code} (with JWT auth) ====================
    
    def test_update_race_without_auth_returns_422(self):
        """PUT /api/race-config/update/{code} without auth should return 422"""
        response = self.session.put(
            f"{BASE_URL}/api/race-config/update/BYSD-2026",
            json={"name": "Updated Name"}
        )
        assert response.status_code in [401, 422], f"Expected 401 or 422, got {response.status_code}"
    
    def test_update_race_with_auth_returns_200(self):
        """PUT /api/race-config/update/{code} with auth should update race"""
        # First get current data
        get_response = self.session.get(f"{BASE_URL}/api/race-config/BYSD-2026")
        original_data = get_response.json()
        original_location = original_data.get("location")
        
        # Update location
        new_location = "Sierra Prieta, Santo Domingo, República Dominicana"
        response = requests.put(
            f"{BASE_URL}/api/race-config/update/BYSD-2026",
            headers=self.auth_headers,
            json={"location": new_location}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "message" in data, "Response should have 'message' field"
        assert "race" in data, "Response should have 'race' field"
        
        # Verify update persisted
        verify_response = self.session.get(f"{BASE_URL}/api/race-config/BYSD-2026")
        verify_data = verify_response.json()
        assert verify_data.get("location") == new_location, "Location should be updated"
    
    def test_update_nonexistent_race_returns_404(self):
        """PUT /api/race-config/update/{code} for non-existent race should return 404"""
        response = requests.put(
            f"{BASE_URL}/api/race-config/update/NONEXISTENT-9999",
            headers=self.auth_headers,
            json={"name": "Updated Name"}
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    # ==================== POST /api/race-config/activate/{code} ====================
    
    def test_activate_race_without_auth_returns_422(self):
        """POST /api/race-config/activate/{code} without auth should return 422"""
        response = self.session.post(f"{BASE_URL}/api/race-config/activate/BYSD-2026")
        assert response.status_code in [401, 422], f"Expected 401 or 422, got {response.status_code}"
    
    def test_activate_nonexistent_race_returns_404(self):
        """POST /api/race-config/activate/{code} for non-existent race should return 404"""
        response = requests.post(
            f"{BASE_URL}/api/race-config/activate/NONEXISTENT-9999",
            headers=self.auth_headers
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


class TestRaceConfigDataIntegrity:
    """Tests for data integrity and persistence"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_active_race_excludes_mongodb_id(self):
        """GET /api/race-config/active should not include MongoDB _id field"""
        response = self.session.get(f"{BASE_URL}/api/race-config/active")
        assert response.status_code == 200
        data = response.json()
        
        assert "_id" not in data, "Response should not include MongoDB _id field"
    
    def test_race_by_code_excludes_mongodb_id(self):
        """GET /api/race-config/{code} should not include MongoDB _id field"""
        response = self.session.get(f"{BASE_URL}/api/race-config/BYSD-2026")
        assert response.status_code == 200
        data = response.json()
        
        assert "_id" not in data, "Response should not include MongoDB _id field"
    
    def test_all_races_exclude_mongodb_id(self):
        """GET /api/race-config/all should not include MongoDB _id in any race"""
        response = self.session.get(f"{BASE_URL}/api/race-config/all")
        assert response.status_code == 200
        data = response.json()
        
        for race in data.get("races", []):
            assert "_id" not in race, f"Race {race.get('code')} should not include MongoDB _id"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
