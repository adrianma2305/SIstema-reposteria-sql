const API_URL_PROD = "https://sistema-pasteleria-sql.onrender.com/api"; 
let productosStock = [];
let verInactivosProd = false;
let recetaTemporal = [];

// ==========================================
// 1. CARGA Y RENDERIZADO DE TABLA 
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    cargarProductos();
    
    // Inyectar el toggle visual de "Ver Inactivos"
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
            const val = document.getElementById("busqueda-productos")?.value.toLowerCase() || "";
            filtrarProductosRender(val);
        });
    }

    document.getElementById('btn-ir-productos')?.addEventListener('click', () => {
        cargarProductos();
    });
});

async function cargarProductos() {
    const tbody = document.querySelector('#productos-table tbody');
    if (!tbody) return;
    tbody.innerHTML = "<tr><td colspan='5' class='text-center'>Cargando catálogo...</td></tr>";

    try {
        const res = await fetch(`${API_URL_PROD}/productos`);
        if (!res.ok) throw new Error();
        productosStock = await res.json();
        filtrarProductosRender(document.getElementById("busqueda-productos")?.value.toLowerCase() || "");
        cargarCategoriasFiltro();
    } catch (error) {
        tbody.innerHTML = "<tr><td colspan='5' class='text-center text-danger'>Fallo de red al cargar productos.</td></tr>";
    }
}

function filtrarProductosRender(val = "") {
    let filtrados = productosStock.filter(p => p.nombre.toLowerCase().includes(val));

    if (!verInactivosProd) {
        filtrados = filtrados.filter(p => p.activo !== false && p.activo !== 0);
    }

    const cat = document.getElementById('filtro-categoria')?.value;
    if (cat) {
        filtrados = filtrados.filter(p => p.categoria && p.categoria.nombre === cat);
    }

    renderizarProductos(filtrados);
}

function renderizarProductos(productos) {
    const tbody = document.querySelector('#productos-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    if (productos.length === 0) {
        tbody.innerHTML = "<tr><td colspan='5' class='text-center text-muted'>No se encontraron productos.</td></tr>";
        return;
    }

    productos.forEach(p => {
        const esInactivo = p.activo === false || p.activo === 0;
        const rowStyle = esInactivo ? "opacity: 0.5; background-color: #f8f9fa;" : "";
        const badgeCaducidad = p.stock > 0 ? generarBadgeCaducidad(p.fecha_vencimiento) : '';

        const badgeStock = esInactivo 
            ? `<span class="badge bg-secondary ms-2">Eliminado</span>` 
            : (p.stock > 0 
                ? `<span class="badge bg-success ms-2">${p.stock} en vitrina</span> ${badgeCaducidad}` 
                : `<span class="badge bg-danger ms-2">Agotado</span>`);

        let botones = "";
        if (esInactivo) {
            botones = `<button class="btn btn-sm btn-success fw-bold" onclick="reactivarProducto(${p.id})" title="Restaurar"><i class="bi bi-arrow-counterclockwise"></i></button>`;
        } else {
            botones = `
                <button class="btn btn-sm btn-secondary me-1 text-white" onclick="window.abrirModalVerReceta(${p.id}, '${p.nombre}')" title="Ver Receta"><i class="bi bi-list-ul"></i></button>
                <button class="btn btn-sm btn-info me-1 text-white" onclick="window.abrirModalEditarProducto(${p.id})" title="Editar"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-danger" onclick="window.eliminarProducto(${p.id})" title="Eliminar"><i class="bi bi-trash"></i></button>
            `;
        }

        const nombreCat = p.categoria ? p.categoria.nombre : 'Sin Categoría';
        const costo = p.costo ? parseFloat(p.costo).toFixed(2) : '0.00';

        tbody.insertAdjacentHTML("beforeend", `
            <tr style="${rowStyle}">
                <td class="fw-bold text-muted">#${p.id}</td>
                <td class="fw-bold">${p.nombre} ${badgeStock}</td>
                <td>${nombreCat}</td>
                <td>
                    <span class="text-success fw-bold">Venta: C$ ${parseFloat(p.precio).toFixed(2)}</span><br>
                    <small class="text-muted">Costo Receta: C$ ${costo}</small>
                </td>
                <td class="text-center">${botones}</td>
            </tr>
        `);
    });
}

// ==========================================
// 2. LÓGICA DE CADUCIDAD (VITRINA NICARAGUA)
// ==========================================
document.getElementById('prod-produccion')?.addEventListener('change', (e) => {
    const select = e.target;
    if (select.selectedIndex <= 0) return;

    const nombreProducto = select.options[select.selectedIndex].text.toLowerCase();
    let diasVidaUtil = 3; 

    if (nombreProducto.includes('galleta') || nombreProducto.includes('pico') || nombreProducto.includes('polvoron') || nombreProducto.includes('pan')) {
        diasVidaUtil = 10; 
    } else if (nombreProducto.includes('tres leches') || nombreProducto.includes('pio quinto') || nombreProducto.includes('postre')) {
        diasVidaUtil = 3; 
    } else if (nombreProducto.includes('pastel') || nombreProducto.includes('torta')) {
        diasVidaUtil = 4; 
    }

    const fechaVencimiento = new Date();
    fechaVencimiento.setDate(fechaVencimiento.getDate() + diasVidaUtil);
    document.getElementById('fecha-vencimiento-prod').value = fechaVencimiento.toISOString().split('T')[0];
});

