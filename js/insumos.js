const API_URL_INS = "https://sistema-pasteleria-sql.onrender.com/api";
let insumosOriginal = [];
let proveedoresMap = {};
let verInactivosIns = false;

document.addEventListener("DOMContentLoaded", () => {
    // Inyección dinámica del botón "Ver Eliminados"
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
    
    // Aquí es donde chocaba antes porque faltaba la función. ¡Ya está arreglado!
    llenarSelectCalculadora(insumosOriginal.filter(i => i.activo !== false && i.activo !== 0));
  } catch (error) { 
    console.error(error);
    tabla.innerHTML = "<tr><td colspan='6' class='text-center text-danger'>Error.</td></tr>"; 
  }
}

function filtrarInsumos() {
  const valor = document.getElementById("busqueda-insumos").value.trim().toLowerCase();
  let filtrados = insumosOriginal.filter((i) => i.nombre.toLowerCase().includes(valor));
  if (!verInactivosIns) filtrados = filtrados.filter(i => i.activo !== false && i.activo !== 0);
  renderizarInsumos(filtrados);
}

function renderizarInsumos(insumos) {
  const tabla = document.querySelector("#insumos-table tbody"); tabla.innerHTML = "";
  insumos.forEach((i) => {
    const esInactivo = (i.activo === false || i.activo === 0);
    const rowStyle = esInactivo ? "opacity: 0.5; background-color: #f8f9fa;" : "";
    let colorStock = i.stock_actual <= 5 ? "text-danger" : "text-success";
    let iconoAlerta = i.stock_actual <= 5 && !esInactivo ? '<i class="bi bi-exclamation-triangle-fill ms-1" title="Crítico"></i>' : '';
    
    let botonesAccion = esInactivo 
        ? `<button class="btn btn-sm btn-success fw-bold" onclick="reactivarInsumo(${i.id})"><i class="bi bi-arrow-counterclockwise"></i> Restaurar</button>` 
        : `<button class="btn btn-sm btn-dark me-1" onclick="abrirKardex(${i.id}, '${i.nombre}')"><i class="bi bi-clock-history"></i></button> <button class="btn btn-sm btn-info text-white me-1" onclick="abrirEditarInsumo(${i.id})"><i class="bi bi-pencil"></i></button> <button class="btn btn-sm btn-danger" onclick="eliminarInsumo(${i.id})"><i class="bi bi-trash"></i></button>`;
        
    tabla.insertAdjacentHTML("beforeend", `<tr style="${rowStyle}"><td>${i.id}</td><td class="fw-bold">${i.nombre} <br><small class="text-muted">${i.unidad}</small> ${esInactivo ? '<span class="badge bg-danger ms-1">Baja</span>' : ''}</td><td class="text-center bg-light fs-5 fw-bold ${colorStock} border-start border-end">${i.stock_actual.toFixed(2)} ${iconoAlerta}</td><td class="text-primary fw-bold">C$ ${i.precio !== null ? i.precio : ""}</td><td><span class="badge bg-secondary">${i.proveedores?.nombre || "Sin proveedor"}</span></td><td class="text-center">${botonesAccion}</td></tr>`);
  });
}

window.reactivarInsumo = function(id) { mostrarConfirmacion("¿Volver a ingresar?", async () => { try { await fetch(`${API_URL_INS}/insumos/${id}/reactivar`, { method: 'PUT' }); mostrarNotificacion("OK", "Activo", "success"); cargarInsumos(); } catch (error) { mostrarNotificacion("Error", "Fallo", "error"); } }); };
window.eliminarInsumo = function(id) { mostrarConfirmacion("¿Dar de baja?", async () => { try { await fetch(`${API_URL_INS}/insumos/${id}`, { method: 'DELETE' }); mostrarNotificacion("OK", "Baja", "success"); cargarInsumos(); } catch (error) { mostrarNotificacion("Error", "Fallo", "error"); } }); };

