"""Modelos de entrada de la API.

FastAPI revisa con estos modelos los datos que llegan (primera validación) y MongoDB vuelve a
validarlos con el $jsonSchema de cada colección (segunda validación).
"""
from typing import Literal

from pydantic import BaseModel, Field

from app.catalogos import LAT_MAX, LAT_MIN, LNG_MAX, LNG_MIN

Categoria = Literal["bache", "alumbrado", "basura", "agua_potable", "alcantarillado",
                    "arbol_caido", "semaforo", "seguridad_vial", "ruido", "otro"]
Prioridad = Literal["baja", "media", "alta", "critica"]
Estado = Literal["recibido", "en_revision", "asignado", "en_proceso", "resuelto", "rechazado"]
TipoInstitucion = Literal["alcaldia", "autonoma", "ministerio", "distribuidora", "emergencias"]
TipoEvidencia = Literal["foto", "video", "documento"]

PATRON_DUI = r"^[0-9]{8}-[0-9]$"
PATRON_EMAIL = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
PATRON_TELEFONO = r"^[267][0-9]{3}-[0-9]{4}$"


# ---------- Ciudadanos ----------
class Direccion(BaseModel):
    departamento: str = Field(examples=["San Salvador"])
    municipio: str = Field(examples=["San Salvador Centro"])
    colonia: str | None = Field(default=None, max_length=120, examples=["Colonia Escalón"])


class CiudadanoCrear(BaseModel):
    dui: str = Field(pattern=PATRON_DUI, examples=["04567891-2"])
    nombre: str = Field(min_length=3, max_length=100, examples=["Ana Lucía Martínez"])
    email: str = Field(pattern=PATRON_EMAIL, examples=["ana.martinez@correo.sv"])
    telefono: str | None = Field(default=None, pattern=PATRON_TELEFONO, examples=["7123-4567"])
    direccion: Direccion


class CiudadanoActualizar(BaseModel):
    nombre: str | None = Field(default=None, min_length=3, max_length=100)
    email: str | None = Field(default=None, pattern=PATRON_EMAIL)
    telefono: str | None = Field(default=None, pattern=PATRON_TELEFONO)
    direccion: Direccion | None = None


# ---------- Instituciones ----------
class Cobertura(BaseModel):
    nacional: bool = False
    departamentos: list[str] = []
    municipios: list[str] = []


class Contacto(BaseModel):
    telefono: str | None = None
    email: str | None = Field(default=None, pattern=PATRON_EMAIL)


class InstitucionCrear(BaseModel):
    codigo: str = Field(min_length=2, max_length=40, examples=["AM-SAN-SALVADOR-CENTRO"])
    nombre: str = Field(min_length=3, max_length=150)
    tipo: TipoInstitucion
    categoriasAtendidas: list[Categoria] = Field(min_length=1)
    cobertura: Cobertura
    contacto: Contacto | None = None


class InstitucionActualizar(BaseModel):
    nombre: str | None = Field(default=None, min_length=3, max_length=150)
    categoriasAtendidas: list[Categoria] | None = Field(default=None, min_length=1)
    cobertura: Cobertura | None = None
    contacto: Contacto | None = None
    activa: bool | None = None


# ---------- Reportes ----------
class EvidenciaIn(BaseModel):
    url: str = Field(pattern=r"^https?://", examples=["https://storage.reporteciudadano.sv/evidencias/foto1.jpg"])
    tipo: TipoEvidencia = "foto"


class ReporteCrear(BaseModel):
    ciudadanoId: str
    titulo: str = Field(min_length=5, max_length=120, examples=["Bache profundo frente a escuela"])
    descripcion: str = Field(min_length=10, max_length=2000,
                             examples=["Bache de aprox. 1 m de diámetro que obliga a los carros a invadir el otro carril."])
    categoria: Categoria
    prioridad: Prioridad = "media"
    latitud: float = Field(ge=LAT_MIN, le=LAT_MAX, examples=[13.6989])
    longitud: float = Field(ge=LNG_MIN, le=LNG_MAX, examples=[-89.1914])
    departamento: str = Field(examples=["San Salvador"])
    municipio: str = Field(examples=["San Salvador Centro"])
    referencia: str | None = Field(default=None, max_length=200, examples=["Frente al Centro Escolar República de Chile"])
    etiquetas: list[str] = Field(default=[], max_length=10, examples=[["escuela", "via_principal"]])
    evidencias: list[EvidenciaIn] = Field(default=[], max_length=10)


class CambioEstado(BaseModel):
    estado: Estado
    comentario: str | None = Field(default=None, max_length=500)
    actor: str = Field(min_length=2, max_length=100, examples=["Operador Alcaldía SS Centro"])


class ApoyoIn(BaseModel):
    ciudadanoId: str


class CalificacionIn(BaseModel):
    ciudadanoId: str
    puntaje: int = Field(ge=1, le=5)
    comentario: str | None = Field(default=None, max_length=500)
