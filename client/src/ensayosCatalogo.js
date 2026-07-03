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

export const ESTADOS = {
  pendiente: { texto: 'Pendiente', badge: 'pendiente' },
  en_proceso: { texto: 'En proceso', badge: 'pendiente' },
  completada: { texto: 'Completada', badge: 'ok' },
  cancelada: { texto: 'Cancelada', badge: 'mal' },
};
