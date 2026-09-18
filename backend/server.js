const express = require('express');
const sql = require('mssql'); 
const cors = require('cors');

const app = express();

app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

const dbConfig = { 
    user: 'adminsory', 
    password: 'sep.2311', 
    server: 'servidor-adrian.database.windows.net', 
    database: 'reposteria_sorydb', 
    options: { encrypt: true, trustServerCertificate: false, connectTimeout: 30000 } 
};

const poolPromise = sql.connect(dbConfig)
    .then(pool => { console.log("🚀 Azure SQL OK!"); return pool; })
    .catch(err => { console.log("❌ Error:", err.message); });

// ==========================================
// 1. USUARIOS / EMPLEADOS (LOGIN)
// ==========================================
app.get('/api/empleados', async (req, res) => {
    try { let pool = await poolPromise; let result = await pool.request().query('SELECT id, nombre, cargo, activo FROM Empleados ORDER BY nombre'); res.json(result.recordset); } catch (err) { res.status(500).send(err.message); }
});
app.get('/api/empleados/:id', async (req, res) => {
    try { let pool = await poolPromise; let result = await pool.request().input('id', sql.Int, req.params.id).query('SELECT id, nombre, cargo, activo, contraseña FROM Empleados WHERE id = @id'); res.json(result.recordset[0] || {}); } catch (err) { res.status(500).send(err.message); }
});
app.post('/api/empleados', async (req, res) => {
    try { let pool = await poolPromise; await pool.request().input('nombre', sql.VarChar, req.body.nombre).input('cargo', sql.VarChar, req.body.cargo).input('pass', sql.VarChar, req.body.contraseña).query('INSERT INTO Empleados (nombre, cargo, contraseña) VALUES (@nombre, @cargo, @pass)'); res.status(201).send('OK'); } catch (err) { res.status(500).send(err.message); }
});
app.put('/api/empleados/:id', async (req, res) => {
    try { let pool = await poolPromise; let reqSql = pool.request().input('id', sql.Int, req.params.id);
        if (req.body.es_recuperacion || req.body.password) { reqSql.input('pass', sql.VarChar, req.body.password);
            if (req.body.nombre) { reqSql.input('nombre', sql.VarChar, req.body.nombre).input('cargo', sql.VarChar, req.body.cargo); await reqSql.query('UPDATE Empleados SET nombre = @nombre, cargo = @cargo, contraseña = @pass WHERE id = @id'); } 
            else { await reqSql.query('UPDATE Empleados SET contraseña = @pass WHERE id = @id'); }
        } else { reqSql.input('nombre', sql.VarChar, req.body.nombre).input('cargo', sql.VarChar, req.body.cargo); await reqSql.query('UPDATE Empleados SET nombre = @nombre, cargo = @cargo WHERE id = @id'); }
        res.status(200).send('OK'); } catch (err) { res.status(500).send(err.message); }
});
app.delete('/api/empleados/:id', async (req, res) => { try { let pool = await poolPromise; await pool.request().input('id', sql.Int, req.params.id).query('UPDATE Empleados SET activo = 0 WHERE id = @id'); res.status(200).send('OK'); } catch (err) { res.status(500).send(err.message); } });
app.put('/api/empleados/:id/reactivar', async (req, res) => { try { let pool = await poolPromise; await pool.request().input('id', sql.Int, req.params.id).query('UPDATE Empleados SET activo = 1 WHERE id = @id'); res.status(200).send('OK'); } catch (err) { res.status(500).send(err.message); } });

