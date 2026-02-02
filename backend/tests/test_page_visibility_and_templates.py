"""
Test Page Visibility and Email Templates Features
Tests for:
1. /api/race-config/page-visibility endpoint
2. Email templates loading and payment_receipt_received template
3. GET /api/email-templates/{template_id} endpoint
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Admin credentials for authenticated endpoints
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "Backyard2026!"


class TestPageVisibility:
    """Tests for page visibility endpoint"""
    
    def test_page_visibility_endpoint_returns_200(self):
        """Test that page-visibility endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/race-config/page-visibility")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ Page visibility endpoint returns 200")
    
    def test_page_visibility_returns_show_tracking_page(self):
        """Test that response contains show_tracking_page field"""
        response = requests.get(f"{BASE_URL}/api/race-config/page-visibility")
        assert response.status_code == 200
        data = response.json()
        
        assert "show_tracking_page" in data, "Missing show_tracking_page field"
        assert isinstance(data["show_tracking_page"], bool), "show_tracking_page should be boolean"
        print(f"✓ show_tracking_page: {data['show_tracking_page']}")
    
    def test_page_visibility_returns_show_community_page(self):
        """Test that response contains show_community_page field"""
        response = requests.get(f"{BASE_URL}/api/race-config/page-visibility")
        assert response.status_code == 200
        data = response.json()
        
        assert "show_community_page" in data, "Missing show_community_page field"
        assert isinstance(data["show_community_page"], bool), "show_community_page should be boolean"
        print(f"✓ show_community_page: {data['show_community_page']}")
    
    def test_page_visibility_returns_race_name(self):
        """Test that response contains race_name field"""
        response = requests.get(f"{BASE_URL}/api/race-config/page-visibility")
        assert response.status_code == 200
        data = response.json()
        
        assert "race_name" in data, "Missing race_name field"
        assert isinstance(data["race_name"], str), "race_name should be string"
        print(f"✓ race_name: {data['race_name']}")
    
    def test_page_visibility_returns_race_code(self):
        """Test that response contains race_code field"""
        response = requests.get(f"{BASE_URL}/api/race-config/page-visibility")
        assert response.status_code == 200
        data = response.json()
        
        assert "race_code" in data, "Missing race_code field"
        print(f"✓ race_code: {data['race_code']}")


