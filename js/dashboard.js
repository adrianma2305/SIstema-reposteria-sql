const API_URL_DASH = "https://sistema-pasteleria-sql.onrender.com";
let ventasCache = []; 

// --- CARGAR DATOS PARA REPORTES AVANZADOS ---
async function actualizarCacheVentas() {
  try {
    const res = await fetch(`${API_URL_DASH}/ventas`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    if (res.ok) {
      ventasCache = await res.json();
    }
  } catch (error) {
    console.error("Error cargando ventas para el dashboard", error);
  }
}

// --- ACTUALIZAR PANTALLA DEL DASHBOARD ---
async function refrescarTotales() {
  try {
    const res = await fetch(`${API_URL_DASH}/dashboard/resumen`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    if(!res.ok) throw new Error("Error en el resumen");
    const datos = await res.json();

    document.getElementById("ventas-dia").innerText = `C$ ${datos.dia.toFixed(2)}`;
    document.getElementById("ventas-comparacion-dia").innerText = "Total contabilizado hoy";
    document.getElementById("ventas-semana").innerText = `C$ ${datos.semana.toFixed(2)}`;
    document.getElementById("ventas-mes").innerText = `C$ ${datos.mes.toFixed(2)}`;
  } catch(error) {
    console.error("Error al refrescar totales:", error);
  }
}

// --- GRÁFICO TOP PRODUCTOS ---
let graficoTop = null;

async function refrescarTopProductos() {
  try {
    const res = await fetch(`${API_URL_DASH}/dashboard/top-productos`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    const top = await res.json();
    
    const etiquetas = top.map((p) => p.nombre);
    const datos = top.map((p) => p.total_vendido);
    
    renderGraficoTopProductos(etiquetas, datos);
  } catch (error) {
    console.error("Error cargando top productos:", error);
  }
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

// --- GRÁFICO LÍNEAS ---
let graficoVentas = null;

async function obtenerDatosVentasMes() {
    try {
        const res = await fetch(`${API_URL_DASH}/dashboard/ventas-mes`, {
            headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        return await res.json();
    } catch(e) {
        console.error("Error en gráfico", e);
        return [];
    }
}

async function graficarSemana() {
  const datosSQL = await obtenerDatosVentasMes();
  const ultimos7 = datosSQL.slice(-7);
  
  const etiquetas = ultimos7.map(d => d.dia);
  const datos = ultimos7.map(d => parseFloat(d.total_dia));

  renderGraficoVentas(etiquetas, datos, "Últimos 7 días activos");
}

async function graficarMes() {
  const datosSQL = await obtenerDatosVentasMes();
  
  const etiquetas = datosSQL.map(d => d.dia);
  const datos = datosSQL.map(d => parseFloat(d.total_dia));

  renderGraficoVentas(etiquetas, datos, "Mes Actual");
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
    const idProd = venta.producto?.nombre || 'eliminado';
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
  if (typeof esAdmin === 'function' && !esAdmin()) {
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

  let html = `<table class="table table-bordered align-middle"><thead class="table-dark"><tr><th>Mes</th><th class="text-center">Registros Vendidos</th><th class="text-end">Total</th></tr></thead><tbody>`;
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

  document.getElementById("btn-ir-inicio")?.addEventListener("click", async () => {
    await refrescarTotales();
    graficarSemana();
    refrescarTopProductos();
  });
});