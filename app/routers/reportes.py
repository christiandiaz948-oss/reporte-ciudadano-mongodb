from datetime import datetime

from fastapi import APIRouter, HTTPException, Query
from pymongo import ASCENDING, DESCENDING

from app.catalogos import ESTADOS_CERRADOS, NIVEL_PRIORIDAD, TRANSICIONES, municipio_valido
from app.db import db
from app.schemas import (ApoyoIn, AsignarInstitucion, CalificacionIn, CambioEstado, Categoria,
                         Estado, EvidenciaIn, Prioridad, ReporteCrear)
from app.servicios import buscar_institucion, siguiente_folio
from app.utils import a_oid, ahora, paginar, serializar

router = APIRouter(prefix="/reportes", tags=["Reportes"])

# En listados no se envían los arrays pesados (proyección)
PROYECCION_LISTADO = {"historial": 0, "apoyos": 0, "descripcion": 0}


def _buscar(reporte_id: str, proyeccion=None) -> dict:
    """Acepta el ObjectId o el folio legible (RC-2026-000123)."""
    filtro = {"folio": reporte_id.upper()} if reporte_id.upper().startswith("RC-") else {"_id": a_oid(reporte_id)}
    doc = db.reportes.find_one(filtro, proyeccion)
    if not doc:
        raise HTTPException(404, "Reporte no encontrado")
    return doc


# ------------------------------------------------------------------ escritura
@router.post("", status_code=201, summary="Crear reporte (asigna institución automáticamente)")
def crear_reporte(datos: ReporteCrear):
    ciudadano_id = a_oid(datos.ciudadanoId, "ciudadanoId")
    ciudadano = db.ciudadanos.find_one({"_id": ciudadano_id}, {"nombre": 1})
    if not ciudadano:
        raise HTTPException(404, "El ciudadano no existe")
    if not municipio_valido(datos.departamento, datos.municipio):
        raise HTTPException(422, f"El municipio '{datos.municipio}' no pertenece a '{datos.departamento}'")

    momento = ahora()
    institucion = buscar_institucion(db, datos.categoria, datos.departamento, datos.municipio)
    historial = [{"estado": "recibido", "fecha": momento, "actor": ciudadano["nombre"],
                  "comentario": "Reporte creado desde la API."}]
    doc = {
        "folio": siguiente_folio(db, momento.year),
        "titulo": datos.titulo,
        "descripcion": datos.descripcion,
        "categoria": datos.categoria,
        "prioridad": datos.prioridad,
        "nivelPrioridad": NIVEL_PRIORIDAD[datos.prioridad],
        "estado": "recibido",
        "ubicacion": {"type": "Point", "coordinates": [float(datos.longitud), float(datos.latitud)]},
        "direccion": {"departamento": datos.departamento, "municipio": datos.municipio,
                      "referencia": datos.referencia},
        "ciudadanoId": ciudadano_id,
        "institucion": institucion,
        "historial": historial,
        "evidencias": [{**e.model_dump(), "fechaSubida": momento} for e in datos.evidencias],
        "apoyos": [],
        "totalApoyos": 0,
        "etiquetas": [e.strip().lower() for e in datos.etiquetas if e.strip()],
        "fechaCreacion": momento,
        "fechaActualizacion": momento,
        "fechaResolucion": None,
    }
    resultado = db.reportes.insert_one(doc)
    # Patrón Computed: se actualiza el contador del ciudadano en la misma operación de negocio
    db.ciudadanos.update_one(
        {"_id": ciudadano_id},
        {"$inc": {"estadisticas.totalReportes": 1}, "$set": {"estadisticas.ultimoReporte": momento}},
    )
    return serializar({**doc, "_id": resultado.inserted_id})


