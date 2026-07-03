// Importa equipos desde equipos.json (generado por exportar-equipos.ps1).
// Idempotente: actualiza por ID interno, inserta los nuevos.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../src/db');

async function main() {
  const archivo = process.argv[2] || path.join(__dirname, 'equipos.json');
  const equipos = JSON.parse(fs.readFileSync(archivo, 'utf8').replace(/^﻿/, ''));
  let nuevas = 0, actualizadas = 0;
  for (const e of equipos) {
    const nombre = (e.nombre || '').trim();
    if (!nombre) continue;
    const ref = (e.referencia_interna || '').trim();
    const refLimpia = !ref || /^N\/?A$/i.test(ref) ? null : ref;
    if (refLimpia) {
      const { rows } = await pool.query(
        `SELECT id FROM equipos WHERE lower(referencia_interna) = lower($1)`, [refLimpia]
      );
      if (rows[0]) {
        await pool.query('UPDATE equipos SET nombre = $1 WHERE id = $2', [nombre, rows[0].id]);
        actualizadas++;
        continue;
      }
    }
    await pool.query(
      'INSERT INTO equipos (nombre, referencia_interna) VALUES ($1, $2)',
      [nombre, refLimpia]
    );
    nuevas++;
  }
  console.log(`equipos nuevos: ${nuevas}, actualizados: ${actualizadas}`);
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
