from fastapi import APIRouter, HTTPException, Query
from pymongo import ASCENDING
from pymongo.errors import DuplicateKeyError

from app.db import db
from app.schemas import Categoria, InstitucionActualizar, InstitucionCrear, TipoInstitucion
from app.utils import a_oid, paginar, serializar

router = APIRouter(prefix="/instituciones", tags=["Instituciones"])


@router.post("", status_code=201, summary="Registrar institución")
def crear_institucion(datos: InstitucionCrear):
    doc = datos.model_dump()
    doc["codigo"] = doc["codigo"].upper()
    doc["activa"] = True
    try:
        resultado = db.instituciones.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(409, f"Ya existe una institución con código {doc['codigo']}")
    return serializar({**doc, "_id": resultado.inserted_id})


@router.get("", summary="Listar instituciones")
def listar_instituciones(
    tipo: TipoInstitucion | None = None,
    categoria: Categoria | None = Query(None, description="Instituciones que atienden esta categoría"),
    departamento: str | None = Query(None, description="Con cobertura en el departamento (o nacional)"),
    activa: bool | None = None,
    pagina: int = Query(1, ge=1),
    tamano: int = Query(20, ge=1, le=100),
):
    filtro = {}
    if tipo:
        filtro["tipo"] = tipo
    if categoria:
        filtro["categoriasAtendidas"] = categoria  # igualdad sobre un array = "contiene"
    if departamento:
        filtro["$or"] = [{"cobertura.departamentos": departamento}, {"cobertura.nacional": True}]
    if activa is not None:
        filtro["activa"] = activa
    return paginar(db.instituciones, filtro, pagina, tamano, [("tipo", ASCENDING), ("nombre", ASCENDING)])


@router.get("/{institucion_id}", summary="Obtener institución")
def obtener_institucion(institucion_id: str):
    doc = db.instituciones.find_one({"_id": a_oid(institucion_id)})
    if not doc:
        raise HTTPException(404, "Institución no encontrada")
    return serializar(doc)


@router.patch("/{institucion_id}", summary="Actualizar institución")
def actualizar_institucion(institucion_id: str, datos: InstitucionActualizar):
    cambios = datos.model_dump(exclude_none=True)
    if not cambios:
        raise HTTPException(400, "No se enviaron campos para actualizar")
    oid = a_oid(institucion_id)
    doc = db.instituciones.find_one_and_update({"_id": oid}, {"$set": cambios}, return_document=True)
    if not doc:
        raise HTTPException(404, "Institución no encontrada")
    # Mantener sincronizada la copia (Extended Reference) en los reportes
    if "nombre" in cambios:
        db.reportes.update_many({"institucion._id": oid}, {"$set": {"institucion.nombre": cambios["nombre"]}})
    return serializar(doc)
