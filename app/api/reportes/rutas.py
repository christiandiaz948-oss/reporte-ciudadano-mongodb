import re
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query
from pymongo import ASCENDING, DESCENDING

from app.catalogos import ESTADOS_CERRADOS, NIVEL_PRIORIDAD, TRANSICIONES, municipio_valido
from app.db import db
from app.schemas import (ApoyoIn, CalificacionIn, CambioEstado, Categoria, Estado, EvidenciaIn,
                         Prioridad, ReporteCrear)
from app.servicios import buscar_institucion, siguiente_folio
from app.utils import a_oid, ahora, paginar, serializar

router = APIRouter(prefix="/reportes", tags=["Reportes"])

# Proyección para los listados: se excluyen los arrays largos que solo se ven en el detalle
PROYECCION_LISTADO = {"historial": 0, "apoyos": 0, "descripcion": 0}


def _buscar(reporte_id: str, proyeccion=None) -> dict:
    """Busca un reporte por su _id o por su folio (RC-2026-000123)."""
    if reporte_id.upper().startswith("RC-"):
        filtro = {"folio": reporte_id.upper()}
    else:
        filtro = {"_id": a_oid(reporte_id)}
    reporte = db.reportes.find_one(filtro, proyeccion)
    if not reporte:
        raise HTTPException(404, "Reporte no encontrado")
    return reporte


# ======================================================================== ESCRITURA
@router.post("", status_code=201, summary="Crear reporte (se asigna la institución automáticamente)")
def crear_reporte(datos: ReporteCrear):
    ciudadano_id = a_oid(datos.ciudadanoId, "ciudadanoId")
    ciudadano = db.ciudadanos.find_one({"_id": ciudadano_id}, {"nombre": 1})
    if not ciudadano:
        raise HTTPException(404, "El ciudadano no existe")
    if not municipio_valido(datos.departamento, datos.municipio):
        raise HTTPException(422, f"El municipio '{datos.municipio}' no pertenece a '{datos.departamento}'")

    momento = ahora()
    reporte = {
        "folio": siguiente_folio(db, momento.year),
        "titulo": datos.titulo,
        "descripcion": datos.descripcion,
        "categoria": datos.categoria,
        "prioridad": datos.prioridad,
        "nivelPrioridad": NIVEL_PRIORIDAD[datos.prioridad],  # número para poder ordenar por prioridad
        "estado": "recibido",
        "ubicacion": {"latitud": datos.latitud, "longitud": datos.longitud},
        "direccion": {"departamento": datos.departamento, "municipio": datos.municipio,
                      "referencia": datos.referencia},
        "ciudadanoId": ciudadano_id,                                   # referencia
        "institucion": buscar_institucion(db, datos.categoria, datos.departamento, datos.municipio),
        "historial": [{"estado": "recibido", "fecha": momento, "actor": ciudadano["nombre"],
                       "comentario": "Reporte creado"}],               # embebido
        "evidencias": [{**e.model_dump(), "fechaSubida": momento} for e in datos.evidencias],
        "apoyos": [],
        "totalApoyos": 0,
        "etiquetas": [e.strip().lower() for e in datos.etiquetas if e.strip()],
        "fechaCreacion": momento,
        "fechaActualizacion": momento,
        "fechaResolucion": None,
    }
    resultado = db.reportes.insert_one(reporte)

    # Se actualiza el contador de reportes del ciudadano
    db.ciudadanos.update_one(
        {"_id": ciudadano_id},
        {"$inc": {"estadisticas.totalReportes": 1}, "$set": {"estadisticas.ultimoReporte": momento}},
    )
    reporte["_id"] = resultado.inserted_id
    return serializar(reporte)


@router.patch("/{reporte_id}/estado", summary="Cambiar el estado del reporte")
def cambiar_estado(reporte_id: str, datos: CambioEstado):
    reporte = _buscar(reporte_id, {"estado": 1})

    # Regla de negocio: solo se permiten ciertos cambios (ver TRANSICIONES en catalogos.py)
    permitidos = TRANSICIONES[reporte["estado"]]
    if datos.estado not in permitidos:
        raise HTTPException(409, f"No se puede pasar de '{reporte['estado']}' a '{datos.estado}'. "
                                 f"Permitidos: {permitidos or 'ninguno (estado final)'}")

    momento = ahora()
    # $set cambia el estado y $push agrega el cambio al historial, en una sola operación
    db.reportes.update_one(
        {"_id": reporte["_id"]},
        {
            "$set": {"estado": datos.estado, "fechaActualizacion": momento,
                     "fechaResolucion": momento if datos.estado == "resuelto" else None},
            "$push": {"historial": {"estado": datos.estado, "fecha": momento,
                                    "actor": datos.actor, "comentario": datos.comentario}},
        },
    )
    return serializar(db.reportes.find_one({"_id": reporte["_id"]}, {"apoyos": 0}))


