// Consultas de demostración: ejecutar en mongosh o en el shell integrado de Compass
// mongosh "mongodb://localhost:27017/reporte_ciudadano"
use("reporte_ciudadano");

// 1. Un reporte completo (subdocumentos y arrays embebidos)
db.reportes.findOne({ estado: "resuelto", calificacion: { $exists: true } });

// 2. Validación: este insert DEBE fallar (Document failed validation, código 121)
try {
  db.reportes.insertOne({ folio: "MAL", titulo: "x", categoria: "volcan" });
} catch (e) { print("Rechazado por $jsonSchema:", e.code); }

// 3. Comparación + lógicos: abiertos de San Salvador críticos O con 10+ apoyos
db.reportes.find(
  {
    "direccion.departamento": "San Salvador",
    estado: { $nin: ["resuelto", "rechazado"] },
    $or: [{ prioridad: "critica" }, { totalApoyos: { $gte: 10 } }]
  },
  { folio: 1, titulo: 1, prioridad: 1, totalApoyos: 1, _id: 0 }
).sort({ totalApoyos: -1 }).limit(5);

// 4. Arrays: con TODAS las etiquetas indicadas y al menos una evidencia
db.reportes.find(
  { etiquetas: { $all: ["salud", "lluvia"] }, "evidencias.0": { $exists: true } },
  { folio: 1, etiquetas: 1, _id: 0 }
);

// 5. Subdocumento dentro de un array: reportes donde un actor puso 'en_proceso'
db.reportes.find(
  { historial: { $elemMatch: { estado: "en_proceso", actor: /Alcaldía/ } } },
  { folio: 1, "institucion.nombre": 1, _id: 0 }
).limit(3);

// 6. Geoespacial: reportes abiertos a menos de 5 km del centro de San Salvador
db.reportes.find({
  ubicacion: { $nearSphere: { $geometry: { type: "Point", coordinates: [-89.19, 13.70] }, $maxDistance: 5000 } },
  estado: { $nin: ["resuelto", "rechazado"] }
}, { folio: 1, titulo: 1, _id: 0 }).limit(5);

// 7. Texto completo en español
db.reportes.find({ $text: { $search: "semáforo dañado" } }, { score: { $meta: "textScore" }, titulo: 1, _id: 0 })
  .sort({ score: { $meta: "textScore" } }).limit(5);

// 8. AGREGACIÓN: tiempo promedio de resolución por institución ($match, $project, $group, $lookup, $unwind)
db.reportes.aggregate([
  { $match: { estado: "resuelto" } },
  { $project: { inst: "$institucion._id",
                horas: { $dateDiff: { startDate: "$fechaCreacion", endDate: "$fechaResolucion", unit: "hour" } } } },
  { $group: { _id: "$inst", casos: { $sum: 1 }, promedioHoras: { $avg: "$horas" } } },
  { $match: { casos: { $gte: 3 } } },
  { $lookup: { from: "instituciones", localField: "_id", foreignField: "_id", as: "i" } },
  { $unwind: "$i" },
  { $project: { _id: 0, institucion: "$i.nombre", tipo: "$i.tipo", casos: 1,
                promedioDias: { $round: [{ $divide: ["$promedioHoras", 24] }, 1] } } },
  { $sort: { promedioDias: 1 } },
  { $limit: 10 }
]);

// 9. AGREGACIÓN: etiquetas más frecuentes en problemas abiertos ($unwind de un array)
db.reportes.aggregate([
  { $match: { estado: { $nin: ["resuelto", "rechazado"] } } },
  { $unwind: "$etiquetas" },
  { $group: { _id: "$etiquetas", total: { $sum: 1 } } },
  { $sort: { total: -1 } }
]);

// 10. Actualización atómica: apoyar sin duplicar ($ne + $push + $inc)
// const r = db.reportes.findOne({ estado: "asignado" });
// const c = db.ciudadanos.findOne({ _id: { $ne: r.ciudadanoId } });
// db.reportes.updateOne({ _id: r._id, apoyos: { $ne: c._id } }, { $push: { apoyos: c._id }, $inc: { totalApoyos: 1 } });

// 11. Plan de ejecución: comprobar que usa índice (IXSCAN) y no COLLSCAN
db.reportes.find({ estado: "asignado", categoria: "bache" }).sort({ fechaCreacion: -1 }).explain("executionStats").queryPlanner.winningPlan;
