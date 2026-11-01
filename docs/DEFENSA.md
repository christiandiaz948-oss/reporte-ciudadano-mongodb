# Guía para la defensa: Grupo 2

**Sábado 7 de noviembre de 2026, de 6:20 a 6:35 PM.** Son 15 minutos como máximo, hay que conectarse
puntualmente y mostrar la base de datos y la API funcionando.

## Antes de conectarse (checklist)

- [ ] Servicio de MongoDB corriendo; Compass abierto en la base `reporte_ciudadano`.
- [ ] `python -m scripts.seed` ejecutado ese mismo día, para que las fechas sean recientes.
- [ ] `uvicorn app.main:app` corriendo y <http://localhost:8000/docs> abierto.
- [ ] [`consultas_demo.mongodb.js`](consultas_demo.mongodb.js) abierto para copiar consultas al shell de Compass.
- [ ] Un `ciudadanoId` y un folio de prueba copiados en un bloc de notas, para no buscarlos en vivo.
- [ ] Un ensayo completo con cronómetro.

## Guion de 15 minutos (propuesta de reparto)

| Min | Quién | Qué se muestra |
|---|---|---|
| 0–2 | Integrante 1 | Qué problema resuelve el sistema y **por qué MongoDB** (respuesta corta, abajo) |
| 2–6 | Integrante 1 | **Modelo** en Compass: abrir un reporte y explicar qué se embebió y qué se referenció. Pestaña *Validation*: mostrar el `$jsonSchema` e insertar un documento inválido para que se vea el rechazo |
| 6–10 | Integrante 2 | **API en Swagger:** crear un reporte (se asigna solo a la alcaldía), apoyarlo, intentar apoyarlo otra vez (409), llevarlo hasta "resuelto" e intentar un cambio no permitido (409) |
| 10–13 | Integrante 3 | **Consultas:** `GET /reportes` con varios filtros (`abiertos`, `categoria`, `urgentes`). **Agregaciones:** `/analitica/tiempos-resolucion` (explicar `$lookup` + `$unwind`) y `/analitica/por-categoria` |
| 13–15 | Todos | Escalabilidad (shard key) y preguntas |

---

## ¿Por qué MongoDB y no Cassandra?

### Respuesta corta (30 segundos, para decirla de memoria)

> "Elegimos MongoDB porque un reporte es naturalmente un **documento**: tiene su historial, sus fotos y su
> dirección dentro. Además, la aplicación necesita **filtrar por muchos campos combinados**: estado, categoría,
> municipio, fechas y etiquetas. MongoDB lo permite con índices y tiene el Aggregation Pipeline para las métricas.
> En Cassandra cada consulta necesita su propia tabla diseñada de antemano, no hay joins y las agregaciones son
> muy limitadas. Cassandra es mejor cuando hay muchísimas escrituras por segundo, como sensores o IoT, y ese no
> es nuestro caso."

### Comparación

| Criterio | Lo que necesita el sistema | MongoDB | Cassandra |
|---|---|---|---|
| **Forma de los datos** | Un reporte con historial, fotos y dirección dentro | Documentos con subdocumentos y arrays | Tablas con filas y columnas; los datos anidados son limitados |
| **Consultas** | Combinar filtros: estado + categoría + municipio + fechas | Se puede filtrar por cualquier campo y crear índices | La consulta debe usar la **partition key**. Para otra combinación hay que crear otra tabla o usar `ALLOW FILTERING`, que es lento |
| **Métricas** | Promedios por institución, conteos por municipio | Aggregation Pipeline (`$group`, `$lookup`, `$unwind`) | Sin joins y con agregaciones muy básicas |
| **Actualizar un reporte** | Cambiar el estado y guardar el cambio en el historial | Un solo `update_one` con `$set` + `$push` | Los datos están duplicados en varias tablas: hay que actualizar todas |
| **Validación** | DUI con formato, coordenadas dentro del país, estados válidos | `$jsonSchema` | Solo valida el tipo de cada columna |
| **Volumen** | Miles de reportes al día | Suficiente, y escala con sharding | Diseñado para millones de escrituras por segundo: más de lo que necesitamos |

