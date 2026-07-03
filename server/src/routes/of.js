// Impresión por OF: junta en un solo PDF todo lo de una orden de fabricación
// — reportes de Test de cromado (FM-15-30) y registros de espesores
// (FM-15-01-03) — dejando escoger qué documentos y qué pruebas imprimir.
// Cada documento conserva su formato y su numeración de páginas, como el
// paquete real (FM-15-30 con el FM-15-01-03 de anexo).
const express = require('express');
const { PassThrough } = require('stream');
const { PDFDocument } = require('pdf-lib');
const { query } = require('../db');
const { requireAuth } = require('../auth');
const { cargarRegistro } = require('./registros');
const { cargarReporte } = require('./reportes');
const generarRegistroPdf = require('../pdf/registroPdf');
const generarReportePdf = require('../pdf/reportePdf');

const router = express.Router();

// Corre un generador de PDF (que espera un stream) hacia un Buffer.
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

const ids = v => String(v || '').split(',')
  .map(Number).filter(n => Number.isInteger(n) && n > 0);

const SECCIONES_REGISTRO = ['thickness', 'step', 'poros'];

// OFs que existen en cualquiera de los dos módulos, con cuántos documentos
// tiene cada una (para la búsqueda de la pantalla Imprimir por OF).
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(
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
       GROUP BY t."of" ORDER BY t."of" DESC LIMIT 25`,
      [`%${(req.query.q || '').trim()}%`]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// Todo lo capturado con esa OF, en los dos módulos.
router.get('/documentos', requireAuth, async (req, res, next) => {
  try {
    const of = (req.query.of || '').trim();
    if (!of) return res.status(400).json({ error: 'Indica la OF' });

    const [registros, reportes] = await Promise.all([
      query(
        `SELECT r.id, r.reporte_no, r.norma, r.referencia, r.denominacion, r.barra,
                r.fecha_prueba, r.resultado, r.aprobado_por IS NOT NULL AS aprobado,
                c.nombre AS cliente_nombre,
                (SELECT count(*) FROM registro_piezas p WHERE p.registro_id = r.id)::int AS num_piezas,
                (SELECT count(*) FROM registro_piezas p WHERE p.registro_id = r.id
                   AND (p.ni_sb IS NOT NULL OR p.ni_br IS NOT NULL OR p.ni_mps IS NOT NULL
                        OR p.dp_mp_br IS NOT NULL OR p.dp_br_sb IS NOT NULL))::int AS num_step,
                (SELECT count(*) FROM registro_piezas p WHERE p.registro_id = r.id
                   AND p.poros IS NOT NULL)::int AS num_poros
         FROM registros_espesores r
         JOIN clientes c ON c.id = r.cliente_id
         WHERE btrim(r.of) = $1
         ORDER BY r.fecha_prueba DESC, r.reporte_no DESC`, [of]
      ),
      query(
        `SELECT r.id, r.folio, r.referencia, r.denominacion, r.conclusion,
                r.fecha_recepcion, r.aprobado_por IS NOT NULL AS aprobado,
                c.nombre AS cliente_nombre,
                (SELECT coalesce(json_agg(json_build_object(
                   'id', p.id, 'numero', p.numero, 'ensayo', p.ensayo, 'norma', p.norma,
                   'apartado', p.apartado, 'valoracion', p.valoracion) ORDER BY p.numero), '[]')
                 FROM reporte_pruebas p WHERE p.reporte_id = r.id) AS pruebas
         FROM reportes_ensayo r
         JOIN clientes c ON c.id = r.cliente_id
         WHERE btrim(r.of) = $1
         ORDER BY r.folio DESC`, [of]
      )
    ]);
    res.json({ of, registros: registros.rows, reportes: reportes.rows });
  } catch (e) { next(e); }
});

// PDF combinado: ?of=...&reportes=1,2&pruebas_1=10,11&registros=3,4&secciones_3=thickness,poros
// (pruebas_<id> limita qué pruebas de ese reporte se imprimen; secciones_<id>
// limita qué partes del FM-15-01-03 van — thickness, step, poros; sin ellos va todo).
// Orden del paquete: primero los FM-15-30, luego los FM-15-01-03 de anexo.
router.get('/pdf', requireAuth, async (req, res, next) => {
  try {
    const of = (req.query.of || '').trim();
    if (!of) return res.status(400).json({ error: 'Indica la OF' });
    const idsReportes = ids(req.query.reportes);
    const idsRegistros = ids(req.query.registros);
    if (!idsReportes.length && !idsRegistros.length) {
      return res.status(400).json({ error: 'Selecciona al menos un documento' });
    }

    // solo documentos que de verdad pertenecen a esa OF
    const buffers = [];
    for (const id of idsReportes) {
      const reporte = await cargarReporte(id);
      if (!reporte || (reporte.of || '').trim() !== of) continue;
      const seleccion = ids(req.query[`pruebas_${id}`]);
      if (seleccion.length) reporte.pruebas = reporte.pruebas.filter(p => seleccion.includes(p.id));
      buffers.push(await aBuffer(generarReportePdf, reporte));
    }
    for (const id of idsRegistros) {
      const registro = await cargarRegistro(id);
      if (!registro || (registro.of || '').trim() !== of) continue;
      const pedidas = String(req.query[`secciones_${id}`] || '').split(',')
        .filter(s => SECCIONES_REGISTRO.includes(s));
      const opciones = pedidas.length
        ? { secciones: Object.fromEntries(SECCIONES_REGISTRO.map(s => [s, pedidas.includes(s)])) }
        : {};
      buffers.push(await aBuffer((s, datos) => generarRegistroPdf(s, datos, opciones), registro));
    }
    if (!buffers.length) {
      return res.status(404).json({ error: 'Ninguno de los documentos seleccionados pertenece a esa OF' });
    }

    const junto = await PDFDocument.create();
    for (const buf of buffers) {
      const pdf = await PDFDocument.load(buf);
      const paginas = await junto.copyPages(pdf, pdf.getPageIndices());
      for (const p of paginas) junto.addPage(p);
    }
    const bytes = await junto.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="OF_${of.replace(/[^\w.-]+/g, '_')}.pdf"`);
    res.send(Buffer.from(bytes));
  } catch (e) { next(e); }
});

module.exports = router;
