"""
Test Volunteer Registration Edit Mode
Tests for GET /api/volunteer-registration/by-token/{token} and PUT /api/volunteer-registration/update/{token}
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test token provided by main agent
TEST_TOKEN = "EDT78bhF8KUlbVBcnoSqO1oArwmR5mm6"
INVALID_TOKEN = "INVALID_TOKEN_12345678901234567890"


class TestVolunteerByToken:
    """Tests for GET /api/volunteer-registration/by-token/{token}"""
    
    def test_get_registration_by_valid_token(self):
        """Test retrieving volunteer registration with valid token"""
        response = requests.get(f"{BASE_URL}/api/volunteer-registration/by-token/{TEST_TOKEN}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify required fields are present
        assert "email" in data, "Response should contain email"
        assert "nombre" in data, "Response should contain nombre"
        assert "apellidos" in data, "Response should contain apellidos"
        assert "telefono" in data, "Response should contain telefono"
        assert "slots_interes" in data, "Response should contain slots_interes"
        
        # Verify email matches expected test volunteer
        assert data["email"] == "test_volunteer@example.com", f"Expected test_volunteer@example.com, got {data['email']}"
        
        # Verify edit_token is NOT exposed in response (security)
        assert "edit_token" not in data, "edit_token should not be exposed in response"
        
        # Verify _id is NOT in response
        assert "_id" not in data, "_id should not be in response"
        
        print(f"✓ Valid token returns volunteer data: {data['nombre']} {data['apellidos']}")
    
    def test_get_registration_by_invalid_token(self):
        """Test retrieving volunteer registration with invalid token returns 404"""
        response = requests.get(f"{BASE_URL}/api/volunteer-registration/by-token/{INVALID_TOKEN}")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data, "Response should contain detail message"
        assert "no encontrado" in data["detail"].lower() or "not found" in data["detail"].lower(), \
            f"Error message should indicate not found, got: {data['detail']}"
        
        print(f"✓ Invalid token returns 404: {data['detail']}")
    
    def test_get_registration_empty_token(self):
        """Test retrieving with empty token returns 404 or 422"""
        response = requests.get(f"{BASE_URL}/api/volunteer-registration/by-token/")
        
        # Empty token should return 404 (not found) or 422 (validation error)
        assert response.status_code in [404, 422], f"Expected 404 or 422, got {response.status_code}"
        
        print(f"✓ Empty token returns {response.status_code}")


class TestVolunteerUpdate:
    """Tests for PUT /api/volunteer-registration/update/{token}"""
    
    def test_update_registration_with_valid_token(self):
        """Test updating volunteer registration with valid token"""
        # First get current data
        get_response = requests.get(f"{BASE_URL}/api/volunteer-registration/by-token/{TEST_TOKEN}")
        assert get_response.status_code == 200
        original_data = get_response.json()
        
        # Prepare update data with all required fields
        update_data = {
            "nombre": "Pedro",
            "apellidos": "Actualizado Test",
            "fecha_nacimiento": original_data.get("fecha_nacimiento", "1990-01-15"),
            "sexo": original_data.get("sexo", "Masculino"),
            "nacionalidad": original_data.get("nacionalidad", "Dominicana"),
            "telefono": original_data.get("telefono", "809-555-1234"),
            "ciudad_residencia": original_data.get("ciudad_residencia", "Santo Domingo"),
            "experiencia_voluntariado": original_data.get("experiencia_voluntariado", "Sí"),
            "experiencia_voluntariado_detalle": "Experiencia actualizada via test",
            "slots_interes": [13, 14],
            "tipo_sangre": "O+",
            "condicion_medica": "No",
            "alergias": "No",
            "contacto_emergencia_nombre": "María Test",
            "contacto_emergencia_telefono": "809-555-5678"
        }
        
        # Update
        response = requests.put(
            f"{BASE_URL}/api/volunteer-registration/update/{TEST_TOKEN}",
            json=update_data,
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should contain success message"
        
        # Verify update persisted by fetching again
        verify_response = requests.get(f"{BASE_URL}/api/volunteer-registration/by-token/{TEST_TOKEN}")
        assert verify_response.status_code == 200
        
        updated_data = verify_response.json()
        assert updated_data["apellidos"] == "Actualizado Test", \
            f"Expected 'Actualizado Test', got {updated_data['apellidos']}"
        
        print(f"✓ Update successful: {data['message']}")
        
        # Restore original apellidos
        update_data["apellidos"] = "Actualizado"
        requests.put(
            f"{BASE_URL}/api/volunteer-registration/update/{TEST_TOKEN}",
            json=update_data,
            headers={"Content-Type": "application/json"}
        )
    
    def test_update_registration_with_invalid_token(self):
        """Test updating volunteer registration with invalid token returns 404"""
        update_data = {
            "nombre": "Test",
            "apellidos": "User",
            "fecha_nacimiento": "1990-01-15",
            "sexo": "Masculino",
            "nacionalidad": "Dominicana",
            "telefono": "809-555-1234",
            "ciudad_residencia": "Santo Domingo",
            "experiencia_voluntariado": "No",
            "contacto_emergencia_nombre": "Emergency Contact",
            "contacto_emergencia_telefono": "809-555-5678"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/volunteer-registration/update/{INVALID_TOKEN}",
            json=update_data,
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data, "Response should contain detail message"
        
        print(f"✓ Invalid token update returns 404: {data['detail']}")
    
    def test_update_slots_interes(self):
        """Test updating slots_interes field"""
        # Get current data
        get_response = requests.get(f"{BASE_URL}/api/volunteer-registration/by-token/{TEST_TOKEN}")
        original_data = get_response.json()
        original_slots = original_data.get("slots_interes", [])
        
        # Update with new slots
        new_slots = [13, 14, 15] if 15 not in original_slots else [13, 14]
        
        update_data = {
            "nombre": original_data.get("nombre", "Pedro"),
            "apellidos": original_data.get("apellidos", "Actualizado"),
            "fecha_nacimiento": original_data.get("fecha_nacimiento", "1990-01-15"),
            "sexo": original_data.get("sexo", "Masculino"),
            "nacionalidad": original_data.get("nacionalidad", "Dominicana"),
            "telefono": original_data.get("telefono", "809-555-1234"),
            "ciudad_residencia": original_data.get("ciudad_residencia", "Santo Domingo"),
            "experiencia_voluntariado": original_data.get("experiencia_voluntariado", "Sí"),
            "slots_interes": new_slots,
            "contacto_emergencia_nombre": original_data.get("contacto_emergencia_nombre", "María Test"),
            "contacto_emergencia_telefono": original_data.get("contacto_emergencia_telefono", "809-555-5678")
        }
        
        response = requests.put(
            f"{BASE_URL}/api/volunteer-registration/update/{TEST_TOKEN}",
            json=update_data,
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Verify slots updated
        verify_response = requests.get(f"{BASE_URL}/api/volunteer-registration/by-token/{TEST_TOKEN}")
        updated_data = verify_response.json()
        
        assert updated_data["slots_interes"] == new_slots, \
            f"Expected slots {new_slots}, got {updated_data['slots_interes']}"
        
        print(f"✓ Slots updated successfully: {new_slots}")
        
        # Restore original slots
        update_data["slots_interes"] = [13, 14]
        requests.put(
            f"{BASE_URL}/api/volunteer-registration/update/{TEST_TOKEN}",
            json=update_data,
            headers={"Content-Type": "application/json"}
        )
    
    def test_update_missing_required_fields(self):
        """Test update with missing required fields returns 422"""
        # Missing nombre, apellidos, etc.
        incomplete_data = {
            "telefono": "809-555-1234"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/volunteer-registration/update/{TEST_TOKEN}",
            json=incomplete_data,
            headers={"Content-Type": "application/json"}
        )
        
        # Should return 422 validation error
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
        
        print(f"✓ Missing required fields returns 422")


class TestAvailableSlots:
    """Tests for GET /api/volunteer-registration/available-slots"""
    
    def test_get_available_slots(self):
        """Test retrieving available volunteer slots"""
        response = requests.get(f"{BASE_URL}/api/volunteer-registration/available-slots")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify response structure
        assert "positions" in data, "Response should contain positions"
        assert "shifts_info" in data, "Response should contain shifts_info"
        assert "race_date" in data, "Response should contain race_date"
        
        # Verify positions is a list
        assert isinstance(data["positions"], list), "positions should be a list"
        
        print(f"✓ Available slots returned: {len(data['positions'])} positions")
        
        # If there are positions, verify structure
        if data["positions"]:
            pos = data["positions"][0]
            assert "puesto" in pos, "Position should have puesto"
            assert "turnos" in pos, "Position should have turnos"
            
            if pos["turnos"]:
                turno = pos["turnos"][0]
                assert "turno" in turno, "Turno should have turno number"
                assert "hora_inicio" in turno, "Turno should have hora_inicio"
                assert "hora_fin" in turno, "Turno should have hora_fin"
                assert "slots" in turno, "Turno should have slots"
                
                print(f"✓ Position structure verified: {pos['puesto']}")


class TestEditModeIntegration:
    """Integration tests for edit mode flow"""
    
    def test_full_edit_flow(self):
        """Test complete edit flow: load -> modify -> save -> verify"""
        # Step 1: Load existing registration
        load_response = requests.get(f"{BASE_URL}/api/volunteer-registration/by-token/{TEST_TOKEN}")
        assert load_response.status_code == 200, "Failed to load registration"
        original_data = load_response.json()
        
        print(f"✓ Step 1: Loaded registration for {original_data['email']}")
        
        # Step 2: Modify data
        modified_comentarios = f"Test comment updated at {os.popen('date').read().strip()}"
        
        update_data = {
            "nombre": original_data.get("nombre", "Pedro"),
            "apellidos": original_data.get("apellidos", "Actualizado"),
            "fecha_nacimiento": original_data.get("fecha_nacimiento", "1990-01-15"),
            "sexo": original_data.get("sexo", "Masculino"),
            "nacionalidad": original_data.get("nacionalidad", "Dominicana"),
            "telefono": original_data.get("telefono", "809-555-1234"),
            "ciudad_residencia": original_data.get("ciudad_residencia", "Santo Domingo"),
            "experiencia_voluntariado": original_data.get("experiencia_voluntariado", "Sí"),
            "experiencia_voluntariado_detalle": original_data.get("experiencia_voluntariado_detalle", ""),
            "slots_interes": original_data.get("slots_interes", [13, 14]),
            "tipo_sangre": original_data.get("tipo_sangre", "O+"),
            "condicion_medica": original_data.get("condicion_medica", "No"),
            "alergias": original_data.get("alergias", "No"),
            "contacto_emergencia_nombre": original_data.get("contacto_emergencia_nombre", "María Test"),
            "contacto_emergencia_relacion": original_data.get("contacto_emergencia_relacion", ""),
            "contacto_emergencia_telefono": original_data.get("contacto_emergencia_telefono", "809-555-5678"),
            "talla_camiseta": "L",
            "como_se_entero": "Redes Sociales",
            "comentarios": modified_comentarios
        }
        
        # Step 3: Save changes
        save_response = requests.put(
            f"{BASE_URL}/api/volunteer-registration/update/{TEST_TOKEN}",
            json=update_data,
            headers={"Content-Type": "application/json"}
        )
        assert save_response.status_code == 200, f"Failed to save: {save_response.text}"
        
        print(f"✓ Step 2-3: Modified and saved registration")
        
        # Step 4: Verify changes persisted
        verify_response = requests.get(f"{BASE_URL}/api/volunteer-registration/by-token/{TEST_TOKEN}")
        assert verify_response.status_code == 200
        
        verified_data = verify_response.json()
        assert verified_data["comentarios"] == modified_comentarios, \
            f"Comments not updated. Expected: {modified_comentarios}, Got: {verified_data.get('comentarios')}"
        assert verified_data["talla_camiseta"] == "L", "Talla not updated"
        assert verified_data["como_se_entero"] == "Redes Sociales", "Como se entero not updated"
        
        print(f"✓ Step 4: Verified changes persisted")
        print(f"✓ Full edit flow completed successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
