const API_URL_INS = "https://sistema-pasteleria-sql.onrender.com/api";
let insumosOriginal = [];
let proveedoresMap = {};
let verInactivosIns = false;

document.addEventListener("DOMContentLoaded", () => {
    const searchRow = document.getElementById("busqueda-insumos")?.closest(".row");
    if(searchRow && !document.getElementById("toggle-inactivos-ins")) {
        searchRow.insertAdjacentHTML('beforeend', `<div class="col-md-3"><div class="form-check form-switch"><input class="form-check-input bg-danger" type="checkbox" id="toggle-inactivos-ins"><label class="form-check-label fw-bold text-muted small">Ver Eliminados</label></div></div>`);
        document.getElementById("toggle-inactivos-ins").addEventListener("change", (e) => { verInactivosIns = e.target.checked; filtrarInsumos(); });
    }
    cargarInsumos();
});

async function cargarInsumos() {
    const tabla = document.querySelector("#insumos-table tbody"); 
    if(!tabla) return;
    tabla.innerHTML = "<tr><td colspan='6' class='text-center'>Cargando inventario en la nube...</td></tr>";
    try {
        const res = await fetch(`${API_URL_INS}/insumos`);
        if (!res.ok) throw new Error("Fallo en red");
        insumosOriginal = await res.json();
        filtrarInsumos();
        llenarSelectCalculadora(insumosOriginal.filter(i => i.activo !== false && i.activo !== 0));
    } catch (error) { 
        console.error(error);
        tabla.innerHTML = "<tr><td colspan='6' class='text-center text-danger'>Error de red al cargar inventario.</td></tr>"; 
    }
}

function filtrarInsumos() {
    const busquedaEl = document.getElementById("busqueda-insumos");
    const valor = busquedaEl ? busquedaEl.value.trim().toLowerCase() : "";
    let filtrados = insumosOriginal.filter((i) => i.nombre.toLowerCase().includes(valor));
    if (!verInactivosIns) filtrados = filtrados.filter(i => i.activo !== false && i.activo !== 0);
    renderizarInsumos(filtrados);
}

function renderizarInsumos(insumos) {
    const tabla = document.querySelector("#insumos-table tbody"); 
    if(!tabla) return;
    tabla.innerHTML = "";
    
    if (insumos.length === 0) {
        tabla.innerHTML = "<tr><td colspan='6' class='text-center text-muted'>No hay insumos registrados.</td></tr>";
        return;
    }

    insumos.forEach((i) => {
        const esInactivo = (i.activo === false || i.activo === 0);
        const rowStyle = esInactivo ? "opacity: 0.5; background-color: #f8f9fa;" : "";
        
        // Blindaje matemático para evitar NaN
        const stockActual = parseFloat(i.stock_actual || 0);
        const precio = parseFloat(i.precio || 0).toFixed(2);
        const nombreProv = i.proveedores?.nombre || i.nombre_proveedor || "Sin proveedor";

        let colorStock = stockActual <= 5 ? "text-danger" : "text-success";
        let iconoAlerta = stockActual <= 5 && !esInactivo ? '<i class="bi bi-exclamation-triangle-fill ms-1" title="Crítico"></i>' : '';
        
        let botonesAccion = esInactivo 
            ? `<button class="btn btn-sm btn-success fw-bold" onclick="reactivarInsumo(${i.id})"><i class="bi bi-arrow-counterclockwise"></i> Restaurar</button>` 
            : `<button class="btn btn-sm btn-dark me-1" onclick="abrirKardex(${i.id}, '${i.nombre}')"><i class="bi bi-clock-history"></i></button> 
               <button class="btn btn-sm btn-info text-white me-1" onclick="abrirEditarInsumo(${i.id})"><i class="bi bi-pencil"></i></button> 
               <button class="btn btn-sm btn-danger" onclick="eliminarInsumo(${i.id})"><i class="bi bi-trash"></i></button>`;
            
        tabla.insertAdjacentHTML("beforeend", `
            <tr style="${rowStyle}">
                <td>${i.id}</td>
                <td class="fw-bold">${i.nombre} <br><small class="text-muted">${i.unidad}</small> ${esInactivo ? '<span class="badge bg-danger ms-1">Baja</span>' : ''}</td>
                <td class="text-center bg-light fs-5 fw-bold ${colorStock} border-start border-end">${stockActual.toFixed(2)} ${iconoAlerta}</td>
                <td class="text-primary fw-bold">C$ ${precio}</td>
                <td><span class="badge bg-secondary">${nombreProv}</span></td>
                <td class="text-center">${botonesAccion}</td>
            </tr>
        `);
    });
}

