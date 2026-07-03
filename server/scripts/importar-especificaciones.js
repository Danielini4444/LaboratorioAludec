// Importa las especificaciones por cliente/norma desde el Excel
// "Registro de espesores" (una hoja por cliente; los límites están en la
// fila de SPECS). Idempotente: actualiza por (cliente, norma).
//
// Uso: node scripts/importar-especificaciones.js "ruta/al/Registro de espesores.xlsx"
require('dotenv').config();
const XLSX = require('xlsx');
const { pool } = require('../src/db');

// Encabezado de columna del Excel → clave de la app. El mapeo es POR NOMBRE
// porque algunas hojas (Stellantis PS50014/PS50065) intercalan columnas
// extra (%SB, RATIO) y las posiciones cambian. %SB y RATIO son reglas
// relativas que no se modelan como límite absoluto.
const ENCABEZADO_A_CLAVE = {
  'cr': 'cr',
  'mp ni': 'mp_ni',
  'br ni': 'br_ni',
  'sb ni': 'sb_ni',
  'ni t': 'ni_t',
  'cu': 'cu',
  'poros/cm2': 'microporos',
  'mp - br': 'step_mp_br',
  'br - sb': 'step_br_sb'
};

// Hoja → cliente. Los sufijos "OK" y los paréntesis de norma se quitan.
function clienteDeHoja(hoja) {
  let nombre = hoja.replace(/\(.+\)$/, '').replace(/OK$/, '').trim().toUpperCase();
  if (nombre === 'VW') nombre = 'VOLKSWAGEN';
  return nombre;
}

// "≥ 10 000" → {min:10000}; "0.3-0.8" y "≥20 - 90" → {min,max};
// "10 000(MIN) - 124,000 (MAX)" → {min,max}; "6" → {min:6}; "N/E" → null.
// Porcentuales: "≥ 50% Total Ni" → {min_pct:50}; "≥ 20% - 50%" →
// {min_pct:20, max_pct:50} (porcentaje del Ni total del punto de medición).
function parseLimite(celda) {
  if (celda === null || celda === undefined) return null;
  const s = String(celda)
    .replace(/,/g, '')
    .replace(/\((MIN|MAX)\)?/gi, '')
    .replace(/\s+/g, '')
    .trim();
  if (!s || /N\/?E/i.test(s)) return null;
  let pct = s.match(/^[≥>]?=?(\d+\.?\d*)%-(\d+\.?\d*)%?$/);
  if (pct) return { min_pct: Number(pct[1]), max_pct: Number(pct[2]) };
  pct = s.match(/^[≥>]=?(\d+\.?\d*)%(TOTAL\s*NI)?$/i);
  if (pct) return { min_pct: Number(pct[1]) };
  pct = s.match(/^[≤<]=?(\d+\.?\d*)%(TOTAL\s*NI)?$/i);
  if (pct) return { max_pct: Number(pct[1]) };
  if (s.includes('%')) return null;
  let m = s.match(/^[≥>]?=?(\d+\.?\d*)-(\d+\.?\d*)$/);
  if (m) return { min: Number(m[1]), max: Number(m[2]) };
  m = s.match(/^[≥>]=?(\d+\.?\d*)$/);
  if (m) return { min: Number(m[1]) };
  m = s.match(/^[≤<]=?(\d+\.?\d*)$/);
  if (m) return { max: Number(m[1]) };
  const n = Number(s);
  if (!Number.isNaN(n)) return { min: n }; // en este formato los valores sueltos son mínimos
  return null; // texto no interpretable: se reporta y se omite
}

// Correcciones donde el Excel difiere del informe oficial del laboratorio
// (ej. el PDF FM-15-01-03 real de FORD exige Cr >= 0.18 aunque el Excel
// diga N/E). Se aplican encima de lo parseado.
const CORRECCIONES = {
  FORD: { cr: { min: 0.18 } }
};

