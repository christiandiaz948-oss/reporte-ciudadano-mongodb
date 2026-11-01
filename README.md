# Sistema de Reporte Ciudadano — MongoDB + FastAPI

Proyecto final de **Bases de Datos II (No Relacionales)**, Universidad Evangélica de El Salvador.
Catedrático: Mg. Josué A. Guinea Henríquez.

**Grupo 2**
- Christian Alessandro Díaz Hernández
- Daniel Antonio Hidalgo Ramírez
- Luis Rene Alfaro Martinez

---

## ¿Qué hace el sistema?

Las personas reportan problemas de su comunidad (baches, alumbrado, basura, fugas de agua, árboles caídos, semáforos…)
con ubicación GPS y evidencias. El sistema **enruta automáticamente** cada reporte a la institución responsable
(alcaldía del distrito, ANDA, distribuidora eléctrica, VMT, etc.), controla el **flujo de estados** del caso,
permite que otros ciudadanos **apoyen** el reporte y que el autor **califique** la atención.
Las autoridades consultan **métricas** construidas con *Aggregation Pipeline*: tiempos de resolución por institución,
municipios con más problemas abiertos y tendencias mensuales.

| Pieza | Tecnología |
|---|---|
| Base de datos | MongoDB 7 (Community Server) |
| API | Python 3.11+ con FastAPI y PyMongo |
| Documentación de la API | Swagger / OpenAPI, generada automáticamente en `/docs` |

## Requisitos

1. **MongoDB Community Server** 7.x o superior (probado con 8.3), instalado y corriendo como servicio en `localhost:27017`.
   Descarga: <https://www.mongodb.com/try/download/community>. Se recomienda instalar también **MongoDB Compass**.
2. **Python 3.11 o superior**.

## Puesta en marcha (Windows / PowerShell)

```powershell
# 1. Clonar e ingresar
git clone https://github.com/christiandiaz948-oss/reporte-ciudadano-mongodb.git
cd reporte-ciudadano-mongodb

# 2. Entorno virtual y dependencias
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt

# 3. Variables de entorno (opcional: si no existe .env se usa localhost:27017)
copy .env.example .env

# 4. Crear colecciones con $jsonSchema + índices, y cargar datos de prueba
python -m scripts.seed

# 5. Levantar la API
uvicorn app.main:app --reload
```

En Linux o macOS se activa el entorno con `source venv/bin/activate` y se copia el archivo con `cp .env.example .env`.

Después de levantar la API:
- **Swagger UI:** <http://localhost:8000/docs> (probar todos los endpoints desde el navegador)
- **ReDoc:** <http://localhost:8000/redoc>
- **OpenAPI para Postman o Insomnia:** importar [`docs/openapi.json`](docs/openapi.json) o la URL `http://localhost:8000/openapi.json`

> `python -m scripts.seed` **borra y recrea** las colecciones. Para solo aplicar validaciones e índices sin
> tocar los datos, usar `python -m scripts.init_db`.

### Variables de entorno

| Variable | Valor por defecto | Descripción |
|---|---|---|
| `MONGO_URI` | `mongodb://localhost:27017` | Cadena de conexión (puede ser Atlas) |
| `MONGO_DB` | `reporte_ciudadano` | Nombre de la base de datos |

## Datos de prueba (seed)

| Colección | Documentos | Contenido |
|---|---|---|
| `instituciones` | 57 | 44 alcaldías de distrito (división 2024), ANDA, MOP, FOVIAL, VMT, PNC, MARN, Bomberos, Protección Civil, CAESS, DELSUR, AES CLESA, EEO y DEUSEM |
| `ciudadanos` | 100 | DUI con dígito verificador válido, correo, teléfono y dirección |
| `reportes` | 400 | Historial de estados coherente, evidencias, apoyos y calificaciones, distribuidos en los últimos 12 meses |

Los datos son ficticios. Se generan con una semilla fija, así que cada carga produce los mismos datos.

## Endpoints

Todos los endpoints llevan el prefijo `/api`.

