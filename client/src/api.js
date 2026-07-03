export async function api(ruta, opciones = {}) {
  const esFormData = opciones.body instanceof FormData;
  const res = await fetch(`/api${ruta}`, {
    ...opciones,
    headers: opciones.body !== undefined && !esFormData ? { 'Content-Type': 'application/json' } : undefined,
    body: esFormData ? opciones.body
      : opciones.body !== undefined ? JSON.stringify(opciones.body)
      : undefined
  });
  if (!res.ok) {
    let mensaje = `Error ${res.status}`;
    try { mensaje = (await res.json()).error || mensaje; } catch { /* sin cuerpo JSON */ }
    const error = new Error(mensaje);
    error.status = res.status;
    throw error;
  }
  return res.json();
}
