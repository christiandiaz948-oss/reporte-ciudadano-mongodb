// Frontend del Sistema de Reporte Ciudadano.
// Cada pantalla llama a la API con fetch(); toda la lógica de datos está en el backend.

const API = "/api";

let catalogos = null;   // categorías, estados, departamentos... (GET /api/catalogos)
let ciudadanos = [];    // para llenar las listas de ciudadanos
let paginaActual = 1;
let reporteActual = null;

// ---------------------------------------------------------------- utilidades

// Llama a la API y devuelve el JSON. Si la API responde con error, lanza el mensaje.
async function api(ruta, metodo = "GET", cuerpo = null) {
  const opciones = { method: metodo, headers: { "Content-Type": "application/json" } };
  if (cuerpo) opciones.body = JSON.stringify(cuerpo);
  const respuesta = await fetch(API + ruta, opciones);
  if (respuesta.status === 204) return null;
  const datos = await respuesta.json();
  if (!respuesta.ok) throw new Error(textoError(datos.detail));
  return datos;
}

// FastAPI devuelve el error como texto o como lista de errores de validación
function textoError(detalle) {
  if (Array.isArray(detalle)) {
    return detalle.map((e) => `${e.loc.slice(-1)[0]}: ${e.msg}`).join(" · ");
  }
  return detalle || "Error desconocido";
}

function mostrarMensaje(texto, tipo = "ok") {
  const caja = document.getElementById("mensaje");
  caja.textContent = texto;
  caja.className = "mensaje " + tipo;
  window.scrollTo({ top: 0, behavior: "smooth" });
  clearTimeout(caja.temporizador);
  caja.temporizador = setTimeout(() => caja.classList.add("oculto"), 6000);
}

// Evita que un texto escrito por el usuario se interprete como HTML
function esc(texto) {
  const div = document.createElement("div");
  div.textContent = texto ?? "";
  return div.innerHTML;
}

const fecha = (iso) => (iso ? new Date(iso).toLocaleString("es-SV", { dateStyle: "medium", timeStyle: "short" }) : "");
const legible = (valor) => (valor || "").replaceAll("_", " ");
const badge = (tipo, valor) => `<span class="badge ${tipo}-${valor}">${legible(valor)}</span>`;

function llenarSelect(select, valores, textoVacio = null) {
  select.innerHTML = textoVacio !== null ? `<option value="">${textoVacio}</option>` : "";
  for (const v of valores) {
    const valor = typeof v === "object" ? v.valor : v;
    const texto = typeof v === "object" ? v.texto : legible(v);
    select.insertAdjacentHTML("beforeend", `<option value="${esc(valor)}">${esc(texto)}</option>`);
  }
}

// Convierte un formulario en un objeto { campo: valor } sin campos vacíos
function datosFormulario(form) {
  const datos = {};
  for (const [campo, valor] of new FormData(form)) {
    if (valor !== "") datos[campo] = valor;
  }
  return datos;
}

// ---------------------------------------------------------------- navegación

// La URL decide qué vista se muestra: #reportes, #registrar, #metricas o #detalle/FOLIO
function navegar() {
  const [vista, parametro] = (location.hash.slice(1) || "reportes").split("/");
  document.querySelectorAll(".vista").forEach((v) => v.classList.remove("visible"));
  document.querySelectorAll("nav a").forEach((a) => a.classList.toggle("activo", a.hash === "#" + vista));
  const seccion = document.getElementById("vista-" + vista);
  if (!seccion) return;
  seccion.classList.add("visible");

  if (vista === "reportes") cargarReportes();
  if (vista === "detalle") cargarDetalle(parametro);
  if (vista === "metricas") cargarMetricas();
}

// ---------------------------------------------------------------- listado de reportes