// ==========================================
// 2. PRODUCTOS Y CATEGORÍAS
// ==========================================
app.get('/api/categorias', async (req, res) => { try { let pool = await poolPromise; let result = await pool.request().query('SELECT * FROM categorias ORDER BY nombre'); res.json(result.recordset); } catch (err) { res.status(500).send(err.message); } });
app.get('/api/productos', async (req, res) => {
    try { let pool = await poolPromise; let result = await pool.request().query(`SELECT p.id, p.nombre, p.precio, p.categoria_id, p.stock, p.activo, p.fecha_vencimiento, c.nombre as nombre_categoria, ISNULL(SUM(rd.cantidad_necesaria * i.precio), 0) as costo_total FROM productos p LEFT JOIN categorias c ON p.categoria_id = c.id LEFT JOIN Recetas_Detalle rd ON p.id = rd.producto_id AND rd.activo = 1 LEFT JOIN Insumos i ON rd.insumo_id = i.id GROUP BY p.id, p.nombre, p.precio, p.categoria_id, p.stock, p.activo, p.fecha_vencimiento, c.nombre ORDER BY p.id DESC`);
        res.json(result.recordset.map(prod => ({ id: prod.id, nombre: prod.nombre, precio: prod.precio, costo: prod.costo_total, stock: prod.stock || 0, fecha_vencimiento: prod.fecha_vencimiento, activo: prod.activo, categoria_id: prod.categoria_id, categoria: prod.nombre_categoria ? { nombre: prod.nombre_categoria } : null }))); } catch (err) { res.status(500).send(err.message); }
});
app.get('/api/productos/:id/receta', async (req, res) => { try { let pool = await poolPromise; let result = await pool.request().input('id', sql.Int, req.params.id).query(`SELECT rd.insumo_id, i.nombre as nombre_insumo, i.unidad, i.precio as costo_unitario, rd.cantidad_necesaria, (rd.cantidad_necesaria * i.precio) as subtotal_costo FROM Recetas_Detalle rd JOIN Insumos i ON rd.insumo_id = i.id WHERE rd.producto_id = @id AND rd.activo = 1`); res.json(result.recordset); } catch (err) { res.status(500).send(err.message); } });
app.post('/api/productos', async (req, res) => {
    let transaction; try { let pool = await poolPromise; transaction = new sql.Transaction(pool); await transaction.begin();
        let resProd = await new sql.Request(transaction).input('nombre', sql.VarChar, req.body.nombre).input('precio', sql.Int, req.body.precio).input('categoria_id', sql.Int, req.body.categoria_id || null).query('INSERT INTO productos (nombre, precio, categoria_id, stock) OUTPUT INSERTED.id VALUES (@nombre, @precio, @categoria_id, 0)');
        if (req.body.receta && req.body.receta.length > 0) { for (let item of req.body.receta) { await new sql.Request(transaction).input('prod_id', sql.Int, resProd.recordset[0].id).input('ins_id', sql.Int, item.insumo_id).input('cant', sql.Decimal(10,4), item.cantidad_necesaria).query('INSERT INTO Recetas_Detalle (producto_id, insumo_id, cantidad_necesaria) VALUES (@prod_id, @ins_id, @cant)'); } }
        await transaction.commit(); res.status(201).send('OK'); } catch (err) { if(transaction) await transaction.rollback(); res.status(500).send(err.message); }
});
app.put('/api/productos/:id', async (req, res) => {
    let transaction; try { let pool = await poolPromise; transaction = new sql.Transaction(pool); await transaction.begin();
        await new sql.Request(transaction).input('id', sql.Int, req.params.id).input('nombre', sql.VarChar, req.body.nombre).input('precio', sql.Int, req.body.precio).input('categoria_id', sql.Int, req.body.categoria_id || null).query('UPDATE productos SET nombre = @nombre, precio = @precio, categoria_id = @categoria_id, fecha_actualizacion = GETDATE() WHERE id = @id');
        if (req.body.receta) { await new sql.Request(transaction).input('id', sql.Int, req.params.id).query('DELETE FROM Recetas_Detalle WHERE producto_id = @id');
            for (let item of req.body.receta) { await new sql.Request(transaction).input('prod_id', sql.Int, req.params.id).input('ins_id', sql.Int, item.insumo_id).input('cant', sql.Decimal(10,4), item.cantidad_necesaria).query('INSERT INTO Recetas_Detalle (producto_id, insumo_id, cantidad_necesaria) VALUES (@prod_id, @ins_id, @cant)'); } }
        await transaction.commit(); res.status(200).send('OK'); } catch (err) { if(transaction) await transaction.rollback(); res.status(500).send(err.message); }
});
app.delete('/api/productos/:id', async (req, res) => { try { let pool = await poolPromise; await pool.request().input('id', sql.Int, req.params.id).query('UPDATE productos SET activo = 0 WHERE id = @id'); res.status(200).send('OK'); } catch (err) { res.status(500).send(err.message); } });
app.put('/api/productos/:id/reactivar', async (req, res) => { try { let pool = await poolPromise; await pool.request().input('id', sql.Int, req.params.id).query('UPDATE productos SET activo = 1 WHERE id = @id'); res.status(200).send('OK'); } catch (err) { res.status(500).send(err.message); } });

