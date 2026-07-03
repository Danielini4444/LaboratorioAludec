const express = require('express');
const { query, pool } = require('../db');
const { requireAuth, requireRol, requireQuimico } = require('../auth');
const generarRegistroPdf = require('../pdf/registroPdf');

const router = express.Router();

function numero(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (Number.isNaN(n)) throw Object.assign(new Error(`Valor no numérico: "${v}"`), { status: 400 });
  return n;
}

// Especificación aplicable: por cliente y norma; si la norma no coincide,
// la única del cliente.
async function especDelRegistro(clienteId, norma) {
  const { rows } = await query(
    'SELECT * FROM especificaciones WHERE cliente_id = $1 AND activa', [clienteId]
  );
  return rows.find(e => e.norma === norma) || (rows.length === 1 ? rows[0] : null);
}

async function cargarRegistro(id) {
  const { rows } = await query(
    `SELECT r.*, c.nombre AS cliente_nombre,
            ur.nombre AS realizado_por_nombre, ua.nombre AS aprobado_por_nombre,
            uan.nombre AS anulado_por_nombre
     FROM registros_espesores r
     JOIN clientes c ON c.id = r.cliente_id
     JOIN usuarios ur ON ur.id = r.realizado_por
     LEFT JOIN usuarios ua ON ua.id = r.aprobado_por
     LEFT JOIN usuarios uan ON uan.id = r.anulado_por
     WHERE r.id = $1`, [id]
  );
  const registro = rows[0];
  if (!registro) return null;

  const [piezas, imagenes, espec] = await Promise.all([
    query(
      `SELECT p.*,
         (SELECT coalesce(json_agg(json_build_object('punto', m.punto, 'cr', m.cr, 'ni_total', m.ni_total, 'cu', m.cu) ORDER BY m.punto), '[]')
          FROM registro_mediciones m WHERE m.pieza_id = p.id) AS mediciones
       FROM registro_piezas p WHERE p.registro_id = $1 ORDER BY p.numero`, [id]
    ),
    query(
      `SELECT id, nombre_original AS nombre, archivo, pieza_id, seccion FROM registro_imagenes
       WHERE registro_id = $1 ORDER BY id`, [id]
    ),
    especDelRegistro(registro.cliente_id, registro.norma)
  ]);
  return { ...registro, piezas: piezas.rows, imagenes: imagenes.rows, espec };
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
      condiciones.push(`(r.referencia ILIKE $${params.length} OR r.denominacion ILIKE $${params.length}
        OR r.of ILIKE $${params.length} OR r.barra ILIKE $${params.length} OR c.nombre ILIKE $${params.length})`);
    }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT r.id, r.reporte_no, r.referencia, r.denominacion, r.of, r.barra,
              r.fecha_prueba, r.resultado, r.norma, c.nombre AS cliente_nombre,
              u.nombre AS realizado_por_nombre, r.aprobado_por IS NOT NULL AS aprobado,
              r.anulado_por IS NOT NULL AS anulado,
              (SELECT count(*) FROM registro_piezas p WHERE p.registro_id = r.id)::int AS num_piezas
       FROM registros_espesores r
       JOIN clientes c ON c.id = r.cliente_id
       JOIN usuarios u ON u.id = r.realizado_por
       ${where}
       ORDER BY r.fecha_prueba DESC, r.reporte_no DESC LIMIT 300`, params
    );
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/:id(\\d+)', requireAuth, async (req, res, next) => {
  try {
    const registro = await cargarRegistro(req.params.id);
    if (!registro) return res.status(404).json({ error: 'Registro no encontrado' });
    res.json(registro);
  } catch (e) { next(e); }
});

router.post('/', requireQuimico(), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { cliente_id, norma, referencia, denominacion, of, barra,
            fecha_produccion, fecha_prueba, resultado, observaciones, piezas } = req.body;
    if (!cliente_id || !referencia || !denominacion) {
      return res.status(400).json({ error: 'Cliente, referencia y denominación son requeridos' });
    }
    if (!Array.isArray(piezas) || !piezas.length) {
      return res.status(400).json({ error: 'Captura al menos una pieza' });
    }
    if (resultado && !['PASS', 'FAIL'].includes(resultado)) {
      return res.status(400).json({ error: 'Resultado debe ser PASS o FAIL' });
    }
    for (const p of piezas) {
      if (!['HCD', 'LCD'].includes(p.densidad)) {
        return res.status(400).json({ error: 'La densidad de cada pieza debe ser HCD o LCD' });
      }
    }

    await client.query('BEGIN');
    const { rows: regs } = await client.query(
      `INSERT INTO registros_espesores
         (reporte_no, cliente_id, norma, referencia, denominacion, of, barra,
          fecha_produccion, fecha_prueba, resultado, observaciones, realizado_por)
       VALUES (
         (SELECT coalesce(max(reporte_no), 0) + 1 FROM registros_espesores WHERE cliente_id = $1),
         $1,$2,$3,$4,$5,$6,$7, coalesce($8, current_date), $9,$10,$11)
       RETURNING *`,
      [cliente_id, norma || null, referencia.trim(), denominacion.trim(), of || null, barra || null,
       fecha_produccion || null, fecha_prueba || null, resultado || null, observaciones || null,
       req.session.user.id]
    );
    const registro = regs[0];
    const piezasCreadas = [];

    for (let i = 0; i < piezas.length; i++) {
      const p = piezas[i];
      const { rows: pzs } = await client.query(
        `INSERT INTO registro_piezas
           (registro_id, numero, posicion_rack, densidad, step_punto,
            ni_sb, ni_br, ni_mps, dp_mp_br, dp_br_sb, poros)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [registro.id, i + 1, p.posicion_rack || null, p.densidad, numero(p.step_punto),
         numero(p.ni_sb), numero(p.ni_br), numero(p.ni_mps),
         numero(p.dp_mp_br), numero(p.dp_br_sb), numero(p.poros)]
      );
      piezasCreadas.push({ id: pzs[0].id, numero: i + 1 });
      for (const m of (p.mediciones || [])) {
        const cr = numero(m.cr), niTotal = numero(m.ni_total), cu = numero(m.cu);
        if (cr === null && niTotal === null && cu === null) continue;
        await client.query(
          `INSERT INTO registro_mediciones (pieza_id, punto, cr, ni_total, cu)
           VALUES ($1,$2,$3,$4,$5)`,
          [pzs[0].id, m.punto, cr, niTotal, cu]
        );
      }
    }
    // la pieza se da de alta sola al catálogo si es nueva
    await client.query(
      `INSERT INTO piezas (referencia, denominacion, cliente_id)
       VALUES ($1,$2,$3) ON CONFLICT ((lower(referencia))) DO NOTHING`,
      [referencia.trim(), denominacion.trim(), cliente_id]
    );
    await client.query('COMMIT');
    res.status(201).json({ ...registro, piezas: piezasCreadas });
  } catch (e) {
    await client.query('ROLLBACK');
    if (e.code === '23503') return res.status(400).json({ error: 'Cliente no existe' });
    next(e);
  } finally {
    client.release();
  }
});