async function abrirKardex(id, nombre) { document.getElementById("kardex-titulo").innerHTML = `Historial: ${nombre}`; const tbody = document.getElementById("kardex-body"); tbody.innerHTML = "<tr><td colspan='5' class='text-center'>Buscando...</td></tr>"; new bootstrap.Modal(document.getElementById("modalKardex")).show(); try { const res = await fetch(`${API_URL_INS}/kardex/${id}`); const movimientos = await res.json(); tbody.innerHTML = ""; if(movimientos.length === 0) { tbody.innerHTML = "<tr><td colspan='5' class='text-center text-muted'>Vacío</td></tr>"; return; } movimientos.forEach(m => { let badgeMov = m.tipo_movimiento === 'ENTRADA' ? '<span class="badge bg-success">ENTRADA</span>' : '<span class="badge bg-danger">SALIDA</span>'; let signo = m.tipo_movimiento === 'ENTRADA' ? '+' : '-'; tbody.insertAdjacentHTML("beforeend", `<tr><td class="small">${new Date(m.fecha).toLocaleString()}</td><td>${badgeMov}</td><td class="text-center fw-bold ${m.tipo_movimiento === 'ENTRADA' ? 'text-success' : 'text-danger'}">${signo}${parseFloat(m.cantidad).toFixed(3)}</td><td class="small text-muted">${m.motivo}</td><td class="small"><i class="bi bi-person"></i> ${m.usuario}</td></tr>`); }); } catch (error) {} }

async function abrirModalCompraRapida() { await cargarProveedoresSelect("compra-proveedor"); const selInsumo = document.getElementById("compra-insumo"); selInsumo.innerHTML = "<option value='' disabled selected>Selecciona...</option>"; insumosOriginal.filter(i => i.activo !== false && i.activo !== 0).forEach(i => { selInsumo.innerHTML += `<option value="${i.id}">${i.nombre} (${i.unidad})</option>`; }); new bootstrap.Modal(document.getElementById("modalCompraRapida")).show(); }
window.registrarCompra = async function(event) { event.preventDefault(); const proveedor_id = parseInt(document.getElementById("compra-proveedor").value); const insumo_id = parseInt(document.getElementById("compra-insumo").value); const cantidad = parseFloat(document.getElementById("compra-cantidad").value); const costo_total = parseInt(document.getElementById("compra-total").value); const empleado_id = localStorage.getItem("usuario_id") ? parseInt(localStorage.getItem("usuario_id")) : null; const tipo_pago = document.querySelector('input[name="tipoPago"]:checked').value; if(!proveedor_id || !insumo_id || isNaN(cantidad) || cantidad <= 0 || isNaN(costo_total) || costo_total < 0) return mostrarNotificacion("Error", "Montos inválidos", "warning"); try { const res = await fetch(`${API_URL_INS}/compras/rapida`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ proveedor_id, insumo_id, cantidad, costo_total, empleado_id, tipo_pago }) }); if(!res.ok) throw new Error("Error"); mostrarNotificacion("OK", "Compra registrada", "success"); document.getElementById("form-compra-rapida").reset(); bootstrap.Modal.getInstance(document.getElementById("modalCompraRapida")).hide(); cargarInsumos(); } catch (error) {} };

async function cargarProveedoresSelect(selectId, seleccionado = null) { try { const res = await fetch(`${API_URL_INS}/proveedores`); const proveedores = await res.json(); const select = document.getElementById(selectId); select.innerHTML = "<option value=''>Sin proveedor</option>"; proveedores.filter(p => p.activo !== 0 && p.activo !== false).forEach(p => { proveedoresMap[p.id] = p.nombre; const option = document.createElement("option"); option.value = p.id; option.innerText = p.nombre; if (seleccionado && parseInt(seleccionado) === p.id) option.selected = true; select.appendChild(option); }); } catch (error) {} }

