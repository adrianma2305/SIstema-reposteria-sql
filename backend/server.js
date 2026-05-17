const express = require('express');
const sql = require('mssql'); 
const cors = require('cors');

const app = express();
app.use(cors()); 
app.use(express.json());

// --- 1. CONFIGURACION DE BASE DE DATOS (AZURE) ---
const dbConfig = {
    user: 'adminsory',
    password: 'sep.23059', 
    server: 'servidor-adrian.database.windows.net', 
    database: 'PasteleriaDB',
    options: {
        encrypt: true, 
        trustServerCertificate: false,
        connectTimeout: 30000 
    }
};

const poolPromise = sql.connect(dbConfig).then(pool => {
    console.log("🚀 ¡Conectado a la nube de Azure SQL Database con éxito!");
    return pool;
}).catch(err => {
    console.log("❌ Error al conectar a la BD en Azure: ", err.message);
});

// --- 2. RUTAS DE EMPLEADOS ---
app.get('/api/empleados', async (req, res) => {
    try {
        let pool = await poolPromise; 
        let result = await pool.request().query('SELECT id, nombre, cargo FROM empleados WHERE activo = 1 ORDER BY nombre');
        res.json(result.recordset);
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/empleados/:id', async (req, res) => {
    try {
        const id = req.params.id;
        let pool = await poolPromise;
        let result = await pool.request().input('id', sql.Int, id).query('SELECT * FROM empleados WHERE id = @id AND activo = 1');
        if (result.recordset.length > 0) res.json(result.recordset[0]);
        else res.status(404).send('Usuario no encontrado');
    } catch (err) { res.status(500).send(err.message); }
});

app.put('/api/empleados/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, cargo, password, es_recuperacion } = req.body;
        let pool = await poolPromise;

        if (es_recuperacion) {
            if (!password) return res.status(400).send("Faltan datos");
            let result = await pool.request()
                .input('id', sql.Int, id)
                .input('pass', sql.VarChar, password)
                .query('UPDATE Empleados SET contraseña = @pass WHERE id = @id');
            if (result.rowsAffected[0] === 0) return res.status(404).send("Empleado no encontrado");
            return res.json({ success: true, message: "Contraseña actualizada" });
        } else {
            let query = 'UPDATE Empleados SET nombre = @nombre, cargo = @cargo';
            if (password) query += ', contraseña = @pass';
            query += ' WHERE id = @id';

            let peticion = pool.request()
                .input('id', sql.Int, id)
                .input('nombre', sql.VarChar, nombre)
                .input('cargo', sql.VarChar, cargo);
            
            if (password) peticion.input('pass', sql.VarChar, password);

            let result = await peticion.query(query);
            if (result.rowsAffected[0] === 0) return res.status(404).send("Empleado no encontrado");
            return res.json({ success: true, message: "Usuario actualizado" });
        }
    } catch (err) { res.status(500).send(err.message); }
});

