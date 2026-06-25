const API_URL_PROV = "https://sistema-pasteleria-sql.onrender.com/api";
let proveedoresOriginal = []; let verInactivosProv = false;

document.addEventListener("DOMContentLoaded", () => {
    const rowProv = document.querySelector("#seccion-proveedores .row.mb-3:first-of-type");
    if(rowProv && !document.getElementById("toggle-inactivos-prov")) {
        rowProv.insertAdjacentHTML('beforeend', `<div class="col-md-3 mt-2"><div class="form-check form-switch"><input class="form-check-input bg-danger" type="checkbox" id="toggle-inactivos-prov"><label class="form-check-label fw-bold text-muted small">Ver Eliminados</label></div></div>`);
        document.getElementById("toggle-inactivos-prov").addEventListener("change", (e) => { verInactivosProv = e.target.checked; filtrarProveedores(); });
    }
    cargarProveedores();
});

async function cargarProveedores() {
  const tabla = document.querySelector("#proveedores-table tbody"); tabla.innerHTML = "<tr><td colspan='6' class='text-center'>Cargando proveedores...</td></tr>";
  try { const respuesta = await fetch(`${API_URL_PROV}/proveedores`); if (!respuesta.ok) throw new Error(); proveedoresOriginal = await respuesta.json(); filtrarProveedores(); } catch (error) { tabla.innerHTML = "<tr><td colspan='6' class='text-center text-danger'>Error</td></tr>"; }
}

function filtrarProveedores() {
  const valor = document.getElementById("busqueda-proveedores").value.trim().toLowerCase();
  let filtrados = proveedoresOriginal.filter((p) => p.nombre.toLowerCase().includes(valor) || (p.telefono && p.telefono.includes(valor)));
  if (!verInactivosProv) filtrados = filtrados.filter(p => p.activo !== false && p.activo !== 0);
  renderizarProveedores(filtrados);
}

function renderizarProveedores(proveedores) {
  const tabla = document.querySelector("#proveedores-table tbody"); tabla.innerHTML = "";
  proveedores.forEach((p) => {
    const esInactivo = (p.activo === false || p.activo === 0);
    const rowStyle = esInactivo ? "opacity: 0.5; background-color: #f8f9fa;" : "";
    let celdaDeuda = p.deuda_total > 0 ? `<span class="text-danger fw-bold">C$ ${p.deuda_total}</span>` : `<span class="text-success fw-bold">C$ 0</span>`;
    let celdaEntrega = '<span class="text-muted small">Sin programar</span>'; let btnRecibido = '';

    if (p.entrega) {
        const partes = p.entrega.split('T')[0].split('-'); const fechaEntrega = new Date(partes[0], partes[1] - 1, partes[2]); const hoy = new Date(); hoy.setHours(0,0,0,0);
        if (fechaEntrega < hoy) celdaEntrega = `<span class="badge bg-danger text-wrap p-2 shadow-sm"><i class="bi bi-exclamation-triangle-fill"></i> Atrasado: ${fechaEntrega.toLocaleDateString()}</span>`;
        else if (fechaEntrega.getTime() === hoy.getTime()) celdaEntrega = `<span class="badge bg-warning text-dark text-wrap p-2 shadow-sm border border-warning"><i class="bi bi-truck"></i> ¡Llega Hoy!</span>`;
        else celdaEntrega = `<span class="badge bg-info text-dark text-wrap p-2"><i class="bi bi-calendar-event"></i> Pendiente: ${fechaEntrega.toLocaleDateString()}</span>`;
        if (!esInactivo) btnRecibido = `<button class="btn btn-sm btn-primary text-white me-1 shadow-sm" onclick="marcarEntregaRecibida(${p.id})" title="Marcar Recibido"><i class="bi bi-check-circle"></i></button>`;
    }
    let botonesAccion = esInactivo ? `<button class="btn btn-sm btn-success fw-bold" onclick="reactivarProveedor(${p.id})"><i class="bi bi-arrow-counterclockwise"></i> Restaurar</button>` : `${p.deuda_total > 0 ? `<button class="btn btn-sm btn-success text-white me-1" onclick="abrirModalAbono(${p.id}, '${p.nombre}', ${p.deuda_total})"><i class="bi bi-cash-coin"></i></button>` : `<button class="btn btn-sm btn-outline-secondary me-1" disabled><i class="bi bi-cash-coin"></i></button>`} ${btnRecibido} <button class="btn btn-sm btn-info text-white me-1" onclick="abrirEditarProveedor(${p.id})"><i class="bi bi-pencil"></i></button> <button class="btn btn-sm btn-danger" onclick="eliminarProveedor(${p.id})"><i class="bi bi-trash"></i></button>`;
    tabla.insertAdjacentHTML("beforeend", `<tr style="${rowStyle}"><td>${p.id}</td><td class="fw-bold">${p.nombre} ${esInactivo ? '<span class="badge bg-danger">Inactivo</span>' : ''}</td><td>${p.telefono || 'N/A'}</td><td class="bg-light border-start border-end text-center">${celdaDeuda}</td><td class="text-center align-middle">${celdaEntrega}</td><td>${botonesAccion}</td></tr>`);
  });
}

