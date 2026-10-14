const API_URL_FINANZAS = "https://sistema-pasteleria-sql.onrender.com/api";

document.addEventListener("DOMContentLoaded", () => {
    // Validar los campos decimales para evitar letras
    const montoEgreso = document.getElementById("egreso-monto");
    if (montoEgreso) {
        montoEgreso.addEventListener('input', function() {
            this.value = this.value.replace(/[^0-9.]/g, '');
            if ((this.value.match(/\./g) || []).length > 1) {
                this.value = this.value.substring(0, this.value.lastIndexOf('.'));
            }
        });
    }

    const montoMachote = document.getElementById("machote-subtotal");
    if (montoMachote) {
        montoMachote.addEventListener('input', function() {
            this.value = this.value.replace(/[^0-9.]/g, '');
            if ((this.value.match(/\./g) || []).length > 1) {
                this.value = this.value.substring(0, this.value.lastIndexOf('.'));
            }
        });
    }
});

// ========================================================
// 1. CARGA DEL ESTADO DE RESULTADOS (PÉRDIDAS Y GANANCIAS)
// ========================================================
window.cargarEstadoFinanciero = async function() {
    try {
        const res = await fetch(`${API_URL_FINANZAS}/reportes/estado-financiero`);
        const data = await res.json(); 

        const fmt = (num) => parseFloat(num || 0).toFixed(2);

        // Llenar tabla P&L
        document.getElementById('fin-ingresos').textContent = fmt(data.ingresos);
        document.getElementById('fin-costos').textContent = fmt(data.costo_ventas);
        document.getElementById('fin-util-bruta').textContent = fmt(data.utilidad_bruta);
        document.getElementById('fin-cif').textContent = fmt(data.cif); 
        document.getElementById('fin-util-antes').textContent = fmt(data.utilidad_neta_antes);
        document.getElementById('fin-ir').textContent = fmt(data.impuestos?.ir_mensual);
        document.getElementById('fin-iva').textContent = fmt(data.impuestos?.iva_debito);
        document.getElementById('fin-liquida').textContent = fmt(data.utilidad_liquida);

        // Llenar nuevas Tarjetas KPI
        const totalSalidas = parseFloat(data.costo_ventas || 0) + parseFloat(data.cif || 0) + parseFloat(data.impuestos?.ir_mensual || 0);
        let margen = 0;
        if (parseFloat(data.ingresos) > 0) {
            margen = (parseFloat(data.utilidad_liquida) / parseFloat(data.ingresos)) * 100;
        }

        document.getElementById('kpi-ingresos').textContent = fmt(data.ingresos);
        document.getElementById('kpi-salidas').textContent = fmt(totalSalidas);
        document.getElementById('kpi-margen').textContent = fmt(margen);

        // Cargar también la tabla de historial de egresos en la pestaña 2
        cargarHistorialEgresos();
        
    } catch (error) {
        console.error("Error cargando finanzas:", error);
        if(typeof mostrarNotificacion === 'function') mostrarNotificacion("Aviso", "Hubo un error cargando los datos financieros.", "error");
        
        const elementos = ['fin-ingresos', 'fin-costos', 'fin-util-bruta', 'fin-cif', 'fin-util-antes', 'fin-ir', 'fin-iva', 'fin-liquida', 'kpi-ingresos', 'kpi-salidas', 'kpi-margen'];
        elementos.forEach(el => {
            const domEl = document.getElementById(el);
            if (domEl) domEl.textContent = "0.00";
        });
    }
};

// ========================================================
// 2. HISTORIAL DE EGRESOS Y ACTIVOS (TABLA)
// ========================================================
async function cargarHistorialEgresos() {
    const tbody = document.getElementById("tabla-egresos-historial");
    if (!tbody) return;

    try {
        const res = await fetch(`${API_URL_FINANZAS}/gastos/historial`);
        const datos = await res.json();
        
        tbody.innerHTML = "";
        if (datos.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">No hay desembolsos registrados este mes.</td></tr>`;
            return;
        }

        datos.forEach(d => {
            const fechaStr = new Date(d.fecha).toLocaleDateString();
            const badgeTipo = d.tipo_gasto === 'ACTIVO_FIJO' ? 'bg-primary' : 'bg-danger';
            
            tbody.insertAdjacentHTML('beforeend', `
                <tr>
                    <td class="small">${fechaStr}</td>
                    <td><span class="badge ${badgeTipo}">${d.tipo_gasto}</span></td>
                    <td class="small text-truncate" style="max-width: 150px;" title="${d.descripcion}">${d.descripcion}</td>
                    <td class="text-end fw-bold">C$ ${parseFloat(d.monto_total).toFixed(2)}</td>
                    <td class="text-end fw-bold text-danger">C$ ${parseFloat(d.deducible).toFixed(2)}</td>
                </tr>
            `);
        });
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error al cargar el historial desde el servidor.</td></tr>`;
    }
}

// ========================================================
// 3. REGISTRAR DESEMBOLSO (EGRESO O ACTIVO)
// ========================================================
window.guardarEgreso = async function(e) {
    e.preventDefault();
    const tipo_gasto = document.getElementById("egreso-tipo").value;
    const descripcion = document.getElementById("egreso-desc").value.trim();
    const monto_total = parseFloat(document.getElementById("egreso-monto").value);
    const porcentaje_negocio = parseFloat(document.getElementById("egreso-porcentaje").value);
    const fecha = document.getElementById("egreso-fecha").value;

    if (!tipo_gasto || !descripcion || isNaN(monto_total)) {
        if (typeof mostrarNotificacion === 'function') {
            mostrarNotificacion("Atención", "Por favor llene todos los campos del formulario.", "warning");
        }
        return;
    }

    try {
        const res = await fetch(`${API_URL_FINANZAS}/gastos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                tipo_gasto: tipo_gasto, 
                monto_total: monto_total, 
                porcentaje_negocio: porcentaje_negocio, 
                fecha: fecha, 
                descripcion: descripcion 
            })
        });
        
        if (res.ok) {
            if (typeof mostrarNotificacion === 'function') {
                mostrarNotificacion("Transacción Exitosa", "El desembolso fue registrado en la contabilidad.", "success");
            }
            document.getElementById("form-registrar-egreso").reset();
            window.cargarEstadoFinanciero(); // Refresca P&L y la tabla
        } else {
            throw new Error("Fallo en el backend al guardar");
        }
    } catch (error) {
        console.error("Error guardando egreso:", error);
        if (typeof mostrarNotificacion === 'function') {
            mostrarNotificacion("Error", "No se pudo guardar la transacción en la base de datos.", "error");
        }
    }
};