### Escritura
| Método | Ruta | Qué demuestra |
|---|---|---|
| POST | `/ciudadanos` | Inserción, índice único (DUI y correo) |
| PATCH | `/ciudadanos/{id}` | `$set` parcial |
| POST | `/instituciones` | Inserción con arrays y subdocumentos |
| PATCH | `/instituciones/{id}` | `$set` y sincronización de la referencia extendida con `update_many` |
| POST | `/reportes` | Enrutamiento automático, folio con contador atómico, `$inc` en el ciudadano |
| PATCH | `/reportes/{id}/estado` | Máquina de estados, `$set` + `$push` al historial en una sola operación atómica, concurrencia optimista |
| PATCH | `/reportes/{id}/institucion` | Reasignación con validación de competencia |
| POST | `/reportes/{id}/apoyos` | `$push` + `$inc` condicionados con `$ne` (sin votos duplicados) |
| DELETE | `/reportes/{id}/apoyos/{ciudadanoId}` | `$pull` |
| POST | `/reportes/{id}/evidencias` | `$push` con array acotado (`evidencias.9` + `$exists`) |
| POST | `/reportes/{id}/calificacion` | Actualización condicionada (solo el autor, una vez, con el reporte resuelto) |
| DELETE | `/reportes/{id}` | `delete_one` condicionado al estado |

### Lectura simple y avanzada
| Método | Ruta | Qué demuestra |
|---|---|---|
| GET | `/reportes` | `$in`, `$nin`, `$or`, `$gte`/`$lte`, `$all`, `$exists`, `$text`, *dot notation*, proyección, `sort`, `skip` y `limit` |
| GET | `/reportes/cercanos` | Consulta geoespacial `$nearSphere` (índice `2dsphere`) |
| GET | `/reportes/{id o folio}` | Detalle y resolución de la referencia al ciudadano |
| GET | `/ciudadanos` | `$regex` sin distinguir mayúsculas, filtro sobre subdocumento, paginación |
| GET | `/ciudadanos/{id}/reportes` | Consulta apoyada en el índice `{ciudadanoId, fechaCreacion}` |
| GET | `/instituciones` | Igualdad sobre un array y `$or` |

### Reportes y analítica (Aggregation Pipeline)
| Ruta | Etapas principales |
|---|---|
| `/analitica/resumen` | `$match`, `$facet`, `$group`, `$cond` |
| `/analitica/por-municipio` | `$group` por clave compuesta, `$set`, `$divide`, `$sort`, `$limit` |
| `/analitica/tiempos-resolucion` | `$project` + `$dateDiff`, `$group`, **`$lookup`**, **`$unwind`** |
| `/analitica/tendencia-mensual` | `$dateToString` con zona horaria y dos `$group` encadenados |
| `/analitica/ciudadanos-activos` | `$group`, `$lookup` con sub-pipeline, `$unwind` |
| `/analitica/etiquetas` | `$unwind` de un array y `$addToSet` |
| `/analitica/rendimiento-estados` | `$zip` + `$unwind` del historial embebido |

## Estructura del repositorio

```
app/
  main.py            # FastAPI, manejo de errores de $jsonSchema (código 121)
  db.py, config.py   # conexión y variables de entorno
  catalogos.py       # categorías, estados, transiciones y los 44 municipios
  schemas.py         # validación de entrada (Pydantic)
  servicios.py       # enrutamiento a instituciones y folio atómico
  routers/           # ciudadanos, instituciones, reportes, analitica
scripts/
  init_db.py         # colecciones con $jsonSchema + índices (idempotente)
  seed.py            # carga de datos de prueba
docs/
  DISENO.md          # justificación del modelo (embeber vs referenciar, índices, patrones)
  DEFENSA.md         # guion de exposición y preguntas: ¿por qué MongoDB y no Cassandra?
  consultas_demo.mongodb.js  # consultas para ejecutar en mongosh o Compass
  openapi.json       # especificación para importar en Postman o Insomnia
```

## Documentación

- [Diseño del modelo NoSQL](docs/DISENO.md)
- [Guía para la defensa](docs/DEFENSA.md)
- [Consultas de demostración en mongosh](docs/consultas_demo.mongodb.js)
