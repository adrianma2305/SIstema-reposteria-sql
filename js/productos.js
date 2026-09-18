const API_URL_PROD = "https://sistema-pasteleria-sql.onrender.com/api";
let listaProductos = [];
let listaInsumosDisponibles = [];
let verInactivosProd = false;

document.addEventListener("DOMContentLoaded", () => {
    cargarTablaProductos();
    cargarInsumosParaRecetas(); // Se cargan en segundo plano para tenerlos listos

    // Búsqueda de productos
    document.getElementById("busqueda-productos")?.addEventListener("input", (e) => {
        renderizarTablaProductos(e.target.value.toLowerCase());
    });

    // Toggle para ver productos eliminados/inactivos
    document.getElementById("toggle-inactivos-prod")?.addEventListener("change", (e) => {
        verInactivosProd = e.target.checked;
        renderizarTablaProductos(document.getElementById("busqueda-productos")?.value.toLowerCase() || "");
    });

    // Conectar el formulario de creación
    const formAgregar = document.getElementById("form-agregar-producto");
    if(formAgregar) {
        formAgregar.addEventListener("submit", guardarProductoConReceta);
    }
});

// ==========================================
// 1. CARGAR Y RENDERIZAR PRODUCTOS
// ==========================================
window.cargarTablaProductos = async function() {
    const tbody = document.querySelector("#productos-table tbody");
    if (!tbody) return;
    tbody.innerHTML = "<tr><td colspan='6' class='text-center text-muted'>Cargando productos...</td></tr>";

    try {
        const res = await fetch(`${API_URL_PROD}/productos`);
        listaProductos = await res.json();
        renderizarTablaProductos();
    } catch (error) {
        console.error("Error al cargar productos:", error);
        tbody.innerHTML = "<tr><td colspan='6' class='text-center text-danger fw-bold'>Fallo de red al cargar el inventario.</td></tr>";
    }
};

