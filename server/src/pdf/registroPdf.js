// Reporte de espesores y S.T.E.P. en el formato FM-15-01-03 del laboratorio:
// página 1 THICKNESS TEST REPORT, página 2 S.T.E.P. TEST REPORT.
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const UPLOADS = path.join(__dirname, '..', '..', 'uploads');
const LOGO = path.join(__dirname, '..', '..', 'assets', 'logo.png');
// Paleta styles.md §7: gris oscuro de marca (naranja se reserva para acentos).
const PRIMARIO = '#1d252d';
const FONDO = '#eceded';
const BORDE = '#d0d3d4';
const MARGEN = 50;
const ANCHO_UTIL = 612 - 2 * MARGEN;
const LIMITE_Y = 700; // a partir de aquí se salta de página

// Datos fijos del proceso, como vienen en su formato.
const PROCESO = { numero: '1450', descripcion: 'CHROME PLATED', taller: 'CIE ALUDEC AUTOMOCION' };

function fecha(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fechaHora(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

// Nota: la fuente estándar de pdfkit (WinAnsi) no tiene ≥ ≤ Δ, por eso
// los límites van con >= / <= y "Pot. Diff." en lugar de ΔP.
// Los límites pueden ser absolutos ({min,max}) o porcentuales respecto al
// Ni total ({min_pct,max_pct}), como el "SB Ni >= 50% Total Ni" de Toyota.
function limiteTexto(espec, clave, unidad = '') {
  const lim = espec && espec.limites ? espec.limites[clave] : null;
  if (!lim) return 'N/S';
  const u = unidad ? ` ${unidad}` : '';
  const partes = [];
  if (lim.min !== undefined && lim.max !== undefined) partes.push(`${lim.min}-${lim.max}${u}`);
  else if (lim.min !== undefined) partes.push(`>= ${lim.min}${u}`);
  else if (lim.max !== undefined) partes.push(`<= ${lim.max}${u}`);
  if (lim.min_pct !== undefined && lim.max_pct !== undefined) partes.push(`${lim.min_pct}-${lim.max_pct}% NiT`);
  else if (lim.min_pct !== undefined) partes.push(`>= ${lim.min_pct}% NiT`);
  else if (lim.max_pct !== undefined) partes.push(`<= ${lim.max_pct}% NiT`);
  return partes.join(' y ') || 'N/S';
}

// Ni total de referencia para los porcentajes: el del mismo punto del STEP,
// si no el promedio de la pieza, si no la suma de capas SB+Br+MPS.
function niTotalBase(pieza) {
  const meds = (pieza.mediciones || []).filter(m => m.ni_total !== null && m.ni_total !== undefined);
  const punto = Number(pieza.step_punto);
  if (punto) {
    const m = meds.find(m => Number(m.punto) === punto);
    if (m) return Number(m.ni_total);
  }
  if (meds.length) return meds.reduce((s, m) => s + Number(m.ni_total), 0) / meds.length;
  const capas = [pieza.ni_sb, pieza.ni_br, pieza.ni_mps]
    .filter(v => v !== null && v !== undefined)
    .map(Number);
  return capas.length >= 2 ? capas.reduce((a, b) => a + b, 0) : null;
}

function fueraDeLimite(espec, clave, valor, base = null) {
  const lim = espec && espec.limites ? espec.limites[clave] : null;
  if (!lim || valor === null || valor === undefined) return false;
  const n = Number(valor);
  if ((lim.min !== undefined && n < lim.min) || (lim.max !== undefined && n > lim.max)) return true;
  if ((lim.min_pct !== undefined || lim.max_pct !== undefined) && base) {
    const pct = (n / base) * 100;
    if (lim.min_pct !== undefined && pct < lim.min_pct) return true;
    if (lim.max_pct !== undefined && pct > lim.max_pct) return true;
  }
  return false;
}

// Tabla con bordes; columnas: [{titulo, ancho}], filas: [[{texto, rojo?}|string]]
function tabla(doc, x, columnas, filas, altoEncabezado = 26) {
  const anchoTotal = columnas.reduce((s, c) => s + c.ancho, 0);
  let y = doc.y;
  // encabezado
  doc.rect(x, y, anchoTotal, altoEncabezado).fillAndStroke(FONDO, BORDE);
  let cx = x;
  for (const col of columnas) {
    doc.fillColor('black').font('Helvetica-Bold').fontSize(7)
      .text(col.titulo, cx + 2, y + 4, { width: col.ancho - 4, align: 'center' });
    doc.moveTo(cx, y).lineTo(cx, y + altoEncabezado).strokeColor(BORDE).stroke();
    cx += col.ancho;
  }
  y += altoEncabezado;
  // filas
  const altoFila = 14;
  for (const fila of filas) {
    doc.rect(x, y, anchoTotal, altoFila).strokeColor(BORDE).stroke();
    cx = x;
    fila.forEach((celda, i) => {
      const { texto, rojo } = typeof celda === 'object' && celda !== null ? celda : { texto: celda };
      doc.fillColor(rojo ? '#b91c1c' : 'black').font(rojo ? 'Helvetica-Bold' : 'Helvetica').fontSize(8)
        .text(texto === null || texto === undefined ? '—' : String(texto), cx + 2, y + 3.5, { width: columnas[i].ancho - 4, align: 'center' });
      doc.moveTo(cx, y).lineTo(cx, y + altoFila).strokeColor(BORDE).stroke();
      cx += columnas[i].ancho;
    });
    y += altoFila;
  }
  doc.fillColor('black');
  doc.y = y + 8;
}

function encabezado(doc, titulo, registro) {
  // logo CIE Aludec sobre el blanco + banda de título
  try { doc.image(LOGO, MARGEN, MARGEN + 5, { height: 28 }); } catch { /* sin logo: solo banda */ }
  const bandaX = MARGEN + 115;
  doc.rect(bandaX, MARGEN, ANCHO_UTIL - 150 - 115, 38).fillAndStroke(PRIMARIO, PRIMARIO);
  doc.fillColor('white').font('Helvetica-Bold')
    .fontSize(13).text(titulo, bandaX + 6, MARGEN + 12, { width: ANCHO_UTIL - 150 - 115 - 12, align: 'center' });
  // recuadro de formato
  const fx = MARGEN + ANCHO_UTIL - 145;
  doc.rect(fx, MARGEN, 145, 38).strokeColor(BORDE).stroke();
  doc.fillColor('black').font('Helvetica').fontSize(6.5);
  doc.text('FORMAT ID:  FM-15-01-03  ·  REV. A', fx + 4, MARGEN + 4);
  doc.text('FORMAT CREATION DATE:  ene-24', fx + 4, MARGEN + 16);
  doc.text('FORMAT REVIEW DATE:  ene-24', fx + 4, MARGEN + 27);
  doc.y = MARGEN + 46;

  tabla(doc, MARGEN, [
    { titulo: 'No. PROCESS/OPERATION', ancho: 130 },
    { titulo: 'PROCESS DESCRIPTION', ancho: 252 },
    { titulo: 'WORKSHOP', ancho: 130 }
  ], [[PROCESO.numero, PROCESO.descripcion, PROCESO.taller]], 14);

  tabla(doc, MARGEN, [
    { titulo: 'REPORT NO.', ancho: 80 },
    { titulo: 'DATE', ancho: 80 },
    { titulo: 'ISSUED BY', ancho: 130 },
    { titulo: 'APPROVED BY', ancho: 130 },
    { titulo: 'CUSTOMER', ancho: 92 }
  // ISSUED BY muestra al responsable; APPROVED BY lleva al firmante digital
  // (si el registro está firmado) o queda en blanco para firma a mano.
  ], [[registro.reporte_no, fecha(registro.fecha_prueba), registro.realizado_por_nombre,
       registro.firmado_por ? registro.firmado_por_nombre : '', registro.cliente_nombre]], 14);

  tabla(doc, MARGEN, [
    { titulo: 'REFERENCE', ancho: 110 },
    { titulo: 'DENOMINATION', ancho: 152 },
    { titulo: 'OF', ancho: 80 },
    { titulo: 'PRODUCTION DATE', ancho: 90 },
    { titulo: 'CUSTOMER NORME', ancho: 80 }
  ], [[registro.referencia, registro.denominacion, registro.of || '—',
       fecha(registro.fecha_produccion), registro.norma || '—']], 14);
}

function leyendaYObservaciones(doc, registro) {
  doc.fontSize(7).font('Helvetica-Bold')
    .text('HCD: High Current Density   ·   LCD: Low Current Density', MARGEN, doc.y);
  doc.y += 4;
  tabla(doc, MARGEN, [{ titulo: 'Observations', ancho: ANCHO_UTIL }],
    [[registro.observaciones || 'Without any alteration']], 12);
  if (registro.resultado) {
    const ok = registro.resultado === 'PASS';
    doc.font('Helvetica-Bold').fontSize(10).fillColor(ok ? '#15803d' : '#b91c1c')
      .text(`RESULT: ${registro.resultado}`, MARGEN, doc.y);
    doc.fillColor('black');
    doc.y += 6;
  }
}

// opciones.secciones permite imprimir solo parte del formato (lo usa la
// impresión por OF): { thickness, step, poros } — sin opciones va completo.
// opciones.qr: PNG del QR de verificación cuando el registro está firmado.
module.exports = function generarRegistroPdf(stream, registro, opciones = {}) {
  const secciones = { thickness: true, step: true, poros: true, ...(opciones.secciones || {}) };
  const doc = new PDFDocument({ size: 'LETTER', margins: { top: MARGEN, bottom: 55, left: MARGEN, right: MARGEN }, bufferPages: true });
  doc.pipe(stream);
  const espec = registro.espec;

  // Marca de agua ANULADO/VOID en cada página cuando el registro está anulado.
  if (registro.anulado_por) {
    const marcaAgua = () => {
      // Restaurar doc.x/doc.y: el texto de la marca los mueve a media página y,
      // tras cada addPage, el contenido empezaría ahí (con hueco enorme arriba).
      const xPrev = doc.x, yPrev = doc.y;
      doc.save();
      doc.rotate(-45, { origin: [306, 396] });
      doc.fontSize(60).fillColor('#f3d0d0').font('Helvetica-Bold')
        .text('ANULADO / VOID', 0, 360, { width: 612, align: 'center' });
      doc.restore();
      doc.fillColor('black');
      doc.x = xPrev; doc.y = yPrev;
    };
    marcaAgua();
    doc.on('pageAdded', marcaAgua);
  }

  // pdfkit ya trae la primera página creada; las siguientes secciones abren la suya
  let hayPagina = false;
  const paginaDeSeccion = (titulo) => {
    if (hayPagina) doc.addPage();
    hayPagina = true;
    encabezado(doc, titulo, registro);
  };

  const existe = (img) => fs.existsSync(path.join(UPLOADS, img.archivo));
  const fotosDe = (piezaId, seccion) =>
    (registro.imagenes || []).filter(img => img.pieza_id === piezaId && img.seccion === seccion && existe(img));

  // filas de fotos CENTRADAS, con salto de página y tamaño dado. Cada fila
  // se centra en el ancho útil; cada foto se centra dentro de su recuadro.
  const filaFotos = (lista, ancho, alto) => {
    const porFila = Math.max(1, Math.floor((ANCHO_UTIL + 12) / (ancho + 12)));
    for (let i = 0; i < lista.length; i += porFila) {
      const grupo = lista.slice(i, i + porFila);
      if (doc.y + alto + 6 > LIMITE_Y) doc.addPage();
      const anchoGrupo = grupo.length * ancho + (grupo.length - 1) * 12;
      let x = MARGEN + (ANCHO_UTIL - anchoGrupo) / 2;
      for (const img of grupo) {
        try {
          doc.image(path.join(UPLOADS, img.archivo), x, doc.y + 3, { fit: [ancho, alto], align: 'center', valign: 'center' });
        } catch { /* ilegible: se omite */ }
        x += ancho + 12;
      }
      doc.y += alto + 8;
    }
    doc.x = MARGEN;
  };

  // ===== Página 1: THICKNESS TEST REPORT =====
  if (secciones.thickness) {
  paginaDeSeccion('THICKNESS TEST REPORT');

  // foto(s) de muestra (puntos de medición): a ancho completo (el de una
  // línea de texto) y centradas.
  const fotos = (registro.imagenes || []).filter(img => !img.pieza_id && existe(img));
  if (fotos.length) {
    tabla(doc, MARGEN, [{ titulo: 'SAMPLE', ancho: ANCHO_UTIL }], [], 12);
    const altoSample = 380;
    for (const img of fotos.slice(0, 3)) {
      if (doc.y + altoSample + 6 > LIMITE_Y) doc.addPage();
      try {
        doc.image(path.join(UPLOADS, img.archivo), MARGEN, doc.y + 3, { fit: [ANCHO_UTIL, altoSample], align: 'center', valign: 'center' });
      } catch { /* ilegible: se omite */ }
      doc.y += altoSample + 8;
    }
  }

  doc.font('Helvetica-Bold').fontSize(10).text('Thickness measurement', MARGEN, doc.y, { width: ANCHO_UTIL, align: 'center' });
  doc.y += 4;

  for (const pieza of registro.piezas) {
    if (doc.y > 600) doc.addPage();
    doc.font('Helvetica-Bold').fontSize(8.5)
      .text(`Piece ${pieza.numero} — Rack position ${pieza.posicion_rack || '—'} ${pieza.densidad}`, MARGEN, doc.y);
    doc.y += 2;
    tabla(doc, MARGEN + 60, [
      { titulo: 'measurement\npoint', ancho: 50 },
      { titulo: `Cr thickness\n(${limiteTexto(espec, 'cr', 'µm')})`, ancho: 95 },
      { titulo: `TOTAL Nickel\nThickness (${limiteTexto(espec, 'ni_t', 'µm')})`, ancho: 100 },
      { titulo: `Cu thickness\n(${limiteTexto(espec, 'cu', 'µm')})`, ancho: 95 },
      { titulo: 'Comment', ancho: 110 }
    ], pieza.mediciones.map(m => [
      m.punto,
      { texto: m.cr, rojo: fueraDeLimite(espec, 'cr', m.cr) },
      { texto: m.ni_total, rojo: fueraDeLimite(espec, 'ni_t', m.ni_total) },
      { texto: m.cu, rojo: fueraDeLimite(espec, 'cu', m.cu) },
      m.comentario || ''
    ]));

    // fotos de espesores de la pieza
    const fotosEsp = fotosDe(pieza.id, 'espesores');
    if (fotosEsp.length) {
      if (doc.y + 140 > LIMITE_Y) doc.addPage(); // etiqueta y foto juntas
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#5b6b84')
        .text(`Thickness photos — Piece ${pieza.numero}:`, MARGEN, doc.y);
      doc.fillColor('black');
      filaFotos(fotosEsp, 160, 120);
    }
  }

  leyendaYObservaciones(doc, registro);
  }

  // ===== Página 2: S.T.E.P. TEST REPORT (incluye el conteo de poros) =====
  const conStep = registro.piezas.filter(p =>
    p.ni_sb !== null || p.ni_br !== null || p.ni_mps !== null ||
    p.dp_mp_br !== null || p.dp_br_sb !== null ||
    p.ni_sb_pct !== null || p.ni_br_pct !== null
  );
  const conPoros = registro.piezas.filter(p => p.poros !== null);
  const quiereStep = secciones.step && conStep.length > 0;
  const quierePoros = secciones.poros && conPoros.length > 0;
  if (quiereStep || quierePoros) {
    paginaDeSeccion('S.T.E.P. TEST REPORT');

    for (const pieza of (quiereStep ? conStep : [])) {
      if (doc.y > 580) doc.addPage();
      doc.font('Helvetica-Bold').fontSize(8.5)
        .text(`STEP TEST — Piece ${pieza.numero} (Rack position ${pieza.posicion_rack || '—'}) ${pieza.densidad}`, MARGEN, doc.y);
      doc.y += 2;
      const base = niTotalBase(pieza);
      tabla(doc, MARGEN, [
        { titulo: 'measurement\npoint', ancho: 42 },
        { titulo: `Nickel SB\nThickness (${limiteTexto(espec, 'sb_ni', 'µm')})`, ancho: 72 },
        { titulo: `Br Nickel\nThickness (${limiteTexto(espec, 'br_ni', 'µm')})`, ancho: 72 },
        { titulo: `MPS Nickel\nThickness (${limiteTexto(espec, 'mp_ni', 'µm')})`, ancho: 72 },
        { titulo: '% Ni SB', ancho: 48 },
        { titulo: '% Ni Br', ancho: 48 },
        { titulo: `Pot. Diff. NiMPS-NiB\n(${limiteTexto(espec, 'step_mp_br', 'mV')})`, ancho: 79 },
        { titulo: `Pot. Diff. NiB-NiSB\n(${limiteTexto(espec, 'step_br_sb', 'mV')})`, ancho: 79 }
      ], [[
        pieza.step_punto,
        { texto: pieza.ni_sb, rojo: fueraDeLimite(espec, 'sb_ni', pieza.ni_sb, base) },
        { texto: pieza.ni_br, rojo: fueraDeLimite(espec, 'br_ni', pieza.ni_br, base) },
        { texto: pieza.ni_mps, rojo: fueraDeLimite(espec, 'mp_ni', pieza.ni_mps, base) },
        pieza.ni_sb_pct != null ? `${pieza.ni_sb_pct}%` : '—',
        pieza.ni_br_pct != null ? `${pieza.ni_br_pct}%` : '—',
        { texto: pieza.dp_mp_br, rojo: fueraDeLimite(espec, 'step_mp_br', pieza.dp_mp_br) },
        { texto: pieza.dp_br_sb, rojo: fueraDeLimite(espec, 'step_br_sb', pieza.dp_br_sb) }
      ]]);

      // gráficas STEP de la pieza (espesor / potencial)
      const graficas = fotosDe(pieza.id, 'step');
      if (graficas.length) {
        if (doc.y + 150 > LIMITE_Y) doc.addPage(); // etiqueta y foto juntas
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#5b6b84')
          .text(`Thickness / Potential graphs — Piece ${pieza.numero}:`, MARGEN, doc.y);
        doc.fillColor('black');
        filaFotos(graficas, 240, 130);
      }
    }

    // Conteo de poros: una tarjeta por pieza, con el valor grande y el
    // mínimo de la norma — verde si cumple, rojo si no.
    if (quierePoros) {
      doc.y += 4;
      doc.font('Helvetica-Bold').fontSize(10).fillColor('black')
        .text('Pore count / Conteo de poros', MARGEN, doc.y, { width: ANCHO_UTIL, align: 'center' });
      doc.y += 6;
      const minPorosLim = espec && espec.limites && espec.limites.microporos && espec.limites.microporos.min;
      const anchoCaja = 160, altoCaja = 72, sep = 16;
      const porFila = 3;
      for (let i = 0; i < conPoros.length; i += porFila) {
        if (doc.y + altoCaja + 10 > LIMITE_Y) doc.addPage();
        const fila = conPoros.slice(i, i + porFila);
        const anchoFila = fila.length * anchoCaja + (fila.length - 1) * sep;
        let x = MARGEN + (ANCHO_UTIL - anchoFila) / 2;
        const y = doc.y;
        for (const pieza of fila) {
          const fuera = fueraDeLimite(espec, 'microporos', pieza.poros);
          doc.roundedRect(x, y, anchoCaja, altoCaja, 6).fillAndStroke(fuera ? '#fdecec' : '#eaf6ee', fuera ? '#e7a4a8' : '#a9d8b5');
          doc.fillColor('#5b6b84').font('Helvetica-Bold').fontSize(6.5)
            .text(`PIECE ${pieza.numero} · ${pieza.posicion_rack || '—'} · ${pieza.densidad}`,
              x + 6, y + 9, { width: anchoCaja - 12, align: 'center' });
          doc.fillColor(fuera ? '#b91c1c' : '#15803d').font('Helvetica-Bold').fontSize(19)
            .text(Number(pieza.poros).toLocaleString('en-US'), x, y + 22, { width: anchoCaja, align: 'center' });
          doc.fillColor('#5b6b84').font('Helvetica').fontSize(7)
            .text(`pores/cm²${minPorosLim ? `  ·  min ${Number(minPorosLim).toLocaleString('en-US')}` : ''}  ·  ${fuera ? 'OUT OF SPEC' : 'OK'}`,
              x, y + 50, { width: anchoCaja, align: 'center' });
          x += anchoCaja + sep;
        }
        doc.y = y + altoCaja + 12;
      }
      doc.fillColor('black');
      doc.x = MARGEN;

      // fotos de poros (microscopio) por pieza
      for (const pieza of conPoros) {
        const fotosPoros = fotosDe(pieza.id, 'poros');
        if (!fotosPoros.length) continue;
        if (doc.y + 140 > LIMITE_Y) doc.addPage(); // etiqueta y foto juntas
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#5b6b84')
          .text(`Pore count photos — Piece ${pieza.numero} (${pieza.posicion_rack || '—'}) ${pieza.densidad}:`, MARGEN, doc.y);
        doc.fillColor('black');
        filaFotos(fotosPoros, 160, 120);
      }
    }

    // tabla de discontinuidad mínima, como el formato (va con los poros)
    if (quierePoros) {
      const minPoros = espec && espec.limites && espec.limites.microporos && espec.limites.microporos.min;
      tabla(doc, MARGEN, [
        { titulo: 'Table 2: Minimum Discontinuity Quantities — Type', ancho: 256 },
        { titulo: 'Minimum Discontinuity', ancho: 256 }
      ], [['Micropores', minPoros ? `${Number(minPoros).toLocaleString('en-US')} pores/cm²` : 'N/S']], 12);
    }

    leyendaYObservaciones(doc, registro);
  }

  // ===== Firma digital =====
  // Al final del documento, cuando el registro fue firmado (admin / admin de
  // área): firmante, momento de la firma y QR a la verificación pública.
  if (registro.firmado_por) {
    if (doc.y + 100 > LIMITE_Y) doc.addPage();
    doc.y += 6;
    const yF = doc.y;
    doc.rect(MARGEN, yF, ANCHO_UTIL, 92).strokeColor(BORDE).stroke();
    if (opciones.qr) {
      try { doc.image(opciones.qr, MARGEN + 8, yF + 8, { fit: [76, 76] }); } catch { /* sin QR: solo texto */ }
    }
    const tx = MARGEN + 96;
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('black')
      .text('FIRMA DIGITAL / DIGITAL SIGNATURE', tx, yF + 10);
    doc.font('Helvetica-Bold').fontSize(10)
      .text(registro.firmado_por_nombre || '', tx, yF + 25);
    doc.font('Helvetica').fontSize(8).fillColor('#5b6770')
      .text(`Firmado digitalmente el / Digitally signed on: ${fechaHora(registro.firmado_en)}`, tx, yF + 41)
      .text(`ID de firma / Signature ID: ${String(registro.firma_token || '').slice(0, 16).toUpperCase()}`, tx, yF + 53)
      .text('Verifique la autenticidad escaneando el código QR / Verify authenticity by scanning the QR code',
        tx, yF + 68, { width: ANCHO_UTIL - 104 });
    doc.fillColor('black');
    doc.y = yF + 100;
  }

  // ===== Pie de página =====
  const total = doc.bufferedPageRange().count;
  for (let i = 0; i < total; i++) {
    doc.switchToPage(i);
    const margenInferior = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.fontSize(7.5).fillColor('#777777').text(
      `FM-15-01-03 · ${registro.cliente_nombre} · Report No. ${registro.reporte_no} · Página ${i + 1} de ${total}`,
      MARGEN, 755, { width: ANCHO_UTIL, align: 'center', lineBreak: false }
    );
    doc.page.margins.bottom = margenInferior;
  }

  doc.end();
};
