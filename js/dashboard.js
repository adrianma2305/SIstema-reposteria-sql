const API_URL_DASH = "https://sistema-pasteleria-sql.onrender.com/api";
let chartVentas, chartTop;

// Variables globales para guardar los datos y mandarlos al PDF
let datosReporteGlobal = [];
let datosMensualGlobal = [];

async function cargarDashboard() {
  try {
    const resResumen = await fetch(`${API_URL_DASH}/dashboard/resumen`);
    if (resResumen.ok) {
      const data = await resResumen.json();
      document.getElementById("ventas-dia").innerText = `C$ ${data.dia}`;
      document.getElementById("ventas-semana").innerText = `C$ ${data.semana}`;
      document.getElementById("ventas-mes").innerText = `C$ ${data.mes}`;
    }
  } catch (error) { console.error("Error", error); }

  cargarGraficoVentasMes();
  cargarGraficoTopProductos();
}

async function cargarGraficoVentasMes() {
  try {
    const res = await fetch(`${API_URL_DASH}/dashboard/ventas-mes`);
    const data = await res.json();
    const ctx = document.getElementById('grafico-ventas');
    if (!ctx) return;
    if (chartVentas) chartVentas.destroy();
    
    chartVentas = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.map(d => d.dia),
        datasets: [{
          label: 'Ingresos C$',
          data: data.map(d => d.total_dia),
          borderColor: '#ff69b7',
          backgroundColor: 'rgba(255, 105, 183, 0.2)',
          borderWidth: 2,
          fill: true,
          tension: 0.3
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  } catch (error) { console.error(error); }
}

async function cargarGraficoTopProductos() {
  try {
    const res = await fetch(`${API_URL_DASH}/dashboard/top-productos`);
    const data = await res.json();
    const ctx = document.getElementById('grafico-top-productos');
    if (!ctx) return;
    if (chartTop) chartTop.destroy();
    
    chartTop = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: data.map(d => d.nombre),
        datasets: [{
          data: data.map(d => d.total_vendido),
          backgroundColor: ['#ff69b7', '#ff9f43', '#ffc107', '#28c76f', '#20c997'],
          borderWidth: 0
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
  } catch (error) { console.error(error); }
}

window.abrirReporteCompleto = async function() {
  const modal = new bootstrap.Modal(document.getElementById("modalReporteProductos"));
  modal.show();
  
  // INYECCIÓN DEL BOTÓN PDF EN EL MODAL
  const modalHeader = document.querySelector("#modalReporteProductos .modal-header");
  if(modalHeader && !document.getElementById("btn-exportar-pdf")) {
      const btnPdf = document.createElement("button");
      btnPdf.id = "btn-exportar-pdf";
      btnPdf.className = "btn btn-danger btn-sm ms-auto me-3 fw-bold shadow-sm";
      btnPdf.innerHTML = '<i class="bi bi-file-earmark-pdf-fill"></i> Exportar a PDF';
      btnPdf.onclick = generarPDFReporte;
      modalHeader.insertBefore(btnPdf, modalHeader.querySelector(".btn-close"));
  }

  const tbody = document.getElementById("tabla-reporte-general-body");
  const divMensual = document.getElementById("contenido-reporte-mensual");
  
  tbody.innerHTML = "<tr><td colspan='4' class='text-center'>Cargando desglose de productos...</td></tr>";
  divMensual.innerHTML = "<div class='text-center p-4 text-muted'>Calculando registros históricos mensuales...</div>";

  try {
    const res = await fetch(`${API_URL_DASH}/reportes/financiero`);
    const datos = await res.json();
    datosReporteGlobal = datos; // Guardamos en global para el PDF
    tbody.innerHTML = "";
    
    if(datos.length === 0) {
        tbody.innerHTML = "<tr><td colspan='4' class='text-center text-muted'>No hay registros de ventas.</td></tr>";
    } else {
        datos.forEach(d => {
          const isEliminado = d.producto.includes("Eliminado");
          const colorNombre = isEliminado ? "text-danger" : "";
          tbody.insertAdjacentHTML('beforeend', `
            <tr>
              <td class="fw-bold ${colorNombre}">${d.producto}</td>
              <td class="text-center">${d.tickets}</td>
              <td class="text-center fw-bold">${d.unidades}</td>
              <td class="text-end fw-bold text-success">C$ ${d.ingreso_total}</td>
            </tr>
          `);
        });
    }
  } catch (error) { tbody.innerHTML = "<tr><td colspan='4' class='text-center text-danger'>Error al conectar con la base de datos de productos.</td></tr>"; }

  try {
    const resM = await fetch(`${API_URL_DASH}/reportes/mensual`);
    const datosM = await resM.json();
    datosMensualGlobal = datosM; // Guardamos en global para el PDF
    divMensual.innerHTML = "";
    
    if(datosM.length === 0) {
        divMensual.innerHTML = "<div class='text-center text-muted p-4'>No hay facturas registradas en el historial.</div>";
    } else {
        let tablaHTML = `
          <table class="table table-hover table-bordered align-middle m-0">
            <thead class="table-dark">
              <tr>
                <th>Período Contable</th>
                <th class="text-center">Volumen de Transacciones</th>
                <th class="text-end">Monto Total Recaudado</th>
              </tr>
            </thead>
            <tbody>
        `;
        datosM.forEach(m => {
          tablaHTML += `
            <tr>
              <td class="fw-bold text-primary"><i class="bi bi-calendar-check-fill me-2"></i>Mes de ${mesANombre(m.mes)}</td>
              <td class="text-center">${m.total_tickets} facturas emitidas</td>
              <td class="text-end fw-bold text-success">C$ ${m.total_ganado}.00</td>
            </tr>
          `;
        });
        tablaHTML += `</tbody></table>`;
        divMensual.innerHTML = tablaHTML;
    }
  } catch (error) { divMensual.innerHTML = "<div class='text-center text-danger p-4'>Error al procesar el resumen mensual.</div>"; }
};

function mesANombre(formatoMes) {
  const [mes, anio] = formatoMes.split('-');
  const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  return `${meses[parseInt(mes) - 1]} del ${anio}`;
}

// --- FUNCIÓN MAESTRA PARA GENERAR EL PDF BANCARIO ---
window.generarPDFReporte = function() {
    const fechaActual = new Date().toLocaleDateString();
    
    let filasMensual = "";
    let granTotal = 0;
    datosMensualGlobal.forEach(m => {
        granTotal += m.total_ganado;
        filasMensual += `<tr>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">Mes de ${mesANombre(m.mes)}</td>
            <td style="text-align:center; padding: 8px; border-bottom: 1px solid #ddd;">${m.total_tickets}</td>
            <td style="text-align:right; font-weight:bold; padding: 8px; border-bottom: 1px solid #ddd;">C$ ${m.total_ganado}.00</td>
        </tr>`;
    });

    let filasRendimiento = "";
    datosReporteGlobal.forEach(d => {
        filasRendimiento += `<tr>
            <td style="padding: 6px; border-bottom: 1px solid #eee;">${d.producto}</td>
            <td style="text-align:center; padding: 6px; border-bottom: 1px solid #eee;">${d.tickets}</td>
            <td style="text-align:center; padding: 6px; border-bottom: 1px solid #eee;">${d.unidades}</td>
            <td style="text-align:right; padding: 6px; border-bottom: 1px solid #eee;">C$ ${d.ingreso_total}</td>
        </tr>`;
    });

    const contenidoHtml = `
    <div style="font-family: 'Arial', sans-serif; padding: 20px; color: #333;">
        <div style="text-align: center; border-bottom: 2px solid #ff69b7; padding-bottom: 15px; margin-bottom: 20px;">
            <h2 style="margin: 0; color: #ff69b7; text-transform: uppercase;">Repostería Sory</h2>
            <p style="margin: 5px 0 0 0; color: #555; font-weight: bold;">Documento de Rendimiento Financiero y Ventas</p>
            <p style="margin: 5px 0 0 0; font-size: 0.9em; color: #777;">Generado por el Sistema Central el: ${fechaActual}</p>
        </div>
        
        <h4 style="background-color: #f8f9fa; padding: 8px; border-left: 4px solid #333; margin-top: 30px;">1. Resumen de Ingresos Históricos</h4>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 0.95em;">
            <thead>
                <tr style="background-color: #333; color: white;">
                    <th style="padding: 10px; text-align:left;">Período Contable</th>
                    <th style="padding: 10px; text-align:center;">Volumen (Facturas)</th>
                    <th style="padding: 10px; text-align:right;">Ingreso Total</th>
                </tr>
            </thead>
            <tbody>
                ${filasMensual}
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="2" style="text-align:right; padding: 15px; font-weight:bold;">INGRESOS TOTALES REGISTRADOS:</td>
                    <td style="text-align:right; padding: 15px; font-weight:bold; color: green; font-size: 1.2em;">C$ ${granTotal}.00</td>
                </tr>
            </tfoot>
        </table>

        <h4 style="background-color: #f8f9fa; padding: 8px; border-left: 4px solid #333;">2. Desglose de Rentabilidad por Producto</h4>
        <table style="width: 100%; border-collapse: collapse; font-size: 0.85em;">
            <thead>
                <tr style="background-color: #555; color: white;">
                    <th style="padding: 8px; text-align:left;">Producto / Ítem</th>
                    <th style="padding: 8px; text-align:center;">Nº Ventas</th>
                    <th style="padding: 8px; text-align:center;">Unidades Salientes</th>
                    <th style="padding: 8px; text-align:right;">Recaudación</th>
                </tr>
            </thead>
            <tbody>
                ${filasRendimiento}
            </tbody>
        </table>
        
        <div style="margin-top: 60px; text-align: center;">
            <p style="border-top: 1px solid #000; display: inline-block; padding-top: 5px; width: 250px; color: #000; font-weight: bold;">Firma Autorizada / Sello Gerencial</p>
        </div>
    </div>
    `;

    const ventana = window.open('', '_blank', 'height=800, width=800');
    ventana.document.write('<html><head><title>Reporte Financiero Oficial</title></head><body onload="setTimeout(function(){ window.print(); window.close(); }, 500);">');
    ventana.document.write(contenidoHtml);
    ventana.document.write('</body></html>');
    ventana.document.close();
};

document.getElementById("btn-ir-inicio")?.addEventListener("click", () => { cargarDashboard(); });
document.addEventListener("DOMContentLoaded", cargarDashboard);