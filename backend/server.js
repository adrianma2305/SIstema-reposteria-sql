const express = require('express');
const sql = require('mssql'); 
const cors = require('cors');

const app = express();

// --- CONFIGURACIÓN CORS ---
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// --- CONFIGURACIÓN BASE DE DATOS AZURE ---
const dbConfig = { 
    user: 'adminsory', 
    password: 'sep.2311', 
    server: 'servidor-adrian.database.windows.net', 
    database: 'reposteria_sorydb', 
    options: { encrypt: true, trustServerCertificate: false, connectTimeout: 30000 } 
};

const poolPromise = sql.connect(dbConfig)
    .then(pool => { 
        console.log("🚀 Azure SQL OK!"); 
        return pool; 
    })
    .catch(err => { 
        console.log("❌ Error:", err.message); 
    });

// ==========================================
// MÓDULO DE PRODUCTOS E INVENTARIO
// ==========================================

app.get('/api/productos', async (req, res) => {
    try {
        let pool = await poolPromise;
        let result = await pool.request().query(`
            SELECT p.id, p.nombre, p.precio, p.categoria_id, p.stock, p.activo, p.fecha_vencimiento,
                   c.nombre as nombre_categoria, ISNULL(SUM(rd.cantidad_necesaria * i.precio), 0) as costo_total 
            FROM productos p 
            LEFT JOIN categorias c ON p.categoria_id = c.id 
            LEFT JOIN Recetas_Detalle rd ON p.id = rd.producto_id AND rd.activo = 1 
            LEFT JOIN Insumos i ON rd.insumo_id = i.id 
            GROUP BY p.id, p.nombre, p.precio, p.categoria_id, p.stock, p.activo, p.fecha_vencimiento, c.nombre 
            ORDER BY p.id DESC
        `);
        
        const formated = result.recordset.map(prod => ({ 
            id: prod.id, nombre: prod.nombre, precio: prod.precio, costo: prod.costo_total, 
            stock: prod.stock || 0, fecha_vencimiento: prod.fecha_vencimiento, activo: prod.activo, 
            categoria_id: prod.categoria_id, categoria: prod.nombre_categoria ? { nombre: prod.nombre_categoria } : null 
        }));
        
        res.json(formated);
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/productos/:id/receta', async (req, res) => { 
    try { 
        let pool = await poolPromise; 
        let result = await pool.request().input('id', sql.Int, req.params.id).query(`
            SELECT rd.insumo_id, i.nombre as nombre_insumo, i.unidad, i.precio as costo_unitario, rd.cantidad_necesaria, 
            (rd.cantidad_necesaria * i.precio) as subtotal_costo 
            FROM Recetas_Detalle rd JOIN Insumos i ON rd.insumo_id = i.id 
            WHERE rd.producto_id = @id AND rd.activo = 1
        `); 
        res.json(result.recordset); 
    } catch (err) { res.status(500).send(err.message); } 
});

app.post('/api/productos', async (req, res) => { 
    let transaction; 
    try { 
        const { nombre, precio, categoria_id, receta } = req.body; 
        let pool = await poolPromise; 
        transaction = new sql.Transaction(pool); 
        await transaction.begin(); 
        
        let reqProd = new sql.Request(transaction); 
        let resProd = await reqProd
            .input('nombre', sql.VarChar, nombre)
            .input('precio', sql.Int, precio)
            .input('categoria_id', sql.Int, categoria_id || null)
            .query('INSERT INTO productos (nombre, precio, categoria_id, stock) OUTPUT INSERTED.id VALUES (@nombre, @precio, @categoria_id, 0)'); 
            
        let nuevoId = resProd.recordset[0].id; 
        
        if (receta && receta.length > 0) { 
            for (let item of receta) { 
                let reqRec = new sql.Request(transaction); 
                await reqRec
                    .input('prod_id', sql.Int, nuevoId)
                    .input('ins_id', sql.Int, item.insumo_id)
                    .input('cant', sql.Decimal(10,4), item.cantidad_necesaria)
                    .query('INSERT INTO Recetas_Detalle (producto_id, insumo_id, cantidad_necesaria) VALUES (@prod_id, @ins_id, @cant)'); 
            } 
        } 
        await transaction.commit(); 
        res.status(201).send('OK'); 
    } catch (err) { 
        if(transaction) await transaction.rollback(); 
        res.status(500).send(err.message); 
    } 
});

app.put('/api/productos/:id', async (req, res) => { 
    let transaction; 
    try { 
        const id = req.params.id; 
        const { nombre, precio, categoria_id, receta } = req.body; 
        let pool = await poolPromise; 
        transaction = new sql.Transaction(pool); 
        await transaction.begin(); 
        
        let reqProd = new sql.Request(transaction); 
        await reqProd
            .input('id', sql.Int, id).input('nombre', sql.VarChar, nombre).input('precio', sql.Int, precio).input('categoria_id', sql.Int, categoria_id || null)
            .query('UPDATE productos SET nombre = @nombre, precio = @precio, categoria_id = @categoria_id, fecha_actualizacion = GETDATE() WHERE id = @id'); 
            
        if (receta) { 
            let reqDel = new sql.Request(transaction); 
            await reqDel.input('id', sql.Int, id).query('DELETE FROM Recetas_Detalle WHERE producto_id = @id'); 
            
            for (let item of receta) { 
                let reqRec = new sql.Request(transaction); 
                await reqRec
                    .input('prod_id', sql.Int, id).input('ins_id', sql.Int, item.insumo_id).input('cant', sql.Decimal(10,4), item.cantidad_necesaria)
                    .query('INSERT INTO Recetas_Detalle (producto_id, insumo_id, cantidad_necesaria) VALUES (@prod_id, @ins_id, @cant)'); 
            } 
        } 
        await transaction.commit(); 
        res.status(200).send('OK'); 
    } catch (err) { 
        if(transaction) await transaction.rollback(); 
        res.status(500).send(err.message); 
    } 
});

app.delete('/api/productos/:id', async (req, res) => { 
    try { 
        let pool = await poolPromise; 
        await pool.request().input('id', sql.Int, req.params.id).query('UPDATE productos SET activo = 0 WHERE id = @id'); 
        res.status(200).send('OK'); 
    } catch (err) { res.status(500).send(err.message); } 
});

app.put('/api/productos/:id/reactivar', async (req, res) => { 
    try { 
        let pool = await poolPromise; 
        await pool.request().input('id', sql.Int, req.params.id).query('UPDATE productos SET activo = 1 WHERE id = @id'); 
        res.status(200).send('OK'); 
    } catch (err) { res.status(500).send(err.message); } 
});

// ==========================================
// MÓDULO DE PRODUCCIÓN Y CADUCIDAD
// ==========================================

app.post('/api/produccion', async (req, res) => { 
    let transaction; 
    try { 
        const { producto_id, cantidad_producida, usuario_id, fecha_vencimiento } = req.body; 
        let pool = await poolPromise; 
        transaction = new sql.Transaction(pool); 
        await transaction.begin(); 
        
        let reqReceta = new sql.Request(transaction); 
        let resReceta = await reqReceta.input('p_id', sql.Int, producto_id).query(`
            SELECT rd.insumo_id, i.nombre, rd.cantidad_necesaria 
            FROM Recetas_Detalle rd JOIN Insumos i ON rd.insumo_id = i.id 
            WHERE rd.producto_id = @p_id AND rd.activo = 1
        `); 
        
        if(resReceta.recordset.length === 0) { 
            let reqStock = new sql.Request(transaction); 
            await reqStock
                .input('p_id', sql.Int, producto_id).input('cant', sql.Int, cantidad_producida).input('vence', sql.Date, fecha_vencimiento || null)
                .query('UPDATE Productos SET stock = ISNULL(stock, 0) + @cant, fecha_vencimiento = @vence WHERE id = @p_id'); 
                
            await transaction.commit(); 
            return res.status(200).json({ success: true, tipo: 'directo' }); 
        } 
        
        for (let item of resReceta.recordset) { 
            let gastoTotal = item.cantidad_necesaria * cantidad_producida; 
            
            let reqCheck = new sql.Request(transaction); 
            let resCheck = await reqCheck.input('ins_id', sql.Int, item.insumo_id).query(`
                SELECT ISNULL((SELECT SUM(CASE WHEN tipo_movimiento = 'ENTRADA' THEN cantidad ELSE -cantidad END) FROM Kardex_Insumos WHERE insumo_id = @ins_id), 0) as stock
            `); 
            
            if (resCheck.recordset[0].stock < gastoTotal) { 
                throw new Error(`¡Stock insuficiente! Faltan ${(gastoTotal - resCheck.recordset[0].stock).toFixed(2)} unidades de "${item.nombre}"`); 
            } 
            
            let reqKardex = new sql.Request(transaction); 
            await reqKardex
                .input('ins_id', sql.Int, item.insumo_id).input('cant', sql.Decimal(10,4), gastoTotal).input('usu_id', sql.Int, usuario_id || null)
                .input('motivo', sql.VarChar, `Producción de ${cantidad_producida} unid.`)
                .query("INSERT INTO Kardex_Insumos (insumo_id, tipo_movimiento, cantidad, motivo, usuario_id) VALUES (@ins_id, 'SALIDA', @cant, @motivo, @usu_id)"); 
        } 
        
        let reqStock = new sql.Request(transaction); 
        await reqStock
            .input('p_id', sql.Int, producto_id).input('cant', sql.Int, cantidad_producida).input('vence', sql.Date, fecha_vencimiento || null)
            .query('UPDATE Productos SET stock = ISNULL(stock, 0) + @cant, fecha_vencimiento = @vence WHERE id = @p_id'); 
            
        await transaction.commit(); 
        res.status(200).json({ success: true, tipo: 'receta' }); 
    } catch (err) { 
        if(transaction) await transaction.rollback(); 
        res.status(400).json({ success: false, mensaje: err.message }); 
    } 
});

// ==========================================
// MÓDULO DE PROVEEDORES E INSUMOS
// ==========================================

app.get('/api/proveedores', async (req, res) => { 
    try { 
        let pool = await poolPromise; 
        let result = await pool.request().query(`
            SELECT p.*, ISNULL((SELECT SUM(saldo_pendiente) FROM Compras_Proveedores WHERE proveedor_id = p.id AND estado_pago != 'PAGADO' AND activo = 1), 0) as deuda_total 
            FROM proveedores p ORDER BY p.nombre
        `); 
        res.json(result.recordset); 
    } catch (err) { res.status(500).send(err.message); } 
});

app.post('/api/proveedores', async (req, res) => { 
    try { 
        const { nombre, telefono, entrega } = req.body; 
        let pool = await poolPromise; 
        await pool.request()
            .input('nombre', sql.VarChar, nombre).input('telefono', sql.VarChar, telefono || null).input('entrega', sql.Date, entrega || null)
            .query('INSERT INTO proveedores (nombre, telefono, entrega) VALUES (@nombre, @telefono, @entrega)'); 
        res.status(201).send('OK'); 
    } catch (err) { res.status(500).send(err.message); } 
});

app.put('/api/proveedores/:id', async (req, res) => { 
    try { 
        const { nombre, telefono, entrega } = req.body; 
        let pool = await poolPromise; 
        await pool.request()
            .input('id', sql.Int, req.params.id).input('nombre', sql.VarChar, nombre).input('telefono', sql.VarChar, telefono || null).input('entrega', sql.Date, entrega || null)
            .query('UPDATE proveedores SET nombre = @nombre, telefono = @telefono, entrega = @entrega, fecha_actualizacion = GETDATE() WHERE id = @id'); 
        res.status(200).send('OK'); 
    } catch (err) { res.status(500).send(err.message); } 
});

app.get('/api/insumos', async (req, res) => { 
    try { 
        let pool = await poolPromise; 
        let result = await pool.request().query(`
            SELECT i.*, p.nombre as nombre_proveedor, 
                   ISNULL((SELECT SUM(CASE WHEN tipo_movimiento = 'ENTRADA' THEN cantidad ELSE -cantidad END) FROM Kardex_Insumos WHERE insumo_id = i.id), 0) as stock_actual 
            FROM insumos i LEFT JOIN proveedores p ON i.proveedor_id = p.id ORDER BY i.id
        `); 
        const formated = result.recordset.map(ins => ({ 
            id: ins.id, nombre: ins.nombre, unidad: ins.unidad, precio: ins.precio, stock_actual: ins.stock_actual, 
            activo: ins.activo, proveedor_id: ins.proveedor_id, proveedores: ins.nombre_proveedor ? { nombre: ins.nombre_proveedor } : null 
        })); 
        res.json(formated); 
    } catch (err) { res.status(500).send(err.message); } 
});

app.post('/api/insumos', async (req, res) => { 
    try { 
        const { nombre, unidad, precio, proveedor_id } = req.body; 
        let pool = await poolPromise; 
        await pool.request()
            .input('nombre', sql.VarChar, nombre).input('unidad', sql.VarChar, unidad || null)
            .input('precio', sql.Int, precio || null).input('proveedor_id', sql.Int, proveedor_id || null)
            .query('INSERT INTO insumos (nombre, unidad, precio, proveedor_id) VALUES (@nombre, @unidad, @precio, @proveedor_id)'); 
        res.status(201).send('OK'); 
    } catch (err) { res.status(500).send(err.message); } 
});

// ==========================================
// MÓDULO DE VENTAS Y FACTURACIÓN
// ==========================================

app.get('/api/ventas', async (req, res) => { 
    try { 
        let pool = await poolPromise; 
        let result = await pool.request().query(`
            SELECT v.id, v.fecha, v.total, ISNULL(c.nombre, 'Consumidor Final') as cliente, ISNULL(e.nombre, 'Admin') as empleado 
            FROM Ventas v LEFT JOIN Clientes c ON v.cliente_id = c.id LEFT JOIN Empleados e ON v.empleado_id = e.id ORDER BY v.fecha DESC
        `); 
        res.json(result.recordset); 
    } catch (err) { res.status(500).send(err.message); } 
});

app.post('/api/ventas', async (req, res) => { 
    let transaction; 
    try { 
        const { cliente_id, empleado_id, total, detalles } = req.body; 
        let pool = await poolPromise; 
        transaction = new sql.Transaction(pool); 
        await transaction.begin(); 
        
        const reqCab = new sql.Request(transaction); 
        let resCab = await reqCab
            .input('cliente_id', sql.Int, cliente_id || null).input('empleado_id', sql.Int, empleado_id || null).input('total', sql.Int, total)
            .query('INSERT INTO Ventas (cliente_id, empleado_id, total) OUTPUT INSERTED.id VALUES (@cliente_id, @empleado_id, @total)'); 
            
        const nuevaVentaId = resCab.recordset[0].id; 
        
        for (let item of detalles) { 
            const reqDet = new sql.Request(transaction); 
            await reqDet
                .input('venta_id', sql.Int, nuevaVentaId).input('producto_id', sql.Int, item.producto_id)
                .input('cantidad', sql.Int, item.cantidad).input('precio_unitario', sql.Int, item.precio_unitario).input('subtotal', sql.Int, item.subtotal)
                .query('INSERT INTO Ventas_Detalle (venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES (@venta_id, @producto_id, @cantidad, @precio_unitario, @subtotal)'); 
        } 
        await transaction.commit(); 
        res.status(201).json({ id: nuevaVentaId }); 
    } catch (err) { 
        if (transaction) await transaction.rollback(); 
        res.status(500).send(err.message); 
    } 
});

// ==========================================
// DASHBOARD, GRÁFICOS Y FINANZAS (RUTAS CORREGIDAS)
// ==========================================

app.get('/api/dashboard/resumen', async (req, res) => { 
    try { 
        let pool = await poolPromise; 
        let qDia = await pool.request().query("SELECT ISNULL(SUM(total), 0) as total FROM Ventas WHERE CAST(fecha as DATE) = CAST(GETDATE() as DATE)"); 
        let qSemana = await pool.request().query("SELECT ISNULL(SUM(total), 0) as total FROM Ventas WHERE fecha >= DATEADD(day, -7, GETDATE())"); 
        let qMes = await pool.request().query("SELECT ISNULL(SUM(total), 0) as total FROM Ventas WHERE MONTH(fecha) = MONTH(GETDATE()) AND YEAR(fecha) = YEAR(GETDATE())"); 
        res.json({ dia: qDia.recordset[0].total, semana: qSemana.recordset[0].total, mes: qMes.recordset[0].total }); 
    } catch (err) { res.status(500).send(err.message); } 
});

app.get('/api/dashboard/top-productos', async (req, res) => { 
    try { 
        let pool = await poolPromise; 
        let result = await pool.request().query(`
            SELECT TOP 5 ISNULL(p.nombre, 'Producto Eliminado') as nombre, SUM(vd.cantidad) as total_vendido 
            FROM Ventas_Detalle vd JOIN Ventas v ON vd.venta_id = v.id LEFT JOIN Productos p ON vd.producto_id = p.id 
            WHERE MONTH(v.fecha) = MONTH(GETDATE()) AND YEAR(v.fecha) = YEAR(GETDATE()) 
            GROUP BY p.nombre ORDER BY total_vendido DESC
        `); 
        res.json(result.recordset); 
    } catch (err) { res.status(500).send(err.message); } 
});

app.get('/api/dashboard/ventas-mes', async (req, res) => { 
    try { 
        let pool = await poolPromise; 
        let result = await pool.request().query(`
            SELECT FORMAT(fecha, 'dd-MM') as dia, SUM(total) as total_dia 
            FROM Ventas 
            GROUP BY FORMAT(fecha, 'dd-MM'), CAST(fecha as DATE) ORDER BY CAST(fecha as DATE)
        `); 
        res.json(result.recordset); 
    } catch (err) { res.status(500).send(err.message); } 
});

app.get('/api/reportes/estado-financiero', async (req, res) => {
    try {
        let pool = await poolPromise;
        const mes = req.query.mes || new Date().getMonth() + 1;
        const anio = req.query.anio || new Date().getFullYear();

        let qVentas = await pool.request().input('mes', sql.Int, mes).input('anio', sql.Int, anio).query(`
            SELECT ISNULL(SUM(v.total), 0) as ingresos 
            FROM Ventas v WHERE MONTH(v.fecha) = @mes AND YEAR(v.fecha) = @anio
        `);
        
        let ingresos = parseFloat(qVentas.recordset[0].ingresos); 
        
        
        let costo_ventas = ingresos * 0.35; // Estimación base del 35% de costo de materia prima ajustable

        res.json({ 
            mes, 
            anio, 
            ingresos, 
            costo_ventas, 
            utilidad_bruta: ingresos - costo_ventas 
        });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

// ==========================================
// MÓDULO DE USUARIOS / EMPLEADOS (LOGIN)
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
        if (result.recordset.length > 0) {
            res.json(result.recordset[0]);
        } else {
            res.status(404).send('Usuario no encontrado');
        }
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
            .query('INSERT INTO Empleados (nombre, cargo, contraseña) VALUES (@nombre, @cargo, @pass)');
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

app.listen(3000, () => console.log('✅ Servidor corriendo en el puerto 3000'));