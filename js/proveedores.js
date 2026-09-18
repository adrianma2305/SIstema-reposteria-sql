const API_URL_PROV = "https://sistema-pasteleria-sql.onrender.com/api";
let listaProveedores = [];
let verInactivosProv = false;

document.addEventListener("DOMContentLoaded", () => {
    cargarTablaProveedores();

    // Inyectar el toggle visual de "Ver Inactivos"
    const rowProv = document.querySelector("#seccion-proveedores .row.mb-3");
    if (rowProv && !document.getElementById("toggle-inactivos-prov")) {
        rowProv.insertAdjacentHTML('beforeend', `
            <div class="col-md-3 mt-2">
                <div class="form-check form-switch">
                    <input class="form-check-input bg-danger" type="checkbox" id="toggle-inactivos-prov">
                    <label class="form-check-label fw-bold text-muted small">Ver Inactivos</label>
                </div>
            </div>
        `);
        
        document.getElementById("toggle-inactivos-prov").addEventListener("change", (e) => {
            verInactivosProv = e.target.checked;
            const val = document.getElementById("busqueda-proveedores")?.value.toLowerCase() || "";
            filtrarProveedoresRender(val);
        });
    }
});

// ==========================================
// RENDERIZADO Y OBTENCIÓN DE DATOS
// ==========================================
window.cargarTablaProveedores = async function() {
    const tbody = document.querySelector("#proveedores-table tbody");
    if (!tbody) return;

    tbody.innerHTML = "<tr><td colspan='6' class='text-center'>Cargando proveedores...</td></tr>";

    try {
        const res = await fetch(`${API_URL_PROV}/proveedores`);
        if (!res.ok) throw new Error();

        listaProveedores = await res.json();
        filtrarProveedoresRender(document.getElementById("busqueda-proveedores")?.value.toLowerCase() || "");
    } catch (error) {
        tbody.innerHTML = "<tr><td colspan='6' class='text-center text-danger'>Fallo de red al cargar proveedores.</td></tr>";
    }
};

function filtrarProveedoresRender(val = "") {
    let filtrados = listaProveedores.filter(prov => 
        prov.nombre.toLowerCase().includes(val) || 
        (prov.telefono && prov.telefono.includes(val))
    );

    if (!verInactivosProv) {
        filtrados = filtrados.filter(p => p.activo !== false && p.activo !== 0);
    }

    renderizarTablaProveedores(filtrados);
}

function renderizarTablaProveedores(proveedores) {
    const tbody = document.querySelector("#proveedores-table tbody");
    tbody.innerHTML = "";

    if (proveedores.length === 0) {
        tbody.innerHTML = "<tr><td colspan='6' class='text-center text-muted'>No se encontraron proveedores.</td></tr>";
        return;
    }

    proveedores.forEach(prov => {
        const esInactivo = (prov.activo === false || prov.activo === 0);
        const rowStyle = esInactivo ? "opacity: 0.5; background-color: #f8f9fa;" : "";
        
        let botones = "";
        if (esInactivo) {
            botones = `<button class="btn btn-sm btn-success fw-bold" onclick="window.reactivarProveedor(${prov.id})" title="Restaurar"><i class="bi bi-arrow-counterclockwise"></i> Restaurar</button>`;
        } else {
            botones = `
                <button class="btn btn-sm btn-success me-1 text-white" onclick="window.abrirModalAbonarProveedor(${prov.id}, '${prov.nombre}', ${prov.deuda_total})" title="Abonar Deuda"><i class="bi bi-cash-coin"></i> Abonar</button>
                <button class="btn btn-sm btn-info me-1 text-white" onclick="window.abrirModalEditarProveedor(${prov.id})" title="Editar"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-danger" onclick="window.eliminarProveedor(${prov.id})" title="Eliminar"><i class="bi bi-trash"></i></button>
            `;
        }

        tbody.insertAdjacentHTML("beforeend", `
            <tr style="${rowStyle}">
                <td class="fw-bold">#${prov.id}</td>
                <td>
                    <i class="bi bi-truck text-muted me-2"></i>${prov.nombre} 
                    ${esInactivo ? '<span class="badge bg-danger ms-1">Inactivo</span>' : ''}
                </td>
                <td>${prov.telefono || 'N/A'}</td>
                <td class="text-center fw-bold text-success">C$ ${prov.deuda_total || '0.00'}</td>
                <td>${prov.entrega ? new Date(prov.entrega).toLocaleDateString() : 'Sin definir'}</td>
                <td>${botones}</td>
            </tr>
        `);
    });
}

document.getElementById("busqueda-proveedores")?.addEventListener("input", e => {
    filtrarProveedoresRender(e.target.value.toLowerCase());
});

// ==========================================
// CREAR Y EDITAR PROVEEDORES
// ==========================================
window.abrirModalAgregarProveedor = function() {
    document.getElementById("form-agregar-proveedor")?.reset();
    bootstrap.Modal.getOrCreateInstance(document.getElementById("modalAgregarProveedor")).show();
};