@router.post("/{reporte_id}/apoyos", summary="Apoyar un reporte ('a mí también me afecta')")
def apoyar(reporte_id: str, datos: ApoyoIn):
    reporte = _buscar(reporte_id, {"_id": 1})
    ciudadano_id = a_oid(datos.ciudadanoId, "ciudadanoId")
    if not db.ciudadanos.find_one({"_id": ciudadano_id}, {"_id": 1}):
        raise HTTPException(404, "El ciudadano no existe")

    # El filtro solo coincide si el ciudadano NO ha apoyado ($ne) y no es el autor.
    # Si coincide, se agrega al array ($push) y se suma 1 al contador ($inc).
    resultado = db.reportes.update_one(
        {"_id": reporte["_id"], "apoyos": {"$ne": ciudadano_id}, "ciudadanoId": {"$ne": ciudadano_id}},
        {"$push": {"apoyos": ciudadano_id}, "$inc": {"totalApoyos": 1}},
    )
    if resultado.modified_count == 0:
        raise HTTPException(409, "El ciudadano ya apoyó este reporte o es su autor")
    return serializar(db.reportes.find_one({"_id": reporte["_id"]}, {"folio": 1, "totalApoyos": 1}))


@router.delete("/{reporte_id}/apoyos/{ciudadano_id}", summary="Quitar un apoyo ($pull)")
def quitar_apoyo(reporte_id: str, ciudadano_id: str):
    reporte = _buscar(reporte_id, {"_id": 1})
    cid = a_oid(ciudadano_id, "ciudadanoId")
    resultado = db.reportes.update_one(
        {"_id": reporte["_id"], "apoyos": cid},
        {"$pull": {"apoyos": cid}, "$inc": {"totalApoyos": -1}},
    )
    if resultado.modified_count == 0:
        raise HTTPException(404, "El ciudadano no había apoyado este reporte")
    return serializar(db.reportes.find_one({"_id": reporte["_id"]}, {"folio": 1, "totalApoyos": 1}))


@router.post("/{reporte_id}/evidencias", summary="Agregar una evidencia (máximo 10)")
def agregar_evidencia(reporte_id: str, datos: EvidenciaIn):
    reporte = _buscar(reporte_id, {"evidencias": 1})
    if len(reporte["evidencias"]) >= 10:
        raise HTTPException(409, "El reporte ya tiene el máximo de 10 evidencias")
    momento = ahora()
    db.reportes.update_one(
        {"_id": reporte["_id"]},
        {"$push": {"evidencias": {**datos.model_dump(), "fechaSubida": momento}},
         "$set": {"fechaActualizacion": momento}},
    )
    return serializar(db.reportes.find_one({"_id": reporte["_id"]}, {"folio": 1, "evidencias": 1}))


@router.post("/{reporte_id}/calificacion", summary="Calificar la atención (solo el autor, con el reporte resuelto)")
def calificar(reporte_id: str, datos: CalificacionIn):
    reporte = _buscar(reporte_id)
    if reporte["estado"] != "resuelto":
        raise HTTPException(409, "Solo se pueden calificar reportes resueltos")
    if str(reporte["ciudadanoId"]) != datos.ciudadanoId:
        raise HTTPException(403, "Solo el autor del reporte puede calificarlo")
    if "calificacion" in reporte:
        raise HTTPException(409, "El reporte ya fue calificado")

    calificacion = {"puntaje": datos.puntaje, "comentario": datos.comentario, "fecha": ahora()}
    db.reportes.update_one({"_id": reporte["_id"]}, {"$set": {"calificacion": calificacion}})
    return {"folio": reporte["folio"], "calificacion": calificacion}


