"""Lógica de negocio compartida por la API y el script de seed."""
from pymongo import ReturnDocument

# Mientras más específica la cobertura, mejor candidata es la institución
_ESPECIFICIDAD = {"municipio": 3, "departamento": 2, "nacional": 1}


def buscar_institucion(db, categoria: str, departamento: str, municipio: str) -> dict | None:
    """Enruta el reporte a la institución activa más específica que atiende la categoría.

    Ej.: un bache en 'San Salvador Centro' va a la alcaldía del distrito antes que al MOP (nacional).
    """
    candidatas = db.instituciones.find(
        {
            "activa": True,
            "categoriasAtendidas": categoria,
            "$or": [
                {"cobertura.municipios": municipio},
                {"cobertura.departamentos": departamento, "cobertura.municipios": {"$size": 0}},
                {"cobertura.nacional": True},
            ],
        },
        {"codigo": 1, "nombre": 1, "cobertura": 1},
    )

    def puntaje(inst):
        cob = inst["cobertura"]
        if municipio in cob.get("municipios", []):
            return _ESPECIFICIDAD["municipio"]
        if departamento in cob.get("departamentos", []):
            return _ESPECIFICIDAD["departamento"]
        return _ESPECIFICIDAD["nacional"]

    mejor = max(candidatas, key=puntaje, default=None)
    if mejor is None:
        return None
    # Patrón Extended Reference: se copia solo lo que se muestra junto al reporte
    return {"_id": mejor["_id"], "codigo": mejor["codigo"], "nombre": mejor["nombre"]}


def siguiente_folio(db, anio: int) -> str:
    """Folio legible y único (RC-2026-000123) usando un contador atómico."""
    contador = db.contadores.find_one_and_update(
        {"_id": "folio_reportes"},
        {"$inc": {"secuencia": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return f"RC-{anio}-{contador['secuencia']:06d}"