async function cargarReportes() {
  const filtros = datosFormulario(document.getElementById("form-filtros"));
  const parametros = new URLSearchParams({ ...filtros, pagina: paginaActual, tamano: 15 });
  // Los checkbox llegan como "on"; la API espera true
  if (filtros.abiertos) parametros.set("abiertos", "true");
  if (filtros.urgentes) parametros.set("urgentes", "true");

  try {
    const resultado = await api("/reportes?" + parametros);
    const filas = resultado.datos.map((r) => `
      <tr data-folio="${esc(r.folio)}">
        <td>${esc(r.folio)}</td>
        <td>${esc(r.titulo)}</td>
        <td>${legible(r.categoria)}</td>
        <td>${badge("prioridad", r.prioridad)}</td>
        <td>${badge("estado", r.estado)}</td>
        <td>${esc(r.direccion.municipio)}</td>
        <td>${esc(r.institucion?.nombre)}</td>
        <td>${r.totalApoyos}</td>
        <td>${fecha(r.fechaCreacion)}</td>
      </tr>`);
    document.getElementById("tabla-reportes").innerHTML =
      filas.join("") || `<tr><td colspan="9">No hay reportes con esos filtros.</td></tr>`;
    document.getElementById("total-reportes").textContent = `${resultado.total} reportes encontrados`;
    document.getElementById("texto-pagina").textContent = `Página ${resultado.pagina} de ${resultado.paginas || 1}`;
    document.getElementById("btn-anterior").disabled = resultado.pagina <= 1;
    document.getElementById("btn-siguiente").disabled = resultado.pagina >= resultado.paginas;
  } catch (error) {
    mostrarMensaje(error.message, "error");
  }
}

// ---------------------------------------------------------------- detalle

async function cargarDetalle(folio) {
  try {
    reporteActual = await api("/reportes/" + encodeURIComponent(folio));
  } catch (error) {
    mostrarMensaje(error.message, "error");
    return;
  }
  const r = reporteActual;

  const historial = r.historial.map((h) => `
    <li>${badge("estado", h.estado)} <strong>${esc(h.actor)}</strong>
        <small>${fecha(h.fecha)}</small> ${h.comentario ? "— " + esc(h.comentario) : ""}</li>`).join("");
  const evidencias = r.evidencias.map((e, i) =>
    `<li><a href="${esc(e.url)}" target="_blank">${legible(e.tipo)} ${i + 1}</a></li>`).join("") || "<li>Sin evidencias</li>";
  const calificacion = r.calificacion
    ? `${"★".repeat(r.calificacion.puntaje)}${"☆".repeat(5 - r.calificacion.puntaje)} ${esc(r.calificacion.comentario)}`
    : "Sin calificar";

  document.getElementById("detalle-contenido").innerHTML = `
    <h2>${esc(r.folio)} · ${esc(r.titulo)}</h2>
    <div class="columnas">
      <div class="tarjeta">
        <p>${esc(r.descripcion)}</p>
        <p><strong>Categoría:</strong> ${legible(r.categoria)} &nbsp; ${badge("prioridad", r.prioridad)} ${badge("estado", r.estado)}</p>
        <p><strong>Lugar:</strong> ${esc(r.direccion.municipio)}, ${esc(r.direccion.departamento)}
           ${r.direccion.referencia ? "(" + esc(r.direccion.referencia) + ")" : ""}</p>
        <p><strong>Coordenadas:</strong> ${r.ubicacion.latitud}, ${r.ubicacion.longitud}</p>
        <p><strong>Reportado por:</strong> ${esc(r.ciudadano?.nombre)} · ${fecha(r.fechaCreacion)}</p>
        <p><strong>Institución:</strong> ${esc(r.institucion?.nombre) || "Sin asignar"}</p>
        <p><strong>Apoyos:</strong> ${r.totalApoyos}</p>
        <p><strong>Etiquetas:</strong> ${r.etiquetas.map(esc).join(", ") || "—"}</p>
        <p><strong>Calificación:</strong> ${calificacion}</p>
      </div>
      <div class="tarjeta">
        <h3>Historial</h3>
        <ul class="historial">${historial}</ul>
        <h3 style="margin-top:16px">Evidencias</h3>
        <ul>${evidencias}</ul>
      </div>
    </div>`;

  // Solo se ofrecen los cambios de estado permitidos desde el estado actual
  const permitidos = catalogos.transiciones[r.estado];
  const formEstado = document.getElementById("form-estado");
  llenarSelect(formEstado.estado, permitidos);
  formEstado.querySelector("button").disabled = permitidos.length === 0;

  // Para apoyar se excluye al autor
  llenarSelect(document.querySelector("#form-apoyo select"),
    ciudadanos.filter((c) => c._id !== r.ciudadanoId).map((c) => ({ valor: c._id, texto: c.nombre })));

  document.getElementById("form-calificacion").style.display =
    r.estado === "resuelto" && !r.calificacion ? "block" : "none";
}

