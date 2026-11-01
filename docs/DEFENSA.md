# Guía para la defensa: Grupo 2

**Sábado 7 de noviembre de 2026, de 6:20 a 6:35 PM.** Son 15 minutos como máximo, hay que conectarse
puntualmente y mostrar la base de datos y la API funcionando.

## Antes de conectarse (checklist)

- [ ] Servicio de MongoDB corriendo; Compass abierto en la base `reporte_ciudadano`.
- [ ] `python -m scripts.seed` ejecutado ese mismo día, para que las fechas sean recientes.
- [ ] `uvicorn app.main:app` corriendo y <http://localhost:8000/docs> abierto.
- [ ] Ventana de `mongosh` con [`consultas_demo.mongodb.js`](consultas_demo.mongodb.js) a mano.
- [ ] Copiar en un bloc de notas un `ciudadanoId` y un folio de prueba para no buscarlos en vivo.
- [ ] Ensayar al menos una vez con cronómetro.

## Guion de 15 minutos (propuesta de reparto)

| Min | Quién | Qué se muestra |
|---|---|---|
| 0–2 | Integrante 1 | Problema que resuelve el sistema, actores (ciudadano, institución, autoridad) y **por qué MongoDB** (versión corta, ver abajo) |
| 2–6 | Integrante 1 | **Modelo** en Compass: un reporte completo y la explicación de qué se embebió, qué se referenció y por qué. Pestaña *Validation* con el `$jsonSchema`; intentar insertar un documento inválido y mostrar el rechazo |
| 6–10 | Integrante 2 | **API en Swagger:** crear un reporte (asignación automática a la alcaldía), apoyarlo, intentar apoyarlo dos veces (409), cambiar el estado hasta resuelto e intentar una transición inválida (409) |
| 10–13 | Integrante 3 | **Lecturas avanzadas:** `GET /reportes` con varios filtros, `/reportes/cercanos` y `$text`. **Analítica:** `/analitica/tiempos-resolucion` (explicar `$lookup` + `$unwind`) y `/analitica/resumen` (`$facet`) |
| 13–15 | Todos | Escalabilidad (shard key) y preguntas |

---

## ¿Por qué MongoDB y no Cassandra?

### Respuesta corta (30 segundos, para decir de memoria)

> "Elegimos MongoDB porque el sistema lee mucho más de lo que escribe y necesita **consultas flexibles**:
> el ciudadano y la institución filtran por estado, categoría, municipio, fechas, texto y cercanía, en cualquier
> combinación. Cassandra obliga a conocer de antemano cada consulta y a crear una tabla por cada una, sin joins ni
> agregaciones complejas. Además el reporte es naturalmente un **documento** con su historial, sus fotos y su
> ubicación, y MongoDB nos da índices geoespaciales, búsqueda de texto, Aggregation Pipeline y validación con
> `$jsonSchema`. Cassandra brilla con volúmenes masivos de escritura, como sensores IoT o telemetría, y ese no
> es nuestro caso."

### Argumentos detallados

| Criterio | Nuestro sistema necesita | MongoDB | Cassandra |
|---|---|---|---|
| **Forma del dato** | Un reporte con historial, evidencias, ubicación y calificación anidados | Documento JSON/BSON con subdocumentos y arrays consultables | Filas planas. Las colecciones y los UDT existen, pero no se puede filtrar dentro de ellos con libertad (y los UDT deben ser `frozen`) |
| **Consultas** | Filtros combinables: estado + categoría + municipio + fechas + etiquetas + texto | Cualquier campo, con índices secundarios y compuestos | Diseño *query-first*: el `WHERE` debe incluir la **partition key**. Otra combinación exige una tabla nueva o `ALLOW FILTERING` (antipatrón que recorre el clúster) |
| **Analítica** | Promedios por institución, ranking por municipio, tendencias | Aggregation Pipeline: `$group`, `$lookup`, `$unwind`, `$facet` | Sin joins; `GROUP BY` solo sobre columnas de la clave primaria; agregados limitados. Haría falta Spark |
| **Geolocalización** | "Reportes cerca de mí" | Índice `2dsphere` y `$nearSphere` nativos | No tiene soporte geoespacial nativo; habría que simularlo con geohash |
| **Búsqueda de texto** | Buscar "semáforo dañado" | Índice de texto en español | No nativo; SAI en versiones recientes y con limitaciones |
| **Actualizaciones** | Cambiar el estado y registrar en la bitácora sin conflictos | `$set` + `$push` atómico en un documento y concurrencia optimista en el filtro | Cada consulta tiene su propia tabla desnormalizada: un cambio de estado debe escribirse en **varias tablas**. El control de concurrencia (`IF`, LWT) usa Paxos y es costoso |
| **Consistencia** | Dos operadores no pueden dejar el reporte en estados contradictorios | Consistencia fuerte en el primario por defecto (CP en CAP) | Consistencia eventual o ajustable (AP en CAP) |
| **Validación** | DUI, coordenadas dentro del país, enums | `$jsonSchema` con patrones, rangos y enums | Tipos de columna, pero sin reglas de negocio |
| **Volumen de escritura** | Miles de reportes por día a nivel nacional | Suficiente, y escala con sharding si crece | Pensado para millones de escrituras por segundo: más capacidad de la necesaria |

