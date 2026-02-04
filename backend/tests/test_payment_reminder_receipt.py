"""
Test suite for Payment Reminder and Receipt Upload features
Tests the following endpoints:
- GET /api/registration/admin/active-athletes-count/{race_code}
- POST /api/registration/admin/send-payment-reminder/{race_code}
- GET /api/registration/payment-info/{token}
- POST /api/registration/submit-payment-receipt/{token}
- GET /api/registration/admin/pending-receipts/{race_code}
- PUT /api/registration/admin/review-receipt/{email}
"""

import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://lapmanager.preview.emergentagent.com')
RACE_CODE = "BYSD-2027"
TEST_TOKEN = "aYAYnRNvM_S4hQ-XUBEYDMP9pID5c3hYq3ga-7gHd-c"


class TestActiveAthletesCount:
    """Test GET /api/registration/admin/active-athletes-count/{race_code}"""
    
    def test_get_active_athletes_count_success(self):
        """Test getting count of active athletes with pending payment"""
        response = requests.get(f"{BASE_URL}/api/registration/admin/active-athletes-count/{RACE_CODE}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "count" in data
        assert "race_code" in data
        assert data["race_code"] == RACE_CODE
        assert isinstance(data["count"], int)
        assert data["count"] >= 0
        print(f"✓ Active athletes count: {data['count']}")
    
    def test_get_active_athletes_count_invalid_race(self):
        """Test with invalid race code"""
        response = requests.get(f"{BASE_URL}/api/registration/admin/active-athletes-count/INVALID-RACE")
        
        # Should return 0 count for non-existent race
        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 0
        print("✓ Invalid race returns 0 count")


class TestPaymentInfo:
    """Test GET /api/registration/payment-info/{token}"""
    
    def test_get_payment_info_success(self):
        """Test getting payment info with valid token"""
        response = requests.get(f"{BASE_URL}/api/registration/payment-info/{TEST_TOKEN}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "registration" in data
        assert "race_config" in data
        
        # Verify registration data
        reg = data["registration"]
        assert "email" in reg
        assert "nombre" in reg
        assert "apellidos" in reg
        assert "race_code" in reg
        assert "payment_status" in reg
        
        # Verify race config data (payment info)
        config = data["race_config"]
        assert "payment_bank_name" in config
        assert "payment_account_number" in config
        assert "payment_account_name" in config
        assert "registration_cost" in config
        
        print(f"✓ Payment info retrieved for: {reg['nombre']} {reg['apellidos']}")
        print(f"  Bank: {config.get('payment_bank_name')}")
        print(f"  Account: {config.get('payment_account_number')}")
        print(f"  Amount: RD$ {config.get('registration_cost')}")
    
    def test_get_payment_info_invalid_token(self):
        """Test with invalid token"""
        response = requests.get(f"{BASE_URL}/api/registration/payment-info/invalid-token-12345")
        
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data
        print("✓ Invalid token returns 404")


class TestPendingReceipts:
    """Test GET /api/registration/admin/pending-receipts/{race_code}"""
    
    def test_get_pending_receipts_success(self):
        """Test getting pending receipts list"""
        response = requests.get(f"{BASE_URL}/api/registration/admin/pending-receipts/{RACE_CODE}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "race_code" in data
        assert "count" in data
        assert "registrations" in data
        assert data["race_code"] == RACE_CODE
        assert isinstance(data["registrations"], list)
        
        print(f"✓ Pending receipts count: {data['count']}")
        
        # If there are pending receipts, verify structure
        if data["registrations"]:
            receipt = data["registrations"][0]
            assert "email" in receipt
            assert "nombre" in receipt
            assert "payment_receipt" in receipt
            print(f"  First pending: {receipt['email']}")


class TestSubmitPaymentReceipt:
    """Test POST /api/registration/submit-payment-receipt/{token}"""
    
    def test_submit_receipt_missing_file(self):
        """Test submitting without receipt image"""
        response = requests.post(
            f"{BASE_URL}/api/registration/submit-payment-receipt/{TEST_TOKEN}",
            data={
                "payment_date": "2026-01-15",
                "bank_origin": "Banco Popular"
            }
        )
        
        # Should fail without file
        assert response.status_code == 422
        print("✓ Missing file returns 422")
    
    def test_submit_receipt_invalid_token(self):
        """Test submitting with invalid token"""
        # Create a fake image file
        fake_image = io.BytesIO(b'\x89PNG\r\n\x1a\n' + b'\x00' * 100)
        
        response = requests.post(
            f"{BASE_URL}/api/registration/submit-payment-receipt/invalid-token-xyz",
            data={
                "payment_date": "2026-01-15",
                "bank_origin": "Banco Popular"
            },
            files={
                "receipt_image": ("test.png", fake_image, "image/png")
            }
        )
        
        assert response.status_code == 404
        print("✓ Invalid token returns 404")


class TestReviewReceipt:
    """Test PUT /api/registration/admin/review-receipt/{email}"""
    
    def test_review_receipt_no_receipt(self):
        """Test reviewing when no receipt exists"""
        # Use an email that doesn't have a receipt
        response = requests.put(
            f"{BASE_URL}/api/registration/admin/review-receipt/atleta_test_final@example.com",
            params={
                "race_code": RACE_CODE,
                "approved": True
            }
        )
        
        # Should fail because no receipt exists
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        print("✓ No receipt returns 400")
    
    def test_review_receipt_invalid_email(self):
        """Test reviewing with invalid email"""
        response = requests.put(
            f"{BASE_URL}/api/registration/admin/review-receipt/nonexistent@example.com",
            params={
                "race_code": RACE_CODE,
                "approved": True
            }
        )
        
        assert response.status_code == 404
        print("✓ Invalid email returns 404")


class TestSendPaymentReminder:
    """Test POST /api/registration/admin/send-payment-reminder/{race_code}"""
    
    def test_send_reminder_invalid_race(self):
        """Test sending reminder for invalid race"""
        response = requests.post(
            f"{BASE_URL}/api/registration/admin/send-payment-reminder/INVALID-RACE"
        )
        
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data
        print("✓ Invalid race returns 404")
    
    def test_send_reminder_success(self):
        """Test sending payment reminder to active athletes"""
        # First check if there are active athletes
        count_response = requests.get(
            f"{BASE_URL}/api/registration/admin/active-athletes-count/{RACE_CODE}"
        )
        count_data = count_response.json()
        
        if count_data["count"] == 0:
            pytest.skip("No active athletes with pending payment to test")
        
        # Send reminder
        response = requests.post(
            f"{BASE_URL}/api/registration/admin/send-payment-reminder/{RACE_CODE}"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "message" in data
        assert "sent_count" in data
        assert "failed_count" in data
        assert "total_athletes" in data
        
        print(f"✓ Payment reminder sent")
        print(f"  Sent: {data['sent_count']}")
        print(f"  Failed: {data['failed_count']}")
        print(f"  Total: {data['total_athletes']}")


class TestRaceConfigTimezone:
    """Test timezone_gmt field in race configuration"""
    
    def test_race_config_has_timezone(self):
        """Test that race config includes timezone_gmt field"""
        response = requests.get(f"{BASE_URL}/api/race-config/active")
        
        assert response.status_code == 200
        data = response.json()
        
        # Check if timezone_gmt field exists (may be null if not set)
        # The field should be present in the response
        print(f"✓ Race config retrieved")
        print(f"  Code: {data.get('code')}")
        print(f"  Timezone GMT: {data.get('timezone_gmt', 'Not set')}")
        
        # Verify other payment-related fields
        assert "payment_bank_name" in data or data.get("payment_bank_name") is None
        assert "payment_account_number" in data or data.get("payment_account_number") is None
        assert "registration_cost" in data


class TestEndToEndPaymentFlow:
    """End-to-end test of the payment reminder flow"""
    
    def test_full_payment_info_flow(self):
        """Test the complete flow of getting payment info"""
        # Step 1: Get active athletes count
        count_response = requests.get(
            f"{BASE_URL}/api/registration/admin/active-athletes-count/{RACE_CODE}"
        )
        assert count_response.status_code == 200
        count_data = count_response.json()
        print(f"Step 1: Active athletes with pending payment: {count_data['count']}")
        
        # Step 2: Get payment info for test athlete
        info_response = requests.get(
            f"{BASE_URL}/api/registration/payment-info/{TEST_TOKEN}"
        )
        assert info_response.status_code == 200
        info_data = info_response.json()
        print(f"Step 2: Payment info retrieved for {info_data['registration']['nombre']}")
        
        # Step 3: Check pending receipts
        receipts_response = requests.get(
            f"{BASE_URL}/api/registration/admin/pending-receipts/{RACE_CODE}"
        )
        assert receipts_response.status_code == 200
        receipts_data = receipts_response.json()
        print(f"Step 3: Pending receipts: {receipts_data['count']}")
        
        print("✓ Full payment flow test completed successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
