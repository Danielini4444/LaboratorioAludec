const express = require('express');
const fs = require('fs');
const path = require('path');
const { query } = require('../db');
const { requireAuth, requireArea, requireFirmante } = require('../auth');
const { generarToken, qrDeFirma } = require('../firma');
const generarEnsayoInyeccionPdf = require('../pdf/ensayoInyeccionPdf');

const UPLOADS = path.join(__dirname, '..', '..', 'uploads');

const router = express.Router();
const AREA = 'Metrología';

// OF/lote: varias o ninguna ("no siempre aplica"); se guardan como text[].
function normalizarOfs(ofs) {
  if (!Array.isArray(ofs)) return [];
  return [...new Set(ofs.map(o => String(o).trim()).filter(Boolean))];
}

async function cargarEnsayo(id) {
  const { rows } = await query(
    `SELECT e.*, c.nombre AS cliente_nombre,
            ur.nombre AS realizado_por_nombre, ua.nombre AS aprobado_por_nombre,
            uan.nombre AS anulado_por_nombre, uf.nombre AS firmado_por_nombre
     FROM ensayos_inyeccion e
     JOIN clientes c ON c.id = e.cliente_id
     JOIN usuarios ur ON ur.id = e.realizado_por
     LEFT JOIN usuarios ua ON ua.id = e.aprobado_por
     LEFT JOIN usuarios uan ON uan.id = e.anulado_por
     LEFT JOIN usuarios uf ON uf.id = e.firmado_por
     WHERE e.id = $1`, [id]
  );
  const ensayo = rows[0];
  if (!ensayo) return null;

  const { rows: filas } = await query(
    `SELECT f.*, u.nombre AS realizado_por_nombre
     FROM ensayo_iny_filas f
     JOIN usuarios u ON u.id = f.realizado_por
     WHERE f.ensayo_id = $1 ORDER BY f.numero`, [id]
  );
  const { rows: fotos } = await query(
    `SELECT id, archivo, nombre_original, descripcion
     FROM ensayo_iny_fotos WHERE ensayo_id = $1 ORDER BY id`, [id]
  );
  return { ...ensayo, filas, fotos };
}

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const condiciones = [];
    const params = [];
    if (req.query.cliente_id) {
      params.push(req.query.cliente_id);
      condiciones.push(`e.cliente_id = $${params.length}`);
    }
    const busqueda = (req.query.q || '').trim();
    if (busqueda) {
      params.push(`%${busqueda}%`);
      condiciones.push(`(e.folio::text ILIKE $${params.length} OR e.referencia ILIKE $${params.length}
        OR e.denominacion ILIKE $${params.length} OR array_to_string(e.ofs, ' ') ILIKE $${params.length}
        OR c.nombre ILIKE $${params.length})`);
    }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT e.id, e.folio, e.referencia, e.denominacion, e.ofs, e.solicitante,
              e.creado_en, e.aprobado_por IS NOT NULL AS aprobado,
              e.anulado_por IS NOT NULL AS anulado,
              c.nombre AS cliente_nombre, u.nombre AS realizado_por_nombre,
              (SELECT count(*) FROM ensayo_iny_filas f WHERE f.ensayo_id = e.id)::int AS num_filas,
              (SELECT count(*) FROM ensayo_iny_filas f WHERE f.ensayo_id = e.id AND f.conformidad = 'NOK')::int AS num_nok
       FROM ensayos_inyeccion e
       JOIN clientes c ON c.id = e.cliente_id
       JOIN usuarios u ON u.id = e.realizado_por
       ${where} ORDER BY e.folio DESC LIMIT 300`, params
    );
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/:id(\\d+)', requireAuth, async (req, res, next) => {
  try {
    const ensayo = await cargarEnsayo(req.params.id);
    if (!ensayo) return res.status(404).json({ error: 'Ensayo no encontrado' });
    res.json(ensayo);
  } catch (e) { next(e); }
});

// Crea el informe (asigna folio Iny_####); las filas se agregan después.
router.post('/', requireArea(AREA), async (req, res, next) => {
  try {
    const { cliente_id, referencia, denominacion, ofs, solicitante, informacion_previa } = req.body;
    if (!cliente_id || !referencia || !denominacion) {
      return res.status(400).json({ error: 'Cliente, referencia y denominación son requeridos' });
    }
    const { rows } = await query(
      `INSERT INTO ensayos_inyeccion
         (folio, cliente_id, referencia, denominacion, ofs, solicitante, informacion_previa, realizado_por)
       VALUES (nextval('iny_folio_seq'), $1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [cliente_id, referencia.trim(), denominacion.trim(), normalizarOfs(ofs),
       solicitante || null, informacion_previa || null, req.session.user.id]
    );
    // pieza nueva → catálogo
    await query(
      `INSERT INTO piezas (referencia, denominacion, cliente_id)
       VALUES ($1,$2,$3) ON CONFLICT ((lower(referencia))) DO NOTHING`,
      [referencia.trim(), denominacion.trim(), cliente_id]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23503') return res.status(400).json({ error: 'Cliente no existe' });
    next(e);
  }
});

