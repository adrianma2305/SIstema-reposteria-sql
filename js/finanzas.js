
document.getElementById('btn-ir-finanzas').addEventListener('click', (e) => {
    e.preventDefault();
    
    // Ocultar todas las secciones principales
    document.querySelectorAll('main > section').forEach(sec => sec.style.display = 'none');
    
    // Mostrar solo la sección de Finanzas
    document.getElementById('seccion-finanzas').style.display = 'block';
    
    // Cambiar el estilo activo en el menú lateral
    document.querySelectorAll('.nav-links li a').forEach(a => a.classList.remove('active'));
    e.target.classList.add('active');
    
    // Cargar los datos de la DGI y gastos automáticamente
    cargarEstadoFinanciero();
});

// 2. Enviar el gasto (agua, luz, nómina) al servidor
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
        // Ojo: Si ya lo subiste a Render, cambia 'http://localhost:3000' por tu URL de Render
        const res = await fetch('http://localhost:3000/api/gastos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if(res.ok) {
            alert("¡Gasto operativo registrado exitosamente!");
            document.getElementById('form-registrar-gasto').reset();
            cargarEstadoFinanciero(); // Recargar la tabla con los nuevos datos
        } else {
            alert("Error al registrar el gasto en la base de datos.");
        }
    } catch(error) {
        console.error("Error de conexión:", error);
        alert("Fallo al conectar con el servidor.");
    }
}

// 3. Obtener el Estado de Resultados y actualizar el HTML
async function cargarEstadoFinanciero() {
    try {
        // Ojo: Igual aquí, si estás en producción, cambia el localhost por tu URL de Render
        const res = await fetch('http://localhost:3000/api/reportes/estado-financiero');
        const data = await res.json();

        // Función rápida para formatear dinero con 2 decimales
        const fmt = (num) => parseFloat(num).toFixed(2);

        // Inyectar los datos matemáticos en el HTML
        document.getElementById('fin-ingresos').textContent = fmt(data.ingresos);
        document.getElementById('fin-costos').textContent = fmt(data.costo_ventas);
        document.getElementById('fin-util-bruta').textContent = fmt(data.utilidad_bruta);
        document.getElementById('fin-cif').textContent = fmt(data.gastos_operativos);
        document.getElementById('fin-util-antes').textContent = fmt(data.utilidad_neta_antes);
        
        // Impuestos DGI (IVA 15% e IR 1%)
        document.getElementById('fin-ir').textContent = fmt(data.impuestos.ir_mensual);
        document.getElementById('fin-iva').textContent = fmt(data.impuestos.iva_debito);
        
        // Ganancia Real (Utilidad Líquida)
        document.getElementById('fin-liquida').textContent = fmt(data.utilidad_liquida);
        
        // Actualizar la fecha del reporte (Ej: Reporte de Septiembre 2026)
        const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        document.getElementById('lbl-mes-fiscal').textContent = `Reporte de ${meses[data.mes - 1]} ${data.anio}`;

    } catch (error) {
        console.error("Error cargando el estado financiero:", error);
    }
}