function generarBadgeCaducidad(fechaVencimientoBD) {
    if (!fechaVencimientoBD) return ''; 
    const hoy = new Date(); hoy.setHours(0,0,0,0); 
    const fechaVence = new Date(fechaVencimientoBD); fechaVence.setHours(0,0,0,0);
    const diasRestantes = Math.ceil((fechaVence.getTime() - hoy.getTime()) / (1000 * 3600 * 24));

    if (diasRestantes < 0) return `<span class="badge bg-danger ms-2 shadow-sm" title="¡Dar de baja!"><i class="bi bi-exclamation-octagon"></i> Vencido</span>`;
    if (diasRestantes === 0) return `<span class="badge bg-warning text-dark ms-2 shadow-sm"><i class="bi bi-clock-history"></i> Vence Hoy</span>`;
    if (diasRestantes <= 2) return `<span class="badge bg-info text-dark ms-2 shadow-sm"><i class="bi bi-info-circle"></i> Vence en ${diasRestantes} días</span>`;
    return `<span class="badge bg-success ms-2 shadow-sm"><i class="bi bi-check-circle"></i> Fresco</span>`; 
}

// ==========================================
// 3. MÓDULO DE PRODUCCIÓN (HORNEAR)
// ==========================================
window.abrirModalProduccion = async function() {
    try {
        const selectProd = document.getElementById('prod-produccion');
        selectProd.innerHTML = '<option value="">Seleccione qué va a hornear...</option>';
        productosStock.filter(p => p.activo !== false && p.activo !== 0).forEach(p => {
            selectProd.innerHTML += `<option value="${p.id}">${p.nombre}</option>`;
        });
        document.getElementById('cant-produccion').value = '';
        if(document.getElementById('fecha-vencimiento-prod')) document.getElementById('fecha-vencimiento-prod').value = '';
        bootstrap.Modal.getOrCreateInstance(document.getElementById('modalProduccion')).show();
    } catch (error) {
        console.error("Error al cargar productos para producción:", error);
    }
}

window.ejecutarProduccion = async function(event) { 
    event.preventDefault(); 
    const producto_id = parseInt(document.getElementById("prod-produccion").value); 
    const cantidad_producida = parseInt(document.getElementById("cant-produccion").value, 10); 
    let fecha_vencimiento = null;
    if(document.getElementById("fecha-vencimiento-prod")) {
        fecha_vencimiento = document.getElementById("fecha-vencimiento-prod").value; 
    }
    
    if (!producto_id || isNaN(cantidad_producida) || cantidad_producida <= 0) {
        return mostrarNotificacion("Aviso", "Ingresa una cantidad válida.", "warning"); 
    }
    
    const usuario_id = localStorage.getItem("usuario_id") ? parseInt(localStorage.getItem("usuario_id")) : 1; 
    
    try { 
        const respuesta = await fetch(`${API_URL_PROD}/produccion`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ producto_id, cantidad_producida, usuario_id, fecha_vencimiento }) 
        }); 
        const data = await respuesta.json();

        if(respuesta.ok) {
            mostrarNotificacion("Vitrina Actualizada", `Se agregaron ${cantidad_producida} unidades a la vitrina.`, "success");
            bootstrap.Modal.getOrCreateInstance(document.getElementById('modalProduccion')).hide();
            cargarProductos(); 
        } else {
            mostrarNotificacion("Error de Producción", data.mensaje || 'Revisa si tienes stock suficiente de insumos.', "error");
        }
    } catch (error) { 
        mostrarNotificacion("Error", "Fallo de conexión al servidor.", "error");
    } 
};