app.post('/api/empleados', async (req, res) => {
    try {
        const { nombre, cargo, contraseña } = req.body;
        if (!nombre || !cargo || !contraseña) return res.status(400).send("Faltan datos");

        let pool = await poolPromise;
        await pool.request()
            .input('nombre', sql.VarChar, nombre)
            .input('cargo', sql.VarChar, cargo)
            .input('pass', sql.VarChar, contraseña)
            .query('INSERT INTO Empleados (nombre, cargo, contraseña, activo) VALUES (@nombre, @cargo, @pass, 1)');
        res.status(201).json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

app.delete('/api/empleados/:id', async (req, res) => {
    try {
        const id = req.params.id;
        let pool = await poolPromise;
        await pool.request().input('id', sql.Int, id).query('UPDATE empleados SET activo = 0 WHERE id = @id');
        res.status(200).send('Empleado eliminado');
    } catch (err) { res.status(500).send(err.message); }
});

// --- 3. RUTAS DE CATEGORIAS ---
app.get('/api/categorias', async (req, res) => {
    try {
        let pool = await poolPromise;
        let result = await pool.request().query('SELECT * FROM categorias ORDER BY nombre');
        res.json(result.recordset);
    } catch (err) { res.status(500).send(err.message); }
});

// --- 4. RUTAS DE PRODUCTOS Y RECETAS ---
app.get('/api/productos', async (req, res) => {
    try {
        let pool = await poolPromise;
        let result = await pool.request().query(`
            SELECT p.id, p.nombre, p.precio, p.categoria_id, c.nombre as nombre_categoria,
                   ISNULL(SUM(rd.cantidad_necesaria * i.precio), 0) as costo_total
            FROM productos p 
            LEFT JOIN categorias c ON p.categoria_id = c.id
            LEFT JOIN Recetas_Detalle rd ON p.id = rd.producto_id AND rd.activo = 1
            LEFT JOIN Insumos i ON rd.insumo_id = i.id
            WHERE p.activo = 1
            GROUP BY p.id, p.nombre, p.precio, p.categoria_id, c.nombre
            ORDER BY p.id DESC
        `);
        
        const formated = result.recordset.map(prod => ({
            id: prod.id,
            nombre: prod.nombre,
            precio: prod.precio,
            costo: prod.costo_total,
            categoria_id: prod.categoria_id,
            categoria: prod.nombre_categoria ? { nombre: prod.nombre_categoria } : null
        }));
        res.json(formated);
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/productos/:id/receta', async (req, res) => {
    try {
        let pool = await poolPromise;
        let result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query(`
                SELECT rd.insumo_id, i.nombre as nombre_insumo, i.unidad, i.precio as costo_unitario, 
                       rd.cantidad_necesaria, (rd.cantidad_necesaria * i.precio) as subtotal_costo
                FROM Recetas_Detalle rd
                JOIN Insumos i ON rd.insumo_id = i.id
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
            .query('INSERT INTO productos (nombre, precio, categoria_id) OUTPUT INSERTED.id VALUES (@nombre, @precio, @categoria_id)');
            
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
            .input('id', sql.Int, id)
            .input('nombre', sql.VarChar, nombre)
            .input('precio', sql.Int, precio)
            .input('categoria_id', sql.Int, categoria_id || null)
            .query('UPDATE productos SET nombre = @nombre, precio = @precio, categoria_id = @categoria_id, fecha_actualizacion = GETDATE() WHERE id = @id');

        if (receta) {
            let reqDel = new sql.Request(transaction);
            await reqDel.input('id', sql.Int, id).query('DELETE FROM Recetas_Detalle WHERE producto_id = @id');

            for (let item of receta) {
                let reqRec = new sql.Request(transaction);
                await reqRec
                    .input('prod_id', sql.Int, id)
                    .input('ins_id', sql.Int, item.insumo_id)
                    .input('cant', sql.Decimal(10,4), item.cantidad_necesaria)
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

// --- PRODUCCION (HORNEAR) ---
app.post('/api/produccion', async (req, res) => {
    let transaction;
    try {
        const { producto_id, cantidad_producida, usuario_id } = req.body;
        let pool = await poolPromise;
        transaction = new sql.Transaction(pool);
        await transaction.begin();

        let reqReceta = new sql.Request(transaction);
        let resReceta = await reqReceta.input('p_id', sql.Int, producto_id).query('SELECT insumo_id, cantidad_necesaria FROM Recetas_Detalle WHERE producto_id = @p_id AND activo = 1');
        
        if(resReceta.recordset.length === 0) throw new Error("El producto no tiene receta armada.");

        for (let item of resReceta.recordset) {
            let gastoTotal = item.cantidad_necesaria * cantidad_producida;
            let reqKardex = new sql.Request(transaction);
            await reqKardex
                .input('ins_id', sql.Int, item.insumo_id)
                .input('cant', sql.Decimal(10,4), gastoTotal)
                .input('usu_id', sql.Int, usuario_id || null)
                .input('motivo', sql.VarChar, `Producción de ${cantidad_producida} unidades`)
                .query("INSERT INTO Kardex_Insumos (insumo_id, tipo_movimiento, cantidad, motivo, usuario_id) VALUES (@ins_id, 'SALIDA', @cant, @motivo, @usu_id)");
        }

        await transaction.commit();
        res.status(200).json({ success: true });
    } catch (err) {
        if(transaction) await transaction.rollback();
        res.status(500).send(err.message);
    }
});

// --- 5. PROVEEDORES ---
app.get('/api/proveedores', async (req, res) => {
    try {
        let pool = await poolPromise;
        let result = await pool.request().query('SELECT * FROM proveedores WHERE activo = 1 ORDER BY id');
        res.json(result.recordset);
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/proveedores/:id', async (req, res) => {
    try {
        const id = req.params.id;
        let pool = await poolPromise;
        let result = await pool.request().input('id', sql.Int, id).query('SELECT * FROM proveedores WHERE id = @id AND activo = 1');
        if (result.recordset.length > 0) res.json(result.recordset[0]);
        else res.status(404).send('Proveedor no encontrado');
    } catch (err) { res.status(500).send(err.message); }
});

app.post('/api/proveedores', async (req, res) => {
    try {
        const { nombre, telefono, entrega } = req.body;
        let pool = await poolPromise;
        await pool.request()
            .input('nombre', sql.VarChar, nombre)
            .input('telefono', sql.VarChar, telefono || null)
            .input('entrega', sql.Date, entrega || null)
            .query('INSERT INTO proveedores (nombre, telefono, entrega) VALUES (@nombre, @telefono, @entrega)');
        res.status(201).send('Proveedor agregado');
    } catch (err) { res.status(500).send(err.message); }
});

app.put('/api/proveedores/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const { nombre, telefono, entrega } = req.body;
        let pool = await poolPromise;
        await pool.request()
            .input('id', sql.Int, id)
            .input('nombre', sql.VarChar, nombre)
            .input('telefono', sql.VarChar, telefono || null)
            .input('entrega', sql.Date, entrega || null)
            .query('UPDATE proveedores SET nombre = @nombre, telefono = @telefono, entrega = @entrega, fecha_actualizacion = GETDATE() WHERE id = @id');
        res.status(200).send('Proveedor actualizado');
    } catch (err) { res.status(500).send(err.message); }
});

app.delete('/api/proveedores/:id', async (req, res) => {
    try {
        const id = req.params.id;
        let pool = await poolPromise;
        await pool.request().input('id', sql.Int, id).query('UPDATE proveedores SET activo = 0 WHERE id = @id');
        res.status(200).send('Proveedor eliminado lógicamente');
    } catch (err) { res.status(500).send(err.message); }
});

// --- 6. INSUMOS Y KARDEX (FASE 2) ---
app.get('/api/insumos', async (req, res) => {
    try {
        let pool = await poolPromise;
        let result = await pool.request().query(`
            SELECT i.*, p.nombre as nombre_proveedor,
                   ISNULL((SELECT SUM(CASE WHEN tipo_movimiento = 'ENTRADA' THEN cantidad ELSE -cantidad END) 
                           FROM Kardex_Insumos WHERE insumo_id = i.id), 0) as stock_actual
            FROM insumos i 
            LEFT JOIN proveedores p ON i.proveedor_id = p.id 
            WHERE i.activo = 1
            ORDER BY i.id
        `);
        
        const insumosFormateados = result.recordset.map(ins => ({
            id: ins.id, nombre: ins.nombre, unidad: ins.unidad, precio: ins.precio, stock_actual: ins.stock_actual,
            proveedor_id: ins.proveedor_id, proveedores: ins.nombre_proveedor ? { nombre: ins.nombre_proveedor } : null
        }));
        res.json(insumosFormateados);
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/insumos/:id', async (req, res) => {
    try {
        let pool = await poolPromise;
        let result = await pool.request().input('id', sql.Int, req.params.id).query('SELECT * FROM insumos WHERE id = @id AND activo = 1');
        res.json(result.recordset[0]);
    } catch (err) { res.status(500).send(err.message); }
});

app.post('/api/insumos', async (req, res) => {
    try {
        const { nombre, unidad, precio, proveedor_id } = req.body;
        let pool = await poolPromise;
        await pool.request().input('nombre', sql.VarChar, nombre).input('unidad', sql.VarChar, unidad || null).input('precio', sql.Int, precio || null).input('proveedor_id', sql.Int, proveedor_id || null).query('INSERT INTO insumos (nombre, unidad, precio, proveedor_id) VALUES (@nombre, @unidad, @precio, @proveedor_id)');
        res.status(201).send('OK');
    } catch (err) { res.status(500).send(err.message); }
});

app.put('/api/insumos/:id', async (req, res) => {
    try {
        const { nombre, unidad, precio, proveedor_id } = req.body;
        let pool = await poolPromise;
        await pool.request().input('id', sql.Int, req.params.id).input('nombre', sql.VarChar, nombre).input('unidad', sql.VarChar, unidad || null).input('precio', sql.Int, precio || null).input('proveedor_id', sql.Int, proveedor_id || null).query('UPDATE insumos SET nombre = @nombre, unidad = @unidad, precio = @precio, proveedor_id = @proveedor_id, fecha_actualizacion = GETDATE() WHERE id = @id');
        res.status(200).send('OK');
    } catch (err) { res.status(500).send(err.message); }
});

app.delete('/api/insumos/:id', async (req, res) => {
    try {
        let pool = await poolPromise;
        await pool.request().input('id', sql.Int, req.params.id).query('UPDATE insumos SET activo = 0 WHERE id = @id');
        res.status(200).send('OK');
    } catch (err) { res.status(500).send(err.message); }
});

// Obtener Historial Kardex de un insumo
app.get('/api/kardex/:insumo_id', async (req, res) => {
    try {
        let pool = await poolPromise;
        let result = await pool.request()
            .input('id', sql.Int, req.params.insumo_id)
            .query(`SELECT k.*, ISNULL(e.nombre, 'Sistema') as usuario FROM Kardex_Insumos k LEFT JOIN Empleados e ON k.usuario_id = e.id WHERE k.insumo_id = @id ORDER BY k.fecha DESC`);
        res.json(result.recordset);
    } catch (err) { res.status(500).send(err.message); }
});

// Registrar Compra de Mercadería (Suma stock y crea deuda)
app.post('/api/compras/rapida', async (req, res) => {
    let transaction;
    try {
        const { proveedor_id, insumo_id, cantidad, costo_total, empleado_id } = req.body;
        let pool = await poolPromise;
        transaction = new sql.Transaction(pool);
        await transaction.begin();

        let reqCompra = new sql.Request(transaction);
        let resCompra = await reqCompra
            .input('prov_id', sql.Int, proveedor_id)
            .input('total', sql.Int, costo_total)
            .input('emp_id', sql.Int, empleado_id || null)
            .query("INSERT INTO Compras_Proveedores (proveedor_id, total_factura, estado_pago, saldo_pendiente, empleado_id) OUTPUT INSERTED.id VALUES (@prov_id, @total, 'PENDIENTE', @total, @emp_id)");
        
        const compraId = resCompra.recordset[0].id;

        let reqDet = new sql.Request(transaction);
        await reqDet
            .input('comp_id', sql.Int, compraId)
            .input('ins_id', sql.Int, insumo_id)
            .input('cant', sql.Decimal(10,4), cantidad)
            .input('sub', sql.Int, costo_total)
            .query("INSERT INTO Compras_Detalle (compra_id, insumo_id, cantidad, precio_unitario, subtotal) VALUES (@comp_id, @ins_id, @cant, 0, @sub)");

        let reqKardex = new sql.Request(transaction);
        await reqKardex
            .input('ins_id', sql.Int, insumo_id)
            .input('cant', sql.Decimal(10,4), cantidad)
            .input('emp_id', sql.Int, empleado_id || null)
            .input('motivo', sql.VarChar, `Compra Ingresada Fac #${compraId}`)
            .query("INSERT INTO Kardex_Insumos (insumo_id, tipo_movimiento, cantidad, motivo, usuario_id) VALUES (@ins_id, 'ENTRADA', @cant, @motivo, @emp_id)");

        await transaction.commit();
        res.status(201).json({ success: true });
    } catch (err) {
        if(transaction) await transaction.rollback();
        res.status(500).send(err.message);
    }
});

// --- 7. CLIENTES Y VENTAS ---
app.get('/api/clientes', async (req, res) => {
    try {
        let pool = await poolPromise;
        let nombre = req.query.nombre;
        if(nombre) {
            let result = await pool.request().input('nombre', sql.VarChar, `%${nombre}%`).query('SELECT * FROM clientes WHERE nombre LIKE @nombre AND activo = 1');
            res.json(result.recordset);
        } else {
            let result = await pool.request().query('SELECT * FROM clientes WHERE activo = 1');
            res.json(result.recordset);
        }
    } catch (err) { res.status(500).send(err.message); }
});

app.post('/api/clientes', async (req, res) => {
    try {
        const { nombre, telefono } = req.body;
        let pool = await poolPromise;
        let result = await pool.request().input('nombre', sql.VarChar, nombre).input('telefono', sql.VarChar, telefono || null).query('INSERT INTO clientes (nombre, telefono) OUTPUT INSERTED.id VALUES (@nombre, @telefono)');
        res.status(201).json({ id: result.recordset[0].id });
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/ventas', async (req, res) => {
    try {
        let pool = await poolPromise;
        let result = await pool.request().query("SELECT v.id, v.fecha, v.total, ISNULL(c.nombre, 'Consumidor Final') as cliente, ISNULL(e.nombre, 'Admin/Sistema') as empleado FROM Ventas v LEFT JOIN Clientes c ON v.cliente_id = c.id LEFT JOIN Empleados e ON v.empleado_id = e.id WHERE v.activo = 1 ORDER BY v.fecha DESC");
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
        let resCab = await reqCab.input('cliente_id', sql.Int, cliente_id || null).input('empleado_id', sql.Int, empleado_id || null).input('total', sql.Int, total).query('INSERT INTO Ventas (cliente_id, empleado_id, total) OUTPUT INSERTED.id VALUES (@cliente_id, @empleado_id, @total)');
        const nuevaVentaId = resCab.recordset[0].id;

        for (let item of detalles) {
            const reqDet = new sql.Request(transaction);
            await reqDet.input('venta_id', sql.Int, nuevaVentaId).input('producto_id', sql.Int, item.producto_id).input('cantidad', sql.Int, item.cantidad).input('precio_unitario', sql.Int, item.precio_unitario).input('subtotal', sql.Int, item.subtotal).query('INSERT INTO Ventas_Detalle (venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES (@venta_id, @producto_id, @cantidad, @precio_unitario, @subtotal)');
        }
        await transaction.commit();
        res.status(201).json({ id: nuevaVentaId });
    } catch (err) { 
        if (transaction) await transaction.rollback();
        res.status(500).send(err.message); 
    }
});

app.get('/api/ventas/:id/detalles', async (req, res) => {
    try {
        let pool = await poolPromise;
        let result = await pool.request().input('id', sql.Int, req.params.id).query('SELECT dv.cantidad, p.nombre, dv.subtotal FROM Ventas_Detalle dv INNER JOIN productos p ON dv.producto_id = p.id WHERE dv.venta_id = @id');
        res.json(result.recordset);
    } catch (err) { res.status(500).send(err.message); }
});

// --- 8. DASHBOARD ---
app.get('/api/dashboard/resumen', async (req, res) => {
    try {
        let pool = await poolPromise;
        let qDia = await pool.request().query(`SELECT ISNULL(SUM(total), 0) as total FROM Ventas WHERE CAST(fecha as DATE) = CAST(GETDATE() as DATE) AND activo = 1`);
        let qSemana = await pool.request().query(`SELECT ISNULL(SUM(total), 0) as total FROM Ventas WHERE fecha >= DATEADD(day, -7, GETDATE()) AND activo = 1`);
        let qMes = await pool.request().query(`SELECT ISNULL(SUM(total), 0) as total FROM Ventas WHERE MONTH(fecha) = MONTH(GETDATE()) AND YEAR(fecha) = YEAR(GETDATE()) AND activo = 1`);
        res.json({ dia: qDia.recordset[0].total, semana: qSemana.recordset[0].total, mes: qMes.recordset[0].total });
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/dashboard/top-productos', async (req, res) => {
    try {
        let pool = await poolPromise;
        let result = await pool.request().query("SELECT TOP 5 p.nombre, SUM(vd.cantidad) as total_vendido FROM Ventas_Detalle vd JOIN Ventas v ON vd.venta_id = v.id JOIN Productos p ON vd.producto_id = p.id WHERE v.activo = 1 AND MONTH(v.fecha) = MONTH(GETDATE()) AND YEAR(v.fecha) = YEAR(GETDATE()) GROUP BY p.nombre ORDER BY total_vendido DESC");
        res.json(result.recordset);
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/dashboard/ventas-mes', async (req, res) => {
    try {
        let pool = await poolPromise;
        let result = await pool.request().query("SELECT FORMAT(fecha, 'dd-MM') as dia, SUM(total) as total_dia FROM Ventas WHERE activo = 1 AND MONTH(fecha) = MONTH(GETDATE()) AND YEAR(fecha) = YEAR(GETDATE()) GROUP BY FORMAT(fecha, 'dd-MM'), CAST(fecha as DATE) ORDER BY CAST(fecha as DATE)");
        res.json(result.recordset);
    } catch (err) { res.status(500).send(err.message); }
});

app.listen(3000, () => console.log('Servidor corriendo en el puerto 3000'));