@router.patch("/{reporte_id}/estado", summary="Cambiar estado (valida la máquina de estados)")
def cambiar_estado(reporte_id: str, datos: CambioEstado):
    actual = _buscar(reporte_id, {"estado": 1, "institucion": 1})
    permitidos = TRANSICIONES[actual["estado"]]
    if datos.estado not in permitidos:
        raise HTTPException(409, f"No se puede pasar de '{actual['estado']}' a '{datos.estado}'. "
                                 f"Permitidos: {permitidos or 'ninguno (estado final)'}")
    if datos.estado in ("asignado", "en_proceso") and not actual.get("institucion"):
        raise HTTPException(409, "El reporte no tiene institución asignada")

    momento = ahora()
    cambios = {"$set": {"estado": datos.estado, "fechaActualizacion": momento,
                        "fechaResolucion": momento if datos.estado == "resuelto" else None},
               "$push": {"historial": {"estado": datos.estado, "fecha": momento,
                                       "actor": datos.actor, "comentario": datos.comentario}}}
    if datos.estado == "en_proceso":
        cambios["$unset"] = {"calificacion": ""}  # una reapertura invalida la calificación previa
    # Control de concurrencia optimista: solo actualiza si nadie cambió el estado antes
    resultado = db.reportes.find_one_and_update(
        {"_id": actual["_id"], "estado": actual["estado"]}, cambios,
        projection={"apoyos": 0}, return_document=True)
    if not resultado:
        raise HTTPException(409, "El reporte cambió de estado mientras se procesaba, intente de nuevo")
    return serializar(resultado)


@router.patch("/{reporte_id}/institucion", summary="Reasignar institución manualmente")
def asignar_institucion(reporte_id: str, datos: AsignarInstitucion):
    reporte = _buscar(reporte_id, {"estado": 1, "categoria": 1})
    if reporte["estado"] in ESTADOS_CERRADOS:
        raise HTTPException(409, "No se puede reasignar un reporte cerrado")
    inst = db.instituciones.find_one(
        {"_id": a_oid(datos.institucionId, "institucionId"), "activa": True},
        {"codigo": 1, "nombre": 1, "categoriasAtendidas": 1})
    if not inst:
        raise HTTPException(404, "Institución no encontrada o inactiva")
    if reporte["categoria"] not in inst["categoriasAtendidas"]:
        raise HTTPException(422, f"{inst['nombre']} no atiende la categoría '{reporte['categoria']}'")
    momento = ahora()
    resultado = db.reportes.find_one_and_update(
        {"_id": reporte["_id"]},
        {"$set": {"institucion": {"_id": inst["_id"], "codigo": inst["codigo"], "nombre": inst["nombre"]},
                  "fechaActualizacion": momento},
         "$push": {"historial": {"estado": reporte["estado"], "fecha": momento, "actor": datos.actor,
                                 "comentario": f"Reasignado a {inst['nombre']}"}}},
        projection={"apoyos": 0}, return_document=True)
    return serializar(resultado)


@router.post("/{reporte_id}/apoyos", summary="Apoyar un reporte ('a mí también me afecta')")
def apoyar(reporte_id: str, datos: ApoyoIn):
    reporte = _buscar(reporte_id, {"_id": 1})
    ciudadano_id = a_oid(datos.ciudadanoId, "ciudadanoId")
    if not db.ciudadanos.count_documents({"_id": ciudadano_id}, limit=1):
        raise HTTPException(404, "El ciudadano no existe")
    # $ne en el filtro + $push/$inc evita votos duplicados de forma atómica
    resultado = db.reportes.update_one(
        {"_id": reporte["_id"], "apoyos": {"$ne": ciudadano_id}, "ciudadanoId": {"$ne": ciudadano_id},
         "estado": {"$nin": ESTADOS_CERRADOS}},
        {"$push": {"apoyos": ciudadano_id}, "$inc": {"totalApoyos": 1}})
    if resultado.modified_count == 0:
        raise HTTPException(409, "Ya apoyó este reporte, es el autor o el reporte está cerrado")
    return serializar(db.reportes.find_one({"_id": reporte["_id"]}, {"folio": 1, "totalApoyos": 1}))


