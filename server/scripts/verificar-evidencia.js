// Verifica la integridad de la evidencia fotográfica: que cada imagen
// registrada en la BD exista en disco y su contenido coincida con el hash
// SHA-256 guardado al subirla. Las imágenes sin hash (anteriores al hash)
// se rellenan con el hash del archivo actual (backfill).
//
// Uso: node scripts/verificar-evidencia.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const crypto = require('crypto');
const fs = require('fs');
const { pool, query } = require('../src/db');

const UPLOADS = path.join(__dirname, '..', 'uploads');
const hashDe = (archivo) => crypto.createHash('sha256').update(fs.readFileSync(path.join(UPLOADS, archivo))).digest('hex');

async function revisar(tabla, etiqueta) {
  const { rows } = await query(`SELECT id, archivo, sha256 FROM ${tabla} ORDER BY id`);
  let ok = 0, faltantes = 0, cambiadas = 0, rellenadas = 0;
  for (const img of rows) {
    const ruta = path.join(UPLOADS, img.archivo);
    if (!fs.existsSync(ruta)) {
      console.log(`  ✗ FALTANTE  ${etiqueta} #${img.id} → ${img.archivo}`);
      faltantes++;
      continue;
    }
    const actual = hashDe(img.archivo);
    if (!img.sha256) {
      await query(`UPDATE ${tabla} SET sha256 = $1 WHERE id = $2`, [actual, img.id]);
      rellenadas++;
      ok++;
    } else if (img.sha256 !== actual) {
      console.log(`  ✗ CAMBIADA  ${etiqueta} #${img.id} → ${img.archivo}`);
      cambiadas++;
    } else {
      ok++;
    }
  }
  console.log(`${etiqueta}: ${rows.length} imágenes — ${ok} OK (${rellenadas} hash rellenado), ${faltantes} faltantes, ${cambiadas} cambiadas`);
  return { faltantes, cambiadas };
}

(async () => {
  console.log('Verificando integridad de la evidencia fotográfica…\n');
  const r1 = await revisar('registro_imagenes', 'Registro');
  const r2 = await revisar('prueba_imagenes', 'Cromado');
  const problemas = r1.faltantes + r1.cambiadas + r2.faltantes + r2.cambiadas;
  console.log(`\n${problemas === 0 ? '✓ Todo íntegro.' : `⚠ ${problemas} problema(s) de integridad — revisar arriba.`}`);
  await pool.end();
  process.exit(problemas === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
