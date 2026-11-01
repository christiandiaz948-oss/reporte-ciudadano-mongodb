// Consultas de demostración: copiarlas en el shell integrado de Compass (pestaña _MONGOSH, abajo)
use("reporte_ciudadano");

// 1. Ver un reporte completo (subdocumentos y arrays embebidos)
db.reportes.findOne({ estado: "resuelto", calificacion: { $exists: true } });

// 2. Validación: este insert DEBE fallar con "Document failed validation" (código 121)
db.reportes.insertOne({ folio: "MAL", titulo: "x", categoria: "volcan" });

// 3. Comparación y lógicos: abiertos de San Salvador que son críticos O tienen 10+ apoyos
db.reportes.find(
  {
    "direccion.departamento": "San Salvador",
    estado: { $nin: ["resuelto", "rechazado"] },
    $or: [{ prioridad: "critica" }, { totalApoyos: { $gte: 10 } }]
  },
  { folio: 1, titulo: 1, prioridad: 1, totalApoyos: 1, _id: 0 }
).sort({ totalApoyos: -1 }).limit(5);

// 4. Arrays: reportes que tienen TODAS estas etiquetas
db.reportes.find({ etiquetas: { $all: ["salud", "lluvia"] } }, { folio: 1, etiquetas: 1, _id: 0 });

// 5. Dentro de un array de subdocumentos: reportes que una alcaldía puso "en_proceso"
db.reportes.find(
  { historial: { $elemMatch: { estado: "en_proceso", actor: /Alcaldía/ } } },
  { folio: 1, "institucion.nombre": 1, _id: 0 }
).limit(3);

// 6. Regex: título que contiene "semáforo" sin importar mayúsculas
db.reportes.find({ titulo: { $regex: "semáforo", $options: "i" } }, { titulo: 1, _id: 0 }).limit(5);

// 7. AGREGACIÓN: días promedio de resolución por institución ($match, $project, $group, $lookup, $unwind)
db.reportes.aggregate([
  { $match: { estado: "resuelto" } },
  { $project: { institucionId: "$institucion._id",
                horas: { $dateDiff: { startDate: "$fechaCreacion", endDate: "$fechaResolucion", unit: "hour" } } } },
  { $group: { _id: "$institucionId", resueltos: { $sum: 1 }, promedioHoras: { $avg: "$horas" } } },
  { $lookup: { from: "instituciones", localField: "_id", foreignField: "_id", as: "institucion" } },
  { $unwind: "$institucion" },
  { $project: { _id: 0, institucion: "$institucion.nombre", resueltos: 1,
                promedioDias: { $round: [{ $divide: ["$promedioHoras", 24] }, 1] } } },
  { $sort: { promedioDias: 1 } },
  { $limit: 10 }
]);

// 8. AGREGACIÓN: etiquetas más comunes en reportes abiertos ($unwind de un array)
db.reportes.aggregate([
  { $match: { estado: { $nin: ["resuelto", "rechazado"] } } },
  { $unwind: "$etiquetas" },
  { $group: { _id: "$etiquetas", total: { $sum: 1 } } },
  { $sort: { total: -1 } }
]);

// 9. Ver que la consulta usa un índice: buscar "IXSCAN" en el resultado (COLLSCAN = sin índice)
db.reportes.find({ estado: "asignado", categoria: "bache" }).sort({ fechaCreacion: -1 }).explain().queryPlanner.winningPlan;
