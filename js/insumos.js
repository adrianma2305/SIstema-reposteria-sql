const API_URL_INS = "https://kalel-tintometric-nonefficiently.ngrok-free.dev/api";
let insumosOriginal = [];
let proveedoresMap = {}; 

// --- CARGAR INSUMOS ---
async function cargarInsumos() {
  const tabla = document.querySelector("#insumos-table tbody");
  tabla.innerHTML = "<tr><td colspan='6'>Cargando...</td></tr>";
  
  try {
    const res = await fetch(`${API_URL_INS}/insumos`);
    if (!res.ok) throw new Error("Error de red");
    const insumos = await res.json();
    
    insumosOriginal = insumos;
    renderizarInsumos(insumos);
  } catch (error) {
    tabla.innerHTML = "<tr><td colspan='6'>Error al cargar los insumos.</td></tr>";
  }
}

// --- RENDERIZAR TABLA ---
function renderizarInsumos(insumos) {
  const tabla = document.querySelector("#insumos-table tbody");
  tabla.innerHTML = "";
  insumos.forEach((i) => {
    tabla.insertAdjacentHTML("beforeend", `
      <tr>
        <td>${i.id}</td>
        <td>${i.nombre}</td>
        <td>${i.unidad || ""}</td>
        <td>${i.precio !== null ? i.precio.toFixed(2) : ""}</td>
        <td>${i.proveedores?.nombre || ""}</td>
        <td>
          <button class="btn btn-sm btn-danger" onclick="eliminarInsumo(${i.id})" title="Eliminar"><i class="bi bi-trash"></i></button>
          <button class="btn btn-sm btn-info" onclick="abrirEditarInsumo(${i.id})" title="Editar"><i class="bi bi-pencil"></i></button>
        </td>
      </tr>
    `);
  });
}

// --- SELECT DE PROVEEDORES ---
async function cargarProveedoresSelect(selectId, seleccionado = null) {
  try {
    const res = await fetch(`${API_URL_INS}/proveedores`);
    if (!res.ok) throw new Error("Error cargando proveedores");
    const proveedores = await res.json();
    
    const select = document.getElementById(selectId);
    select.innerHTML = "<option value=''>Sin proveedor</option>";
    
    proveedores.forEach(p => {
      proveedoresMap[p.id] = p.nombre;
      const option = document.createElement("option");
      option.value = p.id;
      option.innerText = p.nombre;
      if (seleccionado && parseInt(seleccionado) === p.id) option.selected = true;
      select.appendChild(option);
    });
  } catch (error) {
    console.error("Error en select de proveedores", error);
  }
}

// --- AGREGAR INSUMO ---
async function agregarInsumo(event) {
  event.preventDefault();
  const nombre = document.getElementById("nombre-insumo").value.trim();
  const unidad = document.getElementById("unidad-insumo").value.trim();
  const precio = parseFloat(document.getElementById("precio-insumo").value) || null;
  const proveedor_id = document.getElementById("proveedor-insumo").value || null;

  if (!nombre) return mostrarNotificacion({ titulo: "Faltan datos", mensaje: "El nombre es obligatorio.", tipo: "warning" });

  try {
    const res = await fetch(`${API_URL_INS}/insumos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, unidad, precio, proveedor_id: proveedor_id ? parseInt(proveedor_id) : null })
    });

    if (!res.ok) throw new Error("Error al guardar");

    mostrarNotificacion({ titulo: "Insumo agregado", mensaje: "Insumo agregado correctamente.", tipo: "success" });
    bootstrap.Modal.getInstance(document.getElementById("modalAgregarInsumo")).hide();
    document.getElementById("form-agregar-insumo").reset();
    cargarInsumos();
  } catch (error) {
    mostrarNotificacion({ titulo: "Error", mensaje: "No se pudo agregar el insumo.", tipo: "error" });
  }
}

// --- ELIMINAR INSUMO ---
async function eliminarInsumo(id) {
  if (!confirm("¿Estás seguro que quieres eliminar este insumo?")) return;
  
  try {
    const res = await fetch(`${API_URL_INS}/insumos/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error("Error al eliminar");

    mostrarNotificacion({ titulo: "Eliminado", mensaje: "Insumo eliminado correctamente.", tipo: "success" });
    cargarInsumos();
  } catch (error) {
    mostrarNotificacion({ titulo: "Error", mensaje: "No se pudo eliminar el insumo.", tipo: "error" });
  }
}

// --- ABRIR MODAL EDICIÓN ---
async function abrirEditarInsumo(id) {
  try {
    const res = await fetch(`${API_URL_INS}/insumos/${id}`);
    if (!res.ok) throw new Error("Error al cargar insumo");
    const data = await res.json();

    await cargarProveedoresSelect("edit-proveedor-insumo", data.proveedor_id);
    
    document.getElementById("edit-id-insumo").value = data.id;
    document.getElementById("edit-nombre-insumo").value = data.nombre;
    document.getElementById("edit-unidad-insumo").value = data.unidad || "";
    document.getElementById("edit-precio-insumo").value = data.precio !== null ? data.precio : "";
    
    const modal = new bootstrap.Modal(document.getElementById("modalEditarInsumo"));
    modal.show();
  } catch (error) {
    mostrarNotificacion({ titulo: "Error", mensaje: "No se pudo cargar el insumo.", tipo: "error" });
  }
}

// --- ACTUALIZAR INSUMO ---
async function actualizarInsumo(event) {
  event.preventDefault();
  const id = document.getElementById("edit-id-insumo").value;
  const nombre = document.getElementById("edit-nombre-insumo").value.trim();
  const unidad = document.getElementById("edit-unidad-insumo").value.trim();
  const precio = parseFloat(document.getElementById("edit-precio-insumo").value) || null;
  const proveedor_id = document.getElementById("edit-proveedor-insumo").value || null;

  try {
    const res = await fetch(`${API_URL_INS}/insumos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, unidad, precio, proveedor_id: proveedor_id ? parseInt(proveedor_id) : null })
    });

    if (!res.ok) throw new Error("Error al actualizar");

    mostrarNotificacion({ titulo: "Actualizado", mensaje: "Insumo actualizado correctamente.", tipo: "success" });
    bootstrap.Modal.getInstance(document.getElementById("modalEditarInsumo")).hide();
    cargarInsumos();
  } catch (error) {
    mostrarNotificacion({ titulo: "Error", mensaje: "No se pudo actualizar el insumo.", tipo: "error" });
  }
}

// --- BUSCADOR Y EVENTOS ---
function filtrarInsumos() {
  const valor = document.getElementById("busqueda-insumos").value.trim().toLowerCase();
  const filtrados = insumosOriginal.filter((i) => i.nombre.toLowerCase().includes(valor));
  renderizarInsumos(filtrados);
}

document.getElementById("busqueda-insumos").addEventListener("input", filtrarInsumos);
document.getElementById("form-agregar-insumo").addEventListener("submit", agregarInsumo);
document.getElementById("form-editar-insumo").addEventListener("submit", actualizarInsumo);
document.getElementById("modalAgregarInsumo").addEventListener("show.bs.modal", () => cargarProveedoresSelect("proveedor-insumo"));