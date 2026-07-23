// Especificaciones de espesores de pintura por cliente y norma. Cada spec
// tiene varias capas (primer/base/transparente/total…) con su rango mín–máx
// en µm. Lectura para la captura/PDF; edición solo admin (Admin › Pintura).
// Hermana de especificaciones.js (normas del laboratorio químico).
const express = require('express');
const { pool, query } = require('../db');
const { requireAuth, requireRol } = require('../auth');

const router = express.Router();

// Normaliza las capas recibidas: nombre obligatorio, mín/máx numéricos u opcionales.
function normalizarCapas(capas) {
  if (!Array.isArray(capas)) return [];
  const limpias = [];
  for (const c of capas) {
    const nombre = (c.nombre || '').trim();
    if (!nombre) continue;
    const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
    const min = num(c.espesor_min);
    const max = num(c.espesor_max);
    if ((min !== null && Number.isNaN(min)) || (max !== null && Number.isNaN(max))) {
      throw Object.assign(new Error(`Rango no numérico en la capa "${nombre}"`), { status: 400 });
    }
    limpias.push({ nombre, espesor_min: min, espesor_max: max });
  }
  return limpias;
}

async function cargarCapas(especId) {
  const { rows } = await query(
    `SELECT id, orden, nombre, espesor_min, espesor_max
     FROM especificacion_pintura_capas WHERE espec_id = $1 ORDER BY orden`, [especId]
  );
  return rows;
}

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const params = [];
    const condiciones = [];
    if (!req.query.todas) condiciones.push('e.activa');
    if (req.query.cliente_id) {
      params.push(req.query.cliente_id);
      condiciones.push(`e.cliente_id = $${params.length}`);
    }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT e.*, c.nombre AS cliente_nombre
       FROM especificaciones_pintura e JOIN clientes c ON c.id = e.cliente_id
       ${where} ORDER BY c.nombre, e.norma`, params
    );
    for (const e of rows) e.capas = await cargarCapas(e.id);
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/', requireRol(), async (req, res, next) => {
  const cliente = await pool.connect();
  try {
    const { cliente_id, norma } = req.body;
    if (!cliente_id || !norma || !norma.trim()) return res.status(400).json({ error: 'Cliente y norma son requeridos' });
    const capas = normalizarCapas(req.body.capas || []);

    await cliente.query('BEGIN');
    const { rows } = await cliente.query(
      `INSERT INTO especificaciones_pintura (cliente_id, norma) VALUES ($1,$2) RETURNING *`,
      [cliente_id, norma.trim()]
    );
    for (let i = 0; i < capas.length; i++) {
      await cliente.query(
        `INSERT INTO especificacion_pintura_capas (espec_id, orden, nombre, espesor_min, espesor_max)
         VALUES ($1,$2,$3,$4,$5)`,
        [rows[0].id, i + 1, capas[i].nombre, capas[i].espesor_min, capas[i].espesor_max]
      );
    }
    await cliente.query('COMMIT');
    res.status(201).json({ ...rows[0], capas: await cargarCapas(rows[0].id) });
  } catch (e) {
    await cliente.query('ROLLBACK');
    if (e.code === '23505') return res.status(409).json({ error: 'Ya existe esa norma para ese cliente' });
    if (e.code === '23503') return res.status(400).json({ error: 'Cliente no existe' });
    next(e);
  } finally {
    cliente.release();
  }
});

router.put('/:id(\\d+)', requireRol(), async (req, res, next) => {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const { rows } = await cliente.query(
      `UPDATE especificaciones_pintura SET
         norma = COALESCE($1, norma),
         activa = COALESCE($2, activa)
       WHERE id = $3 RETURNING *`,
      [req.body.norma ? req.body.norma.trim() : null, req.body.activa, req.params.id]
    );
    if (!rows[0]) {
      await cliente.query('ROLLBACK');
      return res.status(404).json({ error: 'Especificación no encontrada' });
    }
    if (req.body.capas !== undefined) {
      const capas = normalizarCapas(req.body.capas);
      await cliente.query('DELETE FROM especificacion_pintura_capas WHERE espec_id = $1', [req.params.id]);
      for (let i = 0; i < capas.length; i++) {
        await cliente.query(
          `INSERT INTO especificacion_pintura_capas (espec_id, orden, nombre, espesor_min, espesor_max)
           VALUES ($1,$2,$3,$4,$5)`,
          [req.params.id, i + 1, capas[i].nombre, capas[i].espesor_min, capas[i].espesor_max]
        );
      }
    }
    await cliente.query('COMMIT');
    res.json({ ...rows[0], capas: await cargarCapas(req.params.id) });
  } catch (e) {
    await cliente.query('ROLLBACK');
    if (e.code === '23505') return res.status(409).json({ error: 'Ya existe esa norma para ese cliente' });
    next(e);
  } finally {
    cliente.release();
  }
});

module.exports = router;
