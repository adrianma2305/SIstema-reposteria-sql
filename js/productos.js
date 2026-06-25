const API_URL = "https://sistema-pasteleria-sql.onrender.com/api";
let productosOriginal = [];
let insumosAlmacenados = []; 
let recetaTemporal = []; 
let verInactivosProd = false;
let costoAcumuladoGlobal = 0; // Para el semáforo de rentabilidad

document.addEventListener("DOMContentLoaded", () => {
    // 1. Inyectar el switch de "Ver Eliminados"
    const rowProd = document.querySelector("#seccion-productos .row.mb-3");
    if (rowProd && !document.getElementById("toggle-inactivos-prod")) {
        rowProd.insertAdjacentHTML('beforeend', `
            <div class="col-md-3 mt-2">
                <div class="form-check form-switch">
                    <input class="form-check-input bg-danger" type="checkbox" id="toggle-inactivos-prod">
                    <label class="form-check-label fw-bold text-muted small">Ver Eliminados</label>
                </div>
            </div>
        `);
        document.getElementById("toggle-inactivos-prod").addEventListener("change", (e) => { 
            verInactivosProd = e.target.checked; 
            filtrarProductos(); 
        });
    }

    // 2. Inyectar el Semáforo de Rentabilidad en Agregar Producto
    const inputPrecioAdd = document.getElementById("precio");
    if (inputPrecioAdd && !document.getElementById("indicador-ganancia-add")) {
        inputPrecioAdd.parentElement.insertAdjacentHTML('beforeend', `
            <div id="indicador-ganancia-add" class="mt-2 p-2 rounded small fw-bold text-center border" style="display:none;"></div>
        `);
        inputPrecioAdd.addEventListener("input", actualizarSemaforoAdd);
    }

    // 3. Inyectar el Semáforo de Rentabilidad en Editar Producto
    const inputPrecioEdit = document.getElementById("edit-precio");
    if (inputPrecioEdit && !document.getElementById("indicador-ganancia-edit")) {
        inputPrecioEdit.parentElement.insertAdjacentHTML('beforeend', `
            <div id="indicador-ganancia-edit" class="mt-2 p-2 rounded small fw-bold text-center border" style="display:none;"></div>
        `);
        inputPrecioEdit.addEventListener("input", actualizarSemaforoEdit);
    }

    cargarProductos();
});

async function cargarProductos() {
    const tabla = document.querySelector("#productos-table tbody");
    tabla.innerHTML = "<tr><td colspan='5' class='text-center'>Cargando menú desde Azure...</td></tr>";
    
    try {
        const respuesta = await fetch(`${API_URL}/productos`);
        if (!respuesta.ok) throw new Error();
        
        productosOriginal = await respuesta.json();
        filtrarProductos(); 
        await cargarSelectInsumosReceta();
        cargarSelectsCategorias();
    } catch (error) { 
        tabla.innerHTML = "<tr><td colspan='5' class='text-center text-danger'>Error al conectar con la base de datos.</td></tr>"; 
    }
}

