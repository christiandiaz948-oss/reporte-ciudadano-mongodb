"""Reportes y métricas construidos con Aggregation Pipeline."""
from fastapi import APIRouter, Query

from app.db import db

router = APIRouter(prefix="/metricas", tags=["Métricas (Aggregation Pipeline)"])

# Cuenta 1 si el reporte sigue abierto (no está resuelto ni rechazado), 0 si no
CONTAR_ABIERTOS = {"$sum": {"$cond": [{"$in": ["$estado", ["resuelto", "rechazado"]]}, 0, 1]}}
CONTAR_RESUELTOS = {"$sum": {"$cond": [{"$eq": ["$estado", "resuelto"]}, 1, 0]}}


@router.get("/por-categoria", summary="Total de reportes, abiertos y resueltos por categoría")
def por_categoria(departamento: str | None = None):
    pipeline = [
        # 1. Filtrar (opcional) por departamento
        {"$match": {"direccion.departamento": departamento} if departamento else {}},
        # 2. Agrupar por categoría y contar
        {"$group": {
            "_id": "$categoria",
            "total": {"$sum": 1},
            "abiertos": CONTAR_ABIERTOS,
            "resueltos": CONTAR_RESUELTOS,
            "apoyos": {"$sum": "$totalApoyos"},
        }},
        # 3. Ordenar de mayor a menor
        {"$sort": {"total": -1}},
        # 4. Dar formato a la salida
        {"$project": {"_id": 0, "categoria": "$_id", "total": 1, "abiertos": 1, "resueltos": 1, "apoyos": 1}},
    ]
    return list(db.reportes.aggregate(pipeline))


@router.get("/por-municipio", summary="Municipios con más reportes abiertos")
def por_municipio(departamento: str | None = None, limite: int = Query(10, ge=1, le=44)):
    pipeline = [
        {"$match": {"direccion.departamento": departamento} if departamento else {}},
        # Agrupar por dos campos a la vez (departamento + municipio)
        {"$group": {
            "_id": {"departamento": "$direccion.departamento", "municipio": "$direccion.municipio"},
            "total": {"$sum": 1},
            "abiertos": CONTAR_ABIERTOS,
            "criticos": {"$sum": {"$cond": [{"$eq": ["$prioridad", "critica"]}, 1, 0]}},
        }},
        {"$sort": {"abiertos": -1}},
        {"$limit": limite},
        {"$project": {"_id": 0, "departamento": "$_id.departamento", "municipio": "$_id.municipio",
                      "total": 1, "abiertos": 1, "criticos": 1}},
    ]
    return list(db.reportes.aggregate(pipeline))


@router.get("/tiempos-resolucion", summary="Días promedio de resolución por institución ($lookup + $unwind)")
def tiempos_resolucion(limite: int = Query(10, ge=1, le=57)):
    pipeline = [
        # 1. Solo reportes resueltos
        {"$match": {"estado": "resuelto"}},
        # 2. Calcular cuántas horas tardó cada reporte
        {"$project": {
            "institucionId": "$institucion._id",
            "horas": {"$dateDiff": {"startDate": "$fechaCreacion", "endDate": "$fechaResolucion", "unit": "hour"}},
        }},
        # 3. Promedio de horas por institución
        {"$group": {"_id": "$institucionId", "resueltos": {"$sum": 1}, "promedioHoras": {"$avg": "$horas"}}},
        # 4. Traer los datos de la institución desde su colección (como un JOIN)
        {"$lookup": {"from": "instituciones", "localField": "_id", "foreignField": "_id", "as": "institucion"}},
        # 5. $lookup devuelve un arreglo; $unwind lo convierte en un objeto
        {"$unwind": "$institucion"},
        {"$project": {
            "_id": 0,
            "institucion": "$institucion.nombre",
            "tipo": "$institucion.tipo",
            "resueltos": 1,
            "promedioDias": {"$round": [{"$divide": ["$promedioHoras", 24]}, 1]},
        }},
        # 6. Las más rápidas primero
        {"$sort": {"promedioDias": 1}},
        {"$limit": limite},
    ]
    return list(db.reportes.aggregate(pipeline))


@router.get("/etiquetas", summary="Etiquetas más frecuentes en reportes abiertos ($unwind de un array)")
def etiquetas_frecuentes(limite: int = Query(10, ge=1, le=50)):
    pipeline = [
        {"$match": {"estado": {"$nin": ["resuelto", "rechazado"]}}},
        # Un documento por cada etiqueta del array
        {"$unwind": "$etiquetas"},
        {"$group": {"_id": "$etiquetas", "total": {"$sum": 1}}},
        {"$sort": {"total": -1}},
        {"$limit": limite},
        {"$project": {"_id": 0, "etiqueta": "$_id", "total": 1}},
    ]
    return list(db.reportes.aggregate(pipeline))
