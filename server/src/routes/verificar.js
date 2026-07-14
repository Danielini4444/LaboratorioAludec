// Verificación pública de firmas digitales: la URL viene del QR impreso en
// el PDF, así que NO pide sesión (se monta antes del middleware de auth).
// Muestra una página mínima con el estado de la firma y los datos básicos
// del documento; el token se compara en tiempo constante.
const express = require('express');
const crypto = require('crypto');
const { query } = require('../db');

const router = express.Router();

function tokenCoincide(guardado, recibido) {
  if (!guardado || !recibido) return false;
  const a = Buffer.from(String(guardado));
  const b = Buffer.from(String(recibido));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function fechaHora(d) {
  return new Date(d).toLocaleString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

const esc = (s) => String(s ?? '—').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Página con la identidad del sistema (styles.md: gris #1d252d, acento naranja).
function pagina({ valida, titulo, filas, motivo }) {
  const color = valida ? '#15803d' : '#b91c1c';
  const estado = valida ? 'FIRMA VÁLIDA' : 'FIRMA NO VÁLIDA';
  const detalle = filas.map(([k, v]) =>
    `<tr><td style="color:#5b6770;padding:6px 14px 6px 0;white-space:nowrap">${esc(k)}</td>
     <td style="font-weight:600">${esc(v)}</td></tr>`).join('');
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Verificación de firma — CIE Aludec</title></head>
<body style="margin:0;font-family:system-ui,Segoe UI,Arial,sans-serif;background:#eceded;color:#1d252d">
  <div style="background:#1d252d;color:#fff;padding:18px 24px;font-weight:700">
    CIE ALUDEC · Laboratorio <span style="color:#e8927c">·</span> Verificación de documentos
  </div>
  <div style="max-width:560px;margin:32px auto;padding:0 16px">
    <div style="background:#fff;border:1px solid #d0d3d4;border-radius:8px;padding:24px">
      <div style="font-size:22px;font-weight:800;color:${color}">${estado}</div>
      ${motivo ? `<div style="margin-top:6px;color:#b91c1c">${esc(motivo)}</div>` : ''}
      <div style="margin-top:14px;font-weight:700">${esc(titulo)}</div>
      <table style="margin-top:10px;border-collapse:collapse;font-size:14px">${detalle}</table>
      <div style="margin-top:18px;font-size:12px;color:#5b6770">
        La validez se comprueba contra el sistema del laboratorio en este momento.
        Si el documento impreso difiere de estos datos, no corresponde a esta firma.
      </div>
    </div>
  </div>
</body></html>`;
}

router.get('/:tipo(registro|reporte)/:id(\\d+)/:token', async (req, res, next) => {
  try {
    const { tipo, id, token } = req.params;
    const sql = tipo === 'registro'
      ? `SELECT r.reporte_no::text AS folio_texto, r.referencia, r.denominacion, r.of,
                r.firma_token, r.firmado_en, r.anulado_por,
                c.nombre AS cliente_nombre, uf.nombre AS firmado_por_nombre
         FROM registros_espesores r
         JOIN clientes c ON c.id = r.cliente_id
         LEFT JOIN usuarios uf ON uf.id = r.firmado_por
         WHERE r.id = $1`
      : `SELECT 'Ens_' || r.folio AS folio_texto, r.referencia, r.denominacion, r.of,
                r.firma_token, r.firmado_en, r.anulado_por,
                c.nombre AS cliente_nombre, uf.nombre AS firmado_por_nombre
         FROM reportes_ensayo r
         JOIN clientes c ON c.id = r.cliente_id
         LEFT JOIN usuarios uf ON uf.id = r.firmado_por
         WHERE r.id = $1`;
    const { rows } = await query(sql, [id]);
    const doc = rows[0];
    const nombreDoc = tipo === 'registro'
      ? 'Registro de espesores y STEP (FM-15-01-03)'
      : 'Informe de ensayos (FM-15-30)';

    res.setHeader('Content-Type', 'text/html; charset=utf-8');

    if (!doc || !tokenCoincide(doc.firma_token, token)) {
      // Sin filtrar datos del documento cuando el token no corresponde.
      return res.status(doc ? 400 : 404).send(pagina({
        valida: false,
        titulo: nombreDoc,
        filas: [],
        motivo: 'El código escaneado no corresponde a ningún documento firmado en este sistema.'
      }));
    }

    const anulado = !!doc.anulado_por;
    res.send(pagina({
      valida: !anulado,
      titulo: nombreDoc,
      motivo: anulado ? 'El documento fue ANULADO después de firmarse: la firma ya no ampara este documento.' : '',
      filas: [
        ['Documento', doc.folio_texto],
        ['Cliente', doc.cliente_nombre],
        ['Referencia', doc.referencia],
        ['Denominación', doc.denominacion],
        ['OF', doc.of],
        ['Firmado por', doc.firmado_por_nombre],
        ['Fecha de firma', fechaHora(doc.firmado_en)]
      ]
    }));
  } catch (e) { next(e); }
});

module.exports = router;
