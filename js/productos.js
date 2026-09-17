const API_URL_PROD = "https://sistema-pasteleria-sql.onrender.com/api"; 
let productosStock = [];

// ==========================================
// 1. CARGA Y RENDERIZADO DE TABLA (CON CADUCIDAD)
// ==========================================

async function cargarProductos() {
    try {
        const res = await fetch(`${API_URL_PROD}/productos`);
        productosStock = await res.json();
        renderizarProductos(productosStock);
        cargarCategoriasFiltro();
    } catch (error) {
        console.error("Error cargando productos:", error);
    }
}

function renderizarProductos(productos) {
    const tbody = document.querySelector('#productos-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    productos.forEach(p => {
        const esInactivo = p.estado === 'Inactivo' || p.estado === 0;
        
        // Nueva lógica: Evaluar si está vencido antes de mostrar el stock
        const badgeCaducidad = p.stock > 0 ? generarBadgeCaducidad(p.fecha_vencimiento) : '';

        const badgeStock = esInactivo 
            ? `<span class="badge bg-secondary ms-2">Descontinuado</span>` 
            : (p.stock > 0 
                ? `<span class="badge bg-success ms-2">${p.stock} en vitrina</span> ${badgeCaducidad}` 
                : `<span class="badge bg-danger ms-2">Agotado</span>`);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="fw-bold text-muted">#${p.id}</td>
            <td class="fw-bold">${p.nombre} ${badgeStock}</td>
            <td>${p.categoria || 'Sin Categoría'}</td>
            <td>
                <span class="text-success fw-bold">Venta: C$ ${parseFloat(p.precio).toFixed(2)}</span><br>
                <small class="text-muted">Costo: C$ ${p.costo_fabricacion ? parseFloat(p.costo_fabricacion).toFixed(2) : '0.00'}</small>
            </td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="abrirModalVerReceta(${p.id}, '${p.nombre}')" title="Ver Receta">
                    <i class="bi bi-list-ul"></i>
                </button>
                <button class="btn btn-sm btn-outline-info" onclick="abrirModalEditarProducto(${p.id})" title="Editar">
                    <i class="bi bi-pencil-square"></i>
                </button>
                <button class="btn btn-sm btn-outline-warning" onclick="darDeBajaProducto(${p.id})" title="Dar de baja (Merma)">
                    <i class="bi bi-trash3"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ==========================================
// 2. LÓGICA DE CADUCIDAD (VITRINA NICARAGUA)
// ==========================================

document.getElementById('prod-produccion')?.addEventListener('change', (e) => {
    const select = e.target;
    if (select.selectedIndex <= 0) return;

    const nombreProducto = select.options[select.selectedIndex].text.toLowerCase();
    let diasVidaUtil = 3; // Por defecto 3 días (Repostería estándar)

    // Reglas de negocio según el tipo de producto
    if (nombreProducto.includes('galleta') || nombreProducto.includes('pico') || nombreProducto.includes('polvoron') || nombreProducto.includes('pan')) {
        diasVidaUtil = 10; // Repostería seca dura más
    } else if (nombreProducto.includes('tres leches') || nombreProducto.includes('pio quinto') || nombreProducto.includes('postre')) {
        diasVidaUtil = 3; // Repostería fría
    } else if (nombreProducto.includes('pastel') || nombreProducto.includes('torta')) {
        diasVidaUtil = 4; // Pasteles decorados
    }

    // Calcular la fecha sumando los días a la fecha actual
    const fechaVencimiento = new Date();
    fechaVencimiento.setDate(fechaVencimiento.getDate() + diasVidaUtil);
    
    // Formatear a YYYY-MM-DD para que el input type="date" lo reconozca
    const fechaFormateada = fechaVencimiento.toISOString().split('T')[0];
    document.getElementById('fecha-vencimiento-prod').value = fechaFormateada;
});

function generarBadgeCaducidad(fechaVencimientoBD) {
    if (!fechaVencimientoBD) return ''; 

    const hoy = new Date();
    hoy.setHours(0,0,0,0); 
    
    // Convertimos la fecha que venga de la Base de Datos
    const fechaVence = new Date(fechaVencimientoBD); 
    fechaVence.setHours(0,0,0,0);

    const diferenciaTiempo = fechaVence.getTime() - hoy.getTime();
    const diasRestantes = Math.ceil(diferenciaTiempo / (1000 * 3600 * 24));

    if (diasRestantes < 0) {
        return `<span class="badge bg-danger ms-2 shadow-sm" title="¡Dar de baja!"><i class="bi bi-exclamation-octagon"></i> Vencido (Hace ${Math.abs(diasRestantes)} días)</span>`;
    } else if (diasRestantes === 0) {
        return `<span class="badge bg-warning text-dark ms-2 shadow-sm"><i class="bi bi-clock-history"></i> Vence Hoy</span>`;
    } else if (diasRestantes <= 2) {
        return `<span class="badge bg-info text-dark ms-2 shadow-sm"><i class="bi bi-info-circle"></i> Vence en ${diasRestantes} días</span>`;
    }
    
    return `<span class="badge bg-success ms-2 shadow-sm"><i class="bi bi-check-circle"></i> Fresco</span>`; 
}

// ==========================================
// 3. MÓDULO DE PRODUCCIÓN (HORNEAR)
// ==========================================

async function abrirModalProduccion() {
    try {
        const res = await fetch(`${API_URL_PROD}/productos`);
        const productos = await res.json();
        
        const selectProd = document.getElementById('prod-produccion');
        selectProd.innerHTML = '<option value="">Seleccione qué va a hornear...</option>';
        
        productos.forEach(p => {
            if (p.estado !== 'Inactivo') {
                selectProd.innerHTML += `<option value="${p.id}">${p.nombre}</option>`;
            }
        });
        
        document.getElementById('cant-produccion').value = '';
        document.getElementById('fecha-vencimiento-prod').value = '';
        
        const modal = new bootstrap.Modal(document.getElementById('modalProduccion'));
        modal.show();
    } catch (error) {
        console.error("Error al cargar productos para producción:", error);
    }
}

window.ejecutarProduccion = async function(event) { 
    event.preventDefault(); 
    const producto_id = parseInt(document.getElementById("prod-produccion").value); 
    const cantidad_producida = parseInt(document.getElementById("cant-produccion").value, 10); 
    const fecha_vencimiento = document.getElementById("fecha-vencimiento-prod").value; 
    
    // Validaciones
    if (!producto_id || isNaN(cantidad_producida) || cantidad_producida <= 0) {
        return alert("Ingresa una cantidad válida para ingresar a la vitrina."); 
    }
    if (!fecha_vencimiento) {
        return alert("La fecha de vencimiento es obligatoria."); 
    }
    
    // Obtener ID del usuario activo si usas localStorage, sino mandar null
    const usuario_id = localStorage.getItem("usuario_id") ? parseInt(localStorage.getItem("usuario_id")) : 1; 
    
    try { 
        const respuesta = await fetch(`${API_URL_PROD}/produccion`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ producto_id, cantidad_producida, usuario_id, fecha_vencimiento }) 
        }); 
        
        const data = await respuesta.json();

        if(respuesta.ok) {
            alert(`¡Producción registrada! Se agregaron ${cantidad_producida} unidades a la vitrina.`);
            bootstrap.Modal.getInstance(document.getElementById('modalProduccion')).hide();
            document.getElementById('form-produccion').reset();
            cargarProductos(); // Recargar la tabla
        } else {
            alert(`Error: ${data.mensaje || 'No se pudo registrar la producción. Verifica los insumos.'}`);
        }
    } catch (error) { 
        console.error("Error ejecutando producción:", error); 
        alert("Fallo de conexión al servidor backend.");
    } 
};

