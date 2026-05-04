const API_URL_DASH = "https://kalel-tintometric-nonefficiently.ngrok-free.dev/api";
let ventasCache = []; 

// --- FUNCIÓN PARA DESCARGAR TODAS LAS VENTAS ---
async function actualizarCacheVentas() {
  try {
    const res = await fetch(`${API_URL_DASH}/ventas`, {
        headers: {
            'ngrok-skip-browser-warning': 'true'
        }
    });
    if (res.ok) {
      ventasCache = await res.json();
    }
  } catch (error) {
    console.error("Error cargando ventas para el dashboard", error);
  }
}

// --- FECHAS AUXILIARES ---
function getFechaInicio(periodo) {
  const now = new Date();
  if (periodo === "dia") {
    now.setHours(0, 0, 0, 0);
  } else if (periodo === "semana") {
    const diaSemana = now.getDay(); 
    const diff = now.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1);
    now.setDate(diff);
    now.setHours(0, 0, 0, 0);
  } else if (periodo === "mes") {
    now.setDate(1);
    now.setHours(0, 0, 0, 0);
  }
  return now;
}

function getFechaAyer() {
  const ahora = new Date();
  ahora.setDate(ahora.getDate() - 1);
  ahora.setHours(0, 0, 0, 0);
  return ahora;
}

// --- CÁLCULOS MATEMÁTICOS ---
function calcularTotalVentasDesde(fechaInicio) {
  return ventasCache.reduce((acc, v) => {
    const fechaVenta = new Date(v.fecha);
    if (fechaVenta >= fechaInicio) {
      return acc + parseFloat(v.total || 0);
    }
    return acc;
  }, 0);
}

function calcularTotalVentasDiaExacto(fechaObjetivo) {
  const inicio = new Date(fechaObjetivo);
  inicio.setHours(0, 0, 0, 0);
  const fin = new Date(inicio);
  fin.setHours(23, 59, 59, 999);

  return ventasCache.reduce((acc, v) => {
    const d = new Date(v.fecha);
    if (d >= inicio && d <= fin) return acc + parseFloat(v.total || 0);
    return acc;
  }, 0);
}

function obtenerTopProductosLocal(fechaInicio, limite = 5) {
  const resumen = {};

  ventasCache.forEach((v) => {
    const d = new Date(v.fecha);
    if (d >= fechaInicio && v.producto_id) {
      const nombre = v.producto ? v.producto.nombre : "Producto eliminado";
      if (!resumen[v.producto_id]) resumen[v.producto_id] = { nombre, cantidad: 0 };
      resumen[v.producto_id].cantidad += v.cantidad;
    }
  });

  return Object.values(resumen)
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, limite);
}

// --- ACTUALIZAR PANTALLA DEL DASHBOARD ---
async function refrescarTotales() {
  await actualizarCacheVentas(); 

  const hoy = new Date();
  const ayer = getFechaAyer();
  const semana = getFechaInicio("semana");
  const mes = getFechaInicio("mes");

  const totalDia = calcularTotalVentasDiaExacto(hoy);
  const totalAyer = calcularTotalVentasDiaExacto(ayer);

  const dif = totalDia - totalAyer;
  let textoDif = dif > 0 ? `C$ ${dif.toFixed(2)} más en ventas que ayer` 
                 : dif < 0 ? `C$ ${Math.abs(dif).toFixed(2)} menos en ventas que ayer` 
                 : "Igual que ayer";

  const totalSemana = calcularTotalVentasDesde(semana);
  const totalMes = calcularTotalVentasDesde(mes);

  document.getElementById("ventas-dia").innerText = `C$ ${totalDia.toFixed(2)}`;
  document.getElementById("ventas-comparacion-dia").innerText = textoDif;
  document.getElementById("ventas-semana").innerText = `C$ ${totalSemana.toFixed(2)}`;
  document.getElementById("ventas-mes").innerText = `C$ ${totalMes.toFixed(2)}`;
}

// --- GRÁFICO TOP PRODUCTOS ---
let graficoTop = null;

function refrescarTopProductos() {
  const top = obtenerTopProductosLocal(getFechaInicio("mes"), 8);
  const etiquetas = top.map((p) => p.nombre);
  const datos = top.map((p) => p.cantidad);
  renderGraficoTopProductos(etiquetas, datos);
}

