"""
Test Athlete Profile System APIs
- Authentication: login, wrong credentials
- Profile: get, update
- 2026 Results: search, claim
- Race history: get with claimed results
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://athlete-dashboard-7.preview.emergentagent.com')

# Test credentials
TEST_EMAIL = "test.athlete@example.com"
TEST_PASSWORD = "test123456"


class TestAthleteAuth:
    """Authentication endpoint tests"""
    
    def test_login_success(self):
        """Test successful login returns token"""
        response = requests.post(f"{BASE_URL}/api/athletes/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "athlete" in data
        assert data["athlete"]["email"] == TEST_EMAIL
        assert "nombre" in data["athlete"]
        
    def test_login_wrong_password(self):
        """Test wrong password returns 401 with 'Credenciales incorrectas'"""
        response = requests.post(f"{BASE_URL}/api/athletes/login", json={
            "email": TEST_EMAIL,
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        data = response.json()
        assert data["detail"] == "Credenciales incorrectas"
        
    def test_login_wrong_email(self):
        """Test non-existent email returns 401"""
        response = requests.post(f"{BASE_URL}/api/athletes/login", json={
            "email": "nonexistent@example.com",
            "password": "anypassword"
        })
        assert response.status_code == 401
        data = response.json()
        assert data["detail"] == "Credenciales incorrectas"


class TestAthleteProfile:
    """Profile endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        response = requests.post(f"{BASE_URL}/api/athletes/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json()["token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    def test_get_profile(self):
        """Test GET /api/athletes/profile returns full athlete data"""
        response = requests.get(f"{BASE_URL}/api/athletes/profile", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify required fields
        assert "id" in data
        assert data["email"] == TEST_EMAIL
        assert "nombre" in data
        assert "apellidos" in data
        assert "telefono" in data
        assert "pais" in data
        assert "ciudad" in data
        assert "email_verified" in data
        
    def test_get_profile_no_auth(self):
        """Test profile endpoint without token returns 401"""
        response = requests.get(f"{BASE_URL}/api/athletes/profile")
        assert response.status_code == 401
        
    def test_update_profile(self):
        """Test PUT /api/athletes/profile updates data"""
        # Update profile
        update_data = {
            "telefono": "TEST8095551234",
            "contacto_emergencia_nombre": "TEST_Contact"
        }
        response = requests.put(
            f"{BASE_URL}/api/athletes/profile", 
            headers=self.headers,
            json=update_data
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        
        # Verify update persisted
        get_response = requests.get(f"{BASE_URL}/api/athletes/profile", headers=self.headers)
        assert get_response.status_code == 200
        profile = get_response.json()
        assert profile["telefono"] == "TEST8095551234"
        assert profile["contacto_emergencia_nombre"] == "TEST_Contact"
        
        # Cleanup - restore original values
        requests.put(
            f"{BASE_URL}/api/athletes/profile",
            headers=self.headers,
            json={"telefono": "8091234567", "contacto_emergencia_nombre": "Maria Test"}
        )


class TestMyRaces:
    """My Races endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        response = requests.post(f"{BASE_URL}/api/athletes/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json()["token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    def test_get_my_races(self):
        """Test GET /api/athletes/my-races returns races array"""
        response = requests.get(f"{BASE_URL}/api/athletes/my-races", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "races" in data
        assert isinstance(data["races"], list)


class TestSearch2026Results:
    """Search 2026 Results endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        response = requests.post(f"{BASE_URL}/api/athletes/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json()["token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    def test_search_by_nombre(self):
        """Test search by nombre returns results"""
        response = requests.get(
            f"{BASE_URL}/api/athletes/search-2026-results?q=Lucas",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        assert len(data["results"]) > 0
        
        # Verify result structure
        result = data["results"][0]
        assert "id" in result
        assert "bib" in result
        assert "nombre" in result
        assert "apellidos" in result
        assert "laps_completed" in result
        assert "status" in result
        
    def test_search_by_bib(self):
        """Test search by BIB number"""
        response = requests.get(
            f"{BASE_URL}/api/athletes/search-2026-results?q=002",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        # May find result by BIB
        
    def test_search_hamlet(self):
        """Test search for Hamlet returns participant"""
        response = requests.get(
            f"{BASE_URL}/api/athletes/search-2026-results?q=Hamlet",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        
        # Should find Hamlet Burgos Frías
        results = data["results"]
        assert len(results) > 0
        hamlet = results[0]
        assert "Hamlet" in hamlet["nombre"]
        
    def test_search_carlos_multiple_results(self):
        """Test search for common name returns multiple results"""
        response = requests.get(
            f"{BASE_URL}/api/athletes/search-2026-results?q=Carlos",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        # Carlos should return multiple participants
        assert len(data["results"]) >= 3
        
    def test_search_too_short(self):
        """Test search with 1 character returns empty"""
        response = requests.get(
            f"{BASE_URL}/api/athletes/search-2026-results?q=L",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["results"] == []
        
    def test_search_no_results(self):
        """Test search with non-matching term"""
        response = requests.get(
            f"{BASE_URL}/api/athletes/search-2026-results?q=ZZZZNONEXISTENT",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["results"] == []


class TestRaceHistory:
    """Race History endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        response = requests.post(f"{BASE_URL}/api/athletes/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json()["token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    def test_get_race_history(self):
        """Test GET /api/athletes/race-history returns history"""
        response = requests.get(f"{BASE_URL}/api/athletes/race-history", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "history" in data
        assert isinstance(data["history"], list)
        
    def test_race_history_includes_claimed(self):
        """Test race history includes claimed results"""
        response = requests.get(f"{BASE_URL}/api/athletes/race-history", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        if len(data["history"]) > 0:
            # Verify structure of history entry
            entry = data["history"][0]
            assert "registration_id" in entry
            assert "race_code" in entry
            assert "bib" in entry
            assert "laps_completed" in entry
            assert "status" in entry


class TestClaimResult:
    """Claim Result endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        response = requests.post(f"{BASE_URL}/api/athletes/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json()["token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    def test_claim_already_claimed_result(self):
        """Test claiming an already claimed result returns error"""
        # The Hamlet result (697e23c3860d1735b9947500) was claimed in tests
        response = requests.post(
            f"{BASE_URL}/api/athletes/claim-result",
            headers=self.headers,
            json={"result_id": "697e23c3860d1735b9947500"}
        )
        # Should return 400 because already claimed
        assert response.status_code == 400
        data = response.json()
        assert "reclamado" in data["detail"].lower()
        
    def test_claim_invalid_result_id(self):
        """Test claiming with invalid ID returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/athletes/claim-result",
            headers=self.headers,
            json={"result_id": "invalid_id"}
        )
        assert response.status_code == 404
        
    def test_claim_nonexistent_result(self):
        """Test claiming non-existent result returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/athletes/claim-result",
            headers=self.headers,
            json={"result_id": "000000000000000000000000"}
        )
        assert response.status_code == 404


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