async function agregarInsumo(event) { event.preventDefault(); const nombre = document.getElementById("nombre-insumo").value.trim(); const unidad = document.getElementById("unidad-insumo").value.trim(); const precio = parseFloat(document.getElementById("precio-insumo").value); const proveedor_id = document.getElementById("proveedor-insumo").value || null; if (!nombre || !unidad || isNaN(precio) || precio <= 0) return mostrarNotificacion("Atención", "Error", "warning"); try { await fetch(`${API_URL_INS}/insumos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre, unidad, precio, proveedor_id: proveedor_id ? parseInt(proveedor_id) : null }) }); bootstrap.Modal.getInstance(document.getElementById("modalAgregarInsumo")).hide(); document.getElementById("form-agregar-insumo").reset(); mostrarNotificacion("OK", "Guardado", "success"); cargarInsumos(); } catch (error) {} }
async function abrirEditarInsumo(id) { try { const res = await fetch(`${API_URL_INS}/insumos/${id}`); const data = await res.json(); await cargarProveedoresSelect("edit-proveedor-insumo", data.proveedor_id); document.getElementById("edit-id-insumo").value = data.id; document.getElementById("edit-nombre-insumo").value = data.nombre; document.getElementById("edit-unidad-insumo").value = data.unidad || ""; document.getElementById("edit-precio-insumo").value = data.precio !== null ? data.precio : ""; new bootstrap.Modal(document.getElementById("modalEditarInsumo")).show(); } catch (error) {} }
async function actualizarInsumo(event) { event.preventDefault(); const id = document.getElementById("edit-id-insumo").value; const nombre = document.getElementById("edit-nombre-insumo").value.trim(); const unidad = document.getElementById("edit-unidad-insumo").value.trim(); const precio = parseFloat(document.getElementById("edit-precio-insumo").value); const proveedor_id = document.getElementById("edit-proveedor-insumo").value || null; if (isNaN(precio) || precio <= 0) return mostrarNotificacion("Atención", "Inválido", "warning"); try { await fetch(`${API_URL_INS}/insumos/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre, unidad, precio, proveedor_id: proveedor_id ? parseInt(proveedor_id) : null }) }); bootstrap.Modal.getInstance(document.getElementById("modalEditarInsumo")).hide(); mostrarNotificacion("OK", "Actualizado", "success"); cargarInsumos(); } catch (error) {} }

// ==========================================
// AQUI ESTÁN LAS FUNCIONES RESTAURADAS
// ==========================================
window.abrirCalculadora = function() { 
    new bootstrap.Modal(document.getElementById("modalCalculadora")).show(); 
};

function llenarSelectCalculadora(insumos) { 
    const select = document.getElementById("calc-insumo"); 
    if (!select) return;
    select.innerHTML = '<option value="">Selecciona qué insumo usarás...</option>'; 
    insumos.forEach(i => { 
        select.innerHTML += `<option value="${i.id}" data-precio="${i.precio}" data-unidad="${i.unidad}">${i.nombre} (Costo: C$ ${i.precio})</option>`; 
    }); 
}

function calcularReceta() { 
    const select = document.getElementById("calc-insumo"); 
    const rendimiento = parseInt(document.getElementById("calc-rendimiento").value); 
    const meta = parseInt(document.getElementById("calc-meta").value); 
    const divRes = document.getElementById("calc-resultado"); 
    
    if (!select.value || isNaN(rendimiento) || isNaN(meta) || rendimiento <= 0 || meta <= 0) { 
        divRes.innerHTML = `<h6 class="text-muted">Ingresa valores mayores a 0 para ver el cálculo</h6>`; 
        return; 
    } 
    
    const optionSel = select.options[select.selectedIndex]; 
    const precioSaco = parseFloat(optionSel.dataset.precio); 
    const unidad = optionSel.dataset.unidad; 
    const insumosNecesarios = meta / rendimiento; 
    const costoTotalProduccion = insumosNecesarios * precioSaco; 
    const costoUnidad = costoTotalProduccion / meta; 
    
    divRes.innerHTML = `<h5 class="fw-bold text-dark">Para fabricar ${meta} unidades necesitas:</h5><h3 class="text-warning fw-bold">${insumosNecesarios.toFixed(2)} x [${unidad}]</h3><hr><div class="row text-start mt-2"><div class="col-6"><strong>Inversión en Insumo:</strong></div><div class="col-6 text-end text-danger fw-bold">C$ ${Math.ceil(costoTotalProduccion)}</div><div class="col-6"><strong>Costo por 1 unidad:</strong></div><div class="col-6 text-end text-muted">C$ ${costoUnidad.toFixed(2)}</div></div>`; 
}

document.getElementById("busqueda-insumos")?.addEventListener("input", filtrarInsumos);
document.getElementById("form-agregar-insumo")?.addEventListener("submit", agregarInsumo);
document.getElementById("form-editar-insumo")?.addEventListener("submit", actualizarInsumo);
document.getElementById("modalAgregarInsumo")?.addEventListener("show.bs.modal", () => cargarProveedoresSelect("proveedor-insumo"));

// Listeners de la calculadora restaurados
document.getElementById("calc-insumo")?.addEventListener("change", calcularReceta);
document.getElementById("calc-rendimiento")?.addEventListener("input", calcularReceta);
document.getElementById("calc-meta")?.addEventListener("input", calcularReceta);