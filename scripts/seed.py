"""Carga datos ficticios pero realistas de El Salvador.

  - 57 instituciones (44 alcaldías de distrito + autónomas, ministerios, distribuidoras, emergencias)
  - 100 ciudadanos
  - 400 reportes con historial, evidencias, apoyos y calificaciones coherentes

ATENCIÓN: borra y vuelve a crear las colecciones. Uso:  python -m scripts.seed
"""
import random
import unicodedata
from datetime import timedelta

from bson import ObjectId

from app.catalogos import (CATEGORIAS, DEPARTAMENTOS, NIVEL_PRIORIDAD, PRIORIDADES)
from app.db import db
from app.servicios import buscar_institucion
from app.utils import ahora
from scripts.init_db import crear_colecciones, crear_indices

rnd = random.Random(2026)  # semilla fija: los mismos datos en cada carga
AHORA = ahora()
N_CIUDADANOS = 100
N_REPORTES = 400


def slug(texto: str) -> str:
    sin_tildes = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    return sin_tildes.upper().replace(" ", "-")


# ---------------------------------------------------------------- instituciones
def generar_instituciones() -> list[dict]:
    instituciones = []
    for depto, info in DEPARTAMENTOS.items():
        for muni in info["municipios"]:
            instituciones.append({
                "codigo": f"AM-{slug(muni)}",
                "nombre": f"Alcaldía Municipal de {muni}",
                "tipo": "alcaldia",
                "categoriasAtendidas": ["bache", "basura", "arbol_caido", "ruido", "otro"],
                "cobertura": {"nacional": False, "departamentos": [depto], "municipios": [muni]},
                "contacto": {"telefono": f"2{rnd.randint(100, 999)}-{rnd.randint(1000, 9999)}",
                             "email": f"atencion@{slug(muni).lower()}.gob.sv"},
                "activa": True,
            })

    def otra(codigo, nombre, tipo, categorias, departamentos=None, telefono=None):
        return {
            "codigo": codigo, "nombre": nombre, "tipo": tipo, "categoriasAtendidas": categorias,
            "cobertura": {"nacional": departamentos is None, "departamentos": departamentos or [], "municipios": []},
            "contacto": {"telefono": telefono, "email": f"reportes@{codigo.lower()}.gob.sv"},
            "activa": True,
        }

    instituciones += [
        otra("ANDA", "Administración Nacional de Acueductos y Alcantarillados", "autonoma",
             ["agua_potable", "alcantarillado"], telefono="2247-2700"),
        otra("MOP", "Ministerio de Obras Públicas y de Transporte", "ministerio", ["bache"], telefono="2528-3000"),
        otra("FOVIAL", "Fondo de Conservación Vial", "autonoma", ["bache"], telefono="2528-3600"),
        otra("VMT", "Viceministerio de Transporte", "ministerio", ["semaforo", "seguridad_vial"], telefono="2528-9300"),
        otra("PNC-TRANSITO", "PNC - División de Tránsito Terrestre", "ministerio", ["seguridad_vial", "ruido"], telefono="911"),
        otra("MARN", "Ministerio de Medio Ambiente y Recursos Naturales", "ministerio", ["basura", "ruido"], telefono="2132-6276"),
        otra("BOMBEROS", "Cuerpo de Bomberos de El Salvador", "emergencias", ["arbol_caido"], telefono="913"),
        otra("PROTECCION-CIVIL", "Dirección General de Protección Civil", "emergencias", ["arbol_caido", "otro"], telefono="2201-2424"),
        otra("CAESS", "CAESS - Distribuidora eléctrica", "distribuidora", ["alumbrado"],
             ["San Salvador", "Chalatenango", "Cuscatlán", "Cabañas"], "2529-9999"),
        otra("DELSUR", "DELSUR - Distribuidora eléctrica", "distribuidora", ["alumbrado"],
             ["La Libertad", "La Paz", "San Vicente"], "2233-5400"),
        otra("AES-CLESA", "AES CLESA - Distribuidora eléctrica", "distribuidora", ["alumbrado"],
             ["Santa Ana", "Ahuachapán", "Sonsonate"], "2429-4000"),
        otra("EEO", "EEO - Empresa Eléctrica de Oriente", "distribuidora", ["alumbrado"],
             ["San Miguel", "Morazán", "La Unión"], "2606-8000"),
        otra("DEUSEM", "DEUSEM - Distribuidora eléctrica", "distribuidora", ["alumbrado"], ["Usulután"], "2662-0000"),
    ]
    return instituciones