window.reactivarInsumo = function(id) { 
    if(typeof mostrarConfirmacion === 'function') {
        mostrarConfirmacion("¿Volver a ingresar?", async () => { 
            try { await fetch(`${API_URL_INS}/insumos/${id}/reactivar`, { method: 'PUT' }); 
            if(typeof mostrarNotificacion === 'function') mostrarNotificacion("OK", "Activo", "success"); 
            cargarInsumos(); } catch (error) { if(typeof mostrarNotificacion === 'function') mostrarNotificacion("Error", "Fallo", "error"); } 
        });
    } else {
        if(confirm("¿Volver a ingresar?")) {
            fetch(`${API_URL_INS}/insumos/${id}/reactivar`, { method: 'PUT' }).then(() => cargarInsumos());
        }
    }
};

window.eliminarInsumo = function(id) { 
    if(typeof mostrarConfirmacion === 'function') {
        mostrarConfirmacion("¿Dar de baja?", async () => { 
            try { await fetch(`${API_URL_INS}/insumos/${id}`, { method: 'DELETE' }); 
            if(typeof mostrarNotificacion === 'function') mostrarNotificacion("OK", "Baja", "success"); 
            cargarInsumos(); } catch (error) { if(typeof mostrarNotificacion === 'function') mostrarNotificacion("Error", "Fallo", "error"); } 
        });
    } else {
        if(confirm("¿Dar de baja?")) {
            fetch(`${API_URL_INS}/insumos/${id}`, { method: 'DELETE' }).then(() => cargarInsumos());
        }
    }
};

window.abrirKardex = async function(id, nombre) { 
    const modalTitle = document.getElementById("kardex-titulo") || document.getElementById("kardex-insumo-nombre");
    if(modalTitle) modalTitle.innerHTML = `Historial: ${nombre}`; 
    
    const tbody = document.getElementById("kardex-body") || document.querySelector("#tabla-kardex tbody"); 
    if(tbody) tbody.innerHTML = "<tr><td colspan='5' class='text-center'>Buscando...</td></tr>"; 
    
    const modalEl = document.getElementById("modalKardex") || document.getElementById("modalKardexInsumo");
    if(modalEl) bootstrap.Modal.getOrCreateInstance(modalEl).show(); 
    
    try { 
        // Intenta usar la ruta nueva o la ruta vieja según tu backend
        let res = await fetch(`${API_URL_INS}/insumos/${id}/kardex`); 
        if(!res.ok) res = await fetch(`${API_URL_INS}/kardex/${id}`);
        renderKardex(await res.json(), tbody);
    } catch (error) {
        if(tbody) tbody.innerHTML = "<tr><td colspan='5' class='text-center text-danger'>Fallo al cargar.</td></tr>"; 
    } 
};

