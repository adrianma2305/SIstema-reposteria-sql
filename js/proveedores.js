const API_URL_PROV = "https://kalel-tintometric-nonefficiently.ngrok-free.dev/api";
let proveedoresOriginal = [];

// --- CARGAR PROVEEDORES ---
async function cargarProveedores() {
  const tabla = document.querySelector("#proveedores-table tbody");
  tabla.innerHTML = "<tr><td colspan='5'>Cargando...</td></tr>";
  
  try {
    const res = await fetch(`${API_URL_PROV}/proveedores`, {
        headers: {
            'ngrok-skip-browser-warning': 'true'
        }
    });
    if (!res.ok) throw new Error("Error de red");
    const proveedores = await res.json();
    
    proveedoresOriginal = proveedores;
    renderizarProveedores(proveedores);
  } catch (error) {
    tabla.innerHTML = "<tr><td colspan='5'>Error al cargar los proveedores.</td></tr>";
  }
}

// --- RENDERIZAR TABLA ---
function renderizarProveedores(proveedores) {
  const tabla = document.querySelector("#proveedores-table tbody");
  tabla.innerHTML = "";

  const fecha = new Date();
  const hoyStr = fecha.toISOString().split('T')[0];

  proveedores.forEach((p) => {
    let claseFila = "";
    let titulo = "";
    let textoFechaClass = "";
    
    // Formatear la fecha que viene de SQL Server
    let fechaFormat = "";
    let fechaMostrar = "";
    if (p.entrega) {
        fechaFormat = p.entrega.split('T')[0];
        fechaMostrar = new Date(fechaFormat + 'T12:00:00').toLocaleDateString();
        
        if (fechaFormat <= hoyStr) {
            claseFila = "table-warning";
            textoFechaClass = "fw-bold text-danger";
            titulo = 'title="⚠ La fecha de entrega ya pasó o es hoy"';
        }
    }

    // Botones siempre visibles
    const botonesAccion = `
      <button class="btn btn-sm btn-danger" onclick="eliminarProveedor(${p.id})" title="Eliminar"><i class="bi bi-trash"></i></button>
      <button class="btn btn-sm btn-info" onclick="abrirEditarProveedor(${p.id})" title="Editar"><i class="bi bi-pencil"></i></button>
    `;

    tabla.insertAdjacentHTML("beforeend", `
      <tr class="${claseFila}" ${titulo}>
        <td>${p.id}</td>
        <td>${p.nombre}</td>
        <td>${p.telefono || ""}</td>
        <td class="${textoFechaClass}">${fechaMostrar}</td>
        <td>${botonesAccion}</td>
      </tr>
    `);
  });
}

// --- AGREGAR PROVEEDOR ---
async function agregarProveedor(event) {
  event.preventDefault();
  const nombre = document.getElementById("nombre-proveedor").value.trim();
  const telefono = document.getElementById("telefono-proveedor").value.trim();
  const entrega = document.getElementById("entrega-proveedor").value || null;

  if (!nombre) return mostrarNotificacion({ titulo: "Faltan datos", mensaje: "El nombre es obligatorio.", tipo: "warning" });

  try {
    const res = await fetch(`${API_URL_PROV}/proveedores`, {
      method: 'POST',
      headers: { 
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
      },
      body: JSON.stringify({ nombre, telefono, entrega })
    });

    if (!res.ok) throw new Error("Error al guardar");

    mostrarNotificacion({ titulo: "Proveedor agregado", mensaje: "Proveedor agregado correctamente.", tipo: "success" });
    bootstrap.Modal.getInstance(document.getElementById("modalAgregarProveedor")).hide();
    document.getElementById("form-agregar-proveedor").reset();
    cargarProveedores();
  } catch (error) {
    mostrarNotificacion({ titulo: "Error", mensaje: "No se pudo agregar el proveedor.", tipo: "error" });
  }
}

// --- ELIMINAR PROVEEDOR ---
async function eliminarProveedor(id) {
  if (!confirm("¿Estás seguro que quieres eliminar este proveedor?")) return;
  
  try {
    const res = await fetch(`${API_URL_PROV}/proveedores/${id}`, { 
        method: 'DELETE',
        headers: {
            'ngrok-skip-browser-warning': 'true'
        }
    });
    if (!res.ok) throw new Error("Error al eliminar");

    mostrarNotificacion({ titulo: "Eliminado", mensaje: "Proveedor eliminado correctamente.", tipo: "success" });
    cargarProveedores();
  } catch (error) {
    mostrarNotificacion({ titulo: "Error", mensaje: "No se pudo eliminar el proveedor.", tipo: "error" });
  }
}

// --- ABRIR MODAL EDICIÓN ---
async function abrirEditarProveedor(id) {
  try {
    const res = await fetch(`${API_URL_PROV}/proveedores/${id}`, {
        headers: {
            'ngrok-skip-browser-warning': 'true'
        }
    });
    if (!res.ok) throw new Error("Error al cargar");
    const data = await res.json();

    document.getElementById("edit-id-proveedor").value = data.id;
    document.getElementById("edit-nombre-proveedor").value = data.nombre;
    document.getElementById("edit-telefono-proveedor").value = data.telefono || "";
    document.getElementById("edit-entrega-proveedor").value = data.entrega ? data.entrega.split('T')[0] : "";

    const modal = new bootstrap.Modal(document.getElementById("modalEditarProveedor"));
    modal.show();
  } catch (error) {
    mostrarNotificacion({ titulo: "Error", mensaje: "No se pudo cargar el proveedor.", tipo: "error" });
  }
}

// --- ACTUALIZAR PROVEEDOR ---
async function actualizarProveedor(event) {
  event.preventDefault();
  const id = parseInt(document.getElementById("edit-id-proveedor").value);
  const nombre = document.getElementById("edit-nombre-proveedor").value.trim();
  const telefono = document.getElementById("edit-telefono-proveedor").value.trim();
  const entrega = document.getElementById("edit-entrega-proveedor").value || null;

  if (!nombre) return mostrarNotificacion({titulo: "Error", mensaje: "El nombre no puede estar vacío", tipo: "warning"});

  try {
    const res = await fetch(`${API_URL_PROV}/proveedores/${id}`, {
      method: 'PUT',
      headers: { 
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
      },
      body: JSON.stringify({ nombre, telefono, entrega })
    });

    if (!res.ok) throw new Error("Error al actualizar");

    mostrarNotificacion({ titulo: "Actualizado", mensaje: "Proveedor actualizado correctamente.", tipo: "success" });
    bootstrap.Modal.getInstance(document.getElementById("modalEditarProveedor")).hide();
    cargarProveedores();
  } catch (error) {
    mostrarNotificacion({ titulo: "Error", mensaje: "No se pudo actualizar el proveedor.", tipo: "error" });
  }
}

// --- BUSCADOR Y EVENTOS ---
function filtrarProveedores() {
  const valor = document.getElementById("busqueda-proveedores").value.trim().toLowerCase();
  const filtrados = proveedoresOriginal.filter((p) => p.nombre.toLowerCase().includes(valor));
  renderizarProveedores(filtrados);
}

document.addEventListener("DOMContentLoaded", () => {
  const formAgregar = document.getElementById("form-agregar-proveedor");
  if (formAgregar) formAgregar.addEventListener("submit", agregarProveedor);

  const formEditar = document.getElementById("form-editar-proveedor");
  if (formEditar) formEditar.addEventListener("submit", actualizarProveedor);

  const busqueda = document.getElementById("busqueda-proveedores");
  if (busqueda) busqueda.addEventListener("input", filtrarProveedores);
});