# ---------------------------------------------------------------- ciudadanos
NOMBRES = ["José", "María", "Carlos", "Ana", "Luis", "Rosa", "Juan", "Carmen", "Jorge", "Sofía", "Miguel",
           "Gabriela", "Francisco", "Daniela", "Roberto", "Valeria", "Óscar", "Andrea", "Mario", "Fátima",
           "Ricardo", "Karla", "Ernesto", "Marcela", "Kevin", "Alejandra", "Christian", "Jennifer", "René", "Lucía"]
APELLIDOS = ["Hernández", "Martínez", "López", "García", "Rodríguez", "Pérez", "Ramírez", "Flores", "Cruz",
             "Rivera", "Mejía", "Portillo", "Alvarado", "Guardado", "Romero", "Aguilar", "Menjívar", "Orellana",
             "Ayala", "Chávez", "Escobar", "Molina", "Bonilla", "Castillo", "Díaz", "Guevara"]
COLONIAS = ["Colonia Escalón", "Residencial Los Héroes", "Barrio El Centro", "Colonia Miramonte", "Lotificación Las Brisas",
            "Urbanización La Cima", "Colonia San Benito", "Reparto Santa Fe", "Cantón El Rosario", "Colonia Las Margaritas"]


def generar_dui(usados: set) -> str:
    while True:
        base = [rnd.randint(0, 9) for _ in range(8)]
        suma = sum(d * p for d, p in zip(base, range(9, 1, -1)))
        verificador = (10 - suma % 10) % 10
        dui = "".join(map(str, base)) + f"-{verificador}"
        if dui not in usados:
            usados.add(dui)
            return dui


def generar_ciudadanos() -> list[dict]:
    ciudadanos, duis, correos = [], set(), set()
    for _ in range(N_CIUDADANOS):
        nombre = f"{rnd.choice(NOMBRES)} {rnd.choice(APELLIDOS)} {rnd.choice(APELLIDOS)}"
        base_correo = slug(nombre).lower().replace("-", ".")
        correo, n = f"{base_correo}@correo.sv", 1
        while correo in correos:
            n += 1
            correo = f"{base_correo}{n}@correo.sv"
        correos.add(correo)
        depto = rnd.choices(list(DEPARTAMENTOS), weights=[4, 6, 5, 3, 8, 14, 3, 4, 2, 2, 4, 6, 2, 3])[0]
        ciudadanos.append({
            "_id": ObjectId(),
            "dui": generar_dui(duis),
            "nombre": nombre,
            "email": correo,
            "telefono": f"{rnd.choice('67')}{rnd.randint(100, 999)}-{rnd.randint(1000, 9999)}",
            "direccion": {"departamento": depto, "municipio": rnd.choice(DEPARTAMENTOS[depto]["municipios"]),
                          "colonia": rnd.choice(COLONIAS)},
            "fechaRegistro": AHORA - timedelta(days=rnd.randint(370, 900)),
            "estadisticas": {"totalReportes": 0, "ultimoReporte": None},
        })
    return ciudadanos


# ---------------------------------------------------------------- reportes
PLANTILLAS = {
    "bache": (["Bache profundo en calle principal", "Hundimiento en carril", "Baches frente a {lugar}"],
              "Hay un bache de gran tamaño que obliga a los vehículos a invadir el otro carril. Con la lluvia se llena de agua y no se ve.",
              ["via_principal", "lluvia", "peligro"]),
    "alumbrado": (["Lámpara apagada en pasaje", "Zona sin alumbrado público", "Poste de luz parpadeando cerca de {lugar}"],
                  "La calle queda completamente oscura por la noche, los vecinos temen por su seguridad al regresar a casa.",
                  ["seguridad", "noche"]),
    "basura": (["Acumulación de basura en esquina", "Botadero ilegal junto a {lugar}", "Camión recolector no pasa"],
               "Se acumula basura desde hace varios días, hay malos olores y presencia de zancudos y perros callejeros.",
               ["salud", "zancudos", "malos_olores"]),
    "agua_potable": (["Fuga de agua potable", "Colonia sin servicio de agua", "Tubería rota frente a {lugar}"],
                     "Hay una fuga constante de agua potable que se desperdicia en la calle, mientras varias casas no tienen servicio.",
                     ["fuga", "desperdicio"]),
    "alcantarillado": (["Tragante tapado", "Aguas negras en la calle", "Alcantarilla sin tapadera cerca de {lugar}"],
                       "Las aguas negras corren por la calle y el tragante está obstruido, cuando llueve se inunda el pasaje.",
                       ["inundacion", "salud", "lluvia"]),
    "arbol_caido": (["Árbol caído obstruye la vía", "Rama a punto de caer sobre cables", "Árbol caído junto a {lugar}"],
                    "Después de la tormenta un árbol cayó y bloquea el paso de vehículos y peatones, hay cables enredados.",
                    ["tormenta", "cables", "peligro"]),
    "semaforo": (["Semáforo dañado en intersección", "Semáforo intermitente en hora pico", "Semáforo sin luz roja cerca de {lugar}"],
                 "El semáforo no funciona y en hora pico se forman congestionamientos y casi accidentes.",
                 ["trafico", "peligro"]),
    "seguridad_vial": (["Falta señalización de paso peatonal", "Túmulo sin pintar", "Vehículos a exceso de velocidad frente a {lugar}"],
                       "No hay señalización y los vehículos pasan a alta velocidad donde cruzan niños y adultos mayores.",
                       ["peatones", "escuela", "trafico"]),
    "ruido": (["Ruido excesivo de bar nocturno", "Taller con ruido toda la noche", "Música a alto volumen cerca de {lugar}"],
              "Ruido excesivo después de las 10 p.m. todos los fines de semana, los vecinos no pueden descansar.",
              ["noche", "convivencia"]),
    "otro": (["Muro con riesgo de derrumbe", "Animal muerto en la vía", "Cableado colgando frente a {lugar}"],
             "Situación de riesgo para la comunidad que requiere revisión de las autoridades correspondientes.",
             ["riesgo"]),
}
LUGARES = ["la escuela", "el parque central", "la iglesia", "la unidad de salud", "el mercado municipal",
           "la parada de buses", "el centro comercial", "la cancha comunal"]
