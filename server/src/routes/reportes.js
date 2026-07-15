const express = require('express');
const fs = require('fs');
const path = require('path');
const { query } = require('../db');
const { requireAuth, requireRol, requireArea, requireFirmante } = require('../auth');
const { generarToken, qrDeFirma } = require('../firma');
const generarReportePdf = require('../pdf/reportePdf');

const UPLOADS = path.join(__dirname, '..', '..', 'uploads');

const router = express.Router();
const AREA = 'Metrología';

async function cargarReporte(id) {
  const { rows } = await query(
    `SELECT r.*, c.nombre AS cliente_nombre,
            ur.nombre AS realizado_por_nombre, ua.nombre AS aprobado_por_nombre,
            uan.nombre AS anulado_por_nombre, uf.nombre AS firmado_por_nombre
     FROM reportes_ensayo r
     JOIN clientes c ON c.id = r.cliente_id
     JOIN usuarios ur ON ur.id = r.realizado_por
     LEFT JOIN usuarios ua ON ua.id = r.aprobado_por
     LEFT JOIN usuarios uan ON uan.id = r.anulado_por
     LEFT JOIN usuarios uf ON uf.id = r.firmado_por
     WHERE r.id = $1`, [id]
  );
  const reporte = rows[0];
  if (!reporte) return null;

  const { rows: pruebas } = await query(
    `SELECT p.*, u.nombre AS realizado_por_nombre,
            q.nombre AS equipo_nombre, q.referencia_interna AS equipo_referencia,
            q.fecha_calibracion AS equipo_calibracion,
            (SELECT coalesce(json_agg(json_build_object('id', i.id, 'nombre', i.nombre_original, 'archivo', i.archivo) ORDER BY i.id), '[]')
             FROM prueba_imagenes i WHERE i.prueba_id = p.id) AS imagenes
     FROM reporte_pruebas p
     JOIN usuarios u ON u.id = p.realizado_por
     LEFT JOIN equipos q ON q.id = p.equipo_id
     WHERE p.reporte_id = $1 ORDER BY p.numero`, [id]
  );
  return { ...reporte, pruebas };
}

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const condiciones = [];
    const params = [];
    if (req.query.cliente_id) {
      params.push(req.query.cliente_id);
      condiciones.push(`r.cliente_id = $${params.length}`);
    }
    const busqueda = (req.query.q || '').trim();
    if (busqueda) {
      params.push(`%${busqueda}%`);
      condiciones.push(`(r.folio::text ILIKE $${params.length} OR r.referencia ILIKE $${params.length}
        OR r.denominacion ILIKE $${params.length} OR r.of ILIKE $${params.length} OR c.nombre ILIKE $${params.length})`);
    }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT r.id, r.folio, r.referencia, r.denominacion, r.of, r.conclusion,
              r.fecha_recepcion, r.creado_en, r.aprobado_por IS NOT NULL AS aprobado,
              r.anulado_por IS NOT NULL AS anulado,
              c.nombre AS cliente_nombre, u.nombre AS realizado_por_nombre,
              (SELECT count(*) FROM reporte_pruebas p WHERE p.reporte_id = r.id)::int AS num_pruebas
       FROM reportes_ensayo r
       JOIN clientes c ON c.id = r.cliente_id
       JOIN usuarios u ON u.id = r.realizado_por
       ${where} ORDER BY r.folio DESC LIMIT 300`, params
    );
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/:id(\\d+)', requireAuth, async (req, res, next) => {
  try {
    const reporte = await cargarReporte(req.params.id);
    if (!reporte) return res.status(404).json({ error: 'Reporte no encontrado' });
    res.json(reporte);
  } catch (e) { next(e); }
});

// Crea el reporte (asigna folio Ens_####); las pruebas se agregan después.
router.post('/', requireArea(AREA), async (req, res, next) => {
  try {
    const { cliente_id, referencia, denominacion, proyecto, area_solicitante,
            descripcion_material, of, fecha_recepcion, cantidad_piezas, informacion_previa } = req.body;
    if (!cliente_id || !referencia || !denominacion) {
      return res.status(400).json({ error: 'Cliente, referencia y denominación son requeridos' });
    }
    const { rows } = await query(
      `INSERT INTO reportes_ensayo
         (folio, cliente_id, referencia, denominacion, proyecto, area_solicitante,
          descripcion_material, of, fecha_recepcion, cantidad_piezas, informacion_previa, realizado_por)
       VALUES (nextval('ens_folio_seq'), $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [cliente_id, referencia.trim(), denominacion.trim(), proyecto || null, area_solicitante || null,
       descripcion_material || null, of || null, fecha_recepcion || null,
       cantidad_piezas || null, informacion_previa || null, req.body.realizado_por || req.session.user.id]
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
    const { proyecto, area_solicitante, descripcion_material, of,
            fecha_recepcion, cantidad_piezas, informacion_previa, realizado_por } = req.body;
    const { rows } = await query(
      `UPDATE reportes_ensayo SET
         proyecto = COALESCE($1, proyecto),
         area_solicitante = COALESCE($2, area_solicitante),
         descripcion_material = COALESCE($3, descripcion_material),
         of = COALESCE($4, of),
         fecha_recepcion = COALESCE($5, fecha_recepcion),
         cantidad_piezas = COALESCE($6, cantidad_piezas),
         informacion_previa = COALESCE($7, informacion_previa),
         realizado_por = COALESCE($9, realizado_por)
       WHERE id = $8 AND aprobado_por IS NULL AND anulado_por IS NULL RETURNING *`,
      [proyecto, area_solicitante, descripcion_material, of,
       fecha_recepcion, cantidad_piezas, informacion_previa, req.params.id, realizado_por || null]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Reporte no encontrado, ya aprobado o anulado' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// Agrega una prueba al reporte.
router.post('/:id(\\d+)/pruebas', requireArea(AREA), async (req, res, next) => {
  try {
    const { ensayo, norma, apartado, criterios, equipo_id, condiciones,
            fecha_inicio, fecha_fin, resultado, tipo_falla, valoracion, comentario } = req.body;
    if (!ensayo) return res.status(400).json({ error: 'El nombre del ensayo es requerido' });
    if (valoracion && !['OK', 'NOK'].includes(valoracion)) {
      return res.status(400).json({ error: 'La valoración debe ser OK o NOK' });
    }
    const { rows: reps } = await query('SELECT aprobado_por, anulado_por FROM reportes_ensayo WHERE id = $1', [req.params.id]);
    if (!reps[0]) return res.status(404).json({ error: 'Reporte no encontrado' });
    if (reps[0].aprobado_por) return res.status(400).json({ error: 'El reporte ya está aprobado' });
    if (reps[0].anulado_por) return res.status(400).json({ error: 'El reporte está anulado' });

    const { rows } = await query(
      `INSERT INTO reporte_pruebas
         (reporte_id, numero, ensayo, norma, apartado, criterios, equipo_id, condiciones,
          fecha_inicio, fecha_fin, resultado, tipo_falla, valoracion, comentario, realizado_por)
       VALUES ($1, (SELECT coalesce(max(numero), 0) + 1 FROM reporte_pruebas WHERE reporte_id = $1),
               $2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [req.params.id, ensayo.trim(), norma || null, apartado || null, criterios || null,
       equipo_id || null, condiciones || null, fecha_inicio || null, fecha_fin || null,
       resultado || null, tipo_falla || null, valoracion || null, comentario || null, req.session.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23503') return res.status(400).json({ error: 'Equipo no existe' });
    next(e);
  }
});

// Precarga las pruebas del plan de cromado del cliente del reporte.
router.post('/:id(\\d+)/precargar-plan', requireArea(AREA), async (req, res, next) => {
  try {
    const { rows: reps } = await query(
      'SELECT cliente_id, aprobado_por, anulado_por FROM reportes_ensayo WHERE id = $1', [req.params.id]
    );
    if (!reps[0]) return res.status(404).json({ error: 'Reporte no encontrado' });
    if (reps[0].aprobado_por) return res.status(400).json({ error: 'El reporte ya está aprobado' });
    if (reps[0].anulado_por) return res.status(400).json({ error: 'El reporte está anulado' });

    const params = [reps[0].cliente_id];
    let filtroNorma = '';
    if (req.body && req.body.plan_norma) {
      params.push(req.body.plan_norma);
      filtroNorma = 'AND plan_norma = $2';
    }
    const { rows: plan } = await query(
      `SELECT * FROM planes_prueba WHERE cliente_id = $1 AND proceso = 'cromado' ${filtroNorma} ORDER BY orden`,
      params
    );
    if (!plan.length) return res.status(404).json({ error: 'El cliente no tiene plan de cromado cargado' });
    const normas = [...new Set(plan.map(p => p.plan_norma))];
    if (normas.length > 1) {
      return res.status(400).json({ error: `El cliente tiene varios planes; indica cuál: ${normas.join(', ')}` });
    }

    for (const p of plan) {
      await query(
        `INSERT INTO reporte_pruebas
           (reporte_id, numero, ensayo, norma, criterios, realizado_por)
         VALUES ($1, (SELECT coalesce(max(numero), 0) + 1 FROM reporte_pruebas WHERE reporte_id = $1),
                 $2,$3,$4,$5)`,
        [req.params.id, p.ensayo, p.norma, p.caracteristica, req.session.user.id]
      );
    }
    res.status(201).json({ agregadas: plan.length });
  } catch (e) { next(e); }
});

// Completa/edita una prueba mientras el reporte siga abierto.
router.put('/pruebas/:pruebaId(\\d+)', requireArea(AREA), async (req, res, next) => {
  try {
    const { ensayo, norma, apartado, criterios, equipo_id, condiciones,
            fecha_inicio, fecha_fin, resultado, tipo_falla, valoracion, comentario } = req.body;
    if (valoracion && !['OK', 'NOK'].includes(valoracion)) {
      return res.status(400).json({ error: 'La valoración debe ser OK o NOK' });
    }
    const { rows } = await query(
      `UPDATE reporte_pruebas p SET
         ensayo = COALESCE($1, p.ensayo),
         norma = COALESCE($2, p.norma),
         apartado = COALESCE($3, p.apartado),
         criterios = COALESCE($4, p.criterios),
         equipo_id = COALESCE($5, p.equipo_id),
         condiciones = COALESCE($6, p.condiciones),
         fecha_inicio = COALESCE($7, p.fecha_inicio),
         fecha_fin = COALESCE($8, p.fecha_fin),
         resultado = COALESCE($9, p.resultado),
         tipo_falla = COALESCE($10, p.tipo_falla),
         valoracion = COALESCE($11, p.valoracion),
         comentario = COALESCE($12, p.comentario),
         realizado_por = $13
       FROM reportes_ensayo r
       WHERE p.id = $14 AND r.id = p.reporte_id AND r.aprobado_por IS NULL AND r.anulado_por IS NULL
       RETURNING p.*`,
      [ensayo, norma, apartado, criterios, equipo_id, condiciones,
       fecha_inicio, fecha_fin, resultado, tipo_falla, valoracion, comentario,
       req.session.user.id, req.params.pruebaId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Prueba no encontrada o el reporte ya está aprobado' });
    res.json(rows[0]);
  } catch (e) {
    if (e.code === '23503') return res.status(400).json({ error: 'Equipo no existe' });
    next(e);
  }
});

router.delete('/pruebas/:pruebaId(\\d+)', requireArea(AREA), async (req, res, next) => {
  try {
    const { rows } = await query(
      `DELETE FROM reporte_pruebas p
       USING reportes_ensayo r
       WHERE p.id = $1 AND r.id = p.reporte_id AND r.aprobado_por IS NULL AND r.anulado_por IS NULL
       RETURNING p.id`, [req.params.pruebaId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Prueba no encontrada o el reporte ya está aprobado' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Aprueba el reporte: requiere conclusión.
router.put('/:id(\\d+)/aprobar', requireArea(AREA, true), async (req, res, next) => {
  try {
    const { conclusion, valoracion_final } = req.body;
    if (!conclusion || !['CUMPLE', 'NO_CUMPLE'].includes(conclusion)) {
      return res.status(400).json({ error: 'La conclusión (CUMPLE / NO_CUMPLE) es requerida' });
    }
    const { rows } = await query(
      `UPDATE reportes_ensayo SET
         conclusion = $1, valoracion_final = $2,
         aprobado_por = $3, aprobado_en = now(), fecha_emision = current_date
       WHERE id = $4 AND aprobado_por IS NULL AND anulado_por IS NULL RETURNING *`,
      [conclusion, valoracion_final || null, req.session.user.id, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Reporte no encontrado, ya aprobado o anulado' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// Firma digital: solo admin, admin de Químico y admin de Metrología, y solo
// sobre reportes ya aprobados. El token queda en el documento y el QR del
// PDF lleva a la página pública de verificación.
router.put('/:id(\\d+)/firmar', requireFirmante, async (req, res, next) => {
  try {
    const fechaIso = new Date().toISOString();
    const token = generarToken('reporte', req.params.id, req.session.user.id, fechaIso);
    const { rows } = await query(
      `UPDATE reportes_ensayo SET firmado_por = $1, firmado_en = $2, firma_token = $3
       WHERE id = $4 AND aprobado_por IS NOT NULL AND anulado_por IS NULL AND firmado_por IS NULL
       RETURNING id`,
      [req.session.user.id, fechaIso, token, req.params.id]
    );
    if (!rows[0]) {
      return res.status(400).json({ error: 'El reporte no existe, no está aprobado, está anulado o ya está firmado' });
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Anulación con traza (en vez de borrado): el reporte queda visible y marcado.
router.put('/:id(\\d+)/anular', requireRol(), async (req, res, next) => {
  try {
    const motivo = (req.body.motivo || '').trim();
    if (!motivo) return res.status(400).json({ error: 'El motivo de la anulación es obligatorio' });
    const { rows } = await query(
      `UPDATE reportes_ensayo SET anulado_por = $1, anulado_en = now(), motivo_anulacion = $2
       WHERE id = $3 AND anulado_por IS NULL RETURNING id`,
      [req.session.user.id, motivo, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Reporte no encontrado o ya está anulado' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Borrado DEFINITIVO del reporte completo (a diferencia de Anular, que deja
// traza): solo admin, y aplica aunque el reporte esté aprobado o firmado.
// Las pruebas e imágenes caen en cascada; las fotos se limpian del disco.
router.delete('/:id(\\d+)', requireRol(), async (req, res, next) => {
  try {
    const { rows: fotos } = await query(
      `SELECT i.archivo FROM prueba_imagenes i
       JOIN reporte_pruebas p ON p.id = i.prueba_id WHERE p.reporte_id = $1`, [req.params.id]
    );
    const { rows } = await query('DELETE FROM reportes_ensayo WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Reporte no encontrado' });
    for (const f of fotos) fs.unlink(path.join(UPLOADS, f.archivo), () => {});
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.get('/:id(\\d+)/pdf', requireAuth, async (req, res, next) => {
  try {
    const reporte = await cargarReporte(req.params.id);
    if (!reporte) return res.status(404).json({ error: 'Reporte no encontrado' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Ens_${reporte.folio}.pdf"`);
    generarReportePdf(res, reporte, { qr: await qrDeFirma(req, 'reporte', reporte) });
  } catch (e) { next(e); }
});

module.exports = router;
module.exports.cargarReporte = cargarReporte; // la usa la impresión por OF
