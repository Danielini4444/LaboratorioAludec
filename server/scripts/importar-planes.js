// Importa el plan de pruebas de cromado por cliente desde la hoja
// "CROMADO VAL" de "Información metrologia.xlsx".
//
// Estructura de la hoja: bloques que inician con CLIENTE; cada bloque trae
// la norma, sus pruebas (ENSAYO REALIZADO + CARACTERISTICA A EVALUAR) y la
// lista de referencias a las que aplica. La norma puede cambiar a mitad de
// bloque (ej. Toyota: TSH6504G-S, TSH6102G, TSH6536G-S).
//
// Uso: node scripts/importar-planes.js "ruta/al/Información metrologia.xlsx"
require('dotenv').config();
const XLSX = require('xlsx');
const { pool } = require('../src/db');

const HOJA = 'CROMADO VAL';
const PROCESO = 'cromado';

// El Excel usa nombres cortos; la base usa estos.
function nombreCliente(nombre) {
  const limpio = nombre.trim().toUpperCase();
  return limpio === 'VW' ? 'VOLKSWAGEN' : limpio;
}

async function main() {
  const archivo = process.argv[2];
  if (!archivo) {
    console.error('Uso: node scripts/importar-planes.js "archivo.xlsx"');
    process.exit(1);
  }
  const wb = XLSX.readFile(archivo);
  if (!wb.SheetNames.includes(HOJA)) throw new Error(`No existe la hoja "${HOJA}"`);
  const filas = XLSX.utils.sheet_to_json(wb.Sheets[HOJA], { header: 1, defval: null });

  // parsear bloques
  const bloques = []; // {cliente, pruebas: [{norma, ensayo, caracteristica}], referencias: [{referencia, denominacion}]}
  let bloque = null;
  let normaActual = null;
  for (let i = 1; i < filas.length; i++) {
    const f = filas[i] || [];
    const cliente = f[1] && String(f[1]).trim();
    const referencia = f[2] && String(f[2]).trim();
    const denominacion = f[3] && String(f[3]).trim();
    const norma = f[4] && String(f[4]).trim();
    const ensayo = f[5] && String(f[5]).trim();
    const caracteristica = f[6] && String(f[6]).trim();

    if (cliente) {
      bloque = { cliente: nombreCliente(cliente), plan_norma: null, pruebas: [], referencias: [] };
      bloques.push(bloque);
      normaActual = null;
    }
    if (!bloque) continue;
    if (norma) {
      normaActual = norma;
      if (!bloque.plan_norma) bloque.plan_norma = norma; // la primera norma identifica el plan
    }
    if (ensayo) bloque.pruebas.push({ norma: normaActual, ensayo, caracteristica: caracteristica || null });
    if (referencia && denominacion) bloque.referencias.push({ referencia, denominacion });
  }

  let clientesNuevos = 0, piezasNuevas = 0;
  for (const b of bloques) {
    const { rows: clientes } = await pool.query(
      `INSERT INTO clientes (nombre) VALUES ($1)
       ON CONFLICT (nombre) DO UPDATE SET nombre = EXCLUDED.nombre
       RETURNING id, (xmax = 0) AS nuevo`, [b.cliente]
    );
    if (clientes[0].nuevo) clientesNuevos++;
    const clienteId = clientes[0].id;

    // el plan del Excel manda: se reemplaza completo por cliente + norma
    const planNorma = b.plan_norma || '';
    await pool.query(
      `DELETE FROM planes_prueba WHERE proceso = $1 AND cliente_id = $2 AND plan_norma = $3`,
      [PROCESO, clienteId, planNorma]
    );
    for (let i = 0; i < b.pruebas.length; i++) {
      const p = b.pruebas[i];
      await pool.query(
        `INSERT INTO planes_prueba (proceso, cliente_id, plan_norma, norma, ensayo, caracteristica, orden)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [PROCESO, clienteId, planNorma, p.norma, p.ensayo, p.caracteristica, i + 1]
      );
    }

    // las referencias del bloque enriquecen el catálogo de piezas
    for (const r of b.referencias) {
      const { rows } = await pool.query(
        `INSERT INTO piezas (referencia, denominacion, cliente_id)
         VALUES ($1,$2,$3) ON CONFLICT ((lower(referencia))) DO NOTHING RETURNING id`,
        [r.referencia, r.denominacion, clienteId]
      );
      if (rows.length) piezasNuevas++;
    }
    console.log(`  ${b.cliente} | plan ${planNorma || '(sin norma)'} | ${b.pruebas.length} pruebas | ${b.referencias.length} referencias`);
  }

  console.log(`\nbloques: ${bloques.length}, clientes nuevos: ${clientesNuevos}, piezas nuevas al catálogo: ${piezasNuevas}`);
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