// ========================================================
// 4. MACHOTE DE FACTURA FORMAL NICARAGÜENSE
// ========================================================
window.calcularMachote = function() {
    const subtotalInput = document.getElementById("machote-subtotal").value;
    const subtotal = parseFloat(subtotalInput) || 0;

    const aplicaIva = document.getElementById("chk-iva").checked;
    const tasaIR = parseFloat(document.getElementById("sel-ret-ir").value) || 0;
    const aplicaAlma = document.getElementById("chk-alma").checked;

    // Fórmulas de Nicaragua: Impuestos y Retenciones
    const iva = aplicaIva ? (subtotal * 0.15) : 0;
    const bruto = subtotal + iva;
    
    // Las retenciones en Nicaragua SIEMPRE se aplican sobre el Subtotal, no sobre el Bruto
    const retIR = subtotal * (tasaIR / 100);
    const retAlma = aplicaAlma ? (subtotal * 0.01) : 0;

    const neto = bruto - retIR - retAlma;

    // Renderizar Resultados
    document.getElementById("out-subtotal").innerText = subtotal.toFixed(2);
    document.getElementById("out-iva").innerText = iva.toFixed(2);
    document.getElementById("out-bruto").innerText = bruto.toFixed(2);
    document.getElementById("out-ret-ir").innerText = retIR.toFixed(2);
    document.getElementById("out-ret-alma").innerText = retAlma.toFixed(2);
    document.getElementById("out-neto").innerText = neto.toFixed(2);
};

// ========================================================
// 5. EXPORTACIÓN A PDF
// ========================================================
window.exportarFinanzasPDF = function() {
    const contenido = document.getElementById('area-imprimir-finanzas').innerHTML;
    const mesActual = document.getElementById('lbl-mes-fiscal').innerText;
    
    const v = window.open('', '', 'height=600, width=800');
    v.document.write(`
        <html>
        <head>
            <title>Pérdidas y Ganancias - Repostería Sory</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" />
            <style>
                body { padding: 30px; font-family: 'Arial', sans-serif; }
                .table-light { background-color: #f8f9fa !important; font-weight: bold; }
                .table-warning { background-color: #fff3cd !important; font-weight: bold; }
                .table-success { background-color: #d1e7dd !important; font-weight: bold; }
                #declaratoria-iva-box { display: none !important; } /* Se oculta al imprimir */
            </style>
        </head>
        <body>
            <div class="text-center mb-4 border-bottom pb-3">
                <h2 class="text-uppercase" style="color: #ff69b7;">Repostería Sory</h2>
                <h4>Estado de Resultados (Pérdidas y Ganancias)</h4>
                <p class="text-muted">Período Fiscal: ${mesActual} | Impreso el: ${new Date().toLocaleDateString()}</p>
            </div>
            ${contenido}
        </body>
        </html>
    `);
    v.document.close();
    v.focus();
    setTimeout(() => { v.print(); v.close(); }, 800);
};

window.exportarEgresosPDF = function() {
    const tbodyHtml = document.getElementById('tabla-egresos-historial').innerHTML;
    const v = window.open('', '', 'height=600, width=800');
    v.document.write(`
        <html>
        <head>
            <title>Desembolsos y Activos Fijos</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" />
        </head>
        <body style="padding: 30px;">
            <div class="text-center mb-4 border-bottom pb-3">
                <h2 style="color: #ff69b7; text-transform: uppercase;">Repostería Sory</h2>
                <h4>Reporte de Desembolsos y Activos Fijos</h4>
                <p class="text-muted">Mes Actual | Impreso el: ${new Date().toLocaleDateString()}</p>
            </div>
            <table class="table table-bordered table-striped">
                <thead class="table-dark">
                    <tr>
                        <th>Fecha</th>
                        <th>Categoría</th>
                        <th>Descripción</th>
                        <th class="text-end">Costo Total</th>
                        <th class="text-end">Deducible Operativo</th>
                    </tr>
                </thead>
                <tbody>
                    ${tbodyHtml}
                </tbody>
            </table>
        </body>
        </html>
    `);
    v.document.close();
    v.focus();
    setTimeout(() => { v.print(); v.close(); }, 800);
};

// Cargar la información cuando se haga clic en la navegación
document.getElementById('btn-ir-finanzas')?.addEventListener('click', (e) => {
    window.cargarEstadoFinanciero();
});