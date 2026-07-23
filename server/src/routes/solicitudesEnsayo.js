// Solicitud de ensayos — sistema de tickets (FM-15-01 / FM-15-01A).
// El solicitante crea el ticket; el área del laboratorio lo toma y lo cierra.
const express = require('express');
const { pool, query } = require('../db');
const { requireAuth, requireRol, esDeArea } = require('../auth');

const router = express.Router();

const SECUENCIA_FOLIO = { SE: 'sol_se_folio_seq', SEMP: 'sol_semp_folio_seq' };

// Módulos del sistema a los que puede apuntar una solicitud. El área que
// atiende se deduce de aquí (el solicitante ya no elige área), y ofCampo dice
// qué OF de la solicitud precarga el reporte de ese módulo.
const MODULOS = {
  registro:  { area: 'Químico',    ofCampo: 'of_cromado' },
  cromado:   { area: 'Metrología', ofCampo: 'of_cromado' },
  inyeccion: { area: 'Metrología', ofCampo: 'of_inyeccion' },
  pintura:   { area: 'Metrología', ofCampo: 'of_pintura' },
};

// La OF que se precargará al generar el reporte: la del módulo, o la primera
// OF que venga llena si esa está vacía.
function ofDeModulo(sol) {
  const campo = MODULOS[sol.modulo]?.ofCampo;
  const preferida = campo ? sol[campo] : null;
  return preferida || sol.of_cromado || sol.of_inyeccion || sol.of_ensamble || sol.of_pintura || null;
}

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
      `SELECT s.id, s.tipo, s.folio, s.estado, s.modulo, s.referencia, s.denominacion, s.proveedor,
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

// Solicitudes YA TOMADAS (en_proceso) de un módulo, pendientes de generar su
// reporte. Alimenta el aviso "Tienes un reporte pendiente de esta OF" en la
// lista del módulo; trae los datos de cliente/pieza/OF para precargar.
router.get('/pendientes', requireAuth, async (req, res, next) => {
  try {
    const modulo = req.query.modulo;
    if (!MODULOS[modulo]) return res.status(400).json({ error: 'Módulo inválido' });
    const { rows } = await query(
      `SELECT s.id, s.tipo, s.folio, s.cliente_id, s.referencia, s.denominacion,
              s.of_cromado, s.of_inyeccion, s.of_ensamble, s.of_pintura,
              c.nombre AS cliente_nombre, us.nombre AS solicitada_por_nombre,
              ua.nombre AS atendida_por_nombre
       FROM solicitudes_ensayo s
       LEFT JOIN clientes c ON c.id = s.cliente_id
       JOIN usuarios us ON us.id = s.solicitada_por
       LEFT JOIN usuarios ua ON ua.id = s.atendida_por
       WHERE s.modulo = $1 AND s.estado = 'en_proceso'
       ORDER BY s.creada_en`, [modulo]
    );
    res.json(rows.map(s => ({
      id: s.id, tipo: s.tipo, folio: s.folio,
      cliente_id: s.cliente_id, cliente_nombre: s.cliente_nombre,
      referencia: s.referencia, denominacion: s.denominacion,
      of: ofDeModulo(s), solicitante: s.solicitada_por_nombre,
      atendida_por_nombre: s.atendida_por_nombre,
    })));
  } catch (e) { next(e); }
});

// Conteo de reportes pendientes por módulo (para el punto del menú lateral).
router.get('/pendientes-conteo', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT modulo, count(*)::int AS n FROM solicitudes_ensayo
       WHERE estado = 'en_proceso' AND modulo IS NOT NULL GROUP BY modulo`
    );
    const conteo = { registro: 0, cromado: 0, inyeccion: 0, pintura: 0 };
    for (const r of rows) if (r.modulo in conteo) conteo[r.modulo] = r.n;
    res.json(conteo);
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
      tipo, modulo, cliente_id, referencia, denominacion,
      of_cromado, of_inyeccion, of_ensamble, of_pintura,
      proveedor, numero_etiqueta, color_material, fecha_caducidad,
      notas, lineas
    } = req.body;

    if (!['SE', 'SEMP'].includes(tipo)) return res.status(400).json({ error: 'Tipo de solicitud inválido (SE o SEMP)' });
    if (!MODULOS[modulo]) return res.status(400).json({ error: 'Indica el módulo destino de la solicitud' });
    if (!referencia || !referencia.trim()) return res.status(400).json({ error: 'La referencia es requerida' });

    // El área que atiende se deduce del módulo elegido.
    const { rows: areaRows } = await cliente.query('SELECT id FROM areas WHERE nombre = $1', [MODULOS[modulo].area]);
    if (!areaRows[0]) return res.status(400).json({ error: `No existe el área ${MODULOS[modulo].area} para el módulo elegido` });
    const area_id = areaRows[0].id;
    const ensayos = (lineas || [])
      .map((l, i) => ({ orden: i + 1, ensayo: (l.ensayo || '').trim(), num_muestras: l.num_muestras, observaciones: (l.observaciones || '').trim() || null }))
      .filter(l => l.ensayo);
    if (!ensayos.length) return res.status(400).json({ error: 'Agrega al menos un ensayo' });

    await cliente.query('BEGIN');
    const { rows: folioRows } = await cliente.query(`SELECT nextval('${SECUENCIA_FOLIO[tipo]}') AS folio`);
    const folio = folioRows[0].folio;
    const { rows } = await cliente.query(
      `INSERT INTO solicitudes_ensayo
         (tipo, folio, area_id, modulo, cliente_id, referencia, denominacion,
          of_cromado, of_inyeccion, of_ensamble, of_pintura,
          proveedor, numero_etiqueta, color_material, fecha_caducidad, notas, solicitada_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id`,
      [tipo, folio, area_id, modulo, cliente_id || null, referencia.trim(), (denominacion || '').trim() || null,
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

// Borrado DEFINITIVO de la solicitud (a diferencia de Cancelar, que deja traza):
// admin global o admin del área que la atiende. Las líneas de ensayo caen en cascada.
router.delete('/:id(\\d+)', requireAuth, async (req, res, next) => {
  try {
    const { rows: act } = await query(
      `SELECT a.nombre AS area_nombre FROM solicitudes_ensayo s
       JOIN areas a ON a.id = s.area_id WHERE s.id = $1`, [req.params.id]
    );
    if (!act[0]) return res.status(404).json({ error: 'Solicitud no encontrada' });
    if (!esDeArea(req.session.user, act[0].area_nombre, true)) {
      return res.status(403).json({ error: `Solo admin o el admin de ${act[0].area_nombre} puede borrar esta solicitud` });
    }
    await query('DELETE FROM solicitudes_ensayo WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
