document.addEventListener("DOMContentLoaded", () => {
  //  1. CAPTURAR BOTONES Y SECCIONES 
  const botonesNav = {
    inicio: document.getElementById("btn-ir-inicio"),
    ventas: document.getElementById("btn-ir-ventas"),
    productos: document.getElementById("btn-ir-productos"),
    proveedores: document.getElementById("btn-ir-proveedores")
  };

  const secciones = {
    inicio: document.getElementById("seccion-dashboard"),
    ventas: document.getElementById("seccion-ventas"),
    productos: document.getElementById("seccion-productos"),
    proveedores: document.getElementById("seccion-proveedores")
  };

  // --- 2. FUNCIÓN PARA OCULTAR TODO ---
  function ocultarTodasLasSecciones() {
    Object.values(secciones).forEach(seccion => {
      if (seccion) seccion.style.display = "none";
    });
    Object.values(botonesNav).forEach(btn => {
      if (btn) btn.classList.remove("active");
    });
  }

  // --- 3. EVENTOS DE CLIC ---
  if (botonesNav.inicio) {
    botonesNav.inicio.addEventListener("click", async (e) => {
      e.preventDefault();
      ocultarTodasLasSecciones();
      if (secciones.inicio) secciones.inicio.style.display = "block";
      botonesNav.inicio.classList.add("active");
      
      // Recargar gráficos al entrar
      if (typeof refrescarTotales === 'function') await refrescarTotales();
      if (typeof graficarSemana === 'function') graficarSemana();
      if (typeof refrescarTopProductos === 'function') refrescarTopProductos();
    });
  }

  if (botonesNav.ventas) {
    botonesNav.ventas.addEventListener("click", (e) => {
      e.preventDefault();
      ocultarTodasLasSecciones();
      if (secciones.ventas) secciones.ventas.style.display = "block";
      botonesNav.ventas.classList.add("active");
      
      // Cargar los productos para vender y la tabla del historial de ventas
      if (typeof iniciarPOSVenta === 'function') iniciarPOSVenta();
      if (typeof cargarVentas === 'function') cargarVentas(); 
    });
  }

  if (botonesNav.productos) {
    botonesNav.productos.addEventListener("click", (e) => {
      e.preventDefault();
      ocultarTodasLasSecciones();
      if (secciones.productos) secciones.productos.style.display = "block";
      botonesNav.productos.classList.add("active");

      // Cargar la tabla de productos y la de insumos
      if (typeof cargarProductos === 'function') cargarProductos();
      if (typeof cargarInsumos === 'function') cargarInsumos();
    });
  }

  if (botonesNav.proveedores) {
    botonesNav.proveedores.addEventListener("click", (e) => {
      e.preventDefault();
      ocultarTodasLasSecciones();
      if (secciones.proveedores) secciones.proveedores.style.display = "block";
      botonesNav.proveedores.classList.add("active");

      // Cargar la tabla de proveedores
      if (typeof cargarProveedores === 'function') cargarProveedores();
    });
  }
});