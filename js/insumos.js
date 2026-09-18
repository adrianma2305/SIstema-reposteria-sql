const API_URL_INS = "https://sistema-pasteleria-sql.onrender.com/api";
let listaInsumos = [];
let verInactivosIns = false;

document.addEventListener("DOMContentLoaded", () => {
    cargarTablaInsumos();
    cargarProveedoresSelect();

    // Inyectar el toggle visual de "Ver Inactivos"
    const rowIns = document.querySelector("#seccion-insumos .row.mb-3");
    if (rowIns && !document.getElementById("toggle-inactivos-ins")) {
        rowIns.insertAdjacentHTML('beforeend', `
            <div class="col-md-3 mt-2">
                <div class="form-check form-switch">
                    <input class="form-check-input bg-danger" type="checkbox" id="toggle-inactivos-ins">
                    <label class="form-check-label fw-bold text-muted small">Ver Inactivos</label>
                </div>
            </div>
        `);
        
        document.getElementById("toggle-inactivos-ins").addEventListener("change", (e) => {
            verInactivosIns = e.target.checked;
            const val = document.getElementById("busqueda-insumos")?.value.toLowerCase() || "";
            filtrarInsumosRender(val);
        });
    }
});

// ==========================================
// RENDERIZADO Y OBTENCIÓN DE DATOS
// ==========================================
window.cargarProveedoresSelect = async function() {
    try {
        const res = await fetch(`${API_URL_INS}/proveedores`);
        if (res.ok) {
            const provs = await res.json();
            let html = '<option value="">Sin Proveedor Asociado</option>';
            provs.filter(p => p.activo !== false && p.activo !== 0).forEach(p => {
                html += `<option value="${p.id}">${p.nombre}</option>`;
            });
            const selAdd = document.getElementById("proveedor-insumo");
            const selEdit = document.getElementById("edit-proveedor-insumo");
            if (selAdd) selAdd.innerHTML = html;
            if (selEdit) selEdit.innerHTML = html;
        }
    } catch (error) {
        console.error("Error cargando proveedores al select", error);
    }
};

window.cargarTablaInsumos = async function() {
    const tbody = document.querySelector("#insumos-table tbody");
    if (!tbody) return;

    tbody.innerHTML = "<tr><td colspan='6' class='text-center'>Cargando insumos y materias primas...</td></tr>";

    try {
        const res = await fetch(`${API_URL_INS}/insumos`);
        if (!res.ok) throw new Error();

        listaInsumos = await res.json();
        filtrarInsumosRender(document.getElementById("busqueda-insumos")?.value.toLowerCase() || "");
    } catch (error) {
        tbody.innerHTML = "<tr><td colspan='6' class='text-center text-danger'>Fallo de red al cargar insumos.</td></tr>";
    }
};

function filtrarInsumosRender(val = "") {
    let filtrados = listaInsumos.filter(ins => 
        ins.nombre.toLowerCase().includes(val) || 
        (ins.proveedores && ins.proveedores.nombre && ins.proveedores.nombre.toLowerCase().includes(val))
    );

    if (!verInactivosIns) {
        filtrados = filtrados.filter(i => i.activo !== false && i.activo !== 0);
    }

    renderizarTablaInsumos(filtrados);
}

