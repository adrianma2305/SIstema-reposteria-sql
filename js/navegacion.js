// --- FUNCIONES GLOBALES ELEGANTES PARA NOTIFICACIONES ---
window.mostrarNotificacion = function(titulo, mensaje, tipo = 'info') {
  const modalEl = document.getElementById("modalNotificacion");
  if (!modalEl) return alert(titulo + ": " + mensaje);

  const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
  const icon = document.getElementById("notif-icon");
  const titleEl = document.getElementById("notif-title");
  const textEl = document.getElementById("notif-text");

  titleEl.innerText = titulo;
  textEl.innerText = mensaje;

  if (tipo === 'success') { icon.innerHTML = '<i class="bi bi-check-circle-fill text-success"></i>'; } 
  else if (tipo === 'error') { icon.innerHTML = '<i class="bi bi-x-circle-fill text-danger"></i>'; } 
  else if (tipo === 'warning') { icon.innerHTML = '<i class="bi bi-exclamation-triangle-fill text-warning"></i>'; } 
  else { icon.innerHTML = '<i class="bi bi-info-circle-fill text-primary"></i>'; }
  modal.show();
};

window.mostrarConfirmacion = function(mensaje, callback) {
  const modalEl = document.getElementById("modalConfirmacion");
  if (!modalEl) { if(confirm(mensaje)) callback(); return; }

  document.getElementById("confirm-text").innerText = mensaje;
  const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
  
  const btnConfirmar = document.getElementById("btn-confirmar-accion");
  const newBtn = btnConfirmar.cloneNode(true);
  btnConfirmar.parentNode.replaceChild(newBtn, btnConfirmar); // <--- AQUI ESTABA EL ERROR MORTAL
  
  newBtn.addEventListener('click', () => {
    modal.hide();
    callback();
  });
  
  modal.show();
};

document.addEventListener("DOMContentLoaded", () => {
  const botonesNav = {
    inicio: document.getElementById("btn-ir-inicio"),
    ventas: document.getElementById("btn-ir-ventas"),
    productos: document.getElementById("btn-ir-productos"),
    proveedores: document.getElementById("btn-ir-proveedores"),
    usuarios: document.getElementById("btn-ir-usuarios")
  };

  const secciones = {
    inicio: document.getElementById("seccion-dashboard"),
    ventas: document.getElementById("seccion-ventas"),
    productos: document.getElementById("seccion-productos"),
    proveedores: document.getElementById("seccion-proveedores"),
    usuarios: document.getElementById("seccion-usuarios")
  };

  function ocultarTodasLasSecciones() {
    Object.values(secciones).forEach(seccion => { if (seccion) seccion.style.display = "none"; });
    document.querySelectorAll(".nav-links li a").forEach(a => a.classList.remove("active"));
  }

  if (botonesNav.inicio) {
    botonesNav.inicio.addEventListener("click", async (e) => {
      e.preventDefault(); ocultarTodasLasSecciones();
      if (secciones.inicio) secciones.inicio.style.display = "block";
      botonesNav.inicio.classList.add("active");
      if (typeof cargarDashboard === 'function') cargarDashboard();
    });
  }

  if (botonesNav.ventas) {
    botonesNav.ventas.addEventListener("click", (e) => {
      e.preventDefault(); ocultarTodasLasSecciones();
      if (secciones.ventas) secciones.ventas.style.display = "block";
      botonesNav.ventas.classList.add("active");
      if (typeof cargarCatVentas === 'function') cargarCatVentas(); 
    });
  }

  if (botonesNav.productos) {
    botonesNav.productos.addEventListener("click", (e) => {
      e.preventDefault(); ocultarTodasLasSecciones();
      if (secciones.productos) secciones.productos.style.display = "block";
      botonesNav.productos.classList.add("active");
      if (typeof cargarProductos === 'function') cargarProductos();
    });
  }

  if (botonesNav.proveedores) {
    botonesNav.proveedores.addEventListener("click", (e) => {
      e.preventDefault(); ocultarTodasLasSecciones();
      if (secciones.proveedores) secciones.proveedores.style.display = "block";
      botonesNav.proveedores.classList.add("active");
      if (typeof cargarProveedores === 'function') cargarProveedores();
      if (typeof cargarInsumos === 'function') cargarInsumos();
    });
  }

  if (botonesNav.usuarios) {
    botonesNav.usuarios.addEventListener("click", (e) => {
      e.preventDefault(); ocultarTodasLasSecciones();
      if (secciones.usuarios) secciones.usuarios.style.display = "block";
      botonesNav.usuarios.classList.add("active");
      if (typeof cargarTablaUsuariosAdmin === 'function') cargarTablaUsuariosAdmin();
    });
  }

  // Eventos para botones de acciones rápidas
  const btnAccionVender = document.getElementById("btn-accion-vender");
  const btnAccionAgregar = document.getElementById("btn-accion-agregar");
  const btnAccionProveedores = document.getElementById("btn-accion-proveedores");

  if (btnAccionVender) btnAccionVender.addEventListener("click", () => { if (botonesNav.ventas) botonesNav.ventas.click(); });
  if (btnAccionAgregar) btnAccionAgregar.addEventListener("click", () => { if (botonesNav.productos) botonesNav.productos.click(); });
  if (btnAccionProveedores) btnAccionProveedores.addEventListener("click", () => { if (botonesNav.proveedores) botonesNav.proveedores.click(); });
});