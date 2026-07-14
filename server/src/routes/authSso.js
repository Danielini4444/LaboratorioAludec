// Rutas /api/auth en AUTH_MODE=sso: el login, el logout y las contraseñas
// viven en el IdP central; aquí solo queda /me (verificarJwt ya corrió antes).
const express = require('express');

const router = express.Router();

router.get('/me', (req, res) => res.json(req.session.user));

// El logout real lo hace el client contra el IdP; se responde ok por compatibilidad.
router.post('/logout', (req, res) => res.json({ ok: true }));

router.post('/login', (req, res) =>
  res.status(403).json({ error: 'El login local está deshabilitado en modo SSO' }));
router.post('/cambiar-password', (req, res) =>
  res.status(403).json({ error: 'Las contraseñas se administran en el login central del QMS' }));

module.exports = router;
