"""Carga datos de prueba ficticios:

  - 57 instituciones (44 alcaldías + ANDA, MOP, VMT, distribuidoras eléctricas, etc.)
  - 15 ciudadanos
  - 20 reportes con historial, evidencias, apoyos y calificaciones

ATENCIÓN: borra y vuelve a crear las colecciones. Uso:  python -m scripts.seed
"""
import random
from datetime import timedelta

from bson import ObjectId

from app.catalogos import CATEGORIAS, DEPARTAMENTOS, NIVEL_PRIORIDAD, PRIORIDADES
from app.db import db
from app.servicios import buscar_institucion
from app.utils import ahora
from scripts.init_db import crear_colecciones, crear_indices

random.seed(2026)  # semilla fija: cada vez que se corre se generan los mismos datos
AHORA = ahora()


def codigo_de(texto: str) -> str:
    """'San Salvador Centro' -> 'SAN-SALVADOR-CENTRO' (sin tildes)."""
    sin_tildes = texto.translate(str.maketrans("áéíóúñÁÉÍÓÚÑ", "aeiounAEIOUN"))
    return sin_tildes.upper().replace(" ", "-")


# ------------------------------------------------------------------ instituciones
def generar_instituciones() -> list[dict]:
    instituciones = []

    # Una alcaldía por cada uno de los 44 municipios
    for departamento, info in DEPARTAMENTOS.items():
        for municipio in info["municipios"]:
            instituciones.append({
                "codigo": "AM-" + codigo_de(municipio),
                "nombre": f"Alcaldía Municipal de {municipio}",
                "tipo": "alcaldia",
                "categoriasAtendidas": ["bache", "basura", "arbol_caido", "ruido", "otro"],
                "cobertura": {"nacional": False, "departamentos": [departamento], "municipios": [municipio]},
                "contacto": {"telefono": None, "email": f"atencion@{codigo_de(municipio).lower()}.gob.sv"},
                "activa": True,
            })

    # Instituciones nacionales o por departamento: (código, nombre, tipo, categorías, departamentos)
    otras = [
        ("ANDA", "Administración Nacional de Acueductos y Alcantarillados", "autonoma", ["agua_potable", "alcantarillado"], None),
        ("MOP", "Ministerio de Obras Públicas y de Transporte", "ministerio", ["bache"], None),
        ("FOVIAL", "Fondo de Conservación Vial", "autonoma", ["bache"], None),
        ("VMT", "Viceministerio de Transporte", "ministerio", ["semaforo", "seguridad_vial"], None),
        ("PNC-TRANSITO", "PNC - División de Tránsito Terrestre", "ministerio", ["seguridad_vial", "ruido"], None),
        ("MARN", "Ministerio de Medio Ambiente y Recursos Naturales", "ministerio", ["basura", "ruido"], None),
        ("BOMBEROS", "Cuerpo de Bomberos de El Salvador", "emergencias", ["arbol_caido"], None),
        ("PROTECCION-CIVIL", "Dirección General de Protección Civil", "emergencias", ["arbol_caido", "otro"], None),
        ("CAESS", "CAESS - Distribuidora eléctrica", "distribuidora", ["alumbrado"], ["San Salvador", "Chalatenango", "Cuscatlán", "Cabañas"]),
        ("DELSUR", "DELSUR - Distribuidora eléctrica", "distribuidora", ["alumbrado"], ["La Libertad", "La Paz", "San Vicente"]),
        ("AES-CLESA", "AES CLESA - Distribuidora eléctrica", "distribuidora", ["alumbrado"], ["Santa Ana", "Ahuachapán", "Sonsonate"]),
        ("EEO", "EEO - Empresa Eléctrica de Oriente", "distribuidora", ["alumbrado"], ["San Miguel", "Morazán", "La Unión"]),
        ("DEUSEM", "DEUSEM - Distribuidora eléctrica", "distribuidora", ["alumbrado"], ["Usulután"]),
    ]
    for codigo, nombre, tipo, categorias, departamentos in otras:
        instituciones.append({
            "codigo": codigo,
            "nombre": nombre,
            "tipo": tipo,
            "categoriasAtendidas": categorias,
            "cobertura": {"nacional": departamentos is None, "departamentos": departamentos or [], "municipios": []},
            "contacto": {"telefono": None, "email": f"reportes@{codigo.lower()}.gob.sv"},
            "activa": True,
        })
    return instituciones


# ------------------------------------------------------------------ ciudadanos
NOMBRES = ["José", "María", "Carlos", "Ana", "Luis", "Rosa", "Juan", "Carmen", "Jorge", "Sofía", "Miguel",
           "Gabriela", "Francisco", "Daniela", "Roberto", "Valeria", "Óscar", "Andrea", "Mario", "Fátima"]
APELLIDOS = ["Hernández", "Martínez", "López", "García", "Rodríguez", "Pérez", "Ramírez", "Flores", "Cruz",
             "Rivera", "Mejía", "Portillo", "Alvarado", "Guardado", "Romero", "Aguilar", "Menjívar", "Orellana"]
