"""Crea las colecciones con reglas de validación ($jsonSchema) y sus índices.

Se puede ejecutar varias veces: si la colección ya existe, solo actualiza la validación (collMod).
Uso:  python -m scripts.init_db
"""
from pymongo import ASCENDING, DESCENDING
from pymongo.errors import CollectionInvalid

from app.catalogos import (CATEGORIAS, ESTADOS, LAT_MAX, LAT_MIN, LNG_MAX, LNG_MIN,
                           PRIORIDADES, TIPOS_EVIDENCIA, TIPOS_INSTITUCION)
from app.db import db

# Python guarda los números enteros como "int" o "long" según su tamaño
ENTERO = ["int", "long"]

VALIDADOR_CIUDADANOS = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["dui", "nombre", "email", "direccion", "fechaRegistro", "estadisticas"],
        "properties": {
            "dui": {"bsonType": "string", "pattern": "^[0-9]{8}-[0-9]$",
                    "description": "DUI con formato 00000000-0"},
            "nombre": {"bsonType": "string", "minLength": 3, "maxLength": 100},
            "email": {"bsonType": "string", "pattern": "^[^@ ]+@[^@ ]+\\.[^@ ]+$"},
            "telefono": {"bsonType": ["string", "null"], "pattern": "^[267][0-9]{3}-[0-9]{4}$"},
            # Subdocumento embebido
            "direccion": {
                "bsonType": "object",
                "required": ["departamento", "municipio"],
                "properties": {
                    "departamento": {"bsonType": "string"},
                    "municipio": {"bsonType": "string"},
                    "colonia": {"bsonType": ["string", "null"]},
                },
            },
            "fechaRegistro": {"bsonType": "date"},
            # Contadores guardados para no tener que contar los reportes cada vez
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
        "required": ["codigo", "nombre", "tipo", "categoriasAtendidas", "cobertura", "activa"],
        "properties": {
            "codigo": {"bsonType": "string", "minLength": 2, "maxLength": 40},
            "nombre": {"bsonType": "string", "minLength": 3, "maxLength": 150},
            "tipo": {"enum": TIPOS_INSTITUCION},
            "categoriasAtendidas": {
                "bsonType": "array", "minItems": 1,
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
            "contacto": {"bsonType": ["object", "null"]},
            "activa": {"bsonType": "bool"},
        },
    }
}

VALIDADOR_REPORTES = {
    "$jsonSchema": {
        "bsonType": "object",
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
            # Coordenadas dentro de El Salvador
            "ubicacion": {
                "bsonType": "object",
                "required": ["latitud", "longitud"],
                "properties": {
                    "latitud": {"bsonType": "double", "minimum": LAT_MIN, "maximum": LAT_MAX},
                    "longitud": {"bsonType": "double", "minimum": LNG_MIN, "maximum": LNG_MAX},
                },
            },
            "direccion": {
                "bsonType": "object",
                "required": ["departamento", "municipio"],
                "properties": {
                    "departamento": {"bsonType": "string"},
                    "municipio": {"bsonType": "string"},
                    "referencia": {"bsonType": ["string", "null"]},
                },
            },
            # REFERENCIA: el ciudadano está en su propia colección
            "ciudadanoId": {"bsonType": "objectId"},
            # REFERENCIA EXTENDIDA: id + nombre de la institución, para no hacer $lookup al listar
            "institucion": {
                "bsonType": ["object", "null"],
                "required": ["_id", "codigo", "nombre"],
                "properties": {
                    "_id": {"bsonType": "objectId"},
                    "codigo": {"bsonType": "string"},
                    "nombre": {"bsonType": "string"},
                },
            },
            # EMBEBIDO: la bitácora de cambios de estado
            "historial": {
                "bsonType": "array", "minItems": 1, "maxItems": 50,
                "items": {
                    "bsonType": "object",
                    "required": ["estado", "fecha", "actor"],
                    "properties": {
                        "estado": {"enum": ESTADOS},
                        "fecha": {"bsonType": "date"},
                        "actor": {"bsonType": "string"},
                        "comentario": {"bsonType": ["string", "null"]},
                    },
                },
            },
            # EMBEBIDO: máximo 10 evidencias (solo URLs, no archivos) por el límite de 16 MB
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
            "apoyos": {"bsonType": "array", "items": {"bsonType": "objectId"}},
            "totalApoyos": {"bsonType": ENTERO, "minimum": 0},
            "etiquetas": {"bsonType": "array", "maxItems": 10, "items": {"bsonType": "string"}},
            "calificacion": {
                "bsonType": "object",
                "required": ["puntaje", "fecha"],
                "properties": {
                    "puntaje": {"bsonType": ENTERO, "minimum": 1, "maximum": 5},
                    "comentario": {"bsonType": ["string", "null"]},
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
            # Ya existía: solo se actualiza la regla de validación
            db.command("collMod", nombre, validator=validador,
                       validationLevel="strict", validationAction="error")
            print(f"  ~ colección '{nombre}' actualizada")


def crear_indices() -> None:
    # Únicos: no se permiten dos ciudadanos con el mismo DUI o correo
    db.ciudadanos.create_index("dui", unique=True)
    db.ciudadanos.create_index("email", unique=True)

    db.instituciones.create_index("codigo", unique=True)
    db.instituciones.create_index("categoriasAtendidas")

    db.reportes.create_index("folio", unique=True)
    # Compuestos: apoyan los filtros más usados del listado, ordenados por fecha
    db.reportes.create_index([("estado", ASCENDING), ("categoria", ASCENDING), ("fechaCreacion", DESCENDING)])
    db.reportes.create_index([("direccion.departamento", ASCENDING), ("direccion.municipio", ASCENDING)])
    db.reportes.create_index([("ciudadanoId", ASCENDING), ("fechaCreacion", DESCENDING)])
    db.reportes.create_index("institucion._id")
    print("  + índices creados")


def main() -> None:
    print(f"Inicializando base '{db.name}'...")
    crear_colecciones()
    crear_indices()
    print("Listo.")


if __name__ == "__main__":
    main()
