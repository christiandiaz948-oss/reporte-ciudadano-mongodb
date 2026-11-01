// =====================================================================
// Sistema de Reporte Ciudadano - Script de base de datos (MongoDB)
// Bases de Datos II - Universidad Evangélica de El Salvador - Grupo 2
//
// Crea la base reporte_ciudadano con:
//   1. Colecciones con validación $jsonSchema
//   2. Índices
//   3. Datos de prueba: 57 instituciones, 15 ciudadanos, 20 reportes
//
// Cómo ejecutarlo:
//   - En MongoDB Compass: abrir la pestaña >_MONGOSH, pegar todo el archivo y presionar Enter.
//   - En una terminal:    mongosh script_bd_reporte_ciudadano.mongodb.js
//
// ATENCIÓN: borra la base reporte_ciudadano si ya existe.
// =====================================================================

use("reporte_ciudadano");
db.dropDatabase();


// =====================================================================
// 1. COLECCIONES CON VALIDACIÓN ($jsonSchema)
// =====================================================================

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

db.createCollection("contadores");


// =====================================================================
// 2. ÍNDICES
// =====================================================================

db.ciudadanos.createIndex({ "dui": 1 }, { unique: true });
db.ciudadanos.createIndex({ "email": 1 }, { unique: true });
db.instituciones.createIndex({ "codigo": 1 }, { unique: true });
db.instituciones.createIndex({ "categoriasAtendidas": 1 });
db.reportes.createIndex({ "folio": 1 }, { unique: true });
db.reportes.createIndex({ "estado": 1, "categoria": 1, "fechaCreacion": -1 });
db.reportes.createIndex({ "direccion.departamento": 1, "direccion.municipio": 1 });
db.reportes.createIndex({ "ciudadanoId": 1, "fechaCreacion": -1 });
db.reportes.createIndex({ "institucion._id": 1 });


// =====================================================================
// 3. DATOS DE PRUEBA
// =====================================================================

