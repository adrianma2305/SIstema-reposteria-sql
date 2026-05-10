let usuarioActual = null;
const API_URL_USUARIOS = "https://sistema-pasteleria-sql.onrender.com/api";
let listaEmpleadosAdmin = []; 

async function inicializarSistemaConLogin() {
  const mainContent = document.querySelector(".main-content");
  const sidebar = document.querySelector(".sidebar");

  if (mainContent) mainContent.style.display = "none";
  if (sidebar) sidebar.style.display = "none";

  const idGuardado = localStorage.getItem("usuario_id");

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
        
        document.getElementById("btn-ir-inicio")?.click(); 
        return; 
      } else {
        localStorage.removeItem("usuario_id");
      }
    } catch (error) { console.error("Error de sesión", error); }
  }

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
        
        // ¡SOLUCIÓN AL BUG! Dispara la carga al iniciar sesión
        document.getElementById("btn-ir-inicio")?.click(); 

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

window.abrirModalUsuarios = function() {
  if(confirm("¿Deseas cerrar la sesión actual y cambiar de usuario?")) {
    localStorage.removeItem("usuario_id");
    window.location.reload(); 
  }
};

// --- AGREGAR USUARIO ---
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
    mostrarNotificacion({titulo: "Usuario Creado", mensaje: "El usuario ha sido registrado.", tipo: "success"});
    bootstrap.Modal.getInstance(document.getElementById("modalAgregarUsuario")).hide();
    if (document.getElementById("seccion-usuarios").style.display === "block") cargarTablaUsuariosAdmin();
  } catch (error) { mostrarNotificacion({titulo: "Error", mensaje: "No se pudo crear el usuario", tipo: "error"}); }
});

// --- EDITAR USUARIO (NUEVO) ---
window.abrirEditarUsuario = function(id) {
  const emp = listaEmpleadosAdmin.find(u => u.id === id);
  if(!emp) return;
  
  document.getElementById("edit-id-usuario").value = emp.id;
  document.getElementById("edit-nombre-usuario").value = emp.nombre;
  document.getElementById("edit-cargo-usuario").value = emp.cargo || '';
  document.getElementById("edit-contrasea-usuario").value = ''; // Queda en blanco por defecto
  
  const modal = new bootstrap.Modal(document.getElementById("modalEditarUsuario"));
  modal.show();
};