// ==========================================
// 3. PRODUCCIÓN (HORNEAR)
// ==========================================
app.post('/api/produccion', async (req, res) => {
    let transaction; try { let pool = await poolPromise; transaction = new sql.Transaction(pool); await transaction.begin();
        let resReceta = await new sql.Request(transaction).input('p_id', sql.Int, req.body.producto_id).query(`SELECT rd.insumo_id, i.nombre, rd.cantidad_necesaria FROM Recetas_Detalle rd JOIN Insumos i ON rd.insumo_id = i.id WHERE rd.producto_id = @p_id AND rd.activo = 1`);
        if(resReceta.recordset.length === 0) { await new sql.Request(transaction).input('p_id', sql.Int, req.body.producto_id).input('cant', sql.Int, req.body.cantidad_producida).input('vence', sql.Date, req.body.fecha_vencimiento || null).query('UPDATE Productos SET stock = ISNULL(stock, 0) + @cant, fecha_vencimiento = @vence WHERE id = @p_id'); await transaction.commit(); return res.status(200).json({ success: true, tipo: 'directo' }); }
        for (let item of resReceta.recordset) { let gastoTotal = item.cantidad_necesaria * req.body.cantidad_producida;
            let resCheck = await new sql.Request(transaction).input('ins_id', sql.Int, item.insumo_id).query(`SELECT ISNULL((SELECT SUM(CASE WHEN tipo_movimiento = 'ENTRADA' THEN cantidad ELSE -cantidad END) FROM Kardex_Insumos WHERE insumo_id = @ins_id), 0) as stock`);
            if (resCheck.recordset[0].stock < gastoTotal) throw new Error(`¡Stock insuficiente! Faltan ${(gastoTotal - resCheck.recordset[0].stock).toFixed(2)} unidades de "${item.nombre}"`);
            await new sql.Request(transaction).input('ins_id', sql.Int, item.insumo_id).input('cant', sql.Decimal(10,4), gastoTotal).input('usu_id', sql.Int, req.body.usuario_id || null).input('motivo', sql.VarChar, `Producción de ${req.body.cantidad_producida} unid.`).query("INSERT INTO Kardex_Insumos (insumo_id, tipo_movimiento, cantidad, motivo, usuario_id) VALUES (@ins_id, 'SALIDA', @cant, @motivo, @usu_id)"); }
        await new sql.Request(transaction).input('p_id', sql.Int, req.body.producto_id).input('cant', sql.Int, req.body.cantidad_producida).input('vence', sql.Date, req.body.fecha_vencimiento || null).query('UPDATE Productos SET stock = ISNULL(stock, 0) + @cant, fecha_vencimiento = @vence WHERE id = @p_id');
        await transaction.commit(); res.status(200).json({ success: true, tipo: 'receta' }); } catch (err) { if(transaction) await transaction.rollback(); res.status(400).json({ success: false, mensaje: err.message }); }
});

// ==========================================
// 4. PROVEEDORES E INSUMOS
// ==========================================
app.get('/api/proveedores', async (req, res) => { try { let pool = await poolPromise; let result = await pool.request().query(`SELECT p.*, ISNULL((SELECT SUM(saldo_pendiente) FROM Compras_Proveedores WHERE proveedor_id = p.id AND estado_pago != 'PAGADO' AND activo = 1), 0) as deuda_total FROM proveedores p ORDER BY p.nombre`); res.json(result.recordset); } catch (err) { res.status(500).send(err.message); } });
app.post('/api/proveedores', async (req, res) => { try { let pool = await poolPromise; await pool.request().input('nombre', sql.VarChar, req.body.nombre).input('telefono', sql.VarChar, req.body.telefono || null).input('entrega', sql.Date, req.body.entrega || null).query('INSERT INTO proveedores (nombre, telefono, entrega) VALUES (@nombre, @telefono, @entrega)'); res.status(201).send('OK'); } catch (err) { res.status(500).send(err.message); } });
app.put('/api/proveedores/:id', async (req, res) => { try { let pool = await poolPromise; await pool.request().input('id', sql.Int, req.params.id).input('nombre', sql.VarChar, req.body.nombre).input('telefono', sql.VarChar, req.body.telefono || null).input('entrega', sql.Date, req.body.entrega || null).query('UPDATE proveedores SET nombre = @nombre, telefono = @telefono, entrega = @entrega WHERE id = @id'); res.status(200).send('OK'); } catch (err) { res.status(500).send(err.message); } });
app.delete('/api/proveedores/:id', async (req, res) => { try { let pool = await poolPromise; await pool.request().input('id', sql.Int, req.params.id).query('UPDATE proveedores SET activo = 0 WHERE id = @id'); res.status(200).send('OK'); } catch (err) { res.status(500).send(err.message); } });
app.put('/api/proveedores/:id/reactivar', async (req, res) => { try { let pool = await poolPromise; await pool.request().input('id', sql.Int, req.params.id).query('UPDATE proveedores SET activo = 1 WHERE id = @id'); res.status(200).send('OK'); } catch (err) { res.status(500).send(err.message); } });
app.post('/api/proveedores/:id/abonar', async (req, res) => { try { let pool = await poolPromise; await pool.request().input('id', sql.Int, req.params.id).input('monto', sql.Decimal(10,2), req.body.monto).query(`UPDATE TOP (1) Compras_Proveedores SET saldo_pendiente = saldo_pendiente - @monto WHERE proveedor_id = @id AND estado_pago != 'PAGADO' AND activo = 1`); res.status(200).send('OK'); } catch (err) { res.status(500).send(err.message); } });

