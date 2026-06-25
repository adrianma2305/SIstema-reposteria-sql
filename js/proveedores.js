const API_URL_PROV = "https://sistema-pasteleria-sql.onrender.com/api";
let proveedoresOriginal = [];
let verInactivosProv = false;

document.addEventListener("DOMContentLoaded", () => {
    const rowProv = document.querySelector("#seccion-proveedores .row.mb-3:first-of-type");
    if(rowProv && !document.getElementById("toggle-inactivos-prov")) {
        rowProv.insertAdjacentHTML('beforeend', `<div class="col-md-3 mt-2"><div class="form-check form-switch"><input class="form-check-input bg-danger" type="checkbox" id="toggle-inactivos-prov"><label class="form-check-label fw-bold text-muted small">Ver Eliminados</label></div></div>`);
        document.getElementById("toggle-inactivos-prov").addEventListener("change", (e) => { verInactivosProv = e.target.checked; filtrarProveedores(); });
    }
    cargarProveedores();
});

async function cargarProveedores() {
  const tabla = document.querySelector("#proveedores-table tbody");
  tabla.innerHTML = "<tr><td colspan='6' class='text-center'>Cargando proveedores...</td></tr>";
  try {
    const respuesta = await fetch(`${API_URL_PROV}/proveedores`);
    if (!respuesta.ok) throw new Error("Error de red");
    proveedoresOriginal = await respuesta.json();
    filtrarProveedores();
  } catch (error) { tabla.innerHTML = "<tr><td colspan='6' class='text-center text-danger'>Error al cargar los datos</td></tr>"; }
}

function filtrarProveedores() {
  const valor = document.getElementById("busqueda-proveedores").value.trim().toLowerCase();
  let filtrados = proveedoresOriginal.filter((p) => p.nombre.toLowerCase().includes(valor) || (p.telefono && p.telefono.includes(valor)));
  if (!verInactivosProv) filtrados = filtrados.filter(p => p.activo !== false && p.activo !== 0);
  renderizarProveedores(filtrados);
}

function renderizarProveedores(proveedores) {
  const tabla = document.querySelector("#proveedores-table tbody");
  tabla.innerHTML = "";
  proveedores.forEach((p) => {
    const esInactivo = (p.activo === false || p.activo === 0);
    const rowStyle = esInactivo ? "opacity: 0.5; background-color: #f8f9fa;" : "";
    let celdaDeuda = p.deuda_total > 0 ? `<span class="text-danger fw-bold">C$ ${p.deuda_total}</span>` : `<span class="text-success fw-bold">C$ 0 (Solvente)</span>`;

    let botonesAccion = "";
    if (esInactivo) {
        botonesAccion = `<button class="btn btn-sm btn-success fw-bold" onclick="reactivarProveedor(${p.id})"><i class="bi bi-arrow-counterclockwise"></i> Restaurar</button>`;
    } else {
        let btnAbonar = p.deuda_total > 0 ? `<button class="btn btn-sm btn-success text-white me-1" onclick="abrirModalAbono(${p.id}, '${p.nombre}', ${p.deuda_total})" title="Abonar / Pagar Deuda"><i class="bi bi-cash-coin"></i></button>` : `<button class="btn btn-sm btn-outline-secondary me-1" disabled><i class="bi bi-cash-coin"></i></button>`;
        botonesAccion = `
          ${btnAbonar}
          <button class="btn btn-sm btn-info text-white me-1" onclick="abrirEditarProveedor(${p.id})"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-danger" onclick="eliminarProveedor(${p.id})"><i class="bi bi-trash"></i></button>
        `;
    }

    tabla.insertAdjacentHTML("beforeend", `
      <tr style="${rowStyle}">
        <td>${p.id}</td>
        <td class="fw-bold">${p.nombre} ${esInactivo ? '<span class="badge bg-danger">Inactivo</span>' : ''}</td>
        <td>${p.telefono || 'N/A'}</td>
        <td class="bg-light border-start border-end text-center">${celdaDeuda}</td>
        <td>${p.entrega ? new Date(p.entrega).toLocaleDateString() : 'N/A'}</td>
        <td>${botonesAccion}</td>
      </tr>
    `);
  });
}

window.reactivarProveedor = function(id) {
    mostrarConfirmacion("¿Deseas activar nuevamente a este proveedor?", async () => {
        try { await fetch(`${API_URL_PROV}/proveedores/${id}/reactivar`, { method: 'PUT' }); mostrarNotificacion("Restaurado", "Proveedor activo.", "success"); cargarProveedores(); } 
        catch (error) { mostrarNotificacion("Error", "No se logró restaurar.", "error"); }
    });
};

