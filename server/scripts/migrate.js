require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../src/db');

async function main() {
  const dir = path.join(__dirname, '..', 'migrations');
  await pool.query(`CREATE TABLE IF NOT EXISTS _migraciones (
    nombre text PRIMARY KEY, aplicada_en timestamptz NOT NULL DEFAULT now()
  )`);
  const aplicadas = new Set(
    (await pool.query('SELECT nombre FROM _migraciones')).rows.map(r => r.nombre)
  );
  for (const archivo of fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
    if (aplicadas.has(archivo)) continue;
    const sql = fs.readFileSync(path.join(dir, archivo), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migraciones (nombre) VALUES ($1)', [archivo]);
      await client.query('COMMIT');
      console.log(`aplicada: ${archivo}`);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
  await pool.end();
  console.log('migraciones al día');
}

main().catch(e => { console.error(e); process.exit(1); });
