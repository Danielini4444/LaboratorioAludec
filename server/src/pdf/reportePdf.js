// Reporte de Test de cromado (FM-15-30, folio Ens_####), con las
// 8 secciones de "Información reportes": datos generales, identificación
// de la pieza, pruebas (norma+apartado, equipo con calibración,
// condiciones, resultado, tipo de falla, evidencia), conclusión y
// aprobaciones con espacio de firma.
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const UPLOADS = path.join(__dirname, '..', '..', 'uploads');
const LOGO = path.join(__dirname, '..', '..', 'assets', 'logo.png');
// Paleta styles.md §7: gris oscuro de marca (naranja se reserva para acentos).
const PRIMARIO = '#1d252d';
const PRIMARIO_HOVER = '#333f48';
const FONDO = '#eceded';
const BORDE = '#d0d3d4';
const GRIS = '#5b6770';
const MARGEN = 50;
const ANCHO_UTIL = 612 - 2 * MARGEN;
const LIMITE_Y = 700;
// Revisión del documento controlado FM-15-30. Actualizar aquí cuando
// metrología emita una nueva revisión del formato (es cambio de versión).
const FORMATO_REV = 'A';

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

// opciones.qr: PNG del QR de verificación cuando el reporte está firmado.
module.exports = function generarReportePdf(stream, reporte, opciones = {}) {
  const doc = new PDFDocument({ size: 'LETTER', margins: { top: MARGEN, bottom: 55, left: MARGEN, right: MARGEN }, bufferPages: true });
  doc.pipe(stream);

  const esAnulado = !!reporte.anulado_por;
  const esBorrador = !reporte.aprobado_por;
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

  // Tabla con bordes (mismo estilo del reporte de espesores).
  const tabla = (columnas, filas, altoEncabezado = 14) => {
    const anchoTotal = columnas.reduce((s, c) => s + c.ancho, 0);
    let y = doc.y;
    doc.rect(MARGEN, y, anchoTotal, altoEncabezado).fillAndStroke(FONDO, BORDE);
    let cx = MARGEN;
    for (const col of columnas) {
      doc.fillColor('black').font('Helvetica-Bold').fontSize(7)
        .text(col.titulo, cx + 2, y + 4, { width: col.ancho - 4, align: 'center' });
      doc.moveTo(cx, y).lineTo(cx, y + altoEncabezado).strokeColor(BORDE).stroke();
      cx += col.ancho;
    }
    y += altoEncabezado;
    for (const fila of filas) {
      // alto según el texto más largo de la fila
      doc.font('Helvetica').fontSize(8);
      const alto = Math.max(14, ...fila.map((celda, i) =>
        doc.heightOfString(String(celda ?? '—'), { width: columnas[i].ancho - 8 }) + 7));
      doc.rect(MARGEN, y, anchoTotal, alto).strokeColor(BORDE).stroke();
      cx = MARGEN;
      fila.forEach((celda, i) => {
        doc.fillColor('black').text(celda === null || celda === undefined ? '—' : String(celda),
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
  // logo CIE Aludec sobre el blanco + banda de título
  try { doc.image(LOGO, MARGEN, MARGEN + 5, { height: 28 }); } catch { /* sin logo: solo banda */ }
  const bandaX = MARGEN + 115;
  doc.rect(bandaX, MARGEN, ANCHO_UTIL - 150 - 115, 38).fillAndStroke(PRIMARIO, PRIMARIO);
  doc.fillColor('white').font('Helvetica-Bold')
    .fontSize(12).text('INFORME DE ENSAYOS / TEST REPORT', bandaX + 6, MARGEN + 13, { width: ANCHO_UTIL - 150 - 115 - 12, align: 'center' });
  const fx = MARGEN + ANCHO_UTIL - 145;
  doc.rect(fx, MARGEN, 145, 38).strokeColor('black').lineWidth(1.2).stroke();
  doc.fillColor(GRIS).font('Helvetica').fontSize(6.5).text('Nº Ensayo / Report No.', fx + 4, MARGEN + 5, { width: 137, align: 'center' });
  doc.fillColor('black').font('Helvetica-Bold').fontSize(14)
    .text(`Ens_${reporte.folio}`, fx + 4, MARGEN + 16, { width: 137, align: 'center' });
  doc.lineWidth(1);
  doc.y = MARGEN + 46;

  doc.fontSize(7).fillColor(GRIS).font('Helvetica')
    .text(`Código / Code: FM-15-30   ·   Emisión / Issue date: ${reporte.fecha_emision ? fecha(reporte.fecha_emision) : 'pendiente / pending'}   ·   CIE ALUDEC AUTOMOCION`,
      MARGEN, doc.y, { width: ANCHO_UTIL, align: 'center' });
  doc.fillColor('black');
  doc.y += 10;

  // ===== 1-2. Datos generales e identificación de la pieza =====
  tabla([
    { titulo: 'CLIENTE / CUSTOMER', ancho: 128 },
    { titulo: 'ÁREA SOLICITANTE / REQUESTER', ancho: 128 },
    { titulo: 'PROYECTO / PROJECT', ancho: 128 },
    { titulo: 'OF', ancho: 128 }
  ], [[reporte.cliente_nombre, reporte.area_solicitante, reporte.proyecto, reporte.of]]);

  tabla([
    { titulo: 'REFERENCIA / REFERENCE', ancho: 128 },
    { titulo: 'DENOMINACIÓN / DENOMINATION', ancho: 192 },
    { titulo: 'RECEPCIÓN / RECEPTION', ancho: 100 },
    { titulo: 'PIEZAS / PIECES', ancho: 92 }
  ], [[reporte.referencia, reporte.denominacion, fecha(reporte.fecha_recepcion), reporte.cantidad_piezas]], 18);

  if (reporte.descripcion_material) {
    tabla([{ titulo: 'DESCRIPCIÓN DEL MATERIAL ENSAYADO / TESTED MATERIAL DESCRIPTION', ancho: ANCHO_UTIL }],
      [[reporte.descripcion_material]]);
  }
  if (reporte.informacion_previa) {
    tabla([{ titulo: 'INFORMACIÓN PREVIA / PREVIOUS INFORMATION', ancho: ANCHO_UTIL }],
      [[reporte.informacion_previa]]);
  }

  // ===== 3-6. Pruebas =====
  for (const p of reporte.pruebas) {
    salto(110);
    // banner: Norma - Apartado Ensayo (como "TL 528 D-21 - 3.5.1 Grind Saw Test")
    const titulo = [p.norma, [p.apartado, p.ensayo].filter(Boolean).join(' ')].filter(Boolean).join(' - ');
    doc.rect(MARGEN, doc.y, ANCHO_UTIL, 16).fillAndStroke(PRIMARIO_HOVER, PRIMARIO_HOVER);
    doc.fillColor('white').font('Helvetica-Bold').fontSize(8.5)
      .text(`Ensayo / Test ${p.numero}:  ${titulo}`, MARGEN + 6, doc.y + 4, { width: ANCHO_UTIL - 70 });
    if (p.valoracion) {
      doc.fillColor(p.valoracion === 'OK' ? '#7ee2a0' : '#ffb3b8')
        .text(p.valoracion, MARGEN + ANCHO_UTIL - 56, doc.y - 12, { width: 50, align: 'right' });
    }
    doc.fillColor('black');
    doc.y += 6;

    tabla([
      { titulo: 'RESPONSABLE / RESPONSIBLE', ancho: 128 },
      { titulo: 'EQUIPO / EQUIPMENT', ancho: 200 },
      { titulo: 'INICIO / START', ancho: 92 },
      { titulo: 'FIN / FINISH', ancho: 92 }
    ], [[
      p.realizado_por_nombre,
      p.equipo_nombre
        ? `${p.equipo_nombre}${p.equipo_referencia ? ` (${p.equipo_referencia})` : ''}${p.equipo_calibracion ? ` · calib. ${fecha(p.equipo_calibracion)}` : ''}`
        : null,
      p.fecha_inicio ? fechaHora(p.fecha_inicio) : null,
      p.fecha_fin ? fechaHora(p.fecha_fin) : null
    ]]);

    const filasDetalle = [];
    if (p.criterios) filasDetalle.push(['Criterios de aceptación / Acceptance criteria', p.criterios]);
    if (p.condiciones) filasDetalle.push(['Condiciones de ensayo / Test conditions', p.condiciones]);
    if (p.resultado) filasDetalle.push(['Resultado / Result', p.resultado]);
    if (p.tipo_falla) filasDetalle.push(['Tipo de falla / Failure type', p.tipo_falla]);
    if (filasDetalle.length) {
      tabla([{ titulo: '', ancho: 170 }, { titulo: '', ancho: 342 }], filasDetalle, 0.001);
    }

    // evidencia fotográfica
    const fotos = (p.imagenes || []).filter(img => fs.existsSync(path.join(UPLOADS, img.archivo)));
    if (fotos.length) {
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(GRIS).text('Evidencia / Evidence:', MARGEN, doc.y);
      doc.fillColor('black');
      let x = MARGEN;
      let filaAlto = 0;
      for (const img of fotos) {
        if (x + 240 > MARGEN + ANCHO_UTIL) { x = MARGEN; doc.y += filaAlto + 8; filaAlto = 0; }
        if (doc.y + 165 > LIMITE_Y) { doc.addPage(); x = MARGEN; filaAlto = 0; }
        try {
          doc.image(path.join(UPLOADS, img.archivo), x, doc.y + 4, { fit: [240, 160] });
          x += 252;
          filaAlto = Math.max(filaAlto, 168);
        } catch { /* ilegible: se omite */ }
      }
      doc.y += filaAlto + 10;
      doc.x = MARGEN;
    }
    doc.y += 4;
  }
  if (!reporte.pruebas.length) {
    doc.font('Helvetica-Oblique').fontSize(9).fillColor(GRIS)
      .text('Sin pruebas registradas todavía / No tests recorded yet', MARGEN, doc.y);
    doc.fillColor('black');
    doc.y += 14;
  }

  // ===== 7. Conclusión =====
  salto(120);
  const cumple = reporte.conclusion === 'CUMPLE';
  doc.rect(MARGEN, doc.y, ANCHO_UTIL, 16).fillAndStroke(FONDO, BORDE);
  doc.fillColor('black').font('Helvetica-Bold').fontSize(8.5)
    .text('CONCLUSIÓN / CONCLUSION', MARGEN + 6, doc.y + 4);
  doc.y += 8;
  if (reporte.conclusion) {
    doc.font('Helvetica-Bold').fontSize(13).fillColor(cumple ? '#15803d' : '#b91c1c')
      .text(cumple ? 'CUMPLE / PASS' : 'NO CUMPLE / FAIL', MARGEN, doc.y);
    doc.fillColor('black');
    doc.y += 4;
  } else {
    doc.font('Helvetica-Oblique').fontSize(9).fillColor(GRIS).text('Pendiente / Pending', MARGEN, doc.y);
    doc.fillColor('black');
    doc.y += 4;
  }
  if (reporte.valoracion_final) {
    doc.font('Helvetica').fontSize(9).text(reporte.valoracion_final, MARGEN, doc.y, { width: ANCHO_UTIL });
    doc.y += 4;
  }
  // ===== 8. Firma digital =====
  // Solo cuando el reporte fue firmado (admin / admin de área): nombre del
  // firmante, momento de la firma y QR a la página pública de verificación.
  if (reporte.firmado_por) {
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
      .text(reporte.firmado_por_nombre || '', tx, yF + 25);
    doc.font('Helvetica').fontSize(8).fillColor(GRIS)
      .text(`Firmado digitalmente el / Digitally signed on: ${fechaHora(reporte.firmado_en)}`, tx, yF + 41)
      .text(`ID de firma / Signature ID: ${String(reporte.firma_token || '').slice(0, 16).toUpperCase()}`, tx, yF + 53)
      .text('Verifique la autenticidad escaneando el código QR / Verify authenticity by scanning the QR code',
        tx, yF + 68, { width: ANCHO_UTIL - 104 });
    doc.fillColor('black');
    doc.y = yF + 100;
  }
  // Sin firma digital no hay bloque de firmas: el responsable de cada prueba
  // queda en la tabla RESPONSABLE de cada ensayo.

  // ===== Pie de página =====
  const total = doc.bufferedPageRange().count;
  for (let i = 0; i < total; i++) {
    doc.switchToPage(i);
    const margenInferior = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.fontSize(7.5).fillColor('#777777').text(
      `Ens_${reporte.folio} · FM-15-30 Rev. ${FORMATO_REV} · Página ${i + 1} de ${total} / Page ${i + 1} of ${total}`,
      MARGEN, 755, { width: ANCHO_UTIL, align: 'center', lineBreak: false }
    );
    doc.page.margins.bottom = margenInferior;
  }

  doc.end();
};
