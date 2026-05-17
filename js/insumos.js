const API_URL_INS = "https://sistema-pasteleria-sql.onrender.com/api";
let insumosOriginal = [];
let proveedoresMap = {}; 

async function cargarInsumos() {
  const tabla = document.querySelector("#insumos-table tbody");
  tabla.innerHTML = "<tr><td colspan='6' class='text-center'>Calculando inventario en la nube...</td></tr>";
  try {
    const res = await fetch(`${API_URL_INS}/insumos`);
    if (!res.ok) throw new Error();
    const insumos = await res.json();
    insumosOriginal = insumos;
    renderizarInsumos(insumos);
    llenarSelectCalculadora(insumos);
  } catch (error) { tabla.innerHTML = "<tr><td colspan='6' class='text-center text-danger'>Error al cargar bodega.</td></tr>"; }
}

function renderizarInsumos(insumos) {
  const tabla = document.querySelector("#insumos-table tbody");
  tabla.innerHTML = "";
  insumos.forEach((i) => {
    let colorStock = i.stock_actual <= 5 ? "text-danger" : "text-success";
    let iconoAlerta = i.stock_actual <= 5 ? '<i class="bi bi-exclamation-triangle-fill ms-1" title="¡Stock Crítico!"></i>' : '';

    tabla.insertAdjacentHTML("beforeend", `
      <tr>
        <td>${i.id}</td>
        <td class="fw-bold">${i.nombre} <br><small class="text-muted">${i.unidad || "Unidad"}</small></td>
        <td class="text-center bg-light fs-5 fw-bold ${colorStock} border-start border-end">${i.stock_actual.toFixed(2)} ${iconoAlerta}</td>
        <td class="text-primary fw-bold">C$ ${i.precio !== null ? i.precio : ""}</td>
        <td><span class="badge bg-secondary">${i.proveedores?.nombre || "Sin proveedor"}</span></td>
        <td class="text-center">
          <button class="btn btn-sm btn-dark me-1" onclick="abrirKardex(${i.id}, '${i.nombre}')" title="Ver Historial (Kardex)"><i class="bi bi-clock-history"></i></button>
          <button class="btn btn-sm btn-info text-white me-1" onclick="abrirEditarInsumo(${i.id})" title="Editar Info"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-danger" onclick="eliminarInsumo(${i.id})" title="Borrar"><i class="bi bi-trash"></i></button>
        </td>
      </tr>
    `);
  });
}

async function abrirKardex(id, nombre) {
  document.getElementById("kardex-titulo").innerHTML = `<i class="bi bi-box-seam"></i> Historial Kardex: ${nombre}`;
  const tbody = document.getElementById("kardex-body");
  tbody.innerHTML = "<tr><td colspan='5' class='text-center'>Buscando rastros...</td></tr>";
  new bootstrap.Modal(document.getElementById("modalKardex")).show();

  try {
    const res = await fetch(`${API_URL_INS}/kardex/${id}`);
    const movimientos = await res.json();
    tbody.innerHTML = "";
    if(movimientos.length === 0) {
      tbody.innerHTML = "<tr><td colspan='5' class='text-center text-muted'>Bodega vacía. No hay ingresos ni gastos.</td></tr>";
      return;
    }
    movimientos.forEach(m => {
      let badgeMov = m.tipo_movimiento === 'ENTRADA' ? '<span class="badge bg-success">ENTRADA</span>' : '<span class="badge bg-danger">SALIDA</span>';
      let signo = m.tipo_movimiento === 'ENTRADA' ? '+' : '-';
      tbody.insertAdjacentHTML("beforeend", `
        <tr>
          <td class="small">${new Date(m.fecha).toLocaleString()}</td>
          <td>${badgeMov}</td>
          <td class="text-center fw-bold ${m.tipo_movimiento === 'ENTRADA' ? 'text-success' : 'text-danger'}">${signo}${parseFloat(m.cantidad).toFixed(3)}</td>
          <td class="small text-muted">${m.motivo}</td>
          <td class="small"><i class="bi bi-person"></i> ${m.usuario}</td>
        </tr>
      `);
    });
  } catch (error) { tbody.innerHTML = "<tr><td colspan='5' class='text-center text-danger'>Error al conectar con Azure.</td></tr>"; }
}

