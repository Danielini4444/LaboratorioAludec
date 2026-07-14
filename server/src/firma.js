// Firma digital de documentos emitidos. El token es un HMAC-SHA256 del
// documento (tipo, id, firmante y momento) con el secreto del servidor:
// no se puede fabricar un token válido sin el secreto. El QR de los PDFs
// apunta a la página pública de verificación con ese token.
const os = require('os');
const crypto = require('crypto');
const QRCode = require('qrcode');

const SECRETO = process.env.FIRMA_SECRET || process.env.SESSION_SECRET || 'cambia-este-secreto';

// IP del equipo en la red local (la que usan los demás equipos de la
// intranet para entrar al sistema): primera IPv4 no interna.
function ipLocal() {
  const redes = os.networkInterfaces();
  for (const nombre of Object.keys(redes)) {
    for (const red of redes[nombre] || []) {
      if (red.family === 'IPv4' && !red.internal) return red.address;
    }
  }
  return 'localhost';
}

function generarToken(tipo, docId, usuarioId, fechaIso) {
  return crypto.createHmac('sha256', SECRETO)
    .update(`${tipo}|${docId}|${usuarioId}|${fechaIso}`)
    .digest('hex');
}

// Base pública para el enlace del QR. Prioridad:
// 1. APP_URL del .env (dirección fija del servidor, si se configuró).
// 2. El host con el que se pidió el PDF — sirve tal cual cuando ya se entró
//    por la IP o nombre del servidor desde otra máquina.
// 3. Si el PDF se pidió desde la propia máquina ("localhost"), ese host no
//    sirve para el teléfono que escanea: se usa la IP del equipo en la red
//    y el puerto del API (que es quien sirve la página de verificación).
function urlVerificacion(req, tipo, docId, token) {
  const host = req.get('host') || '';
  const base = process.env.APP_URL
    || (/^(localhost|127\.)/i.test(host)
      ? `http://${ipLocal()}:${process.env.PORT || 3000}`
      : `${req.protocol}://${host}`);
  return `${base}/api/verificar/${tipo}/${docId}/${token}`;
}

// PNG del QR listo para incrustar en el PDF (null si el documento no está firmado).
async function qrDeFirma(req, tipo, doc) {
  if (!doc.firmado_por || !doc.firma_token) return null;
  const url = urlVerificacion(req, tipo, doc.id, doc.firma_token);
  return QRCode.toBuffer(url, { errorCorrectionLevel: 'M', margin: 1, width: 220 });
}

module.exports = { generarToken, urlVerificacion, qrDeFirma };