COLONIAS = ["Colonia Escalón", "Residencial Los Héroes", "Barrio El Centro", "Colonia Miramonte",
            "Urbanización La Cima", "Reparto Santa Fe", "Cantón El Rosario", "Colonia Las Margaritas"]


def generar_ciudadanos(cantidad: int) -> list[dict]:
    ciudadanos = []
    for i in range(cantidad):
        nombre = f"{random.choice(NOMBRES)} {random.choice(APELLIDOS)} {random.choice(APELLIDOS)}"
        departamento = random.choice(list(DEPARTAMENTOS))
        ciudadanos.append({
            "_id": ObjectId(),  # se genera aquí para poder usarlo en los reportes
            "dui": f"{random.randint(0, 99999999):08d}-{random.randint(0, 9)}",
            "nombre": nombre,
            "email": f"ciudadano{i + 1}@correo.sv",  # único y sencillo
            "telefono": f"7{random.randint(100, 999)}-{random.randint(1000, 9999)}",
            "direccion": {
                "departamento": departamento,
                "municipio": random.choice(DEPARTAMENTOS[departamento]["municipios"]),
                "colonia": random.choice(COLONIAS),
            },
            "fechaRegistro": AHORA - timedelta(days=random.randint(400, 900)),
            "estadisticas": {"totalReportes": 0, "ultimoReporte": None},
        })
    return ciudadanos


# ------------------------------------------------------------------ reportes
# Por categoría: (títulos posibles, descripción, etiquetas posibles)
PLANTILLAS = {
    "bache": (["Bache profundo en calle principal", "Hundimiento en el carril", "Baches frente a la escuela"],
              "Hay un bache grande que obliga a los vehículos a invadir el otro carril.", ["via_principal", "lluvia", "peligro"]),
    "alumbrado": (["Lámpara apagada en pasaje", "Zona sin alumbrado público", "Poste de luz parpadeando"],
                  "La calle queda completamente oscura por la noche y es peligroso caminar.", ["seguridad", "noche"]),
    "basura": (["Acumulación de basura en esquina", "Botadero ilegal junto al parque", "El camión recolector no pasa"],
               "Se acumula basura desde hace varios días, hay malos olores y zancudos.", ["salud", "zancudos"]),
    "agua_potable": (["Fuga de agua potable", "Colonia sin servicio de agua", "Tubería rota en la calle"],
                     "Hay una fuga de agua potable que se desperdicia mientras varias casas no tienen servicio.", ["fuga", "desperdicio"]),
    "alcantarillado": (["Tragante tapado", "Aguas negras en la calle", "Alcantarilla sin tapadera"],
                       "Las aguas negras corren por la calle y cuando llueve se inunda el pasaje.", ["inundacion", "salud", "lluvia"]),
    "arbol_caido": (["Árbol caído obstruye la vía", "Rama a punto de caer sobre cables"],
                    "Después de la tormenta un árbol bloquea el paso de vehículos y peatones.", ["tormenta", "peligro"]),
    "semaforo": (["Semáforo dañado en intersección", "Semáforo intermitente en hora pico"],
                 "El semáforo no funciona y en hora pico se forman congestionamientos.", ["trafico", "peligro"]),
    "seguridad_vial": (["Falta señalización de paso peatonal", "Túmulo sin pintar"],
                       "No hay señalización y los vehículos pasan rápido donde cruzan niños.", ["peatones", "escuela"]),
    "ruido": (["Ruido excesivo de bar nocturno", "Música a alto volumen todas las noches"],
              "Ruido excesivo después de las 10 p.m., los vecinos no pueden descansar.", ["noche", "convivencia"]),
    "otro": (["Muro con riesgo de derrumbe", "Cableado colgando en la acera"],
             "Situación de riesgo para la comunidad que necesita revisión.", ["riesgo"]),
}

# Camino normal de un reporte; se corta en el estado final elegido
FLUJO = ["recibido", "en_revision", "asignado", "en_proceso", "resuelto"]
# Probabilidad de cada estado final (porcentajes aproximados)
ESTADOS_FINALES = ["recibido", "en_revision", "asignado", "en_proceso", "resuelto", "rechazado"]
PESOS_ESTADO = [10, 10, 15, 15, 40, 10]
# Las instituciones nacionales tardan más que las locales (multiplica las horas de cada paso)
LENTITUD = {"alcaldia": 1, "distribuidora": 1, "emergencias": 0.5, "autonoma": 2, "ministerio": 2.5}


