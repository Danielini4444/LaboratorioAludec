// Informe de Ensayos de inyección (folio Iny_####): datos generales
// (cliente, referencia/denominación, OF/lote, solicitante, información
// previa), tabla de ensayos (Id, Ensayo-Descripción, Exigencia, Resultado,
// Característica, Observaciones, Conformidad), valoración final, apartado
// de fotos con descripción y firma digital con QR.
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const UPLOADS = path.join(__dirname, '..', '..', 'uploads');
const LOGO = path.join(__dirname, '..', '..', 'assets', 'logo.png');
// Paleta styles.md §7: gris oscuro de marca (naranja se reserva para acentos).
const PRIMARIO = '#1d252d';
const FONDO = '#eceded';
const BORDE = '#d0d3d4';
const GRIS = '#5b6770';
const MARGEN = 50;
const ANCHO_UTIL = 612 - 2 * MARGEN;
const LIMITE_Y = 700;
// Código y revisión del formato controlado: pendientes de que calidad emita
// el formato real del informe de inyección; actualizar aquí cuando exista.
const FORMATO_CODIGO = '';
const FORMATO_REV = 'A';

const folioTexto = (folio) => `Iny_${String(folio).padStart(4, '0')}`;

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

// opciones.qr: PNG del QR de verificación cuando el informe está firmado.
module.exports = function generarEnsayoInyeccionPdf(stream, ensayo, opciones = {}) {
  const doc = new PDFDocument({ size: 'LETTER', margins: { top: MARGEN, bottom: 55, left: MARGEN, right: MARGEN }, bufferPages: true });
  doc.pipe(stream);

  const esAnulado = !!ensayo.anulado_por;
  const esBorrador = !ensayo.aprobado_por;
  // ANULADO tiene prioridad sobre BORRADOR (un anulado puede no estar aprobado)
  const marca = esAnulado
    ? { texto: 'ANULADO / VOID', color: '#f3d0d0' }
    : { texto: 'BORRADOR / DRAFT', color: '#ececec' };
  const marcaAgua = () => {
    doc.save();
    doc.rotate(-45, { origin: [306, 396] });
    doc.fontSize(54).fillColor(marca.color).font('Helvetica-Bold')
      .text(marca.texto, 0, 366, { width: 612, align: 'center' });
    doc.restore();
    doc.fillColor('black');
  };
  if (esAnulado || esBorrador) {
    marcaAgua();
    doc.on('pageAdded', marcaAgua);
  }

  const salto = (alto = 0) => { if (doc.y + alto > LIMITE_Y) doc.addPage(); };

  // Tabla con bordes (mismo estilo del reporte de cromado).
  const tabla = (columnas, filas, altoEncabezado = 14) => {
    const anchoTotal = columnas.reduce((s, c) => s + c.ancho, 0);
    let y = doc.y;
    if (altoEncabezado >= 1) {
      doc.rect(MARGEN, y, anchoTotal, altoEncabezado).fillAndStroke(FONDO, BORDE);
      let cx = MARGEN;
      for (const col of columnas) {
        doc.fillColor('black').font('Helvetica-Bold').fontSize(7)
          .text(col.titulo, cx + 2, y + 4, { width: col.ancho - 4, align: 'center' });
        doc.moveTo(cx, y).lineTo(cx, y + altoEncabezado).strokeColor(BORDE).stroke();
        cx += col.ancho;
      }
      y += altoEncabezado;
    }
    for (const fila of filas) {
      // alto según el texto más largo de la fila
      doc.font('Helvetica').fontSize(8);
      const alto = Math.max(14, ...fila.map((celda, i) =>
        doc.heightOfString(String(celda ?? '—'), { width: columnas[i].ancho - 8 }) + 7));
      if (y + alto > LIMITE_Y + 30) {
        doc.addPage();
        y = MARGEN;
      }
      doc.rect(MARGEN, y, anchoTotal, alto).strokeColor(BORDE).stroke();
      let cx = MARGEN;
      fila.forEach((celda, i) => {
        doc.fillColor('black').text(celda === null || celda === undefined || celda === '' ? '—' : String(celda),
          cx + 4, y + 3.5, { width: columnas[i].ancho - 8, align: 'center' });
        doc.moveTo(cx, y).lineTo(cx, y + alto).strokeColor(BORDE).stroke();
        cx += columnas[i].ancho;
      });
      y += alto;
    }
    doc.y = y + 8;
    doc.x = MARGEN;
  };

  // ===== Encabezado =====
  try { doc.image(LOGO, MARGEN, MARGEN + 5, { height: 28 }); } catch { /* sin logo: solo banda */ }
  const bandaX = MARGEN + 115;
  doc.rect(bandaX, MARGEN, ANCHO_UTIL - 150 - 115, 38).fillAndStroke(PRIMARIO, PRIMARIO);
  doc.fillColor('white').font('Helvetica-Bold')
    .fontSize(11).text('INFORME DE ENSAYOS DE INYECCIÓN / INJECTION TEST REPORT', bandaX + 6, MARGEN + 9, { width: ANCHO_UTIL - 150 - 115 - 12, align: 'center' });
  const fx = MARGEN + ANCHO_UTIL - 145;
  doc.rect(fx, MARGEN, 145, 38).strokeColor('black').lineWidth(1.2).stroke();
  doc.fillColor(GRIS).font('Helvetica').fontSize(6.5).text('Nº Ensayo / Report No.', fx + 4, MARGEN + 5, { width: 137, align: 'center' });
  doc.fillColor('black').font('Helvetica-Bold').fontSize(14)
    .text(folioTexto(ensayo.folio), fx + 4, MARGEN + 16, { width: 137, align: 'center' });
  doc.lineWidth(1);
  doc.y = MARGEN + 46;

  doc.fontSize(7).fillColor(GRIS).font('Helvetica')
    .text(`${FORMATO_CODIGO ? `Código / Code: ${FORMATO_CODIGO}   ·   ` : ''}Emisión / Issue date: ${ensayo.fecha_emision ? fecha(ensayo.fecha_emision) : 'pendiente / pending'}   ·   CIE ALUDEC AUTOMOCION`,
      MARGEN, doc.y, { width: ANCHO_UTIL, align: 'center' });
  doc.fillColor('black');
  doc.y += 10;

  // ===== Datos generales =====
  tabla([
    { titulo: 'CLIENTE / CUSTOMER', ancho: 160 },
    { titulo: 'SOLICITANTE / REQUESTER', ancho: 160 },
    { titulo: 'OF / LOTE', ancho: 192 }
  ], [[ensayo.cliente_nombre, ensayo.solicitante, (ensayo.ofs || []).join(', ')]]);

  tabla([
    { titulo: 'REFERENCIA / REFERENCE', ancho: 200 },
    { titulo: 'DENOMINACIÓN / DENOMINATION', ancho: 312 }
  ], [[ensayo.referencia, ensayo.denominacion]], 18);

  if (ensayo.informacion_previa) {
    tabla([{ titulo: 'INFORMACIÓN PREVIA / PREVIOUS INFORMATION', ancho: ANCHO_UTIL }],
      [[ensayo.informacion_previa]]);
  }

  // ===== Ensayos =====
  salto(60);
  doc.rect(MARGEN, doc.y, ANCHO_UTIL, 16).fillAndStroke(PRIMARIO, PRIMARIO);
  doc.fillColor('white').font('Helvetica-Bold').fontSize(8.5)
    .text('ENSAYOS / TESTS', MARGEN + 6, doc.y + 4);
  doc.fillColor('black');
  doc.y += 6;

  if (ensayo.filas.length) {
    tabla([
      { titulo: 'ID', ancho: 22 },
      { titulo: 'ENSAYO-DESCRIPCIÓN / TEST-DESCRIPTION', ancho: 120 },
      { titulo: 'EXIGENCIA / REQUIREMENT', ancho: 90 },
      { titulo: 'RESULTADO / RESULT', ancho: 90 },
      { titulo: 'CARACTERÍSTICA / CHARACTERISTIC', ancho: 78 },
      { titulo: 'OBSERVACIONES / REMARKS', ancho: 78 },
      { titulo: 'CONF.', ancho: 34 }
    ], ensayo.filas.map(f => [
      f.numero, f.descripcion, f.exigencia, f.resultado,
      f.caracteristica, f.observaciones, f.conformidad
    ]), 20);
  } else {
    doc.y += 4;
    doc.font('Helvetica-Oblique').fontSize(9).fillColor(GRIS)
      .text('Sin ensayos registrados todavía / No tests recorded yet', MARGEN, doc.y);
    doc.fillColor('black');
    doc.y += 14;
  }

  // ===== Valoración final =====
  salto(60);
  doc.rect(MARGEN, doc.y, ANCHO_UTIL, 16).fillAndStroke(FONDO, BORDE);
  doc.fillColor('black').font('Helvetica-Bold').fontSize(8.5)
    .text('VALORACIÓN FINAL / FINAL ASSESSMENT', MARGEN + 6, doc.y + 4);
  doc.y += 8;
  if (ensayo.valoracion_final) {
    doc.font('Helvetica').fontSize(9).text(ensayo.valoracion_final, MARGEN, doc.y, { width: ANCHO_UTIL });
  } else {
    doc.font('Helvetica-Oblique').fontSize(9).fillColor(GRIS).text('Pendiente / Pending', MARGEN, doc.y);
    doc.fillColor('black');
  }
  doc.y += 6;

  // ===== Fotos con descripción =====
  const fotos = (ensayo.fotos || []).filter(img => fs.existsSync(path.join(UPLOADS, img.archivo)));
  if (fotos.length) {
    salto(120); // que el encabezado del apartado no quede huérfano al pie
    doc.rect(MARGEN, doc.y, ANCHO_UTIL, 16).fillAndStroke(FONDO, BORDE);
    doc.fillColor('black').font('Helvetica-Bold').fontSize(8.5)
      .text('EVIDENCIA FOTOGRÁFICA / PHOTOGRAPHIC EVIDENCE', MARGEN + 6, doc.y + 4);
    doc.y += 10;
    // cada foto ocupa solo su espacio real (escalada a un máximo de 240×160),
    // con su descripción al pie; se acomodan en fila según lo que ocupen.
    // La Y de la fila se lleva aparte porque doc.text() del pie mueve doc.y.
    let x = MARGEN;
    let yFila = doc.y;
    let filaAlto = 0;
    for (const img of fotos) {
      try {
        const info = doc.openImage(path.join(UPLOADS, img.archivo));
        const escala = Math.min(240 / info.width, 160 / info.height);
        const ancho = info.width * escala;
        const alto = info.height * escala;
        const pie = img.descripcion || img.nombre_original || '';
        doc.font('Helvetica').fontSize(8);
        const anchoPie = Math.max(ancho, 110);
        const altoPie = pie ? doc.heightOfString(pie, { width: anchoPie }) + 4 : 0;
        const anchoCelda = Math.max(ancho, anchoPie);
        if (x + anchoCelda > MARGEN + ANCHO_UTIL) { x = MARGEN; yFila += filaAlto + 10; filaAlto = 0; }
        if (yFila + alto + altoPie + 10 > LIMITE_Y + 30) { doc.addPage(); x = MARGEN; yFila = doc.page.margins.top; filaAlto = 0; }
        doc.image(path.join(UPLOADS, img.archivo), x + (anchoCelda - ancho) / 2, yFila + 4, { width: ancho, height: alto });
        if (pie) {
          doc.fillColor(GRIS)
            .text(pie, x, yFila + alto + 8, { width: anchoPie, align: 'center' });
          doc.fillColor('black');
        }
        x += anchoCelda + 12;
        filaAlto = Math.max(filaAlto, alto + altoPie + 8);
      } catch { /* ilegible: se omite */ }
    }
    doc.y = yFila + filaAlto + 12;
    doc.x = MARGEN;
  }

  // ===== Firma digital =====
  // Solo cuando el informe fue firmado (admin / admin de área): nombre del
  // firmante, momento de la firma y QR a la página pública de verificación.
  if (ensayo.firmado_por) {
    salto(110);
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
      .text(ensayo.firmado_por_nombre || '', tx, yF + 25);
    doc.font('Helvetica').fontSize(8).fillColor(GRIS)
      .text(`Firmado digitalmente el / Digitally signed on: ${fechaHora(ensayo.firmado_en)}`, tx, yF + 41)
      .text(`ID de firma / Signature ID: ${String(ensayo.firma_token || '').slice(0, 16).toUpperCase()}`, tx, yF + 53)
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
      `${folioTexto(ensayo.folio)}${FORMATO_CODIGO ? ` · ${FORMATO_CODIGO} Rev. ${FORMATO_REV}` : ''} · Página ${i + 1} de ${total} / Page ${i + 1} of ${total}`,
      MARGEN, 755, { width: ANCHO_UTIL, align: 'center', lineBreak: false }
    );
    doc.page.margins.bottom = margenInferior;
  }

  doc.end();
};
