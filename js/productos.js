const API_URL = "https://sistema-pasteleria-sql.onrender.com/api";
let productosOriginal = [];
let insumosAlmacenados = []; 
let recetaTemporal = []; 
let verInactivosProd = false;
let costoAcumuladoGlobal = 0;

document.addEventListener("DOMContentLoaded", () => {
    // 1. Inyectar el switch de "Ver Eliminados" visualmente si no existe en el HTML
    const rowProd = document.querySelector("#seccion-productos .row.mb-3");
    if (rowProd && !document.getElementById("toggle-inactivos-prod")) {
        rowProd.insertAdjacentHTML('beforeend', `
            <div class="col-md-3 mt-2">
                <div class="form-check form-switch">
                    <input class="form-check-input bg-danger border-danger" type="checkbox" id="toggle-inactivos-prod">
                    <label class="form-check-label fw-bold text-muted small">Ver Eliminados</label>
                </div>
            </div>
        `);
        document.getElementById("toggle-inactivos-prod").addEventListener("change", (e) => { 
            verInactivosProd = e.target.checked; 
            window.filtrarProductos(); 
        });
    }

    // 2. Inyectar el Semáforo de Rentabilidad en Agregar y Editar
    const inputPrecioAdd = document.getElementById("precio");
    if (inputPrecioAdd && !document.getElementById("indicador-ganancia-add")) {
        inputPrecioAdd.parentElement.insertAdjacentHTML('beforeend', `<div id="indicador-ganancia-add" class="mt-2 p-2 rounded small fw-bold text-center border" style="display:none;"></div>`);
        inputPrecioAdd.addEventListener("input", window.actualizarSemaforoAdd);
    }

    const inputPrecioEdit = document.getElementById("edit-precio");
    if (inputPrecioEdit && !document.getElementById("indicador-ganancia-edit")) {
        inputPrecioEdit.parentElement.insertAdjacentHTML('beforeend', `<div id="indicador-ganancia-edit" class="mt-2 p-2 rounded small fw-bold text-center border" style="display:none;"></div>`);
        inputPrecioEdit.addEventListener("input", window.actualizarSemaforoEdit);
    }

    window.cargarProductos();
});

// ==========================================
// CARGA Y RENDERIZADO DE TABLA PRINCIPAL
// ==========================================
window.cargarProductos = async function() {
    const tabla = document.querySelector("#productos-table tbody");
    if(tabla) tabla.innerHTML = "<tr><td colspan='5' class='text-center'>Cargando menú desde Azure...</td></tr>";
    try {
        const respuesta = await fetch(`${API_URL}/productos`);
        if (!respuesta.ok) throw new Error();
        productosOriginal = await respuesta.json();
        window.filtrarProductos(); 
        await window.cargarSelectInsumosReceta();
        window.cargarSelectsCategorias();
    } catch (error) { 
        if(tabla) tabla.innerHTML = "<tr><td colspan='5' class='text-center text-danger'>Error al conectar con la base de datos.</td></tr>"; 
    }
};

