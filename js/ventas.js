const API_URL_VENTAS = "https://sistema-pasteleria-sql.onrender.com/api";
let productosVenta = [];
let carritoActual = [];

window.cargarCatVentas = async function() {
  try {
    const res = await fetch(`${API_URL_VENTAS}/productos`);
    productosVenta = await res.json();
    renderizarGridVentas(productosVenta);
    cargarVentasHistorial();
  } catch (error) { console.error("Error cargando productos venta", error); }
};

function renderizarGridVentas(productos) {
  const grid = document.getElementById("grid-productos-venta");
  if (!grid) return;
  grid.innerHTML = "";
  
  const activos = productos.filter(p => p.activo !== false && p.activo !== 0);

  activos.forEach(p => {
    const agotado = p.stock <= 0;
    const cardClass = agotado ? "bg-light text-muted border-danger" : "border-primary cursor-pointer";
    const opacity = agotado ? "opacity-50" : "";
    const onClick = agotado ? `onclick="mostrarNotificacion('¡Agotado!', 'La bandeja de ${p.nombre} está vacía. Deben hornear más.', 'warning')"` : `onclick="window.agregarAlCarrito(${p.id})"`;
    const badgeStock = agotado ? `<span class="badge bg-danger">Agotado</span>` : `<span class="badge bg-success">${p.stock} en vitrina</span>`;

    grid.insertAdjacentHTML('beforeend', `
      <div class="col">
        <div class="card h-100 shadow-sm ${cardClass}" style="${agotado ? '' : 'cursor: pointer;'} transition: 0.2s;" ${onClick}>
          <div class="card-body p-2 text-center ${opacity}">
            <div class="small fw-bold mb-1" style="min-height: 2.5rem;">${p.nombre}</div>
            <div class="text-primary fw-bold mb-1">C$ ${p.precio}</div>
            ${badgeStock}
          </div>
        </div>
      </div>
    `);
  });
}

window.agregarAlCarrito = function(idProd) {
  const prod = productosVenta.find(p => p.id === idProd);
  if (!prod) return;

  const itemExistente = carritoActual.find(i => i.producto_id === idProd);
  if (itemExistente) {
    if (itemExistente.cantidad >= prod.stock) {
      return mostrarNotificacion("Límite de Vitrina", `Solo hay ${prod.stock} unidades de ${prod.nombre}.`, "warning");
    }
    itemExistente.cantidad++;
    itemExistente.subtotal = itemExistente.cantidad * itemExistente.precio_unitario;
  } else {
    if (prod.stock < 1) return mostrarNotificacion("Agotado", "Producto sin existencias", "error");
    carritoActual.push({ producto_id: prod.id, nombre: prod.nombre, cantidad: 1, precio_unitario: prod.precio, subtotal: prod.precio });
  }
  actualizarUIFactura();
};

window.reducirDelCarrito = function(idProd) {
  const itemExistente = carritoActual.find(i => i.producto_id === idProd);
  if (itemExistente) {
    itemExistente.cantidad--;
    itemExistente.subtotal = itemExistente.cantidad * itemExistente.precio_unitario;
    if (itemExistente.cantidad === 0) carritoActual = carritoActual.filter(i => i.producto_id !== idProd);
  }
  actualizarUIFactura();
};

window.eliminarDelCarrito = function(idProd) {
  carritoActual = carritoActual.filter(i => i.producto_id !== idProd);
  actualizarUIFactura();
};

function actualizarUIFactura() {
  const tbody = document.getElementById("tabla-factura");
  const totalEl = document.getElementById("factura-total");
  const btnGuardar = document.getElementById("btn-guardar-venta");
  if(!tbody) return;

  tbody.innerHTML = "";
  let total = 0;

  carritoActual.forEach(item => {
    total += item.subtotal;
    tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td class="small text-truncate" style="max-width: 120px;">${item.nombre}</td>
        <td>
            <div class="btn-group btn-group-sm">
                <button class="btn btn-outline-secondary py-0 px-1" onclick="window.reducirDelCarrito(${item.producto_id})">-</button>
                <span class="btn border-0 py-0 px-1 fw-bold">${item.cantidad}</span>
                <button class="btn btn-outline-secondary py-0 px-1" onclick="window.agregarAlCarrito(${item.producto_id})">+</button>
            </div>
        </td>
        <td class="fw-bold text-success">C$ ${item.subtotal}</td>
        <td><button class="btn btn-sm text-danger p-0" onclick="window.eliminarDelCarrito(${item.producto_id})"><i class="bi bi-x-circle"></i></button></td>
      </tr>
    `);
  });

  totalEl.innerText = `C$ ${total}`;
  if(btnGuardar) btnGuardar.disabled = carritoActual.length === 0;
}

document.getElementById("btn-guardar-venta")?.addEventListener("click", async () => {
  const nombreCliente = document.getElementById("cliente-nombre").value.trim();
  const telefonoCliente = document.getElementById("cliente-telefono").value.trim();
  const empleado_id = localStorage.getItem("usuario_id") ? parseInt(localStorage.getItem("usuario_id")) : null;
  const btnGuardar = document.getElementById("btn-guardar-venta");
  
  if (telefonoCliente && telefonoCliente.length < 8) {
    return mostrarNotificacion("Teléfono Inválido", "El teléfono debe tener 8 dígitos.", "warning");
  }

  btnGuardar.disabled = true;
  btnGuardar.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Procesando...`;

  try {
    let cliente_id = null;
    if (nombreCliente) {
      const resCli = await fetch(`${API_URL_VENTAS}/clientes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: nombreCliente, telefono: telefonoCliente }) });
      const dataCli = await resCli.json();
      cliente_id = dataCli.id;
    }

    let totalVenta = carritoActual.reduce((acc, item) => acc + item.subtotal, 0);

    const resVenta = await fetch(`${API_URL_VENTAS}/ventas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cliente_id, empleado_id, total: totalVenta, detalles: carritoActual })
    });

    if (!resVenta.ok) throw new Error("Error al guardar venta");
    const dataVenta = await resVenta.json();

    mostrarNotificacion("Venta Exitosa", `Ticket #${dataVenta.id} generado.`, "success");
    abrirRecibo(dataVenta.id, nombreCliente || "Consumidor Final", empleado_id, carritoActual, totalVenta);

    carritoActual = [];
    document.getElementById("cliente-nombre").value = "";
    document.getElementById("cliente-telefono").value = "";
    actualizarUIFactura();
    window.cargarCatVentas(); 
  } catch (error) { mostrarNotificacion("Error", "Fallo al guardar la venta.", "error"); } 
  finally { btnGuardar.disabled = false; btnGuardar.innerText = "Guardar venta"; }
});

