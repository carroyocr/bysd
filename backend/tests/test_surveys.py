"""
Test suite for Survey System - Backyard Ultra Santo Domingo 2026
Tests: Athletes, Volunteers, Spectators survey endpoints and stats
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSurveyStats:
    """Test GET /api/surveys/stats endpoint"""
    
    def test_stats_endpoint_returns_200(self):
        """Stats endpoint should return 200"""
        response = requests.get(f"{BASE_URL}/api/surveys/stats")
        assert response.status_code == 200
        
    def test_stats_returns_correct_structure(self):
        """Stats should return athletes, volunteers, spectators, total counts"""
        response = requests.get(f"{BASE_URL}/api/surveys/stats")
        data = response.json()
        
        assert "athletes" in data
        assert "volunteers" in data
        assert "spectators" in data
        assert "total" in data
        assert isinstance(data["athletes"], int)
        assert isinstance(data["volunteers"], int)
        assert isinstance(data["spectators"], int)
        assert data["total"] == data["athletes"] + data["volunteers"] + data["spectators"]


class TestAthletesSurvey:
    """Test POST /api/surveys/athletes endpoint"""
    
    def test_submit_athletes_survey_success(self):
        """Submit valid athlete survey should return success"""
        payload = {
            "nombre": "TEST_Atleta Prueba",
            "email": "test_atleta@example.com",
            "bib": "999",
            "satisfaccion_general": 5,
            "organizacion_evento": 4,
            "comunicacion_previa": 5,
            "proceso_registro": 4,
            "kit_corredor": 5,
            "marcacion_ruta": 4,
            "seguridad_ruta": 5,
            "estaciones_hidratacion": 4,
            "atencion_medica": 5,
            "instalaciones": 4,
            "ambiente_comunidad": 5,
            "lo_mejor": "La comunidad y el ambiente",
            "areas_mejora": "Más estaciones de hidratación",
            "participaria_nuevamente": "Sí",
            "recomendaria": "Sí",
            "comentarios_adicionales": "Excelente evento!"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/surveys/athletes",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "id" in data
        assert "message" in data
        
    def test_submit_athletes_survey_minimal_fields(self):
        """Submit athlete survey with only required fields"""
        payload = {
            "nombre": "TEST_Atleta Minimo",
            "email": "test_atleta_min@example.com",
            "satisfaccion_general": 3,
            "organizacion_evento": 3,
            "comunicacion_previa": 3,
            "proceso_registro": 3,
            "kit_corredor": 3,
            "marcacion_ruta": 3,
            "seguridad_ruta": 3,
            "estaciones_hidratacion": 3,
            "atencion_medica": 3,
            "instalaciones": 3,
            "ambiente_comunidad": 3,
            "participaria_nuevamente": "Tal vez",
            "recomendaria": "Tal vez"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/surveys/athletes",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        
    def test_submit_athletes_survey_missing_required_field(self):
        """Submit athlete survey without required field should fail"""
        payload = {
            "nombre": "TEST_Atleta Incompleto",
            # Missing email
            "satisfaccion_general": 5,
            "organizacion_evento": 4,
            "comunicacion_previa": 5,
            "proceso_registro": 4,
            "kit_corredor": 5,
            "marcacion_ruta": 4,
            "seguridad_ruta": 5,
            "estaciones_hidratacion": 4,
            "atencion_medica": 5,
            "instalaciones": 4,
            "ambiente_comunidad": 5,
            "participaria_nuevamente": "Sí",
            "recomendaria": "Sí"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/surveys/athletes",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 422  # Validation error
        
    def test_submit_athletes_survey_invalid_rating(self):
        """Submit athlete survey with invalid rating (>5) should fail"""
        payload = {
            "nombre": "TEST_Atleta Rating Invalido",
            "email": "test_invalid@example.com",
            "satisfaccion_general": 10,  # Invalid - should be 1-5
            "organizacion_evento": 4,
            "comunicacion_previa": 5,
            "proceso_registro": 4,
            "kit_corredor": 5,
            "marcacion_ruta": 4,
            "seguridad_ruta": 5,
            "estaciones_hidratacion": 4,
            "atencion_medica": 5,
            "instalaciones": 4,
            "ambiente_comunidad": 5,
            "participaria_nuevamente": "Sí",
            "recomendaria": "Sí"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/surveys/athletes",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 422  # Validation error


class TestVolunteersSurvey:
    """Test POST /api/surveys/volunteers endpoint"""
    
    def test_submit_volunteers_survey_success(self):
        """Submit valid volunteer survey should return success"""
        payload = {
            "nombre": "TEST_Voluntario Prueba",
            "email": "test_voluntario@example.com",
            "area_voluntariado": "hidratacion",
            "satisfaccion_general": 5,
            "claridad_funciones": 4,
            "capacitacion_recibida": 5,
            "comunicacion_coordinadores": 4,
            "materiales_recursos": 5,
            "trato_organizacion": 5,
            "alimentacion_hidratacion": 4,
            "horarios_turnos": 4,
            "ambiente_equipo": 5,
            "reconocimiento": 4,
            "lo_mejor": "El trabajo en equipo",
            "areas_mejora": "Mejor comunicación previa",
            "voluntario_nuevamente": "Sí",
            "recomendaria": "Sí",
            "comentarios_adicionales": "Gran experiencia!"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/surveys/volunteers",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "id" in data
        
    def test_submit_volunteers_survey_minimal_fields(self):
        """Submit volunteer survey with only required fields"""
        payload = {
            "nombre": "TEST_Voluntario Minimo",
            "email": "test_vol_min@example.com",
            "satisfaccion_general": 4,
            "claridad_funciones": 4,
            "capacitacion_recibida": 4,
            "comunicacion_coordinadores": 4,
            "materiales_recursos": 4,
            "trato_organizacion": 4,
            "alimentacion_hidratacion": 4,
            "horarios_turnos": 4,
            "ambiente_equipo": 4,
            "reconocimiento": 4,
            "voluntario_nuevamente": "Sí",
            "recomendaria": "Sí"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/surveys/volunteers",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True


class TestSpectatorsSurvey:
    """Test POST /api/surveys/spectators endpoint"""
    
    def test_submit_spectators_survey_success(self):
        """Submit valid spectator survey should return success"""
        payload = {
            "nombre": "TEST_Espectador Prueba",
            "email": "test_espectador@example.com",
            "relacion_evento": "familiar",
            "satisfaccion_general": 5,
            "facilidad_acceso": 4,
            "informacion_evento": 5,
            "visibilidad_recorrido": 4,
            "servicios_disponibles": 4,
            "ambiente_general": 5,
            "atencion_personal": 5,
            "lo_mejor": "Ver a mi familiar correr",
            "areas_mejora": "Más sombra para espectadores",
            "asistiria_nuevamente": "Sí",
            "recomendaria": "Sí",
            "comentarios_adicionales": "Muy emocionante!"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/surveys/spectators",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "id" in data
        
    def test_submit_spectators_survey_minimal_fields(self):
        """Submit spectator survey with only required fields"""
        payload = {
            "nombre": "TEST_Espectador Minimo",
            "email": "test_esp_min@example.com",
            "satisfaccion_general": 3,
            "facilidad_acceso": 3,
            "informacion_evento": 3,
            "visibilidad_recorrido": 3,
            "servicios_disponibles": 3,
            "ambiente_general": 3,
            "atencion_personal": 3,
            "asistiria_nuevamente": "Tal vez",
            "recomendaria": "Tal vez"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/surveys/spectators",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True


class TestSurveyResponses:
    """Test GET /api/surveys/{type}/responses endpoints (admin)"""
    
    def test_get_athletes_responses(self):
        """Get athletes responses should return list"""
        response = requests.get(f"{BASE_URL}/api/surveys/athletes/responses")
        assert response.status_code == 200
        data = response.json()
        assert "total" in data
        assert "responses" in data
        assert isinstance(data["responses"], list)
        
    def test_get_volunteers_responses(self):
        """Get volunteers responses should return list"""
        response = requests.get(f"{BASE_URL}/api/surveys/volunteers/responses")
        assert response.status_code == 200
        data = response.json()
        assert "total" in data
        assert "responses" in data
        assert isinstance(data["responses"], list)
        
    def test_get_spectators_responses(self):
        """Get spectators responses should return list"""
        response = requests.get(f"{BASE_URL}/api/surveys/spectators/responses")
        assert response.status_code == 200
        data = response.json()
        assert "total" in data
        assert "responses" in data
        assert isinstance(data["responses"], list)


class TestSurveyStatsAfterSubmission:
    """Test that stats update after survey submissions"""
    
    def test_stats_increment_after_athlete_survey(self):
        """Stats should increment after athlete survey submission"""
        # Get initial stats
        initial_response = requests.get(f"{BASE_URL}/api/surveys/stats")
        initial_data = initial_response.json()
        initial_athletes = initial_data["athletes"]
        
        # Submit new survey
        payload = {
            "nombre": "TEST_Atleta Stats",
            "email": f"test_stats_{time.time()}@example.com",
            "satisfaccion_general": 5,
            "organizacion_evento": 5,
            "comunicacion_previa": 5,
            "proceso_registro": 5,
            "kit_corredor": 5,
            "marcacion_ruta": 5,
            "seguridad_ruta": 5,
            "estaciones_hidratacion": 5,
            "atencion_medica": 5,
            "instalaciones": 5,
            "ambiente_comunidad": 5,
            "participaria_nuevamente": "Sí",
            "recomendaria": "Sí"
        }
        
        submit_response = requests.post(
            f"{BASE_URL}/api/surveys/athletes",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        assert submit_response.status_code == 200
        
        # Check stats incremented
        final_response = requests.get(f"{BASE_URL}/api/surveys/stats")
        final_data = final_response.json()
        
        assert final_data["athletes"] == initial_athletes + 1
        assert final_data["total"] == initial_data["total"] + 1


class TestNavigationLinks:
    """Test that navigation links are correctly configured"""
    
    def test_encuesta_page_loads(self):
        """Survey page should be accessible"""
        response = requests.get(f"{BASE_URL}")
        assert response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
