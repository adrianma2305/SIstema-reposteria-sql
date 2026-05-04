const express = require('express');
const sql = require('mssql/msnodesqlv8'); 
const cors = require('cors');

const app = express();
app.use(cors()); 
app.use(express.json());

// --- 1. CONFIGURACIÓN FORZANDO RED ---
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

// --- 1.5 LA MAGIA ---
console.log("⏳ Intentando conectar a la base de datos..."); 

const poolPromise = sql.connect(dbConfig).then(pool => {
    console.log("✅ ¡Conectado a SQL Server al cien con Windows!");
    return pool;
}).catch(err => {
    console.log("❌ Error al conectar BD: ", err.message);
});

// --- 2. RUTAS DE EMPLEADOS ---
app.get('/api/empleados', async (req, res) => {
    try {
        let pool = await poolPromise; 
        let result = await pool.request().query('SELECT id, nombre, cargo FROM empleados ORDER BY nombre');
        res.json(result.recordset);
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/empleados/:id', async (req, res) => {
    try {
        const id = req.params.id;
        let pool = await poolPromise;
        let result = await pool.request().input('id', sql.Int, id).query('SELECT * FROM empleados WHERE id = @id');
        if (result.recordset.length > 0) res.json(result.recordset[0]);
        else res.status(404).send('Usuario no encontrado');
    } catch (err) { res.status(500).send(err.message); }
});

// --- 3. RUTAS DE PRODUCTOS ---
app.get('/api/productos', async (req, res) => {
    try {
        let pool = await poolPromise;
        let result = await pool.request().query(`
            SELECT p.*, i.nombre as nombre_insumo 
            FROM productos p 
            LEFT JOIN insumos i ON p.insumo_id = i.id
        `);
        
        const productosFormateados = result.recordset.map(prod => ({
            id: prod.id,
            nombre: prod.nombre,
            precio: prod.precio,
            insumo_id: prod.insumo_id,
            insumo: prod.nombre_insumo ? { nombre: prod.nombre_insumo } : null
        }));

        res.json(productosFormateados);
    } catch (err) { res.status(500).send(err.message); }
});

app.post('/api/productos', async (req, res) => {
    try {
        const { nombre, precio, insumo_id } = req.body;
        let pool = await poolPromise;
        await pool.request()
            .input('nombre', sql.VarChar, nombre)
            .input('precio', sql.Decimal(10,2), precio)
            .input('insumo_id', sql.Int, insumo_id)
            .query('INSERT INTO productos (nombre, precio, insumo_id) VALUES (@nombre, @precio, @insumo_id)');
            
        res.status(201).send('Producto agregado');
    } catch (err) { res.status(500).send(err.message); }
});

app.delete('/api/productos/:id', async (req, res) => {
    try {
        const id = req.params.id;
        let pool = await poolPromise;
        await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM productos WHERE id = @id');
        res.status(200).send('Producto eliminado');
    } catch (err) { 
        // 547 es el código exacto de SQL Server cuando intentás borrar algo que ya está en uso
        if (err.number === 547) {
            res.status(400).send('No se puede eliminar. Este producto ya tiene ventas registradas.');
        } else {
            res.status(500).send(err.message); 
        }
    }
});

// --- OBTENER UN SOLO PRODUCTO (Para abrir el modal de editar) ---
app.get('/api/productos/:id', async (req, res) => {
    try {
        const id = req.params.id;
        let pool = await poolPromise;
        let result = await pool.request().input('id', sql.Int, id).query('SELECT * FROM productos WHERE id = @id');
        if (result.recordset.length > 0) res.json(result.recordset[0]);
        else res.status(404).send('Producto no encontrado');
    } catch (err) { res.status(500).send(err.message); }
});

// --- ACTUALIZAR UN PRODUCTO (Guardar los cambios) ---
app.put('/api/productos/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const { nombre, precio, insumo_id } = req.body;
        let pool = await poolPromise;
        await pool.request()
            .input('id', sql.Int, id)
            .input('nombre', sql.VarChar, nombre)
            .input('precio', sql.Decimal(10,2), precio)
            .input('insumo_id', sql.Int, insumo_id)
            .query('UPDATE productos SET nombre = @nombre, precio = @precio, insumo_id = @insumo_id WHERE id = @id');
        res.status(200).send('Producto actualizado');
    } catch (err) { res.status(500).send(err.message); }
});

