const API_URL_VENTAS = "http://localhost:3000/api";
let productosParaVenta = [];
let factura = [];

// 1. CARGAR PRODUCTOS EN LA CUADRÍCULA 
async function cargarProductosParaVenta() {
  try {
    const res = await fetch(`${API_URL_VENTAS}/productos`);
    if (!res.ok) throw new Error("Error al cargar productos");
    const productos = await res.json();
    
    productosParaVenta = productos;
    renderizarGridProductosVenta(productos);
  } catch(error) {
    console.error("Error cargando productos para venta:", error);
  }
}

function renderizarGridProductosVenta(listado) {
  const grid = document.getElementById("grid-productos-venta");
  grid.innerHTML = "";
  listado.forEach((p) => {
    grid.insertAdjacentHTML("beforeend", `
      <div class="col">
        <div class="card producto-card h-100" onclick="agregarAFactura(${p.id})">
          <div class="card-body text-center">
            <h6 class="mb-1">${p.nombre}</h6>
            <div class="mb-2 text-muted small">C$ ${p.precio.toFixed(2)}</div>
          </div>
        </div>
      </div>
    `);
  });
}

// 2. LÓGICA DE LA FACTURA 
window.agregarAFactura = function (id) {
  
  const prod = productosParaVenta.find((p) => p.id == id);
  
  if (!prod) {
    console.error("Error: No se encontró el producto con ID", id);
    return;
  }

  const idx = factura.findIndex((item) => item.id == id);
  if (idx >= 0) {
    factura[idx].cantidad += 1;
  } else {
    factura.push({ id: prod.id, nombre: prod.nombre, precio: parseFloat(prod.precio), cantidad: 1 });
  }
  
  renderFactTabla();
};

function renderFactTabla() {
  const tbody = document.getElementById("tabla-factura");
  tbody.innerHTML = "";
  let total = 0;
  
  factura.forEach((item) => {
    const subtotal = item.precio * item.cantidad;
    total += subtotal;
    tbody.insertAdjacentHTML("beforeend", `
      <tr>
        <td>${item.nombre}</td>
        <td>
          <input type="number" min="1" value="${item.cantidad}" onchange="setCantidadFact(${item.id},this.value)">
          <button class="btn btn-link btn-sm p-0 ms-2" onclick="quitarDeFactura(${item.id})"><i class="bi bi-x-lg text-danger"></i></button>
        </td>
        <td>C$ ${subtotal.toFixed(2)}</td>
        <td></td>
      </tr>`
    );
  });
  
  document.getElementById("factura-total").innerText = "C$ " + total.toFixed(2);
  document.getElementById("btn-guardar-venta").disabled = factura.length === 0;
}

window.setCantidadFact = function (id, val) {
  val = Math.max(1, parseInt(val));
  const prod = factura.find((p) => p.id == id);
  if (prod) prod.cantidad = val;
  renderFactTabla();
};

window.quitarDeFactura = function (id) {
  factura = factura.filter((item) => item.id != id);
  renderFactTabla();
};

// Búsqueda rápida de productos
document.getElementById("busqueda-venta-productos").addEventListener("input", function () {
  const val = this.value.trim().toLowerCase();
  const filtrados = productosParaVenta.filter((p) => p.nombre.toLowerCase().includes(val));
  renderizarGridProductosVenta(filtrados);
});

