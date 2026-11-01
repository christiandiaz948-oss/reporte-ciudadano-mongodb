import math
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import HTTPException


def ahora() -> datetime:
    return datetime.now(timezone.utc)


def a_oid(valor: str, campo: str = "id") -> ObjectId:
    if not ObjectId.is_valid(valor):
        raise HTTPException(status_code=400, detail=f"'{campo}' no es un ObjectId válido: {valor}")
    return ObjectId(valor)


def serializar(valor):
    """Convierte ObjectId a texto de forma recursiva para responder en JSON."""
    if isinstance(valor, ObjectId):
        return str(valor)
    if isinstance(valor, list):
        return [serializar(v) for v in valor]
    if isinstance(valor, dict):
        return {k: serializar(v) for k, v in valor.items()}
    return valor


def paginar(coleccion, filtro: dict, pagina: int, tamano: int, orden=None, proyeccion=None) -> dict:
    total = coleccion.count_documents(filtro)
    cursor = coleccion.find(filtro, proyeccion)
    if orden:
        cursor = cursor.sort(orden)
    datos = list(cursor.skip((pagina - 1) * tamano).limit(tamano))
    return {
        "total": total,
        "pagina": pagina,
        "tamano": tamano,
        "paginas": math.ceil(total / tamano) if total else 0,
        "datos": serializar(datos),
    }