app.get('/api/insumos', async (req, res) => { try { let pool = await poolPromise; let result = await pool.request().query(`SELECT i.*, p.nombre as nombre_proveedor, ISNULL((SELECT SUM(CASE WHEN tipo_movimiento = 'ENTRADA' THEN cantidad ELSE -cantidad END) FROM Kardex_Insumos WHERE insumo_id = i.id), 0) as stock_actual FROM insumos i LEFT JOIN proveedores p ON i.proveedor_id = p.id ORDER BY i.id`); res.json(result.recordset.map(ins => ({ id: ins.id, nombre: ins.nombre, unidad: ins.unidad, precio: ins.precio, stock_actual: ins.stock_actual, activo: ins.activo, proveedor_id: ins.proveedor_id, proveedores: ins.nombre_proveedor ? { nombre: ins.nombre_proveedor } : null }))); } catch (err) { res.status(500).send(err.message); } });
app.post('/api/insumos', async (req, res) => { try { let pool = await poolPromise; await pool.request().input('nombre', sql.VarChar, req.body.nombre).input('unidad', sql.VarChar, req.body.unidad).input('precio', sql.Int, req.body.precio).input('proveedor_id', sql.Int, req.body.proveedor_id || null).query('INSERT INTO insumos (nombre, unidad, precio, proveedor_id) VALUES (@nombre, @unidad, @precio, @proveedor_id)'); res.status(201).send('OK'); } catch (err) { res.status(500).send(err.message); } });
app.put('/api/insumos/:id', async (req, res) => { try { let pool = await poolPromise; await pool.request().input('id', sql.Int, req.params.id).input('nombre', sql.VarChar, req.body.nombre).input('unidad', sql.VarChar, req.body.unidad).input('precio', sql.Int, req.body.precio).input('proveedor_id', sql.Int, req.body.proveedor_id || null).query('UPDATE insumos SET nombre=@nombre, unidad=@unidad, precio=@precio, proveedor_id=@proveedor_id WHERE id=@id'); res.status(200).send('OK'); } catch (err) { res.status(500).send(err.message); } });
app.delete('/api/insumos/:id', async (req, res) => { try { let pool = await poolPromise; await pool.request().input('id', sql.Int, req.params.id).query('UPDATE insumos SET activo = 0 WHERE id = @id'); res.status(200).send('OK'); } catch (err) { res.status(500).send(err.message); } });
app.put('/api/insumos/:id/reactivar', async (req, res) => { try { let pool = await poolPromise; await pool.request().input('id', sql.Int, req.params.id).query('UPDATE insumos SET activo = 1 WHERE id = @id'); res.status(200).send('OK'); } catch (err) { res.status(500).send(err.message); } });
app.get('/api/insumos/:id/kardex', async (req, res) => { try { let pool = await poolPromise; let result = await pool.request().input('id', sql.Int, req.params.id).query(`SELECT k.fecha, k.tipo_movimiento, k.cantidad, k.motivo, ISNULL(e.nombre, 'Sistema') as usuario FROM Kardex_Insumos k LEFT JOIN Empleados e ON k.usuario_id = e.id WHERE k.insumo_id = @id ORDER BY k.fecha DESC`); res.json(result.recordset); } catch (err) { res.status(500).send(err.message); } });
app.post('/api/compras/rapida', async (req, res) => {
    let transaction; try { let pool = await poolPromise; transaction = new sql.Transaction(pool); await transaction.begin();
        let estadoPago = (req.body.tipo_pago === 'CONTADO') ? 'PAGADO' : 'PENDIENTE'; let deuda = (req.body.tipo_pago === 'CONTADO') ? 0 : req.body.costo_total;
        let resCompra = await new sql.Request(transaction).input('prov_id', sql.Int, req.body.proveedor_id).input('total', sql.Int, req.body.costo_total).input('estado', sql.VarChar, estadoPago).input('saldo', sql.Int, deuda).input('emp_id', sql.Int, req.body.empleado_id || null).query("INSERT INTO Compras_Proveedores (proveedor_id, total_factura, estado_pago, saldo_pendiente, empleado_id) OUTPUT INSERTED.id VALUES (@prov_id, @total, @estado, @saldo, @emp_id)");
        let compraId = resCompra.recordset[0].id;
        await new sql.Request(transaction).input('comp_id', sql.Int, compraId).input('ins_id', sql.Int, req.body.insumo_id).input('cant', sql.Decimal(10,4), req.body.cantidad).input('sub', sql.Int, req.body.costo_total).query("INSERT INTO Compras_Detalle (compra_id, insumo_id, cantidad, precio_unitario, subtotal) VALUES (@comp_id, @ins_id, @cant, 0, @sub)");
        await new sql.Request(transaction).input('ins_id', sql.Int, req.body.insumo_id).input('cant', sql.Decimal(10,4), req.body.cantidad).input('emp_id', sql.Int, req.body.empleado_id || null).input('motivo', sql.VarChar, `Compra Fac #${compraId}`).query("INSERT INTO Kardex_Insumos (insumo_id, tipo_movimiento, cantidad, motivo, usuario_id) VALUES (@ins_id, 'ENTRADA', @cant, @motivo, @emp_id)");
        await transaction.commit(); res.status(201).json({ success: true }); } catch (err) { if(transaction) await transaction.rollback(); res.status(500).send(err.message); }
});

