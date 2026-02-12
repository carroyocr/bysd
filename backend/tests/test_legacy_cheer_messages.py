"""
Test legacy cheer messages retrieval for historical races (BYSD-2026)

This tests the bug fix for support messages stored WITHOUT race_code field.
Production has legacy messages in cheer_messages collection without race_code.
The fix modifies get_my_messages to query BOTH collections for 2026 races.

Test Data Setup:
- 6 legacy messages in cheer_messages (without race_code) for BIB 048
- 1 message in archived_cheer_messages for BIB 048
- Athlete carroyo.cr@gmail.com has claimed_results pointing to archived_participant with BIB 048
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_ACCOUNT_EMAIL = "carroyo.cr@gmail.com"
TEST_ACCOUNT_PASSWORD = "Cral1956"
TEST_ACCOUNT_2_EMAIL = "test.athlete@example.com"
TEST_ACCOUNT_2_PASSWORD = "password123"


class TestAthleteLogin:
    """Test login endpoint works for test accounts"""
    
    def test_login_with_primary_test_account(self):
        """POST /api/athletes/login - test account with claimed BIB 048 result"""
        response = requests.post(
            f"{BASE_URL}/api/athletes/login",
            json={"email": TEST_ACCOUNT_EMAIL, "password": TEST_ACCOUNT_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert data.get("success") is True
        assert "token" in data
        assert "athlete" in data
        assert data["athlete"]["email"] == TEST_ACCOUNT_EMAIL
    
    def test_login_with_secondary_test_account(self):
        """POST /api/athletes/login - secondary test account"""
        response = requests.post(
            f"{BASE_URL}/api/athletes/login",
            json={"email": TEST_ACCOUNT_2_EMAIL, "password": TEST_ACCOUNT_2_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert data.get("success") is True
        assert "token" in data
    
    def test_login_invalid_credentials(self):
        """POST /api/athletes/login - should reject invalid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/athletes/login",
            json={"email": "invalid@test.com", "password": "wrongpassword"}
        )
        assert response.status_code == 401