function renderizarProductos(productos) {
    const tabla = document.querySelector("#productos-table tbody");
    tabla.innerHTML = "";
    const isAdmin = (typeof esAdmin === 'function') ? esAdmin() : false;

    productos.forEach((p) => {
        const esInactivo = (p.activo === false || p.activo === 0);
        const rowStyle = esInactivo ? "opacity: 0.5; background-color: #f8f9fa;" : "";
        const badgeStock = esInactivo 
            ? `<span class="badge bg-danger ms-2">Descontinuado</span>` 
            : (p.stock > 0 ? `<span class="badge bg-success ms-2">${p.stock} en vitrina</span>` : `<span class="badge bg-danger ms-2">Agotado</span>`);

        let botonesAccion = "";
        
        // Control de permisos para botones
        if (isAdmin) {
            if (esInactivo) {
                botonesAccion = `
                    <button class="btn btn-sm btn-success fw-bold" onclick="reactivarProducto(${p.id})" title="Volver a Vender">
                        <i class="bi bi-arrow-counterclockwise"></i> Reactivar
                    </button>
                `;
            } else {
                botonesAccion = `
                    <button class="btn btn-sm btn-primary me-1" onclick="verRecetaModal(${p.id}, '${p.nombre}')" title="Ver Fórmula">
                        <i class="bi bi-journal-text"></i>
                    </button>
                    <button class="btn btn-sm btn-info text-white me-1" onclick="abrirEditarProducto(${p.id})" title="Editar Info Básica">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="eliminarProducto(${p.id})" title="Eliminar">
                        <i class="bi bi-trash"></i>
                    </button>
                `;
            }
        } else { 
            botonesAccion = `<span class="badge bg-secondary">Solo lectura</span>`; 
        }
        
        // Lógica visual del Costo vs Ganancia
        const costoFabricacion = p.costo || 0;
        const gananciaNeta = p.precio - costoFabricacion;
        let infoFinanciera = `<div class="fw-bold fs-6">C$ ${p.precio}</div>`;
        
        if (costoFabricacion > 0) {
            if (gananciaNeta >= 0) {
                infoFinanciera += `<small class="text-success fw-bold"><i class="bi bi-graph-up-arrow"></i> Ganas: C$ ${gananciaNeta.toFixed(0)}</small>`; 
            } else {
                infoFinanciera += `<small class="text-danger fw-bold"><i class="bi bi-exclamation-triangle"></i> Pierdes: C$ ${Math.abs(gananciaNeta).toFixed(0)}</small>`;
            }
            infoFinanciera += `<br><small class="text-muted" style="font-size:0.75em;">Costo Insumos: C$ ${costoFabricacion.toFixed(0)}</small>`;
        } else {
            infoFinanciera += `<small class="badge bg-secondary">Directo / Sin Receta</small>`; 
        }

        tabla.insertAdjacentHTML("beforeend", `
            <tr style="${rowStyle}">
                <td>${p.id}</td>
                <td><div class="fw-bold">${p.nombre} ${badgeStock}</div></td>
                <td><span class="badge bg-dark">${p.categoria?.nombre || 'General'}</span></td>
                <td>${infoFinanciera}</td>
                <td>${botonesAccion}</td>
            </tr>
        `);
    });
}

function filtrarProductos() { 
    const valor = document.getElementById("busqueda-productos").value.trim().toLowerCase(); 
    const precioBuscado = document.getElementById("busqueda-precio").value; 
    const categoriaBuscada = document.getElementById("filtro-categoria").value; 
    
    let filtrados = productosOriginal.filter((p) => p.nombre.toLowerCase().includes(valor)); 
    
    if (precioBuscado !== "") filtrados = filtrados.filter((p) => p.precio == parseInt(precioBuscado)); 
    if (categoriaBuscada !== "") filtrados = filtrados.filter((p) => p.categoria_id == parseInt(categoriaBuscada)); 
    if (!verInactivosProd) filtrados = filtrados.filter(p => p.activo !== false && p.activo !== 0);
    
    renderizarProductos(filtrados); 
}

// ==========================================
// SEMÁFOROS DE RENTABILIDAD EN VIVO
// ==========================================
function actualizarSemaforoAdd() {
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
        divIndicador.innerHTML = `<i class="bi bi-emoji-smile"></i> ¡Bien! Tu costo es C$ ${costoAcumuladoGlobal.toFixed(2)}. Ganarás C$ ${ganancia.toFixed(2)} por unidad.`;
    } else if (ganancia === 0) {
        divIndicador.className = "mt-2 p-2 rounded small fw-bold text-center bg-warning text-dark shadow-sm";
        divIndicador.innerHTML = `<i class="bi bi-emoji-neutral"></i> Tu costo es igual al precio. No le ganas nada.`;
    } else {
        divIndicador.className = "mt-2 p-2 rounded small fw-bold text-center bg-danger text-white shadow-sm shadow-sm";
        divIndicador.innerHTML = `<i class="bi bi-emoji-frown"></i> ¡PÉRDIDA! Cuesta C$ ${costoAcumuladoGlobal.toFixed(2)} fabricarlo. Estás perdiendo C$ ${Math.abs(ganancia).toFixed(2)}.`;
    }
}

function actualizarSemaforoEdit() {
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
}

