let usuarioActual = null; 
const API_URL_USUARIOS = "https://sistema-pasteleria-sql.onrender.com/api"; 
let listaEmpleadosAdmin = []; 
let verInactivosUsu = false;

document.addEventListener("DOMContentLoaded", () => {
    inicializarSistemaConLogin();
    const rowUsu = document.querySelector("#seccion-usuarios .row.mb-3");
    if(rowUsu && !document.getElementById("toggle-inactivos-usu")) { 
        rowUsu.insertAdjacentHTML('beforeend', `<div class="col-md-3 mt-2"><div class="form-check form-switch"><input class="form-check-input bg-danger" type="checkbox" id="toggle-inactivos-usu"><label class="form-check-label fw-bold text-muted small">Ver Inactivos</label></div></div>`); 
        document.getElementById("toggle-inactivos-usu").addEventListener("change", (e) => { 
            verInactivosUsu = e.target.checked; 
            filtrarUsuariosRender(document.getElementById("busqueda-usuarios-tabla").value.toLowerCase()); 
        }); 
    }
});

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
                if (esAdmin()) { document.getElementById("btn-ir-inicio")?.click(); } 
                else { document.getElementById("btn-ir-ventas")?.click(); } 
                return; 
            } else { localStorage.removeItem("usuario_id"); } 
        } catch (error) { console.error("Error", error); } 
    } 
    
    const modalElement = document.getElementById("modalLoginInicio"); 
    let modalLogin = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement, { backdrop: 'static', keyboard: false }); 
    const select = document.getElementById("login-usuario"); 
    select.innerHTML = "<option value='' selected disabled>Selecciona tu usuario...</option>"; 
    
    try { 
        const resEmp = await fetch(`${API_URL_USUARIOS}/empleados`); 
        if (resEmp.ok) { 
            const empleados = await resEmp.json(); 
            empleados.filter(e => e.activo !== false && e.activo !== 0).forEach(emp => { 
                const option = document.createElement("option"); 
                option.value = emp.id; 
                option.innerText = `${emp.nombre} (${emp.cargo || ''})`; 
                select.appendChild(option); 
            }); 
        } 
    } catch (error) {} 
    
    modalLogin.show(); 
    
    const formLogin = document.getElementById("form-login"); 
    formLogin.onsubmit = async (e) => { 
        e.preventDefault(); 
        const idUsuario = select.value; 
        const pass = document.getElementById("login-password").value; 
        
        if (!idUsuario) return mostrarErrorLogin("Por favor selecciona un usuario de la lista."); 
        
        try { 
            const res = await fetch(`${API_URL_USUARIOS}/empleados/${idUsuario}`); 
            if (!res.ok) return mostrarErrorLogin("Error al verificar credenciales."); 
            
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
                
                if (esAdmin()) document.getElementById("btn-ir-inicio")?.click(); 
                else document.getElementById("btn-ir-ventas")?.click(); 
                
                mostrarNotificacion("Acceso Exitoso", `Bienvenido al sistema, ${data.nombre}`, "success");
            } else { 
                mostrarErrorLogin("Contraseña incorrecta. Inténtalo de nuevo.");
                document.getElementById("login-password").value = ""; 
            } 
        } catch (error) {
            mostrarErrorLogin("Error de conexión al servidor.");
        } 
    }; 
}

// === ¡AQUI ESTÁ LA FUNCIÓN RESTAURADA PARA EL MENSAJE ROJO! ===
function mostrarErrorLogin(mensaje) {
    const errorDiv = document.getElementById("login-error");
    if(errorDiv) {
        errorDiv.innerText = mensaje;
        errorDiv.style.display = "block";
        // Ocultar mágicamente después de 3 segundos
        setTimeout(() => { errorDiv.style.display = "none"; }, 3000);
    } else {
        // Por si acaso el div no existe en el HTML, tira una alerta flotante
        mostrarNotificacion("Error de Autenticación", mensaje, "error");
    }
}