@router.delete("/{reporte_id}/apoyos/{ciudadano_id}", summary="Retirar apoyo ($pull)")
def retirar_apoyo(reporte_id: str, ciudadano_id: str):
    reporte = _buscar(reporte_id, {"_id": 1})
    cid = a_oid(ciudadano_id, "ciudadanoId")
    resultado = db.reportes.update_one(
        {"_id": reporte["_id"], "apoyos": cid}, {"$pull": {"apoyos": cid}, "$inc": {"totalApoyos": -1}})
    if resultado.modified_count == 0:
        raise HTTPException(404, "El ciudadano no había apoyado este reporte")
    return serializar(db.reportes.find_one({"_id": reporte["_id"]}, {"folio": 1, "totalApoyos": 1}))


@router.post("/{reporte_id}/evidencias", summary="Agregar evidencia (máx. 10)")
def agregar_evidencia(reporte_id: str, datos: EvidenciaIn):
    reporte = _buscar(reporte_id, {"_id": 1})
    resultado = db.reportes.find_one_and_update(
        # 'evidencias.9' existe solo si ya hay 10: el array se mantiene acotado
        {"_id": reporte["_id"], "evidencias.9": {"$exists": False}},
        {"$push": {"evidencias": {**datos.model_dump(), "fechaSubida": ahora()}},
         "$set": {"fechaActualizacion": ahora()}},
        projection={"folio": 1, "evidencias": 1}, return_document=True)
    if not resultado:
        raise HTTPException(409, "El reporte ya tiene el máximo de 10 evidencias")
    return serializar(resultado)


@router.post("/{reporte_id}/calificacion", summary="Calificar la atención (solo autor y reporte resuelto)")
def calificar(reporte_id: str, datos: CalificacionIn):
    reporte = _buscar(reporte_id, {"_id": 1})
    resultado = db.reportes.find_one_and_update(
        {"_id": reporte["_id"], "estado": "resuelto", "ciudadanoId": a_oid(datos.ciudadanoId, "ciudadanoId"),
         "calificacion": {"$exists": False}},
        {"$set": {"calificacion": {"puntaje": datos.puntaje, "comentario": datos.comentario, "fecha": ahora()}}},
        projection={"folio": 1, "estado": 1, "calificacion": 1}, return_document=True)
    if not resultado:
        raise HTTPException(409, "Solo el autor puede calificar, una vez, y con el reporte resuelto")
    return serializar(resultado)


@router.delete("/{reporte_id}", status_code=204, summary="Eliminar reporte (solo si sigue 'recibido')")
def eliminar_reporte(reporte_id: str):
    reporte = _buscar(reporte_id, {"ciudadanoId": 1})
    resultado = db.reportes.delete_one({"_id": reporte["_id"], "estado": "recibido"})
    if resultado.deleted_count == 0:
        raise HTTPException(409, "Solo se pueden eliminar reportes en estado 'recibido'")
    db.ciudadanos.update_one({"_id": reporte["ciudadanoId"]}, {"$inc": {"estadisticas.totalReportes": -1}})