// ==========================================
// 4. CREAR, EDITAR, ELIMINAR Y RECETAS
// ==========================================
window.eliminarProducto = async function(id) {
    mostrarConfirmacion("¿Seguro que deseas eliminar este producto? Se ocultará del catálogo.", async () => {
        try {
            const res = await fetch(`${API_URL_PROD}/productos/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error();
            mostrarNotificacion("Eliminado", "Producto oculto correctamente.", "success");
            cargarProductos();
        } catch (error) {
            mostrarNotificacion("Error", "No se pudo eliminar el producto.", "error");
        }
    });
};

window.reactivarProducto = async function(id) {
    mostrarConfirmacion("¿Deseas restaurar este producto al catálogo?", async () => {
        try {
            const res = await fetch(`${API_URL_PROD}/productos/${id}/reactivar`, { method: 'PUT' });
            if (!res.ok) throw new Error();
            mostrarNotificacion("Restaurado", "Producto devuelto al catálogo.", "success");
            cargarProductos();
        } catch (error) {
            mostrarNotificacion("Error", "No se pudo restaurar el producto.", "error");
        }
    });
};

window.abrirModalVerReceta = async function(id, nombre) {
    document.getElementById("title-ver-receta").innerText = `Fórmula de: ${nombre}`;
    const tbody = document.getElementById("body-ver-receta");
    tbody.innerHTML = "<tr><td colspan='3' class='text-center'>Buscando receta en servidor...</td></tr>";
    
    bootstrap.Modal.getOrCreateInstance(document.getElementById("modalVerReceta")).show();

    try {
        const res = await fetch(`${API_URL_PROD}/productos/${id}/receta`);
        if (!res.ok) throw new Error();
        const detalles = await res.json();

        if(detalles.length === 0) {
            tbody.innerHTML = "<tr><td colspan='3' class='text-center text-muted'>Este producto no tiene receta BOM asignada.</td></tr>";
            return;
        }

        tbody.innerHTML = "";
        let totalCosto = 0;
        detalles.forEach(d => {
            totalCosto += parseFloat(d.subtotal_costo);
            tbody.insertAdjacentHTML('beforeend', `
                <tr>
                    <td>${d.nombre_insumo} <br><small class="text-muted">${d.cantidad_necesaria} ${d.unidad}</small></td>
                    <td>C$ ${parseFloat(d.costo_unitario).toFixed(2)} c/u</td>
                    <td class="fw-bold">C$ ${parseFloat(d.subtotal_costo).toFixed(2)}</td>
                </tr>
            `);
        });
        tbody.insertAdjacentHTML('beforeend', `
            <tr class="table-dark">
                <td colspan="2" class="text-end fw-bold">COSTO TOTAL DE FÁBRICA:</td>
                <td class="fw-bold text-success fs-5">C$ ${totalCosto.toFixed(2)}</td>
            </tr>
        `);
    } catch (error) {
        tbody.innerHTML = "<tr><td colspan='3' class='text-center text-danger'>Error al obtener la receta.</td></tr>";
    }
};

window.abrirModalEditarProducto = async function(id) {
    const prod = productosStock.find(p => p.id === id);
    if (!prod) return;

    document.getElementById("edit-id").value = prod.id;
    document.getElementById("edit-nombre").value = prod.nombre;
    document.getElementById("edit-precio").value = prod.precio;

    const selectCat = document.getElementById("edit-categoria-principal");
    try {
        const resCat = await fetch(`${API_URL_PROD}/categorias`);
        const cats = await resCat.json();
        selectCat.innerHTML = '<option value="">Sin Categoría</option>';
        cats.forEach(c => {
            const isSelected = prod.categoria_id == c.id ? "selected" : "";
            selectCat.innerHTML += `<option value="${c.id}" ${isSelected}>${c.nombre}</option>`;
        });
    } catch(e) { console.error("Error cargando cats", e); }

    bootstrap.Modal.getOrCreateInstance(document.getElementById("modalEditar")).show();
};

document.getElementById("form-editar")?.addEventListener("submit", async function(e) {
    e.preventDefault();
    const id = document.getElementById("edit-id").value;
    const nombre = document.getElementById("edit-nombre").value.trim();
    const precio = parseFloat(document.getElementById("edit-precio").value);
    const categoria_id = document.getElementById("edit-categoria-principal").value || null;

    try {
        const res = await fetch(`${API_URL_PROD}/productos/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, precio, categoria_id })
        });
        if (!res.ok) throw new Error();
        mostrarNotificacion("Actualizado", "Producto actualizado correctamente.", "success");
        bootstrap.Modal.getOrCreateInstance(document.getElementById("modalEditar")).hide();
        cargarProductos();
    } catch (error) {
        mostrarNotificacion("Error", "No se pudo actualizar el producto.", "error");
    }
});

// ==========================================
// 5. FILTROS
// ==========================================
document.getElementById('busqueda-productos')?.addEventListener('input', (e) => {
    filtrarProductosRender(e.target.value.toLowerCase());
});

function cargarCategoriasFiltro() {
    const categorias = [...new Set(productosStock.filter(p => p.categoria).map(p => p.categoria.nombre))];
    const select = document.getElementById('filtro-categoria');
    if(!select) return;
    
    select.innerHTML = '<option value="">Todas las categorías</option>';
    categorias.forEach(c => { select.innerHTML += `<option value="${c}">${c}</option>`; });
}

document.getElementById('filtro-categoria')?.addEventListener('change', () => {
    filtrarProductosRender(document.getElementById('busqueda-productos')?.value.toLowerCase() || "");
});