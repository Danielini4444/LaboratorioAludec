const express = require('express');
const { query } = require('../db');
const { requireAuth, requireRol } = require('../auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM clientes ORDER BY nombre');
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/', requireRol('solicitante'), async (req, res, next) => {
  try {
    const nombre = (req.body.nombre || '').trim();
    if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
    const { rows } = await query('INSERT INTO clientes (nombre) VALUES ($1) RETURNING *', [nombre]);
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Ya existe un cliente con ese nombre' });
    next(e);
  }
});

module.exports = router;