// ==========================================
// 5. CLIENTES Y VENTAS (RUTAS RESTAURADAS)
// ==========================================
app.get('/api/clientes', async (req, res) => { try { let pool = await poolPromise; let result = await pool.request().query('SELECT * FROM clientes WHERE activo = 1'); res.json(result.recordset); } catch (err) { res.status(500).send(err.message); } });
app.post('/api/clientes', async (req, res) => { try { let pool = await poolPromise; let result = await pool.request().input('nombre', sql.VarChar, req.body.nombre).input('telefono', sql.VarChar, req.body.telefono || null).query('INSERT INTO clientes (nombre, telefono) OUTPUT INSERTED.id VALUES (@nombre, @telefono)'); res.status(201).json({ id: result.recordset[0].id }); } catch (err) { res.status(500).send(err.message); } });

app.get('/api/ventas', async (req, res) => { try { let pool = await poolPromise; let result = await pool.request().query("SELECT v.id, v.fecha, v.total, ISNULL(c.nombre, 'Consumidor Final') as cliente, ISNULL(e.nombre, 'Admin/Sistema') as empleado FROM Ventas v LEFT JOIN Clientes c ON v.cliente_id = c.id LEFT JOIN Empleados e ON v.empleado_id = e.id ORDER BY v.fecha DESC"); res.json(result.recordset); } catch (err) { res.status(500).send(err.message); } });
app.get('/api/ventas/:id/detalles', async (req, res) => { try { let pool = await poolPromise; let result = await pool.request().input('id', sql.Int, req.params.id).query('SELECT dv.cantidad, p.nombre, dv.subtotal, dv.precio_unitario FROM Ventas_Detalle dv INNER JOIN productos p ON dv.producto_id = p.id WHERE dv.venta_id = @id'); res.json(result.recordset); } catch (err) { res.status(500).send(err.message); } });
app.post('/api/ventas', async (req, res) => {
    let transaction; try { let pool = await poolPromise; transaction = new sql.Transaction(pool); await transaction.begin();
        let resCab = await new sql.Request(transaction).input('cliente_id', sql.Int, req.body.cliente_id || null).input('empleado_id', sql.Int, req.body.empleado_id || null).input('total', sql.Int, req.body.total).query('INSERT INTO Ventas (cliente_id, empleado_id, total) OUTPUT INSERTED.id VALUES (@cliente_id, @empleado_id, @total)');
        const nuevaVentaId = resCab.recordset[0].id;
        for (let item of req.body.detalles) { await new sql.Request(transaction).input('venta_id', sql.Int, nuevaVentaId).input('producto_id', sql.Int, item.producto_id).input('cantidad', sql.Int, item.cantidad).input('precio_unitario', sql.Int, item.precio_unitario).input('subtotal', sql.Int, item.subtotal).query('INSERT INTO Ventas_Detalle (venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES (@venta_id, @producto_id, @cantidad, @precio_unitario, @subtotal)'); }
        await transaction.commit(); res.status(201).json({ id: nuevaVentaId }); } catch (err) { if (transaction) await transaction.rollback(); res.status(500).send(err.message); }
});