function forzarCierreBackdrop() { const backdrops = document.querySelectorAll('.modal-backdrop'); backdrops.forEach(backdrop => backdrop.remove()); document.body.classList.remove('modal-open'); document.body.style.overflow = ''; document.body.style.paddingRight = ''; }
function actualizarHeaderUsuario(data) { const nombreEl = document.getElementById("header-usuario-nombre"); const cargoEl = document.getElementById("header-usuario-cargo"); if(nombreEl) nombreEl.textContent = data.nombre; if(cargoEl) cargoEl.textContent = "(" + (data.cargo || "") + ")"; }
async function hashPassword(password) { const encoder = new TextEncoder(); const data = encoder.encode(password); const hashBuffer = await window.crypto.subtle.digest("SHA-256", data); return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join(""); }
window.abrirModalUsuarios = function() { new bootstrap.Modal(document.getElementById("modalConfirmarLogout")).show(); }; 
window.ejecutarLogout = function() { localStorage.removeItem("usuario_id"); window.location.reload(); }; 
window.abrirModalAgregarUsuario = function () { const form = document.getElementById("form-agregar-usuario"); if (form) form.reset(); new bootstrap.Modal(document.getElementById("modalAgregarUsuario")).show(); };
document.getElementById("form-agregar-usuario")?.addEventListener("submit", async function (e) { e.preventDefault(); const nombre = document.getElementById("nombre-usuario").value.trim(); const cargo = document.getElementById("cargo-usuario").value.trim(); const contrasea = document.getElementById("contrasea-usuario").value.trim(); const hash = await hashPassword(contrasea); try { await fetch(`${API_URL_USUARIOS}/empleados`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre, cargo, contraseña: hash }) }); bootstrap.Modal.getInstance(document.getElementById("modalAgregarUsuario")).hide(); cargarTablaUsuariosAdmin(); } catch (error) {} });
window.abrirEditarUsuario = function(id) { const emp = listaEmpleadosAdmin.find(u => u.id === id); if(!emp) return; document.getElementById("edit-id-usuario").value = emp.id; document.getElementById("edit-nombre-usuario").value = emp.nombre; document.getElementById("edit-cargo-usuario").value = emp.cargo || ''; document.getElementById("edit-contrasea-usuario").value = ''; new bootstrap.Modal(document.getElementById("modalEditarUsuario")).show(); };
document.getElementById("form-editar-usuario")?.addEventListener("submit", async function(e) { e.preventDefault(); const id = document.getElementById("edit-id-usuario").value; const nombre = document.getElementById("edit-nombre-usuario").value.trim(); const cargo = document.getElementById("edit-cargo-usuario").value.trim(); const passRaw = document.getElementById("edit-contrasea-usuario").value.trim(); const bodyData = { nombre, cargo }; if (passRaw) bodyData.password = await hashPassword(passRaw); try { await fetch(`${API_URL_USUARIOS}/empleados/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bodyData) }); bootstrap.Modal.getInstance(document.getElementById("modalEditarUsuario")).hide(); if (usuarioActual && usuarioActual.id == id) { usuarioActual.nombre = nombre; usuarioActual.cargo = cargo; actualizarHeaderUsuario(usuarioActual); } cargarTablaUsuariosAdmin(); } catch(error) {} });
window.cargarTablaUsuariosAdmin = async function() { const tbody = document.querySelector("#usuarios-table-admin tbody"); if (!tbody) return; tbody.innerHTML = "<tr><td colspan='4' class='text-center'>Cargando...</td></tr>"; try { const res = await fetch(`${API_URL_USUARIOS}/empleados`); listaEmpleadosAdmin = await res.json(); filtrarUsuariosRender(""); } catch (error) {} };
function filtrarUsuariosRender(val = "") { let filtrados = listaEmpleadosAdmin.filter(emp => emp.nombre.toLowerCase().includes(val) || emp.cargo.toLowerCase().includes(val)); if(!verInactivosUsu) filtrados = filtrados.filter(e => e.activo !== false && e.activo !== 0); renderizarTablaUsuarios(filtrados); }
function renderizarTablaUsuarios(empleados) { const tbody = document.querySelector("#usuarios-table-admin tbody"); tbody.innerHTML = ""; empleados.forEach(emp => { const esInactivo = (emp.activo === false || emp.activo === 0); const rowStyle = esInactivo ? "opacity: 0.5; background-color: #f8f9fa;" : ""; let badgeRole = emp.cargo.toLowerCase().includes('admin') ? `<span class="badge bg-danger">${emp.cargo}</span>` : `<span class="badge bg-secondary">${emp.cargo}</span>`; let botones = esInactivo ? `<button class="btn btn-sm btn-success fw-bold" onclick="reactivarUsuario(${emp.id})">Restaurar</button>` : `<button class="btn btn-sm btn-info me-1 text-white" onclick="abrirEditarUsuario(${emp.id})"><i class="bi bi-pencil"></i></button>${usuarioActual && emp.id === usuarioActual.id ? `<button class="btn btn-sm btn-outline-secondary" disabled title="Tú"><i class="bi bi-person-fill"></i></button>` : `<button class="btn btn-sm btn-danger" onclick="eliminarUsuario(${emp.id})"><i class="bi bi-trash"></i></button>`}`; tbody.insertAdjacentHTML("beforeend", `<tr style="${rowStyle}"><td class="fw-bold">${emp.id}</td><td><div class="d-flex align-items-center gap-2"><i class="bi bi-person-circle fs-4 text-muted"></i> ${emp.nombre} ${esInactivo ? '<span class="badge bg-danger">Inactivo</span>' : ''}</div></td><td>${badgeRole}</td><td class="text-center">${botones}</td></tr>`); }); }
document.getElementById("busqueda-usuarios-tabla")?.addEventListener("input", e => filtrarUsuariosRender(e.target.value.toLowerCase()));
window.eliminarUsuario = async function(id) { mostrarConfirmacion("¿Eliminar?", async () => { try { await fetch(`${API_URL_USUARIOS}/empleados/${id}`, { method: 'DELETE' }); cargarTablaUsuariosAdmin(); } catch (error) {} }); };
window.reactivarUsuario = async function(id) { mostrarConfirmacion("¿Restaurar?", async () => { try { await fetch(`${API_URL_USUARIOS}/empleados/${id}/reactivar`, { method: 'PUT' }); cargarTablaUsuariosAdmin(); } catch (error) {} }); };
window.iniciarRecuperacion = function() { new bootstrap.Modal(document.getElementById("modalRecuperarPass")).show(); };
document.getElementById("form-recuperar-pass")?.addEventListener("submit", async function(e) { e.preventDefault(); const idAdmin = document.getElementById("login-usuario").value; const pinMaestro = document.getElementById("recup-pin-maestro").value; const nuevaClave = document.getElementById("recup-nueva-pass").value; if (pinMaestro !== "UNI-2026") return; try { const hashNuevo = await hashPassword(nuevaClave); const res = await fetch(`${API_URL_USUARIOS}/empleados/${idAdmin}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: hashNuevo, es_recuperacion: true }) }); if (res.ok) { bootstrap.Modal.getInstance(document.getElementById("modalRecuperarPass")).hide(); } } catch (error) {} });
function esAdmin() { if (!usuarioActual) return false; return usuarioActual.cargo.toLowerCase().trim().includes("admin"); }
function aplicarPermisosInterfaz() { const elementos = { reporte: document.getElementById("btn-accion-reporte"), inicio: document.getElementById("btn-ir-inicio")?.parentElement, productos: document.getElementById("btn-ir-productos")?.parentElement, proveedores: document.getElementById("btn-ir-proveedores")?.parentElement, usuarios: document.getElementById("nav-item-usuarios"), addProd: document.querySelector("#seccion-productos .agregarprod"), addProv: document.querySelector("#seccion-proveedores .agregarprod") }; const mostrar = esAdmin() ? "block" : "none"; const mostrarInline = esAdmin() ? "inline-block" : "none"; if(elementos.reporte) elementos.reporte.style.display = mostrar; if(elementos.inicio) elementos.inicio.style.display = mostrar; if(elementos.productos) elementos.productos.style.display = mostrar; if(elementos.proveedores) elementos.proveedores.style.display = mostrar; if(elementos.usuarios) elementos.usuarios.style.display = mostrar; if(elementos.addProd) elementos.addProd.style.display = mostrarInline; if(elementos.addProv) elementos.addProv.style.display = mostrarInline; if (!esAdmin() && document.getElementById("btn-ir-ventas")) { document.getElementById("btn-ir-ventas").click(); document.getElementById("seccion-dashboard").style.display = "none"; } }