// Edita un registro completo (cabecera + piezas + mediciones). Solo mientras
// no esté aprobado. Las piezas se actualizan EN SU LUGAR por id para no perder
// las fotos ligadas a ellas (registro_imagenes.pieza_id es ON DELETE CASCADE).
router.put('/:id(\\d+)', requireQuimico(), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const id = req.params.id;
    const { cliente_id, norma, referencia, denominacion, of, barra,
            fecha_produccion, fecha_prueba, resultado, observaciones, piezas } = req.body;
    if (!cliente_id || !referencia || !denominacion) {
      return res.status(400).json({ error: 'Cliente, referencia y denominación son requeridos' });
    }
    if (!Array.isArray(piezas) || !piezas.length) {
      return res.status(400).json({ error: 'Captura al menos una pieza' });
    }
    if (resultado && !['PASS', 'FAIL'].includes(resultado)) {
      return res.status(400).json({ error: 'Resultado debe ser PASS o FAIL' });
    }
    for (const p of piezas) {
      if (!['HCD', 'LCD'].includes(p.densidad)) {
        return res.status(400).json({ error: 'La densidad de cada pieza debe ser HCD o LCD' });
      }
    }

    await client.query('BEGIN');
    const { rows: ex } = await client.query(
      'SELECT aprobado_por, anulado_por FROM registros_espesores WHERE id = $1 FOR UPDATE', [id]
    );
    if (!ex[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Registro no encontrado' }); }
    if (ex[0].aprobado_por) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'El registro ya está aprobado y no se puede editar' }); }
    if (ex[0].anulado_por) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'El registro está anulado y no se puede editar' }); }

    await client.query(
      `UPDATE registros_espesores SET cliente_id = $1, norma = $2, referencia = $3,
         denominacion = $4, of = $5, barra = $6, fecha_produccion = $7,
         fecha_prueba = coalesce($8, current_date), resultado = $9, observaciones = $10
       WHERE id = $11`,
      [cliente_id, norma || null, referencia.trim(), denominacion.trim(), of || null, barra || null,
       fecha_produccion || null, fecha_prueba || null, resultado || null, observaciones || null, id]
    );

    // piezas: actualizar las existentes por id, insertar nuevas, borrar las quitadas
    const { rows: existentes } = await client.query(
      'SELECT id FROM registro_piezas WHERE registro_id = $1', [id]
    );
    const idsExistentes = existentes.map(r => r.id);
    const idsPayload = piezas.filter(p => p.id).map(p => Number(p.id));
    const aBorrar = idsExistentes.filter(pid => !idsPayload.includes(pid));
    if (aBorrar.length) {
      await client.query('DELETE FROM registro_piezas WHERE id = ANY($1)', [aBorrar]);
    }
    // se corren los números para que UNIQUE(registro_id, numero) no choque al renumerar
    await client.query('UPDATE registro_piezas SET numero = numero + 1000 WHERE registro_id = $1', [id]);

    for (let i = 0; i < piezas.length; i++) {
      const p = piezas[i];
      const valores = [p.posicion_rack || null, p.densidad, numero(p.step_punto),
        numero(p.ni_sb), numero(p.ni_br), numero(p.ni_mps),
        numero(p.dp_mp_br), numero(p.dp_br_sb), numero(p.poros)];
      let piezaId;
      if (p.id && idsExistentes.includes(Number(p.id))) {
        await client.query(
          `UPDATE registro_piezas SET numero = $1, posicion_rack = $2, densidad = $3,
             step_punto = $4, ni_sb = $5, ni_br = $6, ni_mps = $7, dp_mp_br = $8, dp_br_sb = $9, poros = $10
           WHERE id = $11`,
          [i + 1, ...valores, Number(p.id)]
        );
        piezaId = Number(p.id);
      } else {
        const { rows: pzs } = await client.query(
          `INSERT INTO registro_piezas
             (registro_id, numero, posicion_rack, densidad, step_punto,
              ni_sb, ni_br, ni_mps, dp_mp_br, dp_br_sb, poros)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
          [id, i + 1, ...valores]
        );
        piezaId = pzs[0].id;
      }
      // las mediciones no llevan fotos: se reemplazan completas
      await client.query('DELETE FROM registro_mediciones WHERE pieza_id = $1', [piezaId]);
      for (const m of (p.mediciones || [])) {
        const cr = numero(m.cr), niTotal = numero(m.ni_total), cu = numero(m.cu);
        if (cr === null && niTotal === null && cu === null) continue;
        await client.query(
          `INSERT INTO registro_mediciones (pieza_id, punto, cr, ni_total, cu) VALUES ($1,$2,$3,$4,$5)`,
          [piezaId, m.punto, cr, niTotal, cu]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ ok: true, id: Number(id) });
  } catch (e) {
    await client.query('ROLLBACK');
    if (e.code === '23503') return res.status(400).json({ error: 'Cliente no existe' });
    if (e.code === '23505') return res.status(409).json({ error: 'Ese cliente ya tiene un registro con este número' });
    next(e);
  } finally {
    client.release();
  }
});

router.put('/:id(\\d+)/aprobar', requireQuimico(true), async (req, res, next) => {
  try {
    const { rows } = await query(
      `UPDATE registros_espesores SET aprobado_por = $1, aprobado_en = now()
       WHERE id = $2 AND aprobado_por IS NULL AND anulado_por IS NULL RETURNING *`,
      [req.session.user.id, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Registro no encontrado, ya aprobado o anulado' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// Anulación con traza (en vez de borrado): el registro queda visible y marcado.
router.put('/:id(\\d+)/anular', requireRol(), async (req, res, next) => {
  try {
    const motivo = (req.body.motivo || '').trim();
    if (!motivo) return res.status(400).json({ error: 'El motivo de la anulación es obligatorio' });
    const { rows } = await query(
      `UPDATE registros_espesores SET anulado_por = $1, anulado_en = now(), motivo_anulacion = $2
       WHERE id = $3 AND anulado_por IS NULL RETURNING id`,
      [req.session.user.id, motivo, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Registro no encontrado o ya está anulado' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.get('/:id(\\d+)/pdf', requireAuth, async (req, res, next) => {
  try {
    const registro = await cargarRegistro(req.params.id);
    if (!registro) return res.status(404).json({ error: 'Registro no encontrado' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition',
      `inline; filename="Reporte_espesores_${registro.cliente_nombre}_${registro.reporte_no}.pdf"`);
    generarRegistroPdf(res, registro);
  } catch (e) { next(e); }
});

module.exports = router;
module.exports.cargarRegistro = cargarRegistro; // la usa la impresión por OF