window.renderizarProductos = function(productos) {
    const tabla = document.querySelector("#productos-table tbody");
    if(!tabla) return;
    tabla.innerHTML = "";
    
    // Si no está definida la función de permisos, asume que es admin por defecto para no bloquear la interfaz
    const isAdmin = (typeof esAdmin === 'function') ? esAdmin() : true;

    productos.forEach((p) => {
        const esInactivo = (p.activo === false || p.activo === 0);
        const rowStyle = esInactivo ? "opacity: 0.5; background-color: #f8f9fa;" : "";
        const badgeStock = esInactivo 
            ? `<span class="badge bg-danger ms-2">Descontinuado</span>` 
            : (p.stock > 0 ? `<span class="badge bg-success ms-2">${p.stock} en vitrina</span>` : `<span class="badge bg-danger ms-2">Agotado</span>`);

        let botonesAccion = "";
        
        if (isAdmin) {
            if (esInactivo) {
                botonesAccion = `<button class="btn btn-sm btn-success fw-bold shadow-sm" onclick="window.reactivarProducto(${p.id})" title="Volver a Vender"><i class="bi bi-arrow-counterclockwise"></i> Reactivar</button>`;
            } else {
                // DISEÑO ORIGINAL SEPARADO (Celeste, Amarillo, Rojo con me-1 para el espacio)
                botonesAccion = `
                    <button class="btn btn-sm btn-info text-white me-1 shadow-sm" onclick="window.abrirEditarProducto(${p.id})" title="Editar Info Básica">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-warning text-dark me-1 shadow-sm" onclick="window.verRecetaModal(${p.id}, '${p.nombre}')" title="Ver Fórmula">
                        <i class="bi bi-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-danger shadow-sm" onclick="window.eliminarProducto(${p.id})" title="Eliminar">
                        <i class="bi bi-trash"></i>
                    </button>
                `;
            }
        } else { 
            botonesAccion = `<span class="badge bg-secondary">Solo lectura</span>`; 
        }
        
        const costoFabricacion = p.costo || 0;
        const gananciaNeta = p.precio - costoFabricacion;
        let infoFinanciera = `<div class="fw-bold fs-6">C$ ${p.precio}</div>`;
        
        if (costoFabricacion > 0) {
            if (gananciaNeta >= 0) infoFinanciera += `<small class="text-success fw-bold"><i class="bi bi-graph-up-arrow"></i> Ganas: C$ ${gananciaNeta.toFixed(0)}</small>`; 
            else infoFinanciera += `<small class="text-danger fw-bold"><i class="bi bi-exclamation-triangle"></i> Pierdes: C$ ${Math.abs(gananciaNeta).toFixed(0)}</small>`;
            infoFinanciera += `<br><small class="text-muted" style="font-size:0.75em;">Costo Insumos: C$ ${costoFabricacion.toFixed(0)}</small>`;
        } else {
            infoFinanciera += `<small class="badge bg-secondary">Directo / Sin Receta</small>`; 
        }

        tabla.insertAdjacentHTML("beforeend", `<tr style="${rowStyle}"><td>${p.id}</td><td><div class="fw-bold">${p.nombre} ${badgeStock}</div></td><td><span class="badge bg-dark">${p.categoria?.nombre || 'General'}</span></td><td>${infoFinanciera}</td><td>${botonesAccion}</td></tr>`);
    });
};

window.filtrarProductos = function() { 
    const valor = document.getElementById("busqueda-productos")?.value.trim().toLowerCase() || ""; 
    const precioBuscado = document.getElementById("busqueda-precio")?.value || ""; 
    const categoriaBuscada = document.getElementById("filtro-categoria")?.value || ""; 
    
    let filtrados = productosOriginal.filter((p) => p.nombre.toLowerCase().includes(valor)); 
    if (precioBuscado !== "") filtrados = filtrados.filter((p) => p.precio == parseInt(precioBuscado)); 
    if (categoriaBuscada !== "") filtrados = filtrados.filter((p) => p.categoria_id == parseInt(categoriaBuscada)); 
    if (!verInactivosProd) filtrados = filtrados.filter(p => p.activo !== false && p.activo !== 0);
    
    window.renderizarProductos(filtrados); 
};

// ==========================================
// SEMÁFOROS Y BORRADO LÓGICO
// ==========================================
window.actualizarSemaforoAdd = function() {
    const inputPrecio = document.getElementById("precio");
    const divIndicador = document.getElementById("indicador-ganancia-add");
    if (!inputPrecio || !divIndicador) return;
    
    const precio = parseFloat(inputPrecio.value) || 0;
    divIndicador.style.display = "block";

    if (costoAcumuladoGlobal === 0) {
        divIndicador.className = "mt-2 p-2 rounded small fw-bold text-center bg-light text-dark border border-secondary";
        divIndicador.innerHTML = `Venta Directa: Ganas el 100% (No has agregado receta)`;
        return;
    }

    const ganancia = precio - costoAcumuladoGlobal;
    if (ganancia > 0) {
        divIndicador.className = "mt-2 p-2 rounded small fw-bold text-center bg-success text-white shadow-sm";
        divIndicador.innerHTML = `<i class="bi bi-emoji-smile"></i> ¡Bien! Tu costo es C$ ${costoAcumuladoGlobal.toFixed(2)}. Ganarás C$ ${ganancia.toFixed(2)}.`;
    } else if (ganancia === 0) {
        divIndicador.className = "mt-2 p-2 rounded small fw-bold text-center bg-warning text-dark shadow-sm";
        divIndicador.innerHTML = `<i class="bi bi-emoji-neutral"></i> Tu costo es igual al precio. No le ganas nada.`;
    } else {
        divIndicador.className = "mt-2 p-2 rounded small fw-bold text-center bg-danger text-white shadow-sm shadow-sm";
        divIndicador.innerHTML = `<i class="bi bi-emoji-frown"></i> ¡PÉRDIDA! Cuesta C$ ${costoAcumuladoGlobal.toFixed(2)} fabricarlo. Pierdes C$ ${Math.abs(ganancia).toFixed(2)}.`;
    }
};