// ==========================================
// FUNCIONES DE BORRADO LÓGICO (SOFT DELETE)
// ==========================================
window.reactivarProducto = function(id) { 
    mostrarConfirmacion("¿Deseas volver a vender este producto?", async () => {
        try { 
            await fetch(`${API_URL}/productos/${id}/reactivar`, { method: 'PUT' }); 
            mostrarNotificacion("Restaurado", "El producto está activo de nuevo.", "success"); 
            cargarProductos(); 
        } catch (error) { 
            mostrarNotificacion("Error", "No se pudo reactivar", "error"); 
        } 
    });
};

window.eliminarProducto = function(id) { 
    mostrarConfirmacion("¿Deseas deshabilitar este producto de tu menú?", async () => {
        try { 
            await fetch(`${API_URL}/productos/${id}`, { method: 'DELETE' }); 
            mostrarNotificacion("Eliminado", "El producto fue ocultado exitosamente.", "success"); 
            cargarProductos(); 
        } catch (error) { 
            mostrarNotificacion("Error", "No se pudo borrar", "error"); 
        } 
    });
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
    selectCategoria.innerHTML = document.getElementById("categoria-principal").innerHTML;
    selectCategoria.value = prod.categoria_id || "";
    
    // Enviar el costo al semáforo de edición
    const indicador = document.getElementById("indicador-ganancia-edit");
    if (indicador) {
        indicador.dataset.costo = prod.costo || 0;
        actualizarSemaforoEdit();
    }

    new bootstrap.Modal(document.getElementById("modalEditar")).show();
};

document.getElementById("form-editar").addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = document.getElementById("edit-id").value;
    const nombre = document.getElementById("edit-nombre").value.trim();
    const precio = parseInt(document.getElementById("edit-precio").value, 10);
    const categoria_id = document.getElementById("edit-categoria-principal").value ? parseInt(document.getElementById("edit-categoria-principal").value) : null;
    
    if (isNaN(precio) || precio <= 0) {
        return mostrarNotificacion("Error", "El precio de venta debe ser mayor a 0", "error");
    }
    
    try {
        const res = await fetch(`${API_URL}/productos/${id}`, { 
            method: 'PUT', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ nombre, precio, categoria_id }) 
        });
        
        if (!res.ok) throw new Error();
        
        bootstrap.Modal.getInstance(document.getElementById("modalEditar")).hide();
        mostrarNotificacion("Actualizado", "El producto se modificó correctamente.", "success");
        cargarProductos();
    } catch (error) { 
        mostrarNotificacion("Error", "Error al actualizar el producto", "error"); 
    }
});

// ==========================================
// GESTIÓN DE RECETAS
// ==========================================
async function cargarSelectInsumosReceta() { 
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
}

function limpiarRecetaTemporal() { 
    recetaTemporal = []; 
    costoAcumuladoGlobal = 0; 
    document.getElementById("receta-rendimiento-lote").value = "1"; 
    renderizarTablaRecetaTemporal(); 
    
    const indicador = document.getElementById("indicador-ganancia-add");
    if(indicador) indicador.style.display = "none"; 
}

function agregarIngredienteATemporal() { 
    const select = document.getElementById("insumo-receta-select"); 
    const cantInput = document.getElementById("insumo-receta-cantidad"); 
    const rendimientoInput = document.getElementById("receta-rendimiento-lote"); 
    const rendimientoLote = parseFloat(rendimientoInput.value) || 1; 
    
    if (!select.value || !cantInput.value || parseFloat(cantInput.value) <= 0) {
        return mostrarNotificacion('Atención', 'Selecciona ingrediente y cantidad mayor a 0.', 'warning'); 
    }
    
    const insumoId = parseInt(select.value); 
    const cantidadDigitada = parseFloat(cantInput.value); 
    const cantidadUnitariaCalculada = cantidadDigitada / rendimientoLote; 
    const insumoObj = insumosAlmacenados.find(i => i.id === insumoId); 
    
    if (recetaTemporal.some(item => item.insumo_id === insumoId)) {
        return mostrarNotificacion('Duplicado', 'Ese ingrediente ya está en la lista.', 'warning'); 
    }
    
    recetaTemporal.push({ 
        insumo_id: insumoId, 
        nombre: insumoObj.nombre, 
        cantidad_lote_visible: cantidadDigitada, 
        cantidad_necesaria: cantidadUnitariaCalculada, 
        subtotal: (cantidadUnitariaCalculada * insumoObj.precio) 
    }); 
    
    cantInput.value = ""; 
    renderizarTablaRecetaTemporal(); 
}