// ==========================================
// 4. FILTROS Y BÚSQUEDAS
// ==========================================

document.getElementById('busqueda-productos')?.addEventListener('input', (e) => {
    const termino = e.target.value.toLowerCase();
    const filtrados = productosStock.filter(p => p.nombre.toLowerCase().includes(termino));
    renderizarProductos(filtrados);
});

function cargarCategoriasFiltro() {
    const categorias = [...new Set(productosStock.map(p => p.categoria).filter(c => c))];
    const select = document.getElementById('filtro-categoria');
    if(!select) return;
    
    select.innerHTML = '<option value="">Todas las categorías</option>';
    categorias.forEach(c => {
        select.innerHTML += `<option value="${c}">${c}</option>`;
    });
}

document.getElementById('filtro-categoria')?.addEventListener('change', (e) => {
    const cat = e.target.value;
    const filtrados = cat ? productosStock.filter(p => p.categoria === cat) : productosStock;
    renderizarProductos(filtrados);
});

// ==========================================
// INICIALIZACIÓN
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    // Si estamos en la sección de productos, los cargamos
    const seccionProductos = document.getElementById('seccion-productos');
    if(seccionProductos && seccionProductos.style.display !== 'none') {
        cargarProductos();
    }
    
    // También escuchamos el click en el menú para recargar la tabla fresquita
    document.getElementById('btn-ir-productos')?.addEventListener('click', () => {
        cargarProductos();
    });
});