PESO_CATEGORIAS = [22, 14, 16, 12, 8, 6, 5, 7, 5, 5]
PESO_PRIORIDADES = [20, 45, 25, 10]
# Horas promedio de resolución según el tipo de institución
HORAS_BASE = {"alcaldia": 70, "distribuidora": 55, "autonoma": 130, "ministerio": 210, "emergencias": 18}
FACTOR_PRIORIDAD = {"baja": 1.6, "media": 1.0, "alta": 0.6, "critica": 0.3}
ACTOR_SISTEMA = "Sistema"
COMENTARIOS = {
    "en_revision": "Reporte validado por el centro de atención.",
    "asignado": "Remitido a la institución responsable.",
    "en_proceso": "Cuadrilla programada para atender el caso.",
    "resuelto": "Trabajo finalizado y verificado en campo.",
    "rechazado": "Reporte duplicado o fuera de competencia.",
}


def punto_en(depto: str) -> list[float]:
    lat, lng = DEPARTAMENTOS[depto]["centro"]
    return [round(lng + rnd.uniform(-0.08, 0.08), 6), round(lat + rnd.uniform(-0.06, 0.06), 6)]


def generar_reportes(ciudadanos: list[dict], tipos_inst: dict) -> list[dict]:
    reportes = []
    ids_ciudadanos = [c["_id"] for c in ciudadanos]
    for i in range(1, N_REPORTES + 1):
        autor = rnd.choice(ciudadanos)
        # 75 % de las veces reporta en su propio municipio
        if rnd.random() < 0.75:
            depto, muni = autor["direccion"]["departamento"], autor["direccion"]["municipio"]
        else:
            depto = rnd.choice(list(DEPARTAMENTOS))
            muni = rnd.choice(DEPARTAMENTOS[depto]["municipios"])
        categoria = rnd.choices(CATEGORIAS, weights=PESO_CATEGORIAS)[0]
        prioridad = rnd.choices(PRIORIDADES, weights=PESO_PRIORIDADES)[0]
        titulos, descripcion, etiquetas_base = PLANTILLAS[categoria]
        lugar = rnd.choice(LUGARES)
        titulo = rnd.choice(titulos).format(lugar=lugar)
        # Distribución sesgada a fechas recientes (más actividad en los últimos meses)
        dias_atras = int(rnd.betavariate(1, 2.2) * 364)
        creado = AHORA - timedelta(days=dias_atras, hours=rnd.randint(0, 23), minutes=rnd.randint(0, 59))
        institucion = buscar_institucion(db, categoria, depto, muni)

        # Recorre la máquina de estados con tiempos coherentes
        historial = [{"estado": "recibido", "fecha": creado, "actor": autor["nombre"],
                      "comentario": "Reporte creado desde la app."}]
        estado, fecha = "recibido", creado
        horas_total = rnd.lognormvariate(0, 0.5) * HORAS_BASE[tipos_inst[institucion["_id"]]] * FACTOR_PRIORIDAD[prioridad]
        rechazar = rnd.random() < 0.07
        # Rezago: ~25 % de los casos se queda detenido en alguna etapa (como en la vida real)
        etapa_tope = rnd.choice(["en_revision", "asignado", "asignado", "en_proceso"]) if rnd.random() < 0.25 else None
        for siguiente, fraccion in [("en_revision", 0.1), ("asignado", 0.15), ("en_proceso", 0.35), ("resuelto", 0.4)]:
            if rechazar and siguiente == "asignado":
                siguiente = "rechazado"
            nueva_fecha = fecha + timedelta(hours=max(0.5, horas_total * fraccion))
            if nueva_fecha > AHORA:
                break
            actor = ACTOR_SISTEMA if siguiente in ("en_revision", "rechazado") else institucion["nombre"]
            historial.append({"estado": siguiente, "fecha": nueva_fecha, "actor": actor,
                              "comentario": COMENTARIOS[siguiente]})
            estado, fecha = siguiente, nueva_fecha
            if siguiente in ("rechazado", etapa_tope):
                break

        n_apoyos = min(int(rnd.expovariate(1 / 4)), 30)
        apoyos = rnd.sample([c for c in ids_ciudadanos if c != autor["_id"]], n_apoyos)
        folio = f"RC-{creado.year}-{i:06d}"
        evidencias = [{"url": f"https://storage.reporteciudadano.sv/evidencias/{folio}-{n}.jpg",
                       "tipo": rnd.choices(["foto", "video"], weights=[85, 15])[0],
                       "fechaSubida": creado}
                      for n in range(1, rnd.choice([0, 1, 1, 2, 3]) + 1)]

        reporte = {
            "folio": folio,
            "titulo": titulo,
            "descripcion": descripcion,
            "categoria": categoria,
            "prioridad": prioridad,
            "nivelPrioridad": NIVEL_PRIORIDAD[prioridad],
            "estado": estado,
            "ubicacion": {"type": "Point", "coordinates": punto_en(depto)},
            "direccion": {"departamento": depto, "municipio": muni, "referencia": f"Cerca de {lugar}"},
            "ciudadanoId": autor["_id"],
            "institucion": institucion,
            "historial": historial,
            "evidencias": evidencias,
            "apoyos": apoyos,
            "totalApoyos": len(apoyos),
            "etiquetas": rnd.sample(etiquetas_base, rnd.randint(1, len(etiquetas_base))),
            "fechaCreacion": creado,
            "fechaActualizacion": fecha,
            "fechaResolucion": fecha if estado == "resuelto" else None,
        }
        if estado == "resuelto" and rnd.random() < 0.65:
            # Más rápido = mejor calificación (con algo de ruido)
            dias = (fecha - creado).total_seconds() / 86400
            puntaje = max(1, min(5, round(5 - dias / 4 + rnd.uniform(-1, 1))))
            reporte["calificacion"] = {"puntaje": puntaje, "fecha": fecha + timedelta(hours=rnd.randint(1, 48)),
                                       "comentario": rnd.choice([None, "Gracias por la atención.", "Tardaron mucho.",
                                                                 "Excelente trabajo.", "Quedó a medias."])}
            if reporte["calificacion"]["fecha"] > AHORA:
                del reporte["calificacion"]
        reportes.append(reporte)
    return reportes


