const express = require('express');
const { query } = require('../db');
const { requireAuth, requireRol } = require('../auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const condiciones = [];
    const params = [];
    const busqueda = (req.query.q || '').trim();
    if (busqueda) {
      params.push(`%${busqueda}%`);
      condiciones.push(`(p.referencia ILIKE $${params.length} OR p.denominacion ILIKE $${params.length} OR c.nombre ILIKE $${params.length})`);
    }
    if (req.query.cliente_id) {
      params.push(req.query.cliente_id);
      condiciones.push(`p.cliente_id = $${params.length}`);
    }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT p.*, c.nombre AS cliente_nombre
       FROM piezas p JOIN clientes c ON c.id = p.cliente_id
       ${where} ORDER BY c.nombre, p.referencia`, params
    );
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/', requireRol('solicitante', 'admin_area'), async (req, res, next) => {
  try {
    const { referencia, denominacion, cliente_id } = req.body;
    if (!referencia || !denominacion || !cliente_id) {
      return res.status(400).json({ error: 'Referencia, denominación y cliente son requeridos' });
    }
    const { rows } = await query(
      `INSERT INTO piezas (referencia, denominacion, cliente_id)
       VALUES ($1,$2,$3) RETURNING *`,
      [referencia.trim(), denominacion.trim(), cliente_id]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Ya existe una pieza con esa referencia' });
    next(e);
  }
});

router.put('/:id', requireRol('solicitante', 'admin_area'), async (req, res, next) => {
  try {
    const { referencia, denominacion, cliente_id, activa } = req.body;
    const { rows } = await query(
      `UPDATE piezas SET
         referencia = COALESCE($1, referencia),
         denominacion = COALESCE($2, denominacion),
         cliente_id = COALESCE($3, cliente_id),
         activa = COALESCE($4, activa)
       WHERE id = $5 RETURNING *`,
      [referencia, denominacion, cliente_id, activa, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Pieza no encontrada' });
    res.json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Ya existe una pieza con esa referencia' });
    next(e);
  }
});

module.exports = router;
