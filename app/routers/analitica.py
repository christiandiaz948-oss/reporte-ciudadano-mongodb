"""Reportes y métricas construidos con Aggregation Pipeline."""
from datetime import datetime, timedelta

from fastapi import APIRouter, Query

from app.catalogos import ESTADOS_CERRADOS
from app.db import db
from app.utils import ahora, serializar

router = APIRouter(prefix="/analitica", tags=["Analítica (Aggregation Pipeline)"])

ZONA = "America/El_Salvador"


def _match_base(departamento: str | None, desde: datetime | None, hasta: datetime | None) -> dict:
    filtro: dict = {}
    if departamento:
        filtro["direccion.departamento"] = departamento
    if desde or hasta:
        filtro["fechaCreacion"] = {k: v for k, v in (("$gte", desde), ("$lte", hasta)) if v}
    return filtro


def _contar_si(condicion: dict) -> dict:
    return {"$sum": {"$cond": [condicion, 1, 0]}}


ES_ABIERTO = {"$not": [{"$in": ["$estado", ESTADOS_CERRADOS]}]}
ES_RESUELTO = {"$eq": ["$estado", "resuelto"]}


@router.get("/resumen", summary="Tablero general ($facet: varios agrupamientos en una sola consulta)")
def resumen(departamento: str | None = None, desde: datetime | None = None, hasta: datetime | None = None):
    pipeline = [
        {"$match": _match_base(departamento, desde, hasta)},
        {"$facet": {
            "totales": [{"$group": {
                "_id": None,
                "reportes": {"$sum": 1},
                "abiertos": _contar_si(ES_ABIERTO),
                "resueltos": _contar_si(ES_RESUELTO),
                "rechazados": _contar_si({"$eq": ["$estado", "rechazado"]}),
                "criticosAbiertos": _contar_si({"$and": [ES_ABIERTO, {"$eq": ["$prioridad", "critica"]}]}),
                "apoyosTotales": {"$sum": "$totalApoyos"},
            }}, {"$project": {"_id": 0}}],
            "porEstado": [{"$group": {"_id": "$estado", "total": {"$sum": 1}}}, {"$sort": {"total": -1}}],
            "porCategoria": [{"$group": {"_id": "$categoria", "total": {"$sum": 1},
                                         "abiertos": _contar_si(ES_ABIERTO)}},
                             {"$sort": {"total": -1}}],
            "porPrioridad": [{"$group": {"_id": "$prioridad", "total": {"$sum": 1}}}, {"$sort": {"total": -1}}],
        }},
        {"$set": {"totales": {"$first": "$totales"}}},
    ]
    resultado = next(db.reportes.aggregate(pipeline), {})
    totales = resultado.get("totales") or {}
    if totales.get("reportes"):
        totales["tasaResolucion"] = round(totales["resueltos"] * 100 / totales["reportes"], 1)
    return serializar(resultado)


@router.get("/por-municipio", summary="Ranking de municipios por reportes abiertos")
def por_municipio(departamento: str | None = None, limite: int = Query(15, ge=1, le=44)):
    pipeline = [
        {"$match": _match_base(departamento, None, None)},
        {"$group": {
            "_id": {"departamento": "$direccion.departamento", "municipio": "$direccion.municipio"},
            "total": {"$sum": 1},
            "abiertos": _contar_si(ES_ABIERTO),
            "resueltos": _contar_si(ES_RESUELTO),
            "criticos": _contar_si({"$eq": ["$prioridad", "critica"]}),
            "apoyos": {"$sum": "$totalApoyos"},
        }},
        {"$set": {"tasaResolucion": {"$round": [{"$multiply": [{"$divide": ["$resueltos", "$total"]}, 100]}, 1]}}},
        {"$sort": {"abiertos": -1, "criticos": -1}},
        {"$limit": limite},
        {"$project": {"_id": 0, "departamento": "$_id.departamento", "municipio": "$_id.municipio",
                      "total": 1, "abiertos": 1, "resueltos": 1, "criticos": 1, "apoyos": 1, "tasaResolucion": 1}},
    ]
    return list(db.reportes.aggregate(pipeline))


@router.get("/tiempos-resolucion",
            summary="Tiempo promedio de resolución por institución ($group + $lookup + $unwind)")
def tiempos_resolucion(
    tipo: str | None = Query(None, description="Filtrar por tipo de institución (después del $lookup)"),
    min_resueltos: int = Query(3, ge=1, description="Mínimo de casos para aparecer en el ranking"),
):
    pipeline = [
        {"$match": {"estado": "resuelto", "fechaResolucion": {"$ne": None}}},
        {"$project": {
            "institucionId": "$institucion._id",
            "categoria": 1,
            "horas": {"$dateDiff": {"startDate": "$fechaCreacion", "endDate": "$fechaResolucion", "unit": "hour"}},
            "puntaje": "$calificacion.puntaje",
        }},
        {"$group": {
            "_id": "$institucionId",
            "resueltos": {"$sum": 1},
            "promedioHoras": {"$avg": "$horas"},
            "minHoras": {"$min": "$horas"},
            "maxHoras": {"$max": "$horas"},
            "satisfaccion": {"$avg": "$puntaje"},  # $avg ignora los reportes sin calificar
            "categorias": {"$addToSet": "$categoria"},
        }},
        {"$match": {"resueltos": {"$gte": min_resueltos}}},
        {"$lookup": {"from": "instituciones", "localField": "_id", "foreignField": "_id", "as": "inst"}},
        {"$unwind": "$inst"},
    ]
    if tipo:
        pipeline.append({"$match": {"inst.tipo": tipo}})
    pipeline += [
        {"$project": {
            "_id": 0, "codigo": "$inst.codigo", "institucion": "$inst.nombre", "tipo": "$inst.tipo",
            "resueltos": 1, "minHoras": 1, "maxHoras": 1, "categorias": 1,
            "promedioHoras": {"$round": ["$promedioHoras", 1]},
            "promedioDias": {"$round": [{"$divide": ["$promedioHoras", 24]}, 1]},
            "satisfaccion": {"$round": ["$satisfaccion", 2]},
        }},
        {"$sort": {"promedioHoras": 1}},
    ]
    return list(db.reportes.aggregate(pipeline))