// ---------- instituciones (57) ----------
db.instituciones.insertMany([
  {
    "_id": ObjectId("6ae6ba73af7333f46925add2"),
    "codigo": "AM-AHUACHAPAN-NORTE",
    "nombre": "Alcaldía Municipal de Ahuachapán Norte",
    "tipo": "alcaldia",
    "categoriasAtendidas": ["bache", "basura", "arbol_caido", "ruido", "otro"],
    "cobertura": {
      "nacional": false,
      "departamentos": ["Ahuachapán"],
      "municipios": ["Ahuachapán Norte"]
    },
    "contacto": {
      "telefono": null,
      "email": "atencion@ahuachapan-norte.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925add3"),
    "codigo": "AM-AHUACHAPAN-CENTRO",
    "nombre": "Alcaldía Municipal de Ahuachapán Centro",
    "tipo": "alcaldia",
    "categoriasAtendidas": ["bache", "basura", "arbol_caido", "ruido", "otro"],
    "cobertura": {
      "nacional": false,
      "departamentos": ["Ahuachapán"],
      "municipios": ["Ahuachapán Centro"]
    },
    "contacto": {
      "telefono": null,
      "email": "atencion@ahuachapan-centro.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925add4"),
    "codigo": "AM-AHUACHAPAN-SUR",
    "nombre": "Alcaldía Municipal de Ahuachapán Sur",
    "tipo": "alcaldia",
    "categoriasAtendidas": ["bache", "basura", "arbol_caido", "ruido", "otro"],
    "cobertura": {
      "nacional": false,
      "departamentos": ["Ahuachapán"],
      "municipios": ["Ahuachapán Sur"]
    },
    "contacto": {
      "telefono": null,
      "email": "atencion@ahuachapan-sur.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925add5"),
    "codigo": "AM-SANTA-ANA-NORTE",
    "nombre": "Alcaldía Municipal de Santa Ana Norte",
    "tipo": "alcaldia",
    "categoriasAtendidas": ["bache", "basura", "arbol_caido", "ruido", "otro"],
    "cobertura": {
      "nacional": false,
      "departamentos": ["Santa Ana"],
      "municipios": ["Santa Ana Norte"]
    },
    "contacto": {
      "telefono": null,
      "email": "atencion@santa-ana-norte.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925add6"),
    "codigo": "AM-SANTA-ANA-CENTRO",
    "nombre": "Alcaldía Municipal de Santa Ana Centro",
    "tipo": "alcaldia",
    "categoriasAtendidas": ["bache", "basura", "arbol_caido", "ruido", "otro"],
    "cobertura": {
      "nacional": false,
      "departamentos": ["Santa Ana"],
      "municipios": ["Santa Ana Centro"]
    },
    "contacto": {
      "telefono": null,
      "email": "atencion@santa-ana-centro.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925add7"),
    "codigo": "AM-SANTA-ANA-ESTE",
    "nombre": "Alcaldía Municipal de Santa Ana Este",
    "tipo": "alcaldia",
    "categoriasAtendidas": ["bache", "basura", "arbol_caido", "ruido", "otro"],
    "cobertura": {
      "nacional": false,
      "departamentos": ["Santa Ana"],
      "municipios": ["Santa Ana Este"]
    },
    "contacto": {
      "telefono": null,
      "email": "atencion@santa-ana-este.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925add8"),
    "codigo": "AM-SANTA-ANA-OESTE",
    "nombre": "Alcaldía Municipal de Santa Ana Oeste",
    "tipo": "alcaldia",
    "categoriasAtendidas": ["bache", "basura", "arbol_caido", "ruido", "otro"],
    "cobertura": {
      "nacional": false,
      "departamentos": ["Santa Ana"],
      "municipios": ["Santa Ana Oeste"]
    },
    "contacto": {
      "telefono": null,
      "email": "atencion@santa-ana-oeste.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925add9"),
    "codigo": "AM-SONSONATE-NORTE",
    "nombre": "Alcaldía Municipal de Sonsonate Norte",
    "tipo": "alcaldia",
    "categoriasAtendidas": ["bache", "basura", "arbol_caido", "ruido", "otro"],
    "cobertura": {
      "nacional": false,
      "departamentos": ["Sonsonate"],
      "municipios": ["Sonsonate Norte"]
    },
    "contacto": {
      "telefono": null,
      "email": "atencion@sonsonate-norte.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925adda"),
    "codigo": "AM-SONSONATE-CENTRO",
    "nombre": "Alcaldía Municipal de Sonsonate Centro",
    "tipo": "alcaldia",
    "categoriasAtendidas": ["bache", "basura", "arbol_caido", "ruido", "otro"],
    "cobertura": {
      "nacional": false,
      "departamentos": ["Sonsonate"],
      "municipios": ["Sonsonate Centro"]
    },
    "contacto": {
      "telefono": null,
      "email": "atencion@sonsonate-centro.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925addb"),
    "codigo": "AM-SONSONATE-ESTE",
    "nombre": "Alcaldía Municipal de Sonsonate Este",
    "tipo": "alcaldia",
    "categoriasAtendidas": ["bache", "basura", "arbol_caido", "ruido", "otro"],
    "cobertura": {
      "nacional": false,
      "departamentos": ["Sonsonate"],
      "municipios": ["Sonsonate Este"]
    },
    "contacto": {
      "telefono": null,
      "email": "atencion@sonsonate-este.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925addc"),
    "codigo": "AM-SONSONATE-OESTE",
    "nombre": "Alcaldía Municipal de Sonsonate Oeste",
    "tipo": "alcaldia",
    "categoriasAtendidas": ["bache", "basura", "arbol_caido", "ruido", "otro"],
    "cobertura": {
      "nacional": false,
      "departamentos": ["Sonsonate"],
      "municipios": ["Sonsonate Oeste"]
    },
    "contacto": {
      "telefono": null,
      "email": "atencion@sonsonate-oeste.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925addd"),
    "codigo": "AM-CHALATENANGO-NORTE",
    "nombre": "Alcaldía Municipal de Chalatenango Norte",
    "tipo": "alcaldia",
    "categoriasAtendidas": ["bache", "basura", "arbol_caido", "ruido", "otro"],
    "cobertura": {
      "nacional": false,
      "departamentos": ["Chalatenango"],
      "municipios": ["Chalatenango Norte"]
    },
    "contacto": {
      "telefono": null,
      "email": "atencion@chalatenango-norte.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925adde"),
    "codigo": "AM-CHALATENANGO-CENTRO",
    "nombre": "Alcaldía Municipal de Chalatenango Centro",
    "tipo": "alcaldia",
    "categoriasAtendidas": ["bache", "basura", "arbol_caido", "ruido", "otro"],
    "cobertura": {
      "nacional": false,
      "departamentos": ["Chalatenango"],
      "municipios": ["Chalatenango Centro"]
    },
    "contacto": {
      "telefono": null,
      "email": "atencion@chalatenango-centro.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925addf"),
    "codigo": "AM-CHALATENANGO-SUR",
    "nombre": "Alcaldía Municipal de Chalatenango Sur",
    "tipo": "alcaldia",
    "categoriasAtendidas": ["bache", "basura", "arbol_caido", "ruido", "otro"],
    "cobertura": {
      "nacional": false,
      "departamentos": ["Chalatenango"],
      "municipios": ["Chalatenango Sur"]
    },
    "contacto": {
      "telefono": null,
      "email": "atencion@chalatenango-sur.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ade0"),
    "codigo": "AM-LA-LIBERTAD-NORTE",
    "nombre": "Alcaldía Municipal de La Libertad Norte",
    "tipo": "alcaldia",
    "categoriasAtendidas": ["bache", "basura", "arbol_caido", "ruido", "otro"],
    "cobertura": {
      "nacional": false,
      "departamentos": ["La Libertad"],
      "municipios": ["La Libertad Norte"]
    },
    "contacto": {
      "telefono": null,
      "email": "atencion@la-libertad-norte.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ade1"),
    "codigo": "AM-LA-LIBERTAD-CENTRO",
    "nombre": "Alcaldía Municipal de La Libertad Centro",
    "tipo": "alcaldia",
    "categoriasAtendidas": ["bache", "basura", "arbol_caido", "ruido", "otro"],
    "cobertura": {
      "nacional": false,
      "departamentos": ["La Libertad"],
      "municipios": ["La Libertad Centro"]
    },
    "contacto": {
      "telefono": null,
      "email": "atencion@la-libertad-centro.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ade2"),
    "codigo": "AM-LA-LIBERTAD-OESTE",
    "nombre": "Alcaldía Municipal de La Libertad Oeste",
    "tipo": "alcaldia",
    "categoriasAtendidas": ["bache", "basura", "arbol_caido", "ruido", "otro"],
    "cobertura": {
      "nacional": false,
      "departamentos": ["La Libertad"],
      "municipios": ["La Libertad Oeste"]
    },
    "contacto": {
      "telefono": null,
      "email": "atencion@la-libertad-oeste.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ade3"),
    "codigo": "AM-LA-LIBERTAD-ESTE",
    "nombre": "Alcaldía Municipal de La Libertad Este",
    "tipo": "alcaldia",
    "categoriasAtendidas": ["bache", "basura", "arbol_caido", "ruido", "otro"],
    "cobertura": {
      "nacional": false,
      "departamentos": ["La Libertad"],
      "municipios": ["La Libertad Este"]
    },
    "contacto": {
      "telefono": null,
      "email": "atencion@la-libertad-este.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ade4"),
    "codigo": "AM-LA-LIBERTAD-COSTA",
    "nombre": "Alcaldía Municipal de La Libertad Costa",
    "tipo": "alcaldia",
    "categoriasAtendidas": ["bache", "basura", "arbol_caido", "ruido", "otro"],
    "cobertura": {
      "nacional": false,
      "departamentos": ["La Libertad"],
      "municipios": ["La Libertad Costa"]
    },
    "contacto": {
      "telefono": null,
      "email": "atencion@la-libertad-costa.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ade5"),
    "codigo": "AM-LA-LIBERTAD-SUR",
    "nombre": "Alcaldía Municipal de La Libertad Sur",
    "tipo": "alcaldia",
    "categoriasAtendidas": ["bache", "basura", "arbol_caido", "ruido", "otro"],
    "cobertura": {
      "nacional": false,
      "departamentos": ["La Libertad"],
      "municipios": ["La Libertad Sur"]
    },
    "contacto": {
      "telefono": null,
      "email": "atencion@la-libertad-sur.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ade6"),
    "codigo": "AM-SAN-SALVADOR-NORTE",
    "nombre": "Alcaldía Municipal de San Salvador Norte",
    "tipo": "alcaldia",
    "categoriasAtendidas": ["bache", "basura", "arbol_caido", "ruido", "otro"],
    "cobertura": {
      "nacional": false,
      "departamentos": ["San Salvador"],
      "municipios": ["San Salvador Norte"]
    },
    "contacto": {
      "telefono": null,
      "email": "atencion@san-salvador-norte.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ade7"),
    "codigo": "AM-SAN-SALVADOR-OESTE",
    "nombre": "Alcaldía Municipal de San Salvador Oeste",
    "tipo": "alcaldia",
    "categoriasAtendidas": ["bache", "basura", "arbol_caido", "ruido", "otro"],
    "cobertura": {
      "nacional": false,
      "departamentos": ["San Salvador"],
      "municipios": ["San Salvador Oeste"]
    },
    "contacto": {
      "telefono": null,
      "email": "atencion@san-salvador-oeste.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ade8"),
    "codigo": "AM-SAN-SALVADOR-ESTE",
    "nombre": "Alcaldía Municipal de San Salvador Este",
    "tipo": "alcaldia",
    "categoriasAtendidas": ["bache", "basura", "arbol_caido", "ruido", "otro"],
    "cobertura": {
      "nacional": false,
      "departamentos": ["San Salvador"],
      "municipios": ["San Salvador Este"]
    },
    "contacto": {
      "telefono": null,
      "email": "atencion@san-salvador-este.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ade9"),
    "codigo": "AM-SAN-SALVADOR-CENTRO",
    "nombre": "Alcaldía Municipal de San Salvador Centro",
    "tipo": "alcaldia",
    "categoriasAtendidas": ["bache", "basura", "arbol_caido", "ruido", "otro"],
    "cobertura": {
      "nacional": false,
      "departamentos": ["San Salvador"],
      "municipios": ["San Salvador Centro"]
    },
    "contacto": {
      "telefono": null,
      "email": "atencion@san-salvador-centro.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925adea"),
    "codigo": "AM-SAN-SALVADOR-SUR",
    "nombre": "Alcaldía Municipal de San Salvador Sur",
    "tipo": "alcaldia",
    "categoriasAtendidas": ["bache", "basura", "arbol_caido", "ruido", "otro"],
    "cobertura": {
      "nacional": false,
      "departamentos": ["San Salvador"],
      "municipios": ["San Salvador Sur"]
    },
    "contacto": {
      "telefono": null,
      "email": "atencion@san-salvador-sur.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925adeb"),
    "codigo": "AM-CUSCATLAN-NORTE",
    "nombre": "Alcaldía Municipal de Cuscatlán Norte",
    "tipo": "alcaldia",
    "categoriasAtendidas": ["bache", "basura", "arbol_caido", "ruido", "otro"],
    "cobertura": {
      "nacional": false,
      "departamentos": ["Cuscatlán"],
      "municipios": ["Cuscatlán Norte"]
    },
    "contacto": {
      "telefono": null,
      "email": "atencion@cuscatlan-norte.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925adec"),
    "codigo": "AM-CUSCATLAN-SUR",
    "nombre": "Alcaldía Municipal de Cuscatlán Sur",
    "tipo": "alcaldia",
    "categoriasAtendidas": ["bache", "basura", "arbol_caido", "ruido", "otro"],
    "cobertura": {
      "nacional": false,
      "departamentos": ["Cuscatlán"],
      "municipios": ["Cuscatlán Sur"]
    },
    "contacto": {
      "telefono": null,
      "email": "atencion@cuscatlan-sur.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925aded"),
    "codigo": "AM-LA-PAZ-OESTE",
    "nombre": "Alcaldía Municipal de La Paz Oeste",
    "tipo": "alcaldia",
    "categoriasAtendidas": ["bache", "basura", "arbol_caido", "ruido", "otro"],
    "cobertura": {
      "nacional": false,
      "departamentos": ["La Paz"],
      "municipios": ["La Paz Oeste"]
    },
    "contacto": {
      "telefono": null,
      "email": "atencion@la-paz-oeste.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925adee"),
    "codigo": "AM-LA-PAZ-CENTRO",
    "nombre": "Alcaldía Municipal de La Paz Centro",
    "tipo": "alcaldia",
    "categoriasAtendidas": ["bache", "basura", "arbol_caido", "ruido", "otro"],
    "cobertura": {
      "nacional": false,
      "departamentos": ["La Paz"],
      "municipios": ["La Paz Centro"]
    },
    "contacto": {
      "telefono": null,
      "email": "atencion@la-paz-centro.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925adef"),
    "codigo": "AM-LA-PAZ-ESTE",
    "nombre": "Alcaldía Municipal de La Paz Este",
    "tipo": "alcaldia",
    "categoriasAtendidas": ["bache", "basura", "arbol_caido", "ruido", "otro"],
    "cobertura": {
      "nacional": false,
      "departamentos": ["La Paz"],
      "municipios": ["La Paz Este"]
    },
    "contacto": {
      "telefono": null,
      "email": "atencion@la-paz-este.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925adf0"),
    "codigo": "AM-CABANAS-ESTE",
    "nombre": "Alcaldía Municipal de Cabañas Este",
    "tipo": "alcaldia",
    "categoriasAtendidas": ["bache", "basura", "arbol_caido", "ruido", "otro"],
    "cobertura": {
      "nacional": false,
      "departamentos": ["Cabañas"],
      "municipios": ["Cabañas Este"]
    },
    "contacto": {
      "telefono": null,
      "email": "atencion@cabanas-este.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925adf1"),
    "codigo": "AM-CABANAS-OESTE",
    "nombre": "Alcaldía Municipal de Cabañas Oeste",
    "tipo": "alcaldia",
    "categoriasAtendidas": ["bache", "basura", "arbol_caido", "ruido", "otro"],
    "cobertura": {
      "nacional": false,
      "departamentos": ["Cabañas"],
      "municipios": ["Cabañas Oeste"]
    },
    "contacto": {
      "telefono": null,
      "email": "atencion@cabanas-oeste.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925adf2"),
    "codigo": "AM-SAN-VICENTE-NORTE",
    "nombre": "Alcaldía Municipal de San Vicente Norte",
    "tipo": "alcaldia",
    "categoriasAtendidas": ["bache", "basura", "arbol_caido", "ruido", "otro"],
    "cobertura": {
      "nacional": false,
      "departamentos": ["San Vicente"],
      "municipios": ["San Vicente Norte"]
    },
    "contacto": {
      "telefono": null,
      "email": "atencion@san-vicente-norte.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925adf3"),
    "codigo": "AM-SAN-VICENTE-SUR",
    "nombre": "Alcaldía Municipal de San Vicente Sur",
    "tipo": "alcaldia",
    "categoriasAtendidas": ["bache", "basura", "arbol_caido", "ruido", "otro"],
    "cobertura": {
      "nacional": false,
      "departamentos": ["San Vicente"],
      "municipios": ["San Vicente Sur"]
    },
    "contacto": {
      "telefono": null,
      "email": "atencion@san-vicente-sur.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925adf4"),
    "codigo": "AM-USULUTAN-NORTE",
    "nombre": "Alcaldía Municipal de Usulután Norte",
    "tipo": "alcaldia",
    "categoriasAtendidas": ["bache", "basura", "arbol_caido", "ruido", "otro"],
    "cobertura": {
      "nacional": false,
      "departamentos": ["Usulután"],
      "municipios": ["Usulután Norte"]
    },
    "contacto": {
      "telefono": null,
      "email": "atencion@usulutan-norte.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925adf5"),
    "codigo": "AM-USULUTAN-ESTE",
    "nombre": "Alcaldía Municipal de Usulután Este",
    "tipo": "alcaldia",
    "categoriasAtendidas": ["bache", "basura", "arbol_caido", "ruido", "otro"],
    "cobertura": {
      "nacional": false,
      "departamentos": ["Usulután"],
      "municipios": ["Usulután Este"]
    },
    "contacto": {
      "telefono": null,
      "email": "atencion@usulutan-este.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925adf6"),
    "codigo": "AM-USULUTAN-OESTE",
    "nombre": "Alcaldía Municipal de Usulután Oeste",
    "tipo": "alcaldia",
    "categoriasAtendidas": ["bache", "basura", "arbol_caido", "ruido", "otro"],
    "cobertura": {
      "nacional": false,
      "departamentos": ["Usulután"],
      "municipios": ["Usulután Oeste"]
    },
    "contacto": {
      "telefono": null,
      "email": "atencion@usulutan-oeste.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925adf7"),
    "codigo": "AM-SAN-MIGUEL-NORTE",
    "nombre": "Alcaldía Municipal de San Miguel Norte",
    "tipo": "alcaldia",
    "categoriasAtendidas": ["bache", "basura", "arbol_caido", "ruido", "otro"],
    "cobertura": {
      "nacional": false,
      "departamentos": ["San Miguel"],
      "municipios": ["San Miguel Norte"]
    },
    "contacto": {
      "telefono": null,
      "email": "atencion@san-miguel-norte.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925adf8"),
    "codigo": "AM-SAN-MIGUEL-CENTRO",
    "nombre": "Alcaldía Municipal de San Miguel Centro",
    "tipo": "alcaldia",
    "categoriasAtendidas": ["bache", "basura", "arbol_caido", "ruido", "otro"],
    "cobertura": {
      "nacional": false,
      "departamentos": ["San Miguel"],
      "municipios": ["San Miguel Centro"]
    },
    "contacto": {
      "telefono": null,
      "email": "atencion@san-miguel-centro.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925adf9"),
    "codigo": "AM-SAN-MIGUEL-OESTE",
    "nombre": "Alcaldía Municipal de San Miguel Oeste",
    "tipo": "alcaldia",
    "categoriasAtendidas": ["bache", "basura", "arbol_caido", "ruido", "otro"],
    "cobertura": {
      "nacional": false,
      "departamentos": ["San Miguel"],
      "municipios": ["San Miguel Oeste"]
    },
    "contacto": {
      "telefono": null,
      "email": "atencion@san-miguel-oeste.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925adfa"),
    "codigo": "AM-MORAZAN-NORTE",
    "nombre": "Alcaldía Municipal de Morazán Norte",
    "tipo": "alcaldia",
    "categoriasAtendidas": ["bache", "basura", "arbol_caido", "ruido", "otro"],
    "cobertura": {
      "nacional": false,
      "departamentos": ["Morazán"],
      "municipios": ["Morazán Norte"]
    },
    "contacto": {
      "telefono": null,
      "email": "atencion@morazan-norte.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925adfb"),
    "codigo": "AM-MORAZAN-SUR",
    "nombre": "Alcaldía Municipal de Morazán Sur",
    "tipo": "alcaldia",
    "categoriasAtendidas": ["bache", "basura", "arbol_caido", "ruido", "otro"],
    "cobertura": {
      "nacional": false,
      "departamentos": ["Morazán"],
      "municipios": ["Morazán Sur"]
    },
    "contacto": {
      "telefono": null,
      "email": "atencion@morazan-sur.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925adfc"),
    "codigo": "AM-LA-UNION-NORTE",
    "nombre": "Alcaldía Municipal de La Unión Norte",
    "tipo": "alcaldia",
    "categoriasAtendidas": ["bache", "basura", "arbol_caido", "ruido", "otro"],
    "cobertura": {
      "nacional": false,
      "departamentos": ["La Unión"],
      "municipios": ["La Unión Norte"]
    },
    "contacto": {
      "telefono": null,
      "email": "atencion@la-union-norte.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925adfd"),
    "codigo": "AM-LA-UNION-SUR",
    "nombre": "Alcaldía Municipal de La Unión Sur",
    "tipo": "alcaldia",
    "categoriasAtendidas": ["bache", "basura", "arbol_caido", "ruido", "otro"],
    "cobertura": {
      "nacional": false,
      "departamentos": ["La Unión"],
      "municipios": ["La Unión Sur"]
    },
    "contacto": {
      "telefono": null,
      "email": "atencion@la-union-sur.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925adfe"),
    "codigo": "ANDA",
    "nombre": "Administración Nacional de Acueductos y Alcantarillados",
    "tipo": "autonoma",
    "categoriasAtendidas": ["agua_potable", "alcantarillado"],
    "cobertura": {
      "nacional": true,
      "departamentos": [],
      "municipios": []
    },
    "contacto": {
      "telefono": null,
      "email": "reportes@anda.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925adff"),
    "codigo": "MOP",
    "nombre": "Ministerio de Obras Públicas y de Transporte",
    "tipo": "ministerio",
    "categoriasAtendidas": ["bache"],
    "cobertura": {
      "nacional": true,
      "departamentos": [],
      "municipios": []
    },
    "contacto": {
      "telefono": null,
      "email": "reportes@mop.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ae00"),
    "codigo": "FOVIAL",
    "nombre": "Fondo de Conservación Vial",
    "tipo": "autonoma",
    "categoriasAtendidas": ["bache"],
    "cobertura": {
      "nacional": true,
      "departamentos": [],
      "municipios": []
    },
    "contacto": {
      "telefono": null,
      "email": "reportes@fovial.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ae01"),
    "codigo": "VMT",
    "nombre": "Viceministerio de Transporte",
    "tipo": "ministerio",
    "categoriasAtendidas": ["semaforo", "seguridad_vial"],
    "cobertura": {
      "nacional": true,
      "departamentos": [],
      "municipios": []
    },
    "contacto": {
      "telefono": null,
      "email": "reportes@vmt.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ae02"),
    "codigo": "PNC-TRANSITO",
    "nombre": "PNC - División de Tránsito Terrestre",
    "tipo": "ministerio",
    "categoriasAtendidas": ["seguridad_vial", "ruido"],
    "cobertura": {
      "nacional": true,
      "departamentos": [],
      "municipios": []
    },
    "contacto": {
      "telefono": null,
      "email": "reportes@pnc-transito.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ae03"),
    "codigo": "MARN",
    "nombre": "Ministerio de Medio Ambiente y Recursos Naturales",
    "tipo": "ministerio",
    "categoriasAtendidas": ["basura", "ruido"],
    "cobertura": {
      "nacional": true,
      "departamentos": [],
      "municipios": []
    },
    "contacto": {
      "telefono": null,
      "email": "reportes@marn.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ae04"),
    "codigo": "BOMBEROS",
    "nombre": "Cuerpo de Bomberos de El Salvador",
    "tipo": "emergencias",
    "categoriasAtendidas": ["arbol_caido"],
    "cobertura": {
      "nacional": true,
      "departamentos": [],
      "municipios": []
    },
    "contacto": {
      "telefono": null,
      "email": "reportes@bomberos.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ae05"),
    "codigo": "PROTECCION-CIVIL",
    "nombre": "Dirección General de Protección Civil",
    "tipo": "emergencias",
    "categoriasAtendidas": ["arbol_caido", "otro"],
    "cobertura": {
      "nacional": true,
      "departamentos": [],
      "municipios": []
    },
    "contacto": {
      "telefono": null,
      "email": "reportes@proteccion-civil.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ae06"),
    "codigo": "CAESS",
    "nombre": "CAESS - Distribuidora eléctrica",
    "tipo": "distribuidora",
    "categoriasAtendidas": ["alumbrado"],
    "cobertura": {
      "nacional": false,
      "departamentos": ["San Salvador", "Chalatenango", "Cuscatlán", "Cabañas"],
      "municipios": []
    },
    "contacto": {
      "telefono": null,
      "email": "reportes@caess.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ae07"),
    "codigo": "DELSUR",
    "nombre": "DELSUR - Distribuidora eléctrica",
    "tipo": "distribuidora",
    "categoriasAtendidas": ["alumbrado"],
    "cobertura": {
      "nacional": false,
      "departamentos": ["La Libertad", "La Paz", "San Vicente"],
      "municipios": []
    },
    "contacto": {
      "telefono": null,
      "email": "reportes@delsur.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ae08"),
    "codigo": "AES-CLESA",
    "nombre": "AES CLESA - Distribuidora eléctrica",
    "tipo": "distribuidora",
    "categoriasAtendidas": ["alumbrado"],
    "cobertura": {
      "nacional": false,
      "departamentos": ["Santa Ana", "Ahuachapán", "Sonsonate"],
      "municipios": []
    },
    "contacto": {
      "telefono": null,
      "email": "reportes@aes-clesa.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ae09"),
    "codigo": "EEO",
    "nombre": "EEO - Empresa Eléctrica de Oriente",
    "tipo": "distribuidora",
    "categoriasAtendidas": ["alumbrado"],
    "cobertura": {
      "nacional": false,
      "departamentos": ["San Miguel", "Morazán", "La Unión"],
      "municipios": []
    },
    "contacto": {
      "telefono": null,
      "email": "reportes@eeo.gob.sv"
    },
    "activa": true
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ae0a"),
    "codigo": "DEUSEM",
    "nombre": "DEUSEM - Distribuidora eléctrica",
    "tipo": "distribuidora",
    "categoriasAtendidas": ["alumbrado"],
    "cobertura": {
      "nacional": false,
      "departamentos": ["Usulután"],
      "municipios": []
    },
    "contacto": {
      "telefono": null,
      "email": "reportes@deusem.gob.sv"
    },
    "activa": true
  }
]);

