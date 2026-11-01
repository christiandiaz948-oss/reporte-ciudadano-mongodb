// Crea la base reporte_ciudadano, sus colecciones con validación ($jsonSchema) y los índices.
// Ejecutar en Compass: abrir la pestaña _MONGOSH (abajo), pegar todo y presionar Enter.
// Después importar los datos con Add Data -> Import JSON (archivos de esta carpeta).
use("reporte_ciudadano");

// ---------- ciudadanos ----------
db.createCollection("ciudadanos", {
  validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "required": [
        "dui",
        "nombre",
        "email",
        "direccion",
        "fechaRegistro",
        "estadisticas"
      ],
      "properties": {
        "dui": {
          "bsonType": "string",
          "pattern": "^[0-9]{8}-[0-9]$",
          "description": "DUI con formato 00000000-0"
        },
        "nombre": {
          "bsonType": "string",
          "minLength": 3,
          "maxLength": 100
        },
        "email": {
          "bsonType": "string",
          "pattern": "^[^@ ]+@[^@ ]+\\.[^@ ]+$"
        },
        "telefono": {
          "bsonType": [
            "string",
            "null"
          ],
          "pattern": "^[267][0-9]{3}-[0-9]{4}$"
        },
        "direccion": {
          "bsonType": "object",
          "required": [
            "departamento",
            "municipio"
          ],
          "properties": {
            "departamento": {
              "bsonType": "string"
            },
            "municipio": {
              "bsonType": "string"
            },
            "colonia": {
              "bsonType": [
                "string",
                "null"
              ]
            }
          }
        },
        "fechaRegistro": {
          "bsonType": "date"
        },
        "estadisticas": {
          "bsonType": "object",
          "required": [
            "totalReportes"
          ],
          "properties": {
            "totalReportes": {
              "bsonType": [
                "int",
                "long"
              ],
              "minimum": 0
            },
            "ultimoReporte": {
              "bsonType": [
                "date",
                "null"
              ]
            }
          }
        }
      }
    }
  },
  validationLevel: "strict",
  validationAction: "error"
});

// ---------- instituciones ----------
db.createCollection("instituciones", {
  validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "required": [
        "codigo",
        "nombre",
        "tipo",
        "categoriasAtendidas",
        "cobertura",
        "activa"
      ],
      "properties": {
        "codigo": {
          "bsonType": "string",
          "minLength": 2,
          "maxLength": 40
        },
        "nombre": {
          "bsonType": "string",
          "minLength": 3,
          "maxLength": 150
        },
        "tipo": {
          "enum": [
            "alcaldia",
            "autonoma",
            "ministerio",
            "distribuidora",
            "emergencias"
          ]
        },
        "categoriasAtendidas": {
          "bsonType": "array",
          "minItems": 1,
          "items": {
            "enum": [
              "bache",
              "alumbrado",
              "basura",
              "agua_potable",
              "alcantarillado",
              "arbol_caido",
              "semaforo",
              "seguridad_vial",
              "ruido",
              "otro"
            ]
          }
        },
        "cobertura": {
          "bsonType": "object",
          "required": [
            "nacional",
            "departamentos",
            "municipios"
          ],
          "properties": {
            "nacional": {
              "bsonType": "bool"
            },
            "departamentos": {
              "bsonType": "array",
              "items": {
                "bsonType": "string"
              }
            },
            "municipios": {
              "bsonType": "array",
              "items": {
                "bsonType": "string"
              }
            }
          }
        },
        "contacto": {
          "bsonType": [
            "object",
            "null"
          ]
        },
        "activa": {
          "bsonType": "bool"
        }
      }
    }
  },
  validationLevel: "strict",
  validationAction: "error"
});

