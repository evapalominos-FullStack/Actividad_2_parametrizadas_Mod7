require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

// Configuración del Pool usando variables de entorno
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// GET /clientes con filtros (rut, edad, rango, nombre)
app.get('/clientes', async (req, res) => {
    const { rut, edad, edadMin, edadMax, nombre } = req.query;
    let sql = 'SELECT * FROM clientes';
    let params = [];

    try {
        if (rut) {
            sql += ' WHERE rut = $1';
            params = [rut];
        } else if (edad) {
            sql += ' WHERE edad = $1';
            params = [edad];
        } else if (edadMin && edadMax) {
            sql += ' WHERE edad BETWEEN $1 AND $2';
            params = [edadMin, edadMax];
        } else if (nombre) {
            sql += ' WHERE nombre ILIKE $1';
            params = [`${nombre}%`];
        }

        sql += ' ORDER BY nombre ASC';
        const { rows } = await pool.query(sql, params);

        if (rows.length === 0) {
            return res.status(404).json({ message: "No se encontraron coincidencias" });
        }
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /clientes (por parámetro de ruta o query params)
app.delete('/clientes/:rut', async (req, res) => {
    eliminarLogica(req, res);
});

app.delete('/clientes', async (req, res) => {
    eliminarLogica(req, res);
});

async function eliminarLogica(req, res) {
    const { rut } = req.params;
    const { edad, edadMin, edadMax } = req.query;
    
    let sql = 'DELETE FROM clientes';
    let params = [];
    let criteria = '';

    if (rut) {
        criteria = 'WHERE rut = $1';
        params = [rut];
    } else if (edad) {
        criteria = 'WHERE edad = $1';
        params = [edad];
    } else if (edadMin && edadMax) {
        criteria = 'WHERE edad BETWEEN $1 AND $2';
        params = [edadMin, edadMax];
    } else {
        return res.status(400).json({ error: "Faltan criterios de eliminación" });
    }

    try {
        const result = await pool.query(`${sql} ${criteria} RETURNING nombre`, params);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: "No hay coincidencias para eliminar" });
        }
        res.json({ message: "Eliminados con éxito", eliminados: result.rows.map(r => r.nombre) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

// Los métodos POST y PUT se mantienen iguales al ejercicio anterior...
app.post('/clientes', async (req, res) => {
    const { rut, nombre, edad } = req.body;
    if (typeof edad !== 'number' || isNaN(edad)) {
        return res.status(400).json({ error: 'La edad debe ser un número válido' });
    }

    try {
        const sql = 'INSERT INTO clientes (rut, nombre, edad) VALUES ($1, $2, $3) RETURNING *';
        const { rows } = await pool.query(sql, [rut, nombre, edad]);
        res.status(201).json(rows[0]);
    } catch (err) {
        // 2. Validar llave duplicada (Código 23505 en Postgres)
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Conflicto: El RUT ya existe en el sistema' });
        }
        res.status(500).json({ error: 'Error inesperado: ' + err.message });
    }
});

app.put('/clientes/:rut', async (req, res) => {
    const { rut } = req.params;
    const { nombre } = req.body;
    const result = await pool.query('UPDATE clientes SET nombre = $1 WHERE rut = $2', [nombre, rut]);
    res.json(result.rowCount > 0 ? { message: 'Actualizado' } : { message: 'No encontrado' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));