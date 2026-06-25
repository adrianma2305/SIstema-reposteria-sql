const API_URL = "https://sistema-pasteleria-sql.onrender.com/api";
let productosOriginal = []; let insumosAlmacenados = []; let recetaTemporal = []; 
let verInactivosProd = false; let costoAcumuladoGlobal = 0; 

document.addEventListener("DOMContentLoaded", () => {
    const rowProd = document.querySelector("#seccion-productos .row.mb-3");
    if(rowProd && !document.getElementById("toggle-inactivos-prod")) {
        rowProd.insertAdjacentHTML('beforeend', `<div class="col-md-3 mt-2"><div class="form-check form-switch"><input class="form-check-input bg-danger" type="checkbox" id="toggle-inactivos-prod"><label class="form-check-label fw-bold text-muted small">Ver Eliminados</label></div></div>`);
        document.getElementById("toggle-inactivos-prod").addEventListener("change", (e) => { verInactivosProd = e.target.checked; filtrarProductos(); });
    }
    const inputPrecioAdd = document.getElementById("precio");
    if(inputPrecioAdd && !document.getElementById("indicador-ganancia-add")) {
        inputPrecioAdd.parentElement.insertAdjacentHTML('beforeend', `<div id="indicador-ganancia-add" class="mt-2 p-2 rounded small fw-bold text-center border" style="display:none;"></div>`);
        inputPrecioAdd.addEventListener("input", actualizarSemaforoAdd);
    }
    const inputPrecioEdit = document.getElementById("edit-precio");
    if(inputPrecioEdit && !document.getElementById("indicador-ganancia-edit")) {
        inputPrecioEdit.parentElement.insertAdjacentHTML('beforeend', `<div id="indicador-ganancia-edit" class="mt-2 p-2 rounded small fw-bold text-center border" style="display:none;"></div>`);
        inputPrecioEdit.addEventListener("input", actualizarSemaforoEdit);
    }
    cargarProductos();
});

async function cargarProductos() {
  const tabla = document.querySelector("#productos-table tbody");
  tabla.innerHTML = "<tr><td colspan='5' class='text-center'>Cargando menú desde Azure...</td></tr>";
  try { const respuesta = await fetch(`${API_URL}/productos`); if (!respuesta.ok) throw new Error(); productosOriginal = await respuesta.json(); filtrarProductos(); await cargarSelectInsumosReceta(); cargarSelectsCategorias(); } catch (error) { tabla.innerHTML = "<tr><td colspan='5' class='text-center text-danger'>Error al conectar.</td></tr>"; }
}

