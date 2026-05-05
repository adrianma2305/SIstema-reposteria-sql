const express = require('express');
const sql = require('mssql/msnodesqlv8'); 
const cors = require('cors');

const app = express();
app.use(cors()); 
app.use(express.json());

// --- 1. CONFIGURACION DE BASE DE DATOS ---
const dbConfig = {
    server: 'localhost', 
    port: 1433,          
    database: 'PasteleriaDB',
    driver: 'SQL Server', 
    options: {
        trustedConnection: true,
        trustServerCertificate: true,
        connectTimeout: 5000 
    }
};

const poolPromise = sql.connect(dbConfig).then(pool => {
    console.log("Conectado a SQL Server con Autenticación de Windows");
    return pool;
}).catch(err => {
    console.log("Error al conectar BD: ", err.message);
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

// --- 3. RUTAS DE CATEGORIAS ---
app.get('/api/categorias', async (req, res) => {
    try {
        let pool = await poolPromise;
        let result = await pool.request().query('SELECT * FROM categorias ORDER BY nombre');
        res.json(result.recordset);
    } catch (err) { res.status(500).send(err.message); }
});

// --- 4. RUTAS DE PRODUCTOS ---
app.get('/api/productos', async (req, res) => {
    try {
        let pool = await poolPromise;
        let result = await pool.request().query(`
            SELECT p.*, 
                   i.nombre as nombre_insumo,
                   c.nombre as nombre_categoria
            FROM productos p 
            LEFT JOIN insumos i ON p.insumo_id = i.id
            LEFT JOIN categorias c ON p.categoria_id = c.id
            WHERE p.activo = 1
        `);
        
        const productosFormateados = result.recordset.map(prod => ({
            id: prod.id,
            nombre: prod.nombre,
            precio: prod.precio,
            insumo_id: prod.insumo_id,
            categoria_id: prod.categoria_id,
            insumo: prod.nombre_insumo ? { nombre: prod.nombre_insumo } : null,
            categoria: prod.nombre_categoria ? { nombre: prod.nombre_categoria } : null
        }));

        res.json(productosFormateados);
    } catch (err) { res.status(500).send(err.message); }
});

app.post('/api/productos', async (req, res) => {
    try {
        const { nombre, precio, insumo_id, categoria_id } = req.body;
        let pool = await poolPromise;
        await pool.request()
            .input('nombre', sql.VarChar, nombre)
            .input('precio', sql.Decimal(10,2), precio)
            .input('insumo_id', sql.Int, insumo_id || null)
            .input('categoria_id', sql.Int, categoria_id || null)
            .query('INSERT INTO productos (nombre, precio, insumo_id, categoria_id) VALUES (@nombre, @precio, @insumo_id, @categoria_id)');
            
        res.status(201).send('Producto agregado');
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/productos/:id', async (req, res) => {
    try {
        const id = req.params.id;
        let pool = await poolPromise;
        let result = await pool.request().input('id', sql.Int, id).query('SELECT * FROM productos WHERE id = @id AND activo = 1');
        if (result.recordset.length > 0) res.json(result.recordset[0]);
        else res.status(404).send('Producto no encontrado');
    } catch (err) { res.status(500).send(err.message); }
});

app.put('/api/productos/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const { nombre, precio, insumo_id, categoria_id } = req.body;
        let pool = await poolPromise;
        await pool.request()
            .input('id', sql.Int, id)
            .input('nombre', sql.VarChar, nombre)
            .input('precio', sql.Decimal(10,2), precio)
            .input('insumo_id', sql.Int, insumo_id || null)
            .input('categoria_id', sql.Int, categoria_id || null)
            .query('UPDATE productos SET nombre = @nombre, precio = @precio, insumo_id = @insumo_id, categoria_id = @categoria_id, fecha_actualizacion = GETDATE() WHERE id = @id');
        res.status(200).send('Producto actualizado');
    } catch (err) { res.status(500).send(err.message); }
});

app.delete('/api/productos/:id', async (req, res) => {
    try {
        const id = req.params.id;
        let pool = await poolPromise;
        await pool.request()
            .input('id', sql.Int, id)
            .query('UPDATE productos SET activo = 0 WHERE id = @id');
        res.status(200).send('Producto eliminado lógicamente');
    } catch (err) { res.status(500).send(err.message); }
});

// --- 5. RUTAS DE PROVEEDORES ---
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

// --- 6. RUTAS DE INSUMOS ---
app.get('/api/insumos', async (req, res) => {
    try {
        let pool = await poolPromise;
        let result = await pool.request().query(`
            SELECT i.*, p.nombre as nombre_proveedor 
            FROM insumos i 
            LEFT JOIN proveedores p ON i.proveedor_id = p.id 
            WHERE i.activo = 1
            ORDER BY i.id
        `);
        
        const insumosFormateados = result.recordset.map(ins => ({
            id: ins.id,
            nombre: ins.nombre,
            unidad: ins.unidad,
            precio: ins.precio,
            proveedor_id: ins.proveedor_id,
            proveedores: ins.nombre_proveedor ? { nombre: ins.nombre_proveedor } : null
        }));

        res.json(insumosFormateados);
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/insumos/:id', async (req, res) => {
    try {
        const id = req.params.id;
        let pool = await poolPromise;
        let result = await pool.request().input('id', sql.Int, id).query('SELECT * FROM insumos WHERE id = @id AND activo = 1');
        if (result.recordset.length > 0) res.json(result.recordset[0]);
        else res.status(404).send('Insumo no encontrado');
    } catch (err) { res.status(500).send(err.message); }
});

app.post('/api/insumos', async (req, res) => {
    try {
        const { nombre, unidad, precio, proveedor_id } = req.body;
        let pool = await poolPromise;
        await pool.request()
            .input('nombre', sql.VarChar, nombre)
            .input('unidad', sql.VarChar, unidad || null)
            .input('precio', sql.Decimal(10,2), precio || null)
            .input('proveedor_id', sql.Int, proveedor_id || null)
            .query('INSERT INTO insumos (nombre, unidad, precio, proveedor_id) VALUES (@nombre, @unidad, @precio, @proveedor_id)');
        res.status(201).send('Insumo agregado');
    } catch (err) { res.status(500).send(err.message); }
});

app.put('/api/insumos/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const { nombre, unidad, precio, proveedor_id } = req.body;
        let pool = await poolPromise;
        await pool.request()
            .input('id', sql.Int, id)
            .input('nombre', sql.VarChar, nombre)
            .input('unidad', sql.VarChar, unidad || null)
            .input('precio', sql.Decimal(10,2), precio || null)
            .input('proveedor_id', sql.Int, proveedor_id || null)
            .query('UPDATE insumos SET nombre = @nombre, unidad = @unidad, precio = @precio, proveedor_id = @proveedor_id, fecha_actualizacion = GETDATE() WHERE id = @id');
        res.status(200).send('Insumo actualizado');
    } catch (err) { res.status(500).send(err.message); }
});

