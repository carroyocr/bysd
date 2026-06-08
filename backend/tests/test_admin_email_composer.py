"""
Backend tests for Admin Mass Email Composer (WYSIWYG + merge variables).
Endpoints under test:
- POST /api/athletes/admin/email-preview
- POST /api/athletes/admin/email-recipients
- POST /api/athletes/admin/send-email  (only with filter_type='manual' + single test email)

NOTE: Real send uses Gmail SMTP. We only exercise the endpoint with one test address.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://ultra-santo-admin.preview.emergentagent.com").rstrip("/")

ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "Backyard2026!"
TEST_EMAIL = "test-composer@example.com"


# --- Fixtures --------------------------------------------------------------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/race/auth/admin-login",
        json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    assert token, f"No token in response: {data}"
    return token


@pytest.fixture
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# --- Auth checks (401 without token) --------------------------------------
class TestAuthRequired:
    def test_preview_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/athletes/admin/email-preview",
                          json={"subject": "x", "content": "y"}, timeout=10)
        assert r.status_code == 401

    def test_recipients_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/athletes/admin/email-recipients",
                          json={"filter_type": "all_athletes"}, timeout=10)
        assert r.status_code == 401

    def test_send_requires_auth(self):
        r = requests.post(
            f"{BASE_URL}/api/athletes/admin/send-email",
            json={
                "subject": "x", "content": "y",
                "recipients": {"filter_type": "manual", "manual_emails": [TEST_EMAIL]},
            },
            timeout=10,
        )
        assert r.status_code == 401


# --- Email preview --------------------------------------------------------
class TestEmailPreview:
    def test_preview_substitutes_all_variables(self, auth_headers):
        subject = "Hola {{nombre}}"
        content = (
            "<p>Hola <b>{{nombre}} {{apellidos}}</b>, "
            "tu nombre completo es {{nombre_completo}} y tu correo es {{email}}.</p>"
        )
        r = requests.post(
            f"{BASE_URL}/api/athletes/admin/email-preview",
            json={"subject": subject, "content": content},
            headers=auth_headers,
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "html" in data
        assert "subject" in data
        assert data["subject"] == "Hola Juan"
        html = data["html"]
        # Sample replacements
        assert "Juan" in html
        assert "Pérez" in html
        assert "Juan Pérez" in html
        assert "juan.perez@ejemplo.com" in html
        # No raw merge tags should remain
        assert "{{nombre}}" not in html
        assert "{{apellidos}}" not in html
        assert "{{nombre_completo}}" not in html
        assert "{{email}}" not in html

    def test_preview_keeps_html_formatting(self, auth_headers):
        r = requests.post(
            f"{BASE_URL}/api/athletes/admin/email-preview",
            json={"subject": "Test", "content": "<p><b>Bold</b><br/>Line2</p>"},
            headers=auth_headers,
            timeout=15,
        )
        assert r.status_code == 200
        html = r.json()["html"]
        assert "<b>Bold</b>" in html
        assert "<br" in html


# --- Recipient filters ----------------------------------------------------
class TestRecipientFilters:
    def test_recipients_all_athletes(self, auth_headers):
        r = requests.post(
            f"{BASE_URL}/api/athletes/admin/email-recipients",
            json={"filter_type": "all_athletes"},
            headers=auth_headers,
            timeout=20,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "recipients" in data
        assert "total" in data
        assert isinstance(data["recipients"], list)
        assert data["total"] == len(data["recipients"])
        if data["recipients"]:
            sample = data["recipients"][0]
            for key in ("email", "nombre", "apellidos", "nombre_completo", "source"):
                assert key in sample, f"Missing key '{key}' in recipient: {sample}"
            assert sample["source"] == "atleta"
            # nombre_completo should be nombre + apellidos
            assert sample["nombre_completo"] == f"{sample['nombre']} {sample['apellidos']}".strip()

    def test_recipients_manual(self, auth_headers):
        emails = [TEST_EMAIL, "another@example.com"]
        r = requests.post(
            f"{BASE_URL}/api/athletes/admin/email-recipients",
            json={"filter_type": "manual", "manual_emails": emails},
            headers=auth_headers,
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["total"] == 2
        got_emails = sorted(r["email"] for r in data["recipients"])
        assert got_emails == sorted(e.lower() for e in emails)
        for rec in data["recipients"]:
            assert rec["source"] == "manual"
            assert "nombre" in rec and "apellidos" in rec and "nombre_completo" in rec

    def test_recipients_manual_empty_returns_zero(self, auth_headers):
        r = requests.post(
            f"{BASE_URL}/api/athletes/admin/email-recipients",
            json={"filter_type": "manual", "manual_emails": []},
            headers=auth_headers,
            timeout=10,
        )
        assert r.status_code == 200
        assert r.json()["total"] == 0

    def test_recipients_volunteers(self, auth_headers):
        r = requests.post(
            f"{BASE_URL}/api/athletes/admin/email-recipients",
            json={"filter_type": "volunteers"},
            headers=auth_headers,
            timeout=20,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data["recipients"], list)
        for rec in data["recipients"]:
            assert rec["source"] == "voluntario"


# --- Send email (SAFE: single test address only) --------------------------
class TestSendEmail:
    def test_send_with_manual_single_test_email(self, auth_headers):
        payload = {
            "subject": "Prueba composer {{nombre_completo}}",
            "content": "<p>Hola <b>{{nombre}}</b>, este es un correo de prueba para {{email}}.</p>",
            "recipients": {
                "filter_type": "manual",
                "manual_emails": [TEST_EMAIL],
            },
        }
        r = requests.post(
            f"{BASE_URL}/api/athletes/admin/send-email",
            json=payload,
            headers=auth_headers,
            timeout=60,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        # Expected shape: success/sent/failed/total
        assert "sent" in data
        assert "failed" in data
        assert "total" in data
        assert data["total"] == 1
        assert data["sent"] + data["failed"] == 1
        # SMTP may legitimately fail to deliver to the placeholder address;
        # main requirement is endpoint executed personalization and returned counts.

    def test_send_no_recipients_returns_400(self, auth_headers):
        payload = {
            "subject": "x", "content": "y",
            "recipients": {"filter_type": "manual", "manual_emails": []},
        }
        r = requests.post(
            f"{BASE_URL}/api/athletes/admin/send-email",
            json=payload, headers=auth_headers, timeout=15,
        )
        assert r.status_code == 400