window.actualizarSemaforoEdit = function() {
    const inputPrecio = document.getElementById("edit-precio");
    const divIndicador = document.getElementById("indicador-ganancia-edit");
    if (!inputPrecio || !divIndicador) return;

    const costoBase = parseFloat(divIndicador.dataset.costo) || 0;
    const precio = parseFloat(inputPrecio.value) || 0;
    divIndicador.style.display = "block";
    
    if (costoBase === 0) {
        divIndicador.className = "mt-2 p-2 rounded small fw-bold text-center bg-light text-dark border border-secondary";
        divIndicador.innerHTML = `Producto de reventa directo.`;
        return;
    }

    const ganancia = precio - costoBase;
    if (ganancia > 0) {
        divIndicador.className = "mt-2 p-2 rounded small fw-bold text-center bg-success text-white shadow-sm";
        divIndicador.innerHTML = `Costo Actual: C$ ${costoBase.toFixed(2)} | Ganancia: C$ ${ganancia.toFixed(2)}`;
    } else {
        divIndicador.className = "mt-2 p-2 rounded small fw-bold text-center bg-danger text-white shadow-sm";
        divIndicador.innerHTML = `¡Atención! Pierdes C$ ${Math.abs(ganancia).toFixed(2)} por unidad.`;
    }
};

window.reactivarProducto = function(id) { 
    if(window.mostrarConfirmacion) {
        window.mostrarConfirmacion("¿Deseas volver a vender este producto?", async () => {
            try { 
                await fetch(`${API_URL}/productos/${id}/reactivar`, { method: 'PUT' }); 
                if(window.mostrarNotificacion) window.mostrarNotificacion("Restaurado", "El producto está activo de nuevo.", "success"); 
                window.cargarProductos(); 
            } catch (error) {} 
        });
    }
};

window.eliminarProducto = function(id) { 
    if(window.mostrarConfirmacion) {
        window.mostrarConfirmacion("¿Deseas deshabilitar este producto de tu menú?", async () => {
            try { 
                await fetch(`${API_URL}/productos/${id}`, { method: 'DELETE' }); 
                if(window.mostrarNotificacion) window.mostrarNotificacion("Eliminado", "El producto fue ocultado exitosamente.", "success"); 
                window.cargarProductos(); 
            } catch (error) {} 
        });
    }
};

// ==========================================
// EDICIÓN DE PRODUCTOS
// ==========================================
window.abrirEditarProducto = function(id) {
    const prod = productosOriginal.find(p => p.id === id);
    if (!prod) return;
    
    document.getElementById("edit-id").value = prod.id;
    document.getElementById("edit-nombre").value = prod.nombre;
    document.getElementById("edit-precio").value = prod.precio;
    
    const selectCategoria = document.getElementById("edit-categoria-principal");
    if (selectCategoria && document.getElementById("categoria-principal")) {
        selectCategoria.innerHTML = document.getElementById("categoria-principal").innerHTML;
        selectCategoria.value = prod.categoria_id || "";
    }
    
    const indicador = document.getElementById("indicador-ganancia-edit");
    if (indicador) {
        indicador.dataset.costo = prod.costo || 0;
        window.actualizarSemaforoEdit();
    }

    bootstrap.Modal.getOrCreateInstance(document.getElementById("modalEditar")).show();
};

document.getElementById("form-editar")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = document.getElementById("edit-id").value;
    const nombre = document.getElementById("edit-nombre").value.trim();
    const precio = parseInt(document.getElementById("edit-precio").value, 10);
    const categoria_id = document.getElementById("edit-categoria-principal").value ? parseInt(document.getElementById("edit-categoria-principal").value) : null;
    
    if (isNaN(precio) || precio <= 0) {
        if(window.mostrarNotificacion) return window.mostrarNotificacion("Error", "El precio de venta debe ser mayor a 0", "error");
        return;
    }
    
    try {
        const res = await fetch(`${API_URL}/productos/${id}`, { 
            method: 'PUT', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ nombre, precio, categoria_id }) 
        });
        
        if (!res.ok) throw new Error();
        
        bootstrap.Modal.getInstance(document.getElementById("modalEditar")).hide();
        if(window.mostrarNotificacion) window.mostrarNotificacion("Actualizado", "El producto se modificó correctamente.", "success");
        window.cargarProductos();
    } catch (error) { 
        if(window.mostrarNotificacion) window.mostrarNotificacion("Error", "Error al actualizar el producto", "error"); 
    }
});

