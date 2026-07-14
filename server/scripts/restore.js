// Restaura en un servidor nuevo un respaldo completo hecho con pg_dump -F c,
// más la carpeta de fotos (uploads.zip) que vive fuera de la base de datos.
// Pensado para el primer arranque cuando se migran datos YA CAPTURADOS, en
// vez de partir de npm run seed (ver README > "Migrar datos ya capturados").
//
// Uso: node scripts/restore.js <respaldo.dump> [uploads.zip] [--force]
//   PG_BIN_DIR=... si pg_restore/createdb no están en el PATH del sistema
//   --force        restaura aunque la base destino ya tenga usuarios capturados
//                  (por default se aborta, para no pisar datos por accidente;
//                  una base recién migrada pero sin datos —el caso normal de
//                  un servidor nuevo tras "npm run migrate"— SÍ se sobrescribe
//                  sin pedir --force, ahí no hay nada que perder)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { Client } = require('pg');
// Ruta explícita (no relativa al cwd): el atajo "npm run restore" de la
// raíz del proyecto invoca este script sin cambiar el directorio a server/.
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function buscarBinPostgres() {
  if (process.env.PG_BIN_DIR) return process.env.PG_BIN_DIR;
  try { execFileSync('pg_restore', ['--version'], { stdio: 'ignore' }); return null; } catch { /* no está en PATH */ }
  const base = 'C:\\Program Files\\PostgreSQL';
  if (fs.existsSync(base)) {
    const versiones = fs.readdirSync(base)
      .filter(v => fs.existsSync(path.join(base, v, 'bin', 'pg_restore.exe')))
      .sort((a, b) => Number(b) - Number(a)); // la más nueva primero
    if (versiones.length) return path.join(base, versiones[0], 'bin');
  }
  throw new Error('No se encontró pg_restore. Define PG_BIN_DIR con la carpeta bin de tu instalación de PostgreSQL.');
}

const herramienta = (binDir, nombre) => binDir ? path.join(binDir, `${nombre}.exe`) : nombre;

async function main() {
  const forzar = process.argv.includes('--force');
  const [dumpFile, uploadsZip] = process.argv.slice(2).filter(a => a !== '--force');
  if (!dumpFile) {
    console.error('Uso: node scripts/restore.js <respaldo.dump> [uploads.zip] [--force]');
    process.exit(1);
  }
  if (!fs.existsSync(dumpFile)) throw new Error(`No existe el archivo: ${dumpFile}`);
  if (uploadsZip && !fs.existsSync(uploadsZip)) throw new Error(`No existe el archivo: ${uploadsZip}`);
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL no está configurada en server/.env');

  const url = new URL(process.env.DATABASE_URL);
  const host = url.hostname, port = url.port || '5432';
  const user = decodeURIComponent(url.username), password = decodeURIComponent(url.password);
  const dbName = url.pathname.replace(/^\//, '');
  const binDir = buscarBinPostgres();
  const envConPassword = { ...process.env, PGPASSWORD: password };

  // 1. crear la base si no existe (conectando a la base de mantenimiento 'postgres')
  const admin = new Client({ host, port, user, password, database: 'postgres' });
  await admin.connect();
  const { rows: existe } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (!existe.length) {
    console.log(`Creando base "${dbName}"…`);
    await admin.query(`CREATE DATABASE "${dbName}"`);
  }
  await admin.end();

  // 2. abortar si la base destino ya tiene DATOS reales, salvo --force.
  // Una base recién migrada (esquema creado por "npm run migrate", sin
  // filas) no cuenta como "con datos" — ahí no hay nada que proteger, y es
  // justo el estado normal de un servidor nuevo antes de restaurar.
  const destino = new Client({ host, port, user, password, database: dbName });
  await destino.connect();
  let usuariosExistentes = 0;
  try {
    const { rows } = await destino.query('SELECT count(*)::int AS n FROM usuarios');
    usuariosExistentes = rows[0].n;
  } catch { /* la tabla "usuarios" no existe todavía: base limpia */ }
  await destino.end();
  if (usuariosExistentes > 0 && !forzar) {
    throw new Error(
      `La base "${dbName}" ya tiene ${usuariosExistentes} usuario(s) capturado(s) — no se restaura encima para no perder datos. ` +
      'Si de verdad quieres continuar (sobrescribe lo que choque), vuelve a correr agregando --force.'
    );
  }

  // 3. pg_restore — --clean --if-exists para que funcione igual si la base
  // llegó vacía de verdad o si ya tiene el esquema (creado por migrate):
  // borra y recrea cada objeto en vez de fallar por "ya existe".
  console.log('Restaurando el respaldo…');
  execFileSync(herramienta(binDir, 'pg_restore'), [
    '-h', host, '-p', port, '-U', user, '-d', dbName,
    '--no-owner', '--no-privileges', '--clean', '--if-exists', '--exit-on-error', dumpFile
  ], { stdio: 'inherit', env: envConPassword });

  // 4. fotos
  if (uploadsZip) {
    const destinoUploads = path.join(__dirname, '..', 'uploads');
    fs.mkdirSync(destinoUploads, { recursive: true });
    console.log('Descomprimiendo fotos…');
    execFileSync('powershell.exe', [
      '-NoProfile', '-Command',
      `Expand-Archive -Path '${uploadsZip}' -DestinationPath '${destinoUploads}' -Force`
    ], { stdio: 'inherit' });
  } else {
    console.log('Sin uploads.zip: las fotos no se copiaron — hazlo a mano si el respaldo las tenía.');
  }

  // 5. resumen para verificar que todo llegó
  const check = new Client({ host, port, user, password, database: dbName });
  await check.connect();
  console.log('\nDatos restaurados:');
  for (const tabla of ['clientes', 'piezas', 'usuarios', 'registros_espesores', 'reportes_ensayo']) {
    const { rows } = await check.query(`SELECT count(*)::int AS n FROM ${tabla}`);
    console.log(`  ${tabla}: ${rows[0].n}`);
  }
  await check.end();

  console.log('\nListo. Sigue con: npm run migrate (confirma que el esquema está al día) → npm run build → npm start');
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
