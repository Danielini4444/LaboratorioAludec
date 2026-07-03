// Especificaciones por cliente y norma. Lectura para la captura/PDF;
// edición solo para el admin (Administración > Normas). El importador
// (scripts/importar-especificaciones.js) también las actualiza.
const express = require('express');
const { query } = require('../db');
const { requireAuth, requireRol } = require('../auth');

const router = express.Router();

// Cada límite admite min/max (absoluto) y min_pct/max_pct (% del Ni total).
function validarLimites(limites) {
  if (typeof limites !== 'object' || limites === null || Array.isArray(limites)) {
    throw Object.assign(new Error('Límites no válidos'), { status: 400 });
  }
  const limpios = {};
  for (const [clave, lim] of Object.entries(limites)) {
    const entrada = {};
    for (const extremo of ['min', 'max', 'min_pct', 'max_pct']) {
      if (lim[extremo] !== undefined && lim[extremo] !== null && lim[extremo] !== '') {
        const n = Number(lim[extremo]);
        if (Number.isNaN(n)) {
          throw Object.assign(new Error(`Límite ${extremo} de "${clave}" debe ser numérico`), { status: 400 });
        }
        entrada[extremo] = n;
      }
    }
    if (Object.keys(entrada).length) limpios[clave] = entrada;
  }
  return limpios;
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
       FROM especificaciones e JOIN clientes c ON c.id = e.cliente_id
       ${where} ORDER BY c.nombre, e.norma`, params
    );
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/', requireRol(), async (req, res, next) => {
  try {
    const { cliente_id, norma } = req.body;
    if (!cliente_id || !norma) return res.status(400).json({ error: 'Cliente y norma son requeridos' });
    const limites = validarLimites(req.body.limites || {});
    const { rows } = await query(
      `INSERT INTO especificaciones (cliente_id, norma, limites)
       VALUES ($1,$2,$3) RETURNING *`,
      [cliente_id, norma.trim(), JSON.stringify(limites)]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Ya existe esa norma para ese cliente' });
    if (e.code === '23503') return res.status(400).json({ error: 'Cliente no existe' });
    next(e);
  }
});

router.put('/:id(\\d+)', requireRol(), async (req, res, next) => {
  try {
    const limites = req.body.limites !== undefined ? validarLimites(req.body.limites) : null;
    // editar norma o límites a mano la protege de que el importador la pise
    const { rows } = await query(
      `UPDATE especificaciones SET
         norma = COALESCE($1, norma),
         limites = COALESCE($2, limites),
         activa = COALESCE($3, activa),
         editada_manual = editada_manual OR $5
       WHERE id = $4 RETURNING *`,
      [req.body.norma, limites && JSON.stringify(limites), req.body.activa, req.params.id,
       limites !== null || req.body.norma !== undefined]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Norma no encontrada' });
    res.json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Ya existe esa norma para ese cliente' });
    next(e);
  }
});

module.exports = router;
