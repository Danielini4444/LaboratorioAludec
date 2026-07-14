// Integración con el login central del QMS (Keycloak) para AUTH_MODE=sso.
// ÚNICO archivo que conoce keycloak-js: el resto del client solo usa estas
// funciones. El token vive en memoria (nunca en localStorage).
import Keycloak from 'keycloak-js';

export let modoAuth = 'standalone';
let kc = null;

export async function cargarConfig() {
  const res = await fetch('/api/config');
  const config = await res.json();
  modoAuth = config.auth_mode;
  return config;
}

// Redirige a Keycloak si no hay sesión; al volver completa el code+PKCE.
export async function iniciarSso({ url, realm, client_id }) {
  kc = new Keycloak({ url, realm, clientId: client_id });
  await kc.init({ onLoad: 'login-required', pkceMethod: 'S256', checkLoginIframe: false });
}

// Devuelve un token vigente; si está por expirar (<30 s) lo refresca solo.
// Si la sesión del IdP ya murió, vuelve a mandar al login central.
export async function obtenerToken() {
  try {
    await kc.updateToken(30);
  } catch {
    kc.login();
  }
  return kc.token;
}

export function reLogin() {
  kc.login();
}

export function cerrarSesion() {
  kc.logout({ redirectUri: window.location.origin });
}
