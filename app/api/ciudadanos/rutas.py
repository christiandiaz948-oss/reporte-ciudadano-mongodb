import re

from fastapi import APIRouter, HTTPException, Query
from pymongo import ASCENDING, DESCENDING
from pymongo.errors import DuplicateKeyError

from app.catalogos import municipio_valido
from app.db import db
from app.schemas import CiudadanoActualizar, CiudadanoCrear
from app.utils import a_oid, ahora, paginar, serializar

router = APIRouter(prefix="/ciudadanos", tags=["Ciudadanos"])


def _validar_direccion(direccion) -> None:
    if not municipio_valido(direccion.departamento, direccion.municipio):
        raise HTTPException(422, f"El municipio '{direccion.municipio}' no pertenece a '{direccion.departamento}'")


@router.post("", status_code=201, summary="Registrar ciudadano")
def crear_ciudadano(datos: CiudadanoCrear):
    _validar_direccion(datos.direccion)
    doc = datos.model_dump()
    doc["fechaRegistro"] = ahora()
    doc["estadisticas"] = {"totalReportes": 0, "ultimoReporte": None}
    try:
        resultado = db.ciudadanos.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(409, "Ya existe un ciudadano con ese DUI o correo")
    return serializar({**doc, "_id": resultado.inserted_id})


@router.get("", summary="Listar ciudadanos con filtros y paginación")
def listar_ciudadanos(
    departamento: str | None = None,
    municipio: str | None = None,
    nombre: str | None = Query(None, description="Búsqueda parcial, sin distinguir mayúsculas ($regex)"),
    min_reportes: int | None = Query(None, ge=0, description="Mínimo de reportes creados ($gte)"),
    orden: str = Query("nombre", pattern="^(nombre|fechaRegistro|estadisticas.totalReportes)$"),
    direccion_orden: str = Query("asc", pattern="^(asc|desc)$"),
    pagina: int = Query(1, ge=1),
    tamano: int = Query(10, ge=1, le=100),
):
    filtro = {}
    if departamento:
        filtro["direccion.departamento"] = departamento
    if municipio:
        filtro["direccion.municipio"] = municipio
    if nombre:
        filtro["nombre"] = {"$regex": re.escape(nombre), "$options": "i"}
    if min_reportes is not None:
        filtro["estadisticas.totalReportes"] = {"$gte": min_reportes}
    sentido = ASCENDING if direccion_orden == "asc" else DESCENDING
    return paginar(db.ciudadanos, filtro, pagina, tamano, [(orden, sentido)])


@router.get("/{ciudadano_id}", summary="Obtener ciudadano")
def obtener_ciudadano(ciudadano_id: str):
    doc = db.ciudadanos.find_one({"_id": a_oid(ciudadano_id)})
    if not doc:
        raise HTTPException(404, "Ciudadano no encontrado")
    return serializar(doc)


@router.patch("/{ciudadano_id}", summary="Actualizar datos del ciudadano ($set)")
def actualizar_ciudadano(ciudadano_id: str, datos: CiudadanoActualizar):
    cambios = datos.model_dump(exclude_none=True)
    if not cambios:
        raise HTTPException(400, "No se enviaron campos para actualizar")
    if datos.direccion:
        _validar_direccion(datos.direccion)
    try:
        doc = db.ciudadanos.find_one_and_update(
            {"_id": a_oid(ciudadano_id)}, {"$set": cambios}, return_document=True)
    except DuplicateKeyError:
        raise HTTPException(409, "El correo ya está registrado")
    if not doc:
        raise HTTPException(404, "Ciudadano no encontrado")
    return serializar(doc)


@router.get("/{ciudadano_id}/reportes", summary="Reportes creados por un ciudadano")
def reportes_del_ciudadano(
    ciudadano_id: str,
    pagina: int = Query(1, ge=1),
    tamano: int = Query(10, ge=1, le=100),
):
    filtro = {"ciudadanoId": a_oid(ciudadano_id)}
    proyeccion = {"folio": 1, "titulo": 1, "categoria": 1, "estado": 1, "prioridad": 1,
                  "fechaCreacion": 1, "totalApoyos": 1, "institucion.nombre": 1}
    return paginar(db.reportes, filtro, pagina, tamano, [("fechaCreacion", DESCENDING)], proyeccion)