// ==========================================
// GESTIÓN DE RECETAS (CREACIÓN Y VISTA)
// ==========================================
window.cargarSelectInsumosReceta = async function() { 
    try { 
        const respuesta = await fetch(`${API_URL}/insumos`); 
        insumosAlmacenados = await respuesta.json(); 
        
        const select = document.getElementById("insumo-receta-select"); 
        if (select) { 
            select.innerHTML = '<option value="" disabled selected>Selecciona ingrediente...</option>'; 
            insumosAlmacenados.forEach(i => { 
                if (i.activo !== 0 && i.activo !== false) {
                    select.innerHTML += `<option value="${i.id}">${i.nombre} (${i.unidad}) - Base C$${i.precio}</option>`; 
                }
            }); 
        } 
    } catch (error) {} 
};

window.limpiarRecetaTemporal = function() { 
    recetaTemporal = []; 
    costoAcumuladoGlobal = 0; 
    
    const rend = document.getElementById("receta-rendimiento-lote");
    if(rend) rend.value = "1"; 
    
    window.renderizarTablaRecetaTemporal(); 
    
    const indicador = document.getElementById("indicador-ganancia-add");
    if(indicador) indicador.style.display = "none"; 
};

window.agregarIngredienteATemporal = function() { 
    const select = document.getElementById("insumo-receta-select"); 
    const cantInput = document.getElementById("insumo-receta-cantidad"); 
    const rendimientoInput = document.getElementById("receta-rendimiento-lote"); 
    
    if (!select || !cantInput) return;
    
    const rendimientoLote = parseFloat(rendimientoInput?.value) || 1; 
    
    if (!select.value || !cantInput.value || parseFloat(cantInput.value) <= 0) {
        if(window.mostrarNotificacion) return window.mostrarNotificacion('Atención', 'Selecciona ingrediente y cantidad mayor a 0.', 'warning'); 
        return;
    }
    
    const insumoId = parseInt(select.value); 
    const cantidadDigitada = parseFloat(cantInput.value); 
    const cantidadUnitariaCalculada = cantidadDigitada / rendimientoLote; 
    const insumoObj = insumosAlmacenados.find(i => i.id === insumoId); 
    
    if (recetaTemporal.some(item => item.insumo_id === insumoId)) {
        if(window.mostrarNotificacion) return window.mostrarNotificacion('Duplicado', 'Ese ingrediente ya está en la lista.', 'warning'); 
        return;
    }
    
    recetaTemporal.push({ 
        insumo_id: insumoId, 
        nombre: insumoObj.nombre, 
        cantidad_lote_visible: cantidadDigitada, 
        cantidad_necesaria: cantidadUnitariaCalculada, 
        subtotal: (cantidadUnitariaCalculada * insumoObj.precio) 
    }); 
    
    cantInput.value = ""; 
    window.renderizarTablaRecetaTemporal(); 
};

window.quitarIngredienteTemporal = function(index) { 
    recetaTemporal.splice(index, 1); 
    window.renderizarTablaRecetaTemporal(); 
};

