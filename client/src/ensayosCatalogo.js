// Catálogo fijo de ensayos, tomado de las listas reales del formato
// "Solicitud de ensayos.xlsm". Fijo en código a propósito (no configurable).

// SE — Solicitud de ensayos de producto (FM-15-01)
export const ENSAYOS_SE = [
  'ADHERENCIA',
  'PELADO',
  'CHOQUE TÉRMICO',
  'CLIMAS ALTERNOS 20 CICLOS',
  'CLIMAS ALTERNOS 8 CICLOS',
  'ESTABILIDAD DIMENSIONAL',
  'CASS TEST',
  'SALT SPRAY TEST',
  'CORRODKOTE TEST',
  'THERMAL CYCLE TEST',
  'ACTIVE SITES',
  'STONE CHIPPING RESISTANCE',
  'ARRANCAMIENTO PERPENDICULAR',
  'ARRANCAMIENTO DE PUNTOS DE SOLDADURA',
  'WET-OUT',
  'DESPRENDIMIENTO LATERAL',
  'SOLDADURAS',
  'FINEZA PINTURA',
  'ESPESORES DE PINTURA',
  'MEDICIÓN DE ESPESORES DE PINTURA',
  'STRESS TEST',
  'VISCOSIDAD PINTURA',
  'DENSIDAD PINTURA',
  'CLIPADO',
  'MEDICIÓN DE BRILLO',
  'TEAR DOWN TESTING',
  '48 hrs a 70°C',
];

// SEMP — Solicitud de ensayos de materia prima (FM-15-01A)
export const ENSAYOS_SEMP = [
  'B28 3710 - Adhesividad 24H',
  'ALUDEC INTERNO - (-25.5 °C 5HRS)',
  'ALUDEC INTERNO - Medio Ambiente (48 hrs)',
  '48 hrs a 70°C',
  'ADHERENCIA',
  'CHOQUE TÉRMICO',
];

export const ensayosDe = (tipo) => (tipo === 'SEMP' ? ENSAYOS_SEMP : ENSAYOS_SE);

// Módulos del sistema a los que se dirige una solicitud. La solicitud apunta
// DIRECTO a un módulo (el área que atiende se deduce). `ruta` es el formulario
// de reporte nuevo que se precarga al generar; `area` debe coincidir con el
// nombre del área en la BD.
export const MODULOS = [
  { key: 'registro',  etiqueta: 'Laboratorio químico · Registro de espesores', area: 'Químico',    ruta: '/registros/nuevo', ofCampo: 'of_cromado' },
  { key: 'cromado',   etiqueta: 'Test de cromado',                              area: 'Metrología', ruta: '/reportes/nuevo',  ofCampo: 'of_cromado' },
  { key: 'inyeccion', etiqueta: 'Ensayos inyección',                           area: 'Metrología', ruta: '/inyeccion/nuevo', ofCampo: 'of_inyeccion' },
  { key: 'pintura',   etiqueta: 'Ensayos pintura',                             area: 'Metrología', ruta: '/pintura/nuevo',   ofCampo: 'of_pintura' },
];

export const moduloPorKey = (key) => MODULOS.find(m => m.key === key) || null;

// OF que se precargará al generar el reporte de una solicitud: la del módulo,
// o la primera OF que venga llena.
export const ofDeSolicitud = (s) => {
  const m = moduloPorKey(s.modulo);
  const preferida = m ? s[m.ofCampo] : null;
  return preferida || s.of_cromado || s.of_inyeccion || s.of_ensamble || s.of_pintura || '';
};

// Construye la URL del formulario de reporte de un módulo, precargando lo que
// se pueda pasar (OF, cliente, referencia, denominación) y el id de solicitud.
export const rutaReporteConDatos = (moduloKey, { of, cliente_id, referencia, denominacion, solicitante, id }) => {
  const m = moduloPorKey(moduloKey);
  if (!m) return null;
  const p = new URLSearchParams();
  if (of) p.set('of', of);
  if (cliente_id) p.set('cliente_id', String(cliente_id));
  if (referencia) p.set('referencia', referencia);
  if (denominacion) p.set('denominacion', denominacion);
  if (solicitante) p.set('solicitante', solicitante);
  if (id) p.set('sol', String(id));
  return `${m.ruta}?${p.toString()}`;
};

// URL del reporte precargado desde una solicitud completa (usa su módulo/OF).
// El solicitante del reporte se jala del solicitante de la solicitud.
export const rutaGenerarReporte = (s) =>
  rutaReporteConDatos(s.modulo, {
    of: ofDeSolicitud(s), cliente_id: s.cliente_id,
    referencia: s.referencia, denominacion: s.denominacion,
    solicitante: s.solicitada_por_nombre, id: s.id,
  });

export const ESTADOS = {
  pendiente: { texto: 'Pendiente', badge: 'pendiente' },
  en_proceso: { texto: 'En proceso', badge: 'pendiente' },
  completada: { texto: 'Completada', badge: 'ok' },
  cancelada: { texto: 'Cancelada', badge: 'mal' },
};