### ¿Cuándo sí usaríamos Cassandra?

Si el sistema evolucionara, por ejemplo con **luminarias o medidores inteligentes** que envían telemetría cada pocos
segundos, esa serie de tiempo masiva iría en Cassandra, con una tabla como
`lecturas_por_sensor ((sensor_id, dia), fecha_hora)`, mientras los reportes ciudadanos seguirían en MongoDB.
Esto se conoce como **persistencia políglota**: usar cada motor para lo que hace mejor. Mencionarlo muestra criterio.

### "¿Y cómo se vería en Cassandra?" (por si lo preguntan)

Habría que crear una tabla por consulta y duplicar los datos:
```sql
CREATE TABLE reportes_por_municipio (
  municipio text, estado text, fecha_creacion timestamp, folio text, titulo text, categoria text,
  PRIMARY KEY ((municipio, estado), fecha_creacion, folio)
) WITH CLUSTERING ORDER BY (fecha_creacion DESC, folio ASC);

CREATE TABLE reportes_por_ciudadano (
  ciudadano_id uuid, fecha_creacion timestamp, folio text, titulo text, estado text,
  PRIMARY KEY ((ciudadano_id), fecha_creacion, folio)
) WITH CLUSTERING ORDER BY (fecha_creacion DESC, folio ASC);

CREATE TABLE reportes_por_institucion ( ... PRIMARY KEY ((institucion_id, estado), fecha_creacion, folio) );
```
Cada cambio de estado tendría que actualizar las tres tablas. Y como `estado` forma parte de la clave de partición,
cambiarlo implica **borrar e insertar**, lo que genera *tombstones*. Filtrar además por categoría + fechas + texto
exigiría más tablas todavía. Este ejemplo sirve para mostrar que el grupo conoce Cassandra y la descartó con
argumentos, no por desconocimiento.

---

## Preguntas probables y respuestas

**¿Por qué el historial está embebido y no en otra colección?**
Siempre se lee junto con el reporte, tiene pocos elementos (un tope de 50) y así el cambio de estado y su registro
en la bitácora son atómicos en una sola operación, sin transacciones multi-documento.

**¿Qué pasa con el límite de 16 MB?**
Las evidencias se guardan como URLs, no como binarios, y los arrays tienen tope en el `$jsonSchema`
(10 evidencias, 50 cambios de historial). Un reporte típico pesa pocos KB. El único array que podría crecer sin
control es `apoyos`; si un reporte superara miles de apoyos, se aplicaría el *Outlier Pattern*.

**¿Por qué duplican el nombre de la institución dentro del reporte?**
Es el *Extended Reference Pattern*: el listado, la consulta más frecuente, muestra el nombre sin hacer un `$lookup`.
El nombre de una institución casi nunca cambia, y cuando cambia el endpoint `PATCH` lo sincroniza con `update_many`.

**¿Por qué el ciudadano no está embebido en el reporte?**
Porque tiene datos personales (DUI, teléfono) que no deben duplicarse, crea muchos reportes (1:N sin límite) y
tiene vida propia. Se guarda solo `ciudadanoId`.

**¿Cómo evitan que alguien apoye dos veces?**
Con el filtro `apoyos: {$ne: id}` dentro del mismo `update_one` que hace `$push` y `$inc`. Si ya existe, el update
no modifica nada y la API responde 409. Es atómico y no hay condición de carrera.

**¿Qué pasa si se inserta un documento inválido desde Compass?**
El `$jsonSchema` lo rechaza con el error 121 (*Document failed validation*). Se puede mostrar en vivo.

**¿Qué índices crearon y por qué?**
Ver la tabla de [DISENO.md](DISENO.md#5-índices). Conviene destacar el índice compuesto que sigue la regla ESR
(Equality, Sort, Range), el `2dsphere` y el de texto en español con pesos.

**¿Cómo escalaría?**
Con sharding sobre `{ "direccion.departamento": 1, "_id": "hashed" }`. Las consultas por departamento quedan
dirigidas y las escrituras se reparten sin *hotspots*. No se usa la fecha porque es monótona creciente.

**¿Por qué FastAPI?**
Es un framework de Python que valida la entrada con tipos y genera la documentación Swagger automáticamente,
lo que cubre el entregable de la colección de pruebas. PyMongo es el driver oficial de MongoDB para Python.

**¿Qué hace `$lookup` en su pipeline?**
En `tiempos-resolucion`, después de agrupar por `institucion._id`, `$lookup` trae el tipo y el nombre de la
institución desde su colección, y `$unwind` convierte el arreglo resultante en un objeto. Se hace después del
`$group` para unir pocas filas (una por institución) y no los 400 reportes.
