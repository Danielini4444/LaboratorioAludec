// Solicitud de ensayos — sistema de tickets (FM-15-01 / FM-15-01A).
// El solicitante crea el ticket; el área del laboratorio lo toma y lo cierra.
const express = require('express');
const { pool, query } = require('../db');
const { requireAuth, requireRol, esDeArea } = require('../auth');

const router = express.Router();

const SECUENCIA_FOLIO = { SE: 'sol_se_folio_seq', SEMP: 'sol_semp_folio_seq' };

// Carga cabecera + líneas de ensayo, con los nombres ya resueltos.
async function cargarSolicitud(id) {
  const { rows } = await query(
    `SELECT s.*, c.nombre AS cliente_nombre, a.nombre AS area_nombre,
            us.nombre AS solicitada_por_nombre, ua.nombre AS atendida_por_nombre
     FROM solicitudes_ensayo s
     JOIN areas a ON a.id = s.area_id
     JOIN usuarios us ON us.id = s.solicitada_por
     LEFT JOIN clientes c ON c.id = s.cliente_id
     LEFT JOIN usuarios ua ON ua.id = s.atendida_por
     WHERE s.id = $1`, [id]
  );
  const solicitud = rows[0];
  if (!solicitud) return null;
  const { rows: lineas } = await query(
    `SELECT id, orden, ensayo, num_muestras, observaciones
     FROM solicitud_ensayo_lineas WHERE solicitud_id = $1 ORDER BY orden`, [id]
  );
  return { ...solicitud, lineas };
}

// Lista con filtros (estado, tipo, cliente, texto libre) — como el tablero.
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const condiciones = [];
    const params = [];
    for (const [col, val] of [['estado', req.query.estado], ['tipo', req.query.tipo], ['cliente_id', req.query.cliente_id], ['area_id', req.query.area_id]]) {
      if (val) { params.push(val); condiciones.push(`s.${col} = $${params.length}`); }
    }
    const busqueda = (req.query.q || '').trim();
    if (busqueda) {
      params.push(`%${busqueda}%`);
      const p = `$${params.length}`;
      condiciones.push(`(s.folio::text ILIKE ${p} OR s.referencia ILIKE ${p}
        OR s.denominacion ILIKE ${p} OR c.nombre ILIKE ${p} OR s.proveedor ILIKE ${p}
        OR s.of_cromado ILIKE ${p} OR s.of_inyeccion ILIKE ${p})`);
    }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT s.id, s.tipo, s.folio, s.estado, s.referencia, s.denominacion, s.proveedor,
              s.creada_en, c.nombre AS cliente_nombre, a.nombre AS area_nombre,
              us.nombre AS solicitada_por_nombre,
              (SELECT count(*) FROM solicitud_ensayo_lineas l WHERE l.solicitud_id = s.id)::int AS num_ensayos
       FROM solicitudes_ensayo s
       JOIN areas a ON a.id = s.area_id
       JOIN usuarios us ON us.id = s.solicitada_por
       LEFT JOIN clientes c ON c.id = s.cliente_id
       ${where} ORDER BY s.creada_en DESC LIMIT 300`, params
    );
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/:id(\\d+)', requireAuth, async (req, res, next) => {
  try {
    const solicitud = await cargarSolicitud(req.params.id);
    if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada' });
    res.json(solicitud);
  } catch (e) { next(e); }
});

// Crea el ticket con sus líneas de ensayo. Asigna folio correlativo por formato.
router.post('/', requireRol('solicitante'), async (req, res, next) => {
  const cliente = await pool.connect();
  try {
    const {
      tipo, area_id, cliente_id, referencia, denominacion,
      of_cromado, of_inyeccion, of_ensamble, of_pintura,
      proveedor, numero_etiqueta, color_material, fecha_caducidad,
      notas, lineas
    } = req.body;

    if (!['SE', 'SEMP'].includes(tipo)) return res.status(400).json({ error: 'Tipo de solicitud inválido (SE o SEMP)' });
    if (!area_id) return res.status(400).json({ error: 'Indica el área del laboratorio que atenderá la solicitud' });
    if (!referencia || !referencia.trim()) return res.status(400).json({ error: 'La referencia es requerida' });
    const ensayos = (lineas || [])
      .map((l, i) => ({ orden: i + 1, ensayo: (l.ensayo || '').trim(), num_muestras: l.num_muestras, observaciones: (l.observaciones || '').trim() || null }))
      .filter(l => l.ensayo);
    if (!ensayos.length) return res.status(400).json({ error: 'Agrega al menos un ensayo' });

    await cliente.query('BEGIN');
    const { rows: folioRows } = await cliente.query(`SELECT nextval('${SECUENCIA_FOLIO[tipo]}') AS folio`);
    const folio = folioRows[0].folio;
    const { rows } = await cliente.query(
      `INSERT INTO solicitudes_ensayo
         (tipo, folio, area_id, cliente_id, referencia, denominacion,
          of_cromado, of_inyeccion, of_ensamble, of_pintura,
          proveedor, numero_etiqueta, color_material, fecha_caducidad, notas, solicitada_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
      [tipo, folio, area_id, cliente_id || null, referencia.trim(), (denominacion || '').trim() || null,
       of_cromado || null, of_inyeccion || null, of_ensamble || null, of_pintura || null,
       proveedor || null, numero_etiqueta || null, color_material || null, fecha_caducidad || null,
       notas || null, req.session.user.id]
    );
    const solicitudId = rows[0].id;
    for (const l of ensayos) {
      await cliente.query(
        `INSERT INTO solicitud_ensayo_lineas (solicitud_id, orden, ensayo, num_muestras, observaciones)
         VALUES ($1,$2,$3,$4,$5)`,
        [solicitudId, l.orden, l.ensayo, Number.isInteger(l.num_muestras) ? l.num_muestras : (l.num_muestras ? Number(l.num_muestras) : null), l.observaciones]
      );
    }
    await cliente.query('COMMIT');
    res.status(201).json(await cargarSolicitud(solicitudId));
  } catch (e) {
    await cliente.query('ROLLBACK');
    if (e.code === '23503') return res.status(400).json({ error: 'Cliente o área no existe' });
    next(e);
  } finally {
    cliente.release();
  }
});

