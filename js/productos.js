const API_URL = "https://sistema-pasteleria-sql.onrender.com/api";
let productosOriginal = [];
let insumosAlmacenados = []; 
let recetaTemporal = []; 

async function cargarProductos() {
  const tabla = document.querySelector("#productos-table tbody");
  tabla.innerHTML = "<tr><td colspan='5' class='text-center'>Cargando menú desde Azure...</td></tr>";
  try {
    const respuesta = await fetch(`${API_URL}/productos`);
    if (!respuesta.ok) throw new Error();
    const productos = await respuesta.json();
    productosOriginal = productos;
    renderizarProductos(productos);
    await cargarSelectInsumosReceta();
    cargarSelectsCategorias();
  } catch (error) { tabla.innerHTML = "<tr><td colspan='5' class='text-center text-danger'>Error al conectar con la base de datos en la nube.</td></tr>"; }
}

function renderizarProductos(productos) {
  const tabla = document.querySelector("#productos-table tbody");
  tabla.innerHTML = "";
  const isAdmin = (typeof esAdmin === 'function') ? esAdmin() : false;

  productos.forEach((p) => {
    const botonesAccion = isAdmin ? `<button class="btn btn-sm btn-primary me-1" onclick="verRecetaModal(${p.id}, '${p.nombre}')" title="Ver Fórmula"><i class="bi bi-journal-text"></i></button><button class="btn btn-sm btn-danger" onclick="eliminarProducto(${p.id})" title="Eliminar"><i class="bi bi-trash"></i></button>` : `<span class="badge bg-secondary">Solo lectura</span>`;
    const costoFabricacion = p.costo || 0;
    const gananciaNeta = p.precio - costoFabricacion;
    
    let infoFinanciera = `<div class="fw-bold">C$ ${p.precio}</div>`;
    if (costoFabricacion > 0) {
      if(gananciaNeta >= 0) { infoFinanciera += `<small class="text-success fw-bold">Utilidad: C$ ${gananciaNeta.toFixed(0)}</small>`; } 
      else { infoFinanciera += `<small class="text-danger fw-bold">⚠️ Pérdida: C$ ${Math.abs(gananciaNeta).toFixed(0)}</small>`; }
      infoFinanciera += `<br><small class="text-muted text-xs">Costo Unitario: C$ ${costoFabricacion.toFixed(0)}</small>`;
    } else { infoFinanciera += `<small class="text-warning">Sin Receta (100% Margen)</small>`; }

    // FASE 4: MOSTRAR EL STOCK EN LA VITRINA
    const badgeStock = p.stock > 0 ? `<span class="badge bg-success ms-2">${p.stock} en vitrina</span>` : `<span class="badge bg-danger ms-2">Agotado</span>`;

    const fila = `
      <tr>
        <td>${p.id}</td>
        <td><div class="fw-bold">${p.nombre} ${badgeStock}</div></td>
        <td><span class="badge bg-dark">${p.categoria?.nombre || 'General'}</span></td>
        <td>${infoFinanciera}</td>
        <td>${botonesAccion}</td>
      </tr>
    `;
    tabla.insertAdjacentHTML("beforeend", fila);
  });
}