function renderizarProductos(productos) {
  const tabla = document.querySelector("#productos-table tbody"); tabla.innerHTML = "";
  const isAdmin = (typeof esAdmin === 'function') ? esAdmin() : false;
  productos.forEach((p) => {
    const esInactivo = (p.activo === false || p.activo === 0);
    const rowStyle = esInactivo ? "opacity: 0.5; background-color: #f8f9fa;" : "";
    const badgeStock = esInactivo ? `<span class="badge bg-danger ms-2">Descontinuado</span>` : (p.stock > 0 ? `<span class="badge bg-success ms-2">${p.stock} en vitrina</span>` : `<span class="badge bg-danger ms-2">Agotado</span>`);
    let botonesAccion = "";
    if (isAdmin) {
        if (esInactivo) { botonesAccion = `<button class="btn btn-sm btn-success fw-bold" onclick="reactivarProducto(${p.id})"><i class="bi bi-arrow-counterclockwise"></i> Reactivar</button>`; } 
        else { botonesAccion = `<button class="btn btn-sm btn-primary me-1" onclick="verRecetaModal(${p.id}, '${p.nombre}')"><i class="bi bi-journal-text"></i></button> <button class="btn btn-sm btn-info text-white me-1" onclick="abrirEditarProducto(${p.id})"><i class="bi bi-pencil"></i></button> <button class="btn btn-sm btn-danger" onclick="eliminarProducto(${p.id})"><i class="bi bi-trash"></i></button>`; }
    } else { botonesAccion = `<span class="badge bg-secondary">Solo lectura</span>`; }
    
    const costoFabricacion = p.costo || 0; const gananciaNeta = p.precio - costoFabricacion;
    let infoFinanciera = `<div class="fw-bold fs-6">C$ ${p.precio}</div>`;
    if (costoFabricacion > 0) {
      if(gananciaNeta >= 0) infoFinanciera += `<small class="text-success fw-bold"><i class="bi bi-graph-up-arrow"></i> Ganas: C$ ${gananciaNeta.toFixed(0)}</small>`; 
      else infoFinanciera += `<small class="text-danger fw-bold"><i class="bi bi-exclamation-triangle"></i> Pierdes: C$ ${Math.abs(gananciaNeta).toFixed(0)}</small>`;
      infoFinanciera += `<br><small class="text-muted" style="font-size:0.75em;">Costo Insumos: C$ ${costoFabricacion.toFixed(0)}</small>`;
    } else infoFinanciera += `<small class="badge bg-secondary">Directo / Sin Receta</small>`; 
    tabla.insertAdjacentHTML("beforeend", `<tr style="${rowStyle}"><td>${p.id}</td><td><div class="fw-bold">${p.nombre} ${badgeStock}</div></td><td><span class="badge bg-dark">${p.categoria?.nombre || 'General'}</span></td><td>${infoFinanciera}</td><td>${botonesAccion}</td></tr>`);
  });
}

function filtrarProductos() { 
    const valor = document.getElementById("busqueda-productos").value.trim().toLowerCase(); const precioBuscado = document.getElementById("busqueda-precio").value; const categoriaBuscada = document.getElementById("filtro-categoria").value; 
    let filtrados = productosOriginal.filter((p) => p.nombre.toLowerCase().includes(valor)); 
    if (precioBuscado !== "") filtrados = filtrados.filter((p) => p.precio == parseInt(precioBuscado)); 
    if (categoriaBuscada !== "") filtrados = filtrados.filter((p) => p.categoria_id == parseInt(categoriaBuscada)); 
    if (!verInactivosProd) filtrados = filtrados.filter(p => p.activo !== false && p.activo !== 0);
    renderizarProductos(filtrados); 
}

function actualizarSemaforoAdd() {
    const inputPrecio = document.getElementById("precio"); const divIndicador = document.getElementById("indicador-ganancia-add"); if(!inputPrecio || !divIndicador) return;
    const precio = parseFloat(inputPrecio.value) || 0; divIndicador.style.display = "block";
    if (costoAcumuladoGlobal === 0) { divIndicador.className = "mt-2 p-2 rounded small fw-bold text-center bg-light text-dark border border-secondary"; divIndicador.innerHTML = `Venta Directa: Ganas el 100% (Sin receta)`; return; }
    const ganancia = precio - costoAcumuladoGlobal;
    if (ganancia > 0) { divIndicador.className = "mt-2 p-2 rounded small fw-bold text-center bg-success text-white shadow-sm"; divIndicador.innerHTML = `Costo C$ ${costoAcumuladoGlobal.toFixed(2)}. Ganancia C$ ${ganancia.toFixed(2)}`; } 
    else if (ganancia === 0) { divIndicador.className = "mt-2 p-2 rounded small fw-bold text-center bg-warning text-dark shadow-sm"; divIndicador.innerHTML = `Costo igual al precio. Ganancia C$ 0.`; } 
    else { divIndicador.className = "mt-2 p-2 rounded small fw-bold text-center bg-danger text-white shadow-sm"; divIndicador.innerHTML = `¡PÉRDIDA! Cuesta C$ ${costoAcumuladoGlobal.toFixed(2)}. Pierdes C$ ${Math.abs(ganancia).toFixed(2)}.`; }
}