// ---------- ciudadanos (15) ----------
db.ciudadanos.insertMany([
  {
    "_id": ObjectId("6ae6ba73af7333f46925ae0b"),
    "dui": "86865468-1",
    "nombre": "Ana Mejía Menjívar",
    "email": "ciudadano1@correo.sv",
    "telefono": "7328-7891",
    "direccion": {
      "departamento": "Cabañas",
      "municipio": "Cabañas Oeste",
      "colonia": "Colonia Las Margaritas"
    },
    "fechaRegistro": ISODate("2025-05-28T04:05:07.529Z"),
    "estadisticas": {
      "totalReportes": 3,
      "ultimoReporte": ISODate("2026-09-30T00:05:07.529Z")
    }
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ae0c"),
    "dui": "13160265-7",
    "nombre": "José López García",
    "email": "ciudadano2@correo.sv",
    "telefono": "7111-9032",
    "direccion": {
      "departamento": "La Libertad",
      "municipio": "La Libertad Sur",
      "colonia": "Reparto Santa Fe"
    },
    "fechaRegistro": ISODate("2025-06-12T04:05:07.529Z"),
    "estadisticas": {
      "totalReportes": 0,
      "ultimoReporte": null
    }
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ae0d"),
    "dui": "50512102-8",
    "nombre": "Francisco Cruz Portillo",
    "email": "ciudadano3@correo.sv",
    "telefono": "7753-2250",
    "direccion": {
      "departamento": "San Salvador",
      "municipio": "San Salvador Este",
      "colonia": "Residencial Los Héroes"
    },
    "fechaRegistro": ISODate("2024-12-16T04:05:07.529Z"),
    "estadisticas": {
      "totalReportes": 0,
      "ultimoReporte": null
    }
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ae0e"),
    "dui": "18909714-9",
    "nombre": "Andrea Rivera Rivera",
    "email": "ciudadano4@correo.sv",
    "telefono": "7416-1405",
    "direccion": {
      "departamento": "La Paz",
      "municipio": "La Paz Este",
      "colonia": "Reparto Santa Fe"
    },
    "fechaRegistro": ISODate("2025-03-25T04:05:07.529Z"),
    "estadisticas": {
      "totalReportes": 2,
      "ultimoReporte": ISODate("2026-08-07T15:05:07.529Z")
    }
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ae0f"),
    "dui": "78613714-8",
    "nombre": "Roberto Guardado López",
    "email": "ciudadano5@correo.sv",
    "telefono": "7610-2907",
    "direccion": {
      "departamento": "Cuscatlán",
      "municipio": "Cuscatlán Sur",
      "colonia": "Colonia Las Margaritas"
    },
    "fechaRegistro": ISODate("2025-03-08T04:05:07.529Z"),
    "estadisticas": {
      "totalReportes": 4,
      "ultimoReporte": ISODate("2026-10-03T15:05:07.529Z")
    }
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ae10"),
    "dui": "64315788-8",
    "nombre": "Óscar Cruz Guardado",
    "email": "ciudadano6@correo.sv",
    "telefono": "7630-1415",
    "direccion": {
      "departamento": "San Vicente",
      "municipio": "San Vicente Norte",
      "colonia": "Barrio El Centro"
    },
    "fechaRegistro": ISODate("2024-08-05T04:05:07.529Z"),
    "estadisticas": {
      "totalReportes": 0,
      "ultimoReporte": null
    }
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ae11"),
    "dui": "83524993-6",
    "nombre": "María Menjívar García",
    "email": "ciudadano7@correo.sv",
    "telefono": "7581-3333",
    "direccion": {
      "departamento": "San Miguel",
      "municipio": "San Miguel Centro",
      "colonia": "Colonia Miramonte"
    },
    "fechaRegistro": ISODate("2024-07-19T04:05:07.529Z"),
    "estadisticas": {
      "totalReportes": 2,
      "ultimoReporte": ISODate("2026-10-26T05:05:07.529Z")
    }
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ae12"),
    "dui": "73233523-4",
    "nombre": "Ana Romero Aguilar",
    "email": "ciudadano8@correo.sv",
    "telefono": "7673-7587",
    "direccion": {
      "departamento": "San Miguel",
      "municipio": "San Miguel Oeste",
      "colonia": "Urbanización La Cima"
    },
    "fechaRegistro": ISODate("2024-12-21T04:05:07.529Z"),
    "estadisticas": {
      "totalReportes": 1,
      "ultimoReporte": ISODate("2026-05-17T14:05:07.529Z")
    }
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ae13"),
    "dui": "27183296-4",
    "nombre": "Óscar Aguilar Alvarado",
    "email": "ciudadano9@correo.sv",
    "telefono": "7951-5407",
    "direccion": {
      "departamento": "Cuscatlán",
      "municipio": "Cuscatlán Norte",
      "colonia": "Colonia Escalón"
    },
    "fechaRegistro": ISODate("2025-07-13T04:05:07.529Z"),
    "estadisticas": {
      "totalReportes": 0,
      "ultimoReporte": null
    }
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ae14"),
    "dui": "48309773-3",
    "nombre": "Fátima Romero Menjívar",
    "email": "ciudadano10@correo.sv",
    "telefono": "7366-8955",
    "direccion": {
      "departamento": "La Paz",
      "municipio": "La Paz Centro",
      "colonia": "Colonia Las Margaritas"
    },
    "fechaRegistro": ISODate("2024-08-10T04:05:07.529Z"),
    "estadisticas": {
      "totalReportes": 1,
      "ultimoReporte": ISODate("2026-10-04T15:05:07.529Z")
    }
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ae15"),
    "dui": "38932423-5",
    "nombre": "Daniela Orellana Martínez",
    "email": "ciudadano11@correo.sv",
    "telefono": "7568-2611",
    "direccion": {
      "departamento": "La Unión",
      "municipio": "La Unión Sur",
      "colonia": "Urbanización La Cima"
    },
    "fechaRegistro": ISODate("2025-02-08T04:05:07.529Z"),
    "estadisticas": {
      "totalReportes": 3,
      "ultimoReporte": ISODate("2026-04-13T12:05:07.529Z")
    }
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ae16"),
    "dui": "87046671-4",
    "nombre": "Rosa Guardado Aguilar",
    "email": "ciudadano12@correo.sv",
    "telefono": "7610-7064",
    "direccion": {
      "departamento": "Santa Ana",
      "municipio": "Santa Ana Norte",
      "colonia": "Colonia Miramonte"
    },
    "fechaRegistro": ISODate("2024-09-10T04:05:07.529Z"),
    "estadisticas": {
      "totalReportes": 2,
      "ultimoReporte": ISODate("2026-09-13T04:05:07.529Z")
    }
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ae17"),
    "dui": "12370664-0",
    "nombre": "Daniela Rodríguez Romero",
    "email": "ciudadano13@correo.sv",
    "telefono": "7562-9955",
    "direccion": {
      "departamento": "Ahuachapán",
      "municipio": "Ahuachapán Norte",
      "colonia": "Colonia Miramonte"
    },
    "fechaRegistro": ISODate("2025-05-24T04:05:07.529Z"),
    "estadisticas": {
      "totalReportes": 1,
      "ultimoReporte": ISODate("2026-09-07T23:05:07.529Z")
    }
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ae18"),
    "dui": "89721481-5",
    "nombre": "Ana Martínez Orellana",
    "email": "ciudadano14@correo.sv",
    "telefono": "7258-1084",
    "direccion": {
      "departamento": "La Libertad",
      "municipio": "La Libertad Oeste",
      "colonia": "Colonia Las Margaritas"
    },
    "fechaRegistro": ISODate("2024-10-09T04:05:07.529Z"),
    "estadisticas": {
      "totalReportes": 0,
      "ultimoReporte": null
    }
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ae19"),
    "dui": "78911235-2",
    "nombre": "Luis Orellana Flores",
    "email": "ciudadano15@correo.sv",
    "telefono": "7712-9269",
    "direccion": {
      "departamento": "La Paz",
      "municipio": "La Paz Centro",
      "colonia": "Residencial Los Héroes"
    },
    "fechaRegistro": ISODate("2025-02-26T04:05:07.529Z"),
    "estadisticas": {
      "totalReportes": 1,
      "ultimoReporte": ISODate("2026-09-20T15:05:07.529Z")
    }
  }
]);

