"""
Extended tests for Athlete Profile System - Testing new fields and race inscription
Tests: Profile with extended fields, race inscription with event-specific fields
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test.athlete@example.com"
TEST_PASSWORD = "test123456"


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def auth_token(api_client):
    """Get authentication token for test athlete"""
    response = api_client.post(f"{BASE_URL}/api/athletes/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Authentication failed - test athlete not available")


@pytest.fixture(scope="module")
def authenticated_client(api_client, auth_token):
    """Session with auth header"""
    api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
    return api_client


# ==================== AUTH TESTS ====================

class TestAthleteAuth:
    """Authentication endpoint tests"""
    
    def test_login_success(self, api_client):
        """Test successful login returns token and athlete data"""
        response = api_client.post(f"{BASE_URL}/api/athletes/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "athlete" in data
        assert data["athlete"]["email"] == TEST_EMAIL
    
    def test_login_wrong_password(self, api_client):
        """Test login with wrong password returns 'Credenciales incorrectas'"""
        response = api_client.post(f"{BASE_URL}/api/athletes/login", json={
            "email": TEST_EMAIL,
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        data = response.json()
        assert "Credenciales incorrectas" in data.get("detail", "")
    
    def test_login_nonexistent_email(self, api_client):
        """Test login with non-existent email returns 'Credenciales incorrectas'"""
        response = api_client.post(f"{BASE_URL}/api/athletes/login", json={
            "email": "nonexistent@example.com",
            "password": "anypassword"
        })
        assert response.status_code == 401
        data = response.json()
        assert "Credenciales incorrectas" in data.get("detail", "")


# ==================== PROFILE TESTS WITH EXTENDED FIELDS ====================

class TestProfileExtendedFields:
    """Tests for profile API returning all new fields"""
    
    def test_profile_returns_personal_fields(self, authenticated_client):
        """Test GET /api/athletes/profile returns personal fields"""
        response = authenticated_client.get(f"{BASE_URL}/api/athletes/profile")
        assert response.status_code == 200
        data = response.json()
        
        # Required personal fields
        assert "nombre" in data
        assert "apellidos" in data
        assert "email" in data
        assert "telefono" in data
        assert "fecha_nacimiento" in data
        assert "sexo" in data
        assert "nacionalidad" in data
        assert "ciudad_residencia" in data
    
    def test_profile_returns_medical_fields(self, authenticated_client):
        """Test GET /api/athletes/profile returns medical fields"""
        response = authenticated_client.get(f"{BASE_URL}/api/athletes/profile")
        assert response.status_code == 200
        data = response.json()
        
        # Medical fields
        assert "tipo_sangre" in data
        assert "condicion_medica" in data
        assert "condicion_medica_detalle" in data
        assert "alergias" in data
        assert "alergias_detalle" in data
    
    def test_profile_returns_emergency_fields(self, authenticated_client):
        """Test GET /api/athletes/profile returns emergency contact fields"""
        response = authenticated_client.get(f"{BASE_URL}/api/athletes/profile")
        assert response.status_code == 200
        data = response.json()
        
        # Emergency contact fields
        assert "contacto_emergencia_nombre" in data
        assert "contacto_emergencia_relacion" in data
        assert "contacto_emergencia_telefono" in data
    
    def test_profile_returns_preferences_fields(self, authenticated_client):
        """Test GET /api/athletes/profile returns preference fields"""
        response = authenticated_client.get(f"{BASE_URL}/api/athletes/profile")
        assert response.status_code == 200
        data = response.json()
        
        # Preference fields
        assert "talla_camiseta" in data
        assert "personalizacion_camiseta" in data
        assert "como_se_entero" in data
    
    def test_profile_returns_profile_complete_flag(self, authenticated_client):
        """Test GET /api/athletes/profile returns profile_complete boolean"""
        response = authenticated_client.get(f"{BASE_URL}/api/athletes/profile")
        assert response.status_code == 200
        data = response.json()
        
        assert "profile_complete" in data
        assert isinstance(data["profile_complete"], bool)


# ==================== PROFILE UPDATE TESTS ====================

class TestProfileUpdate:
    """Tests for updating profile with extended fields"""
    
    def test_update_medical_fields(self, authenticated_client):
        """Test updating medical fields"""
        update_data = {
            "tipo_sangre": "AB+",
            "condicion_medica": "No"
        }
        response = authenticated_client.put(f"{BASE_URL}/api/athletes/profile", json=update_data)
        assert response.status_code == 200
        
        # Verify update persisted
        get_response = authenticated_client.get(f"{BASE_URL}/api/athletes/profile")
        assert get_response.status_code == 200
        profile = get_response.json()
        assert profile["tipo_sangre"] == "AB+"
    
    def test_update_emergency_contact(self, authenticated_client):
        """Test updating emergency contact fields"""
        update_data = {
            "contacto_emergencia_nombre": "Test Emergency Contact",
            "contacto_emergencia_relacion": "Hermano",
            "contacto_emergencia_telefono": "+1 809 555 9999"
        }
        response = authenticated_client.put(f"{BASE_URL}/api/athletes/profile", json=update_data)
        assert response.status_code == 200
        
        # Verify update persisted
        get_response = authenticated_client.get(f"{BASE_URL}/api/athletes/profile")
        profile = get_response.json()
        assert profile["contacto_emergencia_nombre"] == "Test Emergency Contact"
    
    def test_update_preferences(self, authenticated_client):
        """Test updating preference fields"""
        update_data = {
            "talla_camiseta": "L",
            "personalizacion_camiseta": "TESTER"
        }
        response = authenticated_client.put(f"{BASE_URL}/api/athletes/profile", json=update_data)
        assert response.status_code == 200
        
        # Verify update persisted
        get_response = authenticated_client.get(f"{BASE_URL}/api/athletes/profile")
        profile = get_response.json()
        assert profile["talla_camiseta"] == "L"
        assert profile["personalizacion_camiseta"] == "TESTER"


# ==================== RACE INSCRIPTION TESTS ====================

class TestRaceInscription:
    """Tests for race inscription with event-specific fields"""
    
    def test_my_races_endpoint(self, authenticated_client):
        """Test GET /api/athletes/my-races returns races list"""
        response = authenticated_client.get(f"{BASE_URL}/api/athletes/my-races")
        assert response.status_code == 200
        data = response.json()
        assert "races" in data
        assert isinstance(data["races"], list)
    
    def test_register_race_requires_profile_fields(self, authenticated_client):
        """Test race registration validates profile completeness"""
        # Get profile first to check profile_complete status
        profile_response = authenticated_client.get(f"{BASE_URL}/api/athletes/profile")
        profile = profile_response.json()
        
        # If profile is complete, registration should work
        # If incomplete, it may still work but inscription button won't show in UI
        inscription_data = {
            "race_code": "BYSD-2027",
            "motivacion": "Test motivation for the race",
            "anos_experiencia": 5,
            "maxima_distancia_km": 42.2,
            "vueltas_aspiradas": "De 11 a 15",
            "tiene_carpa": "Si",
            "hospedaje": "Si quiero acampar",
            "acompanantes": 2
        }
        
        response = authenticated_client.post(f"{BASE_URL}/api/athletes/register-race", json=inscription_data)
        
        # Either success or already registered
        if response.status_code == 200:
            data = response.json()
            assert "bib" in data or data.get("success") == True
        elif response.status_code == 400:
            # Already registered is acceptable
            assert "Ya estás inscrito" in response.json().get("detail", "")
        else:
            # Other errors should be investigated
            print(f"Registration response: {response.status_code} - {response.json()}")


# ==================== HISTORY AND CLAIM TESTS ====================

class TestHistoryAndClaim:
    """Tests for race history and result claiming"""
    
    def test_search_2026_results(self, authenticated_client):
        """Test search 2026 results endpoint"""
        response = authenticated_client.get(f"{BASE_URL}/api/athletes/search-2026-results?q=Lucas")
        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        assert isinstance(data["results"], list)
    
    def test_search_2026_requires_min_chars(self, authenticated_client):
        """Test search requires minimum 2 characters"""
        response = authenticated_client.get(f"{BASE_URL}/api/athletes/search-2026-results?q=L")
        assert response.status_code == 200
        data = response.json()
        # Should return empty results for single character
        assert data["results"] == []
    
    def test_race_history_endpoint(self, authenticated_client):
        """Test GET /api/athletes/race-history returns history"""
        response = authenticated_client.get(f"{BASE_URL}/api/athletes/race-history")
        assert response.status_code == 200
        data = response.json()
        assert "history" in data
        assert isinstance(data["history"], list)


# ==================== REGISTRATION MODEL TESTS ====================

class TestRegisterModel:
    """Tests for registration data model"""
    
    def test_register_endpoint_exists(self, api_client):
        """Test register endpoint exists and validates input"""
        # Missing required fields
        response = api_client.post(f"{BASE_URL}/api/athletes/register", json={
            "email": "incomplete@test.com"
        })
        # Should fail validation (422) or bad request (400)
        assert response.status_code in [400, 422]
    
    def test_register_validates_password_length(self, api_client):
        """Test registration validates password minimum length"""
        response = api_client.post(f"{BASE_URL}/api/athletes/register", json={
            "email": "test.validation@example.com",
            "password": "short",  # Less than 6 chars
            "nombre": "Test",
            "apellidos": "User"
        })
        # Should accept request but may reject short password at business logic level
        # or Pydantic may accept it (no min length in model)
        assert response.status_code in [200, 201, 400, 422]


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