function renderizarTablaInsumos(insumos) {
    const tbody = document.querySelector("#insumos-table tbody");
    tbody.innerHTML = "";

    if (insumos.length === 0) {
        tbody.innerHTML = "<tr><td colspan='6' class='text-center text-muted'>No se encontraron insumos.</td></tr>";
        return;
    }

    insumos.forEach(ins => {
        const esInactivo = (ins.activo === false || ins.activo === 0);
        const rowStyle = esInactivo ? "opacity: 0.5; background-color: #f8f9fa;" : "";
        
        let botones = "";
        if (esInactivo) {
            botones = `<button class="btn btn-sm btn-success fw-bold" onclick="window.reactivarInsumo(${ins.id})" title="Restaurar"><i class="bi bi-arrow-counterclockwise"></i> Restaurar</button>`;
        } else {
            botones = `
                <button class="btn btn-sm btn-secondary me-1 text-white" onclick="window.abrirKardex(${ins.id}, '${ins.nombre}')" title="Historial"><i class="bi bi-clock-history"></i></button>
                <button class="btn btn-sm btn-info me-1 text-white" onclick="window.abrirModalEditarInsumo(${ins.id})" title="Editar"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-danger" onclick="window.eliminarInsumo(${ins.id})" title="Eliminar"><i class="bi bi-trash"></i></button>
            `;
        }

        tbody.insertAdjacentHTML("beforeend", `
            <tr style="${rowStyle}">
                <td class="fw-bold">#${ins.id}</td>
                <td>
                    <i class="bi bi-box-seam text-muted me-2"></i>${ins.nombre} 
                    ${esInactivo ? '<span class="badge bg-danger ms-1">Inactivo</span>' : ''}
                </td>
                <td class="text-center fw-bold font-mono text-primary">${ins.stock_actual} <span class="small text-muted">${ins.unidad}</span></td>
                <td class="font-mono">C$ ${ins.precio.toFixed(2)}</td>
                <td>${ins.proveedores ? ins.proveedores.nombre : '<span class="text-muted fst-italic">Sin Proveedor</span>'}</td>
                <td class="text-center">${botones}</td>
            </tr>
        `);
    });
}

document.getElementById("busqueda-insumos")?.addEventListener("input", e => {
    filtrarInsumosRender(e.target.value.toLowerCase());
});

// ==========================================
// CREAR Y EDITAR INSUMOS
// ==========================================
window.abrirModalAgregarInsumo = function() {
    document.getElementById("form-agregar-insumo")?.reset();
    bootstrap.Modal.getOrCreateInstance(document.getElementById("modalAgregarInsumo")).show();
};

document.getElementById("form-agregar-insumo")?.addEventListener("submit", async function(e) {
    e.preventDefault();
    const nombre = document.getElementById("nombre-insumo").value.trim();
    const unidad = document.getElementById("unidad-insumo").value;
    const precio = parseFloat(document.getElementById("precio-insumo").value);
    const proveedor_id = document.getElementById("proveedor-insumo").value || null;

    if (!nombre || !precio) {
        return mostrarNotificacion("Atención", "El nombre y el precio unitario son requeridos.", "warning");
    }

    try {
        const res = await fetch(`${API_URL_INS}/insumos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, unidad, precio, proveedor_id })
        });

        if (!res.ok) throw new Error();

        mostrarNotificacion("Éxito", "Insumo registrado correctamente en la base de datos.", "success");
        bootstrap.Modal.getOrCreateInstance(document.getElementById("modalAgregarInsumo")).hide();
        cargarTablaInsumos();
    } catch (error) {
        mostrarNotificacion("Error", "No se pudo registrar el insumo.", "error");
    }
});

window.abrirModalEditarInsumo = function(id) {
    const ins = listaInsumos.find(i => i.id === id);
    if (!ins) return;

    document.getElementById("edit-id-insumo").value = ins.id;
    document.getElementById("edit-nombre-insumo").value = ins.nombre;
    document.getElementById("edit-unidad-insumo").value = ins.unidad;
    document.getElementById("edit-precio-insumo").value = ins.precio;
    document.getElementById("edit-proveedor-insumo").value = ins.proveedor_id || "";

    bootstrap.Modal.getOrCreateInstance(document.getElementById("modalEditarInsumo")).show();
};

document.getElementById("form-editar-insumo")?.addEventListener("submit", async function(e) {
    e.preventDefault();
    const id = document.getElementById("edit-id-insumo").value;
    const nombre = document.getElementById("edit-nombre-insumo").value.trim();
    const unidad = document.getElementById("edit-unidad-insumo").value;
    const precio = parseFloat(document.getElementById("edit-precio-insumo").value);
    const proveedor_id = document.getElementById("edit-proveedor-insumo").value || null;

    try {
        const res = await fetch(`${API_URL_INS}/insumos/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, unidad, precio, proveedor_id })
        });

        if (!res.ok) throw new Error();

        mostrarNotificacion("Actualizado", "Datos del insumo modificados.", "success");
        bootstrap.Modal.getOrCreateInstance(document.getElementById("modalEditarInsumo")).hide();
        cargarTablaInsumos();
    } catch (error) {
        mostrarNotificacion("Error", "No se pudo modificar el insumo.", "error");
    }
});