### ¿Cuándo sí usaríamos Cassandra?

Si en el futuro se agregaran, por ejemplo, **lámparas inteligentes** que envían su estado cada pocos segundos, esos
millones de lecturas irían en Cassandra, con una tabla particionada por sensor y día. Los reportes seguirían en
MongoDB. Usar cada base de datos para lo que hace mejor se llama **persistencia políglota**.

### "¿Cómo se vería en Cassandra?" (por si lo preguntan)

Se diseña una tabla por cada consulta (*query-first*, clase 16):
```sql
CREATE TABLE reportes_por_municipio (
  municipio text, estado text, fecha_creacion timestamp, folio text, titulo text,
  PRIMARY KEY ((municipio, estado), fecha_creacion, folio)
) WITH CLUSTERING ORDER BY (fecha_creacion DESC, folio ASC);

CREATE TABLE reportes_por_ciudadano (
  ciudadano_id uuid, fecha_creacion timestamp, folio text, titulo text, estado text,
  PRIMARY KEY ((ciudadano_id), fecha_creacion, folio)
) WITH CLUSTERING ORDER BY (fecha_creacion DESC, folio ASC);
```
Cada reporte tendría que guardarse en las dos tablas, y en cada cambio de estado habría que actualizar ambas.
Además, como `estado` forma parte de la clave, cambiarlo obliga a borrar la fila e insertarla de nuevo.
Para filtrar también por categoría o fechas harían falta más tablas.

---

## Preguntas probables y respuestas

**¿Por qué el historial está embebido y no en otra colección?**
Porque siempre se muestra junto con el reporte y son pocos cambios (máximo 50). Así, con un solo `update_one`
se cambia el estado (`$set`) y se agrega el registro al historial (`$push`).

**¿Qué pasa con el límite de 16 MB por documento?**
Las fotos no se guardan en MongoDB, solo su URL, y los arrays tienen máximo (10 evidencias, 50 cambios de historial).
Un reporte pesa unos pocos KB.

**¿Por qué guardan el nombre de la institución dentro del reporte si ya tienen su id?**
Es una **referencia extendida** (clase 10): el listado muestra el nombre en cada fila y así no hace falta un
`$lookup`. Si la institución cambia de nombre, el `PATCH /instituciones/{id}` lo actualiza en todos sus reportes
con `update_many`.

**¿Por qué el ciudadano no está embebido en el reporte?**
Porque tiene datos personales (DUI, teléfono) que no se deben copiar en cada reporte, puede tener muchos reportes
y existe por sí solo. Por eso el reporte guarda únicamente el `ciudadanoId`.

**¿Cómo evitan que alguien apoye dos veces?**
El filtro del `update_one` incluye `apoyos: {$ne: id}`, es decir, "que el ciudadano todavía no esté en el array".
Si ya estaba, no se modifica nada y la API responde 409.

**¿Qué pasa si se inserta un documento inválido desde Compass?**
MongoDB lo rechaza con el error 121 (*Document failed validation*) gracias al `$jsonSchema`. Se puede mostrar en vivo.

**¿Qué índices crearon?**
Índices únicos para DUI, correo y folio, y compuestos para los filtros más usados, como
`{estado, categoria, fechaCreacion}`. La tabla completa está en [DISENO.md](DISENO.md#5-índices).

**¿Cómo escalaría el sistema?**
Con sharding usando `{ "direccion.departamento": 1, "_id": "hashed" }`. Las consultas por departamento van a un
solo shard y el `_id` hasheado reparte los datos para que San Salvador no se sature. No se usa la fecha porque
siempre crece y todo iría al mismo shard.

**¿Qué hace `$lookup` en su agregación?**
En `tiempos-resolucion`, primero se agrupan los reportes por institución y se calcula el promedio. Después
`$lookup` trae el nombre y el tipo de la institución desde su colección, como un JOIN. Como `$lookup` devuelve
un arreglo, `$unwind` lo convierte en un objeto.

**¿Por qué FastAPI?**
Es un framework de Python para crear APIs. Valida los datos que llegan y genera solo la documentación Swagger en
`/docs`, que usamos para probar los endpoints. PyMongo es el driver oficial de MongoDB para Python.