# ------------------------------------------------------------------ lectura
@router.get("", summary="Buscar reportes con filtros avanzados, orden y paginación")
def listar_reportes(
    estado: list[Estado] | None = Query(None, description="Uno o varios ($in)"),
    categoria: list[Categoria] | None = Query(None, description="Una o varias ($in)"),
    prioridad: list[Prioridad] | None = Query(None),
    abiertos: bool | None = Query(None, description="true = no resueltos ni rechazados ($nin)"),
    urgentes: bool | None = Query(None, description="Críticos O con 10+ apoyos ($or)"),
    departamento: str | None = None,
    municipio: str | None = None,
    institucion_id: str | None = None,
    sin_institucion: bool | None = Query(None, description="Reportes sin institución asignada"),
    desde: datetime | None = Query(None, description="Fecha de creación desde ($gte)"),
    hasta: datetime | None = Query(None, description="Fecha de creación hasta ($lte)"),
    min_apoyos: int | None = Query(None, ge=0, description="Mínimo de apoyos ($gte)"),
    etiquetas: list[str] | None = Query(None, description="Debe tener TODAS ($all)"),
    con_evidencia: bool | None = Query(None, description="Con al menos una evidencia ($exists sobre el índice 0)"),
    calificacion_max: int | None = Query(None, ge=1, le=5, description="Calificados con puntaje <= N (dot notation en subdocumento)"),
    texto: str | None = Query(None, description="Búsqueda de texto completo en título/descripción ($text)"),
    orden: str = Query("fechaCreacion", pattern="^(fechaCreacion|fechaActualizacion|totalApoyos|nivelPrioridad)$"),
    direccion_orden: str = Query("desc", pattern="^(asc|desc)$"),
    pagina: int = Query(1, ge=1),
    tamano: int = Query(10, ge=1, le=100),
):
    filtro: dict = {}
    if estado:
        filtro["estado"] = {"$in": estado}
    elif abiertos is not None:
        filtro["estado"] = {"$nin": ESTADOS_CERRADOS} if abiertos else {"$in": ESTADOS_CERRADOS}
    if categoria:
        filtro["categoria"] = {"$in": categoria}
    if prioridad:
        filtro["prioridad"] = {"$in": prioridad}
    if urgentes:
        filtro["$or"] = [{"prioridad": "critica"}, {"totalApoyos": {"$gte": 10}}]
    if departamento:
        filtro["direccion.departamento"] = departamento
    if municipio:
        filtro["direccion.municipio"] = municipio
    if institucion_id:
        filtro["institucion._id"] = a_oid(institucion_id, "institucion_id")
    elif sin_institucion:
        filtro["institucion"] = None
    if desde or hasta:
        filtro["fechaCreacion"] = {k: v for k, v in (("$gte", desde), ("$lte", hasta)) if v}
    if min_apoyos is not None:
        filtro["totalApoyos"] = {"$gte": min_apoyos}
    if etiquetas:
        filtro["etiquetas"] = {"$all": [e.lower() for e in etiquetas]}
    if con_evidencia is not None:
        filtro["evidencias.0"] = {"$exists": con_evidencia}
    if calificacion_max is not None:
        filtro["calificacion.puntaje"] = {"$lte": calificacion_max}
    if texto:
        filtro["$text"] = {"$search": texto}

    sentido = ASCENDING if direccion_orden == "asc" else DESCENDING
    respuesta = paginar(db.reportes, filtro, pagina, tamano, [(orden, sentido), ("_id", sentido)],
                        PROYECCION_LISTADO)
    respuesta["filtroAplicado"] = serializar({k: v for k, v in filtro.items()})
    return respuesta


@router.get("/cercanos", summary="Reportes cercanos a un punto ($nearSphere, índice 2dsphere)")
def reportes_cercanos(
    lat: float = Query(..., ge=13.1, le=14.5, examples=[13.6989]),
    lng: float = Query(..., ge=-90.2, le=-87.6, examples=[-89.1914]),
    radio_m: int = Query(2000, ge=50, le=50000, description="Radio en metros"),
    solo_abiertos: bool = True,
    limite: int = Query(20, ge=1, le=100),
):
    filtro = {"ubicacion": {"$nearSphere": {"$geometry": {"type": "Point", "coordinates": [lng, lat]},
                                            "$maxDistance": radio_m}}}
    if solo_abiertos:
        filtro["estado"] = {"$nin": ESTADOS_CERRADOS}
    datos = list(db.reportes.find(filtro, PROYECCION_LISTADO).limit(limite))
    return {"total": len(datos), "datos": serializar(datos)}


@router.get("/{reporte_id}", summary="Detalle del reporte (por _id o folio) con datos del ciudadano")
def obtener_reporte(reporte_id: str):
    reporte = _buscar(reporte_id, {"apoyos": 0})
    # Referencia resuelta en la aplicación: solo se exponen datos públicos del ciudadano
    ciudadano = db.ciudadanos.find_one({"_id": reporte["ciudadanoId"]},
                                       {"nombre": 1, "direccion.municipio": 1})
    reporte["ciudadano"] = ciudadano
    return serializar(reporte)
