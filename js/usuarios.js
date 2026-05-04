let usuarioActual = null;
const API_URL_USUARIOS = "https://kalel-tintometric-nonefficiently.ngrok-free.dev/api";

async function inicializarSistemaConLogin() {
  const mainContent = document.querySelector(".main-content");
  const sidebar = document.querySelector(".sidebar");

  if (mainContent) mainContent.style.display = "none";
  if (sidebar) sidebar.style.display = "none";

  const idGuardado = localStorage.getItem("usuario_id");

  // Verificar sesión automática
  if (idGuardado) {
    try {
      const res = await fetch(`${API_URL_USUARIOS}/empleados/${idGuardado}`);
      if (res.ok) {
        const data = await res.json();
        usuarioActual = data;
        actualizarHeaderUsuario(data);
        aplicarPermisosInterfaz(); 
        
        if (mainContent) mainContent.style.display = "block";
        if (sidebar) sidebar.style.display = "block";
        return; 
      } else {
        localStorage.removeItem("usuario_id");
      }
    } catch (error) { console.error("Error de sesión", error); }
  }

  // Cargar modal de login si no hay sesión
  const modalElement = document.getElementById("modalLoginInicio");
  let modalLogin = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement, { backdrop: 'static', keyboard: false });
  
  const select = document.getElementById("login-usuario");
  select.innerHTML = "<option value='' selected disabled>Selecciona tu usuario...</option>";

  try {
    const resEmp = await fetch(`${API_URL_USUARIOS}/empleados`);
    if (resEmp.ok) {
      const empleados = await resEmp.json();
      empleados.forEach(emp => {
        const option = document.createElement("option");
        option.value = emp.id;
        option.innerText = `${emp.nombre} (${emp.cargo || ''})`;
        select.appendChild(option);
      });
    }
  } catch (error) { console.error("Error cargando usuarios", error); }

  modalLogin.show();

  const formLogin = document.getElementById("form-login");
  formLogin.onsubmit = async (e) => {
    e.preventDefault();
    const idUsuario = select.value;
    const pass = document.getElementById("login-password").value;

    if (!idUsuario) return mostrarErrorLogin("Por favor selecciona un usuario.");

    try {
      const res = await fetch(`${API_URL_USUARIOS}/empleados/${idUsuario}`);
      if (!res.ok) return mostrarErrorLogin("Error al verificar usuario.");
      
      const data = await res.json();
      const hashIngresado = await hashPassword(pass);
      
      if (hashIngresado === data.contraseña) {
        usuarioActual = data;
        localStorage.setItem("usuario_id", data.id);
        actualizarHeaderUsuario(data);
        modalLogin.hide();
        forzarCierreBackdrop();

        if (mainContent) mainContent.style.display = "block";
        if (sidebar) sidebar.style.display = "block";
        
        aplicarPermisosInterfaz();
        mostrarNotificacion({titulo: "Bienvenido", mensaje: `Hola, ${data.nombre}`, tipo: "success"});
      } else {
        mostrarErrorLogin("Contraseña incorrecta.");
        document.getElementById("login-password").value = "";
      }
    } catch (error) {
      mostrarErrorLogin("Error de red. Revisa tu servidor Node.");
    }
  };
}

function forzarCierreBackdrop() {
  const backdrops = document.querySelectorAll('.modal-backdrop');
  backdrops.forEach(backdrop => backdrop.remove());

  document.body.classList.remove('modal-open');
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
}

function actualizarHeaderUsuario(data) {
  const nombreEl = document.getElementById("header-usuario-nombre");
  const cargoEl = document.getElementById("header-usuario-cargo");
  if(nombreEl) nombreEl.textContent = data.nombre;
  if(cargoEl) cargoEl.textContent = "(" + (data.cargo || "") + ")";
}

function mostrarErrorLogin(mensaje) {
  const errorDiv = document.getElementById("login-error");
  if(errorDiv) {
    errorDiv.innerText = mensaje;
    errorDiv.style.display = "block";
  }
}

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// --- LA FUNCIÓN DEL BOTÓN ---
window.abrirModalUsuarios = function() {
  if(confirm("¿Deseas cerrar la sesión actual y cambiar de usuario?")) {
    localStorage.removeItem("usuario_id");
    window.location.reload(); 
  }
};

window.abrirModalAgregarUsuario = function () {
  const form = document.getElementById("form-agregar-usuario");
  if (form) form.reset();
  const modal = new bootstrap.Modal(document.getElementById("modalAgregarUsuario"));
  modal.show();
};

document.getElementById("form-agregar-usuario")?.addEventListener("submit", async function (e) {
  e.preventDefault();
  const nombre = document.getElementById("nombre-usuario").value.trim();
  const cargo = document.getElementById("cargo-usuario").value.trim();
  const contrasea = document.getElementById("contrasea-usuario").value.trim();

  if (!nombre || !cargo || !contrasea) return;

  const hash = await hashPassword(contrasea);
  
  try {
    const respuesta = await fetch(`${API_URL_USUARIOS}/empleados`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, cargo, contraseña: hash })
    });

    if (!respuesta.ok) throw new Error("Error al crear");

    alert("Usuario creado exitosamente");
    const modalEl = document.getElementById("modalAgregarUsuario");
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();
  } catch (error) {
    alert("Error al crear usuario");
  }
});

// Permisos
function esAdmin() {
  if (!usuarioActual) return false;
  const cargo = usuarioActual.cargo.toLowerCase().trim();
  return cargo.includes("admin"); 
}

function aplicarPermisosInterfaz() {
  const btnReporte = document.getElementById("btn-accion-reporte");
  const btnConfigUsuarios = document.querySelector("#admin-acciones"); 
  
  const navInicio = document.getElementById("btn-ir-inicio");
  const navProductos = document.getElementById("btn-ir-productos");
  const navProveedores = document.getElementById("btn-ir-proveedores");
  
  const btnAgregarProd = document.querySelector("#seccion-productos .agregarprod");
  const btnAgregarProv = document.querySelector("#seccion-proveedores .agregarprod");

  if (esAdmin()) {
    if(btnReporte) btnReporte.style.display = "block";
    if(btnConfigUsuarios) btnConfigUsuarios.style.display = "block";
    
    if(navInicio) navInicio.parentElement.style.display = "block";
    if(navProductos) navProductos.parentElement.style.display = "block";
    if(navProveedores) navProveedores.parentElement.style.display = "block";
    
    if(btnAgregarProd) btnAgregarProd.style.display = "inline-block";
    if(btnAgregarProv) btnAgregarProv.style.display = "inline-block";

  } else {
    if(btnReporte) btnReporte.style.display = "none";
    if(btnConfigUsuarios) btnConfigUsuarios.style.display = "none";

    if(navInicio) navInicio.parentElement.style.display = "none";
    if(navProductos) navProductos.parentElement.style.display = "none";
    if(navProveedores) navProveedores.parentElement.style.display = "none";

    if(btnAgregarProd) btnAgregarProd.style.display = "none";
    if(btnAgregarProv) btnAgregarProv.style.display = "none";

    const btnVentas = document.getElementById("btn-ir-ventas");
    if(btnVentas) {
        btnVentas.click();
        document.getElementById("seccion-dashboard").style.display = "none";
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  inicializarSistemaConLogin();
});