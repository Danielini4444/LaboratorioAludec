// Plan de pruebas por cliente (se carga con scripts/importar-planes.js o se
// crea a mano desde la pantalla "Planes de prueba" de Metrología).
const express = require('express');
const { query, pool } = require('../db');
const { requireAuth, requireArea } = require('../auth');

const router = express.Router();
const AREA = 'Metrología';
const PROCESO = 'cromado';

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const params = [];
    let where = '';
    if (req.query.cliente_id) {
      params.push(req.query.cliente_id);
      where = `WHERE p.cliente_id = $${params.length}`;
    }
    const { rows } = await query(
      `SELECT p.*, c.nombre AS cliente_nombre
       FROM planes_prueba p JOIN clientes c ON c.id = p.cliente_id
       ${where} ORDER BY c.nombre, p.plan_norma, p.orden`, params
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// Crea un plan de cromado a mano: cliente + norma del plan + lista de pruebas.
router.post('/', requireArea(AREA), async (req, res, next) => {
  const { cliente_id, plan_norma, pruebas } = req.body;
  const planNorma = (plan_norma || '').trim();
  if (!cliente_id) return res.status(400).json({ error: 'Falta el cliente' });
  if (!planNorma) return res.status(400).json({ error: 'Falta la norma del plan' });
  const limpias = (Array.isArray(pruebas) ? pruebas : [])
    .map(p => ({
      norma: (p.norma || '').trim() || planNorma,
      ensayo: (p.ensayo || '').trim(),
      caracteristica: (p.caracteristica || '').trim() || null
    }))
    .filter(p => p.ensayo);
  if (!limpias.length) return res.status(400).json({ error: 'Agrega al menos una prueba con su ensayo' });

  try {
    const { rows: cli } = await query('SELECT id, nombre FROM clientes WHERE id = $1', [cliente_id]);
    if (!cli[0]) return res.status(404).json({ error: 'Cliente no encontrado' });
    const { rows: existe } = await query(
      `SELECT 1 FROM planes_prueba WHERE proceso = $1 AND cliente_id = $2 AND plan_norma = $3 LIMIT 1`,
      [PROCESO, cliente_id, planNorma]
    );
    if (existe[0]) {
      return res.status(409).json({ error: `${cli[0].nombre} ya tiene un plan "${planNorma}". Usa otra norma o bórralo primero.` });
    }
    const conexion = await pool.connect();
    try {
      await conexion.query('BEGIN');
      for (let i = 0; i < limpias.length; i++) {
        const p = limpias[i];
        await conexion.query(
          `INSERT INTO planes_prueba (proceso, cliente_id, plan_norma, norma, ensayo, caracteristica, orden)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [PROCESO, cliente_id, planNorma, p.norma, p.ensayo, p.caracteristica, i + 1]
        );
      }
      await conexion.query('COMMIT');
    } catch (e) {
      await conexion.query('ROLLBACK');
      throw e;
    } finally {
      conexion.release();
    }
    res.status(201).json({ cliente_id, plan_norma: planNorma, pruebas: limpias.length });
  } catch (e) { next(e); }
});

// Borra un plan completo (cliente + norma del plan). La norma va por query
// para no romper la ruta si contiene caracteres como "/".
router.delete('/:cliente_id(\\d+)', requireArea(AREA), async (req, res, next) => {
  try {
    const planNorma = req.query.plan_norma;
    if (!planNorma) return res.status(400).json({ error: 'Falta la norma del plan (plan_norma)' });
    const { rowCount } = await query(
      `DELETE FROM planes_prueba WHERE proceso = $1 AND cliente_id = $2 AND plan_norma = $3`,
      [PROCESO, req.params.cliente_id, planNorma]
    );
    if (!rowCount) return res.status(404).json({ error: 'Plan no encontrado' });
    res.json({ ok: true, borradas: rowCount });
  } catch (e) { next(e); }
});

module.exports = router;
