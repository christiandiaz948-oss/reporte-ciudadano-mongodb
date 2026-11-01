"""Catálogos de dominio compartidos por la API, las validaciones y el seed."""

CATEGORIAS = [
    "bache",
    "alumbrado",
    "basura",
    "agua_potable",
    "alcantarillado",
    "arbol_caido",
    "semaforo",
    "seguridad_vial",
    "ruido",
    "otro",
]

PRIORIDADES = ["baja", "media", "alta", "critica"]
NIVEL_PRIORIDAD = {p: i + 1 for i, p in enumerate(PRIORIDADES)}

ESTADOS = ["recibido", "en_revision", "asignado", "en_proceso", "resuelto", "rechazado"]
ESTADOS_CERRADOS = ["resuelto", "rechazado"]

# Máquina de estados del reporte: estado actual -> estados permitidos
TRANSICIONES = {
    "recibido": ["en_revision", "rechazado"],
    "en_revision": ["asignado", "rechazado"],
    "asignado": ["en_proceso", "rechazado"],
    "en_proceso": ["resuelto"],
    "resuelto": ["en_proceso"],  # reapertura si el problema persiste
    "rechazado": [],
}

TIPOS_INSTITUCION = ["alcaldia", "autonoma", "ministerio", "distribuidora", "emergencias"]

TIPOS_EVIDENCIA = ["foto", "video", "documento"]

# Distritos municipales vigentes desde 2024 (44 municipios) con centro aproximado (lat, lng)
DEPARTAMENTOS = {
    "Ahuachapán": {"centro": (13.92, -89.85), "municipios": ["Ahuachapán Norte", "Ahuachapán Centro", "Ahuachapán Sur"]},
    "Santa Ana": {"centro": (13.99, -89.56), "municipios": ["Santa Ana Norte", "Santa Ana Centro", "Santa Ana Este", "Santa Ana Oeste"]},
    "Sonsonate": {"centro": (13.72, -89.72), "municipios": ["Sonsonate Norte", "Sonsonate Centro", "Sonsonate Este", "Sonsonate Oeste"]},
    "Chalatenango": {"centro": (14.04, -88.94), "municipios": ["Chalatenango Norte", "Chalatenango Centro", "Chalatenango Sur"]},
    "La Libertad": {"centro": (13.68, -89.29), "municipios": ["La Libertad Norte", "La Libertad Centro", "La Libertad Oeste", "La Libertad Este", "La Libertad Costa", "La Libertad Sur"]},
    "San Salvador": {"centro": (13.70, -89.20), "municipios": ["San Salvador Norte", "San Salvador Oeste", "San Salvador Este", "San Salvador Centro", "San Salvador Sur"]},
    "Cuscatlán": {"centro": (13.72, -88.93), "municipios": ["Cuscatlán Norte", "Cuscatlán Sur"]},
    "La Paz": {"centro": (13.50, -88.95), "municipios": ["La Paz Oeste", "La Paz Centro", "La Paz Este"]},
    "Cabañas": {"centro": (13.86, -88.74), "municipios": ["Cabañas Este", "Cabañas Oeste"]},
    "San Vicente": {"centro": (13.64, -88.78), "municipios": ["San Vicente Norte", "San Vicente Sur"]},
    "Usulután": {"centro": (13.35, -88.44), "municipios": ["Usulután Norte", "Usulután Este", "Usulután Oeste"]},
    "San Miguel": {"centro": (13.48, -88.18), "municipios": ["San Miguel Norte", "San Miguel Centro", "San Miguel Oeste"]},
    "Morazán": {"centro": (13.77, -88.13), "municipios": ["Morazán Norte", "Morazán Sur"]},
    "La Unión": {"centro": (13.34, -87.84), "municipios": ["La Unión Norte", "La Unión Sur"]},
}

# Límites geográficos aproximados de El Salvador (usados en $jsonSchema)
LNG_MIN, LNG_MAX = -90.2, -87.6
LAT_MIN, LAT_MAX = 13.1, 14.5


def municipio_valido(departamento: str, municipio: str) -> bool:
    return municipio in DEPARTAMENTOS.get(departamento, {}).get("municipios", [])
