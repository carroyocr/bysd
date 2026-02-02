"""
Test registration cancellation functionality
"""
import pytest
import asyncio
import sys
import os
from httpx import AsyncClient

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

from server import app
from models.database import registrations_collection
from datetime import datetime, timezone


@pytest.fixture
async def test_registration():
    """Create a test registration for cancellation tests"""
    test_data = {
        "email": "test@example.com",
        "nombre": "Test",
        "apellidos": "User",
        "fecha_nacimiento": "1990-01-01",
        "sexo": "Masculino",
        "nacionalidad": "Dominicana",
        "telefono": "+1 809 555 0000",
        "ciudad_residencia": "Santo Domingo",
        "anos_experiencia": 5,
        "maxima_distancia_km": 42.2,
        "motivacion": "Test motivation",
        "tipo_sangre": "O+",
        "condicion_medica": "No",
        "alergias": "No",
        "contacto_emergencia_nombre": "Emergency Contact",
        "contacto_emergencia_telefono": "+1 809 555 0001",
        "talla_camiseta": "M",
        "personalizacion_camiseta": "TEST",
        "race_code": "TEST2024",
        "edit_token": "test-token-123",
        "status": "pre_registered",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    # Insert test registration
    await registrations_collection.insert_one(test_data)
    
    yield test_data
    
    # Cleanup
    await registrations_collection.delete_one({"edit_token": "test-token-123"})


@pytest.mark.asyncio
async def test_cancel_registration_success(test_registration):
    """Test successful registration cancellation"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/api/registration/cancel/test-token-123",
            json={
                "reason": "Me lesioné",
                "other_reason": None
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Registro cancelado exitosamente"
        
        # Verify registration is marked as cancelled
        registration = await registrations_collection.find_one({"edit_token": "test-token-123"})
        assert registration["status"] == "cancelled"
        assert registration["cancellation_reason"] == "Me lesioné"
        assert "cancelled_at" in registration


@pytest.mark.asyncio
async def test_cancel_registration_with_other_reason(test_registration):
    """Test registration cancellation with custom reason"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/api/registration/cancel/test-token-123",
            json={
                "reason": "Otra razón",
                "other_reason": "Custom cancellation reason"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Registro cancelado exitosamente"
        
        # Verify registration is marked as cancelled with custom reason
        registration = await registrations_collection.find_one({"edit_token": "test-token-123"})
        assert registration["status"] == "cancelled"
        assert registration["cancellation_reason"] == "Otra razón: Custom cancellation reason"


@pytest.mark.asyncio
async def test_cancel_registration_invalid_token():
    """Test cancellation with invalid token"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/api/registration/cancel/invalid-token",
            json={
                "reason": "Me lesioné",
                "other_reason": None
            }
        )
        
        assert response.status_code == 404
        data = response.json()
        assert data["detail"] == "Registro no encontrado"


@pytest.mark.asyncio
async def test_cancel_registration_missing_reason():
    """Test cancellation with missing reason"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/api/registration/cancel/test-token-123",
            json={}
        )
        
        assert response.status_code == 422  # Validation error


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v"])