@router.delete("/{reporte_id}", status_code=204, summary="Eliminar reporte (solo si sigue 'recibido')")
def eliminar_reporte(reporte_id: str):
    reporte = _buscar(reporte_id, {"estado": 1, "ciudadanoId": 1})
    if reporte["estado"] != "recibido":
        raise HTTPException(409, "Solo se pueden eliminar reportes en estado 'recibido'")
    db.reportes.delete_one({"_id": reporte["_id"]})
    db.ciudadanos.update_one({"_id": reporte["ciudadanoId"]}, {"$inc": {"estadisticas.totalReportes": -1}})


# ======================================================================== LECTURA
@router.get("", summary="Buscar reportes con filtros, orden y paginación")
def listar_reportes(
    estado: list[Estado] | None = Query(None, description="Uno o varios estados ($in)"),
    categoria: list[Categoria] | None = Query(None, description="Una o varias categorías ($in)"),
    prioridad: list[Prioridad] | None = Query(None, description="Una o varias prioridades ($in)"),
    abiertos: bool | None = Query(None, description="true = ni resueltos ni rechazados ($nin)"),
    urgentes: bool | None = Query(None, description="Prioridad crítica O 10+ apoyos ($or)"),
    departamento: str | None = Query(None, description="Departamento (subdocumento direccion)"),
    municipio: str | None = None,
    institucion_id: str | None = None,
    desde: datetime | None = Query(None, description="Creados desde esta fecha ($gte)"),
    hasta: datetime | None = Query(None, description="Creados hasta esta fecha ($lte)"),
    min_apoyos: int | None = Query(None, ge=0, description="Mínimo de apoyos ($gte)"),
    etiquetas: list[str] | None = Query(None, description="Debe tener TODAS estas etiquetas ($all)"),
    titulo: str | None = Query(None, description="Texto contenido en el título ($regex)"),
    orden: str = Query("fechaCreacion", pattern="^(fechaCreacion|totalApoyos|nivelPrioridad)$"),
    direccion_orden: str = Query("desc", pattern="^(asc|desc)$"),
    pagina: int = Query(1, ge=1),
    tamano: int = Query(10, ge=1, le=100),
):
    # El filtro se arma solo con los parámetros que se enviaron
    filtro = {}
    if estado:
        filtro["estado"] = {"$in": estado}
    elif abiertos is True:
        filtro["estado"] = {"$nin": ESTADOS_CERRADOS}
    elif abiertos is False:
        filtro["estado"] = {"$in": ESTADOS_CERRADOS}
    if categoria:
        filtro["categoria"] = {"$in": categoria}
    if prioridad:
        filtro["prioridad"] = {"$in": prioridad}
    if urgentes:
        filtro["$or"] = [{"prioridad": "critica"}, {"totalApoyos": {"$gte": 10}}]
    if departamento:
        filtro["direccion.departamento"] = departamento  # dot notation
    if municipio:
        filtro["direccion.municipio"] = municipio
    if institucion_id:
        filtro["institucion._id"] = a_oid(institucion_id, "institucion_id")
    if desde or hasta:
        filtro["fechaCreacion"] = {}
        if desde:
            filtro["fechaCreacion"]["$gte"] = desde
        if hasta:
            filtro["fechaCreacion"]["$lte"] = hasta
    if min_apoyos is not None:
        filtro["totalApoyos"] = {"$gte": min_apoyos}
    if etiquetas:
        filtro["etiquetas"] = {"$all": [e.lower() for e in etiquetas]}
    if titulo:
        filtro["titulo"] = {"$regex": re.escape(titulo), "$options": "i"}

    sentido = ASCENDING if direccion_orden == "asc" else DESCENDING
    return paginar(db.reportes, filtro, pagina, tamano, [(orden, sentido)], PROYECCION_LISTADO)


@router.get("/{reporte_id}", summary="Detalle de un reporte (por _id o folio) con el nombre del ciudadano")
def obtener_reporte(reporte_id: str):
    reporte = _buscar(reporte_id, {"apoyos": 0})
    # Se resuelve la referencia: solo se muestran datos públicos del ciudadano
    reporte["ciudadano"] = db.ciudadanos.find_one({"_id": reporte["ciudadanoId"]},
                                                  {"nombre": 1, "direccion.municipio": 1})
    return serializar(reporte)
