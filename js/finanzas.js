// ==========================================
// LÓGICA DEL MÓDULO CONTABLE Y FISCAL (FORMATO DGI)
// Archivo: js/finanzas.js
// ==========================================

const API_URL_FIN = "https://sistema-pasteleria-sql.onrender.com/api"; 

// 1. Navegación: Mostrar la pantalla de finanzas al hacer clic en el menú
document.getElementById('btn-ir-finanzas')?.addEventListener('click', (e) => {
    e.preventDefault();
    
    document.querySelectorAll('main > section').forEach(sec => sec.style.display = 'none');
    
    const seccionFinanzas = document.getElementById('seccion-finanzas');
    if (seccionFinanzas) seccionFinanzas.style.display = 'block';
    
    document.querySelectorAll('.nav-links li a').forEach(a => a.classList.remove('active'));
    e.target.classList.add('active');
    
    cargarEstadoFinanciero();
});

// 2. Enviar el gasto al servidor
window.guardarGastoCIF = async function(event) {
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
};

// 3. Obtener el Estado de Resultados y actualizar el HTML
window.cargarEstadoFinanciero = async function() {
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
        const mesNombre = data.mes ? meses[data.mes - 1] : meses[new Date().getMonth()];
        const anioNum = data.anio || new Date().getFullYear();
        
        const lblMes = document.getElementById('lbl-mes-fiscal');
        if (lblMes) {
            lblMes.textContent = `Reporte de ${mesNombre} ${anioNum}`;
            
            // Inyectar el botón de PDF DGI si no existe
            if (!document.getElementById('btn-exportar-dgi-pdf')) {
                lblMes.insertAdjacentHTML('afterend', `
                    <button id="btn-exportar-dgi-pdf" class="btn btn-danger btn-sm mt-2 shadow-sm fw-bold" onclick="exportarDeclaratoriaPDF('${mesNombre}', '${anioNum}')">
                        <i class="bi bi-file-earmark-pdf-fill"></i> Exportar Declaratoria DGI
                    </button>
                `);
            }
        }

    } catch (error) {
        console.error("Error cargando el estado financiero:", error);
        mostrarNotificacion("Error de Reporte", "Hubo un problema al generar los cálculos financieros.", "error");
    }
};

// 4. Exportar el reporte a PDF con formato legal DGI
window.exportarDeclaratoriaPDF = function(mes, anio) {
    const fechaActual = new Date().toLocaleDateString();
    
    // Obtener los valores actuales del DOM
    const ingresos = document.getElementById('fin-ingresos').textContent;
    const ir = document.getElementById('fin-ir').textContent;
    const iva = document.getElementById('fin-iva').textContent;
    const utilLiquida = document.getElementById('fin-liquida').textContent;

    const contenidoHtml = `
    <div style="font-family: 'Arial', sans-serif; padding: 40px; color: #333; line-height: 1.6;">
        <div style="text-align: center; border-bottom: 3px solid #000; padding-bottom: 20px; margin-bottom: 30px;">
            <h1 style="margin: 0; font-size: 24px; text-transform: uppercase;">Gobierno de Reconciliación<br>y Unidad Nacional</h1>
            <h2 style="margin: 10px 0 0 0; font-size: 28px; font-weight: 900;">DGI</h2>
            <p style="margin: 5px 0; font-size: 16px; font-weight: bold;">APRENDAMOS A TRIBUTAR</p>
            <p style="margin: 5px 0; font-size: 14px;">Declaración Mensual de Impuestos - Repostería Sory</p>
        </div>

        <div style="margin-bottom: 20px;">
            <p><strong>Período Fiscal:</strong> ${mes} ${anio}</p>
            <p><strong>Fecha de Emisión:</strong> ${fechaActual}</p>
            <p style="text-align: justify;">El presente documento se emite bajo los principios generales de la tributación nicaragüense: <strong>Legalidad, Generalidad, Equidad, Suficiencia, Neutralidad y Simplicidad.</strong></p>
        </div>

        <h3 style="background-color: #f0f0f0; padding: 10px; border-left: 5px solid #333;">1. Rentas de Actividades Económicas (IR)</h3>
        <p style="text-align: justify; font-size: 12px; color: #555;">Grava los ingresos devengados o percibidos por un contribuyente que suministre bienes y servicios. Se aplica el Anticipo mensual a cuenta según el marco regulatorio.</p>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
                <td style="padding: 8px; border: 1px solid #ddd;">Base Imponible (Ingresos Brutos):</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-weight: bold;">C$ ${ingresos}</td>
            </tr>
            <tr>
                <td style="padding: 8px; border: 1px solid #ddd;">Anticipo Mensual a Cuenta (IR):</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-weight: bold; color: #d9534f;">C$ ${ir}</td>
            </tr>
        </table>

        <h3 style="background-color: #f0f0f0; padding: 10px; border-left: 5px solid #333;">2. Impuesto al Valor Agregado (IVA)</h3>
        <p style="text-align: justify; font-size: 12px; color: #555;">La base imponible del IVA es el precio pactado en la enajenación de bienes. Se aplica la Tasa General del 15% sobre las ventas gravadas.</p>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
                <td style="padding: 8px; border: 1px solid #ddd;">Débito Fiscal (IVA 15%):</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-weight: bold; color: #d9534f;">C$ ${iva}</td>
            </tr>
        </table>

        <h3 style="background-color: #f0f0f0; padding: 10px; border-left: 5px solid #333;">3. Impuesto de Timbres Fiscales</h3>
        <p style="text-align: justify; font-size: 12px; color: #555;">Tributo que recae sobre documentos expresamente contenidos en la Ley. Se aplica la tarifa para Certificaciones para acreditar pagos efectuados al Fisco.</p>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
            <tr>
                <td style="padding: 8px; border: 1px solid #ddd;">Certificación de Pago al Fisco:</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-weight: bold;">C$ 30.00</td>
            </tr>
        </table>

        <div style="border-top: 2px dashed #333; padding-top: 20px; text-align: right;">
            <h3 style="margin: 0; color: #333;">UTILIDAD LÍQUIDA DEL PERÍODO:</h3>
            <h2 style="margin: 5px 0 0 0; color: #28a745;">C$ ${utilLiquida}</h2>
        </div>
    </div>`;

    const ventana = window.open('', '_blank'); 
    ventana.document.write('<html><head><title>Declaratoria Fiscal DGI</title></head><body onload="setTimeout(function(){ window.print(); window.close(); }, 500);">'); 
    ventana.document.write(contenidoHtml); 
    ventana.document.write('</body></html>'); 
    ventana.document.close();
};