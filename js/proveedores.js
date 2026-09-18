const API_URL_PROV = "https://sistema-pasteleria-sql.onrender.com/api";
let listaProveedores = [];
let verInactivosProv = false; 

document.addEventListener("DOMContentLoaded", () => {
    // Inyectar el switch de inactivos
    const searchRow = document.getElementById("busqueda-proveedores")?.closest(".row");
    if(searchRow && !document.getElementById("toggle-inactivos-prov")) {
        searchRow.insertAdjacentHTML('beforeend', `<div class="col-md-3"><div class="form-check form-switch"><input class="form-check-input bg-danger" type="checkbox" id="toggle-inactivos-prov"><label class="form-check-label fw-bold text-muted small">Ver Inactivos</label></div></div>`);
        document.getElementById("toggle-inactivos-prov").addEventListener("change", (e) => { 
            verInactivosProv = e.target.checked; 
            filtrarProveedores(); 
        });
    }

    // Evento de búsqueda
    document.getElementById("busqueda-proveedores")?.addEventListener("input", filtrarProveedores);

    cargarTablaProveedores();
    inyectarModalDeuda(); 

    const formAgregar = document.getElementById("form-agregar-proveedor");
    if(formAgregar) formAgregar.addEventListener("submit", guardarProveedor);
    
    const formEditar = document.getElementById("form-editar-proveedor");
    if(formEditar) formEditar.addEventListener("submit", actualizarProveedor);
});

// ==========================================
// 1. CARGAR Y RENDERIZAR TABLA
// ==========================================
window.cargarTablaProveedores = async function() {
    const tbody = document.querySelector("#proveedores-table tbody");
    if (!tbody) return;
    tbody.innerHTML = "<tr><td colspan='6' class='text-center text-muted'>Cargando proveedores...</td></tr>";

    try {
        const res = await fetch(`${API_URL_PROV}/proveedores`);
        listaProveedores = await res.json();
        filtrarProveedores();
    } catch (error) { 
        tbody.innerHTML = "<tr><td colspan='6' class='text-center text-danger fw-bold'>Error de conexión al cargar proveedores.</td></tr>"; 
    }
};

function filtrarProveedores() {
    const valor = document.getElementById("busqueda-proveedores")?.value.trim().toLowerCase() || "";
    let filtrados = listaProveedores.filter(p => p.nombre.toLowerCase().includes(valor));
    
    if (!verInactivosProv) {
        filtrados = filtrados.filter(p => p.activo !== false && p.activo !== 0);
    }
    renderizarTablaProveedores(filtrados);
}

function renderizarTablaProveedores(proveedores) {
    const tbody = document.querySelector("#proveedores-table tbody");
    if(!tbody) return;
    tbody.innerHTML = "";
    
    if (proveedores.length === 0) {
        tbody.innerHTML = "<tr><td colspan='6' class='text-center text-muted'>No hay proveedores registrados.</td></tr>";
        return;
    }

    proveedores.forEach(prov => {
        const esInactivo = (prov.activo === false || prov.activo === 0);
        const rowStyle = esInactivo ? "opacity: 0.5; background-color: #f8f9fa;" : "";
        
        // Conversión segura de deuda
        const deudaNum = parseFloat(prov.deuda_total || 0);
        const deuda = deudaNum.toFixed(2);
        
        const entrega = prov.entrega ? new Date(prov.entrega).toLocaleDateString() : '<span class="badge bg-secondary">Sin agendar</span>';
        const telefono = prov.telefono || '<span class="text-muted">N/A</span>';
        const claseDeuda = deudaNum > 0 ? 'text-danger' : 'text-success';

        let botones = "";
        
        if (esInactivo) {
            botones = `<button class="btn btn-sm btn-success fw-bold" onclick="window.reactivarProveedor(${prov.id})"><i class="bi bi-arrow-counterclockwise"></i> Restaurar</button>`;
        } else {
            // LÓGICA PARA DESACTIVAR EL BOTÓN DE ABONAR SI LA DEUDA ES 0
            const esDeudaCero = (deudaNum <= 0);
            const btnAbonarClass = esDeudaCero ? 'btn-secondary text-white opacity-50' : 'btn-success text-white';
            const btnAbonarClick = esDeudaCero ? '' : `onclick="window.abrirModalAbonarProveedor(${prov.id}, '${prov.nombre}', ${deuda})"`;
            const btnAbonarState = esDeudaCero ? 'disabled title="Sin deuda para abonar"' : 'title="Abonar Deuda"';

            botones = `
                <button class="btn btn-sm btn-warning text-dark fw-bold me-1 mb-1 shadow-sm" onclick="window.abrirModalDeuda(${prov.id}, '${prov.nombre}')" title="Agendar Entrega/Deuda"><i class="bi bi-calendar-plus"></i></button>
                <button class="btn btn-sm ${btnAbonarClass} fw-bold me-1 mb-1 shadow-sm" ${btnAbonarClick} ${btnAbonarState}><i class="bi bi-cash-coin"></i></button>
                <button class="btn btn-sm btn-info text-white me-1 mb-1 shadow-sm" onclick="window.abrirEditarProveedor(${prov.id})" title="Editar"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-danger mb-1 shadow-sm" onclick="window.eliminarProveedor(${prov.id})" title="Eliminar"><i class="bi bi-trash"></i></button>
            `;
        }

        tbody.insertAdjacentHTML("beforeend", `
            <tr class="align-middle" style="${rowStyle}">
                <td class="fw-bold text-muted">#${prov.id}</td>
                <td class="fw-bold text-dark">${prov.nombre} ${esInactivo ? '<span class="badge bg-danger">Inactivo</span>' : ''}</td>
                <td><i class="bi bi-telephone text-muted"></i> ${telefono}</td>
                <td class="text-center fw-bold ${claseDeuda}">C$ ${deuda}</td>
                <td class="text-center">${entrega}</td>
                <td class="text-end" style="min-width: 140px;">${botones}</td>
            </tr>
        `);
    });
}

