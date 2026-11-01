"""Lógica de negocio compartida por la API y el script de seed."""
from pymongo import ReturnDocument


def buscar_institucion(db, categoria: str, departamento: str, municipio: str) -> dict | None:
    """Elige la institución que debe atender el reporte.

    Prioridad: 1) la del municipio (alcaldía), 2) la del departamento (distribuidora eléctrica),
    3) una nacional (ANDA, MOP, VMT...). Ej.: un bache en 'San Salvador Centro' va a esa alcaldía.
    """
    filtro_base = {"activa": True, "categoriasAtendidas": categoria}
    opciones = [
        {**filtro_base, "cobertura.municipios": municipio},
        {**filtro_base, "cobertura.departamentos": departamento, "cobertura.municipios": []},
        {**filtro_base, "cobertura.nacional": True},
    ]
    for filtro in opciones:
        institucion = db.instituciones.find_one(filtro, {"codigo": 1, "nombre": 1})
        if institucion:
            # Referencia extendida: se guarda solo _id, código y nombre dentro del reporte
            return institucion
    return None


def siguiente_folio(db, anio: int) -> str:
    """Genera folios únicos RC-2026-000123 con un contador ($inc es atómico: no se repiten)."""
    contador = db.contadores.find_one_and_update(
        {"_id": "folio_reportes"},
        {"$inc": {"secuencia": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return f"RC-{anio}-{contador['secuencia']:06d}"