async function cargarVentasHistorial() {
  const tbody = document.querySelector("#ventas-table tbody");
  if(!tbody) return;
  tbody.innerHTML = "<tr><td colspan='6' class='text-center'>Cargando tickets...</td></tr>";
  try {
    const res = await fetch(`${API_URL_VENTAS}/ventas`);
    const ventas = await res.json();
    tbody.innerHTML = "";
    ventas.forEach(v => {
      const fecha = new Date(v.fecha).toLocaleString();
      tbody.insertAdjacentHTML('beforeend', `
        <tr>
          <td class="fw-bold text-primary">#${v.id}</td>
          <td class="small">${fecha}</td>
          <td>${v.cliente}</td>
          <td><span class="badge bg-secondary"><i class="bi bi-person"></i> ${v.empleado}</span></td>
          <td class="fw-bold text-success">C$ ${v.total}</td>
          <td class="text-center"><button class="btn btn-sm btn-outline-dark" onclick="window.verDetalleVenta(${v.id}, '${v.cliente}', '${fecha}', '${v.empleado}', ${v.total})"><i class="bi bi-printer"></i> Ticket</button></td>
        </tr>
      `);
    });
  } catch (error) { tbody.innerHTML = "<tr><td colspan='6' class='text-center text-danger'>Error al cargar historial</td></tr>"; }
}

window.verDetalleVenta = async function(idVenta, cliente, fecha, empleado, total) {
  try {
    const res = await fetch(`${API_URL_VENTAS}/ventas/${idVenta}/detalles`);
    if(!res.ok) throw new Error();
    const detalles = await res.json();
    abrirRecibo(idVenta, cliente, empleado, detalles, total, fecha);
  } catch (error) { mostrarNotificacion("Error", "Error al cargar los detalles del ticket.", "error"); }
};

function abrirRecibo(id, cliente, empleado, detalles, total, fechaStr = null) {
  document.getElementById("recibo-id").innerText = id;
  document.getElementById("recibo-fecha").innerText = fechaStr || new Date().toLocaleString();
  document.getElementById("recibo-cliente").innerText = cliente;
  document.getElementById("recibo-empleado").innerText = empleado || "Admin";
  document.getElementById("recibo-total").innerText = `C$ ${total}`;

  const tbody = document.getElementById("recibo-detalles");
  tbody.innerHTML = "";
  detalles.forEach(d => {
    const precio = d.precio_unitario ? d.precio_unitario : (d.subtotal / d.cantidad);
    tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td class="text-start pb-2 align-top">${d.cantidad}</td>
        <td class="text-start pb-2" style="word-break: break-word; white-space: normal;">
            ${d.nombre} <br><small class="text-muted">C$ ${precio}</small>
        </td>
        <td class="text-end pb-2 align-top">C$ ${d.subtotal}</td>
      </tr>
    `);
  });

  bootstrap.Modal.getOrCreateInstance(document.getElementById("modalRecibo")).show();
}

window.abrirCorteCaja = async function() {
    try {
        const res = await fetch(`${API_URL_VENTAS}/reportes/corte-caja`);
        if (!res.ok) throw new Error("Fallo al obtener corte");
        const data = await res.json();

        document.getElementById("corte-fecha").innerText = new Date().toLocaleDateString();
        document.getElementById("corte-ventas").innerText = `C$ ${data.ventas}`;
        document.getElementById("corte-gastos").innerText = `C$ ${data.gastos}`;
        
        const hCaja = document.getElementById("corte-caja-total");
        hCaja.innerText = `C$ ${data.caja}`;
        hCaja.className = data.caja < 0 ? "fw-bold m-0 text-danger" : "fw-bold m-0 text-success";

        bootstrap.Modal.getOrCreateInstance(document.getElementById("modalCorteCaja")).show();
    } catch (error) { 
        mostrarNotificacion("Error", "No se pudo hacer el corte de caja. Verifica que el backend esté en línea.", "error"); 
    }
};

document.getElementById("busqueda-venta-productos")?.addEventListener("input", function(e) {
  const val = e.target.value.toLowerCase();
  const activos = productosVenta.filter(p => p.activo !== false && p.activo !== 0);
  renderizarGridVentas(activos.filter(p => p.nombre.toLowerCase().includes(val)));
});

// Evitar múltiples llamadas al cargar la sección
document.getElementById("btn-ir-ventas")?.addEventListener("click", () => { window.cargarCatVentas(); });