// 3. GUARDAR LA VENTA Y CREAR CLIENTE 
async function obtenerOCrearCliente() {
  const nombreInput = document.getElementById("cliente-nombre");
  const telInput = document.getElementById("cliente-telefono");

  if (!nombreInput || !telInput) return null;

  const nombre = nombreInput.value.trim();
  const telefono = telInput.value.trim();

  if (!nombre) return null;

  try {
    const resBusq = await fetch(`${API_URL_VENTAS}/clientes?nombre=${encodeURIComponent(nombre)}`);
    const encontrados = await resBusq.json();

    if (encontrados && encontrados.length > 0) {
      return encontrados[0].id; 
    }

    const resCrear = await fetch(`${API_URL_VENTAS}/clientes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, telefono })
    });
    
    const nuevo = await resCrear.json();
    return nuevo.id; 

  } catch (error) {
    console.error("Error procesando cliente", error);
    return null;
  }
}

document.getElementById("btn-guardar-venta").onclick = async function () {
  if (factura.length === 0) return;
  
  document.getElementById("btn-guardar-venta").disabled = true;

  const clienteId = await obtenerOCrearCliente();
  const empleadoIdStr = localStorage.getItem("usuario_id");
  const empleadoId = empleadoIdStr ? parseInt(empleadoIdStr) : null;

  // Calculamos el total de la factura
  const totalFactura = factura.reduce((acc, item) => acc + (item.cantidad * item.precio), 0);

  // Preparamos el array de detalles para enviarlo de un solo golpe
  const detallesVenta = factura.map(item => ({
      producto_id: item.id,
      cantidad: item.cantidad,
      precio_unitario: item.precio,
      subtotal: item.cantidad * item.precio
  }));

  try {
    // Mandamos el paquete completo al nuevo backend
    const res = await fetch(`${API_URL_VENTAS}/ventas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
          cliente_id: clienteId,
          empleado_id: empleadoId,
          total: totalFactura,
          detalles: detallesVenta
      })
    });

    if (!res.ok) throw new Error("No se pudo registrar la venta");

    factura = [];
    renderFactTabla();
    document.getElementById("cliente-nombre").value = "";
    document.getElementById("cliente-telefono").value = "";

    cargarVentas();
    mostrarNotificacion({ titulo: "Venta registrada", mensaje: "Venta guardada en la base de datos.", tipo: "success" });
  } catch (error) {
    console.error(error);
    mostrarNotificacion({ titulo: "Error", mensaje: "No se pudo registrar la venta.", tipo: "error" });
    document.getElementById("btn-guardar-venta").disabled = false;
  }
};

// 4. CARGAR HISTORIAL DE VENTAS 
async function cargarVentas() {
  const tabla = document.querySelector("#ventas-table tbody");
  tabla.innerHTML = "<tr><td colspan='8'>Cargando...</td></tr>";

  try {
    const res = await fetch(`${API_URL_VENTAS}/ventas`);
    if (!res.ok) throw new Error("Error de red");
    const ventas = await res.json();

    tabla.innerHTML = "";
    ventas.forEach((v) => {
      const fechaStr = v.fecha ? new Date(v.fecha).toLocaleString() : "";
      tabla.insertAdjacentHTML("beforeend", `
        <tr>
          <td>${v.id}</td>
          <td>${v.producto?.nombre || "Producto eliminado"}</td>
          <td>${v.cantidad}</td>
          <td>${v.precio_unitario !== null ? v.precio_unitario.toFixed(2) : ""}</td>
          <td>${v.total !== null ? v.total.toFixed(2) : ""}</td>
          <td>${fechaStr}</td>
          <td>${v.cliente?.nombre || ""}</td>
          <td>${v.empleado?.nombre || ""}</td>
        </tr>
      `);
    });
  } catch (error) {
    tabla.innerHTML = `<tr><td colspan='8'>Error al cargar las ventas.</td></tr>`;
    console.error(error);
  }
}

async function iniciarPOSVenta() {
  await cargarProductosParaVenta();
  factura = [];
  renderFactTabla();
}

// --- NOTIFICACIONES ---
function mostrarNotificacion({ titulo = "¡Aviso!", mensaje = "", tipo = "success", tiempo = 1000 }) {
  const modalEl = document.getElementById("modalNotificacion");
  const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
  
  document.getElementById("notif-title").innerText = titulo;
  document.getElementById("notif-text").innerText = mensaje;
  
  let iconHtml = "";
  if (tipo === "success") iconHtml = '<i class="bi bi-check-circle" style="color:#3dc964"></i>';
  else if (tipo === "error") iconHtml = '<i class="bi bi-x-circle" style="color:#e74c3c"></i>';
  else if (tipo === "warning") iconHtml = '<i class="bi bi-exclamation-circle" style="color:#ffc107"></i>';
  else iconHtml = '<i class="bi bi-info-circle" style="color:#3498db"></i>';
  
  document.getElementById("notif-icon").innerHTML = iconHtml;
  modal.show();

  if (tiempo > 0) {
    setTimeout(() => modal.hide(), tiempo);
  }
}