// Firma digital de documentos emitidos. El token es un HMAC-SHA256 del
// documento (tipo, id, firmante y momento) con el secreto del servidor:
// no se puede fabricar un token válido sin el secreto. El QR de los PDFs
// apunta a la página pública de verificación con ese token.
const os = require('os');
const crypto = require('crypto');
const QRCode = require('qrcode');

const SECRETO = process.env.FIRMA_SECRET || process.env.SESSION_SECRET || 'cambia-este-secreto';

// Interfaces que NUNCA son la red por la que entra un teléfono: switches
// virtuales (Hyper-V/Docker/WSL), VPN y loopback. Se descartan siempre.
const INTERFAZ_NO_USABLE = /vEthernet|virtual|docker|wsl|vpn|tap|tun|loopback|zerotier|tailscale/i;

// IP(s) del equipo por las que un teléfono en la misma red podría llegar.
// No hay forma de adivinar CUÁL red usa el teléfono cuando el equipo tiene
// varias activas a la vez (Wi-Fi normal + un hotspot que el propio equipo
// comparte, por ejemplo) — por eso esto es solo un respaldo de desarrollo;
// para un despliegue real, fija APP_URL en el .env y esto no se usa.
function candidatosIp() {
  const redes = os.networkInterfaces();
  const candidatos = [];
  for (const nombre of Object.keys(redes)) {
    if (INTERFAZ_NO_USABLE.test(nombre)) continue;
    for (const red of redes[nombre] || []) {
      if (red.family === 'IPv4' && !red.internal) candidatos.push(red.address);
    }
  }
  return candidatos;
}

let avisada = false;
function ipLocal() {
  const candidatos = candidatosIp();
  if (candidatos.length > 1 && !avisada) {
    avisada = true;
    console.warn(
      `[firma] Este equipo tiene ${candidatos.length} redes activas (${candidatos.join(', ')}); ` +
      'no se puede saber cuál usa el teléfono que escanea el QR. ' +
      'Fija APP_URL en server/.env con la dirección correcta para no depender de esta detección automática.'
    );
  }
  return candidatos[0] || 'localhost';
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