// ==========================================
// 6. DASHBOARD Y FINANZAS (RUTAS RESTAURADAS)
// ==========================================
app.get('/api/dashboard/resumen', async (req, res) => { try { let pool = await poolPromise; let qDia = await pool.request().query("SELECT ISNULL(SUM(total), 0) as total FROM Ventas WHERE CAST(fecha as DATE) = CAST(GETDATE() as DATE)"); let qSemana = await pool.request().query("SELECT ISNULL(SUM(total), 0) as total FROM Ventas WHERE fecha >= DATEADD(day, -7, GETDATE())"); let qMes = await pool.request().query("SELECT ISNULL(SUM(total), 0) as total FROM Ventas WHERE MONTH(fecha) = MONTH(GETDATE()) AND YEAR(fecha) = YEAR(GETDATE())"); res.json({ dia: qDia.recordset[0].total, semana: qSemana.recordset[0].total, mes: qMes.recordset[0].total }); } catch (err) { res.status(500).send(err.message); } });
app.get('/api/dashboard/top-productos', async (req, res) => { try { let pool = await poolPromise; let result = await pool.request().query(`SELECT TOP 5 ISNULL(p.nombre, 'Producto Eliminado') as nombre, SUM(vd.cantidad) as total_vendido FROM Ventas_Detalle vd JOIN Ventas v ON vd.venta_id = v.id LEFT JOIN Productos p ON vd.producto_id = p.id WHERE MONTH(v.fecha) = MONTH(GETDATE()) AND YEAR(v.fecha) = YEAR(GETDATE()) GROUP BY p.nombre ORDER BY total_vendido DESC`); res.json(result.recordset); } catch (err) { res.status(500).send(err.message); } });
app.get('/api/dashboard/ventas-mes', async (req, res) => { try { let pool = await poolPromise; let result = await pool.request().query(`SELECT FORMAT(fecha, 'dd-MM') as dia, SUM(total) as total_dia FROM Ventas GROUP BY FORMAT(fecha, 'dd-MM'), CAST(fecha as DATE) ORDER BY CAST(fecha as DATE)`); res.json(result.recordset); } catch (err) { res.status(500).send(err.message); } });