document.getElementById("form-editar-usuario")?.addEventListener("submit", async function(e) {
  e.preventDefault();
  const id = document.getElementById("edit-id-usuario").value;
  const nombre = document.getElementById("edit-nombre-usuario").value.trim();
  const cargo = document.getElementById("edit-cargo-usuario").value.trim();
  const passRaw = document.getElementById("edit-contrasea-usuario").value.trim();

  const bodyData = { nombre, cargo };
  // Si escribió algo en contraseña, la hasheamos y la mandamos
  if (passRaw) bodyData.password = await hashPassword(passRaw);

  try {
      const res = await fetch(`${API_URL_USUARIOS}/empleados/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyData)
      });
      if(!res.ok) throw new Error("Error al editar");
      
      mostrarNotificacion({titulo: "Actualizado", mensaje: "Datos del usuario guardados.", tipo: "success"});
      bootstrap.Modal.getInstance(document.getElementById("modalEditarUsuario")).hide();
      
      // Actualizamos header si el que se editó fue el usuario actual
      if (usuarioActual && usuarioActual.id == id) {
          usuarioActual.nombre = nombre;
          usuarioActual.cargo = cargo;
          actualizarHeaderUsuario(usuarioActual);
      }
      cargarTablaUsuariosAdmin();
  } catch(error) {
      mostrarNotificacion({titulo: "Error", mensaje: "No se pudo actualizar.", tipo: "error"});
  }
});

// --- ELIMINAR USUARIO ---
window.eliminarUsuario = async function(id) {
  if (usuarioActual.id === id) return alert("No puedes eliminar tu propio usuario mientras tienes la sesión iniciada.");
  if (!confirm("⚠️ ¿Peligro: Estás seguro que quieres eliminar este usuario permanentemente?")) return;

  try {
    const res = await fetch(`${API_URL_USUARIOS}/empleados/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error("Error al eliminar");
    mostrarNotificacion({titulo: "Usuario Eliminado", mensaje: "Se ha borrado el acceso al sistema.", tipo: "success"});
    cargarTablaUsuariosAdmin();
  } catch (error) { mostrarNotificacion({titulo: "Error", mensaje: "No se pudo eliminar el usuario.", tipo: "error"}); }
};

// --- CARGAR TABLA DE ADMINISTRACIÓN ---
window.cargarTablaUsuariosAdmin = async function() {
  const tbody = document.querySelector("#usuarios-table-admin tbody");
  if (!tbody) return;
  tbody.innerHTML = "<tr><td colspan='4' class='text-center'>Cargando usuarios...</td></tr>";

  try {
    const res = await fetch(`${API_URL_USUARIOS}/empleados`);
    if (!res.ok) throw new Error("Error de red");
    const empleados = await res.json();
    listaEmpleadosAdmin = empleados;
    renderizarTablaUsuarios(empleados);
  } catch (error) { tbody.innerHTML = "<tr><td colspan='4' class='text-center text-danger'>Error al cargar los usuarios.</td></tr>"; }
};

function renderizarTablaUsuarios(empleados) {
  const tbody = document.querySelector("#usuarios-table-admin tbody");
  tbody.innerHTML = "";
  
  empleados.forEach(emp => {
    let badgeRole = emp.cargo.toLowerCase().includes('admin') ? `<span class="badge bg-danger">${emp.cargo}</span>` : `<span class="badge bg-secondary">${emp.cargo}</span>`;

    // Botones (Editar siempre activo, Eliminar deshabilitado para uno mismo)
    let botones = `<button class="btn btn-sm btn-info me-1 text-white" onclick="abrirEditarUsuario(${emp.id})" title="Editar"><i class="bi bi-pencil"></i></button>`;
    if (emp.id === usuarioActual.id) {
        botones += `<button class="btn btn-sm btn-outline-secondary" disabled title="Tú"><i class="bi bi-person-fill"></i></button>`;
    } else {
        botones += `<button class="btn btn-sm btn-danger" onclick="eliminarUsuario(${emp.id})" title="Eliminar Acceso"><i class="bi bi-trash"></i></button>`;
    }

    tbody.insertAdjacentHTML("beforeend", `
      <tr>
        <td class="fw-bold">${emp.id}</td>
        <td>
          <div class="d-flex align-items-center gap-2">
            <i class="bi bi-person-circle fs-4 text-muted"></i>
            ${emp.nombre}
          </div>
        </td>
        <td>${badgeRole}</td>
        <td class="text-center">${botones}</td>
      </tr>
    `);
  });
}

document.getElementById("busqueda-usuarios-tabla")?.addEventListener("input", function(e) {
  const val = e.target.value.toLowerCase();
  const filtrados = listaEmpleadosAdmin.filter(emp => emp.nombre.toLowerCase().includes(val) || emp.cargo.toLowerCase().includes(val));
  renderizarTablaUsuarios(filtrados);
});

// --- RECUPERACIÓN DE CONTRASEÑA (PIN MAESTRO) ---
window.iniciarRecuperacion = function() {
  const idUsuario = document.getElementById("login-usuario").value;
  if (!idUsuario) return mostrarErrorLogin("Selecciona tu usuario primero.");
  const modalRecup = new bootstrap.Modal(document.getElementById("modalRecuperarPass"));
  modalRecup.show();
};

document.getElementById("form-recuperar-pass")?.addEventListener("submit", async function(e) {
  e.preventDefault();
  const idAdmin = document.getElementById("login-usuario").value;
  const pinMaestro = document.getElementById("recup-pin-maestro").value;
  const nuevaClave = document.getElementById("recup-nueva-pass").value;
  const confirmarClave = document.getElementById("recup-confirmar-pass").value;

  if (nuevaClave !== confirmarClave) return alert("❌ Las contraseñas no coinciden. Por favor, verifica lo que escribiste.");
  if (pinMaestro !== "UNI-2026") return alert("❌ PIN Maestro incorrecto. Acceso denegado.");

  try {
    const hashNuevo = await hashPassword(nuevaClave);
    const res = await fetch(`${API_URL_USUARIOS}/empleados/${idAdmin}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: hashNuevo, es_recuperacion: true })
    });

    if (res.ok) {
      alert("🎉 Éxito: La contraseña ha sido actualizada.");
      bootstrap.Modal.getInstance(document.getElementById("modalRecuperarPass")).hide();
      document.getElementById("form-recuperar-pass").reset();
      document.getElementById("login-password").value = ""; 
    } else alert("Error al actualizar en la base de datos.");
  } catch (error) { alert("Error de conexión al intentar recuperar."); }
});

// --- PERMISOS ---
function esAdmin() {
  if (!usuarioActual) return false;
  return usuarioActual.cargo.toLowerCase().trim().includes("admin"); 
}

function aplicarPermisosInterfaz() {
  const elementos = {
    reporte: document.getElementById("btn-accion-reporte"),
    inicio: document.getElementById("btn-ir-inicio")?.parentElement,
    productos: document.getElementById("btn-ir-productos")?.parentElement,
    proveedores: document.getElementById("btn-ir-proveedores")?.parentElement,
    usuarios: document.getElementById("nav-item-usuarios"),
    addProd: document.querySelector("#seccion-productos .agregarprod"),
    addProv: document.querySelector("#seccion-proveedores .agregarprod")
  };

  const mostrar = esAdmin() ? "block" : "none";
  const mostrarInline = esAdmin() ? "inline-block" : "none";

  if(elementos.reporte) elementos.reporte.style.display = mostrar;
  if(elementos.inicio) elementos.inicio.style.display = mostrar;
  if(elementos.productos) elementos.productos.style.display = mostrar;
  if(elementos.proveedores) elementos.proveedores.style.display = mostrar;
  if(elementos.usuarios) elementos.usuarios.style.display = mostrar;
  if(elementos.addProd) elementos.addProd.style.display = mostrarInline;
  if(elementos.addProv) elementos.addProv.style.display = mostrarInline;

  if (!esAdmin() && document.getElementById("btn-ir-ventas")) {
    document.getElementById("btn-ir-ventas").click();
    document.getElementById("seccion-dashboard").style.display = "none";
  }
}

document.addEventListener("DOMContentLoaded", () => inicializarSistemaConLogin());