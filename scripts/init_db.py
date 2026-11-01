"""Crea las colecciones con reglas $jsonSchema y sus índices.

Es idempotente: si la colección ya existe, actualiza el validador con collMod.
Uso:  python -m scripts.init_db
"""
from pymongo import ASCENDING, DESCENDING, GEOSPHERE, TEXT
from pymongo.errors import CollectionInvalid

from app.catalogos import (CATEGORIAS, ESTADOS, LAT_MAX, LAT_MIN, LNG_MAX, LNG_MIN,
                           PRIORIDADES, TIPOS_EVIDENCIA, TIPOS_INSTITUCION)
from app.db import db

ENTERO = ["int", "long"]
TEXTO_OPCIONAL = ["string", "null"]

VALIDADOR_CIUDADANOS = {
    "$jsonSchema": {
        "bsonType": "object",
        "title": "Ciudadano que reporta problemas",
        "required": ["dui", "nombre", "email", "direccion", "fechaRegistro", "estadisticas"],
        "properties": {
            "dui": {"bsonType": "string", "pattern": "^[0-9]{8}-[0-9]$",
                    "description": "DUI con formato 00000000-0"},
            "nombre": {"bsonType": "string", "minLength": 3, "maxLength": 100},
            "email": {"bsonType": "string", "pattern": "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$"},
            "telefono": {"bsonType": TEXTO_OPCIONAL, "pattern": "^[267][0-9]{3}-[0-9]{4}$"},
            "direccion": {
                "bsonType": "object",
                "required": ["departamento", "municipio"],
                "properties": {
                    "departamento": {"bsonType": "string"},
                    "municipio": {"bsonType": "string"},
                    "colonia": {"bsonType": TEXTO_OPCIONAL},
                },
            },
            "fechaRegistro": {"bsonType": "date"},
            # Patrón Computed: contadores precalculados para no recontar en cada lectura
            "estadisticas": {
                "bsonType": "object",
                "required": ["totalReportes"],
                "properties": {
                    "totalReportes": {"bsonType": ENTERO, "minimum": 0},
                    "ultimoReporte": {"bsonType": ["date", "null"]},
                },
            },
        },
    }
}

VALIDADOR_INSTITUCIONES = {
    "$jsonSchema": {
        "bsonType": "object",
        "title": "Institución que atiende reportes",
        "required": ["codigo", "nombre", "tipo", "categoriasAtendidas", "cobertura", "activa"],
        "properties": {
            "codigo": {"bsonType": "string", "minLength": 2, "maxLength": 40},
            "nombre": {"bsonType": "string", "minLength": 3, "maxLength": 150},
            "tipo": {"enum": TIPOS_INSTITUCION},
            "categoriasAtendidas": {
                "bsonType": "array", "minItems": 1, "uniqueItems": True,
                "items": {"enum": CATEGORIAS},
            },
            "cobertura": {
                "bsonType": "object",
                "required": ["nacional", "departamentos", "municipios"],
                "properties": {
                    "nacional": {"bsonType": "bool"},
                    "departamentos": {"bsonType": "array", "items": {"bsonType": "string"}},
                    "municipios": {"bsonType": "array", "items": {"bsonType": "string"}},
                },
            },
            "contacto": {
                "bsonType": ["object", "null"],
                "properties": {
                    "telefono": {"bsonType": TEXTO_OPCIONAL},
                    "email": {"bsonType": TEXTO_OPCIONAL},
                },
            },
            "activa": {"bsonType": "bool"},
        },
    }
}

