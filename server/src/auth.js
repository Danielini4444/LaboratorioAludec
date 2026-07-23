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
// El admin de área entra a CUALQUIER área (no solo la suya); el usuario de
// área queda limitado a su propia área.
function esDeArea(user, area, soloAdmin = false) {
  if (user.rol === 'admin') return true;
  if (user.rol === 'admin_area') return true;
  return !soloAdmin && user.rol === 'usuario_area' && user.area_nombre === area;
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

// Firmantes de documentos: SOLO admin global, admin de Químico y admin de
// Metrología (admin_area siempre tiene una de esas dos áreas).
function puedeFirmar(user) {
  return user.rol === 'admin' || user.rol === 'admin_area';
}

function requireFirmante(req, res, next) {
  const u = req.session.user;
  if (!u) return res.status(401).json({ error: 'No autenticado' });
  if (!puedeFirmar(u)) {
    return res.status(403).json({ error: 'Solo admin, admin de Químico o admin de Metrología pueden firmar' });
  }
  next();
}

module.exports = { requireAuth, requireRol, esDeArea, requireArea, esQuimico, requireQuimico, puedeFirmar, requireFirmante };