// ---------------------------------------------------------------- métricas

// Dibuja una tabla simple; "columnas" es una lista de [titulo, campo]
function tablaSimple(filas, columnas, campoBarra = null) {
  const maximo = campoBarra ? Math.max(...filas.map((f) => f[campoBarra]), 1) : 0;
  const encabezado = columnas.map(([titulo]) => `<th>${titulo}</th>`).join("") + (campoBarra ? "<th></th>" : "");
  const cuerpo = filas.map((f) => "<tr>" +
    columnas.map(([, campo]) => `<td>${esc(legible(String(f[campo])))}</td>`).join("") +
    (campoBarra ? `<td style="width:30%"><div class="barra" style="width:${(f[campoBarra] / maximo) * 100}%"></div></td>` : "") +
    "</tr>").join("");
  return `<table><thead><tr>${encabezado}</tr></thead><tbody>${cuerpo}</tbody></table>`;
}

async function cargarMetricas() {
  try {
    const [categorias, municipios, tiempos, etiquetas] = await Promise.all([
      api("/metricas/por-categoria"),
      api("/metricas/por-municipio?limite=10"),
      api("/metricas/tiempos-resolucion?limite=10"),
      api("/metricas/etiquetas?limite=10"),
    ]);
    document.getElementById("metrica-categorias").innerHTML = tablaSimple(categorias,
      [["Categoría", "categoria"], ["Total", "total"], ["Abiertos", "abiertos"], ["Resueltos", "resueltos"]], "total");
    document.getElementById("metrica-municipios").innerHTML = tablaSimple(municipios,
      [["Municipio", "municipio"], ["Abiertos", "abiertos"], ["Críticos", "criticos"], ["Total", "total"]], "abiertos");
    document.getElementById("metrica-tiempos").innerHTML = tablaSimple(tiempos,
      [["Institución", "institucion"], ["Resueltos", "resueltos"], ["Días promedio", "promedioDias"]]);
    document.getElementById("metrica-etiquetas").innerHTML = tablaSimple(etiquetas,
      [["Etiqueta", "etiqueta"], ["Reportes", "total"]], "total");
  } catch (error) {
    mostrarMensaje(error.message, "error");
  }
}

// ---------------------------------------------------------------- formularios

async function crearReporte(evento) {
  evento.preventDefault();
  const form = evento.target;
  const datos = datosFormulario(form);
  const reporte = {
    ...datos,
    latitud: Number(datos.latitud),
    longitud: Number(datos.longitud),
    etiquetas: (datos.etiquetas || "").split(",").map((e) => e.trim()).filter(Boolean),
    evidencias: datos.foto ? [{ url: datos.foto, tipo: "foto" }] : [],
  };
  delete reporte.foto;
  try {
    const creado = await api("/reportes", "POST", reporte);
    mostrarMensaje(`Reporte ${creado.folio} creado y asignado a: ${creado.institucion?.nombre || "sin institución"}`);
    form.reset();
    location.hash = "detalle/" + creado.folio;
  } catch (error) {
    mostrarMensaje(error.message, "error");
  }
}

async function crearCiudadano(evento) {
  evento.preventDefault();
  const form = evento.target;
  const { departamento, municipio, colonia, ...resto } = datosFormulario(form);
  try {
    const creado = await api("/ciudadanos", "POST", { ...resto, direccion: { departamento, municipio, colonia } });
    mostrarMensaje(`Ciudadano ${creado.nombre} registrado`);
    form.reset();
    await cargarCiudadanos();
  } catch (error) {
    mostrarMensaje(error.message, "error");
  }
}