// ---------- reportes (20) ----------
db.reportes.insertMany([
  {
    "_id": ObjectId("6ae6ba73af7333f46925ae1a"),
    "folio": "RC-2025-000001",
    "titulo": "Acumulación de basura en esquina",
    "descripcion": "Se acumula basura desde hace varios días, hay malos olores y zancudos.",
    "categoria": "basura",
    "prioridad": "critica",
    "nivelPrioridad": 4,
    "estado": "resuelto",
    "ubicacion": {
      "latitud": 13.328935,
      "longitud": -87.882657
    },
    "direccion": {
      "departamento": "La Unión",
      "municipio": "La Unión Sur",
      "referencia": null
    },
    "ciudadanoId": ObjectId("6ae6ba73af7333f46925ae15"),
    "institucion": {
      "_id": ObjectId("6ae6ba73af7333f46925adfd"),
      "codigo": "AM-LA-UNION-SUR",
      "nombre": "Alcaldía Municipal de La Unión Sur"
    },
    "historial": [
      {
        "estado": "recibido",
        "fecha": ISODate("2025-12-15T19:05:07.529Z"),
        "actor": "Daniela Orellana Martínez",
        "comentario": null
      },
      {
        "estado": "en_revision",
        "fecha": ISODate("2025-12-17T07:05:07.529Z"),
        "actor": "Centro de atención",
        "comentario": null
      },
      {
        "estado": "asignado",
        "fecha": ISODate("2025-12-18T13:05:07.529Z"),
        "actor": "Alcaldía Municipal de La Unión Sur",
        "comentario": null
      },
      {
        "estado": "en_proceso",
        "fecha": ISODate("2025-12-19T17:05:07.529Z"),
        "actor": "Alcaldía Municipal de La Unión Sur",
        "comentario": null
      },
      {
        "estado": "resuelto",
        "fecha": ISODate("2025-12-20T06:05:07.529Z"),
        "actor": "Alcaldía Municipal de La Unión Sur",
        "comentario": null
      }
    ],
    "evidencias": [
      {
        "url": "https://fotos.reporteciudadano.sv/RC-2025-000001-0.jpg",
        "tipo": "foto",
        "fechaSubida": ISODate("2025-12-15T19:05:07.529Z")
      },
      {
        "url": "https://fotos.reporteciudadano.sv/RC-2025-000001-1.jpg",
        "tipo": "foto",
        "fechaSubida": ISODate("2025-12-15T19:05:07.529Z")
      }
    ],
    "apoyos": [ObjectId("6ae6ba73af7333f46925ae18"), ObjectId("6ae6ba73af7333f46925ae0e"), ObjectId("6ae6ba73af7333f46925ae11"), ObjectId("6ae6ba73af7333f46925ae0b")],
    "totalApoyos": 4,
    "etiquetas": ["salud", "zancudos"],
    "fechaCreacion": ISODate("2025-12-15T19:05:07.529Z"),
    "fechaActualizacion": ISODate("2025-12-20T06:05:07.529Z"),
    "fechaResolucion": ISODate("2025-12-20T06:05:07.529Z"),
    "calificacion": {
      "puntaje": 4,
      "comentario": null,
      "fecha": ISODate("2025-12-20T06:05:07.529Z")
    }
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ae1b"),
    "folio": "RC-2026-000002",
    "titulo": "Falta señalización de paso peatonal",
    "descripcion": "No hay señalización y los vehículos pasan rápido donde cruzan niños.",
    "categoria": "seguridad_vial",
    "prioridad": "media",
    "nivelPrioridad": 2,
    "estado": "en_revision",
    "ubicacion": {
      "latitud": 13.713361,
      "longitud": -88.946358
    },
    "direccion": {
      "departamento": "Cuscatlán",
      "municipio": "Cuscatlán Sur",
      "referencia": null
    },
    "ciudadanoId": ObjectId("6ae6ba73af7333f46925ae0f"),
    "institucion": {
      "_id": ObjectId("6ae6ba73af7333f46925ae01"),
      "codigo": "VMT",
      "nombre": "Viceministerio de Transporte"
    },
    "historial": [
      {
        "estado": "recibido",
        "fecha": ISODate("2026-09-20T10:05:07.529Z"),
        "actor": "Roberto Guardado López",
        "comentario": null
      },
      {
        "estado": "en_revision",
        "fecha": ISODate("2026-09-21T21:05:07.529Z"),
        "actor": "Centro de atención",
        "comentario": null
      }
    ],
    "evidencias": [
      {
        "url": "https://fotos.reporteciudadano.sv/RC-2026-000002-0.jpg",
        "tipo": "foto",
        "fechaSubida": ISODate("2026-09-20T10:05:07.529Z")
      }
    ],
    "apoyos": [ObjectId("6ae6ba73af7333f46925ae15")],
    "totalApoyos": 1,
    "etiquetas": ["escuela"],
    "fechaCreacion": ISODate("2026-09-20T10:05:07.529Z"),
    "fechaActualizacion": ISODate("2026-09-21T21:05:07.529Z"),
    "fechaResolucion": null
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ae1c"),
    "folio": "RC-2026-000003",
    "titulo": "Fuga de agua potable",
    "descripcion": "Hay una fuga de agua potable que se desperdicia mientras varias casas no tienen servicio.",
    "categoria": "agua_potable",
    "prioridad": "media",
    "nivelPrioridad": 2,
    "estado": "en_revision",
    "ubicacion": {
      "latitud": 13.858384,
      "longitud": -88.722137
    },
    "direccion": {
      "departamento": "Cabañas",
      "municipio": "Cabañas Oeste",
      "referencia": null
    },
    "ciudadanoId": ObjectId("6ae6ba73af7333f46925ae0b"),
    "institucion": {
      "_id": ObjectId("6ae6ba73af7333f46925adfe"),
      "codigo": "ANDA",
      "nombre": "Administración Nacional de Acueductos y Alcantarillados"
    },
    "historial": [
      {
        "estado": "recibido",
        "fecha": ISODate("2026-09-08T11:05:07.529Z"),
        "actor": "Ana Mejía Menjívar",
        "comentario": null
      },
      {
        "estado": "en_revision",
        "fecha": ISODate("2026-09-09T01:05:07.529Z"),
        "actor": "Centro de atención",
        "comentario": null
      }
    ],
    "evidencias": [],
    "apoyos": [ObjectId("6ae6ba73af7333f46925ae19"), ObjectId("6ae6ba73af7333f46925ae18"), ObjectId("6ae6ba73af7333f46925ae16")],
    "totalApoyos": 3,
    "etiquetas": ["fuga"],
    "fechaCreacion": ISODate("2026-09-08T11:05:07.529Z"),
    "fechaActualizacion": ISODate("2026-09-09T01:05:07.529Z"),
    "fechaResolucion": null
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ae1d"),
    "folio": "RC-2026-000004",
    "titulo": "Música a alto volumen todas las noches",
    "descripcion": "Ruido excesivo después de las 10 p.m., los vecinos no pueden descansar.",
    "categoria": "ruido",
    "prioridad": "alta",
    "nivelPrioridad": 3,
    "estado": "en_revision",
    "ubicacion": {
      "latitud": 13.956805,
      "longitud": -89.861681
    },
    "direccion": {
      "departamento": "Ahuachapán",
      "municipio": "Ahuachapán Norte",
      "referencia": null
    },
    "ciudadanoId": ObjectId("6ae6ba73af7333f46925ae17"),
    "institucion": {
      "_id": ObjectId("6ae6ba73af7333f46925add2"),
      "codigo": "AM-AHUACHAPAN-NORTE",
      "nombre": "Alcaldía Municipal de Ahuachapán Norte"
    },
    "historial": [
      {
        "estado": "recibido",
        "fecha": ISODate("2026-09-07T23:05:07.529Z"),
        "actor": "Daniela Rodríguez Romero",
        "comentario": null
      },
      {
        "estado": "en_revision",
        "fecha": ISODate("2026-09-09T03:05:07.529Z"),
        "actor": "Centro de atención",
        "comentario": null
      }
    ],
    "evidencias": [
      {
        "url": "https://fotos.reporteciudadano.sv/RC-2026-000004-0.jpg",
        "tipo": "foto",
        "fechaSubida": ISODate("2026-09-07T23:05:07.529Z")
      }
    ],
    "apoyos": [ObjectId("6ae6ba73af7333f46925ae11"), ObjectId("6ae6ba73af7333f46925ae13")],
    "totalApoyos": 2,
    "etiquetas": ["noche", "convivencia"],
    "fechaCreacion": ISODate("2026-09-07T23:05:07.529Z"),
    "fechaActualizacion": ISODate("2026-09-09T03:05:07.529Z"),
    "fechaResolucion": null
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ae1e"),
    "folio": "RC-2026-000005",
    "titulo": "Túmulo sin pintar",
    "descripcion": "No hay señalización y los vehículos pasan rápido donde cruzan niños.",
    "categoria": "seguridad_vial",
    "prioridad": "critica",
    "nivelPrioridad": 4,
    "estado": "resuelto",
    "ubicacion": {
      "latitud": 13.511615,
      "longitud": -88.145213
    },
    "direccion": {
      "departamento": "San Miguel",
      "municipio": "San Miguel Oeste",
      "referencia": null
    },
    "ciudadanoId": ObjectId("6ae6ba73af7333f46925ae12"),
    "institucion": {
      "_id": ObjectId("6ae6ba73af7333f46925ae01"),
      "codigo": "VMT",
      "nombre": "Viceministerio de Transporte"
    },
    "historial": [
      {
        "estado": "recibido",
        "fecha": ISODate("2026-05-17T14:05:07.529Z"),
        "actor": "Ana Romero Aguilar",
        "comentario": null
      },
      {
        "estado": "en_revision",
        "fecha": ISODate("2026-05-19T03:35:07.529Z"),
        "actor": "Centro de atención",
        "comentario": null
      },
      {
        "estado": "asignado",
        "fecha": ISODate("2026-05-21T15:35:07.529Z"),
        "actor": "Viceministerio de Transporte",
        "comentario": null
      },
      {
        "estado": "en_proceso",
        "fecha": ISODate("2026-05-25T04:35:07.529Z"),
        "actor": "Viceministerio de Transporte",
        "comentario": null
      },
      {
        "estado": "resuelto",
        "fecha": ISODate("2026-05-28T12:35:07.529Z"),
        "actor": "Viceministerio de Transporte",
        "comentario": null
      }
    ],
    "evidencias": [
      {
        "url": "https://fotos.reporteciudadano.sv/RC-2026-000005-0.jpg",
        "tipo": "foto",
        "fechaSubida": ISODate("2026-05-17T14:05:07.529Z")
      }
    ],
    "apoyos": [],
    "totalApoyos": 0,
    "etiquetas": ["peatones"],
    "fechaCreacion": ISODate("2026-05-17T14:05:07.529Z"),
    "fechaActualizacion": ISODate("2026-05-28T12:35:07.529Z"),
    "fechaResolucion": ISODate("2026-05-28T12:35:07.529Z")
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ae1f"),
    "folio": "RC-2025-000006",
    "titulo": "Árbol caído obstruye la vía",
    "descripcion": "Después de la tormenta un árbol bloquea el paso de vehículos y peatones.",
    "categoria": "arbol_caido",
    "prioridad": "media",
    "nivelPrioridad": 2,
    "estado": "resuelto",
    "ubicacion": {
      "latitud": 13.352078,
      "longitud": -87.861953
    },
    "direccion": {
      "departamento": "La Unión",
      "municipio": "La Unión Sur",
      "referencia": null
    },
    "ciudadanoId": ObjectId("6ae6ba73af7333f46925ae15"),
    "institucion": {
      "_id": ObjectId("6ae6ba73af7333f46925adfd"),
      "codigo": "AM-LA-UNION-SUR",
      "nombre": "Alcaldía Municipal de La Unión Sur"
    },
    "historial": [
      {
        "estado": "recibido",
        "fecha": ISODate("2025-11-02T23:05:07.529Z"),
        "actor": "Daniela Orellana Martínez",
        "comentario": null
      },
      {
        "estado": "en_revision",
        "fecha": ISODate("2025-11-03T04:05:07.529Z"),
        "actor": "Centro de atención",
        "comentario": null
      },
      {
        "estado": "asignado",
        "fecha": ISODate("2025-11-04T06:05:07.529Z"),
        "actor": "Alcaldía Municipal de La Unión Sur",
        "comentario": null
      },
      {
        "estado": "en_proceso",
        "fecha": ISODate("2025-11-04T20:05:07.529Z"),
        "actor": "Alcaldía Municipal de La Unión Sur",
        "comentario": null
      },
      {
        "estado": "resuelto",
        "fecha": ISODate("2025-11-05T22:05:07.529Z"),
        "actor": "Alcaldía Municipal de La Unión Sur",
        "comentario": null
      }
    ],
    "evidencias": [
      {
        "url": "https://fotos.reporteciudadano.sv/RC-2025-000006-0.jpg",
        "tipo": "foto",
        "fechaSubida": ISODate("2025-11-02T23:05:07.529Z")
      }
    ],
    "apoyos": [ObjectId("6ae6ba73af7333f46925ae16"), ObjectId("6ae6ba73af7333f46925ae14"), ObjectId("6ae6ba73af7333f46925ae13"), ObjectId("6ae6ba73af7333f46925ae0e")],
    "totalApoyos": 4,
    "etiquetas": ["peligro", "tormenta"],
    "fechaCreacion": ISODate("2025-11-02T23:05:07.529Z"),
    "fechaActualizacion": ISODate("2025-11-05T22:05:07.529Z"),
    "fechaResolucion": ISODate("2025-11-05T22:05:07.529Z"),
    "calificacion": {
      "puntaje": 3,
      "comentario": null,
      "fecha": ISODate("2025-11-05T22:05:07.529Z")
    }
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ae20"),
    "folio": "RC-2026-000007",
    "titulo": "El camión recolector no pasa",
    "descripcion": "Se acumula basura desde hace varios días, hay malos olores y zancudos.",
    "categoria": "basura",
    "prioridad": "baja",
    "nivelPrioridad": 1,
    "estado": "recibido",
    "ubicacion": {
      "latitud": 13.440632,
      "longitud": -88.198645
    },
    "direccion": {
      "departamento": "San Miguel",
      "municipio": "San Miguel Centro",
      "referencia": null
    },
    "ciudadanoId": ObjectId("6ae6ba73af7333f46925ae11"),
    "institucion": {
      "_id": ObjectId("6ae6ba73af7333f46925adf8"),
      "codigo": "AM-SAN-MIGUEL-CENTRO",
      "nombre": "Alcaldía Municipal de San Miguel Centro"
    },
    "historial": [
      {
        "estado": "recibido",
        "fecha": ISODate("2026-10-26T05:05:07.529Z"),
        "actor": "María Menjívar García",
        "comentario": null
      }
    ],
    "evidencias": [],
    "apoyos": [ObjectId("6ae6ba73af7333f46925ae16")],
    "totalApoyos": 1,
    "etiquetas": ["zancudos", "salud"],
    "fechaCreacion": ISODate("2026-10-26T05:05:07.529Z"),
    "fechaActualizacion": ISODate("2026-10-26T05:05:07.529Z"),
    "fechaResolucion": null
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ae21"),
    "folio": "RC-2026-000008",
    "titulo": "Aguas negras en la calle",
    "descripcion": "Las aguas negras corren por la calle y cuando llueve se inunda el pasaje.",
    "categoria": "alcantarillado",
    "prioridad": "baja",
    "nivelPrioridad": 1,
    "estado": "en_proceso",
    "ubicacion": {
      "latitud": 13.682302,
      "longitud": -88.911417
    },
    "direccion": {
      "departamento": "Cuscatlán",
      "municipio": "Cuscatlán Sur",
      "referencia": null
    },
    "ciudadanoId": ObjectId("6ae6ba73af7333f46925ae0f"),
    "institucion": {
      "_id": ObjectId("6ae6ba73af7333f46925adfe"),
      "codigo": "ANDA",
      "nombre": "Administración Nacional de Acueductos y Alcantarillados"
    },
    "historial": [
      {
        "estado": "recibido",
        "fecha": ISODate("2026-10-03T15:05:07.529Z"),
        "actor": "Roberto Guardado López",
        "comentario": null
      },
      {
        "estado": "en_revision",
        "fecha": ISODate("2026-10-03T23:05:07.529Z"),
        "actor": "Centro de atención",
        "comentario": null
      },
      {
        "estado": "asignado",
        "fecha": ISODate("2026-10-04T13:05:07.529Z"),
        "actor": "Administración Nacional de Acueductos y Alcantarillados",
        "comentario": null
      },
      {
        "estado": "en_proceso",
        "fecha": ISODate("2026-10-05T09:05:07.529Z"),
        "actor": "Administración Nacional de Acueductos y Alcantarillados",
        "comentario": null
      }
    ],
    "evidencias": [
      {
        "url": "https://fotos.reporteciudadano.sv/RC-2026-000008-0.jpg",
        "tipo": "foto",
        "fechaSubida": ISODate("2026-10-03T15:05:07.529Z")
      },
      {
        "url": "https://fotos.reporteciudadano.sv/RC-2026-000008-1.jpg",
        "tipo": "foto",
        "fechaSubida": ISODate("2026-10-03T15:05:07.529Z")
      }
    ],
    "apoyos": [ObjectId("6ae6ba73af7333f46925ae0b")],
    "totalApoyos": 1,
    "etiquetas": ["salud", "inundacion"],
    "fechaCreacion": ISODate("2026-10-03T15:05:07.529Z"),
    "fechaActualizacion": ISODate("2026-10-05T09:05:07.529Z"),
    "fechaResolucion": null
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ae22"),
    "folio": "RC-2026-000009",
    "titulo": "Semáforo intermitente en hora pico",
    "descripcion": "El semáforo no funciona y en hora pico se forman congestionamientos.",
    "categoria": "semaforo",
    "prioridad": "media",
    "nivelPrioridad": 2,
    "estado": "asignado",
    "ubicacion": {
      "latitud": 13.455763,
      "longitud": -88.928483
    },
    "direccion": {
      "departamento": "La Paz",
      "municipio": "La Paz Centro",
      "referencia": null
    },
    "ciudadanoId": ObjectId("6ae6ba73af7333f46925ae19"),
    "institucion": {
      "_id": ObjectId("6ae6ba73af7333f46925ae01"),
      "codigo": "VMT",
      "nombre": "Viceministerio de Transporte"
    },
    "historial": [
      {
        "estado": "recibido",
        "fecha": ISODate("2026-09-20T15:05:07.529Z"),
        "actor": "Luis Orellana Flores",
        "comentario": null
      },
      {
        "estado": "en_revision",
        "fecha": ISODate("2026-09-21T18:35:07.529Z"),
        "actor": "Centro de atención",
        "comentario": null
      },
      {
        "estado": "asignado",
        "fecha": ISODate("2026-09-24T14:05:07.529Z"),
        "actor": "Viceministerio de Transporte",
        "comentario": null
      }
    ],
    "evidencias": [],
    "apoyos": [ObjectId("6ae6ba73af7333f46925ae15"), ObjectId("6ae6ba73af7333f46925ae0f"), ObjectId("6ae6ba73af7333f46925ae11"), ObjectId("6ae6ba73af7333f46925ae17")],
    "totalApoyos": 4,
    "etiquetas": ["peligro", "trafico"],
    "fechaCreacion": ISODate("2026-09-20T15:05:07.529Z"),
    "fechaActualizacion": ISODate("2026-09-24T14:05:07.529Z"),
    "fechaResolucion": null
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ae23"),
    "folio": "RC-2026-000010",
    "titulo": "Lámpara apagada en pasaje",
    "descripcion": "La calle queda completamente oscura por la noche y es peligroso caminar.",
    "categoria": "alumbrado",
    "prioridad": "media",
    "nivelPrioridad": 2,
    "estado": "en_proceso",
    "ubicacion": {
      "latitud": 13.952568,
      "longitud": -89.574596
    },
    "direccion": {
      "departamento": "Santa Ana",
      "municipio": "Santa Ana Norte",
      "referencia": null
    },
    "ciudadanoId": ObjectId("6ae6ba73af7333f46925ae16"),
    "institucion": {
      "_id": ObjectId("6ae6ba73af7333f46925ae08"),
      "codigo": "AES-CLESA",
      "nombre": "AES CLESA - Distribuidora eléctrica"
    },
    "historial": [
      {
        "estado": "recibido",
        "fecha": ISODate("2026-09-13T04:05:07.529Z"),
        "actor": "Rosa Guardado Aguilar",
        "comentario": null
      },
      {
        "estado": "en_revision",
        "fecha": ISODate("2026-09-14T05:05:07.529Z"),
        "actor": "Centro de atención",
        "comentario": null
      },
      {
        "estado": "asignado",
        "fecha": ISODate("2026-09-14T21:05:07.529Z"),
        "actor": "AES CLESA - Distribuidora eléctrica",
        "comentario": null
      },
      {
        "estado": "en_proceso",
        "fecha": ISODate("2026-09-15T04:05:07.529Z"),
        "actor": "AES CLESA - Distribuidora eléctrica",
        "comentario": null
      }
    ],
    "evidencias": [
      {
        "url": "https://fotos.reporteciudadano.sv/RC-2026-000010-0.jpg",
        "tipo": "foto",
        "fechaSubida": ISODate("2026-09-13T04:05:07.529Z")
      },
      {
        "url": "https://fotos.reporteciudadano.sv/RC-2026-000010-1.jpg",
        "tipo": "foto",
        "fechaSubida": ISODate("2026-09-13T04:05:07.529Z")
      }
    ],
    "apoyos": [ObjectId("6ae6ba73af7333f46925ae0c"), ObjectId("6ae6ba73af7333f46925ae0d"), ObjectId("6ae6ba73af7333f46925ae14"), ObjectId("6ae6ba73af7333f46925ae19"), ObjectId("6ae6ba73af7333f46925ae15")],
    "totalApoyos": 5,
    "etiquetas": ["noche"],
    "fechaCreacion": ISODate("2026-09-13T04:05:07.529Z"),
    "fechaActualizacion": ISODate("2026-09-15T04:05:07.529Z"),
    "fechaResolucion": null
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ae24"),
    "folio": "RC-2026-000011",
    "titulo": "El camión recolector no pasa",
    "descripcion": "Se acumula basura desde hace varios días, hay malos olores y zancudos.",
    "categoria": "basura",
    "prioridad": "media",
    "nivelPrioridad": 2,
    "estado": "en_proceso",
    "ubicacion": {
      "latitud": 13.50549,
      "longitud": -88.911085
    },
    "direccion": {
      "departamento": "La Paz",
      "municipio": "La Paz Centro",
      "referencia": null
    },
    "ciudadanoId": ObjectId("6ae6ba73af7333f46925ae14"),
    "institucion": {
      "_id": ObjectId("6ae6ba73af7333f46925adee"),
      "codigo": "AM-LA-PAZ-CENTRO",
      "nombre": "Alcaldía Municipal de La Paz Centro"
    },
    "historial": [
      {
        "estado": "recibido",
        "fecha": ISODate("2026-10-04T15:05:07.529Z"),
        "actor": "Fátima Romero Menjívar",
        "comentario": null
      },
      {
        "estado": "en_revision",
        "fecha": ISODate("2026-10-05T09:05:07.529Z"),
        "actor": "Centro de atención",
        "comentario": null
      },
      {
        "estado": "asignado",
        "fecha": ISODate("2026-10-05T21:05:07.529Z"),
        "actor": "Alcaldía Municipal de La Paz Centro",
        "comentario": null
      },
      {
        "estado": "en_proceso",
        "fecha": ISODate("2026-10-06T12:05:07.529Z"),
        "actor": "Alcaldía Municipal de La Paz Centro",
        "comentario": null
      }
    ],
    "evidencias": [
      {
        "url": "https://fotos.reporteciudadano.sv/RC-2026-000011-0.jpg",
        "tipo": "foto",
        "fechaSubida": ISODate("2026-10-04T15:05:07.529Z")
      }
    ],
    "apoyos": [ObjectId("6ae6ba73af7333f46925ae0b"), ObjectId("6ae6ba73af7333f46925ae16"), ObjectId("6ae6ba73af7333f46925ae17"), ObjectId("6ae6ba73af7333f46925ae13")],
    "totalApoyos": 4,
    "etiquetas": ["salud"],
    "fechaCreacion": ISODate("2026-10-04T15:05:07.529Z"),
    "fechaActualizacion": ISODate("2026-10-06T12:05:07.529Z"),
    "fechaResolucion": null
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ae25"),
    "folio": "RC-2026-000012",
    "titulo": "Alcantarilla sin tapadera",
    "descripcion": "Las aguas negras corren por la calle y cuando llueve se inunda el pasaje.",
    "categoria": "alcantarillado",
    "prioridad": "media",
    "nivelPrioridad": 2,
    "estado": "en_proceso",
    "ubicacion": {
      "latitud": 13.84175,
      "longitud": -88.724213
    },
    "direccion": {
      "departamento": "Cabañas",
      "municipio": "Cabañas Oeste",
      "referencia": null
    },
    "ciudadanoId": ObjectId("6ae6ba73af7333f46925ae0b"),
    "institucion": {
      "_id": ObjectId("6ae6ba73af7333f46925adfe"),
      "codigo": "ANDA",
      "nombre": "Administración Nacional de Acueductos y Alcantarillados"
    },
    "historial": [
      {
        "estado": "recibido",
        "fecha": ISODate("2026-09-30T00:05:07.529Z"),
        "actor": "Ana Mejía Menjívar",
        "comentario": null
      },
      {
        "estado": "en_revision",
        "fecha": ISODate("2026-09-30T18:05:07.529Z"),
        "actor": "Centro de atención",
        "comentario": null
      },
      {
        "estado": "asignado",
        "fecha": ISODate("2026-10-02T00:05:07.529Z"),
        "actor": "Administración Nacional de Acueductos y Alcantarillados",
        "comentario": null
      },
      {
        "estado": "en_proceso",
        "fecha": ISODate("2026-10-02T12:05:07.529Z"),
        "actor": "Administración Nacional de Acueductos y Alcantarillados",
        "comentario": null
      }
    ],
    "evidencias": [],
    "apoyos": [ObjectId("6ae6ba73af7333f46925ae19"), ObjectId("6ae6ba73af7333f46925ae14"), ObjectId("6ae6ba73af7333f46925ae10"), ObjectId("6ae6ba73af7333f46925ae11"), ObjectId("6ae6ba73af7333f46925ae18")],
    "totalApoyos": 5,
    "etiquetas": ["inundacion", "salud", "lluvia"],
    "fechaCreacion": ISODate("2026-09-30T00:05:07.529Z"),
    "fechaActualizacion": ISODate("2026-10-02T12:05:07.529Z"),
    "fechaResolucion": null
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ae26"),
    "folio": "RC-2026-000013",
    "titulo": "Música a alto volumen todas las noches",
    "descripcion": "Ruido excesivo después de las 10 p.m., los vecinos no pueden descansar.",
    "categoria": "ruido",
    "prioridad": "alta",
    "nivelPrioridad": 3,
    "estado": "rechazado",
    "ubicacion": {
      "latitud": 13.485911,
      "longitud": -88.936299
    },
    "direccion": {
      "departamento": "La Paz",
      "municipio": "La Paz Este",
      "referencia": null
    },
    "ciudadanoId": ObjectId("6ae6ba73af7333f46925ae0e"),
    "institucion": {
      "_id": ObjectId("6ae6ba73af7333f46925adef"),
      "codigo": "AM-LA-PAZ-ESTE",
      "nombre": "Alcaldía Municipal de La Paz Este"
    },
    "historial": [
      {
        "estado": "recibido",
        "fecha": ISODate("2026-03-21T06:05:07.529Z"),
        "actor": "Andrea Rivera Rivera",
        "comentario": null
      },
      {
        "estado": "en_revision",
        "fecha": ISODate("2026-03-22T09:05:07.529Z"),
        "actor": "Centro de atención",
        "comentario": null
      },
      {
        "estado": "rechazado",
        "fecha": ISODate("2026-03-23T03:05:07.529Z"),
        "actor": "Centro de atención",
        "comentario": null
      }
    ],
    "evidencias": [
      {
        "url": "https://fotos.reporteciudadano.sv/RC-2026-000013-0.jpg",
        "tipo": "foto",
        "fechaSubida": ISODate("2026-03-21T06:05:07.529Z")
      },
      {
        "url": "https://fotos.reporteciudadano.sv/RC-2026-000013-1.jpg",
        "tipo": "foto",
        "fechaSubida": ISODate("2026-03-21T06:05:07.529Z")
      },
      {
        "url": "https://fotos.reporteciudadano.sv/RC-2026-000013-2.jpg",
        "tipo": "foto",
        "fechaSubida": ISODate("2026-03-21T06:05:07.529Z")
      }
    ],
    "apoyos": [ObjectId("6ae6ba73af7333f46925ae19"), ObjectId("6ae6ba73af7333f46925ae10"), ObjectId("6ae6ba73af7333f46925ae11"), ObjectId("6ae6ba73af7333f46925ae0f")],
    "totalApoyos": 4,
    "etiquetas": ["noche", "convivencia"],
    "fechaCreacion": ISODate("2026-03-21T06:05:07.529Z"),
    "fechaActualizacion": ISODate("2026-03-23T03:05:07.529Z"),
    "fechaResolucion": null
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ae27"),
    "folio": "RC-2026-000014",
    "titulo": "Semáforo intermitente en hora pico",
    "descripcion": "El semáforo no funciona y en hora pico se forman congestionamientos.",
    "categoria": "semaforo",
    "prioridad": "baja",
    "nivelPrioridad": 1,
    "estado": "resuelto",
    "ubicacion": {
      "latitud": 13.303796,
      "longitud": -87.816048
    },
    "direccion": {
      "departamento": "La Unión",
      "municipio": "La Unión Sur",
      "referencia": null
    },
    "ciudadanoId": ObjectId("6ae6ba73af7333f46925ae15"),
    "institucion": {
      "_id": ObjectId("6ae6ba73af7333f46925ae01"),
      "codigo": "VMT",
      "nombre": "Viceministerio de Transporte"
    },
    "historial": [
      {
        "estado": "recibido",
        "fecha": ISODate("2026-04-13T12:05:07.529Z"),
        "actor": "Daniela Orellana Martínez",
        "comentario": null
      },
      {
        "estado": "en_revision",
        "fecha": ISODate("2026-04-16T15:05:07.529Z"),
        "actor": "Centro de atención",
        "comentario": null
      },
      {
        "estado": "asignado",
        "fecha": ISODate("2026-04-17T06:05:07.529Z"),
        "actor": "Viceministerio de Transporte",
        "comentario": null
      },
      {
        "estado": "en_proceso",
        "fecha": ISODate("2026-04-18T19:35:07.529Z"),
        "actor": "Viceministerio de Transporte",
        "comentario": null
      },
      {
        "estado": "resuelto",
        "fecha": ISODate("2026-04-19T18:05:07.529Z"),
        "actor": "Viceministerio de Transporte",
        "comentario": null
      }
    ],
    "evidencias": [],
    "apoyos": [ObjectId("6ae6ba73af7333f46925ae10"), ObjectId("6ae6ba73af7333f46925ae13")],
    "totalApoyos": 2,
    "etiquetas": ["peligro"],
    "fechaCreacion": ISODate("2026-04-13T12:05:07.529Z"),
    "fechaActualizacion": ISODate("2026-04-19T18:05:07.529Z"),
    "fechaResolucion": ISODate("2026-04-19T18:05:07.529Z"),
    "calificacion": {
      "puntaje": 5,
      "comentario": null,
      "fecha": ISODate("2026-04-19T18:05:07.529Z")
    }
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ae28"),
    "folio": "RC-2025-000015",
    "titulo": "Música a alto volumen todas las noches",
    "descripcion": "Ruido excesivo después de las 10 p.m., los vecinos no pueden descansar.",
    "categoria": "ruido",
    "prioridad": "critica",
    "nivelPrioridad": 4,
    "estado": "resuelto",
    "ubicacion": {
      "latitud": 13.463361,
      "longitud": -88.203856
    },
    "direccion": {
      "departamento": "San Miguel",
      "municipio": "San Miguel Centro",
      "referencia": null
    },
    "ciudadanoId": ObjectId("6ae6ba73af7333f46925ae11"),
    "institucion": {
      "_id": ObjectId("6ae6ba73af7333f46925adf8"),
      "codigo": "AM-SAN-MIGUEL-CENTRO",
      "nombre": "Alcaldía Municipal de San Miguel Centro"
    },
    "historial": [
      {
        "estado": "recibido",
        "fecha": ISODate("2025-11-16T07:05:07.529Z"),
        "actor": "María Menjívar García",
        "comentario": null
      },
      {
        "estado": "en_revision",
        "fecha": ISODate("2025-11-16T21:05:07.529Z"),
        "actor": "Centro de atención",
        "comentario": null
      },
      {
        "estado": "asignado",
        "fecha": ISODate("2025-11-18T09:05:07.529Z"),
        "actor": "Alcaldía Municipal de San Miguel Centro",
        "comentario": null
      },
      {
        "estado": "en_proceso",
        "fecha": ISODate("2025-11-18T19:05:07.529Z"),
        "actor": "Alcaldía Municipal de San Miguel Centro",
        "comentario": null
      },
      {
        "estado": "resuelto",
        "fecha": ISODate("2025-11-19T04:05:07.529Z"),
        "actor": "Alcaldía Municipal de San Miguel Centro",
        "comentario": null
      }
    ],
    "evidencias": [],
    "apoyos": [ObjectId("6ae6ba73af7333f46925ae17")],
    "totalApoyos": 1,
    "etiquetas": ["noche"],
    "fechaCreacion": ISODate("2025-11-16T07:05:07.529Z"),
    "fechaActualizacion": ISODate("2025-11-19T04:05:07.529Z"),
    "fechaResolucion": ISODate("2025-11-19T04:05:07.529Z")
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ae29"),
    "folio": "RC-2026-000016",
    "titulo": "Ruido excesivo de bar nocturno",
    "descripcion": "Ruido excesivo después de las 10 p.m., los vecinos no pueden descansar.",
    "categoria": "ruido",
    "prioridad": "media",
    "nivelPrioridad": 2,
    "estado": "en_revision",
    "ubicacion": {
      "latitud": 13.742198,
      "longitud": -88.977049
    },
    "direccion": {
      "departamento": "Cuscatlán",
      "municipio": "Cuscatlán Sur",
      "referencia": null
    },
    "ciudadanoId": ObjectId("6ae6ba73af7333f46925ae0f"),
    "institucion": {
      "_id": ObjectId("6ae6ba73af7333f46925adec"),
      "codigo": "AM-CUSCATLAN-SUR",
      "nombre": "Alcaldía Municipal de Cuscatlán Sur"
    },
    "historial": [
      {
        "estado": "recibido",
        "fecha": ISODate("2026-09-25T22:05:07.529Z"),
        "actor": "Roberto Guardado López",
        "comentario": null
      },
      {
        "estado": "en_revision",
        "fecha": ISODate("2026-09-26T02:05:07.529Z"),
        "actor": "Centro de atención",
        "comentario": null
      }
    ],
    "evidencias": [
      {
        "url": "https://fotos.reporteciudadano.sv/RC-2026-000016-0.jpg",
        "tipo": "foto",
        "fechaSubida": ISODate("2026-09-25T22:05:07.529Z")
      },
      {
        "url": "https://fotos.reporteciudadano.sv/RC-2026-000016-1.jpg",
        "tipo": "foto",
        "fechaSubida": ISODate("2026-09-25T22:05:07.529Z")
      }
    ],
    "apoyos": [ObjectId("6ae6ba73af7333f46925ae16"), ObjectId("6ae6ba73af7333f46925ae13"), ObjectId("6ae6ba73af7333f46925ae12"), ObjectId("6ae6ba73af7333f46925ae11")],
    "totalApoyos": 4,
    "etiquetas": ["noche"],
    "fechaCreacion": ISODate("2026-09-25T22:05:07.529Z"),
    "fechaActualizacion": ISODate("2026-09-26T02:05:07.529Z"),
    "fechaResolucion": null
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ae2a"),
    "folio": "RC-2025-000017",
    "titulo": "Lámpara apagada en pasaje",
    "descripcion": "La calle queda completamente oscura por la noche y es peligroso caminar.",
    "categoria": "alumbrado",
    "prioridad": "media",
    "nivelPrioridad": 2,
    "estado": "resuelto",
    "ubicacion": {
      "latitud": 13.86995,
      "longitud": -88.765184
    },
    "direccion": {
      "departamento": "Cabañas",
      "municipio": "Cabañas Oeste",
      "referencia": null
    },
    "ciudadanoId": ObjectId("6ae6ba73af7333f46925ae0b"),
    "institucion": {
      "_id": ObjectId("6ae6ba73af7333f46925ae06"),
      "codigo": "CAESS",
      "nombre": "CAESS - Distribuidora eléctrica"
    },
    "historial": [
      {
        "estado": "recibido",
        "fecha": ISODate("2025-11-17T04:05:07.529Z"),
        "actor": "Ana Mejía Menjívar",
        "comentario": null
      },
      {
        "estado": "en_revision",
        "fecha": ISODate("2025-11-18T07:05:07.529Z"),
        "actor": "Centro de atención",
        "comentario": null
      },
      {
        "estado": "asignado",
        "fecha": ISODate("2025-11-18T15:05:07.529Z"),
        "actor": "CAESS - Distribuidora eléctrica",
        "comentario": null
      },
      {
        "estado": "en_proceso",
        "fecha": ISODate("2025-11-19T18:05:07.529Z"),
        "actor": "CAESS - Distribuidora eléctrica",
        "comentario": null
      },
      {
        "estado": "resuelto",
        "fecha": ISODate("2025-11-20T17:05:07.529Z"),
        "actor": "CAESS - Distribuidora eléctrica",
        "comentario": null
      }
    ],
    "evidencias": [],
    "apoyos": [ObjectId("6ae6ba73af7333f46925ae14")],
    "totalApoyos": 1,
    "etiquetas": ["noche", "seguridad"],
    "fechaCreacion": ISODate("2025-11-17T04:05:07.529Z"),
    "fechaActualizacion": ISODate("2025-11-20T17:05:07.529Z"),
    "fechaResolucion": ISODate("2025-11-20T17:05:07.529Z")
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ae2b"),
    "folio": "RC-2025-000018",
    "titulo": "Zona sin alumbrado público",
    "descripcion": "La calle queda completamente oscura por la noche y es peligroso caminar.",
    "categoria": "alumbrado",
    "prioridad": "media",
    "nivelPrioridad": 2,
    "estado": "resuelto",
    "ubicacion": {
      "latitud": 14.031769,
      "longitud": -89.575488
    },
    "direccion": {
      "departamento": "Santa Ana",
      "municipio": "Santa Ana Norte",
      "referencia": null
    },
    "ciudadanoId": ObjectId("6ae6ba73af7333f46925ae16"),
    "institucion": {
      "_id": ObjectId("6ae6ba73af7333f46925ae08"),
      "codigo": "AES-CLESA",
      "nombre": "AES CLESA - Distribuidora eléctrica"
    },
    "historial": [
      {
        "estado": "recibido",
        "fecha": ISODate("2025-11-15T01:05:07.529Z"),
        "actor": "Rosa Guardado Aguilar",
        "comentario": null
      },
      {
        "estado": "en_revision",
        "fecha": ISODate("2025-11-16T03:05:07.529Z"),
        "actor": "Centro de atención",
        "comentario": null
      },
      {
        "estado": "asignado",
        "fecha": ISODate("2025-11-17T13:05:07.529Z"),
        "actor": "AES CLESA - Distribuidora eléctrica",
        "comentario": null
      },
      {
        "estado": "en_proceso",
        "fecha": ISODate("2025-11-19T00:05:07.529Z"),
        "actor": "AES CLESA - Distribuidora eléctrica",
        "comentario": null
      },
      {
        "estado": "resuelto",
        "fecha": ISODate("2025-11-19T11:05:07.529Z"),
        "actor": "AES CLESA - Distribuidora eléctrica",
        "comentario": null
      }
    ],
    "evidencias": [],
    "apoyos": [ObjectId("6ae6ba73af7333f46925ae13"), ObjectId("6ae6ba73af7333f46925ae0e"), ObjectId("6ae6ba73af7333f46925ae10"), ObjectId("6ae6ba73af7333f46925ae15")],
    "totalApoyos": 4,
    "etiquetas": ["noche"],
    "fechaCreacion": ISODate("2025-11-15T01:05:07.529Z"),
    "fechaActualizacion": ISODate("2025-11-19T11:05:07.529Z"),
    "fechaResolucion": ISODate("2025-11-19T11:05:07.529Z")
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ae2c"),
    "folio": "RC-2026-000019",
    "titulo": "Colonia sin servicio de agua",
    "descripcion": "Hay una fuga de agua potable que se desperdicia mientras varias casas no tienen servicio.",
    "categoria": "agua_potable",
    "prioridad": "baja",
    "nivelPrioridad": 1,
    "estado": "en_proceso",
    "ubicacion": {
      "latitud": 13.692017,
      "longitud": -88.911084
    },
    "direccion": {
      "departamento": "Cuscatlán",
      "municipio": "Cuscatlán Sur",
      "referencia": null
    },
    "ciudadanoId": ObjectId("6ae6ba73af7333f46925ae0f"),
    "institucion": {
      "_id": ObjectId("6ae6ba73af7333f46925adfe"),
      "codigo": "ANDA",
      "nombre": "Administración Nacional de Acueductos y Alcantarillados"
    },
    "historial": [
      {
        "estado": "recibido",
        "fecha": ISODate("2026-09-14T18:05:07.529Z"),
        "actor": "Roberto Guardado López",
        "comentario": null
      },
      {
        "estado": "en_revision",
        "fecha": ISODate("2026-09-16T18:05:07.529Z"),
        "actor": "Centro de atención",
        "comentario": null
      },
      {
        "estado": "asignado",
        "fecha": ISODate("2026-09-19T16:05:07.529Z"),
        "actor": "Administración Nacional de Acueductos y Alcantarillados",
        "comentario": null
      },
      {
        "estado": "en_proceso",
        "fecha": ISODate("2026-09-22T02:05:07.529Z"),
        "actor": "Administración Nacional de Acueductos y Alcantarillados",
        "comentario": null
      }
    ],
    "evidencias": [
      {
        "url": "https://fotos.reporteciudadano.sv/RC-2026-000019-0.jpg",
        "tipo": "foto",
        "fechaSubida": ISODate("2026-09-14T18:05:07.529Z")
      },
      {
        "url": "https://fotos.reporteciudadano.sv/RC-2026-000019-1.jpg",
        "tipo": "foto",
        "fechaSubida": ISODate("2026-09-14T18:05:07.529Z")
      }
    ],
    "apoyos": [ObjectId("6ae6ba73af7333f46925ae0d"), ObjectId("6ae6ba73af7333f46925ae0e")],
    "totalApoyos": 2,
    "etiquetas": ["desperdicio", "fuga"],
    "fechaCreacion": ISODate("2026-09-14T18:05:07.529Z"),
    "fechaActualizacion": ISODate("2026-09-22T02:05:07.529Z"),
    "fechaResolucion": null
  },
  {
    "_id": ObjectId("6ae6ba73af7333f46925ae2d"),
    "folio": "RC-2026-000020",
    "titulo": "Botadero ilegal junto al parque",
    "descripcion": "Se acumula basura desde hace varios días, hay malos olores y zancudos.",
    "categoria": "basura",
    "prioridad": "media",
    "nivelPrioridad": 2,
    "estado": "resuelto",
    "ubicacion": {
      "latitud": 13.464536,
      "longitud": -88.937312
    },
    "direccion": {
      "departamento": "La Paz",
      "municipio": "La Paz Este",
      "referencia": null
    },
    "ciudadanoId": ObjectId("6ae6ba73af7333f46925ae0e"),
    "institucion": {
      "_id": ObjectId("6ae6ba73af7333f46925adef"),
      "codigo": "AM-LA-PAZ-ESTE",
      "nombre": "Alcaldía Municipal de La Paz Este"
    },
    "historial": [
      {
        "estado": "recibido",
        "fecha": ISODate("2026-08-07T15:05:07.529Z"),
        "actor": "Andrea Rivera Rivera",
        "comentario": null
      },
      {
        "estado": "en_revision",
        "fecha": ISODate("2026-08-08T12:05:07.529Z"),
        "actor": "Centro de atención",
        "comentario": null
      },
      {
        "estado": "asignado",
        "fecha": ISODate("2026-08-09T13:05:07.529Z"),
        "actor": "Alcaldía Municipal de La Paz Este",
        "comentario": null
      },
      {
        "estado": "en_proceso",
        "fecha": ISODate("2026-08-10T00:05:07.529Z"),
        "actor": "Alcaldía Municipal de La Paz Este",
        "comentario": null
      },
      {
        "estado": "resuelto",
        "fecha": ISODate("2026-08-11T00:05:07.529Z"),
        "actor": "Alcaldía Municipal de La Paz Este",
        "comentario": null
      }
    ],
    "evidencias": [
      {
        "url": "https://fotos.reporteciudadano.sv/RC-2026-000020-0.jpg",
        "tipo": "foto",
        "fechaSubida": ISODate("2026-08-07T15:05:07.529Z")
      }
    ],
    "apoyos": [ObjectId("6ae6ba73af7333f46925ae19"), ObjectId("6ae6ba73af7333f46925ae13")],
    "totalApoyos": 2,
    "etiquetas": ["salud", "zancudos"],
    "fechaCreacion": ISODate("2026-08-07T15:05:07.529Z"),
    "fechaActualizacion": ISODate("2026-08-11T00:05:07.529Z"),
    "fechaResolucion": ISODate("2026-08-11T00:05:07.529Z"),
    "calificacion": {
      "puntaje": 4,
      "comentario": null,
      "fecha": ISODate("2026-08-11T00:05:07.529Z")
    }
  }
]);

// ---------- contadores (1) ----------
db.contadores.insertMany([
  {
    "_id": "folio_reportes",
    "secuencia": 20
  }
]);


// =====================================================================
// VERIFICACIÓN
// =====================================================================

print("Base reporte_ciudadano creada:");
["instituciones", "ciudadanos", "reportes", "contadores"].forEach(c =>
  print("  " + c + ": " + db.getCollection(c).countDocuments() + " documentos"));
