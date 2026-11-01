from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, RedirectResponse
from pymongo.errors import PyMongoError, WriteError

from app.db import db
from app.routers import analitica, ciudadanos, instituciones, reportes

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
app.include_router(analitica.router, prefix="/api")


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


@app.get("/", include_in_schema=False)
def inicio():
    return RedirectResponse("/docs")


@app.get("/api/salud", tags=["Sistema"], summary="Verifica conexión con MongoDB")
def salud():
    db.command("ping")
    return {
        "estado": "ok",
        "baseDatos": db.name,
        "colecciones": {c: db[c].estimated_document_count() for c in ("ciudadanos", "instituciones", "reportes")},
    }
