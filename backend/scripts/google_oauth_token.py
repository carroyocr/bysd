"""Obtiene, una sola vez, el refresh token con el que el backend escribe en
Google como una cuenta de la organizacion (la que tiene acceso a la hoja del
Campeonato Mundial).

Hace falta cuando lo que hay que tocar no se puede compartir con la cuenta de
servicio: la hoja del Mundial la controla la organizacion mundial y solo dio
acceso a dos cuentas nuestras.

Antes, una vez, en la consola de Google Cloud del proyecto `bysd-live`
(https://console.cloud.google.com/apis/credentials?project=bysd-live):

  1. "Pantalla de consentimiento de OAuth" (OAuth consent screen): tipo
     Externo, nombre cualquiera ("BYSD backend"), tu correo de contacto. En
     "Usuarios de prueba" (Test users) anade la cuenta que va a dar el
     permiso (carroyo.cr@gmail.com o backyardultrasantodomingo@gmail.com).
     Pulsa "Publicar la app" (Publish app) si lo ofrece: con la app en
     "Prueba" el refresh token caduca a los 7 dias; publicada, no.
  2. "Credenciales" -> "Crear credenciales" -> "ID de cliente de OAuth" ->
     tipo "App de escritorio" (Desktop app). Copia el ID de cliente y el
     secreto.

Luego, en el Mac:

    cd backend
    .venv/bin/python scripts/google_oauth_token.py

Pide el ID y el secreto, abre el navegador para que entres con esa cuenta y
aceptes el permiso de hojas de calculo, y escribe el JSON para la variable
GOOGLE_OAUTH_JSON (dashboard de Render -> Environment, en una sola linea).
Guardalo tambien en ~/Proyectos/bysd-secretos/. No va al repositorio.
"""
import http.server
import json
import secrets
import sys
import threading
import urllib.parse
import webbrowser

import httpx

SCOPE = "https://www.googleapis.com/auth/spreadsheets"
AUTH_URI = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URI = "https://oauth2.googleapis.com/token"
PUERTO = 8765
REDIRECT = f"http://localhost:{PUERTO}/"


def main():
    client_id = input("ID de cliente de OAuth: ").strip()
    client_secret = input("Secreto del cliente: ").strip()
    if not client_id or not client_secret:
        sys.exit("Hacen falta el ID y el secreto.")

    estado = secrets.token_urlsafe(16)
    recibido = {}

    class Receptor(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            parametros = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            recibido.update({k: v[0] for k, v in parametros.items()})
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write("<h2>Listo. Ya puedes cerrar esta pestaña y volver a la terminal.</h2>".encode())

        def log_message(self, *args):
            pass

    servidor = http.server.HTTPServer(("localhost", PUERTO), Receptor)
    hilo = threading.Thread(target=servidor.handle_request, daemon=True)
    hilo.start()

    direccion = AUTH_URI + "?" + urllib.parse.urlencode({
        "client_id": client_id,
        "redirect_uri": REDIRECT,
        "response_type": "code",
        "scope": SCOPE,
        "access_type": "offline",
        "prompt": "consent",
        "state": estado,
    })
    print("\nAbre esta direccion si el navegador no se abre solo:\n", direccion, "\n")
    webbrowser.open(direccion)
    hilo.join(timeout=600)

    if recibido.get("state") != estado or not recibido.get("code"):
        sys.exit(f"No llego el codigo de Google: {recibido or 'sin respuesta en 10 minutos'}")

    respuesta = httpx.post(TOKEN_URI, data={
        "grant_type": "authorization_code",
        "code": recibido["code"],
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": REDIRECT,
    }, timeout=20)
    if respuesta.status_code != 200:
        sys.exit(f"Google no dio el token: {respuesta.status_code} {respuesta.text}")
    datos = respuesta.json()
    if not datos.get("refresh_token"):
        sys.exit("Google no devolvio refresh_token: revoca el acceso de la app en "
                 "https://myaccount.google.com/permissions y vuelve a correr el script.")

    # Con que cuenta se dio el permiso, para enseñarlo en el panel.
    quien = httpx.get(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        headers={"Authorization": f"Bearer {datos['access_token']}"}, timeout=20,
    )
    email = quien.json().get("email") if quien.status_code == 200 else None

    valor = json.dumps({
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": datos["refresh_token"],
        "email": email,
    })
    print("\nValor para GOOGLE_OAUTH_JSON (una sola linea):\n")
    print(valor)
    print("\nCuenta:", email or "(no se pudo leer; el permiso de hojas no incluye el correo)")


if __name__ == "__main__":
    main()
