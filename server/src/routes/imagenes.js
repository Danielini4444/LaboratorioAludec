const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const { query } = require('../db');
const { requireAuth, requireQuimico, requireArea } = require('../auth');

const UPLOADS = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(UPLOADS, { recursive: true });

// Solo JPG/PNG: son los formatos que pdfkit puede incrustar en el reporte.
const EXTENSIONES = { 'image/jpeg': '.jpg', 'image/png': '.png' };

// Hash de la evidencia: detecta si el archivo se borró o cambió fuera del sistema.
const hashArchivo = (nombre) =>
  crypto.createHash('sha256').update(fs.readFileSync(path.join(UPLOADS, nombre))).digest('hex');

const subir = multer({
  storage: multer.diskStorage({
    destination: UPLOADS,
    filename: (req, file, cb) => cb(null, crypto.randomUUID() + EXTENSIONES[file.mimetype])
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => {
    if (EXTENSIONES[file.mimetype]) return cb(null, true);
    cb(Object.assign(new Error('Solo se aceptan imágenes JPG o PNG'), { status: 400 }));
  }
});

const router = express.Router();

// Sube una o varias fotos a un registro de espesores. Campos opcionales:
// seccion ('muestra' | 'step' | 'poros') y pieza_id (para step/poros).
router.post('/registro/:registroId', requireQuimico(), subir.array('imagenes'), async (req, res, next) => {
  const limpiar = () => { for (const f of req.files || []) fs.unlink(f.path, () => {}); };
  try {
    const { rows } = await query('SELECT id, aprobado_por, anulado_por FROM registros_espesores WHERE id = $1', [req.params.registroId]);
    if (!rows[0]) {
      limpiar();
      return res.status(404).json({ error: 'Registro no encontrado' });
    }
    if (rows[0].aprobado_por || rows[0].anulado_por) {
      limpiar();
      return res.status(400).json({ error: 'El registro ya está cerrado (aprobado o anulado) y no admite cambios' });
    }
    const seccion = ['muestra', 'step', 'poros'].includes(req.body.seccion) ? req.body.seccion : 'muestra';
    let piezaId = null;
    if (req.body.pieza_id) {
      const { rows: piezas } = await query(
        'SELECT id FROM registro_piezas WHERE id = $1 AND registro_id = $2',
        [req.body.pieza_id, req.params.registroId]
      );
      if (!piezas[0]) {
        limpiar();
        return res.status(400).json({ error: 'La pieza no pertenece a este registro' });
      }
      piezaId = piezas[0].id;
    }
    if (!req.files || !req.files.length) return res.status(400).json({ error: 'No se recibió ninguna imagen' });

    const guardadas = [];
    for (const f of req.files) {
      const { rows: ins } = await query(
        `INSERT INTO registro_imagenes (registro_id, pieza_id, seccion, archivo, nombre_original, subida_por, sha256)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, nombre_original`,
        [req.params.registroId, piezaId, seccion, f.filename, f.originalname, req.session.user.id, hashArchivo(f.filename)]
      );
      guardadas.push(ins[0]);
    }
    res.status(201).json(guardadas);
  } catch (e) { next(e); }
});

router.get('/:id(\\d+)/archivo', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query('SELECT archivo FROM registro_imagenes WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Imagen no encontrada' });
    res.sendFile(path.join(UPLOADS, rows[0].archivo), err => {
      if (err && !res.headersSent) res.status(404).json({ error: 'Archivo no disponible' });
    });
  } catch (e) { next(e); }
});