document.getElementById("form-agregar-proveedor")?.addEventListener("submit", async function(e) {
    e.preventDefault();
    const nombre = document.getElementById("nombre-proveedor").value.trim();
    const telefono = document.getElementById("telefono-proveedor").value.trim();
    const entrega = document.getElementById("entrega-proveedor").value;

    if (!nombre) {
        return mostrarNotificacion("Atención", "El nombre es obligatorio", "warning");
    }

    try {
        const res = await fetch(`${API_URL_PROV}/proveedores`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, telefono, entrega })
        });

        if (!res.ok) throw new Error();

        mostrarNotificacion("Éxito", "Proveedor registrado correctamente.", "success");
        bootstrap.Modal.getOrCreateInstance(document.getElementById("modalAgregarProveedor")).hide();
        cargarTablaProveedores();
    } catch (error) {
        mostrarNotificacion("Error", "No se pudo registrar el proveedor.", "error");
    }
});

window.abrirModalEditarProveedor = function(id) {
    const prov = listaProveedores.find(p => p.id === id);
    if (!prov) return;

    document.getElementById("edit-id-proveedor").value = prov.id;
    document.getElementById("edit-nombre-proveedor").value = prov.nombre;
    document.getElementById("edit-telefono-proveedor").value = prov.telefono || "";
    document.getElementById("edit-entrega-proveedor").value = prov.entrega ? prov.entrega.split('T')[0] : "";

    bootstrap.Modal.getOrCreateInstance(document.getElementById("modalEditarProveedor")).show();
};

document.getElementById("form-editar-proveedor")?.addEventListener("submit", async function(e) {
    e.preventDefault();
    const id = document.getElementById("edit-id-proveedor").value;
    const nombre = document.getElementById("edit-nombre-proveedor").value.trim();
    const telefono = document.getElementById("edit-telefono-proveedor").value.trim();
    const entrega = document.getElementById("edit-entrega-proveedor").value;

    try {
        const res = await fetch(`${API_URL_PROV}/proveedores/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, telefono, entrega })
        });

        if (!res.ok) throw new Error();

        mostrarNotificacion("Actualizado", "Datos del proveedor modificados.", "success");
        bootstrap.Modal.getOrCreateInstance(document.getElementById("modalEditarProveedor")).hide();
        cargarTablaProveedores();
    } catch (error) {
        mostrarNotificacion("Error", "No se pudo modificar el proveedor.", "error");
    }
});

// ==========================================
// ELIMINAR, REACTIVAR Y ABONOS
// ==========================================
window.eliminarProveedor = async function(id) {
    mostrarConfirmacion("¿Seguro que deseas inhabilitar a este proveedor?", async () => {
        try {
            const res = await fetch(`${API_URL_PROV}/proveedores/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error();
            mostrarNotificacion("Eliminado", "Proveedor inhabilitado del sistema.", "success");
            cargarTablaProveedores();
        } catch (error) {
            mostrarNotificacion("Error", "No se pudo inhabilitar al proveedor.", "error");
        }
    });
};

window.reactivarProveedor = async function(id) {
    mostrarConfirmacion("¿Deseas restaurar a este proveedor inactivo?", async () => {
        try {
            const res = await fetch(`${API_URL_PROV}/proveedores/${id}/reactivar`, { method: 'PUT' });
            if (!res.ok) throw new Error();
            mostrarNotificacion("Restaurado", "Proveedor reactivado con éxito.", "success");
            cargarTablaProveedores();
        } catch (error) {
            mostrarNotificacion("Error", "No se pudo restaurar el proveedor.", "error");
        }
    });
};

window.abrirModalAbonarProveedor = function(id, nombre, deuda) {
    document.getElementById("abonar-id-proveedor").value = id;
    document.getElementById("nombre-proveedor-abono").innerText = nombre;
    document.getElementById("deuda-actual-proveedor").innerText = `C$ ${deuda || '0.00'}`;
    document.getElementById("monto-abono-proveedor").value = "";

    bootstrap.Modal.getOrCreateInstance(document.getElementById("modalAbonarProveedor")).show();
};

document.getElementById("form-abonar-proveedor")?.addEventListener("submit", async function(e) {
    e.preventDefault();
    const id = document.getElementById("abonar-id-proveedor").value;
    const monto = parseFloat(document.getElementById("monto-abono-proveedor").value);

    if (!monto || monto <= 0) {
        return mostrarNotificacion("Atención", "Ingresa un monto válido a abonar.", "warning");
    }

    try {
        const res = await fetch(`${API_URL_PROV}/proveedores/${id}/abonar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ monto })
        });

        if (!res.ok) throw new Error();

        mostrarNotificacion("Éxito", "Abono registrado a la deuda del proveedor.", "success");
        bootstrap.Modal.getOrCreateInstance(document.getElementById("modalAbonarProveedor")).hide();
        cargarTablaProveedores();
    } catch (error) {
        mostrarNotificacion("Error", "No se pudo registrar el abono.", "error");
    }
});