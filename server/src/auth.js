// Middleware de autenticación y permisos.
// El admin global pasa cualquier verificación de rol.

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });
  next();
}

function requireRol(...roles) {
  return (req, res, next) => {
    const u = req.session.user;
    if (!u) return res.status(401).json({ error: 'No autenticado' });
    if (u.rol === 'admin' || roles.includes(u.rol)) return next();
    return res.status(403).json({ error: 'Sin permiso para esta acción' });
  };
}

// Personal de un área concreta (o admin global). Las dos áreas del
// laboratorio: 'Químico' (registro de espesores) y 'Metrología'
// (reportes de ensayos).
function esDeArea(user, area, soloAdmin = false) {
  if (user.rol === 'admin') return true;
  const rolesValidos = soloAdmin ? ['admin_area'] : ['admin_area', 'usuario_area'];
  return rolesValidos.includes(user.rol) && user.area_nombre === area;
}

function requireArea(area, soloAdmin = false) {
  return (req, res, next) => {
    const u = req.session.user;
    if (!u) return res.status(401).json({ error: 'No autenticado' });
    if (!esDeArea(u, area, soloAdmin)) {
      return res.status(403).json({ error: `Solo el personal de ${area} puede hacer esto` });
    }
    next();
  };
}

const esQuimico = (user, soloAdmin) => esDeArea(user, 'Químico', soloAdmin);
const requireQuimico = (soloAdmin) => requireArea('Químico', soloAdmin);

module.exports = { requireAuth, requireRol, esDeArea, requireArea, esQuimico, requireQuimico };