// ==========================================
// 2. CRUD COMPLETO (AGREGAR, EDITAR, ELIMINAR, REACTIVAR)
// ==========================================
window.guardarProveedor = async function(e) {
    e.preventDefault();
    const nombre = document.getElementById("prov-nombre")?.value || document.getElementById("nombre-proveedor")?.value;
    const telefono = document.getElementById("prov-telefono")?.value || document.getElementById("telefono-proveedor")?.value;
    const entrega = document.getElementById("entrega-proveedor")?.value;

    if(!nombre) return alert("El nombre es obligatorio.");

    try {
        const res = await fetch(`${API_URL_PROV}/proveedores`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, telefono, entrega })
        });
        
        if(res.ok) {
            const form = document.getElementById("form-agregar-proveedor");
            if(form) form.reset();
            const modal = document.getElementById("modalAgregarProveedor") || document.getElementById("modalProveedor");
            if(modal) bootstrap.Modal.getInstance(modal).hide();
            cargarTablaProveedores();
            if(typeof mostrarNotificacion === 'function') mostrarNotificacion("Agregado", "Proveedor guardado.", "success");
        }
    } catch (error) { console.error(error); }
};

window.abrirEditarProveedor = function(id) {
    const prov = listaProveedores.find(p => p.id === id);
    if(!prov) return;
    
    document.getElementById("edit-id-proveedor").value = prov.id;
    document.getElementById("edit-nombre-proveedor").value = prov.nombre;
    document.getElementById("edit-telefono-proveedor").value = prov.telefono || "";
    document.getElementById("edit-entrega-proveedor").value = prov.entrega ? prov.entrega.split('T')[0] : "";
    
    bootstrap.Modal.getOrCreateInstance(document.getElementById("modalEditarProveedor")).show();
};

window.actualizarProveedor = async function(e) {
    e.preventDefault();
    const id = document.getElementById("edit-id-proveedor").value;
    const nombre = document.getElementById("edit-nombre-proveedor").value;
    const telefono = document.getElementById("edit-telefono-proveedor").value;
    const entrega = document.getElementById("edit-entrega-proveedor").value;

    try {
        const res = await fetch(`${API_URL_PROV}/proveedores/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, telefono, entrega })
        });
        if(res.ok) {
            bootstrap.Modal.getInstance(document.getElementById("modalEditarProveedor")).hide();
            cargarTablaProveedores();
            if(typeof mostrarNotificacion === 'function') mostrarNotificacion("Actualizado", "Datos guardados.", "success");
        }
    } catch(error) { console.error(error); }
};

window.eliminarProveedor = function(id) {
    if(typeof mostrarConfirmacion === 'function') {
        mostrarConfirmacion("¿Seguro que deseas desactivar este proveedor?", async () => {
            await fetch(`${API_URL_PROV}/proveedores/${id}`, { method: 'DELETE' });
            cargarTablaProveedores();
            if(typeof mostrarNotificacion === 'function') mostrarNotificacion("Desactivado", "Proveedor dado de baja.", "success");
        });
    } else {
        if(confirm("¿Seguro que deseas desactivar este proveedor?")) {
            fetch(`${API_URL_PROV}/proveedores/${id}`, { method: 'DELETE' })
                .then(() => cargarTablaProveedores());
        }
    }
};

window.reactivarProveedor = function(id) {
    if(typeof mostrarConfirmacion === 'function') {
        mostrarConfirmacion("¿Deseas restaurar este proveedor?", async () => {
            await fetch(`${API_URL_PROV}/proveedores/${id}/reactivar`, { method: 'PUT' });
            cargarTablaProveedores();
            if(typeof mostrarNotificacion === 'function') mostrarNotificacion("Restaurado", "Proveedor reactivado.", "success");
        });
    } else {
        if(confirm("¿Deseas restaurar este proveedor?")) {
            fetch(`${API_URL_PROV}/proveedores/${id}/reactivar`, { method: 'PUT' })
                .then(() => cargarTablaProveedores());
        }
    }
};

// ==========================================
// 3. ABONAR Y AGENDAR DEUDAS
// ==========================================
window.abrirModalAbonarProveedor = function(id, nombre, deuda) {
    document.getElementById("abonar-id-prov").value = id;
    document.getElementById("lbl-nombre-abonar").innerText = nombre;
    document.getElementById("lbl-deuda-abonar").innerText = deuda;
    document.getElementById("monto-abono").value = ""; 
    bootstrap.Modal.getOrCreateInstance(document.getElementById("modalAbonarProveedor")).show();
};

// Corregido: Se renombra a ejecutarAbono para coincidir con tu HTML
window.ejecutarAbono = async function(e) {
    e.preventDefault();
    const id = document.getElementById("abonar-id-prov").value;
    const monto = document.getElementById("monto-abono").value;

    if(!id || !monto || monto <= 0) return alert("Monto inválido");

    try {
        const res = await fetch(`${API_URL_PROV}/proveedores/${id}/abonar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ monto: parseFloat(monto) })
        });
        if(res.ok) {
            bootstrap.Modal.getInstance(document.getElementById("modalAbonarProveedor")).hide();
            cargarTablaProveedores();
            if(typeof mostrarNotificacion === 'function') mostrarNotificacion("Abono Exitoso", "El pago se descontó.", "success");
        }
    } catch (error) { console.error(error); }
};