function renderKardex(movimientos, tbody) {
    if(!tbody) return;
    tbody.innerHTML = ""; 
    if(movimientos.length === 0) { 
        // AQUI ESTABA EL ERROR: Comillas arregladas usando backticks
        tbody.innerHTML = `<tr><td colspan='5' class='text-center text-muted py-4'><i class="bi bi-inbox fs-3 d-block mb-2"></i>No hay entradas ni salidas registradas para este insumo aún.</td></tr>`; 
        return; 
    } 
    movimientos.forEach(m => { 
        let badgeMov = m.tipo_movimiento === 'ENTRADA' ? '<span class="badge bg-success">ENTRADA</span>' : '<span class="badge bg-danger">SALIDA</span>'; 
        let signo = m.tipo_movimiento === 'ENTRADA' ? '+' : '-'; 
        let cantidad = parseFloat(m.cantidad || 0).toFixed(3);
        tbody.insertAdjacentHTML("beforeend", `<tr><td class="small">${new Date(m.fecha).toLocaleString()}</td><td>${badgeMov}</td><td class="text-center fw-bold ${m.tipo_movimiento === 'ENTRADA' ? 'text-success' : 'text-danger'}">${signo}${cantidad}</td><td class="small text-muted">${m.motivo || ''}</td><td class="small"><i class="bi bi-person"></i> ${m.usuario || 'Sistema'}</td></tr>`); 
    }); 
}

// RESTAURACIÓN DEL MÓDULO DE COMPRAS RÁPIDAS
window.abrirModalCompraRapida = async function() { 
    await cargarProveedoresSelect("compra-proveedor"); 
    const selInsumo = document.getElementById("compra-insumo"); 
    if(!selInsumo) return;
    selInsumo.innerHTML = "<option value='' disabled selected>Selecciona...</option>"; 
    insumosOriginal.filter(i => i.activo !== false && i.activo !== 0).forEach(i => { 
        selInsumo.innerHTML += `<option value="${i.id}">${i.nombre} (${i.unidad})</option>`; 
    }); 
    const modalEl = document.getElementById("modalCompraRapida");
    if(modalEl) bootstrap.Modal.getOrCreateInstance(modalEl).show(); 
};

window.registrarCompra = async function(event) { 
    event.preventDefault(); 
    const proveedor_id = parseInt(document.getElementById("compra-proveedor")?.value); 
    const insumo_id = parseInt(document.getElementById("compra-insumo")?.value); 
    const cantidad = parseFloat(document.getElementById("compra-cantidad")?.value); 
    const costo_total = parseFloat(document.getElementById("compra-total")?.value); 
    const empleado_id = localStorage.getItem("usuario_id") ? parseInt(localStorage.getItem("usuario_id")) : null; 
    const radioPago = document.querySelector('input[name="tipoPago"]:checked');
    const tipo_pago = radioPago ? radioPago.value : 'CONTADO'; 
    
    if(!proveedor_id || !insumo_id || isNaN(cantidad) || cantidad <= 0 || isNaN(costo_total) || costo_total < 0) {
        if(typeof mostrarNotificacion === 'function') mostrarNotificacion("Error", "Montos inválidos", "warning"); 
        else alert("Montos inválidos");
        return;
    }
    
    try { 
        const res = await fetch(`${API_URL_INS}/compras/rapida`, { 
            method: 'POST', headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ proveedor_id, insumo_id, cantidad, costo_total, empleado_id, tipo_pago }) 
        }); 
        if(!res.ok) throw new Error("Error"); 
        if(typeof mostrarNotificacion === 'function') mostrarNotificacion("OK", "Compra registrada", "success"); 
        document.getElementById("form-compra-rapida")?.reset(); 
        const modalEl = document.getElementById("modalCompraRapida");
        if(modalEl) bootstrap.Modal.getInstance(modalEl).hide(); 
        cargarInsumos(); 
    } catch (error) {
        console.error("Error al registrar compra", error);
    } 
};

window.cargarProveedoresSelect = async function(selectId, seleccionado = null) { 
    try { 
        const res = await fetch(`${API_URL_INS}/proveedores`); 
        const proveedores = await res.json(); 
        const select = document.getElementById(selectId); 
        if(!select) return;
        select.innerHTML = "<option value=''>Sin proveedor</option>"; 
        proveedores.filter(p => p.activo !== 0 && p.activo !== false).forEach(p => { 
            proveedoresMap[p.id] = p.nombre; 
            const option = document.createElement("option"); 
            option.value = p.id; 
            option.innerText = p.nombre; 
            if (seleccionado && parseInt(seleccionado) === p.id) option.selected = true; 
            select.appendChild(option); 
        }); 
    } catch (error) {} 
}

