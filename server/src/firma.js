// Firma digital de documentos emitidos. El token es un HMAC-SHA256 del
// documento (tipo, id, firmante y momento) con el secreto del servidor:
// no se puede fabricar un token válido sin el secreto. El QR de los PDFs
// apunta a la página pública de verificación con ese token.
const crypto = require('crypto');
const QRCode = require('qrcode');

const SECRETO = process.env.FIRMA_SECRET || process.env.SESSION_SECRET || 'cambia-este-secreto';

function generarToken(tipo, docId, usuarioId, fechaIso) {
  return crypto.createHmac('sha256', SECRETO)
    .update(`${tipo}|${docId}|${usuarioId}|${fechaIso}`)
    .digest('hex');
}

// Base pública para el enlace del QR. En producción conviene fijar APP_URL
// (p. ej. http://laboratorio.aludec.local:3000); si no, se usa el host con
// el que se pidió el PDF.
function urlVerificacion(req, tipo, docId, token) {
  const base = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  return `${base}/api/verificar/${tipo}/${docId}/${token}`;
}

// PNG del QR listo para incrustar en el PDF (null si el documento no está firmado).
async function qrDeFirma(req, tipo, doc) {
  if (!doc.firmado_por || !doc.firma_token) return null;
  const url = urlVerificacion(req, tipo, doc.id, doc.firma_token);
  return QRCode.toBuffer(url, { errorCorrectionLevel: 'M', margin: 1, width: 220 });
}

module.exports = { generarToken, urlVerificacion, qrDeFirma };
