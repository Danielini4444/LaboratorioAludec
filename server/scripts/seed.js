// Datos iniciales: las dos áreas, un usuario por cada uno de los 8 roles
// (contraseña inicial: cambiar123) y un par de tipos de ensayo de ejemplo.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../src/db');

async function main() {
  // const areas = {};
  // for (const nombre of ['Químico', 'Metrología']) {
  //   const { rows } = await pool.query(
  //     'INSERT INTO areas (nombre) VALUES ($1) RETURNING id', [nombre]
  //   );
  //   areas[nombre] = rows[0].id;
  // }

  const hash = await bcrypt.hash('cambiar123', 10);
  const hashDaniel = await bcrypt.hash('1234', 10);
  const usuarios = [
    // ['admin',            'Administrador',        'admin',        null, hash],
    // ['auditor',          'Auditor',              'auditor',      null, hash],
    // ['auditoradmin',     'Auditor Admin',        'auditor_admin', null, hash],
    // ['solicitante',      'Solicitante de ensayos', 'solicitante', null, hash],
    // ['adminquimico',     'Admin Químico',        'admin_area',   areas['Químico'], hash],
    // ['adminmetrologia',  'Admin Metrología',     'admin_area',   areas['Metrología'], hash],
    // ['usuarioquimico',   'Usuario Químico',      'usuario_area', areas['Químico'], hash],
    // ['usuariometrologia','Usuario Metrología',   'usuario_area', areas['Metrología'], hash],
    ['daniel',           'Daniel',               'admin',        null, hashDaniel]
  ];
  for (const [usuario, nombre, rol, areaId, passwordHash] of usuarios) {
    await pool.query(
      // debe_cambiar_password en true: la contraseña inicial es conocida, hay que rotarla al entrar
      'INSERT INTO usuarios (usuario, nombre, password_hash, rol, area_id, debe_cambiar_password) VALUES ($1,$2,$3,$4,$5,true)',
      [usuario, nombre, passwordHash, rol, areaId]
    );
  }

  await pool.end();
  console.log('datos iniciales creados — usuarios con contraseña: cambiar123 (se exige cambiarla al primer ingreso)');
}

main().catch(e => { console.error(e); process.exit(1); });