VALIDADOR_REPORTES = {
    "$jsonSchema": {
        "bsonType": "object",
        "title": "Reporte ciudadano",
        "required": ["folio", "titulo", "descripcion", "categoria", "prioridad", "nivelPrioridad",
                     "estado", "ubicacion", "direccion", "ciudadanoId", "historial", "apoyos",
                     "totalApoyos", "evidencias", "etiquetas", "fechaCreacion", "fechaActualizacion"],
        "properties": {
            "folio": {"bsonType": "string", "pattern": "^RC-[0-9]{4}-[0-9]{6}$"},
            "titulo": {"bsonType": "string", "minLength": 5, "maxLength": 120},
            "descripcion": {"bsonType": "string", "minLength": 10, "maxLength": 2000},
            "categoria": {"enum": CATEGORIAS},
            "prioridad": {"enum": PRIORIDADES},
            "nivelPrioridad": {"bsonType": ENTERO, "minimum": 1, "maximum": 4},
            "estado": {"enum": ESTADOS},
            # GeoJSON Point: [longitud, latitud] dentro de El Salvador
            "ubicacion": {
                "bsonType": "object",
                "required": ["type", "coordinates"],
                "properties": {
                    "type": {"enum": ["Point"]},
                    "coordinates": {
                        "bsonType": "array", "minItems": 2, "maxItems": 2,
                        "items": [
                            {"bsonType": "double", "minimum": LNG_MIN, "maximum": LNG_MAX},
                            {"bsonType": "double", "minimum": LAT_MIN, "maximum": LAT_MAX},
                        ],
                    },
                },
            },
            "direccion": {
                "bsonType": "object",
                "required": ["departamento", "municipio"],
                "properties": {
                    "departamento": {"bsonType": "string"},
                    "municipio": {"bsonType": "string"},
                    "referencia": {"bsonType": TEXTO_OPCIONAL, "maxLength": 200},
                },
            },
            # Referencia: el ciudadano vive en su propia colección
            "ciudadanoId": {"bsonType": "objectId"},
            # Extended Reference: copia mínima de la institución asignada
            "institucion": {
                "bsonType": ["object", "null"],
                "required": ["_id", "codigo", "nombre"],
                "properties": {
                    "_id": {"bsonType": "objectId"},
                    "codigo": {"bsonType": "string"},
                    "nombre": {"bsonType": "string"},
                },
            },
            # Embebido y acotado: la bitácora siempre se lee junto con el reporte
            "historial": {
                "bsonType": "array", "minItems": 1, "maxItems": 50,
                "items": {
                    "bsonType": "object",
                    "required": ["estado", "fecha", "actor"],
                    "properties": {
                        "estado": {"enum": ESTADOS},
                        "fecha": {"bsonType": "date"},
                        "actor": {"bsonType": "string"},
                        "comentario": {"bsonType": TEXTO_OPCIONAL},
                    },
                },
            },
            "evidencias": {
                "bsonType": "array", "maxItems": 10,
                "items": {
                    "bsonType": "object",
                    "required": ["url", "tipo", "fechaSubida"],
                    "properties": {
                        "url": {"bsonType": "string", "pattern": "^https?://"},
                        "tipo": {"enum": TIPOS_EVIDENCIA},
                        "fechaSubida": {"bsonType": "date"},
                    },
                },
            },
            "apoyos": {"bsonType": "array", "uniqueItems": True, "items": {"bsonType": "objectId"}},
            "totalApoyos": {"bsonType": ENTERO, "minimum": 0},
            "etiquetas": {"bsonType": "array", "maxItems": 10, "items": {"bsonType": "string"}},
            "calificacion": {
                "bsonType": "object",
                "required": ["puntaje", "fecha"],
                "properties": {
                    "puntaje": {"bsonType": ENTERO, "minimum": 1, "maximum": 5},
                    "comentario": {"bsonType": TEXTO_OPCIONAL},
                    "fecha": {"bsonType": "date"},
                },
            },
            "fechaCreacion": {"bsonType": "date"},
            "fechaActualizacion": {"bsonType": "date"},
            "fechaResolucion": {"bsonType": ["date", "null"]},
        },
    }
}

VALIDADORES = {
    "ciudadanos": VALIDADOR_CIUDADANOS,
    "instituciones": VALIDADOR_INSTITUCIONES,
    "reportes": VALIDADOR_REPORTES,
}


def crear_colecciones() -> None:
    for nombre, validador in VALIDADORES.items():
        try:
            db.create_collection(nombre, validator=validador,
                                 validationLevel="strict", validationAction="error")
            print(f"  + colección '{nombre}' creada con $jsonSchema")
        except CollectionInvalid:
            db.command("collMod", nombre, validator=validador,
                       validationLevel="strict", validationAction="error")
            print(f"  ~ colección '{nombre}' actualizada (collMod)")


def crear_indices() -> None:
    db.ciudadanos.create_index("dui", unique=True)
    db.ciudadanos.create_index("email", unique=True)
    db.ciudadanos.create_index([("direccion.departamento", ASCENDING), ("direccion.municipio", ASCENDING)])

    db.instituciones.create_index("codigo", unique=True)
    db.instituciones.create_index([("categoriasAtendidas", ASCENDING), ("activa", ASCENDING)])

    r = db.reportes
    r.create_index("folio", unique=True)
    # ESR (Equality, Sort, Range): filtros de igualdad primero, luego el orden por fecha
    r.create_index([("estado", ASCENDING), ("categoria", ASCENDING), ("fechaCreacion", DESCENDING)])
    r.create_index([("direccion.departamento", ASCENDING), ("direccion.municipio", ASCENDING),
                    ("fechaCreacion", DESCENDING)])
    r.create_index([("ciudadanoId", ASCENDING), ("fechaCreacion", DESCENDING)])
    r.create_index([("institucion._id", ASCENDING), ("estado", ASCENDING)])
    r.create_index([("ubicacion", GEOSPHERE)])
    r.create_index([("titulo", TEXT), ("descripcion", TEXT), ("etiquetas", TEXT)],
                   default_language="spanish", weights={"titulo": 5, "etiquetas": 3, "descripcion": 1},
                   name="busqueda_texto")
    print("  + índices creados")


def main() -> None:
    print(f"Inicializando base '{db.name}'...")
    crear_colecciones()
    crear_indices()
    print("Listo.")


if __name__ == "__main__":
    main()