function renderGraficoTopProductos(labels, data) {
  const canvas = document.getElementById("grafico-top-productos");
  if (!canvas) return; 
  const ctx = canvas.getContext("2d");

  if (graficoTop) graficoTop.destroy();

  graficoTop = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [{
          label: "Unidades vendidas",
          data: data,
          backgroundColor: ["rgba(255, 99, 132, 0.6)", "rgba(54, 162, 235, 0.6)", "rgba(255, 206, 86, 0.6)", "rgba(75, 192, 192, 0.6)", "rgba(153, 102, 255, 0.6)", "rgba(255, 159, 64, 0.6)"],
          borderColor: ["rgba(255, 99, 132, 1)", "rgba(54, 162, 235, 1)", "rgba(255, 206, 86, 1)", "rgba(75, 192, 192, 1)", "rgba(153, 102, 255, 1)", "rgba(255, 159, 64, 1)"],
          borderWidth: 1,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false, 
      indexAxis: 'y', 
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true } },
    },
  });
}

// --- GRÁFICO LÍNEAS (VENTAS) ---
let graficoVentas = null;

function graficarSemana() {
  const inicioSemana = getFechaInicio("semana");
  const datos = new Array(7).fill(0);

  ventasCache.forEach((v) => {
    const d = new Date(v.fecha);
    if (d >= inicioSemana) {
      let dia = d.getDay(); 
      dia = dia === 0 ? 6 : dia - 1; 
      datos[dia] += parseFloat(v.total || 0);
    }
  });

  const NOMBRES_DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
  renderGraficoVentas(NOMBRES_DIAS, datos, "Semana");
}

function graficarMes() {
  const inicioMes = getFechaInicio("mes");
  const dias = new Date().getDate(); // Días transcurridos del mes
  const etiquetas = Array.from({ length: dias }, (_, i) => (i + 1).toString());
  const datos = new Array(dias).fill(0);

  ventasCache.forEach((v) => {
    const d = new Date(v.fecha);
    if (d >= inicioMes) {
      const dia = d.getDate() - 1;
      if (dia >= 0 && dia < dias) datos[dia] += parseFloat(v.total || 0);
    }
  });

  renderGraficoVentas(etiquetas, datos, "Mes");
}

function renderGraficoVentas(labels, datos, modo) {
  const ctx = document.getElementById("grafico-ventas").getContext("2d");
  if (graficoVentas) graficoVentas.destroy();

  graficoVentas = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
          label: `Ventas (${modo})`,
          data: datos,
          borderColor: "#0074D9",
          backgroundColor: "rgba(0,116,217,0.07)",
          tension: 0.3,
          borderWidth: 3,
          pointRadius: 3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: true } },
      scales: { y: { beginAtZero: true } },
    },
  });
}

// --- REPORTES FINANCIEROS ---
async function generarReporteVentas() {
  const contenedor = document.getElementById("contenido-modal-reporte");
  if (!contenedor) return;

  if (ventasCache.length === 0) {
    contenedor.innerHTML = "<div class='alert alert-info'>No hay ventas registradas.</div>";
    new bootstrap.Modal(document.getElementById("modalReporteProductos")).show();
    return;
  }

  const agrupado = {};
  ventasCache.forEach((venta) => {
    const idProd = venta.producto_id || 'eliminado';
    const nombreProd = venta.producto ? venta.producto.nombre : "Producto eliminado";

    if (!agrupado[idProd]) {
      agrupado[idProd] = { nombre: nombreProd, cantidadTotal: 0, ingresoTotal: 0 };
    }
    agrupado[idProd].cantidadTotal += venta.cantidad;
    agrupado[idProd].ingresoTotal += parseFloat(venta.total || 0);
  });

  const listaReporte = Object.values(agrupado).sort((a, b) => b.ingresoTotal - a.ingresoTotal);

  let html = `
    <table class="table table-striped table-bordered table-sm align-middle">
      <thead class="table-dark">
        <tr><th>Producto</th><th class="text-center">Cant.</th><th class="text-end">Precio U. Promedio</th><th class="text-end">Total</th></tr>
      </thead>
      <tbody>
  `;

  listaReporte.forEach((item) => {
    const precioUnitarioPromedio = item.ingresoTotal / item.cantidadTotal;
    html += `
      <tr>
        <td>${item.nombre}</td>
        <td class="text-center">${item.cantidadTotal}</td>
        <td class="text-end">C$ ${precioUnitarioPromedio.toFixed(2)}</td>
        <td class="text-end fw-bold">C$ ${item.ingresoTotal.toFixed(2)}</td>
      </tr>
    `;
  });
  html += `</tbody></table>`;

  contenedor.innerHTML = html;
  new bootstrap.Modal(document.getElementById("modalReporteProductos")).show();
}