async function abrirModalCompraRapida() {
  await cargarProveedoresSelect("compra-proveedor");
  const selInsumo = document.getElementById("compra-insumo");
  selInsumo.innerHTML = "<option value='' disabled selected>Selecciona lo que compraste...</option>";
  insumosOriginal.forEach(i => { selInsumo.innerHTML += `<option value="${i.id}">${i.nombre} (${i.unidad})</option>`; });
  new bootstrap.Modal(document.getElementById("modalCompraRapida")).show();
}

window.registrarCompra = async function(event) {
  event.preventDefault();
  const proveedor_id = parseInt(document.getElementById("compra-proveedor").value);
  const insumo_id = parseInt(document.getElementById("compra-insumo").value);
  const cantidad = parseFloat(document.getElementById("compra-cantidad").value);
  const costo_total = parseInt(document.getElementById("compra-total").value);
  const empleado_id = localStorage.getItem("usuario_id") ? parseInt(localStorage.getItem("usuario_id")) : null;
  const tipo_pago = document.querySelector('input[name="tipoPago"]:checked').value;

  if(!proveedor_id || !insumo_id || isNaN(cantidad) || cantidad <= 0 || isNaN(costo_total)) return alert("Campos numéricos deben ser mayores a cero.");

  try {
    const res = await fetch(`${API_URL_INS}/compras/rapida`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proveedor_id, insumo_id, cantidad, costo_total, empleado_id, tipo_pago })
    });
    if(!res.ok) throw new Error("Error en la transacción");
    let msj = tipo_pago === 'CONTADO' ? "🚚 Mercadería ingresada al contado. Stock actualizado sin crear deuda." : "🚚 Mercadería ingresada al crédito. Se guardó la cuenta por pagar.";
    alert(msj);
    document.getElementById("form-compra-rapida").reset();
    bootstrap.Modal.getInstance(document.getElementById("modalCompraRapida")).hide();
    cargarInsumos();
  } catch (error) { alert("Hubo un error de conexión con la nube."); }
};

async function cargarProveedoresSelect(selectId, seleccionado = null) {
  try {
    const res = await fetch(`${API_URL_INS}/proveedores`);
    const proveedores = await res.json();
    const select = document.getElementById(selectId);
    select.innerHTML = "<option value=''>Sin proveedor</option>";
    proveedores.forEach(p => {
      proveedoresMap[p.id] = p.nombre;
      const option = document.createElement("option");
      option.value = p.id; option.innerText = p.nombre;
      if (seleccionado && parseInt(seleccionado) === p.id) option.selected = true;
      select.appendChild(option);
    });
  } catch (error) {}
}

async function agregarInsumo(event) {
  event.preventDefault();
  const nombre = document.getElementById("nombre-insumo").value.trim();
  const unidad = document.getElementById("unidad-insumo").value.trim();
  const precio = parseInt(document.getElementById("precio-insumo").value, 10);
  const proveedor_id = document.getElementById("proveedor-insumo").value || null;
  if (!nombre || !unidad || isNaN(precio) || precio <= 0) return alert("Datos inválidos");
  try {
    await fetch(`${API_URL_INS}/insumos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre, unidad, precio, proveedor_id: proveedor_id ? parseInt(proveedor_id) : null }) });
    bootstrap.Modal.getInstance(document.getElementById("modalAgregarInsumo")).hide();
    document.getElementById("form-agregar-insumo").reset();
    cargarInsumos();
  } catch (error) {}
}

async function eliminarInsumo(id) {
  if (!confirm("¿Estás seguro que quieres eliminar este insumo?")) return;
  try { await fetch(`${API_URL_INS}/insumos/${id}`, { method: 'DELETE' }); cargarInsumos(); } catch (error) {}
}

async function abrirEditarInsumo(id) {
  try {
    const res = await fetch(`${API_URL_INS}/insumos/${id}`);
    const data = await res.json();
    await cargarProveedoresSelect("edit-proveedor-insumo", data.proveedor_id);
    document.getElementById("edit-id-insumo").value = data.id;
    document.getElementById("edit-nombre-insumo").value = data.nombre;
    document.getElementById("edit-unidad-insumo").value = data.unidad || "";
    document.getElementById("edit-precio-insumo").value = data.precio !== null ? data.precio : "";
    new bootstrap.Modal(document.getElementById("modalEditarInsumo")).show();
  } catch (error) {}
}

async function actualizarInsumo(event) {
  event.preventDefault();
  const id = document.getElementById("edit-id-insumo").value;
  const nombre = document.getElementById("edit-nombre-insumo").value.trim();
  const unidad = document.getElementById("edit-unidad-insumo").value.trim();
  const precio = parseInt(document.getElementById("edit-precio-insumo").value, 10);
  const proveedor_id = document.getElementById("edit-proveedor-insumo").value || null;
  try {
    await fetch(`${API_URL_INS}/insumos/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre, unidad, precio, proveedor_id: proveedor_id ? parseInt(proveedor_id) : null }) });
    bootstrap.Modal.getInstance(document.getElementById("modalEditarInsumo")).hide();
    cargarInsumos();
  } catch (error) {}
}

