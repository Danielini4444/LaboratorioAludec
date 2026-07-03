// Prueba rápida (manual) de la impresión por OF: toma una OF real de la base,
// genera los PDFs de sus documentos y los une con pdf-lib, como hace /api/of/pdf.
// Uso: node server/scripts/prueba-of.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const fs = require('fs');
const os = require('os');
const { PassThrough } = require('stream');
const { PDFDocument } = require('pdf-lib');
const { query, pool } = require('../src/db');
const { cargarRegistro } = require('../src/routes/registros');
const { cargarReporte } = require('../src/routes/reportes');
const generarRegistroPdf = require('../src/pdf/registroPdf');
const generarReportePdf = require('../src/pdf/reportePdf');

function aBuffer(generar, datos) {
  return new Promise((resolve, reject) => {
    const stream = new PassThrough();
    const partes = [];
    stream.on('data', c => partes.push(c));
    stream.on('end', () => resolve(Buffer.concat(partes)));
    stream.on('error', reject);
    generar(stream, datos);
  });
}

(async () => {
  // misma consulta del GET /api/of
  const { rows: ofs } = await query(
    `SELECT t."of", sum(t.registros)::int AS registros, sum(t.reportes)::int AS reportes
     FROM (
       SELECT r.of AS "of", count(*) AS registros, 0 AS reportes
       FROM registros_espesores r
       WHERE r.of IS NOT NULL AND btrim(r.of) <> '' GROUP BY r.of
       UNION ALL
       SELECT e.of, 0, count(*)
       FROM reportes_ensayo e
       WHERE e.of IS NOT NULL AND btrim(e.of) <> '' GROUP BY e.of
     ) t
     WHERE t."of" ILIKE $1
     GROUP BY t."of" ORDER BY t."of" DESC LIMIT 25`, ['%']
  );
  console.log('OFs encontradas:', JSON.stringify(ofs));
  if (!ofs.length) { console.log('No hay OFs capturadas; nada más que probar.'); return pool.end(); }

  // de preferencia una OF que tenga documentos de los dos módulos
  const of = (ofs.find(o => o.registros > 0 && o.reportes > 0) || ofs[0]).of;
  const [regs, reps] = await Promise.all([
    query('SELECT id FROM registros_espesores r WHERE btrim(r.of) = $1', [of]),
    query('SELECT id FROM reportes_ensayo r WHERE btrim(r.of) = $1', [of])
  ]);
  console.log(`OF elegida: "${of}" — ${regs.rows.length} registros, ${reps.rows.length} reportes`);

  const buffers = [];
  for (const { id } of reps.rows) {
    const reporte = await cargarReporte(id);
    // recorte de pruebas, como pruebas_<id>: deja solo la primera
    if (reporte.pruebas.length > 1) {
      console.log(`Reporte Ens_${reporte.folio}: ${reporte.pruebas.length} pruebas, imprimiendo solo la primera`);
      reporte.pruebas = reporte.pruebas.slice(0, 1);
    }
    buffers.push(await aBuffer(generarReportePdf, reporte));
  }
  let primero = true;
  for (const { id } of regs.rows) {
    const registro = await cargarRegistro(id);
    // al primer registro se le recortan secciones, como secciones_<id>=step,poros
    const opciones = primero ? { secciones: { thickness: false, step: true, poros: true } } : {};
    if (primero) console.log(`Registro ${registro.reporte_no}: imprimiendo solo S.T.E.P. y poros (sin thickness)`);
    primero = false;
    buffers.push(await aBuffer((s, datos) => generarRegistroPdf(s, datos, opciones), registro));
  }

  const junto = await PDFDocument.create();
  for (const buf of buffers) {
    const pdf = await PDFDocument.load(buf);
    for (const p of await junto.copyPages(pdf, pdf.getPageIndices())) junto.addPage(p);
  }
  const bytes = await junto.save();
  const destino = path.join(os.tmpdir(), 'prueba-of.pdf');
  fs.writeFileSync(destino, Buffer.from(bytes));
  console.log(`PDF combinado: ${junto.getPageCount()} páginas de ${buffers.length} documentos → ${destino}`);
  await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