window.renderizarTablaRecetaTemporal = function() { 
    const tbody = document.getElementById("tabla-receta-temporal"); 
    const lblTotal = document.getElementById("lbl-costo-receta"); 
    
    if (!tbody || !lblTotal) return; 
    
    tbody.innerHTML = ""; 
    costoAcumuladoGlobal = 0; 
    
    if (recetaTemporal.length === 0) { 
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center text-muted">
                    No has añadido ingredientes para receta.<br>
                    <small>Si guardas ahora, será un producto de Venta Directa.</small>
                </td>
            </tr>
        `; 
        lblTotal.innerText = "0"; 
        window.actualizarSemaforoAdd(); 
        return; 
    } 

    recetaTemporal.forEach((item, index) => { 
        costoAcumuladoGlobal += item.subtotal; 
        tbody.insertAdjacentHTML("beforeend", `
            <tr>
                <td><strong>${item.nombre}</strong></td>
                <td>${item.cantidad_lote_visible}</td>
                <td><span class="badge bg-secondary">${item.cantidad_necesaria.toFixed(4)} / ud</span></td>
                <td class="fw-bold text-success">C$ ${item.subtotal.toFixed(1)}</td>
                <td class="text-end">
                    <button type="button" class="btn btn-sm btn-link p-0 text-danger" onclick="window.quitarIngredienteTemporal(${index})">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `); 
    }); 
    
    lblTotal.innerText = Math.ceil(costoAcumuladoGlobal); 
    window.actualizarSemaforoAdd(); 
};

window.verRecetaModal = async function(id, nombreProducto) { 
    document.getElementById("title-ver-receta").innerText = `Fórmula: ${nombreProducto}`; 
    const tbody = document.getElementById("body-ver-receta"); 
    tbody.innerHTML = "<tr><td colspan='3' class='text-center'>Consultando...</td></tr>"; 
    
    bootstrap.Modal.getOrCreateInstance(document.getElementById("modalVerReceta")).show(); 
    
    try { 
        const res = await fetch(`${API_URL}/productos/${id}/receta`); 
        const datos = await res.json(); 
        
        tbody.innerHTML = ""; 
        
        if (datos.length === 0) {
            return tbody.innerHTML = "<tr><td colspan='3' class='text-center text-muted'>Este producto no tiene receta registrada.</td></tr>"; 
        }
        
        let granTotal = 0;
        datos.forEach(d => { 
            granTotal += d.subtotal_costo;
            tbody.insertAdjacentHTML("beforeend", `
                <tr>
                    <td class="fw-bold">${d.nombre_insumo}</td>
                    <td>${parseFloat(d.cantidad_necesaria).toFixed(4)} (${d.unidad})</td>
                    <td class="text-primary fw-bold">C$ ${Math.ceil(d.subtotal_costo)}</td>
                </tr>
            `); 
        }); 
        
        tbody.insertAdjacentHTML("beforeend", `
            <tr class="table-dark text-white fw-bold">
                <td colspan="2" class="text-end">COSTO DE FABRICACIÓN:</td>
                <td>C$ ${Math.ceil(granTotal)}</td>
            </tr>
        `);
    } catch (error) { 
        tbody.innerHTML = "<tr><td colspan='3' class='text-center text-danger'>Error de servidor.</td></tr>"; 
    } 
};

// ==========================================
// CREACIÓN DE PRODUCTOS Y PRODUCCIÓN
// ==========================================
window.agregarProducto = async function(event) { 
    event.preventDefault(); 
    const nombre = document.getElementById("nombre").value.trim(); 
    const precio = parseInt(document.getElementById("precio").value, 10); 
    const categoria_id = document.getElementById("categoria-principal").value ? parseInt(document.getElementById("categoria-principal").value) : null; 
    
    if (!nombre || isNaN(precio) || precio <= 0 || !categoria_id) {
        if(window.mostrarNotificacion) return window.mostrarNotificacion("Atención", "Revisa que los datos estén completos.", "warning"); 
        return;
    }
    
    if (costoAcumuladoGlobal > 0 && precio < costoAcumuladoGlobal) {
        if(window.mostrarNotificacion) return window.mostrarNotificacion("Alerta Financiera", "No puedes registrar un producto cuyo precio sea menor al costo. ¡Revisa tu semáforo de ganancias!", "error");
        return;
    }

    try { 
        const respuesta = await fetch(`${API_URL}/productos`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ nombre, precio, categoria_id, receta: recetaTemporal }) 
        }); 
        
        if (!respuesta.ok) throw new Error("Error del servidor"); 
        
        let msj = recetaTemporal.length > 0 ? "Producto y receta respaldados." : "Producto agregado para Venta Directa (Sin receta).";
        if(window.mostrarNotificacion) window.mostrarNotificacion("¡Éxito!", msj, "success"); 
        
        document.getElementById("form-agregar").reset(); 
        window.limpiarRecetaTemporal(); 
        bootstrap.Modal.getInstance(document.getElementById("modalAgregar")).hide(); 
        window.cargarProductos(); 
    } catch (error) { 
        if(window.mostrarNotificacion) window.mostrarNotificacion("Error", "Fallo al comunicar con Azure.", "error"); 
    } 
};

window.abrirModalProduccion = function() { 
    const select = document.getElementById("prod-produccion"); 
    if (!select) return; 
    
    select.innerHTML = '<option value="" disabled selected>Selecciona producto...</option>'; 
    
    productosOriginal.filter(p => p.activo !== false && p.activo !== 0).forEach(p => { 
        select.innerHTML += `<option value="${p.id}">${p.nombre}</option>`; 
    }); 
    
    const cantInput = document.getElementById("cant-produccion");
    if(cantInput) cantInput.value = "";
    
    const venceInput = document.getElementById("fecha-vencimiento-prod");
    if(venceInput) venceInput.value = "";
    
    bootstrap.Modal.getOrCreateInstance(document.getElementById("modalProduccion")).show(); 
};

// ESTA FUNCION PREVIENE EL ERROR 404 POST
window.ejecutarProduccion = async function(event) { 
    event.preventDefault(); // <-- MAGIA QUE EVITA QUE SE RECARGUE LA PÁGINA FEA
    
    const producto_id = parseInt(document.getElementById("prod-produccion").value); 
    const cantidad_producida = parseInt(document.getElementById("cant-produccion").value, 10); 
    const usuario_id = localStorage.getItem("usuario_id") ? parseInt(localStorage.getItem("usuario_id")) : null; 
    
    // Si usas campo de fecha de vencimiento en tu BD
    const fechaInput = document.getElementById("fecha-vencimiento-prod");
    const fecha_vencimiento = fechaInput && fechaInput.value ? fechaInput.value : null;
    
    if (!producto_id || isNaN(cantidad_producida) || cantidad_producida <= 0) {
        if(window.mostrarNotificacion) return window.mostrarNotificacion("Atención", "Ingresa una cantidad válida para ingresar a la vitrina.", "warning"); 
        return;
    }
    
    try { 
        const respuesta = await fetch(`${API_URL}/produccion`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ producto_id, cantidad_producida, usuario_id, fecha_vencimiento }) 
        }); 
        
        if (!respuesta.ok) throw new Error(await respuesta.text()); 
        
        const data = await respuesta.json(); 
        
        if (data.tipo === 'directo') {
            if(window.mostrarNotificacion) window.mostrarNotificacion("Stock Actualizado", "Se agregaron las unidades a la vitrina de Venta Directa.", "success"); 
        } else {
            if(window.mostrarNotificacion) window.mostrarNotificacion("¡Horneado Exitoso!", "Se descontaron los insumos de bodega y subió el stock en vitrina.", "success"); 
        }

        document.getElementById("form-produccion").reset(); 
        
        const modalEl = document.getElementById("modalProduccion");
        if (modalEl) bootstrap.Modal.getInstance(modalEl)?.hide();
        
        window.cargarProductos(); 
    } catch (error) { 
        if(window.mostrarNotificacion) window.mostrarNotificacion("Fallo en Producción", error.message, "error"); 
    } 
};

window.cargarSelectsCategorias = async function() { 
    try { 
        const respuesta = await fetch(`${API_URL}/categorias`); 
        const categorias = await respuesta.json(); 
        
        const selectFiltro = document.getElementById("filtro-categoria"); 
        const selectAgregar = document.getElementById("categoria-principal"); 
        const selectEditar = document.getElementById("edit-categoria-principal");
        
        let htmlFiltro = '<option value="">Todas las categorías</option>'; 
        let htmlModal = '<option value="">Seleccione una categoría...</option>'; 
        
        categorias.forEach(c => { 
            htmlFiltro += `<option value="${c.id}">${c.nombre}</option>`; 
            htmlModal += `<option value="${c.id}">${c.nombre}</option>`; 
        }); 
        
        if (selectFiltro) selectFiltro.innerHTML = htmlFiltro; 
        if (selectAgregar) selectAgregar.innerHTML = htmlModal; 
        if (selectEditar) selectEditar.innerHTML = htmlModal; 
    } catch (error) {} 
};

// ==========================================
// EVENT LISTENERS DEL DOM
// ==========================================
document.getElementById("busqueda-productos")?.addEventListener("input", window.filtrarProductos); 
document.getElementById("busqueda-precio")?.addEventListener("input", window.filtrarProductos); 
document.getElementById("filtro-categoria")?.addEventListener("change", window.filtrarProductos); 
document.getElementById("form-agregar")?.addEventListener("submit", window.agregarProducto);
document.getElementById("btn-ir-productos")?.addEventListener("click", () => { window.cargarProductos(); });