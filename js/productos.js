const API_URL = "https://sistema-pasteleria-sql.onrender.com";
let productosOriginal = [];

// --- CARGAR PRODUCTOS ---
async function cargarProductos() {
  const tabla = document.querySelector("#productos-table tbody");
  tabla.innerHTML = "<tr><td colspan='5'>Cargando...</td></tr>";
  
  try {
    const respuesta = await fetch(`${API_URL}/productos`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    if (!respuesta.ok) throw new Error("Error al cargar productos");
    const productos = await respuesta.json();
    
    productosOriginal = productos;
    renderizarProductos(productos);
    cargarSelectsInsumosProducto();
    cargarSelectsCategorias();
  } catch (error) {
    console.error(error);
    tabla.innerHTML = "<tr><td colspan='5'>Error al cargar desde SQL Server. Asegúrate de que el servidor esté corriendo.</td></tr>";
  }
}

// --- RENDERIZAR LA TABLA ---
function renderizarProductos(productos) {
  const tabla = document.querySelector("#productos-table tbody");
  tabla.innerHTML = "";
  
  const isAdmin = (typeof esAdmin === 'function') ? esAdmin() : false;

  productos.forEach((p) => {
    const nombreInsumo = p.insumo ? `<span class="badge bg-secondary">${p.insumo.nombre}</span>` : "-";
    const nombreCategoria = p.categoria ? `<span class="badge bg-primary">${p.categoria.nombre}</span>` : `<span class="badge bg-light text-dark">Sin categoría</span>`;

    const botonesAccion = isAdmin ? `
      <button class="btn btn-sm btn-danger" onclick="eliminarProducto(${p.id})" title="Eliminar"><i class="bi bi-trash"></i></button>
      <button class="btn btn-sm btn-info" onclick="abrirEditarProducto(${p.id})" title="Editar"><i class="bi bi-pencil"></i></button>
    ` : `<span class="badge bg-secondary">Sin permisos</span>`;

    const fila = `
      <tr>
        <td>${p.id}</td>
        <td>
          <div class="fw-bold">${p.nombre}</div>
          <small class="text-muted">Base: ${nombreInsumo}</small>
        </td>
        <td>${nombreCategoria}</td>
        <td>C$ ${p.precio.toFixed(2)}</td>
        <td>${botonesAccion}</td>
      </tr>
    `;
    tabla.insertAdjacentHTML("beforeend", fila);
  });
}

// --- CARGAR SELECTS DE CATEGORIAS ---
async function cargarSelectsCategorias() {
  try {
    const respuesta = await fetch(`${API_URL}/categorias`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    if (!respuesta.ok) throw new Error("Error al cargar categorías");
    const categorias = await respuesta.json();

    const selectFiltro = document.getElementById("filtro-categoria");
    const selectAgregar = document.getElementById("categoria-principal");
    const selectEditar = document.getElementById("edit-categoria-principal");

    let htmlFiltro = '<option value="">Todas las categorías</option>';
    let htmlModal = '<option value="">Seleccione una categoría...</option>';
    
    categorias.forEach(c => {
      htmlFiltro += `<option value="${c.id}">${c.nombre}</option>`;
      htmlModal += `<option value="${c.id}">${c.nombre}</option>`;
    });

    if (selectFiltro) selectFiltro.innerHTML = htmlFiltro;
    if (selectAgregar) selectAgregar.innerHTML = htmlModal;
    if (selectEditar) selectEditar.innerHTML = htmlModal;
  } catch (error) {
    console.error("Error cargando categorías:", error);
  }
}

// --- AGREGAR PRODUCTO ---
async function agregarProducto(event) {
  event.preventDefault();

  if (!esAdmin()) {
    mostrarNotificacion({titulo: "Acceso denegado", mensaje: "Solo los administradores pueden agregar productos.", tipo: "error"});
    return;
  }
  
  const nombre = document.getElementById("nombre").value.trim();
  const precio = parseFloat(document.getElementById("precio").value);
  
  const insumoVal = document.getElementById("insumo-principal").value;
  const insumo_id = insumoVal ? parseInt(insumoVal) : null;

  const categoriaVal = document.getElementById("categoria-principal").value;
  const categoria_id = categoriaVal ? parseInt(categoriaVal) : null;

  if (!nombre || isNaN(precio)) return;
  
  try {
    const respuesta = await fetch(`${API_URL}/productos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      body: JSON.stringify({ nombre, precio, insumo_id, categoria_id }) 
    });

    if (!respuesta.ok) throw new Error("Error al guardar");

    mostrarNotificacion({titulo: "Éxito", mensaje: "Producto agregado", tipo: "success"});
    document.getElementById("form-agregar").reset();
    bootstrap.Modal.getInstance(document.getElementById("modalAgregar")).hide();
    cargarProductos();
  } catch (error) {
    mostrarNotificacion({titulo: "Error", mensaje: "Error al guardar", tipo: "error"});
  }
}

// --- ELIMINAR PRODUCTO ---
async function eliminarProducto(id) {
  if (!esAdmin()) {
    alert("Acceso denegado: Solo los administradores pueden eliminar.");
    return;
  }

  if (!confirm("¿Estás seguro que quieres eliminar este producto?")) return;
  
  try {
    const respuesta = await fetch(`${API_URL}/productos/${id}`, { 
        method: 'DELETE',
        headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    if (!respuesta.ok) throw new Error("No se pudo eliminar");

    mostrarNotificacion({titulo: "Eliminado", mensaje: "Producto eliminado correctamente.", tipo: "success"});
    cargarProductos();
  } catch (error) {
    mostrarNotificacion({titulo: "Error", mensaje: "No se pudo eliminar el producto.", tipo: "error"});
  }
}

// --- CARGAR SELECTS DE INSUMOS ---
async function cargarSelectsInsumosProducto() {
  try {
    const respuesta = await fetch(`${API_URL}/insumos`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    if (!respuesta.ok) throw new Error("Error al cargar insumos");
    const insumos = await respuesta.json();

    const selectAgregar = document.getElementById("insumo-principal");
    const selectEditar = document.getElementById("edit-insumo-principal");

    let html = '<option value="">Ninguno / No aplica</option>';
    insumos.forEach(i => {
      html += `<option value="${i.id}">${i.nombre}</option>`;
    });

    if (selectAgregar) selectAgregar.innerHTML = html;
    if (selectEditar) selectEditar.innerHTML = html;
  } catch (error) {
    console.error("Error cargando selects:", error);
  }
}

// --- ABRIR MODAL DE EDICIÓN ---
async function abrirEditarProducto(id) {
  try {
    const respuesta = await fetch(`${API_URL}/productos/${id}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    if (!respuesta.ok) throw new Error("Error al obtener producto");
    const data = await respuesta.json();

    document.getElementById("edit-id").value = data.id;
    document.getElementById("edit-nombre").value = data.nombre;
    document.getElementById("edit-precio").value = data.precio;
    document.getElementById("edit-insumo-principal").value = data.insumo_id || "";
    document.getElementById("edit-categoria-principal").value = data.categoria_id || ""; 
    
    const modal = new bootstrap.Modal(document.getElementById("modalEditar"));
    modal.show();
  } catch (error) {
    console.error("Error abriendo edición:", error);
  }
}

// --- ACTUALIZAR PRODUCTO ---
async function actualizarProducto(event) {
  event.preventDefault();
  const id = document.getElementById("edit-id").value;
  const nombre = document.getElementById("edit-nombre").value.trim();
  const precio = parseFloat(document.getElementById("edit-precio").value);
  
  const insumoVal = document.getElementById("edit-insumo-principal").value;
  const insumo_id = insumoVal ? parseInt(insumoVal) : null;

  const categoriaVal = document.getElementById("edit-categoria-principal").value;
  const categoria_id = categoriaVal ? parseInt(categoriaVal) : null;

  try {
    const respuesta = await fetch(`${API_URL}/productos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      body: JSON.stringify({ nombre, precio, insumo_id, categoria_id }) 
    });

    if (!respuesta.ok) throw new Error("No se pudo actualizar");

    mostrarNotificacion({titulo: "Actualizado", mensaje: "Producto actualizado", tipo: "success"});
    bootstrap.Modal.getInstance(document.getElementById("modalEditar")).hide();
    cargarProductos();
  } catch (error) {
    mostrarNotificacion({titulo: "Error", mensaje: "No se pudo actualizar", tipo: "error"});
  }
}

// --- EVENT LISTENERS Y BÚSQUEDA ---
document.addEventListener("DOMContentLoaded", cargarProductos);

document.getElementById("busqueda-productos").addEventListener("input", filtrarProductos);
document.getElementById("busqueda-precio").addEventListener("input", filtrarProductos);
document.getElementById("filtro-categoria").addEventListener("change", filtrarProductos);

function filtrarProductos() {
  const valor = document.getElementById("busqueda-productos").value.trim().toLowerCase();
  const precioBuscado = document.getElementById("busqueda-precio").value;
  const categoriaBuscada = document.getElementById("filtro-categoria").value;
  
  let filtrados = productosOriginal.filter((p) =>
    p.nombre.toLowerCase().includes(valor)
  );
  
  if (precioBuscado !== "") {
    filtrados = filtrados.filter((p) => p.precio == parseFloat(precioBuscado));
  }

  if (categoriaBuscada !== "") {
    filtrados = filtrados.filter((p) => p.categoria_id == parseInt(categoriaBuscada));
  }
  
  renderizarProductos(filtrados);
}

document.getElementById("form-agregar").addEventListener("submit", agregarProducto);
document.getElementById("form-editar").addEventListener("submit", actualizarProducto);