function quitarIngredienteTemporal(index) { 
    recetaTemporal.splice(index, 1); 
    renderizarTablaRecetaTemporal(); 
}

function renderizarTablaRecetaTemporal() { 
    const tbody = document.getElementById("tabla-receta-temporal"); 
    const lblTotal = document.getElementById("lbl-costo-receta"); 
    
    if (!tbody) return; 
    
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
        actualizarSemaforoAdd(); 
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
                    <button type="button" class="btn btn-sm btn-link p-0 text-danger" onclick="quitarIngredienteTemporal(${index})">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `); 
    }); 
    
    lblTotal.innerText = Math.ceil(costoAcumuladoGlobal); 
    actualizarSemaforoAdd(); 
}

async function verRecetaModal(id, nombreProducto) { 
    document.getElementById("title-ver-receta").innerText = `Fórmula: ${nombreProducto}`; 
    const tbody = document.getElementById("body-ver-receta"); 
    tbody.innerHTML = "<tr><td colspan='3' class='text-center'>Consultando...</td></tr>"; 
    
    new bootstrap.Modal(document.getElementById("modalVerReceta")).show(); 
    
    try { 
        const res = await fetch(`${API_URL}/productos/${id}/receta`); 
        const datos = await res.json(); 
        
        tbody.innerHTML = ""; 
        
        if (datos.length === 0) {
            return tbody.innerHTML = "<tr><td colspan='3' class='text-center text-muted'>Este producto no tiene receta registrada.</td></tr>"; 
        }
        
        datos.forEach(d => { 
            tbody.insertAdjacentHTML("beforeend", `
                <tr>
                    <td class="fw-bold">${d.nombre_insumo}</td>
                    <td>${parseFloat(d.cantidad_necesaria).toFixed(4)} (${d.unidad})</td>
                    <td class="text-primary fw-bold">C$ ${Math.ceil(d.subtotal_costo)}</td>
                </tr>
            `); 
        }); 
    } catch (error) { 
        tbody.innerHTML = "<tr><td colspan='3' class='text-center text-danger'>Error de servidor.</td></tr>"; 
    } 
}

// ==========================================
// CREACIÓN DE PRODUCTOS Y PRODUCCIÓN
// ==========================================
async function agregarProducto(event) { 
    event.preventDefault(); 
    const nombre = document.getElementById("nombre").value.trim(); 
    const precio = parseInt(document.getElementById("precio").value, 10); 
    const categoria_id = document.getElementById("categoria-principal").value ? parseInt(document.getElementById("categoria-principal").value) : null; 
    
    if (!nombre || isNaN(precio) || precio <= 0 || !categoria_id) {
        return mostrarNotificacion("Atención", "Revisa que los datos estén completos.", "warning"); 
    }
    
    // Validación de prevención de pérdidas
    if (costoAcumuladoGlobal > 0 && precio < costoAcumuladoGlobal) {
        return mostrarNotificacion("Alerta Financiera", "No puedes registrar un producto cuyo precio sea menor al costo. ¡Revisa tu semáforo de ganancias!", "error");
    }

    try { 
        const respuesta = await fetch(`${API_URL}/productos`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ nombre, precio, categoria_id, receta: recetaTemporal }) 
        }); 
        
        if (!respuesta.ok) throw new Error("Error del servidor"); 
        
        let msj = recetaTemporal.length > 0 ? "Producto y receta respaldados." : "Producto agregado para Venta Directa (Sin receta).";
        mostrarNotificacion("¡Éxito!", msj, "success"); 
        
        document.getElementById("form-agregar").reset(); 
        limpiarRecetaTemporal(); 
        bootstrap.Modal.getInstance(document.getElementById("modalAgregar")).hide(); 
        cargarProductos(); 
    } catch (error) { 
        mostrarNotificacion("Error", "Fallo al comunicar con Azure.", "error"); 
    } 
}

function abrirModalProduccion() { 
    const select = document.getElementById("prod-produccion"); 
    if (!select) return; 
    
    select.innerHTML = '<option value="" disabled selected>Selecciona producto...</option>'; 
    
    productosOriginal.filter(p => p.activo !== false && p.activo !== 0).forEach(p => { 
        select.innerHTML += `<option value="${p.id}">${p.nombre}</option>`; 
    }); 
    
    new bootstrap.Modal(document.getElementById("modalProduccion")).show(); 
}

async function ejecutarProduccion(event) { 
    event.preventDefault(); 
    const producto_id = parseInt(document.getElementById("prod-produccion").value); 
    const cantidad_producida = parseInt(document.getElementById("cant-produccion").value, 10); 
    const usuario_id = localStorage.getItem("usuario_id") ? parseInt(localStorage.getItem("usuario_id")) : null; 
    
    if (!producto_id || isNaN(cantidad_producida) || cantidad_producida <= 0) {
        return mostrarNotificacion("Atención", "Ingresa una cantidad válida para ingresar a la vitrina.", "warning"); 
    }
    
    try { 
        const respuesta = await fetch(`${API_URL}/produccion`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ producto_id, cantidad_producida, usuario_id }) 
        }); 
        
        if (!respuesta.ok) throw new Error(await respuesta.text()); 
        
        const data = await respuesta.json(); 
        
        if (data.tipo === 'directo') {
            mostrarNotificacion("Stock Actualizado", "Se agregaron las unidades a la vitrina de Venta Directa.", "success"); 
        } else {
            mostrarNotificacion("¡Horneado Exitoso!", "Se descontaron los insumos de bodega y subió el stock en vitrina.", "success"); 
        }

        document.getElementById("form-produccion").reset(); 
        
        // Cierre limpio del Modal
        const modalEl = document.getElementById("modalProduccion");
        const modalInstance = bootstrap.Modal.getInstance(modalEl);
        if (modalInstance) {
            modalInstance.hide();
        }
        
        cargarProductos(); 
    } catch (error) { 
        mostrarNotificacion("Fallo en Producción", error.message, "error"); 
    } 
}

async function cargarSelectsCategorias() { 
    try { 
        const respuesta = await fetch(`${API_URL}/categorias`); 
        const categorias = await respuesta.json(); 
        
        const selectFiltro = document.getElementById("filtro-categoria"); 
        const selectAgregar = document.getElementById("categoria-principal"); 
        
        let htmlFiltro = '<option value="">Todas las categorías</option>'; 
        let htmlModal = '<option value="">Seleccione una categoría...</option>'; 
        
        categorias.forEach(c => { 
            htmlFiltro += `<option value="${c.id}">${c.nombre}</option>`; 
            htmlModal += `<option value="${c.id}">${c.nombre}</option>`; 
        }); 
        
        if (selectFiltro) selectFiltro.innerHTML = htmlFiltro; 
        if (selectAgregar) selectAgregar.innerHTML = htmlModal; 
    } catch (error) {} 
}

// ==========================================
// EVENT LISTENERS DEL DOM
// ==========================================
document.getElementById("busqueda-productos").addEventListener("input", filtrarProductos); 
document.getElementById("busqueda-precio").addEventListener("input", filtrarProductos); 
document.getElementById("filtro-categoria").addEventListener("change", filtrarProductos); 
document.getElementById("form-agregar").addEventListener("submit", agregarProducto);
// ========================================================
// VALIDACIONES EN TIEMPO REAL (PRODUCTOS)
// ========================================================

// Validar Precio (Agregar y Editar)
['precio', 'edit-precio'].forEach(id => {
    document.getElementById(id)?.addEventListener("input", function() {
        this.value = this.value.replace(/[^0-9]/g, '');
        if (this.value.length > 6) this.value = this.value.slice(0, 6);
    });
});

// Validar Cantidad a Hornear (Enteros)
document.getElementById("cant-produccion")?.addEventListener("input", function() {
    this.value = this.value.replace(/[^0-9]/g, '');
    if (this.value.length > 4) this.value = this.value.slice(0, 4);
});

// Validar Cantidad de Insumo en Receta (Permite 1 punto decimal)
document.getElementById("insumo-receta-cantidad")?.addEventListener("input", function() {
    this.value = this.value.replace(/[^0-9.]/g, '');
    if ((this.value.match(/\./g) || []).length > 1) {
        this.value = this.value.replace(/\.+$/, "");
    }
});

// Limitar longitud de los nombres
['nombre', 'edit-nombre'].forEach(id => {
    document.getElementById(id)?.addEventListener("input", function() {
        if (this.value.length > 50) this.value = this.value.slice(0, 50);
    });
});