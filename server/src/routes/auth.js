const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

router.post('/login', async (req, res, next) => {
  try {
    const { usuario, password } = req.body;
    if (!usuario || !password) return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    const { rows } = await query(
      `SELECT u.*, a.nombre AS area_nombre FROM usuarios u
       LEFT JOIN areas a ON a.id = u.area_id
       WHERE u.usuario = $1 AND u.activo`, [usuario]
    );
    const u = rows[0];
    if (!u || !(await bcrypt.compare(password, u.password_hash))) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }
    req.session.user = { id: u.id, usuario: u.usuario, nombre: u.nombre, rol: u.rol, area_id: u.area_id,
      area_nombre: u.area_nombre, debe_cambiar_password: u.debe_cambiar_password };
    res.json(req.session.user);
  } catch (e) { next(e); }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    // se refresca el flag desde la BD para que el gate funcione aun en sesiones abiertas antes del cambio de esquema
    const { rows } = await query('SELECT debe_cambiar_password FROM usuarios WHERE id = $1', [req.session.user.id]);
    if (rows[0]) req.session.user.debe_cambiar_password = rows[0].debe_cambiar_password;
    res.json(req.session.user);
  } catch (e) { next(e); }
});

router.post('/cambiar-password', requireAuth, async (req, res, next) => {
  try {
    const { actual, nueva } = req.body;
    if (!nueva || nueva.length < 6) return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
    const { rows } = await query('SELECT password_hash FROM usuarios WHERE id = $1', [req.session.user.id]);
    if (!(await bcrypt.compare(actual || '', rows[0].password_hash))) {
      return res.status(400).json({ error: 'La contraseña actual no es correcta' });
    }
    await query('UPDATE usuarios SET password_hash = $1, debe_cambiar_password = false WHERE id = $2',
      [await bcrypt.hash(nueva, 10), req.session.user.id]);
    req.session.user.debe_cambiar_password = false;
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