@router.get("/tendencia-mensual", summary="Reportes por mes y categoría (dos $group encadenados)")
def tendencia_mensual(meses: int = Query(12, ge=1, le=24), categoria: str | None = None):
    filtro: dict = {"fechaCreacion": {"$gte": ahora() - timedelta(days=31 * meses)}}
    if categoria:
        filtro["categoria"] = categoria
    pipeline = [
        {"$match": filtro},
        {"$group": {
            "_id": {"mes": {"$dateToString": {"format": "%Y-%m", "date": "$fechaCreacion", "timezone": ZONA}},
                    "categoria": "$categoria"},
            "total": {"$sum": 1},
            "resueltos": _contar_si(ES_RESUELTO),
        }},
        {"$sort": {"total": -1}},
        {"$group": {
            "_id": "$_id.mes",
            "total": {"$sum": "$total"},
            "resueltos": {"$sum": "$resueltos"},
            "categorias": {"$push": {"categoria": "$_id.categoria", "total": "$total"}},
        }},
        {"$sort": {"_id": 1}},
        {"$project": {"_id": 0, "mes": "$_id", "total": 1, "resueltos": 1, "categorias": 1}},
    ]
    return list(db.reportes.aggregate(pipeline))


@router.get("/ciudadanos-activos", summary="Ciudadanos más participativos ($group + $lookup)")
def ciudadanos_activos(limite: int = Query(10, ge=1, le=50)):
    pipeline = [
        {"$group": {
            "_id": "$ciudadanoId",
            "reportes": {"$sum": 1},
            "resueltos": _contar_si(ES_RESUELTO),
            "apoyosRecibidos": {"$sum": "$totalApoyos"},
            "categorias": {"$addToSet": "$categoria"},
        }},
        {"$sort": {"reportes": -1, "apoyosRecibidos": -1}},
        {"$limit": limite},
        {"$lookup": {"from": "ciudadanos", "localField": "_id", "foreignField": "_id", "as": "ciudadano",
                     "pipeline": [{"$project": {"nombre": 1, "direccion.municipio": 1}}]}},
        {"$unwind": "$ciudadano"},
        {"$project": {"_id": 0, "ciudadanoId": {"$toString": "$_id"}, "nombre": "$ciudadano.nombre",
                      "municipio": "$ciudadano.direccion.municipio", "reportes": 1, "resueltos": 1,
                      "apoyosRecibidos": 1, "categorias": 1}},
    ]
    return list(db.reportes.aggregate(pipeline))


@router.get("/etiquetas", summary="Etiquetas más frecuentes en problemas abiertos ($unwind de un array)")
def etiquetas_frecuentes(limite: int = Query(10, ge=1, le=50), solo_abiertos: bool = True):
    pipeline = [{"$match": {"estado": {"$nin": ESTADOS_CERRADOS}}}] if solo_abiertos else []
    pipeline += [
        {"$unwind": "$etiquetas"},
        {"$group": {"_id": "$etiquetas", "total": {"$sum": 1}, "categorias": {"$addToSet": "$categoria"}}},
        {"$sort": {"total": -1}},
        {"$limit": limite},
        {"$project": {"_id": 0, "etiqueta": "$_id", "total": 1, "categorias": 1}},
    ]
    return list(db.reportes.aggregate(pipeline))


@router.get("/rendimiento-estados", summary="Horas promedio entre cada cambio de estado ($unwind del historial)")
def rendimiento_estados():
    """Desanida el historial embebido y mide cuánto tarda en promedio cada etapa del flujo."""
    pipeline = [
        {"$match": {"historial.1": {"$exists": True}}},
        {"$project": {"categoria": 1, "pasos": {"$zip": {"inputs": [
            "$historial", {"$slice": ["$historial", 1, 50]}]}}}},
        {"$unwind": "$pasos"},
        {"$project": {
            "desde": {"$arrayElemAt": ["$pasos.estado", 0]},
            "hasta": {"$arrayElemAt": ["$pasos.estado", 1]},
            "horas": {"$dateDiff": {"startDate": {"$arrayElemAt": ["$pasos.fecha", 0]},
                                    "endDate": {"$arrayElemAt": ["$pasos.fecha", 1]}, "unit": "hour"}},
        }},
        {"$group": {"_id": {"desde": "$desde", "hasta": "$hasta"}, "casos": {"$sum": 1},
                    "promedioHoras": {"$avg": "$horas"}}},
        {"$sort": {"casos": -1}},
        {"$project": {"_id": 0, "transicion": {"$concat": ["$_id.desde", " -> ", "$_id.hasta"]},
                      "casos": 1, "promedioHoras": {"$round": ["$promedioHoras", 1]}}},
    ]
    return list(db.reportes.aggregate(pipeline))