window.eliminarProveedor = function(id) {
  mostrarConfirmacion("¿Deseas dar de baja a este proveedor?", async () => {
    try { await fetch(`${API_URL_PROV}/proveedores/${id}`, { method: 'DELETE' }); mostrarNotificacion("Eliminado", "Proveedor inactivo.", "success"); cargarProveedores(); } 
    catch (error) { mostrarNotificacion("Error", "Fallo al borrar proveedor", "error"); }
  });
};

// ... Mantenemos el resto igual
window.abrirModalAbono = function(id, nombre, deuda) { document.getElementById("abonar-id-prov").value = id; document.getElementById("lbl-nombre-abonar").innerText = nombre; document.getElementById("lbl-deuda-abonar").innerText = deuda; document.getElementById("monto-abono").max = deuda; document.getElementById("monto-abono").value = ""; new bootstrap.Modal(document.getElementById("modalAbonarProveedor")).show(); };
window.ejecutarAbono = async function(event) { event.preventDefault(); const id = document.getElementById("abonar-id-prov").value; const monto = parseInt(document.getElementById("monto-abono").value, 10); if(!id || isNaN(monto) || monto <= 0) return mostrarNotificacion("Inválido", "Ingresa un abono mayor a cero.", "warning"); try { const res = await fetch(`${API_URL_PROV}/proveedores/${id}/abonar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ monto_abono: monto }) }); if(!res.ok) throw new Error("Error procesando pago"); mostrarNotificacion("Transacción Exitosa", "La deuda con el proveedor ha disminuido.", "success"); bootstrap.Modal.getInstance(document.getElementById("modalAbonarProveedor")).hide(); cargarProveedores(); } catch (error) { mostrarNotificacion("Error", "Error de conexión al registrar el abono.", "error"); } };
async function agregarProveedor(event) { event.preventDefault(); const nombre = document.getElementById("nombre-proveedor").value.trim(); const telefono = document.getElementById("telefono-proveedor").value.trim(); const entrega = document.getElementById("entrega-proveedor").value; if (!nombre) return mostrarNotificacion("Atención", "El nombre es obligatorio.", "warning"); try { await fetch(`${API_URL_PROV}/proveedores`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre, telefono, entrega }) }); bootstrap.Modal.getInstance(document.getElementById("modalAgregarProveedor")).hide(); document.getElementById("form-agregar-proveedor").reset(); mostrarNotificacion("Registrado", "Proveedor guardado.", "success"); cargarProveedores(); } catch (error) { mostrarNotificacion("Error", "Fallo al guardar", "error"); } }
async function abrirEditarProveedor(id) { try { const respuesta = await fetch(`${API_URL_PROV}/proveedores/${id}`); const proveedor = await respuesta.json(); document.getElementById("edit-id-proveedor").value = proveedor.id; document.getElementById("edit-nombre-proveedor").value = proveedor.nombre; document.getElementById("edit-telefono-proveedor").value = proveedor.telefono || ""; document.getElementById("edit-entrega-proveedor").value = proveedor.entrega ? proveedor.entrega.split('T')[0] : ""; new bootstrap.Modal(document.getElementById("modalEditarProveedor")).show(); } catch (error) { mostrarNotificacion("Error", "No se cargaron los datos", "error"); } }
async function actualizarProveedor(event) { event.preventDefault(); const id = document.getElementById("edit-id-proveedor").value; const nombre = document.getElementById("edit-nombre-proveedor").value.trim(); const telefono = document.getElementById("edit-telefono-proveedor").value.trim(); const entrega = document.getElementById("edit-entrega-proveedor").value; try { await fetch(`${API_URL_PROV}/proveedores/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre, telefono, entrega }) }); bootstrap.Modal.getInstance(document.getElementById("modalEditarProveedor")).hide(); mostrarNotificacion("Guardado", "Cambios aplicados", "success"); cargarProveedores(); } catch (error) { mostrarNotificacion("Error", "Fallo al actualizar", "error"); } }
document.getElementById("busqueda-proveedores").addEventListener("input", filtrarProveedores);
document.getElementById("form-agregar-proveedor").addEventListener("submit", agregarProveedor);
document.getElementById("form-editar-proveedor").addEventListener("submit", actualizarProveedor);