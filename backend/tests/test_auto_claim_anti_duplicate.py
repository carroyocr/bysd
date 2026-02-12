"""
Test suite for BYSD-2026 Auto-Claim and Anti-Duplicate features:
1. Auto-claim: When registering with email matching a 2026 BIB, auto-associate result
2. Anti-duplicate: Prevent claiming more than one 2026 result per athlete
"""

import pytest
import requests
import os
import time
from datetime import datetime
from pymongo import MongoClient
from bson import ObjectId

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')

# Test emails from BIB_EMAIL_MAP that should trigger auto-claim
AUTO_CLAIM_EMAIL = "kkephasprp@gmail.com"  # BIB 050
AUTO_CLAIM_BIB = "050"

# Email not in the BIB_EMAIL_MAP - should NOT auto-claim
NON_MATCHING_EMAIL = f"test_no_autoclaim_{int(time.time())}@example.com"

# Existing test account with already claimed result
EXISTING_ACCOUNT_EMAIL = "test.athlete@example.com"
EXISTING_ACCOUNT_PASSWORD = "password123"
EXISTING_CLAIMED_BIB = "002"


class TestSetup:
    """Fixtures and setup utilities"""
    
    @pytest.fixture(scope="class")
    def db_client(self):
        """MongoDB client for direct database access"""
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        yield db
        client.close()
    
    @pytest.fixture(scope="class")
    def api_session(self):
        """Requests session for API calls"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session
    
    @pytest.fixture(scope="class")
    def existing_athlete_token(self, api_session):
        """Login and get token for existing test athlete"""
        response = api_session.post(f"{BASE_URL}/api/athletes/login", json={
            "email": EXISTING_ACCOUNT_EMAIL,
            "password": EXISTING_ACCOUNT_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Could not login existing athlete: {response.status_code} - {response.text}")
        return None


class TestAutoClaim(TestSetup):
    """Test auto-claim functionality when registering with matching 2026 email"""
    
    def test_01_register_with_matching_email_auto_claims(self, db_client, api_session):
        """POST /api/athletes/register with matching email should auto-claim BIB 050"""
        
        # First ensure no existing athlete with this email
        db_client.athletes.delete_many({"email": AUTO_CLAIM_EMAIL})
        
        # Ensure BIB 050 participant exists and is NOT claimed
        participant = db_client.archived_participants.find_one({"bib": {"$in": ["050", "50"]}})
        if not participant:
            # Create one for testing if missing
            db_client.archived_participants.insert_one({
                "bib": "050",
                "nombre": "Test",
                "apellidos": "AutoClaim",
                "race_code": "BYSD-2026",
                "laps_completed": 10,
                "status": "retired"
            })
        else:
            # Remove any existing claim
            db_client.archived_participants.update_one(
                {"_id": participant["_id"]},
                {"$unset": {"claimed_by": ""}}
            )
        
        # Register with matching email
        response = api_session.post(f"{BASE_URL}/api/athletes/register", json={
            "email": AUTO_CLAIM_EMAIL,
            "password": "TestPassword123!",
            "nombre": "Auto",
            "apellidos": "ClaimTest"
        })
        
        print(f"Register response: {response.status_code} - {response.text}")
        assert response.status_code == 200, f"Registration failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert "requires_verification" in data
        
        # Verify athlete was created
        athlete = db_client.athletes.find_one({"email": AUTO_CLAIM_EMAIL})
        assert athlete is not None, "Athlete not created"
        
        # Verify auto-claim happened: athlete.claimed_results should contain the participant ID
        claimed_results = athlete.get("claimed_results", [])
        print(f"Athlete claimed_results: {claimed_results}")
        
        # The participant should now have claimed_by set
        participant = db_client.archived_participants.find_one({"bib": {"$in": ["050", "50"]}})
        print(f"Participant claimed_by: {participant.get('claimed_by')}")
        
        assert len(claimed_results) > 0, "Auto-claim did not add to claimed_results"
        assert participant.get("claimed_by") == str(athlete["_id"]), "Participant not marked as claimed"
    
    def test_02_register_non_matching_email_no_autoclaim(self, db_client, api_session):
        """POST /api/athletes/register with non-matching email should NOT auto-claim"""
        
        # Ensure no existing athlete with this email
        db_client.athletes.delete_many({"email": NON_MATCHING_EMAIL})
        
        response = api_session.post(f"{BASE_URL}/api/athletes/register", json={
            "email": NON_MATCHING_EMAIL,
            "password": "TestPassword456!",
            "nombre": "NoAuto",
            "apellidos": "Claim"
        })
        
        print(f"Register non-matching response: {response.status_code} - {response.text}")
        assert response.status_code == 200, f"Registration failed: {response.text}"
        
        # Verify athlete created but with NO claimed_results
        athlete = db_client.athletes.find_one({"email": NON_MATCHING_EMAIL})
        assert athlete is not None, "Athlete not created"
        
        claimed_results = athlete.get("claimed_results", [])
        print(f"Non-matching athlete claimed_results: {claimed_results}")
        assert len(claimed_results) == 0, "Non-matching email should not auto-claim"
    
    def test_03_autoclaim_marks_participant_correctly(self, db_client):
        """Verify auto-claim properly updates archived_participants.claimed_by"""
        
        athlete = db_client.athletes.find_one({"email": AUTO_CLAIM_EMAIL})
        if not athlete:
            pytest.skip("Auto-claim test athlete not found")
        
        claimed_ids = athlete.get("claimed_results", [])
        assert len(claimed_ids) > 0, "No claimed results on auto-claim athlete"
        
        # Check the claimed participant
        for cid in claimed_ids:
            try:
                participant = db_client.archived_participants.find_one({"_id": ObjectId(cid)})
                if participant:
                    assert participant.get("claimed_by") == str(athlete["_id"])
                    print(f"Verified participant {cid} claimed_by matches athlete {athlete['_id']}")
                    return
            except:
                pass
        
        pytest.fail("Could not verify claimed participant")


class TestAntiDuplicate(TestSetup):
    """Test anti-duplicate control: prevent claiming >1 result from same race"""
    
    def test_04_existing_athlete_login(self, api_session, existing_athlete_token):
        """Verify existing test athlete can login"""
        assert existing_athlete_token is not None, "Could not get token for existing athlete"
        print(f"Got token for existing athlete: {existing_athlete_token[:20]}...")
    
    def test_05_cannot_claim_second_2026_result(self, db_client, api_session, existing_athlete_token):
        """POST /api/athletes/claim-result should reject if athlete already has 2026 claim"""
        
        if not existing_athlete_token:
            pytest.skip("No auth token available")
        
        # Find an unclaimed 2026 participant to try claiming
        unclaimed = db_client.archived_participants.find_one({
            "race_code": {"$regex": "2026", "$options": "i"},
            "claimed_by": {"$exists": False}
        })
        
        if not unclaimed:
            # Create one for testing
            result = db_client.archived_participants.insert_one({
                "bib": "099",
                "nombre": "Unclaimed",
                "apellidos": "Test",
                "race_code": "BYSD-2026",
                "laps_completed": 5,
                "status": "retired"
            })
            unclaimed_id = str(result.inserted_id)
        else:
            unclaimed_id = str(unclaimed["_id"])
        
        print(f"Trying to claim unclaimed participant: {unclaimed_id}")
        
        # Try to claim it - should be rejected
        response = api_session.post(
            f"{BASE_URL}/api/athletes/claim-result",
            json={"result_id": unclaimed_id},
            headers={"Authorization": f"Bearer {existing_athlete_token}"}
        )
        
        print(f"Claim result response: {response.status_code} - {response.text}")
        
        # Should be rejected with 400
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        
        data = response.json()
        assert "ya tienes" in data.get("detail", "").lower() or "already" in data.get("detail", "").lower() or "reclamado" in data.get("detail", "").lower()
    
    def test_06_first_claim_works_for_athlete_without_claims(self, db_client, api_session):
        """POST /api/athletes/claim-result should work for athletes with no 2026 claims"""
        
        # Create a new athlete without any claims
        new_email = f"test_first_claim_{int(time.time())}@example.com"
        db_client.athletes.delete_many({"email": new_email})
        
        # Register
        response = api_session.post(f"{BASE_URL}/api/athletes/register", json={
            "email": new_email,
            "password": "TestFirst123!",
            "nombre": "FirstClaim",
            "apellidos": "Test"
        })
        assert response.status_code == 200, f"Registration failed: {response.text}"
        
        # Manually verify email for testing
        db_client.athletes.update_one(
            {"email": new_email},
            {"$set": {"email_verified": True}}
        )
        
        # Login
        login_response = api_session.post(f"{BASE_URL}/api/athletes/login", json={
            "email": new_email,
            "password": "TestFirst123!"
        })
        
        print(f"Login response: {login_response.status_code} - {login_response.text}")
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        token = login_response.json().get("token")
        assert token, "No token received"
        
        # Find/create an unclaimed participant
        unclaimed = db_client.archived_participants.find_one({
            "race_code": {"$regex": "2026", "$options": "i"},
            "claimed_by": {"$exists": False}
        })
        
        if not unclaimed:
            result = db_client.archived_participants.insert_one({
                "bib": "098",
                "nombre": "Second",
                "apellidos": "Unclaimed",
                "race_code": "BYSD-2026",
                "laps_completed": 3,
                "status": "retired"
            })
            unclaimed_id = str(result.inserted_id)
        else:
            unclaimed_id = str(unclaimed["_id"])
        
        print(f"Claiming unclaimed participant: {unclaimed_id}")
        
        # Claim should succeed
        response = api_session.post(
            f"{BASE_URL}/api/athletes/claim-result",
            json={"result_id": unclaimed_id},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        print(f"First claim response: {response.status_code} - {response.text}")
        assert response.status_code == 200, f"First claim should succeed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        
        # Now try claiming another - should be rejected
        another_unclaimed = db_client.archived_participants.find_one({
            "race_code": {"$regex": "2026", "$options": "i"},
            "claimed_by": {"$exists": False},
            "_id": {"$ne": ObjectId(unclaimed_id)}
        })
        
        if another_unclaimed:
            second_response = api_session.post(
                f"{BASE_URL}/api/athletes/claim-result",
                json={"result_id": str(another_unclaimed["_id"])},
                headers={"Authorization": f"Bearer {token}"}
            )
            print(f"Second claim attempt response: {second_response.status_code} - {second_response.text}")
            assert second_response.status_code == 400, "Second claim should be rejected"
        
        # Cleanup
        db_client.athletes.delete_one({"email": new_email})


class TestRaceHistoryWithAutoClaim(TestSetup):
    """Test that race-history correctly shows auto-claimed results"""
    
    def test_07_race_history_shows_autoclaimed_result(self, db_client, api_session):
        """GET /api/athletes/race-history should include auto-claimed result"""
        
        # First verify athlete and manually verify email
        athlete = db_client.athletes.find_one({"email": AUTO_CLAIM_EMAIL})
        if not athlete:
            pytest.skip("Auto-claim athlete not found")
        
        db_client.athletes.update_one(
            {"email": AUTO_CLAIM_EMAIL},
            {"$set": {"email_verified": True}}
        )
        
        # Login
        login_response = api_session.post(f"{BASE_URL}/api/athletes/login", json={
            "email": AUTO_CLAIM_EMAIL,
            "password": "TestPassword123!"
        })
        
        print(f"Login response: {login_response.status_code} - {login_response.text}")
        
        if login_response.status_code != 200:
            pytest.skip(f"Could not login auto-claim athlete: {login_response.text}")
        
        token = login_response.json().get("token")
        
        # Get race history
        response = api_session.get(
            f"{BASE_URL}/api/athletes/race-history",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        print(f"Race history response: {response.status_code} - {response.text}")
        assert response.status_code == 200, f"Race history failed: {response.text}"
        
        data = response.json()
        history = data.get("history", [])
        print(f"Race history entries: {len(history)}")
        
        # Should have at least the auto-claimed result
        assert len(history) > 0, "Race history should include auto-claimed result"
        
        # Check for the BIB 050 entry
        bib_050_entry = None
        for entry in history:
            bib = entry.get("bib", "")
            if bib in ["050", "50"]:
                bib_050_entry = entry
                break
        
        if bib_050_entry:
            print(f"Found BIB 050 entry: {bib_050_entry}")
            assert bib_050_entry.get("is_claimed") == True
            assert "2026" in bib_050_entry.get("race_code", "")


class TestCleanup:
    """Cleanup test data after tests complete"""
    
    def test_99_cleanup(self):
        """Remove test-created data"""
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        
        # Remove test athletes
        db.athletes.delete_many({"email": AUTO_CLAIM_EMAIL})
        db.athletes.delete_many({"email": {"$regex": "^test_no_autoclaim_"}})
        db.athletes.delete_many({"email": {"$regex": "^test_first_claim_"}})
        
        # Reset any test participants
        db.archived_participants.update_many(
            {"bib": {"$in": ["098", "099"]}},
            {"$unset": {"claimed_by": ""}}
        )
        
        # Reset BIB 050 if it was used for auto-claim test
        db.archived_participants.update_one(
            {"bib": {"$in": ["050", "50"]}},
            {"$unset": {"claimed_by": ""}}
        )
        
        client.close()
        print("Test cleanup completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