// RESTAURACIÓN DE AGREGAR Y EDITAR INSUMO
window.agregarInsumo = async function(event) { 
    event.preventDefault(); 
    const nombre = document.getElementById("nombre-insumo")?.value.trim() || document.getElementById("ins-nombre")?.value.trim(); 
    const unidad = document.getElementById("unidad-insumo")?.value.trim() || document.getElementById("ins-unidad")?.value.trim(); 
    const precio = parseFloat(document.getElementById("precio-insumo")?.value || document.getElementById("ins-precio")?.value); 
    const proveedor_id = document.getElementById("proveedor-insumo")?.value || null; 
    
    if (!nombre || isNaN(precio) || precio <= 0) {
        if(typeof mostrarNotificacion === 'function') mostrarNotificacion("Atención", "Error en campos", "warning"); 
        else alert("Nombre y precio son requeridos");
        return;
    }
    
    try { 
        await fetch(`${API_URL_INS}/insumos`, { 
            method: 'POST', headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ nombre, unidad, precio, proveedor_id: proveedor_id ? parseInt(proveedor_id) : null }) 
        }); 
        const modalEl = document.getElementById("modalAgregarInsumo") || document.getElementById("modalInsumo");
        if(modalEl) bootstrap.Modal.getInstance(modalEl).hide(); 
        document.getElementById("form-agregar-insumo")?.reset(); 
        if(typeof mostrarNotificacion === 'function') mostrarNotificacion("OK", "Guardado", "success"); 
        cargarInsumos(); 
    } catch (error) {} 
}

window.abrirEditarInsumo = async function(id) { 
    try { 
        const res = await fetch(`${API_URL_INS}/insumos/${id}`); 
        if(!res.ok) throw new Error("Fallo");
        const data = await res.json(); 
        await cargarProveedoresSelect("edit-proveedor-insumo", data.proveedor_id); 
        
        const setVal = (elId, val) => { const el = document.getElementById(elId); if(el) el.value = val; };
        setVal("edit-id-insumo", data.id); 
        setVal("edit-nombre-insumo", data.nombre); 
        setVal("edit-unidad-insumo", data.unidad || ""); 
        setVal("edit-precio-insumo", data.precio !== null ? data.precio : ""); 
        
        const modalEl = document.getElementById("modalEditarInsumo");
        if(modalEl) bootstrap.Modal.getOrCreateInstance(modalEl).show(); 
    } catch (error) {} 
}

window.actualizarInsumo = async function(event) { 
    event.preventDefault(); 
    const id = document.getElementById("edit-id-insumo")?.value; 
    const nombre = document.getElementById("edit-nombre-insumo")?.value.trim(); 
    const unidad = document.getElementById("edit-unidad-insumo")?.value.trim(); 
    const precio = parseFloat(document.getElementById("edit-precio-insumo")?.value); 
    const proveedor_id = document.getElementById("edit-proveedor-insumo")?.value || null; 
    
    if (isNaN(precio) || precio <= 0) return alert("Precio Inválido"); 
    
    try { 
        await fetch(`${API_URL_INS}/insumos/${id}`, { 
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ nombre, unidad, precio, proveedor_id: proveedor_id ? parseInt(proveedor_id) : null }) 
        }); 
        const modalEl = document.getElementById("modalEditarInsumo");
        if(modalEl) bootstrap.Modal.getInstance(modalEl).hide(); 
        if(typeof mostrarNotificacion === 'function') mostrarNotificacion("OK", "Actualizado", "success"); 
        cargarInsumos(); 
    } catch (error) {} 
}

// RESTAURACIÓN DE LA CALCULADORA DE RECETAS
window.abrirCalculadora = function() { 
    const modalEl = document.getElementById("modalCalculadora");
    if(modalEl) bootstrap.Modal.getOrCreateInstance(modalEl).show(); 
};