app.get('/api/reportes/financiero', async (req, res) => { try { let pool = await poolPromise; let result = await pool.request().query(`SELECT ISNULL(p.nombre, 'Producto Eliminado') as producto, COUNT(DISTINCT v.id) as tickets, ISNULL(SUM(vd.cantidad), 0) as unidades, ISNULL(SUM(vd.subtotal), 0) as ingreso_total FROM Ventas_Detalle vd JOIN Ventas v ON vd.venta_id = v.id LEFT JOIN Productos p ON vd.producto_id = p.id GROUP BY ISNULL(p.nombre, 'Producto Eliminado') ORDER BY ingreso_total DESC`); res.json(result.recordset); } catch (err) { res.status(500).send(err.message); } });
app.get('/api/reportes/mensual', async (req, res) => { try { let pool = await poolPromise; let result = await pool.request().query(`SELECT RIGHT('0' + CAST(MONTH(fecha) AS VARCHAR(2)), 2) + '-' + CAST(YEAR(fecha) AS VARCHAR(4)) as mes, COUNT(id) as total_tickets, ISNULL(SUM(total), 0) as total_ganado FROM Ventas WHERE activo = 1 AND fecha IS NOT NULL GROUP BY YEAR(fecha), MONTH(fecha) ORDER BY YEAR(fecha) DESC, MONTH(fecha) DESC`); res.json(result.recordset); } catch (err) { res.status(500).send(err.message); } });
app.get('/api/reportes/corte-caja', async (req, res) => { try { let pool = await poolPromise; let rVentas = await pool.request().query("SELECT ISNULL(SUM(total), 0) as v FROM Ventas WHERE CAST(fecha as DATE) = CAST(GETDATE() as DATE)"); let rCompras = await pool.request().query("SELECT ISNULL(SUM(total_factura), 0) as c FROM Compras_Proveedores WHERE CAST(fecha_compra as DATE) = CAST(GETDATE() as DATE) AND estado_pago = 'PAGADO'"); res.json({ ventas: rVentas.recordset[0].v, gastos: rCompras.recordset[0].c, caja: (rVentas.recordset[0].v - rCompras.recordset[0].c) }); } catch(e) { res.status(500).send(e.message); } });

app.post('/api/finanzas/gastos', async (req, res) => { try { let pool = await poolPromise; await pool.request().input('tipo', sql.VarChar, req.body.tipo_gasto).input('monto', sql.Decimal(10,2), req.body.monto_total).input('porc', sql.Decimal(5,2), req.body.porcentaje_negocio).input('fecha', sql.Date, req.body.fecha).query('INSERT INTO Gastos_Operativos (tipo_gasto, monto_total, porcentaje_negocio, fecha_gasto) VALUES (@tipo, @monto, @porc, @fecha)'); res.status(201).send('OK'); } catch (err) { res.status(500).send(err.message); } });
app.get('/api/reportes/estado-financiero', async (req, res) => { 
    try { 
        let pool = await poolPromise; 
        const mes = req.query.mes || new Date().getMonth() + 1; 
        const anio = req.query.anio || new Date().getFullYear(); 

        let qVentas = await pool.request().input('mes', sql.Int, mes).input('anio', sql.Int, anio).query(`
            SELECT ISNULL(SUM(total), 0) as ingresos FROM Ventas WHERE MONTH(fecha) = @mes AND YEAR(fecha) = @anio
        `); 
        
        let qCostos = await pool.request().input('mes', sql.Int, mes).input('anio', sql.Int, anio).query(`
            SELECT ISNULL(SUM(vd.cantidad * ISNULL((SELECT SUM(rd.cantidad_necesaria * i.precio) FROM Recetas_Detalle rd JOIN Insumos i ON rd.insumo_id = i.id WHERE rd.producto_id = vd.producto_id), 0)), 0) as costo_ventas 
            FROM Ventas_Detalle vd JOIN Ventas v ON vd.venta_id = v.id WHERE MONTH(v.fecha) = @mes AND YEAR(v.fecha) = @anio
        `);

        let qGastos = await pool.request().input('mes', sql.Int, mes).input('anio', sql.Int, anio).query(`
            SELECT ISNULL(SUM(monto_total * (porcentaje_negocio / 100.0)), 0) as gastos 
            FROM Gastos_Operativos WHERE MONTH(fecha_gasto) = @mes AND YEAR(fecha_gasto) = @anio
        `); 

        let ingresos = parseFloat(qVentas.recordset[0].ingresos) || 0; 
        let costo_ventas = parseFloat(qCostos.recordset[0].costo_ventas) || 0; 
        let cif = parseFloat(qGastos.recordset[0].gastos) || 0; 

        res.json({ 
            mes, anio, ingresos, costo_ventas, 
            utilidad_bruta: ingresos - costo_ventas, cif: cif, 
            utilidad_neta_antes: (ingresos - costo_ventas) - cif, 
            impuestos: { iva_debito: ingresos * 0.15, ir_mensual: ingresos * 0.01 }, 
            utilidad_liquida: ((ingresos - costo_ventas) - cif) - (ingresos * 0.01) 
        }); 
    } catch (err) { 
        console.error("Error SQL en Finanzas:", err);
        res.status(500).json({ error: err.message }); 
    } 
});

app.listen(3000, () => console.log('✅ Servidor corriendo con todas las rutas en puerto 3000'));