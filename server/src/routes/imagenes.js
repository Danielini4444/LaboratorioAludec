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
// seccion ('muestra' | 'step' | 'poros' | 'espesores') y pieza_id (para las
// secciones por pieza: step, poros, espesores).
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
    const seccion = ['muestra', 'step', 'poros', 'espesores'].includes(req.body.seccion) ? req.body.seccion : 'muestra';
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

module.exports = router;
module.exports.UPLOADS = UPLOADS;