// ---------- reportes ----------
db.createCollection("reportes", {
  validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "required": [
        "folio",
        "titulo",
        "descripcion",
        "categoria",
        "prioridad",
        "nivelPrioridad",
        "estado",
        "ubicacion",
        "direccion",
        "ciudadanoId",
        "historial",
        "apoyos",
        "totalApoyos",
        "evidencias",
        "etiquetas",
        "fechaCreacion",
        "fechaActualizacion"
      ],
      "properties": {
        "folio": {
          "bsonType": "string",
          "pattern": "^RC-[0-9]{4}-[0-9]{6}$"
        },
        "titulo": {
          "bsonType": "string",
          "minLength": 5,
          "maxLength": 120
        },
        "descripcion": {
          "bsonType": "string",
          "minLength": 10,
          "maxLength": 2000
        },
        "categoria": {
          "enum": [
            "bache",
            "alumbrado",
            "basura",
            "agua_potable",
            "alcantarillado",
            "arbol_caido",
            "semaforo",
            "seguridad_vial",
            "ruido",
            "otro"
          ]
        },
        "prioridad": {
          "enum": [
            "baja",
            "media",
            "alta",
            "critica"
          ]
        },
        "nivelPrioridad": {
          "bsonType": [
            "int",
            "long"
          ],
          "minimum": 1,
          "maximum": 4
        },
        "estado": {
          "enum": [
            "recibido",
            "en_revision",
            "asignado",
            "en_proceso",
            "resuelto",
            "rechazado"
          ]
        },
        "ubicacion": {
          "bsonType": "object",
          "required": [
            "latitud",
            "longitud"
          ],
          "properties": {
            "latitud": {
              "bsonType": "double",
              "minimum": 13.1,
              "maximum": 14.5
            },
            "longitud": {
              "bsonType": "double",
              "minimum": -90.2,
              "maximum": -87.6
            }
          }
        },
        "direccion": {
          "bsonType": "object",
          "required": [
            "departamento",
            "municipio"
          ],
          "properties": {
            "departamento": {
              "bsonType": "string"
            },
            "municipio": {
              "bsonType": "string"
            },
            "referencia": {
              "bsonType": [
                "string",
                "null"
              ]
            }
          }
        },
        "ciudadanoId": {
          "bsonType": "objectId"
        },
        "institucion": {
          "bsonType": [
            "object",
            "null"
          ],
          "required": [
            "_id",
            "codigo",
            "nombre"
          ],
          "properties": {
            "_id": {
              "bsonType": "objectId"
            },
            "codigo": {
              "bsonType": "string"
            },
            "nombre": {
              "bsonType": "string"
            }
          }
        },
        "historial": {
          "bsonType": "array",
          "minItems": 1,
          "maxItems": 50,
          "items": {
            "bsonType": "object",
            "required": [
              "estado",
              "fecha",
              "actor"
            ],
            "properties": {
              "estado": {
                "enum": [
                  "recibido",
                  "en_revision",
                  "asignado",
                  "en_proceso",
                  "resuelto",
                  "rechazado"
                ]
              },
              "fecha": {
                "bsonType": "date"
              },
              "actor": {
                "bsonType": "string"
              },
              "comentario": {
                "bsonType": [
                  "string",
                  "null"
                ]
              }
            }
          }
        },
        "evidencias": {
          "bsonType": "array",
          "maxItems": 10,
          "items": {
            "bsonType": "object",
            "required": [
              "url",
              "tipo",
              "fechaSubida"
            ],
            "properties": {
              "url": {
                "bsonType": "string",
                "pattern": "^https?://"
              },
              "tipo": {
                "enum": [
                  "foto",
                  "video",
                  "documento"
                ]
              },
              "fechaSubida": {
                "bsonType": "date"
              }
            }
          }
        },
        "apoyos": {
          "bsonType": "array",
          "items": {
            "bsonType": "objectId"
          }
        },
        "totalApoyos": {
          "bsonType": [
            "int",
            "long"
          ],
          "minimum": 0
        },
        "etiquetas": {
          "bsonType": "array",
          "maxItems": 10,
          "items": {
            "bsonType": "string"
          }
        },
        "calificacion": {
          "bsonType": "object",
          "required": [
            "puntaje",
            "fecha"
          ],
          "properties": {
            "puntaje": {
              "bsonType": [
                "int",
                "long"
              ],
              "minimum": 1,
              "maximum": 5
            },
            "comentario": {
              "bsonType": [
                "string",
                "null"
              ]
            },
            "fecha": {
              "bsonType": "date"
            }
          }
        },
        "fechaCreacion": {
          "bsonType": "date"
        },
        "fechaActualizacion": {
          "bsonType": "date"
        },
        "fechaResolucion": {
          "bsonType": [
            "date",
            "null"
          ]
        }
      }
    }
  },
  validationLevel: "strict",
  validationAction: "error"
});

// ---------- índices ----------
db.ciudadanos.createIndex({"dui": 1}, { unique: true });
db.ciudadanos.createIndex({"email": 1}, { unique: true });
db.instituciones.createIndex({"codigo": 1}, { unique: true });
db.instituciones.createIndex({"categoriasAtendidas": 1});
db.reportes.createIndex({"folio": 1}, { unique: true });
db.reportes.createIndex({"estado": 1, "categoria": 1, "fechaCreacion": -1});
db.reportes.createIndex({"direccion.departamento": 1, "direccion.municipio": 1});
db.reportes.createIndex({"ciudadanoId": 1, "fechaCreacion": -1});
db.reportes.createIndex({"institucion._id": 1});

print("Base reporte_ciudadano creada");
