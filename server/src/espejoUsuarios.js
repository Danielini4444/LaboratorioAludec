// Espejo local de identidad del IdP central (login.md §5): resuelve el `sub`
// del token al `usuarios.id` que usan los FK de trazabilidad. La autorización
// NO sale de aquí (sale del token); el espejo solo aporta el id local.
// Caché en proceso; se escribe SOLO en el alta (primer encuentro) o cuando el
// IdP cambió nombre/rol. Nunca upsert por request.
const { query } = require('./db');

const TTL_MS = 5 * 60 * 1000;
const cache = new Map(); // sub → { user, expira }

let areasPorNombre = null; // catálogo chico y estable: nombre → id
async function resolverAreaId(nombre) {
  if (nombre == null) return null;
  if (!areasPorNombre) {
    const { rows } = await query('SELECT id, nombre FROM areas');
    areasPorNombre = new Map(rows.map(a => [a.nombre, a.id]));
  }
  const id = areasPorNombre.get(nombre);
  if (!id) {
    const e = new Error(`Área desconocida en el mapeo de roles: ${nombre}`);
    e.status = 500;
    throw e;
  }
  return id;
}

// La MISMA forma que arma el login local (routes/auth.js): las rutas y auth.js
// no distinguen en qué modo corren.
function formaSesion(u, area_nombre) {
  return {
    id: u.id, usuario: u.usuario, nombre: u.nombre, rol: u.rol,
    area_id: u.area_id, area_nombre, debe_cambiar_password: false
  };
}

async function resolverUsuario(claims, mapeo) {
  const sub = claims.sub;
  const vigente = cache.get(sub);
  if (vigente && vigente.expira > Date.now()) return vigente.user;

  const usuario = claims.preferred_username;
  const nombre = claims.name || usuario;
  const area_id = await resolverAreaId(mapeo.area_nombre);

  let { rows: [u] } = await query('SELECT * FROM usuarios WHERE external_id = $1', [sub]);

  if (!u) {
    // Adopción: un usuario local pre-SSO con el mismo `usuario` se enlaza al IdP
    // y conserva su historial de trazabilidad (mismos usuarios.id en los FK).
    ({ rows: [u] } = await query(
      `UPDATE usuarios SET external_id = $1, nombre = $2, rol = $3, area_id = $4
       WHERE usuario = $5 AND external_id IS NULL RETURNING *`,
      [sub, nombre, mapeo.rol, area_id, usuario]
    ));
  }
  if (!u) {
    // Alta JIT: primera vez que este usuario del IdP entra a lab.
    // ON CONFLICT protege la carrera de requests paralelos del primer ingreso.
    ({ rows: [u] } = await query(
      `INSERT INTO usuarios (usuario, nombre, rol, area_id, activo, debe_cambiar_password, external_id)
       VALUES ($1, $2, $3, $4, true, false, $5)
       ON CONFLICT (external_id) DO NOTHING RETURNING *`,
      [usuario, nombre, mapeo.rol, area_id, sub]
    ));
    if (!u) ({ rows: [u] } = await query('SELECT * FROM usuarios WHERE external_id = $1', [sub]));
  } else if (u.nombre !== nombre || u.rol !== mapeo.rol || u.area_id !== area_id) {
    // El IdP cambió nombre o rol → se actualiza el espejo (una vez, no por request)
    ({ rows: [u] } = await query(
      'UPDATE usuarios SET nombre = $1, rol = $2, area_id = $3 WHERE id = $4 RETURNING *',
      [nombre, mapeo.rol, area_id, u.id]
    ));
  }

  const user = formaSesion(u, mapeo.area_nombre);
  cache.set(sub, { user, expira: Date.now() + TTL_MS });
  return user;
}

module.exports = { resolverUsuario };