//
// --- 5. RUTAS DE PROVEEDORES ---
// 
app.get('/api/proveedores', async (req, res) => {
    try {
        let pool = await poolPromise;
        let result = await pool.request().query('SELECT * FROM proveedores ORDER BY id');
        res.json(result.recordset);
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/proveedores/:id', async (req, res) => {
    try {
        const id = req.params.id;
        let pool = await poolPromise;
        let result = await pool.request().input('id', sql.Int, id).query('SELECT * FROM proveedores WHERE id = @id');
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
            .query('UPDATE proveedores SET nombre = @nombre, telefono = @telefono, entrega = @entrega WHERE id = @id');
        res.status(200).send('Proveedor actualizado');
    } catch (err) { res.status(500).send(err.message); }
});

app.delete('/api/proveedores/:id', async (req, res) => {
    try {
        const id = req.params.id;
        let pool = await poolPromise;
        await pool.request().input('id', sql.Int, id).query('DELETE FROM proveedores WHERE id = @id');
        res.status(200).send('Proveedor eliminado');
    } catch (err) { res.status(500).send(err.message); }
});

//
// --- 6. RUTAS DE INSUMOS ---
// 
app.get('/api/insumos', async (req, res) => {
    try {
        let pool = await poolPromise;
       
        let result = await pool.request().query(`
            SELECT i.*, p.nombre as nombre_proveedor 
            FROM insumos i 
            LEFT JOIN proveedores p ON i.proveedor_id = p.id 
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
        let result = await pool.request().input('id', sql.Int, id).query('SELECT * FROM insumos WHERE id = @id');
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
            .query('UPDATE insumos SET nombre = @nombre, unidad = @unidad, precio = @precio, proveedor_id = @proveedor_id WHERE id = @id');
        res.status(200).send('Insumo actualizado');
    } catch (err) { res.status(500).send(err.message); }
});

app.delete('/api/insumos/:id', async (req, res) => {
    try {
        const id = req.params.id;
        let pool = await poolPromise;
        await pool.request().input('id', sql.Int, id).query('DELETE FROM insumos WHERE id = @id');
        res.status(200).send('Insumo eliminado');
    } catch (err) { res.status(500).send(err.message); }
});

// 
// --- 7. RUTAS DE CLIENTES ---
//
app.get('/api/clientes', async (req, res) => {
    try {
        let pool = await poolPromise;
        let nombre = req.query.nombre;
        
        
        if(nombre) {
            let result = await pool.request()
                .input('nombre', sql.VarChar, `%${nombre}%`)
                .query('SELECT * FROM clientes WHERE nombre LIKE @nombre');
            res.json(result.recordset);
        } else {
            let result = await pool.request().query('SELECT * FROM clientes');
            res.json(result.recordset);
        }
    } catch (err) { res.status(500).send(err.message); }
});

app.post('/api/clientes', async (req, res) => {
    try {
        const { nombre, telefono } = req.body;
        let pool = await poolPromise;
        //nos devuelve el ID que se acaba de asignar
        let result = await pool.request()
            .input('nombre', sql.VarChar, nombre)
            .input('telefono', sql.VarChar, telefono || null)
            .query('INSERT INTO clientes (nombre, telefono) OUTPUT INSERTED.id VALUES (@nombre, @telefono)');
        
        res.status(201).json({ id: result.recordset[0].id });
    } catch (err) { res.status(500).send(err.message); }
});

// 
// --- 8. RUTAS DE VENTAS ---
// 
app.get('/api/ventas', async (req, res) => {
    try {
        let pool = await poolPromise;
        //JOIN para traer los nombres en vez de solo los números de ID
        let result = await pool.request().query(`
            SELECT v.*, 
                   p.nombre as nombre_producto,
                   c.nombre as nombre_cliente,
                   e.nombre as nombre_empleado
            FROM ventas v
            LEFT JOIN productos p ON v.producto_id = p.id
            LEFT JOIN clientes c ON v.cliente_id = c.id
            LEFT JOIN empleados e ON v.empleado_id = e.id
            ORDER BY v.fecha DESC
        `);
        
        
        const ventasFormateadas = result.recordset.map(v => ({
            id: v.id,
            cantidad: v.cantidad,
            precio_unitario: v.precio_unitario,
            total: v.total,
            fecha: v.fecha,
            producto: v.nombre_producto ? { nombre: v.nombre_producto } : null,
            cliente: v.nombre_cliente ? { nombre: v.nombre_cliente } : null,
            empleado: v.nombre_empleado ? { nombre: v.nombre_empleado } : null
        }));

        res.json(ventasFormateadas);
    } catch (err) { res.status(500).send(err.message); }
});

app.post('/api/ventas', async (req, res) => {
    try {
        const { producto_id, cantidad, precio_unitario, total, cliente_id, empleado_id } = req.body;
        let pool = await poolPromise;
        await pool.request()
            .input('producto_id', sql.Int, producto_id)
            .input('cantidad', sql.Int, cantidad)
            .input('precio_unitario', sql.Decimal(10,2), precio_unitario)
            .input('total', sql.Decimal(10,2), total)
            .input('cliente_id', sql.Int, cliente_id || null)
            .input('empleado_id', sql.Int, empleado_id || null)
            
            .query('INSERT INTO ventas (producto_id, cantidad, precio_unitario, total, cliente_id, empleado_id) VALUES (@producto_id, @cantidad, @precio_unitario, @total, @cliente_id, @empleado_id)');
        res.status(201).send('Venta registrada');
    } catch (err) { res.status(500).send(err.message); }
});

// --- 4. ENCENDER EL SERVIDOR ---
app.listen(3000, () => {
    console.log('Servidor puente corriendo en http://localhost:3000');
});