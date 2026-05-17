const API_URL_VENTAS = "https://sistema-pasteleria-sql.onrender.com/api";
let productosVenta = [];
let carritoActual = [];

async function cargarCatVentas() {
  try {
    const res = await fetch(`${API_URL_VENTAS}/productos`);
    productosVenta = await res.json();
    renderizarGridVentas(productosVenta);
    cargarVentasHistorial();
  } catch (error) { console.error("Error", error); }
}

function renderizarGridVentas(productos) {
  const grid = document.getElementById("grid-productos-venta");
  if (!grid) return;
  grid.innerHTML = "";
  
  productos.forEach(p => {
    // FASE 4: LÓGICA DE AGOTADOS
    const agotado = p.stock <= 0;
    const cardClass = agotado ? "bg-light text-muted border-danger" : "border-primary cursor-pointer";
    const opacity = agotado ? "opacity-50" : "";
    const onClick = agotado ? `onclick="alert('¡Agotado! Debes hornear más ${p.nombre}.')"` : `onclick="agregarAlCarrito(${p.id})"`;
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
  
  // FASE 4: Evitar que metan al carrito más de lo que hay horneado
  if (itemExistente) {
    if (itemExistente.cantidad >= prod.stock) {
      return alert(`¡Hey! Solo tienes ${prod.stock} unidades de ${prod.nombre} horneadas en la vitrina.`);
    }
    itemExistente.cantidad++;
    itemExistente.subtotal = itemExistente.cantidad * itemExistente.precio_unitario;
  } else {
    if (prod.stock < 1) return alert("Agotado");
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

function actualizarUIFactura() {
  const tbody = document.getElementById("tabla-factura");
  const totalEl = document.getElementById("factura-total");
  const btnGuardar = document.getElementById("btn-guardar-venta");
  
  tbody.innerHTML = "";
  let total = 0;

  carritoActual.forEach(item => {
    total += item.subtotal;
    tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td class="small text-truncate" style="max-width: 120px;">${item.nombre}</td>
        <td>
            <div class="btn-group btn-group-sm">
                <button class="btn btn-outline-secondary py-0 px-1" onclick="reducirDelCarrito(${item.producto_id})">-</button>
                <span class="btn border-0 py-0 px-1 fw-bold">${item.cantidad}</span>
                <button class="btn btn-outline-secondary py-0 px-1" onclick="agregarAlCarrito(${item.producto_id})">+</button>
            </div>
        </td>
        <td class="fw-bold text-success">C$ ${item.subtotal}</td>
        <td><button class="btn btn-sm text-danger p-0" onclick="eliminarDelCarrito(${item.producto_id})"><i class="bi bi-x-circle"></i></button></td>
      </tr>
    `);
  });

  totalEl.innerText = `C$ ${total}`;
  btnGuardar.disabled = carritoActual.length === 0;
}

window.eliminarDelCarrito = function(idProd) {
  carritoActual = carritoActual.filter(i => i.producto_id !== idProd);
  actualizarUIFactura();
};

document.getElementById("btn-guardar-venta").addEventListener("click", async () => {
  const nombreCliente = document.getElementById("cliente-nombre").value.trim();
  const telefonoCliente = document.getElementById("cliente-telefono").value.trim();
  const empleado_id = localStorage.getItem("usuario_id") ? parseInt(localStorage.getItem("usuario_id")) : null;
  const btnGuardar = document.getElementById("btn-guardar-venta");
  
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

    alert("✅ Venta registrada con éxito.");
    
    // Mostramos el recibo automáticamente
    abrirRecibo(dataVenta.id, nombreCliente || "Consumidor Final", empleado_id, carritoActual, totalVenta);

    // Limpiar carrito
    carritoActual = [];
    document.getElementById("cliente-nombre").value = "";
    document.getElementById("cliente-telefono").value = "";
    actualizarUIFactura();
    
    // Recargar productos para que el stock baje visualmente
    cargarCatVentas(); 

  } catch (error) {
    alert("Hubo un error de conexión al guardar la venta.");
  } finally {
    btnGuardar.disabled = false;
    btnGuardar.innerText = "Guardar venta";
  }
});

async function cargarVentasHistorial() {
  const tbody = document.querySelector("#ventas-table tbody");
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
          <td class="text-center"><button class="btn btn-sm btn-outline-dark" onclick="verDetalleVenta(${v.id}, '${v.cliente}', '${fecha}', '${v.empleado}', ${v.total})"><i class="bi bi-printer"></i> Ticket</button></td>
        </tr>
      `);
    });
  } catch (error) { tbody.innerHTML = "<tr><td colspan='6' class='text-center text-danger'>Error al cargar historial</td></tr>"; }
}

window.verDetalleVenta = async function(idVenta, cliente, fecha, empleado, total) {
  try {
    const res = await fetch(`${API_URL_VENTAS}/ventas/${idVenta}/detalles`);
    const detalles = await res.json();
    abrirRecibo(idVenta, cliente, empleado, detalles, total, fecha);
  } catch (error) { alert("Error al cargar los detalles del ticket."); }
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
    // Si viene del carrito se llama precio_unitario, si viene del historial ya trae subtotal
    const precio = d.precio_unitario ? (d.subtotal / d.cantidad) : (d.subtotal / d.cantidad);
    tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td class="text-start pb-1">${d.cantidad}</td>
        <td class="text-start pb-1 text-truncate" style="max-width: 150px;">${d.nombre} <br><small class="text-muted">C$ ${precio}</small></td>
        <td class="text-end pb-1">C$ ${d.subtotal}</td>
      </tr>
    `);
  });

  new bootstrap.Modal(document.getElementById("modalRecibo")).show();
}

document.getElementById("busqueda-venta-productos")?.addEventListener("input", function(e) {
  const val = e.target.value.toLowerCase();
  renderizarGridVentas(productosVenta.filter(p => p.nombre.toLowerCase().includes(val)));
});

// Actualizamos el dashboard automáticamente al entrar
document.getElementById("btn-ir-ventas")?.addEventListener("click", () => {
    cargarCatVentas();
});