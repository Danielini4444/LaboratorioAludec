const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { requireAuth, requireRol } = require('../auth');

const router = express.Router();

// Lista mínima (id + nombre) de usuarios activos para los <select> de
// "Realizó / Analista" en la captura. Accesible a cualquier autenticado
// (los capturistas de área la necesitan y no ven la Administración).
router.get('/seleccionables', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT u.id, u.nombre, u.rol, a.nombre AS area_nombre
       FROM usuarios u LEFT JOIN areas a ON a.id = u.area_id
       WHERE u.activo ORDER BY u.nombre`
    );
    res.json(rows);
  } catch (e) { next(e); }
});
const ROLES = ['admin', 'auditor', 'auditor_admin', 'solicitante', 'admin_area', 'usuario_area'];

function validarRolArea(rol, areaId) {
  if (!ROLES.includes(rol)) return 'Rol no válido';
  const esDeArea = rol === 'admin_area' || rol === 'usuario_area';
  if (esDeArea && !areaId) return 'Los roles de área requieren un área asignada';
  if (!esDeArea && areaId) return 'Este rol no lleva área asignada';
  return null;
}

router.get('/', requireRol('auditor_admin', 'admin_area'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT u.id, u.usuario, u.nombre, u.rol, u.area_id, u.activo, a.nombre AS area_nombre
       FROM usuarios u LEFT JOIN areas a ON a.id = u.area_id ORDER BY u.nombre`
    );
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/', requireRol('admin_area'), async (req, res, next) => {
  try {
    const { usuario, nombre, password, rol } = req.body;
    const areaId = req.body.area_id || null;
    if (!usuario || !nombre || !password) return res.status(400).json({ error: 'Usuario, nombre y contraseña son requeridos' });
    if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    const errorRol = validarRolArea(rol, areaId);
    if (errorRol) return res.status(400).json({ error: errorRol });
    const { rows } = await query(
      `INSERT INTO usuarios (usuario, nombre, password_hash, rol, area_id)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, usuario, nombre, rol, area_id, activo`,
      [usuario.trim(), nombre.trim(), await bcrypt.hash(password, 10), rol, areaId]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Ya existe ese nombre de usuario' });
    next(e);
  }
});

router.put('/:id', requireRol('admin_area'), async (req, res, next) => {
  try {
    const { nombre, rol, activo, password } = req.body;
    const areaId = req.body.area_id !== undefined ? req.body.area_id : undefined;
    if (rol !== undefined) {
      const errorRol = validarRolArea(rol, areaId !== undefined ? areaId : null);
      if (errorRol) return res.status(400).json({ error: errorRol });
    }
    if (password !== undefined && password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }
    const hash = password !== undefined ? await bcrypt.hash(password, 10) : null;
    const { rows } = await query(
      `UPDATE usuarios SET
         nombre = COALESCE($1, nombre),
         rol = COALESCE($2, rol),
         area_id = CASE WHEN $3::boolean THEN $4::integer ELSE area_id END,
         activo = COALESCE($5, activo),
         password_hash = COALESCE($6, password_hash)
       WHERE id = $7
       RETURNING id, usuario, nombre, rol, area_id, activo`,
      [nombre, rol, rol !== undefined, areaId !== undefined ? areaId : null, activo, hash, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// Borra un usuario (admin global o admin de área). Un usuario que ya capturó,
// aprobó, firmó o subió evidencia NO se puede borrar: las llaves foráneas lo
// impiden a propósito, porque romperían la trazabilidad de los documentos
// (quién hizo qué). En ese caso se desactiva, que es lo correcto.
router.delete('/:id(\\d+)', requireRol('admin_area'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (id === req.session.user.id) {
      return res.status(400).json({ error: 'No puedes borrar tu propio usuario' });
    }
    const { rows } = await query(
      'DELETE FROM usuarios WHERE id = $1 RETURNING id, usuario', [id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ ok: true });
  } catch (e) {
    if (e.code === '23503') {
      return res.status(409).json({
        error: 'Este usuario tiene documentos asociados (registros, reportes, solicitudes o fotos) ' +
               'y no se puede borrar sin romper la trazabilidad. Desactívalo en su lugar.'
      });
    }
    next(e);
  }
});

module.exports = router;
