// ==========================================
// LÓGICA DEL MÓDULO CONTABLE Y FISCAL
// Archivo: js/finanzas.js
// ==========================================

const API_URL_FIN = "https://sistema-pasteleria-sql.onrender.com/api"; 

// Función para utilizar el modal personalizado en lugar de alert()
function mostrarNotificacion(titulo, mensaje, tipo = 'success') {
    const iconMap = {
        'success': '<i class="bi bi-check-circle-fill text-success"></i>',
        'error': '<i class="bi bi-x-circle-fill text-danger"></i>'
    };
    document.getElementById('notif-icon').innerHTML = iconMap[tipo] || iconMap['success'];
    document.getElementById('notif-title').textContent = titulo;
    document.getElementById('notif-text').textContent = mensaje;
    const modal = new bootstrap.Modal(document.getElementById('modalNotificacion'));
    modal.show();
}

// 1. Navegación: Mostrar la pantalla de finanzas al hacer clic en el menú
document.getElementById('btn-ir-finanzas').addEventListener('click', (e) => {
    e.preventDefault();
    
    document.querySelectorAll('main > section').forEach(sec => sec.style.display = 'none');
    document.getElementById('seccion-finanzas').style.display = 'block';
    
    document.querySelectorAll('.nav-links li a').forEach(a => a.classList.remove('active'));
    e.target.classList.add('active');
    
    cargarEstadoFinanciero();
});

// 2. Enviar el gasto al servidor
async function guardarGastoCIF(event) {
    event.preventDefault();
    
    const data = {
        tipo_gasto: document.getElementById('gasto-tipo').value,
        monto_total: parseFloat(document.getElementById('gasto-monto').value),
        porcentaje_negocio: parseFloat(document.getElementById('gasto-porcentaje').value),
        fecha: document.getElementById('gasto-fecha').value,
        descripcion: "Registro manual desde sistema"
    };

    try {
        const res = await fetch(`${API_URL_FIN}/gastos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if(res.ok) {
            mostrarNotificacion("¡Operación Exitosa!", "El gasto operativo ha sido registrado y calculado.", "success");
            document.getElementById('form-registrar-gasto').reset();
            cargarEstadoFinanciero(); 
        } else {
            mostrarNotificacion("Error en la Base de Datos", "No se pudo registrar el gasto.", "error");
        }
    } catch(error) {
        console.error("Error de conexión:", error);
        mostrarNotificacion("Fallo de conexión", "No se logró comunicar con el servidor backend.", "error");
    }
}

// 3. Obtener el Estado de Resultados y actualizar el HTML
async function cargarEstadoFinanciero() {
    try {
        const res = await fetch(`${API_URL_FIN}/reportes/estado-financiero`);
        const data = await res.json();

        const fmt = (num) => parseFloat(num).toFixed(2);

        document.getElementById('fin-ingresos').textContent = fmt(data.ingresos);
        document.getElementById('fin-costos').textContent = fmt(data.costo_ventas);
        document.getElementById('fin-util-bruta').textContent = fmt(data.utilidad_bruta);
        document.getElementById('fin-cif').textContent = fmt(data.gastos_operativos);
        document.getElementById('fin-util-antes').textContent = fmt(data.utilidad_neta_antes);
        
        document.getElementById('fin-ir').textContent = fmt(data.impuestos.ir_mensual);
        document.getElementById('fin-iva').textContent = fmt(data.impuestos.iva_debito);
        
        document.getElementById('fin-liquida').textContent = fmt(data.utilidad_liquida);
        
        const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        document.getElementById('lbl-mes-fiscal').textContent = `Reporte de ${meses[data.mes - 1]} ${data.anio}`;

    } catch (error) {
        console.error("Error cargando el estado financiero:", error);
        mostrarNotificacion("Error de Reporte", "Hubo un problema al generar los cálculos financieros.", "error");
    }
}