async function abrirReporteCompleto() {
  if (!esAdmin()) {
    mostrarNotificacion({ titulo: "Acceso Restringido", mensaje: "Solo los administradores pueden ver los reportes financieros.", tipo: "error" });
    return;
  }
  
  await actualizarCacheVentas();
  new bootstrap.Modal(document.getElementById("modalReporteProductos")).show();
  cargarPestanaMensual();
  cargarPestanaGeneral();
}

function cargarPestanaMensual() {
  const contenedor = document.getElementById("contenido-reporte-mensual");
  
  const historial = {};
  ventasCache.forEach(venta => {
    const fechaObj = new Date(venta.fecha);
    const nombreMes = fechaObj.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
    const mesFormato = nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1);

    if (!historial[mesFormato]) historial[mesFormato] = { total: 0, cantidad: 0 };
    historial[mesFormato].total += venta.total;
    historial[mesFormato].cantidad += 1;
  });

  let html = `<table class="table table-bordered align-middle"><thead class="table-dark"><tr><th>Mes</th><th class="text-center">Ventas</th><th class="text-end">Total</th></tr></thead><tbody>`;
  Object.keys(historial).forEach(mes => {
    html += `<tr><td class="fw-bold text-primary">${mes}</td><td class="text-center">${historial[mes].cantidad}</td><td class="text-end fw-bold">C$ ${historial[mes].total.toFixed(2)}</td></tr>`;
  });
  html += `</tbody></table>`;
  contenedor.innerHTML = html;
}

function cargarPestanaGeneral() {
  const tbody = document.getElementById("tabla-reporte-general-body");
  const agrupado = {};

  ventasCache.forEach(v => {
    const nombreProd = v.producto?.nombre || "Producto Eliminado";
    if (!agrupado[nombreProd]) {
      agrupado[nombreProd] = { nombre: nombreProd, vecesVendido: 0, unidades: 0, dinero: 0 };
    }
    agrupado[nombreProd].vecesVendido += 1;
    agrupado[nombreProd].unidades += v.cantidad;
    agrupado[nombreProd].dinero += v.total;
  });

  const listaConsolidada = Object.values(agrupado).sort((a, b) => b.dinero - a.dinero);
  tbody.innerHTML = "";
  
  listaConsolidada.forEach(item => {
    tbody.insertAdjacentHTML("beforeend", `
      <tr>
        <td class="fw-bold">${item.nombre}</td>
        <td class="text-center">${item.vecesVendido}</td>
        <td class="text-center fw-bold">${item.unidades}</td>
        <td class="text-end text-success fw-bold">C$ ${item.dinero.toFixed(2)}</td>
      </tr>
    `);
  });
}

// --- EVENTOS DE INICIALIZACIÓN ---
document.addEventListener("DOMContentLoaded", () => {
  const btnSemana = document.getElementById("btn-ver-semana");
  const btnMes = document.getElementById("btn-ver-mes");

  if (btnSemana && btnMes) {
    btnSemana.onclick = function () {
      graficarSemana();
      this.classList.add("active");
      btnMes.classList.remove("active");
    };

    btnMes.onclick = function () {
      graficarMes();
      this.classList.add("active");
      btnSemana.classList.remove("active");
    };
  }

  document.getElementById("btn-accion-vender")?.addEventListener("click", () => document.getElementById("btn-ir-ventas")?.click());
  
  document.getElementById("btn-accion-agregar")?.addEventListener("click", () => { 
    document.getElementById("btn-ir-productos")?.click();
    setTimeout(() => new bootstrap.Modal(document.getElementById("modalAgregar")).show(), 200);
  });

  document.getElementById("btn-accion-proveedores")?.addEventListener("click", () => document.getElementById("btn-ir-proveedores")?.click());

  // Cargamos los datos visuales si entramos directo a inicio
  document.getElementById("btn-ir-inicio")?.addEventListener("click", async () => {
    await refrescarTotales();
    graficarSemana();
    refrescarTopProductos();
  });
});