// Transiciones de estado del ticket. Solo el área destino (o admin) atiende.
const TRANSICIONES = {
  en_proceso: ['pendiente'],
  completada: ['en_proceso', 'pendiente'],
};

router.put('/:id(\\d+)/estado', requireRol('admin_area', 'usuario_area'), async (req, res, next) => {
  try {
    const destino = req.body.estado;
    if (!TRANSICIONES[destino]) return res.status(400).json({ error: 'Estado destino inválido' });

    const { rows: act } = await query('SELECT estado, area_id FROM solicitudes_ensayo WHERE id = $1', [req.params.id]);
    if (!act[0]) return res.status(404).json({ error: 'Solicitud no encontrada' });

    const { rows: areaRows } = await query('SELECT nombre FROM areas WHERE id = $1', [act[0].area_id]);
    if (!esDeArea(req.session.user, areaRows[0].nombre)) {
      return res.status(403).json({ error: `Solo el personal de ${areaRows[0].nombre} puede atender esta solicitud` });
    }
    if (!TRANSICIONES[destino].includes(act[0].estado)) {
      return res.status(400).json({ error: `No se puede pasar de "${act[0].estado}" a "${destino}"` });
    }

    // al tomarla se registra quién la atiende; al completarla se sella la fecha de cierre
    const tomar = destino === 'en_proceso';
    const cerrar = destino === 'completada';
    const { rows } = await query(
      `UPDATE solicitudes_ensayo SET
         estado = $1,
         atendida_por = COALESCE(atendida_por, $2),
         atendida_en = COALESCE(atendida_en, CASE WHEN $3 THEN now() ELSE atendida_en END),
         cerrada_en = CASE WHEN $4 THEN now() ELSE cerrada_en END
       WHERE id = $5 RETURNING id`,
      [destino, req.session.user.id, tomar, cerrar, req.params.id]
    );
    res.json(await cargarSolicitud(rows[0].id));
  } catch (e) { next(e); }
});

// Cancelación con traza (no se borra): el solicitante o un admin, con motivo.
router.put('/:id(\\d+)/cancelar', requireRol('solicitante'), async (req, res, next) => {
  try {
    const motivo = (req.body.motivo || '').trim();
    if (!motivo) return res.status(400).json({ error: 'El motivo de la cancelación es obligatorio' });
    const { rows } = await query(
      `UPDATE solicitudes_ensayo SET estado = 'cancelada', motivo_cancelacion = $1, cerrada_en = now()
       WHERE id = $2 AND estado IN ('pendiente','en_proceso') RETURNING id`,
      [motivo, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Solicitud no encontrada o ya cerrada' });
    res.json(await cargarSolicitud(rows[0].id));
  } catch (e) { next(e); }
});

// Borrado definitivo de la solicitud: solo admin global o admin de área
// (requireRol deja pasar siempre al admin global). Las líneas de ensayo
// caen en cascada. A diferencia de cancelar, no deja traza.
router.delete('/:id(\\d+)', requireRol('admin_area'), async (req, res, next) => {
  try {
    const { rows } = await query(
      'DELETE FROM solicitudes_ensayo WHERE id = $1 RETURNING id', [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Solicitud no encontrada' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
