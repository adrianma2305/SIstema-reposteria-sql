const API_URL_PROV = "https://sistema-pasteleria-sql.onrender.com/api";
let listaProveedores = [];

async function cargarProveedores() {
    try {
        const respuesta = await fetch(`${API_URL_PROV}/proveedores`);
        if (!respuesta.ok) throw new Error("Error en red al cargar proveedores");
        listaProveedores = await respuesta.json();
        renderizarProveedores(listaProveedores);
    } catch (error) {
        console.error("Error al cargar proveedores:", error);
    }
}

function renderizarProveedores(proveedores) {
    const tbody = document.querySelector('#proveedores-table tbody');
    if (!tbody) return; // Si no existe la tabla, no hacemos nada
    
    tbody.innerHTML = '';
    
    if (proveedores.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No hay proveedores registrados</td></tr>`;
        return;
    }

    proveedores.forEach(p => {
        let formatoFecha = p.entrega ? p.entrega.split('T')[0] : 'Sin definir';
        let claseDeuda = p.deuda_total > 0 ? 'text-danger fw-bold' : 'text-success';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="fw-bold text-muted">#${p.id}</td>
            <td class="fw-bold">${p.nombre}</td>
            <td>${p.telefono || '-'}</td>
            <td class="text-center ${claseDeuda}">C$ ${parseFloat(p.deuda_total).toFixed(2)}</td>
            <td>${formatoFecha}</td>
            <td>
                <button class="btn btn-sm btn-outline-info" onclick="abrirModalEditarProveedor(${p.id})"><i class="bi bi-pencil-square"></i> Editar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Búsqueda segura usando el operador opcional (?.)
document.getElementById('busqueda-proveedores')?.addEventListener('input', (e) => {
    const termino = e.target.value.toLowerCase();
    const filtrados = listaProveedores.filter(p => p.nombre.toLowerCase().includes(termino));
    renderizarProveedores(filtrados);
});

// Cargar datos si estamos en la sección de proveedores
document.addEventListener("DOMContentLoaded", () => {
    const seccionProveedores = document.getElementById('seccion-proveedores');
    if(seccionProveedores && seccionProveedores.style.display !== 'none') {
        cargarProveedores();
    }
    
    // Escuchar el clic del menú
    document.getElementById('btn-ir-proveedores')?.addEventListener('click', () => {
        cargarProveedores();
    });
});