async function cambiarEstado(evento) {
  evento.preventDefault();
  try {
    await api(`/reportes/${reporteActual.folio}/estado`, "PATCH", datosFormulario(evento.target));
    mostrarMensaje("Estado actualizado");
    evento.target.reset();
    cargarDetalle(reporteActual.folio);
  } catch (error) {
    mostrarMensaje(error.message, "error");
  }
}

async function apoyar(evento) {
  evento.preventDefault();
  try {
    const r = await api(`/reportes/${reporteActual.folio}/apoyos`, "POST", datosFormulario(evento.target));
    mostrarMensaje(`Apoyo registrado. Total: ${r.totalApoyos}`);
    cargarDetalle(reporteActual.folio);
  } catch (error) {
    mostrarMensaje(error.message, "error");
  }
}

async function calificar(evento) {
  evento.preventDefault();
  const datos = datosFormulario(evento.target);
  try {
    // Quien califica es el autor del reporte
    await api(`/reportes/${reporteActual.folio}/calificacion`, "POST",
      { ciudadanoId: reporteActual.ciudadanoId, puntaje: Number(datos.puntaje), comentario: datos.comentario });
    mostrarMensaje("Gracias por calificar");
    cargarDetalle(reporteActual.folio);
  } catch (error) {
    mostrarMensaje(error.message, "error");
  }
}

// ---------------------------------------------------------------- inicio

async function cargarCiudadanos() {
  const resultado = await api("/ciudadanos?tamano=100&orden=nombre");
  ciudadanos = resultado.datos;
  document.querySelectorAll(".lista-ciudadanos").forEach((select) =>
    llenarSelect(select, ciudadanos.map((c) => ({ valor: c._id, texto: `${c.nombre} (${c.dui})` }))));
}

// Al elegir un departamento se cargan sus municipios
function conectarDepartamentos() {
  document.querySelectorAll(".sel-departamento").forEach((selDepto) => {
    const selMuni = selDepto.closest("form").querySelector(".sel-municipio");
    llenarSelect(selDepto, Object.keys(catalogos.departamentos));
    const actualizar = () => llenarSelect(selMuni, catalogos.departamentos[selDepto.value]);
    selDepto.addEventListener("change", actualizar);
    actualizar();
  });
}

async function iniciar() {
  try {
    catalogos = await api("/catalogos");
  } catch (error) {
    mostrarMensaje("No se pudo conectar con la API: " + error.message, "error");
    return;
  }
  const filtros = document.getElementById("form-filtros");
  llenarSelect(filtros.estado, catalogos.estados, "Todos");
  llenarSelect(filtros.categoria, catalogos.categorias, "Todas");
  llenarSelect(filtros.departamento, Object.keys(catalogos.departamentos), "Todos");

  const formReporte = document.getElementById("form-reporte");
  llenarSelect(formReporte.categoria, catalogos.categorias);
  llenarSelect(formReporte.prioridad, catalogos.prioridades);
  formReporte.prioridad.value = "media";
  conectarDepartamentos();
  await cargarCiudadanos();

  filtros.addEventListener("submit", (e) => { e.preventDefault(); paginaActual = 1; cargarReportes(); });
  document.getElementById("btn-anterior").addEventListener("click", () => { paginaActual--; cargarReportes(); });
  document.getElementById("btn-siguiente").addEventListener("click", () => { paginaActual++; cargarReportes(); });
  document.getElementById("tabla-reportes").addEventListener("click", (e) => {
    const fila = e.target.closest("tr[data-folio]");
    if (fila) location.hash = "detalle/" + fila.dataset.folio;
  });
  formReporte.addEventListener("submit", crearReporte);
  document.getElementById("form-ciudadano").addEventListener("submit", crearCiudadano);
  document.getElementById("form-estado").addEventListener("submit", cambiarEstado);
  document.getElementById("form-apoyo").addEventListener("submit", apoyar);
  document.getElementById("form-calificacion").addEventListener("submit", calificar);

  window.addEventListener("hashchange", navegar);
  navegar();
}

iniciar();
