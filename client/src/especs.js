// Evaluación contra la especificación del cliente (límites por clave).
// Claves: cr / ni_t / cu (espesores), sb_ni / br_ni / mp_ni / step_mp_br /
// step_br_sb (STEP) y microporos (conteo de poros).
//
// Un límite puede ser absoluto ({min, max}) o porcentual respecto al Ni
// total ({min_pct, max_pct}), como el "SB Ni >= 50% del Ni total" de Toyota.

// Campos de una norma, en el orden del formato. El cuarto valor indica si
// admite límite porcentual (capas de níquel respecto al Ni total).
export const CAMPOS_NORMA = [
  ['cr', 'Cr', 'µm', false],
  ['mp_ni', 'Ni MPS', 'µm', true],
  ['br_ni', 'Ni Br', 'µm', true],
  ['sb_ni', 'Ni SB', 'µm', true],
  ['ni_t', 'Ni total', 'µm', false],
  ['cu', 'Cu', 'µm', false],
  ['microporos', 'Poros', 'poros/cm²', false],
  ['step_mp_br', 'Dif. potencial MP–Br', 'mV', false],
  ['step_br_sb', 'Dif. potencial Br–SB', 'mV', false]
];

// Ni total de referencia para los límites porcentuales de una pieza:
// 1) el Ni total medido en el mismo punto que el STEP,
// 2) si no, el promedio de los Ni total de la pieza,
// 3) si no, la suma de las capas STEP capturadas (SB + Br + MPS).
export function niTotalBase(pieza) {
  const meds = pieza.mediciones || [];
  const punto = Number(pieza.step_punto);
  const conNi = meds.filter(m => m.ni_total !== '' && m.ni_total !== null && m.ni_total !== undefined);
  if (punto) {
    const m = conNi.find(m => Number(m.punto) === punto);
    if (m) return Number(m.ni_total);
  }
  if (conNi.length) return conNi.reduce((s, m) => s + Number(m.ni_total), 0) / conNi.length;
  const capas = [pieza.ni_sb, pieza.ni_br, pieza.ni_mps]
    .filter(v => v !== '' && v !== null && v !== undefined)
    .map(Number);
  return capas.length >= 2 ? capas.reduce((a, b) => a + b, 0) : null;
}

export function textoLimite(limites, clave, unidad = '') {
  const lim = limites ? limites[clave] : null;
  if (!lim) return 'N/S';
  const u = unidad ? ` ${unidad}` : '';
  const partes = [];
  if (lim.min !== undefined && lim.max !== undefined) partes.push(`${lim.min}–${lim.max}${u}`);
  else if (lim.min !== undefined) partes.push(`≥ ${lim.min}${u}`);
  else if (lim.max !== undefined) partes.push(`≤ ${lim.max}${u}`);
  if (lim.min_pct !== undefined && lim.max_pct !== undefined) partes.push(`${lim.min_pct}–${lim.max_pct}% del Ni total`);
  else if (lim.min_pct !== undefined) partes.push(`≥ ${lim.min_pct}% del Ni total`);
  else if (lim.max_pct !== undefined) partes.push(`≤ ${lim.max_pct}% del Ni total`);
  return partes.join(' y ') || 'N/S';
}

// base: Ni total de referencia (solo necesario para límites porcentuales).
export function fueraDeLimite(limites, clave, valor, base = null) {
  const lim = limites ? limites[clave] : null;
  if (!lim || valor === undefined || valor === null || valor === '') return false;
  const n = Number(valor);
  if (Number.isNaN(n)) return false;
  if (lim.min !== undefined && n < lim.min) return true;
  if (lim.max !== undefined && n > lim.max) return true;
  if ((lim.min_pct !== undefined || lim.max_pct !== undefined) && base) {
    const pct = (n / base) * 100;
    if (lim.min_pct !== undefined && pct < lim.min_pct) return true;
    if (lim.max_pct !== undefined && pct > lim.max_pct) return true;
  }
  return false;
}
