const express = require('express');
const sql = require('mssql');
const cors = require('cors');

const app = express();

// Configuración de middlewares
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }));
app.use(express.json());

// ==========================================
// CONFIGURACIÓN DE BASE DE DATOS AZURE SQL
// ==========================================
const dbConfig = {
    user: 'adminsory',
    password: process.env.DB_PASSWORD || 'sep.2311', // Asegúrate de tener esto en tu .env en Render
    server: 'servidor-adrian.database.windows.net',
    database: 'reposteria_sorydb',
    options: {
        encrypt: true,
        trustServerCertificate: false,
        connectTimeout: 30000
    }
};

// Inicializar la conexión a la base de datos
const poolPromise = sql.connect(dbConfig)
    .then(pool => {
        console.log("🚀 Conexión a Azure SQL establecida con éxito.");
        return pool;
    })
    .catch(err => {
        console.error("❌ Error al conectar con Azure SQL:", err);
        process.exit(1);
    });

// ==========================================
// MÓDULO: INSUMOS (Materia Prima y Kardex)
// ==========================================
app.get('/api/insumos', async (req, res) => {
    try {
        let pool = await poolPromise;
        let result = await pool.request().query('SELECT * FROM Insumos ORDER BY nombre ASC');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/insumos', async (req, res) => {
    try {
        const { nombre, unidad, precio } = req.body;
        let pool = await poolPromise;
        await pool.request()
            .input('nombre', sql.VarChar, nombre)
            .input('unidad', sql.VarChar, unidad)
            .input('precio', sql.Decimal(10, 2), precio)
            .query('INSERT INTO Insumos (nombre, unidad, precio, activo) VALUES (@nombre, @unidad, @precio, 1)');
        res.status(201).json({ message: 'Insumo creado correctamente' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/insumos/:id/estado', async (req, res) => {
    try {
        const { activo } = req.body;
        let pool = await poolPromise;
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('activo', sql.Bit, activo)
            .query('UPDATE Insumos SET activo = @activo WHERE id = @id');
        res.json({ message: 'Estado del insumo actualizado' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/insumos/:id/kardex', async (req, res) => {
    try {
        let pool = await poolPromise;
        let result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('SELECT * FROM Kardex_Insumos WHERE insumo_id = @id ORDER BY fecha DESC');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// MÓDULO: PROVEEDORES (Abonos, Deudas y Entregas)
// ==========================================
app.get('/api/proveedores', async (req, res) => {
    try {
        let pool = await poolPromise;
        let result = await pool.request().query(`
            SELECT p.*, 
            ISNULL((SELECT SUM(saldo_pendiente) FROM Compras_Proveedores WHERE proveedor_id = p.id AND estado_pago != 'PAGADO'), 0) as deuda_total 
            FROM Proveedores p ORDER BY p.nombre ASC
        `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/proveedores', async (req, res) => {
    try {
        const { nombre, telefono, entrega } = req.body;
        let pool = await poolPromise;
        await pool.request()
            .input('nombre', sql.VarChar, nombre)
            .input('telefono', sql.VarChar, telefono || null)
            .input('entrega', sql.Date, entrega || null)
            .query('INSERT INTO Proveedores (nombre, telefono, entrega, activo) VALUES (@nombre, @telefono, @entrega, 1)');
        res.status(201).json({ message: 'Proveedor registrado' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/proveedores/:id/abonar', async (req, res) => {
    try {
        const { monto } = req.body;
        let pool = await poolPromise;
        // Se aplica el abono al registro más antiguo pendiente
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('monto', sql.Decimal(10, 2), monto)
            .query(`
                UPDATE TOP (1) Compras_Proveedores 
                SET saldo_pendiente = saldo_pendiente - @monto 
                WHERE proveedor_id = @id AND estado_pago != 'PAGADO' AND saldo_pendiente > 0
            `);
        res.json({ message: 'Abono registrado correctamente' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/proveedores/:id/deuda', async (req, res) => {
    try {
        const { monto_deuda, fecha_entrega } = req.body;
        let pool = await poolPromise;
        
        if (fecha_entrega) {
            await pool.request()
                .input('id', sql.Int, req.params.id)
                .input('entrega', sql.Date, fecha_entrega)
                .query("UPDATE Proveedores SET entrega = @entrega WHERE id = @id");
        }
        
        if (monto_deuda > 0) {
            await pool.request()
                .input('id', sql.Int, req.params.id)
                .input('monto', sql.Decimal(10, 2), monto_deuda)
                .query(`
                    INSERT INTO Compras_Proveedores (proveedor_id, total_factura, estado_pago, saldo_pendiente, fecha_compra) 
                    VALUES (@id, @monto, 'PENDIENTE', @monto, GETDATE())
                `);
        }
        res.json({ message: 'Deuda y entrega actualizadas' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// MÓDULO: PRODUCTOS Y RECETAS
// ==========================================
app.get('/api/productos', async (req, res) => {
    try {
        let pool = await poolPromise;
        let result = await pool.request().query('SELECT * FROM Productos ORDER BY nombre ASC');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/productos', async (req, res) => {
    try {
        const { nombre, precio, categoria_id, stock } = req.body;
        let pool = await poolPromise;
        await pool.request()
            .input('nombre', sql.VarChar, nombre)
            .input('precio', sql.Decimal(10, 2), precio)
            .input('categoria_id', sql.Int, categoria_id || 1)
            .input('stock', sql.Int, stock || 0)
            .query('INSERT INTO Productos (nombre, precio, categoria_id, stock, activo) VALUES (@nombre, @precio, @categoria_id, @stock, 1)');
        res.status(201).json({ message: 'Producto creado' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// MÓDULO: GASTOS OPERATIVOS
// ==========================================
app.post('/api/gastos', async (req, res) => {
    try {
        const { tipo_gasto, monto_total, porcentaje_negocio, fecha, descripcion } = req.body;
        let pool = await poolPromise;
        await pool.request()
            .input('tipo', sql.VarChar, tipo_gasto)
            .input('monto', sql.Decimal(10, 2), monto_total)
            .input('porcentaje', sql.Decimal(5, 2), porcentaje_negocio)
            .input('fecha', sql.Date, fecha || new Date())
            .input('desc', sql.Text, descripcion || '')
            .query(`
                INSERT INTO Gastos_Operativos (tipo_gasto, monto_total, porcentaje_negocio, fecha_gasto, descripcion) 
                VALUES (@tipo, @monto, @porcentaje, @fecha, @desc)
            `);
        res.status(201).json({ message: 'Gasto registrado' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// MÓDULO: FINANZAS Y DGI (Blindado contra nulos)
// ==========================================
app.get('/api/reportes/estado-financiero', async (req, res) => {
    try {
        let pool = await poolPromise;
        const mes = req.query.mes || new Date().getMonth() + 1;
        const anio = req.query.anio || new Date().getFullYear();

        // Ingresos: Protegido con ISNULL
        let qVentas = await pool.request()
            .input('mes', sql.Int, mes)
            .input('anio', sql.Int, anio)
            .query('SELECT ISNULL(SUM(total), 0) as ingresos FROM Ventas WHERE MONTH(fecha) = @mes AND YEAR(fecha) = @anio');
        
        // Gastos Operativos CIF: Protegido con ISNULL
        let qGastos = await pool.request()
            .input('mes', sql.Int, mes)
            .input('anio', sql.Int, anio)
            .query('SELECT ISNULL(SUM(monto_total * (porcentaje_negocio / 100.0)), 0) as gastos FROM Gastos_Operativos WHERE MONTH(fecha_gasto) = @mes AND YEAR(fecha_gasto) = @anio');
        
        // Costo de Ventas (Recetas): Altamente protegido contra productos sin receta o ventas vacías
        let qCostos = await pool.request()
            .input('mes', sql.Int, mes)
            .input('anio', sql.Int, anio)
            .query(`
                SELECT ISNULL(SUM(vd.cantidad * ISNULL((
                    SELECT SUM(rd.cantidad_necesaria * i.precio) 
                    FROM Recetas_Detalle rd 
                    JOIN Insumos i ON rd.insumo_id = i.id 
                    WHERE rd.producto_id = vd.producto_id
                ), 0)), 0) as costo_ventas 
                FROM Ventas_Detalle vd 
                JOIN Ventas v ON vd.venta_id = v.id 
                WHERE MONTH(v.fecha) = @mes AND YEAR(v.fecha) = @anio
            `);

        let ingresos = parseFloat(qVentas.recordset[0].ingresos) || 0;
        let costo_ventas = parseFloat(qCostos.recordset[0].costo_ventas) || 0;
        let cif = parseFloat(qGastos.recordset[0].gastos) || 0;

        let utilidad_bruta = ingresos - costo_ventas;
        let utilidad_neta_antes = utilidad_bruta - cif;
        let ir_mensual = ingresos * 0.01; // Anticipo IR (1%)
        let iva_debito = ingresos * 0.15; // IVA (15%)
        let utilidad_liquida = utilidad_neta_antes - ir_mensual;

        res.json({
            mes, anio, 
            ingresos, 
            costo_ventas,
            utilidad_bruta, 
            cif,
            utilidad_neta_antes,
            impuestos: { iva_debito, ir_mensual },
            utilidad_liquida
        });
    } catch (err) {
        console.error("Fallo general en reporte financiero (Fallback activado):", err.message);
        // Si la tabla no existe o hay un fallo mayor, devuelve 0 en lugar de crashear el frontend
        res.json({
            mes: new Date().getMonth() + 1, anio: new Date().getFullYear(),
            ingresos: 0, costo_ventas: 0, utilidad_bruta: 0, cif: 0,
            utilidad_neta_antes: 0, impuestos: { iva_debito: 0, ir_mensual: 0 }, utilidad_liquida: 0
        });
    }
});

// ==========================================
// INICIO DEL SERVIDOR
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Servidor backend SIGECDEC-SORY corriendo en el puerto ${PORT}`);
});