def generar_reportes(cantidad: int, ciudadanos: list[dict], tipo_institucion: dict) -> list[dict]:
    reportes = []
    for i in range(1, cantidad + 1):
        autor = random.choice(ciudadanos)
        departamento = autor["direccion"]["departamento"]
        municipio = autor["direccion"]["municipio"]
        categoria = random.choice(CATEGORIAS)
        prioridad = random.choices(PRIORIDADES, weights=[20, 45, 25, 10])[0]
        titulos, descripcion, etiquetas = PLANTILLAS[categoria]
        institucion = buscar_institucion(db, categoria, departamento, municipio)

        estado_final = random.choices(ESTADOS_FINALES, weights=PESOS_ESTADO)[0]
        # Fechas coherentes: los cerrados son más antiguos y los recién recibidos, muy recientes
        if estado_final in ("resuelto", "rechazado"):
            dias_atras = random.randint(20, 364)
        elif estado_final == "recibido":
            dias_atras = random.randint(0, 10)
        else:
            dias_atras = random.randint(12, 60)
        creado = AHORA - timedelta(days=dias_atras, hours=random.randint(0, 23))

        # Construir el historial paso a paso hasta el estado final
        historial = [{"estado": "recibido", "fecha": creado, "actor": autor["nombre"], "comentario": None}]
        fecha = creado
        pasos = ["en_revision", "rechazado"] if estado_final == "rechazado" else FLUJO[1:FLUJO.index(estado_final) + 1]
        for estado in pasos:
            horas = random.randint(4, 36) * LENTITUD[tipo_institucion[institucion["_id"]]]
            fecha = fecha + timedelta(hours=horas)
            actor = "Centro de atención" if estado in ("en_revision", "rechazado") else institucion["nombre"]
            historial.append({"estado": estado, "fecha": fecha, "actor": actor, "comentario": None})

        # Otros ciudadanos que apoyan el reporte (sin incluir al autor)
        otros = [c["_id"] for c in ciudadanos if c["_id"] != autor["_id"]]
        apoyos = random.sample(otros, random.randint(0, 5))

        folio = f"RC-{creado.year}-{i:06d}"
        reporte = {
            "folio": folio,
            "titulo": random.choice(titulos),
            "descripcion": descripcion,
            "categoria": categoria,
            "prioridad": prioridad,
            "nivelPrioridad": NIVEL_PRIORIDAD[prioridad],
            "estado": estado_final,
            "ubicacion": {
                "latitud": round(DEPARTAMENTOS[departamento]["centro"][0] + random.uniform(-0.05, 0.05), 6),
                "longitud": round(DEPARTAMENTOS[departamento]["centro"][1] + random.uniform(-0.05, 0.05), 6),
            },
            "direccion": {"departamento": departamento, "municipio": municipio, "referencia": None},
            "ciudadanoId": autor["_id"],
            "institucion": institucion,
            "historial": historial,
            "evidencias": [{"url": f"https://fotos.reporteciudadano.sv/{folio}-{n}.jpg", "tipo": "foto",
                            "fechaSubida": creado} for n in range(random.randint(0, 3))],
            "apoyos": apoyos,
            "totalApoyos": len(apoyos),
            "etiquetas": random.sample(etiquetas, random.randint(1, len(etiquetas))),
            "fechaCreacion": creado,
            "fechaActualizacion": fecha,
            "fechaResolucion": fecha if estado_final == "resuelto" else None,
        }
        # 2 de cada 3 reportes resueltos tienen calificación del autor
        if estado_final == "resuelto" and random.random() < 0.66:
            reporte["calificacion"] = {"puntaje": random.choices([1, 2, 3, 4, 5], weights=[5, 8, 17, 35, 35])[0],
                                       "comentario": None, "fecha": fecha}
        reportes.append(reporte)

        # Actualizar los contadores del autor
        autor["estadisticas"]["totalReportes"] += 1
        ultimo = autor["estadisticas"]["ultimoReporte"]
        if ultimo is None or creado > ultimo:
            autor["estadisticas"]["ultimoReporte"] = creado
    return reportes


def main() -> None:
    print(f"Cargando datos en '{db.name}' (se borran los datos anteriores)...")
    for nombre in ("reportes", "ciudadanos", "instituciones", "contadores"):
        db.drop_collection(nombre)
    crear_colecciones()
    crear_indices()

    instituciones = generar_instituciones()
    db.instituciones.insert_many(instituciones)  # insert_many agrega el _id a cada diccionario
    tipo_institucion = {inst["_id"]: inst["tipo"] for inst in instituciones}

    ciudadanos = generar_ciudadanos(15)
    reportes = generar_reportes(20, ciudadanos, tipo_institucion)
    db.ciudadanos.insert_many(ciudadanos)  # ya llevan sus estadísticas calculadas
    db.reportes.insert_many(reportes)
    db.contadores.insert_one({"_id": "folio_reportes", "secuencia": len(reportes)})

    print(f"  instituciones: {db.instituciones.count_documents({})}")
    print(f"  ciudadanos:    {db.ciudadanos.count_documents({})}")
    print(f"  reportes:      {db.reportes.count_documents({})}")
    print("Listo.")


if __name__ == "__main__":
    main()
