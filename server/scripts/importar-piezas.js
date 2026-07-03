// Importa piezas (referencia + denominación) desde un Excel y deduce el
// cliente a partir del texto de la denominación.
//
// Uso: node scripts/importar-piezas.js "ruta/al/archivo.xlsx"
//
// La denominación se guarda tal cual viene (incluidos marcadores como
// *ERROR* u OBS""); esos marcadores solo se ignoran al deducir el cliente.
require('dotenv').config();
const XLSX = require('xlsx');
const { pool } = require('../src/db');

// Primera regla que coincida gana; las más específicas van antes.
// Los nombres de cliente siguen las hojas del formato real del laboratorio
// (BMW, TOYOTA, DAIMLER, NAVISTAR, KENWORTH, STELLANTIS, VW, GM, TESLA,
// VOLVO, EZGO, FORD) más marcas sueltas que aparecen en el catálogo.
const REGLAS = [
  ['STELLANTIS', /DODGE|JEEP|MOPAR|CHRYSLER|\bFCA\b|STELLANTIS|\bRAM\b|RAMVM|WIDE-BEE|WINGED VICTORY|\bLX\b|\bWD\b/],
  ['BMW', /BMW/],
  ['TOYOTA', /TOYOTA/],
  ['DAIMLER', /DTNA|DAIMLER|FREIGHTLINER|THOMAS BUS|WESTERN STAR/],
  ['NAVISTAR', /NAVISTAR|\bNAV\./],
  ['KENWORTH', /KENWORTH|PACCAR|PETERBILT/],
  ['VOLKSWAGEN', /VW|VOLKSWAGEN|4MOTION/],
  ['TESLA', /TESLA/],
  ['VOLVO', /VOLVO|MACK|PREVOST/],
  ['EZGO', /EZ-?GO|\bTSV\b/],
  ['FORD', /FORD|U71[78]|EXPEDITION|KING RANCH/],
  ['GM', /\bGM\b|\bGMC\b|CHEVROLET|CADILLAC/],
  ['JOHN DEERE', /JOHN\W*DEERE/],
  ['NEW HOLLAND', /NEW HOLLAND/],
  ['EATON', /\bS?EATON BADGE/],
  ['MPC', /\bMPC\b/],
  ['HARLEY-DAVIDSON', /HARLEY/],
  ['BRP', /\bBRP\b/],
  ['GREAT DANE', /GREAT DANE|GRAN DAN/],
  ['SEA RAY', /SEA RAY/],
  ['COBALT', /COBALT/],
  ['REGAL', /REGAL/],
  ['NAUTIQUE', /NAUTIQUE/],
  ['CHAPARRAL', /CHAPAR+AL/],
  ['S2 YACHTS', /S2 YA/],
  ['THUNDERBIRD', /THUNDERBIRD/],
  ['CHRIS CRAFT', /CHRIS CH?RAFT/],
  ['TENNANT', /TENNANT/],
  ['HONDA', /HONDA/],
  ['NISSAN', /NISSAN/],
  ['ST. JUDE MEDICAL', /ST\.? ?JUDE/],
  ['ALLEGIS', /ALLEGIS/],
  ['ARCATECH', /ARCATECH/],
  ['SEWELL', /SEWELL/],
  ['BELLTECH', /BELLTECH/],
  ['SNUGTOP', /SNUGTOP/],
  ['WESTERN TRAILERS', /WESTERN TRAILERS/],
  ['DOW', /\bDOW\b/],
  ['WEISS-TECHNIK', /WEISS/],
  ['BULL DOG', /BULL DOG/],
  ['INTERNO (PRUEBAS)', /TEST PANEL|P\/PRUEBAS|PRUEBAS CROMADO/]
];

function deducirCliente(denominacion, referencia) {
  // quita marcadores de estatus para no confundir la deducción
  const texto = denominacion.toUpperCase().replace(/\*?ERROR\*?|OBS""?/g, ' ');
  for (const [cliente, patron] of REGLAS) {
    if (patron.test(texto)) return cliente;
  }
  // deducción por patrón del número de parte cuando el texto no dice nada
  if (/^(68|05)/.test(referencia)) return 'STELLANTIS';       // Stellantis: 68xxx / 05xxx
  if (/^SL1B/i.test(referencia)) return 'FORD';               // familia U717/U718
  if (/^\d[A-Z]{2,3}\d/i.test(referencia)) return 'VOLKSWAGEN'; // formato VW: 5NA…, 2GJ…
  return 'SIN ASIGNAR';
}

async function main() {
  const archivo = process.argv[2];
  if (!archivo) {
    console.error('Uso: node scripts/importar-piezas.js "archivo.xlsx"');
    process.exit(1);
  }
  const wb = XLSX.readFile(archivo);
  const filas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null })
    .slice(1)
    .filter(f => f[0] != null && f[1] != null);

  const clientesCache = {};
  async function idCliente(nombre) {
    if (clientesCache[nombre]) return clientesCache[nombre];
    const { rows } = await pool.query(
      `INSERT INTO clientes (nombre) VALUES ($1)
       ON CONFLICT (nombre) DO UPDATE SET nombre = EXCLUDED.nombre
       RETURNING id`, [nombre]
    );
    clientesCache[nombre] = rows[0].id;
    return rows[0].id;
  }

  const vistas = new Set();
  const porCliente = {};
  const sinAsignar = [];
  let nuevas = 0, actualizadas = 0, duplicadasEnExcel = 0;

  for (const fila of filas) {
    const referencia = String(fila[0]).trim();
    const denominacion = String(fila[1]).trim();
    if (!referencia || !denominacion) continue;
    if (vistas.has(referencia.toLowerCase())) { duplicadasEnExcel++; continue; }
    vistas.add(referencia.toLowerCase());

    const cliente = deducirCliente(denominacion, referencia);
    porCliente[cliente] = (porCliente[cliente] || 0) + 1;
    if (cliente === 'SIN ASIGNAR') sinAsignar.push(`${referencia} | ${denominacion}`);

    const { rows } = await pool.query(
      `INSERT INTO piezas (referencia, denominacion, cliente_id)
       VALUES ($1, $2, $3)
       ON CONFLICT ((lower(referencia))) DO UPDATE
         SET denominacion = EXCLUDED.denominacion, cliente_id = EXCLUDED.cliente_id
       RETURNING (xmax = 0) AS insertada`,
      [referencia, denominacion, await idCliente(cliente)]
    );
    rows[0].insertada ? nuevas++ : actualizadas++;
  }

  console.log(`piezas nuevas: ${nuevas}, actualizadas: ${actualizadas}, duplicadas en el Excel (omitidas): ${duplicadasEnExcel}`);
  console.log('\npiezas por cliente:');
  for (const [c, n] of Object.entries(porCliente).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${c}`);
  }
  if (sinAsignar.length) {
    console.log('\nsin cliente deducible (quedaron en "SIN ASIGNAR", corregibles desde Administración > Piezas):');
    sinAsignar.forEach(p => console.log('  ' + p));
  }
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