function actualizarSemaforoEdit() {
    const inputPrecio = document.getElementById("edit-precio"); const divIndicador = document.getElementById("indicador-ganancia-edit"); if(!inputPrecio || !divIndicador) return;
    const costoBase = parseFloat(divIndicador.dataset.costo) || 0; const precio = parseFloat(inputPrecio.value) || 0; divIndicador.style.display = "block";
    if (costoBase === 0) { divIndicador.className = "mt-2 p-2 rounded small fw-bold text-center bg-light text-dark border border-secondary"; divIndicador.innerHTML = `Producto de reventa directo.`; return; }
    const ganancia = precio - costoBase;
    if (ganancia > 0) { divIndicador.className = "mt-2 p-2 rounded small fw-bold text-center bg-success text-white shadow-sm"; divIndicador.innerHTML = `Costo: C$ ${costoBase.toFixed(2)} | Ganancia: C$ ${ganancia.toFixed(2)}`; } 
    else { divIndicador.className = "mt-2 p-2 rounded small fw-bold text-center bg-danger text-white shadow-sm"; divIndicador.innerHTML = `¡Atención! Pierdes C$ ${Math.abs(ganancia).toFixed(2)} por unidad.`; }
}

window.reactivarProducto = function(id) { mostrarConfirmacion("¿Deseas volver a vender este producto?", async () => { try { await fetch(`${API_URL}/productos/${id}/reactivar`, { method: 'PUT' }); mostrarNotificacion("Restaurado", "Activo", "success"); cargarProductos(); } catch (error) { mostrarNotificacion("Error", "Fallo", "error"); } }); };
window.eliminarProducto = function(id) { mostrarConfirmacion("¿Deseas deshabilitar este producto?", async () => { try { await fetch(`${API_URL}/productos/${id}`, { method: 'DELETE' }); mostrarNotificacion("Eliminado", "Ocultado", "success"); cargarProductos(); } catch (error) { mostrarNotificacion("Error", "Fallo", "error"); } }); };