function inyectarModalDeuda() {
    if (!document.getElementById("modalDeudaEntrega")) {
        document.body.insertAdjacentHTML('beforeend', `
        <div class="modal fade" id="modalDeudaEntrega" tabindex="-1">
          <div class="modal-dialog">
            <div class="modal-content border-0 shadow-lg">
              <div class="modal-header bg-warning text-dark">
                <h5 class="modal-title fw-bold"><i class="bi bi-truck"></i> Agendar Entrega y Facturación</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body bg-light">
                <form id="form-deuda-entrega">
                  <input type="hidden" id="deuda-id-proveedor">
                  <div class="mb-3"><label class="form-label text-muted small fw-bold">Proveedor</label><input type="text" id="deuda-nombre-proveedor" class="form-control fw-bold bg-white" readonly></div>
                  <div class="mb-3 p-3 bg-white border rounded"><label class="form-label fw-bold text-danger"><i class="bi bi-receipt"></i> Monto de Factura a deber (C$)</label><input type="number" step="0.01" min="0" id="deuda-monto" class="form-control form-control-lg border-danger"><small class="text-muted d-block mt-1">Dejar vacío si solo agendas fecha.</small></div>
                  <div class="mb-4"><label class="form-label fw-bold text-primary"><i class="bi bi-calendar-event"></i> Próxima Entrega</label><input type="date" id="deuda-fecha" class="form-control form-control-lg border-primary"></div>
                  <button type="submit" class="btn btn-warning text-dark fw-bold w-100 py-2 shadow-sm fs-5"><i class="bi bi-save"></i> Registrar</button>
                </form>
              </div>
            </div>
          </div>
        </div>`);
        
        document.getElementById("form-deuda-entrega").addEventListener("submit", async (e) => {
            e.preventDefault();
            const id = document.getElementById("deuda-id-proveedor").value;
            const monto = parseFloat(document.getElementById("deuda-monto").value) || 0;
            const fecha = document.getElementById("deuda-fecha").value;

            try {
                const btn = e.target.querySelector('button[type="submit"]');
                const htmlOriginal = btn.innerHTML;
                btn.disabled = true; btn.innerHTML = `Guardando...`;
                const res = await fetch(`${API_URL_PROV}/proveedores/${id}/deuda`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ monto_deuda: monto, fecha_entrega: fecha }) });
                if(res.ok) { bootstrap.Modal.getInstance(document.getElementById("modalDeudaEntrega")).hide(); cargarTablaProveedores(); }
                btn.disabled = false; btn.innerHTML = htmlOriginal;
            } catch (error) { console.error(error); } 
        });
    }
}

window.abrirModalDeuda = function(id, nombre) {
    document.getElementById("deuda-id-proveedor").value = id;
    document.getElementById("deuda-nombre-proveedor").value = nombre;
    document.getElementById("deuda-monto").value = "";
    document.getElementById("deuda-fecha").value = "";
    bootstrap.Modal.getOrCreateInstance(document.getElementById("modalDeudaEntrega")).show();
};