// Las áreas del laboratorio son fijas (Químico, Metrología); esta ruta solo
// existe para que Administración pueda asignar área a los roles de área.
const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM areas ORDER BY nombre');
    res.json(rows);
  } catch (e) { next(e); }
});

module.exports = router;