window.llenarSelectCalculadora = function(insumos) { 
    const select = document.getElementById("calc-insumo"); 
    if (!select) return;
    select.innerHTML = '<option value="">Selecciona qué insumo usarás...</option>'; 
    insumos.forEach(i => { 
        const precio = parseFloat(i.precio || 0);
        select.innerHTML += `<option value="${i.id}" data-precio="${precio}" data-unidad="${i.unidad}">${i.nombre} (Costo: C$ ${precio})</option>`; 
    }); 
}

window.calcularReceta = function() { 
    const select = document.getElementById("calc-insumo"); 
    const rendimiento = parseInt(document.getElementById("calc-rendimiento")?.value); 
    const meta = parseInt(document.getElementById("calc-meta")?.value); 
    const divRes = document.getElementById("calc-resultado"); 
    
    if(!select || !divRes) return;

    if (!select.value || isNaN(rendimiento) || isNaN(meta) || rendimiento <= 0 || meta <= 0) { 
        divRes.innerHTML = `<h6 class="text-muted">Ingresa valores mayores a 0 para ver el cálculo</h6>`; 
        return; 
    } 
    
    const optionSel = select.options[select.selectedIndex]; 
    const precioSaco = parseFloat(optionSel.dataset.precio || 0); 
    const unidad = optionSel.dataset.unidad || 'und'; 
    const insumosNecesarios = meta / rendimiento; 
    const costoTotalProduccion = insumosNecesarios * precioSaco; 
    const costoUnidad = costoTotalProduccion / meta; 
    
    divRes.innerHTML = `
        <h5 class="fw-bold text-dark">Para fabricar ${meta} unidades necesitas:</h5>
        <h3 class="text-warning fw-bold">${insumosNecesarios.toFixed(2)} x [${unidad}]</h3>
        <hr>
        <div class="row text-start mt-2">
            <div class="col-6"><strong>Inversión en Insumo:</strong></div>
            <div class="col-6 text-end text-danger fw-bold">C$ ${Math.ceil(costoTotalProduccion)}</div>
            <div class="col-6"><strong>Costo por 1 unidad:</strong></div>
            <div class="col-6 text-end text-muted">C$ ${costoUnidad.toFixed(2)}</div>
        </div>`; 
}

// BINDINGS (EventListeners)
document.getElementById("busqueda-insumos")?.addEventListener("input", filtrarInsumos);
document.getElementById("form-agregar-insumo")?.addEventListener("submit", agregarInsumo);
document.getElementById("form-editar-insumo")?.addEventListener("submit", actualizarInsumo);
document.getElementById("form-compra-rapida")?.addEventListener("submit", registrarCompra);

document.getElementById("modalAgregarInsumo")?.addEventListener("show.bs.modal", () => cargarProveedoresSelect("proveedor-insumo"));

document.getElementById("calc-insumo")?.addEventListener("change", calcularReceta);
document.getElementById("calc-rendimiento")?.addEventListener("input", calcularReceta);
document.getElementById("calc-meta")?.addEventListener("input", calcularReceta);

// ========================================================
// VALIDACIONES EN TIEMPO REAL
// ========================================================
['precio-insumo', 'edit-precio-insumo', 'ins-precio'].forEach(id => {
    document.getElementById(id)?.addEventListener("input", function() {
        this.value = this.value.replace(/[^0-9.]/g, '');
        if ((this.value.match(/\./g) || []).length > 1) this.value = this.value.replace(/\.+$/, "");
    });
});

document.getElementById("compra-cantidad")?.addEventListener("input", function() {
    this.value = this.value.replace(/[^0-9.]/g, '');
    if ((this.value.match(/\./g) || []).length > 1) this.value = this.value.replace(/\.+$/, "");
});

['nombre-insumo', 'edit-nombre-insumo', 'ins-nombre'].forEach(id => {
    document.getElementById(id)?.addEventListener("input", function() {
        if (this.value.length > 50) this.value = this.value.slice(0, 50);
    });
});