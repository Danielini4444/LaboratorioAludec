-- Firma digital de los documentos emitidos (registro de espesores y reporte
-- de ensayo). Firman solo admin, admin de Químico y admin de Metrología.
-- El token es un HMAC del documento; el QR del PDF apunta a /api/verificar.

ALTER TABLE registros_espesores
  ADD COLUMN firmado_por integer REFERENCES usuarios(id),
  ADD COLUMN firmado_en  timestamptz,
  ADD COLUMN firma_token text;

ALTER TABLE reportes_ensayo
  ADD COLUMN firmado_por integer REFERENCES usuarios(id),
  ADD COLUMN firmado_en  timestamptz,
  ADD COLUMN firma_token text;
