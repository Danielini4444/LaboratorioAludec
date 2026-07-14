// Autenticación en AUTH_MODE=sso (login.md §3–§5): verifica el JWT del IdP
// central (RS256 vía JWKS) y arma req.session.user con la misma forma que el
// login local. Se cambia la puerta, no la casa: auth.js y las rutas quedan igual.
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const { SYSTEM_ID, MAPA_ROLES } = require('./rolesSso');
const { resolverUsuario } = require('./espejoUsuarios');

const ISSUER = process.env.OIDC_ISSUER;
const jwks = jwksClient({
  jwksUri: `${ISSUER}/protocol/openid-connect/certs`,
  cache: true,
  cacheMaxAge: 10 * 60 * 1000,
  rateLimit: true
});

function llaveFirma(header, callback) {
  jwks.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

function verificar(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token, llaveFirma,
      { algorithms: ['RS256'], issuer: ISSUER, audience: SYSTEM_ID },
      (err, payload) => (err ? reject(err) : resolve(payload))
    );
  });
}

module.exports = async function verificarJwt(req, res, next) {
  try {
    const cabecera = req.headers.authorization || '';
    if (!cabecera.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    let claims;
    try {
      claims = await verificar(cabecera.slice(7));
    } catch {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }

    // El claim `role` es un string (un rol por sistema, login.md §4.1);
    // defensivo: si el IdP mandara lista, solo se acepta si trae exactamente uno.
    let rolToken = claims.role;
    if (Array.isArray(rolToken)) rolToken = rolToken.length === 1 ? rolToken[0] : null;
    const mapeo = rolToken ? MAPA_ROLES[rolToken] : null;
    if (!mapeo) return res.status(403).json({ error: 'Sin rol para este sistema' });

    req.session = { user: await resolverUsuario(claims, mapeo) };
    next();
  } catch (e) {
    next(e);
  }
};
