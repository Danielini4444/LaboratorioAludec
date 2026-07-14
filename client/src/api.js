import { modoAuth, obtenerToken, reLogin } from './sso.js';

export async function api(ruta, opciones = {}) {
  const esFormData = opciones.body instanceof FormData;
  const headers = {};
  if (opciones.body !== undefined && !esFormData) headers['Content-Type'] = 'application/json';
  if (modoAuth === 'sso') headers.Authorization = `Bearer ${await obtenerToken()}`;
  const res = await fetch(`/api${ruta}`, {
    ...opciones,
    headers,
    body: esFormData ? opciones.body
      : opciones.body !== undefined ? JSON.stringify(opciones.body)
      : undefined
  });
  if (!res.ok) {
    // En sso un 401 significa sesión del IdP vencida: de vuelta al login central.
    if (res.status === 401 && modoAuth === 'sso') reLogin();
    let mensaje = `Error ${res.status}`;
    try { mensaje = (await res.json()).error || mensaje; } catch { /* sin cuerpo JSON */ }
    const error = new Error(mensaje);
    error.status = res.status;
    throw error;
  }
  return res.json();
}
