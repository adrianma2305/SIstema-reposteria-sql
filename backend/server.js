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
    password: process.env.DB_PASSWORD || 'sep.2311', 
    server: 'servidor-adrian.database.windows.net',
    database: 'reposteria_sorydb',
    options: {
        encrypt: true,
        trustServerCertificate: false,
        connectTimeout: 30000
    }
};

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
// 1. MÓDULO DE USUARIOS / EMPLEADOS (LOGIN)
// ==========================================
app.get('/api/empleados', async (req, res) => {
    try {
        let pool = await poolPromise;
        let result = await pool.request().query('SELECT id, nombre, cargo, activo FROM Empleados ORDER BY nombre');
        res.json(result.recordset);
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/empleados/:id', async (req, res) => {
    try {
        let pool = await poolPromise;
        let result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('SELECT id, nombre, cargo, activo, contraseña FROM Empleados WHERE id = @id');
        if (result.recordset.length > 0) res.json(result.recordset[0]);
        else res.status(404).send('Usuario no encontrado');
    } catch (err) { res.status(500).send(err.message); }
});

app.post('/api/empleados', async (req, res) => {
    try {
        const { nombre, cargo, contraseña } = req.body;
        let pool = await poolPromise;
        await pool.request()
            .input('nombre', sql.VarChar, nombre)
            .input('cargo', sql.VarChar, cargo)
            .input('pass', sql.VarChar, contraseña)
            .query('INSERT INTO Empleados (nombre, cargo, contraseña, activo) VALUES (@nombre, @cargo, @pass, 1)');
        res.status(201).send('OK');
    } catch (err) { res.status(500).send(err.message); }
});

app.put('/api/empleados/:id', async (req, res) => {
    try {
        const { nombre, cargo, password, es_recuperacion } = req.body;
        let pool = await poolPromise;
        let request = pool.request().input('id', sql.Int, req.params.id);

        if (es_recuperacion || password) {
            request.input('pass', sql.VarChar, password);
            if (nombre && cargo) {
                request.input('nombre', sql.VarChar, nombre).input('cargo', sql.VarChar, cargo);
                await request.query('UPDATE Empleados SET nombre = @nombre, cargo = @cargo, contraseña = @pass WHERE id = @id');
            } else {
                await request.query('UPDATE Empleados SET contraseña = @pass WHERE id = @id');
            }
        } else {
            request.input('nombre', sql.VarChar, nombre).input('cargo', sql.VarChar, cargo);
            await request.query('UPDATE Empleados SET nombre = @nombre, cargo = @cargo WHERE id = @id');
        }
        res.status(200).send('OK');
    } catch (err) { res.status(500).send(err.message); }
});

app.delete('/api/empleados/:id', async (req, res) => {
    try {
        let pool = await poolPromise;
        await pool.request().input('id', sql.Int, req.params.id).query('UPDATE Empleados SET activo = 0 WHERE id = @id');
        res.status(200).send('OK');
    } catch (err) { res.status(500).send(err.message); }
});

app.put('/api/empleados/:id/reactivar', async (req, res) => {
    try {
        let pool = await poolPromise;
        await pool.request().input('id', sql.Int, req.params.id).query('UPDATE Empleados SET activo = 1 WHERE id = @id');
        res.status(200).send('OK');
    } catch (err) { res.status(500).send(err.message); }
});

// ==========================================
// 2. MÓDULO DE INSUMOS Y KARDEX
// ==========================================
app.get('/api/insumos', async (req, res) => {
    try {
        let pool = await poolPromise;
        let result = await pool.request().query('SELECT * FROM Insumos ORDER BY nombre ASC');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/insumos', async (req, res) => {
    try {
        const { nombre, unidad, precio, proveedor_id } = req.body;
        let pool = await poolPromise;
        await pool.request()
            .input('nombre', sql.VarChar, nombre)
            .input('unidad', sql.VarChar, unidad)
            .input('precio', sql.Decimal(10, 2), precio)
            .input('prov_id', sql.Int, proveedor_id || null)
            .query('INSERT INTO Insumos (nombre, unidad, precio, proveedor_id, stock_actual, activo) VALUES (@nombre, @unidad, @precio, @prov_id, 0, 1)');
        res.status(201).json({ message: 'OK' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/insumos/:id', async (req, res) => {
    try {
        const { nombre, unidad, precio, proveedor_id } = req.body;
        let pool = await poolPromise;
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('nombre', sql.VarChar, nombre)
            .input('unidad', sql.VarChar, unidad)
            .input('precio', sql.Decimal(10, 2), precio)
            .input('prov_id', sql.Int, proveedor_id || null)
            .query('UPDATE Insumos SET nombre=@nombre, unidad=@unidad, precio=@precio, proveedor_id=@prov_id WHERE id=@id');
        res.json({ message: 'OK' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/insumos/:id', async (req, res) => {
    try {
        let pool = await poolPromise;
        await pool.request().input('id', sql.Int, req.params.id).query('UPDATE Insumos SET activo = 0 WHERE id = @id');
        res.json({ message: 'OK' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/insumos/:id/reactivar', async (req, res) => {
    try {
        let pool = await poolPromise;
        await pool.request().input('id', sql.Int, req.params.id).query('UPDATE Insumos SET activo = 1 WHERE id = @id');
        res.json({ message: 'OK' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/insumos/:id/kardex', async (req, res) => {
    try {
        let pool = await poolPromise;
        let result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('SELECT * FROM Kardex_Insumos WHERE insumo_id = @id ORDER BY fecha DESC');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/compras/rapida', async (req, res) => {
    try {
        const { proveedor_id, insumo_id, cantidad, costo_total, empleado_id, tipo_pago } = req.body;
        let pool = await poolPromise;
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            // Actualizar stock
            await transaction.request()
                .input('id', sql.Int, insumo_id)
                .input('cant', sql.Decimal(10, 2), cantidad)
                .query('UPDATE Insumos SET stock_actual = stock_actual + @cant WHERE id = @id');

            // Insertar movimiento Kardex
            await transaction.request()
                .input('insumo_id', sql.Int, insumo_id)
                .input('cant', sql.Decimal(10, 2), cantidad)
                .input('motivo', sql.VarChar, 'Compra Rápida')
                .query("INSERT INTO Kardex_Insumos (insumo_id, tipo_movimiento, cantidad, fecha, motivo) VALUES (@insumo_id, 'ENTRADA', @cant, GETDATE(), @motivo)");

            // Registrar Gasto o Deuda
            if(tipo_pago === 'CREDITO') {
                await transaction.request()
                    .input('prov_id', sql.Int, proveedor_id)
                    .input('total', sql.Decimal(10, 2), costo_total)
                    .query("INSERT INTO Compras_Proveedores (proveedor_id, total_factura, estado_pago, saldo_pendiente, fecha_compra) VALUES (@prov_id, @total, 'PENDIENTE', @total, GETDATE())");
            } else {
                await transaction.request()
                    .input('total', sql.Decimal(10, 2), costo_total)
                    .query("INSERT INTO Gastos_Operativos (tipo_gasto, monto_total, porcentaje_negocio, fecha_gasto, descripcion) VALUES ('COMPRA INSUMO', @total, 100, GETDATE(), 'Pago de contado mercadería')");
            }

            await transaction.commit();
            res.status(201).json({ message: 'OK' });
        } catch (err) {
            await transaction.rollback();
            res.status(500).json({ error: err.message });
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// 3. MÓDULO DE PROVEEDORES
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
    } catch (err) { res.status(500).json({ error: err.message }); }
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
        res.status(201).json({ message: 'OK' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/proveedores/:id', async (req, res) => {
    try {
        const { nombre, telefono, entrega } = req.body;
        let pool = await poolPromise;
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('nombre', sql.VarChar, nombre)
            .input('telefono', sql.VarChar, telefono || null)
            .input('entrega', sql.Date, entrega || null)
            .query('UPDATE Proveedores SET nombre=@nombre, telefono=@telefono, entrega=@entrega WHERE id=@id');
        res.json({ message: 'OK' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/proveedores/:id', async (req, res) => {
    try {
        let pool = await poolPromise;
        await pool.request().input('id', sql.Int, req.params.id).query('UPDATE Proveedores SET activo = 0 WHERE id = @id');
        res.json({ message: 'OK' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/proveedores/:id/reactivar', async (req, res) => {
    try {
        let pool = await poolPromise;
        await pool.request().input('id', sql.Int, req.params.id).query('UPDATE Proveedores SET activo = 1 WHERE id = @id');
        res.json({ message: 'OK' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/proveedores/:id/abonar', async (req, res) => {
    try {
        const { monto } = req.body;
        let pool = await poolPromise;
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('monto', sql.Decimal(10, 2), monto)
            .query(`
                UPDATE TOP (1) Compras_Proveedores 
                SET saldo_pendiente = saldo_pendiente - @monto 
                WHERE proveedor_id = @id AND estado_pago != 'PAGADO' AND saldo_pendiente > 0
            `);
        res.json({ message: 'OK' });
    } catch (err) { res.status(500).json({ error: err.message }); }
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
                .query("INSERT INTO Compras_Proveedores (proveedor_id, total_factura, estado_pago, saldo_pendiente, fecha_compra) VALUES (@id, @monto, 'PENDIENTE', @monto, GETDATE())");
        }
        res.json({ message: 'OK' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// =========================================
// 4. MÓDULO DE PRODUCTOS Y RECETAS
// =========================================
app.get('/api/productos', async (req, res) => {
    try {
        let pool = await poolPromise;
        let result = await pool.request().query('SELECT * FROM Productos ORDER BY nombre ASC');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/productos', async (req, res) => {
    try {
        const { nombre, precio, categoria_id, stock, receta } = req.body;
        let pool = await poolPromise;
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            let resultProd = await transaction.request()
                .input('nombre', sql.VarChar, nombre)
                .input('precio', sql.Decimal(10, 2), precio)
                .input('categoria_id', sql.Int, categoria_id || 1)
                .input('stock', sql.Int, stock || 0)
                .query('INSERT INTO Productos (nombre, precio, categoria_id, stock, activo) OUTPUT INSERTED.id VALUES (@nombre, @precio, @categoria_id, @stock, 1)');
            
            const producto_id = resultProd.recordset[0].id;

            if (receta && receta.length > 0) {
                for (let ins of receta) {
                    await transaction.request()
                        .input('prod_id', sql.Int, producto_id)
                        .input('ins_id', sql.Int, ins.insumo_id)
                        .input('cant', sql.Decimal(10, 4), ins.cantidad_necesaria)
                        .query('INSERT INTO Recetas_Detalle (producto_id, insumo_id, cantidad_necesaria) VALUES (@prod_id, @ins_id, @cant)');
                }
            }

            await transaction.commit();
            res.status(201).json({ message: 'OK' });
        } catch (err) {
            await transaction.rollback();
            res.status(500).json({ error: err.message });
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/productos/:id', async (req, res) => {
    try {
        const { nombre, precio, categoria_id } = req.body;
        let pool = await poolPromise;
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('nombre', sql.VarChar, nombre)
            .input('precio', sql.Decimal(10, 2), precio)
            .input('cat', sql.Int, categoria_id || 1)
            .query('UPDATE Productos SET nombre=@nombre, precio=@precio, categoria_id=@cat WHERE id=@id');
        res.json({ message: 'OK' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/productos/:id', async (req, res) => {
    try {
        let pool = await poolPromise;
        await pool.request().input('id', sql.Int, req.params.id).query('UPDATE Productos SET activo = 0 WHERE id = @id');
        res.json({ message: 'OK' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/productos/:id/reactivar', async (req, res) => {
    try {
        let pool = await poolPromise;
        await pool.request().input('id', sql.Int, req.params.id).query('UPDATE Productos SET activo = 1 WHERE id = @id');
        res.json({ message: 'OK' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// 5. MÓDULO DE VENTAS Y CLIENTES
// ==========================================
app.post('/api/clientes', async (req, res) => {
    try {
        const { nombre, telefono } = req.body;
        let pool = await poolPromise;
        let result = await pool.request()
            .input('nombre', sql.VarChar, nombre)
            .input('telefono', sql.VarChar, telefono)
            .query('INSERT INTO Clientes (nombre, telefono) OUTPUT INSERTED.id VALUES (@nombre, @telefono)');
        res.status(201).json({ id: result.recordset[0].id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/ventas', async (req, res) => {
    try {
        const { cliente_id, empleado_id, total, detalles } = req.body;
        let pool = await poolPromise;
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            let resultVenta = await transaction.request()
                .input('cli', sql.Int, cliente_id || null)
                .input('emp', sql.Int, empleado_id || null)
                .input('total', sql.Decimal(10, 2), total)
                .query('INSERT INTO Ventas (cliente_id, empleado_id, total, fecha) OUTPUT INSERTED.id VALUES (@cli, @emp, @total, GETDATE())');
            
            const venta_id = resultVenta.recordset[0].id;

            for (let item of detalles) {
                // Registrar detalle de venta
                await transaction.request()
                    .input('venta_id', sql.Int, venta_id)
                    .input('prod_id', sql.Int, item.producto_id)
                    .input('cant', sql.Int, item.cantidad)
                    .input('precio', sql.Decimal(10, 2), item.precio_unitario)
                    .input('subtotal', sql.Decimal(10, 2), item.subtotal)
                    .query('INSERT INTO Ventas_Detalle (venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES (@venta_id, @prod_id, @cant, @precio, @subtotal)');
                
                // Descontar Stock de Producto
                await transaction.request()
                    .input('prod_id', sql.Int, item.producto_id)
                    .input('cant', sql.Int, item.cantidad)
                    .query('UPDATE Productos SET stock = stock - @cant WHERE id = @prod_id');
            }

            await transaction.commit();
            res.status(201).json({ id: venta_id, message: 'Venta completada' });
        } catch (err) {
            await transaction.rollback();
            res.status(500).json({ error: err.message });
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/ventas', async (req, res) => {
    try {
        let pool = await poolPromise;
        let result = await pool.request().query(`
            SELECT v.id, v.fecha, v.total, 
                   ISNULL(c.nombre, 'Consumidor Final') as cliente, 
                   ISNULL(e.nombre, 'Admin') as empleado
            FROM Ventas v
            LEFT JOIN Clientes c ON v.cliente_id = c.id
            LEFT JOIN Empleados e ON v.empleado_id = e.id
            ORDER BY v.fecha DESC
        `);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/ventas/:id/detalles', async (req, res) => {
    try {
        let pool = await poolPromise;
        let result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query(`
                SELECT vd.cantidad, vd.precio_unitario, vd.subtotal, p.nombre 
                FROM Ventas_Detalle vd 
                JOIN Productos p ON vd.producto_id = p.id 
                WHERE vd.venta_id = @id
            `);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// 6. FINANZAS Y GASTOS
// ==========================================
app.post('/api/gastos', async (req, res) => {
    try {
        const { tipo_gasto, monto_total, porcentaje_negocio, fecha } = req.body;
        let pool = await poolPromise;
        await pool.request()
            .input('tipo', sql.VarChar, tipo_gasto)
            .input('monto', sql.Decimal(10, 2), monto_total)
            .input('porcentaje', sql.Decimal(5, 2), porcentaje_negocio)
            .input('fecha', sql.Date, fecha || new Date())
            .query("INSERT INTO Gastos_Operativos (tipo_gasto, monto_total, porcentaje_negocio, fecha_gasto, descripcion) VALUES (@tipo, @monto, @porcentaje, @fecha, 'Registro Manual')");
        res.status(201).json({ message: 'OK' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/reportes/estado-financiero', async (req, res) => {
    try {
        let pool = await poolPromise;
        const mes = req.query.mes || new Date().getMonth() + 1;
        const anio = req.query.anio || new Date().getFullYear();

        let qVentas = await pool.request().input('mes', sql.Int, mes).input('anio', sql.Int, anio)
            .query('SELECT ISNULL(SUM(total), 0) as ingresos FROM Ventas WHERE MONTH(fecha) = @mes AND YEAR(fecha) = @anio');
        
        let qGastos = await pool.request().input('mes', sql.Int, mes).input('anio', sql.Int, anio)
            .query('SELECT ISNULL(SUM(monto_total * (porcentaje_negocio / 100.0)), 0) as gastos FROM Gastos_Operativos WHERE MONTH(fecha_gasto) = @mes AND YEAR(fecha_gasto) = @anio');
        
        let qCostos = await pool.request().input('mes', sql.Int, mes).input('anio', sql.Int, anio)
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
        let ir_mensual = ingresos * 0.01; 
        let iva_debito = ingresos * 0.15; 
        let utilidad_liquida = utilidad_neta_antes - ir_mensual;

        res.json({ mes, anio, ingresos, costo_ventas, utilidad_bruta, cif, utilidad_neta_antes, impuestos: { iva_debito, ir_mensual }, utilidad_liquida });
    } catch (err) {
        res.json({ mes: 1, anio: 2026, ingresos: 0, costo_ventas: 0, utilidad_bruta: 0, cif: 0, utilidad_neta_antes: 0, impuestos: { iva_debito: 0, ir_mensual: 0 }, utilidad_liquida: 0 });
    }
});

app.get('/api/reportes/corte-caja', async (req, res) => {
    try {
        let pool = await poolPromise;
        let rVentas = await pool.request().query('SELECT ISNULL(SUM(total), 0) as total FROM Ventas WHERE CAST(fecha AS DATE) = CAST(GETDATE() AS DATE)');
        let rGastos = await pool.request().query("SELECT ISNULL(SUM(monto_total), 0) as total FROM Gastos_Operativos WHERE CAST(fecha_gasto AS DATE) = CAST(GETDATE() AS DATE) AND descripcion LIKE '%contado%'");
        
        let ventas = rVentas.recordset[0].total || 0;
        let gastos = rGastos.recordset[0].total || 0;
        res.json({ ventas, gastos, caja: ventas - gastos });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// 7. DASHBOARD Y GRAFICOS
// ==========================================
app.get('/api/dashboard/resumen', async (req, res) => {
    try {
        let pool = await poolPromise;
        let rDia = await pool.request().query("SELECT ISNULL(SUM(total), 0) as t FROM Ventas WHERE CAST(fecha AS DATE) = CAST(GETDATE() AS DATE)");
        let rSem = await pool.request().query("SELECT ISNULL(SUM(total), 0) as t FROM Ventas WHERE fecha >= DATEADD(day, -7, GETDATE())");
        let rMes = await pool.request().query("SELECT ISNULL(SUM(total), 0) as t FROM Ventas WHERE MONTH(fecha) = MONTH(GETDATE())");
        res.json({ dia: rDia.recordset[0].t, semana: rSem.recordset[0].t, mes: rMes.recordset[0].t });
    } catch (err) { res.json({ dia: 0, semana: 0, mes: 0 }); }
});

app.get('/api/dashboard/ventas-mes', async (req, res) => {
    try {
        let pool = await poolPromise;
        let result = await pool.request().query(`
            SELECT DAY(fecha) as dia, SUM(total) as total_dia 
            FROM Ventas WHERE MONTH(fecha) = MONTH(GETDATE()) 
            GROUP BY DAY(fecha) ORDER BY dia ASC
        `);
        res.json(result.recordset.length > 0 ? result.recordset : [{ dia: 1, total_dia: 0 }]);
    } catch (err) { res.json([{ dia: 1, total_dia: 0 }]); }
});

app.get('/api/dashboard/top-productos', async (req, res) => {
    try {
        let pool = await poolPromise;
        let result = await pool.request().query(`
            SELECT TOP 5 p.nombre, SUM(vd.cantidad) as total_vendido 
            FROM Ventas_Detalle vd JOIN Productos p ON vd.producto_id = p.id 
            GROUP BY p.nombre ORDER BY total_vendido DESC
        `);
        res.json(result.recordset);
    } catch (err) { res.json([]); }
});

app.get('/api/reportes/financiero', async (req, res) => {
    try {
        let pool = await poolPromise;
        let result = await pool.request().query(`
            SELECT p.nombre as producto, COUNT(vd.venta_id) as tickets, SUM(vd.cantidad) as unidades, SUM(vd.subtotal) as ingreso_total 
            FROM Ventas_Detalle vd JOIN Productos p ON vd.producto_id = p.id 
            GROUP BY p.nombre ORDER BY ingreso_total DESC
        `);
        res.json(result.recordset);
    } catch (err) { res.json([]); }
});

app.get('/api/reportes/mensual', async (req, res) => {
    try {
        let pool = await poolPromise;
        let result = await pool.request().query(`
            SELECT FORMAT(fecha, 'MM-yyyy') as mes, COUNT(id) as total_tickets, SUM(total) as total_ganado 
            FROM Ventas GROUP BY FORMAT(fecha, 'MM-yyyy') ORDER BY mes DESC
        `);
        res.json(result.recordset);
    } catch (err) { res.json([]); }
});

// ==========================================
// INICIO DEL SERVIDOR
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Servidor backend SIGECDEC-SORY corriendo en el puerto ${PORT}`);
});