// Evaluación de espesores de pintura contra la especificación del cliente.
// Una especificación tiene capas (primer/base/transparente/total…), cada una
// con un rango mín–máx en µm. Análogo a especs.js (químico) pero solo mín/máx.

// Texto del rango de una capa: "18–25 µm", "≥ 18 µm", "≤ 25 µm" o "N/S".
export function textoRangoCapa(capa) {
  if (!capa) return 'N/S';
  const min = capa.espesor_min;
  const max = capa.espesor_max;
  const tieneMin = min !== null && min !== undefined && min !== '';
  const tieneMax = max !== null && max !== undefined && max !== '';
  if (tieneMin && tieneMax) return `${min}–${max} µm`;
  if (tieneMin) return `≥ ${min} µm`;
  if (tieneMax) return `≤ ${max} µm`;
  return 'N/S';
}

// ¿El valor medido cae fuera del rango de la capa? (vacío = no evaluado)
export function fueraDeRangoCapa(capa, valor) {
  if (!capa || valor === '' || valor === null || valor === undefined) return false;
  const n = Number(valor);
  if (Number.isNaN(n)) return false;
  const min = capa.espesor_min;
  const max = capa.espesor_max;
  if (min !== null && min !== undefined && min !== '' && n < Number(min)) return true;
  if (max !== null && max !== undefined && max !== '' && n > Number(max)) return true;
  return false;
}
