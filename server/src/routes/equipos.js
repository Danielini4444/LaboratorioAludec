// Catálogo de equipos del laboratorio (nombre, ID interno, calibración).
// Se usan en las pruebas de Test de cromado (Metrología).
const express = require('express');
const { query } = require('../db');
const { requireAuth, requireRol } = require('../auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM equipos ORDER BY nombre');
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/', requireRol('admin_area'), async (req, res, next) => {
  try {
    const { nombre, referencia_interna, fecha_calibracion } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
    const { rows } = await query(
      `INSERT INTO equipos (nombre, referencia_interna, fecha_calibracion)
       VALUES ($1,$2,$3) RETURNING *`,
      [nombre.trim(), referencia_interna ? referencia_interna.trim() : null, fecha_calibracion || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Ya existe un equipo con ese ID interno' });
    next(e);
  }
});

router.put('/:id(\\d+)', requireRol('admin_area'), async (req, res, next) => {
  try {
    const { nombre, referencia_interna, fecha_calibracion, activo } = req.body;
    // referencia_interna y fecha_calibracion admiten null explícito para vaciarlas
    const { rows } = await query(
      `UPDATE equipos SET
         nombre = COALESCE($1, nombre),
         referencia_interna = CASE WHEN $2::boolean THEN $3 ELSE referencia_interna END,
         fecha_calibracion = CASE WHEN $4::boolean THEN $5::date ELSE fecha_calibracion END,
         activo = COALESCE($6, activo)
       WHERE id = $7 RETURNING *`,
      [
        nombre,
        referencia_interna !== undefined, referencia_interna || null,
        fecha_calibracion !== undefined, fecha_calibracion || null,
        activo, req.params.id
      ]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Equipo no encontrado' });
    res.json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Ya existe un equipo con ese ID interno' });
    next(e);
  }
});

module.exports = router;