window.abrirCalculadora = function() { new bootstrap.Modal(document.getElementById("modalCalculadora")).show(); }

function llenarSelectCalculadora(insumos) {
  const select = document.getElementById("calc-insumo");
  select.innerHTML = '<option value="">Selecciona qué insumo usarás...</option>';
  insumos.forEach(i => { select.innerHTML += `<option value="${i.id}" data-precio="${i.precio}" data-unidad="${i.unidad}">${i.nombre} (Costo: C$ ${i.precio})</option>`; });
}

function calcularReceta() {
  const select = document.getElementById("calc-insumo");
  const rendimiento = parseInt(document.getElementById("calc-rendimiento").value);
  const meta = parseInt(document.getElementById("calc-meta").value);
  const divRes = document.getElementById("calc-resultado");

  if (!select.value || isNaN(rendimiento) || isNaN(meta) || rendimiento <= 0 || meta <= 0) {
    divRes.innerHTML = `<h6 class="text-muted">Llena los datos correctamente para ver el cálculo</h6>`;
    return;
  }
  const optionSel = select.options[select.selectedIndex];
  const precioSaco = parseFloat(optionSel.dataset.precio);
  const unidad = optionSel.dataset.unidad;
  const insumosNecesarios = meta / rendimiento;
  const costoTotalProduccion = insumosNecesarios * precioSaco;
  const costoUnidad = costoTotalProduccion / meta;

  divRes.innerHTML = `
    <h5 class="fw-bold text-dark">Para fabricar ${meta} unidades necesitas:</h5>
    <h3 class="text-warning fw-bold">${insumosNecesarios.toFixed(2)} x [${unidad}]</h3>
    <hr>
    <div class="row text-start mt-2">
      <div class="col-6"><strong>Inversión en Insumo:</strong></div>
      <div class="col-6 text-end text-danger fw-bold">C$ ${Math.ceil(costoTotalProduccion)}</div>
      <div class="col-6"><strong>Costo por 1 unidad:</strong></div>
      <div class="col-6 text-end text-muted">C$ ${costoUnidad.toFixed(2)}</div>
    </div>
  `;
}

document.getElementById("busqueda-insumos").addEventListener("input", function() {
  const valor = this.value.trim().toLowerCase();
  renderizarInsumos(insumosOriginal.filter((i) => i.nombre.toLowerCase().includes(valor)));
});

document.getElementById("form-agregar-insumo").addEventListener("submit", agregarInsumo);
document.getElementById("form-editar-insumo").addEventListener("submit", actualizarInsumo);
document.getElementById("modalAgregarInsumo").addEventListener("show.bs.modal", () => cargarProveedoresSelect("proveedor-insumo"));
document.addEventListener("DOMContentLoaded", cargarInsumos);
document.getElementById("calc-insumo").addEventListener("change", calcularReceta);
document.getElementById("calc-rendimiento").addEventListener("input", calcularReceta);
document.getElementById("calc-meta").addEventListener("input", calcularReceta);