router.delete('/:id(\\d+)', requireQuimico(), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT i.archivo, r.aprobado_por, r.anulado_por FROM registro_imagenes i
       JOIN registros_espesores r ON r.id = i.registro_id WHERE i.id = $1`, [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Imagen no encontrada' });
    if (rows[0].aprobado_por || rows[0].anulado_por) return res.status(400).json({ error: 'El registro ya está cerrado (aprobado o anulado) y no admite cambios' });
    await query('DELETE FROM registro_imagenes WHERE id = $1', [req.params.id]);
    fs.unlink(path.join(UPLOADS, rows[0].archivo), () => {});
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ===== Evidencia de las pruebas de Test de cromado (Metrología) =====

router.post('/prueba/:pruebaId(\\d+)', requireArea('Metrología'), subir.array('imagenes'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT p.id FROM reporte_pruebas p
       JOIN reportes_ensayo r ON r.id = p.reporte_id
       WHERE p.id = $1 AND r.aprobado_por IS NULL AND r.anulado_por IS NULL`, [req.params.pruebaId]
    );
    if (!rows[0]) {
      for (const f of req.files || []) fs.unlink(f.path, () => {});
      return res.status(404).json({ error: 'Prueba no encontrada o el reporte ya está cerrado (aprobado o anulado)' });
    }
    if (!req.files || !req.files.length) return res.status(400).json({ error: 'No se recibió ninguna imagen' });

    const guardadas = [];
    for (const f of req.files) {
      const { rows: ins } = await query(
        `INSERT INTO prueba_imagenes (prueba_id, archivo, nombre_original, subida_por, sha256)
         VALUES ($1,$2,$3,$4,$5) RETURNING id, nombre_original`,
        [req.params.pruebaId, f.filename, f.originalname, req.session.user.id, hashArchivo(f.filename)]
      );
      guardadas.push(ins[0]);
    }
    res.status(201).json(guardadas);
  } catch (e) { next(e); }
});

router.get('/prueba-img/:id(\\d+)/archivo', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query('SELECT archivo FROM prueba_imagenes WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Imagen no encontrada' });
    res.sendFile(path.join(UPLOADS, rows[0].archivo), err => {
      if (err && !res.headersSent) res.status(404).json({ error: 'Archivo no disponible' });
    });
  } catch (e) { next(e); }
});

router.delete('/prueba-img/:id(\\d+)', requireArea('Metrología'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT pi.archivo, r.aprobado_por, r.anulado_por FROM prueba_imagenes pi
       JOIN reporte_pruebas p ON p.id = pi.prueba_id
       JOIN reportes_ensayo r ON r.id = p.reporte_id WHERE pi.id = $1`, [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Imagen no encontrada' });
    if (rows[0].aprobado_por || rows[0].anulado_por) return res.status(400).json({ error: 'El reporte ya está cerrado (aprobado o anulado) y no admite cambios' });
    await query('DELETE FROM prueba_imagenes WHERE id = $1', [req.params.id]);
    fs.unlink(path.join(UPLOADS, rows[0].archivo), () => {});
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ===== Fotos de los Ensayos de inyección (apartado general del informe) =====
// Cada foto lleva su descripción: se sube sin ella y se captura/edita inline.

router.post('/ensayo-iny/:ensayoId(\\d+)', requireArea('Metrología'), subir.array('imagenes'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id FROM ensayos_inyeccion
       WHERE id = $1 AND aprobado_por IS NULL AND anulado_por IS NULL`, [req.params.ensayoId]
    );
    if (!rows[0]) {
      for (const f of req.files || []) fs.unlink(f.path, () => {});
      return res.status(404).json({ error: 'Ensayo no encontrado o el informe ya está cerrado (aprobado o anulado)' });
    }
    if (!req.files || !req.files.length) return res.status(400).json({ error: 'No se recibió ninguna imagen' });

    const guardadas = [];
    for (const f of req.files) {
      const { rows: ins } = await query(
        `INSERT INTO ensayo_iny_fotos (ensayo_id, archivo, nombre_original, subida_por, sha256)
         VALUES ($1,$2,$3,$4,$5) RETURNING id, nombre_original`,
        [req.params.ensayoId, f.filename, f.originalname, req.session.user.id, hashArchivo(f.filename)]
      );
      guardadas.push(ins[0]);
    }
    res.status(201).json(guardadas);
  } catch (e) { next(e); }
});

