const API_URL_FINANZAS = "https://sistema-pasteleria-sql.onrender.com/api";

window.cargarEstadoFinanciero = async function() {
    try {
        const res = await fetch(`${API_URL_FINANZAS}/reportes/estado-financiero`);
        const data = await res.json(); 

        const fmt = (num) => parseFloat(num || 0).toFixed(2);

        document.getElementById('fin-ingresos').textContent = fmt(data.ingresos);
        document.getElementById('fin-costos').textContent = fmt(data.costo_ventas);
        document.getElementById('fin-util-bruta').textContent = fmt(data.utilidad_bruta);
        document.getElementById('fin-cif').textContent = fmt(data.cif); 
        document.getElementById('fin-util-antes').textContent = fmt(data.utilidad_neta_antes);
        
        document.getElementById('fin-ir').textContent = fmt(data.impuestos?.ir_mensual);
        document.getElementById('fin-iva').textContent = fmt(data.impuestos?.iva_debito);
        document.getElementById('fin-liquida').textContent = fmt(data.utilidad_liquida);
        
    } catch (error) {
        console.error("Error cargando finanzas, aplicando fallback visual:", error);
        const elementos = ['fin-ingresos', 'fin-costos', 'fin-util-bruta', 'fin-cif', 'fin-util-antes', 'fin-ir', 'fin-iva', 'fin-liquida'];
        elementos.forEach(el => {
            const domEl = document.getElementById(el);
            if(domEl) domEl.textContent = "0.00";
        });
    }
};

// REPARACIÓN: Función para registrar los gastos operativos (restaurada)
window.guardarGastoCIF = async function(e) {
    e.preventDefault();
    const tipo_gasto = document.getElementById("gasto-tipo").value;
    const monto_total = parseFloat(document.getElementById("gasto-monto").value);
    const porcentaje_negocio = parseFloat(document.getElementById("gasto-porcentaje").value);
    const fecha = document.getElementById("gasto-fecha").value;

    try {
        const res = await fetch(`${API_URL_FINANZAS}/gastos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tipo_gasto, monto_total, porcentaje_negocio, fecha })
        });
        
        if (res.ok) {
            if(typeof mostrarNotificacion === 'function') mostrarNotificacion("Registrado", "El gasto operativo fue guardado.", "success");
            document.getElementById("form-registrar-gasto").reset();
            window.cargarEstadoFinanciero();
        } else {
            throw new Error("Fallo al guardar");
        }
    } catch (error) {
        console.error("Error guardando gasto:", error);
        if(typeof mostrarNotificacion === 'function') mostrarNotificacion("Error", "No se pudo guardar el gasto.", "error");
    }
};

document.getElementById('btn-ir-finanzas')?.addEventListener('click', (e) => {
    window.cargarEstadoFinanciero();
});