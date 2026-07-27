"""
Environment variable helpers.

En local los valores se cargan con python-dotenv, que quita las comillas de
GMAIL_USER="algo". El dashboard de Render no las quita: si el valor se pega
con comillas, quedan dentro del valor y el login SMTP falla con 535. Este
helper limpia espacios y comillas envolventes para que ambos entornos se
comporten igual.
"""

import os
from typing import Optional


def get_env(name: str, default: Optional[str] = None) -> Optional[str]:
    """Read an env var, stripping whitespace and surrounding quotes."""
    value = os.environ.get(name)

    if value is None:
        return default

    value = value.strip()

    for quote in ('"', "'"):
        if len(value) >= 2 and value.startswith(quote) and value.endswith(quote):
            value = value[1:-1].strip()
            break

    return value if value else default