// Edita la descripción de una foto mientras el informe siga abierto.
router.put('/ensayo-iny-img/:id(\\d+)', requireArea('Metrología'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `UPDATE ensayo_iny_fotos i SET descripcion = $1
       FROM ensayos_inyeccion e
       WHERE i.id = $2 AND e.id = i.ensayo_id AND e.aprobado_por IS NULL AND e.anulado_por IS NULL
       RETURNING i.id, i.descripcion`,
      [(req.body.descripcion || '').trim() || null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Foto no encontrada o el informe ya está cerrado (aprobado o anulado)' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.get('/ensayo-iny-img/:id(\\d+)/archivo', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query('SELECT archivo FROM ensayo_iny_fotos WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Imagen no encontrada' });
    res.sendFile(path.join(UPLOADS, rows[0].archivo), err => {
      if (err && !res.headersSent) res.status(404).json({ error: 'Archivo no disponible' });
    });
  } catch (e) { next(e); }
});

router.delete('/ensayo-iny-img/:id(\\d+)', requireArea('Metrología'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT i.archivo, e.aprobado_por, e.anulado_por FROM ensayo_iny_fotos i
       JOIN ensayos_inyeccion e ON e.id = i.ensayo_id WHERE i.id = $1`, [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Imagen no encontrada' });
    if (rows[0].aprobado_por || rows[0].anulado_por) return res.status(400).json({ error: 'El informe ya está cerrado (aprobado o anulado) y no admite cambios' });
    await query('DELETE FROM ensayo_iny_fotos WHERE id = $1', [req.params.id]);
    fs.unlink(path.join(UPLOADS, rows[0].archivo), () => {});
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ===== Fotos de los Ensayos de pintura (apartado general del informe) =====
// Igual que inyección: cada foto lleva su descripción, capturada/editada inline.

router.post('/ensayo-pin/:ensayoId(\\d+)', requireArea('Metrología'), subir.array('imagenes'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id FROM ensayos_pintura
       WHERE id = $1 AND aprobado_por IS NULL AND anulado_por IS NULL`, [req.params.ensayoId]
    );
    if (!rows[0]) {
      for (const f of req.files || []) fs.unlink(f.path, () => {});
      return res.status(404).json({ error: 'Ensayo no encontrado o el informe ya está cerrado (aprobado o anulado)' });
    }
    if (!req.files || !req.files.length) return res.status(400).json({ error: 'No se recibió ninguna imagen' });

    const guardadas = [];
    for (const f of req.files) {
      const { rows: ins } = await query(
        `INSERT INTO ensayo_pin_fotos (ensayo_id, archivo, nombre_original, subida_por, sha256)
         VALUES ($1,$2,$3,$4,$5) RETURNING id, nombre_original`,
        [req.params.ensayoId, f.filename, f.originalname, req.session.user.id, hashArchivo(f.filename)]
      );
      guardadas.push(ins[0]);
    }
    res.status(201).json(guardadas);
  } catch (e) { next(e); }
});

router.put('/ensayo-pin-img/:id(\\d+)', requireArea('Metrología'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `UPDATE ensayo_pin_fotos i SET descripcion = $1
       FROM ensayos_pintura e
       WHERE i.id = $2 AND e.id = i.ensayo_id AND e.aprobado_por IS NULL AND e.anulado_por IS NULL
       RETURNING i.id, i.descripcion`,
      [(req.body.descripcion || '').trim() || null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Foto no encontrada o el informe ya está cerrado (aprobado o anulado)' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.get('/ensayo-pin-img/:id(\\d+)/archivo', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query('SELECT archivo FROM ensayo_pin_fotos WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Imagen no encontrada' });
    res.sendFile(path.join(UPLOADS, rows[0].archivo), err => {
      if (err && !res.headersSent) res.status(404).json({ error: 'Archivo no disponible' });
    });
  } catch (e) { next(e); }
});

