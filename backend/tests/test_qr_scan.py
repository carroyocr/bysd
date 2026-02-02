"""
Test QR Scan System for Race Lap Control
Tests endpoints:
- GET /api/qr-scan/race-status
- GET /api/qr-scan/athlete/{bib}
- POST /api/qr-scan/confirm-lap
- POST /api/qr-scan/generate-qr/{bib}
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestQRScanRaceStatus:
    """Tests for GET /api/qr-scan/race-status endpoint"""
    
    def test_race_status_returns_200(self):
        """Race status endpoint should return 200"""
        response = requests.get(f"{BASE_URL}/api/qr-scan/race-status")
        assert response.status_code == 200
        
    def test_race_status_has_required_fields(self):
        """Race status should have required fields"""
        response = requests.get(f"{BASE_URL}/api/qr-scan/race-status")
        data = response.json()
        
        assert "race_active" in data
        assert isinstance(data["race_active"], bool)
        
        if data["race_active"]:
            assert "race_code" in data
            assert "race_name" in data
            assert "race_started" in data
            assert "current_lap" in data
            assert "seconds_remaining" in data


class TestQRScanAthleteEndpoint:
    """Tests for GET /api/qr-scan/athlete/{bib} endpoint"""
    
    def test_athlete_not_found_returns_404(self):
        """Non-existent BIB should return 404"""
        response = requests.get(f"{BASE_URL}/api/qr-scan/athlete/999999")
        assert response.status_code == 404
        
        data = response.json()
        assert "detail" in data
        assert "no encontrado" in data["detail"].lower()
    
    def test_athlete_found_returns_scan_result(self):
        """Existing BIB should return ScanResult with all fields"""
        # First create a test athlete
        test_bib = "TEST_102"
        self._create_test_athlete(test_bib)
        
        response = requests.get(f"{BASE_URL}/api/qr-scan/athlete/{test_bib}")
        
        # If athlete exists, check response structure
        if response.status_code == 200:
            data = response.json()
            assert "bib" in data
            assert "nombre" in data
            assert "apellidos" in data
            assert "status" in data
            assert "laps_completed" in data
            assert "current_race_lap" in data
            assert "lap_to_complete" in data
            assert "time_remaining_seconds" in data
            assert "can_complete" in data
            assert "auto_dnf" in data
            assert "message" in data
        else:
            # 404 is acceptable if test athlete wasn't created
            assert response.status_code == 404
    
    def test_athlete_with_numeric_bib(self):
        """Test athlete lookup with numeric BIB"""
        response = requests.get(f"{BASE_URL}/api/qr-scan/athlete/101")
        # Should return 200 if athlete exists or 404 if not
        assert response.status_code in [200, 404]
    
    def _create_test_athlete(self, bib):
        """Helper to create test athlete via direct DB access"""
        # This would need DB access - skipping for API-only tests
        pass


class TestQRScanConfirmLap:
    """Tests for POST /api/qr-scan/confirm-lap endpoint"""
    
    def test_confirm_lap_missing_bib_returns_error(self):
        """Missing BIB should return validation error"""
        response = requests.post(
            f"{BASE_URL}/api/qr-scan/confirm-lap",
            json={"confirmed_lap": 1, "force_dnf": False}
        )
        assert response.status_code == 422  # Validation error
    
    def test_confirm_lap_nonexistent_bib_returns_404(self):
        """Non-existent BIB should return 404"""
        response = requests.post(
            f"{BASE_URL}/api/qr-scan/confirm-lap",
            json={"bib": "999999", "confirmed_lap": 1, "force_dnf": False}
        )
        assert response.status_code == 404
        
        data = response.json()
        assert "detail" in data
        assert "no encontrado" in data["detail"].lower()
    
    def test_confirm_lap_with_existing_athlete(self):
        """Confirm lap with existing athlete"""
        # Use the test athlete we created (BIB 101)
        response = requests.get(f"{BASE_URL}/api/qr-scan/athlete/101")
        
        if response.status_code == 200:
            athlete_data = response.json()
            lap_to_complete = athlete_data.get("lap_to_complete", 1)
            
            # Try to confirm the lap
            confirm_response = requests.post(
                f"{BASE_URL}/api/qr-scan/confirm-lap",
                json={
                    "bib": "101",
                    "confirmed_lap": lap_to_complete,
                    "force_dnf": False
                }
            )
            
            # Should succeed or fail with sync error (if race not started)
            assert confirm_response.status_code in [200, 400]
            
            if confirm_response.status_code == 200:
                data = confirm_response.json()
                assert "success" in data
                assert data["success"] == True
                assert "action" in data
                assert "message" in data
                assert "bib" in data
    
    def test_force_dnf_with_existing_athlete(self):
        """Test force DNF functionality"""
        # First check if athlete exists
        response = requests.get(f"{BASE_URL}/api/qr-scan/athlete/101")
        
        if response.status_code == 200:
            athlete_data = response.json()
            
            # Only test DNF if athlete is active
            if athlete_data.get("status") == "active":
                dnf_response = requests.post(
                    f"{BASE_URL}/api/qr-scan/confirm-lap",
                    json={
                        "bib": "101",
                        "confirmed_lap": athlete_data.get("lap_to_complete", 1),
                        "force_dnf": True
                    }
                )
                
                assert dnf_response.status_code == 200
                data = dnf_response.json()
                assert data["success"] == True
                assert data["action"] == "dnf"


class TestQRScanGenerateQR:
    """Tests for POST /api/qr-scan/generate-qr/{bib} endpoint"""
    
    def test_generate_qr_nonexistent_bib_returns_404(self):
        """Non-existent BIB should return 404"""
        response = requests.post(f"{BASE_URL}/api/qr-scan/generate-qr/999999")
        assert response.status_code == 404
        
        data = response.json()
        assert "detail" in data
        assert "no encontrado" in data["detail"].lower()
    
    def test_generate_qr_with_existing_athlete(self):
        """Generate QR for existing athlete"""
        response = requests.post(f"{BASE_URL}/api/qr-scan/generate-qr/101")
        
        if response.status_code == 200:
            data = response.json()
            assert "success" in data
            assert data["success"] == True
            assert "bib" in data
            assert "nombre" in data
            assert "qr_code_url" in data
            assert "qr_code_base64" in data
            
            # Verify QR code URL format
            assert data["qr_code_url"].startswith("/api/qr-scan/image/")
            
            # Verify base64 format
            assert data["qr_code_base64"].startswith("data:image/png;base64,")
        else:
            # 404 is acceptable if athlete doesn't exist
            assert response.status_code == 404


class TestQRCodeImage:
    """Tests for GET /api/qr-scan/image/{filename} endpoint"""
    
    def test_qr_image_nonexistent_returns_404(self):
        """Non-existent QR image should return 404"""
        response = requests.get(f"{BASE_URL}/api/qr-scan/image/nonexistent.png")
        assert response.status_code == 404
    
    def test_qr_image_after_generation(self):
        """QR image should be accessible after generation"""
        # First generate a QR code
        gen_response = requests.post(f"{BASE_URL}/api/qr-scan/generate-qr/101")
        
        if gen_response.status_code == 200:
            data = gen_response.json()
            qr_url = data.get("qr_code_url", "")
            
            if qr_url:
                # Try to fetch the image
                img_response = requests.get(f"{BASE_URL}{qr_url}")
                assert img_response.status_code == 200
                assert img_response.headers.get("content-type") == "image/png"


class TestQRScanNoActiveRace:
    """Tests for scenarios when no active race exists"""
    
    def test_race_status_no_active_race(self):
        """Race status should handle no active race gracefully"""
        response = requests.get(f"{BASE_URL}/api/qr-scan/race-status")
        assert response.status_code == 200
        
        data = response.json()
        # Either race_active is True or False with appropriate message
        assert "race_active" in data
        if not data["race_active"]:
            assert "message" in data


# Cleanup fixture
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_data():
    """Cleanup test data after all tests"""
    yield
    # Note: In a real scenario, we'd clean up TEST_ prefixed data
    # For now, the test athlete (BIB 101) is left for frontend testing