// ... EL RESTO DEL CÓDIGO (Recetas, Agregar, Hornear) QUEDA EXACTAMENTE IGUAL ...
async function cargarSelectInsumosReceta() { try { const respuesta = await fetch(`${API_URL}/insumos`); insumosAlmacenados = await respuesta.json(); const select = document.getElementById("insumo-receta-select"); if(select) { select.innerHTML = '<option value="" disabled selected>Selecciona ingrediente...</option>'; insumosAlmacenados.forEach(i => { select.innerHTML += `<option value="${i.id}">${i.nombre} (${i.unidad})</option>`; }); } } catch (error) {} }
function limpiarRecetaTemporal() { recetaTemporal = []; document.getElementById("receta-rendimiento-lote").value = "1"; renderizarTablaRecetaTemporal(); }
function agregarIngredienteATemporal() { const select = document.getElementById("insumo-receta-select"); const cantInput = document.getElementById("insumo-receta-cantidad"); const rendimientoInput = document.getElementById("receta-rendimiento-lote"); const rendimientoLote = parseFloat(rendimientoInput.value) || 1; if(!select.value || !cantInput.value || parseFloat(cantInput.value) <= 0) return alert("Selecciona un ingrediente y digita una cantidad."); const insumoId = parseInt(select.value); const cantidadDigitada = parseFloat(cantInput.value); const cantidadUnitariaCalculada = cantidadDigitada / rendimientoLote; const insumoObj = insumosAlmacenados.find(i => i.id === insumoId); if(recetaTemporal.some(item => item.insumo_id === insumoId)) return alert("El ingrediente ya está en la lista."); const subtotalCostoUnitario = cantidadUnitariaCalculada * insumoObj.precio; recetaTemporal.push({ insumo_id: insumoId, nombre: insumoObj.nombre, cantidad_lote_visible: cantidadDigitada, cantidad_necesaria: cantidadUnitariaCalculada, subtotal: subtotalCostoUnitario }); cantInput.value = ""; renderizarTablaRecetaTemporal(); }
function quitarIngredienteTemporal(index) { recetaTemporal.splice(index, 1); renderizarTablaRecetaTemporal(); }
function renderizarTablaRecetaTemporal() { const tbody = document.getElementById("tabla-receta-temporal"); const lblTotal = document.getElementById("lbl-costo-receta"); if(!tbody) return; tbody.innerHTML = ""; if(recetaTemporal.length === 0) { tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">Añade ingredientes.</td></tr>`; lblTotal.innerText = "0"; return; } let costoAcumuladoUnidad = 0; recetaTemporal.forEach((item, index) => { costoAcumuladoUnidad += item.subtotal; tbody.insertAdjacentHTML("beforeend", `<tr><td><strong>${item.nombre}</strong></td><td>${item.cantidad_lote_visible} <small>(lote)</small></td><td><span class="badge bg-secondary">${item.cantidad_necesaria.toFixed(4)} / ud</span></td><td class="fw-bold text-success">C$ ${item.subtotal.toFixed(1)}</td><td class="text-end"><button type="button" class="btn btn-sm btn-link p-0 text-danger" onclick="quitarIngredienteTemporal(${index})"><i class="bi bi-trash"></i></button></td></tr>`); }); lblTotal.innerText = Math.ceil(costoAcumuladoUnidad); }
async function verRecetaModal(id, nombreProducto) { document.getElementById("title-ver-receta").innerText = `Fórmula: ${nombreProducto}`; const tbody = document.getElementById("body-ver-receta"); tbody.innerHTML = "<tr><td colspan='3' class='text-center'>Consultando Azure SQL...</td></tr>"; new bootstrap.Modal(document.getElementById("modalVerReceta")).show(); try { const res = await fetch(`${API_URL}/productos/${id}/receta`); const datos = await res.json(); tbody.innerHTML = ""; if(datos.length === 0) return tbody.innerHTML = "<tr><td colspan='3' class='text-center text-muted'>Sin ingredientes.</td></tr>"; datos.forEach(d => { tbody.insertAdjacentHTML("beforeend", `<tr><td class="fw-bold">${d.nombre_insumo}</td><td>${parseFloat(d.cantidad_necesaria).toFixed(4)} (${d.unidad})</td><td class="text-primary fw-bold">C$ ${Math.ceil(d.subtotal_costo)}</td></tr>`); }); } catch (error) { tbody.innerHTML = "<tr><td colspan='3' class='text-center text-danger'>Error.</td></tr>"; } }
async function agregarProducto(event) { event.preventDefault(); const nombre = document.getElementById("nombre").value.trim(); const precio = parseInt(document.getElementById("precio").value, 10); const categoria_id = document.getElementById("categoria-principal").value ? parseInt(document.getElementById("categoria-principal").value) : null; if (!nombre || isNaN(precio) || precio <= 0 || !categoria_id) return alert("Campos obligatorios."); try { const respuesta = await fetch(`${API_URL}/productos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre, precio, categoria_id, receta: recetaTemporal }) }); if (!respuesta.ok) throw new Error("Error"); alert("🎉 Producto guardado en la nube."); document.getElementById("form-agregar").reset(); limpiarRecetaTemporal(); bootstrap.Modal.getInstance(document.getElementById("modalAgregar")).hide(); cargarProductos(); } catch (error) { alert("Error de comunicación."); } }
function abrirModalProduccion() { const select = document.getElementById("prod-produccion"); if(!select) return; select.innerHTML = '<option value="" disabled selected>Selecciona producto horneado...</option>'; productosOriginal.forEach(p => { select.innerHTML += `<option value="${p.id}">${p.nombre}</option>`; }); new bootstrap.Modal(document.getElementById("modalProduccion")).show(); }
async function ejecutarProduccion(event) { event.preventDefault(); const producto_id = parseInt(document.getElementById("prod-produccion").value); const cantidad_producida = parseInt(document.getElementById("cant-produccion").value, 10); const usuario_id = localStorage.getItem("usuario_id") ? parseInt(localStorage.getItem("usuario_id")) : null; if(!producto_id || isNaN(cantidad_producida) || cantidad_producida <= 0) return alert("Ingresa datos coherentes."); try { const respuesta = await fetch(`${API_URL}/produccion`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ producto_id, cantidad_producida, usuario_id }) }); if(!respuesta.ok) throw new Error(await respuesta.text()); alert(`💪 ¡Producción registrada! El stock subió en la vitrina.`); document.getElementById("form-produccion").reset(); bootstrap.Modal.getInstance(document.getElementById("modalProduccion")).hide(); cargarProductos(); } catch (error) { alert("Error: " + error.message); } }
async function eliminarProducto(id) { if (!confirm("¿Deseas deshabilitar este producto?")) return; try { await fetch(`${API_URL}/productos/${id}`, { method: 'DELETE' }); cargarProductos(); } catch (error) {} }
async function cargarSelectsCategorias() { try { const respuesta = await fetch(`${API_URL}/categorias`); const categorias = await respuesta.json(); const selectFiltro = document.getElementById("filtro-categoria"); const selectAgregar = document.getElementById("categoria-principal"); let htmlFiltro = '<option value="">Todas las categorías</option>'; let htmlModal = '<option value="">Seleccione una categoría...</option>'; categorias.forEach(c => { htmlFiltro += `<option value="${c.id}">${c.nombre}</option>`; htmlModal += `<option value="${c.id}">${c.nombre}</option>`; }); if (selectFiltro) selectFiltro.innerHTML = htmlFiltro; if (selectAgregar) selectAgregar.innerHTML = htmlModal; } catch (error) {} }
function filtrarProductos() { const valor = document.getElementById("busqueda-productos").value.trim().toLowerCase(); const precioBuscado = document.getElementById("busqueda-precio").value; const categoriaBuscada = document.getElementById("filtro-categoria").value; let filtrados = productosOriginal.filter((p) => p.nombre.toLowerCase().includes(valor)); if (precioBuscado !== "") filtrados = filtrados.filter((p) => p.precio == parseInt(precioBuscado)); if (categoriaBuscada !== "") filtrados = filtrados.filter((p) => p.categoria_id == parseInt(categoriaBuscada)); renderizarProductos(filtrados); }
document.addEventListener("DOMContentLoaded", cargarProductos); document.getElementById("busqueda-productos").addEventListener("input", filtrarProductos); document.getElementById("busqueda-precio").addEventListener("input", filtrarProductos); document.getElementById("filtro-categoria").addEventListener("change", filtrarProductos); document.getElementById("form-agregar").addEventListener("submit", agregarProducto);