app.delete('/api/insumos/:id', async (req, res) => {
    try {
        const id = req.params.id;
        let pool = await poolPromise;
        await pool.request().input('id', sql.Int, id).query('UPDATE insumos SET activo = 0 WHERE id = @id');
        res.status(200).send('Insumo eliminado lógicamente');
    } catch (err) { res.status(500).send(err.message); }
});

// --- 7. RUTAS DE CLIENTES ---
app.get('/api/clientes', async (req, res) => {
    try {
        let pool = await poolPromise;
        let nombre = req.query.nombre;
        
        if(nombre) {
            let result = await pool.request()
                .input('nombre', sql.VarChar, `%${nombre}%`)
                .query('SELECT * FROM clientes WHERE nombre LIKE @nombre AND activo = 1');
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
        let result = await pool.request()
            .input('nombre', sql.VarChar, nombre)
            .input('telefono', sql.VarChar, telefono || null)
            .query('INSERT INTO clientes (nombre, telefono) OUTPUT INSERTED.id VALUES (@nombre, @telefono)');
        
        res.status(201).json({ id: result.recordset[0].id });
    } catch (err) { res.status(500).send(err.message); }
});

// --- 8. RUTAS DE VENTAS (NUEVO MODELO MAESTRO-DETALLE) ---
app.get('/api/ventas', async (req, res) => {
    try {
        let pool = await poolPromise;
        // Unimos Cabecera y Detalle para que tu tabla del frontend siga funcionando igual
        let result = await pool.request().query(`
            SELECT 
                v.id as factura_id,
                v.fecha,
                c.nombre as nombre_cliente,
                e.nombre as nombre_empleado,
                vd.cantidad,
                vd.precio_unitario,
                vd.subtotal as total_producto,
                p.nombre as nombre_producto
            FROM Ventas v
            INNER JOIN Ventas_Detalle vd ON v.id = vd.venta_id
            LEFT JOIN Productos p ON vd.producto_id = p.id
            LEFT JOIN Clientes c ON v.cliente_id = c.id
            LEFT JOIN Empleados e ON v.empleado_id = e.id
            WHERE v.activo = 1
            ORDER BY v.fecha DESC, v.id DESC
        `);
        
        const ventasFormateadas = result.recordset.map(v => ({
            id: v.factura_id, 
            cantidad: v.cantidad,
            precio_unitario: v.precio_unitario,
            total: v.total_producto,
            fecha: v.fecha,
            producto: v.nombre_producto ? { nombre: v.nombre_producto } : null,
            cliente: v.nombre_cliente ? { nombre: v.nombre_cliente } : null,
            empleado: v.nombre_empleado ? { nombre: v.nombre_empleado } : null
        }));

        res.json(ventasFormateadas);
    } catch (err) { res.status(500).send(err.message); }
});

app.post('/api/ventas', async (req, res) => {
    let transaction;
    try {
        const { cliente_id, empleado_id, total, detalles } = req.body;
        
        let pool = await poolPromise;
        transaction = new sql.Transaction(pool);
        await transaction.begin();

        // 1. Insertar la Cabecera (Ventas)
        const requestCabecera = new sql.Request(transaction);
        let resultCabecera = await requestCabecera
            .input('cliente_id', sql.Int, cliente_id || null)
            .input('empleado_id', sql.Int, empleado_id || null)
            .input('total', sql.Decimal(10,2), total)
            .query('INSERT INTO Ventas (cliente_id, empleado_id, total) OUTPUT INSERTED.id VALUES (@cliente_id, @empleado_id, @total)');
        
        const nuevaVentaId = resultCabecera.recordset[0].id;

        // 2. Insertar los Detalles (Ventas_Detalle)
        for (let item of detalles) {
            const requestDetalle = new sql.Request(transaction);
            await requestDetalle
                .input('venta_id', sql.Int, nuevaVentaId)
                .input('producto_id', sql.Int, item.producto_id)
                .input('cantidad', sql.Int, item.cantidad)
                .input('precio_unitario', sql.Decimal(10,2), item.precio_unitario)
                .input('subtotal', sql.Decimal(10,2), item.subtotal)
                .query('INSERT INTO Ventas_Detalle (venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES (@venta_id, @producto_id, @cantidad, @precio_unitario, @subtotal)');
        }

        // Si todo sale perfecto, hacemos COMMIT (guardar cambios)
        await transaction.commit();
        res.status(201).json({ message: 'Venta registrada con éxito', id: nuevaVentaId });
        
    } catch (err) { 
        // Si hay CUALQUIER error, hacemos ROLLBACK (cancelar todo)
        if (transaction) await transaction.rollback();
        res.status(500).send(err.message); 
    }
});

// --- 9. INICIAR SERVIDOR ---
app.listen(3000, () => {
    console.log('Servidor corriendo en el puerto 3000');
});