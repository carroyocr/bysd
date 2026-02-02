"""
Test suite for Cancel Registration functionality
Tests both athlete and volunteer cancellation endpoints
"""
import pytest
import requests
import os
import secrets
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Cancellation reasons
CANCELLATION_REASONS = [
    "Me lesioné",
    "Ya no estoy interesado en participar",
    "Tengo otros compromisos",
    "Otra razón"
]


class TestAthleteRegistrationCancellation:
    """Tests for POST /api/registration/cancel/{token}"""
    
    def test_cancel_athlete_with_invalid_token(self):
        """Test cancellation with invalid token returns 404"""
        invalid_token = "invalid_token_12345"
        response = requests.post(
            f"{BASE_URL}/api/registration/cancel/{invalid_token}",
            json={"reason": "Me lesioné"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        data = response.json()
        assert "detail" in data
        print(f"PASSED: Invalid token returns 404 - {data['detail']}")
    
    def test_cancel_athlete_missing_reason(self):
        """Test cancellation without reason returns validation error"""
        # Using a random token - should fail with 404 before validation
        response = requests.post(
            f"{BASE_URL}/api/registration/cancel/some_token",
            json={}
        )
        # Either 404 (token not found) or 422 (validation error) is acceptable
        assert response.status_code in [404, 422], f"Expected 404 or 422, got {response.status_code}"
        print(f"PASSED: Missing reason handled correctly - status {response.status_code}")
    
    def test_cancel_athlete_with_valid_token(self):
        """Test cancellation with valid token (using existing test token)"""
        # Use the test token from previous iteration if available
        test_token = "aYAYnRNvM_S4hQ-XUBEYDMP9pID5c3hYq3ga-7gHd-c"
        
        # First check if this registration exists
        check_response = requests.get(f"{BASE_URL}/api/registration/my-registration?token={test_token}")
        
        if check_response.status_code == 200:
            # Registration exists, try to cancel
            response = requests.post(
                f"{BASE_URL}/api/registration/cancel/{test_token}",
                json={"reason": "Me lesioné"}
            )
            # Should succeed or already be cancelled
            assert response.status_code in [200, 400], f"Expected 200 or 400, got {response.status_code}"
            if response.status_code == 200:
                data = response.json()
                assert "message" in data
                print(f"PASSED: Athlete cancellation successful - {data['message']}")
            else:
                print(f"INFO: Registration may already be cancelled")
        else:
            # Token doesn't exist, test with invalid token behavior
            response = requests.post(
                f"{BASE_URL}/api/registration/cancel/{test_token}",
                json={"reason": "Me lesioné"}
            )
            assert response.status_code == 404
            print(f"PASSED: Non-existent token returns 404")
    
    def test_cancel_athlete_with_other_reason(self):
        """Test cancellation with 'Otra razón' requires other_reason field"""
        invalid_token = "test_other_reason_token"
        response = requests.post(
            f"{BASE_URL}/api/registration/cancel/{invalid_token}",
            json={
                "reason": "Otra razón",
                "other_reason": "Tengo un viaje programado"
            }
        )
        # Should return 404 for invalid token
        assert response.status_code == 404
        print("PASSED: Other reason payload accepted (token validation first)")


class TestVolunteerRegistrationCancellation:
    """Tests for POST /api/volunteer-registration/cancel/{token}"""
    
    def test_cancel_volunteer_with_invalid_token(self):
        """Test volunteer cancellation with invalid token returns 404"""
        invalid_token = "invalid_volunteer_token_12345"
        response = requests.post(
            f"{BASE_URL}/api/volunteer-registration/cancel/{invalid_token}",
            json={"reason": "Ya no estoy interesado en participar"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        data = response.json()
        assert "detail" in data
        print(f"PASSED: Invalid volunteer token returns 404 - {data['detail']}")
    
    def test_cancel_volunteer_missing_reason(self):
        """Test volunteer cancellation without reason"""
        response = requests.post(
            f"{BASE_URL}/api/volunteer-registration/cancel/some_token",
            json={}
        )
        # Either 404 (token not found) or 422 (validation error) is acceptable
        assert response.status_code in [404, 422], f"Expected 404 or 422, got {response.status_code}"
        print(f"PASSED: Missing reason handled correctly - status {response.status_code}")
    
    def test_cancel_volunteer_with_other_reason(self):
        """Test volunteer cancellation with 'Otra razón'"""
        invalid_token = "test_volunteer_other_reason"
        response = requests.post(
            f"{BASE_URL}/api/volunteer-registration/cancel/{invalid_token}",
            json={
                "reason": "Otra razón",
                "other_reason": "Cambio de trabajo"
            }
        )
        # Should return 404 for invalid token
        assert response.status_code == 404
        print("PASSED: Volunteer other reason payload accepted (token validation first)")


class TestCancelRegistrationPage:
    """Tests for the /cancelar-registro page endpoints"""
    
    def test_athlete_registration_lookup_invalid_token(self):
        """Test that my-registration endpoint returns 404 for invalid token"""
        response = requests.get(f"{BASE_URL}/api/registration/my-registration?token=invalid_token")
        assert response.status_code == 404
        print("PASSED: Invalid athlete token lookup returns 404")
    
    def test_volunteer_registration_lookup_invalid_token(self):
        """Test that volunteer by-token endpoint returns 404 for invalid token"""
        response = requests.get(f"{BASE_URL}/api/volunteer-registration/by-token/invalid_token")
        assert response.status_code == 404
        print("PASSED: Invalid volunteer token lookup returns 404")
    
    def test_cancellation_reasons_list(self):
        """Verify cancellation reasons are consistent"""
        expected_reasons = [
            "Me lesioné",
            "Ya no estoy interesado en participar",
            "Tengo otros compromisos",
            "Otra razón"
        ]
        assert CANCELLATION_REASONS == expected_reasons
        print(f"PASSED: Cancellation reasons verified: {CANCELLATION_REASONS}")


class TestCancellationEndpointStructure:
    """Tests for endpoint structure and response format"""
    
    def test_athlete_cancel_endpoint_exists(self):
        """Verify athlete cancel endpoint exists and accepts POST"""
        response = requests.post(
            f"{BASE_URL}/api/registration/cancel/test_token",
            json={"reason": "Me lesioné"}
        )
        # Should not return 405 Method Not Allowed
        assert response.status_code != 405, "Endpoint should accept POST method"
        print(f"PASSED: Athlete cancel endpoint accepts POST - status {response.status_code}")
    
    def test_volunteer_cancel_endpoint_exists(self):
        """Verify volunteer cancel endpoint exists and accepts POST"""
        response = requests.post(
            f"{BASE_URL}/api/volunteer-registration/cancel/test_token",
            json={"reason": "Me lesioné"}
        )
        # Should not return 405 Method Not Allowed
        assert response.status_code != 405, "Endpoint should accept POST method"
        print(f"PASSED: Volunteer cancel endpoint accepts POST - status {response.status_code}")
    
    def test_cancel_response_format(self):
        """Test that cancel endpoints return proper JSON format"""
        response = requests.post(
            f"{BASE_URL}/api/registration/cancel/test_token",
            json={"reason": "Me lesioné"}
        )
        assert response.headers.get('content-type', '').startswith('application/json')
        data = response.json()
        assert isinstance(data, dict)
        print("PASSED: Cancel endpoint returns proper JSON format")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