async function main() {
  const archivo = process.argv[2];
  if (!archivo) {
    console.error('Uso: node scripts/importar-especificaciones.js "archivo.xlsx"');
    process.exit(1);
  }

  const wb = XLSX.readFile(archivo);
  let creadas = 0, actualizadas = 0, protegidas = 0;
  const avisos = [];

  for (const hoja of wb.SheetNames) {
    const filas = XLSX.utils.sheet_to_json(wb.Sheets[hoja], { header: 1, defval: null });

    // norma: fila que contiene "Norm:"
    let norma = null;
    for (const fila of filas.slice(0, 12)) {
      for (const celda of fila || []) {
        const m = celda && String(celda).match(/Norm:\s*(.+)$/i);
        if (m) { norma = m[1].trim(); break; }
      }
      if (norma) break;
    }
    // fila de encabezados de columna: la que tiene "Cr" en la columna 8.
    // La PRIMERA aparición de cada nombre gana: algunas hojas (Toyota)
    // repiten "BR Ni"/"SB Ni" al final como ratios, que no son espesores.
    let columnas = null; // índice de columna → clave
    for (let i = 0; i < Math.min(filas.length, 25); i++) {
      if (filas[i] && String(filas[i][8] || '').trim().toLowerCase() === 'cr') {
        columnas = {};
        filas[i].forEach((celda, j) => {
          const clave = ENCABEZADO_A_CLAVE[String(celda || '').trim().toLowerCase()];
          if (clave && !Object.values(columnas).includes(clave)) columnas[j] = clave;
        });
        break;
      }
    }
    // en algunas hojas la columna de poros no dice "poros/cm2" en esa fila;
    // se ubica por el rótulo de sección ("MP / MC", "Conteo de poros") o por
    // la fila de unidades ("poros/cm2")
    if (columnas && !Object.values(columnas).includes('microporos')) {
      for (const fila of filas.slice(0, 25)) {
        const j = (fila || []).findIndex(c =>
          c && /^(MP\s*\/\s*MC|Conteo de poros\b.*|poros\/cm2)$/i.test(String(c).trim()));
        if (j >= 0) { columnas[j] = 'microporos'; break; }
      }
    }
    // specs: fila siguiente a la que dice "Especificación"
    let specs = null;
    for (let i = 0; i < Math.min(filas.length, 25); i++) {
      if ((filas[i] || []).some(c => c && /Especificaci/i.test(String(c)))) {
        specs = filas[i + 1] || null;
        break;
      }
    }
    if (!norma || !specs || !columnas) {
      avisos.push(`hoja "${hoja}": sin norma, encabezados o fila de specs, omitida`);
      continue;
    }

    const limites = {};
    for (const [col, clave] of Object.entries(columnas)) {
      const celda = specs[col];
      const lim = parseLimite(celda);
      if (lim) limites[clave] = lim;
      else if (celda !== null && celda !== undefined && String(celda).trim() && !/N\/?E/i.test(String(celda))) {
        avisos.push(`hoja "${hoja}", campo ${clave}: límite no interpretable "${String(celda).trim()}", omitido`);
      }
    }

    const nombreCliente = clienteDeHoja(hoja);
    Object.assign(limites, CORRECCIONES[nombreCliente] || {});
    const { rows: clientes } = await pool.query(
      `INSERT INTO clientes (nombre) VALUES ($1)
       ON CONFLICT (nombre) DO UPDATE SET nombre = EXCLUDED.nombre RETURNING id`, [nombreCliente]
    );

    // las normas editadas a mano en la app (editada_manual) no se tocan
    const { rows } = await pool.query(
      `INSERT INTO especificaciones (cliente_id, norma, limites)
       VALUES ($1,$2,$3)
       ON CONFLICT (cliente_id, norma) DO UPDATE SET limites = EXCLUDED.limites
       WHERE NOT especificaciones.editada_manual
       RETURNING (xmax = 0) AS insertada`,
      [clientes[0].id, norma, JSON.stringify(limites)]
    );
    if (!rows.length) {
      console.log(`  ${nombreCliente} | ${norma} | protegida (editada a mano), no se toca`);
      protegidas++;
    } else {
      rows[0].insertada ? creadas++ : actualizadas++;
      console.log(`  ${nombreCliente} | ${norma} | ${Object.keys(limites).length} límites`);
    }
  }

  console.log(`\nespecificaciones creadas: ${creadas}, actualizadas: ${actualizadas}, protegidas (editadas a mano): ${protegidas}`);
  if (avisos.length) {
    console.log('\navisos:');
    avisos.forEach(a => console.log('  - ' + a));
  }
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