def recalcular_estadisticas() -> None:
    """Patrón Computed con $merge: escribe los contadores en cada ciudadano."""
    db.reportes.aggregate([
        {"$group": {"_id": "$ciudadanoId", "total": {"$sum": 1}, "ultimo": {"$max": "$fechaCreacion"}}},
        {"$project": {"estadisticas": {"totalReportes": "$total", "ultimoReporte": "$ultimo"}}},
        {"$merge": {"into": "ciudadanos", "on": "_id", "whenMatched": "merge", "whenNotMatched": "discard"}},
    ])


def main() -> None:
    print(f"Sembrando base '{db.name}' (se borran los datos anteriores)...")
    for nombre in ("reportes", "ciudadanos", "instituciones", "contadores"):
        db.drop_collection(nombre)
    crear_colecciones()
    crear_indices()

    instituciones = generar_instituciones()
    db.instituciones.insert_many(instituciones)
    tipos_inst = {i["_id"]: i["tipo"] for i in instituciones}

    ciudadanos = generar_ciudadanos()
    db.ciudadanos.insert_many(ciudadanos)

    reportes = generar_reportes(ciudadanos, tipos_inst)
    db.reportes.insert_many(reportes)
    db.contadores.insert_one({"_id": "folio_reportes", "secuencia": N_REPORTES})
    recalcular_estadisticas()

    print(f"  instituciones: {db.instituciones.count_documents({})}")
    print(f"  ciudadanos:    {db.ciudadanos.count_documents({})}")
    print(f"  reportes:      {db.reportes.count_documents({})}")
    print("Listo.")


if __name__ == "__main__":
    main()