class TestEmailTemplatesLoading:
    """Tests for email templates loading"""
    
    def test_email_templates_endpoint_returns_200(self):
        """Test that email templates endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/email-templates/")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ Email templates endpoint returns 200")
    
    def test_email_templates_returns_list(self):
        """Test that email templates returns a list"""
        response = requests.get(f"{BASE_URL}/api/email-templates/")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        assert len(data) > 0, "Should have at least one template"
        print(f"✓ Returned {len(data)} templates")
    
    def test_email_templates_have_required_fields(self):
        """Test that templates have required fields"""
        response = requests.get(f"{BASE_URL}/api/email-templates/")
        assert response.status_code == 200
        data = response.json()
        
        required_fields = ["id", "name", "description", "subject", "content", "category", "merge_sources"]
        
        for template in data[:5]:  # Check first 5 templates
            for field in required_fields:
                assert field in template, f"Template {template.get('id', 'unknown')} missing field: {field}"
        
        print(f"✓ All templates have required fields: {required_fields}")
    
    def test_payment_receipt_received_template_exists(self):
        """Test that payment_receipt_received template exists"""
        response = requests.get(f"{BASE_URL}/api/email-templates/")
        assert response.status_code == 200
        data = response.json()
        
        template_ids = [t["id"] for t in data]
        assert "payment_receipt_received" in template_ids, "payment_receipt_received template not found"
        print("✓ payment_receipt_received template exists")
    
    def test_payment_receipt_received_has_correct_fields(self):
        """Test that payment_receipt_received template has correct fields"""
        response = requests.get(f"{BASE_URL}/api/email-templates/payment_receipt_received")
        assert response.status_code == 200
        data = response.json()
        
        # Verify template structure
        assert data["id"] == "payment_receipt_received"
        assert data["name"] == "Comprobante de Pago Recibido"
        assert data["category"] == "pagos"
        assert "race" in data["merge_sources"]
        assert "athlete" in data["merge_sources"]
        
        # Verify content contains expected merge fields
        content = data["content"]
        assert "{{athlete_nombre_completo}}" in content, "Missing athlete_nombre_completo merge field"
        assert "{{payment_date}}" in content, "Missing payment_date merge field"
        assert "{{race_name}}" in content, "Missing race_name merge field"
        
        print("✓ payment_receipt_received template has correct fields")


class TestGetTemplateById:
    """Tests for GET /api/email-templates/{template_id}"""
    
    def test_get_existing_template_returns_200(self):
        """Test getting an existing template returns 200"""
        response = requests.get(f"{BASE_URL}/api/email-templates/payment_receipt_received")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ GET existing template returns 200")
    
    def test_get_nonexistent_template_returns_404(self):
        """Test getting a non-existent template returns 404"""
        response = requests.get(f"{BASE_URL}/api/email-templates/nonexistent_template_xyz")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ GET non-existent template returns 404")
    
    def test_get_template_returns_correct_structure(self):
        """Test that GET template returns correct structure"""
        response = requests.get(f"{BASE_URL}/api/email-templates/athlete_registration_confirmation")
        assert response.status_code == 200
        data = response.json()
        
        assert "id" in data
        assert "name" in data
        assert "subject" in data
        assert "content" in data
        assert "category" in data
        assert "merge_sources" in data
        
        assert data["id"] == "athlete_registration_confirmation"
        print("✓ GET template returns correct structure")
    
    def test_get_multiple_templates_by_id(self):
        """Test getting multiple templates by ID"""
        template_ids = [
            "payment_receipt_received",
            "payment_reminder",
            "athlete_registration_confirmation",
            "volunteer_registration_confirmation"
        ]
        
        for template_id in template_ids:
            response = requests.get(f"{BASE_URL}/api/email-templates/{template_id}")
            assert response.status_code == 200, f"Failed to get template: {template_id}"
            data = response.json()
            assert data["id"] == template_id
        
        print(f"✓ Successfully retrieved {len(template_ids)} templates by ID")


class TestPageVisibilityUpdate:
    """Tests for updating page visibility settings"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/race/auth/admin-login",
            json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_update_page_visibility_requires_auth(self):
        """Test that updating page visibility requires authentication"""
        response = requests.put(
            f"{BASE_URL}/api/race-config/update/BYSD-2027",
            json={"show_tracking_page": False}
        )
        assert response.status_code == 401 or response.status_code == 422, \
            f"Expected 401 or 422, got {response.status_code}"
        print("✓ Update page visibility requires authentication")
    
    def test_update_show_tracking_page(self, auth_token):
        """Test updating show_tracking_page setting"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Get current value
        response = requests.get(f"{BASE_URL}/api/race-config/page-visibility")
        original_value = response.json().get("show_tracking_page", True)
        
        # Update to opposite value
        new_value = not original_value
        response = requests.put(
            f"{BASE_URL}/api/race-config/update/BYSD-2027",
            json={"show_tracking_page": new_value},
            headers=headers
        )
        assert response.status_code == 200, f"Failed to update: {response.text}"
        
        # Verify change
        response = requests.get(f"{BASE_URL}/api/race-config/page-visibility")
        assert response.json()["show_tracking_page"] == new_value
        
        # Restore original value
        requests.put(
            f"{BASE_URL}/api/race-config/update/BYSD-2027",
            json={"show_tracking_page": original_value},
            headers=headers
        )
        
        print(f"✓ Successfully updated show_tracking_page: {original_value} -> {new_value} -> {original_value}")
    
    def test_update_show_community_page(self, auth_token):
        """Test updating show_community_page setting"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Get current value
        response = requests.get(f"{BASE_URL}/api/race-config/page-visibility")
        original_value = response.json().get("show_community_page", True)
        
        # Update to opposite value
        new_value = not original_value
        response = requests.put(
            f"{BASE_URL}/api/race-config/update/BYSD-2027",
            json={"show_community_page": new_value},
            headers=headers
        )
        assert response.status_code == 200, f"Failed to update: {response.text}"
        
        # Verify change
        response = requests.get(f"{BASE_URL}/api/race-config/page-visibility")
        assert response.json()["show_community_page"] == new_value
        
        # Restore original value
        requests.put(
            f"{BASE_URL}/api/race-config/update/BYSD-2027",
            json={"show_community_page": original_value},
            headers=headers
        )
        
        print(f"✓ Successfully updated show_community_page: {original_value} -> {new_value} -> {original_value}")


class TestAllExpectedTemplates:
    """Test that all expected templates exist"""
    
    def test_all_expected_templates_exist(self):
        """Verify all expected templates are present"""
        expected_templates = [
            "athlete_registration_confirmation",
            "volunteer_registration_confirmation",
            "volunteer_shift_assignment",
            "volunteer_shift_reminder",
            "payment_reminder",
            "payment_received",
            "payment_receipt_received",
            "payment_confirmed",
            "email_verification",
            "admin_credentials",
            "bib_assignment",
            "runner_summary",
            "athlete_cancellation",
            "volunteer_cancellation",
            "volunteer_verification_code",
            "volunteer_edit_link",
            "payment_rejected",
            "athlete_edit_code"
        ]
        
        response = requests.get(f"{BASE_URL}/api/email-templates/")
        assert response.status_code == 200
        data = response.json()
        
        existing_ids = {t["id"] for t in data}
        
        missing = []
        for template_id in expected_templates:
            if template_id not in existing_ids:
                missing.append(template_id)
        
        assert len(missing) == 0, f"Missing templates: {missing}"
        print(f"✓ All {len(expected_templates)} expected templates exist")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
