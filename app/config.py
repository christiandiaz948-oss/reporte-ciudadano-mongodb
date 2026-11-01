import os
from pathlib import Path


def _cargar_env() -> None:
    """Carga variables de un archivo .env local sin dependencias externas."""
    ruta = Path(__file__).resolve().parent.parent / ".env"
    if not ruta.exists():
        return
    for linea in ruta.read_text(encoding="utf-8").splitlines():
        linea = linea.strip()
        if linea and not linea.startswith("#") and "=" in linea:
            clave, valor = linea.split("=", 1)
            os.environ.setdefault(clave.strip(), valor.strip())


_cargar_env()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB = os.getenv("MONGO_DB", "reporte_ciudadano")