router.delete('/ensayo-pin-img/:id(\\d+)', requireArea('Metrología'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT i.archivo, e.aprobado_por, e.anulado_por FROM ensayo_pin_fotos i
       JOIN ensayos_pintura e ON e.id = i.ensayo_id WHERE i.id = $1`, [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Imagen no encontrada' });
    if (rows[0].aprobado_por || rows[0].anulado_por) return res.status(400).json({ error: 'El informe ya está cerrado (aprobado o anulado) y no admite cambios' });
    await query('DELETE FROM ensayo_pin_fotos WHERE id = $1', [req.params.id]);
    fs.unlink(path.join(UPLOADS, rows[0].archivo), () => {});
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ===== Imagen ÚNICA por pieza del apartado de espesores (pintura) =====
// Cada pieza tiene a lo sumo una imagen: al subir otra se reemplaza la anterior.

router.post('/ensayo-pin-pieza/:piezaId(\\d+)', requireArea('Metrología'), subir.single('imagen'), async (req, res, next) => {
  const limpiar = () => { if (req.file) fs.unlink(req.file.path, () => {}); };
  try {
    const { rows } = await query(
      `SELECT p.id, p.imagen_archivo FROM ensayo_pin_piezas p
       JOIN ensayos_pintura e ON e.id = p.ensayo_id
       WHERE p.id = $1 AND e.aprobado_por IS NULL AND e.anulado_por IS NULL`, [req.params.piezaId]
    );
    if (!rows[0]) {
      limpiar();
      return res.status(404).json({ error: 'Pieza no encontrada o el informe ya está cerrado (aprobado o anulado)' });
    }
    if (!req.file) return res.status(400).json({ error: 'No se recibió ninguna imagen' });

    const anterior = rows[0].imagen_archivo;
    await query(
      `UPDATE ensayo_pin_piezas
       SET imagen_archivo = $1, imagen_nombre = $2, imagen_sha256 = $3, imagen_subida_por = $4
       WHERE id = $5`,
      [req.file.filename, req.file.originalname, hashArchivo(req.file.filename), req.session.user.id, req.params.piezaId]
    );
    if (anterior) fs.unlink(path.join(UPLOADS, anterior), () => {});
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

router.get('/ensayo-pin-pieza/:piezaId(\\d+)/archivo', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query('SELECT imagen_archivo FROM ensayo_pin_piezas WHERE id = $1', [req.params.piezaId]);
    if (!rows[0] || !rows[0].imagen_archivo) return res.status(404).json({ error: 'Imagen no encontrada' });
    res.sendFile(path.join(UPLOADS, rows[0].imagen_archivo), err => {
      if (err && !res.headersSent) res.status(404).json({ error: 'Archivo no disponible' });
    });
  } catch (e) { next(e); }
});

router.delete('/ensayo-pin-pieza/:piezaId(\\d+)/imagen', requireArea('Metrología'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT p.imagen_archivo, e.aprobado_por, e.anulado_por FROM ensayo_pin_piezas p
       JOIN ensayos_pintura e ON e.id = p.ensayo_id WHERE p.id = $1`, [req.params.piezaId]
    );
    if (!rows[0] || !rows[0].imagen_archivo) return res.status(404).json({ error: 'Imagen no encontrada' });
    if (rows[0].aprobado_por || rows[0].anulado_por) return res.status(400).json({ error: 'El informe ya está cerrado (aprobado o anulado) y no admite cambios' });
    await query(
      `UPDATE ensayo_pin_piezas
       SET imagen_archivo = NULL, imagen_nombre = NULL, imagen_sha256 = NULL, imagen_subida_por = NULL
       WHERE id = $1`, [req.params.piezaId]
    );
    fs.unlink(path.join(UPLOADS, rows[0].imagen_archivo), () => {});
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
module.exports.UPLOADS = UPLOADS;