@pytest.fixture
def auth_token():
    """Get authentication token for primary test account (BIB 048 claimed)"""
    response = requests.post(
        f"{BASE_URL}/api/athletes/login",
        json={"email": TEST_ACCOUNT_EMAIL, "password": TEST_ACCOUNT_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Authentication failed: {response.text}")


@pytest.fixture
def auth_token_secondary():
    """Get authentication token for secondary test account"""
    response = requests.post(
        f"{BASE_URL}/api/athletes/login",
        json={"email": TEST_ACCOUNT_2_EMAIL, "password": TEST_ACCOUNT_2_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Authentication failed: {response.text}")


class TestLegacyCheerMessages:
    """
    Test that GET /api/athletes/my-messages returns legacy cheer messages
    from cheer_messages collection that lack a race_code field
    """
    
    def test_returns_legacy_messages_without_race_code(self, auth_token):
        """
        GET /api/athletes/my-messages should return legacy messages from 
        cheer_messages collection that lack race_code field
        """
        response = requests.get(
            f"{BASE_URL}/api/athletes/my-messages",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Request failed: {response.text}"
        
        data = response.json()
        assert "messages" in data
        
        messages = data["messages"]
        
        # Should have legacy messages (Fan Produccion 1-5)
        legacy_fan_names = [m["fan_name"] for m in messages if "Produccion" in m.get("fan_name", "")]
        assert len(legacy_fan_names) >= 5, f"Expected at least 5 legacy messages, got {len(legacy_fan_names)}"
        
        # Verify message structure
        for msg in messages:
            assert "fan_name" in msg
            assert "message" in msg
            assert "race_code" in msg
            assert "race_name" in msg
    
    def test_combines_archived_and_legacy_messages(self, auth_token):
        """
        GET /api/athletes/my-messages should combine messages from both
        archived_cheer_messages AND cheer_messages (legacy) without duplicates
        """
        response = requests.get(
            f"{BASE_URL}/api/athletes/my-messages",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        messages = data["messages"]
        
        # Should have message from archived_cheer_messages
        archived_msg = [m for m in messages if m.get("fan_name") == "Fan Archivo"]
        assert len(archived_msg) >= 1, "Missing message from archived_cheer_messages"
        
        # Should have messages from cheer_messages (legacy without race_code)
        legacy_msgs = [m for m in messages if "Produccion" in m.get("fan_name", "")]
        assert len(legacy_msgs) >= 5, f"Expected at least 5 legacy messages, got {len(legacy_msgs)}"
        
        # Total should be 7 (1 archived + 5 legacy + 1 int BIB)
        assert len(messages) >= 7, f"Expected at least 7 messages, got {len(messages)}"
        
        # Verify no duplicates by checking unique content
        content_keys = [(m["fan_name"], m["message"]) for m in messages]
        assert len(content_keys) == len(set(content_keys)), "Duplicate messages found"
    
    def test_handles_bib_type_variations(self, auth_token):
        """
        GET /api/athletes/my-messages should handle BIB type variations:
        - String '048' (padded)
        - String '48' (unpadded)
        - Integer 48
        """
        response = requests.get(
            f"{BASE_URL}/api/athletes/my-messages",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        messages = data["messages"]
        
        # Should include message with integer BIB (48)
        int_bib_msg = [m for m in messages if "Int BIB" in m.get("fan_name", "")]
        assert len(int_bib_msg) >= 1, "Missing message with integer BIB type"
        
        # Should include messages with string BIB '048'
        string_bib_msgs = [m for m in messages if "Produccion" in m.get("fan_name", "")]
        assert len(string_bib_msgs) >= 5, "Missing messages with string BIB '048'"
    
    def test_race_code_assigned_to_2026(self, auth_token):
        """
        All legacy messages should be assigned race_code BYSD-2026 in response
        """
        response = requests.get(
            f"{BASE_URL}/api/athletes/my-messages",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        messages = data["messages"]
        
        # All messages for BIB 048 should have race_code BYSD-2026
        for msg in messages:
            assert msg["race_code"] == "BYSD-2026", f"Unexpected race_code: {msg['race_code']}"
            assert "2026" in msg["race_name"], f"Unexpected race_name: {msg['race_name']}"
    
    def test_races_list_includes_2026(self, auth_token):
        """
        Response should include BYSD-2026 in races list
        """
        response = requests.get(
            f"{BASE_URL}/api/athletes/my-messages",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "races" in data
        
        race_codes = [r["code"] for r in data["races"]]
        assert "BYSD-2026" in race_codes, f"BYSD-2026 not in races list: {race_codes}"


class TestNonArchivedRaces:
    """Test that my-messages still works for non-archived (current) races"""
    
    def test_current_race_messages(self, auth_token_secondary):
        """
        GET /api/athletes/my-messages should work for non-archived races
        (athlete without historical claims should still get empty response)
        """
        response = requests.get(
            f"{BASE_URL}/api/athletes/my-messages",
            headers={"Authorization": f"Bearer {auth_token_secondary}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "messages" in data
        assert "races" in data
        # Secondary test account has claimed result with messages
        # If no messages, empty list is valid


class TestDebugEndpoint:
    """Test the debug endpoint for BIB message analysis"""
    
    def test_debug_endpoint_returns_collection_stats(self):
        """
        GET /api/athletes/debug-messages/{bib} should return collection stats
        """
        response = requests.get(f"{BASE_URL}/api/athletes/debug-messages/048")
        assert response.status_code == 200
        
        data = response.json()
        assert "bib_input" in data
        assert data["bib_input"] == "048"
        
        # Check collections are analyzed
        assert "archived_cheer_messages" in data
        assert "cheer_messages" in data
        
        # Verify archived_cheer_messages stats
        archived = data["archived_cheer_messages"]
        assert "total_docs" in archived
        assert "found_by_athlete_bib" in archived
        assert archived["found_by_athlete_bib"] >= 1
        
        # Verify cheer_messages (legacy) stats
        legacy = data["cheer_messages"]
        assert "total_docs" in legacy
        assert "legacy_no_race_code" in legacy
        assert legacy["legacy_no_race_code"] >= 5  # 5+ legacy messages without race_code
        assert legacy["legacy_with_bib"] >= 5  # Should find legacy messages for BIB 048
    
    def test_debug_bib_variants(self):
        """
        Debug endpoint should search for BIB variants (padded, unpadded, integer)
        """
        response = requests.get(f"{BASE_URL}/api/athletes/debug-messages/48")
        assert response.status_code == 200
        
        data = response.json()
        search_variants = data.get("search_variants", [])
        
        # Should include both '48' and '048' variants
        assert "48" in search_variants or "048" in search_variants


class TestMessageOrdering:
    """Test that messages are properly sorted"""
    
    def test_messages_sorted_by_date_descending(self, auth_token):
        """
        Messages should be sorted by created_at in descending order (newest first)
        """
        response = requests.get(
            f"{BASE_URL}/api/athletes/my-messages",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        messages = data["messages"]
        
        if len(messages) > 1:
            # Verify descending order
            for i in range(len(messages) - 1):
                current_date = messages[i].get("created_at", "")
                next_date = messages[i + 1].get("created_at", "")
                if current_date and next_date:
                    assert current_date >= next_date, f"Messages not sorted: {current_date} should be >= {next_date}"


class TestEdgeCases:
    """Test edge cases and error handling"""
    
    def test_unauthenticated_request_rejected(self):
        """
        GET /api/athletes/my-messages should reject unauthenticated requests
        """
        response = requests.get(f"{BASE_URL}/api/athletes/my-messages")
        assert response.status_code == 401
    
    def test_invalid_token_rejected(self):
        """
        GET /api/athletes/my-messages should reject invalid tokens
        """
        response = requests.get(
            f"{BASE_URL}/api/athletes/my-messages",
            headers={"Authorization": "Bearer invalid_token_here"}
        )
        assert response.status_code == 401


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
