from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pymongo.errors import PyMongoError, WriteError

from app.api.ciudadanos import rutas as ciudadanos
from app.api.instituciones import rutas as instituciones
from app.api.metricas import rutas as metricas
from app.api.reportes import rutas as reportes
from app.catalogos import CATEGORIAS, DEPARTAMENTOS, ESTADOS, PRIORIDADES, TRANSICIONES
from app.db import db

CARPETA_FRONTEND = Path(__file__).resolve().parent.parent / "frontend"

app = FastAPI(
    title="Sistema de Reporte Ciudadano",
    description=(
        "API para que la ciudadanía reporte problemas urbanos (baches, alumbrado, basura, agua...) "
        "y las instituciones los atiendan. Base de datos: **MongoDB**.\n\n"
        "Proyecto final — Bases de Datos II (no relacionales), Universidad Evangélica de El Salvador. Grupo 2."
    ),
    version="1.0.0",
)

app.include_router(ciudadanos.router, prefix="/api")
app.include_router(instituciones.router, prefix="/api")
app.include_router(reportes.router, prefix="/api")
app.include_router(metricas.router, prefix="/api")


@app.exception_handler(WriteError)
def error_validacion_mongo(_: Request, exc: WriteError):
    """Si un documento viola el $jsonSchema, MongoDB lo rechaza (código 121)."""
    if exc.code == 121:
        return JSONResponse(status_code=422, content={
            "detail": "El documento no cumple el $jsonSchema de la colección",
            "errInfo": exc.details.get("errInfo") if exc.details else None,
        })
    return JSONResponse(status_code=400, content={"detail": str(exc)})


@app.exception_handler(PyMongoError)
def error_mongo(_: Request, exc: PyMongoError):
    return JSONResponse(status_code=503, content={"detail": f"Error de base de datos: {exc}"})


@app.get("/api/salud", tags=["Sistema"], summary="Verifica conexión con MongoDB")
def salud():
    db.command("ping")
    return {
        "estado": "ok",
        "baseDatos": db.name,
        "colecciones": {c: db[c].estimated_document_count() for c in ("ciudadanos", "instituciones", "reportes")},
    }


@app.get("/api/catalogos", tags=["Sistema"], summary="Listas para llenar los formularios del frontend")
def catalogos():
    return {
        "categorias": CATEGORIAS,
        "prioridades": PRIORIDADES,
        "estados": ESTADOS,
        "transiciones": TRANSICIONES,
        "departamentos": {nombre: info["municipios"] for nombre, info in DEPARTAMENTOS.items()},
    }


# El frontend (carpeta frontend/) se sirve en la raíz: http://localhost:8000
# Va al final para que las rutas /api y /docs tengan prioridad.
app.mount("/", StaticFiles(directory=CARPETA_FRONTEND, html=True), name="frontend")