// ==========================================
// ELIMINAR Y REACTIVAR INSUMOS
// ==========================================
window.eliminarInsumo = async function(id) {
    mostrarConfirmacion("¿Seguro que deseas inhabilitar esta materia prima/insumo?", async () => {
        try {
            const res = await fetch(`${API_URL_INS}/insumos/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error();
            mostrarNotificacion("Eliminado", "Insumo inhabilitado del almacén.", "success");
            cargarTablaInsumos();
        } catch (error) {
            mostrarNotificacion("Error", "No se pudo inhabilitar el insumo.", "error");
        }
    });
};

window.reactivarInsumo = async function(id) {
    mostrarConfirmacion("¿Deseas restaurar este insumo inactivo?", async () => {
        try {
            const res = await fetch(`${API_URL_INS}/insumos/${id}/reactivar`, { method: 'PUT' });
            if (!res.ok) throw new Error();
            mostrarNotificacion("Restaurado", "Insumo devuelto al catálogo activo.", "success");
            cargarTablaInsumos();
        } catch (error) {
            mostrarNotificacion("Error", "No se pudo restaurar el insumo.", "error");
        }
    });
};

// ==========================================
// KARDEX / HISTORIAL DE MOVIMIENTOS
// ==========================================
window.abrirKardex = async function(id, nombre) {
    const tbody = document.getElementById("kardex-table-body");
    document.getElementById("kardex-insumo-nombre").innerText = nombre;
    
    bootstrap.Modal.getOrCreateInstance(document.getElementById("modalHistorialInsumo")).show();
    tbody.innerHTML = "<tr><td colspan='4' class='text-center'>Buscando movimientos en el servidor...</td></tr>";

    try {
        const res = await fetch(`${API_URL_INS}/insumos/${id}/kardex`);
        if (!res.ok) throw new Error();
        
        const historial = await res.json();
        
        if (historial.length === 0) {
            tbody.innerHTML = "<tr><td colspan='4' class='text-center text-muted py-4'><i class='bi bi-inbox fs-3 d-block mb-2'></i>No hay movimientos registrados para este insumo.</td></tr>";
            return;
        }

        tbody.innerHTML = "";
        historial.forEach(mov => {
            const fecha = new Date(mov.fecha).toLocaleString();
            const esEntrada = mov.tipo_movimiento === 'ENTRADA';
            const colorTipo = esEntrada ? 'text-success' : 'text-danger';
            const iconoTipo = esEntrada ? 'bi-box-arrow-in-right' : 'bi-box-arrow-right';
            const signo = esEntrada ? '+' : '-';

            tbody.insertAdjacentHTML("beforeend", `
                <tr>
                    <td class="small align-middle text-muted font-mono">${fecha}</td>
                    <td class="${colorTipo} fw-bold align-middle">
                        <i class="bi ${iconoTipo} me-1"></i>${mov.tipo_movimiento}
                    </td>
                    <td class="${colorTipo} fw-bold font-mono align-middle fs-6">
                        ${signo}${mov.cantidad}
                    </td>
                    <td class="small align-middle">
                        <span class="d-block text-dark">${mov.motivo}</span>
                        <span class="text-muted" style="font-size: 0.75rem;">Registrado por: ${mov.usuario}</span>
                    </td>
                </tr>
            `);
        });
    } catch (error) {
        tbody.innerHTML = "<tr><td colspan='4' class='text-center text-danger'>Error de conexión al obtener el historial de movimientos.</td></tr>";
    }
};