window.marcarEntregaRecibida = async function(id) { const prov = proveedoresOriginal.find(p => p.id === id); if(!prov) return; mostrarConfirmacion(`¿Confirmas que el proveedor entregó?`, async () => { try { const res = await fetch(`${API_URL_PROV}/proveedores/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: prov.nombre, telefono: prov.telefono, entrega: null }) }); if(!res.ok) throw new Error(); mostrarNotificacion("OK", "Fecha limpiada.", "success"); cargarProveedores(); } catch (error) {} }); };
window.reactivarProveedor = function(id) { mostrarConfirmacion("¿Activar?", async () => { try { await fetch(`${API_URL_PROV}/proveedores/${id}/reactivar`, { method: 'PUT' }); cargarProveedores(); } catch (error) {} }); };
window.eliminarProveedor = function(id) { mostrarConfirmacion("¿Dar de baja?", async () => { try { await fetch(`${API_URL_PROV}/proveedores/${id}`, { method: 'DELETE' }); cargarProveedores(); } catch (error) {} }); };
window.abrirModalAbono = function(id, nombre, deuda) { document.getElementById("abonar-id-prov").value = id; document.getElementById("lbl-nombre-abonar").innerText = nombre; document.getElementById("lbl-deuda-abonar").innerText = deuda; document.getElementById("monto-abono").max = deuda; document.getElementById("monto-abono").value = ""; new bootstrap.Modal(document.getElementById("modalAbonarProveedor")).show(); };
window.ejecutarAbono = async function(event) { event.preventDefault(); const id = document.getElementById("abonar-id-prov").value; const monto = parseInt(document.getElementById("monto-abono").value, 10); if(!id || isNaN(monto) || monto <= 0) return; try { const res = await fetch(`${API_URL_PROV}/proveedores/${id}/abonar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ monto_abono: monto }) }); bootstrap.Modal.getInstance(document.getElementById("modalAbonarProveedor")).hide(); cargarProveedores(); } catch (error) {} };
async function agregarProveedor(event) { event.preventDefault(); const nombre = document.getElementById("nombre-proveedor").value.trim(); const telefono = document.getElementById("telefono-proveedor").value.trim(); const entrega = document.getElementById("entrega-proveedor").value; try { await fetch(`${API_URL_PROV}/proveedores`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre, telefono, entrega }) }); bootstrap.Modal.getInstance(document.getElementById("modalAgregarProveedor")).hide(); cargarProveedores(); } catch (error) {} }
async function abrirEditarProveedor(id) { try { const respuesta = await fetch(`${API_URL_PROV}/proveedores/${id}`); const proveedor = await respuesta.json(); document.getElementById("edit-id-proveedor").value = proveedor.id; document.getElementById("edit-nombre-proveedor").value = proveedor.nombre; document.getElementById("edit-telefono-proveedor").value = proveedor.telefono || ""; document.getElementById("edit-entrega-proveedor").value = proveedor.entrega ? proveedor.entrega.split('T')[0] : ""; new bootstrap.Modal(document.getElementById("modalEditarProveedor")).show(); } catch (error) {} }
async function actualizarProveedor(event) { event.preventDefault(); const id = document.getElementById("edit-id-proveedor").value; const nombre = document.getElementById("edit-nombre-proveedor").value.trim(); const telefono = document.getElementById("edit-telefono-proveedor").value.trim(); const entrega = document.getElementById("edit-entrega-proveedor").value; try { await fetch(`${API_URL_PROV}/proveedores/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre, telefono, entrega }) }); bootstrap.Modal.getInstance(document.getElementById("modalEditarProveedor")).hide(); cargarProveedores(); } catch (error) {} }
document.getElementById("busqueda-proveedores").addEventListener("input", filtrarProveedores); document.getElementById("form-agregar-proveedor").addEventListener("submit", agregarProveedor); document.getElementById("form-editar-proveedor").addEventListener("submit", actualizarProveedor);