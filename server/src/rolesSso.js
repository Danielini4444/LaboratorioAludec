// Mapeo del rol del token del IdP central al RBAC interno de lab (login.md §6).
// ÚNICO lugar donde se traduce rol_token → { rol, area_nombre }. El acceso a
// módulos se DERIVA del rol (§6.1): aquí no hay asignaciones por usuario.
const SYSTEM_ID = 'lab';

const MAPA_ROLES = {
  admin:            { rol: 'admin',         area_nombre: null },
  quimico_admin:    { rol: 'admin_area',    area_nombre: 'Químico' },
  quimico_user:     { rol: 'usuario_area',  area_nombre: 'Químico' },
  metrologia_admin: { rol: 'admin_area',    area_nombre: 'Metrología' },
  metrologia_user:  { rol: 'usuario_area',  area_nombre: 'Metrología' },
  auditor:          { rol: 'auditor',       area_nombre: null },
  auditor_admin:    { rol: 'auditor_admin', area_nombre: null },
  solicitante:      { rol: 'solicitante',   area_nombre: null }
};

module.exports = { SYSTEM_ID, MAPA_ROLES };