window.renderizarTablaProductos = function(filtro = "") {
    const tbody = document.querySelector("#productos-table tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    // Filtrar por búsqueda y por estado activo/inactivo
    const filtrados = listaProductos.filter(p => {
        const coincideTexto = p.nombre.toLowerCase().includes(filtro);
        const coincideEstado = verInactivosProd ? true : p.activo === true;
        return coincideTexto && coincideEstado;
    });

    if (filtrados.length === 0) {
        tbody.innerHTML = "<tr><td colspan='6' class='text-center text-muted'>No se encontraron productos con esos criterios.</td></tr>";
        return;
    }

    filtrados.forEach(prod => {
        const tr = document.createElement("tr");
        if(!prod.activo) tr.classList.add("table-danger", "text-muted"); // Sombreado si está inactivo
        
        // Blindaje matemático para evitar NaN
        const precio = parseFloat(prod.precio || 0).toFixed(2);
        const costo = parseFloat(prod.costo || 0).toFixed(2);
        const stock = parseInt(prod.stock || 0);
        const margen = precio > 0 ? (((precio - costo) / precio) * 100).toFixed(1) : 0;
        
        // Semáforo de Rentabilidad
        let badgeMargen = '<span class="badge bg-success">Excelente</span>';
        if (margen < 30 && margen >= 15) badgeMargen = '<span class="badge bg-warning text-dark">Riesgo</span>';
        if (margen < 15) badgeMargen = '<span class="badge bg-danger">Pérdida</span>';

        tr.innerHTML = `
            <td class="fw-bold">#${prod.id}</td>
            <td class="fw-bold text-dark">${prod.nombre} <br> <small class="text-muted">${prod.categoria?.nombre || 'Sin categoría'}</small></td>
            <td class="text-center fw-bold text-primary">C$ ${precio}</td>
            <td class="text-center text-danger">C$ ${costo}</td>
            <td class="text-center fw-bold">${stock} und</td>
            <td class="text-center">${badgeMargen} <br> <small>${margen}%</small></td>
            <td class="text-end">
                ${prod.activo 
                    ? `<button class="btn btn-sm btn-outline-danger fw-bold" onclick="window.cambiarEstadoProducto(${prod.id}, 0)" title="Desactivar/Eliminar"><i class="bi bi-trash-fill"></i></button>`
                    : `<button class="btn btn-sm btn-outline-success fw-bold" onclick="window.cambiarEstadoProducto(${prod.id}, 1)" title="Reactivar"><i class="bi bi-arrow-counterclockwise"></i></button>`
                }
            </td>
        `;
        tbody.appendChild(tr);
    });
};

// ==========================================
// 2. LÓGICA DE RECETAS BLINDADA
// ==========================================
async function cargarInsumosParaRecetas() {
    try {
        const res = await fetch(`${API_URL_PROD}/insumos`);
        const insumos = await res.json();
        // Solo guardamos los insumos activos
        listaInsumosDisponibles = insumos.filter(i => i.activo === true);
    } catch (error) {
        console.error("Fallo al precargar insumos para recetas", error);
    }
}

window.abrirModalAgregarProducto = function() {
    if (listaInsumosDisponibles.length === 0) {
        alert("¡ATENCIÓN! No tienes materias primas (insumos) registradas o activas en bodega. Ve a la sección de Insumos y registra ingredientes antes de crear un producto.");
        return; // Bloqueo de seguridad: Evita crear recetas vacías
    }

    const form = document.getElementById("form-agregar-producto");
    if(form) form.reset();

    const tbodyReceta = document.querySelector("#tabla-receta-crear tbody");
    if(tbodyReceta) tbodyReceta.innerHTML = "";
    
    document.getElementById("lbl-costo-total-receta").innerText = "C$ 0.00";
    
    // Llenar el selector de insumos
    const selectInsumo = document.getElementById("select-insumo-receta");
    if(selectInsumo) {
        selectInsumo.innerHTML = '<option value="">Selecciona un ingrediente...</option>';
        listaInsumosDisponibles.forEach(i => {
            selectInsumo.innerHTML += `<option value="${i.id}" data-precio="${i.precio}" data-unidad="${i.unidad}">${i.nombre} (C$${i.precio} x ${i.unidad})</option>`;
        });
    }

    bootstrap.Modal.getOrCreateInstance(document.getElementById("modalAgregarProducto")).show();
};

window.agregarInsumoAReceta = function() {
    const select = document.getElementById("select-insumo-receta");
    if(!select || !select.value) return alert("Selecciona un insumo primero.");

    const idInsumo = select.value;
    const option = select.options[select.selectedIndex];
    const nombre = option.text.split(' (')[0];
    const precio = parseFloat(option.dataset.precio) || 0;
    const unidad = option.dataset.unidad || 'und';

    const tbody = document.querySelector("#tabla-receta-crear tbody");
    
    // Evitar duplicados en la receta
    if(document.getElementById(`fila-receta-ins-${idInsumo}`)) {
        return alert("Este ingrediente ya está en la receta.");
    }

    const tr = document.createElement("tr");
    tr.id = `fila-receta-ins-${idInsumo}`;
    tr.dataset.id = idInsumo;
    tr.dataset.precio = precio;
    tr.innerHTML = `
        <td>${nombre}</td>
        <td class="text-center text-muted">${unidad}</td>
        <td style="width: 120px;">
            <input type="number" step="0.01" min="0" class="form-control form-control-sm cant-insumo" placeholder="0.00" oninput="window.calcularCostoRecetaVirtual()">
        </td>
        <td class="text-end fw-bold text-danger subtotal-fila">C$ 0.00</td>
        <td class="text-center">
            <button type="button" class="btn btn-sm btn-outline-danger border-0" onclick="this.closest('tr').remove(); window.calcularCostoRecetaVirtual();"><i class="bi bi-x-circle-fill"></i></button>
        </td>
    `;
    tbody.appendChild(tr);
    select.value = ""; // Limpiar selector
};

window.calcularCostoRecetaVirtual = function() {
    let costoTotal = 0;
    const filas = document.querySelectorAll("#tabla-receta-crear tbody tr");
    
    filas.forEach(fila => {
        const inputCant = fila.querySelector(".cant-insumo");
        const precioUnitario = parseFloat(fila.dataset.precio) || 0;
        
        // Si el usuario borra el número, se toma como 0 para evitar el NaN
        let cantidad = parseFloat(inputCant.value) || 0;
        if(cantidad < 0) { cantidad = 0; inputCant.value = 0; } // Prevenir negativos
        
        const subtotal = cantidad * precioUnitario;
        costoTotal += subtotal;
        
        const spanSub = fila.querySelector(".subtotal-fila");
        if(spanSub) spanSub.innerText = `C$ ${subtotal.toFixed(2)}`;
    });

    const lblCosto = document.getElementById("lbl-costo-total-receta");
    if(lblCosto) lblCosto.innerText = `C$ ${costoTotal.toFixed(2)}`;
};

// ==========================================
// 3. GUARDAR PRODUCTO EN EL BACKEND
// ==========================================
window.guardarProductoConReceta = async function(e) {
    e.preventDefault();

    const nombre = document.getElementById("prod-nombre")?.value;
    const precio = parseFloat(document.getElementById("prod-precio")?.value) || 0;
    const categoria_id = document.getElementById("prod-categoria")?.value || 1;
    
    if(!nombre || precio <= 0) return alert("Nombre y precio (mayor a 0) son obligatorios.");

    // Recopilar la receta
    const recetaExtraida = [];
    const filas = document.querySelectorAll("#tabla-receta-crear tbody tr");
    
    filas.forEach(fila => {
        const id_insumo = parseInt(fila.dataset.id);
        const cantidad = parseFloat(fila.querySelector(".cant-insumo").value) || 0;
        if(cantidad > 0) {
            recetaExtraida.push({ insumo_id: id_insumo, cantidad_necesaria: cantidad });
        }
    });

    const payload = {
        nombre: nombre,
        precio: precio,
        categoria_id: categoria_id,
        stock: 0, // Inicia en 0, se aumenta al producir
        receta: recetaExtraida
    };

    try {
        const btnSubmit = e.target.querySelector('button[type="submit"]');
        const originalText = btnSubmit.innerHTML;
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Guardando...`;

        const res = await fetch(`${API_URL_PROD}/productos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if(res.ok) {
            bootstrap.Modal.getInstance(document.getElementById("modalAgregarProducto")).hide();
            cargarTablaProductos();
            if(typeof mostrarNotificacion === 'function') mostrarNotificacion("Éxito", "Producto y receta guardados.", "success");
        } else {
            alert("Error al guardar el producto en la base de datos.");
        }

        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalText;
    } catch (error) {
        console.error("Fallo guardando producto", error);
        alert("Error de red al intentar guardar.");
    }
};

// ==========================================
// 4. ELIMINAR / REACTIVAR PRODUCTO
// ==========================================
window.cambiarEstadoProducto = async function(id, estadoActivo) {
    const accion = estadoActivo === 0 ? 'DELETE' : 'PUT';
    const urlSufijo = estadoActivo === 0 ? '' : '/reactivar';
    const mensaje = estadoActivo === 0 ? '¿Seguro que deseas desactivar este producto?' : '¿Deseas reactivar este producto?';

    if(!confirm(mensaje)) return;

    try {
        const res = await fetch(`${API_URL_PROD}/productos/${id}${urlSufijo}`, { method: accion });
        if(res.ok) {
            cargarTablaProductos();
        } else {
            alert("Hubo un problema al cambiar el estado del producto.");
        }
    } catch (error) {
        console.error("Error al cambiar estado:", error);
    }
};