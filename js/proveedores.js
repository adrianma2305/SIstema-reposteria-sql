const API_URL_PROV = "https://sistema-pasteleria-sql.onrender.com/api";
let proveedoresOriginal = [];

async function cargarProveedores() {
  const tabla = document.querySelector("#proveedores-table tbody");
  tabla.innerHTML = "<tr><td colspan='6' class='text-center'>Cargando proveedores y cuentas por pagar...</td></tr>";
  try {
    const respuesta = await fetch(`${API_URL_PROV}/proveedores`);
    if (!respuesta.ok) throw new Error("Error de red");
    const proveedores = await respuesta.json();
    proveedoresOriginal = proveedores;
    renderizarProveedores(proveedores);
  } catch (error) {
    tabla.innerHTML = "<tr><td colspan='6' class='text-center text-danger'>Error al cargar los datos</td></tr>";
  }
}

function renderizarProveedores(proveedores) {
  const tabla = document.querySelector("#proveedores-table tbody");
  tabla.innerHTML = "";
  proveedores.forEach((p) => {
    let celdaDeuda = p.deuda_total > 0 
      ? `<span class="text-danger fw-bold">C$ ${p.deuda_total}</span>` 
      : `<span class="text-success fw-bold">C$ 0 (Solvente)</span>`;

    let btnAbonar = p.deuda_total > 0
      ? `<button class="btn btn-sm btn-success text-white me-1" onclick="abrirModalAbono(${p.id}, '${p.nombre}', ${p.deuda_total})" title="Abonar / Pagar Deuda"><i class="bi bi-cash-coin"></i></button>`
      : `<button class="btn btn-sm btn-outline-secondary me-1" disabled title="No hay deuda"><i class="bi bi-cash-coin"></i></button>`;

    let fechaEntrega = p.entrega ? new Date(p.entrega).toLocaleDateString() : 'N/A';

    const fila = `
      <tr>
        <td>${p.id}</td>
        <td class="fw-bold">${p.nombre}</td>
        <td>${p.telefono || 'N/A'}</td>
        <td class="bg-light border-start border-end text-center">${celdaDeuda}</td>
        <td>${fechaEntrega}</td>
        <td>
          ${btnAbonar}
          <button class="btn btn-sm btn-info text-white me-1" onclick="abrirEditarProveedor(${p.id})"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-danger" onclick="eliminarProveedor(${p.id})"><i class="bi bi-trash"></i></button>
        </td>
      </tr>
    `;
    tabla.insertAdjacentHTML("beforeend", fila);
  });
}

window.abrirModalAbono = function(id, nombre, deuda) {
  document.getElementById("abonar-id-prov").value = id;
  document.getElementById("lbl-nombre-abonar").innerText = nombre;
  document.getElementById("lbl-deuda-abonar").innerText = deuda;
  document.getElementById("monto-abono").max = deuda;
  document.getElementById("monto-abono").value = "";
  new bootstrap.Modal(document.getElementById("modalAbonarProveedor")).show();
};

window.ejecutarAbono = async function(event) {
  event.preventDefault();
  const id = document.getElementById("abonar-id-prov").value;
  const monto = parseInt(document.getElementById("monto-abono").value, 10);
  
  if(!id || isNaN(monto) || monto <= 0) return;

  try {
    const res = await fetch(`${API_URL_PROV}/proveedores/${id}/abonar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monto_abono: monto })
    });

    if(!res.ok) throw new Error("Error procesando pago");
    
    alert("💵 ¡Pago registrado exitosamente! La deuda del proveedor ha disminuido.");
    bootstrap.Modal.getInstance(document.getElementById("modalAbonarProveedor")).hide();
    cargarProveedores();
  } catch (error) {
    alert("Error de conexión al registrar el abono.");
  }
};

async function agregarProveedor(event) {
  event.preventDefault();
  const nombre = document.getElementById("nombre-proveedor").value.trim();
  const telefono = document.getElementById("telefono-proveedor").value.trim();
  const entrega = document.getElementById("entrega-proveedor").value;
  if (!nombre) return alert("El nombre es obligatorio.");
  try {
    await fetch(`${API_URL_PROV}/proveedores`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre, telefono, entrega }) });
    bootstrap.Modal.getInstance(document.getElementById("modalAgregarProveedor")).hide();
    document.getElementById("form-agregar-proveedor").reset();
    cargarProveedores();
  } catch (error) { alert("Error al guardar proveedor"); }
}

async function eliminarProveedor(id) {
  if (!confirm("¿Estás seguro de que quieres eliminar a este proveedor?")) return;
  try { await fetch(`${API_URL_PROV}/proveedores/${id}`, { method: 'DELETE' }); cargarProveedores(); } catch (error) { alert("Error al eliminar proveedor"); }
}

async function abrirEditarProveedor(id) {
  try {
    const respuesta = await fetch(`${API_URL_PROV}/proveedores/${id}`);
    const proveedor = await respuesta.json();
    document.getElementById("edit-id-proveedor").value = proveedor.id;
    document.getElementById("edit-nombre-proveedor").value = proveedor.nombre;
    document.getElementById("edit-telefono-proveedor").value = proveedor.telefono || "";
    document.getElementById("edit-entrega-proveedor").value = proveedor.entrega ? proveedor.entrega.split('T')[0] : "";
    new bootstrap.Modal(document.getElementById("modalEditarProveedor")).show();
  } catch (error) { alert("Error al cargar los datos del proveedor"); }
}

async function actualizarProveedor(event) {
  event.preventDefault();
  const id = document.getElementById("edit-id-proveedor").value;
  const nombre = document.getElementById("edit-nombre-proveedor").value.trim();
  const telefono = document.getElementById("edit-telefono-proveedor").value.trim();
  const entrega = document.getElementById("edit-entrega-proveedor").value;
  try {
    await fetch(`${API_URL_PROV}/proveedores/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre, telefono, entrega }) });
    bootstrap.Modal.getInstance(document.getElementById("modalEditarProveedor")).hide();
    cargarProveedores();
  } catch (error) { alert("Error al actualizar proveedor"); }
}

function filtrarProveedores() {
  const valor = document.getElementById("busqueda-proveedores").value.trim().toLowerCase();
  renderizarProveedores(proveedoresOriginal.filter((p) => p.nombre.toLowerCase().includes(valor) || (p.telefono && p.telefono.includes(valor))));
}

document.addEventListener("DOMContentLoaded", cargarProveedores);
document.getElementById("busqueda-proveedores").addEventListener("input", filtrarProveedores);
document.getElementById("form-agregar-proveedor").addEventListener("submit", agregarProveedor);
document.getElementById("form-editar-proveedor").addEventListener("submit", actualizarProveedor);