// Edita la cabecera mientras no esté aprobado.
router.put('/:id(\\d+)', requireArea(AREA), async (req, res, next) => {
  try {
    const { ofs, solicitante, informacion_previa } = req.body;
    const { rows } = await query(
      `UPDATE ensayos_inyeccion SET
         ofs = COALESCE($1, ofs),
         solicitante = COALESCE($2, solicitante),
         informacion_previa = COALESCE($3, informacion_previa)
       WHERE id = $4 AND aprobado_por IS NULL AND anulado_por IS NULL RETURNING *`,
      [ofs !== undefined ? normalizarOfs(ofs) : null, solicitante, informacion_previa, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Ensayo no encontrado, ya aprobado o anulado' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// Agrega una fila de ensayo al informe.
router.post('/:id(\\d+)/filas', requireArea(AREA), async (req, res, next) => {
  try {
    const { descripcion, exigencia, resultado, caracteristica, observaciones, conformidad } = req.body;
    if (!descripcion) return res.status(400).json({ error: 'El ensayo-descripción es requerido' });
    if (conformidad && !['OK', 'NOK'].includes(conformidad)) {
      return res.status(400).json({ error: 'La conformidad debe ser OK o NOK' });
    }
    const { rows: ens } = await query('SELECT aprobado_por, anulado_por FROM ensayos_inyeccion WHERE id = $1', [req.params.id]);
    if (!ens[0]) return res.status(404).json({ error: 'Ensayo no encontrado' });
    if (ens[0].aprobado_por) return res.status(400).json({ error: 'El informe ya está aprobado' });
    if (ens[0].anulado_por) return res.status(400).json({ error: 'El informe está anulado' });

    const { rows } = await query(
      `INSERT INTO ensayo_iny_filas
         (ensayo_id, numero, descripcion, exigencia, resultado, caracteristica, observaciones, conformidad, realizado_por)
       VALUES ($1, (SELECT coalesce(max(numero), 0) + 1 FROM ensayo_iny_filas WHERE ensayo_id = $1),
               $2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.params.id, descripcion.trim(), exigencia || null, resultado || null,
       caracteristica || null, observaciones || null, conformidad || null, req.session.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

// Completa/edita una fila mientras el informe siga abierto.
router.put('/filas/:filaId(\\d+)', requireArea(AREA), async (req, res, next) => {
  try {
    const { descripcion, exigencia, resultado, caracteristica, observaciones, conformidad } = req.body;
    if (conformidad && !['OK', 'NOK'].includes(conformidad)) {
      return res.status(400).json({ error: 'La conformidad debe ser OK o NOK' });
    }
    const { rows } = await query(
      `UPDATE ensayo_iny_filas f SET
         descripcion = COALESCE($1, f.descripcion),
         exigencia = COALESCE($2, f.exigencia),
         resultado = COALESCE($3, f.resultado),
         caracteristica = COALESCE($4, f.caracteristica),
         observaciones = COALESCE($5, f.observaciones),
         conformidad = COALESCE($6, f.conformidad),
         realizado_por = $7
       FROM ensayos_inyeccion e
       WHERE f.id = $8 AND e.id = f.ensayo_id AND e.aprobado_por IS NULL AND e.anulado_por IS NULL
       RETURNING f.*`,
      [descripcion, exigencia, resultado, caracteristica, observaciones, conformidad,
       req.session.user.id, req.params.filaId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Fila no encontrada o el informe ya está aprobado' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.delete('/filas/:filaId(\\d+)', requireArea(AREA), async (req, res, next) => {
  try {
    const { rows } = await query(
      `DELETE FROM ensayo_iny_filas f
       USING ensayos_inyeccion e
       WHERE f.id = $1 AND e.id = f.ensayo_id AND e.aprobado_por IS NULL AND e.anulado_por IS NULL
       RETURNING f.id`, [req.params.filaId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Fila no encontrada o el informe ya está aprobado' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Aprueba el informe: requiere la valoración final.
router.put('/:id(\\d+)/aprobar', requireArea(AREA, true), async (req, res, next) => {
  try {
    const valoracion = (req.body.valoracion_final || '').trim();
    if (!valoracion) return res.status(400).json({ error: 'La valoración final es requerida' });
    const { rows } = await query(
      `UPDATE ensayos_inyeccion SET
         valoracion_final = $1,
         aprobado_por = $2, aprobado_en = now(), fecha_emision = current_date
       WHERE id = $3 AND aprobado_por IS NULL AND anulado_por IS NULL RETURNING *`,
      [valoracion, req.session.user.id, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Ensayo no encontrado, ya aprobado o anulado' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// Firma digital: mismos firmantes que el resto de documentos, solo sobre
// informes ya aprobados. El QR del PDF lleva a la verificación pública.
router.put('/:id(\\d+)/firmar', requireFirmante, async (req, res, next) => {
  try {
    const fechaIso = new Date().toISOString();
    const token = generarToken('inyeccion', req.params.id, req.session.user.id, fechaIso);
    const { rows } = await query(
      `UPDATE ensayos_inyeccion SET firmado_por = $1, firmado_en = $2, firma_token = $3
       WHERE id = $4 AND aprobado_por IS NOT NULL AND anulado_por IS NULL AND firmado_por IS NULL
       RETURNING id`,
      [req.session.user.id, fechaIso, token, req.params.id]
    );
    if (!rows[0]) {
      return res.status(400).json({ error: 'El informe no existe, no está aprobado, está anulado o ya está firmado' });
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Anulación con traza (en vez de borrado): el informe queda visible y marcado.
// Admin global o admin de Metrología.
router.put('/:id(\\d+)/anular', requireArea(AREA, true), async (req, res, next) => {
  try {
    const motivo = (req.body.motivo || '').trim();
    if (!motivo) return res.status(400).json({ error: 'El motivo de la anulación es obligatorio' });
    const { rows } = await query(
      `UPDATE ensayos_inyeccion SET anulado_por = $1, anulado_en = now(), motivo_anulacion = $2
       WHERE id = $3 AND anulado_por IS NULL RETURNING id`,
      [req.session.user.id, motivo, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Ensayo no encontrado o ya está anulado' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Borrado DEFINITIVO del informe completo: admin global o admin de Metrología,
// aplica aunque esté aprobado o firmado. Filas y fotos caen en cascada; las
// fotos se limpian del disco.
router.delete('/:id(\\d+)', requireArea(AREA, true), async (req, res, next) => {
  try {
    const { rows: fotos } = await query(
      'SELECT archivo FROM ensayo_iny_fotos WHERE ensayo_id = $1', [req.params.id]
    );
    const { rows } = await query('DELETE FROM ensayos_inyeccion WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Ensayo no encontrado' });
    for (const f of fotos) fs.unlink(path.join(UPLOADS, f.archivo), () => {});
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Folio para mostrar: Iny_0001.
const folioTexto = (folio) => `Iny_${String(folio).padStart(4, '0')}`;

router.get('/:id(\\d+)/pdf', requireAuth, async (req, res, next) => {
  try {
    const ensayo = await cargarEnsayo(req.params.id);
    if (!ensayo) return res.status(404).json({ error: 'Ensayo no encontrado' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${folioTexto(ensayo.folio)}.pdf"`);
    generarEnsayoInyeccionPdf(res, ensayo, { qr: await qrDeFirma(req, 'inyeccion', ensayo) });
  } catch (e) { next(e); }
});

module.exports = router;
module.exports.folioTexto = folioTexto;