window.abrirEditarProducto = function(id) { const prod = productosOriginal.find(p => p.id === id); if(!prod) return; document.getElementById("edit-id").value = prod.id; document.getElementById("edit-nombre").value = prod.nombre; document.getElementById("edit-precio").value = prod.precio; document.getElementById("edit-categoria-principal").innerHTML = document.getElementById("categoria-principal").innerHTML; document.getElementById("edit-categoria-principal").value = prod.categoria_id || ""; const indicador = document.getElementById("indicador-ganancia-edit"); if(indicador) { indicador.dataset.costo = prod.costo || 0; actualizarSemaforoEdit(); } new bootstrap.Modal(document.getElementById("modalEditar")).show(); };
document.getElementById("form-editar").addEventListener("submit", async (event) => { event.preventDefault(); const id = document.getElementById("edit-id").value; const nombre = document.getElementById("edit-nombre").value.trim(); const precio = parseInt(document.getElementById("edit-precio").value, 10); const categoria_id = document.getElementById("edit-categoria-principal").value ? parseInt(document.getElementById("edit-categoria-principal").value) : null; if(isNaN(precio) || precio <= 0) return mostrarNotificacion("Error", "El precio de venta debe ser mayor a 0", "error"); try { await fetch(`${API_URL}/productos/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre, precio, categoria_id }) }); bootstrap.Modal.getInstance(document.getElementById("modalEditar")).hide(); mostrarNotificacion("Actualizado", "OK", "success"); cargarProductos(); } catch (error) { mostrarNotificacion("Error", "Fallo", "error"); } });

async function cargarSelectInsumosReceta() { try { const respuesta = await fetch(`${API_URL}/insumos`); insumosAlmacenados = await respuesta.json(); const select = document.getElementById("insumo-receta-select"); if(select) { select.innerHTML = '<option value="" disabled selected>Selecciona ingrediente...</option>'; insumosAlmacenados.forEach(i => { if(i.activo !== 0 && i.activo !== false) select.innerHTML += `<option value="${i.id}">${i.nombre} (${i.unidad}) - Base C$${i.precio}</option>`; }); } } catch (error) {} }
function limpiarRecetaTemporal() { recetaTemporal = []; costoAcumuladoGlobal = 0; document.getElementById("receta-rendimiento-lote").value = "1"; renderizarTablaRecetaTemporal(); document.getElementById("indicador-ganancia-add").style.display = "none"; }
function agregarIngredienteATemporal() { const select = document.getElementById("insumo-receta-select"); const cantInput = document.getElementById("insumo-receta-cantidad"); const rendimientoInput = document.getElementById("receta-rendimiento-lote"); const rendimientoLote = parseFloat(rendimientoInput.value) || 1; if(!select.value || !cantInput.value || parseFloat(cantInput.value) <= 0) return mostrarNotificacion('Atención', 'Selecciona ingrediente y cantidad mayor a 0.', 'warning'); const insumoId = parseInt(select.value); const cantidadDigitada = parseFloat(cantInput.value); const cantidadUnitariaCalculada = cantidadDigitada / rendimientoLote; const insumoObj = insumosAlmacenados.find(i => i.id === insumoId); if(recetaTemporal.some(item => item.insumo_id === insumoId)) return mostrarNotificacion('Duplicado', 'Ya está en la lista.', 'warning'); recetaTemporal.push({ insumo_id: insumoId, nombre: insumoObj.nombre, cantidad_lote_visible: cantidadDigitada, cantidad_necesaria: cantidadUnitariaCalculada, subtotal: (cantidadUnitariaCalculada * insumoObj.precio) }); cantInput.value = ""; renderizarTablaRecetaTemporal(); }
function quitarIngredienteTemporal(index) { recetaTemporal.splice(index, 1); renderizarTablaRecetaTemporal(); }
function renderizarTablaRecetaTemporal() { const tbody = document.getElementById("tabla-receta-temporal"); const lblTotal = document.getElementById("lbl-costo-receta"); if(!tbody) return; tbody.innerHTML = ""; costoAcumuladoGlobal = 0; if(recetaTemporal.length === 0) { tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">Añade ingredientes para receta.</td></tr>`; lblTotal.innerText = "0"; actualizarSemaforoAdd(); return; } recetaTemporal.forEach((item, index) => { costoAcumuladoGlobal += item.subtotal; tbody.insertAdjacentHTML("beforeend", `<tr><td><strong>${item.nombre}</strong></td><td>${item.cantidad_lote_visible}</td><td><span class="badge bg-secondary">${item.cantidad_necesaria.toFixed(4)} / ud</span></td><td class="fw-bold text-success">C$ ${item.subtotal.toFixed(1)}</td><td class="text-end"><button type="button" class="btn btn-sm btn-link p-0 text-danger" onclick="quitarIngredienteTemporal(${index})"><i class="bi bi-trash"></i></button></td></tr>`); }); lblTotal.innerText = Math.ceil(costoAcumuladoGlobal); actualizarSemaforoAdd(); }
async function verRecetaModal(id, nombreProducto) { document.getElementById("title-ver-receta").innerText = `Fórmula: ${nombreProducto}`; const tbody = document.getElementById("body-ver-receta"); tbody.innerHTML = "<tr><td colspan='3' class='text-center'>Consultando...</td></tr>"; new bootstrap.Modal(document.getElementById("modalVerReceta")).show(); try { const res = await fetch(`${API_URL}/productos/${id}/receta`); const datos = await res.json(); tbody.innerHTML = ""; if(datos.length === 0) return tbody.innerHTML = "<tr><td colspan='3' class='text-center text-muted'>Sin receta.</td></tr>"; datos.forEach(d => { tbody.insertAdjacentHTML("beforeend", `<tr><td class="fw-bold">${d.nombre_insumo}</td><td>${parseFloat(d.cantidad_necesaria).toFixed(4)} (${d.unidad})</td><td class="text-primary fw-bold">C$ ${Math.ceil(d.subtotal_costo)}</td></tr>`); }); } catch (error) { tbody.innerHTML = "<tr><td colspan='3' class='text-center text-danger'>Error.</td></tr>"; } }

async function agregarProducto(event) { event.preventDefault(); const nombre = document.getElementById("nombre").value.trim(); const precio = parseInt(document.getElementById("precio").value, 10); const categoria_id = document.getElementById("categoria-principal").value ? parseInt(document.getElementById("categoria-principal").value) : null; if (!nombre || isNaN(precio) || precio <= 0 || !categoria_id) return mostrarNotificacion("Atención", "Revisa datos.", "warning"); if (costoAcumuladoGlobal > 0 && precio < costoAcumuladoGlobal) { return mostrarNotificacion("Alerta Financiera", "No puedes registrar un producto cuyo precio sea menor al costo. ¡Revisa tu semáforo!", "error"); } try { const respuesta = await fetch(`${API_URL}/productos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre, precio, categoria_id, receta: recetaTemporal }) }); if (!respuesta.ok) throw new Error("Error"); let msj = recetaTemporal.length > 0 ? "Guardado con receta" : "Guardado como Venta Directa"; mostrarNotificacion("¡Éxito!", msj, "success"); document.getElementById("form-agregar").reset(); limpiarRecetaTemporal(); bootstrap.Modal.getInstance(document.getElementById("modalAgregar")).hide(); cargarProductos(); } catch (error) { mostrarNotificacion("Error", "Fallo con Azure", "error"); } }
function abrirModalProduccion() { const select = document.getElementById("prod-produccion"); if(!select) return; select.innerHTML = '<option value="" disabled selected>Selecciona producto...</option>'; productosOriginal.filter(p => p.activo !== false && p.activo !== 0).forEach(p => { select.innerHTML += `<option value="${p.id}">${p.nombre}</option>`; }); new bootstrap.Modal(document.getElementById("modalProduccion")).show(); }
async function ejecutarProduccion(event) { event.preventDefault(); const producto_id = parseInt(document.getElementById("prod-produccion").value); const cantidad_producida = parseInt(document.getElementById("cant-produccion").value, 10); const usuario_id = localStorage.getItem("usuario_id") ? parseInt(localStorage.getItem("usuario_id")) : null; if(!producto_id || isNaN(cantidad_producida) || cantidad_producida <= 0) return mostrarNotificacion("Atención", "Ingresa cantidad válida", "warning"); try { const respuesta = await fetch(`${API_URL}/produccion`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ producto_id, cantidad_producida, usuario_id }) }); if(!respuesta.ok) throw new Error(await respuesta.text()); const data = await respuesta.json(); if (data.tipo === 'directo') { mostrarNotificacion("Stock", "Se sumó a la vitrina (Venta Directa).", "success"); } else { mostrarNotificacion("Stock", "Se descontaron insumos y se horneó.", "success"); } document.getElementById("form-produccion").reset(); bootstrap.Modal.getInstance(document.getElementById("modalProduccion")).hide(); cargarProductos(); } catch (error) { mostrarNotificacion("Fallo", error.message, "error"); } }
async function cargarSelectsCategorias() { try { const respuesta = await fetch(`${API_URL}/categorias`); const categorias = await respuesta.json(); const selectFiltro = document.getElementById("filtro-categoria"); const selectAgregar = document.getElementById("categoria-principal"); let htmlFiltro = '<option value="">Todas las categorías</option>'; let htmlModal = '<option value="">Seleccione una categoría...</option>'; categorias.forEach(c => { htmlFiltro += `<option value="${c.id}">${c.nombre}</option>`; htmlModal += `<option value="${c.id}">${c.nombre}</option>`; }); if (selectFiltro) selectFiltro.innerHTML = htmlFiltro; if (selectAgregar) selectAgregar.innerHTML = htmlModal; } catch (error) {} }

document.getElementById("busqueda-productos").addEventListener("input", filtrarProductos); document.getElementById("busqueda-precio").addEventListener("input", filtrarProductos); document.getElementById("filtro-categoria").addEventListener("change", filtrarProductos); document.getElementById("form-agregar").addEventListener("submit", agregarProducto);