const API_URL_DASH = "https://sistema-pasteleria-sql.onrender.com/api";
let graficoVentasInstance = null;
let graficoTopInstance = null;

async function cargarResumenDashboard() {
    try {
        const respuesta = await fetch(`${API_URL_DASH}/dashboard/resumen`);
        if (!respuesta.ok) throw new Error("Fallo en la API de resumen");
        const datos = await respuesta.json();

        // Actualización segura de DOM
        const elDia = document.getElementById("ventas-dia");
        const elSemana = document.getElementById("ventas-semana");
        const elMes = document.getElementById("ventas-mes");

        if(elDia) elDia.innerText = `C$ ${parseFloat(datos.dia).toFixed(2)}`;
        if(elSemana) elSemana.innerText = `C$ ${parseFloat(datos.semana).toFixed(2)}`;
        if(elMes) elMes.innerText = `C$ ${parseFloat(datos.mes).toFixed(2)}`;
    } catch (error) {
        console.warn("Servidor inactivo o cargando resumen:", error);
    }
}

async function cargarGraficoVentasMes() {
    try {
        const canvas = document.getElementById('grafico-ventas');
        if (!canvas) return;

        const respuesta = await fetch(`${API_URL_DASH}/dashboard/ventas-mes`);
        if (!respuesta.ok) throw new Error("Fallo API grafico ventas");
        const datos = await respuesta.json();

        const ctx = canvas.getContext('2d');
        if (graficoVentasInstance) graficoVentasInstance.destroy();

        graficoVentasInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: datos.map(d => d.dia),
                datasets: [{
                    label: 'Ventas Diarias (C$)',
                    data: datos.map(d => d.total_dia),
                    borderColor: '#ff69b7',
                    backgroundColor: 'rgba(255, 105, 183, 0.2)',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    } catch (error) {
        console.warn("Cargando gráfico de ventas:", error);
    }
}

async function cargarGraficoTopProductos() {
    try {
        const canvas = document.getElementById('grafico-top-productos');
        if (!canvas) return;

        const respuesta = await fetch(`${API_URL_DASH}/dashboard/top-productos`);
        if (!respuesta.ok) throw new Error("Fallo API grafico top productos");
        const datos = await respuesta.json();

        const ctx = canvas.getContext('2d');
        if (graficoTopInstance) graficoTopInstance.destroy();

        graficoTopInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: datos.map(d => d.nombre),
                datasets: [{
                    label: 'Unidades Vendidas',
                    data: datos.map(d => d.total_vendido),
                    backgroundColor: ['#ffb84d', '#ff69b7', '#9b59b6', '#3498db', '#2ecc71'],
                    borderRadius: 5
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    } catch (error) {
        console.warn("Cargando gráfico top productos:", error);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    cargarResumenDashboard();
    cargarGraficoVentasMes();
    cargarGraficoTopProductos();
});